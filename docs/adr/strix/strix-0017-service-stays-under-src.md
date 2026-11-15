# strix-0017 — `src/service/` 留在 `src/` 里

- **Status:** Accepted
- **Date:** 2026-11-15
- **Context:** 用户要求评估「`src/service/` 的归集是否合理，放 `src` 外还是内更好」
- **Related:** 项目结构规范 `docs/plugin-project-structure.md`、[0018](strix-0018-session-state-reuses-the-host.md)

## 事实

`src/service/` 是**受管服务进程**的源码：宿主用 `node` 起它（`dist/service/main.mjs`），它监听
127.0.0.1，暴露 `/mcp`、`/api/state`、`/api/tool`。20 个模块，其中：

- 8 个是存储/适配（findings、notes、todo、coverage、scope、patch、images、shell-sessions）；
- 6 个是宿主环境（docker、environment、toolchain、preferences、sandbox、proxy）；
- 其余是协议/装配（main、mcp-roster、sarif、dedupe、budget、telemetry、history、freshness、team、paths、skills）。

它与渲染层的**真实耦合**是三个方向：

1. `import { SERVICE_TOOL_NAMES, STRIX_TOOL_SPECS } from "../agent/strix-tools"` —— 工具目录是同一份；
2. `import { finishGate } from "../domain/scan-mode"` —— 收尾门禁的规则是同一个；
3. 面板读它的 HTTP 形状（`runtime-contract.ts`），而那份契约与 `service/` 的输出必须一致。

## 三个候选

| 做法 | 好处 | 代价 |
|---|---|---|
| **A. 留在 `src/service/`** | 一份 tsconfig、一个 `src` 根，跨层 import 是普通的 `../`；打包脚本一条 `esbuild` 命令 | 规范文档里没有 `service/` 这一节（它是插件形态，不是规范漏项） |
| B. 提到插件根 `service/`（与 `src/`、`test/` 平级） | 视觉上"两个入口"很清楚 | 三处共享代码变成 `../src/...` 跨根 import；tsconfig 要加第二个 rootDir；`esbuild`/`tsc` 各多一层配置；`test/` 里再区分"测哪个根" |
| C. 拆成独立 npm 包（workspace） | 边界最硬 | 市场发布是**单包归档**，多一个包就多一套构建与版本同步；收益只是理论上的复用 |

## The decision

**A：留在 `src/` 内。**

理由按重要性排序：

1. **共享代码是常态而非例外**：工具目录、收尾门禁、状态契约三处每天都在同时改两边。跨根 import
   会让每次改动都要多写一层路径，并且 `tsc --noEmit` 需要两个 rootDir 才不会把 `src/` 之外的文件
   当成"外来者"。
2. **发布单位是单包**：`release/*.astraviapkg` 里 `dist/service/main.mjs` 与 `assets/*.js` 是同一个
   归档的两个产物。包内分层不带来用户可见的好处，只带来构建复杂度。
3. **规范没有禁止**：`plugin-project-structure.md` 的 `runtime.ts` 一节说的是"受管服务的生命周期
   适配"（渲染侧），并没有规定服务**实体**放哪里。它列的目录是推荐，不是白名单。

## 什么情况下会改主意

- 服务需要独立的依赖树（比如引入一个只有 Node 侧能用的重型库，且不想进渲染 bundle）；
- 服务被第二个插件复用（那时它该是一个包，而不是一个目录）；
- 服务的启动方式换成宿主托管进程模型，需要自己的 `package.json`。

出现任一条时按 B 迁移，并同步：`tsconfig` 的 rootDir、`scripts/build-service.mjs` 的 entry、
`plugin.json` 的 `services[].entry`、以及 `test/` 里对服务模块的相对导入。

## 配套约定（已生效）

- 服务模块**不** import 任何 `.tsx` 或 React 运行时——它是 Node 进程；
- 渲染层**不** import `service/` 的实现，只 import `runtime-contract.ts` 的类型（HTTP 形状）；
- 唯一的跨层共享是 `agent/strix-tools.ts`（目录）与 `domain/scan-mode.ts`（门禁规则），
  两个文件都必须保持"无副作用、纯数据/纯函数"。
