# video-downloader 插件 ADR 索引

这四份 ADR 记录「把 Tampermonkey 的页面内提取能力接进插件」这件事为什么这样做、为什么不做另外几种。
0001 / 0002 是**提议**状态，正文只代表 2026-11-01 的判断；0003 已随 2.6.0 落地，并且超替 0001 §2 的「零内置站点脚本」；
0004 说明 2.7.0 为什么让适配器去 hook 页面请求、而不是继续追加站点规则。
0001 / 0002 是**提议**状态，正文只代表 2026-11-01 的判断；0003 已随 2.6.0 落地，并且超替 0001 §2 的「零内置站点脚本」。

| ADR | 主题 | 状态 |
| --- | --- | --- |
| [0001](./0001-userscript-adapter-layer.md) | Adapter 层：解析路径三态化（`engine` / `adapter` / `direct`），Tampermonkey 20 个 GM API 只采纳 4 个 | 提议（2.5.0 目标） |
| [0002](./0002-panel-information-architecture.md) | 面板三视图（Extract / Adapters / Settings）+ 状态分域，取代内联折叠 | 提议（2.5.0 目标） |
| [0003](./0003-builtin-adapters-supersede-0001.md) | 三个内置只读适配器随插件发布，超替 0001 §2 的「零内置站点脚本」 | 已落地（2.6.0） |
| [0004](./0004-adapter-observes-requests.md) | Adapter 在页面内 hook `fetch`/`XHR`、诱导播放、扩展名宽容，登录门控时保留离屏窗口 | 已落地（2.7.0） |
| [CONTEXT.md](./CONTEXT.md) | 术语表：Source URL、Media Item、Format、Extraction Path、Adapter、Coverage | 现行 |

## 读法

先读 0001 §4 的路径三态表，它是整件事的地基：一个 Media Item 只能有一条解析路径，Adapter 永不下载。
0002 的三视图只是这条约束的界面投影——Adapters 视图存在的前提，是 Adapter 与 Engine 在数据上是同一个东西。

0001 §6 的采纳/裁剪表是「功能不冗余」的判据。想往里加一个 GM API 之前，先在表里找到它被裁掉的那一行，
看理由是否已经变了；变了就补新 ADR，不要直接改代码。

## 三个未验证的假设

0001 §5 列了三条 **Assumed**，它们决定 Adapter 层到底值多少。落地前用一条最小脚本验一遍，
验证命令写在表里：

```js
// ctx.capture 可用性（旧宿主为 undefined）
typeof ctx.capture === "object"

// 假设一：离屏窗口不共享登录态
probeScript: "JSON.stringify({ cookies: document.cookie.length, keys: Object.keys(localStorage).length })"
```

三条都不成立时，Adapter 退化为「无提取器站点的静态 DOM 抓取」，仍然成立但要重写 0001 §8 的收益估计。

## 复现本文档引用的事实

```bash
cd abilities/plugins/video-downloader

# 下载命令写死 Source URL（0001 §7）
sed -n '206p' service/src/tasks/download-runner.ts

# capture 是可选能力（0001 §5）
grep -n "capture?:" node_modules/@astravia-org/plugin-sdk/dist/context.d.ts

# 权限枚举含 capture.offscreen（0001 §8）
grep -c "capture.offscreen" node_modules/@astravia-org/plugin-sdk/dist/manifest-schema.d.ts

# 站点 53 条、其中 9 条有 reason（0002 §4 的 44 / 53）
grep -c "reason:" service/src/media/site-capabilities.ts

# 面板现状：内联两处（0002 §1）
grep -n "coverageOpen\|settingsOpen" src/features/downloader/components/downloader-view.tsx
```
