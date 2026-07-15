# 关闭 Postman 自动更新（保持汉化不被冲掉）

> 本页配合 [Postman 中文注入](../README.md) 使用。

Postman 桌面端用 **Squirrel 更新器**自动更新：检查更新走 `GET dl.pstmn.io/update/status`，Windows 由 `%LOCALAPPDATA%\Postman\Update.exe` 负责下载并应用。升级后生成新的版本目录（不含补丁）→ 界面变回英文。用下面任一方法关掉更新即可（可叠加）。

> ⚠️ 网传「改 `Preferences.json` 里的 `update.enabled`」对**新版 Postman 已失效**——新版没有该文件、也没有这个开关，别再照抄。

---

## 方法 A（Windows，推荐）：停用 Squirrel 更新器

把更新器 `Update.exe` 改名即可。**不影响 Postman 启动、也不影响用浏览器下载 Postman**，随时可改回——比屏蔽域名更干净。

```powershell
# 停用自动更新
$u="$env:LOCALAPPDATA\Postman\Update.exe"
if(Test-Path $u){ Rename-Item $u "Update.exe.disabled" -Force; "已停用更新：$u -> Update.exe.disabled" } else { "未找到 Update.exe（可能非 Squirrel 安装）" }
```

```powershell
# 还原
$d="$env:LOCALAPPDATA\Postman\Update.exe.disabled"
if(Test-Path $d){ Rename-Item $d "Update.exe" -Force; "已恢复更新器" } else { "未找到 Update.exe.disabled" }
```

> `Update.exe` 是 Squirrel 用来下载并安装更新的程序，改名后就无法自更新。应用内偶尔仍可能弹「有可用更新」提示但装不上；想连提示也去掉，叠加下面的方法 B。

---

## 方法 B（全平台通用）：hosts 屏蔽更新服务器

Postman 经 `GET dl.pstmn.io/update/status?...` 检查更新，并从**同一个** `dl.pstmn.io` 下载更新包。hosts 是**按域名**生效、无法只挡更新而放行下载，所以屏蔽这行后**手动下载 Postman 的链接也会一起失效**——这正是它「彻底」的代价。macOS / Linux 没有可单独改名的更新器，用这个方法最省事。

**实用做法**：**先把要用的 Postman 版本下载并安装好**，再加下面这行；之后极少再用到 `dl.pstmn.io`，真要下载 / 换版本时把该行临时删掉（或行首加 `#` 注释）即可。

编辑 hosts 文件（Windows `C:\Windows\System32\drivers\etc\hosts` 需管理员；macOS / Linux `/etc/hosts` 需 `sudo`），加入：

```
127.0.0.1 dl.pstmn.io
# 以下为历史遗留域名，可选（新版基本不再用）：
127.0.0.1 updates.getpostman.com
127.0.0.1 postman-electron-updates.s3.amazonaws.com
```

macOS / Linux 刷新 DNS 缓存（可选）：

```bash
# macOS
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
# Linux（systemd）
sudo resolvectl flush-caches 2>/dev/null || sudo systemd-resolve --flush-caches
```

---

## 固定在某个版本

想钉死版本：先从[发布说明页](https://www.postman.com/release-notes/postman-app/)选好版本、用[指定版本直链](../README.md#下载-postman各版本)装上，再按上面方法 A / B 关掉更新即可。
