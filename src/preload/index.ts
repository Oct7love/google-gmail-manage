import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';
import type {
  Account,
  Credentials,
  MessageDetail,
  MessageSummary,
} from '../shared/types';

export interface CredentialsStatus {
  configured: boolean;
}

export interface SetCredentialsResult {
  ok: boolean;
  error?: string;
}

export interface AddAccountResult {
  ok: boolean;
  email?: string;
  code?: string;
  error?: string;
}

export interface SyncResult {
  email: string;
  fetched: number;
  status: 'ok' | 'expired' | 'error';
  error?: string;
}

const api = {
  system: {
    ping: (): Promise<string> => ipcRenderer.invoke(IpcChannels.System.Ping),
  },
  accounts: {
    list: (): Promise<Account[]> => ipcRenderer.invoke(IpcChannels.Accounts.List),
    add: (): Promise<AddAccountResult> => ipcRenderer.invoke(IpcChannels.Accounts.Add),
    reauth: (): Promise<AddAccountResult> => ipcRenderer.invoke(IpcChannels.Accounts.Reauth),
    remove: (email: string): Promise<{ ok: boolean; code?: string }> =>
      ipcRenderer.invoke(IpcChannels.Accounts.Remove, email),
  },
  messages: {
    list: (email: string, limit: number): Promise<MessageSummary[]> =>
      ipcRenderer.invoke(IpcChannels.Messages.List, email, limit),
    detail: (email: string, id: string): Promise<MessageDetail | null> =>
      ipcRenderer.invoke(IpcChannels.Messages.Detail, email, id),
    sync: (email: string, max = 10): Promise<SyncResult> =>
      ipcRenderer.invoke(IpcChannels.Messages.Sync, email, max),
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
