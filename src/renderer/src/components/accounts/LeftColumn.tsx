import { useStore } from '../../store';
import AccountItem from './AccountItem';

export default function LeftColumn(): JSX.Element {
  const accounts = useStore((s) => s.accounts);
  const openAddDialog = useStore((s) => s.openAddDialog);
  const refreshAll = useStore((s) => s.refreshAll);
  const refreshingCount = useStore((s) => s.refreshingEmails.size);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <header className="flex items-center justify-between px-3 pt-4 pb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted">
          账号
        </span>
        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={accounts.length === 0}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-black/5 disabled:opacity-30"
          title="全部刷新"
          aria-label="全部刷新"
        >
          <RefreshIcon spinning={refreshingCount > 0} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-2 py-1">
        {accounts.length === 0 ? (
          <EmptyState onAdd={openAddDialog} />
        ) : (
          <ul className="space-y-0.5">
            {accounts.map((a) => (
              <AccountItem key={a.email} account={a} />
            ))}
          </ul>
        )}
      </div>

      <footer className="border-t border-border p-2">
        <button
          type="button"
          onClick={openAddDialog}
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-[13px] font-medium text-white shadow-sm transition hover:bg-accent/90 active:bg-accent/80"
        >
          <PlusIcon />
          添加账号
        </button>
      </footer>
    </aside>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }): JSX.Element {
  return (
    <div className="mt-8 px-4 text-center text-xs text-muted">
      <div className="mb-3 flex justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <polyline points="3,7 12,13 21,7" />
          </svg>
        </div>
      </div>
      <p className="leading-relaxed">
        还没有账号
        <br />
        点下方按钮添加你的第一个
      </p>
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={spinning ? 'animate-spin' : ''}
    >
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function PlusIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
