import { google, gmail_v1 } from 'googleapis';
import * as keychain from '../keychain';
import type { Tokens } from '../../shared/types';

export class TokenExpiredError extends Error {
  code = 'TOKEN_EXPIRED' as const;
  constructor(public email: string) {
    super(`账号 ${email} 的授权已过期`);
  }
}

export class NoCredentialsError extends Error {
  code = 'NO_CREDENTIALS' as const;
  constructor() {
    super('尚未配置 Google Cloud 凭据');
  }
}

/**
 * 为指定 email 构造一个带身份的 Gmail 客户端。
 * 客户端内部会在 access_token 过期时自动用 refresh_token 续；续到新 token
 * 后通过 `tokens` 事件把新值同步写回 Keychain。
 */
export async function getGmailClient(email: string): Promise<gmail_v1.Gmail> {
  const creds = await keychain.getCredentials();
  if (!creds) throw new NoCredentialsError();

  const existing = await keychain.getTokens(email);
  if (!existing) throw new TokenExpiredError(email);

  const oauth2 = new google.auth.OAuth2({
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
  });

  oauth2.setCredentials({
    refresh_token: existing.refreshToken,
    access_token: existing.accessToken,
    expiry_date: existing.expiryDate,
  });

  oauth2.on('tokens', (t: { refresh_token?: string | null; access_token?: string | null; expiry_date?: number | null }) => {
    // refresh_token 只在首次授权时给，后续刷新时 Google 可能不再回传
    const next: Tokens = {
      refreshToken: t.refresh_token ?? existing.refreshToken,
      accessToken: t.access_token ?? existing.accessToken,
      expiryDate: t.expiry_date ?? existing.expiryDate,
    };
    keychain.setTokens(email, next).catch(() => {
      // Keychain 写入失败不影响本次调用
    });
  });

  return google.gmail({ version: 'v1', auth: oauth2 });
}

/** 识别 googleapis 抛的"refresh_token 失效"错误 */
export function isInvalidGrant(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { message?: string; response?: { data?: { error?: string } } };
  const msg = String(e.message ?? '').toLowerCase();
  const apiErr = String(e.response?.data?.error ?? '').toLowerCase();
  return msg.includes('invalid_grant') || apiErr === 'invalid_grant';
}
