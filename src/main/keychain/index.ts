import keytar from 'keytar';
import { app } from 'electron';
import os from 'node:os';
import { join } from 'node:path';
import type { AccountInfo } from '../../shared/types';
import {
  createAccountInfoStore,
  deriveKey,
  mergeAccountInfo,
  type AccountInfoStore,
} from '../storage/account-info-store';

/**
 * 凭据存储封装。
 *
 * - 应用专用密码（IMAP 连接用，必需）：仍存 macOS Keychain / Windows Credential Manager。
 *   它每次同步都要读，用户机器上"始终允许"对它已生效，不弹框。
 * - 账号附加信息（Google 密码 / 2FA / 辅邮 / 链接，可选）：改存**本地加密文件**。
 *   原因见 account-info-store.ts——未签名 App 下按账号逐条存的 Keychain 会反复弹"输入密码"。
 *   旧版本存在 Keychain 里的数据会在首次读取时懒迁移到本地文件（仅那一次会弹框）。
 */

const SERVICE_PASSWORDS = 'MailViewer-imap-passwords';
const SERVICE_INFO = 'MailViewer-account-info'; // 旧版本账号信息所在的 Keychain service（仅用于迁移/清理）

const APP_PEPPER = 'MailViewer/account-info/v1';

// ---------- 应用专用密码（IMAP，仍走 Keychain） ----------

export async function getPassword(email: string): Promise<string | null> {
  return keytar.getPassword(SERVICE_PASSWORDS, email);
}

export async function setPassword(email: string, password: string): Promise<void> {
  await keytar.setPassword(SERVICE_PASSWORDS, email, password);
}

export async function deletePassword(email: string): Promise<void> {
  await keytar.deletePassword(SERVICE_PASSWORDS, email);
}

// ---------- 账号附加信息（本地加密文件） ----------

let _store: AccountInfoStore | null = null;
function store(): AccountInfoStore {
  if (!_store) {
    // username 在同一台机器/用户下稳定，优先保证"不丢数据"；密钥不入库但可由代码推导。
    let user = '';
    try {
      user = os.userInfo().username;
    } catch {
      /* 极少数环境取不到用户名，退化为仅 pepper，仍可用且稳定 */
    }
    const key = deriveKey(`${APP_PEPPER}|${user}`);
    _store = createAccountInfoStore(join(app.getPath('userData'), 'account-info.enc'), key);
  }
  return _store;
}

/** 读旧版本残留在 Keychain 的账号信息（存在则读取会触发一次系统弹框）。 */
async function readLegacyAccountInfo(email: string): Promise<AccountInfo | null> {
  const raw = await keytar.getPassword(SERVICE_INFO, email);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AccountInfo;
  } catch {
    return null;
  }
}

export async function getAccountInfo(email: string): Promise<AccountInfo | null> {
  const fromFile = store().get(email);
  if (fromFile) return fromFile;
  // 本地文件没有 → 尝试从旧 Keychain 懒迁移（仅有旧数据时弹一次框，迁移后不再弹）
  const legacy = await readLegacyAccountInfo(email);
  if (legacy) {
    store().set(email, legacy);
    return legacy;
  }
  return null;
}

export async function setAccountInfo(email: string, info: AccountInfo): Promise<void> {
  // 仅覆盖传入的非空字段，避免覆盖已有信息（getAccountInfo 会顺带迁移旧数据）
  const existing = (await getAccountInfo(email)) ?? {};
  store().set(email, mergeAccountInfo(existing, info));
}

export async function deleteAccountInfo(email: string): Promise<void> {
  store().delete(email);
  // 顺手清掉可能残留的旧 Keychain 记录（删除一般不弹框；失败忽略）
  try {
    await keytar.deletePassword(SERVICE_INFO, email);
  } catch {
    /* 旧数据清理失败无所谓 */
  }
}
