/*
 * ⚠ 非官方第三方汉化工具，与 Postman, Inc. 无任何关联；"Postman" 是 Postman, Inc. 的商标。
 */
/*
 * pm-bridge.js —— 页面与扩展之间的桥（内容脚本，ISOLATED world）。
 *
 * pm-chinese.js 跑在页面的 MAIN world，读写不了 chrome.storage。用户在 Postman「设置 → 通用 → 语言」
 * 里点了「简体中文 / 繁體中文 / English / 日本語」时，它 postMessage 一条
 *   { source: 'pm-chinese', type: 'set-lang', lang, id }
 * 本脚本转给后台（写设置 + 重新注册内容脚本），完成后回一条
 *   { source: 'pm-chinese-ext', type: 'set-lang-done', id, ok }
 * 页面收到后再刷新，确保刷新时加载的已是新语言的数据。
 */
'use strict';

window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  const d = e.data;
  if (!d || d.source !== 'pm-chinese' || d.type !== 'set-lang') return;
  const reply = (ok) => window.postMessage({ source: 'pm-chinese-ext', type: 'set-lang-done', id: d.id, ok }, '*');
  try {
    chrome.runtime.sendMessage({ type: 'pm-set-lang', lang: d.lang }, (resp) => {
      reply(!chrome.runtime.lastError && !!resp && !resp.error);
    });
  } catch (err) {
    reply(false); // 扩展刚更新 / 被禁用时上下文失效
  }
});
