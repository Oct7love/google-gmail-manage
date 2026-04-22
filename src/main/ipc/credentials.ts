import { ipcMain } from 'electron';
import { IpcChannels } from '../../shared/ipc-channels';
import * as keychain from '../keychain';
import type { Credentials } from '../../shared/types';

export interface CredentialsStatus {
  configured: boolean;
}

export interface SetCredentialsResult {
  ok: boolean;
  error?: string;
}

function validate(input: Partial<Credentials>): string | null {
  const clientId = (input.clientId ?? '').trim();
  const clientSecret = (input.clientSecret ?? '').trim();
  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    return 'Client ID 格式有误（应以 .apps.googleusercontent.com 结尾）';
  }
  if (clientSecret.length < 10) {
    return 'Client Secret 不能为空或过短';
  }
  return null;
}

export function registerCredentialsIpc(): void {
  ipcMain.handle(IpcChannels.Credentials.Status, async (): Promise<CredentialsStatus> => {
    const creds = await keychain.getCredentials();
    return { configured: creds !== null };
  });

  ipcMain.handle(
    IpcChannels.Credentials.Set,
    async (_e, input: Credentials): Promise<SetCredentialsResult> => {
      const error = validate(input);
      if (error) return { ok: false, error };
      await keychain.setCredentials({
        clientId: input.clientId.trim(),
        clientSecret: input.clientSecret.trim(),
      });
      return { ok: true };
    },
  );

  ipcMain.handle(IpcChannels.Credentials.Clear, async (): Promise<void> => {
    await keychain.clearCredentials();
  });
}
