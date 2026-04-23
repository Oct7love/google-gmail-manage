import { app, session } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

/**
 * 轻量 App 级别配置（非账号相关，存 userData/settings.json）。
 * 当前只存一个字段：webview 代理。
 */
export interface AppSettings {
  /** 仅用于添加账号对话框的内嵌 Google webview。格式如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080 */
  webviewProxy?: string;
}

const WEBVIEW_PARTITION = 'persist:google-apppasswords';

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(): AppSettings {
  const p = getSettingsPath();
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, 'utf-8')) as AppSettings;
  } catch {
    return {};
  }
}

export function saveSettings(s: AppSettings): void {
  const p = getSettingsPath();
  const dir = dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(p, JSON.stringify(s, null, 2), 'utf-8');
}

/** 把 settings 里的代理应用到 webview 的 session 上 */
export async function applyWebviewProxy(proxy: string | undefined): Promise<void> {
  const ses = session.fromPartition(WEBVIEW_PARTITION);
  if (!proxy || !proxy.trim()) {
    await ses.setProxy({ mode: 'direct' });
    return;
  }
  const rules = proxy.trim();
  // setProxy 接受 proxyRules 格式：scheme=host:port 或 host:port
  // 我们把单一地址转成 http+https 都走它
  let proxyRules = rules;
  if (!/=|;/.test(rules)) {
    // 用户只给了一个地址，统一对 http/https 生效
    proxyRules = `http=${stripScheme(rules)};https=${stripScheme(rules)}`;
  }
  await ses.setProxy({ proxyRules });
}

function stripScheme(url: string): string {
  return url.replace(/^(https?|socks5?):\/\//, '');
}
