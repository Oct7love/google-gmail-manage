import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ThemeId } from '../../../../shared/types';
import { Check, X } from 'lucide-react';

/**
 * 主题选择模态。
 * 每个主题卡片含：mini 三栏布局缩略图（按该主题实际色板渲染）+ 名字 + 描述 + 4 个色板小球。
 */

interface ThemeColors {
  bg: string;
  surface: string;
  sidebar: string;
  border: string;
  accent: string;
  muted: string;
  text: string;
}

interface ThemeMeta {
  id: ThemeId;
  name: string;
  caption: string;
  colors: ThemeColors;
}

const THEMES: readonly ThemeMeta[] = [
  {
    id: 'fog',
    name: '雾蓝',
    caption: '默认 · 清爽专业',
    colors: {
      bg: '#eef3f8',
      surface: '#ffffff',
      sidebar: '#e6eef7',
      border: '#d5dfea',
      accent: '#2077ff',
      muted: '#657286',
      text: '#1d1d1f',
    },
  },
  {
    id: 'warm',
    name: '暖陶',
    caption: '亲和 · 长时间扫读',
    colors: {
      bg: '#f3f0ec',
      surface: '#ffffff',
      sidebar: '#e8e2da',
      border: '#dad0c6',
      accent: '#975337',
      muted: '#70655c',
      text: '#211b17',
    },
  },
  {
    id: 'graphite',
    name: '石墨',
    caption: '克制 · 高对比',
    colors: {
      bg: '#e8eaed',
      surface: '#ffffff',
      sidebar: '#d9dde2',
      border: '#cbd1d9',
      accent: '#161616',
      muted: '#5d6570',
      text: '#111111',
    },
  },
  {
    id: 'indigo',
    name: '靛紫',
    caption: '识别度 · 安静品牌感',
    colors: {
      bg: '#f1f1f7',
      surface: '#ffffff',
      sidebar: '#e7e5f1',
      border: '#d9d6e7',
      accent: '#5b4fd8',
      muted: '#686174',
      text: '#1d1b24',
    },
  },
] as const;

interface Props {
  current: ThemeId;
  onSelect: (id: ThemeId) => void;
  onClose: () => void;
}

export default function ThemePicker({ current, onSelect, onClose }: Props): JSX.Element {
  useEffect(() => {
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  // Toolbar 有 backdrop-blur 创建新 stacking context，会让内部的 fixed 元素失效。
  // 用 Portal 把模态渲染到 document.body 跳出该 context。
  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
      onClick={onClose}
    >
      <div
        className="animate-slide-up w-full max-w-lg overflow-hidden rounded-xl bg-surface shadow-popover"
        onClick={(e) => e.stopPropagation()}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-[15px] font-semibold tracking-tight text-text">选择主题</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition duration-150 ease-out hover:bg-surface-2 hover:text-text active:scale-[0.98]"
            aria-label="关闭"
          >
            <X size={15} />
          </button>
        </header>

        <div className="space-y-2.5 p-3">
          {THEMES.map((t) => (
            <ThemeCard
              key={t.id}
              meta={t}
              selected={current === t.id}
              onClick={() => onSelect(t.id)}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

interface CardProps {
  meta: ThemeMeta;
  selected: boolean;
  onClick: () => void;
}

function ThemeCard({ meta, selected, onClick }: CardProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex w-full overflow-hidden rounded-lg border text-left transition duration-150 ease-out active:scale-[0.99] ${ 
        selected
          ? 'border-accent bg-accent-soft shadow-card'
          : 'border-border bg-surface hover:border-border-strong hover:bg-surface-2'
      }`}
    >
      <ThumbPreview colors={meta.colors} />
      <div className="min-w-0 flex-1 border-l border-border px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13px] font-semibold text-text">{meta.name}</span>
          {selected && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent">
              <Check size={11} className="text-white" strokeWidth={3} />
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-[11px] text-muted">{meta.caption}</p>
        <div className="mt-2 flex gap-1">
          <ColorSwatch color={meta.colors.bg} />
          <ColorSwatch color={meta.colors.sidebar} />
          <ColorSwatch color={meta.colors.accent} />
          <ColorSwatch color={meta.colors.muted} />
        </div>
      </div>
    </button>
  );
}

/** 三栏 mini 缩略图，按主题颜色渲染：sidebar / middle list / right detail */
function ThumbPreview({ colors }: { colors: ThemeColors }): JSX.Element {
  return (
    <svg viewBox="0 0 200 120" className="block h-[82px] w-36 shrink-0" preserveAspectRatio="none">
      {/* 全局底 */}
      <rect width="200" height="120" fill={colors.bg} />
      {/* 顶部工具栏 */}
      <rect x="0" y="0" width="200" height="14" fill={colors.surface} fillOpacity="0.7" />
      <rect x="0" y="13" width="200" height="0.5" fill={colors.border} />
      {/* 左栏（侧栏） */}
      <rect x="0" y="14" width="48" height="106" fill={colors.sidebar} />
      {/* 左栏账号项 */}
      <rect x="4" y="20" width="40" height="8" rx="2" fill={colors.surface} />
      <circle cx="9" cy="34" r="3" fill={colors.accent} fillOpacity="0.5" />
      <rect x="15" y="32" width="28" height="2" rx="1" fill={colors.muted} fillOpacity="0.6" />
      <circle cx="9" cy="44" r="3" fill={colors.muted} fillOpacity="0.4" />
      <rect x="15" y="42" width="28" height="2" rx="1" fill={colors.muted} fillOpacity="0.4" />
      <circle cx="9" cy="54" r="3" fill={colors.muted} fillOpacity="0.4" />
      <rect x="15" y="52" width="28" height="2" rx="1" fill={colors.muted} fillOpacity="0.4" />
      {/* 左栏底部添加按钮 */}
      <rect x="4" y="100" width="40" height="14" rx="3" fill={colors.accent} />
      {/* 中栏邮件列表（白色卡片浮起） */}
      <rect x="51" y="18" width="64" height="98" rx="3" fill={colors.bg} />
      {/* 中栏选中项 */}
      <rect x="51" y="24" width="2" height="14" fill={colors.accent} />
      <rect x="55" y="26" width="40" height="2" rx="1" fill={colors.text} fillOpacity="0.8" />
      <rect x="55" y="30" width="30" height="2" rx="1" fill={colors.muted} fillOpacity="0.5" />
      <rect x="55" y="34" width="35" height="2" rx="1" fill={colors.muted} fillOpacity="0.3" />
      {/* 中栏其它项 */}
      <line x1="51" y1="40" x2="115" y2="40" stroke={colors.border} strokeWidth="0.5" />
      <rect x="55" y="44" width="38" height="2" rx="1" fill={colors.muted} fillOpacity="0.7" />
      <rect x="55" y="48" width="28" height="2" rx="1" fill={colors.muted} fillOpacity="0.4" />
      <line x1="51" y1="56" x2="115" y2="56" stroke={colors.border} strokeWidth="0.5" />
      <rect x="55" y="60" width="38" height="2" rx="1" fill={colors.muted} fillOpacity="0.7" />
      <rect x="55" y="64" width="28" height="2" rx="1" fill={colors.muted} fillOpacity="0.4" />
      {/* 右栏详情（白色卡片浮起） */}
      <rect x="118" y="18" width="78" height="98" rx="3" fill={colors.surface} />
      <rect x="123" y="24" width="68" height="3" rx="1" fill={colors.text} fillOpacity="0.9" />
      <rect x="123" y="30" width="40" height="2" rx="1" fill={colors.muted} fillOpacity="0.5" />
      <line x1="118" y1="38" x2="196" y2="38" stroke={colors.border} strokeWidth="0.5" />
      <rect x="123" y="44" width="68" height="1.5" rx="0.75" fill={colors.muted} fillOpacity="0.6" />
      <rect x="123" y="48" width="65" height="1.5" rx="0.75" fill={colors.muted} fillOpacity="0.6" />
      <rect x="123" y="52" width="55" height="1.5" rx="0.75" fill={colors.muted} fillOpacity="0.6" />
      <rect x="123" y="58" width="68" height="1.5" rx="0.75" fill={colors.muted} fillOpacity="0.6" />
      <rect x="123" y="62" width="50" height="1.5" rx="0.75" fill={colors.muted} fillOpacity="0.6" />
    </svg>
  );
}

function ColorSwatch({ color }: { color: string }): JSX.Element {
  return (
    <span
      className="h-3 w-3 rounded-full border border-border-strong"
      style={{ backgroundColor: color }}
    />
  );
}
