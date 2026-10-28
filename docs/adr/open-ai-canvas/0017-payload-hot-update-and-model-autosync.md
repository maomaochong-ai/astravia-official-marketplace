# ADR-0017：上游天天出新载荷，但进程活着就不会换——补显式探测、就地升级与就绪即同步

- 状态：已接受（2026-10-28）
- 相邻：ADR-0009（载荷来源链）、ADR-0011（下载韧性）、ADR-0014（运行时目录键归属字节）、ADR-0006 / 0013（模型桥与媒体注册）

> 证据等级沿用 `README.md` 的约定。本文的 **Observed（运行）** 指本机跑过 `verify-payload-sources.mjs`
> 的 A–D 四个场景；真实画布（需登录会话）上的升级与模型双向同步一律是 Inferred / NOT RUN。

## 背景：更新链路是通的，只是没人去按

上游 `ddcat-ai/open-ai-canvas` 的发布由仓库 CI 每天追一次：`.github/workflows/build-canvas-payloads.yml`
既有 `workflow_dispatch`，也有 `schedule: cron "17 3 * * *"`，产出新的 zip 与 `payload-manifest.json`。
插件侧的来源链（本地目录 → 镜像前缀 → 官方 → API 兜底）也是现成的。但两处早退让「用户拿到最新版」
在实践上不会发生：

- `prepareRuntime()` 在 `STATE.phase === "ready"` 时直接返回——已经跑起来的服务不会被重新准备；
- `manifestPromise` 是进程级缓存，一个 shim 生命周期内只取一次清单。

后果：用户机器上的画布停在首次安装那一版，**除非重启宿主进程**。Observed（源码）：
`preparation-orchestrator.ts` 的就绪早退与 `payload-source-resolution.ts` 的 `manifestPromise`。

## 决策 1：探测只读，不污染运行态

新增 `peekManifest()`：取清单、解析、返回，**不**修改 `MANIFEST` / `PROVISION_DIR` / `AGENT_DIR`。
`loadManifest()` 变成 `peekManifest()` + `applyManifest()` 的组合，写全局的地方收敛到一个函数。

理由：`checkPayloadUpdate()` 会被界面反复调用（打开概览、切 Tab、启动后自动查一次）。如果探测顺手改全局，
一次「只是看看」就会把 `PROVISION_DIR` 指向一个还没下载的目录，后端随即找不到可执行文件。
Observed（源码）：`applyManifest()` 重算 `path.join(DATA_DIR, "runtime", payloadVersion)`，所以「先 apply 再判断有没有载荷」
会直接退化成「以为已经装好」。

判「有更新」的条件是 `available !== current || !running`：版本号相同但当前根本没在跑，也允许走升级路径重新拉一次。

## 决策 2：升级要显式点，且就地重启

两条本机运维路由，挂在 shim 上而不是做成 MCP 工具：

| 路由 | 行为 |
| --- | --- |
| `GET /__canvas/update-check` | 只读探测，回 `current` / `available` / `upgradeAvailable` / `installedAt` / `upstream` |
| `POST /__canvas/upgrade` | 取清单 → 下载 → 换目录 → 重启后端 → 回 `{ ok, upgraded, from, to, payloadVersion }` |

不做成工具的理由：工具面是给 Agent 的发现面（ADR-0002 / 0016），而「把用户机器上的运行时换掉」是有分钟级
副作用、需要用户当场知情的一次操作，属于界面上的按钮，不属于一段可以被自动串联的调用。工具数保持 28。

失败一律 HTTP 200 + `{ ok: false, code, error }`：升级失败不是「接口坏了」，是「这次没成」，界面要能读到
`rolledBack` 来决定是回 `running` 还是报错。

`restartBackend()` 复用同一个 shim 进程：shim 手里有会话 cookie、模型桥、固定 origin（ADR-0010）与这些运维路由，
杀掉它等于把一切都推倒。所以重启做在 shim 内部（`stopBackend()` → 重新 `reserveBackendPort()` → `startBackend()`），
`baseUrl` 与 `origin` 不变，前端只需重新 `probeState()`。

## 决策 3：装好的载荷自报家门

`provisionPayload()` 在 `rename` 之前写 `PROVISION_DIR/.payload.json`（版本、上游 tag、安装时间、来源 URL）。
没有它，界面只能回答「现在是哪个版本」，回答不了「这版什么时候装的、从哪儿来的」——
而这两个问题正是用户判断「我到底有没有更新到」的依据。

## 决策 4：失败就退回旧目录，且旧目录全程不动

升级路径从不写旧目录：新版本落到新目录，切换靠改 `PROVISION_DIR`。失败时用 `previous.payloadVersion` +
`previous.dir` 指回旧目录并重启一次（`ROLLBACK_READY_TIMEOUT_MS = 60s`），回执带 `rolledBack: true`。

`restarted` 标志在 `await restartBackend()` **之前**置真：区分「后端从来没被我们动过」与「动了之后失败要回滚」。
没有历史版本可回退时（首次安装就失败）不回滚、直接报错；下一次 `update-check` 会因 `!running` 判为可更新，自愈。

## 决策 5：就绪即双向同步，且只跑一次

`applyReady()` 末尾自动跑 `autoSyncModels()`：

1. 宿主文本模型 → 画布渠道（`provisionBridgeChannel`）；
2. 画布图片/视频模型 → 宿主媒体 Provider（`registerCanvasMediaProvider`，先 `dispose()` 旧注册）。

两个方向各自 `try/catch`，一个方向失败不影响另一个；`autoSyncDone` 单次守卫，`stop()` 与升级成功后重置
（渠道与媒体注册都绑在旧端口上）。失败只写 `noticeKey` + `detail`，**不弹 toast**：画布未登录时这些请求
全是 401，弹一串提示只会盖住真正的原因。

升级成功后必须先 `autoSyncDone = false` 再同步，否则守卫会把它变成静默 no-op——这是本轮修掉的一个真实缺陷。
界面上另有「重新同步」按钮走 `resyncModels()`，带 `syncing` 并发守卫（连点会重复 dispose/注册媒体）。

## 决策 6：升级入口要挡并发与错误时机

`upgradePayload()` 入口做两道判断，失败抛 `payload-upgrade-busy`：

- **同一时刻只允许一轮**（`upgrading` 标志）：界面双击、页面重试、两个客户端都会重发 POST，
  两轮同时下载会互相覆盖同一份 `PROVISION_DIR`，两轮重启会让后端反复起落；
- **`STATE.phase` 处于 `installing` / `starting` / `starting-backend` 时拒绝**：那时 `MANIFEST` 与 `PROVISION_DIR`
  正被准备流程改写，升级插进去必然踩坏。

## 后果与代价

- 前端多了一个 `UpdateState` 与 `resyncModels()`；`upgradeRuntime()` 刻意**不调** `stop()`，否则会把要保留的
  shim 一起停掉。
- 探测一次要多一次清单请求。列表清单本身就是载荷索引，体积很小；而它在准备阶段已经取过，
  `peekManifest()` 走同一份缓存，所以自动探测几乎零成本。
- 升级是分钟级请求（下载 200 MB 量级 + 冷启动），`/__canvas/upgrade` 是长请求、跑完才响应。
  宿主侧没有超时保护，中途关闭面板不会中断后端那一侧——这属于可接受的不一致：状态以 shim 自述为准。
- 只覆盖「画布端更新」。插件自身的更新仍走能力市场，两条链路不合并。

## 被否决的选项

| 选项 | 否决理由 |
| --- | --- |
| `update-check` / `upgrade` 做成 MCP 工具 | 工具面给 Agent 自动串联；换运行时必须由用户当场知情 |
| 探测时就 `applyManifest()` | 会把 `PROVISION_DIR` 指向未下载的目录，后端立刻找不到可执行文件 |
| 升级时直接 `stop()` 整个服务再 `ensureRunning()` | 白丢会话 cookie、模型桥与固定 origin，慢且会闪断面板 |
| 每次就绪都重新同步模型（去掉单次守卫） | 渠道 upsert 与媒体注册都是写请求，重复跑只是白耗请求，还会把 `noticeKey` 刷成同步成功 |
| 同步失败弹 toast | 未登录画布时 401 成串，toast 会盖住真正原因 |
| 升级失败就整体报错停下 | 旧目录没被碰过，回滚只需要指回去 + 重启一次 |

## 证据边界

- **Observed（源码）**：`payload-source-resolution.ts` 的 `applyManifest` / `peekManifest`；
  `payload-update.ts` 的两道守卫与回滚分支；`backend-process.ts` 的 `restarting` / `waitForBackendPort` /
  `stopBackend` / `restartBackend`；`runtime-pointing.ts` 抽出的 `pointRuntimeAt()`；
  `service-routes.ts` 的两条路由；`src/runtime.ts` 的 `checkForUpdates` / `upgradeRuntime` / `autoSyncModels` /
  `syncBothWays` / `resyncModels`；`build-canvas-payloads.yml` 的 `schedule` 与 `workflow_dispatch`。
- **Observed（运行）**：`node scripts/verify-payload-sources.mjs` → **24/24**，其中场景 D 用同一个本地载荷目录
  模拟「进程存活时上游出新版」：v1 就绪 → 同版本报 `upgradeAvailable:false` → 目录内容换成 v2 并重写清单 →
  报可更新且运行版本仍是 v1 → `POST /__canvas/upgrade` 回 `upgraded:true` → 重新就绪到 v2 且 `GET /` 含新标题
  → 再查为最新。`npx tsc --noEmit` 与 `npx tsc -p server` 均无输出，`npm test` 全绿。
- **Inferred**：宿主真实网络下从 Release 拉新载荷（本机无登录会话，走的是本地目录与本地镜像）；
  画布侧 401 时自动同步只留提示的表现（按 `rawCanvasApi` 的 `canvas-login-required` 推出）。
- **NOT RUN**：真实画布上点「升级」的端到端；升级过程中关闭面板再打开的状态一致性。
