# Scratch Pad 汉化 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `postman-chinese-injector` 一键注入时，除现有 fetch 钩子外再注入一个运行时 DOM 翻译钩子，把登出态 Scratch Pad（本地 bundle、硬编码英文）的可见文本精确替换为中文。

**Architecture:** 从归档项目 Postman-cn 的 `php/lang/js/scratchpad/**` 提取「英文→中文」纯文本词典，内置进本仓库；新增 DOM 钩子 `pm-scratchpad-cn.js`，只在 `file://…scratchpad` 窗口激活，用 MutationObserver + 精确整串匹配替换文本节点与少量属性；注入器把两个钩子一并写入 preload 同目录，二进制编译时把词典与钩子源码做成可嵌入快照。

**Tech Stack:** Node.js（CommonJS）、`@electron/asar`、`node:test`/`node:assert`（内置，无新增运行时依赖）、bun（编译单文件二进制）。

## Global Constraints

- 语言/注释一律中文（与现有代码风格一致）。
- 不新增运行时依赖；测试只用 Node 内置 `node:test` + `node:assert`（不引入 jsdom）。
- 生成的可嵌入快照（`pm-scratchpad-data.json`、`pm-scratchpad-src.json`）必须 `.gitignore`；词典 `locales/scratchpad/zh-CN.json` 必须提交。
- DOM 钩子只做**去空白后完全相等**的精确整串替换；必须跳过 `input`/`textarea`/`[contenteditable=true]`/`.CodeMirror`/`.monaco-editor` 子树，防止篡改用户输入。
- DOM 钩子仅当 `location.protocol === 'file:'` 且 `location.pathname` 含 `scratchpad`（不区分大小写）时激活。
- 每个钩子文件顶部保留与 `pm-chinese.js` 一致的免责声明注释块。
- 词典源路径默认 `D:/Sinicization/Postman/Postman-cn/php/lang/js/scratchpad`，可用 `--src <dir>` 或环境变量 `POSTMAN_CN_LANG` 覆盖。
- 提交信息结尾附：`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。

---

## 文件结构

- 新建 `scripts/build-scratchpad-dict.js` —— 词典提取器（构建期，dev 工具）。
- 新建 `locales/scratchpad/zh-CN.json` —— 提取产物，内置词典（提交）。
- 新建 `pm-scratchpad-cn.js` —— 运行时 DOM 翻译钩子（注入进 asar）。
- 新建 `test/build-scratchpad-dict.test.js` —— 提取器单测。
- 新建 `test/pm-scratchpad-cn.test.js` —— DOM 钩子纯函数单测。
- 修改 `scripts/build-data.js` —— 追加生成 `pm-scratchpad-data.json` + `pm-scratchpad-src.json` 快照。
- 修改 `postman-chinese-injector.js` —— 注入/还原/状态里带上第二个钩子与词典。
- 修改 `package.json` —— 加 `test` 脚本。
- 修改 `.gitignore` —— 忽略两个新快照。
- 修改 `README.md` —— 补充 Scratch Pad 汉化说明。

---

### Task 1: 词典提取器 + 内置词典

**Files:**
- Create: `scripts/build-scratchpad-dict.js`
- Create: `test/build-scratchpad-dict.test.js`
- Modify: `package.json`（加 `scripts.test`）
- Produce: `locales/scratchpad/zh-CN.json`

**Interfaces:**
- Produces: `module.exports = { extractInto(text, map)->Map, unwrapPhp(s)->string|null, unwrapJs(s)->string|null, build(srcDir?)->{count, out} }`

- [ ] **Step 1: 写提取器脚本**

Create `scripts/build-scratchpad-dict.js`:

```js
#!/usr/bin/env node
/*
 * ⚠ 免责声明：本项目为非官方第三方汉化工具，与 Postman, Inc. 无任何关联，未获其授权或背书；
 *   "Postman" 是 Postman, Inc. 的商标。本仓库不包含、也不分发 Postman 的任何源代码 / 二进制 /
 *   原始语言包。仅供个人在本地使用，使用者自负风险，请遵守 Postman 的服务条款与 EULA。
 *   代码以 MIT 许可（仅覆盖本项目自身代码，不含派生自 Postman 文案的译文数据）。
 */
/*
 * build-scratchpad-dict.js —— 从归档项目 Postman-cn 的 php/lang/js/scratchpad/** 提取
 *   「英文→中文」纯可见文本词典，产出 locales/scratchpad/zh-CN.json（内置进本仓库）。
 *   词条格式为 PHP 数组 '"English"' => '"中文"'（或单引号）；跳过占位符 ______、含 ${} 或
 *   反引号的模板、以及形如 title:"X" 的带代码上下文条目。仅为 dev 工具，用于再生成词典。
 *
 * 用法: node scripts/build-scratchpad-dict.js [--src <Postman-cn 的 scratchpad lang 目录>]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFAULT_SRC = process.env.POSTMAN_CN_LANG ||
  'D:/Sinicization/Postman/Postman-cn/php/lang/js/scratchpad';
const OUT = path.join(ROOT, 'locales', 'scratchpad', 'zh-CN.json');

// 一行形如：  'X' => 'Y',   或   "X" => "Y"
const PAIR_RE = /^\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*=>\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*,?\s*$/;

// 去掉最外层 PHP 引号并还原 \' \" \\ 转义；非带引号串返回 null
function unwrapPhp(s) {
  s = s.trim();
  const q = s[0];
  if ((q === '"' || q === "'") && s[s.length - 1] === q && s.length >= 2) {
    return s.slice(1, -1).replace(/\\(['"\\])/g, '$1');
  }
  return null;
}

// 去掉内层 JS 引号得可见文本；非带引号串（如 title:"X"）返回 null
function unwrapJs(s) {
  const q = s[0];
  if ((q === '"' || q === "'") && s[s.length - 1] === q && s.length >= 2) {
    return s.slice(1, -1);
  }
  return null;
}

// 从一段 PHP lang 文本提取纯可见 EN->ZH 对写入 map（先到先得）
function extractInto(text, map) {
  for (const line of String(text).split(/\r?\n/)) {
    const m = PAIR_RE.exec(line);
    if (!m) continue;
    const en = unwrapPhp(m[1]);
    const zh = unwrapPhp(m[2]);
    if (en == null || zh == null) continue;
    if (en.includes('______') || zh.includes('______')) continue; // 占位
    if (en.includes('${') || en.startsWith('`')) continue;          // 模板
    const enPlain = unwrapJs(en);
    const zhPlain = unwrapJs(zh);
    if (enPlain == null || zhPlain == null) continue;               // 带代码上下文
    if (!enPlain.trim()) continue;
    if (!map.has(enPlain)) map.set(enPlain, zhPlain);
  }
  return map;
}

function walkPhp(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkPhp(p, out);
    else if (e.name.endsWith('.php')) out.push(p);
  }
  return out;
}

function build(srcDir) {
  const src = srcDir || DEFAULT_SRC;
  if (!fs.existsSync(src)) throw new Error(`找不到词典源目录: ${src}`);
  const map = new Map();
  for (const f of walkPhp(src, [])) extractInto(fs.readFileSync(f, 'utf8'), map);
  const obj = {};
  for (const [k, v] of [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))) obj[k] = v;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(obj), 'utf8');
  return { count: map.size, out: OUT };
}

module.exports = { extractInto, unwrapPhp, unwrapJs, build };

if (require.main === module) {
  try {
    const i = process.argv.indexOf('--src');
    const { count, out } = build(i >= 0 ? process.argv[i + 1] : undefined);
    console.log(`[完成] 提取 ${count} 条 -> ${path.relative(ROOT, out)}`);
  } catch (e) {
    console.error(`[错误] ${e.message}`);
    process.exit(1);
  }
}
```

- [ ] **Step 2: 写提取器单测**

Create `test/build-scratchpad-dict.test.js`:

```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { extractInto, unwrapPhp, unwrapJs } = require('../scripts/build-scratchpad-dict.js');

test('unwrapPhp 去外层引号并还原转义', () => {
  assert.strictEqual(unwrapPhp(`'"Delete"'`), '"Delete"');
  assert.strictEqual(unwrapPhp(`"'Delete'"`), "'Delete'");
  assert.strictEqual(unwrapPhp(`'"You don\\'t"'`), `"You don't"`);
  assert.strictEqual(unwrapPhp('title:"Name"'), null); // 非带引号整串
});

test('unwrapJs 去内层引号', () => {
  assert.strictEqual(unwrapJs('"Send"'), 'Send');
  assert.strictEqual(unwrapJs("'Send'"), 'Send');
  assert.strictEqual(unwrapJs('title:"Name"'), null);
});

test('extractInto 提取纯文本，跳过占位/模板/上下文，先到先得', () => {
  const php = [
    `        '"Create Collection"' => '"创建集合"',`,
    `        "'Rename'" => "'重命名'",`,
    `        '"______"' => '"______"',`,
    "        '`This ${a}`' => '`这 ${a}`',",
    `        'title:"Name"' => 'title:"名称"',`,
    `        '"Create Collection"' => '"重复应被忽略"',`,
  ].join('\n');
  const map = extractInto(php, new Map());
  assert.strictEqual(map.get('Create Collection'), '创建集合');
  assert.strictEqual(map.get('Rename'), '重命名');
  assert.strictEqual(map.has('______'), false);
  assert.ok(![...map.keys()].some((k) => k.includes('${')));
  assert.ok(![...map.keys()].some((k) => k.startsWith('title:')));
  assert.strictEqual(map.size, 2);
});
```

- [ ] **Step 3: 加 `test` 脚本到 package.json**

在 `package.json` 的 `"scripts"` 里，`"patch"` 之前加一行：

```json
    "test": "node --test test/",
```

- [ ] **Step 4: 跑测试确认失败**

Run: `node --test test/build-scratchpad-dict.test.js`
Expected: 目前脚本已存在，应 **PASS**。若报模块找不到则说明 Step 1 路径写错，修正后再跑。
（本任务脚本与测试同批写入，测试应直接通过；这一步用于确认逻辑正确，而非 red。）

- [ ] **Step 5: 生成内置词典**

Run: `node scripts/build-scratchpad-dict.js`
Expected: 打印 `[完成] 提取 3672 条 -> locales\scratchpad\zh-CN.json`（条数以实际为准，应在 3600+ 数量级）。

验证文件非空且是合法 JSON：
Run: `node -e "const d=require('./locales/scratchpad/zh-CN.json'); console.log(Object.keys(d).length, JSON.stringify(d['Delete']||d['Rename']))"`
Expected: 打印一个几千的数字和一个中文串。

- [ ] **Step 6: 提交**

```bash
git add scripts/build-scratchpad-dict.js test/build-scratchpad-dict.test.js package.json locales/scratchpad/zh-CN.json
git commit -m "feat: Scratch Pad 词典提取器 + 内置词典（提取自 Postman-cn）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: DOM 翻译钩子 `pm-scratchpad-cn.js`

**Files:**
- Create: `pm-scratchpad-cn.js`
- Create: `test/pm-scratchpad-cn.test.js`

**Interfaces:**
- Consumes: 运行时读同目录 `pm-scratchpad-data.json`（Task 4 注入时写入）。
- Produces（供单测）: `module.exports = { translateString(dict,value)->string|null, isSkippableEl(el)->bool, inSkippableSubtree(node)->bool, isActive(loc)->bool, translateAttributes(dict,el)->void }`

- [ ] **Step 1: 写钩子文件**

Create `pm-scratchpad-cn.js`:

```js
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
        } else {
          for (var j = 0; j < mu.addedNodes.length; j++) {
            var node = mu.addedNodes[j];
            if (node.nodeType === 3) translateTextNode(dict, node);
            else if (node.nodeType === 1) walk(dict, node, doc);
          }
        }
      }
    });
    obs.observe(doc, { subtree: true, childList: true, characterData: true });
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
```

- [ ] **Step 2: 写钩子单测（纯函数，无需 jsdom）**

Create `test/pm-scratchpad-cn.test.js`:

```js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const hook = require('../pm-scratchpad-cn.js');
const { translateString, isSkippableEl, inSkippableSubtree, isActive, translateAttributes } = hook;

const DICT = { 'Send': '发送', 'New Request': '新建请求', 'Delete': '删除' };

// 造一个假元素
function fakeEl(tagName, attrs) {
  attrs = attrs || {};
  return {
    nodeType: 1,
    tagName: tagName,
    parentNode: null,
    _a: Object.assign({}, attrs),
    getAttribute(n) { return Object.prototype.hasOwnProperty.call(this._a, n) ? this._a[n] : null; },
    setAttribute(n, v) { this._a[n] = v; }
  };
}
function fakeText(value, parent) {
  return { nodeType: 3, nodeValue: value, parentNode: parent || null };
}

test('translateString 精确匹配并保留前后空白', () => {
  assert.strictEqual(translateString(DICT, 'Send'), '发送');
  assert.strictEqual(translateString(DICT, '  New Request  '), '  新建请求  ');
  assert.strictEqual(translateString(DICT, '\nDelete\n'), '\n删除\n');
});

test('translateString 无匹配/非串返回 null（不误伤）', () => {
  assert.strictEqual(translateString(DICT, 'Send this'), null);
  assert.strictEqual(translateString(DICT, 'GET /users'), null);
  assert.strictEqual(translateString(DICT, ''), null);
  assert.strictEqual(translateString(DICT, null), null);
});

test('isSkippableEl 命中可编辑/代码区', () => {
  assert.strictEqual(isSkippableEl(fakeEl('INPUT')), true);
  assert.strictEqual(isSkippableEl(fakeEl('TEXTAREA')), true);
  assert.strictEqual(isSkippableEl(fakeEl('DIV', { contenteditable: 'true' })), true);
  assert.strictEqual(isSkippableEl(fakeEl('DIV', { class: 'x CodeMirror y' })), true);
  assert.strictEqual(isSkippableEl(fakeEl('DIV', { class: 'monaco-editor' })), true);
  assert.strictEqual(isSkippableEl(fakeEl('DIV', { class: 'btn' })), false);
});

test('inSkippableSubtree 向上遍历祖先', () => {
  const editor = fakeEl('DIV', { class: 'CodeMirror' });
  const inner = fakeEl('SPAN'); inner.parentNode = editor;
  const t = fakeText('Delete', inner);
  assert.strictEqual(inSkippableSubtree(t), true);
  const plain = fakeEl('DIV', { class: 'toolbar' });
  const t2 = fakeText('Delete', plain);
  assert.strictEqual(inSkippableSubtree(t2), false);
});

test('isActive 只在 file:// + scratchpad 路径为真', () => {
  assert.strictEqual(isActive({ protocol: 'file:', pathname: '/C:/x/html/scratchpad.html' }), true);
  assert.strictEqual(isActive({ protocol: 'https:', pathname: '/scratchpad' }), false);
  assert.strictEqual(isActive({ protocol: 'file:', pathname: '/C:/x/html/console.html' }), false);
  assert.strictEqual(isActive(null), false);
});

test('translateAttributes 翻译 placeholder/title/aria-label', () => {
  const el = fakeEl('DIV', { placeholder: 'Send', title: 'Delete', 'aria-label': 'New Request', other: 'Send' });
  translateAttributes(DICT, el);
  assert.strictEqual(el.getAttribute('placeholder'), '发送');
  assert.strictEqual(el.getAttribute('title'), '删除');
  assert.strictEqual(el.getAttribute('aria-label'), '新建请求');
  assert.strictEqual(el.getAttribute('other'), 'Send'); // 非白名单属性不动
});
```

- [ ] **Step 3: 跑测试确认通过**

Run: `node --test test/pm-scratchpad-cn.test.js`
Expected: 全部 PASS。若 `require('../pm-scratchpad-cn.js')` 得到空对象导致解构报错，检查钩子文件末尾的 `module.exports` 是否落在 IIFE 内部且无语法错误。

- [ ] **Step 4: 提交**

```bash
git add pm-scratchpad-cn.js test/pm-scratchpad-cn.test.js
git commit -m "feat: Scratch Pad 运行时 DOM 翻译钩子 pm-scratchpad-cn.js

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: 把 Scratch Pad 资源接入内嵌构建

**Files:**
- Modify: `scripts/build-data.js`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `locales/scratchpad/zh-CN.json`（Task 1）、`pm-scratchpad-cn.js`（Task 2）。
- Produces: `pm-scratchpad-data.json`（扁平词典快照）、`pm-scratchpad-src.json`（`{src}` 钩子源码快照）。

- [ ] **Step 1: 在 buildData() 末尾追加 Scratch Pad 快照生成**

在 `scripts/build-data.js` 的 `buildData()` 里，`return { lang, count };` 之前插入：

```js
  // Scratch Pad DOM 翻译：词典快照 + 钩子源码快照（供 bun --compile 内嵌）
  const spDict = path.join(ROOT, 'locales', 'scratchpad', 'zh-CN.json');
  if (fs.existsSync(spDict)) {
    const dict = JSON.parse(fs.readFileSync(spDict, 'utf8'));
    const spDataOut = path.join(ROOT, 'pm-scratchpad-data.json');
    fs.writeFileSync(spDataOut, JSON.stringify(dict), 'utf8');
    console.log(`[完成] Scratch Pad 词典 -> ${path.relative(ROOT, spDataOut)} (${Object.keys(dict).length} 条)`);

    const spHookSrc = path.join(ROOT, 'pm-scratchpad-cn.js');
    if (!fs.existsSync(spHookSrc)) throw new Error(`找不到钩子源码: ${spHookSrc}`);
    const spHookOut = path.join(ROOT, 'pm-scratchpad-src.json');
    fs.writeFileSync(spHookOut, JSON.stringify({ src: fs.readFileSync(spHookSrc, 'utf8') }), 'utf8');
    console.log(`[完成] Scratch Pad 钩子源码 -> ${path.relative(ROOT, spHookOut)} (${(fs.statSync(spHookOut).size / 1024).toFixed(0)} KB)`);
  } else {
    console.warn(`[警告] 未找到 ${path.relative(ROOT, spDict)}，跳过 Scratch Pad 快照（请先跑 build-scratchpad-dict.js）`);
  }

```

- [ ] **Step 2: 忽略两个新快照**

在 `.gitignore` 里 `pm-chinese-src.json` 那一行下面追加：

```
pm-scratchpad-data.json
pm-scratchpad-src.json
```

- [ ] **Step 3: 跑构建生成快照并验证**

Run: `node scripts/build-data.js`
Expected: 除原有两行外，另打印 `Scratch Pad 词典 -> pm-scratchpad-data.json (…条)` 与 `Scratch Pad 钩子源码 -> pm-scratchpad-src.json (…KB)`。

验证两个快照存在且合法：
Run: `node -e "console.log(Object.keys(require('./pm-scratchpad-data.json')).length, require('./pm-scratchpad-src.json').src.length)"`
Expected: 打印词条数与源码字符数（均 > 0）。

确认快照未被 git 跟踪：
Run: `git status --porcelain pm-scratchpad-data.json pm-scratchpad-src.json`
Expected: 无输出（被 .gitignore 忽略）。

- [ ] **Step 4: 提交**

```bash
git add scripts/build-data.js .gitignore
git commit -m "build: 内嵌 Scratch Pad 词典与钩子源码快照（供二进制编译）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 注入器集成（注入两个钩子 + 还原 + 状态）

**Files:**
- Modify: `postman-chinese-injector.js`

**Interfaces:**
- Consumes: `pm-scratchpad-cn.js`、`locales/scratchpad/zh-CN.json` 或内嵌 `pm-scratchpad-*.json`；已有的 `findPreloadIn`、`localeRoots`、`preloadDir`。
- Produces（供测试导出）: 追加 `scratchpadHookSource()->{src,from}`、`loadScratchpadDict()->{dict,from}` 到 `module.exports`。

- [ ] **Step 1: 加常量与第二条注入行**

在 `postman-chinese-injector.js` 顶部常量区，`const DATA_NAME = ...;` 之后加：

```js
const SCRATCH_HOOK_NAME = 'pm-scratchpad-cn.js';
const SCRATCH_HOOK_SRC = path.join(BASE_DIR, SCRATCH_HOOK_NAME);
const SCRATCH_DATA_NAME = 'pm-scratchpad-data.json';
```

把 `INJECT_BLOCK` 改为同时 require 两个钩子：

```js
const INJECT_BLOCK =
  `\n${MARK_START}\n` +
  "try { require('./pm-chinese.js'); } catch (e) { console.error('[pm-chinese] load failed', e); }\n" +
  "try { require('./pm-scratchpad-cn.js'); } catch (e) { console.error('[pm-scratchpad] load failed', e); }\n" +
  `${MARK_END}\n`;
```

- [ ] **Step 2: 加 Scratch Pad 钩子源码 / 词典加载函数**

在 `hookSource()` 函数之后插入：

```js
// Scratch Pad 钩子源码（编译后取内嵌快照，逻辑同 hookSource）
function loadEmbeddedScratchpadHook() {
  try { return require('./pm-scratchpad-src.json').src || null; } catch (e) { return null; }
}
function scratchpadHookSource() {
  const cands = [];
  try { cands.push(path.join(path.dirname(process.execPath), SCRATCH_HOOK_NAME)); } catch (e) { /* ignore */ }
  cands.push(SCRATCH_HOOK_SRC);
  for (const p of cands) {
    if (isFile(p)) return { src: fs.readFileSync(p, 'utf8'), from: p };
  }
  const emb = loadEmbeddedScratchpadHook();
  if (emb) return { src: emb, from: '内嵌快照' };
  throw new Error(`缺少 Scratch Pad 钩子源码 ${SCRATCH_HOOK_NAME}（且无内嵌快照）`);
}

// Scratch Pad 词典：① locales/scratchpad/zh-CN.json（exe 旁或源码旁）；② 内嵌快照
function loadEmbeddedScratchpadDict() {
  try { return require('./pm-scratchpad-data.json'); } catch (e) { return null; }
}
function loadScratchpadDict() {
  for (const root of localeRoots()) {
    const p = path.join(root, 'scratchpad', 'zh-CN.json');
    if (isFile(p)) {
      try { return { dict: JSON.parse(fs.readFileSync(p, 'utf8')), from: p }; } catch (e) { /* 坏文件则继续 */ }
    }
  }
  const emb = loadEmbeddedScratchpadDict();
  if (emb && typeof emb === 'object' && Object.keys(emb).length) return { dict: emb, from: '内嵌快照' };
  throw new Error('缺少 Scratch Pad 词典（locales/scratchpad/zh-CN.json 或内嵌快照）');
}
```

- [ ] **Step 3: patchAsar 里写入第二个钩子与词典**

在 `patchAsar()` 内，写完 `pm-chinese.js` + `DATA_NAME` 的那两行 `fs.writeFileSync(...)` 与其后的 `console.log(\`[写入] pm-chinese.js + ${DATA_NAME}\`);` **之后**追加：

```js
  const spHook = scratchpadHookSource();
  const spDict = loadScratchpadDict();
  fs.writeFileSync(path.join(preloadDir, SCRATCH_HOOK_NAME), spHook.src, 'utf8');
  fs.writeFileSync(path.join(preloadDir, SCRATCH_DATA_NAME), JSON.stringify(spDict.dict), 'utf8');
  console.log(`[写入] ${SCRATCH_HOOK_NAME} + ${SCRATCH_DATA_NAME}（${Object.keys(spDict.dict).length} 条）`);
```

- [ ] **Step 4: patchDir 里写入第二个钩子与词典**

在 `patchDir()` 内，同样在写完 `pm-chinese.js` + `DATA_NAME` 的 `console.log(\`[写入] pm-chinese.js + ${DATA_NAME}\`);` **之后**追加**相同**的三行 +（注意 patchDir 用的也是 `preloadDir` 变量，已存在）：

```js
  const spHook = scratchpadHookSource();
  const spDict = loadScratchpadDict();
  fs.writeFileSync(path.join(preloadDir, SCRATCH_HOOK_NAME), spHook.src, 'utf8');
  fs.writeFileSync(path.join(preloadDir, SCRATCH_DATA_NAME), JSON.stringify(spDict.dict), 'utf8');
  console.log(`[写入] ${SCRATCH_HOOK_NAME} + ${SCRATCH_DATA_NAME}（${Object.keys(spDict.dict).length} 条）`);
```

- [ ] **Step 5: 还原时删除新增文件**

在 `restoreDir()` 里，把删除钩子/数据的循环数组扩成四个：

```js
  for (const f of ['pm-chinese.js', DATA_NAME, SCRATCH_HOOK_NAME, SCRATCH_DATA_NAME]) {
```

（`restoreAsar()` 用 `app.asar.bak` 整包覆盖，无需改动。）

- [ ] **Step 6: 状态里报告 Scratch Pad 钩子存在**

在 `statusAsar()` 里，`hasData = files.some(...)` 之后加一行探测（同一 try 块内）：

```js
    var hasScratch = files.some((f) => /(^|[\\/])pm-scratchpad-cn\.js$/.test(f));
```

并在打印 `pm-chinese-data.json 在 asar 内:` 那行 `console.log` 之后加：

```js
  console.log(`  Scratch Pad 钩子在 asar 内: ${hasScratch ? '是' : '否'}`);
```

（注意：`hasScratch` 需在 try 外先 `let hasScratch = false;` 声明，赋值放 try 内，与 `hasHook` 同款处理。）

- [ ] **Step 7: 导出新函数供测试**

把文件底部的 `module.exports = { findPreloadIn, findPreloadInAsar, resolveDirPreload, PRELOAD_CANDIDATES };` 改为：

```js
module.exports = { findPreloadIn, findPreloadInAsar, resolveDirPreload, PRELOAD_CANDIDATES, scratchpadHookSource, loadScratchpadDict };
```

- [ ] **Step 8: 单测新加载函数**

Create `test/injector-scratchpad.test.js`:

```js
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
```

- [ ] **Step 9: 跑全部单测**

Run: `node --test test/`
Expected: 全部 PASS（含前两任务的测试）。若 `loadScratchpadDict` 失败，确认 Task 1 的 `locales/scratchpad/zh-CN.json` 已生成。

- [ ] **Step 10: 提交**

```bash
git add postman-chinese-injector.js test/injector-scratchpad.test.js
git commit -m "feat: 注入器一并注入 Scratch Pad DOM 翻译钩子与词典

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: 真机集成验证 + README + 发布

**Files:**
- Modify: `README.md`
- Modify: `package.json`（版本号）

**Interfaces:** 无（面向用户的验证与文档）。

- [ ] **Step 1: 对真实老版 Postman 跑注入（bun）**

先确保快照最新（Task 3 已生成）。完全退出 Postman 后：

Run: `bun postman-chinese-injector.js --resources "C:\Users\leihu\AppData\Local\Postman\app-10.24.26\resources"`
Expected: 日志里出现 `[写入] pm-scratchpad-cn.js + pm-scratchpad-data.json（…条）` 且成功重打包。

- [ ] **Step 2: 校验 asar 内已含 Scratch Pad 钩子**

Run:
```bash
bun -e "const a=require('@electron/asar');const A='C:/Users/leihu/AppData/Local/Postman/app-10.24.26/resources/app.asar';const L=a.listPackage(A).filter(x=>/pm-scratchpad|pm-chinese/.test(x));console.log(L);const p=a.extractFile(A,'preload\\\\desktop\\\\index.js').toString('utf8');console.log('require 两钩子:', p.includes('pm-chinese.js') && p.includes('pm-scratchpad-cn.js'));"
```
Expected: 列出四个文件（两个钩子 + 两个数据/词典），且 `require 两钩子: true`。

- [ ] **Step 3: 启动登出态 Scratch Pad 人工验收**

完全启动 Postman，**不登录**，进入 Scratch Pad。打开开发者工具 Console（若可）确认打印 `[pm-scratchpad] 已启用 DOM 翻译，词条: …`。
肉眼点检侧栏（Collections/History）、状态栏、常用菜单/按钮/空状态是否变中文；在请求体/URL 编辑器里输入英文（如 `Send`）确认**不被**翻译（验证跳过可编辑区）。
记录仍为英文的关键可见文案，作为后续扩词依据（本步不阻塞发布）。

- [ ] **Step 4: 还原验证幂等/干净**

Run: `bun postman-chinese-injector.js --restore --resources "C:\Users\leihu\AppData\Local\Postman\app-10.24.26\resources"`
接着 Run: `bun postman-chinese-injector.js --status --resources "C:\Users\leihu\AppData\Local\Postman\app-10.24.26\resources"`
Expected: 还原用 `app.asar.bak` 覆盖；状态显示未注入。

- [ ] **Step 5: 更新 README**

在 `README.md` 说明工具能力处，补一段（措辞可微调）：

```markdown
### 登出态 Scratch Pad 汉化

Postman 登入态主界面是远程网页（走 locale 拦截汉化）；**登出态 Scratch Pad 是本地打包、
文案为硬编码英文**，无法用 locale 拦截。本工具会在同一次注入里额外放入运行时 DOM 翻译钩子，
只在 Scratch Pad 窗口对**与内置词典精确匹配**的可见文本做替换（词典源自社区归档项目
Postman-cn，仅覆盖常见 Scratch Pad 界面文案，动态/参数化文案暂不翻译）。用户无需关心版本或
登入状态，一条命令即可。
```

- [ ] **Step 6: 版本号 bump 到 1.4.0**

把 `package.json` 的 `"version": "1.3.0"` 改为 `"version": "1.4.0"`。

- [ ] **Step 7: 提交并（经用户确认后）发版**

```bash
git add README.md package.json
git commit -m "chore(release): 1.4.0 — 登出态 Scratch Pad 运行时 DOM 汉化

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

发版（打 tag 触发 CI，**需用户点头再推**）：

```bash
git tag v1.4.0
git push origin main
git push origin v1.4.0
```

---

## 自查（Self-Review）结果

- **Spec 覆盖**：数据来源→Task 1；DOM 钩子（激活守卫/精确匹配/跳过可编辑区/属性）→Task 2；二进制内嵌→Task 3；一键注入两钩子/还原/状态→Task 4；真机验证/README/发版→Task 5。核心原则「一键、同一脚本、自动适配」由 Task 4 的双 require + 各自运行时守卫落实。
- **占位符**：无 TBD/TODO；所有代码步骤含完整代码与预期输出。
- **类型/命名一致**：`SCRATCH_HOOK_NAME`/`SCRATCH_DATA_NAME`/`scratchpadHookSource`/`loadScratchpadDict`/`translateString` 等跨任务一致；快照文件名 `pm-scratchpad-data.json`（词典）与 `pm-scratchpad-src.json`（源码）全程一致；DOM 钩子对外只暴露纯函数，副作用受 `isActive` 守卫。
- **风险留档**：9.x 词典 vs 10.24 界面靠精确匹配安全降级；拼接片段词条不命中即无副作用；模板字符串 v1 不做，已在 README 声明。
