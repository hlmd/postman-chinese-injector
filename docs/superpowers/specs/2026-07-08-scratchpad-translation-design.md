# Scratch Pad 汉化设计（运行时 DOM 翻译）

日期：2026-07-08
状态：已批准设计，待写实现计划

## 背景与问题

Postman 桌面端在**登出状态**运行的是本地打包的 "Scratch Pad" 界面
（`js/scratchpad/scratchpad.js`，约 17.6MB）。经调查（见下）确认：

- **登入态（Requester）**：主界面从远程 `https://desktop.postman.com` 加载
  （`config.json` 的 `__WP_DESKTOP_UI_UPDATE_URL__`），使用与新版 Postman 相同的
  locale-pack i18n 机制。现有 `pm-chinese.js`（拦截 `_ar-assets/locales/…` 的 fetch/XHR
  并 deep-merge 中文）**已能汉化**它。
- **登出态（Scratch Pad）**：界面是**本地 bundle**，UI 文案是**硬编码英文字符串字面量**
  （如 `name:"New Request"`、`"Save Response"`、`"Scratch Pad"`），**没有 i18n key、
  没有 locale-pack 网络请求**。因此 fetch 拦截钩子对它**完全无效**。

现有翻译数据 `locales/zh-CN/*.json` 按 i18n key 组织、值为中文、**不含英文原文**，
所以**无法复用**到「英文→中文」的文本替换场景。

## 目标

为登出态 Scratch Pad 提供中文界面，采用**运行时 DOM 翻译**：注入脚本在渲染进程里
监听 DOM，把**与词典精确匹配**的可见英文文本换成中文。

非目标（v1 不做）：
- 参数化/模板字符串（`This ${collection} is empty` 等）——后续版本再加。
- 100% 覆盖 17.6MB bundle 的所有字符串。
- 触碰登入态远程界面（由现有 fetch 钩子负责）。

## 数据来源

复用已归档的前身项目 `D:\Sinicization\Postman\Postman-cn` 的词典
（`php/lang/**`，Postman 9.x 时代、同属硬编码字面量 bundle 家族）。

- 词条格式为 PHP 数组 `'"English"' => '"中文"'`（双引号）/ `"'English'" => "'中文'"`
  （单引号），`______` 为占位符需跳过，`${}`/反引号为模板需跳过。
- **范围**：仅 `php/lang/js/scratchpad/**`（探针实测去重后 **3,672 条**唯一 EN→ZH 纯文本对）。
- 因 Postman-cn 已归档，提取结果**内置（vendor）进本仓库**，构建脚本仅用于再生成。

## 架构与组件

三个组件，各自单一职责、可独立测试：

### 1. `scripts/build-scratchpad-dict.js`（构建期提取器）

- 输入：Postman-cn 的 `php/lang/js/scratchpad/**/*.php`（路径为可配置常量）。
- 处理：逐行匹配 `<php-quoted> => <php-quoted>`；剥离外层 PHP 引号（处理 `\'`/`\"`/`\\`
  转义）；再剥离内层 JS 引号得可见文本；跳过含 `______`、含 `${`、以反引号开头、
  或内层非「纯带引号字面量」（形如 `title:"X"` 的代码上下文）的条目；去重（先到先得）。
- 输出：`locales/scratchpad/zh-CN.json`，扁平 `{ "English": "中文" }`。
- 幂等：同输入产同输出，可重复运行。

### 2. `pm-scratchpad-cn.js`（运行时 DOM 翻译钩子，新增）

与 `pm-chinese.js` 同为渲染进程 preload 加载的运行时钩子，放在 preload 同目录。

- **激活守卫**：仅当 `location.protocol === 'file:'` 且 `location.pathname` 含 `scratchpad`
  时激活——精确锁定登出态 Scratch Pad 窗口，绝不影响登入态远程界面（`https:`）与其他窗口。
- **数据加载**：优先 `require('fs')` 读同目录 `pm-scratchpad-data.json`（Scratch Pad 窗口
  webPreferences 为 `nodeIntegration=true` + `contextIsolation=false`，`require`/`fs` 可用）；
  读不到则静默退出（与 `pm-chinese.js` 同款容错）。
- **翻译逻辑**：
  - 启动时全量遍历 + `MutationObserver`（`childList` + `characterData` + `subtree`）增量处理。
  - 仅处理**文本节点**：取 `nodeValue`，按 `^(\s*)([\s\S]*?)(\s*)$` 拆出前后空白与核心文本；
    若 `DICT.has(core)` 则替换为 `前空白 + DICT[core] + 后空白`（**精确整串匹配**，保留空白）。
  - 属性翻译：`placeholder` / `title` / `aria-label`（同样精确整串匹配）。
  - **跳过可编辑/代码区**：遍历时若节点祖先命中 `textarea`、`input`、`[contenteditable]`、
    `.CodeMirror`、`.monaco-editor`（代码编辑器）则跳过——防止篡改用户输入的请求体/URL 等。
- **幂等/防误伤**：只在**去空白后完全等于**词典 key 时替换；中文结果不再匹配任何英文 key，
  不会二次替换。

### 3. 注入器集成（改 `postman-chinese-injector.js`）

- 在 `patchAsar` / `patchDir` 里，除现有 `pm-chinese.js` + `pm-chinese-data.json` 外，
  额外把 `pm-scratchpad-cn.js` + `pm-scratchpad-data.json` 写到 preload 同目录，
  并在注入块里追加 `require('./pm-scratchpad-cn.js')`。
- 还原（restore）与状态（status）相应识别/清理新增文件。
- 两钩子**共存**：fetch 钩子管登入态远程界面，DOM 钩子管登出态本地 Scratch Pad，
  各自守卫、互不干扰。
- **二进制内嵌**：`bun --compile` 会把 `__dirname` 固化到构建路径，运行时不能 fs 读旁边的文件，
  须走 `require()` 内嵌（见现有 `pm-chinese-src.json` 存钩子源码、`pm-chinese-data.json` 存数据）。
  故 Scratch Pad 需并行产出 `pm-scratchpad-src.json`（`{src}`，DOM 钩子源码）与
  `pm-scratchpad-data.json`（词典），由 `scripts/build-data.js`（或同类）一并生成、供编译内嵌；
  `hookSource()`/`loadEmbedded()` 增加对应的 scratchpad 读取分支。

## 数据流

```
构建期： Postman-cn/php/lang/js/scratchpad/**  ──build-scratchpad-dict.js──▶  locales/scratchpad/zh-CN.json（内置）
注入期： locales/scratchpad/zh-CN.json  ──injector──▶  <preload 同目录>/pm-scratchpad-data.json  +  pm-scratchpad-cn.js  +  require 注入行
运行期： Scratch Pad 渲染进程  ──preload 加载 pm-scratchpad-cn.js──▶  守卫通过 ▶ 读 data ▶ 遍历+MutationObserver ▶ 精确匹配替换可见文本/属性
```

## 错误处理与降级

- 词典版本漂移（9.x 词条 vs 10.24 界面）：精确匹配下**过期词条不触发、缺失新词保持英文**，
  安全降级，无损坏风险。
- 拼接片段类词条（源文件里跨拼接、带悬空引号，如 `"Response too large. …\""`）在 DOM 里
  匹配不到整串——构建期已过滤大部分；剩余不命中即无副作用，属可接受的覆盖缺口。
- `fs`/`require` 不可用或读数据失败：钩子静默 return，不抛错、不影响 Postman。
- 首屏可能出现英文瞬时闪烁后被替换（preload 于 document_start 建好 observer 可最小化），
  v1 接受，后续可用 CSS「就绪前隐藏」优化。

## 测试策略

- **提取器单测**：给一小段样例 PHP（含双/单引号、`______`、`${}`、`title:"X"` 上下文），
  断言输出只含预期纯文本对、正确去重、正确处理转义。
- **DOM 翻译单测**（jsdom 或轻量 DOM stub）：
  - 精确匹配的文本节点被替换；非匹配不动。
  - 前后空白保留。
  - 属性（placeholder/title/aria-label）被翻译。
  - 可编辑/代码区（contenteditable/.CodeMirror/textarea）内的文本**不被**翻译。
  - MutationObserver 对后插入节点生效。
  - 激活守卫：`https:` / 非 scratchpad 路径下钩子不动 DOM。
- **集成验证**：真实启动登出态 Scratch Pad（本地 bun 运行注入后），人工点检关键界面
  （侧栏、状态栏、常用菜单/按钮/空状态）是否中文；用临时「收集器」记录未翻译可见文本以迭代。

## 版本与发布

- 属新功能，走 minor 版本（在 1.3.0 之后，如 1.4.0）。发布沿用现有 tag 触发 CI 流程。
