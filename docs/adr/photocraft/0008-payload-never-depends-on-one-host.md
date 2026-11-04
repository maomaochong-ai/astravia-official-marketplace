# ADR 0008：payload 不绑在单一主机上

> **已两度改写**（2026-11-04）：本文的"首次打开时从上游 Release 下载、由回环 hub 发文件"链路先被
> [craft-0011](craft-0011-the-site-ships-in-the-package.md) 换成 CI 源码构建，又被
> [craft-0012](craft-0012-the-site-is-upstreams-release-bundle.md) 换成"打包时下载上游发布的那份 web 包"。
> 站点仍来自上游，只是下载时机从运行时挪到了打包时。以下是当时的判断留痕。


- 状态：已接受（2026-11-03 提出并当日落地，落实位置见 §5）
- 关联文档：[0001](./0001-the-tab-runs-upstreams-web-build.md)、[0005](./0005-payload-provenance-and-runtime-gate.md)、[0007](./0007-one-loopback-hub-three-entries.md)、[CONTEXT.md](./CONTEXT.md)

## 1. 背景

`payload/manifest.json` 第一版只有一个 `url`，指向 GitHub Release 上的 `photocraft-web-0.2.0.zip`。这条单一
引用把「插件能不能用」与「这台机器此刻能不能连上 GitHub」绑成了同一件事。

事实是：上游只在自己的 GitHub Release 发布 web 构建（Observed：`packaging/web/package.sh` 产出
`photocraft-web-<version>.zip`，`release.yml` 的 web job 上传到 Release，`sha256sum -- * | tee SHA256SUMS.txt`），
没有 npm 包、没有独立 CDN、没有可用的 jsDelivr 路径（jsDelivr 镜像的是仓库文件，不是 Release 资产）。

而安装这条路本来可以完全离线：`.astraviapkg` 是一个本地文件，装它不需要网络。于是出现一种荒谬的对比——
**装的时候不需要网络，第一次打开标签页却需要**。在中国大陆无代理的网络里，GitHub Release 的下载经常超时
（Inferred：这是广泛的用户报告，本轮没有在受限网络下实测）。

## 2. 候选

### A. 把 zip 打进 `.astraviapkg`（否决）

打包器的收集范围是白名单：`plugin.json`、`ability.json`、`manifest.entry`、`remoteEntry`、`dist/assets/**`、
`dist/*.css`、`listPluginManifestResources()`、`mcp/`、`scripts/`、`agent/docs/`、`locales/`
（Observed：`@astravia-org/plugin-vite/dist/pack.js::collectRuntimeFiles`）。任意 `payload/*.zip` 不在其中。
想让它进包只有一条路：编进 bundle。而服务制品本身也是由渲染进程以 base64 交给宿主的
（Observed：`PluginServiceArtifactPayload.data`），所以「随包分发」在这个宿主上等价于「14 MB base64 字符串
留在渲染进程内存里」，渲染包从 0.42 MB 涨到约 15 MB。

### B. 放到 `presentation/` 让打包器带上（否决）

`collectRuntimeFiles` 确实会整体收 `presentation/`（Observed：`pack.js:177-185`），但它落在**插件资源目录**，
而 hub 跑在宿主分配的**服务运行目录**里，两者之间没有插件可用的读路径。另外仓库归档上限 25 MB，一个 10.8 MB
的二进制会挤掉后续能力的位置，而它还是可再从上游取得的内容。

### C. 换一个镜像做默认来源（否决）

第三方 GitHub 代理（`ghproxy` 一类）没有可用性承诺，也没有身份可追。把它设成**唯一**来源，等于把插件的
首次可用性外包给匿名服务；把上游设成唯一来源，则是现在这个问题本身。

### D. 多来源按序尝试，字节一致性由 sha256 判定（选定）

## 3. 决策

**D1 `payload/manifest.json` 升到 `schemaVersion: 2`。** 顶层 `version` / `size` / `sha256` 仍是唯一权威；
`url` 拆成有序的 `sources[]`，每项 `{ id, url }`。`id` 只是给人看的标签，代码里没有任何按 id 分支的逻辑。
`sumsUrl` 保留（见 D5）。

**D2 解析顺序是「越本地越优先」。** hub 的 `ensurePayload()` 依次尝试：

1. 缓存 `payload-<sha12>.zip`（命中且 sha256 通过即用，零网络）；
2. 用户投放的叫 `photocraft-web-<version>.zip`（`payload/manifest.json` 的 `localFile`）——**离线兜底**；
3. 同一目录下更短的叫法 `payload.zip`，以及数据目录**上一级**的同名文件；
4. 数据目录里的 `payload.json`：`{ "localFile": "…", "sources": [{ "id", "url" }] }`。这是**宿主下唯一可由用户
   修改的通道**（服务的进程环境是白名单，见 0007 D1b）；首次启动 hub 自己写一份带说明的空壳，等待页印出它的
   绝对路径；
5. 环境变量 `PHOTOCRAFT_PAYLOAD_ZIP` / `PHOTOCRAFT_PAYLOAD_URL`：只在手动 `node server/hub.mjs` 时有效
   （Observed：宿主不给 host-node 子进程透传父环境）；

1–3 全部只做本地探测，**名字只是提示，sha256 才是判定**：放错文件名不影响，放错字节一定被拒。第 4 步的
`localFile` 同样过闸（也是「把文件改名后指着用」的正式写法），`sources[]` 则进入下载队列。

第 2 步是这一版真正的解耦：**只要用户手上有一份 zip，这个插件永远不需要那个 URL。** 它不要求用户理解
manifest、不要求改配置，只要求把文件放进一个等待页会印出绝对路径的目录。

**D3 每个字节来源都必须过 sha256，不通过就换下一个。** 因此镜像方**不需要被信任**：能投毒的是字节，判定
的是哈希。任何一项失败记入 `state.attempts`（`{ id, error }`）后继续，全部失败才 `phase = "failed"`。
失败原因不合并成一句话——「连不上」和「下下来校验不过」是两种完全不同的故障。

**D4 失败必须可自愈，并且说清楚下一步。** payload 未就绪时，`/` 返回 hub 自己渲染的等待页（同源、无脚本、
`meta refresh` 1 s）：当前阶段、已尝试的来源与各自错误、以及**可以直接复制的绝对投放路径**。文件落位后不需要
重启服务——等待页每秒请求 `/`，hub 在 `phase === "failed"` 时会重新走一遍本地文件检查。

**D5 `sumsUrl` 仍是交叉校验，不参与门禁。** 已校验的本地字节就是可服务的字节；上游清单只用来发现「我们和
上游记的不是同一份」这种异常（0005 D2 不变）。

**D6 只走 HTTPS 与显式 loopback 例外。** 来源 URL 必须是 `https:`；`PHOTOCRAFT_PAYLOAD_URL` 允许 `http:`，
因为它的用途就是内网文件服务。除此之外不引入本地文件协议、不接受目录、不接受通配。

## 4. 后果

- **好处一**：默认安装不再与单一主机同生共死。上游挂了、镜像挂了、代理挂了，都只是少一条来源。
- **好处二**：完全离线的机器可安装、可运行——投放一个文件即可（D2-2）。
- **好处三**：包体不变。多源是代码里的 20 行，不是仓库里的 10.8 MB。
- **代价一**：多一层用户可见的失败状态（`attempts`），以及一条「手动投放」的说明书。这是把不可控的网络故障
  换成一个可控的手工步骤。
- **代价二**：第三方镜像的可用性不在我们控制内，因此它们只能排在 `sources[]` 尾部，且默认清单只放一个
  `ghproxy` 样式的镜像；自建镜像应该走 `payload.json` 的 `sources[]`，而不是往市场源里加更多匿名 URL。
- **代价三**：`PHOTOCRAFT_PAYLOAD_URL` / `PHOTOCRAFT_PAYLOAD_ZIP` 在真实宿主里**不可达**（Observed：宿主只给
  host-node 子进程白名单环境 + `plugin.json` 声明的模板变量，父进程的 `export` 不会传下去）。所以这两个变量
  降级为「手动跑 hub 时的调试入口」，用户可配面统一走 D2-4 的 `payload.json`。

## 5. 证据与未验证

Observed：

- `payload/manifest.json` v1 只有一个 `url`（文件本身）；改后为 `schemaVersion: 2` + `sources[]` + `localFile`，
  `scripts/build-hub.mjs` 强制 `https:` 与 `sources[]` 非空；
- 上游只向 GitHub Release 发布 web 包：`packaging/web/package.sh`、`packaging/web/README.md`、
  `release.yml` 的 web job 与 `sha256sum -- * | tee SHA256SUMS.txt`；
- 打包器白名单与 `presentation/` 收集：`@astravia-org/plugin-vite/dist/pack.js:163-230`；
- 服务制品以 base64 由渲染进程交付、宿主逐份校验 sha256：
  `plugin-sdk/dist/service-provider.d.ts:19-24`、宿主 `plugin-service-runtime-installer.ts` 的
  `Service runtime artifact SHA-256 mismatch`；
- 本机实测 `photocraft-web-0.2.0.zip` = 10,755,523 B、sha256 与钉值一致，raw 下载 0.137 s（本机直连）；
- 两个镜像的 `SHA256SUMS.txt` 均 `200`、1,535 B（`ghproxy.net`、`gh-proxy.com`、`ghfast.top`），`ghproxy.net`
  对 zip 的 `Range` 请求回 `206` + `accept-ranges: bytes`，所以断点续传对镜像也成立；
- 落地后的 hub（`server/hub.mjs` 28,331 B、sha256 `adce1393…e2982`）逐项行为已离线跑过：缓存命中 →
  `source:"cache"` 零网络；只放 `localFile` → `source:"local"`；截断文件 → `sha256-mismatch` 入 `attempts`
  后继续；全部源失败 → `phase:"failed"` 且等待页印出源列表与绝对投放路径；随后投放正确文件并再 `GET /` →
  `ready`（未重启进程）。内联进渲染包的 hub 字节与磁盘逐字节相同（反转义后 sha 相等）；
- 宿主 0.5.86 的服务环境是白名单：`INHERITED_ENV_KEYS`（`PATH`/`HOME`/`LANG`/`TMPDIR`/`npm_config_*` 等 23 键）
  + `process.env` 里的模板展开；`TOKEN_PATTERN` 只认 `${ASTRAVIA_SERVICE_(PORT|RUNTIME_DIR|DATA_DIR|CACHE_DIR|SECRET_*)}`
  （Observed：`main/main-Ces8nWEj.js`；运行中的 hub 子进程实测只拿到这四个变量）。

Inferred：

- 中国大陆无代理网络访问 GitHub Release 的失败率——来自广泛的用户报告，未在本机受限网络复现；
- 第三方 `ghproxy` 样式镜像的可用性——写进清单时它可用，不保证以后可用；sha256 会拦住被改写的字节。

已由宿主取证消解（2026-11-03）：`PHOTOCRAFT_PAYLOAD_*` **不透传**——宿主只给 host-node 子进程白名单环境加
`plugin.json` 声明的模板变量，D2-5 因此只对手动启动的 hub 生效，用户实际可配面是 D2-4 的 `payload.json`。

未验证：
1. 等待页的 1 s `meta refresh` 在真实桌面端里与 wasm 首屏编译配合的实际感受（回环侧已验证「落位即 ready」，
   浏览器侧重载次数未计）。
2. 桌面端是否允许 iframe 内的 `http://127.0.0.1` 页面自行刷新——主窗口无 CSP 的事实已确认（0007 §5），
   但刷新循环本身未在真实窗口里跑过。
