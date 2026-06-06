# 设计文档：账号归档 + 上号时间

> 日期：2026-06-06
> 状态：已与用户确认，待出实施计划

---

## 1. 背景与需求

用户管理 30+ 个频繁轮换的 Gmail 账号。当前架构里**每个账号一条持久 IMAP IDLE 连接**
（30 条 ≈ 60MB），这是"账号数实际上限"的来源。用户提出三点需求：

1. **归档功能**：可以把一些账号归档；归档时继续保留它的"已退款/有警告"标记状态。
2. **不再局限 30 个**：归档的账号放到与主账号面板分开的另一处；归档账号不再占用持久连接，
   从而活跃账号不再卡在 30。
3. **上号时间**：每个账号加一个**手动记录**的时间戳（例如"6/6 22:18 上的号"）。

用户进一步明确的两条关键约束：
- **归档账号不继续自动接收邮件**（断持久连接、不进自动轮询）。
- **但归档账号可以手动刷新**（一次性拉取最新，拉完即断，不保持连接）。

## 2. 目标

- 账号可在「在用 / 归档」两种状态间切换，归档后冻结实时收信、腾出 IMAP 连接名额。
- 归档账号保留全部数据（缓存邮件只读可看、应用密码、标记、上号时间），可手动刷新、可恢复。
- 每个账号有一个手动可填/可改的"上号时间"。

## 3. 明确不做（范围边界）

- 不动 IMAP/Keychain 安全模型；归档只改"是否维持持久连接 + 是否进自动刷新"。
- 不做归档账号的自动同步（IDLE / 1h 轮询都跳过归档）。
- 上号时间是**纯手动**字段，不自动探测、不与登录流程耦合。
- 不引入新 UI 框架；沿用 React + Tailwind 语义 token + zustand + lucide。

## 4. 数据模型

`Account`（`src/shared/types.ts`）新增两字段（`mark` 上一迭代已加）：

| 字段 | 类型 | DB 列 | 含义 |
|---|---|---|---|
| `archived` | `boolean` | `archived INTEGER NOT NULL DEFAULT 0` | 是否归档 |
| `startedAt` | `number \| null` | `started_at INTEGER` | 手动"上号时间"，毫秒时间戳，null=未填 |

**迁移**：复用 `src/main/storage/db.ts` 已有的 `addColumnIfMissing(db, table, column, type)`：
- `addColumnIfMissing(db, 'accounts', 'archived', 'INTEGER NOT NULL DEFAULT 0')`
- `addColumnIfMissing(db, 'accounts', 'started_at', 'INTEGER')`

老库自动补列，现有 30+ 账号数据零改动（archived 默认 0 = 在用）。

## 5. 冻结 / 刷新语义（核心）

| 路径 | 在用账号 | 归档账号 |
|---|---|---|
| 持久 IMAP IDLE 连接 | 有 | **无**（归档即断，腾连接） |
| 1h 自动轮询 / "全部刷新" | 参与 | **跳过** |
| 手动单账号刷新（中栏 🔄 / refreshOne） | 可 | **可**（一次性连接，拉完即断，不保持） |
| 查看已缓存邮件 | 可 | 可（只读） |

实现要点：
- `idle-manager.ts` `startAllIdle()`：只对 `!a.archived` 的账号启动 IDLE。
- `scheduler/auto-refresh.ts` `refreshAll()`：只遍历 `!a.archived` 的账号
  （自动轮询和"全部刷新"都走这里）。
- `refreshOne`（`messages:sync` 单账号手动）：**不拦归档**，归档账号也能一次性拉。
- 归档动作：`repo.setArchived(email, true)` + `stopIdleFor(email)`。
- 取消归档：`repo.setArchived(email, false)` + `startIdleFor(email)`
  （`openSession` 内置静默追赶同步，自动补齐归档期间漏的邮件）。

## 6. 界面

### 左栏（`LeftColumn.tsx`）
- 顶部加两个 tab：`在用 (N)` / `归档 (M)`，本地 `useState` 切换；列表按 tab 过滤
  （N/M 由 `accounts` 按 `archived` 分组计数）。
- 在用 tab：现有 `AccountItem` 行为不变。
- 归档 tab：同样的行，但**状态点显示"已归档"灰态**（不显示实时同步绿/橙/红），
  其余（头像、标记胶囊、上号时间）照常。

### 账号项（`AccountItem.tsx`）
- ⋯ 菜单重新分组（分隔线隔开）：
  1. 标记已退款 / 标记有警告 / 清除标记（已有）
  2. **归档账号**（在归档 tab 里此项变 **取消归档**） · **记录上号时间**（一键填当前）
  3. 更新应用密码 / 移除账号
- 行内显示"上号时间"：`@domain` 同行或下方小字 `上 6/6 22:18`（`text-muted-2`，仅 `startedAt` 非空时显示）。

### 凭据抽屉（`CredentialsDrawer.tsx`）
- 加一个可编辑"上号时间"字段，用 `<input type="datetime-local">`，可改成任意日期时间，
  保存走 `setStartedAt`。展示时格式化为本地时间。

## 7. 链路

| 层 | 改动 |
|---|---|
| `shared/ipc-channels.ts` | `Accounts.SetArchived`、`Accounts.SetStartedAt` |
| `main/storage/accounts-repo.ts` | row + rowToAccount 加 archived/started_at；SELECT 加列；`setArchived`、`setStartedAt` |
| `main/storage/db.ts` | 两个 `addColumnIfMissing` 迁移 |
| `main/ipc/accounts.ts` | `setArchived`（repo + stop/start idle）、`setStartedAt`（repo） |
| `main/imap/idle-manager.ts` | `startAllIdle` 过滤归档 |
| `main/scheduler/auto-refresh.ts` | `refreshAll` 过滤归档 |
| `preload/index.ts` | `accounts.setArchived` / `setStartedAt` |
| `renderer/store.ts` | action `setArchived` / `setStartedAt`（调 IPC → re-list → set accounts） |
| `renderer/components/accounts/LeftColumn.tsx` | 两 tab + 按 archived 过滤 |
| `renderer/components/accounts/AccountItem.tsx` | 菜单加归档/上号时间项；行内显示上号时间；归档态灰状态点 |
| `renderer/components/accounts/CredentialsDrawer.tsx` | 上号时间可编辑字段 |

## 8. "不再局限 30 个"如何兑现

只有**活跃账号**占 IMAP IDLE 持久连接，归档账号 0 连接。把不常用的账号归档后，
活跃连接数下降，就能再添更多新活跃账号；**总账号数（活跃 + 归档）不设限**。
活跃账号仍建议控制在 ~30 以内以保证连接健康，但这由用户按需归档自行调节。

## 9. 边界与细节

- 归档当前选中的账号：仍可在归档 tab 点开看缓存邮件，中栏 🔄 仍可手动拉。
- 删除归档账号：与普通删除一致（级联清缓存 + Keychain），不特殊处理。
- 上号时间格式：存毫秒，行内显示 `M/D HH:mm`，抽屉编辑用 `datetime-local`。
- tab 计数实时随归档/取消归档更新（accounts 重新拉取后重算）。

## 10. 验证

- `pnpm typecheck && pnpm build` 通过。
- 主进程改了 DB/IPC/IDLE/调度，验证需重启 App。
- 手动验证：
  1. 归档一个账号 → 它移到「归档」tab；日志确认其 IDLE 连接已断（不再有该账号的 idle 推送）。
  2. 归档账号点中栏 🔄 → 能手动拉到最新邮件；拉完不留持久连接。
  3. 取消归档 → 回到「在用」tab，恢复实时 IDLE 推送。
  4. ⋯ →「记录上号时间」→ 行上出现 `上 M/D HH:mm`；抽屉里可改成别的时间并保存。
  5. 归档账号的"已退款/有警告"标记保持不变。
  6. 重启 App 后归档状态、上号时间、标记都还在。
