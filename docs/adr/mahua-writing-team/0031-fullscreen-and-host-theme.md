# ADR 0031 — 全屏就是这一张纸、配色跟着宿主走

- 状态：已接受（2026-10-31）
- 版本：0.4.20 → 0.4.21
- 决策对象：`src/features/workbench/components/WorkbenchSurface.tsx`、`shell/Studio{Shell,Masthead,Rail}.tsx`、`src/index.tsx`、`src/studio-ids.ts`、`src/style.css`、`src/features/workbench/hooks/use-host-mode.ts`（删除）、`locales/{en,zh}.json`、`plugin.json`
- 取代（部分）：[0025](./0025-continue-reads-and-studio-as-activity-tab.md) §2.2「工作台是一枚活动面板标签」（它当时还留了第二条路，即 workspace view）、[0030](./0030-layout-round-two-roll-inside-sheet.md) §2「换位门放竖栏底部」
- 延续：0006（只用令牌）、0026（宿主令牌）、0028 §1（朱砂 = `primary`）、0030（滚动收进圆角）

## 1. 当时的事实

1. **配色与宿主脱节。** `src/style.css` 里 `.mahua-root` 是一块硬编码的浅色纸面，深色只在
   `[data-mahua-mode="dark"]` 下换一份手写值；`use-host-mode.ts` 靠 `matchMedia` 和一处宿主
   DOM 属性猜当前模式。宿主换成 mono 主题、或用户在设置里改主色，插件纹丝不动——五级明度
   与朱砂都还是插件自己那套。
2. **「全屏」名不副实。** 竖栏底部的换位门打开的是宿主 workspace view：它渲染在 app shell
   里（`PluginWorkspaceViewRoute` 的挂载点就在 `<AppFrame>` 之内），侧栏、页头、其他插件的
   标签都在。用户看到的是「换了个地方显示」，不是「只剩这个插件」。
3. **宿主管家侧栏多一条「麻花小说网」。** 注册 workspace view 的副作用：`sidebar: true` 会
   在宿主的插件列表里加一个入口，点进去还是上一行那种壳里套壳。用户明确说这条是冗余的。
4. **「跳转到侧栏对话」是个死门。** `use-team-reveal.ts` 靠扫宿主的 `.input-card` 找
   `[contenteditable="true"]` 再聚焦——宿主没有「聚焦侧栏」的 API，SDK 也没有；宿主换个输入框
   实现它就静默失灵。按钮留着只会让人以为坏了。
5. **窄宽下文字与筛选带被裁。** 阅读页 `PageHeader` 的 meta 行没有收缩余量，书库筛选带
   `h-10 overflow-hidden` 在 <640px 时把最后一个 chip 切掉半个；书库行与卷名/弧名同样没有
   `truncate`，长标题把圆角容器撑开。

## 2. 决定了什么

**① 全屏 = 同一个根节点切 `fixed inset-0`，不用 portal、不换宿主位置。**

`WorkbenchSurface` 的根节点：

```tsx
<div
  ref={surfaceRef}
  className={`mahua-root flex min-h-0 w-full flex-col overflow-hidden ${
    fullscreen ? "fixed inset-0 z-[60]" : "h-full"
  }`}
  data-fullscreen={fullscreen ? "true" : "false"}
>
```

四条理由，按顺序：

- 宿主做不到「只有插件」。`openWorkspaceView` 渲染在应用外壳内，侧栏与页头都在；SDK
  （`@astravia-org/plugin-sdk@0.3.11` 的 `ui.ts` / `activity-tab.ts`）没有隐藏侧栏、没有窗口
  全屏 API。所以这件事只能由界面自己铺满视口。
- 插件 CSS 编在 `@scope ([data-astravia-plugin-root=…])` 里，`:root` 级选择器碰不到宿主
  chrome。唯一能扩到整窗的东西就是自己的这一块画布。
- `fixed` 不受祖先 `overflow: hidden` 裁剪。宿主挂载点
  （`PluginActivityTabPanel` 的 `flex min-h-0 flex-1 flex-col overflow-hidden`）只有
  `overflow-hidden`，没有 `transform` / `filter` / `contain`，固定定位仍相对视口。
- portal 会把自己踢出 `@scope`。要补一个作用域根，而那个根是
  `display: contents` 且不带 class（`plugin-i18n.tsx`），Tailwind 类写上去会被静默丢弃；
  `astravia-ui-design` 的 `plugin-portal.tsx` 就是这么绕的，本插件没必要复刻一遍。

**② 不做 remount。** 同一棵子树在两个父节点之间搬移必然卸载重挂，书库筛选、阅读字号这些
页内 state 会重置。切 `fixed` 只改定位，state 全留——这是不用 portal 的第四条理由，也是它比
「两个入口各挂一份」好的地方。

**③ 删掉整页视图注册，宿主管家侧栏不再有这条。** `src/studio-view.ts` 整文件删除，
`src/index.tsx` 只留 `registerStudioTab`，`src/studio-ids.ts` 只留 `STUDIO_TAB_ID`，
`plugin.json` 的 `ui.slot.workspace-view` 一并还回去。代价是失去深链路由（宿主 URL 里不能再
直接落到工作台），用户接受。

**④ 报头兼作标题栏，全屏键常驻右槽。** 覆盖整窗后宿主的窗口控制键被盖住，所以：

- `header` 在全屏时加 `.mahua-drag`（`-webkit-app-region: drag`），里面每个可点的东西由
  `.mahua-drag :where(button, a, input, select, textarea, [role="button"])` 反标 `no-drag`；
- mac 上再让出左侧 5.25rem（`.mahua-traffic-lights`），平台由
  `document.documentElement.dataset.platform === "mac"` 嗅探一次，不在 CSS 里写
  `:root[data-platform="mac"]`（`:root` 在 `@scope` 内不可达）；
- 键盘退路：全屏期间监听 `Escape`。

**⑤ 全屏键从竖栏底部搬到报头右槽。** 它是外壳能力，不是某一页的动作；放在报头就不随页面变，
bare 页（运行台 / 激活页）没有竖栏也能到。竖栏底部因此只剩写作卡、凭证行、折叠键，三行都不带
描边——收起成 44px 图标列时描边卡片会碎成一堆短横。

**⑥ 配色全部从宿主 token 派生，深浅交给 `light-dark()`。** `.mahua-root` 用
`light-dark()` + `color-mix(in oklab, …)` 从 `--background` / `--card` / `--foreground` /
`--border` / `--primary` 推出五级纸面、三档墨色、三档线、状态色与投影；宿主在
`:root,[data-mode="dark"]` 与 `[data-mode="light"]` 上都设了 `color-scheme`，它会继承进插件
子树，所以 `light-dark()` 自己就知道现在是哪一档。`data-mahua-mode`、`use-host-mode.ts` 一并
删除。

**朱砂不再自己写死，直接取 `--primary`。** 0028 §1 已经定了「朱砂 = `primary`」，但当时的值仍是
一句写死的色号。现在 `--mahua-cinnabar: var(--primary)`，`cinnabar-soft` / `cinnabar-ink` 用
`color-mix(in oklab, …)` 从 `--primary` 与 `--card` / `--foreground` 推——宿主换主色、换 mono，
戳就跟着走。代价是插件失去固定的品牌红（宿主主色是蓝，戳也是蓝）；封面 `.mahua-cover` 属
插画资产，保留暖色不动。

**⑦ 窄宽一律截断，不靠容器长高兜底。** `PageHeader` 左块 `min-w-0 flex-1` + `h1` 加
`truncate`（少了 `flex-1` 拿不到可收缩长度，`truncate` 不生效）；阅读页 meta 行补 `min-w-0`；
书库筛选带由 `h-10 overflow-hidden` 改为 `min-h-10 flex-wrap gap-y-1.5 py-2`（宁可长两行，
也不让某个 chip 只剩一半）；书库行去掉 `divide-y` 改 `space-y-1` + 每行 `rounded-control`，
卷名与弧名补 `truncate`。

## 3. 后果

- 全屏期间宿主窗口控制键不可用，只能靠 Esc 或报头那枚键退出。这是「模态全屏」的常规取舍
  （VS Code 的 zen mode 同理），已在报头键的 `title` 与 `aria-label` 上写明。
- 插件不再有深链路由；宿主 URL 里没有工作台这一站。
- 宿主换成 mono 主题、改主色、切深浅，插件会跟着变——但朱砂不再是固定的品牌红。
- `test/manifest-guards.test.ts` 的守卫跟着反转：从前是「features 内一律不许 `fixed`」，
  现在是「`fixed` 只许出现在 `WorkbenchSurface.tsx`，全仓不许 `createPortal`」。

## 4. 未验证

- `light-dark()` 的实际取色：需要宿主浅色 / 深色 / mono 三种主题下各看一眼。
- `.mahua-traffic-lights` 的 5.25rem 是否刚好让开 mac 的三个原生按钮：需实机确认。
- `fixed` 在宿主 tab 切换动画期间的实际定位：宿主若给祖先临时加 `transform`，`fixed` 会改
  相对该祖先解析。静态检查排除了常驻的 `transform` / `filter` / `contain:`，动画帧未验证。
