# 技能的索引面是 description，正文按需加载

- 状态：已采纳（2026-11-05）
- 相关：[0003](0003-the-plugin-is-agent-operable.md)（工具与技能的接线）、[0004](0004-tools-reach-the-page-skills-carry-the-work.md)（五份技能的分工）
- 影响面：`agent/skills/**`（五份 `SKILL.md` 全部重写 + 六个 `references/*.md` 新增）、`agent/agents/boardmix-guide.md`（新增）、`plugin.json`（`agent.skillPresentation.skills`、`agent.agents[]`）、`locales/{en,zh}.json`（12 个新键）

## 问题

0004 定下了「六个工具 + 五份技能」的分工，但按当时的写法，技能不会按预期被调用：

1. **模型看不见正文。** 宿主每轮只把每份技能的 `name` 与 `description` 拼进 `<available_skills>`
   索引（`packages/coding-agent/src/resources/skills/prompt.ts` 的 `formatSkillsForPrompt`），正文要等
   `invoke_skill` 才进上下文。当时五份 `description` 是「这份技能讲什么」的陈述句，不含触发条件，
   路由全靠模型猜。
2. **正文没有骨架。** 每份技能是若干条判断与提醒的平铺，没有固定工作流，也没有「做完的定义」。
   结果是模型自创步骤，或者做完不核对就宣称完成。
3. **渐进披露缺位。** 细节只能塞进正文，五份正文越长，命中后一次性吃掉的上下文越多。

宿主自己的预设（`packages/plugins/presets/astravia-ui-design/agent/`）不是这么写的：它的
`description` 是路由式的，正文是固定骨架，深细节放 `references/`。0004 只抄了「一份技能一个领域」，
没抄这套「怎么和宿主 AI 对话」的结构。

## 决定

### 一、`description` 是唯一的路由面

每份技能的 `description` 改成单段三截：**产出什么 → Use when（含用户会说的中文词）→ Do NOT use
for（排除项，并指向该去的地方）**。上限 1024 字符，`name` 必须等于父目录名。验收口径是
五个描述里都能读出「什么时候用我」和「什么时候别用我」。

排除项不是礼貌，是纠错：`boardmix-canvas` 与 `boardmix-ai` 的边界（自己写 Mermaid vs 让
Boardmix 的 AI 生成）、`boardmix-io` 与 `boardmix-canvas` 的边界（产出文件 vs 产出结构）如果
不写进描述，模型会在索引阶段就选错。

### 二、正文用同一副骨架

五份 `SKILL.md` 统一为：

| 段 | 作用 |
| --- | --- |
| 一句定位 | 这份技能管什么，不管什么 |
| `## The one rule` | 最容易违反的一条，写在最前 |
| 分工表 | 用户要什么 → 出什么产物 / 交给谁 |
| `## Workflow` | 固定顺序，含失败阶梯 |
| `## Done` | 完成判据 + 「没有任何东西会提醒你」的自查 |
| `## Do not do` | 具体到不许出现的说法（`已帮你画好了`、`已生成`） |
| `## References (read on demand)` | 文件 → 什么时候读的两列表 |

固定顺序的价值不在整齐，在于模型拿到的是可执行序列而不是一堆注意事项。

### 三、细节下沉到 `references/`

新增六个文件，每个只在对应动作发生时才需要：

| 文件 | 内容 |
| --- | --- |
| `boardmix/references/tool-envelope.md` | 返回体字段、五个 `reason`、三级种子阶梯、逃生口的两种正当用法 |
| `boardmix/references/page-map.md` | 目的地表、`phase` 三态读法、「200 证明不了什么」、帮助中心分组 |
| `boardmix-canvas/references/diagram-recipes.md` | Mermaid 选型、节点文本规则、CJK 引号、元素计数 |
| `boardmix-collaboration/references/run-a-session.md` | 研讨会六段时间线、角色、失败模式 |
| `boardmix-ai/references/prompt-recipes.md` | PPT / 流程图 / 导图 / 文档四套提示词模板 |
| `boardmix-io/references/format-matrix.md` | 导出格式选择、导入排障表、水印核对 |

引用一律写 `$SKILL_DIR` 相对路径，并在表头注明 **Do not read them all up front**：`invoke_skill`
的回执里给的正是 `SKILL_DIR` 绝对路径，技能目录只读，产物写回工作目录。

### 四、调用约定放主技能

`boardmix` 承担「六个工具怎么用」这一层，子技能只写领域：

- `boardmix_open` 先于一切，`boardmix_goto` 不猜路径；
- `phase === "login"` 就停手交还用户，不代填、不重试；
- `needsUserAction: true` 是交接点，不是失败，用一句话说明就停；
- 收尾固定三件：产出物、精确到面板分组的路径、用户唯一要按的那一下。

这三条如果散在子技能里，模型只有先选对子技能才看得到；放在主技能，任何一条路径都会先经过它。

### 五、加一份人格，但不抢角色

`plugin.json` 增 `agent.agents[]` 一条：`id: boardmix-guide`、`mentionHandle: boardmix`、
`avatar` 复用官方图标、`systemPromptPath` 指向 `agent/agents/boardmix-guide.md`。

人格文件是一段密集祈使句：先声明「你通过 `boardmix` 技能工作，按它而不是按自己的习惯」，再列
必须警惕的几种情况，最后规定收尾形状。**不声明 `roles`**：`roles` 是宿主预置角色槽位（设计、
研究等），一个白板场景不该占住它。

`abilities: "all"` 表示这条人格可用插件的全部技能——五份技能本来就是为它写的。

### 六、`skillPresentation` 只做显示，不做可见性

五份技能保持 `defaultVisibility: "visible"`，另补 `skills.<name>.displayName` /
`displayDescription`，让选择器里显示可读名称而不是目录名。

**不通过隐藏技能来减少索引噪声**：宿主里 `disableModelInvocation` 只认 frontmatter 的
`disable-model-invocation: true`，`skillPresentation` 的 `visible|hidden` 纯属界面显示，改它不影响
模型看到什么；而真去写 `disable-model-invocation: true`，`invoke_skill` 就再也找不到这份技能。两条
路都不通向「少占索引且仍可调用」，所以噪声只能靠把 `description` 写准来压。

### 七、技能文件不写版本号

五份 `SKILL.md` 的 frontmatter 只有 `name` 与 `description`，版本由 `plugin.json` 单点声明。
理由：技能随插件发布，双写版本号只会在 `bump` 时漏改一处，让包内出现两个版本真相。

## 后果

- 五份描述合计约 2.9 KB 的索引面，命中质量取决于这五段是否写准——这是本决策唯一没有自动检查的
  部分，靠人工读一遍。
- 打包体积从 21 个运行时文件增到 28 个（多出的 7 个正是六个 references + 人格文件），已核对包内清单。
- 技能正文里不出现工具参数表：参数在工具 `parameters` 里，技能只说「什么时候调哪个」。参数改版时
  技能不用跟着改。
- 人格文件与 `plugin.json` 的 `agents[]` 必须同时存在，单独留一个会让宿主的 manifest 校验或人格加载
  在安装后失败。

## 被否决的选项

| 选项 | 为什么不 |
| --- | --- |
| 只保留一份大技能 | 索引只有一行，模型会把「导出」和「画图」都塞进同一次加载；且一份技能要同时写工具约定与四个领域，正文必然超长 |
| 把六份 references 合并进正文 | 每次命中都付全部成本；现在的形态是只有真正画图时才读 Mermaid 规则 |
| 用 `skillPresentation` 隐藏子技能 | 隐藏是 UI 行为，模型照样看得见；想真隐藏只能关掉模型调用，那就调不到了 |
| 给每条技能声明 `roles` | 会占住宿主的预置角色槽位，影响其它插件与内置 Agent 的角色分配 |
| 在技能里写工具 JSON 参数示例 | 参数以工具 schema 为准，技能里再抄一份就是第二个真相源 |
