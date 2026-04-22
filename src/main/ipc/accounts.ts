import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels';
import * as repo from '../storage/accounts-repo';

export function registerAccountsIpc(): void {
  ipcMain.handle(IpcChannels.Accounts.List, () => repo.listAccounts());
}
