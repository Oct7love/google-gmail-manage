import { useEffect, useRef, useState } from 'react';
import { Smartphone, Loader2, RefreshCw, Copy, Check, AlertTriangle } from 'lucide-react';

interface Props {
  /** 预填手机号（从账号备注里解析到的「手机：xxx」） */
  defaultPhone?: string;
}

type State =
  | { kind: 'idle' }
  | { kind: 'requesting' }
  | { kind: 'waiting'; phone: string; secondsLeft: number }
  | { kind: 'done'; code: string }
  | { kind: 'error'; error: string };

const TOTAL = 120; // 总等待秒数
const STEP = 5; // 轮询间隔秒数

/**
 * 手机号接码（luugpm.cloud 两步式）：
 *   输手机号 → request_phone 拿 otpId → 每 5 秒轮询 request_code，最多 120 秒。
 * 出现在 AddAccountDialog（解析到卡密时）和 CredentialsDrawer（看账号凭据时）。
 */
export default function PhoneOtpBox({ defaultPhone }: Props): JSX.Element {
  const [phone, setPhone] = useState(defaultPhone ?? '');
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [copied, setCopied] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const otpRef = useRef<string | null>(null);
  const leftRef = useRef(TOTAL);

  // defaultPhone 异步到达（抽屉拉取后）时同步一次，前提是用户还没手动改过
  useEffect(() => {
    if (defaultPhone && !touched) setPhone(defaultPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPhone]);

  const clearTimer = (): void => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
  // 卸载时清理轮询 + 复制反馈定时器，避免卸载后 setState
  useEffect(() => {
    return () => {
      clearTimer();
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // id 是本轮发起时的 otpId：响应回来时若 otpRef 已变（开了新一轮 / 已停止），
  // 说明这是过期响应，直接丢弃——否则旧 session 的码会杀掉新一轮轮询并显示旧码。
  const tick = async (id: string): Promise<void> => {
    const r = await window.api.system.fetchPhoneOtpCode(id);
    if (otpRef.current !== id) return;
    if (r.ok && r.code) {
      clearTimer();
      otpRef.current = null;
      setState({ kind: 'done', code: r.code });
    }
  };

  const start = async (): Promise<void> => {
    clearTimer();
    const n = phone.trim();
    if (!n) return;
    setState({ kind: 'requesting' });
    const res = await window.api.system.requestPhoneOtp(n);
    if (!res.ok || !res.otpId) {
      setState({ kind: 'error', error: res.error ?? '获取 session 失败' });
      return;
    }
    const otpId = res.otpId;
    otpRef.current = otpId;
    leftRef.current = TOTAL;
    setState({ kind: 'waiting', phone: res.phone ?? n, secondsLeft: TOTAL });
    void tick(otpId); // 立即查一次
    timerRef.current = setInterval(() => {
      leftRef.current -= STEP;
      if (leftRef.current <= 0) {
        clearTimer();
        otpRef.current = null;
        setState({ kind: 'error', error: '超时未收到验证码（120 秒）' });
        return;
      }
      setState((s) => (s.kind === 'waiting' ? { ...s, secondsLeft: leftRef.current } : s));
      void tick(otpId);
    }, STEP * 1000);
  };

  const copy = (text: string): void => {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1200);
  };

  const busy = state.kind === 'requesting' || state.kind === 'waiting';

  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs">
      <div className="mb-1.5 flex items-center gap-1.5 font-medium text-text">
        <Smartphone size={12} className="text-accent" />
        手机接码
      </div>

      <div className="flex items-center gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          value={phone}
          onChange={(e) => {
            setTouched(true);
            setPhone(e.target.value);
          }}
          placeholder="手机号"
          disabled={busy}
          className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-[12px] text-text outline-none transition focus:border-accent disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void start()}
          disabled={busy || !phone.trim()}
          className="flex shrink-0 items-center gap-1 rounded-md bg-accent px-2 py-1 text-[10.5px] text-white transition duration-150 hover:bg-accent/90 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
          {state.kind === 'done' ? '重新获取' : busy ? '获取中' : '获取验证码'}
        </button>
      </div>

      {state.kind === 'waiting' && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted">
          <Loader2 size={10} className="animate-spin text-accent" />
          等待短信验证码… 还剩 <span className="tabular-nums text-text-2">{state.secondsLeft}s</span>
        </div>
      )}

      {state.kind === 'done' && (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1 font-mono text-xl font-semibold tracking-[0.18em] text-accent tabular-nums">
            {state.code}
          </div>
          <button
            type="button"
            onClick={() => copy(state.code)}
            className="flex shrink-0 items-center gap-0.5 rounded bg-accent/10 px-2 py-1 text-[10px] text-accent transition-colors duration-150 hover:bg-accent/20"
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

      {state.kind === 'error' && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-danger">
          <AlertTriangle size={10} />
          {state.error}
        </div>
      )}
    </div>
  );
}
