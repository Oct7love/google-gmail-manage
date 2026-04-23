import { useEffect } from 'react';
import { useStore } from './store';
import MainLayout from './components/layout/MainLayout';
import AddAccountDialog from './components/accounts/AddAccountDialog';

export default function App(): JSX.Element {
  const status = useStore((s) => s.status);
  const init = useStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center text-muted">加载中…</div>
    );
  }

  return (
    <>
      <MainLayout />
      <AddAccountDialog />
    </>
  );
}
