import { dialog, ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels';
import * as repo from '../storage/accounts-repo';
import * as keychain from '../keychain';
import { authorize } from '../oauth/flow';
import { revokeToken } from '../gmail/revoke';
import { syncAccount } from '../sync';

export interface AddAccountResult {
  ok: boolean;
  email?: string;
  /** 'cancelled' | 'error' */
  code?: string;
  error?: string;
}

async function handleAdd(): Promise<AddAccountResult> {
  try {
    const { email, tokens } = await authorize();
    repo.insertAccount(email);
    await keychain.setTokens(email, tokens);

    // 首次添加后立刻拉一轮
    await syncAccount(email, 10);

    return { ok: true, email };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'OAUTH_CANCELLED') {
      return { ok: false, code: 'cancelled', error: (err as Error).message };
    }
    return { ok: false, code: 'error', error: (err as Error).message };
  }
}

async function handleRemove(email: string): Promise<void> {
  const existing = await keychain.getTokens(email);
  if (existing) {
    await revokeToken(existing.refreshToken);
  }
  await keychain.deleteTokens(email);
  repo.deleteAccount(email);
}

async function handleReauth(): Promise<AddAccountResult> {
  // 和 add 一样走完整 OAuth，但 upsert 语义（已有行只更新 added_at）
  return handleAdd();
}

export function registerAccountsIpc(): void {
  ipcMain.handle(IpcChannels.Accounts.List, () => repo.listAccounts());
  ipcMain.handle(IpcChannels.Accounts.Add, handleAdd);
  ipcMain.handle(IpcChannels.Accounts.Reauth, handleReauth);
  ipcMain.handle(IpcChannels.Accounts.Remove, async (_e, email: string) => {
    const confirmed = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['取消', '确认移除'],
      defaultId: 0,
      cancelId: 0,
      title: '移除账号',
      message: `确定要移除 ${email} 吗？`,
      detail: '本地缓存邮件会被删除，Google 端授权也会同时被撤销。',
    });
    if (confirmed.response !== 1) return { ok: false, code: 'cancelled' };
    await handleRemove(email);
    return { ok: true };
  });
}
