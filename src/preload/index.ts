import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';
import type { Account, Credentials } from '../shared/types';

export interface CredentialsStatus {
  configured: boolean;
}

export interface SetCredentialsResult {
  ok: boolean;
  error?: string;
}

const api = {
  system: {
    ping: (): Promise<string> => ipcRenderer.invoke(IpcChannels.System.Ping),
  },
  accounts: {
    list: (): Promise<Account[]> => ipcRenderer.invoke(IpcChannels.Accounts.List),
  },
  credentials: {
    status: (): Promise<CredentialsStatus> => ipcRenderer.invoke(IpcChannels.Credentials.Status),
    set: (input: Credentials): Promise<SetCredentialsResult> =>
      ipcRenderer.invoke(IpcChannels.Credentials.Set, input),
    clear: (): Promise<void> => ipcRenderer.invoke(IpcChannels.Credentials.Clear),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
