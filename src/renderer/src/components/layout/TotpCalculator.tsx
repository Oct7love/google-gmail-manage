import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, Copy, Check, X } from 'lucide-react';
import { computeTotp } from '../../lib/totp';

/**
 * 独立 2FA 验证码计算器。
 * 工具栏按钮点开的小浮层：粘贴密钥 → 实时出 6 位码 + 倒计时。
 * 受控本地 state，关闭即清空，不在任何地方持久化明文密钥。
 */

interface Props {
  onClose: () => void;
}

export default function TotpCalculator({ onClose }: Props): JSX.Element {
  const [secret, setSecret] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const { code, error, remaining } = useMemo(() => computeTotp(secret, now), [secret, now]);

  const onCopy = async (): Promise<void> => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* noop */
    }
  };

  const progressPct = ((30 - remaining) / 30) * 100;

  // Toolbar 有 backdrop-blur 创建新 stacking context，用 Portal 跳出。
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-start justify-center bg-black/30 p-6 pt-20"
      onClick={onClose}
    >
      <div
        className="animate-slide-up w-full max-w-sm overflow-hidden rounded-xl bg-surface shadow-popover"
        onClick={(e) => e.stopPropagation()}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h2 className="flex items-center gap-1.5 text-[14px] font-semibold tracking-tight text-text">
            <ShieldCheck size={15} className="text-accent" />
            2FA 验证码计算器
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition duration-150 ease-out hover:bg-surface-2 hover:text-text active:scale-[0.98]"
            aria-label="关闭"
          >
            <X size={15} />
          </button>
        </header>

        <div className="px-4 py-3.5">
          <div className="mb-2 flex items-center justify-between text-[11px] text-muted">
            <span>粘贴任意 2FA 密钥即可算码</span>
            <span>本地算，不联网</span>
          </div>

          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            autoFocus
            placeholder="粘贴 2FA 密钥（base32 或 otpauth://...）"
            className="w-full rounded-md border border-border bg-surface px-2.5 py-2 font-mono text-[12px] transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
          />

          {code && !error && (
            <>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 font-mono text-3xl font-semibold tracking-[0.18em] text-accent tabular-nums">
                  {code.slice(0, 3)} {code.slice(3)}
                </div>
                <button
                  type="button"
                  onClick={() => void onCopy()}
                  className="flex items-center gap-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition duration-150 hover:bg-accent/90 active:scale-[0.98]"
                >
                  {copied ? (
                    <>
                      <Check size={13} /> 已复制
                    </>
                  ) : (
                    <>
                      <Copy size={13} /> 复制
                    </>
                  )}
                </button>
              </div>

              <div className="mt-2.5 flex items-center gap-2 text-[10.5px] text-muted">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
                  <div
                    className={`h-full transition-[width] duration-1000 ease-linear ${
                      remaining <= 5 ? 'bg-danger' : 'bg-accent'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="shrink-0 tabular-nums">{remaining}s</span>
              </div>
            </>
          )}

          {error && (
            <div className="mt-3 text-[11px] text-danger">
              密钥格式不对（base32 字符或 otpauth:// URI）
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
