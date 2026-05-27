import { spawn } from 'node:child_process';
import { log as fileLog } from './logger';

/**
 * 跨平台播放系统提示音。
 *
 * 设计要点：
 * - 不读 settings：是否播由调用方判断（保持模块单一职责）
 * - 串行队列：同一刻多次调用按顺序排队，声音不会重叠
 * - 超时兜底：单次播放最长等 1500ms，避免子进程 hang 卡住队列
 * - 平台支持：darwin 用 afplay 播 Glass.aiff；win32 用 PowerShell SoundPlayer；其它平台不播
 */

const MAC_SOUND_PATH = '/System/Library/Sounds/Glass.aiff';
const WIN_SOUND_PATH = 'C:\\Windows\\Media\\Windows Notify.wav';
const PLAY_TIMEOUT_MS = 1500;

let queue: Promise<void> = Promise.resolve();

function log(msg: string): void {
  fileLog(`[sound] ${msg}`);
}

function playOnce(): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };

    let child: ReturnType<typeof spawn> | null = null;
    try {
      if (process.platform === 'darwin') {
        child = spawn('afplay', [MAC_SOUND_PATH], { stdio: 'ignore' });
      } else if (process.platform === 'win32') {
        const cmd = `(New-Object Media.SoundPlayer '${WIN_SOUND_PATH}').PlaySync()`;
        child = spawn('powershell', ['-NoProfile', '-c', cmd], { stdio: 'ignore' });
      } else {
        done();
        return;
      }
    } catch (err) {
      log(`spawn failed: ${err instanceof Error ? err.message : String(err)}`);
      done();
      return;
    }

    child.on('error', (err) => {
      log(`child error: ${err.message}`);
      done();
    });
    child.on('close', () => done());

    setTimeout(done, PLAY_TIMEOUT_MS);
  });
}

/** 排队播放 N 次系统提示音。串行执行，互不重叠。 */
export function playNotification(times: number): void {
  if (!Number.isFinite(times) || times <= 0) return;
  for (let i = 0; i < times; i++) {
    queue = queue.then(playOnce);
  }
}
