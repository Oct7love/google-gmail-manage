import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const APP_PASSWORD_URL = 'https://myaccount.google.com/apppasswords';
const CHROME_EXECUTABLE = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export interface ChromeLaunchResult {
  ok: boolean;
  error?: string;
}

export type CommandRunner = (command: string, args: readonly string[]) => Promise<void>;

const execFileAsync = promisify(execFile);

const runCommand: CommandRunner = async (command, args) => {
  await execFileAsync(command, [...args]);
};

export async function openAppPasswordInIncognitoChrome(
  run: CommandRunner = runCommand,
): Promise<ChromeLaunchResult> {
  try {
    await run(CHROME_EXECUTABLE, ['--incognito', APP_PASSWORD_URL]);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `无法打开 Google Chrome：${message}` };
  }
}
