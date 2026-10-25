# 0008 — 前端产物由 shim 承载，不依赖后端静态路由

- 状态：已接受（现行）
- 日期：2026-10-25
- 取代：无
- 被取代：无
- 相关：0003（运行时分发）、0004（启动就绪契约）、0005（构建农场）

## 背景

插件在 Windows 与 macOS 上启动后，宿主状态是「运行中」，`/api/health/ready` 也是 200，但用户点「在浏览器中打开」只看到一段 JSON：

```json
{"code":404,"data":null,"msg":"请求不存在","reason":"not_found"}
```

这个信封可以逐字归位（**Observed**）：

- `backend/internal/handler/response.go` 的 `fail()` → `writeFailure()` 拼成 `{"code":code,"data":null,"msg":message}`，再按状态码附加 `reason`（404 → `not_found`）；
- 唯一产出这段中文的调用点是 `backend/internal/handler/auth.go:281`，位于 `SystemProxyNoRouteHandler`。

也就是说：请求落到了 Go 的 `NoRoute`，而且**没有任何非 `/api` 路由认领它**。

载荷本身是完整的。`scripts/build-service-zip.mjs --web` 会把上游 `web/dist` 收进 `web-dist/`，`payload-manifest.json` 与五个平台的 zip 里都有这份产物（**Observed**：构建脚本与清单结构）。缺的不是文件，是**服务它的那一段代码**。

## 决策

**前端产物由 shim（`server/boot.mjs`）自己承载。**

处理顺序（`startProxy()` 内，自上而下匹配）：

1. `GET /__canvas/state`；
2. `serveBridge()` —— 模型桥，与后端就绪解耦；
3. `if (!goPort) servePreparation()` —— 准备页；
4. `POST /mcp` → MCP Server；
5. `pathname === "/mcp"` 的其它方法 → `405 Allow: POST`；
6. **非 `/api` 的 `GET`/`HEAD` → 从 `WEB_DIST` 读文件**；
7. 其余（`/api/*`、`upgrade`）透明透传到 Go。

规则与上游分支版 `backend/internal/handler/static_site.go` 对齐，避免两套语义：

- `..`、反斜杠、NUL、`decodeURIComponent` 失败、越出 `WEB_DIST` → 直接 404，不碰磁盘；
- 目录 → 试其 `index.html`；
- 未命中且「`Accept` 含 `text/html` 或路径无扩展名」→ 回退 `index.html`（SPA 深链）；带扩展名未命中则是真实 404，免得坏掉的 JS 被当成 HTML 喂给模块加载器；
- `/assets/` 前缀 → `public, max-age=31536000, immutable`（文件名带内容哈希），其余 `no-cache`；
- 统一带 `X-Content-Type-Options: nosniff`，`HEAD` 只写头。

另外，`prepareRuntime()` 在 `WEB_DIST` 赋值后立即检查 `web-dist/index.html`，缺失就以 `web-bundle-missing` 失败（新增的第 7 个稳定失败码，`FAILURE_MESSAGE_KEYS` 与两套语言包同步）。

## 为什么不改载荷

构建农场（0005）钉的是 `ddcat-ai/open-ai-canvas` 的**最新发布 tag**，每天比对一次 commit 决定是否重发。静态承载特性只存在于 fork 分支 `feat/desktop-shell-tauri-local-service`（`af75ac24`、`7bf9b0ee`）；`v1.6.9.2 / v1.6.9.1 / v1.6.9 / v1.6.8.12 / v1.6.8.11` 全部没有 `static_site.go`，`main.go` 的 `NoRoute` 仍是 `SystemProxyNoRouteHandler`（**Observed**：逐个 tag 检出比对）。

于是「让后端自己发静态文件」有两条路，都被否掉：

| 方案 | 做法 | 否掉的理由 |
| --- | --- | --- |
| A | 载荷改从 fork 的固定 commit 构建 | 丢掉「跟随上游 tag 自动发布」这条唯一的保鲜机制；每次上游发布都要人工合并一次分支，而合并冲突正好出在 `main.go` 的路由注册处 |
| B | 等上游把这个分支合进主线 | 没有时间表，且与 0005 的每日自动化冲突——上游合入前，任何平台打开画布都还是 404 |

方案 C（本 ADR）：**在 shim 补这一层**。

- 不需要重发五个平台各约 200 MB 的载荷，只换 40 KB 的 shim；
- shim 本来就把载荷解到本地、本来就在对外端口上，`WEB_DIST` 是现成的；
- 纯 JS，平台无关，改一次五平台同时修好；
- 上游将来真的带上 `CANVAS_STATIC_DIR` 也不冲突：shim 始终先接管，后端那段代码只会成为没人走到的分支。`backendEnv()` 仍然传 `CANVAS_STATIC_DIR`，就是这个原因。

## 代价

- **多一层要维护的文件语义**：MIME 表、缓存策略、SPA 回退规则都在 shim 里，将来上游加新资源类型需要同步。
- **`/api` 边界靠前缀判断**：shim 不猜路由，`/api` 一律透传。若上游将来把某个非 `/api` 路径做成 API（当前没有），需要回来放宽这一行。
- **`web-bundle-missing` 是新增契约**：旧版插件运行时收到这个 code 只会显示 `error.startFailed` 兜底文案，不会误导，但也拿不到具体原因。

## 验证

`scripts/verify-web-hosting.mjs` 起真实 shim 进程，`ASTRAVIA_SERVICE_RUNTIME_DIR` 指向临时目录（内含假 `web-dist/` 与一个真监听端口的替身后端），因此不下载载荷、不联网。

- 修复后：**17/17 通过**（首页、hash 资源、SPA 深链、缺失脚本真实 404、`/api` 透传、目录逃逸拒绝、`HEAD`、`GET /mcp` 405、缺 `web-dist` 时的失败码与准备页）。
- 同一套断言跑在修复前的 shim（`git show HEAD:…/server/boot.mjs`）上：9 条静态断言全红，所有非 `/api` 请求被透传给后端——正是生产上看到 404 信封的那条路径（**Observed**）。

仍未验证的部分（**Assumed**）：真实 Go 载荷 + 真实 `web/dist` 产物在四个非本机平台上的端到端表现。本地 `.payload/` 只有 555 B 的假夹具，无法替代真载荷；需要一次实机启动确认。
