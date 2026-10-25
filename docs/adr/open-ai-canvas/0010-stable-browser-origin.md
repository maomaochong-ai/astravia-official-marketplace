# 0010 — 浏览器 origin 固定下来，让画布配置活过重启

- 状态：已接受（现行）
- 日期：2026-10-25
- 修正：0004（启动就绪契约）里「宿主端口即页面地址」的隐含前提
- 相关：0003（运行时分发与跨平台）、0008（前端承载在 shim 里）

## 背景

用户的反馈很具体：**每次启动端口都不一样，之前配好的画布模型全部消失。**

端口为什么会变，是宿主决定的（**Observed**，宿主源码）：

- `apps/desktop/src/main/plugins/plugin-service-provider-service.ts` 的 `allocateLoopbackPort()` 用 `listen(0)` 让操作系统分配临时端口；
- `packages/plugins/plugin-sdk/src/manifest-schema.ts` 的服务声明是 `additionalProperties: false`，**没有 port 字段**，插件无法向宿主申请固定端口。

端口变为什么等于配置消失，是画布前端决定的（**Observed**，上游 `open-ai-canvas/web`）：

- `web/src/stores/use-config-store.ts` 用 zustand `persist` + `createJSONStorage(() => scopedLocalStorage)` 保存渠道、模型、apiKey；
- `web/src/lib/localforage-storage.ts` 及多个 store 用 localforage（IndexedDB，`name: "yingce"`）保存草稿、资源与画布状态。

`localStorage` 与 `IndexedDB` 都**按 origin 隔离**。`http://127.0.0.1:53111` 和 `http://127.0.0.1:53472` 是两个互不相干的存储命名空间，所以「换了端口」在浏览器眼里就是「换了一个从未用过的应用」。

同一根因还有两处不那么显眼的伤口（**Observed**，`server/boot.mjs`）：

| 位置 | 后果 |
| --- | --- |
| `CANVAS_PUBLIC_BASE_URL` 用宿主端口 | 上传的图片在库里存的是绝对地址，重启后全部变成死链 |
| `canvasUrl()` 用宿主端口 | MCP 返回给对话的画布链接，下一次启动就失效 |

也就是说：不修这个，任何「保存配置」「记住布局」「上传素材」的功能都只在单次运行内成立。

## 决策

**除宿主端口外，shim 再抢一个固定回环端口，专门当「浏览器 origin」。宿主端口只负责健康检查与模型桥。**

1. **候选与记忆** —— 依次试 `DATA_DIR/browser-origin.json` 里记下的端口、`47810–47813`（`CANVAS_STABLE_PORTS` 可覆盖，`off` 可关闭）。抢到就写回该文件，下次优先复用它。
2. **导航请求 302** —— 宿主端口上收到 `GET`/`HEAD`、`Accept` 含 `text/html`、路径不在 `/api`、`/bridge`、`/__canvas`、`/mcp` 之下时，302 到固定 origin（连 query 一起带过去）。
3. **一个 handler，两个 server** —— 固定 origin 的 server 把请求 `emit` 给宿主端口那份实现，路由、状态机、session 捕捉只有一份代码。用 `req.socket.localPort === HOST_PORT` 判断请求来自哪个口，避免自我重定向。
4. **面向浏览器的地址改用固定 origin** —— `CANVAS_PUBLIC_BASE_URL`、`CANVAS_CORS_ORIGINS`、`canvasUrl()` 全部换成 `PUBLIC_ORIGIN`；CORS 白名单同时保留宿主端口（探针与旧标签页）。
5. **插件侧双保险** —— `/__canvas/state` 增加 `origin` 与 `originPinned`；`runtime.ts` 打开画布时优先用 `origin`，拿不到才回退到宿主基址（老 shim 没有该字段，行为即改造前）。
6. **抢不到就降级** —— 所有候选都被占用时退回宿主端口，只在日志里说明「状态不会随重启保留」。画布照常能用，不会因为抢不到端口而启动失败。

`bindStableOrigin()` 必须早于 `startProxy()`：`backendEnv()` 要用 `PUBLIC_ORIGIN` 算公开基址与 CORS，算晚了后端就跑在旧值上。

## 为什么不去要一个固定端口

这是最自然的第一反应，也是被 schema 直接挡住的那条。

- **宿主没这个口子**：`PluginServiceProviderManifestSchema` 是 `additionalProperties: false`，写 `port` 进去插件装不上，不是「暂时没实现」，是校验就过不去。
- **问了也没用**：即便宿主将来支持声明端口，冲突处理、多实例、被占用后的重试仍要写在插件侧。现在的做法把这些留在了唯一知道「谁在用这个端口」的地方。
- **改动半径**：宿主改动要跟版本、要过 SDK 发布节奏；而用户现在就丢配置。

## 为什么不把配置镜像到服务端

- `localStorage` 能镜像，`IndexedDB` 不能干净地镜像——上游的草稿、资源、画布状态都在后者（`localforage`），只救前者等于只救半条命。
- 要覆盖全部状态就得逐个 store 改写，那是在 fork 里维护一份与上游持续分叉的前端，成本远高于钉住一个端口。

Service Worker 也不行：它的作用域同样绑定 origin，origin 变了，注册的 SW 也就没了。

## 代价

- **多监听一个端口。** 这是本决策唯一新增的系统资源。绑定失败一律降级，不阻塞启动。
- **判别靠 `Accept` 头。** 浏览器导航必带 `text/html`，`fetch`/XHR 默认通配，所以「跳」与「不跳」能分开；但这是启发式，非常规客户端（自定义 UA + 通配 Accept）会直接拿到页面而不是 302——对它们也是正确结果。
- **占用与冲突。** 47810–47813 不是保留端口。被别的程序占走时会换下一个；四个全被占则降级，并在日志里写明后果。
- **一次性迁移。** 已经丢掉的配置不会因为这次修复回来，用户需要在新的固定 origin 上重新配一次，此后不再丢。旧随机端口留下的 localStorage 数据仍留在浏览器里，属于垃圾但无害。
- **CORS 面变宽了一点。** 白名单从 2 项变 4 项（两个端口 × `127.0.0.1` 与 `localhost`），全部是本机回环，不引入外部来源。

## 验证

`scripts/verify-stable-origin.mjs` 起真实 shim 进程，`ASTRAVIA_SERVICE_RUNTIME_DIR` 指向临时目录（假 `yingce-backend` + 假 `web-dist`），`CANVAS_STABLE_PORTS` 给临时空闲端口——不去抢用户机器上真实的 4781x。五个场景：

| 场景 | 环境 | 断言 |
| --- | --- | --- |
| A 首次启动 | 两个临时端口 | `originPinned=true`；`origin` 等于给定端口；宿主端口上的导航请求 302 且 Location 精确到 `origin/`；深链连 query 一起带；通配 Accept 不跳；`/__canvas/state` 与 `/api/*` 即使声称要 HTML 也不跳；固定 origin 上首页、带 hash 资源、`/api` 全部正常；`browser-origin.json` 落盘 |
| B 重启 | 同数据目录、宿主端口重分配 | 宿主端口确实变了**而 origin 不变**；上次的 origin（旧书签）仍能打开画布 |
| C 首选被占 | 先占住候选第一项 | 退到次选且 `originPinned=true`；日志有 `trying next` |
| D 关闭 | `CANVAS_STABLE_PORTS=off` | `originPinned=false`、`origin` 退回宿主端口、导航直接 200 无重定向 |
| E 全被占 | 占住全部候选 | 降级到宿主端口、日志写明后果、画布仍可打开 |

结果：**24/24 通过**（**Observed**）。B 场景是这次问题的直接复现——把「重启后 origin 是否相同」当成断言，而不是靠人眼比对端口号。

仍未验证的部分（**Assumed**）：真实浏览器在固定 origin 上的 localStorage 长期存活（理论上就是 origin 不变则存储不变，但没在真实 Chrome/Edge/safari 上跑过一次「配模型 → 重启 → 看配置是否还在」的往返）；Windows 上第二次监听回环端口是否会触发防火墙提示（同一进程、仅 IPv4 回环，按现有表现预期不会）。

## 回滚

删掉 `bindStableOrigin()` 调用与 `shouldPinOrigin` 分支即可回到「宿主端口即 origin」；`PUBLIC_ORIGIN` 的初值就是宿主端口，所以两者可以分步撤。已发布的制品不可变，回滚要再发一版。
