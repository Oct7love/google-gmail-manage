# Mail Viewer UI 升级 — macOS Sequoia 浅色（Layered 派）设计稿

> 状态：待用户审核 → 通过后进入实现 plan
> 日期：2026-05-28

## 1. 用户需求与边界

用户原话："开始优化主题 组件 ui 等等"。经过澄清后明确：

**目标范围**：

- 视觉风格：**Apple HIG / macOS Sequoia 浅色**，具体走 **Layered 分层派**（浅灰底 + 白色卡片浮起 + 柔和阴影）
- 重点改善体验：邮件列表更好扫 / 详情阅读体验 / 整体质感
- 改动深度：**换皮 + 微调交互**（不动信息架构、不动功能位置、不动核心交互）

**明确不做**：

- 深色模式（用户偏好白底，已记 memory）
- 信息架构调整（不重排面板、不合并/拆分组件）
- 字体可调 / 密度切换 / 主题选择器
- 复杂动效

**左栏特殊处理**：用户选择"结构 / 交互不动，颜色跳随 token 自动变"——即左栏不写新 className，只随 token 自然升级。

## 2. 核心约束

- **不动 CLAUDE.md 已锁定的边界**：极简、白底、不要 #222 这么重、用户偏好 #666 灰
- **不引入新依赖**：完全靠现有 Tailwind + lucide-react + zustand
- **不动安全模型**：iframe srcDoc 的 CSP / sandbox / 默认不加载外部图片 等全部保留
- **可读性优先**：Mac 大屏 30 账号 × 20 邮件场景，单屏可见邮件数不能比当前明显变少
- **范围纪律**：左栏 / 工具栏 / 对话框 等组件只随 token 跟随，不写新 className（除非确认硬编码颜色需替换）

## 3. Design Tokens（新 `tailwind.config.js`）

### 3.1 颜色

```js
colors: {
  // 表面层级
  bg:          '#f5f5f7',  // 全局浅灰底（macOS Settings 同款）
  surface:     '#ffffff',  // 卡片白
  'surface-2': '#fbfbfd',  // 次级表面
  sidebar:     '#ececef',  // 左栏稍灰
  // 边框
  border:        '#e0e0e3',
  'border-strong':'#d0d0d4',
  // 文字
  text:    '#1d1d1f',  // Apple primary
  'text-2':'#3c3c3f',
  muted:   '#6e6e72',  // ≈ 用户偏好的 #666
  'muted-2':'#8e8e93',
  // 强调
  accent:       '#007aff',  // macOS 系统蓝（取代旧 #2563eb）
  'accent-soft':'#e8f1ff',
  // 语义（Apple 调色板）
  danger:  '#ff3b30',
  success: '#34c759',
  warning: '#ff9500',
}
```

### 3.2 字号

```js
fontSize: {
  xs:   '11px',
  sm:   '12.5px',
  base: '13.5px',
  lg:   '15px',
  xl:   '17px',
}
```

### 3.3 圆角

```js
borderRadius: {
  DEFAULT: '8px',
  sm:      '4px',
  lg:      '12px',
}
```

### 3.4 阴影

```js
boxShadow: {
  card:        '0 1px 2px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.05)',
  'card-hover':'0 2px 6px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.06)',
  popover:     '0 8px 24px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.05)',
}
```

### 3.5 字体（不动）

```js
fontFamily: {
  sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Helvetica Neue', 'sans-serif'],
}
```

### 3.6 darkMode 配置

保持 `darkMode: 'media'`；**所有组件不写 `dark:` 前缀**，确保浅色 only 不受系统暗色模式影响。

## 4. 中栏邮件列表（重点）

### 4.1 整体策略

**整个列表包成一个大圆角白卡** 浮在 `bg-bg` 浅灰底上，行内保留紧凑分隔线（不做"逐行小卡片"——会降低信息密度）。学 Apple Mail 浅色。

### 4.2 `MiddleColumn.tsx` 改动

- 整体 `bg-white` → `bg-bg`
- 邮件列表 `<ul>` 包成圆角白卡：`<ul className="mx-3 my-3 divide-y divide-border overflow-hidden rounded bg-surface shadow-card">`
- 空状态 `<p>` 改用同款卡片样式
- Header 内 🔑 / 🔄 按钮：`hover:bg-black/5` → `hover:bg-surface-2`

### 4.3 `MessageRow.tsx` 改动

- 选中态：`bg-accent/10` → `bg-accent-soft`，加左 3px accent 色条 (`border-l-[3px] border-accent`)
- Hover 态：`hover:bg-sidebar` → `hover:bg-surface-2`
- 发件人字号：`text-[13px]` → `text-base` (13.5px)
- 主题字号：`text-[12.5px]` → `text-sm` (12.5px) 保持
- snippet 字号：`text-[11.5px]` → `text-[12px]`
- snippet 颜色：`text-muted` → `text-muted-2`（次级信息退一级）
- 时间字号：`text-[10.5px]` → `text-[12px]`（关键可读性改善）
- 时间格式逻辑：**不动**（当天 HH:MM / 今年 M/D / 跨年 YYYY/M/D 已经合理）

### 4.4 不动

- 行高 / py-2.5 padding（已合适）
- Avatar 32px 大小
- 中栏 360px 宽
- 点击 / 双击交互逻辑
- 时间格式策略

## 5. 右栏邮件详情（重点）

### 5.1 整体策略

**内容包一个大白卡片浮起** 在浅灰底上，包住 Header / TranslationPanel / MessageBody iframe 三段。iframe 走方案 A：被卡片圆角裁切几像素（视觉无感）。

### 5.2 `RightColumn.tsx` 改动

- 整体 `bg-white` → `bg-bg`
- 内容包卡片层：在 `<section>` 内、`<header>` 外加 `<div className="m-4 flex flex-1 flex-col overflow-hidden rounded-lg bg-surface shadow-card">`，把 header + translation 包装 + body iframe 包进来
- 「加载外部图片」按钮：
  - 开启态：`border-accent/40 bg-accent/5 text-accent` → `bg-accent-soft text-accent border-transparent`
  - 关闭态：`border-border bg-white text-muted` → `border-border bg-surface text-muted`
- 发件人邮箱角括号 `<email>`：`text-[12px] text-muted` → `text-[11.5px] text-muted-2`
- 时间字号：`text-[11px]` → `text-[12px]`（与中栏对齐）
- 标题字号：`text-[17px]` → `text-xl` (17px) 保持

### 5.3 `TranslationPanel.tsx` 改动（4 状态卡片）

- **idle 卡片**：背景 `bg-gradient-to-r from-sidebar/40 to-sidebar/20` → `bg-surface-2`（去渐变更干净）
- **idle 按钮**：`bg-accent hover:bg-accent/90` → `bg-accent hover:bg-accent/95`
- **loading 卡片**：`bg-bg` → `bg-surface-2`
- **error 卡片**：`bg-red-50 border-red-200 text-danger` → `bg-[#fff4f3] border-[#ffd5d2] text-danger`（Apple 红柔和）
- **error 重试按钮**：`border-red-300 bg-white hover:bg-red-50` → `border-[#ffd5d2] bg-surface hover:bg-[#fff4f3]`
- **done 头部 hover**：`hover:bg-sidebar` → `hover:bg-surface-2`

### 5.4 `MessageBody.tsx`（iframe srcDoc inline CSS）

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
  font-size: 15px;       /* 原 14px → 15px，正文阅读 +1px 显著舒服 */
  line-height: 1.65;
  color: #1d1d1f;        /* 原 #1a1a1a → #1d1d1f */
  padding: 24px 28px;    /* 原 20px 24px → 24px 28px */
  margin: 0;
  background: #ffffff;
  word-break: break-word;
  overflow-wrap: break-word;
}
a { color: #007aff; }    /* 原 #2563eb → #007aff */
pre { white-space: pre-wrap; word-break: break-word; }
table { max-width: 100%; }
/* imgStyle 逻辑保持不变 */
```

### 5.5 不动

- iframe sandbox / CSP / 默认不加载外部图片 安全策略
- compactParagraphs 翻译合并算法
- 折叠 / 重译 按钮位置
- 翻译 IPC 调用

## 6. 左栏 / 工具栏 / 对话框（被动跟进）

### 6.1 不写新 className 的组件

| 组件 | 处理 |
|---|---|
| `Toolbar.tsx` | 仅 token 跟随；新增的 🔔/🔕 提示音按钮（来自上一次 PR）hover 从 `hover:bg-black/5` → `hover:bg-surface-2`（统一改） |
| `LeftColumn.tsx` | 仅 token 跟随 |
| `AccountItem.tsx` | 仅 token 跟随（hover / 选中态自动用新 sidebar / accent） |
| `AddAccountDialog.tsx` | 仅 token 跟随，**例外**：硬编码红色错误卡需替换（见 6.2） |
| `TotpPanel.tsx` | 仅 token 跟随 |
| `CredentialsDrawer.tsx` | 仅 token 跟随 |
| `SmsCodeBox.tsx` | 仅 token 跟随 |
| `Avatar.tsx` / `Logo.tsx` | 不动（色彩生成算法独立） |
| `common/*` | 不动 |

### 6.2 硬编码颜色替换

实施阶段会跑：

```bash
# 1. 硬编码十六进制 + Tailwind 默认色板
grep -rnE "#[0-9a-fA-F]{6}|bg-(red|blue|gray|green|yellow|orange)-[0-9]" src/renderer/

# 2. black/white + 透明度（hover/active 常见用法）
grep -rnE "(bg|text|border)-(black|white)/[0-9]+" src/renderer/
```

扫出所有硬编码十六进制 / Tailwind 默认色板 / `black|white/数字` 透明度用法（不在我们 token 里的），逐个替换为 token 化值或 Apple 调色板柔和版。

**已知点**（来自 brainstorming 阅读）：

- `TranslationPanel.tsx` 的 `red-50 / red-200 / red-300` → Apple 红柔和（见 5.3）
- 多处 `hover:bg-black/5` → `hover:bg-surface-2`（Toolbar / MiddleColumn header 按钮等）
- 多处 `bg-white/70` 工具栏背景 → 保留（这是磨砂半透明，是设计的一部分，token 已表达不了）
- 其它如 `AddAccountDialog.tsx` 错误卡的硬编码红，若有也同样替换

## 7. 文件改动清单

| 文件 | 改动类型 | 责任 |
|---|---|---|
| `tailwind.config.js` | 改 | 更新 colors / 新增 fontSize / borderRadius / boxShadow tokens |
| `src/renderer/src/components/messages/MiddleColumn.tsx` | 改 | 整体 bg；列表卡片化；按钮 hover bg |
| `src/renderer/src/components/messages/MessageRow.tsx` | 改 | 选中/hover 态；字号统一；snippet 颜色 |
| `src/renderer/src/components/detail/RightColumn.tsx` | 改 | 整体 bg；内容卡片化；加载图片按钮 token；时间字号 |
| `src/renderer/src/components/detail/TranslationPanel.tsx` | 改 | 4 状态卡片 token + 红色柔和 |
| `src/renderer/src/components/detail/MessageBody.tsx` | 改 | iframe srcDoc CSS（字号 / 颜色 / padding） |
| 硬编码扫描发现的其它文件 | 改 | 见 6.2 |

**不动**：CLAUDE.md / 主进程任何文件 / Avatar / Logo / Toolbar / LeftColumn / AccountItem / AddAccountDialog（除硬编码红） / TotpPanel / CredentialsDrawer / SmsCodeBox / store.ts / types.ts。

## 8. 验证清单

实现完成后必须人工验证：

1. `pnpm typecheck && pnpm build` 全绿
2. App 启动后整体视觉：浅灰底 + 中右栏白色卡片浮起 + 阴影柔和
3. 中栏列表：选中态左 3px 色条 + accent-soft 背景；hover 微凸；30 账号场景单屏可见邮件数 ≥ 8
4. 右栏详情：大白卡浮起；iframe 正文 15px 阅读舒适；翻译卡片浅色不刺眼
5. 左栏 / 工具栏 / 对话框：跟随 token，无色板撞色；现有功能 0 改动
6. AddAccountDialog webview 错误卡：红色柔和（非 Tailwind 标准红）
7. TranslationPanel error 态：红色柔和
8. **无 `dark:` 前缀残留**：`grep -rn "dark:" src/renderer/` 应为空（确保浅色 only）
9. 提示音功能仍然正常（不该被 UI 改动影响）

## 9. 不做（YAGNI 总览）

- 深色模式
- 自定义主题颜色 / 主题切换
- 紧凑/宽松密度切换
- 字体大小调节
- 复杂动效（hover transition 已有，足够）
- 信息架构调整（面板位置 / 功能位置）
- 左栏视觉重做
- 邮件列表逐行卡片化方案
- iframe 圆角裁切的精细补偿
