'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const hook = require('../src/hooks/pm-chinese.js');
const main = require('../src/hooks/pm-main-cn.js');

test('parsePref：只认与当前默认语言一致的选择', () => {
  assert.strictEqual(hook.parsePref(JSON.stringify({ lang: 'zh-TW', base: 'zh-CN' }), 'zh-CN'), 'zh-TW');
  assert.strictEqual(hook.parsePref(JSON.stringify({ lang: 'zh-TW', base: 'zh-CN' }), 'zh-TW'), null);
  assert.strictEqual(hook.parsePref('zh-TW', 'zh-CN'), null);
  assert.strictEqual(hook.parsePref(null, 'zh-CN'), null);
});

test('resolveLang / dataFileFor', () => {
  assert.strictEqual(hook.resolveLang(['zh-CN', 'zh-TW'], 'zh-CN', 'zh-TW'), 'zh-TW');
  assert.strictEqual(hook.resolveLang(['zh-CN'], 'zh-CN', 'zh-TW'), 'zh-CN');
  assert.strictEqual(hook.resolveLang(['zh-CN'], 'zh-CN', 'off'), 'off');
  assert.strictEqual(hook.resolveLang(['zh-CN'], 'zh-CN', null), 'zh-CN');
  assert.strictEqual(hook.dataFileFor('pm-chinese-data.json', 'zh-CN', 'zh-CN'), 'pm-chinese-data.json');
  assert.strictEqual(hook.dataFileFor('pm-chinese-data.json', 'zh-TW', 'zh-CN'), 'pm-chinese-data.zh-TW.json');
});

test('主进程词典源：按选择切换、off 不翻译、默认语言变了旧选择作废', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pmc-main-'));
  const prefPath = path.join(dir, 'pref.json');
  fs.writeFileSync(path.join(dir, 'pm-chinese-langs.json'), JSON.stringify({ default: 'zh-CN', langs: ['zh-CN', 'zh-TW'] }));
  fs.writeFileSync(path.join(dir, 'pm-main-data.json'), JSON.stringify({ File: '文件' }));
  fs.writeFileSync(path.join(dir, 'pm-main-data.zh-TW.json'), JSON.stringify({ File: '檔案' }));
  const mk = () => main.createDictSource({ fs, path, dir, prefPath: () => prefPath });

  let src = mk();
  assert.strictEqual(main.translateString(src.get(), 'File'), '文件');
  src.set({ lang: 'zh-TW', base: 'zh-CN' });
  assert.strictEqual(main.translateString(src.get(), 'File'), '檔案');
  src = mk(); // 重启后读回
  assert.strictEqual(main.translateString(src.get(), 'File'), '檔案');
  src.set({ lang: 'off', base: 'zh-CN' });
  assert.strictEqual(src.get(), null);

  // 用 --lang zh-TW 重新注入：默认语言变了，旧选择作废
  fs.writeFileSync(path.join(dir, 'pm-chinese-langs.json'), JSON.stringify({ default: 'zh-TW', langs: ['zh-CN', 'zh-TW'] }));
  src = mk();
  assert.ok(src.get());

  // install 接受 getter：返回 null 时原样透传
  let got = null;
  const electron = { Menu: { buildFromTemplate(t) { got = t; } } };
  let c = null;
  main.install(electron, () => c);
  electron.Menu.buildFromTemplate([{ label: 'File' }]);
  assert.strictEqual(got[0].label, 'File');
  c = main.compile({ File: '文件' });
  electron.Menu.buildFromTemplate([{ label: 'File' }]);
  assert.strictEqual(got[0].label, '文件');
  fs.rmSync(dir, { recursive: true, force: true });
});
