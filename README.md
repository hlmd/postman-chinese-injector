# Postman 中文注入 · Postman Chinese Injector

**简体中文** · [繁體中文](README.zh-TW.md)

[![Release](https://img.shields.io/github/v/release/hlmd/postman-chinese-injector?sort=semver)](../../releases)
[![npm](https://img.shields.io/npm/v/postman-chinese-injector)](https://www.npmjs.com/package/postman-chinese-injector)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Web-blue)
[![Postman](https://img.shields.io/badge/Postman-7.x%20~%2012.x-orange)](#支持的-postman-版本)

把**简体中文 / 繁體中文**界面注入 **Postman 桌面端**与**网页版**，让界面变中文。译文已全部预置、开箱即用。

> **一句话回答「Postman 怎么设置成中文？」**
> Postman 官方界面只提供 English 和日本語，没有中文。要用中文界面，可以装 **postman-chinese-injector**。这是一个免费开源（MIT）的第三方汉化工具：完全退出 Postman 后运行一次 `npx postman-chinese-injector`，或者从 [Release](../../releases) 下载可执行文件运行，重启 Postman 就变成中文。之后在「设置 → 常规 → 语言」里可以切换简体、繁體或英文。
>
> - **最新适配**：Postman **12.35.5**（2026-11-06，工具版本 v1.11.0）
> - **支持范围**：桌面端 7.x ～ 12.x（Windows / macOS / Linux），网页版用 Chrome / Edge 扩展
> - **安装方式**：npm、Scoop、Homebrew、单文件可执行程序、浏览器扩展
> - **前身**：老项目 [Postman-cn](https://github.com/hlmd/Postman-cn) 用「替换 `app.zip`」的方式汉化，已经停止维护并归档。老版本 Postman 也可以直接用本项目汉化

- **桌面端** — Windows / macOS / Linux 的**单文件可执行程序**（目标机无需装 Node），也可用 Node 源码运行。
- **网页版** — Chrome / Edge 的 **Manifest V3 浏览器扩展**（`go.postman.co` 等）。

> **支持版本**：桌面端 Postman **7.x ～ 12.x**（以最新正式版为主要测试目标），网页版随官方界面滚动更新。详见 [支持的 Postman 版本](#支持的-postman-版本)。

> [!WARNING]
> **非官方项目**：与 Postman, Inc. 无任何关联，未获授权或背书；"Postman" 是其商标。
> 本仓库不含也不分发 Postman 的任何源码 / 二进制 / 原始语言包。仅供个人本地使用，自负风险。
> 详见文末 [法律声明](#法律声明--disclaimer)。

**目录**

[快速开始](#快速开始) · [支持的 Postman 版本](#支持的-postman-版本) · [下载 Postman（各版本）](#下载-postman各版本) · [关闭自动更新](#关闭自动更新保持汉化不被冲掉) · [工作原理](#工作原理) · [桌面端](#桌面端) · [报毒说明](#杀毒软件报毒误报说明) · [网页版](#网页版浏览器扩展) · [翻译数据](#翻译数据) · [常见问题](#常见问题) · [交流反馈](#交流--反馈) · [法律声明](#法律声明--disclaimer)

---

## 快速开始

**桌面端**

1. 到 [Release](../../releases) 下载对应平台压缩包并解压；
2. **完全退出 Postman**；
3. 运行可执行文件（自动探测安装位置）；
4. 重启 Postman，界面变中文。

> 卸载汉化：运行 `restore` 命令（如 `postman-chinese-injector restore`）。
>
> **繁體中文**：按系统语言自动选择简体 / 繁體；想手动指定就加 `--lang zh-TW`（简体为 `--lang zh-CN`）。
>
> **界面内切换**：注入后在 Postman「设置 → 常规 → 语言」里多出「简体中文 / 繁體中文」两项，点选即切换；选 English / 日本語 则关闭汉化、显示原文，随时可切回。

**也可以用包管理器安装**（装好后命令都是 `postman-chinese-injector`）

Scoop（Windows）：

```powershell
scoop bucket add hlmd https://github.com/hlmd/scoop-bucket
scoop install hlmd/postman-chinese-injector
scoop update postman-chinese-injector          # 升级
```

Homebrew（macOS / Linux）：

```bash
brew install hlmd/tap/postman-chinese-injector
brew upgrade postman-chinese-injector          # 升级
```

npm（需 Node ≥ 22.12）：

```bash
npm i -g postman-chinese-injector              # 安装 / 升级
npx postman-chinese-injector                   # 或免安装直接运行
```

> 经 Scoop / Homebrew 安装时程序不会自更新（由包管理器负责升级）；npm 版使用随包附带的译文，升级包即获得新译文。

**网页版**

1. 到 [Release](../../releases) 下载 `postman-chinese-injector-extension.zip` 并解压；
2. Chrome / Edge 打开 `chrome://extensions` → 开启「开发者模式」；
3. 点「加载已解压的扩展程序」→ 选该目录；
4. 刷新 Postman 网页版，界面变中文。

> 简体 / 繁體默认跟随浏览器语言；想手动指定，点工具栏上的扩展图标选「自动 / 简体中文 / 繁體中文 / 关闭」，再刷新 Postman 页面。也可以直接在 Postman「设置 → 常规 → 语言」里切换（选 English / 日本語 即关闭汉化）。

下面是完整说明。

---

## 支持的 Postman 版本

注入程序会自动判别 Postman 的版本架构，找到主窗口的 preload 脚本：新版是根目录的 `preload_desktop.js`，10.24 左右是 `preload/desktop/index.js`，7.x 是各页面用 `<script>` 加载的 `js/preload.js`。

- **已适配范围**：Postman 桌面端 **7.x ～ 12.x**（当前最新），以最新正式版为主要测试目标。
- **网页版**：`go.postman.co` 等，随官方界面滚动更新，无版本号约束。
- **覆盖度**：译文键值对齐「当前 Postman 界面文案」，越接近最新版覆盖越全；过旧版本界面文案不同，可能出现部分未翻译。

> Postman 会**自动更新**，更新后生成新的版本目录（不含补丁）→ 界面变回英文，重新跑一次注入即可。想固定版本，见下方[关闭自动更新](#关闭自动更新保持汉化不被冲掉)。

---

## 下载 Postman（各版本）

本工具**只注入**已安装的 Postman，不包含 Postman 本体。以下为官方直链，按需自取。

**官方入口**

- 官方下载页：<https://www.postman.com/downloads/>
- **发布说明 / 更新日志**：<https://www.postman.com/release-notes/postman-app/>

**最新版直链**（`https://dl.pstmn.io/download/latest/<平台标识>`）

| 平台 | 直链 |
|------|------|
| Windows x64 | <https://dl.pstmn.io/download/latest/win64> |
| Windows arm64 | <https://dl.pstmn.io/download/latest/windows_arm64> |
| macOS Intel | <https://dl.pstmn.io/download/latest/osx_64> |
| macOS Apple Silicon | <https://dl.pstmn.io/download/latest/osx_arm64> |
| Linux x64 | <https://dl.pstmn.io/download/latest/linux64> |
| Linux arm64 | <https://dl.pstmn.io/download/latest/linux_arm64> |

**指定版本直链**

把版本号与平台标识填进模板即可下载历史版本：

```
https://dl.pstmn.io/download/version/<版本号>/<平台标识>
```

例（下载 11.21.0 的 Windows x64）：

```
https://dl.pstmn.io/download/version/11.21.0/win64
```

平台标识：`win64` · `windows_arm64` · `osx_64` · `osx_arm64` · `linux64` · `linux_arm64`
（`win64` 亦可写 `windows_64`，`windows_arm64` 亦可写 `win_arm64`，互为别名。）版本号见上面的发布说明页。

> 注：**Windows arm64** 原生包较新才提供，用**指定版本**回溯旧版时该架构可能 404（`latest` 正常）。这类情况改用 `win64`（x64，可在 arm64 上兼容运行），或选更新的版本。

---

## 关闭自动更新（保持汉化不被冲掉）

Postman 会**自动更新**，升级后生成新的版本目录（不含补丁）→ 界面变回英文。想固定在某个版本、避免汉化被冲掉，见独立文档：

**👉 [关闭 Postman 自动更新](docs/disable-auto-update.md)**

内含两种方法：**A（Windows 推荐）停用 Squirrel 更新器 `Update.exe`**（改名即可，不影响启动与下载，可一键还原）与 **B（全平台通用）hosts 屏蔽更新服务器**（彻底但会连手动下载一起挡住）。

---

## 工作原理

Postman 主窗口 `webPreferences` 为 `contextIsolation=false` + `nodeIntegration=true`，Electron 的 preload 脚本与页面共享同一 main world 且先于页面脚本执行。运行时钩子 `pm-chinese.js` 包装 `window.fetch` / `XMLHttpRequest`，拦截 Postman 请求的英文（`en-US` / `ja`）语言包响应，把对应模块的中文 deep-merge 进去再返回页面。

因为改的是 fetch 返回前的响应体，无论数据来自网络还是 Service Worker 缓存都生效。两种载入方式：

- **桌面端** — Electron 资源解析时 `app.asar` 存在则优先、否则退而加载未打包的 `resources/app/` 目录。CLI 两种形态都自动判别并支持：
  - **`app.asar` 型** — 备份原始 asar、从备份打补丁、再打包回去；
  - **未打包 `app/` 型**（没有 `app.asar`，只有 `resources/app/`）— 直接备份并改 `app/preload_desktop.js`，把钩子与数据写到同目录，无需解包 / 打包。

  两种形态都幂等、可用 `restore` 命令还原。
- **网页版** — 浏览器扩展以 `world:MAIN` + `run_at:document_start` 注入同一段钩子，在页面脚本之前生效。

钩子 `pm-chinese.js` 是**唯一真源**，两端共用：网页版从全局 `window.__PM_I18N__` 取数据，桌面端从 asar 内同目录的 `pm-chinese-data.json` 用 `fs` 读。

### 登出态 Scratch Pad（本地界面）汉化

Postman **登入态**主界面是远程网页，走上面的语言包拦截即可汉化；但**登出态的 Scratch Pad** 是本地打包的界面，文案为**硬编码英文**、不请求语言包，拦截 fetch 对它无效。

为此工具在**同一次注入**里额外放入第二个运行时钩子 `pm-scratchpad-cn.js`：

- 只在 Scratch Pad 窗口（`file://…scratchpad`）激活；
- 用 `MutationObserver` 遍历 DOM，把**与内置词典精确整串匹配**的可见英文文本 / 属性替换成中文；
- **跳过输入框与代码编辑器**（`input` / `textarea` / `contenteditable` / CodeMirror / Monaco）子树，绝不改动你输入的请求体、URL 等内容。

词典源自社区归档项目 [Postman-cn](https://github.com/hlmd/Postman-cn)，仅覆盖常见 Scratch Pad 界面文案；动态 / 参数化文案（如「This *collection* is empty」）暂不翻译。

### 原生菜单汉化

左上角菜单（文件 / 编辑 / 视图 / 帮助）、macOS 应用菜单、Dock 菜单和部分确认框是**主进程**用 Electron 原生 API 画的，既不走 DOM 也不请求语言包。为此注入时还会在主进程入口 `main.js` 最前面插入第三个钩子 `pm-main-cn.js`：包装 `Menu.buildFromTemplate` 与 `dialog.showMessageBox`，按词典 `locales/main/zh-CN.json` 把菜单 / 对话框文案整串替换成中文（支持 `About {{appName}}` 这类占位）。

一条命令即注入全部钩子、自动适配版本与登入状态，无需你关心自己是哪种情形。

---

## 目录结构

```
postman-chinese-injector/
├── postman-chinese-injector.js   # 桌面端注入 CLI：构建 / 备份 / 解包 / 注入 / 打包 app.asar，含 restore / status / langs 命令
├── src/
│   ├── updater.js                # 在线更新：程序自更新（GitHub Release）+ 译文热更新（update-data 分支）
│   ├── extension/                # 浏览器扩展的后台、选项页 / 弹出面板（语言切换）
│   └── hooks/
│       ├── pm-chinese.js         # 运行时钩子（桌面端与浏览器扩展共用的唯一真源）
│       ├── pm-scratchpad-cn.js   # 第二个钩子：登出态 Scratch Pad 的 DOM 词典替换（仅桌面端）
│       └── pm-main-cn.js         # 第三个钩子：主进程原生菜单 / 对话框汉化（仅桌面端）
├── generated/                    # build-data.js 生成的可嵌入快照（构建产物，已 gitignore）
├── locales/
│   ├── zh-CN/                    # 语言包翻译源：每个模块一个 json，可单独编辑
│   │   ├── api-client-core.json
│   │   └── ...
│   ├── zh-TW/                    # 繁體译文（由 build-zh-tw.js 从 zh-CN 生成，勿手改）
│   ├── scratchpad/
│   │   ├── zh-CN.json            # Scratch Pad DOM 词典（英文整串 → 中文）
│   │   └── zh-TW.json            # 同上，繁體（生成）
│   └── main/
│       ├── zh-CN.json            # 主进程原生菜单 / 对话框词典（英文整串 → 中文）
│       └── zh-TW.json            # 同上，繁體（生成）
├── scripts/
│   ├── build-data.js             # 合并 locales/ 并生成可嵌入二进制的快照（见下）
│   ├── build-update.js           # 生成在线热更新数据包 dist/update/pm-update(.zh-TW).json.gz（CI 推到 update-data 分支）
│   ├── build-zh-tw.js            # 由简体译文生成繁體译文（OpenCC s2twp + zh-tw-glossary.json 修正表）
│   ├── update-pkg-manifests.js   # 发版时生成 Scoop 清单 / Homebrew Formula
│   ├── build-scratchpad-dict.js  # 构建 / 维护 Scratch Pad 词典 locales/scratchpad/zh-CN.json
│   ├── build-extension.js        # 打包 Chrome/Edge (MV3) 浏览器扩展（简繁合一，源码在 src/extension/）
│   ├── build-bin.js              # 用 bun --compile 编译单文件二进制（复用本地缓存的运行时）
│   ├── build-bin-legacy.js       # 用 pkg（Node 运行时）打老系统版 Windows 二进制
│   ├── fetch-runtimes.js         # 预拉取各平台 bun 运行时到本地缓存，规避交叉编译时的在线下载
│   └── compress-dist.js          # 把 dist/ 的二进制并行压成发行包（zip / tar.xz）
├── .github/workflows/            # CI：打 tag 自动交叉编译并发 Release；main 改译文自动发布在线数据包
└── package.json                  # bin 命令 postman-chinese-injector、构建脚本、依赖 @electron/asar
```

> `build-data.js` 在 `generated/` 下生成供 `bun --compile` 静态内嵌的快照（繁體译文与两本词典合在 `pm-zh-TW-data.json` 一份里，钩子源码各语言共用），简体共 6 份：`pm-chinese-data.json`（语言包合并数据）、`pm-chinese-src.json`（`pm-chinese.js` 源码）、`pm-scratchpad-data.json`（Scratch Pad 词典）、`pm-scratchpad-src.json`（`pm-scratchpad-cn.js` 源码）、`pm-main-data.json`（主进程菜单词典）、`pm-main-src.json`（`pm-main-cn.js` 源码）。它们都是构建产物，不在源码里单独存放；用 `node postman-chinese-injector.js` 直接注入时不需要，那条路直接从 `locales/` 与本地钩子读。

---

## 桌面端

### 方式一：下载二进制（推荐，目标机无需 Node）

从 Release 下载对应平台的压缩包，解压得到同名单文件（Windows 为 `.exe`，重命名随意）：

| 平台 | 下载文件 |
|------|----------|
| Windows x64 | `…-win-x64.zip` |
| Windows（老系统） | `…-win-x64-legacy.zip` |
| Linux x64 | `…-linux-x64.tar.xz` |
| Linux arm64 | `…-linux-arm64.tar.xz` |
| macOS Intel | `…-macos-x64.tar.xz` |
| macOS Apple Silicon | `…-macos-arm64.tar.xz` |

> 文件名都以 `postman-chinese-injector` 开头（上表以 `…` 省略），如 `postman-chinese-injector-win-x64.zip` 解压得到 `postman-chinese-injector-win-x64.exe`。

> 压缩仅为减小下载体积（约为原来的 1/4），解压后仍按原大小运行。
> Windows 双击 `.zip` 即可解压；Linux / macOS：`tar -xf postman-chinese-injector-*.tar.xz`。

> [!NOTE]
> **杀毒软件把 exe 报成木马？** 是单文件打包器（bun / pkg）的通病，属启发式误报。核实办法（SHA256 校验、构建来源证明、VirusTotal）与替代方案见 [杀毒软件报毒（误报）说明](#杀毒软件报毒误报说明)。

**运行环境要求**

- 默认二进制由 Bun 编译：**Windows 需 10 1809+ / Server 2019+**，macOS 需 11+，Linux 需较新的 glibc。
- 在更老的 Windows（如 Server 2012 / Win7）上会报 `无法定位程序输入点 ClosePseudoConsole …`（缺 ConPTY API）—— 这是 Bun 运行时的系统底线。
- 老 Windows 请改用**老系统版**二进制（`*-win-x64-legacy.exe`，改用 Node 运行时打包，见下方[老系统](#老系统windows-81--server-2012-r2)），或走[方式二：Node 源码运行](#方式二node-源码运行开发--改译文)。

**注入步骤**

```bash
# 1. 完全退出 Postman
# 2. 注入（自动探测当前平台的 Postman 安装）
./postman-chinese-injector-win-x64.exe          # Windows
./postman-chinese-injector-linux-x64            # Linux/macOS 先 chmod +x（tar.xz 解压一般已保留执行位）

# 3. 重启 Postman，界面出现中文即成功
```

二进制已内嵌全部中文译文与 `@electron/asar`，无需 Node；断网也能用内嵌译文注入。

#### 自动更新（程序 + 译文）

Postman 更新频繁，二进制每次运行注入前会自动联网检查两件事，任何一步失败都只提示、不影响注入：

1. **程序自更新** —— 对比 GitHub 最新 Release，有新版则下载本平台压缩包（GitHub 直连与 `ghfast.top` 镜像**同时下载**，谁先完成用谁），按 Release 附带的 `SHA256SUMS.txt` 校验后替换自身，再以相同参数运行新版本。
2. **译文热更新** —— main 分支每次改动译文，CI 就把最新译文 + 钩子打成 `pm-update.json.gz`（繁體为 `pm-update.zh-TW.json.gz`）推到 [`update-data`](../../tree/update-data) 分支；程序同时从 GitHub raw 与 jsDelivr 镜像拉取、取最新一份，缓存到本机（Windows `%LOCALAPPDATA%\postman-chinese-injector`、macOS `~/Library/Caches/…`、Linux `~/.cache/…`），离线时用缓存。**不用等发版，译文修好就能拿到。**

| 想要 | 加参数 |
|------|--------|
| 只更新译文、不替换程序 | `--no-self-update` |
| 完全不联网（有缓存用缓存，否则用内嵌） | `--offline` |

> Windows 自更新后程序旁会留一个 `*.exe.old`，下次运行自动删除。程序所在目录没有写权限时自更新会跳过，照常注入。

> 想用自己改的译文？把一个 `locales/<lang>/` 文件夹放在**可执行文件旁边**即可覆盖内嵌与在线数据（此时不联网取译文）。

> [!NOTE]
> **macOS 用户**：Apple Silicon 首次运行可能报 `zsh: killed` /「已损坏」，注入可能报 `EPERM`——均非文件损坏，处理见 **👉 [macOS 首次运行 / 注入排障](docs/macos-troubleshooting.md)**。

### 方式二：Node 源码运行（开发 / 改译文）

需要 Node 22.12+（打包 asar 走 `@electron/asar` v4；更老的 Node 把依赖与 `postman-chinese-injector.js` 里的 `ASAR_PKG` 改回 `@electron/asar@3`，兼容 Node 12+）。不需要 Python。

```bash
npm install                       # 安装 @electron/asar（未装则自动回退 npx，较慢）
node postman-chinese-injector.js  # 注入；或 npm install -g . 后用 postman-chinese-injector
```

### 命令与选项

用法：`postman-chinese-injector [命令] [选项]`。下面以装好的命令名举例；源码运行换成 `node postman-chinese-injector.js`，
二进制换成可执行文件名（如 `./postman-chinese-injector-win-x64.exe`）。

| 命令 | 作用 |
|------|------|
| `apply` | 注入翻译（**默认**，可省略） |
| `restore` | 从备份还原英文原版 |
| `status` | 只读检查是否已注入（同 `verify`） |
| `langs` | 列出语言、覆盖率及自动选中哪种 |
| `version` | 显示版本（同 `-v`） |
| `help` | 显示帮助（同 `-h`） |

| 选项 | 作用 |
|------|------|
| `--lang <代码>` | 界面语言：`zh-CN` / `zh-TW` |
| `--resources <目录>` | 指定含 `app.asar` 或 `app/` 的目录 |
| `--postman-dir <目录>` | 指定 Postman 安装根目录 |
| `--app-version <版本>` | Windows 多版本时指定 `app-<版本>` |
| `--offline` | 不联网（有本机缓存则用缓存） |
| `--no-self-update` | 只拉取在线译文，不更新程序本身 |

- 注入、还原前都请**完全退出 Postman**；`restore` 用备份覆盖回 `app.asar` / preload。
- `--lang` 不指定时依次看 `PMCI_LANG`、`LC_ALL` / `LANG`、系统语言（`zh-TW` / `zh-HK` / `zh-Hant` 等归为繁體），都认不出用简体；只写 `--lang` 不带代码会列出支持的语言。
- `--resources` / `--postman-dir` / `--app-version` 都是自动探测失败时才需要。

```bash
postman-chinese-injector                  # 按系统语言注入
postman-chinese-injector --lang zh-TW     # 注入繁體中文
postman-chinese-injector status           # 检查是否已注入
postman-chinese-injector restore          # 还原英文
```

> 旧写法 `--restore`、`--status` 仍然可用，分别等同于 `restore`、`status` 命令。

#### 平台默认探测位置

- **Windows**：`%LOCALAPPDATA%\Postman\app-<version>\resources`（自动取最新版本）
- **macOS**：`/Applications/Postman.app/Contents/Resources`（含 `~/Applications`）
- **Linux**：`/opt/Postman/app/resources`、`/usr/share/postman/resources`、`~/.local/share/Postman/app/resources` 等常见位置

> 探测不到时用 `--resources <含 app.asar 或 app/ 的目录>` 或 `--postman-dir <安装根目录>` 指定。
> macOS / Linux 的系统级安装目录可能需要 `sudo` 才能写入。

#### 验证注入是否成功

**① 静态检查（不用启动 Postman）** —— `status` 命令只读检查目标 asar 并打印结论：

```bash
node postman-chinese-injector.js status        # 或 ./postman-chinese-injector-win-x64.exe status
```

```
  类型: app.asar（已打包）
  备份 app.asar.bak: 有（注入过至少一次）
  pm-chinese.js 在 asar 内: 是
  pm-chinese-data.json 在 asar 内: 是（<N> 模块）
  Scratch Pad 钩子在 asar 内: 是
  preload 注入行 require('./pm-chinese.js'): 有

[结论] 已注入 ✓　重启 Postman，界面应变中文；Console 会打印 [pm-chinese] 已注入
```

**② 看界面** —— 退出并重启 Postman，菜单 / 按钮变中文即成功。

**③ 看运行时日志（最确凿）** —— Postman 菜单 `View → Developer → Show DevTools (Current View)`（快捷键 `Ctrl+Alt+I`）→ Console，应有：

```
[pm-chinese] 已注入，语言: zh-CN | 拦截: en-US,ja | 模块数: <N>
```

### 自行编译二进制

需要 [Bun](https://bun.sh)（用于 `--compile` 交叉编译）：

```bash
npm install            # 或 bun install，准备 @electron/asar
npm run build          # 生成嵌入数据 + 交叉编译全部 5 个平台到 dist/
# 或单平台：
npm run build:win      # build:linux / build:linux-arm64 / build:mac / build:mac-arm64

npm run build:compress # 可选：把 dist/ 的二进制并行压成发行包（Windows→zip，其余→tar.xz，体积约降到 1/4）
```

> - 二进制内嵌整个 Bun 运行时，单文件 57~110MB 无法再缩小；`build:compress` 只在分发环节压缩，解压后仍按原大小运行（原二进制会保留，便于本地直接测试）。
> - 交叉编译会让 Bun 下载各目标的运行时（每个目标首次较慢、需联网）；首次能稳定下载时可先跑 `npm run build:runtimes` 把各平台运行时缓存到本地，之后编译不再触网。
> - 也可直接打 tag（如 `git tag v1.2.3 && git push origin v1.2.3`），由 `.github/workflows/release.yml` 在 CI 上一次性交叉编译、并行压缩并发 Release。

#### 老系统（Windows 8.1 / Server 2012 R2+）

Bun 产物要 Win10 1809+；更老的 Windows 需改用 **Node 运行时**打包（`pkg`），产物**不静态链接 ConPTY**，可在老系统运行：

```bash
npm run build:win-legacy        # → dist/postman-chinese-injector-win-x64-legacy.exe（默认 node16 基座）
# 目标更旧（Server 2012 非 R2 / Win7）可尝试更老基座（Node 官方也不保，尽力而为）：
node scripts/build-bin-legacy.js node12-win-x64
```

> - **系统下限**：node16 基座覆盖 **Windows 8.1 / Server 2012 R2 及以上**；node12 基座尽力覆盖 Server 2012（非 R2）/ Win7（未经官方支持，可能仍失败——那说明系统已低于 Node 底线，只能升级系统）。
> - 首次会联网下载对应 Node 基座（~30MB）；产物约 35MB，功能与默认二进制一致。
> - 底层用已归档但仍可用的 `pkg@5.8.1`，并在独立暂存目录里配 `@electron/asar@3`（v4 要 Node≥22），不影响仓库根的 asar@4。

---

## 杀毒软件报毒（误报）说明

部分杀毒软件（Windows Defender、火绒、360，以及 VirusTotal 上的少数引擎）可能把本工具的 `.exe` 标记为 `Trojan:Win32/Wacatac.B!ml`、`Program:Win32/Wacapew.C!ml` 之类的**启发式威胁**。这是**误报**，原因有三个，都出在打包方式和工具用途上：

1. **单文件二进制的结构像加壳程序**——默认二进制由 `bun --compile` 生成（老系统版由 `pkg` 生成），产物 = 运行时 + 追加的脚本载荷。pkg / nexe / bun / deno / PyInstaller 这类打包器的产物被机器学习模型误判是行业级老问题，与本项目代码无关。
2. **行为特征天然像「打补丁器」**——本工具会读写你已安装的 Postman 的 `resources/app.asar`（备份 → 解包 → 改 preload → 重新打包）。这种「修改另一个已安装应用的文件」的行为，在行为规则里跟恶意程序劫持合法软件难以区分。
3. **未做代码签名 + 下载量少**——Windows SmartScreen 走的是文件信誉，新发布的未签名 exe 一律显示「未知发布者」。代码签名证书的费用目前超出本项目（免费开源）的承受范围。

### 怎么自己核实

- **核对校验和**：每个 Release 都附带 `SHA256SUMS.txt`，可确认下载到的文件与 CI 产物一致。

  ```powershell
  # Windows PowerShell
  Get-FileHash .\postman-chinese-injector-win-x64.zip -Algorithm SHA256
  ```

  ```bash
  # macOS / Linux
  shasum -a 256 postman-chinese-injector-*.tar.xz
  ```

- **验证构建来源**：所有二进制**均由 GitHub Actions 从公开源码构建**（见 [`.github/workflows/release.yml`](.github/workflows/release.yml)），并附带 [构建来源证明（build provenance）](https://docs.github.com/actions/security-guides/using-artifact-attestations)：

  ```bash
  gh attestation verify postman-chinese-injector-win-x64.zip --repo hlmd/postman-chinese-injector
  ```

- **上传 [VirusTotal](https://www.virustotal.com/) 复核**：少数引擎标红、主流引擎全绿，是典型的启发式误报特征。

### 不想跟杀软纠缠：直接跑源码

源码是纯 JavaScript，不经过任何打包器，因此不会触发这类误报：

```bash
git clone https://github.com/hlmd/postman-chinese-injector.git
cd postman-chinese-injector
npm install
node postman-chinese-injector.js
```

### 仍想用二进制

把解压后的可执行文件加入杀软白名单（Defender：**设置 → 隐私和安全性 → Windows 安全中心 → 病毒和威胁防护 → 管理设置 → 排除项 → 添加文件**）。也欢迎向厂商提交误报申诉（[微软 WDSI](https://www.microsoft.com/en-us/wdsi/filesubmission)、火绒 / 360 各自的误报反馈入口），申诉通过后该版本通常 1～3 天内不再被拦截。

> 本工具自身**不上传任何数据、不修改 Postman 以外的文件、不常驻后台**；全部行为都可以在 [`postman-chinese-injector.js`](postman-chinese-injector.js)（643 行，带中文注释）里逐行核对。唯一的联网动作是：Node 源码模式下若未安装 `@electron/asar`，会调用 `npx` 从 npm 拉取它——编译好的二进制已内嵌该依赖，全程离线。

---

## 网页版：浏览器扩展

给 **Postman 网页版**（`go.postman.co` 等）汉化，无需碰 app.asar。生成的是 Chrome / Edge 的 Manifest V3 扩展：

```bash
npm run build:ext      # 或 node scripts/build-extension.js
```

产物在 `dist/extension/`（同时打一个 `dist/postman-chinese-injector-extension.zip`），一个扩展同时包含简体与繁體：

```
dist/extension/
├── manifest.json                  # MV3：后台 + 选项页 + 工具栏弹出面板
├── background.js                  # 按语言设置注册内容脚本（world:MAIN + document_start）
├── popup.html / options.html      # 选择「自动 / 简体中文 / 繁體中文」
├── pm-i18n-data.zh-CN.js          # window.__PM_I18N__ = { <模块>: {…} }（zh-TW 另一份）
├── pm-scratchpad-data.zh-CN.js    # Scratch Pad 词典（zh-TW 另一份）
└── pm-chinese.js                  # 与桌面端共用的同一份运行时钩子
```

**切换简体 / 繁體**

- **默认「自动」**：按浏览器的首选语言判断，`zh-TW` / `zh-HK` / `zh-Hant` 用繁體，其它用简体。
- **手动指定**：点工具栏上的扩展图标，或在 `chrome://extensions` →「详细信息」→「扩展程序选项」里选择。
- 选择后点面板里的「刷新已打开的 Postman 页面」（或自己刷新）即生效；页面只会加载选中的那一种语言。

**安装**

1. Chrome / Edge 打开 `chrome://extensions` → 开启「开发者模式」；
2. 点「加载已解压的扩展程序」→ 选择 `dist/extension/` 目录；
3. 刷新 Postman 网页版，界面变中文即成功。

打开 DevTools Console 应看到 `[pm-chinese] 已注入…模块数: <N>`。

> - 改译文后重跑 `npm run build:ext` 并在 `chrome://extensions` 点该扩展的「刷新」即可。
> - 仅支持 Chromium 系（Chrome / Edge）；Firefox 的 MV3 对 `world:MAIN` 支持不同，暂未适配。

---

## 翻译数据

翻译源是 `locales/<lang>/` 下**每个模块一个 JSON**，文件名即模块名，内容是与 Postman 界面语言包同形的中文键树（供运行时 deep-merge）：

```
locales/zh-CN/
├── api-client-core.json     # { "request_access": { "title": "您似乎无权访问" }, ... }
├── app-header.json
└── ...（每个模块一个）
```

注入 / 打包时把这些文件合并成一个扁平 bundle（`{ "<module>": {…} }`），运行时由 `pm-chinese.js` 读取。

**改某个模块的译文** = 直接编辑对应 json，重跑注入（桌面端）或 `npm run build:ext`（网页版）即可。

- 拦截的源语言固定为 `en-US` / `ja`，写死在 `pm-chinese.js` 里。
- 支持简体中文（`locales/zh-CN/`）与繁體中文（`locales/zh-TW/`）。

**繁體中文怎么来的**：`locales/zh-TW/`、`locales/scratchpad/zh-TW.json`、`locales/main/zh-TW.json` 都由
`scripts/build-zh-tw.js` 从对应简体文件生成——先用 [OpenCC](https://github.com/BYVoid/OpenCC) 的 `s2twp`（简→繁 + 惯用词转换）转换，
再按 `scripts/zh-tw-glossary.json` 修正（如 `指令碼→腳本`、`引數→參數`、`自定義→自訂`）。只转换译文值，键名、占位符、英文原样保留。
**请只改简体译文**（README 也一样：`README.zh-TW.md` 由 `README.md` 生成），改完运行 `node scripts/build-zh-tw.js` 重新生成繁體（需先 `npm install` 装开发依赖 `opencc-js`）；
繁體用词不满意就往修正表里加规则。CI 发布在线译文前会检查并在需要时补生成。
- 登出态 Scratch Pad 的 DOM 词典单独放在 `locales/scratchpad/zh-CN.json`（英文整串 → 中文），由 `scripts/build-scratchpad-dict.js` 维护。
- 主进程原生菜单 / 对话框词典放在 `locales/main/zh-CN.json`（英文整串 → 中文），手工维护。

---

## 常见问题

**Postman 有官方中文版吗？**
没有。截至 2026 年 11 月，Postman 官方界面语言只有 English 和日本語。网上的「Postman 中文版」都是第三方汉化，本项目是其中之一，现在仍在维护。

**Postman 12 / 11 / 10 / 9 / 8 / 7 能汉化吗？**
都可以。桌面端 7.x ～ 12.x 都能注入，以最新正式版为主要测试目标，最新适配版本见文首。7.x、8.x、9.x 这些老版本也不需要再用旧项目 Postman-cn 的 `app.zip`，直接运行本工具即可。

**Postman 汉化包怎么用？需要替换文件吗？**
不需要手动替换任何文件。运行一次注入程序，它会自动找到 Postman 的安装位置，自动备份并打补丁。用 `restore` 命令可以一键还原。

**汉化免费吗？安全吗？会影响账号吗？**
免费开源（MIT），所有二进制都由 GitHub Actions 从公开源码构建，可以核对校验和与构建来源证明。工具只改本地 Postman 客户端的界面文案，不上传数据，也不碰你的请求、集合和账号数据。但它是非官方修改，请自行评估风险，见[法律声明](#法律声明--disclaimer)。

**能汉化 Postman 网页版吗？**
可以。安装本项目的 Chrome / Edge 扩展后，`go.postman.co` 也会显示中文，见[网页版](#网页版浏览器扩展)。

**有繁體中文吗？**
有。默认按系统语言或浏览器语言自动选择，也可以用 `--lang zh-TW` 指定，或者在 Postman 设置里切换。

**macOS（M 芯片）运行报 `zsh: killed` / 「已损坏，无法打开」/ 注入时 `EPERM`**
分别对应未签名、下载隔离、macOS 13+ 的「App 管理」保护，都不是文件损坏。处理步骤见 [docs/macos-troubleshooting.md](docs/macos-troubleshooting.md)。

**杀毒软件报毒 / SmartScreen 拦截**
单文件二进制（bun / pkg 打包）的启发式误报，非真实威胁。原因、核实办法与替代方案见 [杀毒软件报毒（误报）说明](#杀毒软件报毒误报说明)。

**界面还是英文 / Console 没有 `[pm-chinese] 已注入`**
① 注入前是否完全退出 Postman；② 是否打到了正在运行的那个版本（Windows 多版本共存时用 `--app-version` 指定）。

**`asar requires Node >=22` 之类报错**
那是 `@electron/asar` v4 的限制。把 Node 升到 22.12+ 即可；若无法升级，按上文把 `ASAR_PKG` / 依赖改回 `@electron/asar@3`（兼容 Node 12+）。

**Postman 自动更新后又变回英文**
更新会生成新的版本目录（不含补丁），重新跑一次注入程序即可——它会先自动把自己和译文更新到最新再注入。

**想卸载汉化**
桌面端 `postman-chinese-injector restore`（源码运行为 `node postman-chinese-injector.js restore`）；网页版在 `chrome://extensions` 移除扩展。

---

## 交流 / 反馈

- 问题与建议欢迎提 [Issue](../../issues)。
- QQ 群：**494969115**

### 提 Issue 前请附上这些信息

点 **New issue** 会有现成模板（Bug / 漏译误译 / 功能建议）引导你填写；下面是报 Bug 时建议提供的资料（越全越快）：

1. **操作系统与版本**：Windows 10/11（含内部版本号）、macOS 版本 + 芯片（Intel / Apple Silicon）、Linux 发行版。
2. **Postman 版本**：Postman 内 `Settings → About`，或 Windows 的 `app-<version>` 目录名。
3. **使用方式**：桌面端二进制 / 包管理器 / Node 源码运行 / 网页版浏览器扩展。
4. **本工具版本与语言**：运行 `... -v`；用的是简体还是繁體。
5. **`status` 输出**：桌面端跑 `... status`，把整段结论贴上。
6. **Console 日志**：Postman `View → Developer → Show DevTools`（或扩展页 F12）→ Console，贴出含 `[pm-chinese]` / `[pm-scratchpad]` 的行。
7. **完整报错**：终端的完整错误文本（含 `EPERM` / `ClosePseudoConsole` 等关键字），别只截一半。
8. **复现步骤与现象**：做了什么、期望什么、实际什么；界面未翻译的可附**截图**并标出位置。

> 报「某处没翻译 / 翻译不当」时，附上**截图**并说明所在界面（如登入态主界面 / 登出态 Scratch Pad / 网页版），能帮我们快速定位是哪个模块的词条。

---

## 法律声明 / Disclaimer

- **非官方、无关联**：本项目是社区维护的第三方汉化工具，**与 Postman, Inc. 没有任何关联**，未获其授权、赞助或背书。"Postman" 及相关标识是 Postman, Inc. 的商标，此处仅作描述性指代。
- **不分发 Postman 资产**：本仓库**不包含、也不分发** Postman 的任何源代码、二进制程序或原始语言包。仓库内容只有本项目自己的脚本，以及社区编写的中文译文。
- **译文数据**：`locales/` 下的中文译文是为方便中文用户而创作的，其键结构与文案派生自 Postman 的界面字符串。本项目对这部分**不主张版权**，也不保证其可在所有场景下自由再分发；如 Postman, Inc. 提出异议，将配合处理（如移除相关数据）。
- **本地使用、自负风险**：本工具在**你自己的机器**上修改**你自己安装**的 Postman（重打包 `app.asar` 或加载浏览器扩展）。是否使用由你自行决定并承担风险，并请遵守 Postman 的**服务条款与 EULA**（其中可能包含对反向工程 / 修改 / 衍生作品的限制）。
- **许可**：本项目**自身代码**以 MIT 许可发布；该许可**不覆盖**上述派生自 Postman 文案的译文数据。
- 本说明不构成法律意见。若用于商业用途或有疑虑，请咨询专业律师并查阅 Postman 的最新条款。
