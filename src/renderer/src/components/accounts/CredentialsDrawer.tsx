import { useEffect, useState } from 'react';
import type { AccountCredentials, AccountInfo } from '../../../../shared/types';
import { useStore } from '../../store';
import { computeTotp, TOTP_PERIOD } from '../../lib/totp';
import SmsCodeBox from './SmsCodeBox';
import StartedAtInput from './StartedAtInput';
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
  CreditCard,
  CalendarClock,
  MapPin,
  StickyNote,
} from 'lucide-react';

interface Props {
  email: string;
  onClose: () => void;
}

export default function CredentialsDrawer({ email, onClose }: Props): JSX.Element {
  const [creds, setCreds] = useState<AccountCredentials | null>(null);
  const [revealAll, setRevealAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<AccountInfo>({});
  const [saving, setSaving] = useState(false);
  const account = useStore((s) => s.accounts.find((a) => a.email === email) ?? null);
  const setStartedAt = useStore((s) => s.setStartedAt);
  const refresh = async (): Promise<void> => {
    const c = await window.api.accounts.getCredentials(email);
    setCreds(c);
    setForm({
      googlePassword: c.googlePassword ?? '',
      totpSecret: c.totpSecret ?? '',
      recoveryEmail: c.recoveryEmail ?? '',
      link: c.link ?? '',
      cardLast4: c.cardLast4 ?? '',
      cardExpiry: c.cardExpiry ?? '',
      billingAddress: c.billingAddress ?? '',
      note: c.note ?? '',
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
      cardLast4: form.cardLast4?.trim() || undefined,
      cardExpiry: form.cardExpiry?.trim() || undefined,
      billingAddress: form.billingAddress?.trim() || undefined,
      note: form.note?.trim() || undefined,
    });
    await refresh();
    setEditing(false);
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-xl bg-surface shadow-popover animate-slide-up"
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
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
                title="编辑"
              >
                <Pencil size={11} /> 编辑
              </button>
            )}
            <button
              type="button"
              onClick={() => setRevealAll((r) => !r)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
            >
              {revealAll ? <EyeOff size={11} /> : <Eye size={11} />}
              {revealAll ? '隐藏' : '显示'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
            >
              <X size={14} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-3 rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-[11.5px] text-warning">
            <div className="flex items-start gap-1.5">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span>敏感信息，勿随意截图。凭据仅存在本机 Keychain，不上传任何地方。</span>
            </div>
          </div>

          <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-[12px]">
            <span className="shrink-0 text-muted">上号时间</span>
            <StartedAtInput
              value={account?.startedAt ?? null}
              onChange={(ts) => void setStartedAt(email, ts)}
            />
            {account?.startedAt != null && (
              <button
                type="button"
                onClick={() => void setStartedAt(email, null)}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-muted transition-colors duration-150 hover:bg-surface hover:text-text"
              >
                清除
              </button>
            )}
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
                critical
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

              <SectionTitle>支付信息</SectionTitle>
              <Row
                label="银行卡末四位"
                icon={<CreditCard size={12} />}
                value={creds.cardLast4 ? `•••• ${creds.cardLast4}` : undefined}
                copyValue={creds.cardLast4}
                emptyHint="未保存（点编辑添加）"
              />
              <Row
                label="卡片到期"
                icon={<CalendarClock size={12} />}
                value={creds.cardExpiry}
                emptyHint="未保存"
              />
              <Row
                label="账单地址"
                icon={<MapPin size={12} />}
                value={creds.billingAddress}
                multiline
                emptyHint="未保存"
              />
              <Row
                label="备注"
                icon={<StickyNote size={12} />}
                value={creds.note}
                multiline
                emptyHint="未保存"
              />
            </div>
          )}
        </div>

        {editing && (
          <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-md px-3 py-1.5 text-sm text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving}
              className="flex items-center gap-1 rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-white transition duration-150 hover:bg-accent/90 active:scale-[0.98] disabled:opacity-50"
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

      <SectionTitle>支付信息</SectionTitle>
      <Field
        label="银行卡末四位"
        value={form.cardLast4 ?? ''}
        onChange={(v) => setForm({ ...form, cardLast4: v.replace(/\D/g, '').slice(0, 4) })}
        type="text"
        inputMode="numeric"
        placeholder="如 4242"
        mono
      />
      <Field
        label="卡片到期"
        value={form.cardExpiry ?? ''}
        onChange={(v) => setForm({ ...form, cardExpiry: v })}
        type="text"
        placeholder="MM/YY，如 09/27"
        mono
      />
      <Field
        label="账单地址"
        value={form.billingAddress ?? ''}
        onChange={(v) => setForm({ ...form, billingAddress: v })}
        type="text"
        multiline
        placeholder="收账单的地址"
      />
      <Field
        label="备注"
        value={form.note ?? ''}
        onChange={(v) => setForm({ ...form, note: v })}
        type="text"
        multiline
        placeholder="其它想记的信息"
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
  multiline,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  mono?: boolean;
  multiline?: boolean;
  placeholder?: string;
  inputMode?: 'numeric';
}): JSX.Element {
  const cls = `mt-0.5 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 ${
    mono ? 'font-mono text-[12px]' : ''
  }`;
  return (
    <label className="block text-sm">
      <span className="text-[11px] font-medium text-muted">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className={`${cls} resize-y`}
        />
      ) : (
        <input
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cls}
        />
      )}
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{children}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function Row({
  label,
  icon,
  value,
  copyValue,
  secret,
  mono,
  multiline,
  revealAll,
  emptyHint,
  critical,
}: {
  label: string;
  icon: React.ReactNode;
  value?: string;
  /** 复制时实际写入剪贴板的值（默认用 value）。如卡号显示 "•••• 4242" 但复制 "4242" */
  copyValue?: string;
  secret?: boolean;
  mono?: boolean;
  multiline?: boolean;
  revealAll?: boolean;
  emptyHint?: string;
  critical?: boolean;
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
      <div
        className={`flex gap-1.5 rounded-lg border border-border bg-surface-2/50 px-2.5 py-1.5 ${
          multiline ? 'items-start' : 'items-center'
        }`}
      >
        {value ? (
          <>
            <span
              className={`min-w-0 flex-1 text-[13px] ${mono ? 'font-mono' : ''} ${
                multiline ? 'whitespace-pre-wrap break-words' : 'truncate'
              }`}
              title={show && !multiline ? value : undefined}
            >
              {displayValue}
            </span>
            {secret && !revealAll && (
              <button
                type="button"
                onClick={() => setRevealed((r) => !r)}
                className="flex shrink-0 items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] text-muted transition-colors duration-150 hover:bg-surface hover:text-text"
              >
                {revealed ? <EyeOff size={10} /> : <Eye size={10} />}
              </button>
            )}
            <CopyBtn value={copyValue ?? value} />
          </>
        ) : (
          <span className={`text-[12px] ${critical ? 'text-danger' : 'text-muted'}`}>
            {emptyHint ?? '未设置'}
          </span>
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

  const { code, remaining } = computeTotp(totpSecret ?? '', now);

  const progressPct = ((TOTP_PERIOD - remaining) / TOTP_PERIOD) * 100;
  const showSecret = revealed || revealAll;

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted">
        <ShieldCheck size={12} className="text-accent" />
        <span className="font-medium">2FA 密钥</span>
      </div>
      <div className="rounded-lg border border-border bg-surface-2/50 px-2.5 py-2">
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
                  className="flex shrink-0 items-center rounded px-1.5 py-0.5 text-muted transition-colors duration-150 hover:bg-surface hover:text-text"
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
      className="flex shrink-0 items-center gap-0.5 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
    >
      {copied ? <Check size={9} className="text-success" /> : <Copy size={9} />}
      {copied ? '已复制' : '复制'}
    </button>
  );
}
