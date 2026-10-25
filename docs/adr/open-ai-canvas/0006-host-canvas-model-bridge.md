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
| 插件**可以**把自己的 provider 塞进宿主模型选择器 | `ctx.models.replaceOwnedProviders()`，id 形如 `${pluginId}.${localId}`，读回时 apiKey 打码 |
| 宿主模型清单与输入栏选择器同源 | `official.models.list()` → `{ defaultModel, providers }`，含 `remote: true` 的远端目录 |

结论一句话：**宿主愿意借出「推理」，但绝不借出「凭据」，也不借出「用它自己的凭据去生图」这个动作。**

### 画布那一侧的现实（Observed）

- 画布的模型渠道在它自己的后台（`/api/admin/channels`，需管理员会话），密钥存在画布 SQLite 里；
- 后端**默认拒绝**指向回环/私网的模型上游，除非显式设置 `CANVAS_ALLOWED_PRIVATE_UPSTREAM_HOSTS`（`docker-compose.local.yml` 就是 `CANVAS_ALLOW_PRIVATE_UPSTREAMS:false` + 该变量并存）；
- 管理端接口对密钥是「只写不回读」的语义（`POST /admin/channels/export` 明确注明「导出不含任何密钥」；`publicChannel()` 的实现位置未定位到，**是否回读属于未验证项**）。

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

### 3. 方向 B（画布 → 宿主）：复用用户已经填在画布里的渠道凭据

宿主不给插件读密钥，所以「宿主 → 画布」只能走桥（方向 A）。反方向能做的是**把画布自己的渠道登记成宿主 provider**，密钥从画布那边取。

画布的管理员接口能不能回读密钥，取决于渠道作用域（已读上游 `backend/internal/app/admin.go#publicChannel` 确认）：

| 渠道作用域 | 管理员看到的 `apiKey` | 能否导出 |
| --- | --- | --- |
| system | 固定字符串 `"system"`，`baseUrl` 改写为 `/api/ai/system/<id>`，由后端代理转发 | ❌ 密钥从不下发，连管理员也看不到 |
| user | 用户自己填的真实密钥 | ✅ |

所以导出按钮的规则是：**只挑 user 作用域、`baseUrl` 是 http(s)、且声明了模型的渠道**，跳过其余并如实报告跳过了几个。桥自己创建的那条渠道是 system 作用域，永远不会出现在导出结果里——这不是缺陷，是上游把系统渠道的密钥当成服务端资产。

写入宿主时按 `open-ai-canvas.<channelId>` 作为 provider id，`replaceOwnedProviders` 的语义是**整体替换**，所以插件每次都提交一份完整快照：只有从画布导出的条目，没有别的。用户删掉画布渠道，宿主侧的对应条目随之消失——这是用户意图，不需要额外补偿逻辑。读回 `listOwnedProviders()` 的 `apiKey` 是打码的，无法「merge 后原样写回」，早期版本尝试这么做会把真实密钥覆盖成 `sk-***`，这条被明确放弃。

### 4. 媒体：明确「不支持」，并说清是哪一层不支持

需求里的「图片 / 视频」在宿主侧没有可借的接口（决策前已逐条核对，见背景表）。所以：

| 能力 | 方向 A（宿主 → 画布） | 方向 B（画布 → 宿主） |
| --- | --- | --- |
| 文本 | ✅ 经桥，`ctx.ai` | ✅ 凭据托管后注册为宿主 provider |
| 图片输入（视觉） | ❌ `PluginAiCompleteRequest` 只有 `systemPrompt` / `prompt` 文本字段，`PluginAiChatMessage.content` 也是 `string`；桥带图请求回 **422** `bridge-vision-unsupported` | — |
| 图片生成 | ❌ 宿主无密钥级生成接口，桥对该路径回 **501** | ✅ 仅当用户在插件里给过密钥 |
| 视频生成 | ❌ 同上 | ✅ 同上 |
| OCR | ❌ 不在需求内，且画布无对应渠道类型 | — |

`501` 的响应体带机器可读的 `code: "host-media-not-exposed"` 和一句人话说明，避免画布把它显示成「模型坏了」。

视觉那一格的 ❌ 是核对 SDK 类型后改的：本 ADR 初稿写成 ✅，理由是「`ctx.ai` 支持多模态」——那是宿主的模型清单字段（`PluginAiModel.input` 含 `"image"`），不是请求字段。请求侧没有放图的位置，所以桥收到 `content` 是数组的消息时直接 422，而不是把图丢掉再让模型「以为自己看过了」。同理，执行器只用 `input` 含 `"text"` 的模型上报给画布，避免画布把纯视觉模型当一个能对话的渠道。

这是本 ADR 最容易被当成能力缺失的一处，所以写死：**这不是没实现，是宿主不提供**。等到宿主的媒体注册表允许「引用宿主内置 provider」或 SDK 出现生成调用，这条限制自然消失，届时只需删掉 501 分支。

### 5. 失败码

| code | 含义 | 用户可见动作 |
| --- | --- | --- |
| `bridge-executor-offline` | 桥在，但没有插件运行时接手 | 打开 Astravia 的画布视图后重试 |
| `canvas-login-required` | 没有有效的画布管理员会话 | 打开画布登录页 |
| `canvas-channel-write-failed` | 建/改渠道被后端拒绝（权限或校验） | 展示后端原始 message |
| `bridge-vision-unsupported` | 请求里带图片内容（422） | 在画布里改用纯文本模型 |
| `no-text-models` | 宿主没有声明文本能力的模型 | 先在 Astravia 里配置一个文本模型 |
| `host-media-not-exposed` | 媒体请求打到桥 | 提示「宿主不开放媒体生成」，不是错误重试 |

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

**NOT RUN**：真实 `ctx.ai` 调用与宿主 `replaceOwnedProviders` 注册只能在 Desktop 内验证。这两条链路的行为依据是 SDK 类型（`ai.d.ts` / `models.d.ts`）与主进程实现（`redactProvider`、插件专属 media registry），端到端属 **Assumed**。渠道写入的真实后端响应同理：本地没有画布后端，422/401 来自 shim 自身校验。

## 后续（不在本文范围）

- 宿主媒体注册表若开放「引用内置 provider」，本 ADR 决策 4 应整段删除。
- 视觉桥接要等 `PluginAiCompleteRequest` 出现图片字段；在那之前 422 是最终形态，不做截断降级。
