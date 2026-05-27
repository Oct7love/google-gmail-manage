# 新邮件提示音 — 设计稿

> 状态：待用户审核 → 通过后进入实现 plan
> 日期：2026-05-27

## 1. 用户需求（原话还原）

> "我现在这个好像有邮件的时候是没有声音提醒的 能做一个声音提醒吗？类似微信来消息那样子？"

经过澄清后明确：

- 触发场景：**永远响**（不管 App 是不是前台）
- 频率：**每封新邮件都响一次**（像微信式逐条提示）
- 音色：**macOS 系统内置提示音**（Glass.aiff），Windows 用本机系统等价音
- 开关：**顶部工具栏一个小喇叭图标**，一点切换；默认开启
- 边界 1：**App 启动时**的首批同步**不响**
- 边界 2：**电脑睡眠唤醒后**重连拉到的"漏推邮件"**不响**（与启动同处理）
- 边界 3：**新添加账号**的首批 20 封**不响**
- 边界 4：**1 小时兜底轮询**拉到的邮件——按现有代码路径**天然不响**（不走声音触发点）

## 2. 核心原则与约束

- **不引入新依赖**：用 Node 内置 `child_process.spawn` 调系统命令
- **不打包音频文件**：直接读系统已有的 `.aiff` / `.wav`，App 体积不增加
- **不触发任何反封控红线**：CLAUDE.md 已明确"不要悄悄重试"等约束，本功能纯本地播放，不影响 IMAP 流量
- **跨平台**：Mac 主用，Windows 也要能跑（CLAUDE.md 约束）
- **范围纪律**：只动声音相关代码 + 工具栏一个按钮 + settings 一个字段。不顺手优化其它东西。

## 3. 触发链路（数据流）

```
Gmail 服务器
   │
   ▼ EXISTS 推送（IMAP IDLE 协议）
imapflow client.on('exists')
   │
   ▼ 1.5s 防抖合并
triggerSync(session, { silent: false })
   │
   ▼ 调 syncAccount → 返回 newCount
syncAccount 返回 { fetched: newCount }
   │
   ▼ broadcast { phase: 'done', newCount, silent: false }
   │
   ├─→ renderer：更新未读数 UI（已有逻辑）
   │
   └─→ 主进程内部：
        if (!silent && newCount > 0 && settings.soundEnabled)
            playNotification(newCount)
```

**静默路径**（不响）：

- `openSession` 成功后的追赶同步 → `triggerSync(session, { silent: true })`
- 睡眠唤醒后 `reconnectAll` 重连 → 走同一条 `openSession`，自动静默
- `ipc/accounts.ts` 加账号后调用 `syncAccount` → 不经 idle-manager.triggerSync，**天然不响**
- `scheduler/auto-refresh.ts` 1h 兜底 → 同上，**天然不响**
- `ipc/messages.ts` 用户主动刷新 → 同上，**天然不响**

**响的路径**（唯一）：

- `client.on('exists')` 事件，由 IMAP IDLE 推送触发

## 4. 模块设计

### 4.1 `src/main/sound.ts`（新建）

职责：跨平台播放系统提示音 + 串行队列防重叠。

接口：

```ts
/** 播放 N 次提示音，串行排队，不会重叠。 */
export function playNotification(times: number): void;
```

实现要点：

- 维持一个 module-scope 的 `Promise` 队列（`let queue = Promise.resolve()`）
- 每次调用把 N 个 `playOnce` 追加到 queue
- `playOnce` 用 `spawn` 调系统命令，监听 `close` 事件 resolve
- **安全网**：1.5s 超时强制 resolve，避免 spawn hang 卡住整个队列
- 平台分支：
  - `darwin` → `spawn('afplay', ['/System/Library/Sounds/Glass.aiff'])`
  - `win32` → `spawn('powershell', ['-NoProfile', '-c', "(New-Object Media.SoundPlayer 'C:\\Windows\\Media\\Windows Notify.wav').PlaySync()"])`
  - 其它（linux 等） → 不播（return）
- **不读 settings**：开关检查由调用方做，sound.ts 只管"被调就播"

### 4.2 `src/main/settings.ts`（修改）

`AppSettings` 加一个字段：

```ts
export interface AppSettings {
  webviewProxy?: string;
  /** 新邮件提示音总开关。默认 true（首次未设置时）。 */
  soundEnabled?: boolean;
}
```

读取时如果是 `undefined`，业务侧按 `true` 处理。

### 4.3 `src/main/imap/idle-manager.ts`（修改）

改动点：

1. `triggerSync` 函数签名加一个可选参数：

   ```ts
   function triggerSync(session: IdleSession, opts: { silent?: boolean } = {}): void
   ```

2. 调用点区分：
   - `openSession` 第 124 行的追赶同步：`triggerSync(session, { silent: true })`
   - `client.on('exists')` 第 113 行：`triggerSync(session)`（默认 silent=false）

3. `triggerSync` 内部 syncAccount 成功后：

   ```ts
   if (res.status === 'ok') {
     broadcast({ email: session.email, phase: 'done', newCount: res.fetched, silent: opts.silent ?? false });
     if (!opts.silent && res.fetched > 0) {
       const s = loadSettings();
       if (s.soundEnabled !== false) {
         playNotification(res.fetched);
       }
     }
   }
   ```

4. broadcast 的类型定义（shared/types.ts 或 ipc-channels.ts）补 `silent?: boolean` 字段，renderer 端不强制使用。

### 4.4 `src/renderer/src/components/layout/Toolbar.tsx`（修改）

- 引入 lucide `Bell` / `BellOff` 图标
- 加一个 IconButton：点击调用 `window.api.system.setSettings({ soundEnabled: !current })`
- 当前状态进 zustand store（项目已用 zustand），新增字段 `soundEnabled: boolean`；App 启动时主进程把当前 settings 推给 renderer 初始化 store
- 图标 + tooltip 显示当前状态：开 → Bell + "提示音已开（点击关）"；关 → BellOff + "提示音已关（点击开）"

### 4.5 IPC（无新增）

复用现有 `window.api.system.getSettings()` / `setSettings()`。

## 5. 平台兼容性

| 平台 | 实现 | 备注 |
|---|---|---|
| macOS | `afplay /System/Library/Sounds/Glass.aiff` | Glass 是 macOS 默认通知音，存在性极稳定 |
| Windows | `powershell -c "(New-Object Media.SoundPlayer '...').PlaySync()"` | Windows Notify.wav 在 Win10+ 默认存在 |
| Linux | 不播 | 当前 PRD 没有 Linux 目标 |

如果文件意外缺失：`spawn` 会失败但被 try/catch + 队列超时网兜住，不会崩 App。

## 6. 边界与失败模式

| 场景 | 行为 |
|---|---|
| App 启动，每个账号建 IDLE 连接 | 追赶同步用 silent=true，不响 |
| 睡眠唤醒 → reconnectAll | 同上路径，不响 |
| 新加账号 | IPC 路径调 syncAccount，不经 triggerSync，天然不响 |
| 1h 兜底轮询 | auto-refresh 直接调 syncAccount，天然不响 |
| 用户点 UI 同步按钮 | 同上，天然不响 |
| IDLE 推送 30 个账号同时来邮件（共计 50 封） | 队列串行播 50 次，每次约 0.5s（Glass.aiff 时长），约 25s 内排队播完 |
| 一次 newCount 巨大（异常情况，比如 newCount=200） | **不做特殊截断**——按需求"每封都响"。如果未来发现真的吵，加 `Math.min(times, MAX)` 截断兜底 |
| afplay / powershell 进程 hang | 1.5s 超时强制 resolve 队列，下一条继续 |
| 用户在工具栏关掉开关 | 立即生效（下一次 broadcast 时 loadSettings 重读） |

## 7. 改动文件清单

| 文件 | 改动类型 |
|---|---|
| `src/main/sound.ts` | 新建 |
| `src/main/settings.ts` | 加 1 个字段 |
| `src/main/imap/idle-manager.ts` | `triggerSync` 加参数；exists 事件 / 追赶同步 调用点区分；done 分支加 playNotification |
| `src/shared/types.ts` 或 `ipc-channels.ts` | broadcast payload 类型加 silent 字段 |
| `src/renderer/src/components/layout/Toolbar.tsx` | 加 Bell / BellOff 按钮 |
| `src/renderer/src/store.ts` | zustand store 加 `soundEnabled: boolean` 字段 + setter |

**不动**：CLAUDE.md / sync.ts / fetch-messages.ts / accounts-repo.ts。

## 8. 验证标准

实现完成后必须人工验证：

1. App 启动，30 个账号同时拉同步，**没有声音**
2. App 运行中，给其中一个账号发一封测试邮件，**响 1 次**
3. 同一时间窗连发 3 封，**响 3 次，不重叠**
4. 工具栏点喇叭关闭，再发一封，**不响**；重启 App，喇叭仍是关闭状态
5. 电脑睡眠 30 秒后唤醒，App 重连拉到睡眠期间收到的邮件，**没有声音**
6. 新加一个账号，初次拉 20 封进来，**没有声音**
7. `pnpm typecheck` 全绿
8. （如有 Windows 测试机）Windows 上跑一遍 1–5 项

## 9. 不做（YAGNI）

- 不做静音时段（22:00-8:00 那种）
- 不做按账号开关（仅总开关）
- 不做声音选择菜单（固定 Glass）
- 不做音量调节（跟随系统音量）
- 不做声音预览试听
- 不做"未读数动画"等视觉反馈（用户没要）
