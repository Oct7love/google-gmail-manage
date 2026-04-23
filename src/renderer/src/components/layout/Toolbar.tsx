import { useStore } from '../../store';

/**
 * 顶部工具栏：Mac hiddenInset 交通灯下方的品牌 + 状态条。
 */
export default function Toolbar(): JSX.Element {
  const refreshingCount = useStore((s) => s.refreshingEmails.size);
  const accountsCount = useStore((s) => s.accounts.length);

  return (
    <div
      className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-white/70 px-4 backdrop-blur"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* 左边占位 80px 给 Mac 交通灯 */}
      <div className="w-16 shrink-0" />

      <div className="flex items-center gap-2">
        <LogoIcon />
        <span className="text-sm font-semibold tracking-tight text-text">Mail Viewer</span>
        <span className="text-xs text-muted">· {accountsCount} 个账号</span>
      </div>

      <div className="w-16 shrink-0 text-right text-[11px] text-muted">
        {refreshingCount > 0 ? (
          <span className="flex items-center justify-end gap-1">
            <SpinnerIcon />
            同步中
          </span>
        ) : null}
      </div>
    </div>
  );
}

function LogoIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polyline points="3,7 12,13 21,7" />
    </svg>
  );
}

function SpinnerIcon(): JSX.Element {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="animate-spin">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.2" />
      <path d="M12 2 A 10 10 0 0 1 22 12" />
    </svg>
  );
}
