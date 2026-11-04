# ADR 0005：Payload 取上游发布的 web 包，版本门是运行期能力探测

> **已作废**（2026-11-04）：站点不再从上游 Release 下载，改为由 CI 用上游源码构建并随包分发。
> 现状见 [craft-0011](craft-0011-the-site-ships-in-the-package.md)。以下是当时的判断留痕。


- 状态：已接受（2026-11-02 提出，2026-11-03 按 [0008](./0008-payload-never-depends-on-one-host.md) 把「单一上游 URL」换成有序源清单）
- 关联文档：[0001](./0001-the-tab-runs-upstreams-web-build.md)、[0002](./0002-bytes-move-through-the-host.md)、[0007](./0007-one-loopback-hub-three-entries.md)、[0008](./0008-payload-never-depends-on-one-host.md)

## 1. 背景

标签页要加载的东西必须有一个确定来源。可选的三条路：

1. 把 `dist/web` 打进市场包（解压后单文件 27,072,762 B 的 `.wasm`，超过市场解压总量与单包体积的合理区间）。
2. 首次启用时从上游 GitHub Release 下载 `photocraft-web-<version>.zip`。
3. 让用户自己在本机构建（trunk + wasm32）。

第 3 条把「装个插件」变成「配一套 Rust 工具链」，排除。剩下 1 与 2 的差别是**谁认证这些字节**：

- 打进去：字节由本仓库 CI 认证（我们的包、我们的 sha256），但每次装本插件都要多搬 10.8 MB，
  且市场索引里出现一份我们无法解释来源的 25.8 MiB 二进制。
- 上游下载：字节由**上游的 Release + `SHA256SUMS.txt`** 认证。已核实这条链是通的：
  `release.yml` 的 `web` job 上传 `dist/release/*`，release job 用 `sha256sum -- *` 生成
  `SHA256SUMS.txt`，所以 web zip 与各平台安装包在同一份校验清单里（Observed：`.github/workflows/release.yml`
  第 286–318 行与 release job 的 Checksums 步骤）。

## 2. 决策

**D1 Payload 是上游的 web 包**：`photocraft-web-<version>.zip`，对着同一 Release 的 `SHA256SUMS.txt` 交叉核验。
从哪台主机取字节由 [0008](./0008-payload-never-depends-on-one-host.md) 决定——一份有序的 `sources[]` 加一条
「越本地越优先」的解析顺序，本机已有的文件永远排在网络前面。拉取、校验与服务都在插件的 host-node hub 里做
（[0007](./0007-one-loopback-hub-three-entries.md)），且**不解包**：zip 以整份文件缓存在服务数据目录的
`payload-<sha12>.zip`，按中央目录建 `name → offset` 索引，请求到了才对单个条目 `inflateRaw` 并缓存结果。
没有「解压目录」这个实体，也就不存在解压目录被路径穿越的问题。

**D2 先验后用，验不过就不服务**。拿到的 zip 先算 sha256，不符就删掉、报 `payload-unverified`；
`SHA256SUMS.txt` 里如果列出了这个文件且值与钉住的不同，同样算错配。清单本身拿不到时只记
`state.sums = "unreachable"` 并在日志里留一行——**钉住的 sha256 是唯一门禁**，上游清单只是交叉核对。
校验通过之前 `/` 只返回一个等待页，不会把未认证的字节当成编辑器发出去。

**D3 我们改写上游字节的地方只有 `index.html` 的两处插入**：hub 响应 `/index.html` 时，

1. 在 `<head ...>` 之后插一段内联语言种子（只写 `localStorage["photocraft.preferences"]` 的空值，见 0011 D1/D2）；
2. 在 `</body>` 之前插 `<script src="./host-bridge.js"></script>`（`/host-bridge.js` 由 hub 提供）。

两处都是纯插入，不删不改原有字节，所以 `index.html` 上的 SRI 与分片顺序都不受影响。其余条目（`.wasm`、`.js` 胶水、
`app/*.part-*`、`_headers`、`.htaccess`）逐字节就是 zip 里的字节。这一步是**确定性变换**：同一个 zip 加上这两条插入规则，
就足以描述页面看到的全部内容。缺 `<head`、缺 `</body>` 时 hub 原样返回并在 `/api/state` 报 `inject-miss`——
宁可降级也不能默默插到错位置。

**D4 版本门是能力探测，不是版本号比较**。加载后由 `pc:ready` 报回真正可用的后端：

| 探测顺序 | 判定 | 加载方式 |
| --- | --- | --- |
| 1 | `navigator.gpu` 存在且 `requestAdapter()` 返回非空 | 默认 URL |
| 2 | `WebGL2RenderingContext` 可用 | `index.html?webgl`（上游把 wgpu 后端切到 GL） |
| 3 | 都没有 | `?cpu`（上游的软件光栅路径，编辑可用但慢） |

触发条件不是「探到没有 GPU」，而是**编辑器真的没起来**：上游把 `#photocraft_loading` 移除才算启动成功，
否则会把它改写成 `PhotoCraft failed to start: … A browser with WebGPU or WebGL2 is required.`。桥就盯这一个
元素（`host-bridge.js` 的 `announceBoot`），成功才发 `pc:ready{backend}`，失败或 30 s 超时发 `pc:error`；
标签页收到后者就升一级重挂 iframe（`auto → ?webgl → ?cpu`），到 CPU 还失败才停下并把原文案抬给用户。
后端字母（`GPU` / `GL` / `CPU`）显示在信息条上：用户报「卡」时这就是第一诊断信息，不需要开 DevTools。

**D5 不做「最低版本」断言**。上游 web 构建没有稳定的功能契约可依赖；我们在意的是「它能不能启动、
两个 DOM 接缝还在不在」。接缝不在就降级（见 0002 §4 最后一行），不改行为、不猜版本。

**D6 缓存一份 zip 加一份内存索引**。当前钉住的版本以单文件 `payload-<sha12>.zip` 存在服务数据目录，
启动时只要 sha256 对得上就立即可用；升级插件版本（= 换 sha256）后首次启动拉新的一份，旧的留着不删。
没有「保留最近两份」、也没有删除按钮：一份 10.8 MB 的 zip 不值得为它维护一套目录回收逻辑。
「重新下载」就是换一个 sha 前缀，或者用户自己清数据目录。

## 3. 离线与被墙

这一节原来写的是「还没实现」。2026-11-03 已按 0008 落地，现在的降级顺序有三层：

1. **本机已有字节**：服务数据目录里的 `payload-<sha12>.zip`（缓存）、`photocraft-web-<version>.zip`（用户投放）、
   `payload.zip`（上一级目录同样认）、`PHOTOCRAFT_PAYLOAD_ZIP` 指向的任意路径。**逐个过 sha256，不信任文件名。**
2. **显式覆盖**：`PHOTOCRAFT_PAYLOAD_URL`，唯一允许 `http:` 的入口（内网文件服务）。
3. **`sources[]`**：上游 Release 与其镜像，逐项失败记入 `/api/state.attempts` 后继续。

等待页（`phase:"failed"`）列出每个源的 id 与错误，并给出一个可直接复制的**绝对投放路径**。文件落位不需要重启
服务：下一次 `GET /` 就重走本地探测，投对了当场变 `ready`（Observed，见 §5）。

Hub 侧还保留**断点文件**：字节先写到 `payload-<sha12>.zip.part`，重启后用 `Range: bytes=<已收>-` 续传
（Observed：`server/hub.src.mjs` 的 `downloadSource()`），所以「关掉再开」不会从头再拉。

仍然只有**人**能触发网络重试：失败后 hub 只重查本地文件，重新走网络要等 60 s 或重启服务。自动重试会在租网环境下
变成一场看不见的流量消耗。

## 4. 后果

- **好处**：本仓库不托管任何第三方二进制；升级＝改一个版本号 + 一个 sha256；上游发新版不需要我们重建。
- **代价一**：首次启用必须联网（或用户自备 zip）。这一点必须写在卡片与安装步骤里，不能让人装完发现白屏。
- **代价二**：`SHA256SUMS.txt` 的两列格式已对着真实 Release 核过（`v0.2.0` 的清单 HTTP 200、1,535 B，
  里面确实有 `photocraft-web-0.2.0.zip` 一行，sha256 `a03e6118…48e5f`）。剩余风险是上游改生成方式，
  届时校验会直接失败而不是静默放过。
- **代价三**：注入步骤依赖上游 `index.html` 里存在 `</body>` 与相对资源路径。`packaging/web/package.sh`
  已经强制「根绝对 URL 一律报错」，所以相对路径这条是上游自己保证的（Observed：脚本里的
  `grep -Eq '(src|href)="/[^/]'` 检查）。

## 5. 证据与未验证

Observed：`packaging/web/package.sh` 的产物名与 24 MiB 闸门；`release.yml` 的 web job 与
`sha256sum -- *`；真实的 `v0.2.0` 资产（zip 10,755,523 B、`sha256 a03e6118…48e5f`，且`SHA256SUMS.txt`
里确实在册）；zip 内只有一个顶层目录，`.wasm` 27,072,762 B、胶水 `.js` 159,235 B、`index.html` 1,448 B，
共 9 个条目；hub 从缓存的 zip 直接供给该 `.wasm` 得 200 `application/wasm`、与原件逐字节相同、耗时 0.137 s。
`packaging/web/README.md` 写的是另一个数字（19,680,726 B raw），那是上游自己的尺寸表，与本仓库实测不符，
以实测为准。

Observed（2026-11-03，对应 `release/photocraft-0.0.2.astraviapkg` 的 hub）：预置缓存 `payload-a03e6118beed.zip` →
`source:"cache"`、9 条目、`attempts:[]`，全程不触网；只放 `photocraft-web-0.2.0.zip` → `source:"local"`、`ready`；
放一个被截断的 4 KiB 文件 → `sha256-mismatch` 记入 `attempts` 后继续走网络；把两个源都指向拒绝连接的地址 →
`phase:"failed"`、`attempts` 两条、等待页打印源与绝对投放路径；随后把正确 zip 投到该路径并再 `GET /` →
`ready`、`source:"local"`，**未重启进程**。

未验证：
1. `?cpu` 降级梯子在 25.8 MiB 的 wasm 上是否真的可交互（软件光栅遍历大图可能慢到不可用）。
2. 浏览器侧从首次下载到流式编译完成的总耗时（本地回环响应已实测，浏览器编译未测）。
3. 上游发新版后 `index.html` 的 `</body>` 与相对路径是否仍在（注入点靠这两条）。
4. `PHOTOCRAFT_PAYLOAD_URL` / `_ZIP` 是否真的透传到宿主拉起的 host-node 子进程（`plugin.json` 只声明了四个
   `ASTRAVIA_SERVICE_*` 变量）；未实测，所以它们被设计成**可选加速**，缺省路径不依赖它们。
