'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const hook = require('../pm-scratchpad-cn.js');
const { translateString, isSkippableEl, inSkippableSubtree, isActive, translateAttributes, loadDict } = hook;

const DICT = { 'Send': '发送', 'New Request': '新建请求', 'Delete': '删除' };

// 造一个假元素
function fakeEl(tagName, attrs) {
  attrs = attrs || {};
  return {
    nodeType: 1,
    tagName: tagName,
    parentNode: null,
    _a: Object.assign({}, attrs),
    getAttribute(n) { return Object.prototype.hasOwnProperty.call(this._a, n) ? this._a[n] : null; },
    setAttribute(n, v) { this._a[n] = v; }
  };
}
function fakeText(value, parent) {
  return { nodeType: 3, nodeValue: value, parentNode: parent || null };
}

test('translateString 精确匹配并保留前后空白', () => {
  assert.strictEqual(translateString(DICT, 'Send'), '发送');
  assert.strictEqual(translateString(DICT, '  New Request  '), '  新建请求  ');
  assert.strictEqual(translateString(DICT, '\nDelete\n'), '\n删除\n');
});

test('translateString 无匹配/非串返回 null（不误伤）', () => {
  assert.strictEqual(translateString(DICT, 'Send this'), null);
  assert.strictEqual(translateString(DICT, 'GET /users'), null);
  assert.strictEqual(translateString(DICT, ''), null);
  assert.strictEqual(translateString(DICT, null), null);
});

test('translateString 翻译关于页「标签 + 版本值」行，普通句子不误伤', () => {
  assert.strictEqual(translateString(DICT, 'Version 10.12.11'), '版本 10.12.11');
  assert.strictEqual(translateString(DICT, 'UI Version 10.12.11-ui-230406-1230'), 'UI 版本 10.12.11-ui-230406-1230');
  assert.strictEqual(translateString(DICT, 'Desktop Platform Version 10.12.0'), '桌面平台版本 10.12.0');
  assert.strictEqual(translateString(DICT, 'Architecture x64'), '架构 x64');
  assert.strictEqual(translateString(DICT, 'OS Platform win32 10.0.26300'), '操作系统平台 win32 10.0.26300');
  assert.strictEqual(translateString(DICT, 'Version control is great'), null);
  assert.strictEqual(translateString(DICT, 'Version history'), null);
});

test('isSkippableEl 命中可编辑/代码区', () => {
  assert.strictEqual(isSkippableEl(fakeEl('INPUT')), true);
  assert.strictEqual(isSkippableEl(fakeEl('TEXTAREA')), true);
  assert.strictEqual(isSkippableEl(fakeEl('DIV', { contenteditable: 'true' })), true);
  assert.strictEqual(isSkippableEl(fakeEl('DIV', { contenteditable: '' })), true);
  assert.strictEqual(isSkippableEl(fakeEl('DIV', { contenteditable: 'false' })), false);
  assert.strictEqual(isSkippableEl(fakeEl('DIV', { class: 'x CodeMirror y' })), true);
  assert.strictEqual(isSkippableEl(fakeEl('DIV', { class: 'monaco-editor' })), true);
  assert.strictEqual(isSkippableEl(fakeEl('DIV', { class: 'btn' })), false);
});

test('inSkippableSubtree 向上遍历祖先', () => {
  const editor = fakeEl('DIV', { class: 'CodeMirror' });
  const inner = fakeEl('SPAN'); inner.parentNode = editor;
  const t = fakeText('Delete', inner);
  assert.strictEqual(inSkippableSubtree(t), true);
  const plain = fakeEl('DIV', { class: 'toolbar' });
  const t2 = fakeText('Delete', plain);
  assert.strictEqual(inSkippableSubtree(t2), false);
});

test('inSkippableSubtree 放行编辑器占位提示', () => {
  const monaco = fakeEl('DIV', { class: 'monaco-editor' });
  const ph = fakeEl('SPAN', { class: 'monaco-placeholder' }); ph.parentNode = monaco;
  assert.strictEqual(inSkippableSubtree(fakeText('Use JavaScript', ph)), false);
  const slate = fakeEl('DIV', { contenteditable: 'true' });
  const sph = fakeEl('SPAN', { 'data-slate-placeholder': 'true', contenteditable: 'false' }); sph.parentNode = slate;
  const inner = fakeEl('SPAN'); inner.parentNode = sph;
  assert.strictEqual(inSkippableSubtree(fakeText('Add a description', inner)), false);
  const bot = fakeEl('DIV', { 'data-testid': 'inline-postbot-container' }); bot.parentNode = monaco;
  const p = fakeEl('P'); p.parentNode = bot;
  assert.strictEqual(inSkippableSubtree(fakeText('Close', p)), false);
  // 编辑器正文仍跳过
  const line = fakeEl('SPAN', { class: 'mtk1' }); line.parentNode = monaco;
  assert.strictEqual(inSkippableSubtree(fakeText('Delete', line)), true);
});

test('isActive 覆盖 Postman 完整版上下文（网页版 + 桌面 file:// 窗口）', () => {
  // 桌面端：所有 Postman Electron 窗口均为 file://（Scratch Pad 与登入态主窗口都算）
  assert.strictEqual(isActive({ protocol: 'file:', pathname: '/C:/x/html/scratchpad.html' }), true);
  assert.strictEqual(isActive({ protocol: 'file:', pathname: '/C:/x/html/index.html' }), true);
  // 网页版：host 属于 Postman 域名
  assert.strictEqual(isActive({ protocol: 'https:', hostname: 'go.postman.co' }), true);
  assert.strictEqual(isActive({ protocol: 'https:', hostname: 'web.postman.co' }), true);
  assert.strictEqual(isActive({ protocol: 'https:', hostname: 'app.getpostman.com' }), true);
  // 无关域名不激活；且锚定防止 evil-postman.com / notpostman.com 误命中
  assert.strictEqual(isActive({ protocol: 'https:', hostname: 'example.com' }), false);
  assert.strictEqual(isActive({ protocol: 'https:', hostname: 'notpostman.com' }), false);
  assert.strictEqual(isActive({ protocol: 'https:', hostname: 'evil-postman.com.attacker.net' }), false);
  assert.strictEqual(isActive(null), false);
});

test('isActive 在扩展上下文（已注入全局词典）兜底为真', () => {
  const g = globalThis;
  assert.strictEqual('__PM_SCRATCHPAD__' in g, false);
  try {
    g.__PM_SCRATCHPAD__ = { Send: '发送' };
    assert.strictEqual(isActive({ protocol: 'https:', hostname: 'example.com' }), true);
  } finally {
    delete g.__PM_SCRATCHPAD__;
  }
});

test('loadDict 优先返回全局 __PM_SCRATCHPAD__', () => {
  const g = globalThis;
  const dict = { Send: '发送', Delete: '删除' };
  try {
    g.__PM_SCRATCHPAD__ = dict;
    assert.strictEqual(loadDict(), dict);
  } finally {
    delete g.__PM_SCRATCHPAD__;
  }
});

test('translateAttributes 翻译 placeholder/title/aria-label', () => {
  const el = fakeEl('DIV', { placeholder: 'Send', title: 'Delete', 'aria-label': 'New Request', other: 'Send' });
  translateAttributes(DICT, el);
  assert.strictEqual(el.getAttribute('placeholder'), '发送');
  assert.strictEqual(el.getAttribute('title'), '删除');
  assert.strictEqual(el.getAttribute('aria-label'), '新建请求');
  assert.strictEqual(el.getAttribute('other'), 'Send'); // 非白名单属性不动
});

test('translateSearchInputValue 只译下拉选择框里的白名单值，聚焦时不译', () => {
  const dict = { 'No Environment': '没有环境', 'Production': '生产' };
  const sel = Object.assign(fakeEl('INPUT', { class: 'input input-search' }), { value: 'No Environment' });
  assert.strictEqual(hook.translateSearchInputValue(dict, sel, null), '没有环境');
  assert.strictEqual(hook.translateSearchInputValue(dict, sel, sel), null);
  const env = Object.assign(fakeEl('INPUT', { class: 'input input-search' }), { value: 'Production' });
  assert.strictEqual(hook.translateSearchInputValue(dict, env, null), null);
  const plain = Object.assign(fakeEl('INPUT', { class: 'input' }), { value: 'No Environment' });
  assert.strictEqual(hook.translateSearchInputValue(dict, plain, null), null);
});

test('translateString 翻译带动态计数的查找替换文案', () => {
  assert.strictEqual(translateString(DICT, 'Collections (0)'), '集合 (0)');
  assert.strictEqual(translateString(DICT, 'Environments (12)'), '环境 (12)');
  assert.strictEqual(translateString(DICT, 'Replace in 3 selected'), '在选中的 3 项中替换');
  assert.strictEqual(translateString(DICT, '1 lesson'), '1 节课');
  assert.strictEqual(translateString(DICT, '4 lessons'), '4 节课');
  assert.strictEqual(translateString(DICT, 'Current Version: v7.36.7'), '当前版本：v7.36.7');
  assert.strictEqual(translateString(DICT, 'Collections (abc)'), null);
});

test('translateString 翻译单值的 e.g. 占位示例', () => {
  assert.strictEqual(translateString(DICT, 'e.g. us-east-1'), '例如 us-east-1');
  assert.strictEqual(translateString(DICT, 'e.g. read:org'), '例如 read:org');
  assert.strictEqual(translateString(DICT, 'e.g. this is a sentence'), null);
});

test('translateString 翻译「词条 + 括号快捷键」提示，快捷键原样保留', () => {
  const dict = { 'Single pane view': '单窗格视图', 'Two pane view': '双窗格视图' };
  assert.strictEqual(translateString(dict, 'Single pane view (Ctrl + Alt + V)'), '单窗格视图 (Ctrl + Alt + V)');
  assert.strictEqual(translateString(dict, 'Two pane view (⌘ + ⌥ + V)'), '双窗格视图 (⌘ + ⌥ + V)');
  assert.strictEqual(translateString(dict, 'Single pane view (beta)'), null);
  assert.strictEqual(translateString(dict, 'Unknown thing (Ctrl + K)'), null);
});

test('translateString 翻译活动流的日期与时间', () => {
  assert.strictEqual(translateString(DICT, ' September 29, 2026 '), ' 2026年9月29日 ');
  assert.strictEqual(translateString(DICT, '3:28 PM'), '下午 3:28');
  assert.strictEqual(translateString(DICT, '11:05 AM'), '上午 11:05');
  assert.strictEqual(translateString(DICT, 'Septembre 29, 2026'), null);
});
