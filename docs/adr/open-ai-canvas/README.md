# open-ai-canvas 插件 ADR 索引

这八份 ADR 记录 `abilities/plugins/open-ai-canvas` 为什么长成现在这样。按「谁被谁取代」读，比按编号读更省事。

| ADR | 主题 | 状态 |
| --- | --- | --- |
| [0001](./0001-open-ai-canvas-as-plugin.md) | 以插件形式托管本地服务；MCP 工具集的授权边界 | 已接受，部分决策被 0003 取代 |
| [0002](./0002-canvas-mcp-toolset-and-authorization.md) | 画布操作模型（`PATCH …/operations`）与会话授权 | 已接受 |
| [0003](./0003-service-runtime-distribution-and-cross-platform.md) | 服务运行时如何分发到各平台 | 已接受，制品形态与平台矩阵被 0005 取代 |
| [0004](./0004-startup-readiness-contract-and-platform-gating.md) | 启动就绪契约与平台门禁 | 已接受 |
| [0005](./0005-native-binary-build-farm.md) | 原生二进制构建农场：CI 原生矩阵 + 载荷清单 | 已接受（现行） |
| [0006](./0006-host-canvas-model-bridge.md) | 宿主 ↔ 画布模型桥 | 已接受（现行） |
| [0007](./0007-host-driven-workflow-authoring.md) | 宿主驱动的整图工作流编排 | 已接受（现行） |
| [0008](./0008-frontend-hosting-in-shim.md) | 前端产物由 shim 承载，不依赖后端静态路由 | 已接受（现行） |

## 三个「为什么不是看上去那样」

- **包里只有一个 40 KB 的 shim**：`plugin.json` 的 `providers.services[].runtime` 只有一个制品，就是 `server/boot.mjs` 这份纯 JS。它按平台从 Release 取载荷（`payload-manifest.json`），所以不存在「Windows 用户的包里没有后端」这种状态。见 0005。
- **模型桥是中继，不是网关**：宿主侧只有文本；图片/视频不做桥接（`501 host-media-not-exposed`），视觉输入直接 422，理由是 `ctx.ai` 没有图片输入字段。见 0006。
- **工作流编排只发一次请求**：`apply_workflow` 把整图编译成一批 operations，靠 `metadata.__key` 幂等；不逐个节点打命令，避免半成品工作流。见 0007。
- **前端页面不是后端发的**：载荷里的 `web-dist/` 由 shim 读盘返回；上游发布 tag 的后端只有 `/api` 路由，非 `/api` 一律回 404「请求不存在」。见 0008。

## 文档里标注的三种证据等级

- **Observed**：本机跑过、看见输出（脚本、退出码、字节数）。
- **Inferred**：从已观察到的代码/行为推出。
- **Assumed**：既没跑也没法在本机跑——主要是四个非 darwin-arm64 平台的构建与运行，以及需要真实 Desktop 的 `ctx.ai` 端到端链路。
