# ADR-0004：启动就绪契约与平台门禁——把「我这儿能起」变成「谁的机器都能判断」

## 状态

已接受（草案）。本文不改动 [ADR-0001](./0001-open-ai-canvas-as-plugin.md) 的 `host-node + Node wrapper` 架构、[ADR-0002](./0002-canvas-mcp-toolset-and-authorization.md) 的 MCP 工具集，也不推翻 [ADR-0003](./0003-service-runtime-distribution-and-cross-platform.md) 的任何决策：决策 5（准备期恒 200）被**保留**，决策 2（payload 必须分平台）被**收紧为可校验**，决策 3（`archive: "file"`）与决策 7（`process.env` 模板）无变化。

本文回答三个问题：

| # | 问题 | 决策 |
|---|---|---|
| 1 | 同一份插件，开发机上能起、别人的机器上起不来，怎么让这类偏差在合入前就被挡住？ | **平台矩阵变成单一事实源，并在构建期做跨文件一致性校验**（决策 1） |
| 2 | 平台没有载荷时，为什么要等用户在一次必然失败的下载里耗着，而且宿主看不到原因？ | **不支持的平台立刻带稳定错误码失败，并新增机器可读的 `/__canvas/state`**（决策 2） |
| 3 | 宿主健康检查通过，就代表画布能用吗？ | **不代表。就绪以画布后端自己的状态为准，插件侧按错误码给文案**（决策 3） |

## 背景

### 现象

用户报告：插件在宿主激活后无法正常启动，但在开发机上可以正常启动。

「在开发机上可以」不是巧合。本插件的启动是一条**与机器状态强耦合**的链路，而开发机恰好满足了它需要的全部前提条件。把链路按「依赖」拆开，只有三个耦合点：

| 耦合点 | 开发机 | 干净机器 |
|---|---|---|
| A. 运行时的平台键 | `darwin-arm64` 命中 | 任何其他组合都查不到条目 |
| B. 重型载荷的网络可达性 | 系统代理 `127.0.0.1:7897` 已开且 GitHub 可达 | 首启必须真的下载 207 MB |
| C. `DATA_DIR/runtime/0.0.1` 的就绪状态 | 早已就绪，走「复用」分支 | 空，走「下载 → 校验 → 解包」分支 |

### 事实（Observed）

**平台矩阵只有一项。** `abilities/plugins/open-ai-canvas/plugin.json:31-42` 的 `runtime.platforms` 只有 `darwin-arm64`；`server/boot.mjs:50-52` 的 `PAYLOADS` 与 `server/boot.mjs:59-61` 的 `AGENT_PAYLOADS` 同样只有 `darwin-arm64`。而构建脚本 `scripts/build-service-zip.mjs:47-53` 的 `PLATFORM_MAP` 支持 5 个组合（`win32-x64`、`darwin-x64`、`darwin-arm64`、`linux-x64`、`linux-arm64`）。**构建侧有 5 个平台，分发侧只声明了 1 个**，中间没有任何东西会因此报错。

**不支持平台时，失败对宿主不可见。** 把 `process.platform / process.arch` 覆写成 `win32-x64` 后启动 shim（本次实测）：

```
[open-ai-canvas] 运行时准备失败：当前平台 win32-x64 暂无可用运行时载荷，请等待对应平台发布
[open-ai-canvas] Proxy listening on http://127.0.0.1:18998
```

```
$ curl -s http://127.0.0.1:18998/api/health/ready
{"status":"error","phase":"failed",...,"error":"当前平台 win32-x64 暂无可用运行时载荷，请等待对应平台发布"}
HTTP/1.1 200 OK
```

宿主 `waitUntilReady()` 的判据是 HTTP 200，于是它把这个进程记成 `ready`；插件侧 `phaseFromServiceStatus()`（`src/runtime.ts:45-60`）把宿主 `ready` 映射成 `running`。

**下载失败时，同样只有 200。** 冷 `DATA_DIR` + 不可达载荷源（本次实测）：

```
[open-ai-canvas] 检测到系统代理 127.0.0.1:7897（来源 scutil）
[open-ai-canvas] 解析下载地址失败：HTTP 403
[open-ai-canvas] 下载来源 1/1：127.0.0.1:9
[open-ai-canvas] 下载中断（connect ECONNREFUSED 127.0.0.1:9），第 1/2 次
```

`/api/health/ready` 返回 200，body 为 `{"status":"preparing","phase":"connecting",...}`。宿主认为服务已就绪。

**插件侧的就绪判据取的是宿主状态，不是画布状态。** `src/runtime.ts:211-221` 的 `waitForReady()` 只轮询 `ctx.services.getStatus()`，拿到 `ready` 就 `applyReady()` 并打开浏览器。而宿主的 `ready` 只意味着「shim 的 TCP 端口能连上」——准备中、甚至永久失败，都是 200。

**分发链本身没有漂移**（本次实测）：`server/boot.mjs` 与 `public/assets/boot.mjs` 字节相同（80,463 B），sha256 均为 `5033d8b6…2f92`，与 `plugin.json` 声明一致。所以「包里的 shim 404 / 哈希不符」这一支可以排除，问题不在制品，而在**判定**。

**宿主在启动之前就按平台拦了。** `app.asar` 的 `PluginServiceRuntimeInstaller`（`install()`，`platformTag = ${process.platform}-${process.arch}`）第一句就是取 `service.runtime.platforms[this.platformTag]`，取不到直接 `throw new Error("Service runtime does not support platform …")`。也就是说：非 `darwin-arm64` 的机器**走不到 shim**，插件只在 `catch` 里落到「安装失败」。这是验证阶段反推出来的关键一条——只改 shim 是不够的，用户看不见。

### 「开发机能起」的确切成因

`resolveRuntimeDir()`（`server/boot.mjs:1167-1182`）的解析顺序是 `BUNDLED_DIR` → `PROVISION_DIR` → 按平台下载。开发机的 `DATA_DIR/runtime/0.0.1` 早已存在，第二次启动起就走「复用已就绪的运行时」，**冷路径从来没被真正踩过**；而 `build-service-zip.mjs --shim --check` 只校验 `currentPlatform()` 对应的那一条（`scripts/build-service-zip.mjs:120-154`、`:285`），在开发机上永远是绿的。

结论：这不是某一行写错，而是**三个「只在开发机成立的隐式前提」没有任何校验，且违反了之后也没有人看得见**。ADR-0003 解决了「怎么把载荷送到用户机器」，本文解决「送不到时谁负责说清楚、以及怎么在合入前就知道送不到」。

## 决策

### 1. 平台矩阵是单一事实源，构建期校验三处一致

新增 `abilities/plugins/open-ai-canvas/scripts/check-service-platforms.mjs`，把三份事实读出来互相比对：

| 来源 | 读取方式 |
|---|---|
| `plugin.json#providers.services[].runtime.platforms` | JSON |
| `server/boot.mjs` 的 `PAYLOADS` / `AGENT_PAYLOADS` | 正则解析对象字面量的键与 `sha256` |
| `server/boot.mjs` 与 `public/assets/boot.mjs` 的实际字节 | `sha256` |

判据（任一不满足即 `exit 1`，并打印具体差异）：

1. `plugin.json` 的平台键集 **===** `PAYLOADS` 的键集；`AGENT_PAYLOADS` 的键集是它的**子集**（Agent 可缺席，画布不可）；
2. 每个平台条目恰好 1 个 artifact，且 `archive === "file"`、`destination === "server/boot.mjs"`；
3. artifact 的 `sha256` 是 64 位小写十六进制，且 **===** `server/boot.mjs` 的实际 sha256 **===** `public/assets/boot.mjs` 的实际 sha256；
4. 每个 `PAYLOADS[platform].file` 的文件名带该平台后缀，`sha256` 同样是 64 位小写十六进制（占位值 `TODO` / 全 0 一律拒绝）。

接入方式：`package.json` 增加 `check:platforms` 脚本，并让 `build` 先跑它（`"build": "npm run check:platforms && vite build"`）。CI 只跑 `vite build`，所以校验必须挂在 `build` 前面才会生效；`build:service` 仍负责生成 shim 并打印新 sha256。

**为什么不是「补齐 5 个平台」**：当前 Release 里只有 `darwin-arm64` 的真实产物与 sha256。按市场仓库的规则，示例 URL 与示例 SHA-256 不得进入条目——写占位值是把手写漂移换成假载荷，比现在更坏。补齐平台是发布动作（见「后续」），不是校验动作。

### 2. 平台不受支持时立刻带码失败，并新增 `/__canvas/state`

**门禁放在载荷解析的入口。** `resolveRuntimeDir()` 本来就是「本机已备好就复用、否则按平台取下载条目」的顺序；把平台判定留在原处、只补上错误码，就是最小改动，也已天然早于任何网络请求：

```text
hasPayload(BUNDLED_DIR) || hasPayload(PROVISION_DIR)  → 照旧（复用）
否则 PAYLOADS[PLATFORM] 存在且 sha256 合法            → 照旧（下载）
否则                                                  → 立即失败，不进入下载循环
```

失败不是一句中文，而是一个稳定错误码（挂 `Error.code`）加一句可复制的话——`STATE.code` 是契约，`STATE.message` 只是给人看的：

| code | 触发条件 |
|---|---|
| `platform-unsupported` | 本平台没有载荷条目（或 sha256 非法） |
| `payload-unreachable` | 所有候选下载源都失败（网络/代理/镜像） |
| `payload-checksum-mismatch` | 下载完成但 sha256 与清单不符 |
| `payload-extract-failed` | 解包失败（条目越界、ZIP 结构异常） |
| `backend-spawn-failed` | 后端子进程 `spawn` 报错 |
| `backend-exited` | 后端在就绪前退出 |

**新增 `GET /__canvas/state`。** 它在 `startProxy()` 的请求处理链最前面应答，**不经 Go 代理**，因此准备中、失败后、就绪后都存在：

```json
{
  "phase": "ready | preparing | failed",
  "code": null,
  "error": null,
  "platform": "darwin-arm64",
  "supported": ["darwin-arm64"],
  "ready": true,
  "stage": "启动",
  "message": "运行时已就绪",
  "percent": 100
}
```

`ready` 为 `true` 的充要条件是**后端子进程已报告监听地址**（`goPort` 已确定且 `STATE.phase === "ready"`），不是「shim 起来了」。响应带 `Access-Control-Allow-Origin: *`：插件 UI 跑在宿主渲染进程的另一个 origin 里，不带这个头浏览器的同源策略会拦掉读取（该端点只返回本机运维状态，不含会话与凭据）。

**不改 `/api/health/ready` 的 200 语义。** ADR-0003 决策 5 的实测结论仍然成立：非 200 会让宿主 `waitUntilReady()` 判死并 `killProcess(SIGKILL)`，冷启动必然抖动。所以健康检查继续恒 200，把「真话」放进 body 与新端点——**判据由宿主换到插件自己**。

**shim 这层门禁有个前提：shim 得先被启动。** 未发布平台连这一步都到不了——宿主的 `PluginServiceRuntimeInstaller.install()` 在取平台条目时就抛错了（源码位置见「事实」）。所以门禁必须分两层，少一层就是「改了但用户看不到」：

| 层 | 位置 | 盖住的场景 |
|---|---|---|
| 插件侧预判（真正挡人的那层） | `CanvasController.unsupportedPlatform()`，早于 `install()` 与 `start()` | 平台本来就没载荷：用户点「启动」立刻看到平台名与已发布列表，而不是宿主那句英文异常被折叠成「安装失败」 |
| shim 内部（兜底） | `server/boot.mjs` 的 `resolveRuntimeDir()` | 宿主放行后才发现无载荷；以及平台键在但 sha256 非法、载荷下不下来 |

平台列表在构建期由 `vite.config.ts` 从 `plugin.json#runtime.platforms` 注入（`__SUPPORTED_PLATFORMS__`），而不是运行时猜 `navigator.platform`：那样会在 Rosetta、WSL、ARM Windows 上判错。`getPlatform()` 不可用或返回空时不拦，退回宿主流程——宁可少一次预判，也不拿猜出来的平台名否定用户的机器。

### 3. 就绪以画布后端状态为准，插件侧按 code 给文案

`CanvasController`（`src/runtime.ts`）新增探针：

- `probeState()`：`fetch(${baseUrl}/__canvas/state)`，`AbortController` 2.5 s 超时，失败返回 `undefined`；
- `waitForReady()`：先读探针。`phase === "ready"` 才算就绪；`phase === "failed"` 立即按 `code` 落文案并返回；探针**不可达**时退回宿主状态轮询（保持旧行为，不因为新增依赖把原本能用的场景打死）；
- `ensureLoaded()` / `handleStatusChange()`：宿主报 `ready` 时不再直接 `applyReady()`，而是走一次探针确认；准备中把 `percent` / `stage` 写进状态，界面显示真实进度；
- 文案按 code 映射（新增 i18n key）：

| code | messageKey |
|---|---|
| `platform-unsupported` | `error.platformUnsupported` |
| `payload-unreachable` | `error.payloadUnreachable` |
| `payload-checksum-mismatch` | `error.payloadCorrupt` |
| `payload-extract-failed` | `error.payloadExtract` |
| `backend-spawn-failed` / `backend-exited` | `error.backendFailed` |
| 其它 | `error.startFailed` |

`CanvasState` 增加 `detail?: string`，承载「当前平台 / 已发布平台」或「已下载 43%」这类具体信息；`canvas-view.tsx` 在状态卡里渲染它，busy 时显示阶段与百分比。`ensureRunning()` 不再把所有失败都归到 `error.installFailed`（用户照做「重装插件」也没用），而是给出与 `code` 对应的原因。

**为什么值得改 UI**：`error.installFailed` 让用户去重装一个本身没坏的插件，是把用户往错方向推。平台不支持、网络不可达、哈希不符是三件需要三种不同动作的事。

## 兼容和迁移

| 项 | 变化 |
|---|---|
| `plugin.json#runtime.version` | `0.1.0` → `0.2.0`（新增端点与错误码契约；宿主据此重装 shim） |
| `plugin.json#version` / `package.json` / `ability.json` / 市场条目 | `0.0.9` → `0.0.10` |
| `plugin.json#platforms[].artifacts[].sha256` | 随 shim 重新生成而更新 |
| `PAYLOAD_VERSION` | **不变**（`0.0.1`）：载荷字节没动，老用户不重下 207 MB |
| `DATA_DIR/runtime/0.0.1`、`agent-0.0.1` | 继续复用，不需要重新准备 |
| `health.timeoutMs` | 不变（`120000`，schema 上限） |
| `configVersion` | 不变 |
| 旧版插件 | 无需迁移：新端点只增不改，旧客户端不读它也不受影响 |

老用户在升级后第一次点「启动」时：宿主发现 marker 里的 sha256 与清单不符 → 重装 shim（40 KB 级，包内取）→ 运行时目录已就绪 → 直接 spawn，**不产生任何下载**。

## 备选方案

| 方案 | 结论 |
|---|---|
| A. 立刻补齐 5 个平台的 `platforms` 与 `PAYLOADS` | **驳回**。只有 `darwin-arm64` 有真实产物与 sha256，其余写占位值违反「示例 SHA 不得进入条目」；补齐是发布动作，不是校验动作。 |
| B. 失败时让 `/api/health/ready` 返回 503 | **驳回**。ADR-0003 决策 5 已实测：宿主超时即 `SIGKILL` 并置 `failed`，冷启动会滚动重试；非 200 换来的是更差的可见性。 |
| C. 把主载荷塞进 `.astraviapkg` 一起发 | **驳回**。超单包上限；且 2195 条目 / 216 MB 逼近宿主 `MAX_ARTIFACT_BYTES = 256 MiB`，任何一次载荷增长都会让整个插件装不上。 |
| D. 用 `"any"` / `"*"` 之类的通配平台键 | **驳回**。宿主按 `${platform}-${arch}` 精确取键，没有通配语义；写了只会得到「条目存在但取不到」的第二种困惑。 |
| E. 把就绪判断留在宿主，靠日志排查 | **驳回**。日志只在开发机能看；用户看到的是「运行中」跳到失败页，且被建议去重装插件。 |
| F. 让插件 UI 轮询 Go 后端的 `/api/health/ready` | **驳回**。准备阶段 Go 还没起来（这正是要解决的问题），只有 shim 自己知道进度。 |

## 验证

```bash
cd abilities/plugins/open-ai-canvas

# 1) 三方一致性（新增，接入 build）
node scripts/check-service-platforms.mjs
# 期望：退出码 0，打印 plugin.json / PAYLOADS / AGENT_PAYLOADS / shim 字节数

# 2) shim 与清单对齐（原有）
node scripts/build-service-zip.mjs --shim --check

# 3) 类型检查
npm run check

# 4) 复现实验 A：冷 DATA_DIR + 不可达载荷源
rm -rf /tmp/oac-probe && mkdir -p /tmp/oac-probe
ASTRAVIA_SERVICE_PORT=18999 ASTRAVIA_SERVICE_DATA_DIR=/tmp/oac-probe/data \
  ASTRAVIA_SERVICE_RUNTIME_DIR="$PWD/server" \
  CANVAS_PAYLOAD_BASE_URL=http://127.0.0.1:9 node server/boot.mjs &
sleep 4  && curl -s http://127.0.0.1:18999/__canvas/state   # 连接下载源
sleep 8  && curl -s http://127.0.0.1:18999/__canvas/state   # 重试耗尽
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18999/api/health/ready
# 期望：200（ADR-0003 决策 5 保持）

# 5) 复现实验 B：把平台覆写成未发布的组合
mkdir -p /tmp/oac-win && cat > /tmp/oac-win/spoof.mjs <<'EOF'
Object.defineProperty(process, "platform", { value: "win32" });
Object.defineProperty(process, "arch", { value: "x64" });
await import(process.env.OAC_BOOT);
EOF
ASTRAVIA_SERVICE_PORT=18998 ASTRAVIA_SERVICE_DATA_DIR=/tmp/oac-win/data \
  ASTRAVIA_SERVICE_RUNTIME_DIR="$PWD/server" OAC_BOOT="$PWD/server/boot.mjs" \
  node /tmp/oac-win/spoof.mjs &
curl -s http://127.0.0.1:18998/__canvas/state
# 期望：phase=failed，code=platform-unsupported，supported=["darwin-arm64"]，ready=false
#       且日志里没有「下载来源 1/1」——门禁在下载之前

# 6) 校验真的会拦住漂移：临时把 plugin.json 的平台键改成 darwin-x64
cp plugin.json /tmp/plugin.json.bak
python3 -c 'import json;p="plugin.json";d=json.load(open(p));pl=d["providers"]["services"][0]["runtime"]["platforms"];pl["darwin-x64"]=dict(pl["darwin-arm64"]);json.dump(d,open(p,"w"),indent=2,ensure_ascii=False)'
node scripts/check-service-platforms.mjs; echo "退出码 $?"
cp /tmp/plugin.json.bak plugin.json
# 期望：退出码 1，并指出 plugin.json 有 darwin-x64 而 PAYLOADS 没有

# 7) 市场仓库门禁
cd ../../../.. && node scripts/marketplace.mjs check
```

### 本次实测结果（Observed）

| 场景 | `/__canvas/state` | `/api/health/ready` | 日志 |
|---|---|---|---|
| 平台覆写为 `win32-x64` / `darwin-x64` / `linux-x64` / `linux-arm64`（四个逐一跑） | 四行全部 `phase=failed`、`code=platform-unsupported`、`ready=false`，`error` 里带本平台名与 `supported=["darwin-arm64"]` | 200 | 只有一行「运行时准备失败（platform-unsupported）」，**没有**「候选下载来源」——门禁确实在下载之前 |
| 平台覆写为 `darwin-arm64`（同一脚本，仅换平台标签） | `phase=connecting`、`code=null` | 200 | 出现「候选下载来源 1 个」——只有这一行的门禁被放过，证明四个失败不是脚本本身报错 |
| 冷 `DATA_DIR` + `CANVAS_PAYLOAD_BASE_URL=http://127.0.0.1:9` | 第 4 s：`phase=connecting`、`code=null`、`stage=连接下载源`；第 12 s：`phase=failed`、`code=payload-unreachable` | 200 | 两次「下载中断（ECONNREFUSED）」后 `运行时准备失败（payload-unreachable）` |
| 预热 `DATA_DIR` + 桩后端（真监听 `127.0.0.1:19051`） | `phase=ready`、`code=null`、`ready=true`、`backend=true` | 200 | `复用已就绪的运行时` → `Proxy listening on http://127.0.0.1:19223`；`/api/anything` 透传 200 |
| 人为漂移（给 `platforms` 加 `darwin-x64`） | — | — | `check-service-platforms.mjs` 退出码 1：「平台键集不一致：plugin.json = [darwin-arm64, darwin-x64]，PAYLOADS = [darwin-arm64]」 |

前两行对应「本机不该跑」与「本机能跑但网不通」，`code` 不再相同，也不再都显示成「安装失败，请重装插件」；第三行是唯一的成功路径。

**本机无法实测的部分**：`unsupportedPlatform()` 走的是宿主 `getPlatform()` + 渲染层 UI 文案，须在真机装上插件才能看到。这里只能保证：注入的 `["darwin-arm64"]` 字面量与文案键确实进了 `dist/assets/index-*.js`（`grep` 可见），以及 `tsc --noEmit` 通过。宿主侧「点启动后显示平台名而不是安装失败」属于 Inferred。

## 后续（不在本文范围）

- 发布 `win32-x64` / `darwin-x64` / `linux-x64` / `linux-arm64` 的载荷后，把它们同时写进 `plugin.json#platforms` 与 `PAYLOADS`——决策 1 的校验会保证两处一起改，漏一处即构建失败。
- 代理认证（CONNECT 401）与镜像自建的运维细节，仍属 ADR-0003 的下载收敛议题。
- 「有载荷但后端起不来」时的自动诊断包导出，留给后续 ADR。
