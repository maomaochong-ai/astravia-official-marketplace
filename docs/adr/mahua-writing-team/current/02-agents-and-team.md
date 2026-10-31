# 02 · 智能体与团队

> 现行文本。归并自 [0002](../0002-agents-and-team-as-manifest-declarations.md) 与
> [0019](../0019-agent-directory-and-novel-master-skills.md)。2026-10-31 按 0.4.19 核对。

## 一句话

四个角色和一支团队都是清单声明，不是代码分支；它们的提示词是插件里的 Markdown 文件。

## 现行规矩

1. **角色只在 `plugin.json` 里定义**：`mahua-architect`（架构师，planner）、`mahua-writer`（执笔，writer）、
   `mahua-editor`（主编，auditor）、`mahua-arbiter`（编纂，steward）。`abilities: "own"`，
   因此它们只看见本插件的工具，不会顺手调用宿主的通用能力。
2. **团队 `mahua-studio` 的队长是架构师**。宿主没有 `captain` 字段，队长就是 `members[0]`——
   顺序即语义，不要随意调换成员数组。
3. **提示词是文件，不是字符串拼装**：`agent/agents/*.md` 一人一份，`agent/prompts/routing.md`
   是总纲，`agent/prompts/team-workflow.md` 写协作，`agent/prompts/briefs/*.md` 是派活的模板。
4. **技能与风格是数据**：`agent/skills/{novel-craft,longform-continuity}/SKILL.md` 加
   `references/**`，`agent/styles/*.md` 是四种文风样本。它们随包发布，不允许运行时去外网取。
5. **展示名走 locale**（`%agent.writer.name%` 之类），不写死在清单里——同一份清单要能出中英两种界面。
6. **技能默认不可见**（`skillPresentation.defaultVisibility: "hidden"`）：作者不该在技能列表里
   撞见一堆写作方法论，需要时由智能体自己读。

## 代码落点

| 事 | 文件 |
| --- | --- |
| 角色、团队、技能入口 | `plugin.json` 的 `agent` 段、`src/scenarios.ts` |
| 名称与描述 | `locales/{en,zh}.json` 的 `agent.*` / `worker.*` / `team.*` |
| 提示词与技能 | `agent/**`（约 40 个文件） |
| 身份与出处 | `agent/ATTRIBUTION.md` |

## 代价与边界

- 加一个角色 = 改清单 + 加一份提示词 + 补 locale，没有「插件里注册一个 agent」的 API。
- 技能内容进包会推高体积；现在的取舍是**只装真的会被读的**，不预装参考书。
- 宿主侧的 `mentionHandle`（`@writer`）与 id 分离：改名不会打断用户的 `@` 习惯。

## 怎么验证

```bash
cd abilities/plugins/mahua-writing-team
node -e "const p=require('./plugin.json');console.log(p.agent.agents.map(a=>a.id))"
npx vitest run test/manifest-guards.test.ts   # 清单与 locale 的一致性守卫在里面
```
