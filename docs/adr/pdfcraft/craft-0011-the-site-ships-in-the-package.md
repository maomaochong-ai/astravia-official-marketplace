# 站点随包分发：用上游自己的源码构建，不用上游的 zip

> **已作废**（2026-11-04）：CI 不再用上游源码现编站点，改为直接取上游发布的那份 web 包（十五支全部具备），
> 并把摘要钉进 manifest。
> 现状见 [craft-0012](craft-0012-the-site-is-upstreams-release-bundle.md)。以下是当时的判断留痕。

- 状态：已采纳（2026-11-04）。取代 [0006-payload-pin](0006-payload-pin.md) 与
  [craft-0003](craft-0003-first-open-is-a-preparation-not-a-failure.md) 里的下载链路。
- 相关：[craft-0001](craft-0001-seven-copies-and-a-parity-test.md)、
  [craft-0007](craft-0007-chinese-comes-from-the-shell.md)、[craft-0008](craft-0008-one-container-per-app.md)

## 问题

面板里跑的必须是**上游那个编辑器**，界面、菜单、工具、快捷键和上游官网截图一致。前后两版实现都
没做到"既要原汁原味、又不走上游打包好的 zip"：

1. **上一版**：`payload/manifest.json` 钉住上游 Release 的 `*-web-<version>.zip`，第一次打开时下载、
   校验 sha256、解压进内存，由 `server/hub.mjs` 起一个 loopback HTTP 服务把文件发出去。
   问题不在"是上游"，而在三条代价：一个常驻 Node 进程（15 支同开就 15 个）、首次打开要先下 13–73 MB、
   换一版就得等上游发版（上游没发版就只能是旧版）。
2. **更早一版**：干脆自己写一套内核去模仿编辑器。那不是上游，界面必然对不上，方向就是错的。

要求因此是：**上游的真实代码，上游自己的构建方式，但不是上游的 zip。**

## 决定

### 一、站点由 CI 用上游源码构建

`payload/manifest.json` 从"制品清单"变成"来源清单"（schemaVersion 3）：

```json
{
  "schemaVersion": 3,
  "slug": "designcraft",
  "site": "web",
  "upstream": "https://github.com/storytold/designcraft",
  "release": "0.16.0",
  "commit": "81cca513ba31…",
  "webApp": "apps/designcraft-web",
  "build": { "recipe": "trunk" },
  "builtBy": "scripts/build-craft-web.mjs"
}
```

CI 用 `scripts/build-craft-web.mjs`：把仓库 checkout 到那个 **40 位 commit**，然后按上游
`packaging/web/package.sh` 自己的配方构建——配方不止一种，`build.recipe` 写明是哪一种：

| recipe | 谁是这种 | 上游的做法 |
| --- | --- | --- |
| `trunk` | 十一支 | `apps/<app>-web` 里 `trunk build --release` → `dist/web` |
| `trunk-boot` | photocraft | 两个 trunk crate：构建 `photocraft-web`，再把 `photocraft-web-boot` 的页面作为站点根，app 的 wasm 用 gzip 分包放进 `app/`，`app/parts.txt` 列名 |
| `xtask` | effectcraft / filmcraft / lightcraft | 仓库根的 `cargo xtask web`：cargo → wasm-bindgen CLI（0.2.129）→ 可选 wasm-opt → `<target>/web/dist`（lightcraft 是 `web-site`） |

产物复制到 `abilities/plugins/<slug>/web/`。git 里没有 `web/`（gitignore），它只存在于打包前一刻。

两支细节：

- **lightcraft 的中文字形是站点里的一个独立文件**，`cargo xtask web` 只在 `CRAFT_FONTS_DIR` 存在时才把
  `lightcraft_zh_hans.otf` 复制进去（缺失时它报 `CRAFT_FONTS_REQUIRED is set but CRAFT_FONTS_DIR is missing`）。
  所以 `build.fonts` 钉住 craft-fonts 的 commit，构建脚本 checkout 它并导出那两个环境变量——与上游
  `packaging/fonts.sh` 同一套做法，只是不靠 release zip。
- **它的站点还带 `*.wasm.gz` / `*.wasm.br`**（给会做 `Content-Encoding` 协商的服务器用）。插件协议只送原始
  字节，页面直接 `compileStreaming(fetch(…))`，这两份副本用不到；而且已经压过的内容在包里不会再小——
  构建脚本按 `skipPrecompressed` 删掉它们，这一步省掉的是几十 MB。

于是"钉住什么"从一份 zip 的 sha256 变成**一个上游 commit**：源码级可复现，比二进制制品更严，
也让"上游还没发版"不再阻塞我们跟进它的 main。

### 二、字节怎么进到面板里：`srcdoc` + `<base>` + `replaceState`

宿主用 `astravia-plugin://<id>/versions/<version>/…` 发插件文件，但它的 MIME 表里**没有 `.html`**
（`plugin-protocol.ts` 的 `contentTypeForPath`，Observed）——`application/octet-stream` 的 iframe
导航不会执行脚本，只会下载。所以：

1. 面板 `fetch` 包内 `web/index.html` 的**文本**；
2. 在 `<head>` 最前面注入 `<base href="astravia-plugin://<id>/versions/<v>/web/">`，相对路径的
   `./app.js`、`./*_bg.wasm`、`snippets/` 才落到包里；
3. 紧接一段 `history.replaceState(null, "", "<同一个 URL>?nosw&hl=zh&webgl")`。`about:srcdoc`
   本身没有 URL，上游用 `new URL("…_bg.wasm", location.href)` 找 wasm、用 `location.search`
   读降级标志，没有这一步两者都会拿到 `about:srcdoc`；
4. 语言与偏好种子（原 hub 的 `PREFS_SEED_JS` / `LOCALE_SEED_JS`，逻辑一字未改）；
5. `</body>` 前内联 `src/bridge/host-bridge.js`，顺序与 hub 时代一致；
6. `<iframe srcDoc={html} key={nonce+mode}>`。

在 Electron 34.5.8（宿主同版本）里实测（Observed，一个最小复现页 + 同样的 `registerSchemesAsPrivileged`
与 `protocol.handle`）：`srcdoc` 文档 `isSecureContext === true`、`localStorage` 可写、`navigator.gpu`
存在、自定义 scheme 的 `fetch` 通、`WebAssembly.instantiate` 通、ES module 通，`replaceState` 之后
`location.search === "?webgl"` 且 `location.href` 就是那个真实插件 URL。

同一轮还量了上游真正用得着的那几样，结论全都是"能用"：

| 能力 | 结果 |
| --- | --- |
| `new Worker("./worker.js")` | 起得来，`self.location` 是 `astravia-plugin://…/web/worker.js` |
| `AudioContext.audioWorklet.addModule("./audio-worklet.js")` | 成功（effectcraft 的音频链靠它） |
| `WebAssembly.compileStreaming(fetch("./x.wasm"))` | 成功——宿主给 `.wasm` 的 MIME 正是 `application/wasm` |
| `crossOriginIsolated` / `SharedArrayBuffer` | **false / undefined**，没有跨源隔离 |

最后一行是这条路的硬边界：需要 wasm threads（`+atomics` + SAB）的构建跑不起来。十五支里没有一支是
多线程 wasm——十五个仓库的 `Cargo.toml` / `Trunk.toml` / `.cargo/config.toml` 里没有一处 `+atomics`，
也没有 `wasm-bindgen-rayon`（Observed）。lightcraft 的渲染 worker 是"每个 worker 各跑一份 wasm 实例"，
`apps/lightcraft-web/src/workers.rs` 开头就写明它不需要 shared memory，样例起不来时还会退回主线程内联执行。
所以现在不是问题；将来上游若真上多线程，这里要重新设计，而不是调一个参数。

### 三、于是没有服务进程

`plugin.json` 的 `providers.services` 整块删除，`server/`、`scripts/build-hub.mjs`、`src/runtime.ts`
一并删除。打开面板就是读一个包内文件 + 一次字符串拼接，没有冷启动、没有端口、没有下载进度页。
十五支同开也不再是十五个 Node 进程——这正是"[craft-0004](craft-0004-inactive-tabs-stop-drawing.md)
那条暂停闸门之外，第二个真正的性能来源"。

## 代价与边界（都实测过，不是猜测）

- **制品上限 50 MB**：宿主 `marketplace-plugin-artifact.ts` 的 `MAX_PLUGIN_ARCHIVE_BYTES = 50 * 1024 * 1024`。
  上游 web 构建压完通常 3–33 MB，但 lightcraft 的 release zip 就有 73 MB，本轮因此不发它。
- **service worker 不注册**：自定义 scheme 下 `navigator.serviceWorker.register` 必然失败，
  所以 URL 里恒带 `nosw`；effectcraft 的注册本来就在 `try/catch` 与 `.catch()` 里，失败无声。
- **上游自带的 `location.replace` 重试**（filmcraft 的 WebGPU 失败分支）在 `srcdoc` 下会导航到
  octet-stream 的插件 URL，那一次重试失效；外壳自己的 `auto → webgl → cpu` 阶梯仍然兜底。
- **`?cpu` 不是上游的标志**：上游只认 `webgl`（`materialcraft-web/src/web.rs` 的 `query()`）。
  外壳保留 `cpu` 这一档只作为"再失败就不带标志重开"的语义，不宣称上游识别它。

## 不做的事

- 不把上游 zip 下载回来当"另一条路"：那正是这一版要移除的东西。
- 不在包里放第二份引擎、也不改上游一个字节：站点是上游自己那套构建的原始产物，
  面板只在 HTML 文本外面注入上面那几行。
- 不改宿主（`open-astravia`）去给 `.html` 加 MIME：宿主只读，这条路必须由插件侧走通，已经走通了。
