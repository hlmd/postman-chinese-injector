/*
 * ⚠ 非官方第三方汉化工具，与 Postman, Inc. 无任何关联；"Postman" 是 Postman, Inc. 的商标。
 */
/*
 * background.js —— 浏览器扩展的后台（MV3 service worker）：按语言设置注册内容脚本。
 *
 * 钩子必须在页面脚本之前（document_start）同步拿到译文，而 MAIN world 读不到 chrome.storage，
 * 所以由后台在设置变化 / 浏览器启动 / 安装更新时，用 chrome.scripting.registerContentScripts
 * 只为选中的语言注册「译文数据 + 钩子」。页面里永远只加载一种语言的数据。
 *
 * 语言设置存在 chrome.storage.sync 的 lang：'auto'（默认）/ 'zh-CN' / 'zh-TW'。
 * 'auto' 按浏览器的首选语言列表（navigator.languages）里第一个中文条目判断，认不出用简体。
 */
'use strict';

const SCRIPT_ID = 'pm-chinese';
const MATCHES = ['https://*.postman.co/*', 'https://*.getpostman.com/*', 'https://*.postman.com/*'];
const LANGS = ['zh-CN', 'zh-TW'];

// 把语言标签归一成 zh-CN / zh-TW；非中文返回 null（与桌面端 normalizeLang 规则一致）
function normalizeLang(tag) {
  const parts = String(tag || '').toLowerCase().split(/[-_]/).filter(Boolean);
  if (parts[0] !== 'zh') return null;
  const rest = parts.slice(1);
  if (rest.includes('hant') || rest.some((r) => r === 'tw' || r === 'hk' || r === 'mo')) return 'zh-TW';
  return 'zh-CN';
}

function detectLang(languages) {
  for (const tag of languages || []) {
    const lang = normalizeLang(tag);
    if (lang) return lang;
  }
  return 'zh-CN';
}

function browserLanguages() {
  const list = [].concat(self.navigator && navigator.languages ? navigator.languages : []);
  try { list.push(chrome.i18n.getUILanguage()); } catch (e) { /* ignore */ }
  return list;
}

async function getSetting() {
  const { lang } = await chrome.storage.sync.get({ lang: 'auto' });
  return LANGS.includes(lang) ? lang : 'auto';
}

// 设置 → 实际使用的语言
async function effectiveLang() {
  const setting = await getSetting();
  return { setting, lang: setting === 'auto' ? detectLang(browserLanguages()) : setting };
}

async function register() {
  const { lang } = await effectiveLang();
  const script = {
    id: SCRIPT_ID,
    matches: MATCHES,
    js: [`pm-i18n-data.${lang}.js`, 'pm-chinese.js', `pm-scratchpad-data.${lang}.js`, 'pm-scratchpad-cn.js'],
    runAt: 'document_start',
    world: 'MAIN',
    allFrames: true,
    persistAcrossSessions: true,
  };
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] });
  if (existing.length) await chrome.scripting.updateContentScripts([script]);
  else await chrome.scripting.registerContentScripts([script]);
  return lang;
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
chrome.runtime.onInstalled.addListener(() => { register(); });
chrome.runtime.onStartup.addListener(() => { register(); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.lang) register();
});

// 选项页 / 弹出面板查询当前状态；打开时顺带重新注册（「自动」模式下浏览器语言可能已改）
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === 'pm-state') {
    register()
      .then(() => effectiveLang())
      .then((s) => sendResponse(Object.assign(s, { detected: detectLang(browserLanguages()) })))
      .catch((e) => sendResponse({ error: String(e && e.message || e) }));
    return true; // 异步 sendResponse
  }
  return false;
});
}

// 供 Node 测试使用（浏览器里没有 module）
if (typeof module !== 'undefined') module.exports = { normalizeLang, detectLang };
