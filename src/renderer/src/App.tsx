import { useEffect, useState } from 'react';

export default function App(): JSX.Element {
  const [pong, setPong] = useState<string>('');

  useEffect(() => {
    window.api.system
      .ping()
      .then(setPong)
      .catch((e) => setPong(`error: ${String(e)}`));
  }, []);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-accent">Mail Viewer</h1>
        <p className="mt-2 text-muted">多账号 Gmail 只读查看器</p>
        <p className="mt-6 text-sm">
          IPC 状态：<span className="font-mono text-success">{pong || '...'}</span>
        </p>
      </div>
    </div>
  );
}
