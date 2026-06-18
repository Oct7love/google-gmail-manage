import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import TotpPanel from './TotpPanel';
import SmsCodeBox from './SmsCodeBox';
import { parseAccountLine, ParsedAccount } from '../../lib/parseAccount';
import {
  X,
  Copy,
  Check,
  ClipboardPaste,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

export default function AddAccountDialog(): JSX.Element | null {
  const mode = useStore((s) => s.dialogMode);
  const close = useStore((s) => s.closeDialog);
  const submitAdd = useStore((s) => s.submitAdd);
  const submitUpdate = useStore((s) => s.submitUpdate);

  const isUpdate = mode !== null && mode !== 'new';
  const lockedEmail = isUpdate && mode && typeof mode === 'object' ? mode.update : null;

  const [email, setEmail] = useState<string>(lockedEmail ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [openingChrome, setOpeningChrome] = useState(false);
  const [chromeError, setChromeError] = useState<string | null>(null);
  const [lastAdded, setLastAdded] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // 批量导入
  const [imported, setImported] = useState<ParsedAccount | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  // 2FA 密钥：受控状态，用户在 TotpPanel 里改了什么这里就是什么
  const [totpSecret, setTotpSecret] = useState<string>('');
  const [originalTotpSecret, setOriginalTotpSecret] = useState<string>('');

  const emailInputRef = useRef<HTMLInputElement | null>(null);

  // 切换到更新模式 or 切换到不同账号 → 把锁定邮箱同步到输入框
  // （组件常驻 App 不 unmount，useState 初始值只用一次，所以需要 effect）
  useEffect(() => {
    if (lockedEmail) setEmail(lockedEmail);
  }, [lockedEmail]);

  // 更新模式下，把该账号已保存的附加信息（Google 密码 / 2FA / 辅邮 / 链接）拉出来预填
  // 省得用户每次更新都要重粘一遍
  useEffect(() => {
    if (!isUpdate || !lockedEmail) return;
    let cancelled = false;
    void window.api.accounts.getCredentials(lockedEmail).then((creds) => {
      if (cancelled) return;
      const hasExtra = creds.googlePassword || creds.recoveryEmail || creds.link || creds.totpSecret;
      if (hasExtra) {
        setImported({
          email: lockedEmail,
          googlePassword: creds.googlePassword ?? '',
          recoveryEmail: creds.recoveryEmail ?? '',
          totpSecret: creds.totpSecret ?? '',
          link: creds.link,
        });
      }
      if (creds.totpSecret) {
        setTotpSecret(creds.totpSecret);
        setOriginalTotpSecret(creds.totpSecret);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isUpdate, lockedEmail]);

  if (mode === null) return null;

  const title = isUpdate ? `更新 ${lockedEmail} 的应用密码` : '添加 Gmail 账号';

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // 提交时用的是**当前** TOTP 面板里的密钥（用户可能刚改过）+ 其他字段
    const info = imported || totpSecret.trim()
      ? {
          googlePassword: imported?.googlePassword,
          totpSecret: totpSecret.trim() || undefined,
          recoveryEmail: imported?.recoveryEmail,
          link: imported?.link,
        }
      : undefined;
    const submitFn = isUpdate
      ? () => submitUpdate(lockedEmail!, password, info)
      : () => submitAdd(email, password, info);
    const res = await submitFn();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? '未知错误');
      return;
    }

    if (isUpdate) {
      close();
      return;
    }

    const addedEmail = email;
    setEmail('');
    setPassword('');
    setError(null);
    setLastAdded(addedEmail);
    setImported(null);
    setTotpSecret('');
    setOriginalTotpSecret('');
    setImportText('');
    setTimeout(() => emailInputRef.current?.focus(), 30);
  };

  const onImportParse = (): void => {
    const parsed = parseAccountLine(importText);
    if (!parsed) {
      setImportError('解析失败。支持两种格式：\n  账号 密码 辅邮 2fa密钥\n  账号----密码----辅邮----2fa密钥----链接');
      return;
    }
    setImportError(null);
    setImported(parsed);
    setEmail(parsed.email);
    setTotpSecret(parsed.totpSecret);
    setOriginalTotpSecret(parsed.totpSecret);
    setImportOpen(false);
    setImportText('');
  };

  const copyToClipboard = (s: string): void => {
    void navigator.clipboard.writeText(s).catch(() => undefined);
  };

  const openInBrowser = async (): Promise<void> => {
    setOpeningChrome(true);
    setChromeError(null);
    const result = await window.api.system.openAppPasswordPage();
    setOpeningChrome(false);
    if (!result.ok) setChromeError(result.error ?? '无法打开 Google Chrome');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6 animate-fade-in">
      <div className="flex h-[660px] w-full max-w-[520px] overflow-hidden rounded-xl bg-surface shadow-popover animate-slide-up">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
              aria-label="关闭"
            >
              <X size={14} />
            </button>
          </header>

          {/* 成功提示：固定横条（不占滚动区空间） */}
          {lastAdded && !isUpdate && (
            <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-success/10 px-5 py-1.5 text-[11.5px] text-success">
              <CheckCircle2 size={13} />
              已添加 <span className="font-mono">{lastAdded}</span>，可继续下一个
            </div>
          )}

          {/* Scroll 区 */}
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4"
            id="add-account-form"
          >
            {/* 粘贴解析 */}
            {!isUpdate && (
              <>
                {!importOpen ? (
                  <button
                    type="button"
                    onClick={() => setImportOpen(true)}
                    className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2/60 px-3 py-1.5 text-[12px] text-text transition-colors duration-150 hover:bg-surface-2 active:scale-[0.98]"
                  >
                    <ClipboardPaste size={13} />
                    粘贴一行账号信息自动解析
                  </button>
                ) : (
                  <div className="rounded-lg border border-border bg-surface p-2">
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="账号 密码 辅邮 2fa密钥&#10;或&#10;账号----密码----辅邮----2fa密钥----链接"
                      rows={3}
                      className="w-full resize-y rounded-md border border-border bg-surface px-2 py-1.5 font-mono text-[11px] transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                    />
                    {importError && (
                      <div className="mt-1 whitespace-pre-wrap text-[11px] text-danger">
                        {importError}
                      </div>
                    )}
                    <div className="mt-1.5 flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setImportOpen(false);
                          setImportError(null);
                          setImportText('');
                        }}
                        className="rounded-md px-2 py-1 text-[11px] text-muted transition-colors duration-150 hover:bg-surface-2"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={onImportParse}
                        className="rounded-md bg-accent px-2.5 py-1 text-[11px] text-white transition duration-150 hover:bg-accent/90 active:scale-[0.98]"
                      >
                        解析并填入
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 登录辅助（imported 非空时显示） */}
            {imported && (
              <div className="rounded-lg border border-border bg-surface-2/60 p-2 text-[11px]">
                <div className="mb-1 text-[11px] font-medium text-muted">登录辅助</div>
                <ImportField
                  label="登录密码"
                  value={imported.googlePassword}
                  onCopy={copyToClipboard}
                  mono
                />
                <ImportField
                  label="辅邮"
                  value={imported.recoveryEmail}
                  onCopy={copyToClipboard}
                />
                {imported.link && (
                  <ImportField
                    label="链接"
                    value={imported.link}
                    onCopy={copyToClipboard}
                  />
                )}
              </div>
            )}

            {imported?.link && /^https?:\/\//i.test(imported.link) && (
              <SmsCodeBox url={imported.link} />
            )}

            <div className="rounded-lg border border-accent/20 bg-accent-soft/50 p-3">
              <div className="mb-2 flex items-start gap-2">
                <ExternalLink size={16} className="mt-0.5 shrink-0 text-accent" />
                <div>
                  <div className="text-[12px] font-medium text-text">
                    在无痕 Chrome 中生成应用密码
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                    Chrome 关闭后不会保留本次登录。生成 16 位密码后，请回到这里粘贴。
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void openInBrowser()}
                disabled={openingChrome}
                className="flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-[12px] font-medium text-white transition hover:bg-accent/90 active:scale-[0.99] disabled:opacity-50"
              >
                <ExternalLink size={13} />
                {openingChrome ? '正在打开…' : '用无痕 Chrome 打开应用密码页'}
              </button>
              {chromeError && (
                <p className="mt-2 text-[11px] leading-relaxed text-danger" role="alert">
                  {chromeError}
                </p>
              )}
            </div>

            {/* 帮助（默认折叠，点开看步骤） */}
            {!isUpdate && (
              <div className="overflow-hidden rounded-lg border border-accent/15 bg-accent-soft/50">
                <button
                  type="button"
                  onClick={() => setHelpOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-[11.5px] text-accent transition-colors duration-150 hover:bg-accent-soft/80"
                >
                  <span className="flex items-center gap-1.5">
                    <HelpCircle size={13} />
                    应用密码怎么生成？
                  </span>
                  {helpOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
                {helpOpen && (
                  <div className="border-t border-accent/20 px-3 py-2 text-[11.5px] leading-relaxed text-accent">
                    <ol className="list-decimal space-y-0.5 pl-4">
                      <li>开启 2FA（如果没开）</li>
                      <li>点击上方按钮，在无痕 Chrome 中登录并生成 16 位应用密码</li>
                      <li>复制回来粘贴到下方"应用专用密码" → 点"验证并添加"</li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* 表单字段 */}
            <label className="block">
              <span className="text-[11px] font-medium text-muted">Gmail 地址</span>
              <div className="relative mt-0.5 flex items-center gap-1.5">
                <input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  disabled={isUpdate}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (lastAdded) setLastAdded(null);
                  }}
                  placeholder="xxx@gmail.com"
                  className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-[13px] transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30 disabled:bg-surface-2 disabled:text-muted"
                  required
                  autoFocus={!isUpdate}
                />
                {email && (
                  <CopyButton value={email} onCopy={copyToClipboard} />
                )}
              </div>
            </label>

            <label className="block">
              <span className="text-[11px] font-medium text-muted">应用专用密码（16 位）</span>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="abcd efgh ijkl mnop（空格会自动去掉）"
                className="mt-0.5 w-full rounded-md border border-border bg-surface px-3 py-1.5 font-mono text-[12px] transition-colors duration-150 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/30"
                required
                autoFocus={isUpdate}
              />
            </label>

            <TotpPanel
              secret={totpSecret}
              onSecretChange={setTotpSecret}
              originalSecret={originalTotpSecret}
            />

            {error && (
              <div className="whitespace-pre-wrap rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {error}
              </div>
            )}
          </form>

          {/* Footer（固定，永远可见） */}
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-surface px-5 py-3">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="rounded-md px-3 py-1.5 text-[13px] text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
            >
              {isUpdate ? '取消' : '完成'}
            </button>
            <button
              type="submit"
              form="add-account-form"
              disabled={busy}
              className="rounded-md bg-accent px-4 py-1.5 text-[13px] font-medium text-white shadow-sm transition duration-150 hover:bg-accent/90 active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? '验证中…' : isUpdate ? '更新' : '验证并添加'}
            </button>
          </footer>
        </div>

      </div>
    </div>
  );
}

function ImportField({
  label,
  value,
  onCopy,
  mono,
}: {
  label: string;
  value: string;
  onCopy: (s: string) => void;
  mono?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-16 shrink-0 text-muted">{label}</span>
      <span
        className={`min-w-0 flex-1 truncate text-text ${mono ? 'font-mono' : ''}`}
        title={value}
      >
        {value}
      </span>
      <CopyButton value={value} onCopy={onCopy} />
    </div>
  );
}

function CopyButton({ value, onCopy }: { value: string; onCopy: (s: string) => void }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const onClick = (): void => {
    onCopy(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-0.5 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
    >
      {copied ? (
        <>
          <Check size={9} className="text-success" /> 已复制
        </>
      ) : (
        <>
          <Copy size={9} /> 复制
        </>
      )}
    </button>
  );
}
