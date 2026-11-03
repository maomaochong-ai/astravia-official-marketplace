# 非活动标签停手，而不是让它继续画

## 症状

装上一支 craft 插件、把它的编辑器打开过之后，宿主的对话切换和整个界面开始变卡；
插件标签本身早就切走了，卡顿却一直跟着。关掉那个标签就恢复正常。

## 根因

两层叠在一起：

1. **标签被当作常驻。** 活动面板的驻留策略把用户主动打开过的标签记为 `pinned`，
   切走之后 iframe 文档不销毁，也不 reload——这是对的，编辑器里有未保存的工作。
2. **`display:none` 不停止绘制。** 隐藏标签在 `ActivityPanelView` / `ActivityTabSurface` 里
   只是换成一个 `hidden` class。对 DOM 来说"不显示"，对那个文档里正在跑的循环来说什么都没变：
   上游的 egui/winit Web 构建照旧按帧请求动画帧，一帧不落地算完，只是没人看得见。

一个 1080p 画布在后台按 60 fps 跑，加上每帧的 GPU 提交，宿主当然会卡。

## 决定

暂停闸门放在 **bridge**，也就是页面内部，而不是宿主侧。

`host-bridge.js` 包住 `window.requestAnimationFrame` / `cancelAnimationFrame`：
收到 `craft:pause` 之后，所有帧请求被收进一个 `Map` 并返回一个**负数 id**，
`craft:resume` 时按原顺序重新交给原生 `requestAnimationFrame`，一个不丢、一个不重。
原生 id 空间完全不动，我们的 id 是负数，任何 `cancelAnimationFrame` 都不会摸到别人的回调。

为什么不是宿主侧：

- 宿主要"停止绘制"一个外来文档，只有两条路——销毁它（丢未保存工作），或者改它的代码
  （那就不是"跑上游原样的构建"了）。两条都不能接受。
- 应用自己的循环是唯一请求帧的人。谁请求帧谁就能被暂停，这个杠杆在页面里，不在宿主里。

## 谁在什么时候发

`use-craft-editor.ts` 用 `useActivityTab()` 判断当前标签是不是活动的：

- `everActive` 兜底：宿主的默认 context 是 `{active: false}`，且不会报错。如果直接信它，
  一个还没被激活过的标签会被立刻暂停。所以只有**见过 `active === true`** 之后才允许暂停。
- 只在 `paused` 真的变化（或 `phase` 变化）时发一次：`{type: paused ? "craft:pause" : "craft:resume"}`。
- 依赖里带 `phase`：iframe reload 之后是一个**全新的、未暂停的** bridge，靠 `starting → ready`
  这一次变化重新告诉它当前可见性。`postMessage` 能送到 `display:none` 的 frame，
  `requestAnimationFrame` 不能——这也是为什么这条消息必须由宿主主动发，而不是等页面来问。

## 手势与暂停的关系

`click` / `type` / `press_key` 打到的是**看不见的**标签时，事件会被排进一个永远不会跑的帧里。
所以 bridge 的 `pointer()` / `keys()` 在处理前先调 `resume()`：投递手势意味着"这个标签现在要被操作了"，
让它先活过来，再派发。宿主那边的 `paused` 状态不用改——用户切回来时会照常收到 `resume`。

## 验证与未验证

- Observed：`tests/craft-bridge.test.mjs` 在一个桩 DOM 里用 `vm` 跑真的 bridge，断言暂停后帧请求
  被扣住、恢复后原样放行、负数 id 不干扰原生 id；全部通过。
- Observed：`ActivityPanelView` / `ActivityTabSurface` 用的是 `hidden` class 而不是卸载，
  驻留策略 `activity-tab-residency.ts` 对用户打开过的标签返回 `pinned`。
- Inferred：上游 Web 构建的绘制循环确实由 `requestAnimationFrame` 驱动。**没有**在真机上直接量过
  暂停前后的 CPU 占用；验证路径是打开一支插件标签、切走、看宿主进程 CPU 是否回落，
  再切回来确认画面继续动（`docs/adr/photocraft/probe-embed.mjs` 那套思路可以复用）。
- 没有解决的部分：文档本身仍在内存里（这是"未保存工作不丢"的代价），
  payload 首次解码、WebGL 上下文占用也都不受这个闸门影响。这个决定只关掉持续绘制。
