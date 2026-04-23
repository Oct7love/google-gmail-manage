import keytar from 'keytar';

/**
 * Keychain 薄封装。
 *
 * 存储内容：Gmail 地址对应的"应用专用密码"。
 * - service: MailViewer-imap-passwords
 * - account: 用户的 Gmail 地址
 * - password: Google 颁发的 16 位应用密码（可包含空格，存取原样）
 */

const SERVICE_PASSWORDS = 'MailViewer-imap-passwords';

export async function getPassword(email: string): Promise<string | null> {
  return keytar.getPassword(SERVICE_PASSWORDS, email);
}

export async function setPassword(email: string, password: string): Promise<void> {
  await keytar.setPassword(SERVICE_PASSWORDS, email, password);
}

export async function deletePassword(email: string): Promise<void> {
  await keytar.deletePassword(SERVICE_PASSWORDS, email);
}
