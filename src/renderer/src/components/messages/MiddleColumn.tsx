import type { MessageSummary } from '../../../../shared/types';
import { useStore } from '../../store';
import MessageRow from './MessageRow';

const EMPTY_MESSAGES: MessageSummary[] = [];

export default function MiddleColumn(): JSX.Element {
  const selected = useStore((s) => s.selectedEmail);
  const messages = useStore((s) =>
    s.selectedEmail ? s.messagesByEmail[s.selectedEmail] ?? EMPTY_MESSAGES : EMPTY_MESSAGES,
  );
  const refreshing = useStore((s) =>
    s.selectedEmail ? s.refreshingEmails.has(s.selectedEmail) : false,
  );
  const refreshOne = useStore((s) => s.refreshOne);

  if (!selected) {
    return (
      <section className="flex w-[360px] shrink-0 flex-col items-center justify-center border-r border-border bg-white">
        <p className="text-sm text-muted">选择左侧账号查看邮件</p>
      </section>
    );
  }

  return (
    <section className="flex w-[360px] shrink-0 flex-col border-r border-border bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-text" title={selected}>
            收件箱
          </div>
          <div className="truncate text-[11px] text-muted">
            {selected} · {messages.length} 封
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refreshOne(selected)}
          disabled={refreshing}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-black/5 disabled:opacity-30"
          title="刷新"
          aria-label="刷新"
        >
          <RefreshIcon spinning={refreshing} />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="p-8 text-center text-xs text-muted">暂无邮件</p>
        ) : (
          <ul className="divide-y divide-border">
            {messages.map((m) => (
              <MessageRow key={m.messageId} message={m} />
            ))}
          </ul>
        )}
      </div>
    </section>
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
