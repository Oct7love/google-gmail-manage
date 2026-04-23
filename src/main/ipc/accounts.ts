import { dialog, ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels';
import { MESSAGES_PER_ACCOUNT } from '../../shared/constants';
import type { AccountCredentials, AccountInfo } from '../../shared/types';
import * as repo from '../storage/accounts-repo';
import * as keychain from '../keychain';
import { verifyCredentials } from '../imap/client';
import { syncAccount } from '../sync';
import { startIdleFor, stopIdleFor, restartIdleFor } from '../imap/idle-manager';

export interface AddAccountInput {
  email: string;
  password: string;
  /** 可选：同时保存的附加信息（Google 密码 / 2FA / 辅邮 / 链接） */
  info?: AccountInfo;
}

export interface AddAccountResult {
  ok: boolean;
  email?: string;
  error?: string;
}

export interface VerifyResult {
  ok: boolean;
  error?: string;
}

function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}

function normalizePassword(s: string): string {
  // Google 生成的应用密码带空格，IMAP 登录时不能带——去掉所有空白
  return s.replace(/\s+/g, '');
}

function validateInput(input: AddAccountInput): string | null {
  const email = normalizeEmail(input.email);
  const pass = normalizePassword(input.password);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return '邮箱格式不正确';
  if (pass.length < 16) return '应用密码长度不对（应为 16 位字符）';
  return null;
}

async function handleVerify(input: AddAccountInput): Promise<VerifyResult> {
  const err = validateInput(input);
  if (err) return { ok: false, error: err };
  return verifyCredentials(normalizeEmail(input.email), normalizePassword(input.password));
}

async function handleAdd(input: AddAccountInput): Promise<AddAccountResult> {
  const validationErr = validateInput(input);
  if (validationErr) return { ok: false, error: validationErr };

  const email = normalizeEmail(input.email);
  const password = normalizePassword(input.password);

  const verify = await verifyCredentials(email, password);
  if (!verify.ok) return { ok: false, error: verify.error };

  repo.insertAccount(email);
  await keychain.setPassword(email, password);
  if (input.info) {
    await keychain.setAccountInfo(email, input.info);
  }

  await syncAccount(email, MESSAGES_PER_ACCOUNT);
  void startIdleFor(email); // 启动实时 IDLE 连接
  return { ok: true, email };
}

async function handleUpdatePassword(input: AddAccountInput): Promise<AddAccountResult> {
  // 重新设置某个已有账号的应用密码（比如过期后换新）
  const validationErr = validateInput(input);
  if (validationErr) return { ok: false, error: validationErr };

  const email = normalizeEmail(input.email);
  const password = normalizePassword(input.password);

  const verify = await verifyCredentials(email, password);
  if (!verify.ok) return { ok: false, error: verify.error };

  await keychain.setPassword(email, password);
  if (input.info) {
    await keychain.setAccountInfo(email, input.info);
  }
  repo.updateSyncStatus(email, 'ok');
  await syncAccount(email, MESSAGES_PER_ACCOUNT);
  void restartIdleFor(email); // 用新密码重连 IDLE
  return { ok: true, email };
}

async function handleRemove(email: string): Promise<void> {
  await stopIdleFor(email); // 先断 IDLE 连接
  await keychain.deletePassword(email);
  await keychain.deleteAccountInfo(email);
  repo.deleteAccount(email);
}

async function handleGetCredentials(email: string): Promise<AccountCredentials> {
  const [appPass, info] = await Promise.all([
    keychain.getPassword(email),
    keychain.getAccountInfo(email),
  ]);
  return {
    email,
    appPassword: appPass ?? undefined,
    googlePassword: info?.googlePassword,
    totpSecret: info?.totpSecret,
    recoveryEmail: info?.recoveryEmail,
    link: info?.link,
  };
}

async function handleSetInfo(email: string, info: AccountInfo): Promise<void> {
  await keychain.setAccountInfo(email, info);
}

export function registerAccountsIpc(): void {
  ipcMain.handle(IpcChannels.Accounts.List, () => repo.listAccounts());
  ipcMain.handle(IpcChannels.Accounts.Verify, (_e, input: AddAccountInput) => handleVerify(input));
  ipcMain.handle(IpcChannels.Accounts.Add, (_e, input: AddAccountInput) => handleAdd(input));
  ipcMain.handle(IpcChannels.Accounts.UpdatePassword, (_e, input: AddAccountInput) =>
    handleUpdatePassword(input),
  );
  ipcMain.handle(IpcChannels.Accounts.GetCredentials, (_e, email: string) =>
    handleGetCredentials(email),
  );
  ipcMain.handle(IpcChannels.Accounts.SetInfo, (_e, email: string, info: AccountInfo) =>
    handleSetInfo(email, info),
  );
  ipcMain.handle(IpcChannels.Accounts.Remove, async (_e, email: string) => {
    const confirmed = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['取消', '确认移除'],
      defaultId: 0,
      cancelId: 0,
      title: '移除账号',
      message: `确定要移除 ${email} 吗？`,
      detail: '本地缓存邮件和应用密码会被删除。你仍可以在 Google 账号设置里手动撤销该应用密码。',
    });
    if (confirmed.response !== 1) return { ok: false, code: 'cancelled' };
    await handleRemove(email);
    return { ok: true };
  });
}
