import { app } from 'electron';
import { appendFileSync, existsSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 简单文件日志。写入 userData/logs/main.log。
 * - 每次启动覆盖 main.log.prev 保留上次（方便回看）
 * - 超过 2MB 自动轮转
 */

let inited = false;
let logPath = '';

function init(): void {
  if (inited) return;
  inited = true;
  try {
    const dir = join(app.getPath('userData'), 'logs');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    logPath = join(dir, 'main.log');
    if (existsSync(logPath)) {
      const size = statSync(logPath).size;
      if (size > 2 * 1024 * 1024) {
        // 轮转
        renameSync(logPath, logPath + '.prev');
      }
    }
    log(`--- app start (${new Date().toISOString()}) ---`);
  } catch {
    // 忽略
  }
}

export function log(...parts: unknown[]): void {
  if (!inited) init();
  const line = `[${new Date().toISOString()}] ${parts
    .map((p) => (typeof p === 'string' ? p : JSON.stringify(p)))
    .join(' ')}\n`;
  try {
    appendFileSync(logPath, line);
  } catch {
    // 忽略
  }
  // eslint-disable-next-line no-console
  console.log(...parts);
}

export function getLogPath(): string {
  if (!inited) init();
  return logPath;
}
