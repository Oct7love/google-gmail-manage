import { useRef, useState } from 'react';
import { useStore } from '../../store';
import TotpPanel from './TotpPanel';
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
} from 'lucide-react';

// React 对自定义 <webview> 标签没有内建类型；用 any 放行
type WebviewEl = HTMLElement & {
  loadURL: (url: string) => void;
  reload: () => void;
  src?: string;
};
const WebView = 'webview' as unknown as React.FC<Record<string, unknown>>;

const APP_PASSWORD_URL = 'https://myaccount.google.com/apppasswords';
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
  const [resetKey, setResetKey] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);

  // 批量导入
  const [imported, setImported] = useState<ParsedAccount | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [initialTotpSecret, setInitialTotpSecret] = useState<string>('');

  const webviewRef = useRef<WebviewEl | null>(null);
  const emailInputRef = useRef<HTMLInputElement | null>(null);

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
    const submitFn = isUpdate ? () => submitUpdate(lockedEmail!, password) : () => submitAdd(email, password);
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
    setInitialTotpSecret('');
    setImportText('');
    setResetKey((k) => k + 1);
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
    setInitialTotpSecret(parsed.totpSecret);
    setResetKey((k) => k + 1);
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

            <TotpPanel key={resetKey} initialSecret={initialTotpSecret} />

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
            <WebView
              ref={webviewRef as unknown as React.Ref<Record<string, unknown>>}
              src={APP_PASSWORD_URL}
              className="flex-1 w-full"
              style={{ display: 'flex' }}
              partition="persist:google-apppasswords"
              allowpopups="true"
            />
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
