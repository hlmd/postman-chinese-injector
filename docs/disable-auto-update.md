# 关闭 Postman 自动更新（保持汉化不被冲掉）

> 本页配合 [Postman 中文注入](../README.md) 使用。

Postman 会**自动更新**，升级后生成新的版本目录（不含补丁）→ 界面变回英文。想固定在某个版本，装好指定版后按下面办法关掉更新。

**建议顺序**：先用 **①**（改配置，**完全不影响下载**）；若某些版本仍会自动更新，再叠加 **②**（hosts 屏蔽，会连手动下载一起挡住，慎用）。

---

## ① 改 `Preferences.json`（首选，不影响下载）

**先完全退出 Postman**，再把对应平台整段粘进命令行即可。命令会先把配置备份为 `Preferences.json.pm-bak`（可一键还原），且只写入 `update` 项、保留其它设置。文件路径：Windows `%APPDATA%\Postman\Preferences.json`、macOS `~/Library/Application Support/Postman/Preferences.json`、Linux `~/.config/Postman/Preferences.json`。

**Windows（PowerShell）**

```powershell
# 关闭自动更新
$f="$env:APPDATA\Postman\Preferences.json"
if(!(Test-Path "$f.pm-bak")){Copy-Item $f "$f.pm-bak"}
$j=Get-Content $f -Raw | ConvertFrom-Json
$u=if($j.update){$j.update}else{[pscustomobject]@{}}
$u|Add-Member enabled $false -Force; $u|Add-Member channel 'none' -Force
$j|Add-Member update $u -Force
[IO.File]::WriteAllText($f,($j|ConvertTo-Json -Depth 100))
```

```powershell
# 还原
$f="$env:APPDATA\Postman\Preferences.json"; if(Test-Path "$f.pm-bak"){Copy-Item "$f.pm-bak" $f -Force; Remove-Item "$f.pm-bak"}
```

**macOS / Linux（需 `python3`）**

```bash
# 关闭自动更新（macOS 用下面的 F；Linux 改成 ~/.config/Postman/Preferences.json）
F="$HOME/Library/Application Support/Postman/Preferences.json"
[ -f "$F.pm-bak" ] || cp "$F" "$F.pm-bak"
python3 - "$F" <<'PY'
import json,sys
p=sys.argv[1]; d=json.load(open(p))
u=d.get("update") or {}; u["enabled"]=False; u["channel"]="none"; d["update"]=u
json.dump(d,open(p,"w"),indent=2,ensure_ascii=False)
PY
```

```bash
# 还原（Linux 同样把 F 换成 ~/.config/Postman/Preferences.json）
F="$HOME/Library/Application Support/Postman/Preferences.json"
[ -f "$F.pm-bak" ] && mv "$F.pm-bak" "$F"
```

> 想手动改也行：编辑上面路径的文件，把 `update` 设成 `{ "enabled": false, "channel": "none" }` 即可。
> 各版本行为不一，有时仍会「检查」更新；要死钉版本再叠加下面第 ② 招。

---

## ② 拦截更新服务器（彻底，但会连手动下载一起挡住）

Postman 经 `GET dl.pstmn.io/update/status?...` 检查更新，并从**同一个** `dl.pstmn.io` 下载更新包。hosts 是**按域名**生效、无法只挡更新而放行下载，所以屏蔽这行后**手动下载 Postman 的链接也会一起失效**——这正是它「彻底」的代价，也是为什么把它排在 ① 之后当兜底。

**实用做法**：**先把要用的 Postman 版本下载并安装好**，再加下面这行；之后极少再用到 `dl.pstmn.io`，真要下载 / 换版本时把该行临时删掉（或行首加 `#` 注释）即可。

编辑 hosts 文件（Windows `C:\Windows\System32\drivers\etc\hosts` 需管理员；macOS / Linux `/etc/hosts` 需 `sudo`），加入：

```
127.0.0.1 dl.pstmn.io
# 以下为历史遗留域名，可选（新版基本不再用）：
127.0.0.1 updates.getpostman.com
127.0.0.1 postman-electron-updates.s3.amazonaws.com
```

> Windows 也可试防火墙对 Postman 出站拦截；但 Electron 自更新走应用主进程，难以只挡更新而不影响正常联网使用，故仍以「先下载、后屏蔽」的 hosts 方式更简单可控。
