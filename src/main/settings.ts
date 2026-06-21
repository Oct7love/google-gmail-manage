import { app } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

/**
 * 轻量 App 级别配置（非账号相关，存 userData/settings.json）。
 * 轻量 App 级别配置。
 */
export interface AppSettings {
  /** 新邮件提示音总开关。undefined 视为 true（首次未设置时默认开启）。 */
  soundEnabled?: boolean;
  /** UI 主题预设 ID。undefined 视为 'fog'。 */
  themeId?: import('../shared/types').ThemeId;
}

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
