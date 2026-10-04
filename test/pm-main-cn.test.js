'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const hook = require('../pm-main-cn.js');
const inj = require('../postman-chinese-injector.js');

const c = hook.compile({ File: '文件', 'New Tab': '新建标签页', 'About {{appName}}': '关于 {{appName}}' });

test('translateString：整串精确匹配、保留空白、未命中原样返回', () => {
  assert.strictEqual(hook.translateString(c, 'File'), '文件');
  assert.strictEqual(hook.translateString(c, ' New Tab '), ' 新建标签页 ');
  assert.strictEqual(hook.translateString(c, 'New Tabs'), 'New Tabs');
  assert.strictEqual(hook.translateString(c, 'About Postman'), '关于 Postman');
});

test('translateTemplate：递归翻译 label，不改原模板，保留其它字段', () => {
  const click = () => {};
  const tpl = [{ label: 'File', id: 'f', submenu: [{ label: 'New Tab', accelerator: 'CmdOrCtrl+T', click }, { type: 'separator' }] }];
  const out = hook.translateTemplate(c, tpl);
  assert.strictEqual(out[0].label, '文件');
  assert.strictEqual(out[0].id, 'f');
  assert.strictEqual(out[0].submenu[0].label, '新建标签页');
  assert.strictEqual(out[0].submenu[0].accelerator, 'CmdOrCtrl+T');
  assert.strictEqual(out[0].submenu[0].click, click);
  assert.deepStrictEqual(out[0].submenu[1], { type: 'separator' });
  assert.strictEqual(tpl[0].label, 'File');
});

test('install：包装 Menu.buildFromTemplate 与 dialog.showMessageBox，且只包一次', () => {
  let got = null, box = null;
  const electron = {
    Menu: { buildFromTemplate(t) { got = t; return 'menu'; } },
    dialog: { showMessageBox(win, opts) { box = opts; return 1; } },
  };
  hook.install(electron, { File: '文件', Cancel: '取消' });
  hook.install(electron, { File: '文件', Cancel: '取消' });
  assert.strictEqual(electron.Menu.buildFromTemplate([{ label: 'File' }]), 'menu');
  assert.strictEqual(got[0].label, '文件');
  electron.dialog.showMessageBox({}, { title: 'File', buttons: ['Cancel', 'OK'] });
  assert.deepStrictEqual(box.buttons, ['取消', 'OK']);
  assert.strictEqual(box.title, '文件');
});

test('injectMainEntry：插在最前（或 use strict 之后）且幂等', () => {
  const once = inj.injectMainEntry('(()=>{})();\n');
  assert.ok(once.startsWith('// === PM-I18N START ==='));
  assert.strictEqual(inj.injectMainEntry(once), once);
  assert.strictEqual(inj.stripBlock(once), '(()=>{})();\n');
  const strict = inj.injectMainEntry('"use strict";\nfoo();\n');
  assert.ok(strict.startsWith('"use strict";\n// === PM-I18N START ==='));
});

test('mainHookSource / loadMainDict 可用', () => {
  assert.ok(inj.mainHookSource().src.includes('buildFromTemplate'));
  assert.ok(Object.keys(inj.loadMainDict().dict).length > 50);
});

test('translateTemplate：只写 role 的菜单项按 Electron 默认标签补上中文 label', () => {
  const cc = hook.compile({ Undo: '撤销', 'Paste and Match Style': '粘贴并匹配样式' });
  const out = hook.translateTemplate(cc, [
    { role: 'undo' },
    { role: 'pasteAndMatchStyle' },
    { role: 'zoomIn' },
    { role: 'undo', label: 'Custom' },
  ]);
  assert.strictEqual(out[0].label, '撤销');
  assert.strictEqual(out[0].role, 'undo');
  assert.strictEqual(out[1].label, '粘贴并匹配样式');
  assert.strictEqual('label' in out[2], false);
  assert.strictEqual(out[3].label, 'Custom');
});

test('translateTemplate：Windows 上 role quit 补成「Exit」的译文', { skip: process.platform !== 'win32' }, () => {
  const cc = hook.compile({ Exit: '退出' });
  assert.strictEqual(hook.translateTemplate(cc, [{ role: 'quit' }])[0].label, '退出');
});
