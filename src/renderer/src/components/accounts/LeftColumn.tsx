import { useMemo, useState } from 'react';
import type { Account } from '../../../../shared/types';
import { useStore } from '../../store';
import AccountItem from './AccountItem';
import Logo from '../common/Logo';
import { CalendarDays, Clock, HelpCircle, Mail, Plus, RefreshCw } from 'lucide-react';

type SortMode = 'started' | 'added';

/** 退款（含已封号退款）→ 永远置顶 */
function isRefunded(a: Account): boolean {
  return a.mark === 'refunded' || a.mark === 'banned_refunded';
}

/** 排序：退款的置顶；组内按所选时间「最早在上」（升序）。
 *  按上号时间排序时，没填过上号时间的用添加时间兜底。 */
function sortAccounts(list: Account[], mode: SortMode): Account[] {
  const key = (a: Account): number =>
    mode === 'started' ? a.startedAt ?? a.addedAt : a.addedAt;
  return [...list].sort((a, b) => {
    const ra = isRefunded(a) ? 0 : 1;
    const rb = isRefunded(b) ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return key(a) - key(b);
  });
}

export default function LeftColumn(): JSX.Element {
  const accounts = useStore((s) => s.accounts);
  const openAddDialog = useStore((s) => s.openAddDialog);
  const refreshAll = useStore((s) => s.refreshAll);
  const refreshingCount = useStore((s) => s.refreshingEmails.size);
  const [tab, setTab] = useState<'active' | 'archived'>('active');
  const [showLegend, setShowLegend] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>(
    () => (localStorage.getItem('accountSortMode') as SortMode) || 'started',
  );

  const changeSort = (mode: SortMode): void => {
    setSortMode(mode);
    localStorage.setItem('accountSortMode', mode);
  };

  const activeAccounts = accounts.filter((a) => !a.archived);
  const archivedAccounts = accounts.filter((a) => a.archived);
  const shown = useMemo(
    () => sortAccounts(tab === 'active' ? activeAccounts : archivedAccounts, sortMode),
    [accounts, tab, sortMode],
  );

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border-strong bg-sidebar">
      <header className="flex items-center justify-between gap-1 px-3 pt-3 pb-2">
        <div className="flex min-w-0 items-center gap-0.5 rounded-lg bg-surface-2 p-0.5 text-[11px] font-medium">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`rounded-md px-2 py-1 leading-none transition-colors duration-150 ease-out ${
              tab === 'active'
                ? 'bg-surface text-text shadow-sm'
                : 'text-text-2 hover:text-text'
            }`}
          >
            在用 <span className="tabular-nums">{activeAccounts.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('archived')}
            className={`rounded-md px-2 py-1 leading-none transition-colors duration-150 ease-out ${
              tab === 'archived'
                ? 'bg-surface text-text shadow-sm'
                : 'text-text-2 hover:text-text'
            }`}
          >
            归档 <span className="tabular-nums">{archivedAccounts.length}</span>
          </button>
        </div>
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={() => setShowLegend((v) => !v)}
            className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-text ${
              showLegend ? 'bg-surface-2 text-accent' : 'text-text-2'
            }`}
            title="账号状态颜色说明"
            aria-label="账号状态说明"
          >
            <HelpCircle size={13} />
          </button>
          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={activeAccounts.length === 0}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-2 transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-text active:bg-accent-soft disabled:opacity-30"
            title="全部刷新（仅在用账号）"
            aria-label="全部刷新"
          >
            <RefreshCw size={13} className={refreshingCount > 0 ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      {showLegend && <StatusLegend />}

      <div className="flex items-center gap-1 px-3 pb-1.5">
        <span className="mr-0.5 text-[10.5px] text-muted">排序</span>
        <div className="flex items-center gap-0.5 rounded-md bg-surface-2 p-0.5 text-[10.5px] font-medium">
          <SortTab
            active={sortMode === 'started'}
            onClick={() => changeSort('started')}
            icon={<Clock size={10} />}
            label="上号时间"
          />
          <SortTab
            active={sortMode === 'added'}
            onClick={() => changeSort('added')}
            icon={<CalendarDays size={10} />}
            label="添加时间"
          />
        </div>
        <span className="ml-auto text-[10px] text-muted" title="退款的账号（含已封号退款）始终排在最上面">
          退款置顶
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-1">
        {accounts.length === 0 ? (
          <EmptyState />
        ) : shown.length === 0 ? (
          <div className="mt-8 px-4 text-center text-xs text-muted">
            {tab === 'archived' ? '还没有归档的账号' : '在用账号为空'}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {shown.map((a) => (
              <AccountItem key={a.email} account={a} />
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-border p-2">
        <button
          type="button"
          onClick={openAddDialog}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-white shadow-sm transition duration-150 ease-out hover:bg-accent/90 active:scale-[0.98]"
        >
          <Plus size={14} strokeWidth={2.5} />
          添加账号
        </button>
      </footer>
    </aside>
  );
}

function SortTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: JSX.Element;
  label: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded px-1.5 py-1 leading-none transition-colors duration-150 ease-out ${
        active ? 'bg-surface text-accent shadow-sm' : 'text-text-2 hover:text-text'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function StatusLegend(): JSX.Element {
  const items: { dot: string; label: string }[] = [
    { dot: 'bg-success', label: '正常 · 上次收信成功' },
    { dot: 'bg-warning', label: '应用密码失效 · 点账号更新' },
    { dot: 'bg-danger', label: '同步出错 · 网络/IMAP 报错' },
    { dot: 'bg-muted-2', label: '已归档 · 不自动收信' },
  ];
  return (
    <div className="mx-2 mt-0.5 mb-1 rounded-lg border border-border bg-surface-2/50 px-2.5 py-2">
      <div className="mb-1.5 text-[11px] font-semibold text-text">账号状态（头像角标颜色）</div>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-2 text-[11px] leading-none text-text-2">
            <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${it.dot}`} />
            {it.label}
          </li>
        ))}
        <li className="flex items-center gap-2 text-[11px] leading-none text-text-2">
          <RefreshCw size={10} className="shrink-0 text-accent" />
          正在刷新收信…
        </li>
      </ul>
    </div>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div className="mt-12 px-4 text-center text-xs text-muted">
      <div className="mb-4 flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-surface shadow-sm ring-1 ring-border">
          <Logo size={26} />
        </div>
      </div>
      <p className="leading-relaxed">
        还没有账号
        <br />
        点下方按钮添加第一个
      </p>
      <div className="mx-auto mt-4 flex w-fit items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[10.5px] font-medium leading-none text-text-2">
        <Mail size={10} className="text-accent" /> 多账号 Gmail 查看器
      </div>
    </div>
  );
}
