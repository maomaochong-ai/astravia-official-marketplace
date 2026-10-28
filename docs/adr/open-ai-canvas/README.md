# open-ai-canvas 插件 ADR 索引

这十七份 ADR 记录 `abilities/plugins/open-ai-canvas` 为什么长成现在这样。按「谁被谁取代」读，比按编号读更省事。

| ADR | 主题 | 状态 |
| --- | --- | --- |
| [0001](./0001-open-ai-canvas-as-plugin.md) | 以插件形式托管本地服务；MCP 工具集的授权边界 | 已接受，部分决策被 0003 取代 |
| [0002](./0002-canvas-mcp-toolset-and-authorization.md) | 画布操作模型（`PATCH …/operations`）与会话授权 | 已接受 |
| [0003](./0003-service-runtime-distribution-and-cross-platform.md) | 服务运行时如何分发到各平台 | 已接受，制品形态与平台矩阵被 0005 取代 |
| [0004](./0004-startup-readiness-contract-and-platform-gating.md) | 启动就绪契约与平台门禁 | 已接受 |
| [0005](./0005-native-binary-build-farm.md) | 原生二进制构建农场：CI 原生矩阵 + 载荷清单 | 已接受，决策 4 的下载源顺序被 0009 部分推翻 |
| [0006](./0006-host-canvas-model-bridge.md) | 宿主 ↔ 画布模型桥 | 已接受，决策 3 / 4 由 0013 改写 |
| [0007](./0007-host-driven-workflow-authoring.md) | 宿主驱动的整图工作流编排 | 已接受（现行） |
| [0008](./0008-frontend-hosting-in-shim.md) | 前端产物由 shim 承载，不依赖后端静态路由 | 已接受（现行） |
| [0009](./0009-payload-source-chain.md) | 载荷来源改为本地 / 镜像 / 官方链路 | 已接受（现行） |
| [0010](./0010-stable-browser-origin.md) | 固定浏览器 origin，让画布配置活过重启 | 已接受（现行） |
| [0011](./0011-payload-transfer-resilience.md) | 载荷下载卡 88%：分片停滞必须自己退出且可见 | 已接受（现行） |
| [0012](./0012-service-module-layout.md) | 服务端按职责分文件，运行时仍是单个 bundle | 已接受（现行） |
| [0013](./0013-canvas-media-models-as-host-providers.md) | 画布媒体模型登记为宿主媒体 Provider | 已接受（现行） |
| [0014](./0014-activation-ownership-and-runtime-version-key.md) | 激活的资源归属于激活，运行时目录键归属于字节 | 已接受（现行） |
| [0015](./0015-creator-catalog-projection.md) | 画布创作目录是渠道模型的投影，连接以读回为准 | 已接受（现行） |
| [0016](./0016-canvas-skill-library-toolset.md) | 技能库以上游 `/api/skills*` 为源，用 MCP 工具代理而不复制文档 | 已接受（现行） |
| [0017](./0017-payload-hot-update-and-model-autosync.md) | 载荷显式探测 / 就地升级 / 就绪即双向同步模型 | 已接受（现行） |

## 落实与偏差

2026-10-26 把十一份 ADR 逐条对照源码核一遍（`boot.mjs`、`src/`、`plugin.json`、`scripts/`）。能自动守的已写成脚本，守不了的写在这里，免得下次又把“文档说了”当成“代码做了”。

| ADR | 落实 | 偏差 / 说明 |
| --- | --- | --- |
| 0001 | shim 拉起 Go 二进制、视图、MCP、外部浏览器 | **内置 webview 未实现**（决策 6 只落了外部浏览器）；上游版本改从载荷清单读，载荷里没有 `VERSION` 文件 |
| 0002 | 20 个 MCP 工具（0016 起 28 个）、`PATCH …/operations`、冲突检测、鉴权捕获 | 节点“schema 发现”只能是“发现存在”（上游只回名单）；session 加密但不做多用户分档；工作区项目只有 `list` |
| 0003 | `archive: "file"` 单制品 + 载荷下载 | — |
| 0004 | 就绪契约、平台门禁、`minAppVersion` | — |
| 0005 | CI 原生矩阵 + 清单 | 下载源顺序被 0009 改写 |
| 0006 | 模型桥中继、`501 host-media-not-exposed` | 决策 3 的「导出渠道密钥」**已作废**：`publicChannel` 的 `apiKey` 只在 `admin=true` 时填，普通会话恒空；改向 0013 的媒体 Provider 注册，`models.manage` 权限随之删除 |
| 0007 | `apply_workflow` / `export_workflow` 单次编译 | — |
| 0008 | 前端由 shim 读盘返回 | — |
| 0009 | 本地 → 镜像 → 官方 → API 兜底链 | — |
| 0010 | 固定 origin、302、双保险 | 逃生门从 `CANVAS_STABLE_PORTS` 改成 `DATA_DIR/no-stable-origin` 哨兵文件（宿主不传递该变量） |
| 0012 | `server/src/*.ts` 分模块、esbuild 单 bundle、`check:service-fresh` 守同源 | `service.ts` 迁移期带工程 `@ts-nocheck`；ZIP 与节点契约已拆出，MCP/桥/路由尚未拆 |
| 0013 | 目录读 `GET /api/models`、`ctx.media.registerProvider`、`/bridge/media/:id` 转发、注册显式且随 `dispose()` 释放 | **参考图模式未打通**（缺 `POST /api/resources` 的 multipart 转发），故只声明 text→image/video；画布文本模型登记不进宿主；宿主侧端到端生成未跑 |
| 0014 | `src/index.tsx` 闭包局部 + 幂等释放；`sync-shim` 字节变就 bump `runtime.version`；`check-service-platforms` 固定 `version` / `entry` 与平台声明一致 | 2026-10-27 修复侧栏入口消失与运行时目录键不随字节变；端到端装包未跑 |
| 0015 | 渠道 / 渠道模型 / 免费价格档三级投影，写完读回 `/api/model-catalog` 分类报告；`verify-channel-projection.mjs` 断言 payload 形状与五类分类，`verify-canvas-catalog.mjs` 断言四条新路由可达 | 只投影文本能力；`chat-completion` 与 0 元档是硬编码假设；端到端未跑（本机无登录会话），画布对 `available: false` 的呈现仍为推断 |
| 0016 | 8 个技能库工具投影 `/api/skills*`；`canvas-skill-library.ts` 只依赖注入的 `CanvasApiPort`；顺手修复运行时就绪后 `/__canvas/tools` 被静态回退吃掉 | 只做读 + 加入/移出；技能正文超过 20000 字符默认截断；未与 `skill` 节点的 `skillId` 交叉校验；真实画布端到端未跑 |
| 0017 | `peekManifest` 只读探测 + 两条 `/__canvas/*` 路由；`.payload.json` 记录安装来源；失败按旧目录回滚；就绪后自动双向同步模型（`autoSyncDone` 单次守卫）与升级后重同步 | 自动探测/升级只在宿主真实网络下验证过本地目录与镜像两种来源；真实画布点「升级」的端到端与升级中途关面板的状态一致性未跑 |

守住这些的脚本：`verify-mcp-tools.mjs`（MCP 契约 65 条，含 8 个技能工具与分组断言）、`verify-stable-origin.mjs`（origin 24 条）、`verify-web-hosting.mjs`、`verify-payload-sources.mjs`、`verify-bridge.mjs`（桥 26 条）、`verify-canvas-catalog.mjs`（目录、媒体注册与桥路由 55 条）、`verify-channel-projection.mjs`（渠道投影 payload 与读回分类 29 条）、`verify-workflow.mjs`——全部在 `npm test` 里。

## 八个「为什么不是看上去那样」

- **包里只有一个 40 KB 的 shim**：`plugin.json` 的 `providers.services[].runtime` 只有一个制品，就是 `server/boot.mjs` 这份纯 JS。它按平台从 Release 取载荷（`payload-manifest.json`），所以不存在「Windows 用户的包里没有后端」这种状态。见 0005。
- **包里从来没有 `server/` 目录，这不是打包缺陷**：shim 在包内的位置是 `dist/assets/boot.mjs`（打包器对 `dist/assets/**` 全量收），`server/boot.mjs` 是它在**运行时目录**里的落点，两者刻意不同，中间由插件自己 `ctx.services.install(SERVICE_ID, [{destination, data}])` 搬运。把它当成路径写错去“修”，会把本来正确的契约改坏。见 0014。
- **模型桥是中继，不是网关，但媒体另有出口**：方向 A（宿主 → 画布）只有文本——`ctx.ai` 没有图片输入字段（视觉请求 422），也没有密钥级生成调用（媒体请求 501）。方向 B（画布 → 宿主）不是抄渠道密钥（画布根本不下发），而是把画布的图片/视频模型登记成**宿主媒体 Provider**，生成仍由画布执行。见 0006、0013。
- **工作流编排只发一次请求**：`apply_workflow` 把整图编译成一批 operations，靠 `metadata.__key` 幂等；不逐个节点打命令，避免半成品工作流。见 0007。
- **前端页面不是后端发的**：载荷里的 `web-dist/` 由 shim 读盘返回；上游发布 tag 的后端只有 `/api` 路由，非 `/api` 一律回 404「请求不存在」。见 0008。
- **受限网络不需要用户自备代理**：载荷来源是一条链（本地目录 → 镜像前缀 → 官方 → API 兜底），不是一条 GitHub URL。但“本地”不等于“打进包里”——市场包解压上限 100 MB，五平台载荷合计约 1.1 GB。见 0009。
- **端口每次都不一样，但配置不该跟着消失**：宿主用 `listen(0)` 分配端口且服务声明里没有 `port` 字段，所以 shim 另外钉一个固定回环端口当浏览器 origin，宿主端口上的页面请求 302 过去。`localStorage` 按 origin 隔离，origin 一变配置就“没了”。见 0010。
- **服务端拆成了多个文件，但运行时还是那一个文件**：宿主安装时只下一份 `server/boot.mjs`，所以源在 `server/src/*.ts`、产物是 esbuild 打的单 bundle。改了源没重建时服务会跑旧代码而 `verify-*` 仍全绿，于是 `check:service-fresh` 逐字节比对产物与源。见 0012。

## 文档里标注的三种证据等级

- **Observed**：本机跑过、看见输出（脚本、退出码、字节数）。
- **Inferred**：从已观察到的代码/行为推出。
- **Assumed**：既没跑也没法在本机跑——主要是四个非 darwin-arm64 平台的构建与运行，以及需要真实 Desktop 的 `ctx.ai` 端到端链路。
