# ADR 0032 — 全屏搬到 body；纸内文字一律跟着宽度退让

- 状态：已接受（2026-11-01）
- 版本：0.4.21 → 0.4.22
- 决策对象：`src/features/workbench/components/WorkbenchSurface.tsx`、`src/studio-ids.ts`、`components/shell/{PageHeader,ScoreBar,ChapterBrief,StudioMasthead,StudioRail}.tsx`、`components/pages/{Library,Shelf,Book,Reader,Console,Ledger,Activation}Page.tsx`、`src/features/workbench/components/StudioTurnCard.tsx`、`test/manifest-guards.test.ts`
- 取代（部分）：[0031](./0031-fullscreen-and-host-theme.md) §2①/②（「全屏 = 同一根节点切 `fixed`，不用 portal」「不做 remount」）与 §3 那条守卫
- 延续：0030（滚动收进圆角）、0031 §2⑥（配色跟随宿主）

## 1. 当时的事实

1. **全屏没盖住宿主的壳。** 0031 让根节点切 `fixed inset-0 z-[60]`，实测截图里宿主顶部的标签条与左侧栏
   依旧画在插件之上。静态复查否掉了「`fixed` 被祖先 `transform` / `filter` / `contain` 改解析上下文」这条
   解释：宿主挂载点只有 `overflow-hidden`。真因是**层叠上下文**——宿主把工作区渲染在
   `z-10` / `z-20` 的壳层里，`fixed` 只在该上下文内部抬到 `z-[60]`，出不去。
2. **不 portal 的理由被证伪。** 0031 §2① 最后一条说「portal 会把自己踢出 `@scope`，要补的作用域根
   不能带 class，Tailwind 类会被丢弃」。实际机制是 `plugin-vite` 把插件 CSS 编成
   `@scope ([data-astravia-plugin-root=<id>]){…}`——**属性选择器**。自建一层同属性包裹壳即命中；
   宿主 preset 插件 `astravia-ui-design/src/plugin-portal.tsx` 一直这么写，包的是
   `display: contents` 的裸 div，class 写在里层元素上，不存在丢弃。
3. **书库的行列对不上，文字换行。** `LibraryPage` 的 `COLUMNS` 在窄宽从 6 列降到 4 列、3 列、2 列，
   但表头与每行**始终渲染 6 个单元格**。`display: grid` 会把多出来的子项放进隐式第二行：容器一窄，
   书库就从「一行一本」变成「一本两行、字被挤到换行、右侧金额错位」。
4. **flex 子项的 `truncate` 大面积不生效。** 全仓约 40 处 `truncate` 缺 `min-w-0`。`truncate` 自带
   `overflow: hidden`，但 flex 子项的 `min-width: auto` 在 `nowrap` 下等于 min-content（整行文字宽），
   于是它拒绝收缩 → 整行溢出 → 被祖先的 `overflow-hidden` 裁掉，右侧 `ml-auto` / `shrink-0` 的元素
   被顶出纸面。这正是「圆角容器里文字被遮挡」的系统性根因，不是某一页的排版失误。
5. **`items-baseline` 与 `truncate` 互相打架。** 带 `overflow: hidden` 的 flex 子项，基线由 border box
   合成，于是同一行里「有截断的文字」与「没截断的文字」基线不一致，看着像掉下去半行。
6. **固定宽度的评审条标签。** `ScoreBar` 的维度名写死 `w-9`（36px）：`Continuity` 这类英文标签必然
   折成两行，中文四字也贴边。评审面板一窄，七条评审条高度全不一样。

## 2. 决定了什么

**① 全屏 = 同一份 JSX 换渲染出口：`createPortal` 到 `document.body`。**

```tsx
const surface = (
  <div
    ref={surfaceRef}
    className={`mahua-root flex min-h-0 w-full flex-col overflow-hidden ${
      fullscreen ? "fixed inset-0 z-[2147483000] bg-canvas" : "h-full"
    }`}
    data-fullscreen={fullscreen ? "true" : "false"}
    role={fullscreen ? "dialog" : undefined}
    aria-modal={fullscreen ? true : undefined}
    aria-label={fullscreen ? t("window.fullscreen") : undefined}
  >
    …<StudioShell … />
  </div>
);

if (!fullscreen) return surface;

return createPortal(
  <div data-astravia-plugin-root={STUDIO_PLUGIN_ID} style={{ display: "contents" }}>
    {surface}
  </div>,
  document.body,
);
```

- `fixed` 只有挂在 `body` 下才脱离宿主的层叠上下文；`z-[2147483000]` 是给整个宿主壳（`z-10`…`z-50`、
  弹窗 `z-[100]`+）留出的上限，不是一个随手挑的整数。
- 包裹层 `display: contents`：不产生盒子，不参与布局，`@container` 仍按 `StudioShell` 根节点的
  实际宽度算（`@container` 就写在那上面）；带属性即满足 `@scope`，样式不丢。
- 加 `bg-canvas`：搬出宿主面板后底下是宿主整窗背景，不铺就不透。
- 加 `role="dialog"` / `aria-modal`：它现在确实是一个模态层，键盘与读屏都该按模态处理。
- 全屏期间 `document.body.style.overflow = "hidden"`，退出时还原：否则滚轮会带着被盖住的宿主继续滚。
- `STUDIO_PLUGIN_ID` 落在 `src/studio-ids.ts`，与 `plugin.json` 的 `id` 逐字一致（`manifest-guards`
  有断言）。不写常量就得去 DOM 里猜自己属于哪个作用域。

**② 接受 remount，写在明处。** `createPortal` 与普通 JSX 的 fiber 类型不同，切换必然卸载重挂：
书库筛选、阅读页字号/字体这类页内 state 会重置。这比 0031 §2② 的承诺退了一步，但换来一条确定
的覆盖路径——0031 那版「不 remount」的全屏根本没盖住壳，留 state 毫无意义。阅读字号是偏好，
本来就走存储，重挂后由 `use-studio-state` 读回来；筛选是临时视图，重置可接受。

**③ 不申请窗口全屏、不调宿主侧栏 API。** `requestFullscreen()` 会改窗口状态、动画突兀，还可能被
`webPreferences.fullscreenable` 关掉；`setActivityPanelWidth` / `getSidebarState` 只在宿主 0.5.83 上
确认存在，而 `minAppVersion` 仍是 `0.5.60`。覆盖整窗后宿主侧栏在视觉上就不存在了，够用。

**④ 书库保留 4 档列模板，按档位隐藏单元格，列数必须与单元格数相等。**

```tsx
const HIDE_GENRE = "@max-[1120px]:hidden";   // 题材·篇幅 / 字数
const HIDE_CHAPTERS = "@max-[880px]:hidden"; // 章数·进度
const HIDE_UPDATED = "@max-[680px]:hidden";  // 更新
```

逐档核对（模板顺序 = 书名 | 题材 | 阶段 | 章数 | 字数 | 更新）：

| 容器宽度 | 模板 | 显示 | 隐藏 |
| --- | --- | --- | --- |
| > 1120 | `[1fr_150px_74px_196px_78px_88px]` | 六列 | — |
| ≤ 1120 | `[1fr_74px_150px_88px]` | 书名 / 阶段 / 章数 / 更新 | 题材·篇幅、字数 |
| ≤ 880 | `[1fr_74px_88px]` | 书名 / 阶段 / 更新 | 再隐藏章数 |
| ≤ 680 | `[1fr_74px]` | 书名 / 阶段 | 再隐藏更新 |

`display: none` 的子项不参与 grid 自动布局，隐式第二行随之消失。**这条规则写进守卫测试**：
`COLUMNS` 里每一档的轨道数，必须等于该档可见单元格数——不然下次改列又会悄悄错位。

**⑤ `truncate` 三件套：`min-w-0` + `flex-1`（或 `min-w-0` + 定宽）+ `truncate`。**

只要文字是 flex 子项、又可能比容器长，就必须显式放弃 `min-width: auto`。本轮补齐的位置：
`StudioRail` 导航项、`StudioMasthead` 的 section / 停止条、`StudioTurnCard`、`ShelfPage` 流水行、
`ConsolePage` 页头 meta、`LedgerPage` 表头五格、`ActivationPage` 公钥行与事实格、
`BookPage` 弧线进度 / 检查点 / 卷内弧名、`LibraryPage` 台账卡头与行内四格、`ChapterBrief` 弧名与章名。

`PageHeader` 的 `meta` 统一包一层 `min-w-0 flex-1 basis-[12ch]`：标题够长时元信息整体换行到下一行，
而不是把标题压成一行省略号——标题是这一页唯一不可省的信息。

**⑥ 带 `truncate` 的行改 `items-center`。** `ShelfPage` 三处、`ConsolePage` 检查点行、
`StudioTurnCard`、`ActivationPage` 公钥行、`BookPage` 弧线进度行。纯文本或者纯按钮的行**不动**：
那些行的基线对齐本来就是对的，改 `items-center` 只会让换算出来的视觉位置偏一点。

**⑦ 评审条标签给固定宽 + 截断。** `ScoreBar` 的标签由 `w-9` 改为 `w-[5.5rem] truncate`：
最长的 `Continuity` 与四字中文都放得下，超出就省略号，七条评审条的墨条起点因此对齐。

**⑧ 双栏与表格式区块改「基础态即窄态」。** 用 `@min-[…]` 正向声明宽态，而不是层层叠加 `@max-` 覆盖：
`ActivationPage` 双栏 `@min-[900px]:flex-row`（aside 基础 `w-full`，宽态才 `w-[420px]`）、事实三格
`@min-[640px]:grid-cols-[auto_1fr_1fr]`、失败码/打开方式双栏 `@min-[720px]:grid-cols-2`。
「标签 + 值 + 右注记」的行一律 `flex-wrap` + `gap-x-*` / `gap-y-*` 兜底。

**⑨ 报头全屏键的文案窄宽收起。** 按钮本身留着（它是全屏时唯一的图形退路），只把文字
`hidden whitespace-nowrap @[760px]:inline`，靠 `title` / `aria-label` 保底。

## 3. 后果

- 全屏真的只剩插件：宿主标签条与侧栏都被盖住，Esc 与报头那枚键退出；代价是全屏期间页内临时
  state 重置（§2②）。
- 全屏期间宿主窗口控制键不可用，只能走拖拽区 + Esc，这条路未变（0031 §3 那条取舍仍然成立）。
- 插件样式不再依赖「自己长在宿主挂载点里」——`createPortal` 之后作用域靠属性自己带。
  以后再有需要覆盖整窗的东西，照这一套写，不许各自发明。
- 守卫反转三处：`createPortal` 从「全仓禁止」变成「只许在 `WorkbenchSurface.tsx`」；
  `fixed` 仍只允许那一处，但类串换成 `fixed inset-0 z-[2147483000] bg-canvas`；
  新增「书库列数与可见单元格数一致」一条。
- 窄宽下书库不再换行、右侧注记不再被顶出；但 ≤1120px 时看不到字数与题材，≤880px 时看不到章数
  进度——这是有意的取舍：宁可不显示，也不显示半行。

## 4. 未验证

- 拖拽分割线改变宽度时的实际断点行为：仓库没有布局引擎，只能靠类名与容器查询断点断言，
  真机拖一次才算数。
- `fixed` + `z-[2147483000]` 与宿主弹窗（`z-[100]`+）同时出现时的次序：静态推算应压过，未实测。
- `light-dark()` 在宿主浅色 / 深色 / mono 三种主题下的实际取色：仍需实机看一眼（0031 §4 未结项）。
- mac 红绿灯让位 `.mahua-traffic-lights` 的 5.25rem：需实机确认（0031 §4 未结项）。
- `items-baseline` → `items-center` 的具体视觉位移：按 flexbox 基线规则推断，未逐屏比对截图。
