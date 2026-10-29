# 0019 — agent 目录按预设工程化，并把 novel-master 的手法收进两个技能

- 状态：已接受（2026-10-29）
- 相关：ADR 0002（智能体与团队是 manifest 声明）、ADR 0012（craft library 作为数据随包）

## 背景

当前 `agent/` 是「按文件类型摊平」的：

```
agent/agents/*.md          4 个子智能体的 systemPromptPath
agent/briefs/*.md          2 个成员的 instructionsPath
agent/workflows/*.md       团队的 workflowPath
agent/references/*.md      26 篇写作知识（靠 novelwright_reference 当数据吐给模型）
agent/styles/*.md          4 份文风
agent/voice.md             声线总纲
```

问题有三：

1. **没有技能层**。26 篇 references 只能通过自定义工具 `novelwright_reference` 一篇篇查，
   宿主的技能系统（`agent.skillPaths`）完全没用上——模型不知道「什么时候该读哪一篇」。
2. **目录名与职责不对应**。`briefs/` 其实是「成员的系统提示词补充」，`workflows/` 其实是「团队工作流」，
   与宿主插件预设（`open-astravia/.../presets/content-creation/agent`）的 `prompts/` + `skills/` 两分法对不上。
3. `novel-master` 这个参考项目里有我们缺的东西：**场景七型、戏剧学三幕/麦基、经典文论、禁用词、
   认知偏差包、伏笔系统、角色即子进程**。它们的价值是「写作时该守的规矩」，正是技能该装的内容。

## 决策

### 1. 目标目录

```
agent/
  prompts/
    routing.md              # 全局系统提示块：什么情况用哪个技能、工具按什么顺序用
    team-workflow.md        # 团队 workflowPath（原 workflows/novelwright-studio.md）
    briefs/
      writer.md             # members[].instructionsPath（原 briefs/writer.md）
      editor.md
  agents/
    architect.md writer.md editor.md arbiter.md    # 4 个子智能体的 systemPromptPath，不动
  skills/
    novel-craft/
      SKILL.md
      references/*.md       # 文风、场景、结构、人物、禁用词、认知偏差、伏笔
    longform-continuity/
      SKILL.md
      references/*.md       # 角色子进程、节点压缩图谱、量子审计、一致性、长篇规划
  styles/*.md               # 4 份文风（仍在 agent/ 根）
  voice.md
  references/ATTRIBUTION.md # 来源与许可，位置不变
```

`agent.styles` 与 `agent/voice.md` 留在原处：`scripts/build-reference-library.mjs` 直接扫这两处生成
`src/reference/library.generated.ts`（ADR 0012），挪动它们只会让「随包数据」和「技能文本」两份内容
互相追引用。技能里需要文风时用相对路径指过去，不复制第二份。

### 2. manifest 变更

```json
"agent": {
  "systemPrompt": { "promptPaths": ["agent/prompts/routing.md"] },
  "skillPaths": ["agent/skills"],
  "skillPresentation": { "defaultVisibility": "hidden" },
  "agents": [ ... 四个子智能体，不变 ... ],
  "teams": [ ... workflowPath 改指 agent/prompts/team-workflow.md ... ]
}
```

权限加两项：`agent.systemPrompt.write`（宿主只认这个权限才读 `promptPaths`）、`agent.skills.control`
（同上，读 `skillPaths`）。依据是 `apps/desktop/src/main/plugins/plugin-runtime-config-builder.ts:83-104`：
两个分支各自做 `hasGrantedPermission` 判断，缺权限则静默跳过——不加就等于白写配置。

`skillPresentation.defaultVisibility: "hidden"`：这两个技能是给本插件自己的团队用的，
不该出现在通用的技能选择列表里干扰别的会话（与 `content-creation` 预设同一处置）。

### 3. references 的归属

26 篇按「写的时候要不要照着做」分两堆，而不是按原文件名：

| 目标 | 内容 |
| --- | --- |
| `skills/novel-craft/references/` | plot-structures、character-building、character-template、dialogue-writing、differentiation、hook-techniques、chapter-guide、chapter-template、outline-template、content-expansion、anti-ai-tone、quality-checklist、`genres/**` + 新增 scene-writing、dramaturgy、classic-writing-books、banned-words、cognitive-bias、foreshadowing |
| `skills/longform-continuity/references/` | longform-planning、consistency + 新增 process-per-character、node-compressed-graph、quantum-auditor |

新增的 8 篇来自 `novel-master`（MIT-0），逐篇改写为「本插件可用」的版本：
删掉 python 脚本调用与 `~/.qclaw/workspace` 路径，改成指向本插件工具（`mahua_context`、
`mahua_check_consistency`、`mahua_check_threads`、`mahua_style_stats`）。来源写进
`agent/references/ATTRIBUTION.md`。

### 4. novel-master 的脚本不移植

`scripts/{char_state,ncg,auditor,init_book,track_foreshadowing,update_state}.py` 一个都不进包：

- 插件没有 `terminal.run` 权限，装进去也跑不了；
- 它们的确定性部分在我们的领域层已经有对应物（章节事实抽取、一致性检查、上下文包）；
- 伏笔台账是唯一真正缺的能力，本轮用 TypeScript 原生实现（ADR 0021），而不是把 json 文件格式照搬。

`novel-craft/references/foreshadowing.md` 只留「怎么埋、怎么收、轻重分级」的方法，台账本身由工具负责。

### 5. routing.md 的职责边界

它只写四件事，不重复团队工作流的逐条指令：

1. 什么时候加载哪个技能（`novel-craft` vs `longform-continuity`）；
2. 章节写作的固定工具顺序（context → read → plan → draft → check → review → commit）；
3. 谁的话算数（领域层只出 `reason.*`，下一步以 `mahua_next_instruction` 为准）；
4. 禁止项（不自己发明进度、不在会话里写正文、跳过评审直接提交）。

## 后果

- `scripts/build-reference-library.mjs` 的扫描路径要跟着改（`agent/skills/**/references/**` + `agent/styles/**` + `agent/voice.md`），
  生成物 `src/reference/library.generated.ts` 重新生成。
- `mahua_reference` 工具的 id 命名空间与技能 references 同源，读某一篇时不会出现「工具里有一份、技能里又一份」。
- `test/manifest-guards.test.ts` 增加两条断言：`systemPrompt.promptPaths` 与 `skillPaths` 指向的文件/目录必须真实存在；
  每个 `SKILL.md` 必须有 `name` / `description` frontmatter。
- 技能文本是中文（面向中文长篇作者），但 frontmatter 的 `description` 写「中文 + 一句英文」，
  保证英文界面下技能列表里也能看懂这是什么。
