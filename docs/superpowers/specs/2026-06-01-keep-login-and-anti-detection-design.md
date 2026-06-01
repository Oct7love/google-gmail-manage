# 设计文档：添加账号保持登录 + 一键清空 + 降风控

> 日期：2026-06-01
> 状态：已与用户确认，待实现

---

## 1. 背景与问题

添加 Gmail 账号的对话框右侧是一个内嵌 webview（持久分区 `persist:google-apppasswords`），
用户在里面登录"要添加的那个 Google 账号"，生成 16 位应用专用密码，回到左侧粘贴提交。

当前存在两个体验问题和一个安全顾虑：

1. **添加成功后会自动登出**：`AddAccountDialog.tsx` 的 `onSubmit` 成功后调用了
   `logoutWebview()`，把右侧 webview 导航到 Google 登出页。结果是每加一个账号，
   右侧就掉登录，想连续加好几个账号要反复重登，很烦。
2. **没有"用完即清"的入口**：用户用完这个内嵌浏览器后，希望能一键退出右侧所有
   已登录的 Google 账号、并清掉本地登录缓存，保持干净。
3. **webview 容易触发 Google 风控**：内嵌 webview 默认 UA 里带 `Electron` 字样，
   等于明示"我是嵌入式应用而非真实浏览器"，Google 对这类登录有专门拦截
   （"此浏览器或应用可能不安全 / 无法登录"）。

## 2. 目标

- 添加账号成功后**保持右侧 Google 登录态**，可连续添加多个账号。
- 新增**「退出所有账号并清空登录」**功能：清空内嵌浏览器的全部 Google 登录与缓存。
- 降低 webview 触发 Google 风控的概率（**仅做 UA 伪装这一项低成本高收益的措施**）。

## 3. 明确不做（范围边界）

- **不动左栏已添加的邮箱**：本次"清空"只针对右侧内嵌浏览器的 Google 登录会话，
  不删除任何已添加的邮箱账号，也不动它们存在 Keychain 里的应用密码 / Google 密码 /
  2FA 等凭据。
- **不做无痕浏览器方向**。已与用户达成共识：无痕（每次清空、每次重登）和"保持登录
  连续加号"的目标直接冲突；而且一台设备用全新无干净会话连续登录多个陌生账号，
  反而更像批量薅号，对风控不利，并非更安全。
- **不在本次强推"改用系统浏览器登录"**。系统浏览器确实最不易被风控，但体验割裂
  （要在外部登录、复制、回 App 粘贴）。这条留作以后可选，本次不做。
- IP / 登录频率属于行为层面（别短时间猛切几十个号），不在本次代码改动范围内。

## 4. 方案设计

### 改动 1 · 添加成功后不再自动登出

- 删除 `AddAccountDialog.tsx` `onSubmit` 成功分支里的 `logoutWebview()` 调用。
- webview 用的是持久分区，登录态本来就会保留；删掉这行后，添加成功仍然清空左侧
  表单、显示"已添加 xxx，可继续下一个"，右侧保持登录。
- 用户继续加下一个账号：在 webview 里用 Google 自带的头像 →「添加账号」登录下一个，
  或切到已登录的另一个账号生成应用密码。全过程登录态都在。
- `logoutWebview()` 函数本身保留（改动 2 会复用其语义的强化版）。

### 改动 2 · 「退出所有账号并清空登录」按钮

- **位置**：复用 webview 工具栏现有的那个 `LogOut` 图标按钮（现标题"登出侧边
  Google"，当前只是软导航到 Google 登出页、cookie 仍留在本地）。升级为真正的
  "退出全部 + 清空缓存"。
- **二次确认**：点击后按钮就地变成"确定清空？/ 取消"两步确认（**不弹浏览器原生
  confirm**，与现有 UI 风格一致，避免误触）。
- **行为**：确认后调用新 IPC，把整个 `persist:google-apppasswords` 分区的
  cookie / localStorage / 缓存清空，然后 reload webview 回到干净登录页。
- **文案**：确认态提示明确告知"只清右侧 Google 登录，不影响已添加的邮箱"。

### 改动 3 · Chrome User-Agent 伪装（降风控）

- 给 webview 元素加 `useragent` 属性。
- **取值方式**：直接读当前 `navigator.userAgent`（Electron 的 UA 本身就含真实操作
  系统与 Chromium 版本），用正则去掉 ` Electron/x.x.x` 段和应用名那段，剩下即一个
  **匹配真实系统、Chromium 版本永不过期**的干净 Chrome UA。比硬编码一个会过期的
  UA 字符串更稳，且自动跨 Mac / Windows 正确。
- 正则示意：
  ```
  navigator.userAgent
    .replace(/ Electron\/[\d.]+/i, '')                 // 去掉 Electron 段
    .replace(/(like Gecko\) )\S+ (Chrome\/)/i, '$1$2') // 去掉 Chrome 前的应用名段
  ```

## 5. 技术落点

| 文件 | 改动 |
|---|---|
| `src/shared/constants.ts` | 新增 `GOOGLE_WEBVIEW_PARTITION = 'persist:google-apppasswords'`，主进程与渲染端共用，避免分区名两处写串。 |
| `src/shared/ipc-channels.ts` | `System` 下新增 `ClearWebviewSession`。 |
| `src/main/ipc/system.ts` | 新增 handler：`session.fromPartition(分区).clearStorageData()` + `clearCache()`。 |
| `src/preload/index.ts` | `system` 下暴露 `clearWebviewSession()`。 |
| `src/renderer/.../accounts/AddAccountDialog.tsx` | ① 删 `onSubmit` 里的 `logoutWebview()`；② LogOut 按钮改两步确认 + 调 `clearWebviewSession` + reload；③ WebView 加 `useragent`；④ partition 改用共享常量。 |

## 6. 验证

- `pnpm typecheck && pnpm build` 通过。
- 主进程改了 IPC，验证时需重启 App（kill + `pnpm dev`）。
- 手动验证：
  1. 添加一个账号成功后，右侧 webview **仍保持登录**（不再跳登出页）。
  2. 点 LogOut → 两步确认 → 右侧 Google 全部登出、回到干净登录页；左栏邮箱列表
     **不受影响**。
  3. webview 内打开任意页面，确认 UA 不再含 `Electron` 字样（可在 Google 登录流程
     里观察是否还弹"浏览器不安全"）。
