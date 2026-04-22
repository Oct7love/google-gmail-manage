import type Database from 'better-sqlite3';
import type { MessageDetail, MessageSummary } from '../../shared/types';
import { getDb } from './db';

interface MessageRow {
  account_email: string;
  message_id: string;
  thread_id: string | null;
  subject: string | null;
  from_addr: string | null;
  date_ts: number | null;
  snippet: string | null;
  body_html: string | null;
  body_text: string | null;
  fetched_at: number;
}

function rowToSummary(r: MessageRow): MessageSummary {
  return {
    accountEmail: r.account_email,
    messageId: r.message_id,
    threadId: r.thread_id,
    subject: r.subject ?? '',
    fromAddr: r.from_addr ?? '',
    dateTs: r.date_ts ?? 0,
    snippet: r.snippet ?? '',
    fetchedAt: r.fetched_at,
  };
}

function rowToDetail(r: MessageRow): MessageDetail {
  return { ...rowToSummary(r), bodyHtml: r.body_html, bodyText: r.body_text };
}

export function getLatestMessages(
  email: string,
  limit: number,
  db: Database.Database = getDb(),
): MessageSummary[] {
  const rows = db
    .prepare<[string, number], MessageRow>(
      `SELECT account_email, message_id, thread_id, subject, from_addr, date_ts, snippet,
              body_html, body_text, fetched_at
       FROM messages
       WHERE account_email = ?
       ORDER BY date_ts DESC
       LIMIT ?`,
    )
    .all(email, limit);
  return rows.map(rowToSummary);
}

export function getMessageDetail(
  email: string,
  messageId: string,
  db: Database.Database = getDb(),
): MessageDetail | null {
  const row = db
    .prepare<[string, string], MessageRow>(
      `SELECT account_email, message_id, thread_id, subject, from_addr, date_ts, snippet,
              body_html, body_text, fetched_at
       FROM messages
       WHERE account_email = ? AND message_id = ?`,
    )
    .get(email, messageId);
  return row ? rowToDetail(row) : null;
}

export function upsertMessage(msg: MessageDetail, db: Database.Database = getDb()): void {
  db.prepare(
    `INSERT INTO messages
       (account_email, message_id, thread_id, subject, from_addr, date_ts, snippet,
        body_html, body_text, fetched_at)
     VALUES (@accountEmail, @messageId, @threadId, @subject, @fromAddr, @dateTs, @snippet,
             @bodyHtml, @bodyText, @fetchedAt)
     ON CONFLICT(account_email, message_id) DO UPDATE SET
       thread_id = excluded.thread_id,
       subject   = excluded.subject,
       from_addr = excluded.from_addr,
       date_ts   = excluded.date_ts,
       snippet   = excluded.snippet,
       body_html = excluded.body_html,
       body_text = excluded.body_text,
       fetched_at = excluded.fetched_at`,
  ).run(msg);
}

export function listMessageIdsForAccount(
  email: string,
  db: Database.Database = getDb(),
): string[] {
  return db
    .prepare<[string], { message_id: string }>(
      `SELECT message_id FROM messages WHERE account_email = ?`,
    )
    .all(email)
    .map((r) => r.message_id);
}

export function deleteAllForAccount(
  email: string,
  db: Database.Database = getDb(),
): void {
  db.prepare(`DELETE FROM messages WHERE account_email = ?`).run(email);
}
