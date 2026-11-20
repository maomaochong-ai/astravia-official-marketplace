# 0009：启动与每轮预算——把语料移出入口分块，把工具表按 lab 状态收窄

- **状态：** 已接受
- **日期：** 2026-11-20
- **背景：** 安装本插件后宿主出现可感知的卡顿：应用启动变慢、每轮对话的预填充变大、每轮多两次存储 IPC。本篇把「插件有多大」换算成「宿主每启动一次、每请求一次要付多少」，并决定削减到哪条线。
- **适用：** `src/domain/case/`、`src/features/workbench/`、`src/runtime/contributions.ts`、`src/tools/`、`vite.config.ts`、`scripts/sync-precedents.mjs`

## 问题

宿主在渲染进程启动时激活**每一个已启用插件**（`apps/desktop/src/renderer/domains/plugins/components/plugin-snapshot.ts:28`），
激活前先取该插件 expose 的 sync 资源（`dist/mf-manifest.json` 的 `exposes[0].assets.js.sync`）。
所以插件的入口分块大小 = 每次应用启动的固定税，与用户是否打开面板无关。

实测（2.16.0，构建产物）：

| 项 | 数值 | 位置 |
|---|---|---|
| 入口分块 | 1118.5 KB，单文件 | `dist/assets/index-BcxIeTHJ.js` |
| 其中内联先例正文 | 444 KB 字符串常量 | `src/domain/case/precedents.generated.ts` |
| 其中内联文档索引 | 110 KB JSON，340 条 | `src/content/docs/index.json` |
| 面板页面 | 17 个页面全部静态导入 | `src/features/workbench/components/workbench-screen.tsx:10-27` |
| Agent 工具 | 31 个，描述 + 参数 schema 共 56,147 字符 | `src/tools/ids.ts:50`、`src/tools/**` |
| 工具入口注册次数 | 31 次 IPC，每次都触发主进程全量重建 + 双份稳定序列化 | `apps/desktop/src/main/ipc/plugin-contributions.ts:152-153` |
| 每轮注入的 SYSTEM.md | 23.1 KB（lab 开启时） | `src/domain/system-prompt.generated.ts` |
| 每轮存储读 | 2 次（系统提示 provider + `UserPromptSubmit`） | `src/runtime/contributions.ts:260, 304` |

四条因果链，每条都能单独说清：

1. **先例正文内联**：`precedents.ts:1` 静态 import 生成物，经 `tools/case/search-cases.ts:3`、
   `tools/case/scaffold-case.ts:15`、`pages/cases.tsx:4` 三条链进主分块。
   同一批正文在包里已有两份（`cases/<slug>/docs/*.md` 与 `dist/assets/docs/cases/`），内联的是第三份，
   也是唯一被执行的那份。生成器注释写的「正文必须内联」在 `readCaseText` 落地后已经不成立
   （`src/domain/case/scaffold.ts:94` 能按需读任意包内文件）。
2. **工具表常驻**：31 个工具全部 `scope_use: ["conversation","project"]`，两个主场景都命中，
   于是每轮请求都带 56 KB schema。宿主有 `setToolEnabled`（`run-orchestrator.ts:421-432`，
   对未知工具名安全跳过），官方 ui-design 预设用它做闸门，本插件没用。
3. **热路径读盘**：`readLab` 已维护 `labCacheByStorage` 内存副本，但**每次都先读盘再回写**
   （`src/runtime/contributions.ts:47-61`），两条热路径各付一次。
4. **注册放大**：每个 `registerAgentTool` 在主进程触发 `refreshAgentPlugins`
   → `build()` + `stableSerialize` ×2 + sha256（`plugin-runtime-fingerprint.ts:11-59`）。
   31 个工具 = 31 轮全量序列化。

## 决定

**D1：先例正文退出 JS 分块，只内联索引。**

`precedents.generated.ts` 的 `docs` 从 `{id, text}` 收窄为 `{id}`；正文由
`readCaseText("cases/<slug>/<id>")` 按需读取（`vite.config.ts` 把先例包正文一并发到
`dist/assets/cases/<slug>/`，与已发布的 `tools/` 同一棵树）。`rankPrecedents` 不再扫描正文，
只按 `signals / title / summary / fieldNotes` 打分——正文检索本来就是 `search_docs` 的职责。
`renderPrecedentPackage` 变为异步，因为它要把整包正文交回对话。

判定：索引（slug/title/summary/signals/preset/fieldNotes/caseDocs/tools 元数据）约 15 KB 常驻，
正文 444 KB 按需取——与 D5 的文档索引外置是同一条边界：只有「启动时非有不可」的进分块。

**D2：面板页面按需加载 —— 已回滚（2.17.2）。**

2.17.0 / 2.17.1 把 `workbench-screen.tsx` 的 16 个页面改成 `React.lazy` + `Suspense`，
入口分块因此从 619.8 KB 降到 523.0 KB。但宿主反馈：从能力页添加/更新后，
输入框「+」里选插件**无法把面板加到对话**，点了什么都没出现。

原因在加载机制，不在面板代码：插件是 Module Federation 远程，`expose` 只有入口一个模块；
entry 之外的 chunk 靠 Vite 的 dynamic import 加载，而 `plugin-vite` 没有配 `modulePreload`、
也没有把 async chunk 写进 `mf-manifest` 的 `exposes[].assets.js.async`（实测恒为 `[]`）。
于是分块 URL 落到宿主页面下解析，页面组件拉不到 —— `Suspense` 永远停在 fallback。

处置：页面改回静态 import（2.17.2），回滚后主分块 523.0 → 619.8 KB，功能恢复。
结论：**要减启动体积就减数据（语料、索引），不切代码**。同一时期的 D1/D5 都是减数据，
没有这个风险；D2 是唯一一个曾经切代码的决定，也是唯一一个被回滚的。

如果要重新做代码分割，前提是先在 `plugin-vite` 里把 async chunk 声明进 `mf-manifest`
并配好 `modulePreload`，且至少有一个插件实测通过 —— 在那之前不要在本插件里再试。

**D3：工具表按 lab 状态收窄，核心 9 个常驻。**

在已有的 kernel 系统提示 provider 里追加 `setToolEnabled` 操作：lab 关闭时只留
`triage_binary`、`scan_binary_strings`、`search_docs`、`read_doc`、`search_cases`、
`probe_environment`、`install_toolchain`、`init_task`、`record_case_note`（`src/tools/gate.ts`
的 `CORE_TOOL_IDS`）；其余 22 个由 `TOOL_IDS` 减去核心集合得出（`LAB_ONLY_TOOL_IDS`），
只在 lab 开启时出现。

装环境的两个工具留在核心：装不上工具链的人不该被「先开 lab」再挡一次。

理由不是省 token 一个：这些工具里有 7 个是「装东西 / 跑外部二进制」，在 lab 关闭的日常问答里
被选中只会换来一次注定失败或注定多余的调用。门在工具表上，比在描述里写「不要在这种情况下调用」硬。

这条决定需要 `agent.tools.control`：宿主用它判定能否按轮改工具可见性（缺了它构建期的
权限契约会直接报错）。`plugin.json` 的权限清单因此从 16 项增到 17 项——这是对 0007 D6 的增补，
那条的「16 项」是当时的事实快照，清单始终以 `plugin.json` 为准。

**D4：lab 状态先读内存，只有写才落盘。**

`readLab` 的顺序倒过来：有缓存直接返回；无缓存才读盘并在成功后填充。写入口（lab 口令、
面板 `useLab`）继续写穿存储。热路径上 2 次 IPC 归零。

存储仍是持久化手段，不是唯一事实源——这一条与既有实现在注释里写下的立场一致
（`src/runtime/contributions.ts:25-32`），本决定只是让它真的按那个立场执行。

**D5：不因为「面板要读」就把大 JSON 内联，也不因为「宿主有 IPC」就每轮去读。**

两条边界：语料进 assets（按需 fetch），状态进内存（写穿）。分块里只放「启动时非有不可」的东西。

落实在两处：`src/content/docs/index.json`（110 KB）与 `assets.json` 不再静态 import，
改为 `loadDocsLibrary()` 首次使用时读取（同一套 `astravia-plugin://` 资源通道），
所有查询挂在 `DocsLibrary` 上——索引未就绪是类型上看得见的状态，不是空数组。


**D6：长文档按段交付，每段自带续读入口与小节清单。**

`read_doc` 原先默认 12 000 字符后 `slice(0, budget)`：340 篇里 124 篇被切，5 篇（最大 106 802）
连 `maxChars` 拉到上限也读不完，而且切点落在句子、表格、围栏代码块中间。

现在：

- 默认预算提到 24 000（p90 = 26 447，九成文档一次读完），上限仍 60 000；
- 新增 `offset` 参数；切点落在标题或空行前，围栏代码块未闭合时回退到上一个围栏；
- 未读完时给出三样东西：剩余字符数、**可复制的续读调用**、剩余小节标题与偏移；
- `kb_checklist` 用同一套（`domain/doc-slice.ts`），三处不再各写一份截断逻辑。

正确性由一条性质守着：连续分片的拼接必须逐字等于原文（`doc-slice.test.ts` 与
`docs.test.ts` 各验一次，后者用 106 802 字符那篇真实语料）。


- **不拆工具文件、不改工具名**。31 个 `registerTool` 调用与 `TOOL_IDS` 是自检页、会话事件、
  测试三处的锚点；本篇只改「模型看不看得见」，不改注册与命名。
- **不动 `docs/` 正文的发布方式**。347 篇 4.24 MB 已经按需 fetch，是对的。
- **不引入 MCP、不 vendor 二进制**（沿用 0007 D4/D5）。
- **不改 SYSTEM.md 的正文内容**。23 KB 是契约本身，本篇只减「何时注入」，不删条款。
- **不给 31 次注册加宿主侧批处理**。那是宿主的事，记在关联里，不在本插件里绕。
- **不为了「省字节」压缩先例正文的表达**。语料的可读性是产品，不是构建优化对象。

## 验证

已有：

- `src/test/case/case-precedents.test.ts`：包与生成物一一对应、四份文档顺序、正文可读且 > 200 字符、
  `caseDocs` / `fieldNotes` 指向真实文档、`scope.md` 恒为 `pending`。
- `src/test/case/case-scaffold.test.ts`：`readCaseText` 读回的就是磁盘上的字节。
- `src/test/workbench/workbench.test.tsx`：先例阅读视图渲染正文与标签页切换。
- `src/test/workbench/lab-chain.test.ts`、`src/test/dialogue/contributions.test.ts`：
  kernel 块与 lab 开关的注入面。
- `bun run verify:generated`：四份生成物与来源一致（`sync-docs` 已补进 `scripts` 与该链，
  原先只有 `scripts/sync-docs.mjs` 文件而不在 npm scripts 里）。
- `bun run check`（`tsc --noEmit`）、`bun run build`。
实测（2.17.0 构建，落地后）：

| 项 | 之前 | 之后 |
|---|---|---|
| 入口主分块 | 1118.5 KB（单文件） | 619.8 KB（单文件）；不切代码，省下来的全是数据 |
| 文档索引 | 110 KB + 1.5 KB 内联在主分块 | 0；`dist/assets/docs/{index,assets}.json`，首次使用时读取 |
| 先例正文 | 444 KB 内联在主分块 | 0；95 篇纯文本在 `dist/assets/cases/` |
| lab 关闭时的工具 schema | 56,147 字符 | 15,651 字符（核心 9 个） |
| 每轮存储读 | 2 次 | 仅进程内首次 1 次 |
| `read_doc` 可读性 | 12 000 后硬切，>60 000 永远读不完 | 默认 24 000 + `offset` 续读；106 802 字符那篇可拼回全文 |
| 测试 / 类型 / 构建 | — | 761 passed / `tsc --noEmit` 0 / `vite build` 成功 |

已跟随本篇改完的：`case-precedents.test.ts`（正文改为按需读取、「summary 命中」代替「method text 命中」）、
`workbench.test.tsx`（先例正文与按需页面都要 `findBy*`）、`lab-chain.test.ts` / `contributions.test.ts`
（operations 里要过滤掉 `setToolEnabled`，并断言两条方向）、`docs.test.ts` / `runtime.test.ts`
（索引改异步后先 `await loadDocsLibrary()`）、新增 `doc-slice.test.ts`。

另一处顺手修掉的：`scripts/sync-tool-index.mjs` 原来用裸绝对路径 `await import()`，
Windows 上 Node 把它当 `d:` scheme 拒绝；改成 `pathToFileURL`。四份生成物的 `--check` 现在
在 Windows 上也全过（`verify:generated` 四步 0 退出）。

待补：
- 新增一条构建断言：入口分块的体积上限（记录在 `docs/audits/` 下的构建报告里，不做成 CI 门禁——
  语料增长是正当需求，门禁只用于发现「又把语料内联回去了」）。

## 关联

- [0007](./0007-plugin-layout-normalization.md)：`cases/` 与 `content/` 是只读语料，不进 `src/`。
  本篇让运行时也按同样方式对待它们。
- [0003](./0003-panel-to-host-send-before-edit.md)：面板与宿主的通道以「明确、可数」为准，
  D4 的缓存倒序同理。
- 宿主侧跟进项（不在本仓库）：`registerAgentTools(pluginId, registrations[])` 批量注册通道。
