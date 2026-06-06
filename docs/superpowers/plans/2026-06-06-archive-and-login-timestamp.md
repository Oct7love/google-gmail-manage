# 账号归档 + 上号时间 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给每个 Gmail 账号加"归档"状态（归档=断持久 IMAP 连接、不自动收信但可手动刷新、缓存只读可看）和一个手动"上号时间"时间戳，归档账号在左栏单独 tab 展示。

**Architecture:** 在 `accounts` 表加 `archived` / `started_at` 两列；主进程的 IDLE 启动与自动轮询过滤掉归档账号，单账号手动刷新不受限；渲染端左栏用「在用 / 归档」两 tab 按 `archived` 过滤，⋯ 菜单加归档与记录上号时间动作，凭据抽屉可编辑上号时间。

**Tech Stack:** Electron 主进程 + better-sqlite3 + imapflow（IDLE）；React 18 + Tailwind 语义 token + zustand + lucide-react。

**测试说明：** 本项目无单元测试框架。每个 Task 的验证门是 `pnpm typecheck && pnpm build`；主进程改动需重启 App 做运行期手动验证（见末尾清单）。提交粒度：每个 Task 一次 commit。

---

### Task 1: 数据模型 + DB 迁移

**Files:**
- Modify: `src/shared/types.ts`（`Account` 接口）
- Modify: `src/main/storage/db.ts:migrate`

- [ ] **Step 1: `Account` 加两字段**

在 `src/shared/types.ts` 的 `Account` 接口里，`mark` 字段下方追加：

```typescript
  /** 用户业务标记：已退款 / 有警告 / 未标记 */
  mark: AccountMark | null;
  /** 是否归档（归档=断持久连接、不自动收信，但可手动刷新、缓存只读可看） */
  archived: boolean;
  /** 手动记录的"上号时间"，毫秒时间戳，null=未填 */
  startedAt: number | null;
```

（即在现有 `mark: AccountMark | null;` 后面加 `archived` 和 `startedAt` 两行。）

- [ ] **Step 2: 迁移加两列**

在 `src/main/storage/db.ts` 的 `migrate()` 末尾，现有这一行下面追加两行：

```typescript
  // 增量迁移：给老库补列（CREATE TABLE IF NOT EXISTS 不会给已存在的表加列）
  addColumnIfMissing(db, 'accounts', 'mark', 'TEXT');
  addColumnIfMissing(db, 'accounts', 'archived', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing(db, 'accounts', 'started_at', 'INTEGER');
```

- [ ] **Step 3: 验证 typecheck**

Run: `pnpm typecheck`
Expected: 报错——`accounts-repo.ts` 的 `rowToAccount` 缺 `archived`/`startedAt`（Task 2 会补）。这是预期的中间态，继续 Task 2。

---

### Task 2: 存储层 accounts-repo

**Files:**
- Modify: `src/main/storage/accounts-repo.ts`

- [ ] **Step 1: AccountRow 加两列**

把 `interface AccountRow` 改为（在 `mark` 后加两行）：

```typescript
interface AccountRow {
  email: string;
  display_order: number;
  added_at: number;
  last_synced_at: number | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  mark: string | null;
  archived: number;
  started_at: number | null;
}
```

- [ ] **Step 2: rowToAccount 映射两字段**

把 `rowToAccount` 的 return 改为（在 `mark` 后加两行）：

```typescript
function rowToAccount(r: AccountRow): Account {
  return {
    email: r.email,
    displayOrder: r.display_order,
    addedAt: r.added_at,
    lastSyncedAt: r.last_synced_at,
    lastSyncStatus: r.last_sync_status as SyncStatus | null,
    lastSyncError: r.last_sync_error,
    mark: (r.mark as AccountMark | null) ?? null,
    archived: r.archived === 1,
    startedAt: r.started_at,
  };
}
```

- [ ] **Step 3: 两个 SELECT 加列**

把 `listAccounts` 和 `getAccount` 里两处 SELECT 的列清单从
`..., last_sync_error, mark` 改为 `..., last_sync_error, mark, archived, started_at`：

```typescript
// listAccounts 内：
      `SELECT email, display_order, added_at, last_synced_at, last_sync_status, last_sync_error, mark, archived, started_at
       FROM accounts
       ORDER BY display_order ASC, added_at ASC`,

// getAccount 内：
      `SELECT email, display_order, added_at, last_synced_at, last_sync_status, last_sync_error, mark, archived, started_at
       FROM accounts WHERE email = ?`,
```

- [ ] **Step 4: 加 setArchived / setStartedAt**

在 `setMark` 函数下方追加：

```typescript
/** 设置/取消归档。 */
export function setArchived(
  email: string,
  archived: boolean,
  db: Database.Database = getDb(),
): void {
  db.prepare(`UPDATE accounts SET archived = ? WHERE email = ?`).run(archived ? 1 : 0, email);
}

/** 设置/清除手动"上号时间"（ts=null 表示清除）。 */
export function setStartedAt(
  email: string,
  ts: number | null,
  db: Database.Database = getDb(),
): void {
  db.prepare(`UPDATE accounts SET started_at = ? WHERE email = ?`).run(ts, email);
}
```

- [ ] **Step 5: 验证 + 提交**

Run: `pnpm typecheck && pnpm build`
Expected: PASS（types + repo 自洽）

```bash
git add src/shared/types.ts src/main/storage/db.ts src/main/storage/accounts-repo.ts
git commit -m "feat(archive): Account 加 archived/startedAt 字段 + DB 迁移 + repo 读写"
```

---

### Task 3: 主进程冻结语义（IDLE + 自动轮询过滤归档）

**Files:**
- Modify: `src/main/imap/idle-manager.ts:startAllIdle`
- Modify: `src/main/scheduler/auto-refresh.ts:refreshAll`

- [ ] **Step 1: startAllIdle 跳过归档**

把 `startAllIdle` 里的 `const accounts = accountsRepo.listAccounts();` 改为：

```typescript
export function startAllIdle(): void {
  // 归档账号不维持持久 IDLE 连接（腾出连接名额、不自动收信）
  const accounts = accountsRepo.listAccounts().filter((a) => !a.archived);
  accounts.forEach((a, i) => {
    setTimeout(() => {
      void startIdleFor(a.email);
    }, i * STAGGER_MS);
  });
  // 启动健康检查：每 10 分钟扫一次，拉起死掉的 session（防 close 事件漏派）
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  healthCheckTimer = setInterval(healthCheck, HEALTH_CHECK_INTERVAL_MS);
}
```

- [ ] **Step 2: refreshAll 跳过归档**

把 `src/main/scheduler/auto-refresh.ts` 的 `refreshAll` 里
`const emails = accountsRepo.listAccounts().map((a) => a.email);` 改为：

```typescript
  // 归档账号不进自动轮询 / "全部刷新"（仅手动单账号刷新可触达，见 messages:sync）
  const emails = accountsRepo
    .listAccounts()
    .filter((a) => !a.archived)
    .map((a) => a.email);
```

- [ ] **Step 3: 验证 + 提交**

Run: `pnpm typecheck && pnpm build`
Expected: PASS

```bash
git add src/main/imap/idle-manager.ts src/main/scheduler/auto-refresh.ts
git commit -m "feat(archive): 归档账号不建 IDLE 连接、不进自动轮询（手动单刷不受限）"
```

注：`messages:sync`（单账号手动刷新）不做归档判断——归档账号也能手动一次性拉取，符合"不自动收但可手动刷"。

---

### Task 4: IPC 通道 + handler（setArchived / setStartedAt）

**Files:**
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/main/ipc/accounts.ts`

- [ ] **Step 1: 加 channel 名**

在 `src/shared/ipc-channels.ts` 的 `Accounts` 块里 `SetMark` 下追加：

```typescript
    SetMark: 'accounts:setMark',
    SetArchived: 'accounts:setArchived',
    SetStartedAt: 'accounts:setStartedAt',
```

- [ ] **Step 2: 注册 handler**

在 `src/main/ipc/accounts.ts` 的 `registerAccountsIpc()` 里，`SetMark` 的 handler 之后追加：

```typescript
  ipcMain.handle(IpcChannels.Accounts.SetArchived, async (_e, email: string, archived: boolean) => {
    repo.setArchived(email, archived);
    if (archived) {
      await stopIdleFor(email); // 断持久连接，腾名额
    } else {
      void startIdleFor(email); // 恢复实时（openSession 内置静默追赶同步）
    }
  });
  ipcMain.handle(IpcChannels.Accounts.SetStartedAt, (_e, email: string, ts: number | null) =>
    repo.setStartedAt(email, ts),
  );
```

（`stopIdleFor` / `startIdleFor` 已在该文件顶部从 `../imap/idle-manager` 导入，无需新增 import。）

- [ ] **Step 3: 验证 + 提交**

Run: `pnpm typecheck && pnpm build`
Expected: PASS

```bash
git add src/shared/ipc-channels.ts src/main/ipc/accounts.ts
git commit -m "feat(archive): IPC accounts:setArchived(带 stop/start idle) + setStartedAt"
```

---

### Task 5: preload 暴露 + store action

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/renderer/src/store.ts`

- [ ] **Step 1: preload 暴露两方法**

在 `src/preload/index.ts` 的 `accounts` 块里 `setMark` 之后追加：

```typescript
    setMark: (email: string, mark: AccountMark | null): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.Accounts.SetMark, email, mark),
    setArchived: (email: string, archived: boolean): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.Accounts.SetArchived, email, archived),
    setStartedAt: (email: string, ts: number | null): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.Accounts.SetStartedAt, email, ts),
```

（`AccountMark` 已在该文件顶部 import，无需改 import。）

- [ ] **Step 2: store interface 加两 action**

在 `src/renderer/src/store.ts` 的 `State` 接口里，`setMark` 声明下方追加：

```typescript
  setMark: (email: string, mark: AccountMark | null) => Promise<void>;
  setArchived: (email: string, archived: boolean) => Promise<void>;
  setStartedAt: (email: string, ts: number | null) => Promise<void>;
```

- [ ] **Step 3: store 实现两 action**

在 `store.ts` 的 `setMark` action 实现之后追加：

```typescript
  setArchived: async (email: string, archived: boolean) => {
    await window.api.accounts.setArchived(email, archived);
    const accounts = await window.api.accounts.list();
    set({ accounts });
  },

  setStartedAt: async (email: string, ts: number | null) => {
    await window.api.accounts.setStartedAt(email, ts);
    const accounts = await window.api.accounts.list();
    set({ accounts });
  },
```

- [ ] **Step 4: 验证 + 提交**

Run: `pnpm typecheck && pnpm build`
Expected: PASS

```bash
git add src/preload/index.ts src/renderer/src/store.ts
git commit -m "feat(archive): preload + store 暴露 setArchived/setStartedAt"
```

---

### Task 6: 左栏「在用 / 归档」两 tab

**Files:**
- Modify: `src/renderer/src/components/accounts/LeftColumn.tsx`

- [ ] **Step 1: 加 tab 状态 + 过滤**

把 `LeftColumn` 组件体改为（在现有 import 顶部加 `useState`，并按 archived 分组）：

```typescript
import { useState } from 'react';
import { useStore } from '../../store';
import AccountItem from './AccountItem';
import Logo from '../common/Logo';
import { Mail, Plus, RefreshCw } from 'lucide-react';

export default function LeftColumn(): JSX.Element {
  const accounts = useStore((s) => s.accounts);
  const openAddDialog = useStore((s) => s.openAddDialog);
  const refreshAll = useStore((s) => s.refreshAll);
  const refreshingCount = useStore((s) => s.refreshingEmails.size);
  const [tab, setTab] = useState<'active' | 'archived'>('active');

  const activeAccounts = accounts.filter((a) => !a.archived);
  const archivedAccounts = accounts.filter((a) => a.archived);
  const shown = tab === 'active' ? activeAccounts : archivedAccounts;

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border-strong bg-sidebar">
      <header className="flex items-center justify-between gap-1 px-3 pt-3 pb-2">
        <div className="flex min-w-0 items-center gap-1 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`rounded-md px-2 py-1 transition ${
              tab === 'active' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            在用 {activeAccounts.length}
          </button>
          <button
            type="button"
            onClick={() => setTab('archived')}
            className={`rounded-md px-2 py-1 transition ${
              tab === 'archived' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'
            }`}
          >
            归档 {archivedAccounts.length}
          </button>
        </div>
        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={activeAccounts.length === 0}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-surface-2 disabled:opacity-30"
          title="全部刷新（仅在用账号）"
          aria-label="全部刷新"
        >
          <RefreshCw size={13} className={refreshingCount > 0 ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-2 py-1">
        {accounts.length === 0 ? (
          <EmptyState />
        ) : shown.length === 0 ? (
          <div className="mt-8 px-4 text-center text-xs text-muted">
            {tab === 'archived' ? '还没有归档的账号' : '在用账号为空'}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {shown.map((a) => (
              <AccountItem key={a.email} account={a} />
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-border p-2">
        <button
          type="button"
          onClick={openAddDialog}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-gradient-to-b from-accent to-accent/85 px-3 py-2 text-[13px] font-medium text-white shadow-sm transition hover:from-accent/95 hover:to-accent/80 active:from-accent/85"
        >
          <Plus size={14} strokeWidth={2.5} />
          添加账号
        </button>
      </footer>
    </aside>
  );
}
```

（保留文件底部的 `EmptyState` 函数不动。注意：原 header 里的"账号"标题 + 全部刷新按钮被新的 tab 行替换。）

- [ ] **Step 2: 验证 + 提交**

Run: `pnpm typecheck && pnpm build`
Expected: PASS

```bash
git add src/renderer/src/components/accounts/LeftColumn.tsx
git commit -m "feat(archive): 左栏在用/归档两 tab 切换 + 按 archived 过滤"
```

---

### Task 7: 账号项菜单（归档/取消归档 + 记录上号时间）+ 行内上号时间 + 归档灰状态

**Files:**
- Modify: `src/renderer/src/components/accounts/AccountItem.tsx`

- [ ] **Step 1: import 图标 + 取 store action**

把顶部 lucide import 增加 `Archive`、`ArchiveRestore`、`Clock`：

```typescript
import {
  MoreHorizontal,
  RefreshCw,
  Trash2,
  KeyRound,
  BadgeCheck,
  AlertTriangle,
  Tag,
  Check,
  Archive,
  ArchiveRestore,
  Clock,
} from 'lucide-react';
```

在组件里 `const setMark = useStore((s) => s.setMark);` 下加：

```typescript
  const setMark = useStore((s) => s.setMark);
  const setArchived = useStore((s) => s.setArchived);
  const setStartedAt = useStore((s) => s.setStartedAt);
```

- [ ] **Step 2: 加两个 handler**

在 `onMark` 函数下方加：

```typescript
  const onMark = (mark: AccountMark | null): void => {
    setMenuOpen(false);
    void setMark(account.email, mark);
  };

  const onToggleArchive = (): void => {
    setMenuOpen(false);
    void setArchived(account.email, !account.archived);
  };

  const onRecordStartedAt = (): void => {
    setMenuOpen(false);
    void setStartedAt(account.email, Date.now());
  };
```

- [ ] **Step 3: 行内显示上号时间**

把 `@{domain}` 那个 div 改为附带上号时间（仅 `startedAt` 非空时显示）：

```typescript
            <div className="truncate text-[11px] text-muted">
              @{domain}
              {account.startedAt != null && (
                <span className="text-muted-2"> · 上 {formatStartedAt(account.startedAt)}</span>
              )}
            </div>
```

- [ ] **Step 4: 菜单加归档 + 记录上号时间分组**

在 ⋯ 菜单里"清除标记"块之后、"更新应用密码"按钮之前，插入一组（带上分隔线）：

```typescript
            <button
              type="button"
              onClick={onToggleArchive}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs hover:bg-surface-2"
            >
              {account.archived ? (
                <ArchiveRestore size={12} className="text-muted" />
              ) : (
                <Archive size={12} className="text-muted" />
              )}
              {account.archived ? '取消归档' : '归档账号'}
            </button>
            <button
              type="button"
              onClick={onRecordStartedAt}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-2"
            >
              <Clock size={12} className="text-muted" />
              记录上号时间
            </button>
```

（紧接其后的"更新应用密码"按钮已有 `border-t border-border`，保持不变即可，分组线自然成立。）

- [ ] **Step 5: 归档账号显示灰状态点**

把头像旁的 `<StatusBadge .../>` 调用替换为：归档时画一个中性灰"已归档"点，否则照常：

```typescript
            {account.archived ? (
              <span
                className="absolute -bottom-0.5 -right-0.5 inline-block h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-muted-2"
                title="已归档"
              />
            ) : (
              <StatusBadge
                refreshing={refreshing}
                expired={isExpired}
                error={isError}
                ok={account.lastSyncStatus === 'ok'}
                selected={isSelected}
              />
            )}
```

- [ ] **Step 6: 加 formatStartedAt 辅助函数**

在文件底部（`MarkPill` 函数下方）追加：

```typescript
function formatStartedAt(ts: number): string {
  const d = new Date(ts);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}
```

- [ ] **Step 7: 验证 + 提交**

Run: `pnpm typecheck && pnpm build`
Expected: PASS

```bash
git add src/renderer/src/components/accounts/AccountItem.tsx
git commit -m "feat(archive): ⋯菜单加归档/取消归档+记录上号时间，行内显示上号时间，归档灰状态点"
```

---

### Task 8: 凭据抽屉可编辑上号时间

**Files:**
- Modify: `src/renderer/src/components/accounts/CredentialsDrawer.tsx`

- [ ] **Step 1: 读文件确认结构**

Run: `sed -n '1,60p' src/renderer/src/components/accounts/CredentialsDrawer.tsx`
目的：确认组件 props（拿到 `email`）、是否已从 store 取 accounts、warning banner 的位置（约第 106-112 行的 `bg-surface-2 ... 敏感信息` 块）。本 Task 在该 warning banner 之后、`{!creds ? (` 之前插入"上号时间"行。

- [ ] **Step 2: 取该账号 startedAt + store action**

在组件顶部（其它 `useStore` 调用附近）加：

```typescript
  const account = useStore((s) => s.accounts.find((a) => a.email === email) ?? null);
  const setStartedAt = useStore((s) => s.setStartedAt);
```

- [ ] **Step 3: 插入上号时间可编辑行**

在 warning banner 那个 `</div>` 之后、`{!creds ? (` 之前，插入：

```typescript
          <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px]">
            <span className="shrink-0 text-muted">上号时间</span>
            <input
              type="datetime-local"
              value={toDatetimeLocal(account?.startedAt ?? null)}
              onChange={(e) => {
                const ts = fromDatetimeLocal(e.target.value);
                void setStartedAt(email, ts);
              }}
              className="min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-[12px] focus:border-accent focus:outline-none"
            />
            {account?.startedAt != null && (
              <button
                type="button"
                onClick={() => void setStartedAt(email, null)}
                className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-muted hover:bg-surface"
              >
                清除
              </button>
            )}
          </div>
```

- [ ] **Step 4: 加两个时间转换辅助函数**

在 `CredentialsDrawer.tsx` 文件底部追加（毫秒 ↔ `datetime-local` 字符串，本地时区）：

```typescript
function toDatetimeLocal(ts: number | null): string {
  if (ts == null) return '';
  const d = new Date(ts);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(v: string): number | null {
  if (!v) return null;
  const ms = new Date(v).getTime();
  return Number.isNaN(ms) ? null : ms;
}
```

- [ ] **Step 5: 验证 + 提交**

Run: `pnpm typecheck && pnpm build`
Expected: PASS

```bash
git add src/renderer/src/components/accounts/CredentialsDrawer.tsx
git commit -m "feat(archive): 凭据抽屉加可编辑上号时间字段(datetime-local)"
```

---

### Task 9: 运行期手动验证

**Files:** 无（仅验证）

- [ ] **Step 1: 重启 App**

主进程改了 DB/IPC/IDLE/调度，必须重启。在终端（先注入 node@20 路径）kill 掉旧 dev，重新 `pnpm dev`。

- [ ] **Step 2: 逐项验证**

- [ ] 启动无 SQLITE 错误，账号正常同步（迁移成功）
- [ ] ⋯ →「归档账号」→ 该账号移到「归档」tab；左栏 tab 计数变化
- [ ] 看日志：被归档账号不再有 `[idle] ... idle active` / `exists` 推送（持久连接已断）
- [ ] 归档 tab 里点开该账号 → 能看到之前缓存的邮件（只读）
- [ ] 在归档账号的中栏点 🔄 → 能手动拉到最新（一次性，拉完日志无持久 idle）
- [ ] ⋯ →「取消归档」→ 回到「在用」tab，恢复实时 IDLE（日志重现 idle active）
- [ ] ⋯ →「记录上号时间」→ 行上出现 `· 上 M/D HH:mm`
- [ ] 🔑 凭据抽屉 → 上号时间字段可改成别的日期时间、可清除
- [ ] 归档账号的"已退款/有警告"标记保持显示
- [ ] 重启 App → 归档状态、上号时间、标记都还在

- [ ] **Step 3: 完成**

全部通过后本功能完成；如需打包 `pnpm package:mac`。

---

## 实施顺序说明

Task 1 结束时 typecheck 会暂时报错（中间态），Task 2 修复——这是预期。Task 3 起每个 Task 结束都应 typecheck+build 通过。Task 6/7 是 UI 主体，Task 8 是抽屉补充，Task 9 是运行期验证。
