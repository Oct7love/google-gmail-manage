import { useStore } from '../../store';
import Logo from '../common/Logo';
import { Bell, BellOff, Loader2 } from 'lucide-react';

/**
 * 顶部工具栏：Mac hiddenInset 交通灯下方的品牌区 + 状态。
 */
export default function Toolbar(): JSX.Element {
  const refreshingCount = useStore((s) => s.refreshingEmails.size);
  const accountsCount = useStore((s) => s.accounts.length);
  const soundEnabled = useStore((s) => s.soundEnabled);
  const toggleSound = useStore((s) => s.toggleSound);

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

      <div
        className="flex w-20 shrink-0 items-center justify-end gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {refreshingCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10.5px] text-accent">
            <Loader2 size={11} className="animate-spin" />
            同步中
          </span>
        )}
        <button
          type="button"
          onClick={() => void toggleSound()}
          title={soundEnabled ? '提示音已开（点击关闭）' : '提示音已关（点击开启）'}
          className="rounded p-1 text-muted transition hover:bg-surface-2 hover:text-text"
        >
          {soundEnabled ? <Bell size={15} /> : <BellOff size={15} />}
        </button>
      </div>
    </div>
  );
}
