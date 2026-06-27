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
 *      main world 且先于页面脚本执行。翻译数据从同目录的 pm-chinese-data.json 用 fs 读。
 *   ② 浏览器扩展：作为 MV3 内容脚本以 world:MAIN、run_at:document_start 注入 Postman 网页版；
 *      翻译数据由前置的 pm-i18n-data.js 预置到全局 window.__PM_I18N__（浏览器里没有 fs）。
 *
 * 原理：包装 window.fetch / XMLHttpRequest，拦截 Postman 向
 *   .../_ar-assets/locales/<lang>/<module>-<hash>.json
 * 请求的语言包响应，把对应模块的中文 deep-merge 进去。改的是 fetch 返回前的响应体，
 * 无论来自网络还是 Service Worker 缓存都生效，彻底摆脱代理 / 证书 / 缓存不稳定的问题。
 *
 * 翻译数据结构为扁平映射：
 *   { "<module>": { ...中文键树（与 Postman 原始语言包同形，供 deep-merge）... }, ... }
 * 也兼容带包装结构 { activeLang, interceptLangs, translations }。
 */
(function () {
  'use strict';
  try {
    var I18N = null;
    // 数据来源①：浏览器扩展在 MAIN world 预置的全局（由 pm-i18n-data.js 设置）
    if (typeof globalThis !== 'undefined' && globalThis.__PM_I18N__) {
      I18N = globalThis.__PM_I18N__;
    } else if (typeof require === 'function') {
      // 数据来源②：桌面端 asar 内与本文件同目录的 pm-chinese-data.json
      try {
        var fs = require('fs');
        var path = require('path');
        I18N = JSON.parse(fs.readFileSync(path.join(__dirname, 'pm-chinese-data.json'), 'utf8'));
      } catch (e) {
        console.error('[pm-chinese] 无法读取 pm-chinese-data.json:', e && e.message);
        return;
      }
    }
    if (!I18N) {
      console.error('[pm-chinese] 未找到翻译数据（既无 __PM_I18N__ 全局，也无 pm-chinese-data.json）');
      return;
    }

    // 兼容两种数据结构：
    //   ① 扁平（本工具默认）：{ "<module>": { ...中文树... }, ... }
    //   ② 带包装：{ activeLang, interceptLangs, translations }（其中 translations 为 ① 的结构）
    var wrapped = I18N && I18N.translations && typeof I18N.translations === 'object';
    var TRANSLATIONS = wrapped ? I18N.translations : (I18N || {});
    var INTERCEPT_LANGS = (wrapped && I18N.interceptLangs) || ['en-US', 'ja'];
    var ACTIVE_LANG = (wrapped && I18N.activeLang) || 'zh-CN';
    var URL_RE = /_ar-assets\/locales\/([^/]+)\/([^/?#]+?)\.json(?:[?#]|$)/;

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

    // 命中则返回合并后的 JSON 字符串，否则返回 null（透传）
    function translate(url, jsonText) {
      var m = URL_RE.exec(url);
      if (!m) return null;
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
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
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
    if (typeof XMLHttpRequest !== 'undefined') {
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

    console.log('[pm-chinese] 已注入，语言:', ACTIVE_LANG,
      '| 拦截:', INTERCEPT_LANGS.join(','),
      '| 模块数:', Object.keys(TRANSLATIONS).length);
  } catch (e) {
    console.error('[pm-chinese] 初始化失败:', e);
  }
})();
