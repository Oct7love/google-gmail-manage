# CLAUDE.md — 给未来的 Claude 看

> 这个文件不是给人看的，是给下一次打开这个仓库的 Claude 看的。
> 让它在几十秒内理解项目的定位、用户、边界和隐含约束，少踩坑。

---

## 一句话

一个**只读**多账号 Gmail 查看器 Mac/Windows 桌面应用，服务一位 Noon 电商卖家管理 30+ 个会频繁轮换的 Gmail 账号。

## 用户画像（非常重要）

- **非开发者**，中文母语
- Noon 电商卖家，有多仓库业务
- 用户的 PRD 习惯：文档要先充分提问、用他的语言描述需求，**不要从代码角度自说自话**
- 会用浏览器、会用 Chrome 扩展，但不会修代码
- 默认**用中文**和他沟通，除非他切换语言

## 核心业务约束（不要自作主张扩大范围）

用户已**明确拒绝**的功能，不要加：

| 已拒绝 | 为什么记录在这 |
|---|---|
| 发送邮件 | 用户明确说"不需要" |
| 跨账号搜索 | 用户明确说"只需要查看该账号接收到的邮件" |
| 按发件人/主题过滤 | 同上 |
| 附件查看 | 同上 |
| 已读/未读标记 | 同上 |
| 长历史邮件（>20 封） | 用户说"拉最近 20 封"，账号用几天就删 |
| 系统弹窗通知 | 用户选了 App 内显示未读数就够 |
| 跨账号统一收件箱 | 同"跨账号搜索"，用户只按账号独立看 |

任何"顺手加一下 XX"的念头，先打住。这个产品的价值就是**极简**，用户明确要极简。

## 连接方式：IMAP + 应用专用密码（不是 OAuth / 不是 Gmail API）

**历史决策**：原本选的是 OAuth + Gmail API，但遇到两个硬门槛：
1. `gmail.readonly` 属于 restricted scope，未审核应用的 refresh_token 每 **7 天过期**
2. Test user 列表严格——用户大部分**批量来源账号加不进 test users**（Google 返回"not eligible"）

**现行方案**：IMAP（`imap.gmail.com:993` + 应用专用密码）
- 用户在 Google 账号设置里开 2FA，然后生成 16 位应用密码
- App 用 `imapflow` 连接，`mailparser` 解析
- 一次 IMAP 会话拉完最近 20 封邮件（不要一封一连）
- Keychain service: `MailViewer-imap-passwords`，account = 用户邮箱

**实时推送（IMAP IDLE）**：
- 每个账号一个持久 IMAP 连接（见 `src/main/imap/idle-manager.ts`）
- `mailboxOpen('INBOX')` 后 imapflow 自动进入 IDLE；Gmail 推送 → `exists` 事件 → 1.5s 防抖 → `syncAccount`
- 延迟实测 5-60 秒，这是 Gmail 服务器端批量推送行为，客户端无法控制
- 电脑睡眠/唤醒：`powerMonitor.on('resume')` → `reconnectAll()` 强制重连所有 session
- 1h 轮询保留做兜底，防 IDLE 漏推
- 启动错峰 250ms 逐一连接，避免 30 个连接同时爆发

**绝对不要做**：
- 再接入 Gmail API / googleapis
- 加"Sign in with Google" OAuth 流程
- 内嵌 webview 模拟 Google 登录做"自动登录第三方站"（用户提过，已说服他不做，会触发 Google 反欺诈）

## 技术选型（定了，别轻易改）

- **Electron + React + TypeScript** — 打包 `.app`/`.exe` 分发；Claude 最熟；跨平台
- **better-sqlite3** — 本地缓存；同步 API 不用写 async
- **imapflow** — 现代 IMAP 客户端，Promise-based，TypeScript 友好
- **mailparser** — MIME 解析（HTML/text body + inline 图片 cid: 转 data:）
- **macOS Keychain / Windows Credential Manager**（通过 `keytar`）— 应用密码安全存储
- **otpauth** — 本地 TOTP 6 位码生成（base32 密钥或 otpauth:// URI）
- **lucide-react** — 图标库
- **zustand** — UI 状态管理
- **translate.googleapis.com**（免费公开端点）— 邮件一键英转中，不需要 API key

### 为什么不是 Tauri / 原生 SwiftUI
用户接受过权衡：Tauri 的 Rust 端 Claude 改起来慢；SwiftUI 只 Mac 且要 Xcode。

## 反封控原则（用户最在意的）

用户原话："不要轻易触发封控，一定要是阅读谷歌自己开放的 api"。

IMAP 方案**本质上就是 Mac Mail / Thunderbird / Outlook 同一个协议**，Google 把这种流量当成正常邮件客户端。

**做到：**
- 只用 IMAP `imap.gmail.com:993` 官方端点，不走非公开 API
- 一次会话批量拉邮件（减少连接次数）
- 默认 **1 小时**后台刷新；不要加更高频的"心跳"
- 登录失败要 UI 提示，**不要悄悄重试**（避免一个坏密码反复撞 Google）
- 不发出"探测"类请求；没加的账号不动

**不要做：**
- 爬网页版 Gmail（mail.google.com）
- 模拟浏览器自动化登录 Google
- 自动化"生成应用密码"（Google 不让 API 生成，只能用户手动）
- 存储 Google 账号登录密码（加密也不行——我们用**应用专用密码**，它权限仅限 IMAP，即使泄露也只能读邮件）

## 仓库结构约定

```
google-mail-manage/
├── CLAUDE.md                         # 本文件
├── README.md                         # 人看的入门
├── docs/
│   ├── prd.md                        # 产品需求
│   ├── app_flow.md                   # 用户流程
│   ├── backend_structure.md          # 主进程结构
│   ├── frontend_guideline.md         # 前端规范
│   ├── tech_stack.md                 # 技术栈理由
│   └── implementation_plan.md        # 分阶段回顾
├── src/
│   ├── main/                         # Electron 主进程
│   │   ├── index.ts                  # 入口
│   │   ├── imap/                     # IMAP 连接 / 邮件获取 / IDLE 管理器
│   │   ├── ipc/                      # IPC handlers
│   │   ├── keychain/                 # Keychain 封装
│   │   ├── scheduler/                # 1h 兜底轮询
│   │   ├── storage/                  # SQLite repos
│   │   ├── sync.ts                   # 单账号同步逻辑
│   │   └── translation/              # Google Translate 调用
│   ├── preload/                      # contextBridge 白名单
│   ├── renderer/src/
│   │   ├── components/
│   │   │   ├── accounts/             # 左栏 + 添加对话框 + TOTP
│   │   │   ├── common/               # Avatar / Logo
│   │   │   ├── detail/               # 右栏 + 翻译 + 正文 iframe
│   │   │   ├── layout/               # Toolbar + 三栏布局
│   │   │   └── messages/             # 中栏邮件列表
│   │   ├── lib/                      # avatar / parseAccount 工具
│   │   └── store.ts                  # Zustand 全局 store
│   └── shared/
│       ├── constants.ts              # MESSAGES_PER_ACCOUNT = 20
│       ├── ipc-channels.ts           # IPC channel 常量
│       └── types.ts                  # Account / MessageSummary / MessageDetail 等
└── ...
```

所有文档**用中文写**，用户会亲自审阅。

## 关键 UX 决策（别改）

- **默认不加载外部图片**（防追踪像素），每封邮件单独开关
- **内嵌图片（cid:）默认加载**（它们是邮件附件，不是追踪）
- **邮件正文用 sandboxed `<iframe srcDoc>`**，CSP 禁 JS / 禁外部资源，防钓鱼
- **添加账号对话框**：左表单 + 右 webview（内嵌 `myaccount.google.com/apppasswords`）。webview 登录用户"要添加的那个 Gmail"，生成应用密码，回来粘到左边
- **TotpPanel**：本地计算 TOTP，**受控组件**（secret 由父级管理）。支持在对话框里直接编辑密钥（显示"已改动"徽章 + "还原"按钮），提交时保存当前值
- **粘贴解析**：支持 `账号 密码 辅邮 2fa` 和 `账号----密码----辅邮----2fa----链接` 两种格式，自动填入邮箱 + 2FA 密钥，登录密码和辅邮放"登录辅助"区供复制
- **凭据抽屉（CredentialsDrawer）**：中栏顶部 🔑 按钮，显示该账号的完整凭据（应用密码 / Google 密码 / 2FA 密钥 + 实时码 / 辅邮 / 链接）。默认打码、按需单独或全部显示。可编辑保存
- **存储分层**：
  - Keychain service `MailViewer-imap-passwords`：应用专用密码（IMAP 必需）
  - Keychain service `MailViewer-account-info`：Google 密码 / 2FA / 辅邮 / 链接（JSON，可选）
  - 删账号时两边同步清掉
- **webview 代理**：添加账号对话框右侧有齿轮按钮，可配置 webview 专用代理（如 `http://127.0.0.1:7890`），存 `userData/settings.json`，仅影响 webview 不影响 IMAP / 翻译
- **连不上 Google 兜底**：webview `did-fail-load` 监听 → 覆盖错误卡（重试 / 配代理 / 系统浏览器打开）
- **2FA 设置快捷跳转**：webview 头部除了"→ 应用密码页"还有"→ 2FA 设置"按钮（直达 `/signinoptions/two-step-verification`）

## 如果你要开始写代码

1. 先完整读一遍 `docs/implementation_plan.md`，了解已发生的阶段
2. 用户不会自己跑命令，凡是需要他操作的，**必须写清步骤**
3. 每完成一个改动，跑一次 `pnpm typecheck && pnpm build`
4. Vite 的 HMR 会自动推送 renderer 改动，**主进程改动需要重启 App**（kill + pnpm dev）
5. 绝不静默加范围——想加任何 PRD 没有的功能，先问用户

## 跨平台

- **Mac**：`.dmg` / `.app`，Keychain 存应用密码
- **Windows**：`.exe` 安装包，Credential Manager 存应用密码（keytar 自动切换）
- 代码层面基本无差异；只有 `titleBarStyle: 'hiddenInset'` 是 Mac 专有（Windows 自动忽略）
- 用户有 Mac + Windows 两种朋友，打包时两个都要出

## 打包相关

- **electron-builder.yml** 是打包配置
- `pnpm package:mac` 出 `release/*.dmg` + `release/mac-arm64/*.app`
- `pnpm package:win` 出 `release/*.exe`
- **未做代码签名**（Apple Developer $99/年 + Windows EV $300/年 不划算）
- Mac 首次打开需要**右键 → 打开**绕过 Gatekeeper；Windows 首次运行需要点"更多信息 → 仍要运行"
- **关键**：`.npmrc` 必须有 `node-linker=hoisted`，否则 pnpm 的嵌套 `node_modules` 会让 electron-builder 漏掉 transitive 依赖（典型踩坑：parseley 是 mailparser → html-to-text → selderee 的孙依赖）

## 资源占用（生产模式实测）

- Electron 主 + 渲染 + GPU Helper + 网络 Helper ≈ 4 个进程
- 总内存：**~412 MB**（已经接近 Electron 下限；Spark Mail ~600MB、Slack ~800MB）
- 30 个 IMAP IDLE 持久连接占约 60 MB，是实时推送的代价
- 已做的优化：关 GPU 硬件加速、关拼写检查、TotpPanel 和 messageDetail LRU（上限 50）、邮件一次会话批拉、Vite 压缩
- 再降只能换 Tauri（Rust 重写，~50 MB）—— 代价太大不值

## 应用图标

- **蓝色渐变信封 + 右上橙色通知点**，和顶部工具栏 Logo 同款
- 源文件：`build/icon.svg`
- 生成脚本：`build/make-icon.mjs`（需要 `sharp` + `png-to-ico` + macOS `iconutil`）
- 产物：`build/icon.png`（1024×1024）、`build/icon.icns`（Mac）、`build/icon.ico`（Windows）
- 想换图标：改 SVG → 跑 `node build/make-icon.mjs` → 重打包

## 如果你要改文档

用户不喜欢"文档从代码角度自说自话"。改之前先读 PRD，用他的语言描述问题和方案。
