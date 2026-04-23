import { useRef, useState } from 'react';
import { useStore } from '../../store';
import TotpPanel from './TotpPanel';

// React 对自定义 <webview> 标签没有内建类型；用 any 放行
// （Electron webview 是 custom element，提供 loadURL / reload 等方法）
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
      // 忽略 — webview 尚未 ready 时调用会抛
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
      // 更新完就关，不需要批量
      close();
      return;
    }

    // 新增成功：清空表单 + 清空 2FA 面板 + 登出 webview 准备加下一个
    const addedEmail = email;
    setEmail('');
    setPassword('');
    setError(null);
    setLastAdded(addedEmail);
    setResetKey((k) => k + 1); // 触发 TotpPanel 重置
    logoutWebview();
    setTimeout(() => emailInputRef.current?.focus(), 30);
  };

  const openInBrowser = (): void => {
    void window.api.system.openAppPasswordPage();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
      <div className="flex h-[640px] w-full max-w-[1100px] overflow-hidden rounded-lg bg-white shadow-2xl">
        {/* 左：表单 */}
        <div className="flex w-[420px] shrink-0 flex-col border-r border-border">
          <header className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-base font-semibold">{title}</h2>
            <button
              type="button"
              onClick={close}
              disabled={busy}
              className="rounded-md p-1 text-muted hover:bg-sidebar"
              aria-label="关闭"
            >
              ✕
            </button>
          </header>

          <form
            onSubmit={(e) => void onSubmit(e)}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4"
          >
            {lastAdded && !isUpdate && (
              <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-success">
                ✅ 已添加 <span className="font-mono">{lastAdded}</span>，可以继续添加下一个账号。
              </div>
            )}

            <div className="rounded-md bg-blue-50 px-3 py-2.5 text-xs leading-relaxed text-accent">
              <div className="mb-1 font-medium">怎么生成应用密码</div>
              <ol className="list-decimal space-y-0.5 pl-4">
                <li>在要添加的 Gmail 账号里开启 2FA（如果还没开）</li>
                <li>在右边页面里生成一个 16 位密码（没登录会先让登录）</li>
                <li>复制回来粘贴到下面 → 点"验证并添加"</li>
              </ol>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowWebView((s) => !s)}
                  className="rounded border border-accent/60 bg-white px-2 py-0.5 hover:bg-accent/5"
                >
                  {showWebView ? '折叠侧边浏览器' : '展开侧边浏览器'}
                </button>
                <button
                  type="button"
                  onClick={logoutWebview}
                  className="rounded border border-accent/60 bg-white px-2 py-0.5 hover:bg-accent/5"
                >
                  登出侧边 Google
                </button>
                <button
                  type="button"
                  onClick={openInBrowser}
                  className="rounded border border-accent/60 bg-white px-2 py-0.5 hover:bg-accent/5"
                >
                  在系统浏览器打开
                </button>
              </div>
            </div>

            <label className="block text-sm">
              <span className="font-medium">Gmail 地址</span>
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
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:bg-sidebar"
                required
                autoFocus={!isUpdate}
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium">应用专用密码（16 位）</span>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="abcd efgh ijkl mnop（空格会自动去掉）"
                className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 font-mono text-xs focus:border-accent focus:outline-none"
                required
                autoFocus={isUpdate}
              />
            </label>

            <TotpPanel key={resetKey} />

            {error && (
              <div className="whitespace-pre-wrap rounded-md bg-red-50 px-3 py-2 text-xs text-danger">
                {error}
              </div>
            )}

            <div className="flex-1" />

            <footer className="flex items-center justify-end gap-2 border-t border-border pt-4">
              <button
                type="button"
                onClick={close}
                disabled={busy}
                className="rounded-md px-3 py-2 text-sm text-muted hover:bg-sidebar"
              >
                {isUpdate ? '取消' : '完成'}
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {busy ? '验证中…' : isUpdate ? '更新' : '验证并添加'}
              </button>
            </footer>
          </form>
        </div>

        {/* 右：Google 应用密码页 */}
        {showWebView && (
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex items-center justify-between border-b border-border px-4 py-2 text-[11px] text-muted">
              <span className="truncate">
                🔐 Google 应用密码页（登录 → 生成 → 复制密码）
              </span>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => webviewRef.current?.reload()}
                  className="rounded px-2 py-0.5 hover:bg-sidebar"
                >
                  ↻ 刷新
                </button>
                <button
                  type="button"
                  onClick={openInBrowser}
                  className="rounded px-2 py-0.5 hover:bg-sidebar"
                >
                  改用系统浏览器 ↗
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
      </div>
    </div>
  );
}
