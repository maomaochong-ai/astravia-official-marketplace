# bm-0003 — 页内 AI 就是那个 agent，我们负责给它递话筒

- **Status:** Accepted
- **Date:** 2026-11-10
- **Context:** boardmix 1.8.5 的 `/agent` 页与 `GET_AI_SIGN` 通道
- **Related:** [bm-0001](bm-0001-the-canvas-api-is-not-a-page-global.md)、
  [bm-0002](bm-0002-mermaid-is-the-semantic-bridge.md)、分析记录 `.rea/boardmix-1.8.5/README.md`

## 事实

- AI 页是 `/agent`；`/ai/chat` 与 `/ai/ppt` 都 **redirect** 到它。旧技能里"三个 AI 入口"是三条地址，
  实际是同一页。
- 客户端的 AI 是有票据的：`GET_AI_SIGN`、`CHECK_AI_IMG`、`AI_GENERATE_IMAGE`、`AI_TOOL_CONNECT`、
  `AI_TOOL_MATT_IMAGE`、`AI_TOOL_FIX_IMAGE`、`ENABLE_AI_SUMMARY`、`ENABLE_MULTI_TRANSLATE`。
- 客户端**没有** prompt→图形的规划代码（`createSticky` 之类的插入词汇在，规划器不在），
  推理发生在服务端，落笔通过同一个 wasm core。

结论：产品里的 AI **就是**那个"按指令改画布"的 agent；它不是我们要模仿的，是我们能驱动的。

## 决定

**插件不自己当 agent，也不假装是它；插件把 prompt 递进页内 AI，并把"谁付钱、谁按发送"讲清楚。**

`boardmix_ai_prompt` 的契约：

| 参数 | 行为 |
| --- | --- |
| `prompt` | 必填。工具先做**结构化检查**（主题、受众、篇幅/结构），不合格就拒绝，不把废话送进去 |
| `kind` | `deck` / `diagram` / `doc` / `image` / `chat`，只用来决定落到哪一页 |
| `send` | 默认 `false`：**放进输入框但不发送**，把发送这一步和积分消耗留给用户；用户明确说"你来发"时才 `send: true` |
| 返回 | 找到输入框没有、写进去了没有、发送了没有、当前地址、以及一行"这次生成会花用户积分" |

技能随之改写：`boardmix-ai` 从"把人送到页面就撒手"变成"**问清需求 → 写 prompt → 递进输入框（可选发送）
→ 让用户按发送或由我们按 → 拍图核对**"。

## 边界与代价

- 积分归用户账户（AI 会员 10000 点/月）。`send: true` 必须由用户的明确指令触发，工具每次都在返回里
  重申这一点。
- AI 的产出**不是我们观测到的**，直到截图看见它；失败、排队、额度不足都只能从页面上读。
- 输入框是 DOM 里的 `contenteditable`/`textarea`，选择器随产品改版会变。工具返回"找到了什么"，
  找不到就明确失败并建议改走 `boardmix_read` + `boardmix_act`，而不是盲打。
- CJK：`type` 走真实按键，中文到不了输入框。所以工具优先**合成 paste**（DataTransfer 文本）投递；
  这条合成路本次未在真实页面验证（unknown），失败时退回"prompt 已在返回里，请用户粘贴"。
