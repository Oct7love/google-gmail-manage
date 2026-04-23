# Mail Viewer

一个 Mac / Windows 桌面应用，让你在**一个窗口里**查看几十个 Gmail 账号的收件箱，不用一个一个打开浏览器登录。

## 它解决什么问题

你是一个 Noon 卖家（或类似工作场景），手上有 30 多个 Gmail 账号，每隔几天还会新增/替换一批。每次要看邮件：

- 打开浏览器
- 登录某个账号
- 看完，退出
- 换下一个账号，重新登录
- ……循环 30 次

效率极低，而且浏览器会话冲突一多还容易被 Google 判定为"异常行为"。

这个软件让你：

1. 打开 App，左边看到所有绑定的账号列表（带头像、状态点、未读提示）
2. 点哪个就看哪个账号的收件箱
3. **只读邮件**（不能发，这是故意的，越少权限越安全）
4. 新加 / 删除账号都是一键操作
5. 通过**IMAP + 应用专用密码**（Mac Mail、Thunderbird、Outlook 同款协议），不容易触发封控

## 它不做什么

为了保持极简、稳定、少踩坑，以下功能**有意不做**：

- ❌ 发送邮件
- ❌ 跨账号搜索
- ❌ 附件预览
- ❌ 过滤器/标签/已读标记
- ❌ 超过 20 封历史邮件
- ❌ 系统弹窗通知

如果将来需要，再单独讨论加什么。现在不做就是不做。

## 它"顺便"做的事

| 功能 | 说明 |
|---|---|
| **实时接收新邮件** | IMAP IDLE 持久连接，Gmail 推送新邮件 ~30 秒内自动出现，无需手动刷新 |
| **一键英转中** | 邮件正文一键翻译成中文（Google Translate 免费接口） |
| **内置 2FA 码生成器** | 粘贴 2FA 密钥 → 本地生成 6 位码，不用再切换其他 App |
| **应用密码页内嵌浏览器** | 添加账号时右侧直接显示 Google 应用密码生成页，边看边操作 |
| **粘贴一行解析** | 粘贴 `账号 密码 辅邮 2fa` 一行，自动填入邮箱和 2FA |
| **睡眠唤醒自动重连** | 电脑休眠后醒来，所有 IDLE 连接自动恢复 + 追赶同步 |

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Electron（打包 `.app` / `.exe`） |
| 界面 | React + TypeScript + Tailwind + lucide-react |
| 数据 | better-sqlite3（本地缓存邮件） |
| 凭证 | macOS Keychain / Windows Credential Manager（通过 keytar） |
| 邮件对接 | `imapflow`（IMAP 官方协议）+ `mailparser`（MIME 解析） |
| 2FA | `otpauth`（本地 TOTP 生成） |
| 翻译 | `translate.googleapis.com` 免费端点 |

详细理由见 [`docs/tech_stack.md`](docs/tech_stack.md)。

## 怎么用

### 首次设置（给每个 Gmail 做一次）

> 前提：这个 Gmail 开启了 2FA（两步验证）

1. 下载并安装 Mail Viewer
2. 打开 App，点"+ 添加账号"
3. 弹出对话框，**右侧是嵌入的 Google 应用密码页**
4. 在右侧登录那个 Gmail → 生成一个 16 位应用密码 → 复制
5. 在左侧填入 Gmail 地址 + 粘贴应用密码
6. （可选）粘贴你的 2FA 密钥到 TOTP 面板，登录时直接用
7. 点"验证并添加" → 完成

### 后续使用

- **实时推送**：Gmail 服务器推送新邮件 ~30 秒内自动到达，左栏弹橙色 "+N" 胶囊徽章
- **1 小时兜底轮询**：即使 IDLE 漏推也能捕获
- 手动点左栏顶部 🔄 = 全部账号立即刷新
- 点中栏顶部 🔄 = 当前账号刷新
- 点邮件 → 右栏看正文
- 外部图片默认不加载（防追踪像素），需要看时点"加载外部图片"
- 英文邮件点"翻译为中文"

### 应用密码失效

理论上永不过期（只要主密码不改、不关 2FA、不手动撤销）。
如果某账号突然变成 ⚠️ 状态：点它 → 弹出"更新应用密码"对话框 → 重新生成一个 → 粘贴 → 恢复。

## 文档索引

- [`docs/prd.md`](docs/prd.md) — 产品需求（这东西是给谁做的、要解决什么、不做什么）
- [`docs/app_flow.md`](docs/app_flow.md) — 用户流程（每个操作怎么走）
- [`docs/tech_stack.md`](docs/tech_stack.md) — 技术栈与选型理由
- [`docs/backend_structure.md`](docs/backend_structure.md) — 主进程/后端结构
- [`docs/frontend_guideline.md`](docs/frontend_guideline.md) — 界面规范
- [`docs/implementation_plan.md`](docs/implementation_plan.md) — 开发阶段回顾

## 状态

✅ **核心功能可用**，未打包。开发中运行 `pnpm dev`；打包成 `.app`/`.exe` 待做。
