import { ipcMain, shell } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels';
import { loadSettings, saveSettings, AppSettings } from '../settings';
import { getLogPath } from '../logger';
import { openAppPasswordInIncognitoChrome } from '../system/chrome-launcher';

export function registerSystemIpc(): void {
  ipcMain.handle(IpcChannels.System.Ping, () => 'pong');
  ipcMain.handle(IpcChannels.System.OpenAppPasswordPage, () => {
    return openAppPasswordInIncognitoChrome();
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

  // 手机号接码（luugpm.cloud 两步式）：
  //   ① request_phone?number=手机号 → JSON 数组 [otpId, 显示手机号]
  //   ② request_code?otpId=xxx     → 纯文本验证码（没到就是空）
  ipcMain.handle(
    IpcChannels.System.RequestPhoneOtp,
    async (
      _e,
      number: string,
    ): Promise<{ ok: boolean; otpId?: string; phone?: string; error?: string }> => {
      try {
        const n = (number || '').trim();
        if (!/^\+?\d{6,15}$/.test(n)) return { ok: false, error: '手机号格式不对（只填数字）' };
        const res = await fetch(`${OTP_BASE}/public/request_phone?number=${encodeURIComponent(n)}`, {
          headers: { 'User-Agent': OTP_UA, Accept: '*/*' },
        });
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        const data = (await res.json()) as unknown;
        if (Array.isArray(data) && data[0]) {
          return { ok: true, otpId: String(data[0]), phone: data[1] != null ? String(data[1]) : n };
        }
        return { ok: false, error: '没取到 session（号码可能不可用）' };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  );

  ipcMain.handle(
    IpcChannels.System.FetchPhoneOtpCode,
    async (_e, otpId: string): Promise<{ ok: boolean; code?: string; error?: string }> => {
      try {
        const id = (otpId || '').trim();
        if (!id) return { ok: false, error: '缺少 otpId' };
        const res = await fetch(`${OTP_BASE}/public/request_code?otpId=${encodeURIComponent(id)}`, {
          headers: { 'User-Agent': OTP_UA, Accept: '*/*' },
        });
        if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
        const code = (await res.text()).trim();
        // 空 = 验证码还没到，调用方继续轮询
        return { ok: true, code: code || undefined };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  );
}

// 手机号接码服务地址（如换站只改这里）
const OTP_BASE = 'http://luugpm.cloud';
const OTP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
