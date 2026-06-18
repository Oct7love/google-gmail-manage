# Electron 升级与无痕 Chrome 登录设计

> 日期：2026-06-18
> 状态：已与用户确认

## 1. 背景

添加 Gmail 账号时，右侧 Electron `webview` 打开 Google 应用密码页面。当前项目使用 Electron 33.4.11（Chromium 130），Google 已提示需要更换或升级浏览器。

即使升级内核，Google 仍可能把嵌入其他应用的浏览器视为不受支持的登录环境。因此，本次不再尝试修改 UA 或伪装浏览器，而是把 Google 登录交给这台 Mac 已安装的系统 Google Chrome。

## 2. 目标

- Electron 升级到 42.4.1，使用受支持的新 Chromium 内核。
- 添加或更新账号时，通过系统 Google Chrome 的无痕窗口打开 Google 应用密码页面。
- 移除添加账号对话框中的 Google `webview`，不再让用户在 Electron 内输入 Google 登录凭据。
- 保留现有的邮箱、应用密码、2FA、辅助邮箱和粘贴解析流程。

## 3. 明确不做

- 不修改或伪装 UA；系统 Chrome 使用自身默认 UA、客户端提示和浏览器指纹。
- 不注入脚本、不自动填写、不自动点击、不控制 Google 页面。
- 不尝试读取 Chrome Cookie、登录结果或生成的应用密码。
- 不为 Windows 或旧版 macOS 增加本次未要求的兼容分支。
- 不把无痕模式宣传为防封控。它只隔离本机浏览数据，Google 仍能观察登录行为。

## 4. 用户流程

1. 用户打开“添加 Gmail 账号”或“更新应用密码”。
2. App 显示一个醒目的“用无痕 Chrome 打开应用密码页”按钮和简短操作说明。
3. 点击按钮后，主进程直接调用系统 Google Chrome 可执行文件，并用 `--incognito` 参数打开 `https://myaccount.google.com/apppasswords`。
4. 用户在 Chrome 中人工登录并生成应用密码。
5. 用户回到 App，将 16 位应用密码粘贴到原表单并提交验证。

## 5. 技术设计

### 5.1 Chrome 启动

- 在主进程新增独立的 Chrome 启动模块，只负责校验目标 URL 并启动无痕 Chrome。
- 使用参数数组调用系统命令，不拼接 shell 字符串，避免转义和命令注入问题。
- IPC 返回结构化结果 `{ ok: true }` 或 `{ ok: false, error: string }`。
- Chrome 未安装、系统命令失败或进程启动失败时，渲染端在按钮附近显示中文错误，不静默失败。

### 5.2 Electron 安全收敛

- 删除添加账号对话框中的 `<webview>`、代理设置、刷新、清空 webview 会话和相关状态。
- `BrowserWindow` 关闭 `webviewTag`。
- 删除只为该 webview 暴露的 preload/IPC 通道和共享分区常量。
- 旧设置文件中可能残留的 `webviewProxy` 不影响运行；本次不迁移或删除用户文件。

### 5.3 界面

- 添加账号对话框保留左侧现有表单能力，移除右侧嵌入浏览器。
- 在操作说明附近放置主按钮“用无痕 Chrome 打开应用密码页”。
- 文案明确说明：Chrome 关闭后不会保留该次登录；生成密码后需回到 App 粘贴。
- 启动中禁用按钮，避免连续点击拉起多个窗口。

### 5.4 依赖升级

- 将 Electron 固定升级到 42.4.1，并更新 `pnpm-lock.yaml`。
- 重新构建 `better-sqlite3` 与 `keytar` 原生模块，确保与新 Electron ABI 匹配。
- 如 Electron 42 暴露现有依赖兼容问题，只做完成本次升级所需的最小兼容调整。

## 6. 测试与验收

- 为 Chrome 启动模块增加自动化测试，验证调用系统 Chrome 可执行文件时包含 `--incognito` 和正确 URL。
- 覆盖启动失败时的结构化错误。
- 运行 `pnpm typecheck`、自动化测试和 `pnpm build`。
- 启动开发版，确认按钮打开带无痕标识的 Chrome 窗口，并直达 Google 应用密码页面。
- 确认添加账号表单、粘贴解析和 IMAP 验证流程不受影响。

## 7. 风险说明

无痕 Chrome 能消除 Electron 嵌入式浏览器这一风险因素，并避免不同账号的 Cookie 相互干扰，但不会隐藏 IP、设备或登录行为。短时间连续登录大量账号、频繁更换代理或反复失败，仍可能触发 Google 额外验证或拒绝登录。
