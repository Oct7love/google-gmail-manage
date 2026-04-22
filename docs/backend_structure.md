# 后端结构（Backend Structure）

> 这里的"后端"指 Electron 的**主进程（main process）** 和 **preload 脚本**——
> 即所有不在浏览器窗口里跑的 Node 侧代码。
> UI 那一层（renderer process）的组织方式看 `frontend_guideline.md`。

---

## 进程模型

Electron 有三种进程：

```
┌──────────────────┐    IPC    ┌──────────────────┐
│ Renderer Process │ ◄───────► │  Preload Script  │
│ (React UI)       │           │  (安全桥)        │
└──────────────────┘           └──────────────────┘
                                          │
                                          ▼ contextBridge
                               ┌────────────────────┐
                               │  Main Process      │
                               │  (Node.js 后端)    │
                               │  - OAuth           │
                               │  - Gmail API       │
                               │  - SQLite          │
                               │  - Keychain        │
                               └────────────────────┘
```

**安全原则（必须遵守）：**

- `nodeIntegration: false`
- `contextIsolation: true`
- Renderer **不能** 直接调 `require`、不能直接读文件系统、不能直接访问 Keychain
- 所有敏感操作走 IPC → Main

---

## 目录结构

```
src/
├── main/                          # 主进程
│   ├── index.ts                   # 入口：创建窗口、注册 IPC
│   ├── ipc/                       # IPC 处理器，按领域拆分
│   │   ├── accounts.ts            # 账号增删改查
│   │   ├── messages.ts            # 邮件列表 / 正文
│   │   ├── refresh.ts             # 刷新逻辑
│   │   ├── oauth.ts               # OAuth 流程
│   │   └── credentials.ts         # Google Cloud 凭据管理
│   ├── gmail/                     # Gmail API 封装
│   │   ├── client.ts              # 创建 OAuth2 + gmail client
│   │   ├── fetch-messages.ts      # 拉邮件列表 / 正文
│   │   └── revoke.ts              # 撤销 token
│   ├── oauth/                     # OAuth 流程
│   │   ├── loopback-server.ts     # 本地 loopback HTTP server
│   │   ├── flow.ts                # 完整 OAuth 授权流程
│   │   └── tokens.ts              # token 读写 Keychain
│   ├── storage/
│   │   ├── db.ts                  # better-sqlite3 初始化 + 迁移
│   │   ├── accounts-repo.ts       # accounts 表 CRUD
│   │   └── messages-repo.ts       # messages 表 CRUD
│   ├── keychain/
│   │   └── index.ts               # keytar 薄封装
│   ├── scheduler/
│   │   └── auto-refresh.ts        # 1 小时定时刷新
│   ├── config/
│   │   └── paths.ts               # userData 路径等
│   └── types.ts                   # Main 侧共用类型
│
├── preload/
│   └── index.ts                   # contextBridge 暴露的 API 白名单
│
└── renderer/                      # React UI，见 frontend_guideline.md
    └── ...
```

---

## 模块职责

### 1. `main/index.ts` — 入口

**职责：**

- 创建 BrowserWindow（带 preload 脚本）
- 注册所有 IPC 处理器（从 `ipc/*.ts` 汇总）
- 初始化 SQLite 数据库（建表 / 迁移）
- 启动自动刷新调度器
- 处理窗口生命周期

**不做什么：**

- 不直接写业务逻辑；业务都在 `gmail/`、`oauth/`、`storage/` 等模块里

---

### 2. `main/oauth/` — OAuth 授权

#### `loopback-server.ts`

职责：启动一个临时 HTTP server，监听系统分配的端口，接收 Google 重定向回来的 `?code=...`。

关键点：
- 用 Node 内建 `http` 模块，**不要引 Express**
- 端口动态分配（`server.listen(0)` 让系统选）
- 超时 60 秒自动关闭
- 返回给浏览器一个简单 HTML："授权成功，可以关闭此窗口回到 App"

#### `flow.ts`

职责：编排完整 OAuth 流程。

```
async function authorize(email?: string): Promise<{ email: string; refreshToken: string; accessToken: string }>
```

流程：
1. 从 Keychain 读 Client ID/Secret
2. 启动 loopback server
3. 构造 authorize URL（带 `access_type=offline`、`prompt=consent`）
4. `shell.openExternal(url)` 调系统浏览器
5. `await` loopback server 的 `code`
6. POST 到 Google token endpoint 换 `refresh_token` + `access_token`
7. 调 `gmail.users.getProfile` 拿 emailAddress
8. 关闭 loopback server
9. 返回三元组

#### `tokens.ts`

职责：`refresh_token` / `access_token` 读写 Keychain。

```
getRefreshToken(email: string): Promise<string | null>
setTokens(email: string, refresh: string, access: string, expiry: number): Promise<void>
deleteTokens(email: string): Promise<void>
```

实现：Keychain 的 service 用固定值 `"MailViewer-gmail"`，account 用 email 地址。

---

### 3. `main/gmail/` — Gmail API 封装

#### `client.ts`

```
function getGmailClient(email: string): Promise<gmail_v1.Gmail>
```

流程：
1. 从 Keychain 拿该 email 的 refresh / access token
2. 从 Keychain 拿 Client ID / Secret
3. 创建 `google.auth.OAuth2` 实例
4. setCredentials({ refresh_token, access_token, expiry_date })
5. 监听 `tokens` 事件，拿到新 token 自动更新 Keychain
6. 返回 `google.gmail({ version: 'v1', auth })`

**失败处理**：若 refresh 返回 `invalid_grant`，抛出 `TokenExpiredError` 让上层标记该账号过期。

#### `fetch-messages.ts`

两个函数：

```
listLatestMessageIds(email: string, max: number = 10): Promise<string[]>
fetchMessageDetail(email: string, messageId: string): Promise<MessageDetail>
```

实现：
- `users.messages.list` 用 `q='in:inbox'` + `maxResults=max`
- `users.messages.get` 用 `format='full'` 拿完整 payload
- 解析 payload：
  - 取 `subject`、`from`、`date` 从 headers
  - 正文优先 `text/html`，fallback 到 `text/plain`
  - base64url decode

#### `revoke.ts`

```
async function revokeToken(refreshToken: string): Promise<void>
```

实现：POST 到 `https://oauth2.googleapis.com/revoke?token=<token>`，忽略网络失败（因为删除账号时即使 revoke 失败也要继续清本地数据）。

---

### 4. `main/storage/` — SQLite 持久化

#### `db.ts`

- 数据库文件：`app.getPath('userData') + '/mailviewer.db'`
- 启动时执行迁移（见下方 Schema）
- 暴露全局 `db: Database` 实例

#### Schema

```sql
-- accounts 表：记录已绑定的账号
CREATE TABLE accounts (
  email TEXT PRIMARY KEY,
  display_order INTEGER NOT NULL DEFAULT 0,
  added_at INTEGER NOT NULL,
  last_synced_at INTEGER,
  last_sync_status TEXT,         -- 'ok' | 'expired' | 'error'
  last_sync_error TEXT
);

-- messages 表：缓存每个账号最近 N 封邮件
CREATE TABLE messages (
  account_email TEXT NOT NULL,
  message_id TEXT NOT NULL,       -- Gmail 的 message id
  thread_id TEXT,
  subject TEXT,
  from_addr TEXT,
  date_ts INTEGER,                -- unix 秒
  snippet TEXT,
  body_html TEXT,
  body_text TEXT,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (account_email, message_id),
  FOREIGN KEY (account_email) REFERENCES accounts(email) ON DELETE CASCADE
);

CREATE INDEX idx_messages_date ON messages(account_email, date_ts DESC);
```

**注意**：`refresh_token` / `access_token` **不存这里**，存 Keychain。Client Secret 也是。

#### `accounts-repo.ts` / `messages-repo.ts`

封装 SQL 操作。只导出业务语义函数：

```ts
// accounts-repo.ts
listAccounts(): AccountRow[]
insertAccount(email: string): void
updateSyncStatus(email: string, status: 'ok' | 'expired' | 'error', error?: string): void
deleteAccount(email: string): void

// messages-repo.ts
getLatestMessages(email: string, limit: number): MessageRow[]
upsertMessage(msg: MessageRow): void
deleteAllForAccount(email: string): void
```

---

### 5. `main/keychain/index.ts`

`keytar` 薄封装，所有调用走这里：

```ts
const SERVICE_TOKENS = 'MailViewer-gmail-tokens';
const SERVICE_CREDS  = 'MailViewer-gmail-credentials';

getTokens(email: string): Promise<Tokens | null>
setTokens(email: string, tokens: Tokens): Promise<void>
deleteTokens(email: string): Promise<void>

getCredentials(): Promise<{ clientId: string; clientSecret: string } | null>
setCredentials(clientId: string, clientSecret: string): Promise<void>
```

---

### 6. `main/scheduler/auto-refresh.ts`

```ts
startAutoRefresh(intervalMs: number = 60 * 60 * 1000): void
stopAutoRefresh(): void
triggerRefreshAll(): Promise<RefreshReport>   // 手动全部刷新也走这里
```

实现：
- `setInterval` 触发
- 调 `accounts-repo.listAccounts()`
- 用 `p-limit`（并发 5）并行刷新每个账号
- 单个账号刷新 = 拉最新 10 个 messageIds → 差集 → 只拉新消息的 detail → upsert DB
- 刷新结果通过 IPC `send` 通知 renderer 更新未读数
- 遇到 `TokenExpiredError` → `updateSyncStatus(email, 'expired')` → 跳过
- 遇到 429 → 退避重试最多 3 次（1s / 4s / 16s）

---

### 7. `main/ipc/` — IPC 处理器

每个文件注册该领域的 `ipcMain.handle`。统一格式：

```ts
// ipc/accounts.ts
import { ipcMain } from 'electron';
import * as repo from '../storage/accounts-repo';
import * as keychain from '../keychain';
import { authorize } from '../oauth/flow';
import { revokeToken } from '../gmail/revoke';

ipcMain.handle('accounts:list', () => repo.listAccounts());

ipcMain.handle('accounts:add', async () => {
  const result = await authorize();
  repo.insertAccount(result.email);
  await keychain.setTokens(result.email, { ... });
  return result.email;
});

ipcMain.handle('accounts:remove', async (_e, email: string) => {
  const tokens = await keychain.getTokens(email);
  if (tokens) await revokeToken(tokens.refreshToken).catch(() => {});
  await keychain.deleteTokens(email);
  repo.deleteAccount(email);   // ON DELETE CASCADE 删除 messages
});

// ...
```

所有 IPC channel 名字在 `src/shared/ipc-channels.ts` 里集中定义，preload 和 renderer 共用。

---

### 8. `preload/index.ts`

```ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  accounts: {
    list:   () => ipcRenderer.invoke('accounts:list'),
    add:    () => ipcRenderer.invoke('accounts:add'),
    remove: (email: string) => ipcRenderer.invoke('accounts:remove', email),
    reauth: (email: string) => ipcRenderer.invoke('accounts:reauth', email),
  },
  messages: {
    list: (email: string, limit: number) => ipcRenderer.invoke('messages:list', email, limit),
    detail: (email: string, id: string)  => ipcRenderer.invoke('messages:detail', email, id),
  },
  refresh: {
    one: (email: string) => ipcRenderer.invoke('refresh:one', email),
    all: ()               => ipcRenderer.invoke('refresh:all'),
    onProgress: (cb: (evt: RefreshEvent) => void) =>
      ipcRenderer.on('refresh:progress', (_e, evt) => cb(evt)),
  },
  credentials: {
    get: () => ipcRenderer.invoke('credentials:get'),   // 只返回是否已配置，不返回值
    set: (clientId: string, clientSecret: string) =>
      ipcRenderer.invoke('credentials:set', clientId, clientSecret),
    clear: () => ipcRenderer.invoke('credentials:clear'),
  },
});
```

**关键**：preload **只是 IPC 转发**，不含业务逻辑。Client Secret、refresh token 这类敏感值**绝对不** 通过 IPC 传给 renderer——只暴露"是否已配置"、"是否已授权"这种布尔状态。

---

## 错误处理约定

主进程抛错的层级：

1. **底层**（HTTP 调用、DB 操作）抛原生 Error
2. **业务层**（`gmail/`、`oauth/`）转成带类型标签的 error：
   ```ts
   class TokenExpiredError extends Error { code = 'TOKEN_EXPIRED' }
   class RateLimitError    extends Error { code = 'RATE_LIMIT' }
   class NetworkError      extends Error { code = 'NETWORK' }
   ```
3. **IPC 层** 捕获所有错误，转成 `{ ok: false, code, message }` 返回给 renderer
4. **UI 层** 根据 `code` 决定是弹窗、是标图标、还是静默

---

## 日志

- 用 `electron-log`，文件路径 `userData/logs/main.log`
- 级别：默认 info，开发模式 debug
- 记录：所有 API 调用（email + endpoint + 耗时）、所有错误
- **不记录**：token、Client Secret、邮件正文

日志仅用于排查问题，菜单栏 → "帮助" → "打开日志目录" 让用户能自己翻出来。

---

## 安全审查要点

写代码时必守：

- [ ] `BrowserWindow` 的 `webPreferences.contextIsolation: true`、`nodeIntegration: false`
- [ ] preload 脚本只暴露白名单 API
- [ ] 外部链接一律 `shell.openExternal`，不在 App 内打开
- [ ] 邮件 HTML 渲染必须在沙盒 iframe 里，禁用 JS、禁用外部资源加载
- [ ] Keychain 里的值从不 console.log
- [ ] 未来任何 "打开 devtools" 的代码要用环境变量 gate，生产构建禁用
