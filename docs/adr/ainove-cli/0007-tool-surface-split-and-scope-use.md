# ADR 0007：工具面按「读 / 写 / 裁定」三分，scope_use 显式声明

- 状态：已接受（2026-10-29）
- 决策对象：`abilities/plugins/novelwright/src/tools/`

## 1. 背景

宿主的 `ctx.agent.registerTool` 有两条容易踩的合同：

- `scope_use` **fail-closed**：不声明 = 任何场景都不出现；
- 工具描述是模型唯一的选型依据，写宽了会被误调，写窄了专业能力用不上。

上游把「事实读取」与「状态推进」严格分开（工具只返事实，路由由纯函数算）。插件要保住这条，
工具也就必须按**副作用**分类，而不是按功能域分类。

## 2. 决策

| 类 | 工具 | 副作用 | 授权要求 |
| --- | --- | --- | --- |
| 读 | `novelwright_list_books`、`novelwright_book_status`、`novelwright_read_chapter` | 无 | 无（未激活也可用于排障与展示「你有什么」） |
| 写 | `novelwright_create_book`、`novelwright_accept_brief`、`novelwright_save_plan`、`novelwright_save_outline`、`novelwright_start_drafting`、`novelwright_save_chapter`、`novelwright_save_review`、`novelwright_commit_chapter`、`novelwright_close_arc`、`novelwright_finalize` | 改 `NovelState` | **需有效凭证**（ADR 0004） |
| 路由 | `novelwright_next_instruction` | 无（纯函数） | 无 |
| 裁定 | `novelwright_arbitrate` | 追加 decision 记录 | **需有效凭证**（它会产生新的计划事实） |

- 全部工具声明 `scope_use: ["conversation", "project"]`，与本插件的使用场景一致（团队会话与
  项目内会话都要能用）；其余五个场景不声明，工具不会出现在那里。
- **写工具不返回「下一步」**：返回 `{ ok, phase, currentChapter, arcClosed }` 这类事实。下一步
  一律由 `novelwright_next_instruction` 给出，保证「路由只在一处」。
- 未授权时写工具返回 `{ error: "entitlement-required" }` 并附激活入口说明——结构化拒绝，不是
  抛异常，模型据此能正确转述给用户而不是重试。

## 3. 后果

- 模型永远只有一条获得下一步的路，不会同时看到工具回的「建议」与路由结果两个来源。
- 未激活状态下插件仍是可读的：用户能看到自己有什么、能读到正文、能导出——只是不能推进。
  这比整页白屏更接近「试用」的产品语义。
- 新增写工具时必须同时更新 `src/entitlement/entitlement-gate.ts` 的 `GATED_TOOL_IDS`，否则它默认
  被当作读工具放行。这条现在有两个守卫：`test/entitlement.test.ts` 断言授权状态对写工具的拦截，
  `test/manifest-guards.test.ts` 断言「门禁集合 == 已注册工具减去读工具白名单」——两边不等就红，
  所以漏登记和误登记都会在测试阶段暴露（ADR 0009 扩到 30 个工具、ADR 0012 加到 31 个时，正是靠它发现漏登记）。
