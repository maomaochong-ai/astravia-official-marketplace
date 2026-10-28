# 模块：报告、版本与发布

从「证据」到「能交给别人看的东西」，再到「别人真的能装上」。

## 报告产出

| 工具 | 产出 |
| --- | --- |
| `write_assessment_report` | 四节审计报告：概要 / 判定点（函数或偏移）/ 验证证据 / 纵深防御。缺哪节就写「未提供」，**不编** |
| `export_triage_report` | 单样本体检报告（markdown / json），走宿主保存对话框，不静默落盘 |
| `generate_artifact` | `patch` / `keygen` / `proxy-dll` / `verify` 四种骨架，带补丁表或测试向量占位 |

报告的固定顺序（五段交付）：定位 → 补丁表 → 可运行产物 → 验证 → 回滚。每个断言标
**Observed / Inferred / Assumed**；没跑的步骤标 `NOT RUN` 并附下一条可复现命令。

## 版本与发布

| 事 | 怎么做 |
| --- | --- |
| 只改 `docs/`、`README`、测试 | **不用**抬版本 |
| 改 `src/`、`agent/`、`cases/`、`assets/`、`scripts/`、`plugin.json` | 必须抬版本，否则 `--strict` 直接失败 |
| 抬版本 | `node scripts/marketplace.mjs bump --slug hanshuang-pojia --apply`（默认 dry-run，一次改五份身份文件） |
| 本地预检 | `node scripts/marketplace.mjs check` → `build` → **构建之后**再跑 `node --test tests/*.test.mjs` |
| 发布 | 普通源码 PR → 合入 `main` → CI 构建 `.astraviapkg` 并推进 `gh-pages`。不能靠合并源码 PR 自动发布 |

`bump` 报 `Nothing to bump` 时，通常是本地 `origin/gh-pages` 引用陈旧：

```
gh api "repos/<owner>/<repo>/contents/.astravia/marketplace.json?ref=gh-pages" \
  -H "Accept: application/vnd.github.raw" > .marketplace-prev/.astravia/marketplace.json
node scripts/marketplace.mjs bump --slug hanshuang-pojia --previous .marketplace-prev --apply
```

`build` 报 `Output already exists: .marketplace-build` 时用 `mv` 备份再重建，**不要 `rm -rf`**。

## 插件内自检

`src/features/workbench/services/health.ts` 是面板「自检」页的数据源，分组：
`tools`（31 个工具注册齐全）、`assets`（技能 / 知识库 / 文档 / 路由表 / 战例工程）、`engine`、`permissions`。
`assets.cases` 报 14 条原型里有几条能生成 Linux 构建路径——这条数字掉下来就说明有人把 `build.sh`
又收回了 `.ps1`。

## 代码入口

- `src/tools/report/*.ts`、`src/domain/report/`
- `src/features/workbench/services/health.ts`
- `scripts/marketplace.mjs`、`scripts/check.mjs`、`scripts/report-dead-exports.mjs`

## 发布前清单

1. `npx tsc --noEmit` 无输出；
2. `npx vitest run` 全绿；
3. `node scripts/marketplace.mjs check`（`--strict` 在有改动时）；
4. `node scripts/marketplace.mjs build`（先 `mv` 旧 `.marketplace-build`）；
5. `node --test tests/*.test.mjs`（**必须排在构建之后**，它读构建产物）；
6. `node scripts/report-dead-exports.mjs` 确认 `dead 0`；
7. 清理临时目录与 `release/*.astraviapkg`（不进源码库）。

## 相关文档与测试

- 仓库级规则：`AGENTS.md`（市场源规范）
- 索引与发布说明：[`../README.md`](../../README.md)、仓库 `docs/marketplace-v3.md`
- 测试：`src/test/report/{assessment,report-compare}.test.ts、src/test/analysis/{artifact}.test.ts、src/test/workbench/{panel-boundary}.test.tsx`
