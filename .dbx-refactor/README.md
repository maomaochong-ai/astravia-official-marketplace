# dbx-pro 重构事实基线（实现前置）

本目录只放**事实与规格**，不放实现代码。目标是让后续改写 `abilities/plugins/dbx-pro` 的人（或 agent）
拿到一份「不需要再回读旧项目就能动手」的基线。

## 交付物

| 文件 | 回答的问题 |
| --- | --- |
| [design-spec.md](./design-spec.md) | Q1：旧工作台的设计/交互/状态还原规格 + 索引表 |
| [plugin-constraints.md](./plugin-constraints.md) | Q2：插件 SDK 真实能力面与改造约束；Q3：数据通路真相与「做不到」清单 |
| [engine-runtime.md](./engine-runtime.md) | 宿主侧调查：插件自持本地引擎服务的可行通路（Q1–Q9，含 30 分钟验证计划） |
| README.md（本文件） | 方法、证据等级、结论摘要、开放问题、验收 |

两份规格已写完；仍属 `【推断】`/`【未知】` 的项集中在 [plugin-constraints.md](./plugin-constraints.md) 第 10 节的复验清单。
新增的 [engine-runtime.md](./engine-runtime.md) 给出宿主侧通路选择：`providers.services` **已被宿主真实实现**
（服务运行时 811 行 + 安装器 302 行 + SDK 类型 + IPC），推荐 `runtime.kind = "host-node"` + `ctx.services`；
`ctx.command.spawn` + 回环 HTTP 为降级通路（需额外声明 `commands:["node"]` 与 `network.allowedHosts:["127.0.0.1"]`，无回环豁免）。

## 方法

- **只读**：全程未修改旧项目与插件源码；所有写入只发生在 `.dbx-refactor/`。
- **不全量读**：用 `dir_tree` / `grep` / `sed -n 'A,Bp'` 定点读取。旧工作台约 13k 行，仅读取了
  与还原度判定直接相关的部分（组件头部、模型接口、lib 导出、main 侧数据层）。
- **证据分级**（下文统一使用）：
  - `【实证】` 读到的源码/命令输出，附 `路径:行`。
  - `【推断】` 由实证推导，但与实现无直接对应，需实现时验证。
  - `【未知】` 本仓库内不存在可验证证据。

## 结论摘要（先看这 6 条）

1. **旧工作台的数据层是 `dbx-mcp`（MCP stdio 二进制），不是 `dbx` CLI。**
   `dbx-mcp-client.ts` 手写 JSON-RPC over stdio，调用 13 个 `dbx_*` 工具；结果格式是
   **Markdown 文本**，由 `lib/dbx-sync.ts` 反解析成 `DbQueryResult`。
2. **插件现在假设的 `dbx` CLI 在本机不存在**（`which dbx` 无结果；desktop resources 里只有
   `dbx-mcp`）。因此 `src/features/connection-management/services/dbx-cli.ts` 与
   `src/domain/dbx-storage.ts` 的 sqlite3 直连 `dbx.db` 都是权宜之计，**重构必须换掉整条数据通路**。
3. **插件 UI 无法直接调用 MCP 工具**：`PluginAgentApi` 只暴露
   `registerTool/registerSystemPromptProvider/registerContinuationProvider/registerHook`。
   面板要拿数据，只能走 `ctx.services`（受管本地服务 HTTP 回环）或
   `ctx.command.spawn` + `ctx.network.request`。
4. **仓库内已有可复用的「插件自带引擎」范式**：`externals/cowart-astravia` 用 esbuild 把
   带 npm 依赖的 MCP server 打成一个自包含 `.mjs`，通过 `plugin.json#agent.mcpServers` 声明，
   host 用 `node` 拉起。dbx-pro 可以照抄这个打包方式，自带驱动层。
5. **还原度的真实边界是「UI/交互/状态可 1:1，数据能力不可 1:1」。** 插件 `connection-config.ts`
   声明了 87 个 `dbType`，而一份纯 JS 驱动层实际能覆盖的是其中一小部分；`信息_schema` 类
   catalog 枚举（schema/database/索引/FK/触发器/分区）旧项目本来就靠 `dbx_execute_query` 里的
   系统表 SQL 合成，插件可等价实现，但**原生驱动不支持的语言就没有这条路**。
6. 插件当前 `src` 处于半重构破损态：**`npx tsc --noEmit` 实测 exit 2 / 24 条错误**（实证，见
   `plugin-constraints.md` §3），应以「重写数据层 + 重建面板」而不是「打补丁」的方式推进。

## 开放问题（需人决策，不要在实现时自行拍板）

- **Q-A 数据通路选型**：`ctx.services`（受管服务，需 artifacts 安装步骤）vs
  `ctx.command.spawn`（node + 回环 HTTP）。两者都能做，取舍与推荐见 `plugin-constraints.md` §5。
  **宿主侧已核实**：`providers.services` 是真实实现（非纸面字段），推荐 A（`host-node` + `ctx.services`），
  B 仅在 A 被阻时启用；依据与降级条件见 [engine-runtime.md](./engine-runtime.md) §1、§3。
- **Q-B 驱动覆盖范围**：是「只支持 N 种主流库 + 其余标记不支持」，还是「不做驱动、依赖用户
  自备 dbx 引擎」？后者与本仓库「免配置可用」的详情页文案冲突。
- **Q-C 挂载点**：继续用 `registerActivityTab`，还是改用 `registerWorkspaceView`
  （左侧导航目的地）。旧工作台在宿主里是一个完整页面，语义更接近后者。
- **Q-D 安全闸门归属**：旧项目的 env 标签（`connectionEnv`）、生产写授权、AI 访问白名单存在
  **宿主 desktop-config** 里，插件读写不到，必须在插件自己的存储里重建一套。
- **Q-E 产物规模**：自带驱动层会把插件包从当前体量拉高（纯 JS 驱动 + MCP SDK + zod）；
  需确认市场体积限制（解压 ≤100MB、单文件 ≤8MB）下的可接受上限。

## 验收方式（沿用委派口径）

实现完成后由插件**自证**，缺一不可：

1. `npm run build`（v3 本地预检可打包）通过。
2. `npx tsc --noEmit` 通过（当前 exit 2 / 24 条错误，属预期）。
3. `node --test src/test/*.test.js` 全绿（含新增的数据层/解析层测试）。
4. 按 `design-spec.md` 的交互清单逐条勾选，桌面端真机点一遍并安装一次。
5. 本目录两份规格中标注的【未知】项若在实现中变为事实，回写文档。
