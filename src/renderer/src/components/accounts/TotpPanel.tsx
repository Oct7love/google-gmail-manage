import { useEffect, useMemo, useState } from 'react';
import { TOTP, URI } from 'otpauth';

/**
 * 本地 2FA 6 位码生成面板。
 * 支持两种输入：
 * - 纯 base32 密钥（形如 `abcd efgh ijkl mnop`，空格无所谓，大小写无所谓）
 * - 完整 otpauth:// URI（从 2FA 密钥二维码扫出来的字符串）
 */

const PERIOD = 30; // 秒

export default function TotpPanel(): JSX.Element {
  const [secretInput, setSecretInput] = useState('');
  const [now, setNow] = useState(() => Date.now());

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
    } catch {
      // 忽略
    }
  };

  const progressPct = ((PERIOD - remaining) / PERIOD) * 100;

  return (
    <div className="rounded-md border border-border bg-white px-3 py-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-text">🔐 2FA 验证码生成器</span>
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
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 font-mono text-2xl font-semibold tracking-[0.2em] text-accent">
            {code.slice(0, 3)} {code.slice(3)}
          </div>
          <button
            type="button"
            onClick={() => void onCopy()}
            className="rounded-md bg-accent px-3 py-1.5 text-xs text-white hover:bg-accent/90"
          >
            复制
          </button>
        </div>
      )}

      {code && !error && (
        <div className="mt-2 flex items-center gap-2 text-[10.5px] text-muted">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
            <div
              className={`h-full transition-[width] duration-1000 ease-linear ${
                remaining <= 5 ? 'bg-danger' : 'bg-accent'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="shrink-0 tabular-nums">{remaining}s 后刷新</span>
        </div>
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
  // 纯 base32 密钥
  const cleaned = input.replace(/\s+/g, '').toUpperCase();
  return new TOTP({
    secret: cleaned,
    algorithm: 'SHA1',
    digits: 6,
    period: PERIOD,
  });
}
