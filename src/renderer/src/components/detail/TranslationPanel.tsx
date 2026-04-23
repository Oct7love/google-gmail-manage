import { useEffect, useState } from 'react';
import type { MessageDetail } from '../../../../shared/types';

interface Props {
  detail: MessageDetail;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; text: string }
  | { kind: 'error'; error: string };

/**
 * 邮件翻译面板：按需请求，结果按每封邮件 id 缓存到组件内 state。
 * 展示在邮件正文上方，可以折叠。
 */
export default function TranslationPanel({ detail }: Props): JSX.Element | null {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [expanded, setExpanded] = useState(true);

  // 切换邮件时重置
  useEffect(() => {
    setState({ kind: 'idle' });
    setExpanded(true);
  }, [detail.accountEmail, detail.messageId]);

  const sourceText = pickSourceText(detail);
  if (!sourceText.trim()) return null;

  const translate = async (): Promise<void> => {
    setState({ kind: 'loading' });
    const res = await window.api.translation.translate(sourceText);
    if (res.ok && res.text) setState({ kind: 'done', text: res.text });
    else setState({ kind: 'error', error: res.error ?? '翻译失败' });
  };

  if (state.kind === 'idle') {
    return (
      <div className="flex items-center justify-between rounded-md border border-border bg-bg px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5 text-muted">
          <GlobeIcon />
          英文邮件？一键翻译成中文
        </span>
        <button
          type="button"
          onClick={() => void translate()}
          className="rounded-md bg-accent px-2.5 py-1 text-xs text-white hover:bg-accent/90"
        >
          翻译为中文
        </button>
      </div>
    );
  }

  if (state.kind === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 text-xs text-muted">
        <Spinner /> 翻译中…
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-danger">
        <span>翻译失败：{state.error}</span>
        <button
          type="button"
          onClick={() => void translate()}
          className="rounded-md border border-red-300 bg-white px-2 py-0.5 hover:bg-red-50"
        >
          重试
        </button>
      </div>
    );
  }

  // done
  return (
    <div className="overflow-hidden rounded-md border border-border bg-bg">
      <header className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <GlobeIcon />
          中文翻译
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="rounded px-2 py-0.5 hover:bg-sidebar"
          >
            {expanded ? '折叠' : '展开'}
          </button>
          <button
            type="button"
            onClick={() => void translate()}
            className="rounded px-2 py-0.5 hover:bg-sidebar"
          >
            重新翻译
          </button>
        </div>
      </header>
      {expanded && (
        <div className="whitespace-pre-wrap px-4 py-3 text-[13px] leading-relaxed text-text">
          {state.text.split(/\n\n+/).map((para, i) => (
            <p key={i} className="mb-3 last:mb-0">
              {para}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function pickSourceText(detail: MessageDetail): string {
  if (detail.bodyText && detail.bodyText.trim()) return detail.bodyText;
  if (detail.bodyHtml) return stripHtmlForText(detail.bodyHtml);
  return detail.snippet ?? '';
}

function stripHtmlForText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function GlobeIcon(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function Spinner(): JSX.Element {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
      <path d="M12 2 A 10 10 0 0 1 22 12" />
    </svg>
  );
}
