# 新邮件提示音 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 mail-viewer 加新邮件声音提示——IDLE 推送时播 macOS 系统音，工具栏一个总开关，启动/睡眠唤醒/加账号/兜底/主动刷新全部静默。

**Architecture:** 主进程 `child_process.spawn` 调系统命令（Mac `afplay`、Win PowerShell）+ Promise 队列串行播放。`idle-manager.triggerSync` 加 `silent` 参数区分追赶同步 vs IDLE 推送。开关存 `settings.json` 的 `soundEnabled` 字段，工具栏一个 Bell/BellOff 按钮切换。

**Tech Stack:** Electron 主进程 + Node `child_process` + zustand + lucide-react

**项目惯例（重要）：**
- 本项目**没有自动化测试框架**，验证靠 `pnpm typecheck` + 手测，每个任务都跑 typecheck
- Vite HMR 自动推 renderer 改动；**主进程改动必须重启 App**（`kill` 当前 `pnpm dev` 进程再起）
- 所有提交消息中文，跟随现有 commit 风格
- 命令前需要 node@20 路径（用户全局机器约束），但**该项目目前命令实际跑得通**——按现有项目 README 走就行

---

## 文件结构

| 文件 | 改动类型 | 责任 |
|---|---|---|
| `src/shared/types.ts` | 改 | `RefreshEvent` 加 `silent?: boolean` |
| `src/main/settings.ts` | 改 | `AppSettings` 加 `soundEnabled?: boolean` |
| `src/preload/index.ts` | 改 | `getSettings` / `setSettings` 类型扩展 |
| `src/main/sound.ts` | **新建** | 跨平台系统音播放 + 串行队列 |
| `src/main/imap/idle-manager.ts` | 改 | `triggerSync` 加 `silent` 参数；exists 默认 false、追赶同步 true；done 分支按条件 `playNotification` |
| `src/renderer/src/store.ts` | 改 | `soundEnabled` 状态字段 + `toggleSound` action + init 时读 settings |
| `src/renderer/src/components/layout/Toolbar.tsx` | 改 | 加 Bell/BellOff 按钮 |

---

## Task 1：扩展类型 + Settings 字段

打地基。先把所有类型 / 接口扩好，后面任务用得到。这一步纯类型不动逻辑。

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/settings.ts`
- Modify: `src/preload/index.ts:41-44`

- [ ] **Step 1: 给 `RefreshEvent` 加 `silent` 字段**

Edit `src/shared/types.ts`，找到 `RefreshEvent` interface（约 54-60 行），改成：

```ts
/** 刷新事件（后台刷新时 main → renderer 推送） */
export interface RefreshEvent {
  email: string;
  phase: 'start' | 'done' | 'error' | 'expired';
  /** 本次同步新拉到的邮件数（仅 phase='done' 时有值） */
  newCount?: number;
  error?: string;
  /** 本次同步是否静默触发（启动追赶、睡眠唤醒等），renderer 端目前不使用，主进程用于决定是否播声音 */
  silent?: boolean;
}
```

- [ ] **Step 2: 给 `AppSettings` 加 `soundEnabled` 字段**

Edit `src/main/settings.ts`，找到 `AppSettings` interface（约 9-12 行），改成：

```ts
/**
 * 轻量 App 级别配置（非账号相关，存 userData/settings.json）。
 */
export interface AppSettings {
  /** 仅用于添加账号对话框的内嵌 Google webview。格式如 http://127.0.0.1:7890 或 socks5://127.0.0.1:1080 */
  webviewProxy?: string;
  /** 新邮件提示音总开关。undefined 视为 true（首次未设置时默认开启）。 */
  soundEnabled?: boolean;
}
```

- [ ] **Step 3: 给 preload 的 `getSettings` / `setSettings` 加类型字段**

Edit `src/preload/index.ts`，第 41-44 行：

```ts
    getSettings: (): Promise<{ webviewProxy?: string; soundEnabled?: boolean }> =>
      ipcRenderer.invoke(IpcChannels.System.GetSettings),
    setSettings: (
      next: { webviewProxy?: string; soundEnabled?: boolean },
    ): Promise<{ webviewProxy?: string; soundEnabled?: boolean }> =>
      ipcRenderer.invoke(IpcChannels.System.SetSettings, next),
```

注意：`src/main/ipc/system.ts` 里的 setSettings handler 已经是 spread merge（`{ ...current, ...next }`），新字段自动透传，**不用改 handler**。

- [ ] **Step 4: 跑 typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿，无 error。

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add src/shared/types.ts src/main/settings.ts src/preload/index.ts
git commit -m "feat(sound): 扩展类型字段为提示音功能做准备"
```

---

## Task 2：新建跨平台播放模块 `src/main/sound.ts`

声音播放的核心。要求：跨平台 / 串行队列 / 超时兜底 / 不读 settings（让调用方判断）。

**Files:**
- Create: `src/main/sound.ts`

- [ ] **Step 1: 创建 `src/main/sound.ts`**

```ts
import { spawn } from 'node:child_process';
import { log as fileLog } from './logger';

/**
 * 跨平台播放系统提示音。
 *
 * 设计要点：
 * - **不读 settings**：是否播由调用方判断（保持模块单一职责）
 * - **串行队列**：同一刻多次调用时按顺序排队，声音不会重叠
 * - **超时兜底**：单次播放最长等 1500ms，避免子进程 hang 卡住整个队列
 * - **平台支持**：darwin 用 afplay 调 Glass.aiff；win32 用 PowerShell SoundPlayer；其它平台不播
 *
 * 用法：
 *   playNotification(3) // 排队播 3 次
 */

const MAC_SOUND_PATH = '/System/Library/Sounds/Glass.aiff';
const WIN_SOUND_PATH = 'C:\\Windows\\Media\\Windows Notify.wav';
const PLAY_TIMEOUT_MS = 1500;

let queue: Promise<void> = Promise.resolve();

function log(msg: string): void {
  fileLog(`[sound] ${msg}`);
}

function playOnce(): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };

    let child: ReturnType<typeof spawn> | null = null;
    try {
      if (process.platform === 'darwin') {
        child = spawn('afplay', [MAC_SOUND_PATH], { stdio: 'ignore' });
      } else if (process.platform === 'win32') {
        // PlaySync 会阻塞直到播放完，PowerShell 进程退出 = 声音放完
        const cmd = `(New-Object Media.SoundPlayer '${WIN_SOUND_PATH}').PlaySync()`;
        child = spawn('powershell', ['-NoProfile', '-c', cmd], { stdio: 'ignore' });
      } else {
        // 其它平台不播
        done();
        return;
      }
    } catch (err) {
      log(`spawn failed: ${err instanceof Error ? err.message : String(err)}`);
      done();
      return;
    }

    child.on('error', (err) => {
      log(`child error: ${err.message}`);
      done();
    });
    child.on('close', () => done());

    // 超时兜底：1.5s 还没退出就放弃等待
    setTimeout(done, PLAY_TIMEOUT_MS);
  });
}

/** 排队播放 N 次系统提示音。串行执行，互不重叠。 */
export function playNotification(times: number): void {
  if (!Number.isFinite(times) || times <= 0) return;
  for (let i = 0; i < times; i++) {
    queue = queue.then(playOnce);
  }
}
```

- [ ] **Step 2: 跑 typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿。

- [ ] **Step 3: 手测 sound 模块（在主进程跑一次确认能响）**

临时在 `src/main/index.ts` 的 `app.whenReady().then(...)` 回调最后一行加一行测试代码（**测完要删**）：

```ts
import { playNotification } from './sound';
// ...在 whenReady 回调最后：
setTimeout(() => playNotification(2), 3000); // App 启动 3 秒后响 2 下
```

跑：

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm dev
```

听 App 启动后 3 秒响 2 下 Glass 音，**不重叠**。听到后：
1. 关掉 `pnpm dev`
2. 删掉上面那行测试代码 + 删掉 import（**这步关键，不要把测试代码留下**）

- [ ] **Step 4: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add src/main/sound.ts
git commit -m "feat(sound): 新增跨平台系统提示音模块（串行队列 + 超时兜底）"
```

---

## Task 3：`idle-manager.ts` 区分 silent 触发并接入声音

把 silent 概念落到代码，让"启动追赶 / 睡眠唤醒重连"自动不响，IDLE 事件自动响。

**Files:**
- Modify: `src/main/imap/idle-manager.ts:65-79`（triggerSync 改造）
- Modify: `src/main/imap/idle-manager.ts:111-114`（exists handler）
- Modify: `src/main/imap/idle-manager.ts:123-124`（追赶同步调用）

- [ ] **Step 1: 加 import**

Edit `src/main/imap/idle-manager.ts`，在顶部 import 区（约第 8 行 logger import 之后）追加：

```ts
import { playNotification } from '../sound';
import { loadSettings } from '../settings';
```

- [ ] **Step 2: 改 `triggerSync` 函数签名和实现**

Edit `src/main/imap/idle-manager.ts`，第 65-79 行的 `triggerSync` 函数完全替换为：

```ts
function triggerSync(session: IdleSession, opts: { silent?: boolean } = {}): void {
  const silent = opts.silent ?? false;
  if (session.syncDebounceTimer) clearTimeout(session.syncDebounceTimer);
  session.syncDebounceTimer = setTimeout(async () => {
    session.syncDebounceTimer = null;
    broadcast({ email: session.email, phase: 'start', silent });
    const res = await syncAccount(session.email);
    if (res.status === 'ok') {
      broadcast({ email: session.email, phase: 'done', newCount: res.fetched, silent });
      // 仅在「非静默 + 真有新邮件 + 开关未关」时响
      if (!silent && res.fetched > 0) {
        const s = loadSettings();
        if (s.soundEnabled !== false) {
          playNotification(res.fetched);
        }
      }
    } else if (res.status === 'expired') {
      broadcast({ email: session.email, phase: 'expired', silent });
    } else {
      broadcast({ email: session.email, phase: 'error', error: res.error, silent });
    }
  }, SYNC_DEBOUNCE_MS);
}
```

- [ ] **Step 3: 改追赶同步调用点为 silent**

Edit `src/main/imap/idle-manager.ts`，找到 `openSession` 里第 124 行附近："连上后做一次追赶同步" 的注释下：

```ts
    // 连上后做一次追赶同步，捕获连接前的新邮件
    triggerSync(session);
```

改成：

```ts
    // 连上后做一次追赶同步，捕获连接前的新邮件——静默，不播提示音
    // （启动 / 睡眠唤醒后重连都走这里）
    triggerSync(session, { silent: true });
```

`client.on('exists')` 那条调用（约第 113 行 `triggerSync(session)`）**保持不变**，默认 silent=false。

- [ ] **Step 4: 跑 typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿。

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add src/main/imap/idle-manager.ts
git commit -m "feat(sound): IDLE 推送新邮件播提示音；追赶同步静默"
```

---

## Task 4：`store.ts` 加 `soundEnabled` 状态 + setter

renderer 端拿到开关状态。Toolbar 按钮要读它 + 写它。

**Files:**
- Modify: `src/renderer/src/store.ts`

- [ ] **Step 1: 在 `State` 接口里加字段和 action**

Edit `src/renderer/src/store.ts`，找到 `interface State { ... }`（第 23 行起）。在 `dialogMode: DialogMode;` 之后插入：

```ts
  /** 新邮件提示音开关（true=开，默认 true） */
  soundEnabled: boolean;
```

然后在 `closeDialog: () => void;` 之后追加 action 声明：

```ts
  toggleSound: () => Promise<void>;
```

完整片段示意（仅供对照，**不要全部替换**，只插入上面两段）：

```ts
  dialogMode: DialogMode;
  /** 新邮件提示音开关（true=开，默认 true） */
  soundEnabled: boolean;

  init: () => Promise<void>;
  // ...
  closeDialog: () => void;
  toggleSound: () => Promise<void>;
```

- [ ] **Step 2: 在 `useStore` 的初始 state 里加默认值**

Edit `src/renderer/src/store.ts`，找到 `export const useStore = create<State>((set, get) => ({` 后的初始 state 块（约第 65-74 行）。在 `dialogMode: null,` 之后插入：

```ts
  soundEnabled: true,
```

- [ ] **Step 3: 在 `init` 里读 settings 把开关恢复**

Edit `src/renderer/src/store.ts`，找到 `init: async () => { ... }`（约第 76-81 行），改成：

```ts
  init: async () => {
    const [accounts, settings] = await Promise.all([
      window.api.accounts.list(),
      window.api.system.getSettings(),
    ]);
    const first = accounts[0]?.email ?? null;
    set({
      accounts,
      status: 'ready',
      selectedEmail: first,
      soundEnabled: settings.soundEnabled !== false, // undefined 视为 true
    });
    if (first) await get().selectAccount(first);
  },
```

- [ ] **Step 4: 加 `toggleSound` action 实现**

Edit `src/renderer/src/store.ts`，在 `closeDialog: () => set({ dialogMode: null }),` 之后追加：

```ts
  toggleSound: async () => {
    const next = !get().soundEnabled;
    set({ soundEnabled: next });
    await window.api.system.setSettings({ soundEnabled: next });
  },
```

- [ ] **Step 5: 跑 typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿。

- [ ] **Step 6: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add src/renderer/src/store.ts
git commit -m "feat(sound): store 加 soundEnabled 状态 + toggleSound action"
```

---

## Task 5：Toolbar 加 Bell/BellOff 切换按钮

工具栏右侧加按钮。点击切换；图标随状态变。

**Files:**
- Modify: `src/renderer/src/components/layout/Toolbar.tsx`

- [ ] **Step 1: 修改 import**

Edit `src/renderer/src/components/layout/Toolbar.tsx`，第 3 行：

```ts
import { Loader2 } from 'lucide-react';
```

改成：

```ts
import { Bell, BellOff, Loader2 } from 'lucide-react';
```

- [ ] **Step 2: 在组件里取状态 + action**

Edit `src/renderer/src/components/layout/Toolbar.tsx`，第 9-10 行：

```ts
  const refreshingCount = useStore((s) => s.refreshingEmails.size);
  const accountsCount = useStore((s) => s.accounts.length);
```

之后追加两行：

```ts
  const soundEnabled = useStore((s) => s.soundEnabled);
  const toggleSound = useStore((s) => s.toggleSound);
```

- [ ] **Step 3: 在右侧栏（同步中徽章那块）加按钮**

Edit `src/renderer/src/components/layout/Toolbar.tsx`，右侧栏 div 现在是：

```tsx
      <div className="w-20 shrink-0 text-right">
        {refreshingCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10.5px] text-accent">
            <Loader2 size={11} className="animate-spin" />
            同步中
          </span>
        )}
      </div>
```

替换为：

```tsx
      <div
        className="flex w-20 shrink-0 items-center justify-end gap-2"
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
          onClick={() => void toggleSound()}
          title={soundEnabled ? '提示音已开（点击关闭）' : '提示音已关（点击开启）'}
          className="rounded p-1 text-muted transition hover:bg-black/5 hover:text-text"
        >
          {soundEnabled ? <Bell size={15} /> : <BellOff size={15} />}
        </button>
      </div>
```

说明：
- 工具栏整体是 `WebkitAppRegion: drag`（可拖动窗口），按钮区要 `no-drag` 否则点击会被吞掉
- title 提供 hover tooltip
- 用 muted 文本色保持工具栏视觉清淡

- [ ] **Step 4: 跑 typecheck**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm typecheck
```

Expected: 全绿。

- [ ] **Step 5: Commit**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git add src/renderer/src/components/layout/Toolbar.tsx
git commit -m "feat(sound): 工具栏加提示音开关按钮"
```

---

## Task 6：完整手测 + 收尾

最后跑一遍设计稿第 8 节的 7 项验证。

**Files:** 无改动，纯验证

- [ ] **Step 1: 启动 App**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm dev
```

- [ ] **Step 2: 验证 1 — 启动静默**

App 启动后等 10 秒（30 个账号陆续连 IDLE），观察：**没有任何声音**。
若听到声音 → 检查 `idle-manager.ts` 追赶同步那行是否传了 `{ silent: true }`。

- [ ] **Step 3: 验证 2 — 单封新邮件响 1 次**

给其中一个账号发一封测试邮件，等 Gmail 推送（5-60 秒）。
Expected: 听到 1 次 Glass 提示音，App 中栏自动出现新邮件。

- [ ] **Step 4: 验证 3 — 多封串行不重叠**

短时间内连发 3 封测试邮件（同账号或不同账号都行）。
Expected: 听到 3 次 Glass 提示音，**按顺序连续不重叠**（每次约 0.5s）。

- [ ] **Step 5: 验证 4 — 总开关关闭**

工具栏点击喇叭按钮（Bell → BellOff）。再发一封测试邮件。
Expected: **不响**。然后退出 App 重启，喇叭仍然是关闭状态（BellOff）。再点开关回开（Bell），再发一封测试邮件 → **响 1 次**。

- [ ] **Step 6: 验证 5 — 睡眠唤醒静默**

合上 Mac 屏盖（或 `pmset sleepnow`），睡眠至少 30 秒后唤醒。
- 在睡眠期间安排一封邮件发到某账号（可让朋友发，或定时邮件）
Expected: 唤醒后 App 重连 IMAP，拉到那封邮件，UI 显示新邮件，**但不响**（reconnect 走的是 openSession → silent=true 路径）。

- [ ] **Step 7: 验证 6 — 加账号静默**

添加一个**新的、有未读邮件**的 Gmail 账号到 App。
Expected: 该账号一次拉进来 ≤20 封邮件，**不响**（accounts.add 路径不经 triggerSync）。

- [ ] **Step 8: 验证 7 — `pnpm build`**

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
pnpm build
```

Expected: 全绿，无 error。

- [ ] **Step 9: 验证 8 —（可选）Windows**

如果有 Windows 测试机，重复验证 1-5。否则跳过这步——后续打包时再测。

- [ ] **Step 10: Final commit（如有任何手测发现的微调）**

如果验证中发现问题需要修，修完后：

```bash
cd /Users/mac/Desktop/Code/google-mail-manage
git status
git add <修改的文件>
git commit -m "fix(sound): <具体修了什么>"
```

如无问题，本任务**不需要额外 commit**。

---

## 自审备注（来自 plan 撰写时）

**Spec coverage check** — 设计稿 8 节验证标准全部映射到 Task 6 的 Step 2-9，无遗漏。

**Placeholder scan** — 已审：所有代码块都是可直接复制的完整代码，没有 TBD / TODO / "适当处理错误"等占位符。

**Type consistency check**：
- `RefreshEvent.silent` 在 Task 1 定义，在 Task 3 的 `broadcast` 调用中使用 ✓
- `AppSettings.soundEnabled` 在 Task 1 定义，在 Task 3 (`loadSettings().soundEnabled`)、Task 4（preload getSettings/setSettings）、Task 5（间接） 中使用 ✓
- `playNotification(times: number): void` 在 Task 2 定义，在 Task 3 调用形如 `playNotification(res.fetched)` ✓
- `toggleSound: () => Promise<void>` 在 Task 4 定义，在 Task 5 调用 `void toggleSound()` ✓
- `soundEnabled: boolean` store 字段在 Task 4 定义，在 Task 5 `useStore((s) => s.soundEnabled)` 读取 ✓

**YAGNI 边界** — 仅做总开关；静音时段、按账号开关、声音选择、音量调节、声音预览均按 spec 第 9 节明确不做。
