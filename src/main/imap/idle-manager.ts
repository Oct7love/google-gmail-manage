import { ImapFlow } from 'imapflow';
import { BrowserWindow } from 'electron';
import * as keychain from '../keychain';
import * as accountsRepo from '../storage/accounts-repo';
import { syncAccount } from '../sync';
import type { RefreshEvent } from '../../shared/types';
import { IpcChannels } from '../../shared/ipc-channels';
import { log as fileLog } from '../logger';

/**
 * IMAP IDLE 管理器：为每个账号维持一个持久 IMAP 连接，监听 Gmail 服务器推送。
 *
 * - Gmail 来新邮件 → 服务器发 `EXISTS` → `exists` 事件 → 触发 syncAccount
 * - 网络断/电脑睡眠 → `close` 事件 → 指数退避重连
 * - 认证失败 → 不反复重试，标为 expired 等用户更新
 *
 * 并发 30 个持久连接 ≈ Mac Mail / Thunderbird 的行为，不会触发 Google 异常检测。
 */

const HOST = 'imap.gmail.com';
const PORT = 993;
const RECONNECT_BACKOFF_MS = [2000, 5000, 15000, 30000, 60000, 120000];
const STAGGER_MS = 250; // 初始启动时每个账号之间隔 250ms，避免 30 连接爆发
const SYNC_DEBOUNCE_MS = 1500; // exists 事件合并窗口
const HEALTH_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 每 10 分钟巡检，拉起掉线的 session

let healthCheckTimer: NodeJS.Timeout | null = null;

interface IdleSession {
  email: string;
  client: ImapFlow | null;
  active: boolean;
  reconnectAttempts: number;
  reconnectTimer: NodeJS.Timeout | null;
  syncDebounceTimer: NodeJS.Timeout | null;
}

const sessions = new Map<string, IdleSession>();

function broadcast(evt: RefreshEvent): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send(IpcChannels.Refresh.Progress, evt);
  }
}

function log(email: string, msg: string): void {
  fileLog(`[idle] ${email} ${msg}`);
}

async function buildClient(email: string): Promise<ImapFlow | null> {
  const password = await keychain.getPassword(email);
  if (!password) return null;
  return new ImapFlow({
    host: HOST,
    port: PORT,
    secure: true,
    auth: { user: email, pass: password.replace(/\s+/g, '') },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 120_000, // IDLE 下 socket 要撑久一点
    logger: false,
  });
}

function triggerSync(session: IdleSession): void {
  if (session.syncDebounceTimer) clearTimeout(session.syncDebounceTimer);
  session.syncDebounceTimer = setTimeout(async () => {
    session.syncDebounceTimer = null;
    broadcast({ email: session.email, phase: 'start' });
    const res = await syncAccount(session.email);
    if (res.status === 'ok') {
      broadcast({ email: session.email, phase: 'done', newCount: res.fetched });
    } else if (res.status === 'expired') {
      broadcast({ email: session.email, phase: 'expired' });
    } else {
      broadcast({ email: session.email, phase: 'error', error: res.error });
    }
  }, SYNC_DEBOUNCE_MS);
}

async function openSession(session: IdleSession): Promise<void> {
  const client = await buildClient(session.email);
  if (!client) {
    // 没密码 → 标 expired 等用户添加/更新
    accountsRepo.updateSyncStatus(session.email, 'expired', '应用密码未设置');
    broadcast({ email: session.email, phase: 'expired' });
    session.active = false;
    return;
  }

  session.client = client;

  client.on('error', (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    log(session.email, `ERROR: ${msg}`);
    // 强制关闭 client，保证 close 事件触发 → 走重连逻辑
    // （有些错误 imapflow 自己不会把 socket 关干净）
    try {
      client.close();
    } catch {
      /* noop */
    }
  });

  client.on('close', () => {
    log(session.email, 'connection closed');
    session.client = null;
    if (session.active) scheduleReconnect(session);
  });

  client.on('exists', (data: { count: number }) => {
    log(session.email, `exists → ${data.count}，触发同步`);
    triggerSync(session);
  });

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    // mailboxOpen 之后 imapflow 自动进入 IDLE（有 exists/expunge 事件就触发）
    session.reconnectAttempts = 0;
    log(session.email, 'idle active');

    // 连上后做一次追赶同步，捕获连接前的新邮件
    triggerSync(session);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // imapflow 把真实 IMAP 响应放在 err.responseText，err.message 只是 "Command failed"
    const e = err as { responseText?: string; responseStatus?: string };
    const combined = `${msg} ${e.responseText ?? ''}`;
    log(session.email, `connect failed: ${combined}`);

    if (
      /AUTHENTICATIONFAILED|invalid credentials|Application-specific password required|Web login required/i.test(
        combined,
      )
    ) {
      accountsRepo.updateSyncStatus(session.email, 'expired', e.responseText ?? msg);
      broadcast({ email: session.email, phase: 'expired' });
      session.active = false; // 认证失败不再重试
      return;
    }

    // 网络错误 → 退避重连
    scheduleReconnect(session);
  }
}

function scheduleReconnect(session: IdleSession): void {
  if (!session.active) return;
  if (session.reconnectTimer) return;

  const idx = Math.min(session.reconnectAttempts, RECONNECT_BACKOFF_MS.length - 1);
  const base = RECONNECT_BACKOFF_MS[idx];
  const jitter = Math.random() * 1000;
  const delay = base + jitter;
  session.reconnectAttempts += 1;

  log(session.email, `reconnect in ${Math.round(delay / 1000)}s (attempt ${session.reconnectAttempts})`);

  session.reconnectTimer = setTimeout(() => {
    session.reconnectTimer = null;
    if (session.active) void openSession(session);
  }, delay);
}

function getOrCreate(email: string): IdleSession {
  let s = sessions.get(email);
  if (!s) {
    s = {
      email,
      client: null,
      active: true,
      reconnectAttempts: 0,
      reconnectTimer: null,
      syncDebounceTimer: null,
    };
    sessions.set(email, s);
  }
  return s;
}

export async function startIdleFor(email: string): Promise<void> {
  const session = getOrCreate(email);
  session.active = true;
  if (session.client) return; // 已在 idle 中
  await openSession(session);
}

export async function stopIdleFor(email: string): Promise<void> {
  const session = sessions.get(email);
  if (!session) return;
  session.active = false;
  if (session.reconnectTimer) {
    clearTimeout(session.reconnectTimer);
    session.reconnectTimer = null;
  }
  if (session.syncDebounceTimer) {
    clearTimeout(session.syncDebounceTimer);
    session.syncDebounceTimer = null;
  }
  if (session.client) {
    try {
      await session.client.logout();
    } catch {
      // ignore
    }
    session.client = null;
  }
  sessions.delete(email);
}

export async function restartIdleFor(email: string): Promise<void> {
  await stopIdleFor(email);
  await startIdleFor(email);
}

export function startAllIdle(): void {
  const accounts = accountsRepo.listAccounts();
  accounts.forEach((a, i) => {
    setTimeout(() => {
      void startIdleFor(a.email);
    }, i * STAGGER_MS);
  });
  // 启动健康检查：每 10 分钟扫一次，拉起死掉的 session（防 close 事件漏派）
  if (healthCheckTimer) clearInterval(healthCheckTimer);
  healthCheckTimer = setInterval(healthCheck, HEALTH_CHECK_INTERVAL_MS);
}

export async function stopAllIdle(): Promise<void> {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
  const emails = [...sessions.keys()];
  await Promise.all(emails.map(stopIdleFor));
}

/** 健康检查：active 但 client=null（连接断了）的 session 立即重连 */
function healthCheck(): void {
  for (const session of sessions.values()) {
    if (!session.active) continue;
    if (session.client) continue; // 正常连着
    if (session.reconnectTimer) continue; // 已经在重连倒计时里
    log(session.email, 'health check: session 无活跃连接且无重连计划，立即拉起');
    void openSession(session);
  }
}

/** App 从睡眠唤醒时调用：强制重连所有活跃 session */
export function reconnectAll(): void {
  for (const session of sessions.values()) {
    if (!session.active) continue;
    if (session.client) {
      // 正在连着但可能是僵尸连接，关掉让 close 事件触发重连
      session.client.close();
    } else {
      // 没连着，立即重连
      if (session.reconnectTimer) {
        clearTimeout(session.reconnectTimer);
        session.reconnectTimer = null;
      }
      session.reconnectAttempts = 0;
      void openSession(session);
    }
  }
}
