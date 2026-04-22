// 所有 IPC channel 名字集中在这里，preload 和 main 共用
export const IpcChannels = {
  System: {
    Ping: 'system:ping',
  },
  Accounts: {
    List: 'accounts:list',
    Add: 'accounts:add',
    Remove: 'accounts:remove',
    Reauth: 'accounts:reauth',
  },
  Messages: {
    List: 'messages:list',
    Detail: 'messages:detail',
    Sync: 'messages:sync',
  },
  Credentials: {
    /** 只返回 { configured: boolean }，不返回实际值 */
    Status: 'credentials:status',
    Set: 'credentials:set',
    Clear: 'credentials:clear',
  },
} as const;
