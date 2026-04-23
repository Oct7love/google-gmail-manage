import { app, BrowserWindow, shell } from 'electron';
import { join } from 'node:path';
import { getDb, closeDb } from './storage/db';
import { registerAccountsIpc } from './ipc/accounts';
import { registerMessagesIpc } from './ipc/messages';
import { registerRefreshIpc } from './ipc/refresh';
import { registerSystemIpc } from './ipc/system';
import { registerTranslationIpc } from './ipc/translation';
import { startAutoRefresh, stopAutoRefresh } from './scheduler/auto-refresh';

const isDev = !app.isPackaged;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 620,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#fafafa',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true, // 让 AddAccountDialog 里能内嵌 Google 密码生成页
    },
  });

  win.on('ready-to-show', () => win.show());
  // DevTools 按需打开：⌘⌥I 组合键（dev / production 都生效）
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.meta && input.alt && input.key.toLowerCase() === 'i') {
      win.webContents.toggleDevTools();
    }
  });

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
  registerSystemIpc();
  registerAccountsIpc();
  registerMessagesIpc();
  registerRefreshIpc();
  registerTranslationIpc();
}

app.whenReady().then(() => {
  // 惰性初始化数据库（getDb 内部会建表）。显式调用一次让启动时就把 DB 文件创建出来，方便排查
  getDb();
  registerIpc();
  createWindow();
  startAutoRefresh();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopAutoRefresh();
  closeDb();
});
