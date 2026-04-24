import type { ImapFlow, FetchMessageObject } from 'imapflow';
import { simpleParser, ParsedMail, Attachment } from 'mailparser';
import type { MessageDetail } from '../../shared/types';
import { AuthError, NoPasswordError, openImap } from './client';
import { log } from '../logger';

export class IMAPExpiredError extends Error {
  code = 'TOKEN_EXPIRED' as const;
  constructor(public email: string) {
    super(`账号 ${email} 的应用密码已失效`);
  }
}

/** 一次 IMAP 连接里批量拿"最近 N 封邮件"的完整详情 */
export async function fetchLatestMessages(
  email: string,
  max: number,
): Promise<MessageDetail[]> {
  const c = await openImapSafe(email);
  try {
    const lock = await c.getMailboxLock('INBOX');
    try {
      // 直接读 client.mailbox.exists（lock 打开时已经填充）
      const mailbox = c.mailbox;
      const total =
        mailbox && typeof mailbox !== 'boolean' ? mailbox.exists ?? 0 : 0;
      log(`[fetch] ${email} mailbox.exists=${total}`);
      if (total === 0) return [];
      const start = Math.max(1, total - max + 1);
      const range = `${start}:${total}`;
      log(`[fetch] ${email} fetching range ${range}`);

      const raws: { uid: number; source: Buffer; internalDate?: Date }[] = [];
      for await (const msg of c.fetch(
        range,
        { uid: true, internalDate: true, source: true },
        { uid: false },
      )) {
        if (msg.uid && msg.source) {
          raws.push({
            uid: msg.uid,
            source: msg.source,
            internalDate: msg.internalDate instanceof Date ? msg.internalDate : undefined,
          });
        }
      }
      log(`[fetch] ${email} got ${raws.length} raw messages`);

      // 解析放在锁外（CPU 密集，不占 IMAP 连接）
      lock.release();

      const results: MessageDetail[] = [];
      for (const raw of raws) {
        results.push(await parseMessage(email, raw));
      }
      results.sort((a, b) => b.dateTs - a.dateTs);
      return results;
    } catch (err) {
      // 仅在 try 内抛错时 release（上面 happy path 已 release）
      try {
        lock.release();
      } catch {
        /* noop */
      }
      throw err;
    }
  } finally {
    await c.logout();
  }
}

async function openImapSafe(email: string): Promise<ImapFlow> {
  try {
    return await openImap(email);
  } catch (err) {
    if (err instanceof AuthError || err instanceof NoPasswordError) {
      throw new IMAPExpiredError(email);
    }
    throw err;
  }
}

// ---------- 邮件解析（mailparser 驱动） ----------

interface RawMsg {
  uid: number;
  source: Buffer;
  internalDate?: Date;
}

async function parseMessage(accountEmail: string, raw: RawMsg): Promise<MessageDetail> {
  const parsed: ParsedMail = await simpleParser(raw.source);

  const subject = parsed.subject ?? '';
  const fromAddr =
    parsed.from?.value?.[0]?.name && parsed.from.value[0].address
      ? `${parsed.from.value[0].name} <${parsed.from.value[0].address}>`
      : parsed.from?.value?.[0]?.address ?? parsed.from?.text ?? '';
  const dateTs = parsed.date
    ? parsed.date.getTime()
    : raw.internalDate
    ? raw.internalDate.getTime()
    : 0;

  // 内嵌 cid: 图片 → data: URL 直接注入 HTML，默认就能渲染
  const bodyHtml = parsed.html ? inlineCidImages(parsed.html, parsed.attachments) : null;
  const bodyText = parsed.text ?? null;

  const plain = bodyText ?? (bodyHtml ? stripHtml(bodyHtml) : '');
  const snippet = cleanSnippet(plain);

  return {
    accountEmail,
    messageId: String(raw.uid),
    threadId: null,
    subject,
    fromAddr,
    dateTs,
    snippet,
    bodyHtml,
    bodyText,
    fetchedAt: Date.now(),
  };
}

/** 把 HTML 里所有 cid:xxx 引用替换为 data:image/...;base64,... */
function inlineCidImages(html: string, attachments: Attachment[]): string {
  if (!attachments || attachments.length === 0) return html;
  const cidMap = new Map<string, Attachment>();
  for (const att of attachments) {
    if (att.contentId) {
      // contentId 形如 '<xxx@yyy>'，去掉尖括号
      const id = att.contentId.replace(/^<|>$/g, '');
      cidMap.set(id, att);
    }
  }
  if (cidMap.size === 0) return html;

  return html.replace(/src\s*=\s*["']cid:([^"']+)["']/gi, (_m, cid: string) => {
    const att = cidMap.get(cid);
    if (!att || !att.content) return `src=""`;
    const mime = att.contentType || 'application/octet-stream';
    const b64 = att.content.toString('base64');
    return `src="data:${mime};base64,${b64}"`;
  });
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, ' ');
}

/** 清理邮件预览：去掉 [image: xxx]、[cid: xxx]、url、多余空白 */
function cleanSnippet(raw: string): string {
  return raw
    .replace(/\[image:[^\]]*\]/gi, '')
    .replace(/\[cid:[^\]]*\]/gi, '')
    .replace(/\(https?:\/\/[^)]+\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}
