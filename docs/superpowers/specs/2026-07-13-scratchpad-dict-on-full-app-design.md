# 设计：把 Scratch Pad DOM 词典应用到完整版 Postman（网页版 + 桌面登入态）

日期：2026-07-13
分支：`feat/scratchpad-dict-on-full-app`

## 背景与问题

本项目有两套并存的汉化机制：

- **`pm-chinese.js`**：拦截 Postman 的 `_ar-assets/locales/<lang>/<module>.json` 语言包响应，deep-merge 中文。覆盖登入态完整版界面（桌面主窗口 + 网页版扩展）。数据双源：浏览器取全局 `window.__PM_I18N__`，桌面用 `fs` 读 `pm-chinese-data.json`。
- **`pm-scratchpad-cn.js`**：运行时 DOM 翻译（MutationObserver + 整串精确匹配），只在 `file://…scratchpad` 登出态本地窗口激活。词典 `pm-scratchpad-data.json`（由 `locales/scratchpad/zh-CN.json` 构建）含约 3700 条。

问题：语言包（`pm-chinese`）没覆盖的很多 UI 文案——导入弹窗、请求设置、标签页右键菜单、模板面板、主题设置等——只存在于 Scratch Pad DOM 词典里。因为 DOM 翻译器被 `isActive()` 的 `file://…scratchpad` 守卫挡住，这些串在**完整版 Postman**（网页版、桌面登入态主窗口）里仍显示英文。

目标：让 Scratch Pad DOM 词典在完整版 Postman 里也生效，补语言包的缺口。

## 决策（与用户确认）

1. **范围**：网页版（Chrome/Edge 扩展）+ 桌面登入态主窗口。
2. **姿势**：词典全量照搬，最大覆盖；接受完整版里偶发的短通用词误译（如 `New/Type/Auto/Light/Dark/Skip`），发现后再拉黑名单。不预先加长度/黑名单护栏。
3. **方案**：沿用 `pm-chinese.js` 的双源模式（方案 A），保持「拦包」与「观察 DOM」两套机制职责分离，不合并。

## 架构改动

### ① `pm-scratchpad-cn.js`（唯一真源，桌面与网页共用）

**`loadDict()` 改双源**，顺序对齐 `pm-chinese.js`：

1. 若 `globalThis.__PM_SCRATCHPAD__` 存在 → 直接返回（浏览器扩展预置，无 `fs`）。
2. 否则若 `require` 可用 → `fs.readFileSync(__dirname/pm-scratchpad-data.json)` 解析返回（桌面）。
3. 都失败 → 返回 `null`（记 `console.error`）。

**`isActive(loc)` 放宽为「Postman 上下文即激活」**，仍保留守卫：

- host 匹配 `/(^|\.)(postman\.co|postman\.com|getpostman\.com)$/i` → true（网页版）
- `loc.protocol === 'file:'` → true（桌面端 Scratch Pad 与登入态主窗口均为 Electron 窗口；preload 只注入到 Postman 窗口，故 file: 即 Postman 上下文）
- `globalThis.__PM_SCRATCHPAD__` 存在 → true（扩展上下文兜底）
- 否则 false

保持纯函数可测：只依赖入参 `loc` 与全局标志；不读 `process`/`fs`。Node 单测环境 `location` 为 undefined，副作用守卫（`typeof location !== 'undefined' && isActive(location)`）不触发。

### ② `build-extension.js`

- 读 `locales/scratchpad/zh-CN.json`，生成 `dist/extension/pm-scratchpad-data.js`（内容 `window.__PM_SCRATCHPAD__ = <json>;`）。
- 复制 `pm-scratchpad-cn.js` 到 `dist/extension/`。
- manifest `content_scripts[0].js` 改为 `['pm-i18n-data.js','pm-chinese.js','pm-scratchpad-data.js','pm-scratchpad-cn.js']`（数据脚本在各自钩子之前）。
- 词典文件缺失时告警并跳过 Scratch Pad 部分，不阻断扩展生成（与 `build-data.js` 行为一致）。

### ③ 桌面端 `postman-chinese-injector.js` —— 零改动

`pm-scratchpad-cn.js` 已随 preload 注入每个窗口、`pm-scratchpad-data.json` 已落地 preload 同目录。仅靠 ① 的 `isActive` 放宽即可让登入态主窗口生效。改 `pm-scratchpad-cn.js` 单一文件即自动随桌面构建生效（`build-data.js` 会把它快照进 `pm-scratchpad-src.json`）。

## 数据流

- **网页版**：`pm-scratchpad-data.js` 在 MAIN world / document_start 预置 `window.__PM_SCRATCHPAD__` → `pm-scratchpad-cn.js` 的 `loadDict()` 取全局 → `isActive` 因 host 匹配为真 → MutationObserver 翻译 DOM。
- **桌面登入态主窗口**：preload 里 `require('./pm-scratchpad-cn.js')` → `loadDict()` 走 `fs` → `isActive` 因 `file:` 为真 → 翻译。
- **桌面 Scratch Pad**：同上，`isActive` 因 file:+scratchpad 仍为真（行为不变）。

## 测试与验证

- **单测** `test/pm-scratchpad-cn.test.js`：新增/更新 `isActive` 用例——
  - `{protocol:'https:', hostname:'go.postman.co'}` → true
  - `{protocol:'https:', hostname:'web.postman.co'}` → true
  - `{protocol:'file:', pathname:'/x/scratchpad/index.html'}` → true
  - `{protocol:'file:', pathname:'/x/app/index.html'}` → true（桌面主窗口）
  - `{protocol:'https:', hostname:'example.com'}` → false
  - 全局 `__PM_SCRATCHPAD__` 存在时 → true
- **网页手测**：`npm run build:ext` → Chrome 装载 `dist/extension` → 打开 `go.postman.co` 登入态 → 验证仅存在于 scratchpad 词典的串（如导入弹窗「注册以解锁所有导入方式」/ 标签右键「复制所选标签页」）变中文。
- **桌面手测**：`npm run patch` → 打开登入态主窗口 → 验证同一串。

## 唯一待运行确认项 / 风险

- **桌面登入态主窗口 URL scheme 未 100% 确认**。若为 `file://` 则被守卫覆盖；若为自定义协议，实现阶段在运行的主窗口 console 打 `location.href` 确认，必要时补 Electron 上下文判断（`process.versions.electron`）作为 `isActive` 之外的激活信号。此点须运行时敲定。
- **短通用词误译**：按决策接受，后续黑名单。
- **大页面性能**：MutationObserver 已批处理；完整版 DOM 更大但可接受。编辑器子树（CodeMirror/Monaco/input/textarea/contenteditable）本就跳过，请求体/脚本/响应编辑区不受影响。

## 非目标（YAGNI）

- 不合并两套钩子（不做方案 C）。
- 不加长度阈值/黑名单护栏（除非日后误译成问题）。
- 不改桌面注入器逻辑。
