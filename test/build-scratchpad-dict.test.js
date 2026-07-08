'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { extractInto, unwrapPhp, unwrapJs } = require('../scripts/build-scratchpad-dict.js');

test('unwrapPhp 去外层引号并还原转义', () => {
  assert.strictEqual(unwrapPhp(`'"Delete"'`), '"Delete"');
  assert.strictEqual(unwrapPhp(`"'Delete'"`), "'Delete'");
  assert.strictEqual(unwrapPhp(`'"You don\\'t"'`), `"You don't"`);
  assert.strictEqual(unwrapPhp('title:"Name"'), null); // 非带引号整串
});

test('unwrapJs 去内层引号', () => {
  assert.strictEqual(unwrapJs('"Send"'), 'Send');
  assert.strictEqual(unwrapJs("'Send'"), 'Send');
  assert.strictEqual(unwrapJs('title:"Name"'), null);
});

test('extractInto 提取纯文本，跳过占位/模板/上下文，先到先得', () => {
  const php = [
    `        '"Create Collection"' => '"创建集合"',`,
    `        "'Rename'" => "'重命名'",`,
    `        '"______"' => '"______"',`,
    "        '`This ${a}`' => '`这 ${a}`',",
    `        'title:"Name"' => 'title:"名称"',`,
    `        '"Create Collection"' => '"重复应被忽略"',`,
  ].join('\n');
  const map = extractInto(php, new Map());
  assert.strictEqual(map.get('Create Collection'), '创建集合');
  assert.strictEqual(map.get('Rename'), '重命名');
  assert.strictEqual(map.has('______'), false);
  assert.ok(![...map.keys()].some((k) => k.includes('${')));
  assert.ok(![...map.keys()].some((k) => k.startsWith('title:')));
  assert.strictEqual(map.size, 2);
});
