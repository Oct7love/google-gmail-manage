import { useState } from 'react';
import { useStore } from '../../store';
import Logo from '../common/Logo';
import { Bell, BellOff, Loader2, Palette } from 'lucide-react';
import ThemePicker from './ThemePicker';

/**
 * 顶部工具栏：Mac hiddenInset 交通灯下方的品牌区 + 状态。
 */
export default function Toolbar(): JSX.Element {
  const refreshingCount = useStore((s) => s.refreshingEmails.size);
  const accountsCount = useStore((s) => s.accounts.length);
  const soundEnabled = useStore((s) => s.soundEnabled);
  const toggleSound = useStore((s) => s.toggleSound);
  const themeId = useStore((s) => s.themeId);
  const setTheme = useStore((s) => s.setTheme);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div
      className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface/70 px-4 backdrop-blur-xl"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="w-20 shrink-0" />

      <div className="flex items-center gap-2">
        <Logo size={20} />
        <div className="flex items-baseline gap-2">
          <span className="text-[13.5px] font-semibold tracking-tight text-text">Mail Viewer</span>
          <span className="text-[11px] tabular-nums text-muted">{accountsCount} 个账号</span>
        </div>
      </div>

      <div
        className="relative flex w-28 shrink-0 items-center justify-end gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {refreshingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2 py-0.5 text-[10.5px] font-medium tabular-nums text-accent">
            <Loader2 size={11} className="animate-spin" />
            <span>同步中</span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setPickerOpen((o) => !o)}
          title="切换主题"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition duration-150 ease-out hover:bg-surface-2 hover:text-text active:scale-[0.98]"
        >
          <Palette size={15} />
        </button>
        <button
          type="button"
          onClick={() => void toggleSound()}
          title={soundEnabled ? '提示音已开（点击关闭）' : '提示音已关（点击开启）'}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition duration-150 ease-out hover:bg-surface-2 hover:text-text active:scale-[0.98]"
        >
          {soundEnabled ? <Bell size={15} /> : <BellOff size={15} />}
        </button>
        {pickerOpen && (
          <ThemePicker
            current={themeId}
            onSelect={(id) => {
              void setTheme(id);
              setPickerOpen(false);
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
