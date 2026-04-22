import { useCallback, useEffect, useState } from 'react';
import type { Account, MessageDetail, MessageSummary } from '../../shared/types';
import SetupWizard from './components/SetupWizard';

type AppStatus = 'loading' | 'needs-credentials' | 'ready';

export default function App(): JSX.Element {
  const [status, setStatus] = useState<AppStatus>('loading');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [messages, setMessages] = useState<MessageSummary[]>([]);
  const [detail, setDetail] = useState<MessageDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<string>('');

  const appendLog = (line: string): void =>
    setLog((prev) => `[${new Date().toLocaleTimeString()}] ${line}\n${prev}`.slice(0, 5000));

  const reloadAccounts = useCallback(async (): Promise<Account[]> => {
    const list = await window.api.accounts.list();
    setAccounts(list);
    return list;
  }, []);

  const reloadMessages = useCallback(async (email: string): Promise<void> => {
    const list = await window.api.messages.list(email, 10);
    setMessages(list);
  }, []);

  const init = useCallback(async () => {
    const creds = await window.api.credentials.status();
    if (!creds.configured) {
      setStatus('needs-credentials');
      return;
    }
    const list = await reloadAccounts();
    if (list.length && !selected) setSelected(list[0].email);
    setStatus('ready');
  }, [reloadAccounts, selected]);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (selected) void reloadMessages(selected);
  }, [selected, reloadMessages]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center text-muted">加载中…</div>
    );
  }
  if (status === 'needs-credentials') {
    return <SetupWizard onDone={init} />;
  }

  const onAdd = async (): Promise<void> => {
    setBusy('add');
    appendLog('启动 OAuth 流程，等浏览器完成授权…');
    const res = await window.api.accounts.add();
    setBusy(null);
    if (res.ok && res.email) {
      appendLog(`✅ 添加成功：${res.email}`);
      const list = await reloadAccounts();
      const newAcct = list.find((a) => a.email === res.email) ?? list[0];
      setSelected(newAcct.email);
    } else if (res.code === 'cancelled') {
      appendLog(`ℹ️ 授权已取消（${res.error ?? ''}）`);
    } else {
      appendLog(`❌ 添加失败：${res.error ?? '未知错误'}`);
    }
  };

  const onSync = async (): Promise<void> => {
    if (!selected) return;
    setBusy('sync');
    appendLog(`同步 ${selected} …`);
    const res = await window.api.messages.sync(selected, 10);
    setBusy(null);
    if (res.status === 'ok') appendLog(`✅ 拉到 ${res.fetched} 封新邮件`);
    else if (res.status === 'expired') appendLog(`⚠️ 账号已过期，需重新授权`);
    else appendLog(`❌ 同步出错：${res.error ?? ''}`);
    await reloadAccounts();
    await reloadMessages(selected);
  };

  const onRemove = async (): Promise<void> => {
    if (!selected) return;
    const res = await window.api.accounts.remove(selected);
    if (res.ok) {
      appendLog(`✅ 已移除 ${selected}`);
      const list = await reloadAccounts();
      setSelected(list[0]?.email ?? '');
      setMessages([]);
    } else {
      appendLog(`ℹ️ 取消移除`);
    }
  };

  const onOpenMessage = async (m: MessageSummary): Promise<void> => {
    const d = await window.api.messages.detail(m.accountEmail, m.messageId);
    setDetail(d);
  };

  return (
    <div className="flex h-screen flex-col p-6">
      <header className="mb-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold text-accent">Mail Viewer — P3 调试界面</h1>
          <p className="text-xs text-muted">已配置凭据 ✓ · 账号数：{accounts.length}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAdd}
            disabled={busy !== null}
            className="rounded-md bg-accent px-3 py-1.5 text-xs text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {busy === 'add' ? '添加中…' : '+ 添加账号'}
          </button>
          <button
            type="button"
            onClick={onSync}
            disabled={!selected || busy !== null}
            className="rounded-md border border-border bg-white px-3 py-1.5 text-xs hover:bg-sidebar disabled:opacity-50"
          >
            刷新当前账号
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={!selected || busy !== null}
            className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs text-danger hover:bg-red-50 disabled:opacity-50"
          >
            移除当前账号
          </button>
        </div>
      </header>

      <section className="mb-3 flex items-center gap-2">
        <label className="text-xs text-muted">当前账号：</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-md border border-border bg-white px-2 py-1 text-sm"
        >
          <option value="">（无账号）</option>
          {accounts.map((a) => (
            <option key={a.email} value={a.email}>
              {a.email}
              {a.lastSyncStatus ? ` · ${a.lastSyncStatus}` : ''}
            </option>
          ))}
        </select>
      </section>

      <section className="flex min-h-0 flex-1 gap-4">
        <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-border bg-white">
          <div className="border-b border-border px-3 py-2 text-xs font-medium">
            邮件列表（{messages.length}） — 点行查看正文
          </div>
          <div className="flex-1 overflow-auto">
            {messages.length === 0 ? (
              <p className="p-4 text-sm text-muted">暂无邮件。点击"添加账号"或"刷新当前账号"。</p>
            ) : (
              <ul className="divide-y divide-border">
                {messages.map((m) => (
                  <li
                    key={m.messageId}
                    onClick={() => void onOpenMessage(m)}
                    className="cursor-pointer px-3 py-2 text-xs hover:bg-sidebar"
                  >
                    <div className="flex justify-between">
                      <span className="truncate font-medium">{m.fromAddr}</span>
                      <span className="text-muted">
                        {new Date(m.dateTs).toLocaleString()}
                      </span>
                    </div>
                    <div className="truncate text-text">{m.subject}</div>
                    <div className="truncate text-muted">{m.snippet}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex w-96 flex-col overflow-hidden rounded-md border border-border bg-black/90 text-xs text-green-200">
          <div className="border-b border-white/10 px-3 py-2 text-xs font-medium text-white/80">
            日志
          </div>
          <pre className="flex-1 overflow-auto whitespace-pre-wrap p-3 font-mono">{log || '（暂无）'}</pre>
        </div>
      </section>

      {detail && (
        <MessageViewer detail={detail} onClose={() => setDetail(null)} />
      )}
    </div>
  );
}

function MessageViewer({
  detail,
  onClose,
}: {
  detail: MessageDetail;
  onClose: () => void;
}): JSX.Element {
  // 构造沙盒 iframe 的 srcDoc：禁用脚本、禁用外部资源、只渲染样式
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:;">`;
  const wrap = (body: string): string =>
    `<!doctype html><html><head>${csp}<meta charset="utf-8"><style>body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;padding:16px;margin:0;}</style></head><body>${body}</body></html>`;
  const html = detail.bodyHtml
    ? wrap(detail.bodyHtml)
    : wrap(`<pre style="white-space:pre-wrap">${escapeHtml(detail.bodyText ?? '(空)')}</pre>`);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-10"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-md bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="border-b border-border px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold">{detail.subject || '(无主题)'}</h2>
              <p className="mt-1 truncate text-xs text-muted">
                {detail.fromAddr} · {new Date(detail.dateTs).toLocaleString()}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-xs text-muted hover:bg-sidebar"
            >
              关闭
            </button>
          </div>
        </header>
        <iframe
          title="邮件正文"
          sandbox="allow-same-origin"
          srcDoc={html}
          className="flex-1 w-full border-0"
        />
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
