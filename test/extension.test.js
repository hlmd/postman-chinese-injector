'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'src', 'extension', 'background.js'), 'utf8');

// 用最小的 chrome.* 模拟跑 background.js，返回可触发事件的句柄
function load({ languages = ['en-US'], uiLang = 'en-US', stored = {} } = {}) {
  const listeners = {};
  const on = (name) => ({ addListener: (fn) => { listeners[name] = fn; } });
  const store = { ...stored };
  let registered = {}; // id -> script
  const chrome = {
    runtime: { onInstalled: on('installed'), onStartup: on('startup'), onMessage: on('message') },
    storage: {
      onChanged: on('changed'),
      sync: {
        get: async (defaults) => ({ ...defaults, ...store }),
        set: async (obj) => {
          Object.assign(store, obj);
          listeners.changed(Object.fromEntries(Object.keys(obj).map((k) => [k, { newValue: obj[k] }])), 'sync');
        },
      },
    },
    i18n: { getUILanguage: () => uiLang },
    scripting: {
      getRegisteredContentScripts: async ({ ids }) => ids.filter((id) => registered[id]).map((id) => registered[id]),
      registerContentScripts: async (list) => {
        for (const s of list) { assert.ok(!registered[s.id], '重复 register ' + s.id); registered[s.id] = s; }
      },
      unregisterContentScripts: async ({ ids }) => { for (const id of ids) delete registered[id]; },
    },
  };
  const ctx = { chrome, self: { navigator: { languages } }, navigator: { languages }, module: { exports: {} }, console };
  vm.runInNewContext(SRC, ctx);
  const tick = () => new Promise((r) => setTimeout(r, 10));
  return {
    api: ctx.module.exports,
    listeners, store, chrome, tick,
    script: () => registered['pm-chinese'],
    bridge: () => registered['pm-chinese-bridge'],
    message: (msg) => new Promise((resolve) => listeners.message(msg, {}, resolve)),
  };
}

test('detectLang：取首选语言列表里第一个中文条目', () => {
  const { api } = load();
  assert.strictEqual(api.detectLang(['en-US', 'zh-TW', 'zh-CN']), 'zh-TW');
  assert.strictEqual(api.detectLang(['zh-HK']), 'zh-TW');
  assert.strictEqual(api.detectLang(['zh-Hant-TW']), 'zh-TW');
  assert.strictEqual(api.detectLang(['zh', 'zh-TW']), 'zh-CN');
  assert.strictEqual(api.detectLang(['en-US', 'ja']), 'zh-CN');
});

test('安装时按浏览器语言注册对应语言的内容脚本（MAIN world、document_start）', async () => {
  const h = load({ languages: ['zh-TW', 'en'] });
  h.listeners.installed();
  await h.tick();
  const s = h.script();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(s.js)), ['pm-i18n-data.zh-TW.js', 'pm-chinese.js', 'pm-scratchpad-data.zh-TW.js', 'pm-scratchpad-cn.js']);
  assert.strictEqual(s.world, 'MAIN');
  assert.strictEqual(s.runAt, 'document_start');
  assert.strictEqual(s.allFrames, true);
});

test('手动指定语言后改注册；切回自动按浏览器语言', async () => {
  const h = load({ languages: ['zh-TW'] });
  h.listeners.installed();
  await h.tick();
  await h.chrome.storage.sync.set({ lang: 'zh-CN' });
  await h.tick();
  assert.strictEqual(h.script().js[0], 'pm-i18n-data.zh-CN.js');
  await h.chrome.storage.sync.set({ lang: 'auto' });
  await h.tick();
  assert.strictEqual(h.script().js[0], 'pm-i18n-data.zh-TW.js');
});

test('选项页查询状态：返回设置、实际语言与自动检测结果；非法设置按自动处理', async () => {
  const h = load({ languages: ['en-US'], uiLang: 'zh-HK', stored: { lang: 'fr' } });
  const st = await h.message({ type: 'pm-state' });
  assert.deepStrictEqual(JSON.parse(JSON.stringify(st)), { setting: 'auto', lang: 'zh-TW', detected: 'zh-TW' });
  assert.strictEqual(h.script().js[0], 'pm-i18n-data.zh-TW.js');
});

test('扩展页面引用的文件都存在', () => {
  const dir = path.join(__dirname, '..', 'src', 'extension');
  const html = fs.readFileSync(path.join(dir, 'options.html'), 'utf8');
  assert.ok(html.includes('<body>'), 'options.html 需要裸 <body> 标签（构建 popup.html 时替换）');
  assert.ok(html.includes('src="options.js"'));
  for (const id of ['legend', 'opt-auto', 'opt-off', 'auto-hint', 'status', 'reload']) assert.ok(html.includes(`id="${id}"`), id);
});

test('同时注册 ISOLATED world 的桥接脚本', async () => {
  const h = load({ languages: ['zh-CN'] });
  h.listeners.installed();
  await h.tick();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(h.bridge().js)), ['pm-bridge.js']);
  assert.strictEqual(h.bridge().world, 'ISOLATED');
});

test('页面里切换语言：写设置、重新注册后回复；off 只注册钩子不带译文', async () => {
  const h = load({ languages: ['zh-CN'] });
  h.listeners.installed();
  await h.tick();
  const r = await h.message({ type: 'pm-set-lang', lang: 'zh-TW' });
  assert.strictEqual(r.lang, 'zh-TW');
  assert.strictEqual(h.store.lang, 'zh-TW');
  assert.strictEqual(h.script().js[0], 'pm-i18n-data.zh-TW.js');
  const off = await h.message({ type: 'pm-set-lang', lang: 'off' });
  assert.strictEqual(off.lang, 'off');
  await h.tick();
  assert.deepStrictEqual(JSON.parse(JSON.stringify(h.script().js)), ['pm-i18n-off.js', 'pm-chinese.js']);
  const bad = await h.message({ type: 'pm-set-lang', lang: 'fr' });
  assert.ok(bad.error);
  assert.strictEqual(h.store.lang, 'off');
});
