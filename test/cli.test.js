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
