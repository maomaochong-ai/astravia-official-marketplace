# 03 · 工具面与能力对照

> 现行文本。归并自 [0007](../0007-tool-surface-split-and-scope-use.md)、
> [0009](../0009-capability-parity-with-ainovel-cli.md)、[0015](../0015-capability-parity-round-two.md)、
> [0022](../0022-parity-round-three-and-explicit-non-goals.md)。数字按 0.4.19 重算。

## 一句话

36 个工具按「读 / 写」两分，24 个过门禁；对照关系写在测试里，不写在文档里。

## 现行规矩

1. **读永不挡，写全挡**。12 个读工具（`list_books`、`book_status`、`next_instruction`、`read_chapter`、
   四个体检、`context`、`check_threads`、`reference`、`audit_foundation`、`premise_structure`）
   不需要凭证——排障与「我有什么」不该被卡住。写与裁定 24 个一律需要有效凭证。
2. **门禁在服务层判一次**（`StudioService.requireEntitlement`）。工具与界面都走服务，
   因此不存在「某条路径忘了校验」。`grep -c requireEntitlement src/application/studio-service.ts`
   = 25，其中 1 处是定义、24 处是调用点。
3. **`scope_use` 是 fail-closed 的**：不声明就哪儿都不出现。工具、活动标签页、落章卡片
   三处都显式写 `["conversation", "project"]`，口径统一在 `src/scenarios.ts`。
4. **工具描述是模型唯一的选型依据**。写宽了会误调，写窄了专业能力用不上——每加一个工具，
   描述必须说清「什么时候用它」而不是「它做了什么」。
5. **能力对照进测试，不进正文**。上游 `ainovel-cli` 的每条命令对应哪个工具、哪四个能力
   明确不做，都在 `test/manifest-guards.test.ts` 的 `PARITY` 表里；文档只记结论。
6. **明确不做**：不做对话式「改一句」的编辑带、不做多模态封面生成、不做云端同步、
   不做发布到第三方平台。它们不是「还没轮到」。

## 代码落点

| 段 | 文件 | 工具数 |
| --- | --- | --- |
| 读 / 体检 / 上下文 | `src/tools/reading-tools.ts` | 12 |
| 定题与规则 | `src/tools/foundation-tools.ts` | 4 |
| 卷弧章纲 | `src/tools/outline-tools.ts` | 8 |
| 起草到定稿 | `src/tools/chapter-tools.ts` | 9 |
| 伏笔与裁定 | `src/tools/ledger-tools.ts` | 3 |
| 总装 | `src/tools/register-novel-tools.ts` | — |

## 代价与边界

- 工具多，模型选错的概率就高。缓解办法只有两条：描述写准、`next_instruction` 兜住主路径。
- 门禁在服务层，意味着**新增写操作只要走服务就自动受保护**；绕过服务直接写存储是禁止的。
- 对照表进测试的代价：改了工具名要同时改测试，否则会红。这正是要的效果。

## 怎么验证

```bash
cd abilities/plugins/mahua-writing-team
grep -rho 'id: "mahua_[a-z_]*"' src/tools/*.ts | wc -l   # 期望 36
npx vitest run test/manifest-guards.test.ts
```
