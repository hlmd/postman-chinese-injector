# Postman 中文注入 · Postman Chinese Injector
<!-- 本檔由 scripts/build-zh-tw.js 從 README.md 自動生成，請勿手改；修改請改 README.md 後重新生成 -->

[简体中文](README.md) · **繁體中文**

[![Release](https://img.shields.io/github/v/release/hlmd/postman-chinese-injector?sort=semver)](../../releases)
[![npm](https://img.shields.io/npm/v/postman-chinese-injector)](https://www.npmjs.com/package/postman-chinese-injector)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Web-blue)
[![Postman](https://img.shields.io/badge/Postman-10.x%20~%2012.x-orange)](#支援的-postman-版本)

把**簡體中文 / 繁體中文**介面注入 **Postman 桌面端**與**網頁版**，讓介面變中文。譯文已全部預置、開箱即用。

- **桌面端** — Windows / macOS / Linux 的**單檔案可執行程式**（目標機無需裝 Node），也可用 Node 原始碼執行。
- **網頁版** — Chrome / Edge 的 **Manifest V3 瀏覽器擴充功能**（`go.postman.co` 等）。

> **支援版本**：桌面端 Postman **10.x ～ 12.x**（以最新正式版為主要測試目標），網頁版隨官方介面滾動更新。詳見 [支援的 Postman 版本](#支援的-postman-版本)。

> [!WARNING]
> **非官方專案**：與 Postman, Inc. 無任何關聯，未獲授權或背書；"Postman" 是其商標。
> 本儲存庫不含也不分發 Postman 的任何原始碼 / 二進位 / 原始語言包。僅供個人本地使用，自負風險。
> 詳見文末 [法律宣告](#法律宣告--disclaimer)。

**目錄**

[快速開始](#快速開始) · [支援的 Postman 版本](#支援的-postman-版本) · [下載 Postman（各版本）](#下載-postman各版本) · [關閉自動更新](#關閉自動更新保持中文化不被沖掉) · [工作原理](#工作原理) · [桌面端](#桌面端) · [報毒說明](#防毒軟體報毒誤報說明) · [網頁版](#網頁版瀏覽器擴充功能) · [翻譯資料](#翻譯資料) · [常見問題](#常見問題) · [交流意見回饋](#交流--意見回饋) · [法律宣告](#法律宣告--disclaimer)

---

## 快速開始

**桌面端**

1. 到 [Release](../../releases) 下載對應平臺壓縮包並解壓；
2. **完全退出 Postman**；
3. 執行執行檔（自動探測安裝位置）；
4. 重啟 Postman，介面變中文。

> 解除安裝中文化：執行 `restore` 命令（如 `postman-chinese-injector restore`）。
>
> **繁體中文**：按系統語言自動選擇簡體 / 繁體；想手動指定就加 `--lang zh-TW`（簡體為 `--lang zh-CN`）。

**也可以用包管理器安裝**（裝好後命令都是 `postman-chinese-injector`）

Scoop（Windows）：

```powershell
scoop bucket add hlmd https://github.com/hlmd/scoop-bucket
scoop install hlmd/postman-chinese-injector
scoop update postman-chinese-injector          # 升級
```

Homebrew（macOS / Linux）：

```bash
brew install hlmd/tap/postman-chinese-injector
brew upgrade postman-chinese-injector          # 升級
```

npm（需 Node ≥ 22.12）：

```bash
npm i -g postman-chinese-injector              # 安裝 / 升級
npx postman-chinese-injector                   # 或免安裝直接執行
```

> 經 Scoop / Homebrew 安裝時程式不會自更新（由包管理器負責升級）；npm 版使用隨包附帶的譯文，升級包即獲得新譯文。

**網頁版**

1. 到 [Release](../../releases) 下載 `postman-chinese-injector-extension.zip` 並解壓；
2. Chrome / Edge 開啟 `chrome://extensions` → 開啟「開發者模式」；
3. 點「載入已解壓的擴充功能程式」→ 選該目錄；
4. 重新整理 Postman 網頁版，介面變中文。

> 簡體 / 繁體預設跟隨瀏覽器語言；想手動指定，點工具欄上的擴充功能圖示選「自動 / 簡體中文 / 繁體中文」，再重新整理 Postman 頁面。

下面是完整說明。

---

## 支援的 Postman 版本

中文化對桌面端的適配依賴兩點，滿足即可注入：

- 主視窗 preload 腳本可注入 —— 新版為根目錄 `preload_desktop.js`，老版（10.24）為 `preload/desktop/index.js`，7.x 為各頁面用 `<script>` 載入的 `js/preload.js`，腳本自動判別；
- 介面語言包走 `.../_ar-assets/locales/<lang>/<module>-<hash>.json` 遠端載入 —— 執行時鉤子攔截這些回應做替換。

- **已適配範圍**：Postman 桌面端 **10.x ～ 12.x**（目前最新），以最新正式版為主要測試目標。
- **網頁版**：`go.postman.co` 等，隨官方介面滾動更新，無版本號約束。
- **覆蓋度**：譯文鍵值對齊「目前 Postman 介面文案」，越接近最新版覆蓋越全；過舊版本介面文案不同，可能出現部分未翻譯。
- **不支援**：更早、不走 `_ar-assets` 語言包機制的老架構。

> Postman 會**自動更新**，更新後生成新的版本目錄（不含補丁）→ 介面變回英文，重新跑一次注入即可。想固定版本，見下方[關閉自動更新](#關閉自動更新保持中文化不被沖掉)。

---

## 下載 Postman（各版本）

本工具**只注入**已安裝的 Postman，不包含 Postman 本體。以下為官方直鏈，按需自取。

**官方入口**

- 官方下載頁：<https://www.postman.com/downloads/>
- **發布說明 / 更新日誌**：<https://www.postman.com/release-notes/postman-app/>

**最新版直鏈**（`https://dl.pstmn.io/download/latest/<平臺標識>`）

| 平臺 | 直鏈 |
|------|------|
| Windows x64 | <https://dl.pstmn.io/download/latest/win64> |
| Windows arm64 | <https://dl.pstmn.io/download/latest/windows_arm64> |
| macOS Intel | <https://dl.pstmn.io/download/latest/osx_64> |
| macOS Apple Silicon | <https://dl.pstmn.io/download/latest/osx_arm64> |
| Linux x64 | <https://dl.pstmn.io/download/latest/linux64> |
| Linux arm64 | <https://dl.pstmn.io/download/latest/linux_arm64> |

**指定版本直鏈**

把版本號與平臺標識填進模板即可下載歷史版本：

```
https://dl.pstmn.io/download/version/<版本號>/<平臺標識>
```

例（下載 11.21.0 的 Windows x64）：

```
https://dl.pstmn.io/download/version/11.21.0/win64
```

平臺標識：`win64` · `windows_arm64` · `osx_64` · `osx_arm64` · `linux64` · `linux_arm64`
（`win64` 亦可寫 `windows_64`，`windows_arm64` 亦可寫 `win_arm64`，互為別名。）版本號見上面的發布說明頁。

> 注：**Windows arm64** 原生包較新才提供，用**指定版本**回溯舊版時該架構可能 404（`latest` 正常）。這類情況改用 `win64`（x64，可在 arm64 上相容執行），或選更新的版本。

---

## 關閉自動更新（保持中文化不被沖掉）

Postman 會**自動更新**，升級後生成新的版本目錄（不含補丁）→ 介面變回英文。想固定在某個版本、避免中文化被沖掉，見獨立文件：

**👉 [關閉 Postman 自動更新](docs/disable-auto-update.md)**

內含兩種方法：**A（Windows 推薦）停用 Squirrel 更新器 `Update.exe`**（改名即可，不影響啟動與下載，可一鍵還原）與 **B（全平臺通用）hosts 遮蔽更新伺服器**（徹底但會連手動下載一起擋住）。

---

## 工作原理

Postman 主視窗 `webPreferences` 為 `contextIsolation=false` + `nodeIntegration=true`，Electron 的 preload 腳本與頁面共享同一 main world 且先於頁面腳本執行。執行時鉤子 `pm-chinese.js` 包裝 `window.fetch` / `XMLHttpRequest`，攔截 Postman 請求的英文（`en-US` / `ja`）語言包回應，把對應模組的中文 deep-merge 進去再返回頁面。

因為改的是 fetch 返回前的回應體，無論資料來自網路還是 Service Worker 快取都生效。兩種載入方式：

- **桌面端** — Electron 資源解析時 `app.asar` 存在則優先、否則退而載入未打包的 `resources/app/` 目錄。CLI 兩種形態都自動判別並支援：
  - **`app.asar` 型** — 備份原始 asar、從備份打補丁、再打包回去；
  - **未打包 `app/` 型**（沒有 `app.asar`，只有 `resources/app/`）— 直接備份並改 `app/preload_desktop.js`，把鉤子與資料寫到同目錄，無需解包 / 打包。

  兩種形態都冪等、可用 `restore` 命令還原。
- **網頁版** — 瀏覽器擴充功能以 `world:MAIN` + `run_at:document_start` 注入同一段鉤子，在頁面腳本之前生效。

鉤子 `pm-chinese.js` 是**唯一真源**，兩端共用：網頁版從全域 `window.__PM_I18N__` 取資料，桌面端從 asar 內同目錄的 `pm-chinese-data.json` 用 `fs` 讀。

### 登出態 Scratch Pad（本地介面）中文化

Postman **登入態**主介面是遠端網頁，走上面的語言包攔截即可中文化；但**登出態的 Scratch Pad** 是本地打包的介面，文案為**硬編碼英文**、不請求語言包，攔截 fetch 對它無效。

為此工具在**同一次注入**裡額外放入第二個執行時鉤子 `pm-scratchpad-cn.js`：

- 只在 Scratch Pad 視窗（`file://…scratchpad`）啟用；
- 用 `MutationObserver` 遍歷 DOM，把**與內建詞典精確整串匹配**的可見英文文字 / 屬性替換成中文；
- **跳過輸入框與程式碼編輯器**（`input` / `textarea` / `contenteditable` / CodeMirror / Monaco）子樹，絕不改動你輸入的請求體、URL 等內容。

詞典源自社群歸檔專案 [Postman-cn](https://github.com/hlmd/Postman-cn)，僅覆蓋常見 Scratch Pad 介面文案；動態 / 參數化文案（如「This *collection* is empty」）暫不翻譯。

### 原生選單中文化

左上角選單（檔案 / 編輯 / 檢視 / 幫助）、macOS 應用選單、Dock 選單和部分確認框是**主程序**用 Electron 原生 API 畫的，既不走 DOM 也不請求語言包。為此注入時還會在主程序入口 `main.js` 最前面插入第三個鉤子 `pm-main-cn.js`：包裝 `Menu.buildFromTemplate` 與 `dialog.showMessageBox`，按詞典 `locales/main/zh-CN.json` 把選單 / 對話方塊文案整串替換成中文（支援 `About {{appName}}` 這類佔位）。

一條命令即注入全部鉤子、自動適配版本與登入狀態，無需你關心自己是哪種情形。

---

## 目錄結構

```
postman-chinese-injector/
├── postman-chinese-injector.js   # 桌面端注入 CLI：構建 / 備份 / 解包 / 注入 / 打包 app.asar，含 restore / status / langs 命令
├── src/
│   ├── updater.js                # 線上更新：程式自更新（GitHub Release）+ 譯文熱更新（update-data 分支）
│   ├── extension/                # 瀏覽器擴充功能的後臺、選項頁 / 彈出面板（語言切換）
│   └── hooks/
│       ├── pm-chinese.js         # 執行時鉤子（桌面端與瀏覽器擴充功能共用的唯一真源）
│       ├── pm-scratchpad-cn.js   # 第二個鉤子：登出態 Scratch Pad 的 DOM 詞典替換（僅桌面端）
│       └── pm-main-cn.js         # 第三個鉤子：主程序原生選單 / 對話方塊中文化（僅桌面端）
├── generated/                    # build-data.js 生成的可嵌入快照（構建產物，已 gitignore）
├── locales/
│   ├── zh-CN/                    # 語言包翻譯源：每個模組一個 json，可單獨編輯
│   │   ├── api-client-core.json
│   │   └── ...
│   ├── zh-TW/                    # 繁體譯文（由 build-zh-tw.js 從 zh-CN 生成，勿手改）
│   ├── scratchpad/
│   │   ├── zh-CN.json            # Scratch Pad DOM 詞典（英文整串 → 中文）
│   │   └── zh-TW.json            # 同上，繁體（生成）
│   └── main/
│       ├── zh-CN.json            # 主程序原生選單 / 對話方塊詞典（英文整串 → 中文）
│       └── zh-TW.json            # 同上，繁體（生成）
├── scripts/
│   ├── build-data.js             # 合併 locales/ 並生成可嵌入二進位的快照（見下）
│   ├── build-update.js           # 生成線上熱更新資料包 dist/update/pm-update(.zh-TW).json.gz（CI 推到 update-data 分支）
│   ├── build-zh-tw.js            # 由簡體譯文生成繁體譯文（OpenCC s2twp + zh-tw-glossary.json 修正表）
│   ├── update-pkg-manifests.js   # 發版時生成 Scoop 清單 / Homebrew Formula
│   ├── build-scratchpad-dict.js  # 構建 / 維護 Scratch Pad 詞典 locales/scratchpad/zh-CN.json
│   ├── build-extension.js        # 打包 Chrome/Edge (MV3) 瀏覽器擴充功能（簡繁合一，原始碼在 src/extension/）
│   ├── build-bin.js              # 用 bun --compile 編譯單檔案二進位（複用本地快取的執行時）
│   ├── build-bin-legacy.js       # 用 pkg（Node 執行時）打老系統版 Windows 二進位
│   ├── fetch-runtimes.js         # 預拉取各平臺 bun 執行時到本地快取，規避交叉編譯時的線上下載
│   └── compress-dist.js          # 把 dist/ 的二進位並行壓成發行包（zip / tar.xz）
├── .github/workflows/            # CI：打 tag 自動交叉編譯併發 Release；main 改譯文自動發布線上資料包
└── package.json                  # bin 命令 postman-chinese-injector、構建腳本、依賴 @electron/asar
```

> `build-data.js` 在 `generated/` 下生成供 `bun --compile` 靜態內嵌的快照（繁體譯文與兩本詞典合在 `pm-zh-TW-data.json` 一份裡，鉤子原始碼各語言共用），簡體共 6 份：`pm-chinese-data.json`（語言包合併資料）、`pm-chinese-src.json`（`pm-chinese.js` 原始碼）、`pm-scratchpad-data.json`（Scratch Pad 詞典）、`pm-scratchpad-src.json`（`pm-scratchpad-cn.js` 原始碼）、`pm-main-data.json`（主程序選單詞典）、`pm-main-src.json`（`pm-main-cn.js` 原始碼）。它們都是構建產物，不在原始碼裡單獨存放；用 `node postman-chinese-injector.js` 直接注入時不需要，那條路直接從 `locales/` 與本地鉤子讀。

---

## 桌面端

### 方式一：下載二進位（推薦，目標機無需 Node）

從 Release 下載對應平臺的壓縮包，解壓得到同名單檔案（Windows 為 `.exe`，重新命名隨意）：

| 平臺 | 下載檔案 |
|------|----------|
| Windows x64 | `…-win-x64.zip` |
| Windows（老系統） | `…-win-x64-legacy.zip` |
| Linux x64 | `…-linux-x64.tar.xz` |
| Linux arm64 | `…-linux-arm64.tar.xz` |
| macOS Intel | `…-macos-x64.tar.xz` |
| macOS Apple Silicon | `…-macos-arm64.tar.xz` |

> 檔名都以 `postman-chinese-injector` 開頭（上表以 `…` 省略），如 `postman-chinese-injector-win-x64.zip` 解壓得到 `postman-chinese-injector-win-x64.exe`。

> 壓縮僅為減小下載體積（約為原來的 1/4），解壓後仍按原大小執行。
> Windows 雙擊 `.zip` 即可解壓；Linux / macOS：`tar -xf postman-chinese-injector-*.tar.xz`。

> [!NOTE]
> **防毒軟體把 exe 報成木馬？** 是單檔案打包器（bun / pkg）的通病，屬啟發式誤報。核實辦法（SHA256 校驗、構建來源證明、VirusTotal）與替代方案見 [防毒軟體報毒（誤報）說明](#防毒軟體報毒誤報說明)。

**執行環境要求**

- 預設二進位由 Bun 編譯：**Windows 需 10 1809+ / Server 2019+**，macOS 需 11+，Linux 需較新的 glibc。
- 在更老的 Windows（如 Server 2012 / Win7）上會報 `無法定位程式輸入點 ClosePseudoConsole …`（缺 ConPTY API）—— 這是 Bun 執行時的系統底線。
- 老 Windows 請改用**老系統版**二進位（`*-win-x64-legacy.exe`，改用 Node 執行時打包，見下方[老系統](#老系統windows-81--server-2012-r2)），或走[方式二：Node 原始碼執行](#方式二node-原始碼執行開發--改譯文)。

**注入步驟**

```bash
# 1. 完全退出 Postman
# 2. 注入（自動探測目前平臺的 Postman 安裝）
./postman-chinese-injector-win-x64.exe          # Windows
./postman-chinese-injector-linux-x64            # Linux/macOS 先 chmod +x（tar.xz 解壓一般已保留執行位）

# 3. 重啟 Postman，介面出現中文即成功
```

二進位已內嵌全部中文譯文與 `@electron/asar`，無需 Node；斷網也能用內嵌譯文注入。

#### 自動更新（程式 + 譯文）

Postman 更新頻繁，二進位每次執行注入前會自動聯網檢查兩件事，任何一步失敗都只提示、不影響注入：

1. **程式自更新** —— 對比 GitHub 最新 Release，有新版則下載本平臺壓縮包（GitHub 直連與 `ghfast.top` 映象**同時下載**，誰先完成用誰），按 Release 附帶的 `SHA256SUMS.txt` 校驗後替換自身，再以相同參數執行新版本。
2. **譯文熱更新** —— main 分支每次改動譯文，CI 就把最新譯文 + 鉤子打成 `pm-update.json.gz`（繁體為 `pm-update.zh-TW.json.gz`）推到 [`update-data`](../../tree/update-data) 分支；程式同時從 GitHub raw 與 jsDelivr 映象拉取、取最新一份，快取到本機（Windows `%LOCALAPPDATA%\postman-chinese-injector`、macOS `~/Library/Caches/…`、Linux `~/.cache/…`），離線時用快取。**不用等發版，譯文修好就能拿到。**

| 想要 | 加參數 |
|------|--------|
| 只更新譯文、不替換程式 | `--no-self-update` |
| 完全不聯網（有快取用快取，否則用內嵌） | `--offline` |

> Windows 自更新後程序旁會留一個 `*.exe.old`，下次執行自動刪除。程式所在目錄沒有寫權限時自更新會跳過，照常注入。

> 想用自己改的譯文？把一個 `locales/<lang>/` 資料夾放在**執行檔旁邊**即可覆蓋內嵌與線上資料（此時不聯網取譯文）。

> [!NOTE]
> **macOS 使用者**：Apple Silicon 首次執行可能報 `zsh: killed` /「已損壞」，注入可能報 `EPERM`——均非檔案損壞，處理見 **👉 [macOS 首次執行 / 注入排障](docs/macos-troubleshooting.md)**。

### 方式二：Node 原始碼執行（開發 / 改譯文）

需要 Node 22.12+（打包 asar 走 `@electron/asar` v4；更老的 Node 把依賴與 `postman-chinese-injector.js` 裡的 `ASAR_PKG` 改回 `@electron/asar@3`，相容 Node 12+）。不需要 Python。

```bash
npm install                       # 安裝 @electron/asar（未裝則自動回退 npx，較慢）
node postman-chinese-injector.js  # 注入；或 npm install -g . 後用 postman-chinese-injector
```

### 命令與選項

用法：`postman-chinese-injector [命令] [選項]`。下面以裝好的命令名舉例；原始碼執行換成 `node postman-chinese-injector.js`，
二進位換成執行檔名（如 `./postman-chinese-injector-win-x64.exe`）。

| 命令 | 作用 |
|------|------|
| `apply` | 注入翻譯（**預設**，可省略） |
| `restore` | 從備份還原英文原版 |
| `status` | 只讀檢查是否已注入（同 `verify`） |
| `langs` | 列出語言、覆蓋率及自動選中哪種 |
| `version` | 顯示版本（同 `-v`） |
| `help` | 顯示幫助（同 `-h`） |

| 選項 | 作用 |
|------|------|
| `--lang <程式碼>` | 介面語言：`zh-CN` / `zh-TW` |
| `--resources <目錄>` | 指定含 `app.asar` 或 `app/` 的目錄 |
| `--postman-dir <目錄>` | 指定 Postman 安裝根目錄 |
| `--app-version <版本>` | Windows 多版本時指定 `app-<版本>` |
| `--offline` | 不聯網（有本機快取則用快取） |
| `--no-self-update` | 只拉取線上譯文，不更新程式本身 |

- 注入、還原前都請**完全退出 Postman**；`restore` 用備份覆蓋回 `app.asar` / preload。
- `--lang` 不指定時依次看 `PMCI_LANG`、`LC_ALL` / `LANG`、系統語言（`zh-TW` / `zh-HK` / `zh-Hant` 等歸為繁體），都認不出用簡體；只寫 `--lang` 不帶程式碼會列出支援的語言。
- `--resources` / `--postman-dir` / `--app-version` 都是自動探測失敗時才需要。

```bash
postman-chinese-injector                  # 按系統語言注入
postman-chinese-injector --lang zh-TW     # 注入繁體中文
postman-chinese-injector status           # 檢查是否已注入
postman-chinese-injector restore          # 還原英文
```

> 舊寫法 `--restore`、`--status` 仍然可用，分別等同於 `restore`、`status` 命令。

#### 平臺預設探測位置

- **Windows**：`%LOCALAPPDATA%\Postman\app-<version>\resources`（自動取最新版本）
- **macOS**：`/Applications/Postman.app/Contents/Resources`（含 `~/Applications`）
- **Linux**：`/opt/Postman/app/resources`、`/usr/share/postman/resources`、`~/.local/share/Postman/app/resources` 等常見位置

> 探測不到時用 `--resources <含 app.asar 或 app/ 的目錄>` 或 `--postman-dir <安裝根目錄>` 指定。
> macOS / Linux 的系統級安裝目錄可能需要 `sudo` 才能寫入。

#### 驗證注入是否成功

**① 靜態檢查（不用啟動 Postman）** —— `status` 命令只讀檢查目標 asar 並列印結論：

```bash
node postman-chinese-injector.js status        # 或 ./postman-chinese-injector-win-x64.exe status
```

```
  型別: app.asar（已打包）
  備份 app.asar.bak: 有（注入過至少一次）
  pm-chinese.js 在 asar 內: 是
  pm-chinese-data.json 在 asar 內: 是（<N> 模組）
  Scratch Pad 鉤子在 asar 內: 是
  preload 注入行 require('./pm-chinese.js'): 有

[結論] 已注入 ✓　重啟 Postman，介面應變中文；Console 會列印 [pm-chinese] 已注入
```

**② 看介面** —— 退出並重啟 Postman，選單 / 按鈕變中文即成功。

**③ 看執行時日誌（最確鑿）** —— Postman 選單 `View → Developer → Show DevTools (Current View)`（快捷鍵 `Ctrl+Alt+I`）→ Console，應有：

```
[pm-chinese] 已注入，語言: zh-CN | 攔截: en-US,ja | 模組數: <N>
```

### 自行編譯二進位

需要 [Bun](https://bun.sh)（用於 `--compile` 交叉編譯）：

```bash
npm install            # 或 bun install，準備 @electron/asar
npm run build          # 生成嵌入資料 + 交叉編譯全部 5 個平臺到 dist/
# 或單平臺：
npm run build:win      # build:linux / build:linux-arm64 / build:mac / build:mac-arm64

npm run build:compress # 可選：把 dist/ 的二進位並行壓成發行包（Windows→zip，其餘→tar.xz，體積約降到 1/4）
```

> - 二進位內嵌整個 Bun 執行時，單檔案 57~110MB 無法再縮小；`build:compress` 只在分發環節壓縮，解壓後仍按原大小執行（原二進位會保留，便於本地直接測試）。
> - 交叉編譯會讓 Bun 下載各目標的執行時（每個目標首次較慢、需聯網）；首次能穩定下載時可先跑 `npm run build:runtimes` 把各平臺執行時快取到本地，之後編譯不再觸網。
> - 也可直接打 tag（如 `git tag v1.2.3 && git push origin v1.2.3`），由 `.github/workflows/release.yml` 在 CI 上一次性交叉編譯、並行壓縮併發 Release。

#### 老系統（Windows 8.1 / Server 2012 R2+）

Bun 產物要 Win10 1809+；更老的 Windows 需改用 **Node 執行時**打包（`pkg`），產物**不靜態連結 ConPTY**，可在老系統執行：

```bash
npm run build:win-legacy        # → dist/postman-chinese-injector-win-x64-legacy.exe（預設 node16 基座）
# 目標更舊（Server 2012 非 R2 / Win7）可嘗試更老基座（Node 官方也不保，盡力而為）：
node scripts/build-bin-legacy.js node12-win-x64
```

> - **系統下限**：node16 基座覆蓋 **Windows 8.1 / Server 2012 R2 及以上**；node12 基座盡力覆蓋 Server 2012（非 R2）/ Win7（未經官方支援，可能仍失敗——那說明系統已低於 Node 底線，只能升級系統）。
> - 首次會聯網下載對應 Node 基座（~30MB）；產物約 35MB，功能與預設二進位一致。
> - 底層用已歸檔但仍可用的 `pkg@5.8.1`，並在獨立暫存目錄裡配 `@electron/asar@3`（v4 要 Node≥22），不影響儲存庫根的 asar@4。

---

## 防毒軟體報毒（誤報）說明

部分防毒軟體（Windows Defender、火絨、360，以及 VirusTotal 上的少數引擎）可能把本工具的 `.exe` 標記為 `Trojan:Win32/Wacatac.B!ml`、`Program:Win32/Wacapew.C!ml` 之類的**啟發式威脅**。這是**誤報**，原因有三個，都出在打包方式和工具用途上：

1. **單檔案二進位的結構像加殼程式**——預設二進位由 `bun --compile` 生成（老系統版由 `pkg` 生成），產物 = 執行時 + 追加的腳本載荷。pkg / nexe / bun / deno / PyInstaller 這類打包器的產物被機器學習模型誤判是行業級老問題，與本專案程式碼無關。
2. **行為特徵天然像「打補丁器」**——本工具會讀寫你已安裝的 Postman 的 `resources/app.asar`（備份 → 解包 → 改 preload → 重新打包）。這種「修改另一個已安裝應用的檔案」的行為，在行為規則裡跟惡意程式劫持合法軟體難以區分。
3. **未做程式碼簽名 + 下載量少**——Windows SmartScreen 走的是檔案信譽，新發布的未簽名 exe 一律顯示「未知發布者」。程式碼簽名證書的費用目前超出本專案（免費開源）的承受範圍。

### 怎麼自己核實

- **核對校驗和**：每個 Release 都附帶 `SHA256SUMS.txt`，可確認下載到的檔案與 CI 產物一致。

  ```powershell
  # Windows PowerShell
  Get-FileHash .\postman-chinese-injector-win-x64.zip -Algorithm SHA256
  ```

  ```bash
  # macOS / Linux
  shasum -a 256 postman-chinese-injector-*.tar.xz
  ```

- **驗證構建來源**：所有二進位**均由 GitHub Actions 從公開原始碼構建**（見 [`.github/workflows/release.yml`](.github/workflows/release.yml)），並附帶 [構建來源證明（build provenance）](https://docs.github.com/actions/security-guides/using-artifact-attestations)：

  ```bash
  gh attestation verify postman-chinese-injector-win-x64.zip --repo hlmd/postman-chinese-injector
  ```

- **上傳 [VirusTotal](https://www.virustotal.com/) 複核**：少數引擎標紅、主流引擎全綠，是典型的啟發式誤報特徵。

### 不想跟殺軟糾纏：直接跑原始碼

原始碼是純 JavaScript，不經過任何打包器，因此不會觸發這類誤報：

```bash
git clone https://github.com/hlmd/postman-chinese-injector.git
cd postman-chinese-injector
npm install
node postman-chinese-injector.js
```

### 仍想用二進位

把解壓後的執行檔加入殺軟白名單（Defender：**設定 → 隱私和安全性 → Windows 安全中心 → 病毒和威脅防護 → 管理設定 → 排除項 → 新增檔案**）。也歡迎向廠商提交誤報申訴（[微軟 WDSI](https://www.microsoft.com/en-us/wdsi/filesubmission)、火絨 / 360 各自的誤報意見回饋入口），申訴通過後該版本通常 1～3 天內不再被攔截。

> 本工具自身**不上傳任何資料、不修改 Postman 以外的檔案、不常駐後臺**；全部行為都可以在 [`postman-chinese-injector.js`](postman-chinese-injector.js)（643 行，帶中文註釋）裡逐行核對。唯一的聯網動作是：Node 原始碼模式下若未安裝 `@electron/asar`，會呼叫 `npx` 從 npm 拉取它——編譯好的二進位已內嵌該依賴，全程離線。

---

## 網頁版：瀏覽器擴充功能

給 **Postman 網頁版**（`go.postman.co` 等）中文化，無需碰 app.asar。生成的是 Chrome / Edge 的 Manifest V3 擴充功能：

```bash
npm run build:ext      # 或 node scripts/build-extension.js
```

產物在 `dist/extension/`（同時打一個 `dist/postman-chinese-injector-extension.zip`），一個擴充功能同時包含簡體與繁體：

```
dist/extension/
├── manifest.json                  # MV3：後臺 + 選項頁 + 工具欄彈出面板
├── background.js                  # 按語言設定註冊內容腳本（world:MAIN + document_start）
├── popup.html / options.html      # 選擇「自動 / 簡體中文 / 繁體中文」
├── pm-i18n-data.zh-CN.js          # window.__PM_I18N__ = { <模組>: {…} }（zh-TW 另一份）
├── pm-scratchpad-data.zh-CN.js    # Scratch Pad 詞典（zh-TW 另一份）
└── pm-chinese.js                  # 與桌面端共用的同一份執行時鉤子
```

**切換簡體 / 繁體**

- **預設「自動」**：按瀏覽器的首選語言判斷，`zh-TW` / `zh-HK` / `zh-Hant` 用繁體，其它用簡體。
- **手動指定**：點工具欄上的擴充功能圖示，或在 `chrome://extensions` →「詳細資訊」→「擴充功能程式選項」裡選擇。
- 選擇後點面板裡的「重新整理已開啟的 Postman 頁面」（或自己重新整理）即生效；頁面只會載入選中的那一種語言。

**安裝**

1. Chrome / Edge 開啟 `chrome://extensions` → 開啟「開發者模式」；
2. 點「載入已解壓的擴充功能程式」→ 選擇 `dist/extension/` 目錄；
3. 重新整理 Postman 網頁版，介面變中文即成功。

開啟 DevTools Console 應看到 `[pm-chinese] 已注入…模組數: <N>`。

> - 改譯文後重跑 `npm run build:ext` 並在 `chrome://extensions` 點該擴充功能的「重新整理」即可。
> - 僅支援 Chromium 系（Chrome / Edge）；Firefox 的 MV3 對 `world:MAIN` 支援不同，暫未適配。

---

## 翻譯資料

翻譯源是 `locales/<lang>/` 下**每個模組一個 JSON**，檔名即模組名，內容是與 Postman 介面語言包同形的中文鍵樹（供執行時 deep-merge）：

```
locales/zh-CN/
├── api-client-core.json     # { "request_access": { "title": "您似乎無權訪問" }, ... }
├── app-header.json
└── ...（每個模組一個）
```

注入 / 打包時把這些檔案合併成一個扁平 bundle（`{ "<module>": {…} }`），執行時由 `pm-chinese.js` 讀取。

**改某個模組的譯文** = 直接編輯對應 json，重跑注入（桌面端）或 `npm run build:ext`（網頁版）即可。

- 攔截的源語言固定為 `en-US` / `ja`，寫死在 `pm-chinese.js` 裡。
- 支援簡體中文（`locales/zh-CN/`）與繁體中文（`locales/zh-TW/`）。

**繁體中文怎麼來的**：`locales/zh-TW/`、`locales/scratchpad/zh-TW.json`、`locales/main/zh-TW.json` 都由
`scripts/build-zh-tw.js` 從對應簡體檔案生成——先用 [OpenCC](https://github.com/BYVoid/OpenCC) 的 `s2twp`（簡→繁 + 慣用詞轉換）轉換，
再按 `scripts/zh-tw-glossary.json` 修正（如 `腳本→腳本`、`參數→參數`、`自訂→自訂`）。只轉換譯文值，鍵名、佔位符、英文原樣保留。
**請只改簡體譯文**（README 也一樣：`README.zh-TW.md` 由 `README.md` 生成），改完執行 `node scripts/build-zh-tw.js` 重新生成繁體（需先 `npm install` 裝開發依賴 `opencc-js`）；
繁體用詞不滿意就往修正表裡加規則。CI 發布線上譯文前會檢查並在需要時補生成。
- 登出態 Scratch Pad 的 DOM 詞典單獨放在 `locales/scratchpad/zh-CN.json`（英文整串 → 中文），由 `scripts/build-scratchpad-dict.js` 維護。
- 主程序原生選單 / 對話方塊詞典放在 `locales/main/zh-CN.json`（英文整串 → 中文），手工維護。

---

## 常見問題

**macOS（M 晶片）執行報 `zsh: killed` / 「已損壞，無法開啟」/ 注入時 `EPERM`**
分別對應未簽名、下載隔離、macOS 13+ 的「App 管理」保護，都不是檔案損壞。處理步驟見 [docs/macos-troubleshooting.md](docs/macos-troubleshooting.md)。

**防毒軟體報毒 / SmartScreen 攔截**
單檔案二進位（bun / pkg 打包）的啟發式誤報，非真實威脅。原因、核實辦法與替代方案見 [防毒軟體報毒（誤報）說明](#防毒軟體報毒誤報說明)。

**介面還是英文 / Console 沒有 `[pm-chinese] 已注入`**
① 注入前是否完全退出 Postman；② 是否打到了正在執行的那個版本（Windows 多版本共存時用 `--app-version` 指定）。

**`asar requires Node >=22` 之類報錯**
那是 `@electron/asar` v4 的限制。把 Node 升到 22.12+ 即可；若無法升級，按上文把 `ASAR_PKG` / 依賴改回 `@electron/asar@3`（相容 Node 12+）。

**Postman 自動更新後又變回英文**
更新會生成新的版本目錄（不含補丁），重新跑一次注入程式即可——它會先自動把自己和譯文更新到最新再注入。

**想解除安裝中文化**
桌面端 `postman-chinese-injector restore`（原始碼執行為 `node postman-chinese-injector.js restore`）；網頁版在 `chrome://extensions` 移除擴充功能。

---

## 交流 / 意見回饋

- 問題與建議歡迎提 [Issue](../../issues)。
- QQ 群：**494969115**

### 提 Issue 前請附上這些資訊

點 **New issue** 會有現成模板（Bug / 漏譯誤譯 / 功能建議）引導你填寫；下面是報 Bug 時建議提供的資料（越全越快）：

1. **作業系統與版本**：Windows 10/11（含內部版本號）、macOS 版本 + 晶片（Intel / Apple Silicon）、Linux 發行版。
2. **Postman 版本**：Postman 內 `Settings → About`，或 Windows 的 `app-<version>` 目錄名。
3. **使用方式**：桌面端二進位 / 包管理器 / Node 原始碼執行 / 網頁版瀏覽器擴充功能。
4. **本工具版本與語言**：執行 `... -v`；用的是簡體還是繁體。
5. **`status` 輸出**：桌面端跑 `... status`，把整段結論貼上。
6. **Console 日誌**：Postman `View → Developer → Show DevTools`（或擴充功能頁 F12）→ Console，貼出含 `[pm-chinese]` / `[pm-scratchpad]` 的行。
7. **完整報錯**：終端的完整錯誤文字（含 `EPERM` / `ClosePseudoConsole` 等關鍵字），別隻截一半。
8. **復現步驟與現象**：做了什麼、期望什麼、實際什麼；介面未翻譯的可附**截圖**並標出位置。

> 報「某處沒翻譯 / 翻譯不當」時，附上**截圖**並說明所在介面（如登入態主介面 / 登出態 Scratch Pad / 網頁版），能幫我們快速定位是哪個模組的詞條。

---

## 法律宣告 / Disclaimer

- **非官方、無關聯**：本專案是社群維護的第三方中文化工具，**與 Postman, Inc. 沒有任何關聯**，未獲其授權、贊助或背書。"Postman" 及相關標識是 Postman, Inc. 的商標，此處僅作描述性指代。
- **不分發 Postman 資產**：本儲存庫**不包含、也不分發** Postman 的任何原始碼、二進位程式或原始語言包。儲存庫內容只有本專案自己的腳本，以及社群編寫的中文譯文。
- **譯文資料**：`locales/` 下的中文譯文是為方便中文使用者而創作的，其鍵結構與文案派生自 Postman 的介面字串。本專案對這部分**不主張版權**，也不保證其可在所有場景下自由再分發；如 Postman, Inc. 提出異議，將配合處理（如移除相關資料）。
- **本地使用、自負風險**：本工具在**你自己的機器**上修改**你自己安裝**的 Postman（重打包 `app.asar` 或載入瀏覽器擴充功能）。是否使用由你自行決定並承擔風險，並請遵守 Postman 的**服務條款與 EULA**（其中可能包含對反向工程 / 修改 / 衍生作品的限制）。
- **許可**：本專案**自身程式碼**以 MIT 許可發布；該許可**不覆蓋**上述派生自 Postman 文案的譯文資料。
- 本說明不構成法律意見。若用於商業用途或有疑慮，請諮詢專業律師並查閱 Postman 的最新條款。
