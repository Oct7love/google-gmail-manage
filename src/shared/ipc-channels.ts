// 所有 IPC channel 名字集中在这里，preload 和 main 共用
export const IpcChannels = {
  System: {
    Ping: 'system:ping',
  },
  Accounts: {
    List: 'accounts:list',
  },
} as const;
