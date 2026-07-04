import { ImapFlow } from 'imapflow';
import { BrowserWindow } from 'electron';
import * as keychain from '../keychain';
import * as accountsRepo from '../storage/accounts-repo';
import { syncAccount } from '../sync';
import type { RefreshEvent } from '../../shared/types';
import { IpcChannels } from '../../shared/ipc-channels';
import { log as fileLog } from '../logger';
import { playNotification } from '../sound';
import { loadSettings } from '../settings';

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
  /** openSession 正在建连（buildClient/connect 期间）。防止并发重复建连（#7）。 */
  connecting: boolean;
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

function triggerSync(session: IdleSession, opts: { silent?: boolean } = {}): void {
  const silent = opts.silent ?? false;
  if (session.syncDebounceTimer) clearTimeout(session.syncDebounceTimer);
  session.syncDebounceTimer = setTimeout(async () => {
    session.syncDebounceTimer = null;
    broadcast({ email: session.email, phase: 'start', silent });
    const res = await syncAccount(session.email);
    if (res.status === 'ok') {
      broadcast({ email: session.email, phase: 'done', newCount: res.fetched, silent });
      // 仅在「非静默 + 真有新邮件 + 开关未关」时响
      if (!silent && res.fetched > 0) {
        const s = loadSettings();
        if (s.soundEnabled !== false) {
          playNotification(res.fetched);
        }
      }
    } else if (res.status === 'expired') {
      broadcast({ email: session.email, phase: 'expired', silent });
    } else {
      broadcast({ email: session.email, phase: 'error', error: res.error, silent });
    }
  }, SYNC_DEBOUNCE_MS);
}

/** 该 session 是否仍是 map 里当前有效且启用的那个（在途 await 后用来识别孤儿）。 */
function isLiveSession(session: IdleSession): boolean {
  return sessions.get(session.email) === session && session.active;
}

async function closeQuietly(client: ImapFlow): Promise<void> {
  try {
    await client.logout();
  } catch {
    try {
      client.close();
    } catch {
      /* noop */
    }
  }
}

async function openSession(session: IdleSession): Promise<void> {
  if (session.connecting || session.client) return; // 已在建连/已连上，避免并发重复建连（#7）
  session.connecting = true;
  try {
    const client = await buildClient(session.email);

    // 建连期间账号可能被 stop/删除/归档（stopIdleFor 会把 session 移出 map / 置 active=false）：
    // 此时这条连接是孤儿，任何池子都触达不到 → 关掉别泄漏（#6）
    if (!isLiveSession(session)) {
      if (client) await closeQuietly(client);
      return;
    }

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
      // 只清掉自己这条 client 的槽位——老连接的 close 不能踩掉新连接（#7）
      if (session.client === client) session.client = null;
      if (session.active && sessions.get(session.email) === session) scheduleReconnect(session);
    });

    client.on('exists', (data: { count: number }) => {
      log(session.email, `exists → ${data.count}，触发同步`);
      triggerSync(session);
    });

    await client.connect();
    await client.mailboxOpen('INBOX');

    // connect/mailboxOpen 期间也可能被 stop → 再校验一次，避免留下孤儿连接（#6）
    if (!isLiveSession(session)) {
      if (session.client === client) session.client = null;
      await closeQuietly(client);
      return;
    }

    // mailboxOpen 之后 imapflow 自动进入 IDLE（有 exists/expunge 事件就触发）
    session.reconnectAttempts = 0;
    log(session.email, 'idle active');

    // 连上后做一次追赶同步，捕获连接前的新邮件——静默，不播提示音
    // （启动 / 睡眠唤醒后重连都走这里）
    triggerSync(session, { silent: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // imapflow 把真实 IMAP 响应放在 err.responseText，err.message 只是 "Command failed"
    const e = err as { responseText?: string; responseStatus?: string };
    const combined = `${msg} ${e.responseText ?? ''}`;
    log(session.email, `connect failed: ${combined}`);
    // 连接失败时 client 可能半开着，兜底清掉自己的槽位
    if (session.client) {
      try {
        session.client.close();
      } catch {
        /* noop */
      }
      session.client = null;
    }

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

    // 网络错误 / buildClient(keytar) 异常 → 退避重连（#13：rejection 不再逃逸成静默停摆）
    if (isLiveSession(session)) scheduleReconnect(session);
  } finally {
    session.connecting = false;
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
      connecting: false,
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
  // 归档账号不维持持久 IDLE 连接（腾出连接名额、不自动收信）
  const accounts = accountsRepo.listAccounts().filter((a) => !a.archived);
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
    if (session.connecting) continue; // 正在建连中，别重复拉起
    if (session.reconnectTimer) continue; // 已经在重连倒计时里
    log(session.email, 'health check: session 无活跃连接且无重连计划，立即拉起');
    void openSession(session);
  }
}

/** App 从睡眠唤醒时调用：强制重连所有活跃 session */
export function reconnectAll(): void {
  for (const session of sessions.values()) {
    if (!session.active) continue;
    if (session.connecting) continue; // 正在建连中，交给它自己完成，别插一脚
    if (session.client) {
      // 正在连着但可能是僵尸连接，关掉让 close 事件触发重连。
      // 单个 close 抛错不能中断其它账号的唤醒重连，包一层。
      try {
        session.client.close();
      } catch {
        /* noop */
      }
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
