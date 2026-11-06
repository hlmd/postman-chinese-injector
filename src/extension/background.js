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
 * 语言设置存在 chrome.storage.sync 的 lang：'auto'（默认）/ 'zh-CN' / 'zh-TW' / 'off'（关闭，显示原文）。
 * 'auto' 按浏览器的首选语言列表（navigator.languages）里第一个中文条目判断，认不出用简体。
 * 'off' 时仍注册钩子（不带译文），让 Postman 设置页的语言单选组里保留中文选项，可随时切回。
 *
 * 另注册一个 ISOLATED world 的桥接脚本 pm-bridge.js：页面里在「设置 → 通用 → 语言」切换语言时，
 * 经它发来 { type: 'pm-set-lang' }，这里写设置并重新注册好再回复，页面随后刷新。
 */
'use strict';

const SCRIPT_ID = 'pm-chinese';
const BRIDGE_ID = 'pm-chinese-bridge';
const MATCHES = ['https://*.postman.co/*', 'https://*.getpostman.com/*', 'https://*.postman.com/*'];
// 不汉化的 Postman 站点：学习中心（文档站，保持英文原文）
const EXCLUDE_MATCHES = ['https://learning.postman.com/*'];
const LANGS = ['zh-CN', 'zh-TW'];
const SETTINGS = ['auto', 'off', ...LANGS];

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
  return SETTINGS.includes(lang) ? lang : 'auto';
}

// 设置 → 实际使用的语言
async function effectiveLang() {
  const setting = await getSetting();
  return { setting, lang: setting === 'auto' ? detectLang(browserLanguages()) : setting };
}

function scriptsFor(lang) {
  const js = lang === 'off'
    ? ['pm-i18n-off.js', 'pm-chinese.js']
    : [`pm-i18n-data.${lang}.js`, 'pm-chinese.js', `pm-scratchpad-data.${lang}.js`, 'pm-scratchpad-cn.js'];
  return [
    { id: SCRIPT_ID, matches: MATCHES, excludeMatches: EXCLUDE_MATCHES, js, runAt: 'document_start', world: 'MAIN', allFrames: true, persistAcrossSessions: true },
    { id: BRIDGE_ID, matches: MATCHES, excludeMatches: EXCLUDE_MATCHES, js: ['pm-bridge.js'], runAt: 'document_start', world: 'ISOLATED', allFrames: true, persistAcrossSessions: true },
  ];
}

// 串行执行，避免设置变化与页面请求同时触发两次注册而撞 id
let queue = Promise.resolve();
function register() {
  const run = queue.then(async () => {
    const { lang } = await effectiveLang();
    const scripts = scriptsFor(lang);
    const ids = scripts.map((s) => s.id);
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids });
    if (existing.length) await chrome.scripting.unregisterContentScripts({ ids: existing.map((s) => s.id) });
    await chrome.scripting.registerContentScripts(scripts);
    return lang;
  });
  queue = run.catch(() => {});
  return run;
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onInstalled) {
chrome.runtime.onInstalled.addListener(() => { register(); });
chrome.runtime.onStartup.addListener(() => { register(); });
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.lang) register();
});

// 选项页 / 弹出面板查询当前状态；打开时顺带重新注册（「自动」模式下浏览器语言可能已改）
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // 页面里（Postman 设置 → 通用 → 语言）切换：写设置并等重新注册完成再回复
  if (msg && msg.type === 'pm-set-lang') {
    if (!SETTINGS.includes(msg.lang)) { sendResponse({ error: 'bad lang' }); return false; }
    chrome.storage.sync.set({ lang: msg.lang })
      .then(() => register())
      .then((lang) => sendResponse({ lang }))
      .catch((e) => sendResponse({ error: String(e && e.message || e) }));
    return true;
  }
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
if (typeof module !== 'undefined') module.exports = { normalizeLang, detectLang, scriptsFor };
