# Postman 中文注入 · Postman Chinese Injector

[![Release](https://img.shields.io/github/v/release/hlmd/postman-chinese-injector?sort=semver)](../../releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Web-blue)

把简体中文界面注入 **Postman 桌面端**与**网页版**，让界面变中文。译文已全部预置、开箱即用。

- **桌面端** — Windows / macOS / Linux 的**单文件可执行程序**（目标机无需装 Node），也可用 Node 源码运行。
- **网页版** — Chrome / Edge 的 **Manifest V3 浏览器扩展**（`go.postman.co` 等）。

> [!WARNING]
> **非官方项目**：与 Postman, Inc. 无任何关联，未获授权或背书；"Postman" 是其商标。
> 本仓库不含也不分发 Postman 的任何源码 / 二进制 / 原始语言包。仅供个人本地使用，自负风险。
> 详见文末 [法律声明](#法律声明--disclaimer)。

**目录**

[快速开始](#快速开始) · [支持的 Postman 版本](#支持的-postman-版本) · [下载 Postman（各版本）](#下载-postman各版本) · [关闭自动更新](#关闭自动更新保持汉化不被冲掉) · [工作原理](#工作原理) · [桌面端](#桌面端) · [网页版](#网页版浏览器扩展) · [翻译数据](#翻译数据) · [常见问题](#常见问题) · [交流反馈](#交流--反馈) · [法律声明](#法律声明--disclaimer)

---

## 快速开始

**桌面端**

1. 到 [Release](../../releases) 下载对应平台压缩包并解压；
2. **完全退出 Postman**；
3. 运行可执行文件（自动探测安装位置）；
4. 重启 Postman，界面变中文。

> 卸载汉化：运行时加 `--restore`。

**网页版**

1. 到 [Release](../../releases) 下载 `postman-chinese-injector-extension.zip` 并解压；
2. Chrome / Edge 打开 `chrome://extensions` → 开启「开发者模式」；
3. 点「加载已解压的扩展程序」→ 选该目录；
4. 刷新 Postman 网页版，界面变中文。

下面是完整说明。

---

## 支持的 Postman 版本

汉化对桌面端的适配依赖两点，满足即可注入：

- 主窗口 preload 脚本可注入 —— 新版为根目录 `preload_desktop.js`，老版（10.24）为 `preload/desktop/index.js`，脚本自动判别；
- 界面语言包走 `.../_ar-assets/locales/<lang>/<module>-<hash>.json` 远程加载 —— 运行时钩子拦截这些响应做替换。

| 项 | 说明 |
|------|------|
| **已适配范围** | Postman 桌面端 **10.24 ～ 12.x**（当前最新），以最新正式版为主要测试目标 |
| **网页版** | `go.postman.co` 等，随官方界面滚动更新，无版本号约束 |
| **覆盖度** | 译文键值对齐「当前 Postman 界面文案」，越接近最新版覆盖越全；过旧版本界面文案不同，可能出现部分未翻译 |
| **不支持** | 更早、不走 `_ar-assets` 语言包机制的架构（约 10.x 之前） |

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

内含两种方法：**① 改 `Preferences.json`**（各平台「粘贴即改 + 一键还原」命令，不影响下载，首选）与 **② hosts 屏蔽更新服务器**（彻底但会连手动下载一起挡住的兜底方案）。

---

## 工作原理

Postman 主窗口 `webPreferences` 为 `contextIsolation=false` + `nodeIntegration=true`，Electron 的 preload 脚本与页面共享同一 main world 且先于页面脚本执行。运行时钩子 `pm-chinese.js` 包装 `window.fetch` / `XMLHttpRequest`，拦截 Postman 请求的英文（`en-US` / `ja`）语言包响应，把对应模块的中文 deep-merge 进去再返回页面。

因为改的是 fetch 返回前的响应体，无论数据来自网络还是 Service Worker 缓存都生效。两种载入方式：

- **桌面端** — Electron 资源解析时 `app.asar` 存在则优先、否则退而加载未打包的 `resources/app/` 目录。CLI 两种形态都自动判别并支持：
  - **`app.asar` 型** — 备份原始 asar、从备份打补丁、再打包回去；
  - **未打包 `app/` 型**（没有 `app.asar`，只有 `resources/app/`）— 直接备份并改 `app/preload_desktop.js`，把钩子与数据写到同目录，无需解包 / 打包。

  两种形态都幂等、可 `--restore` 还原。
- **网页版** — 浏览器扩展以 `world:MAIN` + `run_at:document_start` 注入同一段钩子，在页面脚本之前生效。

钩子 `pm-chinese.js` 是**唯一真源**，两端共用：网页版从全局 `window.__PM_I18N__` 取数据，桌面端从 asar 内同目录的 `pm-chinese-data.json` 用 `fs` 读。

### 登出态 Scratch Pad（本地界面）汉化

Postman **登入态**主界面是远程网页，走上面的语言包拦截即可汉化；但**登出态的 Scratch Pad** 是本地打包的界面，文案为**硬编码英文**、不请求语言包，拦截 fetch 对它无效。

为此工具在**同一次注入**里额外放入第二个运行时钩子 `pm-scratchpad-cn.js`：

- 只在 Scratch Pad 窗口（`file://…scratchpad`）激活；
- 用 `MutationObserver` 遍历 DOM，把**与内置词典精确整串匹配**的可见英文文本 / 属性替换成中文；
- **跳过输入框与代码编辑器**（`input` / `textarea` / `contenteditable` / CodeMirror / Monaco）子树，绝不改动你输入的请求体、URL 等内容。

一条命令即注入两个钩子、自动适配版本与登入状态，无需你关心自己是哪种情形。词典源自社区归档项目 [Postman-cn](https://github.com/hlmd/Postman-cn)，仅覆盖常见 Scratch Pad 界面文案；动态 / 参数化文案（如「This *collection* is empty」）暂不翻译。

---

## 目录结构

```
postman-chinese-injector/
├── postman-chinese-injector.js   # 桌面端注入 CLI：构建 / 备份 / 解包 / 注入 / 打包 app.asar，含 --restore
├── pm-chinese.js                 # 运行时钩子（桌面端与浏览器扩展共用的唯一真源）
├── pm-scratchpad-cn.js           # 第二个钩子：登出态 Scratch Pad 的 DOM 词典替换（仅桌面端）
├── locales/
│   ├── zh-CN/                    # 语言包翻译源：每个模块一个 json，可单独编辑
│   │   ├── api-client-core.json
│   │   └── ...
│   └── scratchpad/
│       └── zh-CN.json            # Scratch Pad DOM 词典（英文整串 → 中文）
├── scripts/
│   ├── build-data.js             # 合并 locales/ 并生成可嵌入二进制的快照（见下）
│   ├── build-scratchpad-dict.js  # 构建 / 维护 Scratch Pad 词典 locales/scratchpad/zh-CN.json
│   ├── build-extension.js        # 打包 Chrome/Edge (MV3) 浏览器扩展，给 Postman 网页版用
│   ├── build-bin.js              # 用 bun --compile 编译单文件二进制（复用本地缓存的运行时）
│   ├── build-bin-legacy.js       # 用 pkg（Node 运行时）打老系统版 Windows 二进制
│   ├── fetch-runtimes.js         # 预拉取各平台 bun 运行时到本地缓存，规避交叉编译时的在线下载
│   └── compress-dist.js          # 把 dist/ 的二进制并行压成发行包（zip / tar.xz）
├── .github/workflows/            # CI：打 tag 自动交叉编译、并行压缩并发 Release
└── package.json                  # bin 命令 postman-chinese-injector、构建脚本、依赖 @electron/asar
```

> `build-data.js` 生成 4 份供 `bun --compile` 静态内嵌的快照：`pm-chinese-data.json`（语言包合并数据）、`pm-chinese-src.json`（`pm-chinese.js` 源码）、`pm-scratchpad-data.json`（Scratch Pad 词典）、`pm-scratchpad-src.json`（`pm-scratchpad-cn.js` 源码）。它们都是构建产物，不在源码里单独存放；用 `node postman-chinese-injector.js` 直接注入时不需要，那条路直接从 `locales/` 与本地钩子读。

---

## 桌面端

### 方式一：下载二进制（推荐，目标机无需 Node）

从 Release 下载对应平台的压缩包，解压得到单文件（重命名随意）：

| 平台 | 下载文件 | 解压后 |
|------|----------|--------|
| Windows x64 | `postman-chinese-injector-win-x64.zip` | `postman-chinese-injector-win-x64.exe` |
| Windows x64（老系统） | `postman-chinese-injector-win-x64-legacy.zip` | `postman-chinese-injector-win-x64-legacy.exe` |
| Linux x64 / arm64 | `postman-chinese-injector-linux-x64.tar.xz` / `-arm64.tar.xz` | `postman-chinese-injector-linux-x64` / `-arm64` |
| macOS x64 / arm64（Apple Silicon） | `postman-chinese-injector-macos-x64.tar.xz` / `-arm64.tar.xz` | `postman-chinese-injector-macos-x64` / `-arm64` |

> 压缩仅为减小下载体积（约为原来的 1/4），解压后仍按原大小运行。
> Windows 双击 `.zip` 即可解压；Linux / macOS：`tar -xf postman-chinese-injector-*.tar.xz`。

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

二进制已内嵌全部中文译文与 `@electron/asar`，无需联网、无需 Node。

> 译文有更新但不想换二进制？把一个 `locales/<lang>/` 文件夹放在**可执行文件旁边**即可覆盖内嵌数据。

> [!NOTE]
> **macOS 用户**：Apple Silicon 首次运行可能报 `zsh: killed` /「已损坏」，注入可能报 `EPERM`——均非文件损坏，处理见 **👉 [macOS 首次运行 / 注入排障](docs/macos-troubleshooting.md)**。

### 方式二：Node 源码运行（开发 / 改译文）

需要 Node 22.12+（打包 asar 走 `@electron/asar` v4；更老的 Node 把依赖与 `postman-chinese-injector.js` 里的 `ASAR_PKG` 改回 `@electron/asar@3`，兼容 Node 12+）。不需要 Python。

```bash
npm install                       # 安装 @electron/asar（未装则自动回退 npx，较慢）
node postman-chinese-injector.js  # 注入；或 npm install -g . 后用 postman-chinese-injector
```

### CLI 选项

下面用 `node postman-chinese-injector.js` 举例；二进制把它换成可执行文件名即可（如 `./postman-chinese-injector-win-x64.exe`）。

| 选项 | 作用 |
|------|------|
| `--status` | 只读检查是否已注入，打印结论（不改动） |
| `--restore` | 还原（用备份覆盖回 `app.asar` / preload） |
| `--resources <dir>` | 直接指定含 `app.asar` 或未打包 `app/` 的目录（跳过自动探测） |
| `--postman-dir <dir>` | 指定 Postman 安装根目录 |
| `--app-version 12.16.1` | Windows 多版本共存时指定 `app-<version>`（默认最新） |
| `-v`, `--version` | 显示本工具版本 |
| `-h`, `--help` | 帮助 |

#### 平台默认探测位置

| 平台 | 位置 |
|------|------|
| Windows | `%LOCALAPPDATA%\Postman\app-<version>\resources`（自动取最新版本） |
| macOS | `/Applications/Postman.app/Contents/Resources`（含 `~/Applications`） |
| Linux | `/opt/Postman/app/resources`、`/usr/share/postman/resources`、`~/.local/share/Postman/app/resources` 等常见位置 |

> 探测不到时用 `--resources <含 app.asar 或 app/ 的目录>` 或 `--postman-dir <安装根目录>` 指定。
> macOS / Linux 的系统级安装目录可能需要 `sudo` 才能写入。

#### 验证注入是否成功

**① 静态检查（不用启动 Postman）** —— `--status` 只读检查目标 asar 并打印结论：

```bash
node postman-chinese-injector.js --status      # 或 ./postman-chinese-injector-win-x64.exe --status
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

## 网页版：浏览器扩展

给 **Postman 网页版**（`go.postman.co` 等）汉化，无需碰 app.asar。生成的是 Chrome / Edge 的 Manifest V3 扩展：

```bash
npm run build:ext      # 或 node scripts/build-extension.js
```

产物在 `dist/extension/`（同时打一个 `dist/postman-chinese-injector-extension.zip`）：

```
dist/extension/
├── manifest.json      # MV3，内容脚本 world:MAIN + run_at:document_start
├── pm-i18n-data.js    # window.__PM_I18N__ = { <模块>: {…中文…} }（由 locales/ 合并）
└── pm-chinese.js      # 与桌面端共用的同一份运行时钩子
```

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

- 拦截的源语言固定为 `en-US` / `ja`、展示语言 `zh-CN`，写死在 `pm-chinese.js` 里。
- 目前只注入简体中文（`locales/zh-CN/`）。
- 登出态 Scratch Pad 的 DOM 词典单独放在 `locales/scratchpad/zh-CN.json`（英文整串 → 中文），由 `scripts/build-scratchpad-dict.js` 维护。

---

## 常见问题

**macOS（M 芯片）运行报 `zsh: killed` / 「已损坏，无法打开」/ 注入时 `EPERM`**
分别对应未签名、下载隔离、macOS 13+ 的「App 管理」保护，都不是文件损坏。处理步骤见 [docs/macos-troubleshooting.md](docs/macos-troubleshooting.md)。

**界面还是英文 / Console 没有 `[pm-chinese] 已注入`**
① 注入前是否完全退出 Postman；② 是否打到了正在运行的那个版本（Windows 多版本共存时用 `--app-version` 指定）。

**`asar requires Node >=22` 之类报错**
那是 `@electron/asar` v4 的限制。把 Node 升到 22.12+ 即可；若无法升级，按上文把 `ASAR_PKG` / 依赖改回 `@electron/asar@3`（兼容 Node 12+）。

**Postman 自动更新后又变回英文**
更新会生成新的版本目录（不含补丁），重新跑一次 `node postman-chinese-injector.js` 即可。

**想卸载汉化**
桌面端 `node postman-chinese-injector.js --restore`；网页版在 `chrome://extensions` 移除扩展。

---

## 交流 / 反馈

- 问题与建议欢迎提 [Issue](../../issues)。
- QQ 群：**494969115**

### 提 Issue 前请附上这些信息

点 **New issue** 会有现成模板（Bug / 漏译误译 / 功能建议）引导你填写；下面是报 Bug 时建议提供的资料（越全越快）：

| 信息 | 怎么拿 |
|------|--------|
| **操作系统与版本** | Windows 10/11（含内部版本号）、macOS 版本 + 芯片（Intel / Apple Silicon）、Linux 发行版 |
| **Postman 版本** | Postman 内 `Settings → About`，或 Windows 的 `app-<version>` 目录名 |
| **使用方式** | 桌面端二进制 / Node 源码运行 / 网页版浏览器扩展（三选一） |
| **本工具版本** | 运行 `... --version`，或所下载 Release 的版本号 |
| **`--status` 输出** | 桌面端跑 `... --status`，把整段结论贴上 |
| **Console 日志** | Postman `View → Developer → Show DevTools`（或扩展页 F12）→ Console，贴出含 `[pm-chinese]` / `[pm-scratchpad]` 的行 |
| **完整报错** | 终端的完整错误文本（含 `EPERM` / `ClosePseudoConsole` 等关键字），别只截一半 |
| **复现步骤与现象** | 做了什么、期望什么、实际什么；界面未翻译的可附**截图**并标出位置 |

> 报「某处没翻译 / 翻译不当」时，附上**截图**并说明所在界面（如登入态主界面 / 登出态 Scratch Pad / 网页版），能帮我们快速定位是哪个模块的词条。

---

## 法律声明 / Disclaimer

- **非官方、无关联**：本项目是社区维护的第三方汉化工具，**与 Postman, Inc. 没有任何关联**，未获其授权、赞助或背书。"Postman" 及相关标识是 Postman, Inc. 的商标，此处仅作描述性指代。
- **不分发 Postman 资产**：本仓库**不包含、也不分发** Postman 的任何源代码、二进制程序或原始语言包。仓库内容只有本项目自己的脚本，以及社区编写的中文译文。
- **译文数据**：`locales/` 下的中文译文是为方便中文用户而创作的，其键结构与文案派生自 Postman 的界面字符串。本项目对这部分**不主张版权**，也不保证其可在所有场景下自由再分发；如 Postman, Inc. 提出异议，将配合处理（如移除相关数据）。
- **本地使用、自负风险**：本工具在**你自己的机器**上修改**你自己安装**的 Postman（重打包 `app.asar` 或加载浏览器扩展）。是否使用由你自行决定并承担风险，并请遵守 Postman 的**服务条款与 EULA**（其中可能包含对反向工程 / 修改 / 衍生作品的限制）。
- **许可**：本项目**自身代码**以 MIT 许可发布；该许可**不覆盖**上述派生自 Postman 文案的译文数据。
- 本说明不构成法律意见。若用于商业用途或有疑虑，请咨询专业律师并查阅 Postman 的最新条款。
