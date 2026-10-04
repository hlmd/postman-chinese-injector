'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const inj = require('../postman-chinese-injector.js');

test('scratchpadHookSource 能取到钩子源码', () => {
  const r = inj.scratchpadHookSource();
  assert.ok(r && typeof r.src === 'string' && r.src.includes('pm-scratchpad'));
});

test('loadScratchpadDict 能取到非空词典', () => {
  const r = inj.loadScratchpadDict();
  assert.ok(r && r.dict && Object.keys(r.dict).length > 100);
});

test('findPreloadInAsar 认出 Postman 7.x 的 js/preload.js，且新版路径优先', () => {
  assert.strictEqual(inj.findPreloadInAsar(['\\main.js', '\\js\\preload.js']), 'js\\preload.js');
  assert.strictEqual(inj.findPreloadInAsar(['/js/preload.js', '/preload_desktop.js']), 'preload_desktop.js');
  assert.strictEqual(inj.findPreloadInAsar(['/preload.js']), null);
});
