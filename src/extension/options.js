/*
 * options.js —— 选项页与工具栏弹出面板共用：选择「自动 / 简体中文 / 繁體中文」。
 * 设置写入 chrome.storage.sync.lang，后台（background.js）据此重新注册内容脚本，
 * 已打开的 Postman 页面刷新后生效。面板文字跟随当前实际使用的语言。
 */
'use strict';

const MATCHES = ['https://*.postman.co/*', 'https://*.getpostman.com/*', 'https://*.postman.com/*'];

const TEXT = {
  'zh-CN': {
    legend: '界面语言', auto: '自动', autoHint: (l) => `跟随浏览器：${NAME[l]}`,
    saved: '已保存，刷新 Postman 页面后生效。', reload: '刷新已打开的 Postman 页面',
    reloaded: (n) => (n ? `已刷新 ${n} 个 Postman 页面。` : '没有打开的 Postman 页面。'),
    current: (l) => `当前使用：${NAME[l]}`,
  },
  'zh-TW': {
    legend: '介面語言', auto: '自動', autoHint: (l) => `跟隨瀏覽器：${NAME[l]}`,
    saved: '已儲存，重新整理 Postman 頁面後生效。', reload: '重新整理已開啟的 Postman 頁面',
    reloaded: (n) => (n ? `已重新整理 ${n} 個 Postman 頁面。` : '沒有開啟的 Postman 頁面。'),
    current: (l) => `目前使用：${NAME[l]}`,
  },
};
const NAME = { 'zh-CN': '简体中文', 'zh-TW': '繁體中文' };

const $ = (id) => document.getElementById(id);
const state = () => chrome.runtime.sendMessage({ type: 'pm-state' });

function render(s) {
  const t = TEXT[s.lang] || TEXT['zh-CN'];
  document.documentElement.lang = s.lang;
  $('legend').textContent = t.legend;
  $('opt-auto').textContent = t.auto;
  $('auto-hint').textContent = t.autoHint(s.detected);
  $('reload').textContent = t.reload;
  for (const r of document.querySelectorAll('input[name=lang]')) r.checked = r.value === s.setting;
  return t;
}

async function init() {
  // 作为选项页（chrome://extensions → 详细信息 → 扩展程序选项）打开时，用较宽的版式
  //（popup.html 由构建脚本从 options.html 复制而来，body 带 class="popup"）
  if (!document.body.classList.contains('popup')) document.body.classList.add('page');
  let s = await state();
  if (s.error) { $('status').textContent = s.error; return; }
  let t = render(s);
  $('status').textContent = t.current(s.lang);

  for (const r of document.querySelectorAll('input[name=lang]')) {
    r.addEventListener('change', async () => {
      await chrome.storage.sync.set({ lang: r.value });
      s = await state();
      t = render(s);
      $('status').textContent = `${t.current(s.lang)}　${t.saved}`;
      $('status').className = 'status ok';
      $('reload').hidden = false;
    });
  }

  $('reload').addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ url: MATCHES });
    await Promise.all(tabs.map((tab) => chrome.tabs.reload(tab.id)));
    $('status').textContent = t.reloaded(tabs.length);
    $('reload').hidden = true;
  });
}

init();
