import { app } from 'electron';
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

let _db: Database.Database | null = null;

/** 打开数据库（首次打开会建表）。惰性初始化，重复调用安全。 */
export function getDb(): Database.Database {
  if (_db) return _db;

  const userDataDir = app.getPath('userData');
  if (!existsSync(userDataDir)) mkdirSync(userDataDir, { recursive: true });

  const dbPath = join(userDataDir, 'mailviewer.db');
  _db = new Database(dbPath);

  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  migrate(_db);
  return _db;
}

/** 仅用于测试：指定路径打开一个独立数据库实例 */
export function openDbAt(path: string): Database.Database {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

/** 仅用于测试/热重载：关闭并清空全局实例 */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      email              TEXT PRIMARY KEY,
      display_order      INTEGER NOT NULL DEFAULT 0,
      added_at           INTEGER NOT NULL,
      last_synced_at     INTEGER,
      last_sync_status   TEXT,
      last_sync_error    TEXT
    );

    CREATE TABLE IF NOT EXISTS messages (
      account_email  TEXT NOT NULL,
      message_id     TEXT NOT NULL,
      thread_id      TEXT,
      subject        TEXT,
      from_addr      TEXT,
      date_ts        INTEGER,
      snippet        TEXT,
      body_html      TEXT,
      body_text      TEXT,
      fetched_at     INTEGER NOT NULL,
      PRIMARY KEY (account_email, message_id),
      FOREIGN KEY (account_email) REFERENCES accounts(email) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_date
      ON messages(account_email, date_ts DESC);
  `);
}
