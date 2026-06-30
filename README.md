# Postman 中文注入 · Postman Chinese Injector

[![Release](https://img.shields.io/github/v/release/hlmd/postman-chinese-injector?sort=semver)](../../releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Web-blue)

把简体中文界面注入 **Postman 桌面端**与**网页版**，让界面变中文。译文已全部预置（138 个模块），
开箱即用：

- **桌面端**：Windows / macOS / Linux 的**单文件可执行程序**（目标机无需装 Node），也可用 Node 源码运行。
- **网页版**：Chrome / Edge 的 **Manifest V3 浏览器扩展**（`go.postman.co` 等）。

> ⚠️ **非官方项目**：与 Postman, Inc. 无任何关联，未获授权或背书；"Postman" 是其商标。
> 本仓库不含也不分发 Postman 的任何源码 / 二进制 / 原始语言包。仅供个人本地使用，自负风险。
> 详见文末 [法律声明](#法律声明--disclaimer)。

**目录**：[工作原理](#工作原理) · [桌面端](#桌面端) · [网页版（浏览器扩展）](#网页版浏览器扩展) · [翻译数据](#翻译数据) · [常见问题](#常见问题) · [交流反馈](#交流--反馈) · [法律声明](#法律声明--disclaimer)

## 快速开始

- **桌面端**：到 [Release](../../releases) 下载对应平台压缩包 → 解压 → **完全退出 Postman** → 运行可执行文件 → 重启 Postman，界面变中文。卸载汉化用 `--restore`。
- **网页版**：到 [Release](../../releases) 下载 `postman-chinese-injector-extension.zip` → 解压 → Chrome/Edge 打开 `chrome://extensions` → 开「开发者模式」→「加载已解压的扩展程序」→ 选该目录 → 刷新页面。

下面是完整说明。

## 工作原理

Postman 主窗口 `webPreferences` 为 `contextIsolation=false` + `nodeIntegration=true`，
Electron 的 preload 脚本与页面共享同一 main world 且先于页面脚本执行。运行时钩子
`pm-chinese.js` 包装 `window.fetch` / `XMLHttpRequest`，拦截 Postman 请求的英文
（`en-US` / `ja`）语言包响应，把对应模块的中文 deep-merge 进去再返回页面。

因为改的是 fetch 返回前的响应体，无论数据来自网络还是 Service Worker 缓存都生效。两种载入方式：

- **桌面端**：Electron 资源解析时 `app.asar` 存在则优先、否则退而加载未打包的 `resources/app/`
  目录。CLI 两种形态都自动判别并支持：
  - **`app.asar` 型**：备份原始 asar、从备份打补丁、再打包回去；
  - **未打包 `app/` 型**（没有 `app.asar`，只有 `resources/app/`）：直接备份并改 `app/preload_desktop.js`，
    把钩子与数据写到同目录，无需解包/打包。

  两种形态都幂等、可 `--restore` 还原。
- **网页版**：浏览器扩展以 `world:MAIN` + `run_at:document_start` 注入同一段钩子，在页面脚本之前生效。

钩子 `pm-chinese.js` 是**唯一真源**，两端共用：网页版从全局 `window.__PM_I18N__` 取数据，
桌面端从 asar 内同目录的 `pm-chinese-data.json` 用 `fs` 读。

## 目录结构

```
postman-chinese-injector/
├── postman-chinese-injector.js   # 桌面端注入 CLI：构建 / 备份 / 解包 / 注入 / 打包 app.asar，含 --restore
├── pm-chinese.js                 # 运行时钩子（桌面端与浏览器扩展共用的唯一真源）
├── locales/
│   └── zh-CN/                    # 翻译源：每个模块一个 json（138 个），可单独编辑
│       ├── api-client-core.json
│       └── ...
├── scripts/
│   ├── build-data.js             # 把 locales/<lang>/ 合并成可嵌入二进制的 pm-chinese-data.json
│   ├── build-extension.js        # 打包 Chrome/Edge (MV3) 浏览器扩展，给 Postman 网页版用
│   ├── build-bin.js              # 用 bun --compile 编译单文件二进制（复用本地缓存的运行时）
│   ├── fetch-runtimes.js         # 预拉取各平台 bun 运行时到本地缓存，规避交叉编译时的在线下载
│   └── compress-dist.js          # 把 dist/ 的二进制并行压成发行包（zip / tar.xz）
├── .github/workflows/            # CI：打 tag 自动交叉编译、并行压缩并发 Release
└── package.json                  # bin 命令 postman-chinese-injector、构建脚本、依赖 @electron/asar
```

> 注入时 `postman-chinese-injector.js` 会把 `locales/<lang>/*.json` 合并成一个 `pm-chinese-data.json`
> 写进 asar 供钩子读取——它是构建产物，不在源码里单独存放。编译二进制时这份数据被静态嵌入。

---

# 桌面端

## 方式一：下载二进制（推荐，目标机无需 Node）

从 Release 下载对应平台的压缩包，解压得到单文件（重命名随意）：

| 平台 | 下载文件 | 解压后 |
|------|----------|--------|
| Windows x64 | `postman-chinese-injector-win-x64.zip` | `postman-chinese-injector-win-x64.exe` |
| Linux x64 / arm64 | `postman-chinese-injector-linux-x64.tar.xz` / `-arm64.tar.xz` | `postman-chinese-injector-linux-x64` / `-arm64` |
| macOS x64 / arm64（Apple Silicon） | `postman-chinese-injector-macos-x64.tar.xz` / `-arm64.tar.xz` | `postman-chinese-injector-macos-x64` / `-arm64` |

> 压缩仅为减小下载体积（约为原来的 1/4），解压后仍按原大小运行。
> Windows 双击 `.zip` 即可解压；Linux/macOS：`tar -xf postman-chinese-injector-*.tar.xz`。

```bash
# 1. 完全退出 Postman
# 2. 注入（自动探测当前平台的 Postman 安装）
./postman-chinese-injector-win-x64.exe          # Windows
./postman-chinese-injector-linux-x64            # Linux/macOS 先 chmod +x（tar.xz 解压一般已保留执行位）

# 3. 重启 Postman，界面出现中文即成功
```

二进制已内嵌全部中文译文与 `@electron/asar`，无需联网、无需 Node。
译文有更新但不想换二进制？把一个 `locales/<lang>/` 文件夹放在**可执行文件旁边**即可覆盖内嵌数据。

## 方式二：Node 源码运行（开发 / 改译文）

需要 Node 22.12+（打包 asar 走 `@electron/asar` v4；更老的 Node 把依赖与 `postman-chinese-injector.js`
里的 `ASAR_PKG` 改回 `@electron/asar@3`，兼容 Node 12+）。不需要 Python。

```bash
npm install                       # 安装 @electron/asar（未装则自动回退 npx，较慢）
node postman-chinese-injector.js  # 注入；或 npm install -g . 后用 postman-chinese-injector
```

## CLI 选项

下面用 `node postman-chinese-injector.js` 举例；二进制把它换成可执行文件名即可（如 `./postman-chinese-injector-win-x64.exe`）。

```bash
... --status                  # 只读检查是否已注入，打印结论（不改动）
... --restore                 # 还原（用备份覆盖回 app.asar / preload）
... --resources <dir>         # 直接指定含 app.asar 或未打包 app/ 的目录（跳过自动探测）
... --postman-dir <dir>       # 指定 Postman 安装根目录
... --app-version 12.16.1     # Windows 多版本共存时指定 app-<version>
... --version                 # 显示本工具版本
... --help                    # 帮助
```

### 平台默认探测位置

| 平台 | 位置 |
|------|------|
| Windows | `%LOCALAPPDATA%\Postman\app-<version>\resources`（自动取最新版本） |
| macOS | `/Applications/Postman.app/Contents/Resources`（含 `~/Applications`） |
| Linux | `/opt/Postman/app/resources`、`/usr/share/postman/resources`、`~/.local/share/Postman/app/resources` 等常见位置 |

> 探测不到时用 `--resources <含 app.asar 或 app/ 的目录>` 或 `--postman-dir <安装根目录>` 指定。
> macOS / Linux 的系统级安装目录可能需要 `sudo` 才能写入。

### 验证注入是否成功

**① 静态检查（不用启动 Postman）** —— `--status` 只读检查目标 asar 并打印结论：

```bash
node postman-chinese-injector.js --status      # 或 ./postman-chinese-injector-win-x64.exe --status
```
```
  备份 app.asar.bak: 有（注入过至少一次）
  pm-chinese.js 在 asar 内: 是
  pm-chinese-data.json 在 asar 内: 是（138 模块）
  preload 注入行 require('./pm-chinese.js'): 有

[结论] 已注入 ✓　重启 Postman，界面应变中文；Console 会打印 [pm-chinese] 已注入
```

**② 看界面** —— 退出并重启 Postman，菜单/按钮变中文即成功。

**③ 看运行时日志（最确凿）** —— Postman 菜单 `View → Developer → Show DevTools (Current View)`
（快捷键 `Ctrl+Alt+I`）→ Console，应有：

```
[pm-chinese] 已注入，语言: zh-CN | 拦截: en-US,ja | 模块数: 138
```

## 自行编译二进制

需要 [Bun](https://bun.sh)（用于 `--compile` 交叉编译）：

```bash
npm install            # 或 bun install，准备 @electron/asar
npm run build          # 生成嵌入数据 + 交叉编译全部 5 个平台到 dist/
# 或单平台：
npm run build:win      # build:linux / build:linux-arm64 / build:mac / build:mac-arm64

npm run build:compress # 可选：把 dist/ 的二进制并行压成发行包（Windows→zip，其余→tar.xz，体积约降到 1/4）
```

> 二进制内嵌整个 Bun 运行时，单文件 57~110MB 无法再缩小；`build:compress` 只在分发环节压缩，
> 解压后仍按原大小运行（原二进制会保留，便于本地直接测试）。
>
> 交叉编译会让 Bun 下载各目标的运行时（每个目标首次较慢、需联网）；首次能稳定下载时可先跑
> `npm run build:runtimes` 把各平台运行时缓存到本地，之后编译不再触网。
>
> 也可直接打 tag（如 `git tag v1.2.3 && git push origin v1.2.3`），由 `.github/workflows/release.yml`
> 在 CI 上一次性交叉编译、并行压缩并发 Release。

---

# 网页版：浏览器扩展

给 **Postman 网页版**（`go.postman.co` 等）汉化，无需碰 app.asar。生成的是 Chrome / Edge 的
Manifest V3 扩展：

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

**安装**：Chrome / Edge 打开 `chrome://extensions` → 开启「开发者模式」→「加载已解压的扩展程序」
→ 选择 `dist/extension/` 目录 → 刷新 Postman 网页版，界面变中文即成功。
打开 DevTools Console 应看到 `[pm-chinese] 已注入…模块数: 138`。

> 改译文后重跑 `npm run build:ext` 并在 `chrome://extensions` 点该扩展的「刷新」即可。
> 仅支持 Chromium 系（Chrome / Edge）；Firefox 的 MV3 对 `world:MAIN` 支持不同，暂未适配。

---

# 翻译数据

翻译源是 `locales/<lang>/` 下**每个模块一个 JSON**，文件名即模块名，内容是与 Postman 界面
语言包同形的中文键树（供运行时 deep-merge）：

```
locales/zh-CN/
├── api-client-core.json     # { "request_access": { "title": "您似乎无权访问" }, ... }
├── app-header.json
└── ...（138 个模块）
```

注入 / 打包时把这些文件合并成一个扁平 bundle（`{ "<module>": {…} }`），运行时由 `pm-chinese.js`
读取。**改某个模块的译文 = 直接编辑对应 json，重跑注入（桌面端）或 `npm run build:ext`（网页版）即可。**

- 拦截的源语言固定为 `en-US` / `ja`、展示语言 `zh-CN`，写死在 `pm-chinese.js` 里。
- 目前只注入简体中文（`locales/zh-CN/`）。

# 常见问题

**界面还是英文 / Console 没有 `[pm-chinese] 已注入`**：① 注入前是否完全退出 Postman；
② 是否打到了正在运行的那个版本（Windows 多版本共存时用 `--app-version` 指定）。

**`asar requires Node >=22` 之类报错**：那是 `@electron/asar` v4 的限制。把 Node 升到
22.12+ 即可；若无法升级，按上文把 `ASAR_PKG` / 依赖改回 `@electron/asar@3`（兼容 Node 12+）。

**Postman 自动更新后又变回英文**：更新会生成新的版本目录（不含补丁），重新跑一次
`node postman-chinese-injector.js` 即可。

**想卸载汉化**：桌面端 `node postman-chinese-injector.js --restore`；网页版在 `chrome://extensions` 移除扩展。

# 交流 / 反馈

- 问题与建议欢迎提 [Issue](../../issues)。
- QQ 群：**494969115**

# 法律声明 / Disclaimer

- **非官方、无关联**：本项目是社区维护的第三方汉化工具，**与 Postman, Inc. 没有任何关联**，
  未获其授权、赞助或背书。"Postman" 及相关标识是 Postman, Inc. 的商标，此处仅作描述性指代。
- **不分发 Postman 资产**：本仓库**不包含、也不分发** Postman 的任何源代码、二进制程序或原始语言包。
  仓库内容只有本项目自己的脚本，以及社区编写的中文译文。
- **译文数据**：`locales/` 下的中文译文是为方便中文用户而创作的，其键结构与文案派生自 Postman
  的界面字符串。本项目对这部分**不主张版权**，也不保证其可在所有场景下自由再分发；如 Postman, Inc.
  提出异议，将配合处理（如移除相关数据）。
- **本地使用、自负风险**：本工具在**你自己的机器**上修改**你自己安装**的 Postman（重打包 `app.asar`
  或加载浏览器扩展）。是否使用由你自行决定并承担风险，并请遵守 Postman 的**服务条款与 EULA**
  （其中可能包含对反向工程 / 修改 / 衍生作品的限制）。
- **许可**：本项目**自身代码**以 MIT 许可发布；该许可**不覆盖**上述派生自 Postman 文案的译文数据。
- 本说明不构成法律意见。若用于商业用途或有疑虑，请咨询专业律师并查阅 Postman 的最新条款。
