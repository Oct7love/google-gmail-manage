import { ipcMain, shell } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels';
import { loadSettings, saveSettings, applyWebviewProxy, AppSettings } from '../settings';
import { getLogPath } from '../logger';

export function registerSystemIpc(): void {
  ipcMain.handle(IpcChannels.System.Ping, () => 'pong');
  ipcMain.handle(IpcChannels.System.OpenAppPasswordPage, () => {
    return shell.openExternal('https://myaccount.google.com/apppasswords');
  });

  // 打开日志文件夹方便排查
  ipcMain.handle('system:openLogFolder', () => {
    const path = getLogPath();
    if (path) shell.showItemInFolder(path);
  });

  ipcMain.handle(IpcChannels.System.GetSettings, (): AppSettings => loadSettings());

  ipcMain.handle(
    IpcChannels.System.SetSettings,
    async (_e, next: AppSettings): Promise<AppSettings> => {
      const current = loadSettings();
      const merged: AppSettings = { ...current, ...next };
      saveSettings(merged);
      if ('webviewProxy' in next) {
        await applyWebviewProxy(merged.webviewProxy);
      }
      return merged;
    },
  );
}
