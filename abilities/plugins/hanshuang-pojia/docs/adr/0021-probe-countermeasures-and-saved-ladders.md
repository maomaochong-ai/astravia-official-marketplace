# 0021：拒答梯度要留下「措施」，自定义梯度要能存成预设

- **状态：** 已接受
- **日期：** 2026-11-22
- **背景：** 面板里的拒答梯度对照（`probe-refusal-card.tsx`）已经能跑标准四档、能自定义梯度、能按下重测并对比上一轮。但使用中暴露出三处断点：测出来的结果**不知道落在哪**、每次自定义梯度**都要重打一遍整段话**、以及被拦之后给出的措施**只活在渲染过程里**。
- **适用：** `domain/refusal-probe.ts`、`tools/lab/probe-refusal.ts`、`components/prompts/probe-refusal-card.tsx`

## 问题

| 现象 | 机制 |
| --- | --- |
| 「点『交给对话分析』就直接发送了，结果显示在插件哪儿？」 | 结果确实在写：`probe_refusal` 写 `workbench/probe-refusal.json`，卡片读它。但**卡片上没有一句说这件事**，空态只写「还没有记录」。于是用户以为它只是把话发进对话、插件侧什么都不留 |
| 自定义梯度每次重打 | 自定义文本只在组件 state 里（`const [custom, setCustom] = useState("")`），关面板即丢 |
| 「拒答措施」只在渲染时算 | `adviceFor(record.rows)` 是**渲染时推导**：`probe-refusal.json` 里只有「哪档被拦」，没有「怎么处理」。关掉面板再从文件读，措施就没了 |

三处都指向同一个判断：**这份记录是给人回看的，不是给渲染用的中间态。** 回看时必须自带结论。

## 决定

### D1 措施写进记录，不靠渲染时再推导

`ProbeRecord.advice?: ProbeAdvice[]`，由 `toRecord()` 计算并落盘：只保留 `verdict !== "answered"` 的档位（真需要动作的那些）。
卡片新增「拒答措施」区，**从 `record.advice` 读**，与表格里的建议列同源。

### D2 保存自定义梯度到档案

`ProbeProfile.savedLadders?: { name, text }[]`（同样不含密钥，随 `workbench/probe-profile.json` 落盘）。
命名取第一行前 24 字，重名覆盖。卡片在自定义模式下直接列出，点击回填、可删除。

### D3 结果位置写在空态里

空态加一行：结果由 `probe_refusal` 写入 `workbench/probe-refusal.json`，只在本卡片显示，右上角刷新读最新一份。
这句话比任何文档都靠前——用户是在这里产生疑问的。

## 不做什么

- **不做梯度历史列表。** 与 0018 同一理由：判据是「改之前 vs 改之后」，只留一层 `previous`。
- **不让面板自己发请求。** 面板没有凭据；重测统一走对话，密钥由 Agent 侧传入并在输出里打码。
- **不给 `expect: risky` 的档位判「失败」。** 第 3、4 档被拦是常态，措施是「换写法」，不是「修 bug」。
- **不把 `filtered` / `empty` 也当成换写法就能解决。** 那两类是链路问题（端点/中转），`adviceFor` 早已分开，卡片沿用。

## 验证

| 用例 | 钉住什么 |
| --- | --- |
| `src/test/lab/refusal-probe.test.ts` | `toRecord` 产出 `advice`，只留需要动作的档位；`savedLadders` 默认空数组 |
| `src/test/panel-ux-regressions.test.ts` | 卡片读 `record.advice`，不重新推导 |
| `node scripts/probe-refusal-selftest.mjs` | 判定器对四类回复的分类不变 |
| `node scripts/report-unused-locale.mjs zh.json --strict` | 新增 8 个键全部被引用 |

待补：自定义梯度存成预设是面板内状态 + 档案落盘，端到端未自动化（需要真实端点）。

## 关联

- 0018：拒答梯度要能「按下重测」（本 ADR 是它的续篇：措施要留档）
- 0019：探测是一等公民且要说明真实成本
- 0020：宿主模型自动识别与级联布局
