# 0004 — Adapter 在页面里主动观察，而不是被动读 DOM

- 状态：已落地（2.7.0）
- 日期：2026-11-01
- 相关：[0001](./0001-userscript-adapter-layer.md) §5、[0003](./0003-builtin-adapters-supersede-0001.md)

## 1. 问题

2.6.x 的内置适配器能读到 `<video src>`、`og:video` 和播放器全局，但视频号一律只回 `metadataOnly`，
   `Page Sniffer` 又要求地址带 `.m3u8` / `.mp4` 之类的扩展名。真实取流地址是

```
https://finder.video.qq.com/251/20302/stodownload?encfilekey=…
```

没有扩展名，于是被 `looksMedia()` 直接丢弃；即使不丢，未登录页面上也确实没有这个请求。

## 2. 诊断

一个 Tampermonkey 脚本能在任何站点工作，靠的不是每个站点各写一份解析，而是四件宿主免费给它的能力：

| 能力 | 用户脚本 | 2.6.x 的 Adapter |
| --- | --- | --- |
| 在 `document_start` 注入 | 有 | 无（`load` 之后才注入） |
| 看见页面发出的每个请求（`fetch` / `XHR`） | 有（同源同上下文） | **无** |
| 读播放器私有状态 | 有 | 部分（只能读约定好的全局） |
| 用同一份 Cookie 去请求媒体 | 有 | 无（Adapter 不下载，URL 交给引擎） |

缺的不是「更多站点规则」，是**第二行**：早期媒体请求发生在 Adapter 注入之前，而 Adapter 之后
什么也不做。站点登录门控只是让这件事更明显——没登录时本来就没有请求可看。

## 3. 决定

Adapter body 允许（并要求）在运行期间**主动观察并诱导**页面行为：

1. **hook 请求**：临时替换 `window.fetch` 与 `XMLHttpRequest.prototype.open`，把每个 http(s) URL 记进候选表，
   在 `finally` 里还原（离屏窗口会复用，漏还原等于污染下一次 run）。
2. **诱导播放**：非 `NEEDS_LOGIN` 且此刻还没有强候选时，调一次 `video.play()`（失败无所谓），
   或点一次播放控件；随后最多等 2.5 s，每 200 ms 检查一次是否已经有可排名的候选。
3. **扩展名宽容**：`looksMedia()` 增加 CDN 特征（`stodownload` / `encfilekey` / `videoplayback` / `playurl` …）
   与「路径里带 `playlist|master|media|stream`」两种形态；`<video>` / `<audio>` / `<source>` 绑定的地址无条件接受。
4. **登录即信号**：页面侧 `throw new Error('NEEDS_LOGIN:…')`，runner 侧剥成 `loginRequired`，
   **不调用 `releaseOffscreen`**，让下一次重试落在同一个已登录页面上。

## 4. 为什么不选另外几条路

| 方案 | 否决理由 |
| --- | --- |
| 给每个站点写一个 extractor | 视频号这类站点的取流由客户端下发，逆向后仍是登录态 + 签名，规则会腐烂；成本与覆盖率不成比例 |
| 移植 Tampermonkey 运行时到 `document_start` | 宿主没有 `document_start` 注入点，`ctx.capture.offscreen` 只有 `prepareScript`，注入时机由宿主决定 |
| 用 `browser.sessions`（headed + persistent profile）代替 offscreen | 它确实共享登录态，但**没有任意 JS 求值**能力，取不到页面全局与请求 |
| 让 Adapter 自己带 Cookie 去下载 | Adapter 永不下载（0001 §4）；Cookie 会进 `ps` 与任务记录 |

## 5. 已知代价（Assumed，见 README 的 Known unknowns）

- `releaseOffscreen` 被跳过时，「同 `sessionKey` + 同 URL 复用窗口」是 SDK 文档承诺的行为；
  宿主闲置回收与跨 run 的 Cookie 归属**没有文档**，只能实机验。
- 2.5 s 的等待上限对慢速会员页可能不够；上限是「面板不能长时间无响应」与「给播放器一次机会」的折中。
- hook 只覆盖 `fetch` / `XHR`。用 `sendBeacon` 或 WebSocket 拉流的站点仍然看不到。
