import type { MessageSummary } from '../../../../shared/types';
import { useStore } from '../../store';
import Avatar from '../common/Avatar';
import { displayNameFor } from '../../lib/avatar';

interface Props {
  message: MessageSummary;
}

export default function MessageRow({ message }: Props): JSX.Element {
  const isSelected = useStore((s) => s.selectedMessageId === message.messageId);
  const selectMessage = useStore((s) => s.selectMessage);

  const name = displayNameFor(message.fromAddr) || message.fromAddr;

  return (
    <li>
      <button
        type="button"
        onClick={() => void selectMessage(message.messageId)}
        className={`flex w-full items-start gap-3 border-l-[3px] px-4 py-2.5 text-left transition-colors ${
          isSelected
            ? 'border-accent bg-accent-soft'
            : 'border-transparent hover:bg-surface-2'
        }`}
      >
        <Avatar identityKey={message.fromAddr || 'unknown'} label={name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-base font-semibold text-text">{name}</span>
            <span className="shrink-0 text-[12px] text-muted-2">{formatDate(message.dateTs)}</span>
          </div>
          <div className="mt-0.5 truncate text-sm text-text">
            {message.subject || '(无主题)'}
          </div>
          {message.snippet && (
            <div className="mt-0.5 truncate text-[12px] text-muted-2">{message.snippet}</div>
          )}
        </div>
      </button>
    </li>
  );
}

function formatDate(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
}
