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
