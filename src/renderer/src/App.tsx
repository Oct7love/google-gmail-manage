import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useStore } from './store';
import { dialogInstanceKey } from './lib/dialogKey';
import MainLayout from './components/layout/MainLayout';
import AddAccountDialog from './components/accounts/AddAccountDialog';

export default function App(): JSX.Element {
  const status = useStore((s) => s.status);
  const init = useStore((s) => s.init);
  const dialogMode = useStore((s) => s.dialogMode);

  useEffect(() => {
    void init();
  }, [init]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg text-sm text-muted">
        <Loader2 size={16} className="animate-spin text-muted-2" />
        加载中…
      </div>
    );
  }

  return (
    <>
      <MainLayout />
      {/* 只在打开时挂载、关闭即卸载 → 天然清空残留 state；不同目标用 key 强制 remount，防跨账号串数据 */}
      {dialogMode !== null && <AddAccountDialog key={dialogInstanceKey(dialogMode)} />}
    </>
  );
}
