# 来源与改编说明

## 上游素材

- 原始文件：`codex-skills/02_代码库迁移与重构/代码库迁移与重构工具/SKILL.md`（本地技能集合，128 行，上游 `name: codebase-migrate`）
- 同目录另有一份 `bringyour-migration-auditor/SKILL.md`，主题是 Claude Code → Codex 的**工具链配置迁移审计**（AGENTS.md/CLAUDE.md 作用域、hooks、MCP 配置），与本包「代码库迁移与重构」不是同一对象，因此未并入。
- 上游集合未附带 `LICENSE` 或任何许可声明，也没有可追溯的仓库地址与 commit，因此本包**不声明**具体许可证（`license: "Unspecified"`）。

公开分发前请先确认上游授权；若上游补充了许可，把许可证名称与全文一并替换进本目录即可。

## 改编原则

**方法、命令与工具链与上游保持一致，不做替换。** 本包保留上游的 Composio CLI 协作层——安装与登录、`composio link github` / `composio link linear`、`LINEAR_CREATE_ISSUE`、`GITHUB_CREATE_A_PULL_REQUEST`、`GITHUB_LIST_WORKFLOW_RUNS_FOR_A_REPOSITORY`、`LINEAR_CREATE_COMMENT`、`composio run --file scripts/migrate-batch.ts`，以及 `batch.list` / `done.list` 分批机制与 `migrate/vitest-batch-NN` 分支命名。上游示例中的 `acme/app`、`LIN-482`、`TEAM_ID` 作为占位符原样保留，由 Agent 在具体仓库中替换。

## 本包相对上游的改动

1. **frontmatter**：补 `version` 与中文 `alias`（宿主技能目录名只能是 ASCII，中文展示名只能经由 alias 与 `detail.i18n.zh`）。上游的 `metadata.short-description` 未保留——宿主只读取 `name`/`description`/`version`/`alias`，该键不会被任何界面使用。
2. **新增「基线记录」**（Planning 第 2 步末段）：要求先确认工作树干净、记下当前测试结果与**已在失败的测试**。上游没有这一步，而拿一个本就红的基线去判断迁移是否成功，后续所有「测试通过」都不可信。
3. **新增「Refactors That Move Code」**：上游标题覆盖 structural refactors，但正文只讲「同一种改法应用多次」，搬文件/拆包没有方法。补表征测试、一次一个关注点、公共入口稳定、临时 re-export 过渡。
4. **新增「Audit What the Migration Left Behind」**：上游验证环只有 grep 计数、全量测试、CI conclusion，只能证明改过的地方对，证明不了没改的地方没烂。补死配置、被临时关掉的检查、遗留 shim、过时文档模板、被内联进配置的密钥。
5. **批次循环内的补充**：开 PR 前读 diff 并抽查三个文件；合并绿了之后把该批写入 `done.list`，并把下一批 rebase 到新的 `main`。上游 `done.list` 只出现在「跳过已改文件」与 Safety Rails 里，没写谁在什么时候写它。
6. **安全底线补充三条**：不格式化无关文件、不 force-push 已评审批次、影响面超出用户描述时停下来问。
7. **排障补充两条**：单个文件所有 codemod 都改不动时改为手工、单独提交并说明原因；`composio execute` 鉴权失败时重新 login/link 并上报，而不是在没有 PR trail 的情况下继续推批次。
8. **新增「Reporting」**：每批一条 issue 评论、收尾报告的固定内容。
9. **依赖说明前置**：Prereqs 里明确「composio 缺失或未连接时停下来告诉用户缺什么，不静默退回裸 git」——追踪 issue、每批 PR、CI 结论是两百文件改动可评审的三件事。

## 展示层

- `ability.json`、`detail.json`、`detail.zh.json`：新增展示层，默认英文，中文放在 `zh` 覆盖里；展示名统一为英文「Codebase Migration and Refactoring」，中文条目名称只在 `detail.i18n.zh` 与 `detail.zh.json` 中保留。
- 详情页在使用步骤前明确写出前置条件（GitHub 推送权限 + Linear/Jira 空间 + 一次 Composio 登录连接），并说明没有它时哪些能力不可用，不做免配置承诺。
- 图标为彩色位图 `assets/icon.svg`：蓝色渐变圆角方块上以白色与青色代码括号、橙色分支节点表达「代码库迁移」主题；SVG 为矢量，适配深色/浅色目录页。

## 未包含

上游正文中的具体 transforms 文件名（`transforms/jest-to-vitest.ts`）与 `scripts/migrate-batch.ts` 未作为独立文件打包——前者属于使用方的仓库内容，后者已以内联代码块形式保留在 SKILL.md 的「Workflow Script」一节，由 Agent 按需写入目标仓库后 `composio run --file` 调用。
