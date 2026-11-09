# craft-0025 — 落定的判据是"安静"，不是"完全相同"

- **Status:** Accepted
- **Date:** 2026-11-09
- **Context:** craft 系列 0.0.26
- **Related:** [0009](craft-0009-one-batch-and-a-text-map.md) — 字母地图与 `change` 的来源、
  [0026](craft-0026-act-says-what-it-expects.md) — 落定之后仍要断言

## The situation

`_wait` 现在每 250 ms 探一次画布，`cells` 与 `mean` **连续 `quiet_ms` 完全不变**就算落定
（Observed：`src/tools/craft-tools.ts` 的 `_wait` 循环，`current.cells !== previous.cells || current.mean !== previous.mean`）。

在一张真实画布上，逐格相等是一个比像素管线能给的事实更强的断言：

- 画布是 GPU 合成 + wasm 绘制的，抗锯齿、抖动渐变、光标闪烁都会让个别格子在相邻两帧之间变字母；
- 于是两种坏结果各占一半：要么永远等不到 `settled: true`，每次都跑满 20 s 超时；
  要么把 `quiet_ms` 拉到一秒以上，把"还在算"当成"已经算完"，接着在半个成品上做下一步。

业界没有把逐像素相等当作稳定判据：`egui_kittest` 的快照比较是"逐像素色距阈值 + 允许失败像素数"，
`pixelmatch` / `odiff` 是感知差异（YIQ），Maestro 干脆把等待收进框架而不是让调用方拍数字
（Observed：各自 README；见调研 `topics/03-act-wait-verify.md`）。

## The decision

**一次 look 与上一次比较，两个信号都在容差内就算"这一次没动"；连续 `quiet_ms` 都"没动"即 `settled: true`。**

- `drift`（这一次变了多少比例的格，bridge 已经在算）≤ `0.02`；
- `meanRgb` 的欧氏距离 ≤ `6`。

这两个数与 `describeDelta` 的 `changed` 阈值是**同一组数**（`distance > 6 || drift > 0.02`），
所以"落定"与"变了"互为反面，不会出现两套口径各说各话。

返回里补两个诊断量：`maxDrift` / `maxDistance`——整段等待里最大的一次跳动。
`settled: false` 仍是合法答案（画面在动），它现在还用 `maxDrift` 说明"动得有多厉害"。

## Why not keep exact equality

因为严格相等不是"更保守"，是"更错"：它把噪声当成变化、把超时当成结论，
而超时之后模型只有两个选择——再等一次，或者当作画完继续（`SKILL.md` 里两条都被禁止）。

## What this does not do

- **它不保证"画完了"。** 一个变化极慢的动画（每 600 ms 动一格）会通过容差被判落定。唯一的防线是
  `quiet_ms`，所以调用方在关键步骤后仍要用 [0026](craft-0026-act-says-what-it-expects.md) 的 `expect` 判对错。
- **它不改 `_act` 的返回时机。** `act` 仍在最后一步派发时返回；`_wait` 是显式的一步，不是隐式插进去的。
- **它不新增工具。** 判据换在现有实现里，工具面不变（见 0009 的理由：十五支插件共用一个命名空间）。
