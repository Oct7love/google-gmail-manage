# 多主题切换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 mail-viewer 加多主题切换——3 个预设（cream / stock / onyx），工具栏 popover 选择，切换持久化到 settings.json。

**Architecture:** Tailwind colors 改成引用 CSS 变量 `rgb(var(--c-X) / <alpha-value>)`；3 套 `:root[data-theme="..."]` 定义变量；切换时改 `document.documentElement.dataset.theme` 瞬间换肤；选择存 `settings.json` 的 `themeId`。

**Tech Stack:** Tailwind CSS variables 模式 + lucide-react Palette / Check 图标

**项目惯例：**
- 在 `feat/ui-sequoia` 分支继续做（已经在这）
- 项目无自动化测试，验证靠 `pnpm typecheck` + 手测
- Vite HMR 自动推 renderer 改动
- 每 Task 跑 typecheck + 单独 commit

---

## 文件结构

| 文件 | 改动类型 | 责任 |
|---|---|---|
| `tailwind.config.js` | 改 | colors 改 CSS 变量引用，语义色保留硬编码 |
| `src/renderer/src/index.css` | 改 | 加 3 套 `:root[data-theme="..."]` 变量定义 |
| `src/shared/types.ts` | 改 | 导出 `ThemeId` 类型 |
| `src/main/settings.ts` | 改 | `AppSettings` 加 `themeId?: ThemeId` |
| `src/preload/index.ts` | 改 | getSettings/setSettings 类型补 `themeId` |
| `src/renderer/src/store.ts` | 改 | `themeId` state + `setTheme` action + init 应用 |
| `src/renderer/src/components/layout/ThemePicker.tsx` | **新建** | popover 组件 |
| `src/renderer/src/components/layout/Toolbar.tsx` | 改 | 加 Palette 按钮 + ThemePicker |

---

## Task 1：Tailwind colors 改成 CSS 变量引用

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: 替换 tailwind.config.js**

完整替换为：

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // 表面层级（CSS 变量驱动，跨主题切换）
        bg:            'rgb(var(--c-bg) / <alpha-value>)',
        surface:       'rgb(var(--c-surface) / <alpha-value>)',
        'surface-2':   'rgb(var(--c-surface-2) / <alpha-value>)',
        sidebar:       'rgb(var(--c-sidebar) / <alpha-value>)',
        // 边框
        border:        'rgb(var(--c-border) / <alpha-value>)',
        'border-strong':'rgb(var(--c-border-strong) / <alpha-value>)',
        // 文字
        text:          'rgb(var(--c-text) / <alpha-value>)',
        'text-2':      'rgb(var(--c-text-2) / <alpha-value>)',
        muted:         'rgb(var(--c-muted) / <alpha-value>)',
        'muted-2':     'rgb(var(--c-muted-2) / <alpha-value>)',
        // 强调
        accent:        'rgb(var(--c-accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--c-accent-soft) / <alpha-value>)',
        // 语义色（跨主题统一，不进变量）
        danger:  '#ff3b30',
        success: '#34c759',
        warning: '#ff9500',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      fontSize: {
        xs: '11px',
        sm: '12.5px',
        base: '13.5px',
        lg: '15px',
        xl: '17px',
      },
      borderRadius: {
        DEFAULT: '8px',
        sm: '4px',
        lg: '12px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)',
        'card-hover': '0 2px 6px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.06)',
        popover: '0 8px 24px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.05)',
      },
    },
  },
  plugins: [],
};
```

注意：把硬编码的 12 个色值改成 `rgb(var(--c-X) / <alpha-value>)` 引用；语义色 danger/success/warning 保留硬编码（跨主题统一）。

- [ ] **Step 2: 此时 App 启动会"无主题"（变量未定义）**

不要测——直接进 Task 2。此时单跑 dev 会看到所有 token 失效（变白底黑字默认）。

- [ ] **Step 3: typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿。

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add tailwind.config.js
git commit -m "feat(theme): Tailwind colors 改成 CSS 变量引用"
```

---

## Task 2：定义 3 个主题的 CSS 变量

**Files:**
- Modify: `src/renderer/src/index.css`

- [ ] **Step 1: 替换 index.css 完整内容**

替换为：

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* 默认主题：cream（米白·靛蓝） */
:root,
:root[data-theme="cream"] {
  --c-bg:            250 249 247;
  --c-surface:       255 255 255;
  --c-surface-2:     253 252 250;
  --c-sidebar:       243 241 236;
  --c-border:        232 229 223;
  --c-border-strong: 214 210 201;
  --c-text:          29 29 31;
  --c-text-2:        60 60 63;
  --c-muted:         110 110 114;
  --c-muted-2:       142 142 147;
  --c-accent:        79 70 229;
  --c-accent-soft:   238 242 255;
}

/* stock：Apple HIG 经典 */
:root[data-theme="stock"] {
  --c-bg:            245 245 247;
  --c-surface:       255 255 255;
  --c-surface-2:     251 251 253;
  --c-sidebar:       236 236 239;
  --c-border:        224 224 227;
  --c-border-strong: 208 208 212;
  --c-text:          29 29 31;
  --c-text-2:        60 60 63;
  --c-muted:         110 110 114;
  --c-muted-2:       142 142 147;
  --c-accent:        0 122 255;
  --c-accent-soft:   232 241 255;
}

/* onyx：黑·克制（Things 3 风） */
:root[data-theme="onyx"] {
  --c-bg:            250 250 250;
  --c-surface:       255 255 255;
  --c-surface-2:     245 245 245;
  --c-sidebar:       240 240 240;
  --c-border:        228 228 228;
  --c-border-strong: 212 212 212;
  --c-text:          10 10 10;
  --c-text-2:        38 38 38;
  --c-muted:         82 82 82;
  --c-muted-2:       115 115 115;
  --c-accent:        10 10 10;
  --c-accent-soft:   235 235 235;
}

html,
body,
#root {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
  user-select: none;
}
```

关键点：
- 默认 `:root` 等同 `cream`（首次加载没有 data-theme 时也能用）
- 3 套各自独立 `:root[data-theme=".."]` 覆盖

- [ ] **Step 2: typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿。

- [ ] **Step 3: 启动 dev 看默认 cream 主题恢复**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm dev
```

App 应该恢复成米白底 + 靛蓝主色（跟昨天 Task 7.5 之后效果一致）。

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add src/renderer/src/index.css
git commit -m "feat(theme): 定义 3 套主题 CSS 变量 (cream/stock/onyx)"
```

---

## Task 3：ThemeId 类型 + Settings 字段 + preload 类型

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/settings.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: types.ts 加 ThemeId**

Edit `src/shared/types.ts`，在文件末尾追加：

```ts
/** 可选主题预设。默认 'cream'。 */
export type ThemeId = 'cream' | 'stock' | 'onyx';
```

- [ ] **Step 2: settings.ts 加 themeId 字段**

Edit `src/main/settings.ts`，把 `AppSettings` 接口替换为：

```ts
export interface AppSettings {
  /** 仅用于添加账号对话框的内嵌 Google webview。格式如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080 */
  webviewProxy?: string;
  /** 新邮件提示音总开关。undefined 视为 true（首次未设置时默认开启）。 */
  soundEnabled?: boolean;
  /** UI 主题预设 ID。undefined 视为 'cream'。 */
  themeId?: import('../shared/types').ThemeId;
}
```

- [ ] **Step 3: preload/index.ts 类型扩展**

Edit `src/renderer/src/preload`（实际是 `src/preload/index.ts`），找到 getSettings / setSettings：

```ts
    getSettings: (): Promise<{ webviewProxy?: string; soundEnabled?: boolean }> =>
      ipcRenderer.invoke(IpcChannels.System.GetSettings),
    setSettings: (
      next: { webviewProxy?: string; soundEnabled?: boolean },
    ): Promise<{ webviewProxy?: string; soundEnabled?: boolean }> =>
      ipcRenderer.invoke(IpcChannels.System.SetSettings, next),
```

替换为：

```ts
    getSettings: (): Promise<{
      webviewProxy?: string;
      soundEnabled?: boolean;
      themeId?: import('../shared/types').ThemeId;
    }> => ipcRenderer.invoke(IpcChannels.System.GetSettings),
    setSettings: (next: {
      webviewProxy?: string;
      soundEnabled?: boolean;
      themeId?: import('../shared/types').ThemeId;
    }): Promise<{
      webviewProxy?: string;
      soundEnabled?: boolean;
      themeId?: import('../shared/types').ThemeId;
    }> => ipcRenderer.invoke(IpcChannels.System.SetSettings, next),
```

- [ ] **Step 4: typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿。

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add src/shared/types.ts src/main/settings.ts src/preload/index.ts
git commit -m "feat(theme): ThemeId 类型 + settings/preload 字段扩展"
```

---

## Task 4：Store themeId 状态 + setTheme action + init 应用

**Files:**
- Modify: `src/renderer/src/store.ts`

- [ ] **Step 1: 加 import**

Edit `src/renderer/src/store.ts`，找到 import 区，把 types import 改为包含 ThemeId：

把：

```ts
import type {
  Account,
  MessageDetail,
  MessageSummary,
  RefreshEvent,
} from '../../shared/types';
```

改为：

```ts
import type {
  Account,
  MessageDetail,
  MessageSummary,
  RefreshEvent,
  ThemeId,
} from '../../shared/types';
```

- [ ] **Step 2: 在 State 接口加字段和 action**

找到 `interface State` 块。在 `soundEnabled: boolean;` 之后插入：

```ts
  /** 当前主题 ID。默认 'cream'。 */
  themeId: ThemeId;
```

在 `toggleSound: () => Promise<void>;` 之后插入：

```ts
  setTheme: (id: ThemeId) => Promise<void>;
```

- [ ] **Step 3: 在 useStore 初始 state 加默认值**

找到 `useStore = create<State>((set, get) => ({` 后的初始 state 块。在 `soundEnabled: true,` 之后插入：

```ts
  themeId: 'cream',
```

- [ ] **Step 4: 改 init 读 themeId 并应用 data-theme**

找到 init action，整体替换为：

```ts
  init: async () => {
    const [accounts, settings] = await Promise.all([
      window.api.accounts.list(),
      window.api.system.getSettings(),
    ]);
    const first = accounts[0]?.email ?? null;
    const themeId: ThemeId = settings.themeId ?? 'cream';
    document.documentElement.dataset.theme = themeId;
    set({
      accounts,
      status: 'ready',
      selectedEmail: first,
      soundEnabled: settings.soundEnabled !== false,
      themeId,
    });
    if (first) await get().selectAccount(first);
  },
```

- [ ] **Step 5: 加 setTheme action**

找到 `toggleSound` action 实现。在它之后追加：

```ts
  setTheme: async (id: ThemeId) => {
    document.documentElement.dataset.theme = id;
    set({ themeId: id });
    await window.api.system.setSettings({ themeId: id });
  },
```

- [ ] **Step 6: typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿。

- [ ] **Step 7: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add src/renderer/src/store.ts
git commit -m "feat(theme): store 加 themeId 状态 + setTheme + init 应用 data-theme"
```

---

## Task 5：新建 ThemePicker + Toolbar 集成

**Files:**
- Create: `src/renderer/src/components/layout/ThemePicker.tsx`
- Modify: `src/renderer/src/components/layout/Toolbar.tsx`

- [ ] **Step 1: 新建 ThemePicker.tsx**

```tsx
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
```

- [ ] **Step 2: 改 Toolbar.tsx 加 Palette 按钮**

完整替换 `src/renderer/src/components/layout/Toolbar.tsx`：

```tsx
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
        className="relative flex w-28 shrink-0 items-center justify-end gap-2"
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
          onClick={() => setPickerOpen((o) => !o)}
          title="切换主题"
          className="rounded p-1 text-muted transition hover:bg-surface-2 hover:text-text"
        >
          <Palette size={15} />
        </button>
        <button
          type="button"
          onClick={() => void toggleSound()}
          title={soundEnabled ? '提示音已开（点击关闭）' : '提示音已关（点击开启）'}
          className="rounded p-1 text-muted transition hover:bg-surface-2 hover:text-text"
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
```

主要变化：
- import Palette + ThemePicker + useState
- 取 store 的 themeId + setTheme
- 右栏宽度从 w-20 → w-28（容纳新按钮）
- 加 Palette 按钮（提示音按钮左侧）
- pickerOpen 状态控制 popover 显示
- 右侧容器加 `relative` 给 popover 定位

- [ ] **Step 3: typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿。

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add src/renderer/src/components/layout/ThemePicker.tsx \
        src/renderer/src/components/layout/Toolbar.tsx
git commit -m "feat(theme): 工具栏加 Palette 按钮 + ThemePicker popover"
```

---

## Task 6：手测 + 收尾

**Files:** 无改动，纯验证

- [ ] **Step 1: build 全过**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck && pnpm build
```

Expected: 全绿。

- [ ] **Step 2: 启动 App**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm dev
```

- [ ] **Step 3: 验证 1 — 默认主题**

App 启动后是 `cream`（米白 + 靛蓝），跟之前一致。

- [ ] **Step 4: 验证 2 — 工具栏 Palette 按钮**

右上看到 🎨（提示音 🔔 左侧）。点击 → popover 弹出 3 个主题。

- [ ] **Step 5: 验证 3 — 切换 stock**

点 "Apple 灰 · 系统蓝" → 瞬间整个 App 变 #f5f5f7 中性灰底 + #007aff 系统蓝（选中态、添加账号按钮、所有 accent 全部变蓝）。无闪烁。

- [ ] **Step 6: 验证 4 — 切换 onyx**

点 "黑 · 克制" → 瞬间整个 App 变浅白底 + 全黑主色。选中邮件左 3px 色条变黑；添加账号按钮变黑底白字；同步中徽章背景变浅灰（accent/10 是黑色 10% 透明）。

- [ ] **Step 7: 验证 5 — 透明度变体正常**

切到 cream 主题，看：
- 添加账号按钮的 `bg-gradient-to-b from-accent to-accent/85` 渐变是否两色都正确（靛蓝→靛蓝 85%）
- 同步中徽章 `bg-accent/10` 是淡靛蓝
- accent 透明度变体没有 `var(--c-accent / 0.5)` 这种语法错误

如果哪个透明度变体显示成黑色/默认色，说明 Tailwind 没正确处理 `<alpha-value>` 替换，需要看 PostCSS 编译错误。

- [ ] **Step 8: 验证 6 — 持久化**

切到 onyx，退出 App（Command+Q）。重启 `pnpm dev`。
Expected: App 启动后仍然是 onyx 主题。

- [ ] **Step 9: 验证 7 — popover 关闭**

- ESC 键 → popover 关
- 点 popover 外面 → popover 关
- 选了某个主题后 → popover 自动关

- [ ] **Step 10: 验证 8 — 提示音 / 邮件 / 翻译 在新主题下正常**

切换到任一主题：
- 给账号发邮件 → 应该听到提示音
- 中右栏邮件列表 / 详情正常显示
- 翻译卡片正常（错误态红色硬编码跨主题）

- [ ] **Step 11: 验证 9 — 邮件正文 iframe**

打开一封邮件正文：
- 3 个主题下 iframe 都是白底 + 深字 + 靛蓝链接（按 spec §4.5 决策 A 固定）
- 不会随主题变

- [ ] **Step 12: Final commit（如有手测发现的微调）**

如果验证中发现问题需要修，修完后单独提交：

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git status
git add <修改的文件>
git commit -m "fix(theme): <具体修了什么>"
```

如无问题，本任务**不需要额外 commit**。

---

## 自审备注

**Spec coverage check**：
- spec §2 三主题选型 → Task 2 CSS 变量 + Task 5 ThemePicker 元数据
- spec §3 切换 UI → Task 5
- spec §4.1 CSS 变量做法 → Task 1
- spec §4.2 主题 CSS → Task 2
- spec §4.3 主题切换流程 → Task 4 + Task 5
- spec §4.4 持久化 → Task 3 + Task 4
- spec §4.5 iframe 决策 A → 无需改动（保持上一轮的硬编码 #4f46e5）
- spec §5 三主题完整 token → Task 2
- spec §6 文件改动清单 → Task 1-5 全覆盖
- spec §8 验证清单 → Task 6 Step 1-11

**Placeholder scan** — 全部代码块完整可粘贴，无 TBD / TODO。

**Type consistency**：
- `ThemeId` 在 Task 3 (types.ts) 定义；Task 3 (settings/preload) 使用；Task 4 (store) 使用；Task 5 (ThemePicker/Toolbar) 使用 ✓
- `setTheme: (id: ThemeId) => Promise<void>` 签名在 Task 4 (state interface + 实现) 一致；Task 5 (Toolbar 调用 `setTheme(id)`) 兼容 ✓
- `themeId` state 字段在 Task 4 定义 / init 设置 / setTheme 写入；Task 5 读取 + 传给 ThemePicker 的 `current` prop ✓
- CSS 变量命名 `--c-bg`、`--c-accent` 等在 Task 1 (tailwind 引用) 和 Task 2 (CSS 定义) 一致 ✓

**YAGNI** — 严格按 spec §9，无加塞自定义主题/导入导出/动画/跟随系统等。
