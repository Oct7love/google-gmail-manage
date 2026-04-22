import type { gmail_v1 } from 'googleapis';
import type { MessageDetail } from '../../shared/types';
import { getGmailClient, isInvalidGrant, TokenExpiredError } from './client';

/** 拉指定账号收件箱最近 N 个邮件的 messageId 列表 */
export async function listLatestMessageIds(
  email: string,
  max: number,
): Promise<string[]> {
  const gmail = await getGmailClient(email);
  try {
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: 'in:inbox',
      maxResults: max,
    });
    return (res.data.messages ?? []).map((m) => m.id!).filter(Boolean);
  } catch (err) {
    if (isInvalidGrant(err)) throw new TokenExpiredError(email);
    throw err;
  }
}

/** 拉指定邮件的完整详情 */
export async function fetchMessageDetail(
  email: string,
  messageId: string,
): Promise<MessageDetail> {
  const gmail = await getGmailClient(email);
  try {
    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });
    return parseMessage(email, res.data);
  } catch (err) {
    if (isInvalidGrant(err)) throw new TokenExpiredError(email);
    throw err;
  }
}

// ---------- 邮件解析 ----------

function parseMessage(
  accountEmail: string,
  msg: gmail_v1.Schema$Message,
): MessageDetail {
  const headers = (msg.payload?.headers ?? []).reduce<Record<string, string>>(
    (acc, h) => {
      if (h.name && h.value) acc[h.name.toLowerCase()] = h.value;
      return acc;
    },
    {},
  );

  const subject = headers['subject'] ?? '';
  const fromAddr = headers['from'] ?? '';
  const dateHeader = headers['date'];
  const dateTs = dateHeader ? Date.parse(dateHeader) : Number(msg.internalDate ?? 0);

  const { html, text } = extractBodies(msg.payload ?? {});

  return {
    accountEmail,
    messageId: msg.id!,
    threadId: msg.threadId ?? null,
    subject,
    fromAddr,
    dateTs: isNaN(dateTs) ? 0 : dateTs,
    snippet: msg.snippet ?? '',
    bodyHtml: html,
    bodyText: text,
    fetchedAt: Date.now(),
  };
}

function extractBodies(payload: gmail_v1.Schema$MessagePart): {
  html: string | null;
  text: string | null;
} {
  let html: string | null = null;
  let text: string | null = null;

  function walk(part: gmail_v1.Schema$MessagePart): void {
    const mime = (part.mimeType ?? '').toLowerCase();
    const data = part.body?.data;
    if (data && mime === 'text/html' && !html) html = decode(data);
    else if (data && mime === 'text/plain' && !text) text = decode(data);
    for (const sub of part.parts ?? []) walk(sub);
  }

  walk(payload);
  return { html, text };
}

function decode(b64url: string): string {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64').toString('utf-8');
}
