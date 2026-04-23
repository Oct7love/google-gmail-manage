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
        <div className="text-center text-sm text-muted">
          <MailOpen size={48} strokeWidth={1.2} className="mx-auto mb-3 text-border" />
          选择一封邮件查看内容
        </div>
      </section>
    );
  }

  const senderName = displayNameFor(detail.fromAddr) || detail.fromAddr;
  const senderEmail = detail.fromAddr.match(/<(.+?)>/)?.[1] ?? detail.fromAddr;

  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-white">
      <header className="border-b border-border px-6 py-4">
        <h2 className="mb-3 text-[17px] font-semibold leading-snug text-text">
          {detail.subject || '(无主题)'}
        </h2>
        <div className="flex items-start gap-3">
          <Avatar identityKey={detail.fromAddr || 'unknown'} label={senderName} size={36} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[13px] font-medium text-text">{senderName}</span>
                {senderEmail !== senderName && (
                  <span className="ml-1.5 text-[12px] text-muted">&lt;{senderEmail}&gt;</span>
                )}
              </div>
              <time className="shrink-0 text-[11px] text-muted">
                {new Date(detail.dateTs).toLocaleString('zh-CN')}
              </time>
            </div>
            <div className="mt-0.5 text-[11px] text-muted">发给 {detail.accountEmail}</div>
          </div>
        </div>
        {detail.bodyHtml && (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowImages((s) => !s)}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition ${
                showImages
                  ? 'border-accent/40 bg-accent/5 text-accent'
                  : 'border-border bg-white text-muted hover:bg-sidebar'
              }`}
            >
              {showImages ? <ImageIcon size={12} /> : <ImageOff size={12} />}
              {showImages ? '已加载外部图片' : '加载外部图片'}
            </button>
          </div>
        )}
      </header>
      <div className="border-b border-border px-6 pt-3 pb-3">
        <TranslationPanel detail={detail} />
      </div>
      <MessageBody detail={detail} allowImages={showImages} />
    </section>
  );
}
