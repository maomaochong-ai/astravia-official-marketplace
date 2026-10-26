/**
 * 宿主环境变量、平台矩阵、载荷来源常量
 *
 * 由 server/src/service.ts 按职责切出（ADR-0012）。
 */
import path from "node:path";
import { fileURLToPath } from "node:url";


export const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- 宿主环境变量 ---
export const HOST_PORT = Number(process.env.ASTRAVIA_SERVICE_PORT);
export const DATA_DIR = process.env.ASTRAVIA_SERVICE_DATA_DIR;
export const RUNTIME_DIR = process.env.ASTRAVIA_SERVICE_RUNTIME_DIR || __dirname;

if (!HOST_PORT || !DATA_DIR) {
  console.error("[open-ai-canvas] Missing ASTRAVIA_SERVICE_PORT or ASTRAVIA_SERVICE_DATA_DIR");
  process.exit(1);
}

// --- 浏览器 origin（ADR-0010）---
// 宿主用 listen(0) 分配服务端口（plugin-service-provider-service.ts 的 allocateLoopbackPort，
// 且服务声明 additionalProperties:false，没有 port 字段可声明），所以每次启动的 origin 都不同。
// 画布把渠道/模型/面板布局写在浏览器 localStorage（zustand persist，键名带 :user:<id>），
// 而 localStorage 按 origin 隔离 → origin 一变，用户配好的模型看起来就“消失”。
// 对策：除宿主端口外，再抢一个固定回环端口作为**浏览器 origin**；宿主端口只负责健康检查
// 与模型桥，导航请求 302 过去。抢不到时退回宿主端口（与改造前一致，只是状态仍会丢）。
export const STABLE_ORIGIN_PORTS = [47810, 47811, 47812, 47813];
export const ORIGIN_FILE = path.join(DATA_DIR, "browser-origin.json");
// PUBLIC_ORIGIN / STABLE_PORT / STABLE_SERVER / REQUEST_HANDLER 定义在 ./origin.ts：
// 它们是「稳定 origin 绑定」的产物，只有那个模块写，别处只读。

// --- 运行时载荷 ---
// 包内只装 boot.mjs（几十 KB 的 shim）；原生后端 + web-dist + 官方插件包压缩后约 200 MB，
// 远超 Desktop 的单包上限，所以首次启动时下载到 DATA_DIR/runtime/<payloadVersion>/ 并校验 sha256。
//
// ADR-0005 决策 4：sha256 不再写死在本文件里。插件包一旦发布就不可变，而载荷随上游版本变化——
// 把 5 个平台、2 类载荷的 sha256 抄进源码，等于每发一次上游都要重发一次插件。改为启动时取
// payload-manifest.json，由它决定「下哪个文件、校验什么值」。
// ADR-0009 部分推翻 ADR-0005 决策 4：来源不再以 GitHub 可达为前提。改成一条链——本地目录
// （本地构建或离线搬运，零网络）→ 镜像前缀（ghfast.top / gh-proxy.com，可换可关）→ 配置基址
// 或官方 Release（并发探测，先到先得）→ api.github.com 资产地址（最后一搏）。国内直连
// github.com 常常 30 秒建不起 TCP，普通用户首启只会看到「请开启代理」——那正是要拆掉的墙。
// 但“本地”不等于“打进包里”：单平台载荷约 215 MB，市场包解压上限 100 MB，装不下。
export const OFFICIAL_BASE =
  "https://github.com/maomaochong-ai/astravia-official-marketplace/releases/download/plugin-open-ai-canvas-payloads";
// 镜像把当前基址原样包一层（`<prefix><基址>`），由境内 CDN 回源；包的是基址而不是写死的
// github.com，所以把 CANVAS_PAYLOAD_BASE_URL 指向自建目录时，镜像链依旧成立。
// 2026-10-25 实测：这两个前缀对 130 MB 载荷都回 206 + Content-Range，续传可用；
// 不可达的镜像只白等一次并发探测，不会挡住排在后面的来源。
export const DEFAULT_MIRROR_PREFIXES = ["https://ghfast.top/", "https://gh-proxy.com/"];
// 显式基址（自建镜像、离线自测）优先级高于所有远程来源，语义与改造前一致。
export const PAYLOAD_BASE_URL = process.env.CANVAS_PAYLOAD_BASE_URL || OFFICIAL_BASE;
// 部分网络里 github.com 的 TCP 建不起来，但 api.github.com 与它 302 到的
// release-assets.githubusercontent.com 可达。API 解析降级为兜底来源，不再每次先花 12 秒。
export const GITHUB_REPO = "maomaochong-ai/astravia-official-marketplace";
export const RELEASE_TAG = "plugin-open-ai-canvas-payloads";
export const MANIFEST_ASSET = "payload-manifest.json";
// 清单探测成功后记住这条基址，归档优先从同一条来源取：能列出清单的地方通常也能下文件。
// PREFERRED_BASE 定义在 ./sources.ts：探测成功的镜像前缀，只有来源链自己回写。

// 申报平台集合（ADR-0005 决策 7）。宿主按 `${platform}-${arch}` 精确查
// plugin.json#providers.services[0].runtime.platforms，查不到就等于该平台没有运行时，
// 所以这份键集必须与清单一致：scripts/check-service-platforms.mjs 在构建期比对两处。
// 真正的载荷差异在清单里——这里只回答「这个平台有没有被发布」。
export const TARGET_PLATFORMS = ["win32-x64", "darwin-x64", "darwin-arm64", "linux-x64", "linux-arm64"];

export const PLATFORM = `${process.platform}-${process.arch}`;
export const BINARY_NAME = `yingce-backend${process.platform === "win32" ? ".exe" : ""}`;
export const NODE_BINARY_NAME = process.platform === "win32" ? "node.exe" : "node";
export const BUNDLED_DIR = RUNTIME_DIR;

// 清单解析结果。落盘目录由清单里的 payloadVersion 决定，所以这三个量要等 loadManifest 之后才有值。
export const MANIFEST = { payloadVersion: "", upstream: null, platforms: {}, source: "" };
// PROVISION_DIR / AGENT_DIR 定义在 ./sources.ts：它们由清单里的 payloadVersion 算出。

export function supportedPlatforms() {
  const fromManifest = Object.keys(MANIFEST.platforms);
  return (fromManifest.length > 0 ? fromManifest : TARGET_PLATFORMS).sort();
}
