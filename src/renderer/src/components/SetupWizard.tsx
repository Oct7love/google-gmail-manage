import { useState } from 'react';

interface Props {
  onDone: () => void;
}

interface Step {
  title: string;
  body: JSX.Element;
}

type ParsedJson = { clientId: string; clientSecret: string } | { error: string };

function parseOAuthJson(text: string): ParsedJson {
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    const inner =
      (obj['installed'] as Record<string, unknown> | undefined) ??
      (obj['web'] as Record<string, unknown> | undefined) ??
      obj;
    const clientId = String(inner['client_id'] ?? '');
    const clientSecret = String(inner['client_secret'] ?? '');
    if (!clientId || !clientSecret) return { error: 'JSON 里没找到 client_id / client_secret' };
    return { clientId, clientSecret };
  } catch {
    return { error: '不是合法的 JSON 文件' };
  }
}

export default function SetupWizard({ onDone }: Props): JSX.Element {
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onImportJson = async (file: File) => {
    const text = await file.text();
    const result = parseOAuthJson(text);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    setClientId(result.clientId);
    setClientSecret(result.clientSecret);
    setError(null);
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    const res = await window.api.credentials.set({ clientId, clientSecret });
    setSaving(false);
    if (res.ok) {
      onDone();
    } else {
      setError(res.error ?? '保存失败');
    }
  };

  const steps: Step[] = [
    {
      title: '打开 Google Cloud Console',
      body: (
        <StepBody>
          <p>我们要在 Google Cloud 里创建一个"OAuth 凭据"，让 App 能替你读 Gmail。</p>
          <p className="mt-3">
            点这里打开控制台（会在浏览器中打开）：
            <br />
            <a
              href="https://console.cloud.google.com/"
              className="text-accent underline"
              onClick={(e) => {
                e.preventDefault();
                // main 进程的 setWindowOpenHandler 会把它转给系统浏览器
                window.open('https://console.cloud.google.com/');
              }}
            >
              https://console.cloud.google.com/
            </a>
          </p>
          <Tip>用你平时管理这 30 个 Gmail 的那台电脑上的 Google 账号登录即可（哪个账号都行，这只是存放"凭据"的地方）。</Tip>
        </StepBody>
      ),
    },
    {
      title: '新建一个 Project',
      body: (
        <StepBody>
          <p>顶部有一个"Select a project"下拉菜单 → 点"New Project"。</p>
          <Checklist
            items={[
              'Project name：随便起，比如 MailViewer',
              'Organization / Location：保持默认',
              '点 Create（创建完等 10 秒，左上角会切到新项目）',
            ]}
          />
        </StepBody>
      ),
    },
    {
      title: '启用 Gmail API',
      body: (
        <StepBody>
          <p>在搜索框输入 "Gmail API" → 选第一个结果 → 点 <b>Enable</b>。</p>
          <Tip>等按钮变成"Manage"就代表已启用。</Tip>
        </StepBody>
      ),
    },
    {
      title: '配置 OAuth 同意屏幕（OAuth consent screen）',
      body: (
        <StepBody>
          <p>左侧菜单 → APIs & Services → OAuth consent screen。</p>
          <Checklist
            items={[
              'User Type 选 External → Create',
              'App name：MailViewer（随便起）',
              'User support email：填你自己的邮箱',
              'Developer contact information：填你自己的邮箱',
              '下一页 Scopes：点 Add or Remove Scopes，搜 "gmail.readonly" → 勾选 → Update',
              '下一页 Test users：把你要管理的那 30 个 Gmail 地址都加进来（或者先加几个用来试，后面随时能加到 100 个）',
              '最后一页 Summary → Back to Dashboard',
            ]}
          />
          <Warn>
            Scopes 只勾 <code>.../auth/gmail.readonly</code> 一个！不要勾别的，越少权限越安全。
          </Warn>
        </StepBody>
      ),
    },
    {
      title: '创建 OAuth Client ID',
      body: (
        <StepBody>
          <p>左侧菜单 → APIs & Services → Credentials → 顶部 <b>Create Credentials</b> → <b>OAuth client ID</b>。</p>
          <Checklist
            items={[
              'Application type：选 Desktop app（非常重要！不是 Web）',
              'Name：随便，比如 MailViewer Desktop',
              '点 Create → 会弹出 Client ID 和 Client Secret',
              '点 Download JSON（可选）把文件保存下来',
            ]}
          />
          <Tip>JSON 文件里就有 client_id 和 client_secret，下一步可以直接导入。</Tip>
        </StepBody>
      ),
    },
    {
      title: '填入凭据',
      body: (
        <StepBody>
          <p>把上一步拿到的 Client ID 和 Client Secret 粘贴进来，或者直接导入 JSON 文件。</p>

          <label className="mt-4 block text-sm">
            <span className="font-medium">Client ID</span>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="xxxxxxxxxx-xxxxxx.apps.googleusercontent.com"
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 font-mono text-xs focus:border-accent focus:outline-none"
            />
          </label>

          <label className="mt-3 block text-sm">
            <span className="font-medium">Client Secret</span>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="GOCSPX-xxxxxxxxxxxx"
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 font-mono text-xs focus:border-accent focus:outline-none"
            />
          </label>

          <div className="mt-4">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm hover:bg-bg">
              <span>📂 导入 JSON 文件</span>
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onImportJson(f);
                }}
              />
            </label>
          </div>

          {error && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <Tip>
            Client Secret 会安全存在 macOS 系统钥匙串里（"钥匙串访问"App 里能看到），不会写到项目文件里。
          </Tip>
        </StepBody>
      ),
    },
  ];

  const isLast = step === steps.length - 1;
  const current = steps[step];

  return (
    <div className="flex h-screen">
      {/* Left rail: step indicator */}
      <aside className="w-60 shrink-0 border-r border-border bg-sidebar px-5 py-8">
        <div className="mb-6">
          <div className="text-lg font-semibold text-text">一次性设置</div>
          <div className="mt-1 text-xs text-muted">Google Cloud 凭据配置</div>
        </div>
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => setStep(i)}
                className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm ${
                  i === step
                    ? 'bg-accent/10 text-accent'
                    : i < step
                    ? 'text-muted hover:bg-black/5'
                    : 'text-muted/70 hover:bg-black/5'
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    i === step
                      ? 'bg-accent text-white'
                      : i < step
                      ? 'bg-success text-white'
                      : 'bg-border text-muted'
                  }`}
                >
                  {i < step ? '✓' : i + 1}
                </span>
                <span className="truncate">{s.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </aside>

      {/* Right: step content */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-10 py-8">
          <h1 className="text-2xl font-semibold">
            步骤 {step + 1} / {steps.length}：{current.title}
          </h1>
          <div className="mt-6 max-w-2xl">{current.body}</div>
        </div>
        <footer className="flex items-center justify-between border-t border-border px-10 py-4">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-md px-4 py-2 text-sm text-muted hover:bg-black/5 disabled:opacity-40"
          >
            上一步
          </button>
          {isLast ? (
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !clientId || !clientSecret}
              className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {saving ? '保存中…' : '保存并开始'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
              className="rounded-md bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent/90"
            >
              下一步
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}

function StepBody({ children }: { children: React.ReactNode }): JSX.Element {
  return <div className="space-y-2 text-sm leading-relaxed text-text">{children}</div>;
}

function Checklist({ items }: { items: string[] }): JSX.Element {
  return (
    <ul className="mt-3 list-disc space-y-1.5 pl-5">
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

function Tip({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-xs text-accent">💡 {children}</div>
  );
}

function Warn({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-xs text-warning">⚠️ {children}</div>
  );
}
