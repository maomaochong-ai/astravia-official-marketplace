# craft-0026 — `act` 说出它期望什么

- **Status:** Accepted
- **Date:** 2026-11-09
- **Context:** craft 系列 0.0.26
- **Related:** [0009](craft-0009-one-batch-and-a-text-map.md) — `change` 的由来与它的边界、
  [0019](craft-0019-the-agent-looks-at-the-picture.md) — 同一帧的 PNG、
  [0025](craft-0025-settled-means-quiet-not-identical.md) — 落定

## The situation

`change.distance > 6` 只回答一件事：**发生过什么**。它不回答"做对没有"，而这两件事在画布上分得很开：

- 点错图层 → 画面也变了，`changed: true`；
- 滤镜跑了但参数不对 → 画面也变了，`changed: true`；
- 点了两次、第二次把第一次撤掉 → 前后几乎一样，`changed: false`，其实做了两件事。

`SKILL.md` 里已经写了规矩（"`ok: true` 只表示事件发出去了""同一个位置两次没反应就换方法"），
但那是提醒，不是机制：模型看不见判据，就只能在"我觉得应该对了"上做决定。

业界把这件事交给断言：OSWorld 的每个任务自带 `evaluator`，拿**标准答案产物**和**实际产物**按类型比
（示例里是 `func: "compare_table"`）；`midscene` 的 `aiAssert('选中的方案有蓝色描边和勾')` 直接对着
`<canvas>` 断言；`egui_kittest` 是"钦定基线 + 阈值"。三者共同的形状是：**先把期望写下来，再判。**

## The decision

**在已有的两个读工具上加 `expect`，不新增工具。**

```
expect: {
  region?: {x,y,w,h},        // 分数矩形，默认整帧
  meanRgb?: [r,g,b],         // 期望的平均色
  distance?: number,         // 允许的偏差，默认 6
  against?: "baseline",      // 与钦定基线比，而不是与字面量比
  name?: string,             // 基线名，默认 "current"
  text?: string              // 人读的期望描述，进 HUD 与结果，不参与判定
}
```

- `act` 在批次之后、`probe` 单独调用时，都返回
  `assert: { ok, observed: {meanRgb, distance, drift}, failed: "mean" | "baseline-missing" | null }`；
- 基线是项目里的一份**读数**：`.craft/<APP.id>/baseline/<name>.json`，内容是文字地图 + 平均色 + 采样格栅。
  **它不是图片**：插件里没有 PNG 解码器，而两张像素相同的 PNG 字节并不相同（编码器、时间戳都会差），
  用字节比就会把“一样”判成“不一样”。比像素是 [0019](craft-0019-the-agent-looks-at-the-picture.md) 的事：
  把 `shot` 交给模型自己的 `Read`。基线不进 `shots/` 的 6 张轮转——基线被自动删掉就等于断言悄悄失效；
- 写基线是 `probe` 的 `remember_as: "<name>"`，读是 `expect.against: "baseline"`；
  `expect.region` 会让判定额外探一次那块矩形，否则整帧的读数会被当成那块矩形的答案；
- `against: "baseline"` 而基线不存在、或**几何**（`region` 矩形与 `columns`/`rows`）对不上时，
  返回 `failed: "baseline-missing"` / `"grid-mismatch"`，**不当作通过**——左半边的基线对右半边
  没有任何意义，哪怕格栅一样；
- `assert.ok === false` 时，工具描述里写死一条：不要在同一坐标重试同一批。

## 三个词从此分开用

| 词 | 回答什么 | 谁是权威 |
| --- | --- | --- |
| `settled` | 画面安静下来了没有 | `_wait`（0025） |
| `change` | 期间发生过什么 | `delta(before, after)` |
| `assert` | 我期望的那件事发生了没有 | `expect` |

三者不可互相替代，也不等于"用户想要的最终结果"——最后这一条仍然要人看 PNG。

## What this does not do

- **它不判断"好看"。** 对齐、字距、渐带这些只有 [0019](craft-0019-the-agent-looks-at-the-picture.md) 的 PNG 能答。
  `expect` 只能判可度量的部分：平均色、区域差异、与基线的距离。
- **它不替模型写期望。** 期望错了，`ok: true` 就是错的。唯一的缓解是 `text` 进结果，让用户读得到那句期望。
- **它不做多基线。** 一条 `expect` 对一个基线；要 A/B 就两次调用。
- **它不保证基线可跨机器复现。** 同一台机器同一后端才可比；换了 GPU 或缩放，阈值要重新定
  （`egui_kittest` 在这件事上的警告同样适用）。

## The cost

- 每次带 `against` 的断言要多读写一个小 JSON；`expect` 只带 `meanRgb` 时不碰文件。
- 容差是双刃：太松则"什么都能过"，太紧则"每次都不对"。默认值沿用 `change` 的那一组数（6 / 0.02），
  出现误判时先看 `observed`，再调 `distance`，不要先换基线。
