import { useEffect, useState } from 'react';
import { TOTP, URI } from 'otpauth';
import type { AccountCredentials, AccountInfo } from '../../../../shared/types';
import { useStore } from '../../store';
import SmsCodeBox from './SmsCodeBox';
import {
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  KeyRound,
  Mail,
  ShieldCheck,
  Link as LinkIcon,
  Pencil,
  Save,
  AlertTriangle,
} from 'lucide-react';

interface Props {
  email: string;
  onClose: () => void;
}

const TOTP_PERIOD = 30;

export default function CredentialsDrawer({ email, onClose }: Props): JSX.Element {
  const [creds, setCreds] = useState<AccountCredentials | null>(null);
  const [revealAll, setRevealAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<AccountInfo>({});
  const [saving, setSaving] = useState(false);
  const refresh = async (): Promise<void> => {
    const c = await window.api.accounts.getCredentials(email);
    setCreds(c);
    setForm({
      googlePassword: c.googlePassword ?? '',
      totpSecret: c.totpSecret ?? '',
      recoveryEmail: c.recoveryEmail ?? '',
      link: c.link ?? '',
    });
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const onSave = async (): Promise<void> => {
    setSaving(true);
    await window.api.accounts.setInfo(email, {
      googlePassword: form.googlePassword?.trim() || undefined,
      totpSecret: form.totpSecret?.trim() || undefined,
      recoveryEmail: form.recoveryEmail?.trim() || undefined,
      link: form.link?.trim() || undefined,
    });
    await refresh();
    setEditing(false);
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <KeyRound size={15} className="text-accent" />
            <h2 className="text-[15px] font-semibold">账号凭据</h2>
          </div>
          <div className="flex items-center gap-1">
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-sidebar"
                title="编辑"
              >
                <Pencil size={11} /> 编辑
              </button>
            )}
            <button
              type="button"
              onClick={() => setRevealAll((r) => !r)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted hover:bg-sidebar"
            >
              {revealAll ? <EyeOff size={11} /> : <Eye size={11} />}
              {revealAll ? '隐藏' : '显示'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-sidebar"
            >
              <X size={14} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-[11.5px] text-warning">
            <div className="flex items-start gap-1.5">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>敏感信息，勿随意截图。凭据仅存在本机 Keychain，不上传任何地方。</span>
            </div>
          </div>

          {!creds ? (
            <p className="text-xs text-muted">加载中…</p>
          ) : editing ? (
            <EditForm form={form} setForm={setForm} />
          ) : (
            <div className="space-y-3">
              <Row label="Gmail 地址" icon={<Mail size={12} />} value={creds.email} />
              <Row
                label="应用专用密码"
                icon={<KeyRound size={12} />}
                value={creds.appPassword}
                secret
                mono
                revealAll={revealAll}
                emptyHint="未找到（IMAP 无法工作）"
              />
              <Row
                label="Google 登录密码"
                icon={<KeyRound size={12} />}
                value={creds.googlePassword}
                secret
                revealAll={revealAll}
                emptyHint="未保存（点编辑添加）"
              />
              <TotpRow totpSecret={creds.totpSecret} revealAll={revealAll} />
              <Row
                label="辅助邮箱"
                icon={<Mail size={12} />}
                value={creds.recoveryEmail}
                emptyHint="未保存"
              />
              <Row
                label="备用链接"
                icon={<LinkIcon size={12} />}
                value={creds.link}
                emptyHint="未保存"
              />
              {creds.link && /^https?:\/\//i.test(creds.link) && (
                <SmsCodeBox url={creds.link} />
              )}
            </div>
          )}
        </div>

        {editing && (
          <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-sidebar"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving}
              className="flex items-center gap-1 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              <Save size={12} />
              {saving ? '保存中…' : '保存'}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}

function EditForm({
  form,
  setForm,
}: {
  form: AccountInfo;
  setForm: (f: AccountInfo) => void;
}): JSX.Element {
  return (
    <div className="space-y-3">
      <Field
        label="Google 登录密码"
        value={form.googlePassword ?? ''}
        onChange={(v) => setForm({ ...form, googlePassword: v })}
        type="text"
      />
      <Field
        label="2FA 密钥（base32 或 otpauth://...）"
        value={form.totpSecret ?? ''}
        onChange={(v) => setForm({ ...form, totpSecret: v })}
        type="text"
        mono
      />
      <Field
        label="辅助邮箱"
        value={form.recoveryEmail ?? ''}
        onChange={(v) => setForm({ ...form, recoveryEmail: v })}
        type="email"
      />
      <Field
        label="备用链接"
        value={form.link ?? ''}
        onChange={(v) => setForm({ ...form, link: v })}
        type="text"
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  mono?: boolean;
}): JSX.Element {
  return (
    <label className="block text-sm">
      <span className="text-[12.5px] font-medium">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-0.5 w-full rounded-md border border-border bg-white px-3 py-1.5 text-[13px] focus:border-accent focus:outline-none ${
          mono ? 'font-mono text-[12px]' : ''
        }`}
      />
    </label>
  );
}

function Row({
  label,
  icon,
  value,
  secret,
  mono,
  revealAll,
  emptyHint,
}: {
  label: string;
  icon: React.ReactNode;
  value?: string;
  secret?: boolean;
  mono?: boolean;
  revealAll?: boolean;
  emptyHint?: string;
}): JSX.Element {
  const [revealed, setRevealed] = useState(false);
  const show = revealed || revealAll || !secret;
  const displayValue = !value ? null : show ? value : '••••••••••••••••';

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted">
        <span className="text-accent">{icon}</span>
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-md border border-border bg-sidebar/30 px-2.5 py-1.5">
        {value ? (
          <>
            <span
              className={`min-w-0 flex-1 truncate text-[13px] ${mono ? 'font-mono' : ''}`}
              title={show ? value : undefined}
            >
              {displayValue}
            </span>
            {secret && !revealAll && (
              <button
                type="button"
                onClick={() => setRevealed((r) => !r)}
                className="flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-muted hover:bg-white"
              >
                {revealed ? <EyeOff size={10} /> : <Eye size={10} />}
              </button>
            )}
            <CopyBtn value={value} />
          </>
        ) : (
          <span className="text-[12px] text-muted">{emptyHint ?? '未设置'}</span>
        )}
      </div>
    </div>
  );
}

function TotpRow({
  totpSecret,
  revealAll,
}: {
  totpSecret?: string;
  revealAll: boolean;
}): JSX.Element {
  const [now, setNow] = useState(() => Date.now());
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { code, remaining } = (() => {
    if (!totpSecret?.trim()) return { code: null as string | null, remaining: 0 };
    try {
      const totp = buildTotp(totpSecret.trim());
      return {
        code: totp.generate({ timestamp: now }),
        remaining: TOTP_PERIOD - Math.floor((now / 1000) % TOTP_PERIOD),
      };
    } catch {
      return { code: null, remaining: 0 };
    }
  })();

  const progressPct = ((TOTP_PERIOD - remaining) / TOTP_PERIOD) * 100;
  const showSecret = revealed || revealAll;

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted">
        <ShieldCheck size={12} className="text-accent" />
        <span className="font-medium">2FA 密钥</span>
      </div>
      <div className="rounded-md border border-border bg-sidebar/30 px-2.5 py-2">
        {!totpSecret ? (
          <span className="text-[12px] text-muted">未保存（点编辑添加）</span>
        ) : (
          <>
            {code && (
              <div className="mb-2 flex items-center gap-2">
                <div className="flex-1 font-mono text-xl font-semibold tracking-[0.18em] text-accent tabular-nums">
                  {code.slice(0, 3)} {code.slice(3)}
                </div>
                <CopyBtn value={code} />
                <span className="shrink-0 text-[10px] tabular-nums text-muted">{remaining}s</span>
              </div>
            )}
            {code && (
              <div className="mb-2 h-0.5 overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full transition-[width] duration-1000 ease-linear ${
                    remaining <= 5 ? 'bg-danger' : 'bg-accent'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <span
                className={`min-w-0 flex-1 truncate font-mono text-[11px] ${
                  showSecret ? 'text-text' : 'text-muted'
                }`}
                title={showSecret ? totpSecret : undefined}
              >
                {showSecret ? totpSecret : '密钥已隐藏'}
              </span>
              {!revealAll && (
                <button
                  type="button"
                  onClick={() => setRevealed((r) => !r)}
                  className="flex shrink-0 items-center rounded px-1.5 py-0.5 text-muted hover:bg-white"
                >
                  {revealed ? <EyeOff size={10} /> : <Eye size={10} />}
                </button>
              )}
              <CopyBtn value={totpSecret} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CopyBtn({ value }: { value: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const onClick = (): void => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-0.5 rounded bg-white px-1.5 py-0.5 text-[10px] text-muted hover:bg-border/50"
    >
      {copied ? <Check size={9} className="text-success" /> : <Copy size={9} />}
      {copied ? '已复制' : '复制'}
    </button>
  );
}

function buildTotp(input: string): TOTP {
  if (input.startsWith('otpauth://')) {
    const parsed = URI.parse(input);
    if (parsed instanceof TOTP) return parsed;
    throw new Error('不支持此类型');
  }
  const cleaned = input.replace(/\s+/g, '').toUpperCase();
  return new TOTP({
    secret: cleaned,
    algorithm: 'SHA1',
    digits: 6,
    period: TOTP_PERIOD,
  });
}
