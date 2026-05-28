import { useEffect, useRef } from 'react';
import type { ThemeId } from '../../../../shared/types';
import { Check } from 'lucide-react';

interface ThemeMeta {
  id: ThemeId;
  name: string;
  /** 4 个色板小圆：底色 / 表面 / 主色 / muted */
  swatches: [string, string, string, string];
}

const THEMES: readonly ThemeMeta[] = [
  {
    id: 'cream',
    name: '米白 · 靛蓝',
    swatches: ['#faf9f7', '#ffffff', '#4f46e5', '#6e6e72'],
  },
  {
    id: 'stock',
    name: 'Apple 灰 · 系统蓝',
    swatches: ['#f5f5f7', '#ffffff', '#007aff', '#6e6e72'],
  },
  {
    id: 'onyx',
    name: '黑 · 克制',
    swatches: ['#fafafa', '#ffffff', '#0a0a0a', '#525252'],
  },
] as const;

interface Props {
  current: ThemeId;
  onSelect: (id: ThemeId) => void;
  onClose: () => void;
}

export default function ThemePicker({ current, onSelect, onClose }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent): void => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-9 z-50 w-56 overflow-hidden rounded-lg border border-border bg-surface shadow-popover"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <div className="px-3 pt-2 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-muted-2">
        主题
      </div>
      <ul>
        {THEMES.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onSelect(t.id)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-surface-2"
            >
              <div className="flex shrink-0 gap-0.5">
                {t.swatches.map((c, i) => (
                  <span
                    key={i}
                    className="h-3 w-3 rounded-full border border-black/10"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <span className="flex-1 truncate text-[12.5px] text-text">{t.name}</span>
              {current === t.id && <Check size={13} className="shrink-0 text-accent" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
