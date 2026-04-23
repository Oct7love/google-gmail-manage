// 主进程与渲染进程共享的类型定义

/** 账号同步状态 */
export type SyncStatus = 'ok' | 'expired' | 'error';

/** 单个已绑定 Gmail 账号（暴露给 UI 的形态） */
export interface Account {
  email: string;
  displayOrder: number;
  addedAt: number;
  lastSyncedAt: number | null;
  lastSyncStatus: SyncStatus | null;
  lastSyncError: string | null;
}

/** 邮件列表项（中栏显示用，无正文） */
export interface MessageSummary {
  accountEmail: string;
  messageId: string;
  threadId: string | null;
  subject: string;
  fromAddr: string;
  dateTs: number;
  snippet: string;
  fetchedAt: number;
}

/** 邮件详情（点开某封才拉的完整数据） */
export interface MessageDetail extends MessageSummary {
  bodyHtml: string | null;
  bodyText: string | null;
}

/** 刷新事件（后台刷新时 main → renderer 推送） */
export interface RefreshEvent {
  email: string;
  phase: 'start' | 'done' | 'error' | 'expired';
  /** 本次同步新拉到的邮件数（仅 phase='done' 时有值） */
  newCount?: number;
  error?: string;
}
