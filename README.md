# Google Mail Manager

一个 Mac 桌面应用，让你在**一个窗口里**查看几十个 Gmail 账号的收件箱，不用一个一个打开浏览器登录。

## 它解决什么问题

你是一个 Noon 卖家（或类似工作场景），手上有 30 个左右的 Gmail 账号，每隔几天还会新增/替换一批。每次要看邮件：

- 打开浏览器
- 登录某个账号
- 看完，退出
- 换下一个账号，重新登录
- ……循环 30 次

效率极低，而且浏览器会话冲突一多还容易被 Google 判定为"异常行为"。

这个软件让你：

1. 打开 App，左边看到所有绑定的账号列表
2. 点哪个就看哪个账号的收件箱
3. 只看邮件（**不能发邮件**，这是故意的，越少权限越安全）
4. 新加 / 删除账号都是一键操作
5. 一切通过 Google 官方的 Gmail API，不是爬网页，不容易触发封控

## 它不做什么

为了保持极简、稳定、少踩坑，以下功能**有意不做**：

- ❌ 发送邮件
- ❌ 跨账号搜索
- ❌ 附件预览
- ❌ 过滤器/标签/已读标记
- ❌ 超过 10 封历史邮件
- ❌ 系统弹窗通知

如果将来需要，再单独讨论加什么。现在不做就是不做。

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Electron（打包成 `.app`） |
| 界面 | React + TypeScript |
| 数据 | better-sqlite3（本地缓存） |
| 凭证 | macOS Keychain（系统钥匙串，不落盘明文） |
| Google 对接 | `googleapis` 官方 Node SDK，Gmail API `readonly` 权限 |

详细理由见 [`docs/tech_stack.md`](docs/tech_stack.md)。

## 怎么用（初次设置）

> ⚠️ 首次使用需要你去 Google Cloud Console 做一次约 10 分钟的配置。文档会一步步带你做，需要截图对着抄。

1. 安装 App（拖到 Applications 文件夹）
2. 第一次打开，按引导去 Google Cloud Console 创建一个"OAuth 凭据"（一次性）
3. 把凭据复制到 App 里
4. 点"添加账号" → 弹出谷歌登录 → 授权 → 完成
5. 重复第 4 步把你剩下的账号加进来
6. 之后正常使用

**注意**：每 7 天，每个账号的授权会自动失效，需要你再点一次那个账号重新登录。这是 Google 的规则，不是我们能绕过的。详见 [`docs/prd.md`](docs/prd.md) 的"约束"章节。

## 文档索引

- [`docs/prd.md`](docs/prd.md) — 产品需求（这东西是给谁做的、要解决什么、不做什么）
- [`docs/app_flow.md`](docs/app_flow.md) — 用户流程（每个操作怎么走）
- [`docs/tech_stack.md`](docs/tech_stack.md) — 技术栈与选型理由
- [`docs/backend_structure.md`](docs/backend_structure.md) — 主进程/后端结构
- [`docs/frontend_guideline.md`](docs/frontend_guideline.md) — 界面规范
- [`docs/implementation_plan.md`](docs/implementation_plan.md) — 分阶段开发计划

## 状态

📋 **规划阶段** — 文档和设计完成，代码尚未开始。
