# 来源与改编说明

## 上游素材

- 原始文件：`codex-skills/02_代码库迁移与重构/代码库迁移与重构工具/SKILL.md`（本地技能集合，128 行提示词指南，上游 `name: codebase-migrate`）
- 同目录另有一份 `bringyour-migration-auditor/SKILL.md`，主题是 Claude Code → Codex 的**工具链配置迁移审计**（AGENTS.md/CLAUDE.md 作用域、hooks、MCP 配置），与本包「代码库迁移与重构」不是同一对象，因此未并入；其中可通用的「迁移后残留清查」思路已吸收进本包第 6 节。
- 上游集合未附带 `LICENSE` 或任何许可声明，也没有可追溯的仓库地址与 commit，因此本包**不声明**具体许可证（`license: "Unspecified"`）。

公开分发前请先确认上游授权；若上游补充了许可，把许可证名称与全文一并替换进本目录即可。

## 本包的改编内容

- `SKILL.md`：补齐 `version` 与中文 `alias` frontmatter；正文从「以 Composio CLI 为中心」改写为与具体平台无关的执行流程——
  - 依赖改为仓库里本来就有的 `git`、`rg` 与语言对应的 codemod 工具（ast-grep / ts-morph / jscodeshift / comby / grit 等），Composio 之类的托管服务只作为可选路径，不再是前置条件；
  - 增加「先把变换写成规则」「记录基线（含已有的失败测试）」两步，避免拿一个本就坏的基线去判断迁移是否成功；
  - 增加重构专用小节（先写表征测试、一次只做一件事、用临时 re-export 过渡），原文只覆盖「同一种改法应用多次」；
  - 新增迁移后的残留清查（死配置、被关掉的检查、遗留兼容层、过时文档、被内联的密钥）；
  - 补充「影响范围超出预期时停下来问」的护栏与回滚粒度说明。
- `ability.json`、`detail.json`、`detail.zh.json`：新增展示层，默认英文、中文放在 `zh` 覆盖里；中文条目名称为「代码库迁移与重构」。
- 图标为自制 SVG（`assets/icon.svg`）：旧结构条块 → 新模块容器，不含上游素材与任何第三方图形资产。

## 未包含

上游正文里的 `composio execute LINEAR_CREATE_ISSUE` / `GITHUB_CREATE_A_PULL_REQUEST` 等具体服务调用与示例 owner/repo，均属特定平台的可选集成，本包未固化其中任何命令与凭据形态；`scripts/migrate-batch.ts` 示例脚本也未复制。
