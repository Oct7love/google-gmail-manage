# Mail Viewer 多主题切换 — 设计稿

> 状态：用户已批准方案 → 进入 writing-plans
> 日期：2026-05-28
> 关联：基于 `2026-05-28-mac-sequoia-ui-design.md` 之上的扩展

## 1. 需求

用户希望 App 内能选择主题。当前 token 体系（编译时）改成**运行时可切换**，加 3 个预设主题，工具栏放选择入口。

## 2. 3 个预设主题

| ID | 显示名 | 底色 (bg) | 主色 (accent) | 风格定位 |
|---|---|---|---|---|
| `cream` | 米白·靛蓝 | `#faf9f7` | `#4f46e5` | 当前选定，温暖 Notion 风（默认） |
| `stock` | Apple 灰·系统蓝 | `#f5f5f7` | `#007aff` | 经典 macOS HIG，工具感 |
| `onyx` | 黑·克制 | `#fafafa` | `#0a0a0a` | Things 3 风，最贵感 |

每个主题完整 token 见 §5。

## 3. 切换 UI

工具栏右上 `Palette` lucide 图标按钮，放在 `🔔` 提示音按钮**左边**。

点击 → popover 弹出，列出 3 个主题。每行：

- 4 个小色点（依次展示底色 / 卡片 / 主色 / muted）
- 主题显示名
- 当前选中态打勾

点击某行：
- 立即切换 `data-theme` 属性 → 整个 App 瞬间换肤
- 关闭 popover
- 持久化到 settings.json

## 4. 技术架构

### 4.1 CSS 变量 + Tailwind 引用

把 Tailwind `colors` 改成引用 CSS 变量：

```js
// tailwind.config.js
colors: {
  bg:           'rgb(var(--c-bg) / <alpha-value>)',
  surface:      'rgb(var(--c-surface) / <alpha-value>)',
  'surface-2':  'rgb(var(--c-surface-2) / <alpha-value>)',
  sidebar:      'rgb(var(--c-sidebar) / <alpha-value>)',
  border:       'rgb(var(--c-border) / <alpha-value>)',
  'border-strong':'rgb(var(--c-border-strong) / <alpha-value>)',
  text:         'rgb(var(--c-text) / <alpha-value>)',
  'text-2':     'rgb(var(--c-text-2) / <alpha-value>)',
  muted:        'rgb(var(--c-muted) / <alpha-value>)',
  'muted-2':    'rgb(var(--c-muted-2) / <alpha-value>)',
  accent:       'rgb(var(--c-accent) / <alpha-value>)',
  'accent-soft':'rgb(var(--c-accent-soft) / <alpha-value>)',
  // 语义色保持硬编码（跨主题统一）
  danger:  '#ff3b30',
  success: '#34c759',
  warning: '#ff9500',
}
```

变量值用空格分隔的 RGB 三元组（如 `250 249 247`），这样 Tailwind 的 `<alpha-value>` 占位才能生成 `bg-accent/50` 这种透明度变体。

### 4.2 主题 CSS 定义

新增 `src/renderer/src/index.css`（如果已有则扩展），定义 3 套 `:root[data-theme="..."]` 变量。每套 12 个变量，值是 `R G B` 形式。

### 4.3 主题切换

App 启动：
1. `store.init` 读 `settings.themeId`，默认 `cream`
2. 设置 `document.documentElement.dataset.theme = themeId`

用户切换：
1. ThemePicker onSelect → `store.setTheme(id)`
2. `setTheme`：
   - 立即 `document.documentElement.dataset.theme = id`
   - 写 `settings.json` 的 `themeId`
   - 更新 store

### 4.4 持久化

`AppSettings` 加 `themeId?: ThemeId`。复用现有 `system.getSettings` / `system.setSettings` IPC。

### 4.5 邮件正文 iframe

iframe srcDoc 内部 CSS 不能继承父级 CSS 变量（iframe 是独立文档），所以正文颜色 / 链接色继续硬编码：

- 选项 A：保持当前 `#1d1d1f` text + `#4f46e5` 链接（米白主题色）——跨主题正文样式固定
- 选项 B：把当前主题色通过 srcDoc 模板字符串动态注入

**采用 A**：正文阅读体验跨主题不需要变化，固定一套读起来稳。如果未来用户反馈深主题下链接颜色不对，再换 B。

## 5. 3 个主题的完整 token 表

### 5.1 `cream`（默认）

```css
:root[data-theme="cream"] {
  --c-bg:           250 249 247;  /* #faf9f7 */
  --c-surface:      255 255 255;  /* #ffffff */
  --c-surface-2:    253 252 250;  /* #fdfcfa */
  --c-sidebar:      243 241 236;  /* #f3f1ec */
  --c-border:       232 229 223;  /* #e8e5df */
  --c-border-strong:214 210 201;  /* #d6d2c9 */
  --c-text:         29 29 31;     /* #1d1d1f */
  --c-text-2:       60 60 63;     /* #3c3c3f */
  --c-muted:        110 110 114;  /* #6e6e72 */
  --c-muted-2:      142 142 147;  /* #8e8e93 */
  --c-accent:       79 70 229;    /* #4f46e5 */
  --c-accent-soft:  238 242 255;  /* #eef2ff */
}
```

### 5.2 `stock`（Apple HIG 经典）

```css
:root[data-theme="stock"] {
  --c-bg:           245 245 247;  /* #f5f5f7 */
  --c-surface:      255 255 255;  /* #ffffff */
  --c-surface-2:    251 251 253;  /* #fbfbfd */
  --c-sidebar:      236 236 239;  /* #ececef */
  --c-border:       224 224 227;  /* #e0e0e3 */
  --c-border-strong:208 208 212;  /* #d0d0d4 */
  --c-text:         29 29 31;     /* #1d1d1f */
  --c-text-2:       60 60 63;     /* #3c3c3f */
  --c-muted:        110 110 114;  /* #6e6e72 */
  --c-muted-2:      142 142 147;  /* #8e8e93 */
  --c-accent:       0 122 255;    /* #007aff */
  --c-accent-soft:  232 241 255;  /* #e8f1ff */
}
```

### 5.3 `onyx`（黑·克制）

```css
:root[data-theme="onyx"] {
  --c-bg:           250 250 250;  /* #fafafa */
  --c-surface:      255 255 255;  /* #ffffff */
  --c-surface-2:    245 245 245;  /* #f5f5f5 */
  --c-sidebar:      240 240 240;  /* #f0f0f0 */
  --c-border:       228 228 228;  /* #e4e4e4 */
  --c-border-strong:212 212 212;  /* #d4d4d4 */
  --c-text:         10 10 10;     /* #0a0a0a */
  --c-text-2:       38 38 38;     /* #262626 */
  --c-muted:        82 82 82;     /* #525252 */
  --c-muted-2:      115 115 115;  /* #737373 */
  --c-accent:       10 10 10;     /* #0a0a0a */
  --c-accent-soft:  235 235 235;  /* #ebebeb */
}
```

注意 `onyx` 主题主色用黑——`bg-accent` 文字色应保持白，所以**已有 `text-white` 用法都跨主题正确**（添加账号按钮、提示音徽章等）。`accent-soft` 也调成浅灰而不是淡蓝，符合"黑·克制"语义。

## 6. 文件改动清单

| 文件 | 改动类型 |
|---|---|
| `tailwind.config.js` | 改 — colors 全部换成 CSS 变量引用 |
| `src/renderer/src/index.css` | **新建**（或扩展现有）— 3 个 :root[data-theme] 定义 |
| `src/renderer/src/main.tsx` | 改 — 启动时 import 新 css（如果 index.css 是新建）|
| `src/main/settings.ts` | 改 — `AppSettings` 加 `themeId?: ThemeId` |
| `src/preload/index.ts` | 改 — getSettings / setSettings 类型补 `themeId` |
| `src/renderer/src/store.ts` | 改 — `themeId` 状态、`setTheme` action、init 时读 settings + 设 data-theme |
| `src/renderer/src/components/layout/ThemePicker.tsx` | **新建** — popover 组件 |
| `src/renderer/src/components/layout/Toolbar.tsx` | 改 — 加 Palette 按钮 + ThemePicker |
| `src/shared/types.ts` | 改 — 导出 `ThemeId` 类型供 main / renderer 共用 |

## 7. 关键不动

- iframe srcDoc 内部 CSS（按 §4.5 决策 A 固定）
- 现有 token 类名（`bg-bg`、`text-accent` 等所有使用方）
- 头像调色板（独立算法）
- Apple 红柔和的错误色（`#fff4f3` / `#ffd5d2`）跨主题保持
- 主进程 / IMAP / 提示音 / 翻译 等业务逻辑

## 8. 验证清单

1. `pnpm typecheck && pnpm build` 全绿
2. App 启动默认是 `cream` 主题（首次安装 / 升级后）
3. 工具栏右上能看到 Palette 图标，点击弹出 popover
4. 切换 3 个主题：
   - `cream` → 温暖米白 + 靛蓝
   - `stock` → 冷灰 + Apple 系统蓝
   - `onyx` → 浅白 + 全黑主色
5. 切换瞬间生效，无闪烁，无重新加载
6. 退出 App 重启 → 主题保持上次选择
7. **重要**：`bg-accent/10`、`text-accent/50` 等透明度变体在所有主题下正常工作（验证 `<alpha-value>` 占位正确）
8. 邮件正文 iframe 在 3 个主题下都是白底 + 深字 + 链接靛蓝（固定，不变）
9. 提示音按钮、添加账号按钮、所有交互都正常
10. 无 `dark:` 残留

## 9. 不做（YAGNI）

- 自定义主题（用户编辑色板）
- 主题导入 / 导出
- 主题切换动画过渡（瞬间最干净）
- 深色主题（用户明确不要）
- 主题预览（用 popover 上的小色点 + 切换瞬间即所见就够）
- 跟随系统主题
- 按时段自动切换（早上 cream / 晚上 onyx 之类）
