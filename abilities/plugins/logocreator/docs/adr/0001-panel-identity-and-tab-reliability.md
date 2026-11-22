# 0001 — 面板身份的单一来源、tab 注册的退路、以及面板里的 image-to-image

- 状态：已采纳
- 日期：2026-11-22
- 版本：0.7.0

## 背景

安装后有三个用户可见的故障，都指向同一件事：**插件在宿主里的「身份」和「出现」没有单一来源。**

1. 活动面板 tab 里没有 LogoCreator；
2. 就算出现了，tab 图标也不是这个插件自己的 logo；
3. tab 打开是空白 —— 渲染失败，没有任何提示。

另外两条是能力缺口，不是故障：

4. 对话里生成了图（`logocreator_image`），面板要把那张图呈现出来并继续加工；
5. 上游的 `ReferenceUpload` + `edit-logo` 在面板里没有对应物 —— 「拿这张再改一下」只能在对话里说。

## 决策

### D1 tab 图标 = 插件的 mark，由宿主解析

`plugin.json#icon` 指向 `assets/icon.svg`（上游 `app/icon.svg` 原样复制）。注册时**不再自绘字形**，
而是 `<img src={ctx.plugin.iconUrl}>`；只有宿主不提供 `iconUrl` 的旧版本才回落到 `IconGenerate`。

为什么之前是错的：自绘字形让 tab 显示一枚星形，而能力卡显示的是另一张图 —— 同一插件两个 logo。
宿主 `resolvePluginIcon` 会把相对路径转成资源 URL，`resolvePluginIconNode` 也优先用这张图，
所以「一处声明、到处一致」是宿主已经提供的契约，插件不该绕过它。

输入栏徽标也改成同一个节点：徽标是品牌面，不是面板内部的动词。

### D2 tab 注册必须留退路

`registerActivityTab` 的整套参数（icon 节点、`order`、`retention`）任何一个被宿主拒绝，
整个调用就会抛错。上一版把这次调用包在自己的 try 里 —— 于是「没有 tab」只留下一条 console 文案。

现在：先试完整参数，抛错则用**最小集**（id / label / scope_use / component）再注册一次。
少几个修饰词，换一个存在的 tab，这个交换永远值得。

### D3 可见性按会话断言，不只在激活时

attach 记录按会话 cwd 保存。应用启动时宿主可能还没有「正在展示的会话」，
那一次无参的 `setActivityTabVisible(true)` 会落在空处。所以每次 `conversation-changed`
都带着 `{ cwd }` 再断言一次。用户手动收起过 tab 的会话也会被这次调用恢复 —— 这正是「装了但看不到」的现场。

### D4 面板不允许空白

`PanelShell` = 错误边界 + 画布。边界捕获渲染异常，写一条 `[logocreator] panel render failed`，
弹一个 toast，并在面板里给出错误原文 + 重试。数据坏了（历史/备注/设置）时用户至少知道是什么坏了。

### D5 对话里生成的图，落在同一个地方

工具 → `history.add`（`engine: "ai"` + blobId）→ `revealInCanvas`（pending id 按会话）→ 面板 peek → 查到 → claim → 载入 spec 并选中。
两处补强：

- **pending 不会永久占位**：记录 4 秒内没出现就丢弃，避免一次失败的交接挡住下一次生成；
- **面板开着时也跟随最新 AI 设计**：新记录到达且当前没有人为选中的矢量稿，就切到它。

### D6 面板里的 image-to-image

`generate(spec, { reference })` 把 `referenceBlobId` 透传给宿主媒体层，并强制 `count: 1`
（一次编辑只有一个结果）。dock 上多一枚「改这一张」，只对 `engine === "ai"` 且有 blob 的选中项出现 ——
矢量稿没有位图可编辑，给按钮等于给一个必然失败的动作。

## 后果

- 插件只有一个图标文件（`assets/icon.svg`），`artwork.test.ts` 断言它还留着上游的 `lc-tile` 渐变 id，
  换成任何别的图都会失败；
- 图标从 512px 位图变成 32 viewBox 的矢量：tab 16px、能力卡、市场卡片都由宿主缩放，不再糊；
- 注册多了一次失败重试，代价是一次多余调用，收益是「tab 一定在」；
- 面板里的 AI 产物现在可以从面板继续派生（编辑），而不必回到对话。

## 不做什么

- **不做自动开 tab 的启发式**（「这个目录像不像设计项目」）：这是通用插件，不是设计目录专用；
  打开时机由工具调用与输入栏开关决定；
- **不把上游的品牌图（吉祥物）塞进 tab**：它是 agent 头像，不是产品 mark；
- **不在面板里读对话消息里的图片**：`ConversationMessage` 只有 `text`，没有附件字段；
  想拿到「宿主自己的图片工具」产出的图需要一个新的宿主 API，插件不该假装能读。

## 验证

| 项 | 结果 |
| --- | --- |
| `tsc --noEmit` | 通过 |
| `vitest run`（插件） | 32 文件 / 231 条通过（本轮 +10） |
| `panel-chrome.test.ts` | 注册退路、按会话可见、图标取自 `iconUrl`、边界、pending 不永久占位、跟随最新 AI 设计、reference 透传 |
| 实机：tab 出现、图标、面板渲染、对话生图 | **NOT RUN**（工作区无可用 Desktop） |

实机验证顺序（装 0.7.0 后）：

1. 主进程日志找 `[logocreator] activated · tab=registered`；若为 `FAILED`，看紧随其后的
   `full tab registration rejected` 那条 —— 它会print 出宿主拒绝的字段；
2. 活动面板 tab 条上应显示靛蓝方块 + 双窗格 + 星点的 mark，与市场卡片一致；
3. 对话里让 agent 生成一次 raster logo，面板应自己打开并停在那张图上；
4. 选中那张图后 dock 出现「改这张」，点它会用宿主自己的图像 provider 做一次 image-to-image。
