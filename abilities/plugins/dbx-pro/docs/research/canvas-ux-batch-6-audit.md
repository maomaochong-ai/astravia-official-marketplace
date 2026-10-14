# canvas-ux-batch-6 独立审计（只读复算）

- 审计对象：`canvas-ux-batch-6`（D1–D6 六项修复 + 4 个回归测试文件）以及 D5 触及的 `chart-node-render-fix` 复核项（H）
- 审计方式：只读。未修改/新建/删除任何被审代码；除本文件外只写了 `/tmp` 下的临时验证脚本与产物；未安装依赖、未执行 `npm run build`（`dist/` 未重建）、未执行任何 git 写命令
- 基线：HEAD = `79305d35 chore(dbx-pro): v0.4.68 — 递增版本 + 清理 docs + 同步 build 产物`（`git log -1 --format='%h %s'`）
- 行号口径：本文件所有行号均为**本轮用 `grep -n` / `sed -n` 重新定位**的工作区（worktree）行号，不沿用任务简报里的旧行号；与本文件不一致的旧行号见 §1

---

## 0. 裁定（一句话）

**六项修复的核心行为全部可核实：D1 的 id→name 解析、D2 的真实表下拉、D2b 的选中自动展开、D3 的高度契约、D4 的四条连线语义、D5 的图表卡片跟随系列色，逐条都有阅读所得或实测所得的证据支持，`npx tsc --noEmit` 退出 0、bi-editor 49/49、bigscreen 11/11、全量 802/801（唯一失败与基线同一条），因此**无阻断性发现**；但有 3 项应修：① D4 刻意实现了「无位移的单击不弹菜单」，与用户原始诉求 (e)「点击 socket 即弹菜单」存在实质差异，需主控/用户裁决；② F1 图表节点端口色已改为系列色，而它引出的连线仍是写死的语义绿 `#10b981`，同一节点端口与连线颜色不一致，且默认调色板下图表节点与数据源节点观感趋同；③ 工作区处于「1101 个 quick-bi-docs 删除已入暂存 + D5 的 5 行改动只存在于工作区 + 4 个新测试文件未跟踪」的异常状态，此时按现状提交会吞掉整个文档语料并漏掉新测试。**

---

## 1. 与主控事实的冲突（先列）

| # | 主控/简报说法 | 实测 | 影响 |
| --- | --- | --- | --- |
| C-1 | D4 满足用户诉求 (e)「点击节点 socket 打开菜单（当前需先拖拽再弹菜单）」 | **部分不成立**。无位移的单击（`pointerdown` → 原地 `pointerup`）既不弹菜单也不建线；需要位移 ≥ `CLICK_DRIFT`(6px) 或释放在空白画布上才弹。证据 @`src/features/bi-editor/canvas/components/node-graph.tsx:506 / :822-827 / :950-963`；且这是**被测试固化的预期** @`src/test/bi-editor/canvas-link-menu.dom.test.ts:134-144`（用例名「点一下插槽就走：既不弹菜单也不建连线」） | 需求语义偏差，需裁决（见 §4 应修-1） |
| C-2 | 简报/F1 前提：「SVG presentation attribute 不接受 `var()`，所以 `stroke={l.tone}` 这种写法一旦换成系列色变量就会静默丢色，必须改 `style={{stroke}}`」 | **前提被实测否证**。Electron Chromium 渲染实验中 `stroke="var(--c)"` 属性形式正常上色；阴性对照（未定义变量 `var(--nope)`）不上色，证明扫描器可区分 | F1 的修法选择变宽（一行换色源即可），但持久化 `var()` 的风险仍在（见 §4 应修-2） |
| C-3 | `property-inspector.tsx` 侧栏根行号 `:53/:63`；`canvas-editor.tsx:597`；`paletteStyle` `:424`；图表分支 `:1119-1135` | 实测 `property-inspector.tsx:58 / :68`、`canvas-editor.tsx:464 / :607`、`paletteStyle(palette)` @`canvas-editor.tsx:433`、图表分支 @`node-graph.tsx:1519 / :1621-1623`（`placeholderValues` 在 `:1511`） | 仅引用漂移，不影响结论 |
| C-4 | 组件名 `CanvasEditor` | 实际导出 `BigscreenEditor`（`canvas-editor.tsx:80` 附近，`export function BigscreenEditor`） | 命名纠偏 |
| C-5 | 主控：`npm test` 全量 802 tests / 801 pass / 1 fail | **独立复现一致**（`802 / 194 / 801 / 1`，唯一失败 `not ok 118`） | 无冲突（早前外包记录里的 771/758/2 fail 属另一个时点的时序不确定，非本轮回归） |
| C-6 | D4 的 `pointerup` 区块「:945-975」 | 实际 `function onUp(e: PointerEvent)` 起于 `:898`，连线收尾块在 `:946-966`（`:950` 命中检测 / `:953` tone / `:959` 空白落点弹菜单 / `:963-964` 收尾） | 仅引用漂移 |

---

## 2. A–H 逐条判定表

裁定词只有三种：**属实 / 不符 / 证据不足**。

| 项 | 被审计主张 | 裁定 | 关键证据 |
| --- | --- | --- | --- |
| **A** | 六项验证数字可复现：`tsc` 退出 0；bi-editor 49/49；node-chart-data 18/18；bigscreen 11/11；全量 802/801，唯一失败与基线同一条 | **属实** | 本轮实跑：`TSC_EXIT=0`；`# tests 49 / # suites 13 / # pass 49 / # fail 0`；`# tests 11 / # suites 2 / # pass 11 / # fail 0`；全量 `# tests 802 / # suites 194 / # pass 801 / # fail 1`，`not ok 118 - dbx-pro engine bridge (headless E2E)`，其失败子用例 `not ok 7 - SELECT 返回列与行（markdown 解析，值为字符串）`（= 基线） |
| **B** | D1：读侧把「面板存的连接 id」容错解析成引擎需要的连接名，且解析顺序 id 优先、永不抛错；写入侧仍存 `c.id`；引擎 `/tables` 按连接名取数；`runNode` 的依赖数组已补 `connections` | **属实**（另附 2 条低危注记） | 解析器 @`canvas/lib/connection-ref.ts:26`，`:35-36` id 命中 → `byId.name`，`:38-39` name 命中，`:41` 兜底原样返回；写入侧 @`canvas/components/property-inspector.tsx:407-410` `<option key={c.id} value={c.id}>`；引擎侧 @`shared/services/engine-client.ts:391-397` `engineListTables(connectionName, …)` → `engineRequest("/tables", { connectionName … })`；依赖 @`canvas/hooks/use-canvas-execution.ts:234` `}, [connections]);`（唯一消费 `connections` 的回调就是 `runNode`，`runAll` 经 `:308 }, [runNode]);` 传递） |
| **C** | D2：数据源节点「表名」字段在连接可解析时渲染真实表下拉；拿不到表列表时退回自由文本并说明原因；非数据源节点不发请求；手填的历史值不被下拉吃掉 | **属实** | `TableField` @`property-inspector.tsx:344`，下拉 `data-field-key` @`:355`、`value={value}` @`:356`、占位项 `:360`、当前值补进选项 `:361`；自由文本 + 原因 @`:372-380`；四路兜底文案 @`:333-338`；门控 @`:155 const isSource = kind.startsWith("source-");` 与 `:178 useConnectionTables(isSource ? connectionName : null)`；接线 @`:415-416`。DOM 级证据 @`src/test/bi-editor/canvas-node-panel.dom.test.ts:90-109`（断言引擎收到 `connectionName: "sales-mysql"`，即面板存 id、引擎跑 name）`/ :111-123 / :125-134 / :136-147` |
| **D** | D3：侧栏「底部大片空白与属性面板底色不一致」由父层 `display:block` + 子层无高度导致，修法为父层 `flex h-full` + 子层 `h-full`，并去掉收起态多余的 `border-b` | **属实（静态可证；视觉需实机确认）** | 左侧包裹层 @`canvas-editor.tsx:464` `hidden md:flex h-full shrink-0`；右侧 @`:607` `hidden lg:flex h-full shrink-0`；节点库根 @`node-library.tsx:193`（收起 `w-10`）/ `:207`（展开 `w-60` `<aside>`），两者均 `h-full` 且无 `border-b`；属性面板根 @`property-inspector.tsx:58 / :68`（`w-10` / `w-72`）均 `h-full`。因果：块级父层内 `<aside>` 无高度时高度=内容高，`bg-surface-raised` 提前结束，下方露出画布底色与 `border-r` 断线；`h-full` 修复该成因。`screen-editor.tsx:374/:437/:774` 未发现同类未修的根节点。测试固化在类名/源码契约层 @`src/test/bi-editor/canvas-layout-palette.dom.test.ts:39-77`（用例头 `:4-8` 自述「happy-dom 没有布局引擎…视觉效果仍需人工在 Electron 里确认」） |
| **E** | D4：按下输出端口只启动待定连线；位移过 6px 才弹「添加节点」菜单且只弹一次；释放在输入端口直接连线；释放在空白处弹菜单；自连不建线 | **属实**（实现与文档、用例一致）；但「单击 socket 即弹菜单」这一**原始诉求 = 不符** | 阈值 @`node-graph.tsx:506`；待定态 @`:594 linkStartRef`；启动 @`:597 beginLink`（不弹菜单）；弹菜单 @`:605 openLinkOutMenu`；端口回调 @`:614-615 socketHandlers/onOutputDown`；命中检测 @`:636 hitSocket`；空白判定 @`:648`；漂移弹窗 @`:822-827`；松手收尾 @`:950`（input 直连，tone @`:953`）、`:959-960`（空白落点弹菜单）、`:963-964`（保留拖拽打开的菜单/清理）。用例 7/7 @`src/test/bi-editor/canvas-link-menu.dom.test.ts:100-193`，含「无漂移单击不弹菜单」`:134-144`、「落在自身输入插槽不建自连」`:162-173`、「拖拽中新增节点仍可连线（读最新 `nodesRef`）」`:175-193` |
| **F1** | D5：「调色板不生效」的真实原因是卡片/端口/连线用了写死的 hex `TONE`，图表体其实早已跟随系列色；修复只需 2 处锚点 | **根因判断属实；但引入了新的端口/连线配色不一致（应修）** | 调色板链路：`canvas-editor.tsx:433 style={paletteStyle(palette)}` + `:493 onPaletteChange={setPaletteId}` → `shared/canvas-palettes.ts:68` 生成 `--dbx-series-1..4` → `src/style.css:65-68` 映射 `--color-series-N`（默认亮色 `:161-164 --dbx-series-1: #0969da`）。图表体早已消费系列色 @`node-graph.tsx:105 / :122 / :151 / :158 / :164`（`SERIES[1]/[2]`），节点库 @`node-library.tsx:108`。D5 新增 2 处：输出端口 @`node-graph.tsx:1508 tone: … isChart ? SERIES[0] : …`、卡片强调色 @`:1547 tone={isChart ? SERIES[0] : n.tone}`（落点 @`node-card.tsx:85 style={{ color: tone }}`）。**不一致**：同一图表节点输入端口仍是 `TONE.table` @`:1505`，而它引出的连线 tone 取自节点记录 @`:953 nodesRef.current[pl.from]?.tone ?? "#10b981"`，即建卡时的 `TONE.chart` = `#10b981` 绿（@`node-card.tsx:21-26`），与端口/图标上的 `var(--color-series-1)`（默认亮色 `#0969da` 蓝）不同色 |
| **F2** | `node-card.tsx` 的注释在 D4 后已过期（文件本身本轮未改） | **属实** | @`node-card.tsx:20`「数据类型决定插槽颜色 **+ 连线颜色**」与 @`:32`「输出 socket 被按下 → NodeGraph 应启动 pendingLink **+ 弹出 AddNodeMenu**」均描述旧语义；文件 mtime `Oct 14 21:09`，未出现在 `git status` 中，确认本轮未修改 |
| **G** | 工作区异常：`docs/research/quick-bi-docs` 整目录（1101 文件）已进入暂存删除，工作区已不存在；`node-graph.tsx` 为 `MM`；新测试未跟踪 | **属实** | `git status --short` 计数：`1101 D ` + `5 M ` + `1 MM` + `2 A ` + `4 ??`（合计 1113）；`git diff --cached --stat` 尾部 `1109 files changed, 462 insertions(+), 88272 deletions(-)`；HEAD 树内该目录文件数 = 1101；`ls docs/research/quick-bi-docs` → `No such file or directory`；未暂存改动仅 `node-graph.tsx`（`1 file changed, 5 insertions(+), 1 deletion(-)`，即 D5）。**风险**：D5 的 5 行只在工作区，4 个新测试文件未跟踪 ⇒ 按现状 `git commit`（不加 `-a`）会**丢掉 D5 并吞掉 1101 个文档删除**；且该提交的 CI 检出上不会存在 D5 依赖的断言 |
| **H** | 复核 `chart-node-render-fix`：图表分支走 `resolveNodeChartData`（纯函数）而非哈希假数据；`charts.tsx` 颜色一律经 `style={{stroke/fill}}`；既有导出未被破坏 | **属实** | 数据入口 @`node-graph.tsx:1519-1521 const chartData = isChart ? resolveNodeChartData(kind, values, result ?? null, getUpstreamResult ? getUpstreamResult(id) : null) : null;`，渲染 @`:1621-1623`；`placeholderValues` 定义 @`:1511`，仅被非图表分支使用 @`:1630 / :1657`；`node-chart-data.ts` 内 `grep hashValues|Math.random|Date.now|new Date` **零命中**（纯函数）；导出完整性 `charts.tsx`：`SERIES`@`:15`、`seriesColor`@`:21`、`ticks`@`:24`、`yPercent`@`:30`、`AreaChart`@`:47`、`Sparkline`@`:86`、`Bars`@`:110`、`HBars`@`:125`、`Donut`@`:146`、`Funnel`@`:172`、`Gauge`@`:189`、`LineChart`@`:213`、`BarChart`@`:255`、`Boxplot`@`:285`、`ChartFrame`@`:325`、`EmptyChart`@`:351` |

---

## 3. 「我亲眼读到的」与「我推断的」分开

### 3.1 亲眼读到（有原文/实测输出）

1. `connection-ref.ts` 全文逻辑（`:26-41` 顺序、`:49-59` 标签、`:63-69` 判定）与文件头 docblock；`:5` 附近提到历史 `api:<name>` 形态，但代码**没有**去前缀分支，只靠 id/name 命中。
2. `use-connection-tables.ts`：模块级 `tableCache` @`:26`、`inflight` @`:28` 去重、空连接名不发请求 @`:67`、错误写进状态而非抛出 @`:85` 附近、`clearConnectionTablesCache(connectionName?)` @`:52-55`。
3. `resolveConnectionName` 的三个调用点 @`use-canvas-execution.ts:115 / :147 / :179`（注意 `:179` 是 `connectionId ?? datasourceId`，与另外两处顺序相反，对应 `source-connector`）；依赖数组 @`:105 []` / `:234 [connections]` / `:261 []` / `:308 [runNode]` / `:319 []`。
4. `property-inspector.tsx` 的 `isSource` @`:155`、表列表 hook @`:178`、`DATASOURCE_KEYS` @`:393-394`、数据源下拉 `value={String(current ?? "")}` @`:401`、`<option value="">— 选择数据源 —</option>` @`:405`、`<option key={c.id} value={c.id}>` @`:408-409`、`TableField` 分支 @`:415`、兜底文案 @`:333-338`、当前值补齐 @`:361`。
5. 4 个新测试文件的**全部断言内容**（逐字读过）：`canvas-node-panel.dom.test.ts`（4 例，含「引擎收到的是解析后的连接名」）、`canvas-link-menu.dom.test.ts`（7 例，桩 `elementFromPoint`）、`canvas-layout-palette.dom.test.ts`（7 例，含 `:109` 断言图表强调色指向 `var(--color-series-1)`、`:118` 断言调色板不改写数据源语义色）、`node-chart-data.test.ts`（18 例，随 bi-editor 套件一起全绿）。
6. 本轮实跑输出（见 §5）与 `git status/diff/ls-files` 原始输出。
7. `/tmp/audit-b6-var-attr-test.html` → `html_to_pdf` → `sips` → `/tmp/audit-png-scan.mjs`（zlib 自写 PNG 解码 + 红行扫描）的像素级判读：属性形式 `var()`、style 形式 `var()`、字面量对照、渐变 `stop-color="var()"` 均判为已上色；对照组 `var(--nope)` 未上色。

### 3.2 我推断的（未在运行中的应用里直接观测）

1. 「D3 修好了用户截图里那条底部分色带」——**推断**。happy-dom 无布局引擎（测试文件 `:4-8` 自述），我只证明了类名契约与成因成立；真机视觉未验证（`dist/` 陈旧，本轮禁重建）。
2. 「D2b 自动展开在真实交互下不会被反复弹开」——**推断**。逻辑读过：`selectedId` 变化才 `setRightCollapsed(false)`，`lastAutoExpandedRef` 记住上一次（`canvas-editor.tsx:262-267`）；`rightCollapsed` 初值 `false` @`:94`。未做真机点击验证。
3. 「图表节点端口/连线不同色会被用户直接看到」——**推断**，但依据是「端口 style.background 与 `<path stroke>` 都来自已核实的取值链」，属静态可证 + 常识可见性判断。
4. 「属性面板数据源下拉在连接列表缺失该 id 时会显示为未选择」——**推断**。依据：`value={String(current ?? "")}` 与选项集合 `datasourceOptions = connections ?? []`（`:395`），无「当前值」兜底项（对比 `TableField:361` 有）。存储值不会丢（用户不操作就不写回），但界面会与数据不一致。
5. 全量套件的那 1 个失败「与本次改动无关」——**推断**，依据是它位于 `src/test/engine/engine-service.test.ts`（headless 引擎 E2E），且基线记录里同一条失败。

---

## 4. 阻断级 / 应修 / 建议

### 阻断级
**无。** 没有发现崩溃、数据丢失、契约破坏（`CanvasStrip` 必填 props 与 `node-graph.tsx` JSX 语法错误已在后续提交中修复）、测试造假（无「改断言不改实现」痕迹：`resolveValueField` 新增 `labelField` 参数是为了排除维度列，属实现修正）或指标虚报（A 项数字全部独立复现）。

### 应修（3 项）

1. **D4 与用户诉求 (e) 的语义差异需裁决**（中）
   现状：单击输出端口且原地松开 → 无任何反馈；须位移 ≥6px 或释放在空白处。开发者已把这套语义写进测试（`canvas-link-menu.dom.test.ts:134-144`）与文件头，属于**有意设计**（理由：pointerdown 当帧弹菜单会让用户无法拉线）。
   需决定：接受「拖拽优先」（则请在交付说明里改写诉求 (e) 的表述），或补一条「单击端口 = 在端口旁弹菜单」的旁路（例如 `pointerup` 时若 `menuOpened === false` 且位移 < 阈值，则在端口坐标 `openLinkOutMenu`）。**不构成缺陷，但当前报告口径与用户原话不一致。**

2. **F1 端口色与连线色不一致 / 图表与数据源观感趋同**（中，1–3 行改动）
   同一图表节点：图标与输出端口 = `SERIES[0]`（`node-graph.tsx:1508 / :1547`），输入端口 = `TONE.table` @`:1505`，引出的连线 = 建卡时的 `TONE.chart`（`#10b981`）@`:953` + `node-card.tsx:21-26`。默认亮色调色板下 `--dbx-series-1` 为 `#0969da`（`src/style.css:161`），与 `TONE.table #3b82f6` 同为蓝色系 ⇒ 图表节点与数据源节点在卡片层难以区分，而连线仍是绿色。
   可选修法（择一，均不必改 SVG 属性写法——见 C-2）：
   - 让连线 tone 也来自渲染侧（如按 `from` 节点是否 `isChart` 决定 `SERIES[0]` / `TONE.chart`），保持端口=连线；
   - 或端口/图标改用语义绿（放弃 D5 的 2 处锚点），把「调色板可见性」放到图表体与图例上；
   - **注意**：若把 `var(--color-series-1)` 这个字符串写进 `l.tone` 并随页面序列化（`node-graph.tsx:1288 tone: l.tone`），则在变量未定义的渲染上下文（导出/独立渲染）下可能落到无颜色；建议连线 tone 存语义键、渲染时再解析成变量，而不是把 `var()` 存进持久化数据。

3. **工作区提交卫生（G）必须在提交前处理**（中）
   现状：1101 个 `docs/research/quick-bi-docs/*` 删除已进暂存、工作区已无副本；`node-graph.tsx` 为 `MM`（暂存只有 D4，D5 的 5+/1− 只在工作区）；4 个新测试文件 `??` 未跟踪。
   只读环境下的正确恢复命令（**本轮未执行**）：
   `git restore --source=HEAD --staged --worktree -- docs/research/quick-bi-docs`
   ——只写 `--staged` 不够：工作区副本已被删，必须同时恢复 worktree。
   提交前建议：先确认 `docs/research/quick-bi-docs` 是否本就不该入库（若应当做语料保留，用上面的命令恢复；若是刻意清理，请在提交信息里说明并单独成一个提交）；再 `git add` 那 4 个测试文件与 `node-graph.tsx` 的未暂存改动，避免「删了 8.8 万行文档、丢了 D5 与全部新测试」。

### 建议（低危）

1. `isConnectionResolved`（`connection-ref.ts:63`）与 `clearConnectionTablesCache`（`use-connection-tables.ts:52`）**无生产调用**：前者仅被 `connection-ref.test.ts:96` 使用；后者仅被 `canvas-node-panel.dom.test.ts:27/:34` 使用，而它自己的 docblock 要求业务在刷新连接后调用。要么接线（连接列表刷新后失效表缓存），要么降级为非导出，避免「文档说了、代码没做」。
2. D2 的四路兜底文案中，`loading` 与 `error` 两路**没有用例覆盖**（4 例只覆盖「无连接」「空列表」「手填值」）；建议补两个断言。
3. 数据源下拉缺少「当前值不在连接列表」的兜底项（对比 `TableField:361`），会显示成未选择；建议同一策略对齐。
4. `node-card.tsx:20 / :32` 的注释已过期（F2），顺手改掉；`:21-26` 的 `TONE` 注释建议补一句「连线颜色由 NodeGraph 决定」以免再次误读。
5. `node-graph.tsx:953` 的兜底字面量 `"#10b981"` 与 `:625` 的 `TONE.chart` 重复；建议统一引用常量，避免语义色日后只改一处。
6. `node-graph.tsx:1704` 的 `n.tone + "33"`（拼接透明度）目前安全（该分支只服务 `output-*` 节点，读的是节点记录 `n.tone`，D5 的图表覆盖不经过它），但一旦 `tone` 变成 `var()` 就会产生非法颜色；建议改成 `color-mix()` 或语义 token。
7. `charts.tsx:6` 的注释「SVG 的 presentation attribute 不接受 `var()`」与实测不符（C-2）。作为团队约定（颜色统一走 `style`）仍值得保留，但建议改成「约定」措辞，避免后人据此做出错误推断（现存的属性写法 @`node-graph.tsx:1444 / :1450 / :1740`、`canvas-tiles.tsx:184` 实际能正常上色，均属提交 `7d44df7e9`(2026-10-13) 之前的旧代码，不是本批引入）。
8. D5 的 DOM 用例只断言卡片强调色（`canvas-layout-palette.dom.test.ts:104-119`），**未断言连线颜色**——F1 的不一致没有被任何用例拦住；补一条链接色断言即可自动防回归。
9. 图表渲染分支（`node-graph.tsx:1519` / `:1621-1623`）仍只有纯函数级测试（`node-chart-data.test.ts`），没有组件级断言；建议补一个「图表节点在无上游数据时渲染 `EmptyChart`、有结果时渲染 `BarChart/LineChart/Boxplot`」的 DOM 用例。

---

## 5. 命令与原始输出（均为本轮实跑）

工作目录：`abilities/plugins/dbx-pro`。测试参数照 `package.json:9` 原样：`node --import ./src/test/support/dom-setup.ts --experimental-strip-types --test …`。

```text
$ git log -1 --format='%h %s'
79305d35 chore(dbx-pro): v0.4.68 — 递增版本 + 清理 docs + 同步 build 产物

$ npx tsc --noEmit
TSC_EXIT=0

$ node --import ./src/test/support/dom-setup.ts --experimental-strip-types --test 'src/test/bi-editor/*.test.ts' | tail -10
1..13
# tests 49
# suites 13
# pass 49
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2502.123209

$ node --import ./src/test/support/dom-setup.ts --experimental-strip-types --test 'src/test/bigscreen/*.test.ts' | tail -9
1..2
# tests 11
# suites 2
# pass 11
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1741.09175
```

全量套件（本会话内实跑，日志 `/tmp/audit-b6-npm-test.log`；命令任务退出码 0，`npm test` 自身退出码 1）：

```text
# tests 802
# suites 194
# pass 801
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 34120.980417
NPM_TEST_EXIT=1

3815:    not ok 7 - SELECT 返回列与行（markdown 解析，值为字符串）
3861:not ok 118 - dbx-pro engine bridge (headless E2E)
```

⇒ 与基线同一条失败（`src/test/engine/engine-service.test.ts`，`failureType: 'subtestsFailed'`），非本批回归。`node-chart-data.test.ts` 的 18 例包含在上面的 bi-editor 49 例中（13 个套件 = 该文件 5 个 + 其余）。

工作区取证原始输出：

```text
$ git status --short | grep -v "^D  docs/research/quick-bi-docs"
M  scripts/download-quickbi-docs.mjs
M  src/features/bi-editor/canvas/canvas-editor.tsx
MM src/features/bi-editor/canvas/components/node-graph.tsx
M  src/features/bi-editor/canvas/components/node-library.tsx
M  src/features/bi-editor/canvas/components/property-inspector.tsx
M  src/features/bi-editor/canvas/hooks/use-canvas-execution.ts
A  src/features/bi-editor/canvas/hooks/use-connection-tables.ts
A  src/features/bi-editor/canvas/lib/connection-ref.ts
?? docs/research/canvas-ux-batch-6-audit.md      ← 本审计报告自身（审计前不存在，本次唯一新增文件）
?? src/test/bi-editor/canvas-layout-palette.dom.test.ts
?? src/test/bi-editor/canvas-link-menu.dom.test.ts
?? src/test/bi-editor/canvas-node-panel.dom.test.ts
?? src/test/bi-editor/connection-ref.test.ts

$ git diff --cached --stat | tail -1
 1109 files changed, 462 insertions(+), 88272 deletions(-)

$ git diff --stat | tail -2
 .../dbx-pro/src/features/bi-editor/canvas/components/node-graph.tsx | 6 +++++-
 1 file changed, 5 insertions(+), 1 deletion(-)

$ git ls-files dist | wc -l
       0

$ ls -la docs/research/quick-bi-docs 2>&1 | head -2
ls: docs/research/quick-bi-docs: No such file or directory
```

说明：`?? docs/research/canvas-ux-batch-6-audit.md` 是本审计报告自身（审计前不存在），所以上方列出的条目共 12 条，其中 11 条为被审交付内容。

var()-in-attribute 渲染实验（Electron Chromium，Desktop `html_to_pdf` 路径）：

```text
/tmp/audit-b6-var-attr-test.html    → /tmp/audit-b6-var-attr-test.pdf  (Renderer: electron) → png → /tmp/audit-png-scan.mjs
红行扫描：attr var() y=60..66(293px宽) / style var() y=107..113 / 字面量对照 y=154..160 / 渐变 stop-color var() y=198..210
/tmp/audit-b6-var-attr-control.html → 阴性对照：A attr var(--nope) 未上色；B attr var(--c) 上色 y=107..113；C style var(--c) 上色 y=154..160
```

---

## 6. 无法核实事项

1. **真机视觉**：D3 的底部留白、D5 的卡片强调色、D4 的交互手感，都需要在运行中的 Astravia 里点一遍。本轮的 `dist/` 陈旧（本轮禁止重建），`npm test` 的 happy-dom 无布局引擎，故这些只能停在「静态可证 + 契约级测试」。
2. **Electron 渲染实验的适用边界**：`var()` 实验走的是 Desktop 提供的 Chromium 打印/PDF 路径，不是应用自身的画布渲染树；结论（属性形式 `var()` 能上色）对「用同一 Chromium 渲染引擎」的强推断成立，但未在应用 DOM 里直接测量计算样式。
3. **历史 `api:<name>` 连接引用**：`connection-ref.ts` 的文件头提到该历史形态，代码只靠 id/name 命中。我只在测试夹具里找到 `api:` 前缀（`src/test/api/use-connection-editor.test.ts:70`），没有在真实用户数据里验证过这种旧值是否还存在于线上页面 ⇒ **证据不足**，仅记注记。
4. **交付是否满足用户全部主观诉求**：诉求 (e) 的语义差异（§1 C-1）与 §4 应修-2 的配色取舍属产品判断，需用户/主控确认；审计只给事实与影响。
5. **`scripts/download-quickbi-docs.mjs` 的改动意图**（暂存 192 行）：与本次六项修复无关，未审其正确性；仅提示它与 1101 个文档删除应分开处理。
6. **版本号与提交**：未 bump（HEAD 仍 `v0.4.68`）、未提交、未重建 `dist/`——提交与时序决策需用户显式授权，本轮未执行任何 git 写命令。
