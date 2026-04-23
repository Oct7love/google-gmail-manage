import * as accountsRepo from './storage/accounts-repo';
import * as messagesRepo from './storage/messages-repo';
import { fetchLatestMessages, IMAPExpiredError } from './imap/fetch-messages';
import { MESSAGES_PER_ACCOUNT } from '../shared/constants';

export interface SyncResult {
  email: string;
  fetched: number;
  status: 'ok' | 'expired' | 'error';
  error?: string;
}

/**
 * 同步单个账号最近 N 封邮件。
 *
 * 实现策略：一次 IMAP 会话里直接拉"最近 N 封的完整详情"（envelope + source），
 * 再在本地 upsert。比"先列 UID 再一封一封拉"快 10 倍，因为只有一次 TLS+AUTH 握手。
 */
export async function syncAccount(email: string, max = MESSAGES_PER_ACCOUNT): Promise<SyncResult> {
  try {
    const details = await fetchLatestMessages(email, max);
    const localIds = new Set(messagesRepo.listMessageIdsForAccount(email));
    let newCount = 0;
    for (const d of details) {
      if (!localIds.has(d.messageId)) newCount += 1;
      messagesRepo.upsertMessage(d);
    }
    accountsRepo.updateSyncStatus(email, 'ok');
    return { email, fetched: newCount, status: 'ok' };
  } catch (err) {
    if (err instanceof IMAPExpiredError) {
      accountsRepo.updateSyncStatus(email, 'expired', '应用密码失效或未设置');
      return { email, fetched: 0, status: 'expired' };
    }
    const msg = err instanceof Error ? err.message : String(err);
    accountsRepo.updateSyncStatus(email, 'error', msg);
    return { email, fetched: 0, status: 'error', error: msg };
  }
}
