import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels';
import { refreshAll } from '../scheduler/auto-refresh';

export function registerRefreshIpc(): void {
  ipcMain.handle(IpcChannels.Refresh.All, () => refreshAll());
}
