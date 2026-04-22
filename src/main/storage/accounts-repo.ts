import type Database from 'better-sqlite3';
import type { Account, SyncStatus } from '../../shared/types';
import { getDb } from './db';

interface AccountRow {
  email: string;
  display_order: number;
  added_at: number;
  last_synced_at: number | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
}

function rowToAccount(r: AccountRow): Account {
  return {
    email: r.email,
    displayOrder: r.display_order,
    addedAt: r.added_at,
    lastSyncedAt: r.last_synced_at,
    lastSyncStatus: r.last_sync_status as SyncStatus | null,
    lastSyncError: r.last_sync_error,
  };
}

export function listAccounts(db: Database.Database = getDb()): Account[] {
  const rows = db
    .prepare<[], AccountRow>(
      `SELECT email, display_order, added_at, last_synced_at, last_sync_status, last_sync_error
       FROM accounts
       ORDER BY display_order ASC, added_at ASC`,
    )
    .all();
  return rows.map(rowToAccount);
}

export function getAccount(email: string, db: Database.Database = getDb()): Account | null {
  const row = db
    .prepare<[string], AccountRow>(
      `SELECT email, display_order, added_at, last_synced_at, last_sync_status, last_sync_error
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

export function deleteAccount(email: string, db: Database.Database = getDb()): void {
  // ON DELETE CASCADE 会带走 messages
  db.prepare(`DELETE FROM accounts WHERE email = ?`).run(email);
}
