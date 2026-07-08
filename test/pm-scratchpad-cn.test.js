'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const hook = require('../pm-scratchpad-cn.js');
const { translateString, isSkippableEl, inSkippableSubtree, isActive, translateAttributes } = hook;

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

test('isActive 只在 file:// + scratchpad 路径为真', () => {
  assert.strictEqual(isActive({ protocol: 'file:', pathname: '/C:/x/html/scratchpad.html' }), true);
  assert.strictEqual(isActive({ protocol: 'https:', pathname: '/scratchpad' }), false);
  assert.strictEqual(isActive({ protocol: 'file:', pathname: '/C:/x/html/console.html' }), false);
  assert.strictEqual(isActive(null), false);
});

test('translateAttributes 翻译 placeholder/title/aria-label', () => {
  const el = fakeEl('DIV', { placeholder: 'Send', title: 'Delete', 'aria-label': 'New Request', other: 'Send' });
  translateAttributes(DICT, el);
  assert.strictEqual(el.getAttribute('placeholder'), '发送');
  assert.strictEqual(el.getAttribute('title'), '删除');
  assert.strictEqual(el.getAttribute('aria-label'), '新建请求');
  assert.strictEqual(el.getAttribute('other'), 'Send'); // 非白名单属性不动
});
