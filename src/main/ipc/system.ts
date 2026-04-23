import { ipcMain, shell } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels';

export function registerSystemIpc(): void {
  ipcMain.handle(IpcChannels.System.Ping, () => 'pong');
  ipcMain.handle(IpcChannels.System.OpenAppPasswordPage, () => {
    // Google 的应用专用密码生成页。登录状态下直接可用。
    return shell.openExternal('https://myaccount.google.com/apppasswords');
  });
}
