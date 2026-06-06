// 主进程与渲染进程共享的类型定义

/** 账号同步状态 */
export type SyncStatus = 'ok' | 'expired' | 'error';

/** 用户给账号打的业务标记（互斥单状态，null=未标记）。与同步状态无关。 */
export type AccountMark = 'refunded' | 'warning';

/** 单个已绑定 Gmail 账号（暴露给 UI 的形态） */
export interface Account {
  email: string;
  displayOrder: number;
  addedAt: number;
  lastSyncedAt: number | null;
  lastSyncStatus: SyncStatus | null;
  lastSyncError: string | null;
  /** 用户业务标记：已退款 / 有警告 / 未标记 */
  mark: AccountMark | null;
  /** 是否归档（归档=断持久连接、不自动收信，但可手动刷新、缓存只读可看） */
  archived: boolean;
  /** 手动记录的"上号时间"，毫秒时间戳，null=未填 */
  startedAt: number | null;
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

/** 账号附加信息（可选字段，用户粘贴解析或手动录入） */
export interface AccountInfo {
  /** Google 登录密码（不是应用专用密码） */
  googlePassword?: string;
  /** 2FA 密钥（base32 或 otpauth:// URI） */
  totpSecret?: string;
  /** 辅助邮箱 */
  recoveryEmail?: string;
  /** 备用链接 */
  link?: string;
}

/** 查看账号凭据时返回的完整 bundle */
export interface AccountCredentials extends AccountInfo {
  email: string;
  /** 应用专用密码（IMAP 用） */
  appPassword?: string;
}

/** 刷新事件（后台刷新时 main → renderer 推送） */
export interface RefreshEvent {
  email: string;
  phase: 'start' | 'done' | 'error' | 'expired';
  /** 本次同步新拉到的邮件数（仅 phase='done' 时有值） */
  newCount?: number;
  error?: string;
  /** 本次同步是否静默触发（启动追赶、睡眠唤醒等），主进程用于决定是否播提示音 */
  silent?: boolean;
}

/** 可选主题预设。默认 'cream'。 */
export type ThemeId = 'cream' | 'slate' | 'onyx';
