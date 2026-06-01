/** 每个账号保留/显示的最近邮件数量。调大一点对 API 配额和耗时影响极小。 */
export const MESSAGES_PER_ACCOUNT = 20;

/**
 * 添加账号对话框右侧内嵌 webview 的持久分区名。
 * 主进程（清空 session）和渲染端（webview partition 属性）共用，避免两处写串。
 */
export const GOOGLE_WEBVIEW_PARTITION = 'persist:google-apppasswords';
