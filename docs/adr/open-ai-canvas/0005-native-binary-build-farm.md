# ADR-0005：原生二进制的构建农场与清单驱动的载荷解析——把「只有 darwin-arm64」变成「五平台同一份发行」

## 状态

已接受（2026-10-25）。**部分推翻 ADR-0003 决策 2、决策 4 与 ADR-0004 决策 1。**

| 被推翻的部分 | 原文主张 | 现在 |
| --- | --- | --- |
| ADR-0003 决策 2 | 载荷由**发布者本机**跑一次构建脚本产出，sha256 手抄进 `server/boot.mjs` | 载荷由 **CI 原生矩阵**产出；`boot.mjs` 不再内嵌 sha256，改为运行时读清单 |
| ADR-0003 决策 4 | 平台集合以「本机编得出来的那个」为准（事实上的 `darwin-arm64`） | 平台集合是 5 个组合的**声明式清单**，缺一个即构建失败 |
| ADR-0004 决策 1 | `PAYLOADS` / `AGENT_PAYLOADS` / `plugin.json#platforms` 三处键集必须相等 | 三者不再是同一种事实：`plugin.json` 声明**宿主可安装的平台**，`boot.mjs` 声明**同一组平台**，载荷 sha256 移到发布清单 |

ADR-0004 的其余决策（键集校验、带码失败、`/__canvas/state` 就绪判据）继续有效。

## 背景

### 现象

0.0.10 的 `plugin.json#providers.services[0].runtime.platforms` 只有一个键 `darwin-arm64`。Windows 用户装完插件点「启动」，宿主按 `${process.platform}-${process.arch}` 去查这个对象，查不到就没有运行时可用——按钮点下去什么也不会发生，连失败文案都没有。这不是「Windows 上有 bug」，而是**这个平台从来没有被发布过**。

### 上游可用的分发形态（Observed）

2026-10-25 核对 `ddcat-ai/open-ai-canvas` 的 release（`v1.6.9.2` / `v1.6.9.1` / `v1.6.9` / `v1.6.8.12`），资产只有：

```text
docker-compose.deploy.yml
open-ai-canvas-host-updater-linux-amd64
open-ai-canvas-host-updater-linux-arm64
SHA256SUMS
```

**没有任何可直接在桌面本地运行的二进制。** 上游对本地运行只给源码路径（README）：`git clone` + Bun + Go 1.25，`go run ./cmd/server` + `bun run dev`。OCI 镜像（`ghcr.io/ddcat-ai/open-ai-canvas-{backend,web,yingce-agent}`，`linux/amd64` + `linux/arm64`）是上游唯一的多平台制品形态，但它把 Docker 变成用户的硬前置。

### 为什么不用 OCI 镜像

已评估并否决，理由是**用户使用成本**，不是技术不可行：容器路径要求用户先装 Docker/OrbStack/Desktop 引擎（首次安装 GB 级、常驻 VM、还要处理端口与卷映射），而这个插件的定位是「装完就能用」。把它换成原生二进制后，用户的额外前置是零。

代价必须写清楚：**我们自己承担上游构建链的维护责任**。上游哪天改了构建方式，我们的矩阵会红——这是可控的、响亮的失败；而容器方案的失败发生在用户机器上，是安静的。

### 构建可行性（Observed）

上游 `backend/Dockerfile` 是唯一的权威构建配方，逐条读下来，硬约束只有一条：

- `gorm.io/driver/sqlite v1.6.0` 经 `github.com/mattn/go-sqlite3 v1.14.48`（`go.mod` 第 58 行，indirect）落到 SQLite 的 C 实现，因此 **`CGO_ENABLED=1` 不可省**，交叉编译必须有目标平台的 C 工具链。
- `go.mod` 声明 `go 1.25.0`，含本地 `replace github.com/casdoor/go-sms-sender => ./third_party/go-sms-sender`，所以 `go mod download` 之前必须先拷 `backend/third_party`。
- 构建产物不止一个：`cmd/server`、`cmd/migrate-schema`、`cmd/migrate-sqlite-postgres`，同一套 ldflags：

  ```text
  -s -w -X yingce/backend/internal/buildinfo.Version=…
        -X yingce/backend/internal/buildinfo.Commit=…
        -X yingce/backend/internal/buildinfo.BuildTime=…
  ```

- 后端启动前还需要 `plugin-packages`（支付插件包）：`PAYMENT_PLUGIN_CGO_ENABLED=0 ./plugin-packages/build-packages.sh --payments-only`，随后 `verify-payment-packages.sh <goos> <goarch>` 做冒烟。它需要 `nodejs`、`zip`、`unzip`。
- 前端是 `oven/bun:1.3.9` + `bun install --frozen-lockfile` + `bun --bun ./node_modules/vite/bin/vite.js build`，产物 `web/dist`，**平台中立**；`VITE_TLDRAW_LICENSE_KEY` 是可选 ARG。

本机实测环境（Observed）：`go1.26.5 darwin/arm64`、`bun 1.3.14`、`node v22.22.2`、`Apple clang 21`——即 `darwin-arm64` 的构建链在本机成立，这也解释了为什么只有这一个平台的载荷存在。

## 决策

### 1. 载荷由 CI 的原生矩阵产出，不做交叉编译

GitHub Actions 用**目标平台自己的 runner** 编译，`CGO_ENABLED=1` 交给该 runner 的原生 clang/gcc/MSVC-clang：

| `plugin.json#platforms` 键 | runner | C 工具链 | 备注 |
| --- | --- | --- | --- |
| `darwin-arm64` | `macos-14` | Xcode clang | 现有唯一在售组合，作为基准 |
| `darwin-x64` | `macos-13` | Xcode clang | Intel Mac |
| `win32-x64` | `windows-2022` | mingw-w64（`choco install mingw`） | `go-sqlite3` 官方支持 mingw |
| `linux-x64` | `ubuntu-22.04` | gcc | **刻意不选 24.04**：glibc 2.35 的产物能跑在更多发行版上 |
| `linux-arm64` | `ubuntu-24.04-arm` | gcc | 公开 arm64 runner |

否决交叉编译的理由：`zig cc` / `osxcross` 那条路要把 C 工具链和目标 SDK 一起搬进 runner，一次 libc 或 SDK 版本错配就产出「能编译、跑起来缺符号」的载荷——这类故障在用户机器上表现为「闪一下就没了」，最难查。原生 runner 慢，但错不了。

### 2. 前端只构建一次，五个载荷共用

`web/dist` 不含任何平台代码。矩阵里单独一个 `web` job 用 Bun 构建，其余 job 通过 `actions/download-artifact` 取同一份产物。省掉四次重复的 `bun install`（每次约 2 分钟、约 500 MB 模块缓存）。

### 3. 每个平台产出两个载荷，形态与现在一致

```text
payload-<payloadVersion>-<platform>.zip          # yingce-backend + web-dist/ + plugin-packages/
agent-runtime-<payloadVersion>-<platform>.zip     # node/bin/node + pi-runtime/
```

不把它们合并成一个包：`agent` 载荷是可降级的（ADR-0003 决策 6 已如此实现），且 `pi` 需要 node ≥ 22.19，与主载荷的更新节奏无关。

`agent` 载荷必须**按平台各打一次**：`npm ci --omit=dev` 在 `backend/agent-runtime/pi` 下解析的是本机可选依赖，跨平台复用同一份 `node_modules` 会在缺原生扩展时静默降级。

### 4. 清单驱动：sha256 不再内嵌进 shim

`server/boot.mjs` 里那两张写死 sha256 的表是本 ADR 要拆掉的核心负担——每加一个平台就要手抄 2 个 64 位十六进制，而**插件包版本一旦发布就不可变**：想修正一个抄错的字符，得再发一个插件版本。

改为：发布页放一份 `payload-manifest.json`，shim 启动时先取它。

```json
{
  "schemaVersion": 1,
  "payloadVersion": "0.1.0",
  "upstream": { "repository": "ddcat-ai/open-ai-canvas", "tag": "v1.6.9.2", "commit": "<40 hex>" },
  "builtAt": "2026-10-25T00:00:00Z",
  "platforms": {
    "darwin-arm64": {
      "payload":  { "file": "payload-0.1.0-darwin-arm64.zip",        "sha256": "<64 hex>", "bytes": 217000000 },
      "agent":    { "file": "agent-runtime-0.1.0-darwin-arm64.zip",  "sha256": "<64 hex>", "bytes": 80000000 }
    }
  }
}
```

解析顺序（保持 ADR-0003 决策 3 的三候选策略，只是换成清单）：

1. `CANVAS_PAYLOAD_MANIFEST`（本地文件路径或 http(s) 直链，联调/镜像用；已在 shim 里实现）；
2. `api.github.com/repos/<repo>/releases/tags/<tag>` 里名为 `payload-manifest.json` 的资产（避开 `github.com` 的 TCP 超时）；
3. `https://github.com/<repo>/releases/download/<tag>/payload-manifest.json`（固定链接）。

清单本身**不做签名校验**：它是 HTTPS 取回的声明，真正的内容完整性由它声明的每个 zip 的 sha256 保证。这一点必须诚实：能改我们 release 的攻击者早就能改载荷本体，清单签名不会增加实质阻力，只增加一套密钥管理。

平台不在清单里 → `platform-unsupported`（ADR-0004 决策 2 的错误码不变），并把清单里的平台列表写进 `supported`。

### 5. 载荷版本与插件版本解耦

`payloadVersion` 在清单里，不在 `plugin.json` 里。收益：

- 上游发新版 → CI 重跑矩阵、换清单，**用户点一次「重试/更新」就拿到新上游**，不需要等市场重新审一遍插件版本；
- 插件代码（shim / UI / MCP 工具）与上游运行时各自发版，互不阻塞。

`DATA_DIR/runtime/<payloadVersion>/` 与 `DATA_DIR/runtime/agent-<payloadVersion>/` 的目录约定保留：旧版本目录不删，回滚只需把清单指回去。

### 6. 追踪「上游最新」是一个定时任务，不是人工动作

`.github/workflows/build-canvas-payloads.yml`（**仓库根目录**——GitHub 只读根下的 workflows，放进插件目录不会被执行）：

- `schedule` 每日一次 + `workflow_dispatch`（可指定 `ref`）；
- 第一步解析上游 tag → 40 位 commit（`GET /repos/ddcat-ai/open-ai-canvas/commits/<tag>`）；定时任务与现有清单的 `upstream.commit` 相同 → 直接结束（不产生任何制品）。钉 commit 而非 tag：tag 会移动，commit 不会；
- 否则跑矩阵，产出 5×2 个 zip，汇总生成 `payload-manifest.json`，**整批**上传到 Release `plugin-open-ai-canvas-payloads`（先传 zip，最后用 manifest 覆盖同名资产作为「提交点」——清单不到位，旧清单继续生效，不会出现半套载荷被引用）。

载荷文件名用 `PAYLOAD_VERSION`（CI 从上游 tag 派生），**不用** `plugin.json` 的版本：插件升个小版本就把同一份 300 MB 载荷改名重传，等于让用户白下一次。`buildPayload` 的取值顺序是 `PAYLOAD_VERSION` → `plugin.json`（本地兜底，且会打印用的是哪一个）。

### 7. `plugin.json` 的平台矩阵保持 5 键，shim 字节唯一

shim 是一份纯 JS，与平台无关，五个键指向**同一份字节**、同一个 sha256、同一个 `executable: server/boot.mjs`：

```json
"platforms": {
  "win32-x64":     { "executable": "server/boot.mjs", "artifacts": [{ "sha256": "<shim>", "archive": "file", "destination": "server/boot.mjs" }] },
  "darwin-x64":    { … },
  "darwin-arm64":  { … },
  "linux-x64":     { … },
  "linux-arm64":   { … }
}
```

这不是为了凑数：宿主只有在键命中时才会安装并启动服务，键缺席等于该平台不存在。真正的平台差异发生在 shim 内部——它读清单、取自己平台那一条。

### 8. macOS 签名与隔离属性
不在本决策里做代码签名（没有可用的 Developer ID），但要区分两件事：

- **arm64 的 ad-hoc 签名是硬要求**：Apple Silicon 上未签名的 arm64 Mach-O 根本不会被执行（`killed: 9`）。Go 链接器对 `darwin/arm64` 会自动附加 ad-hoc 签名，所以本方案在 arm64 上不需要额外步骤（Inferred：来自 Go 链接器行为，未在干净机器上实测）。
- **`darwin-x64` 不需要签名也能跑**，代价是首次运行可能弹一次「未验证的开发者」确认。
- 一旦要上 Apple Developer ID + notarization，就变成「重签每一个载荷」的流水线改造，`plugin.json` 的摘要也要跟着变——这是另一件事，不在本文范围。

**隔离属性**：载荷 zip 由 shim 用 node 的 `fs` 落盘，**不是浏览器下载**，因此不会带上 `com.apple.quarantine` 扩展属性，解包出的 `yingce-backend` 不会触发 Gatekeeper 首次运行拦截（Inferred：依据是 node 写文件不设置该 xattr；未在干净系统上实测，列为待验证项）。若实测被拦，退路是 shim 解包后 `xattr -d com.apple.quarantine`——需要在 ADR 里补一条，但这属于运行期修补，不影响本决策。

### 9. 构建配方在插件里，workflow 只挑 runner

上游的目录与构建知识——前端在 `<repo>/web` 且锁文件是 `bun.lock`、Go 模块叫 `yingce/backend`、入口是 `./cmd/server`、版本号从仓库根的 `VERSION` 注入 `buildinfo.Version`、Windows 二进制要带 `.exe`——**全部属于插件**，写在 `abilities/plugins/open-ai-canvas/scripts/build-service-zip.mjs` 里：

| workflow 调用 | 插件侧实现 | 产物 |
| --- | --- | --- |
| `--web` | `buildWeb()`：`cd <canvas-dir>/web` → `bun install --frozen-lockfile` → `bun run build` | `<canvas-dir>/web/dist` |
| `--backend` | `buildBackend()`：`go build -trimpath -ldflags "-s -w -X …buildinfo.Version=…" -o yingce-backend<ext> ./cmd/server` | 平台二进制 |
| `--payload` / `--agent-runtime` | `buildPayload()` / `buildAgentPayload()` | 两类 zip |

workflow 只剩三件事：挑 runner、装工具链（bun / go / node / mingw）、按 `--platform` 调上面的模式。

**为什么不是风格问题**：第一版把 `bun install` 直接写在 YAML 里，`working-directory` 写成 `upstream`（正确值是 `upstream/web`），2026-10-25 的真实失败信息是 `error: Bun could not find a package.json file to install from`——与 web 毫无字面关联，而 workflow 只在 dispatch 之后才跑，一次错误就是一整轮 CI 加一次人工回读。同一天还发现 `--payload` 对 `plugin-packages/*.yingce-plugin` 零命中时**不报错**（载荷看着正常、后台拿不到任何支付通道），已改为直接失败。

`scripts/check-build-workflow.mjs` 守住这条边界（Observed：对新工作流 exit 0，对旧工作流 exit 1）：解析 YAML，要求四个模式都被调用，禁止 `run:` 里出现 `bun install` / `bun run build` / `go build`，`working-directory` 只允许插件目录或 `upstream` 检出根。它跑在 `npm run verify`、`npm test` 与 `npm run build` 里，所以漂移在源码树里就会被拦下，不用等 CI。

## 发布顺序（必须遵守）

1. 先跑 `build-canvas-payloads.yml` 的 `workflow_dispatch`（输入上游 tag 与 payloadVersion），等五平台 zip 与 `payload-manifest.json` 都出现在 Release `plugin-open-ai-canvas-payloads`；
2. 再让市场发布流水线产出 `plugin-open-ai-canvas` Release 上的 `.astraviapkg`。

反过来也能「发成功」，但那是一种更糟的成功：插件装上、按钮能点、然后卡在 `payload-unreachable`。清单依赖上游 tag 而不是插件版本，所以日常只需第 1 步自动跑（每日定时），只有上游确实发了新版才产出新制品。

## 兼容和迁移

- 已安装 0.0.10 的 `darwin-arm64` 用户：新 shim 读不到清单里的 `payloadVersion` 变化时仍复用 `DATA_DIR/runtime/<旧版本>`（`hasPayload` 判据不变），不会重下。
- `plugin.json` 从 1 个平台键扩到 5 个，属于**扩大**可用集合，不放宽任何既有校验。
- 载荷文件名规则不变（`payload-<ver>-<platform>.zip` / `agent-runtime-<ver>-<platform>.zip`）。
- 原来的 `scripts/sync-payloads.mjs` 已删除：它比对新旧 `PAYLOADS` 常量表，而那套常量表正是本决策取消的东西。取而代之的是 `scripts/sync-shim.mjs`（镜像 shim + 写五平台摘要）与 `scripts/build-payload-manifest.mjs`（从 `.payload/` 生成清单）。

## 备选方案

| 方案 | 否决理由 |
| --- | --- |
| 官方 OCI 镜像 + 用户 Docker | 用户成本（已在上文说明）；且容器内的 `127.0.0.1` 不是宿主机，模型桥接要多绕一层 |
| CI 交叉编译（zig cc / osxcross） | 工具链与 SDK 版本错配产出的载荷「能编译、跑不起来」，故障点在用户机器上 |
| 安装时在用户机器上编译 | 要求用户装 Go 1.25 + Bun + C 工具链，正是要消除的东西 |
| 指向远程托管的 `yingce.tv` | 不是「上游最新完整版」，且把用户的画布数据交到第三方实例 |
| 保持现状（只有 `darwin-arm64`） | 就是本 ADR 要修的问题 |

## 验证

本地可执行（已跑过，退出码 0）：

```bash
cd abilities/plugins/open-ai-canvas

node scripts/sync-shim.mjs --check            # shim 镜像与五平台摘要一致
node scripts/check-service-platforms.mjs      # 键集、archive=file、destination、TARGET_PLATFORMS 三处对齐
node scripts/build-payload-manifest.mjs --dir .payload \
  --payload-version 1.6.9.2.1 --upstream-tag v1.6.9.2 --upstream-commit <40 位 sha>
node scripts/check-service-platforms.mjs --payload-manifest .payload/payload-manifest.json
npm run check && npm test                     # tsc + 桥/工作流两个验证器
npm run build                                 # 产出 release/open-ai-canvas-<ver>.astraviapkg
```

**Observed**：`npm run build` 在本机（darwin/arm64）通过，产物 24 个运行时文件，内含 `dist/assets/boot.mjs`（与 `server/boot.mjs` 字节相同）；`plugin.json` 五平台键的 sha256 与该文件一致。用五份假 zip 跑 `build-payload-manifest.mjs` 生成的清单能被 `check-service-platforms.mjs` 完整校验（缺平台即失败）。

为什么包内是 `dist/assets/boot.mjs` 而不是 `server/boot.mjs`：宿主安装服务运行时走的是插件运行时调 `ctx.services.install(serviceId, [{destination, data}])` 的 base64 通道，`data` 由插件从自己包内读出（`astravia-plugin://<id>/versions/<ver>/dist/assets/boot.mjs`），宿主再按 `archive: "file"` 写到 `server/boot.mjs` 并校验 sha256。两个路径名必须同时正确，任一处写错都会在用户机器上变成 install 失败。

CI 侧（`build-canvas-payloads.yml`）：

- 五个原生 runner（`windows-2022` / `macos-13` / `macos-14` / `ubuntu-22.04` / `ubuntu-24.04-arm`）各自 `CGO_ENABLED=1` 本地编译，web 只在上游 `web/` 构一次并作为 artifact 下发；
- Windows runner 装 mingw 提供 gcc（`mattn/go-sqlite3` 需要 C 编译器）；
- zip 先传、`payload-manifest.json` 最后覆盖上传作为提交点；
- 载荷文件名由 `build-service-zip.mjs` 决定，清单由它在 `.payload/` 里扫描得到，两者不各写一份命名规则。

**NOT RUN**：`win32-x64` / `darwin-x64` / `linux-x64` / `linux-arm64` 四个平台的构建与运行，在本机无法验证——本机只有 darwin/arm64。这四个组合在 CI 首次跑通前是 **Assumed**，不是 Observed。上面那条 `archive: "file"` 的安装链路同理：`ctx.services.install` 的 base64 通道来自 SDK 类型与主进程实现（Observed），端到端安装属于 **Assumed**。

## 后续（不在本文范围）

- 载荷增量更新（只下 `web-dist` 差量）——当前 200 MB 全量在弱网下仍是主要痛点，但先把「谁的机器都能起」做对。
- 上游构建失败时的降级：矩阵失败不覆盖旧清单，用户继续用上一个可用版本（已由决策 6 的「清单最后上传」保证）。
