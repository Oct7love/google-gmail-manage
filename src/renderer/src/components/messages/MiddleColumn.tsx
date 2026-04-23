import { useState } from 'react';
import type { MessageSummary } from '../../../../shared/types';
import { useStore } from '../../store';
import MessageRow from './MessageRow';
import CredentialsDrawer from '../accounts/CredentialsDrawer';
import { Inbox, KeyRound, RefreshCw } from 'lucide-react';

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
  const [credsOpen, setCredsOpen] = useState(false);

  if (!selected) {
    return (
      <section className="flex w-[360px] shrink-0 flex-col items-center justify-center border-r border-border bg-white">
        <div className="text-center text-sm text-muted">
          <Inbox size={36} strokeWidth={1.3} className="mx-auto mb-2 text-border" />
          选择左侧账号查看邮件
        </div>
      </section>
    );
  }

  return (
    <section className="flex w-[360px] shrink-0 flex-col border-r border-border bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Inbox size={13} className="shrink-0 text-muted" />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-text" title={selected}>
              收件箱
            </div>
            <div className="truncate text-[11px] text-muted">
              {selected} · {messages.length} 封
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setCredsOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-black/5"
            title="查看账号凭据（密码 / 2FA / 辅邮）"
            aria-label="查看账号凭据"
          >
            <KeyRound size={13} />
          </button>
          <button
            type="button"
            onClick={() => void refreshOne(selected)}
            disabled={refreshing}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-black/5 disabled:opacity-30"
            title="刷新"
            aria-label="刷新"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
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
      {credsOpen && selected && (
        <CredentialsDrawer email={selected} onClose={() => setCredsOpen(false)} />
      )}
    </section>
  );
}
