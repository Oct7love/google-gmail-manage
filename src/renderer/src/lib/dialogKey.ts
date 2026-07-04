import type { DialogMode } from '../store';

/**
 * 给账号弹窗算一个实例 key。
 * 不同目标（new / update:某账号）→ 不同 key，切换目标时 React 强制 remount，
 * 配合"关闭即卸载"彻底避免上一个账号的 imported/2FA/密码残留串进下一个账号。
 */
export function dialogInstanceKey(mode: DialogMode): string {
  if (mode === null) return 'closed';
  if (mode === 'new') return 'new';
  return `update:${mode.update}`;
}
