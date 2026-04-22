import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { join } from 'node:path';
import { IpcChannels } from '../shared/ipc-channels';
import { getDb, closeDb } from './storage/db';
import { registerAccountsIpc } from './ipc/accounts';

const isDev = !app.isPackaged;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fafafa',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.on('ready-to-show', () => win.show());

  // 外部链接走系统浏览器，不在 App 内打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function registerIpc(): void {
  ipcMain.handle(IpcChannels.System.Ping, () => 'pong');
  registerAccountsIpc();
}

app.whenReady().then(() => {
  // 惰性初始化数据库（getDb 内部会建表）。显式调用一次让启动时就把 DB 文件创建出来，方便排查
  getDb();
  registerIpc();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  closeDb();
});
