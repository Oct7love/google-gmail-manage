import { useEffect, useMemo, useState } from 'react';
import { TOTP, URI } from 'otpauth';
import { ShieldCheck, Copy, Check, RefreshCw } from 'lucide-react';

const PERIOD = 30;

interface Props {
  /** 当前密钥（受控值） */
  secret: string;
  /** 密钥变更回调 */
  onSecretChange: (s: string) => void;
  /** 用于显示"已修改"提示的原始值（从粘贴解析来的） */
  originalSecret?: string;
}

export default function TotpPanel({ secret, onSecretChange, originalSecret }: Props): JSX.Element {
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { code, error, remaining } = useMemo(() => {
    const s = secret.trim();
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
  }, [secret, now]);

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
  const modified = Boolean(originalSecret && originalSecret.trim() && secret.trim() !== originalSecret.trim());

  return (
    <div className="rounded-lg border border-border bg-white px-3 py-2.5 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-medium text-text">
          <ShieldCheck size={13} className="text-accent" />
          2FA 验证码生成器
          {modified && (
            <span
              className="rounded-full bg-orange-100 px-1.5 py-0 text-[9.5px] text-warning"
              title="密钥已被你修改，提交账号时会以当前值保存"
            >
              已改动
            </span>
          )}
        </span>
        <div className="flex items-center gap-2 text-[10.5px] text-muted">
          {originalSecret && originalSecret.trim() && (
            <button
              type="button"
              onClick={() => onSecretChange(originalSecret)}
              disabled={!modified}
              className="flex items-center gap-0.5 rounded px-1.5 py-0.5 hover:bg-sidebar disabled:opacity-30"
              title="撤销改动，恢复成粘贴解析时的值"
            >
              <RefreshCw size={9} />
              还原
            </button>
          )}
          <span>本地算，不联网</span>
        </div>
      </div>

      <input
        type="text"
        value={secret}
        onChange={(e) => onSecretChange(e.target.value)}
        placeholder="粘贴 2FA 密钥（base32 或 otpauth://...），想改直接覆盖"
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
