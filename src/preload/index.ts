import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';
import type {
  Account,
  AccountCredentials,
  AccountInfo,
  MessageDetail,
  MessageSummary,
  RefreshEvent,
} from '../shared/types';

export interface AddAccountInput {
  email: string;
  password: string;
  info?: AccountInfo;
}

export interface AddAccountResult {
  ok: boolean;
  email?: string;
  error?: string;
}

export interface VerifyResult {
  ok: boolean;
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
    openAppPasswordPage: (): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.System.OpenAppPasswordPage),
    getSettings: (): Promise<{ webviewProxy?: string }> =>
      ipcRenderer.invoke(IpcChannels.System.GetSettings),
    setSettings: (next: { webviewProxy?: string }): Promise<{ webviewProxy?: string }> =>
      ipcRenderer.invoke(IpcChannels.System.SetSettings, next),
  },
  accounts: {
    list: (): Promise<Account[]> => ipcRenderer.invoke(IpcChannels.Accounts.List),
    verify: (input: AddAccountInput): Promise<VerifyResult> =>
      ipcRenderer.invoke(IpcChannels.Accounts.Verify, input),
    add: (input: AddAccountInput): Promise<AddAccountResult> =>
      ipcRenderer.invoke(IpcChannels.Accounts.Add, input),
    updatePassword: (input: AddAccountInput): Promise<AddAccountResult> =>
      ipcRenderer.invoke(IpcChannels.Accounts.UpdatePassword, input),
    remove: (email: string): Promise<{ ok: boolean; code?: string }> =>
      ipcRenderer.invoke(IpcChannels.Accounts.Remove, email),
    getCredentials: (email: string): Promise<AccountCredentials> =>
      ipcRenderer.invoke(IpcChannels.Accounts.GetCredentials, email),
    setInfo: (email: string, info: AccountInfo): Promise<void> =>
      ipcRenderer.invoke(IpcChannels.Accounts.SetInfo, email, info),
  },
  messages: {
    list: (email: string, limit: number): Promise<MessageSummary[]> =>
      ipcRenderer.invoke(IpcChannels.Messages.List, email, limit),
    detail: (email: string, id: string): Promise<MessageDetail | null> =>
      ipcRenderer.invoke(IpcChannels.Messages.Detail, email, id),
    sync: (email: string, max = 10): Promise<SyncResult> =>
      ipcRenderer.invoke(IpcChannels.Messages.Sync, email, max),
  },
  refresh: {
    all: (): Promise<SyncResult[]> => ipcRenderer.invoke(IpcChannels.Refresh.All),
    onProgress: (cb: (evt: RefreshEvent) => void): (() => void) => {
      const listener = (_e: unknown, evt: RefreshEvent): void => cb(evt);
      ipcRenderer.on(IpcChannels.Refresh.Progress, listener);
      return () => ipcRenderer.removeListener(IpcChannels.Refresh.Progress, listener);
    },
  },
  translation: {
    translate: (text: string): Promise<{ ok: boolean; text?: string; error?: string }> =>
      ipcRenderer.invoke(IpcChannels.Translation.Translate, text),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
