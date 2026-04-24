import { BrowserWindow } from 'electron';
import * as accountsRepo from '../storage/accounts-repo';
import { syncAccount, SyncResult } from '../sync';
import type { RefreshEvent } from '../../shared/types';
import { IpcChannels } from '../../shared/ipc-channels';
import { MESSAGES_PER_ACCOUNT } from '../../shared/constants';

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const CONCURRENCY = 3; // Gmail 并发 IMAP 不能太多，避免 AUTH 限流

let timer: NodeJS.Timeout | null = null;

function broadcast(evt: RefreshEvent): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send(IpcChannels.Refresh.Progress, evt);
  }
}

/** 并发上限为 N 的批量执行 */
async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * 刷新所有账号。并发上限 5，过期账号跳过不重试，汇总发给 renderer。
 */
export async function refreshAll(): Promise<SyncResult[]> {
  const emails = accountsRepo.listAccounts().map((a) => a.email);
  return runWithConcurrency(emails, CONCURRENCY, async (email) => {
    broadcast({ email, phase: 'start' });
    const r = await syncAccount(email, MESSAGES_PER_ACCOUNT);
    if (r.status === 'ok') broadcast({ email, phase: 'done', newCount: r.fetched });
    else if (r.status === 'expired') broadcast({ email, phase: 'expired' });
    else broadcast({ email, phase: 'error', error: r.error });
    return r;
  });
}

export function startAutoRefresh(intervalMs: number = DEFAULT_INTERVAL_MS): void {
  stopAutoRefresh();
  timer = setInterval(() => {
    void refreshAll();
  }, intervalMs);
}

export function stopAutoRefresh(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
