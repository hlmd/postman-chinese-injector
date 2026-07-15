# macOS 首次运行 / 注入排障

> 本页配合 [Postman 中文注入](../README.md) 使用。仅 macOS 需要；Windows / Linux 一般无需这些步骤。

## Apple Silicon（M 芯片）首次运行：`zsh: killed` / 「已损坏，无法打开」

macOS 二进制在 Linux CI 上交叉编译，**未做 Apple 代码签名**；在 Apple Silicon 上，系统会拦截未签名的二进制，表现为运行时 `zsh: killed`、或双击弹「**已损坏，无法打开**」。这些都**不是文件损坏**，按下面三步处理即可（全部在**终端**里执行，先 `cd` 到该文件所在目录；**不要在 Finder 双击**——它是命令行程序，双击必被判「已损坏」）：

```bash
# 1) 去掉「下载隔离」属性
xattr -dr com.apple.quarantine ./postman-chinese-injector-macos-arm64
# 2) 打一个 ad-hoc 签名（-s 后面那个独立的 - 是 ad-hoc 身份，前后都有空格，别漏！）
codesign -s - -f ./postman-chinese-injector-macos-arm64
# 3) 从终端用 ./ 启动（可加 sudo 视安装位置而定）
./postman-chinese-injector-macos-arm64
```

- 验证签名成功：`codesign -dv ./postman-chinese-injector-macos-arm64`，输出含 `Signature=adhoc` 即可。
- `codesign` 报 **`no identity found`**：多半是复制粘贴把那个独立的 `-` 吃掉了（或变成了中文连字符）。请**逐字手敲** `-s - -f`。
- x64（Intel）机型同理，把文件名换成 `postman-chinese-injector-macos-x64`。

## 注入时报 `EPERM: operation not permitted`

拷贝 / 改写 `app.asar` 时报此错，是 macOS 13+ 的「**App 管理**」保护在拦截修改已签名的 `Postman.app`，**`sudo` 也绕不过**。两种解法二选一：

- **给终端授权**：系统设置 → 隐私与安全性 → **App 管理** → 打开你用的终端（Terminal / iTerm；没有就点 `+` 添加 `/Applications/Utilities/Terminal.app`）→ **完全退出并重开终端** → 重新注入。
- **挪出受保护位置再改**：
  ```bash
  cp -R /Applications/Postman.app ~/Postman.app
  ./postman-chinese-injector-macos-arm64 --postman-dir ~/Postman.app
  # 验证界面变中文后，如需放回：
  rm -rf /Applications/Postman.app && mv ~/Postman.app /Applications/
  ```

> 嫌上面麻烦，可直接用 README「方式二」的 Node 源码运行，绕开二进制签名问题（App 管理的 `EPERM` 仍需按上面处理）。
