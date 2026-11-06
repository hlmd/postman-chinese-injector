'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const inj = require('../postman-chinese-injector.js');

const LOCALES = path.join(__dirname, '..', 'locales');
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(LOCALES, ...p), 'utf8'));

test('normalizeLang：识别各种简繁标签', () => {
  for (const t of ['zh', 'zh-CN', 'zh_CN.UTF-8', 'zh-Hans', 'zh-Hans-CN', 'zh-SG', 'cn']) assert.strictEqual(inj.normalizeLang(t), 'zh-CN', t);
  for (const t of ['zh-TW', 'zh_TW.UTF-8', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-HK', 'tw']) assert.strictEqual(inj.normalizeLang(t), 'zh-TW', t);
  for (const t of ['en-US', 'C.UTF-8', 'ja_JP', '', null]) assert.strictEqual(inj.normalizeLang(t), null, String(t));
});

test('resolveLang：--lang > 环境变量 > 系统区域 > 默认简体', () => {
  assert.deepStrictEqual(inj.resolveLang('zh-TW', { LANG: 'zh_CN.UTF-8' }, 'zh-CN'), { lang: 'zh-TW', from: '--lang' });
  assert.strictEqual(inj.resolveLang(null, { PMCI_LANG: 'zh-TW', LANG: 'zh_CN.UTF-8' }, 'zh-CN').lang, 'zh-TW');
  assert.strictEqual(inj.resolveLang(null, { LANG: 'en_US.UTF-8' }, 'zh-HK').lang, 'zh-TW');
  assert.strictEqual(inj.resolveLang(null, {}, 'en-US').lang, 'zh-CN');
  assert.throws(() => inj.resolveLang('fr', {}), /不支持的语言/);
});

test('繁體词典可按语言加载', () => {
  assert.strictEqual(inj.loadMainDict('zh-TW').dict.File, '檔案');
  assert.ok(Object.keys(inj.loadScratchpadDict('zh-TW').dict).length > 0);
});

// 繁體由简体机器转换而来：键必须一一对应，且除汉字外（占位符、ICU、HTML、英文）完全一致
test('zh-TW 与 zh-CN 结构及非汉字内容一致', () => {
  const ascii = (s) => s.replace(/[^\x00-\x7f]/g, '');
  const diffs = [];
  const cmp = (a, b, where) => {
    if (typeof a === 'string') {
      if (typeof b !== 'string' || ascii(a) !== ascii(b)) diffs.push(where);
    } else if (a && typeof a === 'object') {
      if (JSON.stringify(Object.keys(a)) !== JSON.stringify(Object.keys(b || {}))) diffs.push(`${where}（键不同）`);
      else for (const k of Object.keys(a)) cmp(a[k], b[k], `${where}.${k}`);
    }
  };
  const cnFiles = fs.readdirSync(path.join(LOCALES, 'zh-CN')).filter((f) => f.endsWith('.json')).sort();
  const twFiles = fs.readdirSync(path.join(LOCALES, 'zh-TW')).filter((f) => f.endsWith('.json')).sort();
  assert.deepStrictEqual(twFiles, cnFiles, 'zh-TW 模块列表应与 zh-CN 相同（运行 node scripts/build-zh-tw.js）');
  for (const f of cnFiles) cmp(readJson('zh-CN', f), readJson('zh-TW', f), f);
  for (const sub of ['scratchpad', 'main']) cmp(readJson(sub, 'zh-CN.json'), readJson(sub, 'zh-TW.json'), sub);
  assert.deepStrictEqual(diffs.slice(0, 10), [], `${diffs.length} 处不一致`);
});

test('README.md 与 README.zh-TW.md 的页内锚点都能找到标题', () => {
  const { brokenAnchors } = require('../scripts/build-zh-tw.js');
  for (const f of ['README.md', 'README.zh-TW.md']) {
    const md = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    assert.deepStrictEqual(brokenAnchors(md), [], f);
  }
});
