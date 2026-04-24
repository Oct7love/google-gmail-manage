import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import TotpPanel from './TotpPanel';
import SmsCodeBox from './SmsCodeBox';
import { parseAccountLine, ParsedAccount } from '../../lib/parseAccount';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Copy,
  Check,
  ClipboardPaste,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RotateCw,
  LogOut,
  ExternalLink,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Settings,
  Globe,
} from 'lucide-react';

// React 对自定义 <webview> 标签没有内建类型；用 any 放行
type WebviewEl = HTMLElement & {
  loadURL: (url: string) => void;
  reload: () => void;
  src?: string;
};
const WebView = 'webview' as unknown as React.FC<Record<string, unknown>>;

const APP_PASSWORD_URL = 'https://myaccount.google.com/apppasswords';
const TWO_FA_URL = 'https://myaccount.google.com/signinoptions/two-step-verification';
const LOGOUT_URL = `https://accounts.google.com/Logout?continue=${encodeURIComponent(APP_PASSWORD_URL)}`;

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
  const [showWebView, setShowWebView] = useState(true);
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

  const webviewRef = useRef<WebviewEl | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

  // webview 加载错误 / 代理设置
  const [webviewError, setWebviewError] = useState<string | null>(null);
  const [proxyPanelOpen, setProxyPanelOpen] = useState(false);
  const [proxyInput, setProxyInput] = useState('');
  const [proxySaving, setProxySaving] = useState(false);

  // 启动时读已存的代理设置
  useEffect(() => {
    void window.api.system.getSettings().then((s) => {
      if (s.webviewProxy) setProxyInput(s.webviewProxy);
    });
  }, []);

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

  // webview 事件监听（did-fail-load / did-finish-load）
  const webviewRefCallback = useCallback((el: HTMLElement | null) => {
    const prev = webviewRef.current;
    if (prev) {
      // 清掉旧的监听
      (prev as HTMLElement).removeEventListener('did-fail-load', onWebviewFail as EventListener);
      (prev as HTMLElement).removeEventListener('did-finish-load', onWebviewOk as EventListener);
    }
    webviewRef.current = el as WebviewEl | null;
    if (el) {
      el.addEventListener('did-fail-load', onWebviewFail as EventListener);
      el.addEventListener('did-finish-load', onWebviewOk as EventListener);
    }
  }, []);

  function onWebviewFail(e: Event): void {
    // webview 的 did-fail-load 带 errorCode / errorDescription 属性（在 CustomEvent 的 detail 或直接 on event）
    const ev = e as Event & { errorCode?: number; errorDescription?: string; validatedURL?: string };
    // 忽略 ERR_ABORTED（-3），因为我们主动调用 loadURL 会触发这个
    if (ev.errorCode === -3) return;
    setWebviewError(ev.errorDescription || '加载失败');
  }

  function onWebviewOk(): void {
    setWebviewError(null);
  }

  const saveProxy = async (): Promise<void> => {
    setProxySaving(true);
    await window.api.system.setSettings({ webviewProxy: proxyInput.trim() });
    setProxySaving(false);
    setProxyPanelOpen(false);
    // 重新加载 webview 生效
    try {
      webviewRef.current?.loadURL(APP_PASSWORD_URL);
      setWebviewError(null);
    } catch {
      /* noop */
    }
  };

  if (mode === null) return null;

  const title = isUpdate ? `更新 ${lockedEmail} 的应用密码` : '添加 Gmail 账号';

  const logoutWebview = (): void => {
    const v = webviewRef.current;
    if (!v) return;
    try {
      v.loadURL(LOGOUT_URL);
    } catch {
      /* noop */
    }
  };

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
    logoutWebview();
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

  const openInBrowser = (): void => {
    void window.api.system.openAppPasswordPage();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="flex h-[660px] w-full max-w-[1100px] overflow-hidden rounded-lg bg-white shadow-2xl">
        {/* 左：表单（3 段：header / scroll / footer） */}
        <div className="flex w-[440px] shrink-0 flex-col border-r border-border">
          {/* Header */}
          <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="flex h-6 w-6 items-center justify-center rounded-md text-muted hover:bg-sidebar"
              aria-label="关闭"
            >
              <X size={14} />
            </button>
          </header>

          {/* 成功提示：固定横条（不占滚动区空间） */}
          {lastAdded && !isUpdate && (
            <div className="flex shrink-0 items-center gap-1.5 border-b border-emerald-200 bg-emerald-50 px-5 py-1.5 text-[11.5px] text-success">
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
                    className="flex items-center justify-center gap-1.5 rounded-md border border-border bg-sidebar/50 px-3 py-1.5 text-[12px] text-text hover:bg-sidebar"
                  >
                    <ClipboardPaste size={13} />
                    粘贴一行账号信息自动解析
                  </button>
                ) : (
                  <div className="rounded-md border border-border bg-white p-2">
                    <textarea
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder="账号 密码 辅邮 2fa密钥&#10;或&#10;账号----密码----辅邮----2fa密钥----链接"
                      rows={3}
                      className="w-full resize-y rounded border border-border bg-white px-2 py-1.5 font-mono text-[11px] focus:border-accent focus:outline-none"
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
                        className="rounded px-2 py-1 text-[11px] text-muted hover:bg-sidebar"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={onImportParse}
                        className="rounded bg-accent px-2.5 py-1 text-[11px] text-white hover:bg-accent/90"
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
              <div className="rounded-md border border-border bg-sidebar/40 p-2 text-[11px]">
                <div className="mb-1 font-medium text-text">登录辅助</div>
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

            {/* 帮助（默认折叠，点开看步骤） */}
            {!isUpdate && (
              <div className="rounded-md border border-border bg-blue-50/40">
                <button
                  type="button"
                  onClick={() => setHelpOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-[11.5px] text-accent"
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
                      <li>
                        右边 webview 里登录 → 点"→ 应用密码页"按钮 → 输名字 → 生成 16 位密码
                      </li>
                      <li>复制回来粘贴到下方"应用专用密码" → 点"验证并添加"</li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* 表单字段 */}
            <label className="block">
              <span className="text-[12.5px] font-medium">Gmail 地址</span>
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
                className="mt-0.5 w-full rounded-md border border-border bg-white px-3 py-1.5 text-[13px] focus:border-accent focus:outline-none disabled:bg-sidebar"
                required
                autoFocus={!isUpdate}
              />
            </label>

            <label className="block">
              <span className="text-[12.5px] font-medium">应用专用密码（16 位）</span>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="abcd efgh ijkl mnop（空格会自动去掉）"
                className="mt-0.5 w-full rounded-md border border-border bg-white px-3 py-1.5 font-mono text-[12px] focus:border-accent focus:outline-none"
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
              <div className="whitespace-pre-wrap rounded-md bg-red-50 px-3 py-2 text-[12px] text-danger">
                {error}
              </div>
            )}
          </form>

          {/* Footer（固定，永远可见） */}
          <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-white px-5 py-3">
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="rounded-md px-3 py-1.5 text-[13px] text-muted hover:bg-sidebar"
            >
              {isUpdate ? '取消' : '完成'}
            </button>
            <button
              type="submit"
              form="add-account-form"
              disabled={busy}
              className="rounded-md bg-accent px-4 py-1.5 text-[13px] font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {busy ? '验证中…' : isUpdate ? '更新' : '验证并添加'}
            </button>
          </footer>
        </div>

        {/* 右：Google 应用密码页 */}
        {showWebView && (
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between gap-2 border-b border-border bg-sidebar/30 px-3 py-1.5 text-[11px] text-muted">
              <span className="shrink-0 font-medium">Google 应用密码页</span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => webviewRef.current?.loadURL(APP_PASSWORD_URL)}
                  className="flex items-center gap-1 rounded-md bg-accent/10 px-2 py-1 font-medium text-accent hover:bg-accent/20"
                  title="直接跳转到应用密码页"
                >
                  <ArrowRight size={11} />
                  应用密码页
                </button>
                <button
                  type="button"
                  onClick={() => webviewRef.current?.loadURL(TWO_FA_URL)}
                  className="flex items-center gap-1 rounded-md bg-accent/10 px-2 py-1 font-medium text-accent hover:bg-accent/20"
                  title="跳转到两步验证设置页（修改 2FA 密钥用）"
                >
                  <ArrowRight size={11} />
                  2FA 设置
                </button>
                <button
                  type="button"
                  onClick={logoutWebview}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-white hover:bg-sidebar"
                  title="登出侧边 Google"
                >
                  <LogOut size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => webviewRef.current?.reload()}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-white hover:bg-sidebar"
                  title="刷新"
                >
                  <RotateCw size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => setProxyPanelOpen((o) => !o)}
                  className={`flex h-6 w-6 items-center justify-center rounded-md border border-border bg-white hover:bg-sidebar ${
                    proxyInput ? 'text-accent' : ''
                  }`}
                  title="配置 webview 代理（Google 连不上时用）"
                >
                  <Settings size={11} />
                </button>
                <button
                  type="button"
                  onClick={() => setShowWebView(false)}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-white hover:bg-sidebar"
                  title="折叠侧边浏览器"
                >
                  <ChevronRight size={11} />
                </button>
                <button
                  type="button"
                  onClick={openInBrowser}
                  className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-white hover:bg-sidebar"
                  title="改用系统浏览器"
                >
                  <ExternalLink size={11} />
                </button>
              </div>
            </header>

            {proxyPanelOpen && (
              <div className="border-b border-border bg-blue-50/40 px-3 py-2 text-[11px]">
                <div className="mb-1 flex items-center gap-1.5 text-accent">
                  <Globe size={11} />
                  <span className="font-medium">webview 代理</span>
                </div>
                <div className="mb-1.5 text-muted">
                  Google 连不上时填一个本地代理（只影响这个内嵌浏览器，不影响 IMAP / 翻译）。留空=直连。
                </div>
                <div className="flex gap-1">
                  <input
                    value={proxyInput}
                    onChange={(e) => setProxyInput(e.target.value)}
                    placeholder="http://127.0.0.1:7890 或 socks5://127.0.0.1:1080"
                    className="flex-1 rounded border border-border bg-white px-2 py-1 font-mono text-[11px] focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void saveProxy()}
                    disabled={proxySaving}
                    className="rounded bg-accent px-2 py-1 text-[11px] text-white hover:bg-accent/90 disabled:opacity-50"
                  >
                    {proxySaving ? '保存…' : '保存并重载'}
                  </button>
                </div>
              </div>
            )}

            <div className="relative flex flex-1">
              <WebView
                ref={webviewRefCallback as unknown as React.Ref<Record<string, unknown>>}
                src={APP_PASSWORD_URL}
                className="flex-1 w-full"
                style={{ display: 'flex' }}
                partition="persist:google-apppasswords"
                allowpopups="true"
              />
              {webviewError && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/95 p-8">
                  <div className="max-w-sm text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                      <AlertTriangle size={24} className="text-warning" />
                    </div>
                    <h3 className="mb-1 text-sm font-semibold text-text">连不上 Google</h3>
                    <p className="mb-4 text-xs text-muted">
                      {webviewError}
                      <br />
                      常见原因：国内网络 / 代理没开 / VPN 断了
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setWebviewError(null);
                          webviewRef.current?.loadURL(APP_PASSWORD_URL);
                        }}
                        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90"
                      >
                        重试
                      </button>
                      <button
                        type="button"
                        onClick={() => setProxyPanelOpen(true)}
                        className="rounded-md border border-border bg-white px-3 py-1.5 text-xs text-text hover:bg-sidebar"
                      >
                        <Settings size={11} className="mr-1 inline" />
                        配置代理
                      </button>
                      <button
                        type="button"
                        onClick={openInBrowser}
                        className="rounded-md border border-border bg-white px-3 py-1.5 text-xs text-text hover:bg-sidebar"
                      >
                        <ExternalLink size={11} className="mr-1 inline" />
                        用系统浏览器打开
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 右：折叠时的竖条 */}
        {!showWebView && (
          <button
            type="button"
            onClick={() => setShowWebView(true)}
            className="flex w-10 shrink-0 items-center justify-center border-l border-border bg-sidebar/50 text-muted hover:bg-sidebar"
            title="展开侧边浏览器"
          >
            <ChevronLeft size={14} />
          </button>
        )}
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
      className="flex shrink-0 items-center gap-0.5 rounded border border-border bg-white px-1.5 py-0.5 text-[10px] text-muted hover:bg-white/80"
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
