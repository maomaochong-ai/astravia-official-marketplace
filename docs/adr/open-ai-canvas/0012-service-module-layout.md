# ADR-0012：服务端按职责分文件，运行时仍是单个 bundle

- 状态：已采纳（两个阶段均已完成，`@ts-nocheck` 已清零）
- 日期：2026-10-26
- 相关：ADR-0003（服务运行时分发）、ADR-0008（shim 自承前端）

## 背景

`server/boot.mjs` 到 3809 行时，一件事要改三个地方：常量在文件头、下载逻辑在中段、路由在尾部。它不是「一个模块太大」这么简单——它同时是：

1. 宿主拉起的进程入口（`plugin.json` 的 `runtime.entry`，5 个平台的 `artifacts` 全部指向它）；
2. 前端静态资源的分发者（ADR-0008）；
3. MCP 协议层与 20 个工具的实现；
4. 载荷下载与解包的实现。

任何按职责拆分的尝试都会立刻撞上一个硬约束：**宿主只下载并执行这一个文件**。装的时候从 Release 拿的是 `server/boot.mjs` 一个文件，没有目录树，没有 `node_modules`。所以「拆成多个模块」和「运行时只有一个文件」必须同时成立。

## 决策

1. **源在 `server/src/*.ts`，产物是 `server/boot.mjs`。** 入口 `server/src/service.ts` 只做装配（约 20 行：两个 import 加三行启动序列），其余按职责分文件。新块进来时按同样规则：一个文件一件事，文件名说明职责，不用 `utils.ts` / `helpers.ts` / `primitives.ts`。
2. **用 esbuild 打成单个 ESM 文件**，`platform: node`、`target: node20`、`bundle: true`、无 sourcemap。产物写回 `server/boot.mjs`，`npm run shim` 再同步到 `public/assets/boot.mjs`。
3. **产物进版本控制**，并在产物头部标注「生成物，源在 server/src/」。理由是 `plugin.json` 的 `artifacts[].sha256` 指向它的字节，CI 打包读的也是它——产物不入库，仓库就不再是可发布的完整状态。
4. **不留 `@ts-nocheck`。** 迁移期确实挂过一个，只给 `service.ts`，理由是「给流对象挂自定义属性」在 strict TS 下要先补二十几个接口定义。但它只是把编译错误藏起来的临时手段，所以迁移分两阶段推进：先切分（结构对），再逐个模块补类型（类型对），最后删掉首行那句注释。**当前 `npx tsc -p server` 退出 0，`server/src` 与 `scripts` 内无任何 `ts-nocheck` 残留。**
5. **`check:service-fresh` 进 `npm test`**：用 esbuild 在内存里重打一遍，与磁盘产物逐字节比对。改了源没重建时，服务会跑上一版代码而所有 `verify-*` 仍然通过——那种失败最贵。
6. **验证脚本按目录读全部源码，不从产物切片。** `verify-workflow.mjs` 读 `server/src/*.ts`（`readdirSync` + 排序），锚点容忍 `const`/`let`/`var`。进 `vm` 前用仓库里已有的 `typescript` 的 `transpileModule` 做语法擦除——手写正则剥类型（`const X: T =`、函数返回类型、参数类型、函数体内的局部标注）注定漏一种写法，而漏掉的表现是 `verify-*` 崩在 `SyntaxError` 而不是给出断言结果。

### 模块划分（21 个文件，4141 行）

| 文件 | 行 | 职责 |
| --- | --- | --- |
| `service.ts` | 20 | 装配：`bindStableOrigin()` → `startProxy()` → `void prepareRuntime()` |
| `config.ts` | 81 | 端口、目录、Release 标签、平台表 |
| `paths.ts` | 29 | 运行期路径（由 `prepare.ts` 决定，用 `setRuntimePaths()` 写入） |
| `state.ts` | 129 | 准备状态机：`STATE`、`note`、`fail`、`clearFailure`、`setStage` |
| `progress-page.ts` | 149 | 下载进度页 HTML 与转义 |
| `net.ts` | 407 | socket、代理隧道、`readHead`、`pumpBody`、`requestStream`、`Sink` 类型 |
| `download.ts` | 220 | 整包与分片下载、停滞超时、总截止 |
| `sources.ts` | 384 | 候选来源探测、`probeFirst`、`CodedError`、`readTextResponse` |
| `payload.ts` | 182 | 清单解析、大小/摘要校验 |
| `archive.ts` | 138 | ZIP 解包与摘要（不引入第三方解压库） |
| `prepare.ts` | 60 | 载荷准备串场：探测 → 下载 → 校验 → 解包 → 起后端 |
| `backend.ts` | 151 | 拉起 `yingce-backend`、健康探测、进程退出处理 |
| `origin.ts` | 273 | 稳定 origin 绑定、稳定端口尝试、代理转发、`listenStable` |
| `routes.ts` | 149 | `/api/health/ready`、`/state`、`/__canvas/payload/reset`、进度页 |
| `web.ts` | 157 | 前端静态资源与 MIME |
| `session.ts` | 95 | 会话捕获与 AES-256-GCM 落盘 |
| `bridge.ts` | 443 | 宿主模型桥：`/__canvas/chat/completions`、任务队列、空闲回收 |
| `workflow.ts` | 133 | workflow 校验、拓扑、分层布局、patch 生成 |
| `mcp.ts` | 619 | JSON-RPC 2.0 层、工具分发、`callCanvasApi`、`applyCanvasOperations` |
| `mcp-tools.ts` | 276 | 20 个工具的名称、描述与 `inputSchema` |
| `contract.ts` | 46 | 内建节点类型表与 metadata 契约 |

### 迁移记录

**阶段一（结构）：一次性 codemod，跑完即删。** 手工编辑 3600 行不现实，所以写了一个临时脚本：按 18 段 `blocks` 表切原文、用 `stripNonCode()` 把注释与字符串空白化后做声明识别（否则模板字符串里出现的 `function tick()` 会被当成真函数并加上 `export`）、算出每个符号的归属文件、再按 owner 表分发。首跑 121 个类型错误里，三类是脚本自身缺陷（字符串内声明被导出、`has()` 剔除声明行导致漏检、两个跨模块可变量归属错误），修完后降到 110。脚本已删，不留在仓库。

**阶段二（类型）：`tsc` 121 → 110 → 0。** 逐文件推进，每轮只处理一类共同原因：

- `Sink`：`new PassThrough()` 挂了 `statusCode` / `headers` / `bytesRead`。一处 `export type Sink = PassThrough & {…}` 解决 16 条，优于逐处断言。
- `connectDirect` / `connectTunnel` / `openSocket` 返回 `unknown`：标注 `Promise<net.Socket>`。`Promise.race` 里再加 `new Promise<never>(…)`，否则竞速出来的联合类型仍会退化成 `unknown`。
- `Map` 泛型回退：`new Map(nodes.map((n) => [k, v]))` 里 `map` 返回的是 `any[][]` 而非元组，推断成 `Map<unknown, unknown>`。显式写 `Map<string, string[]>` 并对条目加 `as [string, …]`。
- `CodedError`：`err.code = "payload-unreachable"` 是本服务对外契约的一部分，用 `export type CodedError = Error & { code?: string }` 表达，而不是 `as any`。
- `ToolResult` / `BridgeJob` / `StableListenResult`：分别表达 MCP 返回体、运行期挂 `idleTimer` 的任务对象、`listenStable` 的成功/失败联合。
- 外部输入入口不造假类型：`readJsonBody(req: any): Promise<any>`，字段形状由调用点各自校验。

**跨模块可变量的归属。** 拆分暴露了一批「定义在文件头、被后面若干块读写」的 `let`：`PUBLIC_ORIGIN`、`STABLE_PORT`、`goProcess`、`BACKEND_PORT` 等。ESM 的 import 绑定只读，跨模块赋值会在运行期抛错。原则是**定义跟随写入方**：变量留在真正给它赋值的那个模块，读的模块 import 它；确实需要外部写入的，暴露 setter（`setRuntimePaths()`、`setSessionToken()`、`setLastWorkflow()`）。

**循环依赖用参数化打断。** `routes.ts` 的 `stateSnapshot()` 需要 origin，而 `origin.ts` 又要调它。改成 `stateSnapshot({ origin, originPinned })`，由调用方传入，依赖变成单向 `origin → routes`。

## 为什么不是「多文件直接运行」

宿主拿到的只有 entry 一个文件。要在运行时 `import "./archive.ts"`，就得让宿主把这几个文件都下载下来并保持目录结构——`artifacts` 是「文件 → 目标路径」的映射，可以做到，但那样每个新模块都要改 5 个平台的清单、每次引用都要保证顺序，而且**任何一次模块增减都是发布契约变更**。bundle 把这些复杂度收敛到构建期一次。

## 为什么不是「tsc 编译出多文件」

`tsc` 不做打包，`outDir` 出来的是多个 `.js` 加相对 import，仍然要多文件分发。要单文件就得再套一层打包器，等于多一步没有收益。

## 为什么不是「一次重写 3809 行」

拆分是搬运，重写是重新推导。前者可以用 `verify-*` 的现有断言证明行为不变（本次 18/18、26/26、17/17、14/14、24/24、41/41 全绿），后者只能靠人读。先搬完拿到结构，再逐个块补类型。

## 代价

- 新增 `esbuild` 开发依赖；`build` 与 `test` 各多一步。
- 产物 diff 噪声：改一行源，`server/boot.mjs` 的 diff 可能几百行（esbuild 会重排）。
- 类型收口靠的是少量结构化断言（`as Sink`、`as CodedError`、`Map<…>` 标注），不是重写数据结构。要真正消掉它们，得给流对象引入正式的子类或 `WeakMap` 包装——本轮不做，因为那会把「搬运」变成「重构」。
- `verify-workflow.mjs` 现在依赖 `typescript`（devDependency，已有）。裁掉它会让验证脚本失去源码切片能力。
- 行数从 3672 涨到 4141：新增部分是 import/export 头与每模块的职责注释，不是新逻辑。

## 验证（Observed）

| 检查 | 结果 |
| --- | --- |
| `node scripts/build-service.mjs` | `server/boot.mjs ← 21 modules, 122968 bytes` |
| `node --check server/boot.mjs` | 通过 |
| `npx tsc -p server` | 退出 0（无 `@ts-nocheck`，21 个文件全量检查） |
| `node scripts/check-service-fresh.mjs` | `OK server/boot.mjs 与 server/src 同源` |
| `npm test` | 18/18、26/26、17/17、14/14、24/24、41/41 |
| 仓库根 `node --test tests/*.test.mjs` | 73/73 pass |
| `npm run shim` | 一个 sha（`f5cc6bd0…`）→ 5 个平台 |

**未被自动覆盖的部分**：没有断言证明「bundle 后的运行时行为与拆分前完全一致」——那需要真机启动并跑一遍画布。现有证据是：源码块是原样搬运（不是重写）、`node --check` 通过、以及全部 `verify-*` 契约仍绿。首次真机启动仍需人工确认一次。

## 回滚

1. `git revert` 本次提交即可回到拆分前状态（`server/src/` 全部视为新增，`server/boot.mjs` 回到单文件实现）；
2. 若要手工回滚：删掉 `server/src/` 目录，把提交前的 `server/boot.mjs` 恢复到工作区，并去掉首行 `// @ts-nocheck`；
3. 删掉 `scripts/build-service.mjs`、`scripts/check-service-fresh.mjs`、`server/tsconfig.json`，从 `package.json` 的 `build`/`test` 里摘掉对应两步；
4. 跑 `npm run shim` 刷新 `plugin.json` 的 5 个 sha。

拆分前的文件在 git 历史里（`server/boot.mjs` 本次改动前的内容即完整实现）。
