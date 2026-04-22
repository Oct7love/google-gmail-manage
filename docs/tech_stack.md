# 技术栈（Tech Stack）

> 每个选型都带"**为什么选它 / 为什么不选别的**"。
> 将来有人（或下一个 Claude）想换技术栈，先来这里看理由再动。

---

## 总览

| 层 | 选型 | 版本建议 |
|---|---|---|
| 桌面框架 | **Electron** | 最新 stable |
| UI 库 | **React + TypeScript** | React 18+ / TS 5+ |
| 构建工具 | **Vite** + **electron-vite** | 最新 stable |
| 样式 | **Tailwind CSS** | 最新 stable |
| 组件库（可选） | **shadcn/ui** 的少量组件 | 按需复制 |
| 状态管理 | **Zustand** | 最新 stable |
| 本地数据库 | **better-sqlite3** | 最新 stable |
| Google API 客户端 | **googleapis** | 官方 Node SDK |
| 钥匙串访问 | **keytar** 或 Electron 内建 `safeStorage` | 择一 |
| 打包 | **electron-builder** | 最新 stable |
| 代码质量 | **ESLint + Prettier** | 最新 stable |
| 包管理 | **pnpm** | 最新 stable |

---

## 桌面框架：Electron

### 为什么选 Electron

1. **Claude 最熟** — Electron 相关训练数据最多，出 bug 后 Claude 能快速定位修复
2. **Mac 打包最熟** — `electron-builder` 几行配置就能出 `.app` 和 `.dmg`
3. **Node 生态** — Google 官方 `googleapis` 是 Node 包，在 Electron 主进程里直接用，零适配
4. **成熟稳定** — VS Code、Slack、Discord 都是 Electron，企业级验证过
5. **用户是非开发者** — 体积大一点（~150MB）不是问题，换来的是**迭代速度**和**不踩坑**

### 为什么不选 Tauri

- 后端 Rust，Claude 改起来速度下降 2–3 倍
- 体积小的优势（~10MB）对本项目不关键
- `tauri-plugin-oauth` 等周边生态不如 Electron 成熟
- OAuth loopback server 在 Rust 里写要多动脑

### 为什么不选原生 SwiftUI

- 只能 Mac（用户目前确实只要 Mac，但 Electron 顺便也能跨平台是额外福利）
- 要 Xcode，Claude 在 Xcode 项目里的迭代体验远差于 Node
- 原生 API 调 Gmail 要自己写网络层，而 `googleapis` 在 Node 上已经全部包好

### 为什么不是纯 Web（PWA）

- PWA 无法访问 Keychain
- PWA 要托管在某个域名下，增加维护面
- 用户要求是"一打开就能用"的桌面形态，不是浏览器标签

---

## UI 技术：React + TypeScript

### 为什么 React

- Claude 对 React 的掌握最熟练，生成代码 bug 率最低
- 组件化适合三栏布局 + 列表渲染
- 配合 Vite HMR，改 UI 几乎实时

### 为什么 TypeScript（而不是 JS）

- 本项目涉及 OAuth token、Gmail API 响应、IPC 消息，**数据结构多**
- TS 类型能让 Claude 写代码时少出"字段名打错"之类的低级错误
- 非开发用户将来如果找人帮忙改，有类型比没类型友好得多

### 为什么不选 Vue / Svelte

- 都是好框架，但 Claude 写 React 的准确率和生态成熟度目前仍是最高

---

## 构建工具：Vite + electron-vite

- Vite 的冷启动和 HMR 速度远超 webpack
- `electron-vite` 是 Electron + Vite 的官方整合，三个进程（main / preload / renderer）分别打包
- 不需要自己写 webpack config

---

## 样式：Tailwind CSS（+ shadcn/ui 按需）

### 为什么 Tailwind

- 写 class 即样式，Claude 改界面无需在 CSS 文件间来回跳
- 零运行时、打包时静态提取
- 黑暗模式只加 `dark:` 前缀

### 为什么不选 Material UI / Ant Design / Chakra

- 本项目界面非常少（3 栏 + 几个按钮 + OAuth 引导页），用不上庞大组件库
- 第三方 UI 库会让 App 看起来"不像 Mac 原生"，不如自己按 Mac HIG 写

### 为什么提到 shadcn/ui

- `shadcn/ui` 不是组件库，是"可复制粘贴的组件源码"。用 Tailwind 风格
- 需要对话框、菜单、Toast 之类的标准组件时，按需复制几个文件进项目
- 不引入运行时依赖

---

## 状态管理：Zustand

### 为什么 Zustand

- 本项目的全局状态很少：**账号列表**、**当前选中账号**、**当前选中邮件**、**刷新状态**
- Zustand 写法最简单：一个 `create(fn)` 就定义了 store，React 里 `useStore` 直接取
- 无 provider 包裹、无 reducer 样板代码

### 为什么不选 Redux / Jotai / Context

- Redux 对本项目量级完全过度
- Jotai 适合"细粒度原子状态"，本项目用不上
- React Context 做全局 store 会导致不必要的重渲染

---

## 本地数据库：better-sqlite3

### 为什么 better-sqlite3（而不是 sqlite3 / knex / prisma）

- **同步 API**：不需要每个查询 `await`，代码简洁
- 性能最好（C++ 原生绑定）
- 本项目量级（30 账号 × 10 邮件 = 300 行）完全够
- 不需要 ORM 的复杂度，写几条 SQL 就够

### 数据规模估算

| 表 | 行数 | 大小 |
|---|---|---|
| accounts | ~30 | < 10KB |
| messages | ~300（30×10） | ~3MB（HTML 正文为主） |

远低于性能担忧阈值。

---

## Google API 客户端：googleapis

### 为什么用官方 `googleapis` 而不是自己拼 HTTP

- 官方维护，API 变更自动跟进
- 内置 OAuth2 客户端：token 刷新、签名、loopback 流程都封装好
- User-Agent 是 Google 官方客户端标识，**不容易被识别为异常调用**（对"反封控"目标很关键）
- TypeScript 类型完整

---

## 凭据存储：Keychain

### 选 `keytar` 还是 Electron 的 `safeStorage`

两个都可以，选一个即可：

**选 `keytar`**（推荐）：
- 明确调用 macOS Keychain，和系统"钥匙串访问"App 里能看到的条目一致
- 跨平台（Windows Credential Manager、Linux libsecret），虽然本项目只上 Mac
- 缺点：需要原生模块编译，Electron 打包要处理好

**选 `safeStorage`**：
- Electron 内置，无原生模块依赖
- 存的是加密字符串，不是系统级密钥管理
- 加密 key 来自系统 Keychain，但外部工具看不到条目

**结论**：本项目建议 **`keytar`**，让用户在"钥匙串访问"里能看到、能手动删，更透明。

---

## 打包：electron-builder

- 出 `.dmg`（带拖拽到 Applications 的引导）和 `.app`
- 自动处理图标、`Info.plist`、代码签名（我们暂时**不做签名**，用户首次打开要右键）
- 未来要做签名需要 Apple Developer 账号（99 美元/年）

---

## 包管理：pnpm

- 比 npm 快，硬链接节约磁盘
- Monorepo（如果将来拆成 electron/renderer 子包）支持最好

---

## 不用的东西（明确列出）

| 不用 | 理由 |
|---|---|
| Redux / Redux Toolkit | 小项目，Zustand 够 |
| GraphQL | Gmail API 是 REST，没必要包一层 |
| React Query / SWR | 本地 SQLite 直接读，没有远程数据"缓存失效"问题 |
| Web framework（Next / Remix） | 是桌面 App 不是网站 |
| Docker | Electron App 装本地，不需要容器 |
| 任何爬虫库（puppeteer / playwright） | **明令禁止**，只走官方 API |
| 任何非官方 Gmail 库 | 同上 |

---

## 升级策略

- Electron 跟主版本升级，至少每 6 个月一次（安全补丁）
- 其它依赖 `pnpm outdated` + 读 changelog 决定
- 不追"最新最热"，稳定优先
