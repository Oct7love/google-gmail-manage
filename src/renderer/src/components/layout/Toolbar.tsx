import { useStore } from '../../store';
import Logo from '../common/Logo';
import { Loader2 } from 'lucide-react';

/**
 * 顶部工具栏：Mac hiddenInset 交通灯下方的品牌区 + 状态。
 */
export default function Toolbar(): JSX.Element {
  const refreshingCount = useStore((s) => s.refreshingEmails.size);
  const accountsCount = useStore((s) => s.accounts.length);

  return (
    <div
      className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-white/70 px-4 backdrop-blur-xl"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="w-20 shrink-0" />

      <div className="flex items-center gap-2">
        <Logo size={20} />
        <div className="flex items-baseline gap-2">
          <span className="text-[13.5px] font-semibold tracking-tight text-text">Mail Viewer</span>
          <span className="text-[11px] text-muted">{accountsCount} 个账号</span>
        </div>
      </div>

      <div className="w-20 shrink-0 text-right">
        {refreshingCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10.5px] text-accent">
            <Loader2 size={11} className="animate-spin" />
            同步中
          </span>
        )}
      </div>
    </div>
  );
}
