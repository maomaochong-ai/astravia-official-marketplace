# ADR 0030 — 版面第二轮：滚动收进圆角、竖栏换位门、装配门只留一处

- 状态：已接受（2026-10-31）
- 版本：0.4.18 → 0.4.19
- 决策对象：`abilities/plugins/mahua-writing-team/src/features/workbench/**`、`src/studio-{tab,view}.ts`、`src/style.css`、`locales/{en,zh}.json`
- 取代（部分）：[0020](../0020-library-surface-and-default-cover.md) §「整页滚动」、[0026](../0026-design-round-five-surfaces-and-host-tokens.md) §5「页面级滚动」、[0027](../0027-shell-layer-console-and-rail-degradation.md) §2「竖栏只做导航」与 §7「外壳只放同步信息」
- 延续：0006（只用令牌）、0025（双入口）、0029（纸面语言）

## 1. 当时的事实

三件事都被实机截图抓到，不是推测：

1. 拖窄面板时内容重叠挤压。`LibraryPage` 外层套了 `overflow-x-auto` + `min-w-[820px]`，
   两张纸里出现横向滚动条，圆角被内容撑开，左右两侧高度不再相等。
2. 冷启动点「全屏」白屏。`src/studio-view.ts` 直接 `createElement(WorkbenchSurface, …)`，
   没有运行时守卫；`getStudioRuntime()` 抛错 → 整棵子树不渲染。标签页那份有守卫，
   因为守卫写在了两个入口里各一份，漏了其中一份。
3. 圆角卡片下方露出大片 canvas 空档。`main` 是 `overflow-hidden`，但页面根没有
   `min-h-0 flex-1`，内容短时纸面不撑满，长时又被裁掉——两种表现同一个原因。

## 2. 决定了什么

**① 滚动发生在圆角里面，外壳不再滚。**

```text
@container h-full flex-col overflow-hidden            bg-canvas
├─ header   h-12 shrink-0
└─ 内容行    flex min-h-0 flex-1 items-stretch
   ├─ aside w-[208px] shrink-0
   └─ main  min-h-0 min-w-0 flex-1 overflow-hidden rounded-sheet bg-surface
```

页面根只写 `flex min-h-0 flex-1 flex-col`；滚动交给纸内那一层（列表 / 正文 / 表格容器）。
卡片自己 `overflow-hidden`，卡头卡尾 `shrink-0`。双栏都写 `min-h-0`，两栏才会等高。

**② 换位门放竖栏底部，报头右槽让给同步信息。**
非 bare 页（书架 / 书库 / 本册 / 阅读 / 伏笔 / 运行台之外）把「全屏 ↔ 退出全屏」放进竖栏
底部动作区；运行台与激活页没有竖栏，回落到报头右槽。理由：窄面板（<720px）里报头按钮被
`hidden @[720px]:inline` 收起，竖栏那份才是常驻入口；设计稿也是中段导航、底边动作。

**③ 装配门只留一处。** 两个入口都挂 `WorkbenchMount`，`surface` 只决定形态：

```tsx
export function WorkbenchMount({ surface = "panel" }: { surface?: "panel" | "page" }) {
	const ready = useStudioRuntimeReady();
	return ready ? <WorkbenchSurface surface={surface} /> : <StudioBootSkeleton />;
}
```

`WorkbenchScreen.tsx` 删除。骨架与真界面逐层同形（报头 48px + 12px 托底 + 窄栏 + 纸），
否则冷启动换装时纸面会往下跳一次。

**④ 窄了丢列，不压列。** 台账按 1120 / 880 / 680px 逐档丢次要列；`min-w-[820px]` 删除。

## 3. 代价

- 圆角里滚意味着**每个滚动容器都要自己管定高**。漏一个 `min-h-0`，那一栏就会被内容顶开。
- 骨架要跟着真界面改。改版面不改骨架，冷启动就会跳一下——这属于维护成本，不是一次性成本。
- 换位门在竖栏里，**竖栏收起时只剩图标**，可发现性比报头按钮弱。缓解：`title` ＋ `aria-label`
  与文案同源，且报头那份在宽面板里仍在。

## 4. 怎么验证

```bash
cd abilities/plugins/mahua-writing-team
npx tsc --noEmit
npx vitest run
grep -rn "min-w-\[820px\]" src/features | wc -l          # 期望 0
grep -n "component: WorkbenchMount" src/studio-tab.ts
grep -n "createElement(WorkbenchMount" src/studio-view.ts
grep -c "getStudioRuntime" src/features/workbench/components/WorkbenchMount.tsx   # 期望 0
```

守卫测试：`test/manifest-guards.test.ts` 的「survives being rendered before the plugin runtime
exists」断言两个入口都走 `WorkbenchMount`，且该文件不出现 `getStudioRuntime()`。
