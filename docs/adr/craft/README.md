# craft 系列决策记录

七支 craft 插件（DesignCraft、EffectCraft、FilmCraft、LightCraft、PDFCraft、VectorCraft、Photocraft）
共用一套宿主侧代码，钉住七个不同的上游 Web 构建。这里记的是**它们共同的决定**：为什么是七份副本而不是
一个生成器、字节怎么在宿主和页面之间走、为什么非活动标签要停、Agent 怎么真正驱动画布、技能文档
为什么决定了插件能不能被用起来。

单个应用自己的决定（钉哪个上游版本、它有哪份文档、它的界面有哪些特殊之处）在
[`../designcraft/`](../designcraft/)、[`../pdfcraft/`](../pdfcraft/) 一类目录里，不在这里重复。

代码头注释里还会看到 `docs/adr/photocraft/…` —— 这些决定最早是在 photocraft 里写下的，路径仍然有效；
读序从本目录开始，需要细节时再跳过去。

## 读的顺序

1. [CONTEXT.md](CONTEXT.md) —— 先把 bridge、hub、payload、frame、pause gate 这几个词对齐。
2. [0001 七份副本与一条一致性测试](0001-seven-copies-and-a-parity-test.md) —— 代码怎么共享。
3. [0002 Agent 工具打的是正在跑的页面](0002-agent-tools-talk-to-the-running-page.md) —— 传输模型。
4. [0003 第一次打开是在准备，不是失败](0003-first-open-is-a-preparation-not-a-failure.md) —— 冷启动。
5. [0004 非活动标签停手](0004-inactive-tabs-stop-drawing.md) —— 为什么用户会觉得宿主变卡。
6. [0005 Agent 驱动画布](0005-the-agent-drives-the-canvas.md) —— 手势工具与它的能力边界。
7. [0006 技能就是门口](0006-the-skill-is-the-doorway.md) —— 展示名、可见性、图标。
8. [0007 中文来自外壳](0007-chinese-comes-from-the-shell.md) —— 国际化的真实边界。

## 现状与已知缺口

- 七支插件的 `src/**`、`server/hub.src.mjs`、`scripts/build-hub.mjs` 逐字节相同，
  `tests/craft-parity.test.mjs` 会失败当任何一处漂移。`src/app.config.ts` 是唯一允许不同的文件。
- `server/hub.mjs` 由 `scripts/build-hub.mjs` 生成，它**同时**写回 `plugin.json` 里每个平台的
  sha256；`--check` 两个方向都校验。
- `tests/craft-manifest.test.mjs` 用宿主自己的 `PluginManifestSchema` 校验六份清单，
  并断言技能在两个选择面都可见、图标文件存在、版本号三处一致。
- 画布内部界面仍是上游的英文（见 0007）。中文化的重编译管线曾经存在，已删除，
  归档在仓库之外，不要再把它引回插件目录。
