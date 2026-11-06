/*
 * ⚠ 免责声明：本项目为非官方第三方汉化工具，与 Postman, Inc. 无任何关联，未获其授权或背书；
 *   "Postman" 是 Postman, Inc. 的商标。本仓库不包含、也不分发 Postman 的任何源代码 / 二进制 /
 *   原始语言包。仅供个人在本地使用，使用者自负风险，请遵守 Postman 的服务条款与 EULA。
 *   代码以 MIT 许可（仅覆盖本项目自身代码，不含派生自 Postman 文案的译文数据）。
 */
/*
 * pm-chinese.js —— Postman 汉化运行时钩子（唯一真源，桌面端与浏览器扩展共用）
 *
 * 运行环境（两种，本文件自动适配）：
 *   ① 桌面端：注入进 app.asar，由 preload_desktop.js 通过 require('./pm-chinese.js') 加载；
 *      Electron 渲染进程 preload，contextIsolation=false + nodeIntegration=true，与页面共享
 *      main world 且先于页面脚本执行。翻译数据从同目录的 pm-chinese-data(.<lang>).json 用 fs 读。
 *   ② 浏览器扩展：作为 MV3 内容脚本以 world:MAIN、run_at:document_start 注入 Postman 网页版；
 *      翻译数据由前置的 pm-i18n-data.<lang>.js 预置到全局 window.__PM_I18N__（浏览器里没有 fs），
 *      当前语言写在 window.__PM_I18N_LANG__（'zh-CN' / 'zh-TW' / 'off'）。
 *
 * 原理：包装 window.fetch / XMLHttpRequest，拦截 Postman 向
 *   .../_ar-assets/locales/<lang>/<module>-<hash>.json
 * 请求的语言包响应，把对应模块的中文 deep-merge 进去。改的是 fetch 返回前的响应体，
 * 无论来自网络还是 Service Worker 缓存都生效，彻底摆脱代理 / 证书 / 缓存不稳定的问题。
 *
 * 界面内切换语言：在 Postman「设置 → 通用 → 语言」的单选组里追加「简体中文 / 繁體中文」两项。
 *   选中文 → 记住选择并重载窗口；选 English / 日本語 → 关闭汉化（'off'），显示 Postman 原文。
 *   桌面端：选择存 localStorage（键 pm-chinese:lang），并经 IPC 通知主进程钩子（原生菜单随之切换）。
 *   网页版：经 postMessage 交给扩展的桥接脚本（pm-bridge.js）写入扩展设置，后台据此重新注册数据。
 *
 * 翻译数据结构为扁平映射：
 *   { "<module>": { ...中文键树（与 Postman 原始语言包同形，供 deep-merge）... }, ... }
 * 也兼容带包装结构 { activeLang, interceptLangs, translations }。
 */
(function () {
  'use strict';
  var G = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});
  var PREF_KEY = 'pm-chinese:lang';
  var META_NAME = 'pm-chinese-langs.json';
  var DATA_NAME = 'pm-chinese-data.json';
  var LANG_NAMES = { 'zh-CN': '简体中文', 'zh-TW': '繁體中文' };
  var LANG_RADIO_NAME = 'settings-general-application-language';

  // ---------- 纯函数（供单测） ----------

  // 本地保存的选择：{ lang, base }。base 记录做选择时注入的默认语言——之后若用 --lang 换了默认语言
  // 重新注入，旧选择作废，免得命令行指定的语言被界面里的旧选择盖掉。
  function parsePref(raw, base) {
    if (!raw) return null;
    try {
      var p = JSON.parse(raw);
      if (p && typeof p.lang === 'string' && p.base === base) return p.lang;
    } catch (e) { /* 坏值当没有 */ }
    return null;
  }

  // 由「可用语言 / 默认语言 / 用户选择」得出实际语言：'off' 或 langs 之一
  function resolveLang(langs, def, pref) {
    if (pref === 'off') return 'off';
    if (pref && langs.indexOf(pref) >= 0) return pref;
    return def;
  }

  // 默认语言的数据文件不带后缀，其它语言带 .<lang>：pm-chinese-data.json / pm-chinese-data.zh-TW.json
  function dataFileFor(base, lang, def) {
    return lang === def ? base : base.replace(/\.json$/, '.' + lang + '.json');
  }

  function stripHash(name) {
    // workspace-overview-90da0a49fa99b535 -> workspace-overview
    return name.replace(/-[0-9a-f]{8,}$/, '');
  }

  function deepMerge(base, over) {
    if (base == null || typeof base !== 'object') return over;
    for (var k in over) {
      if (!Object.prototype.hasOwnProperty.call(over, k)) continue;
      var bv = base[k], ov = over[k];
      if (bv && typeof bv === 'object' && !Array.isArray(bv) &&
          ov && typeof ov === 'object' && !Array.isArray(ov)) {
        deepMerge(bv, ov);
      } else {
        base[k] = ov;
      }
    }
    return base;
  }

  var exportsObj = { parsePref: parsePref, resolveLang: resolveLang, dataFileFor: dataFileFor, stripHash: stripHash, deepMerge: deepMerge };
  if (typeof module !== 'undefined' && module.exports && typeof window === 'undefined') {
    // 在 Node 里被 require 做单测：只导出纯函数，不装钩子
    module.exports = exportsObj;
    return;
  }

  try {
    var hasRequire = typeof require === 'function';
    var isWeb = G.__PM_I18N__ !== undefined || G.__PM_I18N_LANG__ !== undefined || !hasRequire;
    var fs = null, path = null;
    if (!isWeb) { fs = require('fs'); path = require('path'); }

    function readJson(name) {
      return JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
    }
    function storageGet() {
      try { return G.localStorage ? G.localStorage.getItem(PREF_KEY) : null; } catch (e) { return null; }
    }

    // ---------- 确定语言与数据 ----------
    var LANGS, DEF, ACTIVE, I18N = null;
    // 没有 meta（旧版注入器写的数据，经在线热更新拿到了本钩子）时不知道数据是哪种语言，不显示切换选项
    var PICKER = true;
    if (isWeb) {
      LANGS = ['zh-CN', 'zh-TW'];
      ACTIVE = G.__PM_I18N_LANG__ || 'zh-CN';
      DEF = ACTIVE === 'off' ? 'zh-CN' : ACTIVE;
      I18N = ACTIVE === 'off' ? null : (G.__PM_I18N__ || null);
    } else {
      var meta = null;
      try { meta = readJson(META_NAME); } catch (e) { /* 老版本注入没有 meta：只有一种语言 */ }
      DEF = (meta && meta['default']) || 'zh-CN';
      LANGS = (meta && Array.isArray(meta.langs) && meta.langs.length) ? meta.langs : [DEF];
      PICKER = !!meta;
      ACTIVE = resolveLang(LANGS, DEF, parsePref(storageGet(), DEF));
      if (ACTIVE !== 'off') {
        try {
          I18N = readJson(dataFileFor(DATA_NAME, ACTIVE, DEF));
        } catch (e) {
          console.error('[pm-chinese] 无法读取', ACTIVE, '译文，退回默认语言:', e && e.message);
          ACTIVE = DEF;
          try { I18N = readJson(DATA_NAME); } catch (e2) {
            console.error('[pm-chinese] 无法读取 ' + DATA_NAME + ':', e2 && e2.message);
          }
        }
      }
    }
    // 供 pm-scratchpad-cn.js 等同窗口钩子读取当前语言
    G.__PM_CHINESE_LANG__ = { lang: ACTIVE, isDefault: ACTIVE === DEF, langs: LANGS };

    // 兼容两种数据结构：
    //   ① 扁平（本工具默认）：{ "<module>": { ...中文树... }, ... }
    //   ② 带包装：{ activeLang, interceptLangs, translations }（其中 translations 为 ① 的结构）
    var wrapped = I18N && I18N.translations && typeof I18N.translations === 'object';
    var TRANSLATIONS = wrapped ? I18N.translations : (I18N || {});
    var INTERCEPT_LANGS = (wrapped && I18N.interceptLangs) || ['en-US', 'ja'];
    var URL_RE = /_ar-assets\/locales\/([^/]+)\/([^/?#]+?)\.json(?:[?#]|$)/;
    // 运行中被切到 off（如用户选了日本語）后立即停止合并，Postman 随后拉的语言包保持原文
    var enabled = !!I18N;
    // Postman 实际在用的语言（en-US / ja），取自它最近请求的语言包 URL。
    // 用来判断用户在设置里点的是不是当前语言：是的话 Postman 的 onChange 会直接 return（e===o），只能由我们刷新。
    var postmanLocale = null;

    // 命中则返回合并后的 JSON 字符串，否则返回 null（透传）
    function translate(url, jsonText) {
      var m = URL_RE.exec(url);
      if (!m) return null;
      postmanLocale = m[1];
      if (!enabled) return null;
      if (INTERCEPT_LANGS.indexOf(m[1]) < 0) return null;
      var mod = stripHash(m[2]);
      var tr = TRANSLATIONS[mod];
      if (!tr) return null;
      try {
        var obj = JSON.parse(jsonText);
        deepMerge(obj, tr);
        return JSON.stringify(obj);
      } catch (e) {
        return null;
      }
    }

    function urlOf(input) {
      if (typeof input === 'string') return input;
      if (input && typeof input.url === 'string') return input.url;
      return '';
    }

    // ---- 包装 fetch ----
    if (enabled && typeof window !== 'undefined' && typeof window.fetch === 'function') {
      var _fetch = window.fetch.bind(window);
      window.fetch = function (input, init) {
        var url = urlOf(input);
        var p = _fetch(input, init);
        if (!URL_RE.test(url)) return p;
        return p.then(function (resp) {
          if (!resp || !resp.ok) return resp;
          return resp.clone().text().then(function (text) {
            var merged = translate(url, text);
            if (merged == null) return resp;
            var ct = resp.headers && resp.headers.get && resp.headers.get('content-type');
            var headers = { 'content-type': ct || 'application/json; charset=utf-8' };
            return new Response(merged, {
              status: resp.status,
              statusText: resp.statusText,
              headers: headers
            });
          }).catch(function () { return resp; });
        });
      };
    }

    // ---- 包装 XMLHttpRequest（兜底，万一某些语言包走 XHR）----
    if (enabled && typeof XMLHttpRequest !== 'undefined') {
      var _open = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (method, url) {
        this.__pmI18nUrl = url;
        return _open.apply(this, arguments);
      };
      var _send = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.send = function () {
        var xhr = this;
        var url = xhr.__pmI18nUrl || '';
        if (URL_RE.test(url)) {
          xhr.addEventListener('readystatechange', function () {
            if (xhr.readyState !== 4) return;
            try {
              var merged = translate(url, xhr.responseText);
              if (merged == null) return;
              // responseText / response 是只读的，用实例级 getter 覆盖
              Object.defineProperty(xhr, 'responseText', { configurable: true, get: function () { return merged; } });
              Object.defineProperty(xhr, 'response', { configurable: true, get: function () { return merged; } });
            } catch (e) { /* 透传 */ }
          });
        }
        return _send.apply(this, arguments);
      };
    }

    // ---------- 保存选择 ----------
    // 返回 Promise，保存好后再重载，免得网页版后台还没换好数据就刷新
    function savePref(lang) {
      if (!isWeb) {
        try { G.localStorage.setItem(PREF_KEY, JSON.stringify({ lang: lang, base: DEF })); } catch (e) { /* ignore */ }
        try { require('electron').ipcRenderer.send('pm-chinese:set-lang', { lang: lang, base: DEF }); } catch (e) { /* 主进程钩子缺失时只影响原生菜单 */ }
        return Promise.resolve(true);
      }
      return new Promise(function (resolve) {
        var id = 'pmc-' + Date.now() + '-' + Math.random().toString(36).slice(2);
        var timer = setTimeout(function () { done(false); }, 4000);
        function done(ok) {
          clearTimeout(timer);
          window.removeEventListener('message', onMsg);
          if (!ok) console.warn('[pm-chinese] 扩展没有确认语言切换（桥接脚本未加载？请到 chrome://extensions 重新加载扩展后刷新本页）');
          resolve(ok);
        }
        function onMsg(e) {
          var d = e.data;
          if (e.source === window && d && d.source === 'pm-chinese-ext' && d.type === 'set-lang-done' && d.id === id) done(!!d.ok);
        }
        window.addEventListener('message', onMsg);
        window.postMessage({ source: 'pm-chinese', type: 'set-lang', lang: lang, id: id }, '*');
      });
    }

    // ---------- 设置页语言单选组：追加中文选项 ----------
    function installPicker(doc) {
      var CLS = { on: null, off: null }; // Postman 单选圆点「选中 / 未选中」两种样式类（styled-components 生成）
      var nativeValue = null;            // Postman 自身当前语言（en-US / ja），首次见到单选组时记下
      var busy = false;

      function dot(input) {
        var el = input && input.previousElementSibling;
        return el && el.tagName === 'DIV' ? el : null;
      }
      function setRadio(input, on) {
        if (input.checked !== on) input.checked = on;
        input.setAttribute('aria-checked', on ? 'true' : 'false');
        var d = dot(input), cls = on ? CLS.on : CLS.off;
        if (d && cls && d.className !== cls) d.className = cls;
      }
      // 原生单选的公共父容器（一行选项）与每个选项的外层包裹
      function rowOf(inputs) {
        var row = inputs[0].parentElement;
        var last = inputs[inputs.length - 1];
        while (row && !row.contains(last)) row = row.parentElement;
        return row;
      }
      function wrapperOf(row, input) {
        var el = input;
        while (el && el.parentElement !== row) el = el.parentElement;
        return el;
      }

      function choose(lang, row) {
        if (busy || lang === ACTIVE) return;
        busy = true;
        var ours = row.querySelectorAll('input[data-pm-chinese]');
        for (var i = 0; i < ours.length; i++) setRadio(ours[i], ours[i].value === lang);
        if (lang === 'off') enabled = false;
        savePref(lang).then(function () { location.reload(); });
      }

      function sync(row, natives) {
        var ours = row.querySelectorAll('input[data-pm-chinese]');
        for (var i = 0; i < ours.length; i++) setRadio(ours[i], ours[i].value === ACTIVE);
        if (ACTIVE !== 'off') for (var j = 0; j < natives.length; j++) setRadio(natives[j], false);
      }

      function inject(row, natives) {
        var template = null;
        for (var i = 0; i < natives.length; i++) {
          var n = natives[i], d = dot(n);
          if (n.checked) {
            if (nativeValue == null) nativeValue = n.value;
            if (d && !CLS.on) CLS.on = d.className;
          } else {
            if (d && !CLS.off) CLS.off = d.className;
            if (!template) template = wrapperOf(row, n);
          }
        }
        if (!template) template = wrapperOf(row, natives[natives.length - 1]);
        if (!template) return;
        LANGS.forEach(function (lang) {
          var w = template.cloneNode(true);
          var input = w.querySelector('input');
          var label = w.querySelector('label');
          if (!input) return;
          w.setAttribute('data-pm-chinese-option', lang);
          input.id = 'pm-chinese-' + lang;
          input.name = 'pm-chinese-language';
          input.value = lang;
          input.setAttribute('data-pm-chinese', lang);
          input.removeAttribute('checked');
          input.checked = false;
          if (label) { label.htmlFor = input.id; label.textContent = LANG_NAMES[lang] || lang; }
          input.addEventListener('change', function () { if (input.checked) choose(lang, row); });
          // 原生选项的圆点能点，靠的是外层容器上的 React 点击处理器；克隆出来的节点没有 React 绑定，
          // 只剩 <label for> 能触发。所以整个选项（圆点 / 空白处 / 文字）都自己接管点击，choose 内部去重。
          w.addEventListener('click', function () { choose(lang, row); });
          w.style.cursor = 'pointer';
          row.appendChild(w);
        });
        // 原生选项（English / 日本語）：汉化开着时点它 = 关闭汉化。
        //   点的正是 Postman 当前语言时 Postman 不会有动作，由我们重载；否则交给 Postman 自己切换。
        //   监听捕获阶段的 click 而不是 change：Postman 的单选组件会 preventDefault 自己接管选中状态，
        //   原生 change 事件根本不触发。点标签 / 圆点 / input 都算（标签点击会再派发一次 input 的 click，由 busy 去重）。
        row.addEventListener('click', function (e) {
          if (ACTIVE === 'off' || busy) return;
          var w = e.target && e.target.closest ? e.target.closest('[data-pm-chinese-option]') : null;
          if (w) return; // 我们自己的中文选项
          var el = e.target, t = null;
          while (el && el !== row) {
            if (el.querySelector) t = el.querySelector('input[name="' + LANG_RADIO_NAME + '"]');
            if (t || (el.name === LANG_RADIO_NAME && (t = el))) break;
            el = el.parentElement;
          }
          if (!t) return;
          busy = true;
          enabled = false; // 立即停止合并，Postman 接下来拉的日文 / 英文语言包保持原文
          var ours = row.querySelectorAll('input[data-pm-chinese]');
          for (var k = 0; k < ours.length; k++) setRadio(ours[k], false);
          setRadio(t, true);
          var current = postmanLocale || nativeValue || 'en-US';
          var same = t.value === current;
          console.log('[pm-chinese] 关闭汉化：点了', t.value, '| Postman 当前语言', current, same ? '→ 刷新' : '→ 交给 Postman 切换');
          savePref('off').then(function () {
            if (same) { location.reload(); return; }
            ACTIVE = 'off'; // 交给 Postman 切换；之后不再干预原生选项，也能再点回中文
            busy = false;
          });
        }, true);
      }

      function scan() {
        var natives = doc.querySelectorAll('input[name="' + LANG_RADIO_NAME + '"]');
        if (!natives.length) return;
        var row = rowOf(natives);
        if (!row) return;
        if (!row.querySelector('input[data-pm-chinese]')) inject(row, natives);
        if (!busy) sync(row, natives);
      }

      var queued = false;
      function schedule() {
        if (queued) return;
        queued = true;
        setTimeout(function () { queued = false; try { scan(); } catch (e) { /* ignore */ } }, 0);
      }
      function start() {
        if (!doc.documentElement) return;
        new MutationObserver(schedule).observe(doc.documentElement, { childList: true, subtree: true });
        schedule();
      }
      if (doc.documentElement) start();
      else doc.addEventListener('DOMContentLoaded', start);
    }

    if (PICKER && typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
      try { installPicker(document); } catch (e) { console.error('[pm-chinese] 语言选项注入失败:', e); }
    }

    console.log('[pm-chinese] 已注入，语言:', ACTIVE,
      '| 可选:', LANGS.join(','),
      '| 拦截:', enabled ? INTERCEPT_LANGS.join(',') : '（已关闭）',
      '| 模块数:', Object.keys(TRANSLATIONS).length);
  } catch (e) {
    console.error('[pm-chinese] 初始化失败:', e);
  }
})();
