# ADR-0013：把画布里配好的图片/视频模型登记成宿主媒体 Provider

## 状态

已接受（2026-10-26），取代 [ADR-0006](./0006-host-canvas-model-bridge.md) 决策 3 的「导出渠道密钥」与决策 4 的「媒体全不桥接」。

## 背景

用户的原话需求是：**在宿主激活画布插件后，能加载出画布设置里已经配好的模型，包括视频、图片等多模态模型，并让宿主用这些模型与画布正常交互。**

ADR-0006 给出的答案是「方向 B = 把画布渠道的密钥登记成宿主 provider」。落实时这条路被证据推翻（`internal/app/admin.go#publicChannel` 的 `apiKey` 只在 `admin=true` 时才填，system 作用域连管理员都拿不到），代码已按新结论重写。本 ADR 记录改向之后的设计，以及为什么它比原方案更小、更安全。

三条宿主侧事实决定了设计空间（Observed，来自 `node_modules/@astravia-org/plugin-sdk@0.3.11` 的 `docs/` 与 `dist/`）：

| 宿主能力 | 插件能不能用 | 依据 |
| --- | --- | --- |
| `ctx.ai`（文本推理） | 只能用宿主**自己的**模型，插件不能往里加 provider | `dist/ai.d.ts` 的 `PluginAiApi` 只有 `listModels/complete/stream/chat` |
| `ctx.models.replaceOwnedProviders` | 能给宿主加**文本 provider** | `dist/models.d.ts` |
| `ctx.media.registerProvider` | 能给宿主加**媒体 provider**（图片/视频/音频） | `dist/media.d.ts`，需 `pluginApiVersion ^2.4.0` 与权限 `media.provider.register`（`docs/permissions.md:85`） |

画布侧的对应事实：

- `GET /api/models` 按登录用户返回 `PublicLogicalModel`，带 `capability`、`capabilitySpec.operations`、`priceTiers[].selector`、`available`，**不含密钥**；
- `POST /api/tasks` 的 `type` 只接受 `canvas_text|canvas_image|canvas_video|canvas_audio`（`validateTaskType`）；`input.mode` 必须与之一致；前台模型模式下 `logicalModelId` 必填（`resolveTaskModelSelection`）；
- 创作参数走 `input.config`，键名由 `canonicalCapabilityOptionName` 归一：`aspectRatio→size`、`resolution→vquality`（视频）/`quality`（图片）、`durationSeconds→videoSeconds`；
- 任务 JSON 只有一个 `previewUrl`（`task_output.go#taskMediaPreviewWithPoster`），指向 `/api/resources/:id/file`，**需要会话 Cookie**；
- 画布文本任务走 `createTextReplayTask`：前端直连模型、后端只收 `/text-deltas`，**没有 OpenAI 兼容的文本代理**。

## 决策

### 1. 真源是 `GET /api/models`，不是渠道表

插件读目录只走 `GET /api/models`（`server/src/canvas-catalog.ts#readCanvasCatalog`）。它不需要管理员、不含密钥、且已经是「这个用户在画布里能用的模型」的服务端权威投影。

渠道表 `/api/admin/channels` 只在一个地方保留：ADR-0006 决策 2 的**写**（给画布建一条指向桥的渠道），那不是读密钥。

代价是放弃「把画布渠道抄进宿主模型列表」这个能力。放弃是刻意的：抄过去就要持有密钥副本，而画布根本不下发（Observed：界面显示 `exported 0，skipped 1（画布未下发密钥）`）。`plugin.json` 的 `models.manage` 权限随之删除。

### 2. 图片/视频模型登记成宿主媒体 Provider，只声明真能跑完的模式

`registerCanvasMediaProvider` 把目录按 `image` / `video` 分组，每组生成一条 `PluginMediaCapability`（`operation: "generate"`），模型作为 `models[]` 描述符：

- 只登记 `operations` 里出现 `text_to_image` / `text_to_video`（或同义拼写）的模型；没有 operation 声明的模型进 `unsupported`，**不猜它能干什么**；
- 模式只声明 `text-to-image` / `text-to-video`。参考图模式（`image-to-image` / `image-to-video` / `reference-to-video`）需要把宿主给的参考图字节 multipart 转发到画布 `POST /api/resources`，本轮未打通，因此不声明。SDK 规定「显式模型不支持某模式必须返回 `invalid-request`，不得静默替换」，所以宁可不声明；
- `defaultModelId` 取第一个 `available === true` 的模型，否则退到第一个描述符；
- `resolutions` / `aspectRatios` / `durationsSeconds` 全部来自目录里的 `priceTiers[].selector` 与 `capabilitySpec.options`，不做枚举猜测。

### 3. 产物经 shim 的 `/bridge/media/:id` 转发，不签外链、不交 Cookie

画布的 `/api/resources/:id/file` 要 `open_ai_canvas_session` Cookie，宿主主进程没有。`normalizeCanvasTask` 把会话内路径改写成 `/bridge/media/<resourceId>`，`streamCanvasResource` 用 shim 自己的会话取流并透传 `content-type` / `content-length` / `etag` / `last-modified`。

宿主拿到的 artifact 是 `{type:"remote-url", url, headers:{Authorization: Bearer <bridgeToken>}}`——本地回环地址 + 桥自己的 token，别的进程拿不到画布会话。

### 4. 显式注册，生命周期归插件

- 目录刷新（`refreshCanvasCatalog`）只更新界面计数与模型列表，**不注册任何东西**；进入「模型」页时自动读一次，因为读目录是只读操作，值得省掉一次点击；
- 注册由面板按钮触发（`connectCanvasMediaToHost`），重复点击先 `dispose()` 上一份，避免宿主侧留下多份同名 Provider；
- 撤销是独立动作（`disconnectCanvasMediaFromHost`），只删宿主里的 Provider，不动画布任何配置——「宿主不再用」和「画布删掉模型」是两件事；
- 插件 `dispose()` 时释放注册。宿主重启后不会残留一个指向已卸载插件的 Provider。

### 5. 任务 kind 来自画布任务的 `type`，不猜

`CanvasTaskView.kind` 由 shim 从 `task.type` 去掉 `canvas_` 前缀得出，插件 `getJob` 用它决定 artifact 的 `kind`。不从 job id 猜、不从 URL 后缀决定——早期版本有个 `jobKindHint` 占位函数返回空串，属于死代码，已删。

### 6. 客户端只做形状校验，能力判定交回画布

`readCanvasTaskRequest` 只校验必填与 `kind` 白名单。模型是否支持该 operation、参数是否在允许范围、额度是否够，一律由画布的 `ValidateTaskCapability` / `resolveTaskModelSelection` 判，插件不复制策略。理由与 ADR-0006 决策 2 相同：客户端策略是提示，服务端策略才是权威（CWE-602 的反面）。

## 失败码

桥这一层有新码，见 ADR-0006 决策 5 的表（`bridge-bad-request`、`canvas-unreachable`、`canvas-task-rejected`、`canvas-task-missing`、`no-media-models`）。插件把它们翻成宿主认识的 `PluginMediaErrorCode`：

| 桥码 | 宿主码 | 可重试 |
| --- | --- | --- |
| `bridge-token-missing` / `canvas-unreachable` | `provider-unavailable` | 是 |
| `canvas-login-required` | `unauthenticated` | 否 |
| `canvas-task-rejected` | `invalid-request` | 否 |
| 其余 | `provider-failed` | 是 |

## 备选方案

| 方案 | 为什么不用 |
| --- | --- |
| 导出画布渠道密钥 → `ctx.models.replaceOwnedProviders` | 密钥根本不下发（非管理员恒空）；即使下发了，复制明文密钥进宿主是净增泄露面。已删除 |
| 在插件里实现 OpenAI 兼容的图片/视频代理端点，让画布调它 | 方向反了：画布本来就能生成，缺的是**宿主**要一个生成入口。代理还得自己持有密钥 |
| 让宿主 `ctx.ai` 支持图片生成 | 宿主不提供，改不了 |
| 只做文本、媒体留给画布 | 这是改向前的现状，用户明确要求突破 |

## 验证

```bash
cd abilities/plugins/open-ai-canvas
node scripts/verify-canvas-catalog.mjs   # 48/48 通过
npm run build                            # boot bundle + shim + 五平台 sha256 + tsc + vite
```

`verify-canvas-catalog.mjs` 两段（都是 Observed）：

1. **HTTP 段**起真的 `server/boot.mjs`（清单只声明 `linux-x64`，确定停在 `platform-unsupported`），断言四条新路由的失败码：无 token 401 `bridge-unauthorized`、无画布会话 401 `canvas-login-required`、形状非法 400 `bridge-bad-request`、`/bridge/media/:id` 无会话 503 `canvas-unreachable`；
2. **纯函数段**用 esbuild 把 `canvas-catalog.ts` 与 `canvas-media-provider.ts` 打成临时 `.mjs` 再 import，用一份按上游字段名构造的 `PublicLogicalModel` 样本验证目录归一化、任务体构造、产物改写、能力表生成与参数映射。

界面层的落地（同一轮，Observed 只到编译与打包）：

- 「模型」页按名字列出目录里的每个模型，标出 kind、能跑的模式、画布内是否可用；没有 operation 的模型仍列出但标灰并汇总一条 `bridge.catalogUnsupported`，避免「画布里明明有、宿主里没有」无从排查；
- 目录首次进入即自动读取（只读，无副作用），之后由「刷新」显式重读；
- 注册按钮显示「已登记 N 个模型」，旁边是「撤销登记」；
- 概览页在运行状态下多一个「接通画布的模型」跳转，省掉用户自己找 Tab。

**NOT RUN**：宿主的 `ctx.media.submit` → 本插件 `submit` → 画布真实生成 → 宿主 `ctx.jobs.wait` 的端到端链路只能在 Desktop 内跑（需要真实画布后端与真实渠道）。这一层属 **Assumed**，依据是 `dist/media.d.ts` 的 SPI 形状与 `docs/media.md` 的生命周期说明。

**已知限制（Observed，非缺陷）**：

- 画布文本模型登记不进来——宿主不给插件改自己的文本模型清单，画布也没有 OpenAI 兼容文本代理；
- 参考图模式未打通（缺 `POST /api/resources` 的 multipart 转发）；
- 画布任务 JSON 只有单个 `previewUrl`，所以一次生成多图的模型在宿主侧只看得到一张（上游 `taskMediaPreviewWithPoster` 的既有行为）。

## 后续

- 参考图转发打通后，把 `image-to-image` / `image-to-video` 加进 `BRIDGED_MODES`，其余不动。
- 若上游把多产物暴露成数组，`normalizeCanvasTask` 只需把 `artifacts` 的构造从单条改成一循环。
- 若宿主开放文本 provider 注册，画布文本模型可另开一份 `ctx.models` 注册，届时再改 ADR-0006 决策 3 的末段。
