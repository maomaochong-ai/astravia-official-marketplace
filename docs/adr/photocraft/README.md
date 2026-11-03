# Photocraft 的决策记录

这个目录属于 photocraft 这一支 craft 插件。

- `craft-0001` … `craft-0013` 与 `craft-CONTEXT.md`：整族共用，与其余 craft 插件逐字节相同，
  由 `tests/craft-docs.test.mjs` 守护。其中 `craft-0011` … `craft-0013` 是本轮推翻上游
  zip 依赖后的新决策，越靠后的文档优先级越高。
- 本应用没有独有决策：`src/app.config.ts` 是唯一差异，其余源码逐字节相同。
