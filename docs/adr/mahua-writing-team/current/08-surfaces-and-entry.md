# 08 · 入口与界面结构

> 现行文本。归并自 [0003](../0003-workspace-view-as-primary-surface.md)、
> [0011](../0011-workspace-anatomy-matches-host-agent-panel.md)、
> [0013](../0013-bookshelf-and-reader-surfaces.md)、[0016](../0016-empty-shelf-and-reader-type-scale.md)、
> [0020](../0020-library-surface-and-default-cover.md)、[0025](../0025-continue-reads-and-studio-as-activity-tab.md)、
> [0026](../0026-design-round-five-surfaces-and-host-tokens.md)、[0027](../0027-shell-layer-console-and-rail-degradation.md)。
> 这是覆盖旧 ADR 最多的一篇：八篇讲的是同一件事——人从哪个门进来、进来看到几层。
> 2026-10-31 两轮改写：版面第二轮（0030，三处）与全屏 / 配色轮（0031，两处），见文末「被改写的地方」。

## 一句话

只有一个宿主入口（活动面板标签页）；进来先报头 + 竖栏 + 一张纸，纸里的三层各自定高。全屏是这张纸自己铺满整窗。

## 一、入口：只有一枚活动面板标签页

| 宿主位置 | 注册 | id | 形态 |
| --- | --- | --- | --- |
| 活动面板标签页 | `registerActivityTab` | `studio` | 有竖栏；全屏时由它自己铺满整窗 |

1. **只有一个入口。** 从前还注册过一个 workspace view（`registerStudioView`）：它渲染在应用外壳内
   （侧栏、页头都在），做不到「只有插件」；副作用是宿主管家侧栏里多一条「麻花小说网」。0031 起
   整条注册连同文件一起删（`src/studio-view.ts`、`studio-ids.ts` 的 `STUDIO_VIEW_ID`、
   `plugin.json` 的 `ui.slot.workspace-view` 全部消失）。代价是失去深链路由。
2. **全屏 = 同一个根节点 `createPortal` 到 `document.body`**（0032 §2）。0031 那版只把根节点切成
   `fixed inset-0 z-[60]`，截图里宿主标签条与侧栏照样看得见——`fixed` 只对**最近的层叠上下文**生效，
   宿主壳自己有 `z-10`/`z-20`，插件被关在里面。搬到 `body` 才真出去。层级 `z-[2147483000]`，压过
   宿主壳与它的弹窗；根节点带 `data-fullscreen="true"`，Esc 与报头那枚键都能退，全屏期间
   `body` 滚动锁起来（退出时原值还原）。
3. **portal 需要自补作用域层**：插件 CSS 编在 `@scope ([data-astravia-plugin-root=<id>])` 里，搬出去就
   落在作用域外。所以包裹层写成 `<div data-astravia-plugin-root={STUDIO_PLUGIN_ID} style={{display:"contents"}}>`
   ——属性选择器命中即恢复全部 Tailwind 类，`display:contents` 不产生盒子、不阻断继承，
   `@container` 仍按 `StudioShell` 根节点的实宽算。`STUDIO_PLUGIN_ID` 是常量，守卫核对它与
   `plugin.json` 的 `id` 逐字一致。
4. **代价是 remount**：`createPortal` 与普通 JSX 的 fiber 类型不同，切换必然卸载重挂，页内 state
   （书库筛选、阅读字号）重置；字号偏好走存储能读回，筛选重置可接受。把「只有插件」拿到手更值。
4. **标签页默认上栏**（`initiallyVisible: true`、`removable: true`、`retention: "warm"`），
   `scope_use` 显式写全 `["conversation", "project"]`。
5. **装配门只留一处**：入口挂 `WorkbenchMount`，它先看运行时是否就绪，未就绪给骨架。
   冷启动时运行时还没装好——守卫写成两份，已经实证漏写的那份白屏。

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
5. **竖栏底部只剩写作卡、凭证行、折叠键**，三行都不带描边（收起成 44px 图标列时，描边卡片
   会碎成一堆短横）；中段是导航，底边是动作。
6. **全屏键常驻报头右槽**（0031 §5）。它是外壳能力，不随页面变，bare 页（运行台 / 激活页）
   没有竖栏也能到。全屏时报头兼作窗口标题栏：`.mahua-drag` 给 `-webkit-app-region: drag`，
   里面每个可点的东西由 `.mahua-drag :where(button, a, …)` 反标 `no-drag`；mac 上再让出左侧
   5.25rem 避开原生红绿灯。

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
| 入口 | `src/studio-tab.ts`、`src/studio-ids.ts` |
| 装配门与骨架 | `components/WorkbenchMount.tsx`、`components/StudioBootSkeleton.tsx` |
| 外壳 | `components/shell/{StudioShell,StudioMasthead,StudioRail,PageHeader}.tsx` |
| 七帧 | `components/pages/*Page.tsx` |
| 全屏 | `components/WorkbenchSurface.tsx`（`createPortal` 到 `body` + `fixed inset-0 z-[2147483000]`）、`src/studio-ids.ts` 的 `STUDIO_PLUGIN_ID`、`src/style.css` 的 `.mahua-drag` / `.mahua-traffic-lights` |
| 路由 | `hooks/use-workbench-route.ts`（模块级状态，切换宿主位置不回到书架） |

## 被改写的地方

两轮改写。先是本轮（2026-10-31，0.4.19）修正了三处：

- **0027 §2「竖栏只做导航」** → 竖栏底部现在是动作区，含换位门。导航与动作分工不变，
  但「底部只有写作卡」不再成立。
- **0020 / 0026 的「整页滚动」** → 滚动收进圆角内部，外层不再 `overflow-y-auto`；
  书库表去掉 `min-w-[820px]` 与那层 `overflow-x-auto`。
- **0025 的单一入口叙述** → 当时改成双注册，两份都走 `WorkbenchMount`；`WorkbenchScreen.tsx` 已删。

然后 0031（2026-10-31，0.4.21）又推翻了两条：

- **「全屏 = 换宿主位置」与「不 `fixed inset-0`」** → 宿主的路由渲染在外壳内、SDK 也没有窗口
  全屏 API，所以「只有插件」只能由根节点自己 `fixed inset-0`。
- **双注册** → 只留标签页。整页视图那条在宿主管家侧栏里多占一条，又做不到只有插件。

最后 0032（2026-11-01，0.4.22）推翻了 0031 的全屏做法：

- **「只切 `fixed inset-0`，不 portal」** → 宿主壳自带层叠上下文，插件被关在里面，截图里标签条与
  侧栏照样盖在插件上。改为 `createPortal` 到 `body`，作用域层用 `data-astravia-plugin-root` 自补。
- **「portal 出去 Tailwind 类会被丢弃」** → 不成立：CSS 编在属性选择器作用域里，包裹层写上同一属性
  加 `display:contents` 就命中。

## 怎么验证

```bash
cd abilities/plugins/mahua-writing-team
npx vitest run test/manifest-guards.test.ts test/component-wiring.test.tsx
grep -rn "min-w-\[820px\]\|overflow-x-auto" src/features | wc -l   # 期望 0
grep -rn "\bfixed\b" src --include="*.tsx" | grep -v WorkbenchSurface | wc -l   # 期望 0
grep -rn "createPortal(\|registerStudioView(\|STUDIO_VIEW_ID" src | wc -l   # 期望 0（带括号，避开注释里的自述）
grep -n "component: WorkbenchMount" src/studio-tab.ts
```
