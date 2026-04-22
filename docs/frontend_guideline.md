# 前端规范（Frontend Guideline）

> Renderer 进程的界面（React）怎么写、怎么组织、什么能做什么不能做。
> 目标：**UI 保持极简、所有业务动作走 IPC、不直接碰文件系统和网络**。

---

## 核心原则

1. **只做显示和触发** — Renderer 的所有数据来自 IPC，所有写操作通过 IPC。Renderer 里**没有** `fetch()` 调 Gmail、**没有** `require('fs')` 读文件。
2. **极简优先** — 宁少一个功能，不多一个干扰。用户明确拒绝的功能（搜索、过滤、标记）不要"顺手写个按钮留着"。
3. **Mac HIG 风格** — 看起来要像 Mac 原生应用，不是一个移植过来的网页。
4. **键盘友好** — 常用操作有快捷键，不强制鼠标。

---

## 布局（三栏）

```
┌───────────────┬──────────────────┬────────────────────────────┐
│  LeftColumn   │  MiddleColumn    │  RightColumn               │
│  账号列表     │  邮件标题列表    │  邮件正文                  │
│  220px        │  340px           │  剩余（min 400px）         │
└───────────────┴──────────────────┴────────────────────────────┘
```

- 最外层 `<div class="flex h-screen">`
- 左栏固定 220px，中栏固定 340px，右栏 `flex-1`
- 栏之间有 1px 分隔线
- 顶部没有独立 titlebar，用 Electron 的 `titleBarStyle: 'hiddenInset'` 让 Mac 红黄绿按钮保留但去掉工具栏底色

---

## 组件树

```
<App>
├── <SetupWizard />            ← 未配置凭据时全屏
├── <EmptyState />             ← 有凭据但无账号时全屏
└── <MainLayout>
    ├── <LeftColumn>
    │   ├── <AddAccountButton />
    │   ├── <RefreshAllButton />
    │   └── <AccountList>
    │       └── <AccountItem />   ← 每账号一条
    ├── <MiddleColumn>
    │   ├── <RefreshOneButton />
    │   ├── <MessageList>
    │   │   └── <MessageRow />
    │   └── <LoadMoreButton />
    └── <RightColumn>
        └── <MessageDetail>
            ├── <MessageHeader />
            └── <MessageBody />   ← sandboxed iframe
```

所有组件保持**单一职责**，每个文件 ≤ 150 行。超过就拆。

---

## 状态管理（Zustand）

只建**一个 store**，不要拆成多个：

```ts
// src/renderer/store.ts
type State = {
  // 数据
  accounts: Account[];
  messagesByEmail: Record<string, MessageSummary[]>;
  messageDetail: Record<string, MessageDetail>;    // key 是 `${email}:${id}`

  // UI 状态
  selectedEmail: string | null;
  selectedMessageId: string | null;
  refreshingEmails: Set<string>;     // 哪些账号正在刷新
  credentialsConfigured: boolean;

  // actions
  loadAccounts: () => Promise<void>;
  selectAccount: (email: string) => Promise<void>;
  selectMessage: (id: string) => Promise<void>;
  addAccount: () => Promise<void>;
  removeAccount: (email: string) => Promise<void>;
  reauthAccount: (email: string) => Promise<void>;
  refreshOne: (email: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  loadMore: (email: string) => Promise<void>;
};
```

**不要**：
- 不在组件里直接调 `window.api.*`，都走 store action
- 不在 store 里写 setTimeout / 定时逻辑；那是 main 进程的事
- 不用 Redux DevTools 之类的调试工具上生产

---

## 样式（Tailwind）

### 设计 Token

在 `tailwind.config.js` 固定几套值，不要在组件里散写：

```js
colors: {
  bg:        '#fafafa',    // 主背景
  sidebar:   '#f0f0f0',    // 左栏背景
  border:    '#e5e5e5',
  text:      '#1a1a1a',
  muted:     '#888',
  accent:    '#2563eb',    // 选中、链接
  danger:    '#dc2626',
  success:   '#059669',
  warning:   '#d97706',
}
```

深色模式：用 Tailwind 的 `dark:` 变体，跟随 macOS 系统主题（Electron `nativeTheme.shouldUseDarkColors`）。

### 间距 / 字号

- 基础字号 13px（Mac App 惯例）
- 行高 1.5
- 邮件正文里的字号可以稍大（14–15px）让阅读舒服
- 圆角统一 6px
- Padding 用 Tailwind 的 `p-2`、`p-3`、`p-4`，不要出现 `p-[7px]` 这种

### 字体

```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', ...;
```

让系统自己挑。

---

## 各组件要点

### `<SetupWizard>` — 凭据配置引导

- 6 步，每步一页
- 左边步骤指示器，右边内容 + 截图
- 最后一步有两个输入框 + "导入 JSON"按钮
- 保存后过渡到主界面（有 fade 动画）

### `<EmptyState>` — 空账号状态

- 居中大图标（邮件图标）
- 一行引导文字
- 一个大按钮"添加第一个 Gmail 账号"
- 点击调 `store.addAccount()`

### `<AccountList>` / `<AccountItem>`

- 每项高度 44px
- 左侧状态点（🟢 正常 / ⚠️ 过期 / 🔄 刷新中）
- 中间 email 地址（截断显示，hover 时 tooltip 显示全名）
- 右侧未读数字徽章（0 时不显示）
- **hover 时**右上角出现 "⋯" 菜单按钮
- 点击整行 → 切换账号
- 点击"⋯"按钮 → 弹出菜单：重新授权、移除账号
- 当前选中账号背景高亮 `bg-accent/10`

过期账号：
- 状态点 ⚠️ 黄色
- 点击整行不切账号，直接弹"该账号需重新授权"对话框

### `<MessageList>` / `<MessageRow>`

- 每行高度 72px（双行布局）
  - 第 1 行：发件人名（加粗）+ 右上时间
  - 第 2 行：主题，溢出截断
- 列表顶部固定顶栏：账号 email + 🔄 刷新按钮
- 当前选中邮件背景高亮
- 底部"加载更多"按钮（仅当已加载 ≥ 10 封时显示）

### `<MessageDetail>` / `<MessageHeader>` / `<MessageBody>`

- Header：主题（大号字）+ from / to / date
- Body：用 **sandboxed `<iframe>`** 渲染 HTML 正文
  - `sandbox="allow-same-origin"`（只保留样式解析，禁 JS / 禁表单）
  - 用 Blob URL 加载（避免 srcdoc 的某些限制）
  - **外部链接拦截**：iframe 的 `target="_blank"` 点击通过父级事件捕获，弹确认框后 `shell.openExternal`
  - 外部图片默认不加载：iframe CSP `img-src data:`，顶部显示"显示图片"按钮切换到 `img-src *`
- 如果邮件只有纯文本：用 `<pre class="whitespace-pre-wrap">` 渲染

---

## 快捷键

统一在 `App.tsx` 顶层监听：

| 组合 | 动作 |
|---|---|
| ⌘R | 刷新当前选中账号 |
| ⌘⇧R | 全部刷新 |
| ⌘N | 添加新账号 |
| ↑ / ↓ | 邮件列表上下移动 |
| ⌘⌫ | 移除当前选中账号（带确认） |

---

## 加载与错误状态

**加载中**：
- 切账号：中栏显示缓存（瞬间），顶部显示 1px 进度条表示正在刷新
- 切邮件：正文区显示骨架屏

**错误**：
- 添加账号失败：弹系统对话框（Electron `dialog.showErrorBox`）
- 刷新失败：账号图标变 🔴，hover 显示错误原因
- 网络离线：App 右下角显示 "离线中" 小标签，恢复后自动消失

---

## 邮件正文渲染安全（最重要一节）

邮件是**外部不可信内容**，正文渲染必须严格沙盒化：

1. **iframe 渲染**，不用 `dangerouslySetInnerHTML` 直接塞进 React 树
2. `sandbox` 属性只保留 `allow-same-origin`（不给 `allow-scripts`、`allow-forms`、`allow-popups`）
3. iframe 内注入 CSP meta：
   ```html
   <meta http-equiv="Content-Security-Policy"
         content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:;">
   ```
4. 用户点"显示图片"时，把 `img-src` 临时放开到 `*`
5. 任何 `<a>` 点击用事件委托拦截 → 弹确认 → `shell.openExternal`

**禁止**：
- 在 renderer 里用 `DOMParser` 解析邮件并直接渲染
- 用第三方 "html sanitizer" 代替 iframe 沙盒（深度不够）
- 开启 iframe 的 `allow-scripts`

---

## 国际化（i18n）

- 当前**只做中文**
- 字符串集中在 `src/renderer/i18n/zh-CN.ts`，不要散写在组件里
- 将来要加英文只需加一个 `en.ts` 文件

---

## 测试

本项目不追求高测试覆盖（小工具、单用户），但关键模块要有：

- Store 的 action（mock `window.api`）
- `MessageBody` 的 iframe 初始化逻辑
- `SetupWizard` 的表单验证

用 Vitest + @testing-library/react。

---

## 性能

- `<MessageList>` 用虚拟列表？**不需要**，最多 20–30 条
- `<AccountList>` 同理，30 条直接渲染
- 切换账号时用 React 18 的 `useTransition` 让界面不卡顿

---

## 可访问性（A11y）

最低要求：

- 所有 button 有 `aria-label` 或清晰文本
- 列表行是 `<button>` 或 `role="button" tabIndex={0}`
- 颜色对比度 ≥ WCAG AA
- 键盘能完整走完"添加账号 → 选账号 → 选邮件 → 读正文"的全流程

---

## 不要做的事

- ❌ 在 renderer 里 `new XMLHttpRequest` / `fetch()` 直接调 Google
- ❌ 在 renderer 里 `require('electron')` / `require('fs')`（已禁用但提醒）
- ❌ 把 refresh token、client secret 塞进 store 或 localStorage
- ❌ 在组件里写业务逻辑（如"调用 API 后刷新未读数"——这是 action 的职责）
- ❌ 过度动画，Mac 风格是克制的
- ❌ 自己写拖拽排序之类的花哨功能（PRD 没要求）
