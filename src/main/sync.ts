import * as accountsRepo from './storage/accounts-repo';
import * as messagesRepo from './storage/messages-repo';
import { listLatestMessageIds, fetchMessageDetail } from './gmail/fetch-messages';
import { TokenExpiredError } from './gmail/client';

export interface SyncResult {
  email: string;
  fetched: number;
  status: 'ok' | 'expired' | 'error';
  error?: string;
}

/** 同步单个账号最近 N 封邮件（仅拉本地没有的） */
export async function syncAccount(email: string, max = 10): Promise<SyncResult> {
  try {
    const remoteIds = await listLatestMessageIds(email, max);
    const localIds = new Set(messagesRepo.listMessageIdsForAccount(email));
    const newIds = remoteIds.filter((id) => !localIds.has(id));

    for (const id of newIds) {
      const detail = await fetchMessageDetail(email, id);
      messagesRepo.upsertMessage(detail);
    }

    accountsRepo.updateSyncStatus(email, 'ok');
    return { email, fetched: newIds.length, status: 'ok' };
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      accountsRepo.updateSyncStatus(email, 'expired', '授权已过期');
      return { email, fetched: 0, status: 'expired' };
    }
    const msg = err instanceof Error ? err.message : String(err);
    accountsRepo.updateSyncStatus(email, 'error', msg);
    return { email, fetched: 0, status: 'error', error: msg };
  }
}
