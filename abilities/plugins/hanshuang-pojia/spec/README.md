# spec/ — 被代码解析的产物

这个目录只放**机器读**的东西：测试会打开它、脚本会重算它、CI 会比对它。
人读的散文在 `docs/`；随包给宿主与模型读的在 `agent/` 与根 `AGENTS.md`。

判定一条规则：**「删掉它，有没有代码会失败」**。有 → 放这里；没有 → 放 `docs/`。

## 当前内容

| 文件 | 谁读 | 漂移校验 |
|---|---|---|
| `skill-library.sha256` | `src/test/knowledge/skill-library.test.ts` 逐行复算；`scripts/sync-skill-library.mjs` 生成 | `node scripts/sync-skill-library.mjs --check` |
| `toolchain-parity.md` | `src/test/tools/tool-index.test.ts` 按「探测 / 建议 / 不做」数三档行数，与 `tool-index.json` 对账 | `node scripts/sync-tool-index.mjs --check` |

`toolchain-parity.md` 是 `.md` 但不属 `docs/`：它的表格被当数据解析，且它的价值正是**独立见证**——
`catalog.ts` 决定探测谁，`tool-index.json` 由它生成，这张表是人工逐条判定；三者互校才拦得住生成物自己漂移。
不要把它也改成生成物。

## 新增一项要同时做三件事

1. 一条生成或校验路径：`scripts/sync-*.mjs --check`，或直接由测试复算；
2. 在 `scripts/check-docs-deps.mjs` 里可被识别（它按 `src/` + `scripts/` 的读取 API 判定消费方）；
3. 本表追加一行。

## 不进发布包

`docs/` 与 `spec/` 都不在 `scripts/stage-plugin-release.py` 的 `RUNTIME_DIRS` 里
（`dist` / `locales` / `agent` / `assets` / `service` / `web`）。它们是仓库事实，不是运行时资源：
宿主拿不到 `spec/` 的路径，所以**任何随包技能或提示词都不能引用这里的文件**。
