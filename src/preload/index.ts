import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';
import type { Account } from '../shared/types';

const api = {
  system: {
    ping: (): Promise<string> => ipcRenderer.invoke(IpcChannels.System.Ping),
  },
  accounts: {
    list: (): Promise<Account[]> => ipcRenderer.invoke(IpcChannels.Accounts.List),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
