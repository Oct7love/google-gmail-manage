import { ImapFlow } from 'imapflow';
import * as keychain from '../keychain';

const HOST = 'imap.gmail.com';
const PORT = 993;
const CONN_TIMEOUT_MS = 10_000;
const GREETING_TIMEOUT_MS = 10_000;
const SOCKET_TIMEOUT_MS = 30_000;

export class AuthError extends Error {
  code = 'AUTH' as const;
  constructor(public email: string, public detail?: string) {
    super(`账号 ${email} 认证失败${detail ? '：' + detail : ''}`);
  }
}

export class NoPasswordError extends Error {
  code = 'NO_PASSWORD' as const;
  constructor(public email: string) {
    super(`账号 ${email} 没有保存应用密码，需要重新添加`);
  }
}

/**
 * 打开一个 IMAP 连接，登录成功后返回。调用方负责 logout()。
 * 已处理错误分类：认证失败 → AuthError；其他网络/协议错误原样抛。
 */
export async function openImap(email: string, password?: string): Promise<ImapFlow> {
  const pass = password ?? (await keychain.getPassword(email));
  if (!pass) throw new NoPasswordError(email);

  const log = (level: string, msg: unknown): void => {
    const stamp = new Date().toISOString().slice(11, 23);
    // eslint-disable-next-line no-console
    console.log(`[imap ${stamp} ${email}] ${level}:`, typeof msg === 'string' ? msg : JSON.stringify(msg));
  };

  const client = new ImapFlow({
    host: HOST,
    port: PORT,
    secure: true,
    auth: { user: email, pass },
    connectionTimeout: CONN_TIMEOUT_MS,
    greetingTimeout: GREETING_TIMEOUT_MS,
    socketTimeout: SOCKET_TIMEOUT_MS,
    logger: {
      debug: () => undefined, // 太吵，忽略
      info: (o) => log('INFO', (o as { msg?: string }).msg ?? o),
      warn: (o) => log('WARN', (o as { msg?: string }).msg ?? o),
      error: (o) => log('ERROR', (o as { msg?: string }).msg ?? o),
    },
  });

  // 非常重要：给所有 ImapFlow 实例挂 error 监听，防止异步 socket 错误变成未捕获异常
  // （比如 socket timeout、TLS 断开、对端关闭等在 setTimeout 回调里 emit 的 error）
  client.on('error', (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    log('SOCKET_ERROR', msg);
  });

  try {
    log('CONNECT', `连接 ${HOST}:${PORT} …`);
    await client.connect();
    log('CONNECT', '握手成功');
    return client;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // imapflow 把真实的 IMAP 返回放在 err.responseText，message 通常只是 "Command failed"
    const e = err as { responseText?: string; responseStatus?: string };
    const combined = `${msg} ${e.responseText ?? ''} ${e.responseStatus ?? ''}`;
    log('CONNECT_FAIL', combined);
    if (
      /AUTHENTICATIONFAILED|invalid credentials|Application-specific password required|Web login required/i.test(
        combined,
      )
    ) {
      throw new AuthError(email, e.responseText ?? msg);
    }
    throw err;
  }
}

/** 仅验证凭据是否有效（不做任何读写操作），立即断开。 */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const c = await openImap(email, password);
    await c.logout();
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof AuthError) {
      return {
        ok: false,
        error:
          '认证失败。请检查：\n' +
          '1. 邮箱地址是否拼写正确\n' +
          '2. 是否使用"应用专用密码"（16 位，不是你的 Gmail 登录密码）\n' +
          '3. 账号是否开启了 2FA（应用密码必须在 2FA 开启后才能生成）',
      };
    }
    return { ok: false, error: `连接失败：${msg}` };
  }
}
