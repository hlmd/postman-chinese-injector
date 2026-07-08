/*
 * ⚠ 免责声明：本项目为非官方第三方汉化工具，与 Postman, Inc. 无任何关联，未获其授权或背书；
 *   "Postman" 是 Postman, Inc. 的商标。本仓库不包含、也不分发 Postman 的任何源代码 / 二进制 /
 *   原始语言包。仅供个人在本地使用，使用者自负风险，请遵守 Postman 的服务条款与 EULA。
 *   代码以 MIT 许可（仅覆盖本项目自身代码，不含派生自 Postman 文案的译文数据）。
 */
/*
 * pm-scratchpad-cn.js —— Postman 登出态 Scratch Pad 汉化钩子（运行时 DOM 翻译）
 *
 * 与 pm-chinese.js 共存：pm-chinese.js 拦截登入态远程界面的 locale-pack 请求；本文件只在
 * 登出态本地 Scratch Pad（file://…scratchpad）窗口激活，用 MutationObserver 遍历 DOM，
 * 把「去空白后与词典 key 完全相等」的可见英文文本/属性替换成中文。词典从同目录
 * pm-scratchpad-data.json 用 fs 读（Scratch Pad 窗口 nodeIntegration=true + contextIsolation=false）。
 *
 * 安全：只做整串精确匹配；跳过 input/textarea/[contenteditable]/.CodeMirror/.monaco-editor
 * 子树，避免篡改用户输入的请求体/URL。
 */
(function () {
  'use strict';

  var WS_RE = /^(\s*)([\s\S]*?)(\s*)$/;
  var ATTRS = ['placeholder', 'title', 'aria-label'];
  var SKIP_TAGS = { INPUT: 1, TEXTAREA: 1, SCRIPT: 1, STYLE: 1 };
  var SKIP_CLASS_RE = /(^|\s)(CodeMirror|monaco-editor)(\s|$)/;

  // 纯函数：整串精确翻译，保留前后空白；无匹配返回 null
  function translateString(dict, value) {
    if (typeof value !== 'string' || !value) return null;
    var m = WS_RE.exec(value);
    var core = m[2];
    if (!core) return null;
    if (Object.prototype.hasOwnProperty.call(dict, core)) {
      return m[1] + dict[core] + m[3];
    }
    return null;
  }

  // 纯函数：元素本身是否属于「可编辑/代码区」
  function isSkippableEl(el) {
    if (!el || el.nodeType !== 1) return false;
    if (SKIP_TAGS[el.tagName]) return true;
    if (el.getAttribute && el.getAttribute('contenteditable') === 'true') return true;
    var cls = (el.getAttribute && el.getAttribute('class')) || '';
    return SKIP_CLASS_RE.test(cls);
  }

  // 纯函数：文本节点是否落在可跳过子树内（向上遍历祖先）
  function inSkippableSubtree(node) {
    var p = node && node.parentNode;
    while (p) {
      if (isSkippableEl(p)) return true;
      p = p.parentNode;
    }
    return false;
  }

  // 纯函数：当前窗口是否应激活（登出态本地 Scratch Pad）
  function isActive(loc) {
    return !!loc && loc.protocol === 'file:' && /scratchpad/i.test(loc.pathname || '');
  }

  function translateTextNode(dict, node) {
    if (!node || node.nodeType !== 3) return;
    if (inSkippableSubtree(node)) return;
    var out = translateString(dict, node.nodeValue);
    if (out != null && out !== node.nodeValue) node.nodeValue = out;
  }

  function translateAttributes(dict, el) {
    if (!el || el.nodeType !== 1 || !el.getAttribute) return;
    for (var i = 0; i < ATTRS.length; i++) {
      var name = ATTRS[i];
      var v = el.getAttribute(name);
      if (v == null) continue;
      var out = translateString(dict, v);
      if (out != null && out !== v) el.setAttribute(name, out);
    }
  }

  function walk(dict, root, doc) {
    if (root.nodeType === 1) translateAttributes(dict, root);
    var tw = doc.createTreeWalker(root, 4 /* SHOW_TEXT */, null, false);
    var batch = [], n;
    while ((n = tw.nextNode())) batch.push(n);
    for (var i = 0; i < batch.length; i++) translateTextNode(dict, batch[i]);
    if (root.querySelectorAll) {
      var els = root.querySelectorAll('[placeholder],[title],[aria-label]');
      for (var j = 0; j < els.length; j++) translateAttributes(dict, els[j]);
    }
  }

  function loadDict() {
    try {
      if (typeof require === 'function') {
        var fs = require('fs');
        var path = require('path');
        return JSON.parse(fs.readFileSync(path.join(__dirname, 'pm-scratchpad-data.json'), 'utf8'));
      }
    } catch (e) {
      try { console.error('[pm-scratchpad] 无法读取词典:', e && e.message); } catch (e2) {}
    }
    return null;
  }

  function start(doc, dict) {
    if (doc.documentElement) walk(dict, doc.documentElement, doc);
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var mu = muts[i];
        if (mu.type === 'characterData') {
          translateTextNode(dict, mu.target);
        } else if (mu.type === 'attributes') {
          translateAttributes(dict, mu.target);
        } else {
          for (var j = 0; j < mu.addedNodes.length; j++) {
            var node = mu.addedNodes[j];
            if (node.nodeType === 3) translateTextNode(dict, node);
            else if (node.nodeType === 1) walk(dict, node, doc);
          }
        }
      }
    });
    obs.observe(doc, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label']
    });
    try { console.log('[pm-scratchpad] 已启用 DOM 翻译，词条:', Object.keys(dict).length); } catch (e) {}
  }

  // 仅在渲染进程且守卫通过时执行副作用
  try {
    if (typeof document !== 'undefined' && typeof location !== 'undefined' && isActive(location)) {
      var dict = loadDict();
      if (dict) start(document, dict);
    }
  } catch (e) {
    try { console.error('[pm-scratchpad] 初始化失败:', e); } catch (e2) {}
  }

  // 供单测使用（Node / Electron preload 下 module 存在；浏览器页面无 module，跳过）
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      translateString: translateString,
      isSkippableEl: isSkippableEl,
      inSkippableSubtree: inSkippableSubtree,
      isActive: isActive,
      translateAttributes: translateAttributes
    };
  }
})();
