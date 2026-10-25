# ADR-0003：服务运行时的分发形态、下载收敛策略与跨平台支持

## 状态

已接受（草案）。修订 [ADR-0001](./0001-open-ai-canvas-as-plugin.md) 决策 1 与决策 8 中关于制品分发与平台绑定的部分；不改变 ADR-0001 的 `host-node + Node wrapper` 架构与 ADR-0002 的 MCP 工具集。

本文回答八个问题，顺序与结论一一对应：

| # | 问题 | 决策 |
|---|---|---|
| 1 | 下载不续传，改 `boot.mjs` 断点续传还是把下载挪到插件侧？ | **改 `boot.mjs`**（决策 1）；并把启动改成「先监听后准备」以绕开 120 s 判据（决策 5）；插件侧下载仅保留为离线/内网旁路 |
| 2 | Windows 要支持；能否多个系统共用同一份 zip？ | **shim 共用一份，payload 必须分平台**（决策 2） |
| 3 | `.payload` 里 273 MB 的废弃化石不要再生成 | 当前脚本已不再生成，**补清理与守卫**（决策 4） |
| 4 | 插件首次下载超过宿主 120 s 健康检查窗口，宿主反复 stop→retry 把整个界面拖崩 | **先监听、后准备**：准备期由插件自己应答健康检查（恒 200 + `phase`），失败也不让宿主判死（决策 5） |
| 5 | shim 为什么是一个 zip 去做下载/校验/解包？不应该是脚本吗？ | zip 只是宿主的分发容器；**改为 `archive: "file"` 直接分发 `boot.mjs`**（决策 3） |
| 6 | 点了停止/重装后进程赖着不退，宿主反复重试 | **shim 收到信号必须自己退**，不能只转发给后端（决策 6） |
| 7 | 服务进程拿不到端口和数据目录，宿主报 `Service exited before becoming ready` | **宿主不注入环境变量，只做 `${ASTRAVIA_SERVICE_*}` 模板替换**；`plugin.json` 必须显式声明 `process.env`（决策 7） |
| 8 | 浏览器里的画布缺创作 Agent（生成任务失败）与本地资源地址，能否「一个不落下」？ | **补第二个载荷**：`pi-runtime` + 它需要的 node 单独发布，由 shim 解包后注入 `CANVAS_PI_RUNTIME_DIR` / `CANVAS_NODE_BIN`，并补上 `CANVAS_PUBLIC_BASE_URL`（决策 8） |

> 用户引用的 `@skill:grill-with-docs` 在本机技能清单中不存在（清单只有 `grilling`）。本文按该技能的意图执行：先拷问结论、保留反方论证，再落决策；「拷问记录」一节记录被驳回的方案与答复。

## 背景

### 现状制品

`open-ai-canvas` 采用两层制品（ADR-0001 决策 8）：

| 层 | 媒介 | 体积 | 到位时机 |
|---|---|---|---|
| shim | `public/open-ai-canvas-darwin-arm64.zip` → `.astraviapkg` | zip 12,191 B（内含 `boot.mjs` 39,615 B） | 安装插件时，宿主解到 `runtime/versions/<ver>/server/` |
| payload | GitHub Release `payload-0.0.1-darwin-arm64.zip` | 216,911,067 B（2,195 项） | 首次点「启动」，由 `boot.mjs` 下载 |

payload 内容（Observed，逐条目读取）：

| 条目 | 原始尺寸 | 压缩后 | 平台相关性 |
|---|---|---|---|
| `yingce-backend` | 103,351,554 B（98.6 MiB） | 46,342,717 B（44.2 MiB） | **强**：Mach-O `magic=0xfeedfacf`、`cputype=0x0100000c`、`filetype=2` = arm64 可执行 |
| `web-dist/`（2,087 项） | 与下行合计 229,410,901 B | 与下行合计 ≈162 MiB | **无**：纯静态前端 |
| `plugin-packages/`（107 项） | 229,410,901 B（218.8 MiB） | ≈162 MiB | **无**：`.yingce-plugin` 数据包 |
| 全包合计 | 332,762,455 B（317.3 MiB） | 216,555,015 B（206.5 MiB） | — |

> 早先草稿曾以「zip 总大小 − 后端未压缩尺寸」推算前端体积，得到约 108 MB 的错误值（把压缩后总量与未压缩单项混算）。上表全部取自 zip 中央目录的 `file_size` / `compress_size` 逐项求和。

### 宿主契约（全部从 `/Applications/Astravia.app/Contents/Resources/app.asar` 主进程 bundle 读出）

这几条是本文所有决策的事实基础，先集中列出：

1. **artifact 没有 URL 字段。** `PluginServiceArtifactSchema` 只有 `sha256`、`archive("file"|"zip"|"tar.gz")`、`destination`。也就是说 `install()` 的载荷必须由插件自己提供，宿主不会代下。
2. **宿主按 `destination` 匹配载荷，不按文件名。** `PluginServiceRuntimeInstaller.install()` 里 `expectedByDestination = new Map(platform.artifacts.map(a => [a.destination, a]))`，逐条比对 `destination` 与 `sha256`。
3. **`markerFor()` 只记录 `destination` 与 `sha256`**，不记录制品文件名。
4. **`archive: "file"` 是合法形态**：`writeFile(destination, buffer, { flag: "wx" })`，`destination` 可以是 `server/boot.mjs` 这样的文件路径。
5. **体积/条目上限**：`MAX_ARTIFACT_BYTES = 256 MiB`（单份载荷）、`MAX_ARCHIVE_ENTRIES = 10,000`、`MAX_UNCOMPRESSED_BYTES = 512 MiB`。
6. **base64 通道**：`decodeArtifact()` 要求 `data` 是 base64 字符串，长度上限 `ceil(MAX_ARTIFACT_BYTES/3)*4+4`，且会把解码结果**再编码一次**与原文比对。
7. **健康窗口**：`waitUntilReady()` 的 `deadline = health.timeoutMs ?? 45000`，每 250 ms 轮询一次（单次请求超时 5 s，失败静默重试）。
8. **超时即强杀**：超时后打印 `Plugin service failed to start`，随即 `killProcess(child, "SIGKILL")`，状态置 `failed`。
9. **部署幂等**：`install()` 内部先 `isReadyRuntime(runtimeDirectory, expected)`，已就绪则跳过解压，只更新 marker。

`health.timeoutMs` 在清单 schema 中的上限是 `120000`，本项目已取满，**没有继续放宽的空间**。

### 当前下载实现的三处缺陷（Observed）

`server/boot.mjs` 的 `downloadPayload()` 与 `provisionPayload()`：

- 分片路径（8 片并发）以 `open(archive, "w")` 打开 → **每次截断**，被杀后重启从 0 开始；
- 单连接路径**已经实现了 Range 续传**（`existing = statSync(archive).size` → `Range: bytes=${existing}-` → `createWriteStream(..., { flags: "r+", start: offset })`），但它只在 HEAD 拿不到长度时才会走到；
- `provisionPayload()` 的重试 `catch` 里执行 `fs.rmSync(archive)` —— 把上面那条已实现的续传能力**主动销毁**。

合并效果：宿主 120 s 超时 SIGKILL 后，已下载的字节全部作废，下一次「启动」重新从零开始。

### 跨平台的当前事实

- `plugin.json` 的 `runtime.platforms` 只有 `darwin-arm64`；
- `PAYLOADS` 只有 `darwin-arm64` 一条，其余平台在 `resolveRuntimeDir()` 抛 `当前平台 <platform> 暂无可用运行时载荷`；
- `BINARY_NAME` 已预留 `.exe` 分支（`server/boot.mjs:47`），`scripts/build-service-zip.mjs` 的 `PLATFORM_MAP` 已列 5 个组合（`win32-x64`、`darwin-x64`、`darwin-arm64`、`linux-x64`、`linux-arm64`）；
- `spawn(GO_BINARY, [], { env, stdio })` 没有 `windowsHide`，Windows 上会弹出控制台窗口；
- 进程退出只挂 `process.on("SIGTERM", ...)`，Windows 没有 SIGTERM 语义。

结论：**出包通路是通用的，缺的是每个平台各自的产出、清单条目和几处 Windows 适配**，不是「只能跑 macOS」的架构限制。

## 决策

### 1. 下载收敛：改 `boot.mjs` 断点续传，不把下载挪到插件侧

**采纳：`boot.mjs` 内置断点续传。插件侧下载不作为主路径。**

理由不是偏好，而是通道成本：

| 维度 | `boot.mjs` 断点续传 | 插件侧下载 + `ctx.services.install()` |
|---|---|---|
| 单份载荷上限 | 无（自己写盘） | `MAX_ARTIFACT_BYTES` 256 MiB —— 207 MB 刚好通过，无余量 |
| 传输形态 | HTTP 直落磁盘 | base64 字符串经 IPC 传给主进程 |
| 字符串规模 | 0 | 207 MB → base64 约 **276 MB**，上限 357 MB |
| 内存峰值 | 分片缓冲（MB 级） | ArrayBuffer 207 MB + base64 276 MB + 解码 Buffer 207 MB + 校验时**再编码一次** 276 MB ≈ **0.7–1 GB** |
| 超时约束 | 受 120 s 窗口限制 | **不受** |
| 失败可续 | 改造成本低 | 天然可续（插件自己控制 fetch） |
| 可显示进度 | 只有 stdout 日志 | 可做进度条 |

一句话：插件侧唯一优势是「不受 120 s 约束」，代价是把一条 207 MB 的流式下载变成一次近 1 GB 峰值的 base64 IPC —— 在主进程里做这件事，风险高于它解决的问题。而 120 s 约束的实质伤害是「一次失败后从零重来」，**只要补上断点续传，多次重试即可收敛**，不需要绕过窗口。

**实现规格**（版本 0.0.5 落地）：

1. 分片改为独立暂存文件：`<archive>.part0 … .part7`，每片长度 = `ceil(size/8)`，单片写完后 `fsync`；
2. 启动时逐片比对 `statSync(partN).size` 与该片应有长度：等于则跳过，小于则从该片已写偏移继续（`Range: bytes=<start+have>-<end>`），大于则截断后重下；
3. 全部片就绪后按顺序拼接为 `<archive>`，再算 sha256；校验通过才进入解包；
4. **删除** `provisionPayload()` 重试路径里的 `fs.rmSync(archive)`；仅当 sha256 不匹配时才清理所有 `.partN` 与拼接文件；
5. 保留现有 60 s 停滞看门狗；单片连续两次停滞才放弃该片，不影响其他片；
6. 解包前的 `fs.readFileSync(archive)` 改为流式读取（207 MB 一次性读入是可接受的次生问题，顺手修）。

**配套的产品侧告知**：首次启动失败后，面板文案应明确「已下载 X%，再次点击启动会从断点继续」，否则用户会以为每次都是白下。

**不采纳的变体**：

- 调大 `health.timeoutMs`：schema 上限 120000，已用满。
- detached 子进程在后台续下（宿主 SIGKILL 只杀直接子进程）：技术上可行，但引入孤儿进程回收问题，且宿主是否按进程组 kill 属未验证行为。**列为阶段二候选，先不引入**。
- 把下载拆成「平台无关包 + 平台包」以缩短单次下载量：见决策 2，与拆包一并评估，不与续传耦合。

### 2. 跨平台：shim 一份共用，payload 必须分平台

**先纠正一个前提。** 用户认为「都是 web 界面，不管什么系统打开都一样，所以应该能共用一个 zip」。这个判断对了一半，而且对的那一半正是当前设计的浪费所在：

| 组件 | 是否平台相关 | 能否共用 | 现状 |
|---|---|---|---|
| `boot.mjs`（shim） | **否**，纯 JS | **能，且应该共用** | 现在每平台一个 zip，文件名带平台后缀 —— 纯属自找麻烦 |
| `web-dist/`（2,087 项前端） | **否**，静态资源 | **能共用** | 现在塞在平台专属 payload 里，换平台要重复上传 ≈162 MiB（压缩后） |
| `plugin-packages/`（107 项） | **否**，数据包 | **能共用** | 同上 |
| `yingce-backend`（44.2 MiB 压缩 / 98.6 MiB 展开） | **是**，机器码 | 不能 | 必须每平台一份 |

**决策 2.1：shim 改为全平台共用一份制品。**

宿主既然按 `destination` + `sha256` 匹配、从不看文件名（背景事实 2、3），那么「每个平台各写一条 artifacts，指向同一个 sha256」在契约上完全成立：

```json
"platforms": {
  "darwin-arm64": { "executable": "server/boot.mjs", "artifacts": [{ "sha256": "<同一个>", "archive": "file", "destination": "server/boot.mjs" }] },
  "win32-x64":    { "executable": "server/boot.mjs", "artifacts": [{ "sha256": "<同一个>", "archive": "file", "destination": "server/boot.mjs" }] }
}
```

插件侧 `ARTIFACT_ZIP_PATH` 同步去掉平台后缀。**这是纯收益改动**：少一个平台就少一次打包、少一份 sha 维护、少一处产物不一致的可能。

**决策 2.2：payload 保持每平台一份，不做共用。**

后端是 arm64 机器码，Windows 上无法执行，这是物理事实而非配置问题。但为减少「换平台要重传 ≈162 MiB 静态资源」的浪费，给出**阶段二**选项（本次不实施）：

```
payload-<ver>-common.zip                 web-dist/ + plugin-packages/   压缩后 ≈162 MiB
payload-<ver>-<platform>.zip             仅 yingce-backend              压缩后 ≈44 MiB
```

拆包后换平台只需重传 44 MiB，而不是 206 MiB。收益明确，但它降低的是**新增平台的成本**，不是**现有用户的问题**。

`artifacts` 的 `maxItems` 是 8，两个 `destination`（一个目录、一个文件）完全放得下。代价是 `boot.mjs` 要维护两套 spec、两个 URL、两段校验，失败面从 1 个文件变成 2 个。

**本次不拆的判断依据**：拆包零收益于现有单平台用户，收益只体现在「新增一个平台时少传 162 MiB」——这是一次性成本，而双 spec 的失败面是永久的。等 Windows 载荷真正开始迭代（预计一个月内多次重传）时再拆，那时收益才成立。

**决策 2.3：Windows 支持（`win32-x64` 先行，`win32-arm64` 后续）。**

改动清单，逐项标注证据等级：

| # | 改动 | 位置 | 依据 |
|---|---|---|---|
| 1 | 交叉编译 `yingce-backend.exe` | 上游构建 | **待验证**：需确认上游 Go 无 cgo 依赖（`CGO_ENABLED=0 GOOS=windows GOARCH=amd64 go build`） |
| 2 | `PAYLOADS` 增补 `win32-x64` 条目 | `server/boot.mjs:42` | 现表只有一条（Observed） |
| 3 | `platforms` 增补 `win32-x64` | `plugin.json` | 现有 key 只有 `darwin-arm64`（Observed） |
| 4 | `spawn(..., { windowsHide: true })` | `server/boot.mjs:389` | 现有选项无此键（Observed），不加会弹控制台 |
| 5 | 信号处理按平台分支：Windows 用 `child.kill()` / `taskkill /pid <pid> /T /F` | `server/boot.mjs:422` | 只挂 SIGTERM（Observed）；Go 侧 `watchParentProcess` 仍是最终兜底 |
| 6 | `chmodSync(0o755)` 保持 | `server/boot.mjs:299` | Windows 上为 no-op，无害，无需条件化 |
| 7 | `pi-runtime` 继续排除 | 打包脚本 | payload 内 `.node` 原生模块数 = **0**（Observed），但排除策略不变，避免将来引入平台相关模块 |
| 8 | 反向代理 / WebSocket / 端口探测 | 无改动 | 纯 Node 实现，无平台分支（Observed） |

**验收门槛**（缺一不可）：Windows 上安装插件 → 首次启动完成下载 → `/api/health/ready` 返回 200 → 浏览器打开可用 → MCP `tools/list` 正常 → 停止后无残留 `yingce-backend.exe` 进程。

### 3. shim 的分发形态：zip 只是容器，改为 `archive: "file"` 直接分发脚本

用户的困惑是准确的：**「下载、校验、解包、拉起后端」是 `boot.mjs` 干的，zip 什么也没干。** zip 之所以出现，只因为它是 `artifacts` 允许的容器形态之一，而当时的实现顺手用了它。

宿主契约允许更直接的形态（背景事实 4）：

```json
{ "sha256": "<boot.mjs 的 sha256>", "archive": "file", "destination": "server/boot.mjs" }
```

**决策：采用 `archive: "file"`，`public/` 下直接放 `boot.mjs`，不再打 zip。**

收益：

- sha256 直接对内层脚本，不再「校验一个容器的哈希，而真正的执行体藏在里面」；
- 删掉 `extractZip`（zip 路径仍有 inflate 代码，file 形态下再也走不到，可留作兼容但不再依赖）；
- 跨平台共用（决策 2.1）变成零成本：一个文件、一个 sha、任意多个平台条目；
- 审查体验：`git diff` 看到的是 `boot.mjs` 本身，不是二进制容器。

代价与配套：

- `.astraviapkg` 里路径是 `dist/assets/boot.mjs`，**不是** `dist/boot.mjs` —— 原因见下；
- `src/runtime.ts` 的 `ARTIFACT_ZIP_PATH` 改为 `ARTIFACT_PATH = "dist/assets/boot.mjs"`；
- `scripts/build-service-zip.mjs --shim` 不再产出 zip，只做「把 `server/boot.mjs` 拷到 `public/assets/` + 算 sha + 校验清单」；
- `runtime.version` 从 `0.0.1` 升到 `0.1.0`：制品形态变了，`markerFor()` 里 artifacts 的 sha 也随之变化，`isReadyRuntime()` 本来就会判为不匹配并重装；显式升版本是为了让日志与数据目录能区分「旧 zip 形态」与「新 file 形态」。
**实施时发现的硬约束（Observed，差点误导整个方案）**：`.astraviapkg` 的打包器不是「收 `dist/` 全部」，而是白名单 ——

| 打包器收什么 | 依据 |
|---|---|
| `plugin.json`、`ability.json`、`presentation/**` | 固定 |
| manifest `entry`、`styles[]`、`icon`、agent 各类路径、`providers.services[].templates[].source` | `listPluginManifestResources()` |
| `dist/assets/**` | **全量** |
| `dist/` **根目录** | **只收 `.css`** |
| `locales/**`、`scripts/**`、`mcp/**`、`agent/docs/**` | 目录存在即收 |

后果：把 shim 放 `public/boot.mjs`（vite 会拷到 `dist/boot.mjs`）**不会进包**，实产 17 个条目里没有它（本地复现，`release/open-ai-canvas-0.0.5.astraviapkg` 改造前）。等到用户机器上，`install` 读 `astravia-plugin://…/dist/boot.mjs` 会 404 —— 看上去像运行时装配失败，实际是文件没打进去。

因此 shim 放 **`public/assets/boot.mjs`** → vite 拷到 `dist/assets/boot.mjs` → 落在白名单里唯一一个「无条件全量」的目录。改完实产 18 条目，`dist/assets/boot.mjs` 53 164 B 在包内（Observed）。

这也解释了一个历史疑点：线上 0.0.4 包里**确实有** `dist/open-ai-canvas-darwin-arm64.zip`（19 条目，已下载比对），而本地用当前 tooling 打包得不到它 —— 两者用的不是同一版打包器。**结论是：不要从本地预检包反推 CI 行为，但要选一个两套打包器都全量收的位置。** `dist/assets/` 同时满足两套。

**注意**：这一步不改变 payload，也不改变运行时目录布局。用户已装好的 0.0.4 升级到 0.0.5 时，`server/boot.mjs` 会被重写一次（内容相同或更新），`data/runtime/0.0.1/` 里的 207 MB 载荷**必须保留**——因此新 `boot.mjs` 的 `PROVISION_DIR` 不能跟着 `runtime.version` 一起改，否则用户会被迫重下 207 MB。

**这是本条决策最容易被忽略的陷阱**：`runtime.version`（宿主侧运行时目录与 marker）与 `PAYLOAD_VERSION`（`data/runtime/<ver>/` 载荷目录）必须解耦。前者升 `0.1.0`，后者保持 `0.0.1`。

### 4. 废弃化石：当前已不再生成，补清理与守卫

**事实核定**：`.payload/open-ai-canvas-darwin-arm64.zip`（273,725,752 B、27,161 项）是早期「全量单包」方案的残留，mtime 14:01，早于 `build-service-zip.mjs` 改为两层制。**当前脚本不会再生成它**：

- `--shim` → `public/open-ai-canvas-<platform>.zip`
- `--payload` → `.payload/payload-<version>-<platform>.zip`

所以「不要再生成」已经成立，剩下的是**清掉存量 + 防止回归**。

**决定性删除理由**（比「占 273 MB」强得多）：该包 27,161 项 > `MAX_ARCHIVE_ENTRIES = 10,000`（背景事实 5）。即使有人手工拿它去 `install`，宿主会直接抛 `Service runtime archive has too many entries`。它是一份**永远装不上**的死制品，且与 shim 同名，极易被误拷进 `public/`。

**处置**：

1. 删除 `.payload/open-ai-canvas-darwin-arm64.zip`（保留 `payload-0.0.1-darwin-arm64.zip`，其 sha256 与 `PAYLOADS` 逐字一致，是重传与校验的本地副本）；
2. 构建脚本增加 `--clean`（**已落地**）：删掉 `public/` 与 `public/assets/` 下所有 `open-ai-canvas-*.zip`，并打印删除清单。`.payload/` 不在清理范围 —— 那里的 `payload-<ver>-<platform>.zip` 是线上 Release 的本地副本，误删就要重传 207 MB；废弃化石已被手工删除，且旧脚本不再生成它；
3. `--shim --check` 已成为断言：产物 `sha256`、`archive`（必须 `file`）、`destination`（必须 `server/boot.mjs`）三项任何一项与 `plugin.json` 不符即 `exit 1`。

### 5. 启动编排：先监听，后准备（ready-first）

**问题不是下载慢，而是宿主只有一个判据。** `health.path` 表达的是「这个进程能不能服务」，`timeoutMs` 120 000 是 schema 能接受的上限（背景事实 4）。首次启动要下 207 MB，120 s 内不可能完成，于是宿主到点判定失败 → `stop()` → 用户再点 → 从零重来。这个循环里宿主界面一直在 `starting` 与 `failed` 之间抖动，而插件没有任何位置可以插话 —— 这就是「插件过大导致整个界面崩」的实际成因。

**决策：把「能应答」与「准备好」拆成两件事。**

| 时刻 | 宿主看到的 `/api/health/ready` | 事实 |
|---|---|---|
| `boot.mjs` 一启动 | **200** `{"phase":"starting"}` | 代理壳已 listen，可以应答 |
| 下载 / 校验 / 解包 / 起后端 | **200**，`phase` 依次推进 | 后端还没起来 |
| 后端就绪 | **200** `{"phase":"ready"}` | 真正可服务 |
| 准备失败 | **仍然 200**，`phase:"failed"` + `error` | 失败原因由插件自己的页面呈现 |

**失败也返回 200，是刻意的。** 宿主用状态码决定「要不要杀掉重试」，而这类失败（磁盘满、下载源不可达、sha256 不符）不会因为重启而好转。让用户看到插件写的错误页与「重试」按钮，比让宿主把进程反复杀起十次更有效。

**准备期由插件自己接管两个入口：**

| 路径 | 准备期 | 就绪后 |
|---|---|---|
| `/api/health/ready` | 插件应答，恒 200 + `phase` | 透传后端 |
| `/` | 自包含进度页（轮询 `/__canvas/progress`，`ready` 时 `location.replace('/')`） | 透传后端 |
| `/__canvas/progress` | 插件应答 JSON 进度 | 透传（无害） |
| `/__canvas/retry` | `POST` 触发一次 `prepareRuntime()` | 透传 |
| `/mcp` | **挂起最多 90 s**，后端起来后交给后端 | 透传 |

**`/mcp` 为什么挂起而不是 503**：MCP 客户端会把 503 读成「该服务不支持 MCP」并缓存这个结论，之后不再回来。挂起 90 s 再超时返回 503 + `Retry-After: 10`，把「暂时没准备好」与「永久不支持」区分开。

**对决策 1 的影响（重要，但不是推翻）**：ready-first 之后，120 s 窗口不再是失败源 —— 下载可以跨多次任务继续，宿主也不会中途判死。断点续传因此从「唯一救命手段」降级为「缩短总时长的优化」，**但仍然保留**：慢网下 207 MB 仍可能要跨几个会话，没有续传就是一寸一寸重来。两者不同层次，一个是控制面（不再被判失败），一个是数据面（少传几个字节）。

**不采纳的变体**：

- 调大 `health.timeoutMs`：schema 硬上限 120 000，写 600 000 直接构建失败（已实测）。
- 准备失败时 `process.exit(1)`：宿主会把它当成可恢复失败并自动重启，形成更快的抖动循环。
- 把下载挪到插件前端（`ctx.services.install()`）：见决策 1 的通道成本表；且**shim 本身仍要由宿主写盘**，绕不过去。
- 在 `/api/health/ready` 里撒谎说 `ready`（不带 `phase`）：宿主会立刻去连后端，拿到连接拒绝后又判失败 —— 比超时更糟。

### 6. 停止信号：shim 必须自己退，不能只转发给后端

这是实测中撞到的另一半成因，也是决策 5 的必要补丁。

**原来的实现**：`SIGTERM` / `SIGINT` 只做 `forwardSignal()`，把信号转给 Go 子进程，**shim 自己不退**；退出完全依赖 `goProcess.on("exit")` 回调。

两个漏口：

| 场景 | 后果 |
|---|---|
| 准备阶段（还没 spawn 后端）收到 SIGTERM | 转发是空操作，下载循环继续跑，进程永不退出 |
| 后端不响应信号 | 同上，只能等宿主强杀 |

**实测证据（Observed）**：一个准备阶段的 shim 实例 `kill` 三次无效，存活 30 分钟后才被 `kill -9` 清掉（PID 98171，监听 19312）。

**这直接造成宿主侧的恶性循环**：用户点停止 → 宿主发 SIGTERM → 进程还在 → 宿主判定 stop 没生效 → 重试 / 超时 → 再发。每轮还可能留下一个新实例，端口与内存同时泄漏。**它比下载超时更难排查，因为日志里看不到错误，只有「停止不生效」**。

**决策**：

1. 无子进程时（准备阶段）立即 `process.exit(0)`；
2. 有子进程时转发信号，再挂 3 s 强制退出定时器（`unref()`，不阻止自然退出）；
3. `goProcess.on("exit")` 里先判 `shuttingDown` —— 主动停止不是故障，**不要**把 `phase:"failed"` 写进状态；
4. 下载中途退出留下的 `.partN` 正是决策 1 的续传凭据，不清理。

**验收（Observed，假后端 + 空数据目录）**：

| 场景 | 结果 |
|---|---|
| 准备阶段（下载中）SIGTERM | **0.35 s** 退出，端口立即释放 |
| 就绪后 SIGTERM | 假后端收到并自退 → shim **0.62 s** 退出，无残留子进程 |

两次都不再需要 `kill -9`。

### 7. 服务进程的环境变量必须由 `plugin.json` 显式声明

这是 0.0.5 上线后的第一个致命回归：装好后点「启动画布」直接弹「启动画布服务失败」，主进程日志里只有 `Plugin service failed to start` / `Service exited before becoming ready`，看不出缺的是什么。

**原来的假设（错的）**：宿主会像容器编排那样把 `ASTRAVIA_SERVICE_PORT`、`ASTRAVIA_SERVICE_DATA_DIR` 注入服务进程 —— 毕竟 `boot.mjs` 就是按这些名字读 `process.env` 的。

**实测推翻（Observed，反编译 `app.asar` 主进程 bundle 得到）**：

| 环节 | 真实行为 |
|---|---|
| `createPluginCommandEnvironment(overrides)` | 只组装 `INHERITED_ENV_KEYS` 白名单（`PATH`、`HOME`、`TMPDIR`、`npm_config_*` 等）再展开 `overrides`，**不继承任意 `process.env`** |
| `overrides` 来源 | 唯一来源是 `plugin.json` 的 `providers.services[n].process.env` |
| 注入方式 | **模板替换**：`TOKEN_PATTERN` 匹配 `${ASTRAVIA_SERVICE_(PORT|RUNTIME_DIR|DATA_DIR|CACHE_DIR|SECRET_<NAME>)}`，命中值先过 `replaceTokens(value, values)` 再进环境 |
| 同一套 `values` 的另一个用途 | `materializeTemplates()` —— 替换插件自带模板文件**内容**里的同名占位符 |

在 60 MB 的 bundle 里按纯文本搜 `ASTRAVIA_SERVICE_DATA_DIR` 命中 0 次，原因就是它只以 `${...}` 形式出现，宿主从不拼这个裸名字。

**失效链路**：`plugin.json` 的 `process` 只有 `{ "args": [] }`、没有 `env` → `env` 为空对象 → 白名单里没有 `ASTRAVIA_SERVICE_*` → `boot.mjs` 第 31–32 行读到 `undefined` → `process.exit(1)` → 宿主 `child.once("exit")` 把 `record.child` 置空 → `waitUntilReady` 抛 `Service exited before becoming ready`。三次重试各一秒，全部同因。

**旁证**：同一个 `boot.mjs` 手工带上这四个变量直跑，进程存活、`/api/health/ready` 正常返回 `200 {"status":"preparing","phase":"downloading"}` —— 脚本没问题，缺的只是环境。

**决策**：

1. `providers.services[0].process.env` 显式声明四个变量，值就是对应的模板：`ASTRAVIA_SERVICE_PORT`、`ASTRAVIA_SERVICE_DATA_DIR`、`ASTRAVIA_SERVICE_RUNTIME_DIR`、`ASTRAVIA_SERVICE_CACHE_DIR`；
2. `boot.mjs` 继续直接读 `process.env.ASTRAVIA_SERVICE_*` —— **不去改脚本去猜宿主约定**，也不引入第二套变量名；
3. 需要凭据时用 `${ASTRAVIA_SERVICE_SECRET_<NAME>}`，宿主会创建并持久化（`data/service-secrets.json`）；
4. 这类缺失只在真机才暴露：本地 `npm run build`、市场构建与全部内容测试都不会启动服务进程，所以 0.0.5 一路绿灯。

**验收（Observed，两步对照）**：

| 场景 | 结果 |
|---|---|
| `env -i` 模拟白名单、不带变量（0.0.5 现状） | 立即退出，`exit=1`，stderr 为 `Missing ASTRAVIA_SERVICE_PORT or ASTRAVIA_SERVICE_DATA_DIR` |
| 按 `plugin.json` 声明的四个模板展开后再启动 | 进程存活，`/api/health/ready` 返回 `200 {"status":"preparing","phase":"downloading"}`，代理监听在分配的端口 |

第一个实验复现了宿主日志里的失败，第二个证明声明补上即可，无需改宿主、无需改 shim。

**同批修复：就绪后自动进画布。** 服务能起来之后用户又碰到第二个问题 —— 点「启动画布」后什么都没发生，还得自己再回头点一次「打开浏览器」。原实现只把 `baseUrl` 写进状态，从不主动唤起浏览器。对照上游桌面壳（`apps/desktop/src-tauri/src/server.rs:161`：`wait_ready` 成功后直接 `navigate(app, &base_url)`，没有「请再点一下」这一步），`ensureRunning()` 在 `applyReady()` 之后直接 `openExternal(baseUrl + "/")`；就绪早返回分支同样打开，避开「服务已在跑、点启动没反应」。唤起失败被 `catch` 吞掉，不影响已就绪的事实。
### 8. 创作 Agent 与它要用的 node 单独发载荷，不再靠宿主进程碰运气

0.0.6 之后服务能起来、画布能打开，但**生成任务仍然失败**。原因不在 shim，在供给链：

- 主载荷只有三件（`yingce-backend` / `web-dist` / `plugin-packages`）。`provision.go` 的 `resolvePi` 按「`CANVAS_PI_RUNTIME_DIR` → 已解包目录 → `CANVAS_PI_ARCHIVE` → 报错」解析，**没有联网下载分支**（`node` 有，`pi` 没有）。所以缺就是永久缺，只会得到一句「Agent 运行时文件缺失」。
- `Ensure` 唯一的调用点是 `runtime.go:69`，它在 `runtime.Run` 里；而 `runtime.Run` 只被云 Agent 的生成链路调用（`cloud_agent_pi_runtime.go:48`）。这解释了「服务正常、画布能开、AI 生成报错」这个组合，也说明它不能靠调大超时缓解。

补它有两个陷阱：

1. **`pi` 要 node 22**。实测 `@yingce/pi-agent-runtime` 的 `engines` 是 `>=22.19.0`；宿主 Astravia 用 Electron 内置的 node 启动 shim，那个 node 是 **20.19.1**，跑 `agent-runtime.mjs` 直接 `SyntaxError: The requested module 'node:fs' does not provide an export named 'globSync'`。因此「用 `process.execPath` 当 `CANVAS_NODE_BIN`」对 pi 不成立。
2. **不能塞进主载荷**。pi 解压后 242 MB / 24,965 文件，并进去会让每次插件升级都重下整包，也会把 2,195 条目的主载荷推到 2.7 万条目。

因此：`agent-runtime-0.0.1-darwin-arm64.zip` 独立发布（解压后 94,861,028 B / 24,966 条目），内含 `pi-runtime/**` 与 `node/bin/node`（取宿主已装的官方分发 `~/.astravia/runtimes/node/22.22.2`，版本与 `pinnedNodeVersion` 一致）。shim 解包到 `DATA_DIR/runtime/agent-<ver>/` 后注入两个变量：

```js
CANVAS_PI_RUNTIME_DIR: path.join(AGENT_DIR, "pi-runtime")
CANVAS_NODE_BIN:       path.join(AGENT_DIR, "node", "bin", "node")
```

**分层思路**：node 解析是三层 —— 载荷自带的 node（版本确定）→ `process.execPath`（若 `process.versions.node` ≥ 22.19.0）→ 不设变量，让后端自己走 `installedNode()` / `lookPath`。自带那层存在时永远命中第一层。

**同批补 `CANVAS_PUBLIC_BASE_URL`。** `resource.go:73` 的 `publicResourceBaseURL()` 先看设置项，再看这个环境变量，两者都空就直接 `BadAuthRequest`（「服务器本地存储尚未配置服务器访问地址」）。上游桌面殼在 `server.rs:117` 注入它；插件侧原来只注了 6 个变量，上传/预览本地资源会报错。值是 `http://127.0.0.1:${HOST_PORT}` —— 端口由宿主分配、每次启动都可能变，所以只能运行时算，不能写进配置。

**降级原则**：Agent 载荷失败不拦画布。上游把 pi 当必需（失败即报错）；这里把它当可选能力 —— `resolveAgentDir()` 就地吞掉异常并返回 `null`，画布、MCP、项目管理照常，只有 Agent 任务不可用。这是有意的不对称：主载荷缺失依然让整体 `phase: failed`，因为那是真的没东西可跑。

**顺带修两处 shim 缺陷**（由 24,966 条目才暴露）：

| 缺陷 | 现象 | 修法 |
|---|---|---|
| 每条目重新 `openSync` 归档读本地头 | 2.5 万条目 ≈ 5 万次 open/close | 循环外开一个只读 fd，`try/finally` 关闭 |
| 空文件条目 `compressedSize === 0` | `createReadStream({start, end: start - 1})` 抛 `start is out of range` | 直接落空文件 |

两处都先被实测打到（`The value of "start" is out of range. It must be <= "end"`），不是预判。


## 兼容和迁移

按依赖顺序执行，每步可独立回滚：

| 步骤 | 内容 | 回滚方式 |
|---|---|---|
| 1 | `boot.mjs`：先监听后准备的启动编排（决策 5）、**收到 SIGTERM/SIGINT 时自己退出**（决策 6）、分片 `.partN` 续传、删除重试 `rmSync`、流式解包 | 回退 `boot.mjs` 文件；`data/runtime/` 不受影响 |
| 2 | `scripts/build-service-zip.mjs`：`--shim` 产 `public/assets/boot.mjs` 并校验 `sha256`/`archive`/`destination` 三项；新增 `--clean` | 保留旧 zip 产物即可回退 |
| 3 | `plugin.json`：`archive: "file"` + `destination: "server/boot.mjs"`；`runtime.version` → `0.1.0`；`platforms` 增 `win32-x64`（Windows payload 就绪后再加，避免清单先于制品） | 改回 `0.0.4` 的清单字段；`isReadyRuntime` 会因 marker 不匹配自动重装 |
| 4 | `src/runtime.ts`：`ARTIFACT_PATH = "dist/assets/boot.mjs"`；`ensureRunning()` 改为一次会话只装一次；**就绪后自动打开画布**（决策 7 旁的同批修复） | 与 3 同步回退 |
| 5 | `plugin.json` 的 `providers.services[0].process.env`：声明四个 `${ASTRAVIA_SERVICE_*}` 模板（决策 7） | 删 `env` 即回到 0.0.5 的失败态；无数据迁移 |
| 6 | 发布 `payload-0.0.1-win32-x64.zip` 到 `plugin-open-ai-canvas` Release | 删资产 + 回退清单 platforms |
| 7 | 发布 `agent-runtime-0.0.1-darwin-arm64.zip`（`pi-runtime/**` + `node/bin/node`）到同一 Release，并把 sha256 写进 `boot.mjs` 的 `AGENT_PAYLOADS` | 删资产 + 把 `AGENT_PAYLOADS` 置空；`resolveAgentDir()` 会直接返回 `null`，画布不受影响 |
| 8 | `boot.mjs` 注入 `CANVAS_PUBLIC_BASE_URL` 与自带的 `CANVAS_NODE_BIN`（决策 8） | 删这两行即回到 0.0.6 行为；主载荷与已解包的 agent 目录都无需迁移 |

**版本号**：插件 `0.0.4 → 0.0.5`（本 ADR 落地），`0.0.5 → 0.0.6`（决策 7 与自动打开修复），`0.0.6 → 0.0.7`（决策 8）；`runtime.version` `0.0.1 → 0.1.0`；`PAYLOAD_VERSION` **保持 `0.0.1` 不变**；新增独立的 `AGENT_PAYLOAD_VERSION = "0.0.1"`。

两个载荷的版本号分开管：主载荷 sha256 `fb463965…d545c0c7` 在 0.0.7 里**一字未改**，已下过 216 MB 的用户只多付 90.5 MB；下次只改 agent 内容时也不连累主载荷。

**关键不变量**：老用户升级后不得触发 207 MB 重下。验证方式：升级前记录 `data/runtime/0.0.1/.ready`（或目录 mtime），升级后点「启动」应在数秒内进入 running。

## 备选方案

| 方案 | 否决理由 |
|---|---|
| 插件侧下载后 `install()` | 207 MB → 276 MB base64 经 IPC + 主进程内约 0.7–1 GB 峰值（`decodeArtifact` 会再编码一次做比对）。仅作离线/内网旁路保留。 |
| 调大 `health.timeoutMs` | schema 硬上限 120000，已用满。 |
| 首次启动前提示用户「先等 X 分钟」 | 没有进度反馈的等待等于失败；且不解决任何技术约束。 |
| 让宿主代下（像 MCP runtime 那样带 url） | `PluginServiceArtifactSchema` 没有 url 字段；带 url 的 `downloadArtifact()` 只服务 MCP managed runtime。要改宿主，不在本仓库范围。 |
| payload 全平台共用一份 | 后端是机器码，物理不可行。 |
| 立即拆 common + platform 双包 | 收益只是一次性少传 162 MiB，而双 spec 的失败面是永久的。列为阶段二，等 Windows 载荷进入迭代期再拆。 |
| 保留 zip 容器 | 容器不做事，只增加一层「校验哈希的对象 ≠ 执行体」的认知负担与跨平台打包次数。 |

## 拷问记录

按 `grill-with-docs` 的意图，记录三个被认真考虑后驳回的追问：

**Q：既然「都是 web 界面」，为什么不能连后端也共用一个 zip？**
不能。`web-dist` 是静态资源，任何系统都一样；`yingce-backend` 是编译产物，CPU 指令集不同。共用的上限就是「除后端之外的一切」，本文的决策 2.1 已经把这个上限吃满。

**Q：断点续传只是让用户多点几次，算「根治」吗？**

0.0.5 之后这个问法已失效 —— 决策 5 的 ready-first 把 120 s 窗口从控制面上拿掉了，宿主不再在下载中途判死，续传退化成「少传几个字节」的数据面优化（仍然保留，慢网下有意义）。真正的根治仍是「首次不用下 207 MB」，那需要拆包或本地内置，已列入阶段二/范围外。

**Q：`archive: "file"` 会不会有宿主版本兼容风险？**
`archive` 的联合类型里 `file` 一直存在，`install()` 的 `if (artifact.archive === "file")` 分支也在同一份代码里（Observed）。风险不在契约，而在 `minAppVersion`：若目标宿主版本过低，需同步提高清单里的 `minAppVersion`。

## 验证

全部命令在 `abilities/plugins/open-ai-canvas/` 下执行。

**1. 清单与产物一致性**

```bash
# 决策 3 之后：shim 是单个 .mjs，且必须落在 dist/assets/ 才进得去包
node scripts/build-service-zip.mjs --shim --check   # 期望：插件声明的 sha256/archive/destination 与产物一致
ls -l public/assets/                                # 期望：只有 boot.mjs，无 *.zip
npm run build && python3 -c "import zipfile;print([n for n in zipfile.ZipFile('release/open-ai-canvas-0.0.5.astraviapkg').namelist() if 'boot' in n])"
                                                    # 期望：['dist/assets/boot.mjs']，空列表 = 打包器没收，install 会 404
```

**2. 宿主上限（防化石回归）**

```bash
python3 - <<'PY'
import os, zipfile
for d in (".payload", "public", "public/assets"):
    if not os.path.isdir(d):
        continue
    for n in sorted(os.listdir(d)):
        if not n.endswith(".zip"):
            continue
        p = os.path.join(d, n)
        with zipfile.ZipFile(p) as z:
            print(f"{p}: entries={len(z.namelist())}  (宿主上限 10000)")
PY
# 期望：条目数全部 < 10000，且 .payload/ 下不再出现 open-ai-canvas-*.zip
```

**3a. ready-first（决策 5 的验收）—— 已用假后端在本机实测（Observed）**

做法：`data/runtime/0.0.1/yingce-backend` 换成一个读 `FAKE_DELAY_MS` 延迟 listen 的 node 脚本，其余不变。

| 检查 | 结果 |
|---|---|
| `GET /api/health/ready` 在 t=1..6 s | 持续 **200**，body `{"status":"preparing","phase":"starting-backend",…}` |
| `GET /` 在准备期 | 返回自包含进度页（`<title>正在准备 Open AI Canvas</title>`） |
| `GET /__canvas/progress` | 返回 JSON 进度 |
| `POST /mcp` 在准备期 | **挂起**（3 s 客户端超时 `exit=28`），未返回 503 |
| 后端就绪后 | `/` → 透传后端；日志出现 `复用已就绪的运行时` 与 `Backend listening on port 59128` |

**3b. 断点续传（决策 1 的验收）—— 已用本地 Range 服务实测（Observed）**

24 MiB 假载荷 + 限速 300 ms/块，第 3 秒 `kill -9`：8 个 `.partN` 各 655 360 B，合计 5 242 880 B（20.8%）。重启后服务端收到的 Range 依次为 `bytes=655360-3145727`、`bytes=3801088-6291455`…`bytes=22675456-25165823` —— **每片从「片起点 + 已落盘字节」续取**。最终 sha256 不符 → 分片与归档被正确清空（验证「只有不匹配才删」）。

**3c. 停止信号（决策 6 的验收）—— 已用假后端实测（Observed）**

两个场景各测一次，判据是「不经 `kill -9` 就能死掉且端口释放」：

| 场景 | 构造 | 结果 |
|---|---|---|
| 准备阶段（下载中） | `CANVAS_PAYLOAD_BASE_URL` 指向不可达地址，`/api/health/ready` 返 200 + `phase:"downloading"` | `kill -TERM` → **0.35 s** 退出，19402 立即释放 |
| 就绪后（带后端） | `data/runtime/0.0.1/yingce-backend` 换成打印 `addr=127.0.0.1:<port>` 的 node 假后端 | 假后端收到 SIGTERM 并自退 → shim **0.62 s** 退出，无残留子进程 |

就绪场景的日志尾巴：`[fake] backend got SIGTERM` → `Backend exited: code=0 signal=null`。

修复前同一个 shim 实例 `kill` 三次无效，存活 30 分钟后只能 `kill -9`。

**3e. 服务进程环境（决策 7 的验收）—— 已用 `env -i` 沙箱实测（Observed）**

两次实验用同一个 `boot.mjs`，变量由 `plugin.json` 的 `process.env` 模板派生：

| 场景 | 命令要点 | 结果 |
|---|---|---|
| 不带声明（0.0.5 现状） | `env -i PATH HOME TMPDIR node server/boot.mjs` | `exit=1`，stderr 为 `Missing ASTRAVIA_SERVICE_PORT or ASTRAVIA_SERVICE_DATA_DIR` |
| 按声明展开四个模板 | 同上 + `ASTRAVIA_SERVICE_{PORT,DATA_DIR,RUNTIME_DIR,CACHE_DIR}` | 进程存活，`/api/health/ready` 返 `200 {"status":"preparing","phase":"downloading"}`，日志出现 `Proxy listening on http://127.0.0.1:19691` |

第一个结果是宿主日志里 `Service exited before becoming ready` 的直接复现；第二个证明宿主 `waitUntilReady` 会看到 200 并立即就绪，首次启动剩下的只是那 216 MB 下载。

**3f. 完整链路实测（决策 8 的验收）—— 本地回环起载荷服务实跑（Observed）**

环境：`python3 -m http.server 8901` 指向两个真实载荷（sha256 与 Release 一致），全新空 `DATA_DIR`，四个 `ASTRAVIA_SERVICE_*` + `CANVAS_PAYLOAD_BASE_URL`，宿主端口 8919。

| 阶段 | 日志 | 耗时 |
|---|---|---|
| 主载荷下载 | `下载完成（206.9 MB，用时 9s）` | 9 s |
| 主载荷解包 | `运行时载荷已解包到 …/runtime/0.0.1.partial（4s）` | 4 s |
| Agent 载荷下载 | `下载完成（90.5 MB，用时 9s）` | 9 s |
| Agent 载荷解包 | `创作 Agent 运行时已解包到 …/agent-0.0.1.partial（17s）`（24,966 条目） | 17 s |
| 后端起 | `backend listening addr=127.0.0.1:50901` / `serving frontend static assets` | 即时 |

两个载荷都在本地回环，所以下载耗时不可外推（真实网络按 1.34 MB/s 约 3 min + 1.1 min）；**解包耗时可以外推**，因为它们只与条目数和磁盘 IO 有关。

四路探针全部命中（Observed）：

```
GET  /                  → 200, 3586 bytes
GET  /api/health/ready  → 200 {"ready":true,"checks":{"database":true,"runtime":true,"schema":true}}
POST /mcp initialize    → 200 {"serverInfo":{"name":"open-ai-canvas","version":"0.1.0"}}
```

后端进程的实际环境（`ps -E` 读回，不是看代码推测）：

```
CANVAS_STATIC_DIR      = …/runtime/0.0.1/web-dist
CANVAS_PUBLIC_BASE_URL = http://127.0.0.1:8919
CANVAS_NODE_BIN        = …/runtime/agent-0.0.1/node/bin/node
CANVAS_PI_RUNTIME_DIR  = …/runtime/agent-0.0.1/pi-runtime
```

pi 在自带 node 下确实能起（这层不实测就不知道）：

```
$ node/bin/node -v                          → v22.22.2
$ echo | node/bin/node pi-runtime/agent-runtime.mjs
  → {"event":"runtime_error","message":"Agent runtime input is empty"}
```

对照宿主 Electron 的 node（`20.19.1`）跑同一个入口，得到的是 `SyntaxError: The requested module 'node:fs' does not provide an export named 'globSync'`（来自 `pi-coding-agent/dist/core/package-manager.js:2`）—— 这就是「必须自带 node」的根据。

**未测到的**：用真实模型触发一次生成任务。它需要画布项目 + 模型凭据，属于用户侧验收；本文只证到「后端拿得到 pi 目录与 node 可执行文件，pi 本身能加载」。


**3d. 真机验收步骤（NOT RUN，待界面复验）**

```bash
# 断网/限速到 ~1 MB/s，首次启动后等宿主超时
# 期望：data/runtime/0.0.1.partial.zip.part0..7 保留，部分 size > 0
ls -l ~/.astravia/plugin-services/open-ai-canvas/open-ai-canvas/data/
# 再次点「启动」，观察日志首行是否出现「续传」而非「首次启动」
grep -i "payload\|续传\|part" ~/.astravia/desktop-app/logs/main/$(date +%F).log | tail -20
# 判据：第二次启动后 .partN 累积增长；第三次内进入 running
```

**4. 跨平台共用（决策 2.1 的验收）**

```bash
node -e '
const m=require("./plugin.json"), p=m.providers.services[0].runtime.platforms;
const shas=Object.values(p).map(x=>x.artifacts.map(a=>a.sha256).join(","));
console.log(shas); console.log("shared:", new Set(shas).size===1);
'
# 期望：shared: true
```

**5. 升级不重下（迁移不变量）**

```bash
# 升级前
du -sh ~/.astravia/plugin-services/open-ai-canvas/open-ai-canvas/data/runtime/0.0.1
# 升级 0.0.5 后点「启动」，再次
du -sh ~/.astravia/plugin-services/open-ai-canvas/open-ai-canvas/data/runtime/0.0.1
# 期望：体积不变，日志出现「复用已就绪的运行时」
```

**6. Windows（决策 2.3，需真机）**

```powershell
# 安装插件 → 首次启动 → 等 ready
# 判据：无控制台弹窗；/api/health/ready 200；MCP tools/list 正常；停止后 tasklist 无 yingce-backend.exe
```
