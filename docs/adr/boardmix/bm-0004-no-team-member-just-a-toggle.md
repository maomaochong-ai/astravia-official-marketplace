# bm-0004 — 技能与工具够用了，不需要一个团队成员

- **Status:** Accepted
- **Date:** 2026-11-10
- **Context:** boardmix 0.0.11 安装后在宿主里多出一个「白板向导」成员
- **Related:** [0005](0005-the-skill-index-is-its-description.md) — 技能索引就是它的描述、
  [bm-0003](bm-0003-the-ai-panel-is-the-agent.md) — 页内 AI 才是那个 agent

## 现象与成因

安装插件后，宿主的团队/智能体列表里出现一个 `boardmix-guide`，`@boardmix` 可以点名它。
这不是宿主的臆造：`plugin-agent-presets.ts` 把 `plugin.json#agent.agents[]` 的**每一条**声明
变成一个库内 agent profile，并给它一个 `mentionHandle`。这条声明是插件自己写的。

而它带来的东西，这个插件已经用别的方式拿到了：

| persona 提供 | 现在的来源 |
| --- | --- |
| 先调用 `boardmix` 技能、按它路由 | 技能 `description` 才是路由依据（0005），模型在技能清单里就能选 |
| 三条路（页内 AI / Mermaid / 页面输入）的取舍 | `boardmix/SKILL.md` 的判据表 + `boardmix_ai_prompt` / `boardmix_diagram` 的 `description` |
| 「画布是像素，不许假装读到」 | 技能正文的边界段；工具返回里 `canRead: false` |
| 每次回答都要交还一步给用户 | 工具返回的 `next` 字段，是**每次调用**都带上的 |

也就是说：这条 persona 是重复的一份规矩，代价是**用户列表里多了一个他不需要的成员**，
还要维护一份与技能正文会漂移的长文本。

## 决定

1. **删掉 `agent.agents[]` 与 `agent/agents/boardmix-guide.md`。** 插件只声明技能与工具。
   宿主下次对账时，preset 已不存在的库内 agent 会被移除（`reconciled` 的 `removedAgentIds`），
   用户那边的旧成员会自己消失。
2. **把"随这一轮挂上白板"改成输入栏的一个开关**（`registerInputAction`）。
   persona 没了之后，唯一还能在**发送前**给模型递话的地方就是它：`decoratePrompt()` 返回三条路的
   优先顺序，只在开关打开（或胶囊挂着）时进入这一轮。
3. **胶囊的挂载条件从"标签页被选中"放宽到"开关打开 或 标签页被选中"。**
   否则用户点了开关、面板还没渲染出来时，输入框下面是空的——看起来就像没生效。

## 为什么不是"把 persona 改短一点"

短 persona 仍然是**一个成员**：它占列表、占 `@` 命名空间、占一次模型对"该找谁"的判断。
而这个插件的价值在于"面板 + 工具"，不在于"一个叫白板的同事"。
真要一个同事，那也该是用户自己建的，不是安装插件时被塞进来的。

## 代价

- 失去"用户 `@boardmix` 直达"的入口。换成了输入栏的「白板」开关——它更明确：点了就会把面板打开。
- persona 里那些"每次都要说"的话，现在依赖技能正文；技能不加载时模型得不到它们。
  缓解：`decoratePrompt` 每次都带，代价是只在开关打开时生效。
- 旧版本已经建立的库内 agent 需要一次对账才消失；用户若在插件升级前手动编辑过那个成员，
  对账会把它当 preset-owned 移除。
