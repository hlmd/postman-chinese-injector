'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('child_process');
const path = require('path');
const inj = require('../postman-chinese-injector.js');

const CLI = path.join(__dirname, '..', 'postman-chinese-injector.js');
const run = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' });

test('parseArgs：命令、默认 apply、verify 别名与旧开关', () => {
  assert.strictEqual(inj.parseArgs([]).cmd, 'apply');
  assert.strictEqual(inj.parseArgs(['--offline']).cmd, 'apply');
  assert.strictEqual(inj.parseArgs(['restore']).cmd, 'restore');
  assert.strictEqual(inj.parseArgs(['--restore']).cmd, 'restore');
  assert.strictEqual(inj.parseArgs(['--status']).cmd, 'status');
  assert.strictEqual(inj.parseArgs(['verify']).cmd, 'status');
  assert.strictEqual(inj.parseArgs(['--lang']).opts.lang, '');
  assert.strictEqual(inj.parseArgs(['--lang=zh-TW']).opts.lang, 'zh-TW');
  assert.strictEqual(inj.parseArgs(['apply', '--resources', 'x']).opts.resources, 'x');
  assert.throws(() => inj.parseArgs(['foo']), /未知命令/);
  assert.throws(() => inj.parseArgs(['--bogus']), /未知参数/);
  assert.throws(() => inj.parseArgs(['--resources']), /需要一个值/);
});

test('-v / version 输出「名称 v版本」', () => {
  const v = require('../package.json').version;
  for (const a of [['-v'], ['--version'], ['version'], ['status', '-v']]) {
    const r = run(...a);
    assert.strictEqual(r.status, 0);
    assert.strictEqual(r.stdout.trim(), `postman-chinese-injector v${v}`);
  }
});

test('-h / help 列出命令与语言', () => {
  for (const a of [['-h'], ['help'], ['restore', '--help']]) {
    const r = run(...a);
    assert.strictEqual(r.status, 0);
    for (const s of ['apply', 'restore', 'status', 'langs', '--lang', 'zh-TW']) assert.ok(r.stdout.includes(s), s);
  }
});

test('--lang 不带代码列出语言；langs 显示覆盖率；未知命令退出码 2', () => {
  const l = run('--lang');
  assert.strictEqual(l.status, 0);
  assert.match(l.stdout, /zh-CN\s+简体中文[\s\S]*zh-TW\s+繁體中文/);
  const g = run('langs', '--lang', 'zh-TW');
  assert.strictEqual(g.status, 0);
  assert.match(g.stdout, /\*zh-TW/);
  assert.strictEqual(run('foo').status, 2);
});

test('errorHints：文件被占用 / 权限 / 运行中给出解决办法，其他错误不输出', () => {
  const { errorHints } = require('../postman-chinese-injector.js');
  const busy = errorHints({ code: 'EBUSY' }).join('\n');
  assert.match(busy, /Postman 仍在运行/);
  assert.match(busy, /重新运行本命令/);
  assert.match(errorHints({ code: 'PM_RUNNING' }).join('\n'), /解决办法/);
  assert.match(errorHints({ code: 'ENOSPC' }).join('\n'), /磁盘空间/);
  assert.deepStrictEqual(errorHints({ code: 'ENOENT' }), []);
  assert.deepStrictEqual(errorHints(new Error('x')), []);
});

test('syncChangedFiles：只复制有变化或缺失的文件，内容相同的不碰', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { syncChangedFiles } = require('../postman-chinese-injector.js');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pmci-sync-'));
  const from = path.join(root, 'from'), to = path.join(root, 'to');
  fs.mkdirSync(path.join(from, 'a'), { recursive: true });
  fs.mkdirSync(path.join(to, 'a'), { recursive: true });
  fs.writeFileSync(path.join(from, 'a', 'same.node'), 'same');
  fs.writeFileSync(path.join(to, 'a', 'same.node'), 'same');
  fs.writeFileSync(path.join(from, 'a', 'diff.node'), 'new');
  fs.writeFileSync(path.join(to, 'a', 'diff.node'), 'old');
  fs.writeFileSync(path.join(from, 'a', 'missing.node'), 'm');
  const t0 = fs.statSync(path.join(to, 'a', 'same.node')).mtimeMs;
  assert.strictEqual(syncChangedFiles(from, to), 2);
  assert.strictEqual(fs.readFileSync(path.join(to, 'a', 'diff.node'), 'utf8'), 'new');
  assert.strictEqual(fs.readFileSync(path.join(to, 'a', 'missing.node'), 'utf8'), 'm');
  assert.strictEqual(fs.statSync(path.join(to, 'a', 'same.node')).mtimeMs, t0);
  fs.rmSync(root, { recursive: true, force: true });
});
