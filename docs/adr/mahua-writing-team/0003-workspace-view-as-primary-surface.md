# ADR 0003：主界面用工作区视图，侧边栏露出插件名

- 状态：已接受（2026-10-29）
- 决策对象：`abilities/plugins/novelwright/src/features/studio/StudioWorkspaceView.tsx`
- 依据：[plugin-sdk ui-slots.md](../../../../../open-astravia/packages/plugins/plugin-sdk/docs/ui-slots.md)

## 1. 背景

要求是「插件激活后侧边栏出现插件名，点进去的效果类似点宿主侧边栏智能体」——即一整块内容区，
而不是挂在某个对话旁边的窄面板。

宿主的三个入口对照：

| 入口 | 形态 | 适配度 |
| --- | --- | --- |
| `registerActivityTab` | 绑定当前对话的侧边面板，宽约 400–600px | 不适合：作品是跨会话、跨项目的（**已被 ADR 0025 §2.2 反转**：「跨会话」是数据要求，不是路由形状） |
| `registerGlobalSlot` | 全局浮层，用于悬浮球、引导 | 不适合：会被当成遮罩 |
| `registerWorkspaceView` | 独立路由 `/workspace/<pluginId>/<viewId>`，占满内容区，侧边栏导航项（用户可 pin 到置顶区，最多 5 个） | **采用**（**已由 ADR 0025 §2.2 改选 `registerActivityTab`**：侧边栏格是用户的导航位） |

`ui-slots.md` 对工作区视图的定位原话是「跨会话、跨项目的工作台（看板、控制台、仪表盘）」——
一本书的卷弧看板、章节状态、评审历史全都是这个形状。

## 2. 决策

> **本节已由 ADR 0025 §2.2 / §2.3 取代**：工作台改为活动面板的一枚标签（`initiallyVisible: false`，
> 从「+ → 可添加插件面板」自己加），`activation` 视图删除，未激活时同一枚标签渲染激活面板。以下保留原文。

1. 注册**一个侧边栏入口**：`studio`，`sidebar: true`（默认），`navOrder: 0`。图标用
   `icon-[solar--book-2-linear]`，必须在 `style.css` 里通过 `@plugin "@iconify/tailwind4";`
   生成，否则侧边栏是一个空格子且没有任何报错。

   实现上还有一个 `activation` 视图，**可见性随凭证状态翻转**：未激活时它 `sidebar: true`（否则
   它 `sidebar: false`、`studio` 又没注册，用户没有任何入口能打开它——凭证过期后整个插件等于消失），
   激活后 `studio` 占用那一个导航位，`activation` 沉到 `sidebar: false` 作为设置页保留。

> **§2.2 的页头桥接已废弃、§2.3 已被反转（ADR 0025 §2.3）**：标签没有宿主页头，
> `setWorkspaceViewHeader` 整块删除，「复制稿件」搬进书页顶栏。以下保留原文。

2. **不重复画页头。** 视图挂载后用 `ctx.ui.setWorkspaceViewHeader(...)` 接管宿主页头（标题 +
   作品切换 + 阶段徽章），卸载时清空。宿主页头持有窗口拖拽区与 macOS 红绿灯让位，自己再画一条
   会双头并存。
3. **不使用 activity tab。** 需要伴随对话看正文时，用「打开到对话」按钮让宿主切到团队会话，
   而不是再注册一个第二界面。
4. 面板内一律 `absolute` / `relative` 定位，禁止 `fixed`、禁止 portal 到 `document.body`
   （面板类 slot 的硬规则，见 `styling-and-pitfalls.md`）。
5. 空状态本身就是引导：没有作品时首屏给「三步开书」而不是一个空看板。

## 3. 后果

- 用户 pin 之后，Novelwright 与内置智能体在侧边栏同一层级，点击即整页——与需求描述一致。
- 侧边栏是稀缺空间：只注册一个入口。将来增加「设置」「评审历史」等页时用 `sidebar: false`
  沉到设置页，不再占用导航位。
- 工作区视图是跨会话的，因此**作品数据必须落 Plugin Storage**（ADR 0005），不能依赖当前会话。
