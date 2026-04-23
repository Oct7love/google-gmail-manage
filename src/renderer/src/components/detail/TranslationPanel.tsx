import { useEffect, useState } from 'react';
import type { MessageDetail } from '../../../../shared/types';
import { Languages, Loader2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  detail: MessageDetail;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; text: string }
  | { kind: 'error'; error: string };

export default function TranslationPanel({ detail }: Props): JSX.Element | null {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [expanded, setExpanded] = useState(true);

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
      <div className="flex items-center justify-between rounded-md border border-border bg-gradient-to-r from-sidebar/40 to-sidebar/20 px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5 text-muted">
          <Languages size={13} className="text-accent" />
          英文邮件？一键翻译成中文
        </span>
        <button
          type="button"
          onClick={() => void translate()}
          className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent/90"
        >
          翻译为中文
        </button>
      </div>
    );
  }

  if (state.kind === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 text-xs text-muted">
        <Loader2 size={13} className="animate-spin text-accent" />
        翻译中…
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

  return (
    <div className="overflow-hidden rounded-md border border-border bg-bg">
      <header className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <Languages size={12} className="text-accent" />
          中文翻译
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 hover:bg-sidebar"
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {expanded ? '折叠' : '展开'}
          </button>
          <button
            type="button"
            onClick={() => void translate()}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 hover:bg-sidebar"
          >
            <RotateCcw size={11} />
            重新翻译
          </button>
        </div>
      </header>
      {expanded && (
        <div className="whitespace-pre-wrap px-4 py-3 text-[13px] leading-[1.75] text-text">
          {compactParagraphs(state.text)}
        </div>
      )}
    </div>
  );
}

function compactParagraphs(text: string): string {
  const paras = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  const merged: string[] = [];
  let buf = '';
  for (const p of paras) {
    const shortSelf = p.length <= 40;
    const shortBuf = buf.length > 0 && buf.length <= 40;
    if (shortSelf && (shortBuf || buf === '')) {
      buf = buf ? `${buf} ${p}` : p;
    } else if (shortBuf) {
      merged.push(`${buf} ${p}`);
      buf = '';
    } else {
      if (buf) merged.push(buf);
      buf = p;
    }
  }
  if (buf) merged.push(buf);
  return merged.join('\n\n');
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
