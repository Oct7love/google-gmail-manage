# 前端优化建议清单（多 agent 审计 + 对抗校验产出）

> 生成方式：7 区域并行评审 → 逐条对抗校验硬约束 → 综合去重排序。原始 46 条，校验通过 44，去重后 33 条。
> 全部建议均已校验：不写死 hex、不引框架、不加功能、不动后端，仅前端 Tailwind 语义 token 级改动。

---

共 38 条建议，去重合并后实际为 33 条；其中高 16、中 14、低 3。最该先做的 3 条：StatusBadge 选中态描边错配（每刻可见的选中行脏色环，跨三主题）、健康账号绿点从不渲染（直接决定 30+ 账号巡检效率的逻辑缺失）、全局结构分隔线 border-border 几乎不可见（三栏骨架糊成一团）。

---

## 左栏 · 账号项 (AccountItem.tsx)

- **【组件/区域】**：AccountItem.tsx StatusBadge 选中态描边
- **【问题】**：状态圆点用 `border-2 border-sidebar` 抠间隙，该值按未选中行 `bg-sidebar` 底色定；但选中行容器是 `bg-surface`（三主题均纯白），导致选中那一行状态点外圈描边色（sidebar 深米黄/冷灰/深灰）与脚下白底对不上，出现一圈脏色环——恰是用户最常盯着的当前账号，任意时刻都有一行选中、长期可见。
- **【建议】**：让描边色跟随所在行底色。StatusBadge 接收 `isSelected` 并切换：选中时 `border-surface`、未选中时 `border-sidebar`，即 `border-2 ${selected ? 'border-surface' : 'border-sidebar'} ${color}`，第 60 行调用处传 `selected={isSelected}`。刷新态那枚圆点的写死 `bg-white` 同步改为 `bg-surface`，`ring-1 ring-border` 保留。
- **【优先级】**：高 - 每刻存在的"当前选中账号"行的一眼可见瑕疵，跨三套主题都错。

- **【组件/区域】**：AccountItem.tsx StatusBadge 健康账号状态点
- **【问题】**：`if (!expired && !error && !refreshing) return null` 使 `lastSyncStatus==='ok'` 的健康账号头像上不显示任何点，`let color='bg-success'` 是死代码永不触达。结果正常账号一片空白，只有出问题的才有点，用户无法把"已成功同步的绿点账号"和"还没同步/状态未知(null)"区分开。account.lastSyncStatus 已是现成只读字段，只补视觉不新增数据。
- **【建议】**：StatusBadge 签名加 `ok: boolean`，第 60 行传 `ok={account.lastSyncStatus === 'ok'}`；早退条件改 `if (!expired && !error && !refreshing && !ok) return null`；颜色与尺寸同时分支：ok→`bg-success h-2 w-2`（绿、略小不抢眼）、expired→`bg-warning h-2.5 w-2.5`、error→`bg-danger h-2.5 w-2.5`，把第 140 行写死的 `h-2.5 w-2.5` 换成 `${size}`。
- **【优先级】**：高 - 直接决定 30+ 账号巡检"一眼扫出哪些是绿了的好账号"的核心日常动作，当前是逻辑性缺失。

- **【组件/区域】**：AccountItem.tsx 新邮件计数徽章 +N（第 74 行）
- **【问题】**：白字 `text-white` 压在 `bg-warning`（#ff9500 橙）上对比度仅约 2.2（warning 跨主题固定），10px 小字在浅底里发飘；且 `bg-warning` 与"应用密码失效"warning 橙点同色撞语义，外加常驻 `animate-pulse` 呼吸闪烁，多账号同时来信时一排橙色脉动既扰眼又有歧义，违背"不要花哨动效、克制"基调。+N 是"App 内未读数"的核心视觉落点。
- **【建议】**：去掉 `animate-pulse`（消除持续动效）；底色 `bg-warning`→`bg-accent`、文字保持 `text-white`，让新邮件计数用强调色而非与告警橙同色（accent 三主题为靛蓝/系统蓝/黑，均与橙状态点区分明显，且白字压 accent 对比足够）；`shadow-card` 保留做微浮起。
- **【优先级】**：高 - 关键未读信号既对比不足又与告警同色歧义、还持续脉动，是观感与可辨识双重问题，性价比最高。

- **【组件/区域】**：AccountItem.tsx "移除账号"菜单项 hover（第 106 行）
- **【问题】**：hover 背景写死 `hover:bg-[#fff4f3]`，违反硬约束 4（禁写死 hex）；该浅粉只在 cream 下勉强协调，slate/onyx 冷调主题里是一抹突兀暖粉。
- **【建议】**：`hover:bg-[#fff4f3]`→`hover:bg-surface-2`，与同菜单"更新应用密码"（第 98 行）、行触发按钮（第 84 行）的 hover 写法统一，跨三主题随 `--c-surface-2` 走；危险语义由 `text-danger` 前景承担已足够。
- **【优先级】**：高 - 违反硬约束 4 即作废，且跨主题观感确有问题。

- **【组件/区域】**：AccountItem.tsx 写死 bg-white（StatusBadge 刷新角标底）
- **【问题】**：刷新态角标底写死 `bg-white` 而非语义 `bg-surface`，违反硬约束 4。三主题 surface 当前恰为 #ffffff、视觉暂时一致，但将来微调某主题 surface 即脱节，且与同文件其它 `bg-surface` 用法不统一。
- **【建议】**：StatusBadge 角标底 `bg-white`→`bg-surface`，保持 `ring-1 ring-border` 不变。纯 token 归一、零视觉变化。
- **【优先级】**：中 - 当前不影响观感，但违反禁写死颜色、削弱主题可控性，本组件修复点少风险低。

- **【组件/区域】**：AccountItem.tsx 行容器内边距（第 48 行）
- **【问题】**：行容器 `pl-2 pr-1` 左右不对称（左 8px/右 4px），30 个账号竖排时右缘留白不齐；`pr-1` 也让 hover 出现的更多按钮过于贴边。
- **【建议】**：仅把 `pl-2 pr-1` 改为 `px-2`（改后 `group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors`），左右留白一致、整列右缘扫读更齐。不要动第 84 行更多按钮的 `opacity-0 ... group-hover:opacity-100`（h-6 w-6 常驻占位，opacity 切换不改布局尺寸，优于改 text-transparent）。
- **【优先级】**：中 - 影响整列右缘扫读整齐度，长列表抖动累积成廉价感，但非阻塞。

- **【组件/区域】**：AccountItem.tsx 用户名/域名文本块（第 70 行）
- **【问题】**：用户名 `text-[13px]`、域名 `text-[11px] text-muted`，两行 leading 几乎无呼吸。批量来源账号常是长用户名+长域名两行都 truncate，30 行密排时下半行糊成一片，干扰 username 主信息扫读。
- **【建议】**：仅做空间分层不动颜色——域名 div `text-[11px] text-muted`→新增 `mt-px`（1px 行间呼吸，紧凑不增占高）。域名颜色继续用 `text-muted`，不要改 `text-muted-2`（更浅会进一步降低 sidebar 上对比）。
- **【优先级】**：中 - 两行密排可读性关系长邮箱扫读，但当前并非不可读，属打磨级。

- **【组件/区域】**：AccountItem.tsx + MessageRow.tsx 字号归一到语义 scale
- **【问题】**：config 已定义 xs=11/sm=12.5/base=13.5 紧凑字阶，但全仓充斥 `text-[13px]`/`text-[12px]`/`text-[11px]`/`text-[10px]` 任意值（grep 命中 50+ 处），字号体系实际碎成 7~8 档而非设计的 5 档，跨组件节奏不统一。
- **【建议】**：本区域两组件先对齐——MessageRow 日期/snippet `text-[12px]`→`text-sm`；AccountItem 用户名 `text-[13px]`→`text-base`、`@domain` `text-[11px]`→`text-xs`、+N 徽章 `text-[10px]`→`text-xs`（消灭 10px 孤值）。其余文件后续同法收敛。
- **【优先级】**：中 - 字阶碎档影响整屏紧凑一致观感，账号项与邮件行频率最高、优先对齐收益最大。

---

## 左栏 · 列表容器 (LeftColumn.tsx)

- **【组件/区域】**：LeftColumn.tsx 列表竖向节奏（`<ul>`）
- **【问题】**：列表用 `space-y-0.5`（2px）行距、每行 `py-1.5`、28px 头像，单行约 40px。30+ 账号密排时行几乎贴合，选中行 `shadow-card ring-1` pill 与上下相邻行边缘几乎相碰，圆角浮起感被压没，整列偏"表格化"而非 macOS 有呼吸的侧栏列表。
- **【建议】**：`space-y-0.5`→`space-y-1`（2px→4px），给选中 pill 上下留阴影/ring 呼吸位，30 个账号仍能一屏放下（每行仅多 2px）。容器 `px-2 py-1` 的 py 保持。
- **【优先级】**：低 - 影响整列质感与选中 pill 浮起，属审美打磨，与"一屏装更多"有轻微取舍。

- **【组件/区域】**：LeftColumn.tsx "账号"分组标题（第 15 行）
- **【问题】**：分组标题 `text-muted` 压在 `bg-sidebar` 上，cream 4.09 / slate 3.83，11px 小字+uppercase tracking 本就细，slate 下 3.83 偏弱；它是左栏唯一分区标签、承担定位锚点。且对中文 `uppercase` 无效。
- **【建议】**：`text-[11px] font-semibold uppercase tracking-wider text-muted`→`text-[11px] font-semibold tracking-wider text-text-2`（升对比、删对中文无效的 uppercase）。保留 `text-[11px]`（不改 text-xs，避免放大）、保留 `tracking-wider`。不动第 22 行刷新按钮。
- **【优先级】**：低 - 结构锚点清晰度优化影响小于 snippet/徽章，但顺带修掉无意义 uppercase，低成本一致性打磨。

- **【组件/区域】**：LeftColumn.tsx EmptyState 图标容器写死 bg-white
- **【问题】**：EmptyState 图标容器写死 `bg-white` 而非 `bg-surface`，违反硬约束 4，与同体系 token 用法不统一。
- **【建议】**：`bg-white`→`bg-surface`，保持 `ring-1 ring-border` 不变。纯 token 归一、零视觉变化。
- **【优先级】**：中 - 同 AccountItem 写死白，恢复主题可控性。

---

## 中栏 · 邮件列表 (MiddleColumn.tsx / MessageRow.tsx)

- **【组件/区域】**：MiddleColumn.tsx 列表卡片化包裹（第 70、74 行）
- **【问题】**：邮件列表被包进 `mx-3 my-3 rounded bg-surface shadow-card` 浮起卡片。360px 窄栏左右再各扣 mx-3（12px），可用宽度压到 ~336px，发件人/主题/时间更易截断；`shadow-card` 浮起圆角卡在连续滚动列表语境下不 native（macOS 原生是贴边铺满+行间细分隔线）。空状态卡同款风格需同步。
- **【建议】**：列表 ul（第 74 行）`mx-3 my-3 divide-y divide-border overflow-hidden rounded bg-surface shadow-card`→`divide-y divide-border bg-bg`（删 mx-3/my-3/rounded/shadow-card/overflow-hidden，bg-surface→bg-bg 与 header 同底无缝，保留 divide-y）。MessageRow 的 px-4 天然与 header px-4 对齐，正文净增约 24px。空状态卡（第 70 行）`mx-3 my-3 rounded bg-surface p-8 ... shadow-card`→`p-8 text-center text-xs text-muted`同步去卡片化。
- **【优先级】**：高 - 360px 窄栏多还 24px 对截断改善明显，去浮起卡更贴原生列表质感，直接利好扫件。

- **【组件/区域】**：MessageRow.tsx 发件人/主题信息层级（第 30、33 行）
- **【问题】**：发件人名 `text-base font-semibold`（13.5px/600）比主题 `text-sm`（12.5px）更大更重，信息层级反转。用户扫的是"谁发来+什么事"，发件人压过主题、主题被弱化，一屏 20 行视觉重心全在人名上，找不到内容。
- **【建议】**：发件人（第 30 行）`truncate text-base font-semibold text-text`→`truncate text-sm font-medium text-text-2`（字号降、颜色降一档到次级标签，颜色降档比纯字号更干净地建层级）；主题（第 33 行）`mt-0.5 truncate text-sm text-text`→`mt-0.5 truncate text-base font-medium text-text`（升语义 base 档并加 medium 成为该行主角，不用 semibold 以免破坏克制基调）。
- **【优先级】**：高 - 信息层级反转直接影响每天扫件效率，是该区域最核心可读性问题。

- **【组件/区域】**：MessageRow.tsx 选中态左侧 3px 竖条（第 21 行）
- **【问题】**：选中行 `border-l-[3px] border-accent + bg-accent-soft`，常态又带 `border-l-[3px] border-transparent` 占位，所有行永远有 3px 透明左缝、内容整体右推 3px；3px 实心主题色竖条在 macOS Sequoia 原生（仅整行 accent-soft 浅底）并不存在，onyx 主题 accent 纯黑 #0a0a0a 时 3px 黑竖条尤其刺眼。
- **【建议】**：去掉 `border-l-[3px]` 及两个 `border-*` 类，选中态仅保留 `bg-accent-soft`、未选中保留 `hover:bg-surface-2`，更克制更贴 Sequoia 原生。
- **【优先级】**：高 - 选中态高频交互，3px 实心竖条（尤其 onyx 黑条）明显偏离 native 克制基调。

- **【组件/区域】**：MessageRow.tsx 时间/snippet 对比（第 31、37 行）
- **【问题】**：时间戳与 snippet 都用 `text-muted-2`（最淡两档），实测对比度全主题不达标：cream bg 上 3.05 / hover 2.85，slate 更糟（bg 2.86 / hover 2.61 / 选中 accent-soft 上 2.72）。snippet 是判断邮件内容的关键预览，slate 下 hover 几乎要凑近看；时间是扫件锚点（判新旧）却同档最淡。muted-2 本应只用于极弱化装饰。
- **【建议】**：时间戳（第 31 行）`shrink-0 text-[12px] text-muted-2`→`shrink-0 text-sm text-muted`（升 token 对比、去硬编码字号）；snippet（第 37 行）`mt-0.5 truncate text-[12px] text-muted-2`→`mt-0.5 truncate text-sm text-muted`（snippet 是要读的正文预览，必须升到 text-muted）。形成清晰三档梯度：发件人/主题=text，时间=text-muted（锚点更清晰），保留 snippet 弱于正文但仍可读。
- **【优先级】**：高 - snippet+日期是每行高频扫读信息，slate 2.61 对比直接影响 30+ 账号阅读效率，是本区域最实质可读性缺陷。

- **【组件/区域】**：MessageRow.tsx 行高 py-2.5（第 21 行）
- **【问题】**：每行发件人/主题/snippet 三行文本+`py-2.5`（上下各 10px）+行内 mt-0.5，单行实测偏高，一屏可见邮件条数偏少。该场景是快速扫最近 20 封、频繁切账号，密度优先。
- **【建议】**：button 容器 `py-2.5`→`py-2`（上下 10px→8px），其余 `gap-3`/选中态边框/`mt-0.5` 全不动。单点收紧竖直内边距即可一屏多容纳约 1 封。注意不要同时去掉左边框（那会破坏选中态，与上条"去 3px 竖条"区分：本条仅改 py）。
- **【优先级】**：中 - 密度提升对高密度场景有实际收益但幅度有限。

- **【组件/区域】**：MiddleColumn.tsx 凭据抽屉入口 🔑（第 50 行）
- **【问题】**：KeyRound 凭据入口与 RefreshCw 刷新并排在 header，二者完全同款（同 h-7 w-7、同 `text-muted`、同 hover、同 size=13）。凭据抽屉是 App 核心特色（看密码/2FA/辅邮），却和普通刷新视觉权重一致，新用户难发现"钥匙能点出凭据"，两个等价灰图标也缺主次。
- **【建议】**：仅把第 50 行 KeyRound 图标色 `text-muted`→`text-text-2`（次强层级），其余类名不动；刷新按钮（第 60 行）维持 `text-muted`。不选 text-accent（onyx 下 accent=黑会与 text-text 撞色），不加 border（破坏 header 紧凑一致）。
- **【优先级】**：中 - 凭据抽屉是核心差异化功能，入口可发现性影响新手上手，但老用户已知位置。

- **【组件/区域】**：MiddleColumn.tsx 收件箱为空状态（第 69-72 行）
- **【问题】**："暂无邮件"用 `bg-surface + p-8 + shadow-card` 做成和邮件列表同款浮起卡片，里面只有一行 `text-muted` 文字却带阴影卡片的视觉重量，既空又突兀；且与"正在刷新中暂时为空"无法区分。
- **【建议】**：第 70-72 行整段去卡片化+垂直居中+图标+同步态文案：`<div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-xs text-muted">` 内放 `<Inbox size={28} strokeWidth={1.3} className="text-border" />` + `{refreshing ? '正在同步…' : '暂无邮件'}`。去掉 bg-surface/shadow-card/rounded/p-8 贴父级 bg-bg，复用已有 refreshing 区分"真为空"与"正在刷新"，不新增 state。
- **【优先级】**：中 - 空收件箱日常高频（账号刚加/刚清），但仅观感问题不阻断操作。

- **【组件/区域】**：MiddleColumn.tsx 同步出错/密码失效可见层（header 后、列表前）
- **【问题】**：刷新失败/应用密码失效时中栏永远显示"暂无邮件"，用户无法区分"真没邮件"和"IMAP 连不上/密码失效"。CLAUDE.md 明确要求"登录失败要 UI 提示"，目前中栏无出错可见层。store 已暴露现成只读字段 `Account.lastSyncStatus('ok'|'expired'|'error')`，AccountItem 已消费同款，无需等后端。
- **【建议】**：MiddleColumn 顶部从 store 取选中账号，import 补 `AlertTriangle`；在 header（第 67 行 `</header>`）后、`flex-1 overflow-y-auto`（第 68 行）前插入出错条：当 `lastSyncStatus` 为 expired/error 时渲染 `<div className="mx-3 mt-3 flex items-start gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-2 text-[11.5px] text-warning">` + `<AlertTriangle size={12} className="mt-0.5 shrink-0" />` + 文案（expired→"应用专用密码已失效，请点右上角钥匙更新"，error→"同步失败，请检查网络或应用专用密码"）。只读 lastSyncStatus 做分支、文案写死中文，不消费 lastSyncError 原文（含 IMAP 英文堆栈），不碰 IMAP/store 逻辑。
- **【优先级】**：中 - CLAUDE.md 点名要求出错提示，仅消费已有只读字段、不碰后端，是看得见的前端缺口补全。

---

## 右栏 · 邮件详情 (RightColumn.tsx / MessageBody.tsx / TranslationPanel.tsx)

- **【组件/区域】**：RightColumn.tsx 操作区"加载外部图片"+翻译入口视觉统一（第 59-63、71 行）
- **【问题】**："加载外部图片"按钮用 `border + bg-surface` 实底（与卡片同底却描一圈边，是突兀小方块），翻译 idle 态又单独用 border-b 横幅+实心 accent 按钮，三者像三块补丁堆在标题下方，正是用户点名的"独立卡片/割裂感"。
- **【建议】**：(1) 第 59-63 行"加载外部图片"未激活态 `border-border bg-surface text-muted hover:bg-surface-2`→`border-transparent bg-transparent text-text-2 hover:bg-surface-2 hover:text-text`（改 ghost，`border`/`rounded-md`/`px-2 py-1 text-[11px]`/`gap-1.5`/`transition` 全保留，激活态 `border-transparent bg-accent-soft text-accent` 不动）；(2) 第 71 行翻译块容器 `border-b border-border px-6 pt-3 pb-3`→`px-6 pt-2 pb-3`（删 border-b 去横幅感、保留 px-6 对齐，pt-3→pt-2 贴近上方按钮行）。不删该容器、不动 TranslationPanel 四态逻辑。
- **【优先级】**：高 - 用户明确点名的核心痛点，右栏是日常逐封翻看主视区，割裂感每次打开邮件都出现。

- **【组件/区域】**：TranslationPanel.tsx idle 引导态（第 34-49 行）
- **【问题】**：idle 态是一条 `border + bg-surface-2 + px-3 py-2` 整宽横幅，带"英文邮件？一键翻译成中文"引导语+实心 accent 按钮，即使中文邮件用户每次也要先看到它占掉正文上方一整行高度，且与上方图片按钮分属两种控件形态、加剧补丁感。
- **【建议】**：把第 35-49 整块横幅替换为单个 ghost 小按钮（功能不减、删引导语、保留 Languages 图标+"翻译为中文"）：`<button type="button" onClick={() => void translate()} className="flex items-center gap-1.5 rounded-md border border-transparent bg-transparent px-2 py-1 text-[11px] text-text-2 hover:bg-surface-2 hover:text-text">` + `<Languages size={13} className="text-accent" />翻译为中文`。loading/done/error 三态保持不动（仅它们才占正文上方空间，符合"未翻译近零占位"）。
- **【优先级】**：高 - 横幅每封邮件上方恒占一行且永远存在，对逐封浏览是持续视觉负担与空间浪费；收成 ghost 后未翻译时几乎零占位。

- **【组件/区域】**：TranslationPanel.tsx error 态写死 hex（第 63、68 行）
- **【问题】**：error 态容器与重试按钮写死 `border-[#ffd5d2]`/`bg-[#fff4f3]`，违反硬约束 4；这套粉红只为浅色一种色温设计，slate/onyx 下与冷灰/中性灰外壳不协调。
- **【建议】**：第 63 行容器 `border border-[#ffd5d2] bg-[#fff4f3] px-3 py-2 text-xs text-danger`→`border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger`；第 68 行重试按钮 `rounded-md border border-[#ffd5d2] bg-surface px-2 py-0.5 hover:bg-[#fff4f3]`→`rounded-md border border-danger/30 bg-surface px-2 py-0.5 text-danger hover:bg-danger/5`（显式补 text-danger 使文字色自包含）。danger 是跨主题统一语义 token。
- **【优先级】**：高 - 直接违反硬约束 4 即作废，修复成本极低且一并解决三主题一致性。

- **【组件/区域】**：TranslationPanel.tsx done 展开态 header 按钮 hover（第 87、95 行）
- **【问题】**：done 展开态整块是 `bg-surface-2 + border-border`，header 两个按钮（折叠/重新翻译）hover 用 `hover:bg-surface-2`——但容器本身就是 bg-surface-2，hover 同色无反馈，等于没有 hover 态（按钮看不出可点）。
- **【建议】**：第 87、95 行各把 `hover:bg-surface-2`→`hover:bg-surface`（surface 比 surface-2 更亮一档：cream #fff vs #f4efe5、slate #fff vs #e3e6eb、onyx #fff vs #e0e0e0，hover 时轻微抬升高亮，三主题可见、贴 macOS 原生）。容器 bg-surface-2 与 header text-muted 保持不动。
- **【优先级】**：中 - hover 同色无反馈是确凿交互缺陷，影响每次使用翻译，但非阻断。

- **【组件/区域】**：RightColumn.tsx 标题区元信息字号与对比（第 44、47、51 行）
- **【问题】**：标题 h2 `text-xl`，下面元信息全挤在 muted/muted-2 两档最弱对比里，且字号出现 11px/11.5px/12px/13px 四种零碎非 token 值。`发给 {accountEmail}` 用 `text-muted` 比时间还弱，但它恰是 30+ 账号场景最该一眼看清的"这封是哪个账号收的"。
- **【建议】**：(1) 第 44 行地址 `text-[11.5px] text-muted-2`→`text-xs text-muted-2`；(2) 第 47 行时间 `shrink-0 text-[12px] text-muted-2`→`shrink-0 text-xs text-muted-2`（保留 shrink-0）；(3) 第 51 行"发给"行 `mt-0.5 text-[11px] text-muted`→`mt-0.5 text-xs text-text-2`（颜色从最弱 muted 提到 text-2，使"哪个账号收的"比时间更可读）。第 42 行 senderName 不动。
- **【优先级】**：中 - 提升多账号定位关键信息可读性并消除零碎非 token 字号，影响每封但非阻塞。

- **【组件/区域】**：MessageBody.tsx 正文 iframe 内边距对齐（srcDoc body）
- **【问题】**：iframe 正文左缘对齐靠 srcDoc 写死的 `padding: 24px 28px`，与 header 的 px-6（24px）左对齐不一致（28px≠24px），正文比标题行右移 4px，逐封看时标题与正文左缘错位明显。
- **【建议】**：srcDoc body 的 `padding: 24px 28px`→`padding: 20px 24px`，使正文左右缘与 header px-6 精确对齐（24px）、上缘留白略收。这是 iframe 内联样式（Tailwind 不入 iframe，属既有写死样式范畴），仅做对齐数值校正、不新增写死色。
- **【优先级】**：中 - 标题与正文左缘错位是逐封阅读持续可见的对齐瑕疵，修正后阅读轴线统一。

- **【组件/区域】**：RightColumn.tsx 未选邮件空态图标（第 16-25 行）+ MiddleColumn 中栏空态图标
- **【问题】**：右栏空态 `MailOpen size={48} strokeWidth={1.2} mb-3`，中栏未选账号空态 `Inbox size={36} strokeWidth={1.3} mb-2`，两处尺寸/间距/strokeWidth 各写一套，并排大小不一显得随意；图标都用 `text-border`（极浅）在 cream（border 偏暖浅）下几乎看不见、失去存在感。
- **【建议】**：统一两处规格——都用 `size={40} strokeWidth={1.3}`、间距 `mb-3`；图标色 `text-border`→`text-border-strong`（三主题都比 border 深一档，浅暖底上仍可见但不抢眼）。文案 `text-muted` 不动。
- **【优先级】**：低 - 并排可见的一致性与可见度问题，但不影响功能。

---

## 添加账号对话框 (AddAccountDialog.tsx)

- **【组件/区域】**：AddAccountDialog.tsx 成功提示横条（第 276 行）
- **【问题】**：成功横条用 `border-emerald-200 bg-emerald-50` 两个原生绿阶，违反硬约束 4；emerald 不跟随 `--c-*`，onyx 主题里突兀冒出一块鲜绿、破坏克制基调，与语义 `text-success` 文字割裂。
- **【建议】**：`border-emerald-200 bg-emerald-50`→`border-border bg-surface-2`，其余不动。下边框与上方 header（第 261 行）、下方帮助条（第 565 行）的 `border-border` 对齐；`text-success`（#34c759 跨主题统一）保持，CheckCircle2 继承父级即唯一一抹绿做语义锚点。不用 accent-soft（会给"成功"染蓝与绿语义打架）。
- **【优先级】**：高 - 连续添加 30+ 账号时每加一个闪现一次的高频元素，写死 emerald 违反约束且 onyx 下观感最差。

- **【组件/区域】**：AddAccountDialog.tsx 错误条（第 440 行）
- **【问题】**：错误条写死 `border-[#ffd5d2] bg-[#fff4f3]`，违反硬约束 4；浅粉为 cream 手调，放 slate 冷灰/onyx 灰底上既不跟随主题也偏暖，与周围中性表单格格不入。
- **【建议】**：`border border-[#ffd5d2] bg-[#fff4f3]`→`border border-danger/30 bg-danger/10`，其余（`whitespace-pre-wrap rounded-md px-3 py-2 text-[12px] text-danger`）不变。保留红粉错误暗示且三主题统一（不中性化成 surface-2，避免丢失错误色语义）。
- **【优先级】**：高 - 提交失败是验证应用密码的核心失败路径，必现且用户必读；hex 写死违反硬约束、三主题一致性差。

- **【组件/区域】**：AddAccountDialog.tsx "连不上 Google"错误卡图标底（第 605 行）
- **【问题】**：警告图标圆底用原生 `bg-amber-100`，违反硬约束 4，且该橙底固定不跟随三主题，onyx 灰阶主题里一块琥珀圆底突兀。
- **【建议】**：`bg-amber-100`→`bg-warning/10`（语义 warning 低透明度，三主题统一且仍传警示），AlertTriangle 保持 `text-warning` 做唯一橙色语义锚点。
- **【优先级】**：中 - 同对话框配色体系且写死原生色违反硬约束，但出现在网络异常低频兜底路径。

- **【组件/区域】**：AddAccountDialog.tsx 底部主按钮 + 粘贴框次级按钮（第 460、329 行）
- **【问题】**：主按钮"验证并添加"是对话框唯一提交焦点，但与粘贴框"解析并填入"（第 329 行）同用实心 `bg-accent` 填充，左表单内两块 solid accent 分散提交焦点；主按钮也无 shadow 等更强层级信号。
- **【建议】**：(A 高) 第 460 行主按钮加 `shadow-sm`（复用 LeftColumn:46"添加账号"主 CTA 的 solid accent + shadow-sm 语言，footer 已有 border-t、阴影可读）；(B 中) 第 329 行"解析并填入"从实心降描边：`rounded bg-accent px-2.5 py-1 text-[11px] text-white hover:bg-accent/90`→`rounded border border-accent bg-transparent px-2.5 py-1 text-[11px] text-accent hover:bg-accent-soft`，把左表单唯一 solid accent 留给底部提交（A 可单独采纳即为净改进）。
- **【优先级】**：高 - 主按钮焦点直接决定 30+ 账号录入操作落点效率，让实心 accent 在表单内唯一化是 macOS 原生级层级关键。

- **【组件/区域】**：AddAccountDialog.tsx 字段 label 与 input 间距（第 399、427 行）
- **【问题】**：两字段 label 与输入框间距都是 `mt-0.5`（2px），label 几乎贴 input，而字段间是 `gap-3`（12px）。2px 内聚 vs 12px 字段间距使层级模糊，label 像粘在上一字段尾部而非领起自己的 input，增加扫读成本。
- **【建议】**：第 399 行 `relative mt-0.5 flex ...` 的 `mt-0.5`→`mt-1.5`，第 427 行 input className 开头 `mt-0.5`→`mt-1.5`，统一取 6px（恰为字段间 gap-3 的一半），形成清晰"label 领起 input"分组。仅改这两行、固定 mt-1.5。
- **【优先级】**：中 - 影响每次添加账号核心两字段扫读，2px→6px 是观感微调非阻断。

---

## 凭据抽屉 (CredentialsDrawer.tsx)

- **【组件/区域】**：CredentialsDrawer.tsx 卡片容器 + 警告条写死原生色（第 69、107 行）
- **【问题】**：抽屉卡片 `bg-white`、警告条 `bg-amber-50` 写死原生色，违反硬约束 4；amber-50 固定暖黄与 slate 冷青灰主题不搭，onyx 下卡片白对 bg(#e9e9e9)偏硬。
- **【建议】**：第 69 行 `bg-white`→`bg-surface`（三主题 --c-surface 都 #fff、零视觉变化、纯语义对齐）；第 107 行警告条 `bg-amber-50`→`bg-surface-2`（保留 text-warning 文字 + AlertTriangle 橙做警示锚点，与 slate 冷调不再冲突）。第 65 行遮罩 `bg-black/30`、第 172 行 `hover:bg-accent/90` 保留（modal 惯例/合规 token）。可选同文件补漏：第 242/404 行输入框/CopyBtn `bg-white`→`bg-surface`、第 290/379 行 `hover:bg-white`→`hover:bg-surface-2`。
- **【优先级】**：高 - 直接违反硬约束 4 的写死原生色，且 onyx 下观感割裂，是该区域最实的合规问题。

- **【组件/区域】**：CredentialsDrawer.tsx 应用专用密码致命空态分级（Row 第 121-129、298 行）
- **【问题】**："未找到（IMAP 无法工作）"这种致命空态与普通"未保存"用同一 `text-muted`（第 298 行），看不出严重性——应用密码缺失=该账号根本拉不到邮件，是 30+ 账号管理里最该一眼识别的故障，却被淹没。
- **【建议】**：Row props 加 `critical?: boolean`，第 298 行空态 span `text-[12px] text-muted`→`text-[12px] ${critical ? 'text-danger' : 'text-muted'}`，仅应用专用密码那个 Row（第 121-129 行，在 emptyHint 下一行）传 `critical`，其余 4 个 Row 不传自动落 text-muted。text-danger 是语义 token；TotpRow 第 344 行"未保存"是可选项缺失非致命、保持 text-muted；打码 16 点位维持现状（暴露真实长度是安全减分项）。
- **【优先级】**：中 - 应用密码缺失=账号不可用，是抽屉里最该一眼看到的状态，当前与普通空态同色被淹没。

---

## 顶部工具栏 (Toolbar.tsx)

- **【组件/区域】**：Toolbar.tsx 工具栏背景
- **【问题】**：背景写死 `bg-white/70`，违反硬约束 4；下方三栏用带色温的 `bg-bg`（cream 暖米/slate 冷青/onyx 中性灰）与 `bg-sidebar`，而工具栏纯白半透叠加，cream/slate 下 backdrop-blur 透出暖/冷底色时纯白条显得偏冷发灰、与品牌色温脱节，顶部出现一条不属于任何主题的白带。
- **【建议】**：`bg-white/70`→`bg-surface/70`（--c-surface 三主题均 #ffffff、视觉等价但纳入 token 体系、符合 data-theme 跨主题契约）；`border-b border-border` 保留。
- **【优先级】**：高 - 明确违反硬约束 4，且是 30+ 账号每次开 App 第一眼的全局观感，三主题色温一致性直接受影响。

- **【组件/区域】**：Toolbar.tsx 图标按钮对比度（Palette / Bell）
- **【问题】**：两按钮默认态 `text-muted`，在半透白工具栏上灰度图标偏弱，尤其 onyx（accent 黑、整体高对比）下 muted 灰图标显得没精神、可点击性弱。日常高频切主题/开关提示音的入口不该这么隐身。
- **【建议】**：两按钮默认色 `text-muted`→`text-text-2`，hover 维持 `hover:text-text`，对比提上来又不抢戏。
- **【优先级】**：中 - 影响高频工具入口可见性与点击信心，但不致命。

- **【组件/区域】**：Toolbar.tsx 按钮命中区与节奏（第 48、56 行容器 w-28）
- **【问题】**：两图标按钮用 `p-1` 包 size=15 图标，命中区约 23×23，低于 macOS 推荐 28px 级；它们与左侧"同步中"pill 一起塞进固定 `w-28`（112px）容器，同步态出现时三元素拥挤甚至挤压，节奏偏小偏密。
- **【建议】**：按钮 `p-1`→`p-1.5`（命中区到 27×27）、`rounded`→`rounded-md`（与放大方块协调）；容器 `w-28`→`w-32` 给同步态留余量，按钮间 `gap-2` 保持。
- **【优先级】**：中 - 提升点击舒适度与同步态布局稳健性，属观感与手感优化。

- **【组件/区域】**：Toolbar.tsx 按钮按下反馈（Palette 第 48 行 / Bell 第 56 行）
- **【问题】**：两按钮只有 `hover:bg-surface-2 hover:text-text`，无 active 按下态。macOS 原生工具栏按钮按下有一瞬更深填充反馈，缺失会让点击像没踩实，尤其切主题这种"点一下出弹层"的动作缺触感确认；Palette 也缺"弹层已展开"的选中态。
- **【建议】**：两按钮各补 `active:bg-accent-soft`；Palette 按钮改条件类整体切换（避免 text 叠加不可靠）：`className={`rounded p-1 transition hover:bg-surface-2 hover:text-text active:bg-accent-soft ${pickerOpen ? 'bg-surface-2 text-text' : 'text-muted'}`}`；Bell 只加 `active:bg-accent-soft`（状态已由 Bell/BellOff 图标区分）。
- **【优先级】**：中 - 补齐交互反馈闭环、提升原生手感，但非阻断。

---

## 主题选择器 (ThemePicker.tsx)

- **【组件/区域】**：ThemePicker.tsx 弹层形态瘦身（第 92、96、112 行）
- **【问题】**：任务定位它是 Palette 旁的 popover，但实现是 `fixed inset-0 bg-black/30 backdrop-blur-sm` 全屏遮罩+居中 `max-w-2xl` 大卡片。为仅 3 个主题切换动用整屏变暗+毛玻璃体量过重、打断感强，且从右上角点却在屏幕正中弹大窗，脱离触发它的 Palette 按钮。
- **【建议】**：保留居中模态形态（与 CredentialsDrawer/AddAccountDialog 一致，第 92 行居中遮罩不动），只瘦身：(1) 第 96 行 `max-w-2xl`→`max-w-md`（与 CredentialsDrawer:69 同款、全 App 模态宽度统一）；(2) 第 112 行三栏 `grid grid-cols-3 gap-3 p-5`→`grid grid-cols-1 gap-2.5 p-4`（窄宽下竖排更就近紧凑，缩略图 h-[90px] 保留）；(3) 第 92 行可选去 `backdrop-blur-sm` 保留 `bg-black/30` 降打断。`shadow-popover`/`rounded-lg` 保留。明确不要改成右上角伪锚定（破坏模态一致性）。
- **【优先级】**：高 - 形态与触发点错位是该区域最大体验落差，直接决定"像不像原生 macOS"。

- **【组件/区域】**：ThemePicker.tsx 色板球描边写死黑色（ColorSwatch 第 216-223 行）
- **【问题】**：ColorSwatch 用 `border border-black/10` 描边，写死黑色未走 token，违反硬约束 4；onyx 下黑色球+黑色 10% 描边几乎糊在一起看不清边界。（backgroundColor 走 inline style 渲染 THEMES 预览色板，是被展示内容，保持不动。）
- **【建议】**：仅 `border border-black/10`→`border border-border-strong`（合法 token，本文件第 142 行 hover 已在用，描边对比强于 black/10，onyx 黑球边界更可辨）。`h-3 w-3` 尺寸不动。
- **【优先级】**：中 - 修写死颜色违规并改善 onyx 色板辨识度，范围小、风险低。

- **【组件/区域】**：ThemePicker.tsx 当前选中卡静态层级与未选 hover 位移（ThemeCard 第 141、142、150-151 行）
- **【问题】**：选中卡仅 `border-accent + shadow-card-hover`，相对未选卡缺少静态（非 hover）层级提升，三张卡平铺时当前主题不够"跳出来"；未选卡 hover 才有 `-translate-y-0.5` 位移与极简基调冲突；Check 徽章偏小（h-5 w-5）。
- **【建议】**：(1) 第 141 行选中分支 `border-accent shadow-card-hover`→`border-accent bg-accent-soft shadow-card-hover`（加淡底让当前主题静态可辨，bg-accent-soft 是白名单 token）；(2) 第 142 行未选分支删 `hover:-translate-y-0.5`，仅留描边+阴影轻反馈贴 macOS 克制；(3) 第 151 行 `<Check size={11}>`→`size={12}`，徽章容器 h-5 w-5 不动（推荐最小改动，不要用默认 Tailwind 不存在的 h-5.5）。
- **【优先级】**：中 - 提升"一眼认出当前主题"效率并去掉与极简冲突的位移动效，体验正向但非高频阻断。

---

## 全局 / 跨文件

- **【组件/区域】**：全局结构分隔线层级（LeftColumn.tsx:13 / MiddleColumn.tsx:33,34；根因 border-border 在非白底上对比不足）
- **【问题】**：`border-border` 与 sidebar/surface-2/bg 的对比度普遍 1.03–1.27（>1.2 才看得出），左栏与中栏竖直分隔、中栏 header 下边线在 cream/onyx 下几乎糊在一起，三栏布局缺结构感；而 `border-border-strong` 全仓只用 1 处（ThemePicker hover），层级被浪费。
- **【建议】**：仅升级坐落在非白底上的结构骨架线：LeftColumn.tsx:13 `border-r border-border bg-sidebar`→`border-r border-border-strong bg-sidebar`；MiddleColumn.tsx:33 `border-r border-border bg-bg`→`border-r border-border-strong bg-bg`，:34 header `border-b border-border`→`border-b border-border-strong`。白底（bg-surface）上的边框/带 shadow 浮层（AccountItem 弹出菜单第 94 行、菜单内分隔第 106 行等）一律保留 `border-border`，避免与所有白底浮层不一致。border-border-strong 三主题已在 index.css 定义、零新增。
- **【优先级】**：高 - 三栏分隔线是整屏结构骨架，几乎不可见会让密集列表糊成一团，用现成 token 零新增成本即可解决。

---

## 全局加载态 (App.tsx)

- **【组件/区域】**：App.tsx 全局加载态（第 14-18 行）
- **【问题】**：init 期间整屏只有居中一行 `text-muted` 的"加载中…"纯文字，无容器背景/图标，三主题下都是空白屏配一行灰字，显得像白屏卡死而非加载；管理 30+ 账号每次冷启动都会看到这一帧，廉价感最重。
- **【建议】**：第 16 行 `<div className="flex h-screen items-center justify-center text-muted">加载中…</div>`→`<div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg text-sm text-muted">`，内部第一行放 `<Loader2 size={16} className="animate-spin text-muted-2" />`（import 自 lucide-react），第二行保留"加载中…"。bg-bg 补满主题底色消除露白，图标 text-muted-2 比文案 text-muted 更淡层级正确，text-sm 对齐其它空态文案。
- **【优先级】**：高 - 冷启动必经帧、三主题全露白、改动极小，性价比最高。
