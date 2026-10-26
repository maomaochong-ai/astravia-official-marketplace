# ADR-0015：画布创作目录是渠道模型的投影，连接动作以读回目录为准

- 状态：已接受（2026-10-27）
- 改写：ADR-0006 决策 2 的**写入范围**（桥的传输契约、token、方向不变）
- 相邻：ADR-0013（反方向的媒体 Provider）

> 本文的证据等级按 `README.md` 的字面约定使用，另加一种标注：**Observed（源码）** 表示
> 「在本机上游检出里读到并核对了行号」，不是运行结果。本机没有跑起画布后端与数据库，
> 所以任何「接口实际返回什么」都只能是 Inferred。

## 背景：按钮点了，画布还是空的

用户点「让画布用上 Astravia 的模型」后，插件把宿主的文本模型写进画布的一个自定义渠道，
界面报告「已创建渠道」。浏览器里的画布创作页却看不到任何 Astravia 的模型。

原因不是画布坏了，是**插件写少了一级**。

### 画布的创作目录读的是渠道模型，不是逻辑模型

- Observed（源码）：`web/src/services/api/logical-models.ts:219` 的 `getModelCatalog()` 请求
  `GET /model-catalog`，注释写明「创作目录直接读取系统渠道模型，不使用逻辑模型及其功能开关」。
- Observed（源码）：`backend/internal/handler/model_catalog.go:31` 把该路由接到
  `Service.ModelCatalog(nil)`；`backend/internal/app/model_catalog.go:101-103` 的注释同样声明
  「创作端目录始终来自系统渠道模型，不反查逻辑模型或路由」。
- 推论（Inferred）：给画布补逻辑模型 + 路由对这张目录**没有任何作用**。这条排除掉了一个
  看起来最像正解的方案。

### 三级投影里，插件只做了最外面那级

`publicSystemChannelCatalog`（`model_catalog.go:124-186`）逐条过滤：

1. `channel.Enabled` 为 false → 整条渠道跳过（`:132`）；
2. `cm.Enabled` 为 false → 该模型跳过（`:143`）；
3. `sanitizeChannelModel` 解不出能力配置 → 该模型跳过（`:162-168`，`normalizedChannelModelCapability` 对
   `text` 缺 `capabilityConfig.text` 直接报「请配置文本模型能力参数」，见 `model_capability.go:217-219`）；
4. 公开价格档 `publicTiers` 决定 `Available: len(publicTiers) > 0`（`model_catalog.go:257`），
   而档位要求 `tier.Enabled && tier.PriceConfigured && ValidatePriceTierPrice(...)`
   （`:200`）；`fixed_request` + 0 积分是合法免费档（`price_validation.go:23-26`）。

插件原来只写 `POST /admin/channels`，`models[]` 交给上游的 `syncInitialChannelModels`
（`admin_channels.go` → `channel_models.go:370`）。那一步建出来的渠道模型是：

```go
Enabled: false, PriceConfigured: false, DisplayName: "未分类"
```

Observed（源码）：`channel_models.go` 的同步构造函数里这三个字段就是上面这些值。

于是画布目录里留下的是**一串禁用、无价、无能力配置的行**——用户看不见，画布也没法用。
这就是「点了按钮没反应」的全部机制。不是缓存、不是权限、不是浏览器。

## 决策

### 1. 目录真相是渠道模型；渠道只是接线端子

一次「连接」必须写全三级，缺一级就不可见：

| 级 | 写什么 | 不写会怎样 |
| --- | --- | --- |
| 渠道 | `name`（`astravia-bridge-` 前缀）、`baseUrl` 指回 shim 的 `/bridge/v1`、`apiKey` = 桥 token、`enabled: true` | 整条渠道被跳过 |
| 渠道模型 | `modelKey` / `providerModelKey` / `displayName` / `channelLabel` / `capability: "text"` / `protocol: "chat-completion"` / `enabled: true` / `capabilityConfig` | 行被跳过，或能力解析失败 |
| 价格档 | `billingMode: "fixed_request"`、`unitPriceMicrocredits: 0`、`priceConfigured: true` | `Available: false`，画布认为不可用 |

### 2. 不再用 `POST /admin/channels` 的 `models[]`

那条路径建出的是禁用行（见背景）。改为：创建渠道时 `models: []`，模型逐条走
`POST /admin/channels/:id/models`（新建）与 `PATCH /admin/channels/:id/models/:modelId`（更新）。
这两条接口绑定的是 `ChannelModelRequest`（`internal/app/channel_models.go:15-34`），
`enabled` 是 `*bool`，新建时缺省为 `true`（`channel_models.go:192`）。

兼容说明（Observed（源码），`channel_models_pricing.go:104-114`）：请求里不带 `priceTiers` 时，
上游会把顶层 `billingMode` / `unitPriceMicrocredits` / `priceConfigured` 折算成一个默认档位。
所以免费档不需要手写 `priceTiers` 数组。

### 3. 归属靠前缀 + 只在自家渠道内动手

- 渠道按名字前缀 `astravia-bridge-` 认领（画布没有来源字段）。
- 渠道模型的归属是**该渠道 + `modelKey`**。宿主已经删掉的模型，只有落在我们自己渠道内才删除
  （`DELETE /admin/channels/:id/models/:modelId`），不动任何别的渠道。
- 认领失败（同名但不是我们的渠道）就报错，不猜。

### 4. 不信任自己的写入结果：读回 `/api/model-catalog` 再宣布成功

这是 CWE-602 的直接教训：把「我发了请求」当成「用户能看见了」，等于让客户端自证。

连接动作的最后一步是读 `GET /api/model-catalog`（同一个读路径，画布 UI 用的就是它），
按 `channelId` + `modelKey` 把期望集合分成：

- **usable**：出现在目录里且 `available === true`、带 `capabilityConfig.text`；
- **blocked**：出现了但不可用（`available: false` 或没有文本能力配置）；
- **missing**：压根没出现（渠道或模型被跳过）。

界面报告的是 usable 的实际条数与前三类的分类计数。**usable 为 0 就报失败**，不报「已创建渠道」。

### 5. 仍然只投影 `text` 能力

shim 的 `/bridge/v1/images|videos/generations` 恒返回 `501 host-media-not-exposed`
（ADR-0006 的证据：`ctx.ai` 没有密钥级媒体生成）。把宿主的图片/视频模型也投影进画布，
等于在画布里放一批**点了必然失败**的模型。媒体方向仍由 ADR-0013 的反向 Provider 承担。

### 6. 免费档是刻意的

桥接是本机进程内的中继，不产生真实计费。写 `fixed_request` + 0 积分是让画布能把这条渠道模型
判成 `Available`，不是在伪装付费模型。金额与计费模式都在读回结果里可见，不做隐藏。

## 后果

**收益**

- 连接之后画布真的能看到并使用宿主模型；失败时用户看到的是「几条可用 / 几条被挡 / 几条没出现」，
  而不是一句「已创建渠道」。
- 目录可用性有唯一判据（读回），不再依赖「请求 200 就算成功」。
- 陈旧条目会被清掉，画布目录不会因为宿主换模型而积累死行。

**代价**

- 写入面从 1 个接口扩到 4 个（渠道、渠道模型增改删、目录读回），shim 与画布契约的耦合更深。
- `capability: "text"` + `protocol: "chat-completion"` + `fixed_request` 是**硬编码假设**；
  上游改协议标识或拒绝 0 元档，行为会退化。缓解手段是读回校验把它暴露成「被挡」而不是静默成功，
  外加 `verify-channel-projection.mjs` 断言 payload 形状。
- 删除陈旧模型是写操作，误判会删掉用户手工加的模型——因此限定在自家渠道 + 该渠道内 modelKey
  不在期望集合中，且只在渠道确实是我们的（前缀认领成功）时执行。

## 被否决的选项

| 选项 | 否决理由 |
| --- | --- |
| 继续只写渠道（现状） | Observed（源码）：建出的是禁用行，目录不可见 |
| 补逻辑模型 + 路由 | 创作目录明确不读逻辑模型（`model_catalog.go:101-103`、前端注释） |
| 改画布前端去读 `/api/models` | 前端是上游产物，插件不改上游代码 |
| 把宿主图片/视频模型也投影进画布 | shim 媒体端点恒 501，只会造出必失败的条目 |
| 让用户自己在画布里手工配模型 | 这正是「连接」按钮要替代的劳动 |
| 只读回、不修正 | 用户点按钮的语义就是「让它能用」 |

## 证据边界

- **Observed（源码）**：上述所有 Go / TS 行号；`ChannelModelRequest` 字段；`fixed_request` 0 元合法；
  `Available` 与价格档的关系；`syncInitialChannelModels` 的默认值。
- **Observed**：插件 → shim `/bridge/admin/channels` 的链路在 0.1.6 时代已经跑通（ADR-0006/0013 记录）。
- **Inferred**：真实部署里 `GET /api/model-catalog` 的响应形状（按 `handler` 与读模型定义推出，
  本机没有登录会话，未实机调用）；画布 UI 对 `available: false` 的具体呈现（推测为禁用/隐藏）。
- **Assumed**：`chat-completion` 协议在目标部署的协议注册表里是 `Enabled` 且无 `UnavailableReason`；
  写入门禁（admin scope）对桥接 token 成立——后者在 ADR-0006 已由 shim 的 system scope 会话保证，
  本轮未重新实测。
- **NOT RUN**：端到端「装包 → 点按钮 → 浏览器画布看到模型」。本机没有可点的 UI，也没有能登录的画布后端。
