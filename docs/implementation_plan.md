# 分阶段实现计划（Implementation Plan）

> 不是"功能列表"，是"一步步怎么从空仓库走到能双击打开的 `.app`"。
> 每个阶段有**明确的验收标准**——做完了能眼见为实的那种。
> 顺序可微调，但阶段之间的依赖不能跳。

---

## 总览

```
P0 搭架子 ──► P1 SQLite + 类型 ──► P2 Keychain + 凭据引导
                                        │
                                        ▼
P5 打包分发 ◄─ P4 UI 正栏 ◄─ P3 OAuth + 首个账号 ◄─────┘
       ▲
       │
       └── P3.5 自动刷新 + 7 天过期处理（与 P4 并行）
```

---

## P0：项目脚手架 🏗️（半天）

**目标**：能 `pnpm dev` 打开一个空 Electron 窗口，显示 "Hello"。

**任务**：
- [ ] `pnpm init` + 安装 electron、electron-vite、react、typescript、tailwind、zustand
- [ ] 配 `electron.vite.config.ts`：main / preload / renderer 三个入口
- [ ] 写最小 `main/index.ts`：创建 BrowserWindow，加载 renderer
- [ ] 写最小 `preload/index.ts`：用 contextBridge 暴露一个 `api.ping()`
- [ ] 写最小 `renderer/App.tsx`：显示 "Hello"，调用 `window.api.ping()` 确认 IPC 通
- [ ] `.gitignore`、ESLint、Prettier
- [ ] 配置 Tailwind，Hello 字是蓝色的

**验收**：
- `pnpm dev` 窗口打开
- DevTools Console 里 ping 返回 pong
- 按 ⌘Q 正常退出

**不做**：没有数据库、没有真功能。就是架子。

---

## P1：SQLite + 共享类型 🗄️（半天）

**目标**：本地数据库就绪，能增删查改。

**任务**：
- [ ] 安装 `better-sqlite3`（注意 Electron 原生模块要用 `electron-rebuild` 或 `@electron-forge/plugin-webpack` 处理，简化方案：用 `electron-builder` 的 `buildDependenciesFromSource`）
- [ ] `main/storage/db.ts`：初始化数据库、执行 schema migration
- [ ] `main/storage/accounts-repo.ts`、`messages-repo.ts`：按 `backend_structure.md` 第 4 节的接口实现
- [ ] `src/shared/types.ts`：`Account`、`MessageSummary`、`MessageDetail`、`Tokens`、`SyncStatus` 等类型
- [ ] `src/shared/ipc-channels.ts`：所有 IPC channel 名常量
- [ ] 单元测试：对 accounts-repo 和 messages-repo 各写 1–2 个 Vitest 用例

**验收**：
- `pnpm test` 全绿
- 手动在 main 进程里插入一条 account，重启 App 能查到

**不做**：UI 不变，还是 Hello。

---

## P2：Keychain + Google Cloud 凭据引导 🔐（1 天）

**目标**：用户能完成首次凭据配置，凭据存 Keychain。

**任务**：
- [ ] 安装 `keytar`
- [ ] `main/keychain/index.ts`：按 `backend_structure.md` 第 5 节实现
- [ ] `main/ipc/credentials.ts`：暴露 `credentials:get / set / clear`
- [ ] `renderer/components/SetupWizard.tsx`：6 步向导，每步一页
  - 每步准备一张参考截图（从 Google Cloud Console 实际截）放 `renderer/assets/setup/`
  - 最后一步包含 Client ID、Client Secret 输入框 + JSON 导入按钮
- [ ] `renderer/App.tsx` 启动时调 `credentials:get`，未配置时展示 SetupWizard
- [ ] 凭据基础格式校验：`clientId.endsWith('.apps.googleusercontent.com')`

**验收**：
- 第一次启动显示向导
- 填入真实凭据后进入空状态（下一阶段准备的）
- 重启 App 不再显示向导
- 在 macOS "钥匙串访问"里能看到 `MailViewer-gmail-credentials` 条目

**不做**：还不能加账号。

---

## P3：OAuth 流程 + 添加第一个账号 🔓（2 天）

**目标**：点"添加账号"能跑完完整 OAuth，邮件拉下来存进 DB。

**任务**：
- [ ] `main/oauth/loopback-server.ts`：按文档实现
- [ ] `main/oauth/flow.ts`：完整 authorize 流程
- [ ] `main/oauth/tokens.ts`：token 读写 Keychain
- [ ] `main/gmail/client.ts`：创建 authenticated gmail client，监听 tokens 事件
- [ ] `main/gmail/fetch-messages.ts`：list + get 邮件
- [ ] `main/ipc/accounts.ts`：`accounts:add`、`accounts:list`、`accounts:remove`、`accounts:reauth`
- [ ] `main/ipc/messages.ts`：`messages:list`、`messages:detail`
- [ ] 渲染层先做最朴素版：一个 "添加账号" 按钮 + 一个 `<select>` 选账号 + 一个 `<pre>` 显示拉到的邮件 JSON
- [ ] 手工测完整流程：添加 → 看到 JSON → 删除 → revoke 生效

**验收**：
- 用一个真实 Gmail 账号走完授权，拉到最近 10 封的 subject
- `accounts:remove` 后去 https://myaccount.google.com/permissions 确认应用被撤销
- 再次添加同一个账号能正确触发"已存在，是否重新授权"流程

**不做**：UI 还很丑，下个阶段美化。

---

## P3.5：自动刷新 + 7 天过期处理 ⏰（1 天，可和 P4 并行）

**目标**：后台自动刷新不靠点按钮，过期账号有视觉反馈。

**任务**：
- [ ] `main/scheduler/auto-refresh.ts`：setInterval + p-limit 并发 5
- [ ] 捕获 `invalid_grant`，转成 `TokenExpiredError`
- [ ] 捕获 429，指数退避
- [ ] 更新 `accounts.last_sync_status` / `last_sync_error`
- [ ] IPC `refresh:progress` 广播给 renderer
- [ ] `main/ipc/refresh.ts`：`refresh:one`、`refresh:all`
- [ ] 写测试：模拟 `invalid_grant` 返回，验证账号被标 expired

**验收**：
- 留 App 开着 1 小时（或临时把间隔调到 1 分钟），日志里能看到自动刷新日志
- 手动把某账号的 refresh token 改乱，下一次刷新该账号在 DB 里是 expired 状态
- 429 场景用 mock 验证退避逻辑

**不做**：不做 UI 层的 ⚠️ 图标（放 P4）。

---

## P4：完整三栏 UI 🎨（2–3 天）

**目标**：界面变成最终产品样子，Mac HIG 风格。

**任务**：按 `frontend_guideline.md` 逐个组件实现：
- [ ] `LeftColumn` + `AccountList` + `AccountItem`（含状态点、未读徽章、"⋯" 菜单）
- [ ] `MiddleColumn` + `MessageList` + `MessageRow` + `LoadMoreButton`
- [ ] `RightColumn` + `MessageDetail` + `MessageHeader` + `MessageBody`（sandboxed iframe）
- [ ] `EmptyState`
- [ ] 过期账号的 ⚠️ 图标 + 重新授权对话框
- [ ] 键盘快捷键
- [ ] 深色模式跟随系统
- [ ] 外部链接点击拦截 + 确认对话框
- [ ] Titlebar 用 `hiddenInset`

**验收**：
- 添加 3 个真实账号，界面和 `frontend_guideline.md` 描述一致
- 邮件正文的链接点击有拦截
- 邮件里的外部图片默认不加载，点"显示图片"后才加载
- ⌘R 刷新当前账号，有 loading 状态
- 深色模式下所有文本对比度正常

**不做**：不做测试套件（只写几个关键的），不做国际化。

---

## P5：打包分发 📦（半天）

**目标**：产出一个能双击打开的 `.app`，放到 Applications 里能用。

**任务**：
- [ ] 配 `electron-builder.yml`
- [ ] 应用图标：设计或用 AI 生成一个 1024×1024 的 icns
- [ ] `Info.plist`：bundle id、版本号、最低 macOS 版本
- [ ] `pnpm build` 出 `.app` 和 `.dmg`
- [ ] 在一台未装过 node 的 Mac 上测试双击 `.dmg` 拖进 Applications → 打开
- [ ] 第一次打开因为未签名会被 Gatekeeper 拦，写入 README 的"首次启动"说明
- [ ] 写 CHANGELOG.md v1.0.0

**验收**：
- `.dmg` 能拖进 Applications
- 首次启动（右键打开）能通过
- 整个产品流程跑通：向导 → 添加 2 个账号 → 看邮件 → 删 1 个账号 → 重启还在

**不做**：不做自动更新（Sparkle / electron-updater），v1 手动下载新版替换即可。

---

## 何时交给用户验收

每个 Phase 末尾，**跑一次端到端流程**给用户看：

| Phase | 演示什么 |
|---|---|
| P0 | 空窗口打开、关闭 |
| P1 | 跳过（内部阶段） |
| P2 | 向导能跑完，凭据能保存 |
| P3 | 添加真实账号拉到邮件（JSON） |
| P3.5 | 过期处理（可快进间隔） |
| P4 | 完整 UI，所有交互 |
| P5 | `.dmg` 拖装使用 |

用户是非开发者，演示方式统一为：
- 录一段 30 秒屏幕录像 / GIF
- 说明这一步做到了什么、跟 PRD 里哪一条对应
- 等待用户确认后进入下一阶段

---

## 每个阶段开工前必做的三件事

1. **重读一次 PRD 对应条款** — 确认没偏题
2. **画一下这阶段会改的文件列表** — 控制爆炸半径
3. **先写类型 / 接口** — 类型先行，实现后填

每个阶段结束必做：

1. **跑 `pnpm build`** —— 生产打包不能坏
2. **手动验收端到端** —— 不是"单元测试过了" 就算过
3. **更新 CHANGELOG** —— 写了什么、改了什么

---

## 风险回顾（从 PRD 里复制过来提醒）

每个阶段结束问自己：

- 用户拒绝过的功能，有没有偷偷加进去？
- 有没有在 renderer 里直接调 Gmail？
- token、client secret 有没有落盘明文？
- 自动刷新的间隔是否 ≥ 1 小时？
- 遇到过期账号是不是停下等用户，而不是反复重试？

任何一条答错，停下修。

---

## 不在此计划内的事

明确不做的后续工作：

- Windows / Linux 版
- 代码签名 + 公证（需要 Apple Developer 账号）
- 应用自动更新
- 多用户 / 云同步
- 任何 PRD 非目标里的功能

做完 P5 就算 v1.0 完结。再开新东西之前先回 PRD 重新讨论。
