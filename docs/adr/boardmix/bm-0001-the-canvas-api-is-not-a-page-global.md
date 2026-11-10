# bm-0001 — 画布 API 不是页面全局，我们不假装它是

- **Status:** Accepted
- **Date:** 2026-11-10
- **Context:** boardmix 1.8.5 桌面端（`app.asar`）与 `cdnhw.boardmix.cn` 的 web 构建
- **Related:** [bm-0002](bm-0002-mermaid-is-the-semantic-bridge.md)、[bm-0003](bm-0003-the-ai-panel-is-the-agent.md)、
  分析记录 `.rea/boardmix-1.8.5/README.md`

## 事实

web 构建里有一个完整的画布对象模型 API（`xWt`，7.6 KB）：`createSticky` / `createShape` / `createText` /
`createMM` / `createTable` / `createConnector` / `createFrame`、`move` / `resize` / `remove` / `select`、
`zoomTo` / `setView`、`frameAddItem` / `MMAddSub`、整套 `setText*` / `setFill*` / `setStroke*`。
`createSticky({x,y,width,height,content,style})` 返回 `{id,type,subType,style,props}`——是对象，不是像素。

它怎么被挂出去：`Xs && Qt.bind("boardOpenApi", xWt)`，`Xs` 是调试开关；扁平包装 `FWt` 供 `/embed` 与
`/sdk` 这条 SDK 路使用。包里 **没有** `window.boardmix` / `__boardmix` / `globalThis.boardmix`（0 命中）。

我们的面板加载的是 `/app/`，跨源、且页面不暴露这个对象；`<webview>.executeJavaScript` 能读到 DOM、
读不到模块作用域里的 `xWt`。

## 决定

**不提供"直接调用画布 API"的工具，也不在技能里说可以这么做。**

- 不注入伪造的 `window.boardmix` 垫片去猜 API 形状：猜错的那次会真的改坏用户的画布。
- 不把 `createSticky` 之类的名字写进工具参数，让人以为它们可调用。
- 自动化只走三条**已证实**的路：DOM/输入驱动页面、产品自己的 Mermaid 转换（[bm-0002](bm-0002-mermaid-is-the-semantic-bridge.md)）、
  产品自己的 AI 面板（[bm-0003](bm-0003-the-ai-panel-is-the-agent.md)）。

## 边界与代价

- 能力上限仍是"能把产品推到正确入口、把输入送进去、把结果拍下来核对"，不是"任意构造图形"。
- 若将来 `/embed` 证明可在跨源下驱动，这一条应被新的 ADR 取代，而不是被绕过。
- 分析里没有验证的事（`/embed` 的鉴权边界、AI compositor 是否接受合成 paste）标为 unknown，
  工具必须能在这些点上失败得清楚，而不是假装成功。
