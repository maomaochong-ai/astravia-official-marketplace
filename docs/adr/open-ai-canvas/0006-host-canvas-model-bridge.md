# ADR-0006：宿主与画布的模型桥——可以继承的、不能继承的，以及为什么必须走中继

## 状态

已接受（2026-10-25）。新增能力，不推翻既有 ADR。

## 背景

需求是双向的：

1. 画布里配置好的模型（文本 / 图片 / 视频）能被宿主 `open-astravia` 复用；
2. 宿主里已经配好的多模态模型能驱动外部浏览器里打开的画布。

### 先查清宿主给了什么（Observed）

读的是 `Astravia.app` 的 `app.asar`（`main/main-DWOjUdCb.js`）与插件 SDK 的 `.d.ts`：

| 事实 | 证据 |
| --- | --- |
| 插件**读不到**宿主 provider 的 apiKey | `cap.domain.astravia.model.provider.get` → `{ provider, ...redactProvider(provider) }`；`list()` 只给 `hasApiKey: Boolean(provider.apiKey)` |
| 宿主**没有**内置图片/视频生成 provider | `MediaProviderRegistry` 的 `providers = new Map()` 初始为空；唯一写入点是 `plugin:${pluginId}:${localId}` 的插件注册 |
| 第三方插件**拿不到**「用宿主密钥生图/生视频」的接口 | `ctx.media.submit()` 只能命中上面那张表；SDK 里没有任何宿主侧生成调用 |
| 第三方插件**没有**本地监听能力 | `PluginContext` 无 server/listen；`gateway?` 是 Astravia 服务端网关且**仅 official 插件可用** |
| 文本推理**可以**借给插件，且密钥不进插件运行时 | `ctx.ai.complete / stream({onTextDelta}) / chat({messages,tools})`，注释写明「Provider credentials never enter the plugin runtime」；输入限文本 + 图片 |
| 插件**可以**把自己的文本 provider 塞进宿主模型选择器 | `ctx.models.replaceOwnedProviders()`，id 形如 `${pluginId}.${localId}`，读回时 apiKey 打码 |
| 插件**可以**注册媒体 provider，让宿主用自己的生成入口调它 | `ctx.media.registerProvider()`（SPI v5），id 同为 `${pluginId}:${localId}`，需 `media.provider.register` → 这是 0013 用的口子 |
| 宿主模型清单与输入栏选择器同源 | `official.models.list()` → `{ defaultModel, providers }`，含 `remote: true` 的远端目录 |

结论一句话：**宿主愿意借出「推理」，但绝不借出「凭据」，也不借出「用它自己的凭据去生图」这个动作。**

### 画布那一侧的现实（Observed）

- 画布的模型渠道在它自己的后台（`/api/admin/channels`，需管理员会话），密钥存在画布 SQLite 里；
- 后端**默认拒绝**指向回环/私网的模型上游，除非显式设置 `CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS`（`docker-compose.local.yml` 就是 `CANVAS_ALLOW_PRIVATE_UPSTREAMS:false` + 该变量并存）；
- 管理端接口对密钥是「只在管理员视图回读」的语义：`publicChannel(channel, admin, …)` 里 `apiKey` 只在 `admin=true` 且 `Scope != system` 时才有值，其余情况是空串或占位符 `"system"`（2026-10-26 补读到实现，取代本节初稿的「未验证项」）。

## 决策

### 1. 方向 A（宿主 → 画布）用**中继**，不是网关

约束是两头各缺一半：shim（`server/boot.mjs`）能监听端口但没有 `ctx`；插件运行时（渲染进程）有 `ctx.ai` 但不能监听端口。因此只有一种拓扑同时成立：

```text
画布后端  ──HTTP(OpenAI 兼容)──▶  shim :<HOST_PORT>/bridge/v1/chat/completions
                                        │  入队 job
                                        ▼
                              插件运行时 ctx.services.request() 长轮询取 job
                                        │  ctx.ai.stream({ onTextDelta })
                                        ▼
                              分块 POST 回 shim ──SSE──▶ 画布
```

具体：

- shim 暴露 `GET /bridge/v1/models`、`POST /bridge/v1/chat/completions`（SSE）、`POST /bridge/v1/images/generations`（**501**，见决策 4）；
- 插件运行时以 25 s 长轮询挂 `GET /bridge/jobs`，拿到 job 后用 `ctx.ai.stream` 执行，逐块 `POST /bridge/jobs/<id>/chunk`，末端 `POST /bridge/jobs/<id>/done`；
- 桥只监听 `127.0.0.1`，要求 `Authorization: Bearer <token>`；token 在首次生成后写入 `DATA_DIR/bridge.json`（`0600`），由插件运行时用 `ctx.services.readDataFile` 读取——**token 不进画布配置的明文日志**。

这个拓扑的代价必须写在产品面上：**插件运行时活着，桥才通**。用户关掉 Astravia 的插件视图、或宿主把插件卸载/停用，画布的文本请求就会失败。失败码 `bridge-executor-offline`，画布侧看到的是明确的 503 而不是超时。这一点不做「假成功」，也不假装桥是常驻服务。

### 2. 画布渠道由插件**显式**写入，不在启动时偷偷改配置

「把宿主文本模型接进画布」是一个按钮，不是一个副作用：

1. 插件运行时读 `ctx.ai.listModels()` 得到可用文本模型；
2. 生成/复用桥 token，写 `bridge.json`；
3. 通过已捕获的管理员会话 `POST /api/admin/channels` 建一条 OpenAI 兼容渠道，`baseUrl = http://127.0.0.1:<HOST_PORT>/bridge/v1`，`apiKey = <桥 token>`，模型列表 = 宿主文本模型 id；
4. `backendEnv()` 里补 `CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS=127.0.0.1`（这项是必须的，否则后端的 SSRF 守卫会直接拒掉桥）。

管理员会话来自哪里：shim 的反向代理从登录 `Set-Cookie` 里捕获 `open_ai_canvas_session` 并存在 `DATA_DIR/session.json`（ADR-0002 已实现）。所以这条链路**要求用户已经在浏览器里登录过画布**；没登录时按钮返回 `canvas-login-required`，并直接把登录页打开。

写进画布的渠道带一个可识别前缀（`astrava-bridge-`），更新时按前缀就地改，不重复建。

用户手动删掉渠道之后**不做任何自动重建**：插件不认识「已删除」这件事，也不再尝试记录这个意图。早期草稿里有一个 `bridge.json#channelDisabled` 标记，被删掉了——`bridge.json` 由 shim 写，插件再往里写同名文件只会和 shim 抢写、制造读不到的半截状态。按钮本来就是显式的，用户要回来再按一次即可，这比维护一个跨进程状态文件更可靠。

### 3. 方向 B（画布 → 宿主）：认 `GET /api/models` 的目录，不认渠道表里的密钥

**本节在 2026-10-26 被改写。** 初稿写的是「只导出 user 作用域渠道，把密钥登记成宿主 provider」。落实时发现这条路径在真实会话下拿不到密钥，代码与测试都已改向，理由见下。

#### 初稿错在哪（Observed）

上游 `backend/internal/app/admin.go#publicChannel` 的 `apiKey` 赋值只有三支：

```go
if channel.Scope == model.ChannelScopeSystem {
    if !admin { apiKey = "system"; baseURL = "/api/ai/system/" + channel.ID }
} else if admin {
    apiKey = channel.APIKey
}
```

把它读成表：

| 渠道作用域 | 普通会话（`admin=false`） | 管理员会话（`admin=true`） |
| --- | --- | --- |
| system | `apiKey: "system"`，`baseUrl` 改写为 `/api/ai/system/<id>`（占位，不是密钥） | `apiKey: ""`，连管理员也拿不到 |
| user | `apiKey: ""` —— **空** | `apiKey` 是用户自己填的真实密钥 |

所以「只挑 user 作用域就能拿到密钥」只在**管理员会话**下成立。插件的会话是用户在画布里登录后捕获的普通会话，`apiKey` 一律为空——这正是界面上那句 `exported 0，skipped 1（画布未下发密钥）` 的来源，不是 bug。

即使会话是管理员，这条路的性质也很差：插件会把用户**所有**自定义渠道的明文密钥复制进宿主的 provider 列表，多一个泄露面，还多一份要维护的密钥副本。这是典型的客户端代办服务端职责（CWE-602 的思路），不该做。

#### 改成的做法

方向 B 的交接面换成画布对**当前用户**的服务端权威投影 `GET /api/models`（上游 `internal/handler/logical_models.go` → `PublicLogicalModel`）。它按登录用户返回「画布里已经配好的模型」，字段恰好够用，而且**不含任何密钥**：

| 字段 | 用途 |
| --- | --- |
| `id` / `name` / `description` | 模型身份与展示 |
| `capability` | `chat` / `image` / `video` / `audio`，决定宿主侧登记成文本模型还是媒体模型 |
| `capabilitySpec.operations`、`capabilityProfiles[].operations` | 该模型真能跑的操作（`text_to_image`、`text_to_video`…） |
| `priceTiers[].selector` | 规格真相：`quality`、`vquality`、`size`、`videoSeconds` |
| `available` | 画布自己给出的路由可用性 |

宿主侧的落地方式见 [ADR-0013](./0013-canvas-media-models-as-host-providers.md)：图片/视频模型经 `ctx.media.registerProvider` 登记成宿主媒体 Provider，任务仍由画布执行。文本模型不登记——`ctx.ai` 的模型清单是宿主自己的，插件无法往里塞 provider，而画布的文本任务走 `createTextReplayTask` 由前端直连模型、后端只存日志，没有 OpenAI 兼容的文本代理可挂（Observed，见 `internal/app/task_creation.go` 的 `isTextReplayTaskRequest`）。

#### 为什么不再需要 `models.manage`

初稿用 `ctx.models.replaceOwnedProviders` 整体替换宿主 provider 列表（`apiKey` 读回是打码的，无法 merge 写回；早期版本尝试 merge 会把真实密钥覆盖成 `sk-***`）。这条路径随之删除，`plugin.json` 里的 `models.manage` 权限也一并去掉——权限跟着实际调用走，不跟着历史设计走。

画布那边给宿主开的渠道（决策 2）仍是 system 作用域，它的 `apiKey` 在画布管理员界面上也只显示 `"system"`；这条渠道只服务方向 A，不参与任何导出。

### 4. 媒体：方向 A 只到文本，方向 B 走媒体 Provider 注册

分成两条互不相干的路，别再混成一句「不支持媒体」。

#### 方向 A（宿主 → 画布）：仍然只到文本

| 能力 | 结论 | 依据 |
| --- | --- | --- |
| 文本 | ✅ 经桥，`ctx.ai` | — |
| 图片输入（视觉） | ❌ 桥带图请求回 **422** `bridge-vision-unsupported` | `PluginAiCompleteRequest` 只有 `systemPrompt` / `prompt`；`PluginAiChatUserMessage.content` 是 `string` |
| 图片 / 视频生成 | ❌ `/bridge/v1/(images\|videos)/generations` 回 **501** `host-media-not-exposed` | 宿主不把密钥级生成能力下放给插件；`ctx.ai` 没有生成调用 |

`501` 的响应体带机器可读的 `code` 和一句人话说明，避免画布把它显示成「模型坏了」。执行器只把 `input` 含 `"text"` 的模型上报给画布，免得画布拿纯视觉模型当对话渠道。

这一格的 ❌ 不是没实现，是宿主不提供：`PluginAiModel.input` 里的 `"image"` 是**模型清单**字段，不是**请求**字段。桥收到数组形式的 `content` 直接 422，而不是把图丢掉让模型「以为自己看过了」。

#### 方向 B（画布 → 宿主）：走 `ctx.media.registerProvider`

宿主确实不把生成能力交给 `ctx.ai`，但它有另一条口子：插件可以**注册自己的媒体 Provider**，让宿主界面的生成入口直接调用它。于是画布里配好的图片/视频模型可以这样接进来——

- SPI 版本 5（`pluginApiVersion ^2.4.0` 起可得），权限 `media.provider.register`；
- 只声明桥真能跑完的模式：`text-to-image`、`text-to-video`。`image-to-image` / `image-to-video` / `reference-to-video` 需要把参考图上传到画布（`POST /api/resources` 的 multipart 转发），本轮未打通，因此**不声明**——SDK 规定显式模型不支持某模式时必须返回 `invalid-request`，宁可不声明也不静默降级；
- 产物 kind 由画布任务的 `type`（`canvas_image` / `canvas_video`）决定，不从 job id 或 URL 后缀猜；
- 画布的 `/api/resources/:id/file` 要会话 Cookie，宿主主进程没有，所以产物改走 shim 的 `/bridge/media/:id` 带 Cookie 转发；宿主拿到的是一条本地可读 URL。

细节与取舍见 [ADR-0013](./0013-canvas-media-models-as-host-providers.md)。

### 5. 失败码

| code | 含义 | 用户可见动作 |
| --- | --- | --- |
| `bridge-executor-offline` | 桥在，但没有插件运行时接手 | 打开 Astravia 的画布视图后重试 |
| `canvas-login-required` | 没有有效的画布管理员会话 | 打开画布登录页 |
| `canvas-channel-write-failed` | 建/改渠道被后端拒绝（权限或校验） | 展示后端原始 message |
| `bridge-vision-unsupported` | 请求里带图片内容（422） | 在画布里改用纯文本模型 |
| `no-text-models` | 宿主没有声明文本能力的模型 | 先在 Astravia 里配置一个文本模型 |
| `host-media-not-exposed` | 方向 A 的媒体请求打到桥（501） | 提示「宿主不开放媒体生成」，不是错误重试 |
| `bridge-bad-request` | 插件侧调用 `/bridge/canvas/tasks` 形状不合法（400） | 插件 bug，不是用户动作 |
| `canvas-unreachable` | 画布后端没起或资源取件失败（502 / 503） | 等画布启动；`verify-canvas-catalog.mjs` 断言的就是这条 |
| `canvas-task-rejected` | 画布拒绝了任务（能力/参数/额度） | 展示画布原始 message，不要重试同样参数 |
| `canvas-task-missing` | 任务 id 不存在或已被清理（404） | 重新提交生成 |
| `no-media-models` | 目录里没有声明了 operation 的图片/视频模型 | 先在画布里给模型配好能力，再点「在 Astravia 里使用」 |

## 兼容和迁移

- 不改变画布既有行为：不点按钮，画布照旧用自己配置的渠道。
- 宿主侧新增的 provider 只在用户保存凭据后出现，可随时在宿主里删除。
- 桥的 token 与 `bridge.json` 属于 `DATA_DIR`，卸载插件即随之消失。

## 备选方案

| 方案 | 否决理由 |
| --- | --- |
| 插件运行时起一个 OpenAI 兼容 HTTP 服务 | 渲染进程没有 listen 能力（SDK 无该 API） |
| 从宿主读 apiKey 写进画布 | `redactProvider` 已封死；强行实现等于要求宿主放宽沙箱 |
| 用 `ctx.media.submit()` 调宿主图片模型 | 注册表为空且只接受插件自注册，调不到宿主的 |
| 让 shim 直接调 `ctx.ai` | shim 没有 `ctx`（`host-node` 运行时只有 env 与 stdio） |
| 用户手工把密钥在两边各填一次 | 能用，但每次改渠道都要重填；已确认 user 作用域可回读，导出快照更省事 |

## 验证

```bash
cd abilities/plugins/open-ai-canvas
node scripts/verify-bridge.mjs     # 26/26 通过（Observed）
npm run check                      # tsc，含新增的两个桥模块
```

`verify-bridge.mjs` 起**真的** `server/boot.mjs`（用 `CANVAS_PAYLOAD_MANIFEST` 指向一份只声明 `linux-x64` 的清单，于是任何开发机都停在 `platform-unsupported`，桥照常监听——顺带证明了决策 1 的「桥与后端就绪解耦」）。断言清单：

| 断言 | 结果 |
| --- | --- |
| shim 在载荷不可用时仍然监听 | Observed（`phase=failed` + `platform-unsupported`，端口活得） |
| `bridge.json` 权限 `0600` | Observed |
| `GET /bridge/v1/models` 允许匿名、带 `X-Bridge-Executor: offline`、`{object:"list"}` | Observed |
| `GET /bridge/jobs`、`POST /bridge/v1/chat/completions`、`GET /bridge/admin/channels` 无 token → 401 | Observed |
| 无执行者 → 503 `bridge-executor-offline` | Observed |
| 上报模型 → 清单出现该 id；chat 变成可取任务并带出原始 messages | Observed |
| 两次 chunk → SSE 增量为 `["pong","!"]`、末块 `finish_reason=stop`、`[DONE]` 收尾 | Observed |
| 带图 → 422 `bridge-vision-unsupported` | Observed |
| `/bridge/v1/{images,videos}/generations` → 501 `host-media-not-exposed` | Observed |
| 首个字节前出错 → 502 JSON；流中出错 → `data:{error}` + `[DONE]` | Observed |
| 未登录画布 → 401 `canvas-login-required`（不挂住、不假装成功） | Observed |

**NOT RUN**：真实 `ctx.ai` 调用与宿主侧媒体 Provider 的端到端生成只能在 Desktop 内验证。这两条链路的行为依据是 SDK 类型（`ai.d.ts` / `media.d.ts`）与主进程实现，端到端属 **Assumed**。渠道写入的真实后端响应同理：本地没有画布后端，422/401 来自 shim 自身校验。

### 决策 3 / 4 改写后的追加验证（Observed）

`node scripts/verify-canvas-catalog.mjs` —— **48/48 通过**，两段：

| 断言 | 结果 |
| --- | --- |
| `GET /bridge/canvas/models` 无 token → 401 `bridge-unauthorized` | Observed |
| 有 token、无画布会话 → 401 `canvas-login-required`（不假成功） | Observed |
| `POST /bridge/canvas/tasks` 缺 `logicalModelId` / `prompt`、`kind` 越界 → 400 `bridge-bad-request` | Observed |
| 形状合法但无会话 → 401 `canvas-login-required` | Observed |
| `GET /bridge/canvas/tasks/:id` 无会话 → 401；`GET /bridge/media/:id` 无会话 → 503 `canvas-unreachable` | Observed |
| `GET /bridge/media/:id` 无 token → 401（产物不是公开链接） | Observed |
| `normalizeCanvasCatalog`：`chat` → text、未知能力丢弃、按 name 排序、`available` 只在显式 `true` 时为真 | Observed（纯函数） |
| 计数按 kind 汇总；`operations` 合并 `capabilitySpec` 与 `capabilityProfiles` | Observed |
| `resolutions` 取 `quality`/`vquality`/`imageResolution`/`resolution` 去重；比例只收 `数字:数字`；时长取正整数并升序 | Observed |
| `buildCanvasTaskBody`：`type=canvas_<kind>`、`input.mode` 与之一致、参数落在 `input.config`、无 `projectId` 就不写该键 | Observed |
| `normalizeCanvasTask`：状态小写、`kind` 取自 `type`、`/api/resources/:id/file` → `/bridge/media/:id`、绝对 http(s) 保留、`progress` 原值透传 | Observed |
| `buildMediaCapabilities`：只登记声明了 operation 的模型，其余计入 `unsupported`；视频能力只声明 `text-to-video`；`durationsSeconds` 升序 | Observed |
| `taskOptionsOf`：`aspectRatio→size`、`resolution→vquality`(video)/`quality`(image)、`durationSeconds→videoSeconds`（取整成字符串） | Observed |

## 后续（不在本文范围）

- 视觉桥接要等 `PluginAiCompleteRequest` 出现图片字段；在那之前 422 是最终形态，不做截断降级。
- 画布文本模型无法登记成宿主文本 provider（宿主不给插件改自己的模型清单），这条没有「等 SDK」的时间表，除非宿主开放文本 provider 注册。
