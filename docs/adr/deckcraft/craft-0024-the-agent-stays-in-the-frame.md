# craft-0024 — 自动化留在 frame 里

- **Status:** Accepted
- **Date:** 2026-11-09
- **Context:** craft 系列 0.0.26（调研记录在仓库外的 `photocraft-automation-research`）
- **Related:** [0019](craft-0019-the-agent-looks-at-the-picture.md) — 截图那条读通道、
  [0011](craft-0011-the-site-ships-in-the-package.md) / [0012](craft-0012-the-site-is-upstreams-release-bundle.md) — 站点是上游的字节

## The situation

上游 Photocraft 有一整套语义级自动化：`photocraft --control <port>` 的回环 JSON 控制服务
（`engine.commands`、`ui.inspect`、`ui.menu.invoke`、`ui.pointer`、`ui.dialog.*`、`ui.screenshot`）、
`photocraft-cli mcp` 的五个核心工具、以及 `run` / `batch` / `convert` 三个一次性命令
（Observed：上游 `book/src/automation/` 与 `docs/control-protocol.md`）。

第一反应是"升级 pin 就能拿到"。核对过 tag 树之后这个理由不成立：`crates/automation/`、`apps/photocraft-cli/`、
`book/src/automation/`、`docs/control-protocol.md`、`docs/mcp.md` 在 **v0.19.0 就已经存在**
（Observed：`GET /repos/storytold/photocraft/git/trees/v0.19.0?recursive=1` 后按路径过滤，3199 个条目）。

差别在交付形态，不在版本：

- **web 构建里没有控制服务。** `apps/photocraft-web/src/web.rs:421` 原文：*"The browser build has no TCP
  control server, so `inject_synthetic` finds an empty queue"*；0.19.0 的同一句在 `web.rs:343`（Observed，
  两个 tag 各取一份）。合成输入队列本身编译进了 web（`crates/ui-egui/src/lib.rs` 的 `synthetic`，
  `app.rs` 的 `inject_synthetic`），**缺的是投递者**。
- **语义树也不是备选。** `apps/photocraft-web/Cargo.toml` 给 wasm32 开了 `eframe/accesskit`，但
  `accesskit_winit` 在非 Windows/macOS/Linux/Android/iOS 平台落到 `platform_impl/null.rs`
  （`update_if_active` 空实现），AccessKit 官方 README 的 web 适配器仍标为 *Planned*。
  （Observed：`adapters/winit/src/platform_impl/mod.rs` 与 `null.rs`。）

于是必须回答的是一个问题：**要不要为了这层语义能力，把插件从"面板驱动的像素"改成"旁挂一个原生进程"。**

## The decision

不。三条一起定：

1. **不旁挂 `photocraft-cli`。** 它确实能绕开像素（批处理、格式转换、LUT 导出），但代价是三件事：
   插件要拿进程/服务权限（`plugin.json` 的权限表里没有任何进程或服务类条目，这是改权限模型，不是加个开关）；
   它绕开用户正在看的那块画布——"我说它在做"和"我看见了"分家，而这个面板存在的理由就是后者；
   同一件事出现两条路径就有两套失败语义，模型会按"更省事的那条"选，而不是按"更对的那条"。
2. **不等上游，也不把它排进路线图。** 可以提 issue（附 `web.rs` 行号、Photopea 的 Live Messaging 作为先例——
   同样是 iframe 里的画布编辑器，用 `postMessage` 传脚本、执行完回 `done`），但插件的任何计划都不依赖它。
3. **不把升级 pin 当成自动化手段。** 0.19.0 → 0.22.0 有别的理由（三次迭代的修复、更全的命令表），
   但它不改变"web 里没有控制服务"这一条。

## What this does not do

- **它不否认 CLI 的价值。** 批处理与格式转换是真的有用，只是不属于这个面板的能力面；将来要接，
  得先有一条改权限模型的 ADR，而不是在 `craft-tools.ts` 里顺手起个子进程。
- **它不承诺上游永远不会开这个口子。** 真开了，0024 应该被 superseded，而不是被绕过去。
- **它不解决精度问题。** 恰恰相反：把唯一的通道钉死之后，像素通道的精度就是产品本身。
  这件事交给 [0025](craft-0025-settled-means-quiet-not-identical.md)、
  [0026](craft-0026-act-says-what-it-expects.md)、[0027](craft-0027-precision-starts-from-recorded-failures.md)。

## The cost

- 能力上限继续由上游 web 构建决定：没有图层树、没有文本抽取、没有命令 id 直达。`SKILL.md` 必须继续这么写，
  否则模型会去猜一套不存在的 API。
- 每次精度改进都要在 bridge 与工具返回里做，不能"换个后端"了事——这条会一直贵。
