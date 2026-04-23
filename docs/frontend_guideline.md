# 前端规范（Frontend Guideline）

> Renderer 进程的界面（React）怎么写、怎么组织、什么能做什么不能做。
> 目标：**UI 保持 Mac HIG 风格、所有业务动作走 IPC、严格沙盒化邮件正文**。

---

## 核心原则

1. **只做显示和触发** — Renderer 的所有数据来自 IPC，所有写操作通过 IPC
2. **极简优先** — 用户明确拒绝的功能不要"顺手写个按钮留着"
3. **Mac HIG 风格** — 看起来像 Mac 原生应用，不是移植过来的网页
4. **键盘友好** — 常用操作有快捷键
5. **用 lucide-react 图标**，不用 emoji 或 Unicode 字符

---

## 布局

```
┌─────────────────────────────────────────────────────────┐
│  Toolbar（高 48px）：Logo + "Mail Viewer · N 个账号"     │
├────────────┬────────────┬──────────────────────────────┤
│ LeftColumn │MiddleColumn│ RightColumn                  │
│ 账号列表    │ 邮件列表    │ 邮件正文                     │
│ 256px      │ 360px      │ 剩余（min 400px）            │
└────────────┴────────────┴──────────────────────────────┘
```

- 最外层 `flex flex-col`，`Toolbar` 固定在上，下方 `flex-1` 三栏
- 顶部用 Electron `titleBarStyle: 'hiddenInset'`
- Toolbar 半透明 + backdrop-blur-xl，`WebkitAppRegion: 'drag'` 让用户能拖窗口

---

## 组件树

```
<App>
├── Loading 占位（首次 init）
└── <MainLayout>
    ├── <Toolbar>                  # Logo + 账号计数 + 同步中徽章
    ├── <LeftColumn>
    │   ├── RefreshAll 按钮
    │   ├── <AccountList>
    │   │   └── <AccountItem />    # 头像 + 状态徽章 + 用户名/域名 + ⋯菜单
    │   └── AddAccount 按钮
    ├── <MiddleColumn>
    │   ├── Inbox 头部 + refresh
    │   └── <MessageList>
    │       └── <MessageRow />     # 发件人头像 + 名字/日期/主题/摘要
    └── <RightColumn>
        ├── Subject + Sender 卡片
        ├── 图片开关按钮
        ├── <TranslationPanel />
        └── <MessageBody />        # sandboxed iframe

<AddAccountDialog>                 # 渲染在 <App> 层级的 overlay
├── 左栏（420px）：
│   ├── Header（标题 + 关闭）
│   ├── 成功横条（条件渲染）
│   ├── Scroll 区
│   │   ├── 粘贴解析按钮 / textarea
│   │   ├── 登录辅助区（imported 时）
│   │   ├── 可折叠帮助
│   │   ├── Gmail 输入框
│   │   ├── 应用密码输入框
│   │   ├── <TotpPanel />
│   │   └── 错误提示
│   └── Footer（取消/完成 + 验证并添加）
└── 右栏：
    ├── Header（→应用密码页 / 登出 / 刷新 / 折叠 / 系统浏览器）
    └── <webview>
```

每个组件**单一职责**，每个文件 ≤ 200 行。超过就拆。

---

## 状态管理（Zustand）

只建一个 store（`renderer/src/store.ts`）：

```ts
type State = {
  status: 'loading' | 'ready';
  accounts: Account[];
  selectedEmail: string | null;
  messagesByEmail: Record<string, MessageSummary[]>;
  messageDetail: Record<string, MessageDetail>;   // key = `${email}:${id}`
  selectedMessageId: string | null;
  refreshingEmails: Set<string>;
  dialogMode: null | 'new' | { update: string };

  init, selectAccount, selectMessage, clearSelectedMessage,
  openAddDialog, openUpdateDialog, closeDialog,
  submitAdd, submitUpdate,
  removeAccount, refreshOne, refreshAll,
  onRefreshProgress,
};
```

**不要**：
- 在组件里直接调 `window.api.*`，都走 store action
- 把 `messages.* selectors` 写成返回新 `[]` 的形式（会引发 Zustand 无限循环），用模块级 `EMPTY_MESSAGES` 常量

---

## 图标（lucide-react）

常用的：
- `Mail` / `MailOpen` / `Inbox` — 邮件相关
- `RefreshCw` / `RotateCw` / `RotateCcw` — 刷新类
- `Plus` — 添加
- `X` — 关闭
- `MoreHorizontal` — 更多菜单
- `ChevronDown/Up/Left/Right` — 折叠箭头
- `ExternalLink` — 外部链接
- `LogOut` — 登出
- `Languages` — 翻译
- `Image` / `ImageOff` — 图片开关
- `ShieldCheck` — 2FA / 安全
- `KeyRound` — 密码/凭据
- `Copy` / `Check` — 复制/已复制
- `Trash2` — 删除
- `ClipboardPaste` — 粘贴
- `HelpCircle` — 帮助
- `Loader2` — spinner
- `CheckCircle2` — 成功提示
- `ArrowRight` — 跳转

**尺寸**：11px（非常小的按钮里）/ 12-13px（小按钮）/ 14px（常规按钮）/ 16-20px（logo/标题区）/ 28-48px（空状态）

**描边**：默认 2，必要时 2.5 加粗（Plus 按钮）

---

## Logo

自定义 SVG（`components/common/Logo.tsx`）：
- 渐变信封（`#3B82F6 → #1D4ED8`）
- 右上角橙色（`#F97316`）小圆点 + 白色描边（代表多账号/通知）

出现位置：
- 顶部 Toolbar（20px）
- 空状态（28px，白底圆角卡片里）

---

## 样式（Tailwind）

### 设计 Token（`tailwind.config.js`）

```js
colors: {
  bg:        '#fafafa',
  sidebar:   '#f0f0f0',
  border:    '#e5e5e5',
  text:      '#1a1a1a',
  muted:     '#888',
  accent:    '#2563eb',    // 主色（蓝）
  danger:    '#dc2626',
  success:   '#059669',
  warning:   '#d97706',
}
```

### 字号

- 基础字号 13px（Mac 惯例）
- Label：12.5px medium
- 小标注：11-11.5px
- 大标题（邮件主题）：17px semibold
- 头像首字母：~46% 尺寸
- 2FA 6 位码：24px semibold tracking-wide tabular-nums

### 圆角

- 通用按钮：6px（`rounded-md`）
- 卡片：8px（`rounded-lg`）
- 头像：圆形
- 胶囊标签：full

### 阴影 & 分层

- 选中的 AccountItem：白底 + `shadow-sm` + `ring-1 ring-accent/15`
- 下拉菜单：`shadow-xl ring-1 ring-black/5`
- 添加账号按钮：渐变蓝 + `shadow-sm`

### 字体

```css
-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif
```

---

## 头像（Avatar）

- 首字母用 `initialFor(email)`（取 @ 前首字符，大写）
- 颜色用 `colorForKey(email)`（稳定 hash → 10 色色板）
- 显示名用 `displayNameFor(fromHeader)`（"Name <email>" → "Name"）

---

## 邮件正文渲染（安全最重要）

邮件是**外部不可信内容**，正文渲染必须严格沙盒化：

1. **iframe + srcDoc**（不是 dangerouslySetInnerHTML）
2. **sandbox="allow-same-origin"**（禁 JS / 禁表单 / 禁弹窗）
3. **CSP**（iframe 内注入 meta）：
   ```
   default-src 'none';
   style-src 'unsafe-inline';
   img-src data: [https: when allowImages];
   font-src data:;
   ```
4. **外部图片默认禁**（只 `img-src data:`），用户点按钮后才开到 `https:`
5. **内嵌 cid: 图片**在 main 进程已转成 data URL 嵌到 HTML，默认就能显示（不受 allowImages 控制）

---

## 国际化

当前只做中文，字符串散在组件里。将来加英文再集中到 `i18n/` 目录。

---

## 禁止项

- ❌ `new XMLHttpRequest` / `fetch()` 直接调外部服务（必须通过 main 进程）
- ❌ `require('electron')` / `require('fs')`（contextIsolation 已禁用，但提醒）
- ❌ emoji 图标（统一用 lucide-react）
- ❌ `<p>` 内再套 `<p>`、`<button>` 内再套 `<button>`（HTML 不合法，会报错崩溃）
- ❌ Zustand selector 返回新对象（`() => s.x ?? []` 会无限 rerender，用模块级常量）
- ❌ 邮件正文用 HTML sanitizer 替代 iframe 沙盒（深度不够）
- ❌ 过度动画（Mac 风格是克制的）

---

## 快捷键

目前只实现 **⌘⌥I = 打开 DevTools**（在 main/index.ts 里监听）。

将来可以加：⌘R（刷新当前）/ ⌘⇧R（全部刷新）/ ⌘N（添加账号）。
