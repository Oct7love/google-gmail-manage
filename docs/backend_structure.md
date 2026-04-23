# 后端结构（Backend Structure）

> 这里的"后端"指 Electron 的**主进程（main process）** 和 **preload 脚本**——
> 即所有不在浏览器窗口里跑的 Node 侧代码。
> UI 那一层（renderer process）的组织方式看 `frontend_guideline.md`。

---

## 进程模型

```
┌──────────────────┐    IPC    ┌──────────────────┐
│ Renderer Process │ ◄───────► │  Preload Script  │
│ (React UI)       │           │  (contextBridge) │
└──────────────────┘           └──────────────────┘
                                          │
                                          ▼
                               ┌────────────────────┐
                               │  Main Process      │
                               │  (Node.js)         │
                               │  - IMAP 连接         │
                               │  - mailparser 解析  │
                               │  - Keychain         │
                               │  - SQLite           │
                               │  - 定时调度          │
                               │  - Google Translate │
                               └────────────────────┘
```

**安全原则（必须遵守）：**

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: false`（仅因为 preload 要访问 Electron API；Renderer 本身不碰 Node）
- `webviewTag: true`（允许 `<webview>` 内嵌 Google 应用密码页）
- Renderer **不能** 直接 `require`，必须走 IPC

---

## 目录结构

```
src/main/
├── index.ts                 # 入口：创建窗口、注册 IPC、启动调度器
├── ipc/                     # IPC handlers
│   ├── accounts.ts          # 账号添加/更新/移除/列表
│   ├── messages.ts          # 邮件列表/详情/同步
│   ├── refresh.ts           # 全部刷新
│   ├── system.ts            # ping / openExternal
│   └── translation.ts       # 翻译
├── imap/                    # IMAP 封装
│   ├── client.ts            # 连接 imap.gmail.com:993 + 认证
│   ├── fetch-messages.ts    # 一次会话批量拉邮件 + mailparser 解析
│   └── idle-manager.ts      # 每账号持久 IDLE 连接 + 实时推送
├── keychain/
│   └── index.ts             # keytar 薄封装
├── scheduler/
│   └── auto-refresh.ts      # 1h 定时器 + 并发上限 5
├── storage/
│   ├── db.ts                # better-sqlite3 初始化 + schema
│   ├── accounts-repo.ts     # accounts 表 CRUD
│   └── messages-repo.ts     # messages 表 CRUD
├── translation/
│   └── index.ts             # 调 translate.googleapis.com
└── sync.ts                  # 单账号同步逻辑
```

---

## 模块职责

### `main/index.ts`

**职责**：
- 创建 `BrowserWindow`（带 preload、webview 权限、hiddenInset 标题栏）
- 注册所有 IPC handlers
- 初始化 SQLite（懒加载，第一次 getDb 时建表）
- 启动自动刷新定时器
- 处理窗口生命周期
- 按 ⌘⌥I 打开 DevTools（开发和生产都支持）

---

### `main/imap/client.ts`

```ts
openImap(email: string, password?: string): Promise<ImapFlow>
verifyCredentials(email: string, password: string): Promise<{ok: true} | {ok: false; error: string}>
```

- `imapflow` 连接 `imap.gmail.com:993`（TLS）
- 超时：connectionTimeout 10s / greetingTimeout 10s / socketTimeout 30s
- 认证失败 → `AuthError`
- 未配置密码 → `NoPasswordError`
- 调用方负责 `logout()`

---

### `main/imap/fetch-messages.ts`

```ts
fetchLatestMessages(email: string, max: number): Promise<MessageDetail[]>
```

**策略**：
1. 开一个 IMAP 连接 + 获取 INBOX 锁
2. `status()` 拿邮件总数，反推最后 N 个序号范围
3. `fetch(range, { uid, envelope, internalDate, bodyStructure, source })` 一次拉 N 封
4. **释放 IMAP 锁**（CPU 密集的 mailparser 解析放锁外，省连接时间）
5. 对每封 `mailparser.simpleParser(raw.source)` 得到 `parsed`
6. 解析 `parsed.from/.subject/.date/.html/.text`
7. **inline cid: 图片** → 从 `parsed.attachments` 找对应 contentId → 替换成 `data:...` URL
8. 按 `dateTs` 倒序排序
9. 返回 `MessageDetail[]`

---

### `main/storage/db.ts`

- 路径：`app.getPath('userData') + '/mailviewer.db'`
- WAL 模式 + foreign_keys=ON
- 启动时执行 migration

**Schema**：
```sql
CREATE TABLE accounts (
  email TEXT PRIMARY KEY,
  display_order INTEGER NOT NULL DEFAULT 0,
  added_at INTEGER NOT NULL,
  last_synced_at INTEGER,
  last_sync_status TEXT,    -- 'ok' | 'expired' | 'error'
  last_sync_error TEXT
);

CREATE TABLE messages (
  account_email TEXT NOT NULL,
  message_id TEXT NOT NULL,    -- IMAP UID
  thread_id TEXT,              -- 暂不使用
  subject TEXT,
  from_addr TEXT,
  date_ts INTEGER,
  snippet TEXT,
  body_html TEXT,
  body_text TEXT,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (account_email, message_id),
  FOREIGN KEY (account_email) REFERENCES accounts(email) ON DELETE CASCADE
);

CREATE INDEX idx_messages_date ON messages(account_email, date_ts DESC);
```

**注意**：应用密码**不存这里**，存 Keychain。

---

### `main/keychain/index.ts`

```ts
getPassword(email: string): Promise<string | null>
setPassword(email: string, password: string): Promise<void>
deletePassword(email: string): Promise<void>
```

- service: `MailViewer-imap-passwords`
- account: 用户 Gmail 地址
- 值：16 位应用密码（空格会在 IMAP 连接前去掉）

---

### `main/scheduler/auto-refresh.ts`

```ts
startAutoRefresh(intervalMs?: number): void
stopAutoRefresh(): void
refreshAll(): Promise<SyncResult[]>
```

- 默认间隔 1 小时（IDLE 漏推的兜底）
- `refreshAll` 使用自写的 `runWithConcurrency(emails, 5, syncAccount)`（p-limit v7 ESM-only 和 Electron CJS 不兼容，自写 10 行代替）
- 进度通过 `BrowserWindow.webContents.send('refresh:progress', event)` 推给 renderer

---

### `main/imap/idle-manager.ts`（实时推送核心）

```ts
startIdleFor(email: string): Promise<void>
stopIdleFor(email: string): Promise<void>
restartIdleFor(email: string): Promise<void>
startAllIdle(): void
stopAllIdle(): Promise<void>
reconnectAll(): void   // 电脑唤醒时调用
```

**工作原理**：
- 每个账号维护一个 `IdleSession`：包含持久 ImapFlow 客户端、重连状态、同步防抖 timer
- `buildClient` 用 Keychain 密码创建 ImapFlow，`logger: false` 静音（连接多，噪声大）
- `openSession`：`client.connect()` → `mailboxOpen('INBOX')` → imapflow 自动进入 IDLE
- `exists` 事件 → `triggerSync`（1.5s 防抖）→ `syncAccount` → broadcast `{ phase, newCount }`

**错误 & 重连**：
- `close` 事件（网络断 / 服务器踢 / 睡眠） → 指数退避（`RECONNECT_BACKOFF_MS`）
- `AUTHENTICATIONFAILED` → 标 `expired`，`session.active = false`，不再自动重试
- `buildClient` 返回 null（无密码） → 标 `expired`

**启动节奏**：
- `startAllIdle` 错峰 250ms 逐一启动，避免 30 个连接同时爆发
- 连接成功后立即 `triggerSync` 一次，捕获"连接前积压的邮件"

**与 `main/index.ts` 的集成**：
- `app.whenReady` → `startAllIdle()`
- `powerMonitor.on('resume')` → `reconnectAll()`（Mac 唤醒）
- `app.on('before-quit')` → `await stopAllIdle()`

**与 `main/ipc/accounts.ts` 的集成**：
- `accounts:add` 成功后 → `startIdleFor(email)`
- `accounts:updatePassword` 成功后 → `restartIdleFor(email)`
- `accounts:remove` 前 → `stopIdleFor(email)`

---

### `main/sync.ts`

```ts
syncAccount(email: string, max = MESSAGES_PER_ACCOUNT): Promise<SyncResult>
```

- 一次 IMAP 会话拉最近 N 封（调 `fetchLatestMessages`）
- 每封做差集：本地没有的才算"fetched"
- `upsertMessage` 写入 SQLite（已有 UID 覆盖，保证字段最新）
- 更新 `accounts.last_sync_status` 和 `last_sync_error`
- 错误分类：
  - `IMAPExpiredError` → `status: 'expired'`
  - 其他 → `status: 'error'`

---

### `main/translation/index.ts`

```ts
translateToChinese(text: string): Promise<string>
```

**流程**：
1. `preprocessText` 清理：
   - markdown link `[text](url)` → `text`
   - markdown image `![alt](url)` → 删
   - 裸 URL / `<url>` / `(url)` → 删
   - `[image: X]` / `[cid: X]` → 删
   - 零宽字符 → 删
   - 装饰线（`-===_~·` 纯符号行）→ 删
   - 散落的 `[` 或 `]` → 删
   - 归一化多余空白
2. 按 `\n\n` 拆段落
3. 每段调 `translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=...`
4. 单段超 4500 字硬切
5. 用 `\n\n` 拼回

---

### `main/ipc/*`

每个文件注册该领域的 `ipcMain.handle`。统一错误包装格式：

```ts
{ ok: true, ...data } | { ok: false, error: string, code?: string }
```

所有 IPC channel 名字在 `src/shared/ipc-channels.ts` 里集中定义。

---

## preload（`src/preload/index.ts`）

- 通过 `contextBridge.exposeInMainWorld('api', {...})` 暴露白名单 API
- **只是 IPC 转发**，不含业务逻辑
- 敏感值（应用密码）**不通过 IPC 暴露给 renderer**——renderer 只看到 `{ configured: boolean }` 这种状态

---

## 错误处理约定

- **IMAP 层** 把 `AUTHENTICATIONFAILED` 识别为 `AuthError`，上层转 `IMAPExpiredError`
- **业务层** 转成 `SyncResult` 返回给 IPC
- **IPC 层** 捕获所有未处理异常，转成 `{ ok: false, error }` 返回
- **UI 层** 按错误类型展示：弹 `dialog.showErrorBox` / 账号图标变色 / 翻译面板红条

---

## 跨平台差异

| 点 | Mac | Windows |
|---|---|---|
| Keychain | macOS Keychain | Windows Credential Manager |
| userData 路径 | `~/Library/Application Support/mail-viewer` | `%APPDATA%\mail-viewer` |
| 标题栏 | hiddenInset（交通灯留出 80px） | 默认 Windows 样式（忽略 hiddenInset） |
| 系统浏览器 | `open <url>` | `start <url>` |

这些都由 Electron / keytar / Node 自动处理，代码无需分支。
