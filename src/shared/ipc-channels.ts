// 所有 IPC channel 名字集中在这里，preload 和 main 共用
export const IpcChannels = {
  System: {
    Ping: 'system:ping',
    OpenAppPasswordPage: 'system:openAppPasswordPage',
  },
  Accounts: {
    List: 'accounts:list',
    Add: 'accounts:add',
    Remove: 'accounts:remove',
    Verify: 'accounts:verify',
    UpdatePassword: 'accounts:updatePassword',
  },
  Messages: {
    List: 'messages:list',
    Detail: 'messages:detail',
    Sync: 'messages:sync',
  },
  Refresh: {
    All: 'refresh:all',
    Progress: 'refresh:progress',
  },
  Translation: {
    Translate: 'translation:translate',
  },
} as const;
