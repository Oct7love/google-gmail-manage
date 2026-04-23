import { useEffect, useMemo, useState } from 'react';
import { TOTP, URI } from 'otpauth';
import { ShieldCheck, Copy, Check } from 'lucide-react';

const PERIOD = 30;

interface Props {
  initialSecret?: string;
}

export default function TotpPanel({ initialSecret = '' }: Props): JSX.Element {
  const [secretInput, setSecretInput] = useState(initialSecret);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { code, error, remaining } = useMemo(() => {
    const s = secretInput.trim();
    if (!s) return { code: '', error: null as string | null, remaining: PERIOD };

    try {
      const totp = buildTotp(s);
      const code = totp.generate({ timestamp: now });
      const remaining = PERIOD - Math.floor((now / 1000) % PERIOD);
      return { code, error: null, remaining };
    } catch (e) {
      return {
        code: '',
        error: e instanceof Error ? e.message : String(e),
        remaining: PERIOD,
      };
    }
  }, [secretInput, now]);

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

  const progressPct = ((PERIOD - remaining) / PERIOD) * 100;

  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2.5 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-medium text-text">
          <ShieldCheck size={13} className="text-accent" />
          2FA 验证码生成器
        </span>
        <span className="text-[10.5px] text-muted">本地算，不联网</span>
      </div>

      <input
        type="text"
        value={secretInput}
        onChange={(e) => setSecretInput(e.target.value)}
        placeholder="粘贴 2FA 密钥（base32 或 otpauth://...）"
        className="w-full rounded-md border border-border bg-white px-2 py-1.5 font-mono text-[11px] focus:border-accent focus:outline-none"
      />

      {code && !error && (
        <>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 font-mono text-2xl font-semibold tracking-[0.18em] text-accent tabular-nums">
              {code.slice(0, 3)} {code.slice(3)}
            </div>
            <button
              type="button"
              onClick={() => void onCopy()}
              className="flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
            >
              {copied ? (
                <>
                  <Check size={12} /> 已复制
                </>
              ) : (
                <>
                  <Copy size={12} /> 复制
                </>
              )}
            </button>
          </div>

          <div className="mt-2 flex items-center gap-2 text-[10.5px] text-muted">
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
        <div className="mt-2 text-[11px] text-danger">密钥格式不对（base32 字符或 otpauth:// URI）</div>
      )}
    </div>
  );
}

function buildTotp(input: string): TOTP {
  if (input.startsWith('otpauth://')) {
    const parsed = URI.parse(input);
    if (parsed instanceof TOTP) return parsed;
    throw new Error('只支持 TOTP 类型的 otpauth 链接');
  }
  const cleaned = input.replace(/\s+/g, '').toUpperCase();
  return new TOTP({
    secret: cleaned,
    algorithm: 'SHA1',
    digits: 6,
    period: PERIOD,
  });
}
