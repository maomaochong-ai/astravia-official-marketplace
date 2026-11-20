# 0019：拒答梯度升为一等公民，以及宿主卡顿的真实成本面

- **状态：** 已接受
- **日期：** 2026-11-20
- **背景：** 三件事一起做：拒答梯度对照要成为真正的功能而不是一张表；面板在新建会话后会把上一个会话的样本带进新会话；「插件让宿主卡」的猜测一直指向渲染，量过之后发现不在那里。
- **适用：** `domain/refusal-probe.ts`、`tools/lab/probe-refusal.ts`、`components/prompts/probe-refusal-card.tsx`、`hooks/{use-workbench,use-chat}.ts`、`tools/**/description`、`src/tests/tools/schema-budget.test.ts`

## 问题

### 一、拒答梯度：对齐了接口，但没有对齐「能不能用」

| 项 | 上游 `probe-refusal.py` | 插件改前 | 后果 |
|---|---|---|---|
| finish_reason | `content_filter` / `safety` → REFUSED | 完全不看 | 服务端拦了但 HTTP 200 → 记成「空正文」，归因错 |
| 推理模型 | `reasoning_content` 兜底 | 只读 `content` | 正常回答被记成「空正文」 |
| API 风格 | openai / anthropic 两套 | 只有 openai | 直连 Anthropic 端点探不了 |
| 端点与模型 | 从 `models.json` 自动取 | 面板没有输入处 | 「让我测一次」实际不可执行：Agent 不知道要测谁 |
| 判据 | 关键词表（`sorry` 也命中） | 五类检测器 + 交付物豁免 | 插件更准，保留 |

结论：**面板这一侧从来没真正可用过** —— 按钮在，但没有任何地方告诉执行层要测哪个端点、哪个模型。

### 二、新建会话带病进新会话

`use-chat` 的去重只比 `status / tool / cwd`。新建会话时这三个字段通常一模一样，于是新的 `sessionId` 被当成「没变化」丢掉，面板根本不知道换了会话；而 `report / sample` 又是内存态，自然留在新会话首屏。

### 三、宿主卡顿：量出来的成本不在渲染

| 测量对象 | 实测（真实尺寸） | 判断 |
|---|---|---|
| `buildTimeline`（80 事件） | **0.0755 ms/次** | 不是瓶颈 |
| `mergeActivity`（40 span + 200 结果） | 0.9783 ms/次（已 memo） | 不是瓶颈 |
| 文档 `flatMap`（989 篇） | 0.0491 ms/次 | 不是瓶颈 |
| **工具表 schema**（35 个工具） | **63,521 字符 ≈ 15.9K token，每轮都进上下文** | **这才是大头** |
| 同上，lab 关闭时（13 个 CORE） | 17,791 字符 ≈ 4.4K token | 日常问答的真实成本 |

## 决定

### 拒答梯度

#### D1 四类判定，不是三类

`answered` / `refused` / `filtered` / `empty`。`filtered` 来自 `finish_reason`（content_filter / safety / prohibited / blocked），与「HTTP 200 但正文空」分开 —— 两者都指向链路，但依据不同，混在一起就没法复核。

#### D2 推理模型必须兜底

`extractText` 依次取 `choices[0].message.content` → 数组形式 content → `reasoning_content` / `reasoning` → Anthropic 的 `content[]`。只看 `content` 等于把所有推理模型判成链路故障。

#### D3 面板存「要测谁」，不存密钥

`ProbeProfile`（baseUrl / model / apiStyle / authHeader / lang / level）落在 `workbench/probe-profile.json`，插件作用域。
密钥一概不进面板：存了它就在渲染进程与 localStorage 里，拼进对话就永久留在对话记录里。

#### D4 执行交给宿主 AI，通过一份自包含简报

`buildProbeBrief()` 生成指令：端点、模型、风格、语言、梯度、要看哪些字段、结果要什么形状、密钥不回显。面板只负责把这份文本送进对话 —— 这就是「利用宿主 AI」的接口点，也是唯一不把凭据搬进渲染进程的做法。

#### D5 自定义梯度

一行一档，最多 6 条。标准四档回答「第几档开始拦」，自定义梯度回答「**我这句话**会不会被拦」—— 后者才是日常卡住人的问题。

#### D6 建议必须可执行

每条被拦档位可展开三档 target-free 改写（不依赖 `reshape()` 的目标提取），按同一档重测；记录带 `previous` summary，面板显示「第 N 档 → 第 M 档：变好 / 未改善」。

### 会话

#### D7 去重必须包含 sessionId

`use-chat` 的 `same` 判定加上 `sessionId`。改前它等于「换会话了但面板不知道」。

#### D8 复位边界按存储作用域划

| 作用域 | 例子 | 切会话时 |
|---|---|---|
| 会话级 | drafts | 天然隔离 |
| 工作区级 | 样本库、案例库 | **保留** —— 同一目录下的历史不该因为换会话就消失 |
| 插件级 | 设置、lab、提示词库、探测档案 | **保留** —— 它们是「这台机器怎么配的」 |
| 内存态 | report / sample / phase | **清空** —— 只属于「这一次分析」 |

首帧不动作：挂载时 `sessionId` 常是 null，之后才被 replay 补上，那不是「切了会话」。

### 性能

#### D9 工具表是每轮成本，必须钉预算

`src/test/tools/schema-budget.test.ts`：单工具 ≤ 3.6KB、全表 < 62,000 字符、CORE 13 个 < 18,000 字符、注册数与门禁表一一对应。
本轮把 `run_radare` 里一段**重复且断句的编辑残迹**与 `init_task` 重述的目录语义压掉（63,521 → 61,191）。

#### D10 外壳按输入身份缓存

`timeline` / `live` / `counts` 进 `useMemo`，`Sidebar` 包 `memo`。派生函数本身不贵（0.08ms），但它们是外壳的输入 —— 不缓存就等于每帧把 props 换成新对象，`memo` 形同虚设。

## 不做什么

- **不把密钥存进插件存储。** 见 D3。
- **不在面板里发模型请求。** 面板没有凭据，也不该有。
- **不为了压预算去砍参数说明。** 体量主要在 `parameters`；砍它等于让工具不可用。预算按「实测地板 + 余量」设，目的是挡增长。
- **不做跨会话的报告恢复。** 换会话清就是清；要留存的是 `reports/` 里的文件，那些按设计不动。
- **不改超大页的虚拟滚动。** 反汇编 800 行 + 卡片吃剩余高度已经够；虚拟滚动要动的是一整层渲染路径。
- **不改技能 / 提示词 / 记忆等 Markdown。** 本轮的压缩只发生在 `src/tools/**/*.ts` 的 schema 文本。

## 验证

已有：

| 用例 | 钉住什么 |
|---|---|
| `src/test/workbench/session-switch.test.tsx`（2 条） | 新会话清掉当前样本（工作区库保留）；切会话不重读插件级存储 |
| `src/test/tools/schema-budget.test.ts`（4 条） | 单工具 / 全表 / CORE 三档预算；注册数与门禁一致 |
| `src/test/workbench/render-budget.test.ts`（2 条） | `buildTimeline` < 2ms、`mergeActivity` < 8ms（防止被放回渲染路径） |
| `src/test/lab/refusal-probe.test.ts`（3 条） | 改写三档嵌入原问题、不依赖目标提取、记录保留 previous |
| `scripts/check-layout.mjs --strict` · `report-unused-locale --strict` · `type-scale.test.ts` | 布局 / 文案 / 字号三档门禁 |

待补：

- 「按下重测」端到端未自动化（需真实端点）。
- `filtered` 判定只在单测覆盖，未用真实 `content_filter` 响应验证过。
- 侧栏 memo 的收益未做渲染次数统计（只有函数级耗时）。

## 关联

- 0009：启动与每轮预算（工具闸门的来源）
- 0012 / 0016 / 0017：布局、字号、侧栏一致性的标尺
- 0018：拒答梯度的可执行性（本篇是其续篇，D1–D3 在此补足）
