# macOS Sequoia 浅色 UI 升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 mail-viewer 的视觉升级到 macOS Sequoia 浅色 Layered 派——浅灰底 + 白色卡片浮起 + 柔和阴影；重点改中栏邮件列表 + 右栏详情；左栏/工具栏/对话框 仅 token 跟随。

**Architecture:** 更新 Tailwind `theme.extend` 的 colors / fontSize / borderRadius / boxShadow tokens；用 token 化的 className 改造 MiddleColumn + MessageRow + RightColumn + TranslationPanel + MessageBody iframe srcDoc inline CSS；其它组件靠 token 自动跟进，硬编码 `red-/blue-/black-/white/<num>` 全项目 grep 扫描后逐个替换。

**Tech Stack:** Tailwind 3 + React 18 + lucide-react；无新依赖

**项目惯例（重要）：**
- 项目无自动化测试，验证靠 `pnpm typecheck` + 手测
- Vite HMR 自动推 renderer 改动；改完不用重启 dev 服务（除非动主进程）
- 每个 Task 跑 typecheck + 单独 commit
- **本 plan 在 `feat/ui-sequoia` 分支上执行**——execute 前由 executing-plans 切分支

---

## 文件结构

| 文件 | 改动类型 | 责任 |
|---|---|---|
| `tailwind.config.js` | 改 | 替换 colors；新增 fontSize / borderRadius / boxShadow |
| `src/renderer/src/components/messages/MiddleColumn.tsx` | 改 | bg-bg；列表卡片包装；按钮 hover token |
| `src/renderer/src/components/messages/MessageRow.tsx` | 改 | 选中/hover 态；字号统一；snippet 颜色；时间字号 |
| `src/renderer/src/components/detail/RightColumn.tsx` | 改 | bg-bg；内容卡片包装；图片按钮 token；时间字号 |
| `src/renderer/src/components/detail/TranslationPanel.tsx` | 改 | 4 状态卡 token + Apple 红柔和 |
| `src/renderer/src/components/detail/MessageBody.tsx` | 改 | iframe srcDoc CSS（字号 15px / 颜色 / padding） |
| `src/renderer/src/components/accounts/AccountItem.tsx` | 改 | 硬编码颜色 token 化（hover/选中/菜单/徽章） |
| `src/renderer/src/components/accounts/LeftColumn.tsx` | 改 | hover 按钮 token 化 |
| `src/renderer/src/components/accounts/AddAccountDialog.tsx` | 改 | 蒙层/说明卡/错误卡 token 化 |
| `src/renderer/src/components/accounts/CredentialsDrawer.tsx` | 改 | 蒙层 token 化 |
| `src/renderer/src/components/layout/Toolbar.tsx` | 改 | 提示音按钮 hover token 化 |

**不动**：`MainLayout.tsx` / `Avatar.tsx` / `Logo.tsx`（SVG 渐变）/ `TotpPanel.tsx` / `SmsCodeBox.tsx` / `lib/avatar.ts`（头像调色板独立算法）/ 主进程任何文件 / store.ts / types.ts / CLAUDE.md。

---

## Task 1：更新 Tailwind tokens

打地基。所有后续 Task 依赖这一步的 token。

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: 替换 `tailwind.config.js` 内容**

完整替换为：

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        // 表面层级
        bg: '#f5f5f7',
        surface: '#ffffff',
        'surface-2': '#fbfbfd',
        sidebar: '#ececef',
        // 边框
        border: '#e0e0e3',
        'border-strong': '#d0d0d4',
        // 文字
        text: '#1d1d1f',
        'text-2': '#3c3c3f',
        muted: '#6e6e72',
        'muted-2': '#8e8e93',
        // 强调
        accent: '#007aff',
        'accent-soft': '#e8f1ff',
        // 语义
        danger: '#ff3b30',
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

- [ ] **Step 2: 跑 typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿。

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add tailwind.config.js
git commit -m "feat(ui): 更新 Tailwind token 为 macOS Sequoia 浅色（Layered 派）"
```

---

## Task 2：MiddleColumn 列表卡片化

**Files:**
- Modify: `src/renderer/src/components/messages/MiddleColumn.tsx`

- [ ] **Step 1: 完整替换 MiddleColumn.tsx**

替换为：

```tsx
import { useState } from 'react';
import type { MessageSummary } from '../../../../shared/types';
import { useStore } from '../../store';
import MessageRow from './MessageRow';
import CredentialsDrawer from '../accounts/CredentialsDrawer';
import { Inbox, KeyRound, RefreshCw } from 'lucide-react';

const EMPTY_MESSAGES: MessageSummary[] = [];

export default function MiddleColumn(): JSX.Element {
  const selected = useStore((s) => s.selectedEmail);
  const messages = useStore((s) =>
    s.selectedEmail ? s.messagesByEmail[s.selectedEmail] ?? EMPTY_MESSAGES : EMPTY_MESSAGES,
  );
  const refreshing = useStore((s) =>
    s.selectedEmail ? s.refreshingEmails.has(s.selectedEmail) : false,
  );
  const refreshOne = useStore((s) => s.refreshOne);
  const [credsOpen, setCredsOpen] = useState(false);

  if (!selected) {
    return (
      <section className="flex w-[360px] shrink-0 flex-col items-center justify-center border-r border-border bg-bg">
        <div className="text-center text-sm text-muted">
          <Inbox size={36} strokeWidth={1.3} className="mx-auto mb-2 text-border" />
          选择左侧账号查看邮件
        </div>
      </section>
    );
  }

  return (
    <section className="flex w-[360px] shrink-0 flex-col border-r border-border bg-bg">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Inbox size={13} className="shrink-0 text-muted" />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-text" title={selected}>
              收件箱
            </div>
            <div className="truncate text-[11px] text-muted">
              {selected} · {messages.length} 封
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setCredsOpen(true)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-surface-2"
            title="查看账号凭据（密码 / 2FA / 辅邮）"
            aria-label="查看账号凭据"
          >
            <KeyRound size={13} />
          </button>
          <button
            type="button"
            onClick={() => void refreshOne(selected)}
            disabled={refreshing}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-surface-2 disabled:opacity-30"
            title="刷新"
            aria-label="刷新"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="mx-3 my-3 rounded bg-surface p-8 text-center text-xs text-muted shadow-card">
            暂无邮件
          </div>
        ) : (
          <ul className="mx-3 my-3 divide-y divide-border overflow-hidden rounded bg-surface shadow-card">
            {messages.map((m) => (
              <MessageRow key={m.messageId} message={m} />
            ))}
          </ul>
        )}
      </div>
      {credsOpen && selected && (
        <CredentialsDrawer email={selected} onClose={() => setCredsOpen(false)} />
      )}
    </section>
  );
}
```

主要变化：
- 整体 `bg-white` → `bg-bg`（两处：空状态 + 主区）
- 列表 `<ul>` 加 `mx-3 my-3 overflow-hidden rounded bg-surface shadow-card`
- 空状态卡片化
- 按钮 hover `bg-black/5` → `bg-surface-2`

- [ ] **Step 2: typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿。

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add src/renderer/src/components/messages/MiddleColumn.tsx
git commit -m "feat(ui): 中栏列表卡片化 + bg-bg 底"
```

---

## Task 3：MessageRow 选中态 + 字号

**Files:**
- Modify: `src/renderer/src/components/messages/MessageRow.tsx`

- [ ] **Step 1: 完整替换 MessageRow.tsx**

替换为：

```tsx
import type { MessageSummary } from '../../../../shared/types';
import { useStore } from '../../store';
import Avatar from '../common/Avatar';
import { displayNameFor } from '../../lib/avatar';

interface Props {
  message: MessageSummary;
}

export default function MessageRow({ message }: Props): JSX.Element {
  const isSelected = useStore((s) => s.selectedMessageId === message.messageId);
  const selectMessage = useStore((s) => s.selectMessage);

  const name = displayNameFor(message.fromAddr) || message.fromAddr;

  return (
    <li>
      <button
        type="button"
        onClick={() => void selectMessage(message.messageId)}
        className={`flex w-full items-start gap-3 border-l-[3px] px-4 py-2.5 text-left transition-colors ${
          isSelected
            ? 'border-accent bg-accent-soft'
            : 'border-transparent hover:bg-surface-2'
        }`}
      >
        <Avatar identityKey={message.fromAddr || 'unknown'} label={name} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-base font-semibold text-text">{name}</span>
            <span className="shrink-0 text-[12px] text-muted-2">{formatDate(message.dateTs)}</span>
          </div>
          <div className="mt-0.5 truncate text-sm text-text">
            {message.subject || '(无主题)'}
          </div>
          {message.snippet && (
            <div className="mt-0.5 truncate text-[12px] text-muted-2">{message.snippet}</div>
          )}
        </div>
      </button>
    </li>
  );
}

function formatDate(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
  });
}
```

主要变化：
- 选中态 `bg-accent/10` → `border-l-[3px] border-accent bg-accent-soft`
- 未选中：透明 3px 左边 + `hover:bg-surface-2`
- 发件人字号 `text-[13px]` → `text-base`（13.5px）
- 主题字号 `text-[12.5px]` → `text-sm`
- snippet 字号 `text-[11.5px]` → `text-[12px]`
- snippet 颜色 `text-muted` → `text-muted-2`
- 时间字号 `text-[10.5px]` → `text-[12px]`
- 时间颜色 `text-muted` → `text-muted-2`
- 时间格式逻辑不动

- [ ] **Step 2: typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿。

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add src/renderer/src/components/messages/MessageRow.tsx
git commit -m "feat(ui): MessageRow 选中态左 3px 色条 + 字号统一"
```

---

## Task 4：RightColumn 内容卡片化

**Files:**
- Modify: `src/renderer/src/components/detail/RightColumn.tsx`

- [ ] **Step 1: 完整替换 RightColumn.tsx**

替换为：

```tsx
import { useState } from 'react';
import { useStore } from '../../store';
import MessageBody from './MessageBody';
import TranslationPanel from './TranslationPanel';
import Avatar from '../common/Avatar';
import { displayNameFor } from '../../lib/avatar';
import { MailOpen, Image as ImageIcon, ImageOff } from 'lucide-react';

export default function RightColumn(): JSX.Element {
  const detailKey = useStore((s) =>
    s.selectedEmail && s.selectedMessageId ? `${s.selectedEmail}:${s.selectedMessageId}` : null,
  );
  const detail = useStore((s) => (detailKey ? s.messageDetail[detailKey] : null));
  const [showImages, setShowImages] = useState(false);

  if (!detail) {
    return (
      <section className="flex flex-1 items-center justify-center bg-bg">
        <div className="text-center text-sm text-muted">
          <MailOpen size={48} strokeWidth={1.2} className="mx-auto mb-3 text-border" />
          选择一封邮件查看内容
        </div>
      </section>
    );
  }

  const senderName = displayNameFor(detail.fromAddr) || detail.fromAddr;
  const senderEmail = detail.fromAddr.match(/<(.+?)>/)?.[1] ?? detail.fromAddr;

  return (
    <section className="flex flex-1 flex-col overflow-hidden bg-bg">
      <div className="m-4 flex flex-1 flex-col overflow-hidden rounded-lg bg-surface shadow-card">
        <header className="border-b border-border px-6 py-4">
          <h2 className="mb-3 text-xl font-semibold leading-snug text-text">
            {detail.subject || '(无主题)'}
          </h2>
          <div className="flex items-start gap-3">
            <Avatar identityKey={detail.fromAddr || 'unknown'} label={senderName} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[13px] font-medium text-text">{senderName}</span>
                  {senderEmail !== senderName && (
                    <span className="ml-1.5 text-[11.5px] text-muted-2">&lt;{senderEmail}&gt;</span>
                  )}
                </div>
                <time className="shrink-0 text-[12px] text-muted-2">
                  {new Date(detail.dateTs).toLocaleString('zh-CN')}
                </time>
              </div>
              <div className="mt-0.5 text-[11px] text-muted">发给 {detail.accountEmail}</div>
            </div>
          </div>
          {detail.bodyHtml && (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowImages((s) => !s)}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition ${
                  showImages
                    ? 'border-transparent bg-accent-soft text-accent'
                    : 'border-border bg-surface text-muted hover:bg-surface-2'
                }`}
              >
                {showImages ? <ImageIcon size={12} /> : <ImageOff size={12} />}
                {showImages ? '已加载外部图片' : '加载外部图片'}
              </button>
            </div>
          )}
        </header>
        <div className="border-b border-border px-6 pt-3 pb-3">
          <TranslationPanel detail={detail} />
        </div>
        <MessageBody detail={detail} allowImages={showImages} />
      </div>
    </section>
  );
}
```

主要变化：
- 整体 `bg-white` → `bg-bg`（两处）
- 内容包卡片层 `<div className="m-4 ... rounded-lg bg-surface shadow-card">`
- 「加载外部图片」按钮 开启态：`bg-accent-soft text-accent border-transparent`
- 「加载外部图片」按钮 关闭态：`bg-surface ... hover:bg-surface-2`
- 标题字号 `text-[17px]` → `text-xl`
- 发件人邮箱 `text-[12px] text-muted` → `text-[11.5px] text-muted-2`
- 时间字号 `text-[11px] text-muted` → `text-[12px] text-muted-2`

- [ ] **Step 2: typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿。

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add src/renderer/src/components/detail/RightColumn.tsx
git commit -m "feat(ui): 右栏内容卡片化 + 加载图片按钮 token"
```

---

## Task 5：TranslationPanel 4 状态卡片 token

**Files:**
- Modify: `src/renderer/src/components/detail/TranslationPanel.tsx`

- [ ] **Step 1: 完整替换 TranslationPanel.tsx**

替换为：

```tsx
import { useEffect, useState } from 'react';
import type { MessageDetail } from '../../../../shared/types';
import { Languages, Loader2, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  detail: MessageDetail;
}

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'done'; text: string }
  | { kind: 'error'; error: string };

export default function TranslationPanel({ detail }: Props): JSX.Element | null {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    setState({ kind: 'idle' });
    setExpanded(true);
  }, [detail.accountEmail, detail.messageId]);

  const sourceText = pickSourceText(detail);
  if (!sourceText.trim()) return null;

  const translate = async (): Promise<void> => {
    setState({ kind: 'loading' });
    const res = await window.api.translation.translate(sourceText);
    if (res.ok && res.text) setState({ kind: 'done', text: res.text });
    else setState({ kind: 'error', error: res.error ?? '翻译失败' });
  };

  if (state.kind === 'idle') {
    return (
      <div className="flex items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2 text-xs">
        <span className="flex items-center gap-1.5 text-muted">
          <Languages size={13} className="text-accent" />
          英文邮件？一键翻译成中文
        </span>
        <button
          type="button"
          onClick={() => void translate()}
          className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-accent/95"
        >
          翻译为中文
        </button>
      </div>
    );
  }

  if (state.kind === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs text-muted">
        <Loader2 size={13} className="animate-spin text-accent" />
        翻译中…
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <div className="flex items-center justify-between rounded-md border border-[#ffd5d2] bg-[#fff4f3] px-3 py-2 text-xs text-danger">
        <span>翻译失败：{state.error}</span>
        <button
          type="button"
          onClick={() => void translate()}
          className="rounded-md border border-[#ffd5d2] bg-surface px-2 py-0.5 hover:bg-[#fff4f3]"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface-2">
      <header className="flex items-center justify-between border-b border-border px-3 py-1.5 text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <Languages size={12} className="text-accent" />
          中文翻译
        </span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 hover:bg-surface-2"
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            {expanded ? '折叠' : '展开'}
          </button>
          <button
            type="button"
            onClick={() => void translate()}
            className="flex items-center gap-0.5 rounded px-1.5 py-0.5 hover:bg-surface-2"
          >
            <RotateCcw size={11} />
            重新翻译
          </button>
        </div>
      </header>
      {expanded && (
        <div className="whitespace-pre-wrap px-4 py-3 text-[13px] leading-[1.75] text-text">
          {compactParagraphs(state.text)}
        </div>
      )}
    </div>
  );
}

function compactParagraphs(text: string): string {
  const paras = text.split(/\n\s*\n+/).map((p) => p.trim()).filter(Boolean);
  const merged: string[] = [];
  let buf = '';
  for (const p of paras) {
    const shortSelf = p.length <= 40;
    const shortBuf = buf.length > 0 && buf.length <= 40;
    if (shortSelf && (shortBuf || buf === '')) {
      buf = buf ? `${buf} ${p}` : p;
    } else if (shortBuf) {
      merged.push(`${buf} ${p}`);
      buf = '';
    } else {
      if (buf) merged.push(buf);
      buf = p;
    }
  }
  if (buf) merged.push(buf);
  return merged.join('\n\n');
}

function pickSourceText(detail: MessageDetail): string {
  if (detail.bodyText && detail.bodyText.trim()) return detail.bodyText;
  if (detail.bodyHtml) return stripHtmlForText(detail.bodyHtml);
  return detail.snippet ?? '';
}

function stripHtmlForText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

主要变化：
- idle 卡：`bg-gradient-to-r from-sidebar/40 to-sidebar/20` → `bg-surface-2`
- idle 按钮 hover：`hover:bg-accent/90` → `hover:bg-accent/95`
- loading 卡：`bg-bg` → `bg-surface-2`
- error 卡：`border-red-200 bg-red-50` → `border-[#ffd5d2] bg-[#fff4f3]`
- error 重试按钮：`border-red-300 bg-white hover:bg-red-50` → `border-[#ffd5d2] bg-surface hover:bg-[#fff4f3]`
- done 容器：`bg-bg` → `bg-surface-2`
- done 头部 hover：`hover:bg-sidebar` → `hover:bg-surface-2`
- 翻译/折叠 / 重译 算法 / IPC 调用 完全不动

- [ ] **Step 2: typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿。

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add src/renderer/src/components/detail/TranslationPanel.tsx
git commit -m "feat(ui): TranslationPanel 4 状态卡片 token 化 + Apple 红柔和"
```

---

## Task 6：MessageBody iframe srcDoc CSS

**Files:**
- Modify: `src/renderer/src/components/detail/MessageBody.tsx`

- [ ] **Step 1: 替换 MessageBody.tsx 内的 buildSrcDoc style 块**

Edit `src/renderer/src/components/detail/MessageBody.tsx`，找到 `const style = ...` 模板字符串（约第 29-45 行），替换为：

```ts
  const style = `
    body{
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
      font-size: 15px;
      line-height: 1.65;
      color: #1d1d1f;
      padding: 24px 28px;
      margin: 0;
      background: #ffffff;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    a{ color:#007aff; }
    pre{ white-space: pre-wrap; word-break: break-word; }
    table{ max-width: 100%; }
    ${imgStyle}
  `;
```

主要变化：
- `font-size: 14px` → `15px`
- `color: #1a1a1a` → `#1d1d1f`
- `padding: 20px 24px` → `24px 28px`
- `a { color: #2563eb }` → `#007aff`
- `line-height: 1.65` 保持
- imgStyle 逻辑 / sandbox / CSP 全部不动

- [ ] **Step 2: typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿。

- [ ] **Step 3: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add src/renderer/src/components/detail/MessageBody.tsx
git commit -m "feat(ui): 正文 iframe 字号 15 + Apple 色板"
```

---

## Task 7：其它组件硬编码颜色 token 化

**Files:**
- Modify: `src/renderer/src/components/layout/Toolbar.tsx`
- Modify: `src/renderer/src/components/accounts/LeftColumn.tsx`
- Modify: `src/renderer/src/components/accounts/AccountItem.tsx`
- Modify: `src/renderer/src/components/accounts/AddAccountDialog.tsx`
- Modify: `src/renderer/src/components/accounts/CredentialsDrawer.tsx`

7 个独立编辑点，全部按"硬编码 → token"映射改：

- [ ] **Step 1: Toolbar.tsx —— 提示音按钮 hover**

Edit `src/renderer/src/components/layout/Toolbar.tsx`，第 43 行：

```tsx
          className="rounded p-1 text-muted transition hover:bg-black/5 hover:text-text"
```

改为：

```tsx
          className="rounded p-1 text-muted transition hover:bg-surface-2 hover:text-text"
```

`bg-white/70` 工具栏背景**保留**（这是磨砂半透明设计）。

- [ ] **Step 2: LeftColumn.tsx —— 顶部按钮 hover**

Edit `src/renderer/src/components/accounts/LeftColumn.tsx`，第 22 行：

```tsx
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-black/5 disabled:opacity-30"
```

改为：

```tsx
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition hover:bg-surface-2 disabled:opacity-30"
```

- [ ] **Step 3: AccountItem.tsx —— 5 处硬编码替换**

Edit `src/renderer/src/components/accounts/AccountItem.tsx`：

**第 48-50 行**（选中态 / hover 态）：

```tsx
        className={`group flex items-center gap-2.5 rounded-lg pl-2 pr-1 py-1.5 transition-colors ${
          isSelected ? 'bg-white shadow-sm ring-1 ring-accent/15' : 'hover:bg-black/5'
        }`}
```

改为：

```tsx
        className={`group flex items-center gap-2.5 rounded-lg pl-2 pr-1 py-1.5 transition-colors ${
          isSelected ? 'bg-surface shadow-card ring-1 ring-accent/15' : 'hover:bg-surface-2'
        }`}
```

**第 73-78 行**（新邮件徽章——保持现代橙渐变，但用 Apple warning 色）：

```tsx
            <span
              className="shrink-0 rounded-full bg-gradient-to-b from-orange-400 to-orange-500 px-1.5 text-[10px] font-semibold text-white shadow-sm animate-pulse"
              title={`${newCount} 封新邮件`}
            >
              +{newCount}
            </span>
```

改为：

```tsx
            <span
              className="shrink-0 rounded-full bg-warning px-1.5 text-[10px] font-semibold text-white shadow-card animate-pulse"
              title={`${newCount} 封新邮件`}
            >
              +{newCount}
            </span>
```

**第 84 行**（更多按钮 hover）：

```tsx
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-black/10 group-hover:opacity-100"
```

改为：

```tsx
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted opacity-0 transition hover:bg-surface-2 group-hover:opacity-100"
```

**第 94 行**（弹出菜单容器）：

```tsx
          <div className="absolute right-2 top-11 z-40 w-44 overflow-hidden rounded-lg border border-border bg-white shadow-xl ring-1 ring-black/5">
```

改为：

```tsx
          <div className="absolute right-2 top-11 z-40 w-44 overflow-hidden rounded-lg border border-border bg-surface shadow-popover">
```

**第 95-101 行**（更新应用密码 菜单项 hover）：

```tsx
            <button
              type="button"
              onClick={onUpdate}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-sidebar"
            >
```

改为：

```tsx
            <button
              type="button"
              onClick={onUpdate}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-2"
            >
```

**第 103-110 行**（移除账号 菜单项 hover）：

```tsx
            <button
              type="button"
              onClick={() => void onRemove()}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-danger hover:bg-red-50"
            >
```

改为：

```tsx
            <button
              type="button"
              onClick={() => void onRemove()}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-xs text-danger hover:bg-[#fff4f3]"
            >
```

- [ ] **Step 4: AddAccountDialog.tsx —— 6 处硬编码替换**

Edit `src/renderer/src/components/accounts/AddAccountDialog.tsx`：

**第 234 行**（蒙层）：

```tsx
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6">
```

改为：

```tsx
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
```

（保留半透明蒙层，但降到 30% 更柔和——符合 Sequoia 风格）

**第 348 行**（说明卡 1）：

```tsx
              <div className="rounded-md border border-border bg-blue-50/40">
```

改为：

```tsx
              <div className="rounded-md border border-border bg-accent-soft/50">
```

**第 418 行**（错误卡）：

```tsx
              <div className="whitespace-pre-wrap rounded-md bg-red-50 px-3 py-2 text-[12px] text-danger">
```

改为：

```tsx
              <div className="whitespace-pre-wrap rounded-md border border-[#ffd5d2] bg-[#fff4f3] px-3 py-2 text-[12px] text-danger">
```

**第 515 行**（说明卡 2）：

```tsx
              <div className="border-b border-border bg-blue-50/40 px-3 py-2 text-[11px]">
```

改为：

```tsx
              <div className="border-b border-border bg-accent-soft/50 px-3 py-2 text-[11px]">
```

**第 552 行**（loading 蒙层）：

```tsx
                <div className="absolute inset-0 flex items-center justify-center bg-white/95 p-8">
```

改为：

```tsx
                <div className="absolute inset-0 flex items-center justify-center bg-surface/95 p-8">
```

**第 650 行**（复制按钮）：

```tsx
      className="flex shrink-0 items-center gap-0.5 rounded border border-border bg-white px-1.5 py-0.5 text-[10px] text-muted hover:bg-white/80"
```

改为：

```tsx
      className="flex shrink-0 items-center gap-0.5 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-muted hover:bg-surface-2"
```

- [ ] **Step 5: CredentialsDrawer.tsx —— 蒙层**

Edit `src/renderer/src/components/accounts/CredentialsDrawer.tsx`，第 65 行：

```tsx
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
```

改为：

```tsx
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6"
```

- [ ] **Step 6: typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿。

- [ ] **Step 7: 二次扫描，确认无遗漏**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
grep -rnE "(bg|text|border)-(black|white)/[0-9]+|bg-(red|blue|gray|green|yellow|orange)-[0-9]" src/renderer/ | grep -v "bg-white/70\|bg-white/95\|bg-black/30" || echo "OK 无遗漏"
```

Expected 输出: 只允许保留的 `bg-white/70`（工具栏磨砂）和已用 token 的 `bg-black/30`（蒙层）；其它硬编码项应该都不出现。

如果有其它遗漏（如 `TotpPanel.tsx` 第 64 行的 `bg-orange-100`），那是属于 `TotpPanel` 设计性"上一次同步偏差"的颜色，按 spec §6.1 "TotpPanel 仅 token 跟随"——但 `bg-orange-100` 不是 token。我决定**留它**：这是用户已经接受过的小徽章颜色，且 TotpPanel 单独提及不在本次范围。

- [ ] **Step 8: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add src/renderer/src/components/layout/Toolbar.tsx \
        src/renderer/src/components/accounts/LeftColumn.tsx \
        src/renderer/src/components/accounts/AccountItem.tsx \
        src/renderer/src/components/accounts/AddAccountDialog.tsx \
        src/renderer/src/components/accounts/CredentialsDrawer.tsx
git commit -m "feat(ui): 其它组件硬编码颜色 token 化"
```

---

## Task 8：完整手测 + 收尾

走 spec §8 的 9 项验证。

**Files:** 无改动，纯验证

- [ ] **Step 1: 启动 App**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm dev
```

- [ ] **Step 2: 验证 1 — typecheck + build**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck && pnpm build
```

Expected: 全绿。

- [ ] **Step 3: 验证 2 — 整体视觉**

App 启动后看主窗口：
- 三栏背景：左栏 `#ececef`，中栏 / 右栏 `#f5f5f7` 浅灰底
- 中栏 / 右栏内可见**白色卡片浮起**（带柔和阴影）
- 整体没有刺眼对比 / 颜色撞色

- [ ] **Step 4: 验证 3 — 中栏列表**

- 选中某邮件 → 左侧出现 3px 蓝色条 + `bg-accent-soft` 浅蓝背景
- 鼠标 hover 未选中邮件 → 微微变浅 (`bg-surface-2`)
- 数一下当前可见邮件数，应 ≥ 8（30 账号 1080p 屏幕）

- [ ] **Step 5: 验证 4 — 右栏详情**

- 内容整个浮起为一个大白卡片
- iframe 正文字号比之前大 1px（视觉更舒服）
- 标题 `text-xl` 比之前大一点

- [ ] **Step 6: 验证 5 — 左栏 / 工具栏 token 跟随**

- 工具栏背景：磨砂浅灰（透出底层 `bg-bg`）
- 工具栏右上提示音按钮 hover 是 `bg-surface-2`（不是黑色透明）
- 左栏账号选中态：白底卡片 + accent ring
- 左栏账号 hover：`bg-surface-2`

- [ ] **Step 7: 验证 6 — 加账号对话框**

打开"+添加账号"：
- 蒙层比之前柔和（30% 透明，不是 40%）
- 说明卡背景：淡蓝（`bg-accent-soft/50`，Apple 蓝）
- 制造一个错误（输错应用密码）→ 错误卡是 Apple 红柔和（`#fff4f3` 底）不是 Tailwind 鲜红

- [ ] **Step 8: 验证 7 — TranslationPanel**

打开一封英文邮件：
- idle 卡 `bg-surface-2`（淡灰，无渐变）
- 点击翻译 → loading 灰底转圈
- 翻译成功 → done 卡 `bg-surface-2`，头部 hover 是 surface-2
- 制造翻译失败 → error 卡 Apple 红柔和

- [ ] **Step 9: 验证 8 — 无 `dark:` 残留**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
grep -rn "dark:" src/renderer/
```

Expected 输出: 空（无任何 `dark:` 前缀）。

- [ ] **Step 10: 验证 9 — 提示音功能仍正常**

给某账号发一封测试邮件，5-60 秒后应听到 1 次 Glass 提示音。工具栏右上喇叭按钮仍能切换。

- [ ] **Step 11: Final commit（如有手测发现的微调）**

如果验证中发现问题需要修，修完后单独提交：

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git status
git add <修改的文件>
git commit -m "fix(ui): <具体修了什么>"
```

如无问题，本任务**不需要额外 commit**。

---

## 自审备注（来自 plan 撰写时）

**Spec coverage check** — 对照 spec §7 文件清单：
- `tailwind.config.js` ✓ Task 1
- `MiddleColumn.tsx` ✓ Task 2
- `MessageRow.tsx` ✓ Task 3
- `RightColumn.tsx` ✓ Task 4
- `TranslationPanel.tsx` ✓ Task 5
- `MessageBody.tsx` ✓ Task 6
- 硬编码扫描发现的其它（Toolbar / LeftColumn / AccountItem / AddAccountDialog / CredentialsDrawer）✓ Task 7

spec §8 验证 9 项全部映射到 Task 8 Step 2-10，无遗漏。

**Placeholder scan** — 所有 className 字符串都是完整可粘贴的；所有"old → new"对都有具体 before/after。无 TBD / TODO。

**Type consistency** —
- `bg-bg` / `bg-surface` / `bg-surface-2` / `text-muted-2` / `accent-soft` / `border-strong` 这些新 token 在 Task 1 定义，Task 2-7 使用 ✓
- `text-base` / `text-sm` / `text-lg` / `text-xl` 字号 token 在 Task 1 定义，Task 3 / Task 4 使用 ✓
- `shadow-card` / `shadow-card-hover` / `shadow-popover` 在 Task 1 定义，Task 2 / Task 4 / Task 7 使用 ✓
- 圆角 `rounded` (8px) / `rounded-lg` (12px) 在 Task 1 定义，Task 2 / Task 4 使用 ✓
- Apple 红柔和 `#fff4f3` / `#ffd5d2` 跨 Task 5 / Task 7 使用一致 ✓

**YAGNI 边界** — 严格按 spec §9，无加塞 dark mode / 自定义主题 / 密度切换 / 动效 / 字体可调等。
