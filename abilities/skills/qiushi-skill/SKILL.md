---
name: qiushi-skill
alias: 求是方法论
version: 2.5.0
description: |
  求是方法论：先用「实事求是」约束全部判断，再按任务类型调用十件方法论武器之一——调查研究、矛盾分析、实践认识、群众路线、批评与自我批评、持久战略、集中兵力、星火燎原、统筹兼顾、工作流组合。当用户要求先把事实摸清再下判断、理清多头牵制的复杂局面、在多件事里定主攻、复盘已完成工作的质量、规划短期不可能速胜的长期任务，或直接点名其中某件方法论时使用。具体操作规程不在本文件里，按路由表读 references/skills/<name>/SKILL.md，不要凭记忆复述方法论。
   English: Qiushi methodology — the governing principle of seeking truth from facts plus ten methodology playbooks (investigation, contradiction analysis, practice and cognition, mass line, criticism and self-criticism, protracted strategy, concentration of forces, spark and prairie fire, overall planning, workflow composition). Use when facts must be gathered before a judgment, a many-sided situation untangled, a main direction chosen among competing tasks, finished work reviewed honestly, or a long-horizon task planned — or when the user names one of these methods. The procedures live in references/skills/<name>/SKILL.md; read the one that fits instead of paraphrasing from memory.
metadata:
  astravia:
    presentation:
      icon: assets/icon.png
---

# 求是方法论

这个包是一个整体：**总原则每次生效，具体方法论按需读取**。

- 下面第二节的四条硬规则，只要本技能被加载就一直适用。
- 第三节是一张分派表，每行指向 `references/skills/<name>/SKILL.md`——那是该方法论的操作规程正文，用 `read` 打开后再照做。
- 被派遣执行单一具体任务的子 agent，通常不需要加载本技能。

> "'实事'就是客观存在着的一切事物，'是'就是客观事物的内部联系，即规律性，'求'就是我们去研究。" —— 《改造我们的学习》

**子 agent 执行单一具体任务时：跳过本 skill。**

## 总原则：实事求是（四条硬规则）

| 规则 | 做法 | 违反信号 |
|---|---|---|
| 结论跟着证据走 | 每个判断标出依据：读了什么、跑了什么、看到了什么 | 有判断，无依据 |
| 分清三种话 | 区分「已核实的事实」「推断」「未知」；未知就写"不知道，需确认" | 用猜测填空 |
| 验证过才算完成 | 声称完成前先跑一遍、看输出、比对预期，并写出验证动作 | 写完即宣布完成 |
| 遇阻先诊断 | 失败时先说清原因，再补调查或换路径；不在第一次受阻就停 | "超出能力范围"式放弃 |

事实与预想冲突时，改的是判断，不是事实。

## 路由：什么时候用哪件武器

先判断任务类型。**直接执行类任务（改个名、格式化、按明确指令实现）不触发任何下游方法论**，只吸收上面四条规则。

| 你遇到的情况 | 读这份正文 |
|---|---|
| 要下判断，但事实、上下文不够 | [investigation-first](references/skills/investigation-first/SKILL.md) 调查研究 |
| 问题复杂、多头牵制、不知先解决什么 | [contradiction-analysis](references/skills/contradiction-analysis/SKILL.md) 矛盾分析法 |
| 有了假说或方案，要验证、试错、迭代 | [practice-cognition](references/skills/practice-cognition/SKILL.md) 实践认识论 |
| 多方意见分歧，或方案要带回真实使用者对齐 | [mass-line](references/skills/mass-line/SKILL.md) 群众路线 |
| 工作做完了，要审视质量或处理批评 | [criticism-self-criticism](references/skills/criticism-self-criticism/SKILL.md) 批评与自我批评 |
| 任务长期、短期不可能速胜 | [protracted-strategy](references/skills/protracted-strategy/SKILL.md) 持久战略 |
| 多件事争抢注意力，要定主攻 | [concentrate-forces](references/skills/concentrate-forces/SKILL.md) 集中兵力 |
| 从零起步、资源极少、要选切入口 | [spark-prairie-fire](references/skills/spark-prairie-fire/SKILL.md) 星火燎原 |
| 多个目标互相牵制，要平衡 | [overall-planning](references/skills/overall-planning/SKILL.md) 统筹兼顾 |
| 明显要几件武器接力 | [workflows](references/skills/workflows/SKILL.md) 工作流组合 |

调用纪律：

1. 一次只选一个主 skill，需要时再交接给第二个。
2. 宿主已有等价流程（内置的 plan、review、todo）时，以宿主流程为准，在其内部吸收方法论，不重复输出模板。
3. 不为"形式完整"而机械调用；方法论只在能明显改善判断或行动时才用。

### 怎么用这些正文

**先确定根目录。** 本文件所在目录记作 `$SKILL`：市场安装后通常是 `~/.astravia/skills/qiushi-skill/`；不确定就 glob 一次 `**/qiushi-skill/references/skills/*/SKILL.md`，取它的上两层。下表与正文里的路径都相对 `$SKILL`。

**上游写法对照。** 正文里会看到三种标识，在本包里分别对应：

| 正文里看到的 | 在本包读什么 |
|---|---|
| `arming-thought`、"路由表" | 本文件（入口） |
| `/contradiction-analysis` 这类斜杠命令 | `$SKILL/references/skills/<slug>/SKILL.md` |
| 裸 slug，如 `investigation-first` | 同上 |

宿主没有斜杠命令，也没有名为 `arming-thought` 的技能；按上表换算即可，不要因为找不到命令就跳过那一步。

1. **命中即读，读到才算做过。** 表里对上号就用 `read` 打开那一份再照做。没读文件就凭记忆复述方法论，等于没加载本技能；回答里要能对上下文里的步骤名。
2. **读一份，照做。** 打开后按里面的步骤执行，不要把正文整段复述给用户。
3. **要原著依据再往下读。** 正文末尾常指向同目录的 `original-texts.md` 等参考文件，需要引证或核对时再读，不要预先全部加载。
4. **接力再读第二份。** 第一件武器用完发现该换另一件，回到上表再读一行对应的正文。
5. **要角色就派遣。** 需要并行摸清多个方面时，把 `$SKILL/agents/investigator.md` 当任务简报交给只读子 agent；交付前需要独立审查时，把 `$SKILL/agents/self-critic.md` 交给一个新的子任务。这两份是简报，不是宿主自动注册的 agent。

自检：确认上述路径在本机都成立，跑 `node $SKILL/scripts/verify-package.mjs`。要看图文介绍页，跑 `$SKILL/scripts/open-preview.sh`（Windows 用 `open-preview.ps1`），会用默认浏览器打开包内页面。

装到别的宿主：`node $SKILL/scripts/install-platforms.mjs --list` 列出探测到的宿主与落点，`--target claude-code|codex|cursor|opencode|openclaw|hermes|nanobot|astravia` 装其中一个（`--scope project` 写当前目录，`--dest <目录>` 指到别处，`--dry-run` 只看不写），`--uninstall --target <id>` 只删自己写过的东西。用户说「装到 Codex / Claude Code」时就用它，不要手工 `cp`。

## 指令优先级

用户明确指示 > 宿主平台的系统规则与安全约束 > 本方法论。

认真，但不机械。
