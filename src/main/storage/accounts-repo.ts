import type Database from 'better-sqlite3';
import type { Account, AccountMark, SyncStatus } from '../../shared/types';
import { getDb } from './db';

interface AccountRow {
  email: string;
  display_order: number;
  added_at: number;
  last_synced_at: number | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  mark: string | null;
  refunded_at: number | null;
  archived: number;
  archived_at: number | null;
  started_at: number | null;
}

function rowToAccount(r: AccountRow): Account {
  return {
    email: r.email,
    displayOrder: r.display_order,
    addedAt: r.added_at,
    lastSyncedAt: r.last_synced_at,
    lastSyncStatus: r.last_sync_status as SyncStatus | null,
    lastSyncError: r.last_sync_error,
    mark: (r.mark as AccountMark | null) ?? null,
    refundedAt: r.refunded_at,
    archived: r.archived === 1,
    archivedAt: r.archived_at,
    startedAt: r.started_at,
  };
}

export function listAccounts(db: Database.Database = getDb()): Account[] {
  const rows = db
    .prepare<[], AccountRow>(
      `SELECT email, display_order, added_at, last_synced_at, last_sync_status, last_sync_error, mark, refunded_at, archived, archived_at, started_at
       FROM accounts
       ORDER BY display_order ASC, added_at ASC`,
    )
    .all();
  return rows.map(rowToAccount);
}

export function getAccount(email: string, db: Database.Database = getDb()): Account | null {
  const row = db
    .prepare<[string], AccountRow>(
      `SELECT email, display_order, added_at, last_synced_at, last_sync_status, last_sync_error, mark, refunded_at, archived, archived_at, started_at
       FROM accounts WHERE email = ?`,
    )
    .get(email);
  return row ? rowToAccount(row) : null;
}

/**
 * 插入一个账号。如果已存在，只更新 `added_at` 不动其他字段（重新授权语义）。
 */
export function insertAccount(email: string, db: Database.Database = getDb()): void {
  const now = Date.now();
  const maxOrder = db
    .prepare<[], { v: number | null }>(`SELECT MAX(display_order) as v FROM accounts`)
    .get();
  const nextOrder = (maxOrder?.v ?? -1) + 1;

  db.prepare(
    `INSERT INTO accounts (email, display_order, added_at)
     VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET added_at = excluded.added_at`,
  ).run(email, nextOrder, now);
}

export function updateSyncStatus(
  email: string,
  status: SyncStatus,
  error: string | null = null,
  db: Database.Database = getDb(),
): void {
  db.prepare(
    `UPDATE accounts
     SET last_synced_at = ?, last_sync_status = ?, last_sync_error = ?
     WHERE email = ?`,
  ).run(Date.now(), status, error, email);
}

/** 设置/清除账号业务标记（mark=null 表示清除）。
 *  标记为已退款时记录 refunded_at 冻结时刻（"已上号天数"从此不再累积）；
 *  已是退款则保持原冻结时刻不变（COALESCE）；改成其它标记/清除则清掉冻结时刻。 */
export function setMark(
  email: string,
  mark: AccountMark | null,
  db: Database.Database = getDb(),
): void {
  if (mark === 'refunded' || mark === 'banned_refunded') {
    // 已退款 / 已封号退款：记录冻结时刻（已有则保持），"已上号天数"从此不再累积
    db.prepare(
      `UPDATE accounts SET mark = ?, refunded_at = COALESCE(refunded_at, ?) WHERE email = ?`,
    ).run(mark, Date.now(), email);
  } else {
    db.prepare(`UPDATE accounts SET mark = ?, refunded_at = NULL WHERE email = ?`).run(mark, email);
  }
}

/** 设置/取消归档。
 *  归档时记录 archived_at 定格"已上号"计时（已有定格时刻则保持不变，COALESCE）；
 *  取消归档清掉 archived_at，计时恢复累积。 */
export function setArchived(
  email: string,
  archived: boolean,
  db: Database.Database = getDb(),
): void {
  if (archived) {
    db.prepare(
      `UPDATE accounts SET archived = 1, archived_at = COALESCE(archived_at, ?) WHERE email = ?`,
    ).run(Date.now(), email);
  } else {
    db.prepare(`UPDATE accounts SET archived = 0, archived_at = NULL WHERE email = ?`).run(email);
  }
}

/** 设置/清除手动"上号时间"（ts=null 表示清除）。 */
export function setStartedAt(
  email: string,
  ts: number | null,
  db: Database.Database = getDb(),
): void {
  db.prepare(`UPDATE accounts SET started_at = ? WHERE email = ?`).run(ts, email);
}

export function deleteAccount(email: string, db: Database.Database = getDb()): void {
  // ON DELETE CASCADE 会带走 messages
  db.prepare(`DELETE FROM accounts WHERE email = ?`).run(email);
}
