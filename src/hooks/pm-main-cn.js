/*
 * ⚠ 免责声明：本项目为非官方第三方汉化工具，与 Postman, Inc. 无任何关联，未获其授权或背书；
 *   "Postman" 是 Postman, Inc. 的商标。本仓库不包含、也不分发 Postman 的任何源代码 / 二进制 /
 *   原始语言包。仅供个人在本地使用，使用者自负风险，请遵守 Postman 的服务条款与 EULA。
 *   代码以 MIT 许可（仅覆盖本项目自身代码，不含派生自 Postman 文案的译文数据）。
 */
/*
 * pm-main-cn.js —— Postman 主进程汉化钩子（原生菜单 / 原生对话框）
 *
 * 左上角菜单（File / Edit / View / Help）、macOS 应用菜单、Dock 菜单与部分确认框是主进程用
 * Electron 原生 API 画的，不走 DOM 也不走渲染进程的语言包，pm-chinese.js / pm-scratchpad-cn.js
 * 都够不着。本钩子由注入器插在主进程入口 main.js 最前面，包装：
 *   - Menu.buildFromTemplate：递归翻译模板里的 label / sublabel / toolTip（复制后翻译，不改原模板，
 *     Postman 自己按 id / accelerator 更新菜单的逻辑不受影响）；
 *   - dialog.showMessageBox / showMessageBoxSync：翻译 title / message / detail / buttons / checkboxLabel。
 *
 * 词典为扁平 {英文: 中文}，从同目录的 pm-main-data(.<lang>).json 读（界面里切换语言后随之切换）；整串精确匹配（保留前后空白）。
 * 键里可含 {{name}} 占位（如 "About {{appName}}"），匹配时占位视作任意文本并代入译文。
 */
'use strict';

var WS_RE = /^(\s*)([\s\S]*?)(\s*)$/;
var PH_RE = /\{\{\s*(\w+)\s*\}\}/g;

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// 纯函数：把词典编译成 { exact, templates }，templates 为含 {{占位}} 的键
function compile(dict) {
  var exact = Object.create(null);
  var templates = [];
  Object.keys(dict || {}).forEach(function (en) {
    var zh = dict[en];
    if (typeof zh !== 'string') return;
    if (/\{\{\s*\w+\s*\}\}/.test(en)) {
      var names = [];
      var src = '^' + en.split(PH_RE).map(function (part, i) {
        if (i % 2) { names.push(part); return '([\\s\\S]+?)'; }
        return escapeRe(part);
      }).join('') + '$';
      templates.push({ re: new RegExp(src), names: names, zh: zh });
    } else {
      exact[en] = zh;
    }
  });
  return { exact: exact, templates: templates };
}

// 纯函数：整串翻译，保留前后空白；无匹配返回原值
function translateString(c, value) {
  if (typeof value !== 'string' || !value) return value;
  var m = WS_RE.exec(value);
  var core = m[2];
  if (!core) return value;
  if (Object.prototype.hasOwnProperty.call(c.exact, core)) return m[1] + c.exact[core] + m[3];
  for (var i = 0; i < c.templates.length; i++) {
    var t = c.templates[i];
    var hit = t.re.exec(core);
    if (!hit) continue;
    var vals = {};
    t.names.forEach(function (n, j) { vals[n] = hit[j + 1]; });
    return m[1] + t.zh.replace(PH_RE, function (all, n) { return n in vals ? vals[n] : all; }) + m[3];
  }
  return value;
}

var MENU_KEYS = ['label', 'sublabel', 'toolTip'];

// 只写 role、不写 label 的菜单项（如 { role: 'undo' }），英文标签由 Electron 自己补，模板里没有可翻的串。
//   这里列出 Electron 的默认英文标签（role 小写化后查），词典有译文时显式写进 label。
//   含应用名的 about / hide 不在此列；quit 只在 Windows（Exit）/ Linux（Quit）不含应用名，macOS 不补。
var ROLE_LABELS = {
  quit: process.platform === 'win32' ? 'Exit' : process.platform === 'linux' ? 'Quit' : null,
  undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', paste: 'Paste',
  pasteandmatchstyle: 'Paste and Match Style', delete: 'Delete', selectall: 'Select All',
  reload: 'Reload', forcereload: 'Force Reload', toggledevtools: 'Toggle Developer Tools',
  resetzoom: 'Actual Size', zoomin: 'Zoom In', zoomout: 'Zoom Out',
  togglefullscreen: 'Toggle Full Screen', minimize: 'Minimize', close: 'Close Window',
  zoom: 'Zoom', front: 'Bring All to Front', hideothers: 'Hide Others', unhide: 'Show All',
  services: 'Services', window: 'Window', help: 'Help',
  filemenu: 'File', editmenu: 'Edit', viewmenu: 'View', windowmenu: 'Window'
};

// 纯函数：递归复制并翻译菜单模板（submenu 可能是 Menu 实例，原样保留）
function translateTemplate(c, template) {
  if (!Array.isArray(template)) return template;
  return template.map(function (item) {
    if (!item || typeof item !== 'object') return item;
    var out = Object.assign({}, item);
    if (out.label == null && typeof out.role === 'string') {
      var roleLabel = ROLE_LABELS[out.role.toLowerCase()];
      if (roleLabel && Object.prototype.hasOwnProperty.call(c.exact, roleLabel)) out.label = roleLabel;
    }
    MENU_KEYS.forEach(function (k) { if (typeof out[k] === 'string') out[k] = translateString(c, out[k]); });
    if (Array.isArray(out.submenu)) out.submenu = translateTemplate(c, out.submenu);
    return out;
  });
}

var BOX_KEYS = ['title', 'message', 'detail', 'checkboxLabel'];

// 纯函数：复制并翻译 showMessageBox 的 options
function translateBoxOptions(c, opts) {
  if (!opts || typeof opts !== 'object') return opts;
  var out = Object.assign({}, opts);
  BOX_KEYS.forEach(function (k) { if (typeof out[k] === 'string') out[k] = translateString(c, out[k]); });
  if (Array.isArray(out.buttons)) out.buttons = out.buttons.map(function (b) { return translateString(c, b); });
  return out;
}

// showMessageBox([window, ]options)：options 是最后一个对象参数
function wrapBox(c, fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments);
    var i = args.length - 1;
    if (i >= 0) args[i] = translateBoxOptions(c, args[i]);
    return fn.apply(this, args);
  };
}

// dict 可以是词典对象，也可以是返回「已编译词典或 null（不翻译）」的函数（运行中可切换语言）
function install(electron, dict) {
  var getC;
  if (typeof dict === 'function') getC = dict;
  else { var fixed = compile(dict); getC = function () { return fixed; }; }
  var Menu = electron.Menu;
  if (Menu && typeof Menu.buildFromTemplate === 'function' && !Menu.buildFromTemplate.__pmCn) {
    var orig = Menu.buildFromTemplate;
    var wrapped = function (template) {
      var c = getC();
      return orig.call(this, c ? translateTemplate(c, template) : template);
    };
    wrapped.__pmCn = true;
    Menu.buildFromTemplate = wrapped;
  }
  var dialog = electron.dialog;
  if (dialog) {
    ['showMessageBox', 'showMessageBoxSync'].forEach(function (name) {
      if (typeof dialog[name] === 'function' && !dialog[name].__pmCn) {
        var fn = dialog[name];
        var w = function () {
          var c = getC();
          return c ? wrapBox(c, fn).apply(this, arguments) : fn.apply(this, arguments);
        };
        w.__pmCn = true;
        dialog[name] = w;
      }
    });
  }
}

// 主进程里的语言选择：界面里切换语言时渲染进程经 IPC 发来 { lang, base }，存到 userData 下的
// pm-chinese-lang.json；base（做选择时注入的默认语言）与当前注入的默认语言不同则作废。
// 返回 getter：'off' → null；其它语言读 pm-main-data.<lang>.json，缺失退回默认 pm-main-data.json。
function createDictSource(opts) {
  var fs = opts.fs, path = opts.path, dir = opts.dir;
  var cache = Object.create(null);
  var pref; // undefined = 尚未读取
  var def = 'zh-CN';
  try { def = JSON.parse(fs.readFileSync(path.join(dir, 'pm-chinese-langs.json'), 'utf8'))['default'] || def; } catch (e) { /* 老注入无 meta */ }
  function prefFile() { return opts.prefPath(); }
  function readPref() {
    if (pref !== undefined) return pref;
    pref = null;
    try {
      var p = JSON.parse(fs.readFileSync(prefFile(), 'utf8'));
      if (p && p.base === def && typeof p.lang === 'string') pref = p.lang;
    } catch (e) { /* 没有选择过 */ }
    return pref;
  }
  function load(file) {
    if (!(file in cache)) {
      try { cache[file] = compile(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))); } catch (e) { cache[file] = null; }
    }
    return cache[file];
  }
  function get() {
    var lang = readPref();
    if (lang === 'off') return null;
    var c = lang && lang !== def ? load('pm-main-data.' + lang + '.json') : null;
    return c || load('pm-main-data.json');
  }
  function set(v) {
    if (!v || typeof v.lang !== 'string') return;
    pref = v.base === def ? v.lang : null;
    try { fs.writeFileSync(prefFile(), JSON.stringify({ lang: v.lang, base: v.base })); } catch (e) { /* ignore */ }
  }
  return { get: get, set: set };
}

module.exports = { createDictSource: createDictSource, compile: compile, translateString: translateString, translateTemplate: translateTemplate, translateBoxOptions: translateBoxOptions, install: install };

// 作为注入钩子加载时（主进程、同目录有 pm-main-data.json）自动安装
if (process.type === 'browser') {
  try {
    var fs = require('fs');
    var path = require('path');
    var electron = require('electron');
    var source = createDictSource({
      fs: fs, path: path, dir: __dirname,
      prefPath: function () { return path.join(electron.app.getPath('userData'), 'pm-chinese-lang.json'); }
    });
    install(electron, source.get);
    if (electron.ipcMain) electron.ipcMain.on('pm-chinese:set-lang', function (e, v) { source.set(v); });
    console.log('[pm-main] 已启用原生菜单汉化');
  } catch (e) {
    console.error('[pm-main] 初始化失败:', e && e.message);
  }
}
