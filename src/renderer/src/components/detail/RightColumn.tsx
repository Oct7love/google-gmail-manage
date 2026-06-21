import { useState } from 'react';
import { useStore } from '../../store';
import MessageBody from './MessageBody';
import TranslationPanel from './TranslationPanel';
import Avatar from '../common/Avatar';
import { displayNameFor } from '../../lib/avatar';
import { MailOpen, Image as ImageIcon, ImageOff } from 'lucide-react';

export default function RightColumn(): JSX.Element {
  const detailKey = useStore((s) =>
    s.selectedEmail && s.selectedMessageId ? `${s.selectedEmail}:${s.selectedMessageId}` : null,
  );
  const detail = useStore((s) => (detailKey ? s.messageDetail[detailKey] : null));
  const [showImages, setShowImages] = useState(false);

  if (!detail) {
    return (
      <section className="flex flex-1 items-center justify-center bg-bg">
        <div className="animate-fade-in text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-2">
            <MailOpen size={24} strokeWidth={1.4} className="text-muted-2" />
          </div>
          <p className="text-xs text-muted">选择一封邮件查看内容</p>
        </div>
      </section>
    );
  }

  const senderName = displayNameFor(detail.fromAddr) || detail.fromAddr;
  const senderEmail = detail.fromAddr.match(/<(.+?)>/)?.[1] ?? detail.fromAddr;

  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-bg">
      <div className="m-4 flex flex-1 flex-col overflow-hidden rounded-lg bg-surface shadow-card">
        <header className="border-b border-border px-6 py-4">
          <h2 className="mb-3 text-[18px] font-semibold leading-snug tracking-[-0.01em] text-text">
            {detail.subject || '(无主题)'}
          </h2>
          <div className="flex items-start gap-3">
            <Avatar identityKey={detail.fromAddr || 'unknown'} label={senderName} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[13px] font-medium text-text">{senderName}</span>
                  {senderEmail !== senderName && (
                    <span className="ml-1.5 text-xs text-muted-2">&lt;{senderEmail}&gt;</span>
                  )}
                </div>
                <time className="shrink-0 text-xs tabular-nums text-muted-2">
                  {new Date(detail.dateTs).toLocaleString('zh-CN')}
                </time>
              </div>
              <div className="mt-0.5 text-xs text-text-2">发给 {detail.accountEmail}</div>
            </div>
          </div>
          {detail.bodyHtml && (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowImages((s) => !s)}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-colors duration-150 ease-out ${
                  showImages
                    ? 'border-transparent bg-accent-soft text-accent'
                    : 'border-border bg-transparent text-text-2 hover:bg-surface-2 hover:text-text'
                }`}
              >
                {showImages ? <ImageIcon size={12} /> : <ImageOff size={12} />}
                {showImages ? '已加载外部图片' : '加载外部图片'}
              </button>
            </div>
          )}
        </header>
        <div className="px-6 py-2">
          <TranslationPanel detail={detail} />
        </div>
        <MessageBody detail={detail} allowImages={showImages} />
      </div>
    </section>
  );
}
