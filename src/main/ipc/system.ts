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

  // 拉取短信验证码代收 URL 的返回（给账号绑定的 link 字段用）
  ipcMain.handle(
    IpcChannels.System.FetchSmsCode,
    async (_e, url: string): Promise<{ ok: boolean; code?: string; raw?: string; error?: string }> => {
      try {
        if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'URL 必须是 http:// 或 https://' };
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            Accept: '*/*',
          },
          redirect: 'follow',
        });
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        const text = (await res.text()).trim();
        // 提取第一个 4-8 位连续数字作为验证码
        const match = text.match(/\b(\d{4,8})\b/);
        return {
          ok: true,
          code: match ? match[1] : undefined,
          raw: text.slice(0, 200),
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, error: msg };
      }
    },
  );
}
