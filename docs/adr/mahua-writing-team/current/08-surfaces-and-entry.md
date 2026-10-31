# 08 · 入口与界面结构

> 现行文本。归并自 [0003](../0003-workspace-view-as-primary-surface.md)、
> [0011](../0011-workspace-anatomy-matches-host-agent-panel.md)、
> [0013](../0013-bookshelf-and-reader-surfaces.md)、[0016](../0016-empty-shelf-and-reader-type-scale.md)、
> [0020](../0020-library-surface-and-default-cover.md)、[0025](../0025-continue-reads-and-studio-as-activity-tab.md)、
> [0026](../0026-design-round-five-surfaces-and-host-tokens.md)、[0027](../0027-shell-layer-console-and-rail-degradation.md)。
> 这是覆盖旧 ADR 最多的一篇：八篇讲的是同一件事——人从哪个门进来、进来看到几层。
> 2026-10-31 版面第二轮落地，三处旧结论已被改写，见文末「被改写的地方」。

## 一句话

同一个工作台注册两次；进来先报头 + 竖栏 + 一张纸，纸里的三层各自定高。

## 一、入口：一份代码，两个宿主位置

| 宿主位置 | 注册 | id | 形态 |
| --- | --- | --- | --- |
| 活动面板标签页 | `registerActivityTab` | `studio` | `surface="panel"`，有竖栏 |
| 工作区整页视图 | `registerWorkspaceView` | `studio` | `surface="page"`，同样的界面 |

1. **不 portal、不 `fixed inset-0`**。"全屏"是换宿主位置，不是盖一层遮罩。
2. **`sidebar: true` 是硬要求**。写 `false` 会被宿主改写成 `/settings/extensions?view=…`，
   打开的是设置页而不是工作台。
3. **标签页默认上栏**（`initiallyVisible: true`、`removable: true`、`retention: "warm"`），
   `scope_use` 显式写全 `["conversation", "project"]`。
4. **装配门只留一处**：两个入口都挂 `WorkbenchMount`，它先看运行时是否就绪，未就绪给骨架。
   冷启动点全屏时运行时还没装好——各入口各写一份守卫，已经实证漏写的那份白屏。

## 二、外壳：报头 + 竖栏 + 一张纸

```text
@container  h-full / flex-col / overflow-hidden        bg-canvas
├─ StudioMasthead   h-12 shrink-0  border-b           ← 固定头
└─ 内容行  flex min-h-0 flex-1 items-stretch gap-2 pb-3 pl-2 pr-3 pt-3
   ├─ StudioRail   w-[208px] shrink-0（<640px 折成 44px 图标列）
   └─ main         min-h-0 min-w-0 flex-1 overflow-hidden rounded-sheet bg-surface shadow-raise
                   ← 圆角里那一层才是滚动容器
```

1. **纵向三层**：固定头（`shrink-0`）、可滚中段（`min-h-0 flex-1`）、固定尾（`shrink-0`）。
   少了任何一层，长内容就会把整张纸顶出画布。
2. **滚动发生在圆角里面**。卡片始终 `overflow-hidden` + 定高（`flex-1` 或给死值），
   卡头卡尾 `shrink-0` 钉在圆角上。外层不许 `overflow-y-auto`——那会让圆角跟着内容跑。
3. **双栏就都写 `min-h-0`**。一边滚一边不滚，结果就是矮的那边下方露出 canvas 空档。
4. **同屏滚动区能不并列就不并列**；必须并列时各自被外框限高，不允许两个独立滚动条抢滚轮。
5. **竖栏底部专放「门」**：写作中卡、换位门（全屏 / 退出全屏）、打开团队对话、凭证行、折叠键。
   中段是导航，底边是动作——这条分工来自设计稿。
6. **换位门随形态换位置**：非 bare 页放竖栏底部（报头右槽留给同步信息）；运行台与激活页
   没有竖栏，回落到报头右槽。窄面板里报头按钮会被 `hidden @[720px]:inline` 收起，
   所以竖栏那份才是常驻入口。

## 三、七帧

`shelf`（书架）· `library`（书库）· `book`（本册）· `reader`（阅读）· `ledger`（伏笔与决策）·
`console`（运行台）· `activation`（凭证）。

1. **页面根只写 `flex min-h-0 flex-1 flex-col`**，不要自己算高度——外层 `main` 已经给了确定高度。
2. **页头提在双栏之上**（`PageHeader`），不要塞进某一栏；塞进去两栏的标题就不对齐了。
3. **窄了丢列不压列**。书库表按 1120 / 880 / 680px 逐档丢次要列，不用 `min-w` 强行保列——
   保列的结果是横向滚动条压在圆角里。
4. **面板 <400px 时竖栏降级成图标列**（阈值 640px，实现只有一处：`.mahua-rail[data-collapsed]`）。
5. **书库与藏书是两层**：`shelf` 是工作台自己的书，`library` 是扫描到的稿子。
   两层的差别写在同一套卡片语言里，靠层级与说明区分，不靠两套样式。

## 代码落点

| 事 | 文件 |
| --- | --- |
| 入口 | `src/studio-tab.ts`、`src/studio-view.ts`、`src/studio-ids.ts` |
| 装配门与骨架 | `components/WorkbenchMount.tsx`、`components/StudioBootSkeleton.tsx` |
| 外壳 | `components/shell/{StudioShell,StudioMasthead,StudioRail,PageHeader}.tsx` |
| 七帧 | `components/pages/*Page.tsx` |
| 路由 | `hooks/use-workbench-route.ts`（模块级状态，切换宿主位置不回到书架） |

## 被改写的地方

本轮（2026-10-31，0.4.19）修正了三处此前不成立的结论：

- **0027 §2「竖栏只做导航」** → 竖栏底部现在是动作区，含换位门。导航与动作分工不变，
  但「底部只有写作卡」不再成立。
- **0020 / 0026 的「整页滚动」** → 滚动收进圆角内部，外层不再 `overflow-y-auto`；
  书库表去掉 `min-w-[820px]` 与那层 `overflow-x-auto`。
- **0025 的单一入口叙述** → 双注册是唯一形态，两份都走 `WorkbenchMount`；
  `WorkbenchScreen.tsx` 已删除。

## 怎么验证

```bash
cd abilities/plugins/mahua-writing-team
npx vitest run test/manifest-guards.test.ts test/component-wiring.test.tsx
grep -rn "min-w-\[820px\]\|overflow-x-auto" src/features | wc -l   # 期望 0
grep -n "component: WorkbenchMount" src/studio-tab.ts
```
