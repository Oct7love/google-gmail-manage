import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Account, AccountMark } from '../../../../shared/types';
import { useStore } from '../../store';
import { computeMenuPosition } from '../../lib/menuPosition';
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
  // 菜单改用 portal + fixed 定位，脱离左栏的 overflow 滚动区，避免底部账号菜单被裁切
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);

  // 菜单打开后量一次真实高度再定位（下方放不下就向上弹），定位前先藏起来防止闪一下
  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPos(null);
      return;
    }
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const pos = computeMenuPosition({
      rect: trigger.getBoundingClientRect(),
      viewportW: window.innerWidth,
      viewportH: window.innerHeight,
      menuW: menu.offsetWidth || 176,
      menuH: menu.offsetHeight,
    });
    setMenuPos({ left: pos.left, top: pos.top });
  }, [menuOpen]);

  // 滚动/缩放会让 fixed 定位失效，直接关掉菜单（用户重新点开即可）
  useEffect(() => {
    if (!menuOpen) return;
    const close = (): void => setMenuOpen(false);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true); // capture：含左栏内部滚动
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [menuOpen]);

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
        className={`group flex items-center gap-2 rounded-lg pl-2 pr-1 py-1 transition-colors duration-150 ease-out ${
          isSelected ? 'bg-surface shadow-card ring-1 ring-accent/15' : 'hover:bg-surface-2'
        }`}
      >
        <button
          type="button"
          onClick={() => void onSelect()}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          title={account.email + (isExpired ? '（密码失效，点击更新）' : '')}
        >
          <div className="relative shrink-0">
            <Avatar identityKey={account.email} label={account.email} size={26} />
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
                className={`min-w-0 truncate text-[12.5px] font-medium leading-tight ${
                  isSelected ? 'text-accent' : 'text-text'
                }`}
              >
                {username}
              </span>
              {account.mark && <MarkPill mark={account.mark} />}
            </div>
            <div className="flex items-center gap-1">
              <span className="min-w-0 truncate text-[10.5px] text-muted">@{domain}</span>
              {account.startedAt != null && (
                <>
                  <span className="inline-flex h-4 shrink-0 items-center gap-0.5 rounded bg-surface-2 px-1 text-[10px] font-medium tabular-nums leading-none text-muted">
                    <Clock size={9} />
                    {formatStartedAt(account.startedAt)}
                  </span>
                  <ElapsedPill startedAt={account.startedAt} frozenAt={frozenAtFor(account)} />
                </>
              )}
            </div>
          </div>
          {newCount > 0 && (
            <span
              className="inline-flex h-4 shrink-0 items-center rounded-full bg-accent px-1.5 text-[10px] font-semibold tabular-nums leading-none text-white shadow-card"
              title={`${newCount} 封新邮件`}
            >
              +{newCount}
            </span>
          )}
        </button>
        {account.archived && (
          <button
            type="button"
            onClick={() => void setArchived(account.email, false)}
            className="flex h-6 shrink-0 items-center gap-1 rounded-md bg-accent-soft px-1.5 text-[11px] font-medium text-accent transition duration-150 ease-out hover:bg-accent hover:text-white active:scale-95"
            title="恢复到在用"
          >
            <ArchiveRestore size={11} />
            恢复
          </button>
        )}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted transition duration-150 ease-out hover:bg-surface-2 hover:text-text focus-visible:opacity-100 group-hover:opacity-100 ${
            menuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="更多操作"
        >
          <MoreHorizontal size={14} />
        </button>
      </div>

      {menuOpen &&
        createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} />
          <div
            ref={menuRef}
            className="animate-pop-in fixed z-[61] w-44 rounded-lg border border-border bg-surface p-1 shadow-popover"
            style={{
              left: menuPos?.left ?? -9999,
              top: menuPos?.top ?? -9999,
              visibility: menuPos ? 'visible' : 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => onMark('refunded')}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors duration-150 ease-out hover:bg-surface-2"
            >
              <BadgeCheck size={12} className="text-refund" />
              标记已退款
              {account.mark === 'refunded' && <Check size={12} className="ml-auto text-accent" />}
            </button>
            <button
              type="button"
              onClick={() => onMark('warning')}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors duration-150 ease-out hover:bg-surface-2"
            >
              <AlertTriangle size={12} className="text-warning" />
              标记有警告
              {account.mark === 'warning' && <Check size={12} className="ml-auto text-accent" />}
            </button>
            {account.mark && (
              <button
                type="button"
                onClick={() => onMark(null)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted transition-colors duration-150 ease-out hover:bg-surface-2"
              >
                <Tag size={12} />
                清除标记
              </button>
            )}
            <div className="mx-1 my-1 h-px bg-border" />
            <button
              type="button"
              onClick={onToggleArchive}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors duration-150 ease-out hover:bg-surface-2"
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
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors duration-150 ease-out hover:bg-surface-2"
            >
              <Clock size={12} className="text-muted" />
              记录上号时间
            </button>
            <div className="mx-1 my-1 h-px bg-border" />
            <button
              type="button"
              onClick={onUpdate}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors duration-150 ease-out hover:bg-surface-2"
            >
              <KeyRound size={12} className="text-muted" />
              更新应用密码
            </button>
            <div className="mx-1 my-1 h-px bg-border" />
            <button
              type="button"
              onClick={() => void onRemove()}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-danger transition-colors duration-150 ease-out hover:bg-danger/5"
            >
              <Trash2 size={12} />
              移除账号
            </button>
          </div>
        </>,
          document.body,
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

/** 退款或归档都会定格"已上号"计时，两者都发生时取更早的时刻。 */
function frozenAtFor(a: Account): number | null {
  const candidates = [
    a.mark === 'refunded' ? a.refundedAt : null,
    a.archived ? a.archivedAt : null,
  ].filter((v): v is number => v != null);
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

/** 已上号天数小标：≤3 天绿、3~4 天黄、>4 天红。
 *  frozenAt 非 null（已退款或已归档）时，计时冻结在 frozenAt−startedAt，不再随时间累积。 */
function ElapsedPill({
  startedAt,
  frozenAt,
}: {
  startedAt: number;
  frozenAt: number | null;
}): JSX.Element {
  const end = frozenAt != null ? frozenAt : Date.now();
  const days = Math.max(0, (end - startedAt) / 86_400_000);
  let cls = 'bg-surface-2 text-muted';
  if (days > 4) cls = 'bg-surface-2 text-danger';
  else if (days > 3) cls = 'bg-surface-2 text-warning';
  const totalHours = Math.max(0, Math.floor((end - startedAt) / 3_600_000));
  const d = Math.floor(totalHours / 24);
  const h = totalHours % 24;
  let text: string;
  if (d > 0) text = h > 0 ? `${d}天${h}小时` : `${d}天`;
  else text = h > 0 ? `${h}小时` : '刚上号';
  return (
    <span
      className={`inline-flex h-4 shrink-0 items-center rounded px-1 text-[10px] font-medium tabular-nums leading-none ${cls}`}
      title={
        frozenAt != null
          ? `计时已定格在 ${days.toFixed(1)} 天（退款/归档后不再累积）`
          : `已上号 ${days.toFixed(1)} 天`
      }
    >
      {text}
    </span>
  );
}

function MarkPill({ mark }: { mark: AccountMark }): JSX.Element {
  if (mark === 'refunded') {
    return (
      <span className="inline-flex h-4 shrink-0 items-center rounded-full bg-refund/15 px-1.5 text-[10px] font-medium leading-none text-refund">
        已退款
      </span>
    );
  }
  return (
    <span className="inline-flex h-4 shrink-0 items-center gap-0.5 rounded-full bg-surface-2 px-1.5 text-[10px] font-medium leading-none text-warning">
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
