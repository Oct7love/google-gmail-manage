# 技术栈（Tech Stack）

> 每个选型都带"**为什么选它 / 为什么不选别的**"。
> 将来有人（或下一个 Claude）想换技术栈，先来这里看理由再动。

---

## 总览

| 层 | 选型 |
|---|---|
| 桌面框架 | **Electron** |
| UI 库 | **React + TypeScript** |
| 构建工具 | **Vite** + **electron-vite** |
| 样式 | **Tailwind CSS** |
| 图标 | **lucide-react** |
| 状态管理 | **Zustand** |
| 本地数据库 | **better-sqlite3** |
| IMAP 客户端 | **imapflow** |
| 邮件解析 | **mailparser** |
| TOTP | **otpauth** |
| 钥匙串/凭据管理器 | **keytar** |
| 翻译 | `translate.googleapis.com`（免费公开端点，无 API key） |
| 打包 | **electron-builder** |
| 代码质量 | **ESLint + Prettier** |
| 包管理 | **pnpm** |

---

## 桌面框架：Electron

### 为什么选 Electron

- **Claude 最熟** — 训练数据最多
- **跨平台免费**：Mac `.app/.dmg` + Windows `.exe` 一套代码
- **Node 生态** — `imapflow` `mailparser` `keytar` 都是 Node 包
- **成熟稳定** — VS Code、Slack、Discord 都在用

### 为什么不选 Tauri / 原生 SwiftUI

- Tauri：Rust 端 Claude 改起来慢 2-3 倍
- SwiftUI：只 Mac，要 Xcode
- 原生：要自己写 IMAP 的 TLS 协议栈，事倍功半

---

## UI：React + TypeScript + Tailwind + lucide-react

- React：组件化顺手
- TypeScript：OAuth token / IMAP 响应 / IPC 消息都是结构化数据，有类型更稳
- Tailwind：类名即样式，改 UI 不跳 CSS 文件
- **lucide-react**：专业图标库（Mail、RefreshCw、ChevronDown 等），一致的描边风格

---

## 状态管理：Zustand

项目全局状态很少：账号列表、选中账号、选中邮件、刷新状态、对话框状态。Zustand 最简洁，不需要 Redux 的样板代码。

---

## 本地数据库：better-sqlite3

- 同步 API，代码简洁
- 性能好（C++ 原生绑定）
- 需要 `@electron/rebuild` 针对 Electron ABI 重编
- 本项目量级（~30 账号 × 20 邮件）完全够

---

## 邮件协议：IMAP（imapflow）+ MIME 解析（mailparser）

### 为什么是 IMAP 而不是 Gmail API

**历史**：原计划用 Gmail API + OAuth，但：
1. `gmail.readonly` 是 Google 的 restricted scope，未审核应用的 refresh token **每 7 天过期**
2. Test user 列表严格，用户大部分批量来源账号**加不进去**（Google 返回"not eligible"）

**IMAP 方案**：
- `imap.gmail.com:993` 是 Google 官方支持的标准协议
- 认证用**应用专用密码**（16 位，由 Google 签发，权限仅限邮箱协议）
- 不需要 Google Cloud Console 项目、不需要审核、不需要 test users
- 应用密码**永不过期**（只要主密码不改、2FA 不关）
- 行为上和 Mac Mail、Thunderbird、Outlook 完全一样，**不会触发异常检测**
- **IMAP IDLE** 支持实时推送，Gmail 有新邮件 ~30 秒内到达（Gmail 服务器端有批量推送节奏）

### imapflow vs node-imap vs imap-simple
- `imapflow`：现代、Promise-based、TypeScript 类型齐全、活跃维护（postalsys 公司）
- `node-imap`：callback-based，老
- `imap-simple`：node-imap 的 Promise 包装，依赖有点过时

**选 imapflow**。

### mailparser
- MIME 解析是个大活：多层 multipart、quoted-printable、base64、RFC 2047 编码头、charset 混乱
- `mailparser` 是 Node 生态里做 MIME 解析最完整的
- 自动给 inline 图片（`cid:xxx`）提供 base64 数据，可以注入 HTML 让它们直接显示

---

## 2FA：otpauth

- TOTP 是标准算法（RFC 6238，HMAC-SHA1 + 时间戳）
- `otpauth` 是纯 TS 库，~5KB，零依赖
- 支持两种输入：base32 密钥 或 `otpauth://` URI

---

## 凭据：keytar

用户的**应用专用密码**存这里。
- macOS → Keychain（"钥匙串访问"App 里能看到）
- Windows → Credential Manager
- keytar 自动处理平台差异

service 名称 `MailViewer-imap-passwords`，account = 用户邮箱。

**不存**：Google 账号登录密码、2FA 密钥、邮件正文（邮件存 SQLite 里）。

---

## 翻译：translate.googleapis.com

- 免费公开端点（`translate_a/single`）
- 无 API key
- 单次上限 ~5000 字符，我们按段落切块串联
- 预处理：去掉 URL、markdown `[text](url)`、装饰线
- 在主进程跑 `fetch()`，避开 CORS

### 为什么不用 DeepL / OpenAI
- 需要 API key + 付费
- 用户是个人使用，不值得

### 缺点
- 品牌名会被生硬翻译（"Stripe" → "条纹"）
- 国内访问 Google 要代理

---

## 打包：electron-builder

- 出 `.dmg`（Mac）和 `.exe`（Windows）
- 自动处理原生模块（better-sqlite3、keytar）的对应平台二进制
- 不做代码签名（需要 Apple Developer $99/yr + Windows EV 证书 $300/yr）——朋友首次打开需要右键/"仍要运行"

---

## 不用的东西

| 不用 | 理由 |
|---|---|
| Gmail API / googleapis | 用 IMAP 替代，见上 |
| OAuth 2.0 | 同上 |
| Redux / Redux Toolkit | 小项目，Zustand 够 |
| GraphQL | 本地 DB，没必要 |
| React Query / SWR | 数据都在本地 SQLite |
| Web framework（Next / Remix） | 是桌面 App 不是网站 |
| 任何爬虫库（puppeteer） | **明令禁止**，只走官方协议 |
| p-limit | 自己写了 10 行 runWithConcurrency 代替（p-limit v7 是 ESM-only 和 Electron CJS 冲突） |
