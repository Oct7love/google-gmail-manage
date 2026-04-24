import { useState } from 'react';
import { MessageSquareText, Loader2, RefreshCw, Copy, Check, AlertTriangle } from 'lucide-react';

interface Props {
  url: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; code?: string; raw?: string }
  | { kind: 'error'; error: string };

/**
 * 调账号的"短信验证码代收"URL，把返回里的数字提出来显示。
 * 出现在：
 * - AddAccountDialog 的"登录辅助"区（粘贴解析识别到 link 时）
 * - CredentialsDrawer 里（账号信息保存了 link 时）
 */
export default function SmsCodeBox({ url }: Props): JSX.Element {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [copied, setCopied] = useState(false);

  const fetchCode = async (): Promise<void> => {
    setState({ kind: 'loading' });
    const res = await window.api.system.fetchSmsCode(url);
    if (!res.ok) {
      setState({ kind: 'error', error: res.error ?? '未知错误' });
      return;
    }
    setState({ kind: 'done', code: res.code, raw: res.raw });
  };

  const copy = (text: string): void => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="rounded-md border border-border bg-white px-3 py-2 text-xs">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-medium text-text">
          <MessageSquareText size={12} className="text-accent" />
          短信验证码
        </span>
        <button
          type="button"
          onClick={() => void fetchCode()}
          disabled={state.kind === 'loading'}
          className="flex items-center gap-1 rounded-md bg-accent px-2 py-0.5 text-[10.5px] text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {state.kind === 'loading' ? (
            <>
              <Loader2 size={10} className="animate-spin" /> 获取中…
            </>
          ) : state.kind === 'done' ? (
            <>
              <RefreshCw size={10} /> 重新获取
            </>
          ) : (
            <>
              <RefreshCw size={10} /> 获取验证码
            </>
          )}
        </button>
      </div>

      {state.kind === 'done' && state.code && (
        <div className="flex items-center gap-2">
          <div className="flex-1 font-mono text-xl font-semibold tracking-[0.18em] text-accent tabular-nums">
            {state.code}
          </div>
          <button
            type="button"
            onClick={() => copy(state.code!)}
            className="flex shrink-0 items-center gap-0.5 rounded bg-accent/10 px-2 py-1 text-[10px] text-accent hover:bg-accent/20"
          >
            {copied ? (
              <>
                <Check size={9} /> 已复制
              </>
            ) : (
              <>
                <Copy size={9} /> 复制
              </>
            )}
          </button>
        </div>
      )}

      {state.kind === 'done' && !state.code && (
        <div className="flex items-center gap-1.5 text-[11px] text-warning">
          <AlertTriangle size={10} />
          返回里没解析到验证码。原文：
          <span className="font-mono text-muted">{state.raw?.slice(0, 60) ?? '(空)'}</span>
        </div>
      )}

      {state.kind === 'error' && (
        <div className="flex items-center gap-1.5 text-[11px] text-danger">
          <AlertTriangle size={10} />
          获取失败：{state.error}
        </div>
      )}

      {state.kind === 'idle' && (
        <div className="truncate text-[10.5px] text-muted" title={url}>
          {url}
        </div>
      )}
    </div>
  );
}
