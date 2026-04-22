import keytar from 'keytar';
import type { Credentials, Tokens } from '../../shared/types';

/**
 * Keychain 薄封装。
 * - Credentials（Client ID / Secret）：account 固定为 'default'
 * - Tokens（每个 Gmail 账号一份）：account 使用 email 地址
 *
 * 存的值一律 JSON.stringify；读取时若解析失败视为未配置。
 */

const SERVICE_CREDENTIALS = 'MailViewer-gmail-credentials';
const SERVICE_TOKENS = 'MailViewer-gmail-tokens';
const CREDENTIALS_ACCOUNT = 'default';

export async function getCredentials(): Promise<Credentials | null> {
  const raw = await keytar.getPassword(SERVICE_CREDENTIALS, CREDENTIALS_ACCOUNT);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Credentials;
    if (!parsed.clientId || !parsed.clientSecret) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function setCredentials(creds: Credentials): Promise<void> {
  await keytar.setPassword(SERVICE_CREDENTIALS, CREDENTIALS_ACCOUNT, JSON.stringify(creds));
}

export async function clearCredentials(): Promise<void> {
  await keytar.deletePassword(SERVICE_CREDENTIALS, CREDENTIALS_ACCOUNT);
}

export async function getTokens(email: string): Promise<Tokens | null> {
  const raw = await keytar.getPassword(SERVICE_TOKENS, email);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Tokens;
  } catch {
    return null;
  }
}

export async function setTokens(email: string, tokens: Tokens): Promise<void> {
  await keytar.setPassword(SERVICE_TOKENS, email, JSON.stringify(tokens));
}

export async function deleteTokens(email: string): Promise<void> {
  await keytar.deletePassword(SERVICE_TOKENS, email);
}
