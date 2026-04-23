# 实现过程（Implementation History）

> 从空仓库到现在功能齐全的开发全过程记录。
> 这不是"还要做什么"的 TODO，而是"已经走过了什么"的回顾 —— 方便下个 Claude 理解为什么某些东西长这样。

---

## 总览

```
P0 脚手架 ──► P1 SQLite ──► P2 凭据向导 ─X弃用─► 
                                  │
                                  ▼
     [遇到 OAuth 7-day + test user 风控 → 架构调整]
                                  │
                                  ▼
P3 OAuth（一次通） ──► 重构到 IMAP + 应用密码 ──►
                                  │
                                  ▼
P4 3 栏 UI + 自动刷新 ──► UI/UX 多轮迭代 ──► 文档更新 ──► [待做] 打包 .app/.exe
```

---

## 已完成的阶段

### P0：脚手架
- Electron 33 + electron-vite + React 18 + TypeScript 严格模式 + Tailwind + Zustand
- 三进程 IPC 通路（main / preload / renderer）
- preload 通过 contextBridge 暴露 `window.api` 白名单
- 产出：空窗口显示 "IPC 状态: pong" 确认通路

### P1：SQLite + 共享类型
- `better-sqlite3` + `@electron/rebuild`（postinstall 自动重建 Electron ABI）
- 数据库 schema：`accounts`、`messages`（复合 PK + CASCADE + 日期索引）
- accounts-repo / messages-repo 仓储层
- 共享类型定义（`Account`、`MessageSummary`、`MessageDetail`、`SyncStatus`、`RefreshEvent`）
- IPC 常量集中在 `shared/ipc-channels.ts`

### P2：凭据向导 + Keychain（**已弃用**）
- `keytar` 接入
- 原计划：6 步向导引导用户配置 Google Cloud Console OAuth 凭据
- 实现过：SetupWizard 组件 + credentials:status/set/clear IPC
- **后来为什么删**：Google Cloud + OAuth 方案整体弃用（见下文 P3 后的重构）

### P3：OAuth 流程 + 第一个账号（**整套弃用**）
- `googleapis` 官方 SDK 接入
- OAuth loopback server（系统分配端口 + 2 分钟超时）
- 完整 OAuth 流程（loopback + shell.openExternal + access_type=offline + prompt=consent）
- Gmail client（tokens 事件同步回 Keychain + invalid_grant 识别）
- messages fetch（list + get full）
- **实际跑通过一次**（添加 heraldlinkhorn449@gmail.com，拉到 10 封邮件）

#### **为什么弃用**
用户反馈 test users 添加时 Google 拒绝 15 个批量账号，只接受了少数几个。核心原因：
1. `gmail.readonly` 是 restricted scope，未审核应用 refresh_token **每 7 天过期**
2. Test users 列表严格，大部分批量来源账号被 Google 标为 "not eligible"

没有"改下代码就能解决"的办法——要让这些账号能用，必须绕过 OAuth。

### **架构重构：IMAP + 应用专用密码**
- 删除 `src/main/oauth/*`、`src/main/gmail/*`、`SetupWizard.tsx`、`credentials.ts`
- 卸载 `googleapis`，安装 `imapflow` + `mailparser`
- Keychain service 改名 `MailViewer-imap-passwords`，value = 16 位应用密码
- AddAccountDialog 重写：左表单 + 右内嵌 Google 应用密码页 webview
- 主窗口 BrowserWindow 加 `webviewTag: true`
- CSP meta 放宽 frame-src 允许 `myaccount.google.com` + `accounts.google.com`
- IMAP 连接超时控制：connectionTimeout/greetingTimeout 10s、socketTimeout 30s
- **性能优化**：一次 IMAP 会话批量拉 N 封邮件（而不是一封一连），30s → 3-5s

### P4 + P3.5：正式 3 栏 UI + 自动刷新
- Zustand store 全面接管 UI 状态
- Toolbar（Logo + 账号计数 + 同步中徽章，支持 drag 拖窗）
- LeftColumn / AccountItem（头像 + 状态徽章 + ⋯菜单）
- MiddleColumn / MessageRow（发件人头像 + 摘要）
- RightColumn / MessageBody（sandboxed iframe + CSP）
- 自动刷新调度器：1 小时间隔，并发上限 5
- refresh:progress IPC 事件推送给 UI
- 修过几个 React bug：`<button>` 嵌套、Zustand selector 返回新数组引发的无限 rerender

### 辅助工具迭代
- **TotpPanel**：本地 TOTP 生成器（`otpauth` 库，base32 或 otpauth:// URI，30 秒倒计时 + 一键复制）
- **TranslationPanel**：邮件英转中
  - 初版：直接调 translate.googleapis.com，但有 markdown 链接残骸 `[` `]` 散落
  - 二版：预处理加上 `\[...\]\(url\)` → `text` 替换
  - 三版：渲染时把 ≤40 字的短段落合并，减少稀疏排版
- **粘贴解析**：支持两种格式（空格 / `----` 分隔），自动填 Gmail 和 2FA 密钥
- **批量添加流程**：验证成功后自动清空表单 + 清空 TOTP + 登出 webview + 焦点回邮箱输入框

### UI/UX 多轮打磨
- 配额统一：`MESSAGES_PER_ACCOUNT = 20`（`src/shared/constants.ts`）
- 对话框 3 段式结构（固定头 / 滚动区 / 固定尾）修复底部按钮被截
- 登录辅助区：Google 登录密码 + 辅邮 + 链接，带复制按钮
- "→ 应用密码页"按钮：强制跳转，Google 重定向时的兜底
- 内存优化：DevTools 改为按需 ⌘⌥I，默认不弹（省 200MB）
- 渐变按钮、卡片阴影、内嵌图片 cid: → data URL 等细节

### 图标 + Logo 升级
- 引入 `lucide-react` 替换所有 emoji / Unicode 字符
- 自定义 SVG Logo（渐变信封 + 橙色通知点）
- 账号选中态改为白底 + 阴影 + ring（Mac 卡片感）
- 复制按钮带 "复制 → ✓ 已复制" 状态切换动画
- 刷新中的头像：旋转小图标，不只是脉动绿点

### 文档更新
- 所有文档从"OAuth / Google Cloud 路线"切回"IMAP / 应用密码"现实
- CLAUDE.md 记录弃用决策，防止未来 Claude 走回头路
- PRD 补充"它顺便做的事"（翻译、TOTP、粘贴解析）

### 实时推送（IMAP IDLE）
- `src/main/imap/idle-manager.ts`：每账号持久 IMAP IDLE 连接
- 启动错峰 250ms 逐一，避免 30 连接爆发
- 1.5s 防抖（Gmail 有时连续推 EXISTS）
- 指数退避重连（2s → 5s → 15s → 30s → 60s → 120s）
- AUTHENTICATIONFAILED → 标 expired 不重试
- `powerMonitor.on('resume')` 电脑唤醒强制重连所有 session
- RefreshEvent 加 newCount 字段
- UI：橙色 "+N" 胶囊徽章，脉动 5 秒后消失，点开账号立即清除
- 1h 轮询保留做兜底
- 实测延迟 5-60 秒（Gmail 服务器批量推送行为，不是客户端问题）

### 凭据管理 + 查看抽屉
- Keychain 拆两个 service：`MailViewer-imap-passwords`（IMAP 密码必需）+ `MailViewer-account-info`（Google 密码 / 2FA / 辅邮 / 链接，可选）
- 粘贴解析自动入 Keychain
- `CredentialsDrawer` 组件：中栏 🔑 按钮打开，默认打码 / 编辑模式可改
- 整个对话框带敏感信息警示
- 2FA 行带实时码 + 进度条 + 复制

### TOTP 受控 + 2FA 设置快捷跳转
- TotpPanel 从内部 state 改为 `secret` + `onSecretChange` 受控，父级统一管理
- 显示"已改动"徽章（对比 originalSecret）+ "还原"按钮
- 提交账号时保存的是当前（可能已修改）密钥，而非原始粘贴值
- webview 工具栏新增"→ 2FA 设置"按钮，直达 `/signinoptions/two-step-verification`

### webview 代理 + 连不上兜底
- `main/settings.ts` + `userData/settings.json` 存 `webviewProxy`
- 仅设到 `persist:google-apppasswords` partition session（不影响 IMAP / 翻译）
- IPC `system:setSettings` 立即生效
- webview `did-fail-load` 监听 → 覆盖错误卡（AlertTriangle 图标 + 3 个出口按钮）

### 打包分发
- 接入 `electron-builder` + `electron-builder.yml`
- `package:mac` / `package:win` npm scripts
- **坑**：pnpm 默认嵌套 `node_modules` 让 electron-builder 漏 transitive 依赖
- 修：`.npmrc` 加 `node-linker=hoisted` + 把 `parseley` 显式加为直接依赖
- Mac arm64 `.dmg` + unpacked `.app` 产物均可用
- Windows `.exe` 可从 Mac 交叉编译

### 自定义图标
- `build/icon.svg`（蓝色渐变信封 + 右上橙色通知点，和顶部 Logo 同款）
- `build/make-icon.mjs`：sharp + png-to-ico + iconutil，一键生成 `.png` / `.ico` / `.icns`
- electron-builder 自动打进产物

### 内存优化
- `app.disableHardwareAcceleration()`：省独立 GPU 进程约 80MB
- `webPreferences.spellcheck=false` / `backgroundThrottling=false`
- `messageDetail` LRU 上限 50
- DevTools 改为按需 ⌘⌥I
- 生产模式 `.app` 实测 ~412 MB，接近 Electron 下限

---

## 当前状态

✅ **功能完整**：多账号 Gmail 阅读 + 实时推送 + 翻译 + TOTP + 凭据管理 + 打包分发 + 自定义图标 + webview 代理兜底

## 可选的后续打磨

- 深色模式（跟随系统主题）
- 快捷键（⌘R 刷新 / ⌘N 添加）
- 代码签名（Apple Developer $99/年 + Windows EV $300/年，目前不做）
- DeepL / OpenAI 高质量翻译（现在 Google Translate 免费够用）
- 换 Tauri 重写（~50MB 但要重写 2-3 周）

---

## 教训记录

| 遇到的坑 | 学到的 |
|---|---|
| OAuth 7-day refresh token 过期 | 未审核应用用 restricted scope 有硬上限，不要轻信"测试模式先用着" |
| Test users 加不进来 | Google 有隐性账号风控，批量来源的账号绕不过 |
| 每封邮件一个 IMAP 连接 | TLS 握手贵，必须一次会话做完批量操作 |
| p-limit v7 ESM-only | Electron main 还是 CJS，新包不一定兼容 |
| `<button>` 嵌套 `<button>` | HTML 合法性导致 React 崩溃，不是 CSS 问题 |
| Zustand selector 返回新数组 | React 18 的 `useSyncExternalStore` 会检测引用变化，返回新 `[]` = 无限 rerender |
| 邮件正文手写 MIME parser | 中文乱码，专业领域就用 mailparser 这种成熟库 |
| Google Translate 翻译 markdown 链接 | 翻译前必须预处理掉 URL / 链接残骸 |
