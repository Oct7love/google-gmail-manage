import { describe, expect, it, vi } from 'vitest';
import { APP_PASSWORD_URL, openAppPasswordInIncognitoChrome } from './chrome-launcher';

describe('openAppPasswordInIncognitoChrome', () => {
  it('opens the app-password page in a new Chrome incognito instance', async () => {
    const run = vi.fn(async () => undefined);

    const result = await openAppPasswordInIncognitoChrome(run);

    expect(result).toEqual({ ok: true });
    expect(run).toHaveBeenCalledWith(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      [
      '--incognito',
      APP_PASSWORD_URL,
      ],
    );
  });

  it('returns a Chinese error when Chrome cannot be opened', async () => {
    const run = vi.fn(async () => {
      throw new Error('application not found');
    });

    const result = await openAppPasswordInIncognitoChrome(run);

    expect(result).toEqual({
      ok: false,
      error: '无法打开 Google Chrome：application not found',
    });
  });
});
