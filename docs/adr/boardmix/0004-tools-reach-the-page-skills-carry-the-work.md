# 工具只到「到达」，干活靠技能

- 状态：已采纳（2026-11-05）
- 相关：[0001](0001-the-web-product-is-a-plugin-tab-not-an-mcp.md)、[0002](0002-pin-the-origin-not-the-path.md)、[0003](0003-the-plugin-is-agent-operable.md)
- 影响面：0003 的工具集与技能集（四个工具 → 六个工具，一份技能 → 五份技能）、`src/domain/boardmix-destinations.ts`、`src/tools/boardmix-destination-tools.ts`、`agent/skills/`

> 第七个工具 `boardmix_automate` 由 [0006](0006-automation-runs-before-the-answer.md) 加入，分工原则不变：仍然只到「到达」，只是把多步到达变成一次可观察的运行。

## 问题

0003 定了四个工具：开页、导航、看状态、逃生口。它们诚实地覆盖了「到达」，但用户嘴里的日常任务是另一批话：

> 「把昨天那个评审白板打开，导一版 PDF 给客户。」
> 「明天要讲的，你先帮我把大纲理成流程图，再生成 PPT。」
> 「帮我看看上次那个白板里我们定了哪些结论。」

先回答被问的那个问题：**四个工具不足以支撑日常智能化的使用**。这不是工具写得糙，是边界决定的——工具只改标签页状态，所以它能办的永远止于「把用户送到能做这件事的那一屏」。

## 事实：官方能力面与限额（Observed，2026-11-05）

### 帮助中心的能力分档

`https://boardmix.cn/help-center` 把产品能力分成九组，这就是技能该覆盖的地图：

| 分组 | 篇数 | 条目 |
| --- | --- | --- |
| 快速入门 | 2 | 1 分钟快速上手、简介 |
| 创作工具 | 17 | 文档&卡片、画笔/橡皮擦、基本图形、便签、思维导图… |
| 互动工具 | 2 | 互动表情和印章、计时器 |
| 协作与交流 | 8 | 分组讨论、演示模式、评论和评论列表、投票、第三方音视频 |
| 资源与素材 | 5 | 素材库、模板、嵌入网页、图形资源 |
| 导入导出 | 2 | 导入、导出 |
| 画布设置 | 2 | 画布基础设置、画布模式设置 |
| 路线图 | 1 | 路线图 |
| 常见问题 | — | 上传 PPT/PDF 失败最常见原因是单文件超过 50M（官方原文） |

### 套餐决定「能承诺到哪一步」

`https://boardmix.cn/price/`（Observed，同日的挂牌价）：

| 档 | 可编辑文件 | 单文件图元 | 空间 | 导出 |
| --- | --- | --- | --- | --- |
| 免费用户 | **3 个** | **150 个** | 100 MB | **标清、带水印** |
| 白板会员 ¥199/年 | 不限 | 不限 | 50 GB | 高清 / 超清 / 分页 |
| 白板 AI 会员 ¥288/年 | 同白板会员 | 同白板会员 | 同白板会员 | 同白板会员 + AI 10000 点/月 |
| 免费团队 | 3 个 | 150 个 | 200 MB | 标清、带水印 |

这四条是**必须提前说**的东西：一个让 Agent 写满 300 个便签的方案，落到免费账号上根本存不下；一个承诺「给你导一版无水印 PDF」的回答，在免费账号上是假的。

### 站内地址（Observed，同日读取站内路由表）

```text
/app/                工作台根
/app/recent-file     最近文件
/app/projects        项目（含归档）
/app/my-space        我的空间
/app/trash           回收站
/app/create          新建
/app/open            打开
/app/editor          编辑器
/app/agent           智能体
/app/ai/chat         AI 对话
/app/ai/ppt          AI 生成 PPT
/app/ai/flowchart    AI 生成流程图
/share               分享页（游客访问）
```

有了这张表，把用户「送到那一屏」就不再是一句空话——但每个地址都只是**入口**，进去以后仍要用户自己按一下。

### 两条改变策略的更新

- V1.120（2026-10-13）：**AI Agent 新增画布内容检索能力**。读白板内容这件事，站内自带的 AI 已经能做。
- V1.121（2026-10-27）：**工作台支持导入 Mermaid 文件并转换为流程图**。

第一条说明「读画布」不该由插件去做——产品里已经有一个能读的；第二条给了 Agent 唯一一条真正能把内容送进画布的通道。

## 决定一：工具补两个，都带 `needsUserAction: true`

| id | 语义 | 落地 |
| --- | --- | --- |
| `boardmix_new` | 把标签页送到新建入口 | `/app/create` |
| `boardmix_ai` | 把标签页送到 AI 生成入口；`kind` ∈ `ppt` \| `flowchart` \| `chat` | `/app/ai/<kind>` |

两者都不假装完成了任务：返回体固定带 `needsUserAction: true` 与一句 `next`（「接下来这一步要在页面里点，我把你要说的内容准备好了」）。

`boardmix_ai` 的 `kind` 只放已证实的三个。**思维导图没有独立入口**，参数里就不给这个值——给一个查不到对应地址的枚举值，等于把「页面白屏」当功能。

地址集中在 `src/domain/boardmix-destinations.ts` 一处：

```ts
export const BOARDMIX_ORIGIN = "https://boardmix.cn";

export const DESTINATIONS = {
  workspace: `${BOARDMIX_ORIGIN}/app/`,
  create: `${BOARDMIX_ORIGIN}/app/create`,
  aiPpt: `${BOARDMIX_ORIGIN}/app/ai/ppt`,
  aiFlowchart: `${BOARDMIX_ORIGIN}/app/ai/flowchart`,
  aiChat: `${BOARDMIX_ORIGIN}/app/ai/chat`,
} as const;
```

四条约束不变，只是多两个调用方：未开页返回 `open:false`（不隐式开页）；一律过 `resolveEntryTarget()` 的 origin 闸门；失败返回 `tab-closed` 不悬挂；不碰画布。

### 为什么不给「列出我的白板」

没有官方列表端点。做这件事只有三条路：读页面内部结构（违反 0003 第 2 条）、让用户授权一个第三方凭据（违反第 3 条）、或者猜。三条都不做。用户要「找一块名字带周会的白板」，技能里的答案是：打开 `/app/recent-file`，那里有搜索框。

## 决定二：技能从一份扩到五份

`skillPaths` 显式列五个目录（`shimo` 就是三个显式列，Observed）。五个目录各有一份 `SKILL.md`，主技能写路由，其余四份写领域操作路径。

| 技能 | 触发 | 写什么 |
| --- | --- | --- |
| `boardmix` | 任何 boardmix 任务 | 路由层：这件事能不能办、登录卡住怎么办、打开失败的顺序、该转给哪个子技能 |
| `boardmix-canvas` | 要画、要整理结构 | 便签 / 思维导图 / 流程图 / 文档卡片 / 表格 / 基本图形 / 画笔 / 连接线 / 容器 各自在哪个入口；Mermaid 与 Markdown 的交接方式 |
| `boardmix-collaboration` | 分享、评审、开会 | 分享与权限、评论、投票、演示模式、分组讨论、第三方音视频；团队席位与「禁止向组织外分享」策略 |
| `boardmix-ai` | 要生成内容 | AI 生成 PPT / 流程图 / 文档 / 图片 / 写作 / SWOT 与智能体；AI 点数门槛；**画布检索在页面内，不在插件里** |
| `boardmix-io` | 导入导出 | 导入 PPT/PDF ≤ 50M、Mermaid、PureRef；导出档位与免费版水印 |

每份技能开头的三句话固定，不许省：

1. **你能给的是产物和路径**——产物是可粘贴的结构，路径精确到「哪个面板、哪个按钮」。
2. **你做不到的是点画布和读画布**——不描述、不猜测画布上有什么。
3. **拦住用户的限额要提前说**——3 个文件、150 个图元、水印、AI 点数，动手之前讲，别在结算页才讲。

## 决定三：Mermaid 与 Markdown 是唯一正式的内容交接通道

Agent 产不出画布对象，但能产出结构。V1.121 让工作台支持导入 Mermaid 并转成流程图，画布支持粘贴 Markdown，于是这条路是通的：

```text
用户说「把这套流程画出来」
  → Agent 产出 Mermaid（flowchart / mindmap / sequenceDiagram）
  → Agent 调 boardmix_new 把页面送到 /app/create
  → 用户在页面里导入这个 .mmd 文件或粘贴 Markdown
  → 画布上出现可编辑对象，剩下的交给用户
```

所以技能的产出物清单是封闭的四种：**Mermaid 文件、Markdown、纯文本大纲、表格**。不给截图、不给 base64、不给「已为你创建」。

## 边界没有变

0003 的三条不变量照旧，这一版只把它们落到新工具上：

- 工具能改的只有标签页状态；`boardmix_new` / `boardmix_ai` 改的是地址，不是内容。
- 不读页面内部结构、不调他方站点内部接口。文件列表、画布内容、账号信息，一概不碰。
- 永不代持凭据。没有 `token` / `cookie` / `session` 入参，AI 点数也不由插件代扣。

## 验收

1. 未开页调 `boardmix_new` → `open:false`，断言 `openActivityTab` 未被调用。
2. 已开页调 `boardmix_new` → 落地 `/app/create`，`needsUserAction:true`，`next` 非空。
3. `boardmix_ai { "kind": "ppt" }` → `/app/ai/ppt`；`{ "kind": "mindmap" }` → 参数校验失败，枚举里没有这个值。
4. `boardmix_ai { "kind": "chat" }` 后 `boardmix_tab_status` → `url` 与落地地址一致，`phase` 有值。
5. `boardmix_goto { "url": "https://evil.example/x" }` → `ok:false`、`reason:"origin-not-allowed"`，标签页 URL 未变（沿用 0003 第 3 条）。
6. 关闭标签页后调 `boardmix_new` → `ok:false`、`reason:"tab-closed"`，调用不悬挂。
7. 能力详情页能看到五个技能条目，`skillPicker` 里能按「白板 / 协作 / 导出」搜到对应技能。
8. `boardmix` 技能正文含五条子技能路由，且每条路由的触发词与上表一致。

## 不做的事

- **不做「列出 / 搜索我的白板」工具**。无官方端点，做了就是猜。
- **不代跑 AI 生成**。点数是用户账户里的，代跑等于替用户花钱。
- **不在技能里许诺无水印导出**。免费版标清带水印是产品事实。
- **不做页面自动化**（点击、填表、翻页、拖拽）。0003 的结论不变：那是把上游 UI 当私有 API 用，一次改版全废。
- **不把限额藏进「最后提醒」**。文件数、图元数、水印、AI 点数写在动手之前。
