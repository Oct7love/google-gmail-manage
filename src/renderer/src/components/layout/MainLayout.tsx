import { useEffect } from 'react';
import { useStore } from '../../store';
import LeftColumn from '../accounts/LeftColumn';
import MiddleColumn from '../messages/MiddleColumn';
import RightColumn from '../detail/RightColumn';
import Toolbar from './Toolbar';

export default function MainLayout(): JSX.Element {
  const onRefreshProgress = useStore((s) => s.onRefreshProgress);

  useEffect(() => {
    const unsubscribe = window.api.refresh.onProgress(onRefreshProgress);
    return unsubscribe;
  }, [onRefreshProgress]);

  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <LeftColumn />
        <MiddleColumn />
        <RightColumn />
      </div>
    </div>
  );
}
