import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels';
import * as repo from '../storage/messages-repo';
import { syncAccount, SyncResult } from '../sync';

export function registerMessagesIpc(): void {
  ipcMain.handle(IpcChannels.Messages.List, (_e, email: string, limit: number) =>
    repo.getLatestMessages(email, limit),
  );

  ipcMain.handle(IpcChannels.Messages.Detail, (_e, email: string, id: string) =>
    repo.getMessageDetail(email, id),
  );

  ipcMain.handle(
    IpcChannels.Messages.Sync,
    async (_e, email: string, max: number): Promise<SyncResult> => syncAccount(email, max),
  );
}
