# 01 · 引擎与路由

> 现行文本，不是快照。归并自 [0001](../0001-port-deterministic-engine-as-plugin-domain.md)
> 与 [0017](../0017-review-round-one-global-revision-and-total-verify.md)。
> 改动留痕：2026-10-31 按 0.4.19 代码核对路径与数字。

## 一句话

进度只由 `routeNovel` 算，写操作只有一个入口，模型不参与「下一步做什么」的判断。

## 现行规矩

1. **三分法**——可枚举的状态迁移交给代码；边界清晰的语义判断交给 Arbiter（事实进、结构化决策出、落盘可回放）；
   开放式创作交给 LLM 循环。这条边界就是整个插件的形状，别的决定都要让路。
2. **路由是纯函数**。`routeNovel(facts)` 读 `NovelState`，出 `{ worker, task, chapter, reasonKey }`。
   同一份事实永远出同一个结果，测试是穷举规格而不是样例。
3. **下一步只有一个来源**。任何写工具都只返事实（`{ ok, phase, currentChapter, … }`），
   绝不附带「接下来请调用 X」。要说下一步，只有 `mahua_next_instruction`。
4. **`reasonKey` 是键，不是句子**。域层只发 `reason.*` / `checkpoint.*`，文案在 locale 里；
   键被翻译成句子是界面的事，域层写中文会在英文界面里漏出来。
5. **提交是一个原子发布点**。一次 `commit` 同批写书、章、评审、决策；`revision` 是并发基线，
   拿旧 revision 写会被拒。见 05。
6. **不猜**。证据不足时返回结构化失败（`ServiceResult` 的 `ok: false, error, detail`），
   不自造默认值把流程往前推。

## 代码落点

| 事 | 文件 |
| --- | --- |
| 状态机与路由 | `src/domain/novel-flow.ts`、`src/domain/novel-progress.ts` |
| 事实类型 | `src/domain/novel-types.ts` |
| 服务门面（工具与视图共用） | `src/application/studio-service.ts` |
| 工具注册 | `src/tools/register-novel-tools.ts`（36 个，分五个文件） |
| 规格测试 | `test/novel-flow.test.ts`、`test/instruction-drivability.test.ts` |

## 代价与边界

- 路由写死意味着**新增阶段要改代码**，不是改一份配置。这是有意的：阶段迁移是可枚举的，
  枚举就该被类型和测试盯住。
- `next_instruction` 只回答「下一步做什么」，不回答「值得做吗」。质量判断归 Arbiter 与主编。
- 域层不许有 IO。这条由测试守（`test/novel-flow.test.ts`），不靠自觉。

## 怎么验证

```bash
cd abilities/plugins/mahua-writing-team
npx vitest run test/novel-flow.test.ts test/instruction-drivability.test.ts
```
