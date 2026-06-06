import { useState } from 'react';
import type { Account, AccountMark } from '../../../../shared/types';
import { useStore } from '../../store';
import Avatar from '../common/Avatar';
import {
  MoreHorizontal,
  RefreshCw,
  Trash2,
  KeyRound,
  BadgeCheck,
  AlertTriangle,
  Tag,
  Check,
  Archive,
  ArchiveRestore,
  Clock,
} from 'lucide-react';

interface Props {
  account: Account;
}

export default function AccountItem({ account }: Props): JSX.Element {
  const selectedEmail = useStore((s) => s.selectedEmail);
  const refreshing = useStore((s) => s.refreshingEmails.has(account.email));
  const newCount = useStore((s) => s.recentNewByEmail[account.email] ?? 0);
  const selectAccount = useStore((s) => s.selectAccount);
  const removeAccount = useStore((s) => s.removeAccount);
  const openUpdateDialog = useStore((s) => s.openUpdateDialog);
  const setMark = useStore((s) => s.setMark);
  const setArchived = useStore((s) => s.setArchived);
  const setStartedAt = useStore((s) => s.setStartedAt);

  const [menuOpen, setMenuOpen] = useState(false);
  const isSelected = selectedEmail === account.email;
  const isExpired = account.lastSyncStatus === 'expired';
  const isError = account.lastSyncStatus === 'error';

  const username = account.email.split('@')[0];
  const domain = account.email.split('@')[1];

  const onSelect = async (): Promise<void> => {
    if (isExpired) {
      openUpdateDialog(account.email);
      return;
    }
    await selectAccount(account.email);
  };

  const onRemove = async (): Promise<void> => {
    setMenuOpen(false);
    await removeAccount(account.email);
  };

  const onUpdate = (): void => {
    setMenuOpen(false);
    openUpdateDialog(account.email);
  };

  const onMark = (mark: AccountMark | null): void => {
    setMenuOpen(false);
    void setMark(account.email, mark);
  };

  const onToggleArchive = (): void => {
    setMenuOpen(false);
    void setArchived(account.email, !account.archived);
  };

  const onRecordStartedAt = (): void => {
    setMenuOpen(false);
    void setStartedAt(account.email, Date.now());
  };

  return (
    <li className="relative">
      <div
        className={`group flex items-center gap-2.5 rounded-lg pl-2 pr-1 py-1.5 transition-colors ${
          isSelected ? 'bg-surface shadow-card ring-1 ring-accent/15' : 'hover:bg-surface-2'
        }`}
      >
        <button
          type="button"
          onClick={() => void onSelect()}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
          title={account.email + (isExpired ? '（密码失效，点击更新）' : '')}
        >
          <div className="relative shrink-0">
            <Avatar identityKey={account.email} label={account.email} size={28} />
            {account.archived ? (
              <span
                className="absolute -bottom-0.5 -right-0.5 inline-block h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-muted-2"
                title="已归档"
              />
            ) : (
              <StatusBadge
                refreshing={refreshing}
                expired={isExpired}
                error={isError}
                ok={account.lastSyncStatus === 'ok'}
                selected={isSelected}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span
                className={`min-w-0 truncate text-[13px] font-medium leading-tight ${
                  isSelected ? 'text-accent' : 'text-text'
                }`}
              >
                {username}
              </span>
              {account.mark && <MarkPill mark={account.mark} />}
            </div>
            <div className="flex items-center gap-1">
              <span className="min-w-0 truncate text-[11px] text-muted">@{domain}</span>
              {account.startedAt != null && (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-accent-soft px-1 text-[10px] font-medium leading-tight text-accent">
                  <Clock size={9} />
                  {formatStartedAt(account.startedAt)}
                </span>
              )}
            </div>
          </div>
          {newCount > 0 && (
            <span
              className="shrink-0 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white shadow-card"
              title={`${newCount} 封新邮件`}
            >
              +{newCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-surface-2 group-hover:opacity-100"
          aria-label="更多操作"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-2 top-11 z-40 w-44 overflow-hidden rounded-lg border border-border bg-surface shadow-popover">
            <button
              type="button"
              onClick={() => onMark('refunded')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-2"
            >
              <BadgeCheck size={12} className="text-success" />
              标记已退款
              {account.mark === 'refunded' && <Check size={12} className="ml-auto text-accent" />}
            </button>
            <button
              type="button"
              onClick={() => onMark('warning')}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-2"
            >
              <AlertTriangle size={12} className="text-warning" />
              标记有警告
              {account.mark === 'warning' && <Check size={12} className="ml-auto text-accent" />}
            </button>
            {account.mark && (
              <button
                type="button"
                onClick={() => onMark(null)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted hover:bg-surface-2"
              >
                <Tag size={12} />
                清除标记
              </button>
            )}
            <button
              type="button"
              onClick={onToggleArchive}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs hover:bg-surface-2"
            >
              {account.archived ? (
                <ArchiveRestore size={12} className="text-muted" />
              ) : (
                <Archive size={12} className="text-muted" />
              )}
              {account.archived ? '取消归档' : '归档账号'}
            </button>
            <button
              type="button"
              onClick={onRecordStartedAt}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-2"
            >
              <Clock size={12} className="text-muted" />
              记录上号时间
            </button>
            <button
              type="button"
              onClick={onUpdate}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs hover:bg-surface-2"
            >
              <KeyRound size={12} className="text-muted" />
              更新应用密码
            </button>
            <button
              type="button"
              onClick={() => void onRemove()}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-danger hover:bg-surface-2"
            >
              <Trash2 size={12} />
              移除账号
            </button>
          </div>
        </>
      )}
    </li>
  );
}

function formatStartedAt(ts: number): string {
  // 只精确到小时（向下取整到整点显示）
  const d = new Date(ts);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  return `${mm}/${dd} ${hh}点`;
}

function MarkPill({ mark }: { mark: AccountMark }): JSX.Element {
  if (mark === 'refunded') {
    return (
      <span className="shrink-0 rounded-full bg-success/15 px-1.5 py-px text-[10px] font-medium leading-tight text-success">
        已退款
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-warning/15 px-1.5 py-px text-[10px] font-medium leading-tight text-warning">
      <AlertTriangle size={9} />
      警告
    </span>
  );
}

function StatusBadge({
  refreshing,
  expired,
  error,
  ok,
  selected,
}: {
  refreshing: boolean;
  expired: boolean;
  error: boolean;
  ok: boolean;
  selected: boolean;
}): JSX.Element | null {
  if (!expired && !error && !refreshing && !ok) return null;
  if (refreshing) {
    return (
      <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-surface shadow ring-1 ring-border">
        <RefreshCw size={8} className="animate-spin text-accent" />
      </span>
    );
  }
  // 正常态(ok)用收敛的小绿点；异常(expired/error)稍大更跳。描边色跟随所在行底色：
  // 选中行底是 bg-surface(白)，未选中是 bg-sidebar——否则选中行会出现一圈脏色描边环。
  let color = 'bg-success';
  let size = 'h-2 w-2';
  if (expired) {
    color = 'bg-warning';
    size = 'h-2.5 w-2.5';
  } else if (error) {
    color = 'bg-danger';
    size = 'h-2.5 w-2.5';
  }
  return (
    <span
      className={`absolute -bottom-0.5 -right-0.5 inline-block ${size} rounded-full border-2 ${
        selected ? 'border-surface' : 'border-sidebar'
      } ${color}`}
    />
  );
}
