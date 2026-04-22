import { useEffect, useState } from 'react';

export default function App(): JSX.Element {
  const [pong, setPong] = useState<string>('');
  const [accountCount, setAccountCount] = useState<number | null>(null);

  useEffect(() => {
    window.api.system
      .ping()
      .then(setPong)
      .catch((e) => setPong(`error: ${String(e)}`));

    window.api.accounts
      .list()
      .then((a) => setAccountCount(a.length))
      .catch(() => setAccountCount(-1));
  }, []);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-accent">Mail Viewer</h1>
        <p className="mt-2 text-muted">多账号 Gmail 只读查看器</p>
        <div className="mt-6 space-y-1 text-sm">
          <p>
            IPC 状态：<span className="font-mono text-success">{pong || '...'}</span>
          </p>
          <p>
            本地账号数：
            <span className="font-mono text-success">
              {accountCount === null ? '...' : accountCount}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
