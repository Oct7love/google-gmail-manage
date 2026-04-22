import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';

const api = {
  system: {
    ping: (): Promise<string> => ipcRenderer.invoke(IpcChannels.System.Ping),
  },
};

contextBridge.exposeInMainWorld('api', api);

export type Api = typeof api;
