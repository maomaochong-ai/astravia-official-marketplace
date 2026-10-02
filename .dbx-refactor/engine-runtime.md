# 引擎运行时通路调查：插件如何自持本地数据库服务

> 调查对象是宿主仓库 `open-astravia`（`/Users/zhugeyue/Desktop/project/bigdate/source-code/open-astravia`）。
> 全程只读，未修改宿主、旧项目或插件源码。证据分级沿用 [README.md](./README.md)：`【实证】`附 `路径:行`。
>
> **问题索引**：Q1 §2.1–2.5 ｜ Q2 §2.6 ｜ Q3 §3.0 ｜ Q4 §3.2 ｜ Q5 §3.3 ｜ Q6 §3.4 ｜ Q7 §2.7 ｜ Q8 §3.5 ｜ Q9 §3.6

---

## 1. 结论先行

**`providers.services` 是宿主真实实现的产品能力，不是纸面字段；推荐通路是 `runtime.kind = "host-node"` + 单文件产物 + `ctx.services`。**

- 宿主侧实现规模（均为本次逐个通读的源码，不是文档转述）：
  `plugin-service-provider-service.ts` **811 行**（生命周期 + 回环 HTTP 代理）、
  `plugin-service-runtime-installer.ts` **302 行**（产物校验/解压/原子落盘）、
  `plugin-service-response.ts` 27 行、用例 `plugin-service-provider-service.test.ts` 381 行；【实证】
  另加 IPC 通道 12 个（`shared/plugin-ipc.ts`）、renderer 门面（`plugin-service-api.ts` 81 行）、
  SDK 类型（`dist/service-provider.d.ts` 63 行）与 manifest schema（`src/manifest-schema.ts:50-159`）。
- 之所以必须自持服务：插件 UI **拿不到** `dbx-mcp` 二进制路径，也无法调用 MCP 工具（`PluginAgentApi`
  只有 `registerTool/registerSystemPromptProvider/registerContinuationProvider/registerHook`），
  见 [plugin-constraints.md](./plugin-constraints.md) §4、§5。唯一被 SDK 正式设计的插件→本地进程契约就是
  `ctx.services`。【实证】
- **置信度**：契约层面 `【实证】`（源码逐行）；端到端首次落地 `【推断】`——仓库内 **零** `providers.services`
  真实样例（全仓 `plugin.json` grep 只命中 SDK 测试夹具），`host-node` 也没有除测试之外的任何使用点。【实证】
  ⇒ 首次联调必须按 §4 的 30 分钟验证计划先打通最小服务，再谈驱动层。
- 四个附带硬事实（都会直接改写法）：
  1. **`node:sqlite` 在托管 Node 上免 flag 可用**（22.22.2，`DatabaseSync` 直接 create/insert/select 成功，
     仅一条 ExperimentalWarning）→ 内嵌 SQLite 不需要 `NODE_OPTIONS`，也不需要 `better-sqlite3` 原生模块。
  2. **`@astravia-org/ui` 运行时由宿主 Module Federation 单例提供，但 npm 上不存在（E404）** → 插件若要
     `hostUi: true`，必须在 `.tooling` 里 vendored/symlink 才能本地类型构建（与现有 plugin-sdk 同一手法）。
  3. **`ctx.settings` 已被显式移除**（ADR-0105，Plugin API 1.6.0；SDK `dist/` 34 个模块里没有 settings，
     `src/context.ts` 无该成员）→ 宿主的 `database.*` 配置读不到，安全闸门必须插件自建，且配置界面要按
     官方口径用 `registerWorkspaceView` 自绘、普通配置走 `ctx.storage`、密钥走 `ctx.secrets`
     （呼应 [plugin-constraints.md](./plugin-constraints.md) §5）。
  4. **产物来源决定是否需要网络声明**（ADR-0104）：远端下载 ⇒ 要 `network.fetch` + `allowedHosts`；
     随包分发 ⇒ 零网络声明（但需构建侧确认包内保留 `service/*.mjs`，见 §6.8）。

---

## 2. 契约细节（可复制）

### 2.1 `plugin.json` 片段（host-node 单文件服务）

```jsonc
{
  "providers": {
    "services": [
      {
        "id": "dbx-engine",
        "runtime": {
          "kind": "host-node",              // 默认是 managed-binary；host-node 必须给 entry
          "version": "1.0.0",               // 版本变化 ⇒ 宿主要求重新 install
          "entry": "service/main.mjs",      // 相对「已安装运行时目录」
          "platforms": {
            // 每个平台都必须有 executable + 至少 1 个 artifact（含 host-node）
            "darwin-arm64": {
              "executable": "service/main.mjs",
              "artifacts": [
                { "sha256": "<64位小写hex>", "archive": "file", "destination": "service/main.mjs" }
              ]
            }
            // …win32-x64 / linux-x64 / darwin-x64 各自一份；未声明的平台 install 直接报
            //   "Service runtime does not support platform <tag>"
          }
        },
        "process": {
          "args": ["--port", "${ASTRAVIA_SERVICE_PORT}", "--data", "${ASTRAVIA_SERVICE_DATA_DIR}"]
        },
        "health": { "path": "/health", "timeoutMs": 60000 }
      }
    ]
  }
}
```

- `install` 时宿主校验：`payloads` **数量与 destination 必须与当前平台声明逐一相等**（多/少/重复都抛）、
  逐个 sha256 比对、解压后 `executable` 文件必须存在（host-node 还会校验 `entry` 在）。【实证】
  `plugin-service-runtime-installer.ts:262-287`
- **载荷从哪来**（ADR-0104 原文口径：「插件通过 `ctx.network` 自行下载并校验固定制品，再交给 Desktop
  二次校验、安全解包、启动、健康检查并限制在自身回环 origin」）【实证】`plugin-sdk/CHANGELOG.md:161-164`：
  产物托管在远端时插件必须自己用 `ctx.network.request` 拉取，于是**通路 A 也会用到 `network.fetch`
  与 `network.allowedHosts`**（见 §3.3）；产物随插件包分发时则应走包内读取，无需任何网络声明——后者
  为首选，但包内是否能保留 `service/*.mjs` 这类非 `dist/` 文件需构建侧确认（见 §6.8）。
- `health.path` 的 schema 是 `^/[^/]*`，即**必须是以 `/` 开头的根相对路径**（`/mcp` 可以，绝对 URL 不行）。【实证】
  `src/manifest-schema.ts:104-110`
- 想自己决定何时算 ready：加 `"readiness": { "mode": "plugin" }`，宿主不会自动置 `ready`。【实证】

### 2.2 调用时序（面板激活时）

```
ctx.services.getPlatform()                      → { tag: "darwin-arm64" }
ctx.services.install(serviceId, [                // 每个 destination 一份 base64
  { destination: "service/main.mjs", data: "<base64>" }
])                                               → PluginServiceStatus
ctx.services.start(serviceId)                    → 分配的端口由宿主内部持有，插件只拿 baseUrl
ctx.services.connection(serviceId)               → { baseUrl: "http://127.0.0.1:<port>", credential? }
ctx.services.request(serviceId, { path: "/query", method: "POST", body: {...} })
ctx.services.stop(serviceId) / restart(...)
ctx.services.onStatusChange(l => …)              → Disposable（宿主自动回收）
```

- `install()` **不会下载**：`resolve()` 发现运行时目录不完整就抛 `"Service runtime is not installed by the plugin"`，
  所以顺序必须是 install → start。【实证】`plugin-service-runtime-installer.ts:203-236`
- `connection()` / `request()` 都走 `requireReadyRecord`：非 `ready`（或插件语义就绪未完成）抛
  `"Service is not ready: <pluginId>/<serviceId>"`；插件被禁用抛 `"Plugin disabled: <pluginId>"`。【实证】
  `plugin-service-provider-service.ts:768-800`
- 首次请求若宿主探测还在建立传输，会先 `waitForTransport` 而不是直接失败。【实证】`:455-466`

### 2.3 模板变量 / 密钥 / 端口

`TOKEN_PATTERN = /\$\{ASTRAVIA_SERVICE_(PORT|RUNTIME_DIR|DATA_DIR|CACHE_DIR|SECRET_([A-Z0-9_]+))\}/g`【实证】
`plugin-service-provider-service.ts:40`

| 变量 | 值 |
| --- | --- |
| `${ASTRAVIA_SERVICE_PORT}` | 宿主分配的空闲回环端口（只在 `args` / `env` 值里替换） |
| `${ASTRAVIA_SERVICE_RUNTIME_DIR}` | 已安装运行时目录（也是进程 cwd） |
| `${ASTRAVIA_SERVICE_DATA_DIR}` | 私有数据目录（宿主 `mkdir 0o700`，**不会被插件卸载删除**） |
| `${ASTRAVIA_SERVICE_CACHE_DIR}` | 缓存目录 |
| `${ASTRAVIA_SERVICE_SECRET_<ID>}` | 见下 |

- 未声明的密钥：`credentials: [{ id: "engine-key", bytes: 32 }]` ⇒ 宿主首次启动时
  `randomBytes(32).toString("base64url")` 写入 `<dataDir>/service-secrets.json`（`mode 0o600`），
  变量名 = `id` 大写、非字母数字换 `_`（`engine-key` → `SECRET_ENGINE_KEY`）。【实证】`:121-176`
- 密钥值会出现在子进程环境里，宿主对 stdout/stderr 做**全量脱敏**（`replaceAll(secret, "[redacted]")`）。【实证】
- ⚠️ 与市场侧 MCP 的 `managed-binary` 不同：**这里没有「PORT 必须出现」的校验**，宿主只负责替换；
  服务不监听该端口就是服务自己的问题。

### 2.4 产物与体积上限

| 限制 | 值 | 出处 |
| --- | --- | --- |
| 单个 artifact 解码后 | ≤ 256 MB | `plugin-service-runtime-installer.ts:18` |
| 归档条目数 | ≤ 10 000 | 同上 |
| 解压后总字节 | ≤ 512 MB | 同上 |
| `archive` 取值 | `file` / `zip` / `tar.gz` | `manifest-schema.ts:55` |
| 单平台 artifact 数 | 1–8 | `PluginServicePlatformSchema` |
| 服务数量 / 凭据数 / 模板数 | 8 / 8 / 16 | 同上 |

- `file` = 单文件写到 `destination`；`zip`/`tar.gz` = 解压进 `destination` **目录**。
- zip 拒绝加密项、符号链接、重复路径、目录逃逸；tar 两遍处理（先 `listTar` 校验再 `extractTar`），只允许 File/Directory。【实证】
- 落盘是**原子**的：临时目录 → `replaceDirectory`（旧目录改名备份、失败回滚）。非 win32 对 `executable` `chmod 0o755`；`.runtime.json`（`0o600`）不匹配则强制重装。【实证】
- **host-node 仍要付这份产物成本**：`normalizeServiceProviders` 要求每个 provider 至少一个平台、每个平台必须有 `executable` + `artifacts[{sha256,archive,destination}]`，而且 `install()` 会检查 executable 文件真的存在。所以「host-node 免产物」是错的；可行写法是让 `executable` 与 `entry` 指向**同一个** `.mjs`（见 §2.1）。【实证】

### 2.5 请求代理与超时

- `request` 只允许**根相对路径**（绝对 URL 拒绝），宿主用 `new URL(path, baseUrl)` 拼 `http://127.0.0.1:<port>`，并强制同源。【实证】
- 命名了凭据时宿主自动加 `Authorization: Bearer <credential>`（凭据必须属于本插件自己的服务）。【实证】
- `body` 给了就 `JSON.stringify` + `Content-Type: application/json`；`responseType: "text"`（或空响应体）返回原文，否则 `JSON.parse`。【实证】
- **超时**：默认 30 s，上限 5 min（`PluginServiceRequest.timeoutMs`）；宿主内部各自定义 `DEFAULT_REQUEST_TIMEOUT_MS = 30_000`，响应体上限 `MAX_RESPONSE_BYTES = 16 MB`。【实证】
  `plugin-service-provider-service.ts:30-33`、`dist/service-provider.d.ts`
- 失败语义：`AbortController` 超时 → 抛类型化 `PluginServiceRequestTimeoutError(pluginId, serviceId, method, path, timeoutMs)`；其余失败经主进程 `serviceLog.warn` 记录后重抛；错误响应（非 2xx）**不抛异常**，以 `{ ok:false, status, statusText, headers, body }` 返回。【实证】
- **查询超时必须小于 30 s**，否则须显式传 `timeoutMs`（例如 120_000）；旧工作台的 30 s 查询超时刚好压在默认值边界上，建议实现时显式传值。

### 2.6 生命周期、日志与清理

- 启动：`resolveHostNodeExecutable()`（托管 Node：`~/.astravia/runtimes/node/22.22.2/bin/node`）+
  `[<runtimeDir>/service/main.mjs, ...args]`，cwd = 运行时目录，env = 白名单继承 + 声明 env（已替换变量），
  `stdio: ["ignore","pipe","pipe"]`，非 win32 detached、`windowsHide: true`。【实证】`:664-676`
- 就绪判定：宿主对 `health.path` 发起回环 HTTP 探测（单次 5 s，**250 ms** 轮询），
  截止 `health.timeoutMs ?? 45_000`；`readiness.mode === "plugin"` 时探测通过后仍停在 `starting`，
  需插件 `reportReady(serviceId, true)` 才 `ready`。【实证】`DEFAULT_STARTUP_TIMEOUT_MS = 45_000`、`:722`
- 子进程 stderr/stdout：只在内存里保留最近输出（`status.recentOutput`），并经
  `PLUGIN_EXECUTION_CHANNELS.SERVICE_STATUS` 广播；**不落盘**，脱敏后可在服务状态里看到。【实证】
- 停止/卸载：`stop(serviceId)` 正常停；插件被禁用 → `disablePlugin` = generation+1 + SIGKILL + `phase:"disabled"`
  （宿主在 `plugin-lifecycle-production.ts:56` 接为 `stopServices`）；应用退出 `stopAll()`（`plugin-execution.ts:324`）。
  **没有删除 runtime/data 目录的代码路径** —— 数据目录（连接配置）跨卸载保留，是好也是坑，插件要自己处理 schema 迁移。【实证】
- 权限门：**不存在服务专用权限字面量**（`dist/permissions.d.ts` 40+ 项里没有）。开关就是「manifest 声明
  `providers.services` + 用户安装确认」；renderer `assertDeclared` 与主进程 `requireService` 双重校验 id 归属。【实证】

### 2.7 运行环境事实（Q7）

- 托管 Node **22.22.2**（`apps/desktop/src/main/runtimes/manifest.json`），本机路径
  `~/.astravia/runtimes/node/22.22.2/bin/node`。【实证】
- 该 Node 上 `require("node:sqlite").DatabaseSync` **无需任何 flag**（仅 ExperimentalWarning），
  已实测建表/插入/查询成功。【实证】
- 宿主对 `node:sqlite` 的 shim（`vite.main.config.ts:86-115` + `src/main/shims/node-sqlite.ts`）只针对
  **Electron 自带 Node**，与托管的独立 Node 无关。【实证】
- 子进程环境只继承白名单键（PATH/HOME/TEMP/LANG/`npm_config_*` 等），**`NODE_PATH` / `NODE_OPTIONS` 不继承**；
  逻辑命令名 `node`/`npm`/`npx` 会被重定向到托管运行时，且不经过 shell。【实证】`command-environment.ts:1-37`

---

## 3. 备选通路与降级触发

### 3.0 通路全貌（Q3）

| 通路 | 形态 | 现状 |
| --- | --- | --- |
| **A（推荐）** | `plugin.json#providers.services` + `ctx.services.request` | 宿主已实现（§2）；仓库内无真实样例 |
| C | `agent.mcpServers: { dbx: { type: "service", serviceId, path } }` | 文档已实现，把同一份服务再暴露给 Agent；宿主在服务 `ready` 后物化回环 URL，停止/重启自动撤下重连 |
| B（降级） | `ctx.command.spawn("node", […, "{{PORT}}"], { allocatePort:true })` + `ctx.network.request` | 宿主已实现（`command-spawner.ts` 263 行），但门禁更多（§3.2/§3.3） |
| D（否决） | 插件拉起 `dbx-mcp` 二进制 | 路径不可得（`process.resourcesPath` 由主进程持有），且插件无法调用 MCP 工具 |

### 3.1 通路 C 的额外条件

`type: "service"` 的 MCP 绑定要求目标 serviceId **在本插件 `providers.services` 中声明**，
否则 manifest 解析直接抛 `unknown service`；文档见 `docs/plugin/mcp.md:72`。【实证】
⇒ 若 Agent 需要直接查库，务必复用同一份服务（不要另起一个进程）。

### 3.2 通路 B 契约（Q4）

- 门禁（**四道全绿**才能 spawn）：`plugin.json#permissions` 声明且用户授予 `agent.command.spawn`；
  `file` 必须出现在 `plugin.json#commands`（已声明）**且**用户启用（`grantedCommandNames`）；
  同插件存活进程 ≤ **8**；cwd/env 只做字符串净化。【实证】`command-spawner.ts`
- `{{PORT}}` 替换在 **args 与 env 值**中全量发生；`spawn()` 返回时端口已就绪（`{ spawnId, pid, port }`），
  `getPluginCommandSpawnStatus(...).port` 可随时读；SSH 项目下宿主做本地转发，插件拿到的一直是本机端口。【实证】
- 输出环形缓冲 64 KB；停止 SIGTERM→3 s→SIGKILL；已退出记录保留 5 min。【实证】
- 该通路下 `ctx.network.request` 在**主进程**发起（无渲染层 CORS 问题），但**必须**满足 §3.3。

### 3.3 `network.allowedHosts` 匹配规则（Q5）

`plugin-network-service.ts:60` `isPluginNetworkHostAllowed`：【实证】

- 端口**不参与**匹配（只比 hostname）；hostname 归一化 = 去掉 `[...]`、去一个尾点、小写。
- 三种形态：精确匹配；`"*"` 全放行；`"*.example.com"` 后缀匹配且**不匹配裸域名** `example.com`。
- 协议只允许 `http:`/`https:`；重定向手动跟随 ≤ 5 跳，每跳重新校验；默认超时 120 s、上限 300 s；请求/响应各 ≤ 32 MB。
- **⇒ 没有任何回环豁免**：通路 B 必须在 `plugin.json#network.allowedHosts` 里显式写 `"127.0.0.1"`
  （写 `"localhost"` 只覆盖字面 localhost，两者都要就都写）。通路 A 的**回环请求**不经过这套策略，
  但若产物从远端 URL 下载（§2.1），那份下载仍受本规则约束。

### 3.4 降级触发条件（何时从 A 切到 B）

1. `ctx.services.install()` 在你产出的 `.mjs` 上抛 `"Service runtime artifact SHA-256 mismatch"` /
   `"Service runtime executable is missing"`，且 30 分钟内无法定位（多半是产物目的地/压缩类型写错）。
2. 宿主 `start()` 始终停在 `starting` 且 `recentOutput` 显示 Node 起不来（例如误用 Electron-only API）。
3. 目标宿主机上没有托管 Node（`resolveHostNodeExecutable()` 抛错）且不允许下载。
4. 需要多进程/多端口结构（服务的 1 个 service = 1 个进程 = 1 个端口，要做「每连接一个进程」只能靠 B）。

> 通路 B 的额外代价必须写进详情页帮助文本：多一个 `node` 命令的用户开关、多一个回环 host 声明、
> 进程上限 8、没有宿主托管的就绪/重启语义。

### 3.5 宿主内置数据库服务（Q8）

**不存在。** SDK `dist/` 34 个模块无 sqlite/database 相关成员，`grep -rn sqlite plugin-sdk/src plugin-sdk/dist`
零命中；宿主自己的 SQLite 用 Electron 侧 shim 屏蔽（`node-sqlite.ts` 抛 "not available"），也不是给插件用的服务。【实证】
⇒ 数据层必须由插件自带，不能借宿主的库。

### 3.6 依赖可用性（Q9）

- **(a) `@astravia-org/ui`**：宿主在 MF 共享域里注册了 `@astravia-org/ui` 与旧名别名 `@astravia/ui`
  （`plugin-shared-modules.ts:27-41`，singleton、`requiredVersion: false`），同时还有
  `@astravia-org/theme-ui/plugin-ui`（`ModelSelectorView`/`MultiplierTag`/`ProviderIcon`，与 DB 无关）。【实证】
  但 `npm view @astravia-org/ui` → **E404**；`@astravia-org/plugin-sdk` 与 `@astravia/ui` 同样未发布。【实证】
  ⇒ 插件可用 `hostUi: true` 在**运行时**拿到宿主同款 Button/Dialog/DropdownMenu，但本地类型构建必须先
  vendored（本仓库已有 `.tooling/open-astravia/packages/plugins/plugin-sdk` symlink 先例，
  见 `BUILD.md`）。**`@astravia-org/ui` 不含任何编辑器组件 → CodeMirror 必须插件自带**（对应开放问题 Q-F）。
- **(b) `ctx.settings`：被显式移除，不是从未存在**（ADR-0105，Plugin API 1.6.0）。SDK `dist/*.d.ts` 34 个
  模块无 settings、`src/context.ts` 无该成员；`permissions.d.ts` 里 `settings.read`/`settings.write` 只剩字面量。
  **官方指定的替代路径**【实证】`plugin-sdk/CHANGELOG.md:120-124`：普通配置存 `ctx.storage`（宿主升级时把旧值
  一次性迁到 `settings.json`）、密钥改 `ctx.secrets`、**配置界面改用 `registerWorkspaceView` 自绘**。
  ⇒ 旧工作台的 `database.*` 宿主配置（env 标签、生产写授权、AI 白名单、安全模式）只能插件自建，
  写法照上面三条，与 [plugin-constraints.md](./plugin-constraints.md) §5.3 的结论一致。
- **(c) 两个与挂载点/布局直接相关的版本能力**【实证】`plugin-sdk/CHANGELOG.md:34-48,154-156`：
  `registerWorkspaceView({ sidebar?: boolean })`（`false` = 不占侧边栏导航位，只在「设置 → 更多选项」列出，
  适合配置页/诊断台）与 `useSidebarState()` / `ctx.ui.getSidebarState()` / `data-sidebar-visible` 等宿主属性
  （沉浸式工作区视图需要让位给「展开侧边栏」按钮时用）。前者是 **Q-C 挂载点决策的直接输入**。

---

## 4. 最小可执行验证计划（首次落地必跑，≈30–45 分钟）

目标：用最小代价先证明 A 通路端到端可用，再动驱动层。**任一步失败就按 §3.4 决定是否切 B。**

| 分钟 | 动作 | 通过判据 |
| --- | --- | --- |
| 0–5 | 写 `service/main.mjs`：`node:http` 起服务，`GET /health` 返回 `{ ok:true }`，`POST /echo` 回显 body，端口取 `--port` 参数 | 本机 `node service/main.mjs --port 18080` 后 `curl` 两个路由都 OK |
| 5–10 | esbuild 打成单文件（照 `externals/cowart-astravia/scripts/build-mcp.mjs` 范式），算 `sha256`，写进 `plugin.json#providers.services`（`kind:"host-node"`、`entry` 与 `executable` 同路径、`archive:"file"`） | `node scripts/marketplace.mjs check` 与插件 `npm run build` 均通过 |
| 10–15 | 面板内：`getPlatform()` → `install()`（base64 读自 `fs`） | 状态 `installed: true`；失败则看错误串是否落在 §3.4.1 |
| 15–20 | `start()` 并轮询 `getStatus()` / `onStatusChange` | 45 s 内 `phase === "ready"`；若卡 `starting` 看 `recentOutput` |
| 20–25 | `connection()` 拿 `baseUrl` → `request({ path:"/echo", method:"POST", body:{ping:1} })` | 返回 `{ ok:true, body:{ ping:1 } }` |
| 25–30 | 把 SQLite 换进去：`import { DatabaseSync } from "node:sqlite"`，数据目录取 `${ASTRAVIA_SERVICE_DATA_DIR}`，暴露 `/query` | 建表/插入/查询往返成功，且**不加任何 Node flag** |
| 30–35 | 负例：`request` 故意超时（服务 sleep 40 s） | 收到 `PluginServiceRequestTimeoutError`（或显式 `timeoutMs` 后成功） |
| 35–45 | 生命周期：`stop()` → `start()` → 禁用插件 → 重新启用 | 进程无残留；禁用后 `connection()` 抛 `Plugin disabled` |

**验收记录要落回文档**：若「零样例」风险导致任何一步的报错串与 §2 描述不一致，以实测为准并回写本节。

---

## 5. 证据表

| 结论 | 证据（路径:行 / 命令） |
| --- | --- |
| 服务运行时是真实实现（811/302 行） | `open-astravia/apps/desktop/src/main/plugins/plugin-service-provider-service.ts`、`plugin-service-runtime-installer.ts`（`wc -l`） |
| 12 个 SERVICE IPC 通道 | `apps/desktop/src/shared/plugin-ipc.ts`（`PLUGIN_EXECUTION_CHANNELS`） |
| 每次调用都用会话推导 pluginId | `apps/desktop/src/main/ipc/plugin-execution.ts:120-230` |
| renderer 门面 + 声明校验 | `apps/desktop/src/renderer/domains/plugins/runtime/plugin-service-api.ts:21-25` |
| SDK 类型面（install/start/reportReady/…） | `packages/plugins/plugin-sdk/dist/service-provider.d.ts:1-63` |
| manifest schema（archive 三值/entry/readiness/credentials/templates） | `packages/plugins/plugin-sdk/src/manifest-schema.ts:50-159` |
| host-node 缺 entry 报错 | `packages/plugins/plugin-sdk/src/manifest.ts:339` |
| 模板变量与密钥 | `plugin-service-provider-service.ts:40,121-176` |
| 启动/就绪/探测 | `plugin-service-provider-service.ts:660-730`（`DEFAULT_STARTUP_TIMEOUT_MS=45_000`:32；250 ms 轮询:730） |
| 请求代理/超时/响应上限 | `plugin-service-provider-service.ts:30-33,560-620`（`MAX_RESPONSE_BYTES=16MB`） |
| 禁用/退出停止 | `plugin-service-provider-service.ts:466-485`；`plugin-lifecycle-production.ts:56`；`plugin-execution.ts:324` |
| 产物校验/解压/原子落盘/上限 | `plugin-service-runtime-installer.ts:18-20,60-100,203-300` |
| 无卸载删除 runtime 路径 | `grep -n "uninstall\|rm(" plugin-service-runtime-installer.ts` → 仅备份/暂存清理 |
| 环境白名单（无 NODE_PATH/NODE_OPTIONS） | `apps/desktop/src/main/plugins/command-environment.ts:1-37` |
| 托管 Node 22.22.2 | `apps/desktop/src/main/runtimes/manifest.json`；`ls ~/.astravia/runtimes/node/22.22.2/bin/node` |
| `node:sqlite` 免 flag | `~/.astravia/runtimes/node/22.22.2/bin/node -e "…DatabaseSync…"`（实测建表/插入/查询 OK） |
| Electron 侧 shim 与托管 Node 无关 | `apps/desktop/vite.main.config.ts:86-115`、`src/main/shims/node-sqlite.ts` |
| `network.allowedHosts` 匹配规则 | `apps/desktop/src/main/plugins/plugin-network-service.ts:60`（`isPluginNetworkHostAllowed`）、`:1-20`（超时/上限） |
| 回环需显式声明 | 同上（无 loopback 分支） |
| spawn/`{{PORT}}`/8 进程/3 s grace | `apps/desktop/src/main/plugins/command-spawner.ts:22,169-180` |
| MCP `type:"service"` 语义 | `docs/plugin/mcp.md:72` |
| 共享域注册 `@astravia-org/ui` + 旧别名 | `apps/desktop/src/renderer/domains/plugins/runtime/plugin-shared-modules.ts:27-41` |
| `@astravia-org/ui` 未发布 npm | `npm view @astravia-org/ui versions` → E404（`@astravia-org/plugin-sdk`、`@astravia/ui` 同） |
| 无 settings API | `ls plugin-sdk/dist/*.d.ts`（34 模块无 settings）；`grep -rn settings plugin-sdk/src/context.ts` 零命中 |
| 无内置 sqlite/db 服务 | `grep -rln sqlite plugin-sdk/src plugin-sdk/dist` 零命中 |
| `providers.services` 无真实样例 | 全仓 `plugin.json` grep `"services"` 只命中 `plugin-sdk/test/manifest-service-provider.test.ts` |
| 服务能力进入 SDK 的版本 | `plugin-sdk/CHANGELOG.md:161-164`（`providers.services`+`ctx.services`，ADR-0104）、`:118`（`reportReady`）、`:149-150`（MCP `type:"service"`、`readDataFile/writeDataFile`）——均在 **0.3.0（2026-09-14）** |
| `ctx.settings` 被移除与替代方案 | `plugin-sdk/CHANGELOG.md:120-124`（ADR-0105，Plugin API 1.6.0） |
| 服务运行时已进入真实构建产物 | `apps/desktop/dist/main/main-*.js`、`apps/desktop/dist/renderer/assets/renderApp-*.js` 均含 `reportReady`（`grep -rln reportReady apps/`） |
| host-node 唯一使用点 | `grep -rn host-node` → SDK 测试 + 宿主实现（无插件样例） |

---

## 6. 仍未确认

1. **端到端真机行为**：`install→start→request` 全链只在宿主的单测里被覆盖（`plugin-service-provider-service.test.ts`，381 行，`resolveRuntime` 多为 mock）；**没有任何真实插件跑通过**。§4 是唯一解药。
2. **安装包的体积账**：`service/main.mjs` 里内联 `pg`/`mysql2`/`mongodb`/`ioredis` 等纯 JS 驱动后的实际体积，尚未实测是否落在市场限额（归档 ≤25 MB / 解压 ≤100 MB / 单文件 ≤8 MB）内。
3. **`.mjs` 作为 `executable` 的边界**：安装器会 `chmod 0o755` 并要求该文件存在；是否会被某些平台的杀软/权限策略额外拦，未验证。
4. **`install()` 的 base64 上传路径**：面板进程需先把打包产物读成 base64 再跨 IPC（单条 ≤256 MB 解码上限；IPC 是否有更低上限）未见明文，首次实现要实测大文件。
5. **服务版本升级语义**：`runtime.version` 变化后宿主要求重新 install（用例 `requires the plugin to provision a newly declared runtime version after reload`），但**旧版本目录是否自动清理**未见代码路径 —— 推断会堆积，需实测磁盘占用。
6. **`reportReady` 与宿主探测的关系**（`waitForTransport`）只在 `starting` 且 `child` 存在时等待；若服务先耗尽 45 s 探测预算再报 ready 的行为未实测。
7. **多平台首包成本**：至少要为 `darwin-arm64` / `win32-x64` 两份（或更多）声明 artifacts 与 sha256；marketplace 侧脚本是否已有生成 sha256 的工具链，未在本次范围内确认。
8. **包内保留非 `dist/` 文件**：若想让 `service/main.mjs` 随插件包分发（避免为下载产物多声明一个网络 host），需确认插件打包器会把 `service/` 收进归档、且插件侧能读回该文件（`ctx.fs.readBinaryFile` 的允许根是否包含插件安装目录）。这直接决定商品化时的“零网络声明”能否成立。
9. **`minAppVersion` 对齐**：服务能力落在 SDK 0.3.0（Plugin API 1.x，2026-09-14），而市场条目现在写的是 app `0.5.59`；CHANGELOG 不给出 SDK↔app 版本映射，**需到 app 侧确认 `0.5.59` 是否已带该运行时**，否则要抬高。
