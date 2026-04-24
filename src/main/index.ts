import { app, BrowserWindow, powerMonitor, shell } from 'electron';
import { join } from 'node:path';

// 在 app.whenReady 之前关掉 GPU 硬件加速：
// 我们 UI 是静态三栏 + 偶尔滚动，不需要 GPU 合成。
// 关掉能去掉一整个独立的 GPU 进程（省约 80MB）。
app.disableHardwareAcceleration();

// 防崩：IMAP 持久连接偶尔会抛异步错误（socket timeout / TLS 断开等），
// imapflow 在 setTimeout 回调里 emit，没走 await 链，没人接就变成 Uncaught Exception。
// 已经给每个 client 加了 'error' 监听，这里是兜底，防止任何遗漏导致弹窗。
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('[unhandledRejection]', reason);
});
import { getDb, closeDb } from './storage/db';
import { registerAccountsIpc } from './ipc/accounts';
import { registerMessagesIpc } from './ipc/messages';
import { registerRefreshIpc } from './ipc/refresh';
import { registerSystemIpc } from './ipc/system';
import { registerTranslationIpc } from './ipc/translation';
import { startAutoRefresh, stopAutoRefresh } from './scheduler/auto-refresh';
import { startAllIdle, stopAllIdle, reconnectAll } from './imap/idle-manager';
import { applyWebviewProxy, loadSettings } from './settings';

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
      spellcheck: false, // 我们不做输入，省字典缓存
      backgroundThrottling: false, // 窗口不在前台时保持 IDLE 连接活跃
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
  // 应用已保存的 webview 代理（如果用户配置过）
  void applyWebviewProxy(loadSettings().webviewProxy);
  createWindow();
  startAutoRefresh(); // 1h 兜底轮询
  startAllIdle(); // 实时 IMAP IDLE 推送

  // 电脑睡眠/唤醒时强制重连所有 IDLE 连接
  powerMonitor.on('resume', () => {
    // eslint-disable-next-line no-console
    console.log('[main] system resume → reconnecting all idle sessions');
    reconnectAll();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  stopAutoRefresh();
  await stopAllIdle();
  closeDb();
});
