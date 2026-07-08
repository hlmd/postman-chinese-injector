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
