import { useStore } from '../../store';
import AccountItem from './AccountItem';
import Logo from '../common/Logo';
import { Mail, Plus, RefreshCw } from 'lucide-react';

export default function LeftColumn(): JSX.Element {
  const accounts = useStore((s) => s.accounts);
  const openAddDialog = useStore((s) => s.openAddDialog);
  const refreshAll = useStore((s) => s.refreshAll);
  const refreshingCount = useStore((s) => s.refreshingEmails.size);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-sidebar">
      <header className="flex items-center justify-between px-3 pt-4 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          账号
        </span>
        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={accounts.length === 0}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-black/5 disabled:opacity-30"
          title="全部刷新"
          aria-label="全部刷新"
        >
          <RefreshCw size={13} className={refreshingCount > 0 ? 'animate-spin' : ''} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-2 py-1">
        {accounts.length === 0 ? (
          <EmptyState />
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
          className="flex w-full items-center justify-center gap-1.5 rounded-md bg-gradient-to-b from-accent to-accent/85 px-3 py-2 text-[13px] font-medium text-white shadow-sm transition hover:from-accent/95 hover:to-accent/80 active:from-accent/85"
        >
          <Plus size={14} strokeWidth={2.5} />
          添加账号
        </button>
      </footer>
    </aside>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div className="mt-8 px-4 text-center text-xs text-muted">
      <div className="mb-3 flex justify-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-border">
          <Logo size={28} />
        </div>
      </div>
      <p className="leading-relaxed">
        还没有账号
        <br />
        点下方按钮添加第一个
      </p>
      <div className="mx-auto mt-3 flex w-fit items-center gap-1 rounded-full bg-accent/5 px-2 py-0.5 text-[10.5px] text-accent">
        <Mail size={10} /> 多账号 Gmail 查看器
      </div>
    </div>
  );
}
