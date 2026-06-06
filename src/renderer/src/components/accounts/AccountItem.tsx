import { useState } from 'react';
import type { Account } from '../../../../shared/types';
import { useStore } from '../../store';
import Avatar from '../common/Avatar';
import { MoreHorizontal, RefreshCw, Trash2, KeyRound } from 'lucide-react';

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
            <StatusBadge
              refreshing={refreshing}
              expired={isExpired}
              error={isError}
              ok={account.lastSyncStatus === 'ok'}
              selected={isSelected}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className={`truncate text-[13px] font-medium leading-tight ${
                isSelected ? 'text-accent' : 'text-text'
              }`}
            >
              {username}
            </div>
            <div className="truncate text-[11px] text-muted">@{domain}</div>
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
              onClick={onUpdate}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-2"
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
