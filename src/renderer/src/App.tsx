import { useCallback, useEffect, useState } from 'react';
import SetupWizard from './components/SetupWizard';

type AppStatus = 'loading' | 'needs-credentials' | 'ready';

export default function App(): JSX.Element {
  const [status, setStatus] = useState<AppStatus>('loading');
  const [accountCount, setAccountCount] = useState<number>(0);

  const refresh = useCallback(async () => {
    const creds = await window.api.credentials.status();
    if (!creds.configured) {
      setStatus('needs-credentials');
      return;
    }
    const accounts = await window.api.accounts.list();
    setAccountCount(accounts.length);
    setStatus('ready');
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center text-muted">加载中…</div>
    );
  }

  if (status === 'needs-credentials') {
    return <SetupWizard onDone={refresh} />;
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-accent">Mail Viewer</h1>
        <p className="mt-2 text-muted">多账号 Gmail 只读查看器</p>
        <p className="mt-6 text-sm">
          已配置凭据 ✓ ｜ 本地账号数：
          <span className="font-mono text-success">{accountCount}</span>
        </p>
        <p className="mt-3 text-xs text-muted">（下一阶段 P3 将添加"添加账号"按钮）</p>
      </div>
    </div>
  );
}
