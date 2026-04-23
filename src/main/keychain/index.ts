import keytar from 'keytar';
import type { AccountInfo } from '../../shared/types';

/**
 * Keychain 薄封装。
 *
 * 两个 service：
 * - MailViewer-imap-passwords: 16 位应用专用密码（IMAP 连接用，必需）
 * - MailViewer-account-info: JSON 字符串（Google 密码 / 2FA 密钥 / 辅邮 / 链接，可选）
 * 两者都按 email 地址作为 account 存储。
 */

const SERVICE_PASSWORDS = 'MailViewer-imap-passwords';
const SERVICE_INFO = 'MailViewer-account-info';

// ---------- 应用专用密码（IMAP） ----------

export async function getPassword(email: string): Promise<string | null> {
  return keytar.getPassword(SERVICE_PASSWORDS, email);
}

export async function setPassword(email: string, password: string): Promise<void> {
  await keytar.setPassword(SERVICE_PASSWORDS, email, password);
}

export async function deletePassword(email: string): Promise<void> {
  await keytar.deletePassword(SERVICE_PASSWORDS, email);
}

// ---------- 账号附加信息（Google 密码 / 2FA / 辅邮 / 链接） ----------

export async function getAccountInfo(email: string): Promise<AccountInfo | null> {
  const raw = await keytar.getPassword(SERVICE_INFO, email);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AccountInfo;
  } catch {
    return null;
  }
}

export async function setAccountInfo(email: string, info: AccountInfo): Promise<void> {
  // 仅保存非空字段，避免覆盖已有信息
  const existing = (await getAccountInfo(email)) ?? {};
  const merged: AccountInfo = { ...existing };
  if (info.googlePassword !== undefined) merged.googlePassword = info.googlePassword || undefined;
  if (info.totpSecret !== undefined) merged.totpSecret = info.totpSecret || undefined;
  if (info.recoveryEmail !== undefined) merged.recoveryEmail = info.recoveryEmail || undefined;
  if (info.link !== undefined) merged.link = info.link || undefined;
  await keytar.setPassword(SERVICE_INFO, email, JSON.stringify(merged));
}

export async function deleteAccountInfo(email: string): Promise<void> {
  await keytar.deletePassword(SERVICE_INFO, email);
}
