# ADR 0010：payload 钉到上游 0.19.0，缺陷从上游修，不从我们这边补

> **已作废**（2026-11-04）：站点不再从上游 Release 下载，改为由 CI 用上游源码构建并随包分发。
> 现状见 [craft-0011](craft-0011-the-site-ships-in-the-package.md)。以下是当时的判断留痕。


- 状态：已接受（2026-11-03）
- 关联文档：[0005](./0005-payload-provenance-and-runtime-gate.md)、[0008](./0008-payload-never-depends-on-one-host.md)、[0011](./0011-chinese-default-comes-from-the-shell.md)

## 1. 背景

`0.0.3` 钉的是上游 `v0.2.0` 的 web 包。两条用户反馈都落在**编辑器界面内部**，而界面是上游用 egui 画的，
插件这层只能改注入、改外壳，改不到任何一个按钮：

1. 侧边栏顶端的 `»` 箭头「展开异常」；
2. 界面只有英文（`0.2.0` 的 `crates/ui-egui/src/i18n/` 里只有 `ja.tsv`，中文 catalog 根本不存在）。

按 0001 的立场，编辑器的代码我们不改。所以问题变成：**要么上游已经修了，我们换版本；要么这件事做不成。**

## 2. 取舍

### A. 自己构建 wasm（否决）

`wasm32-unknown-unknown` 装了，但 `trunk`/`wasm-bindgen` 没有；自建意味着引入一条我们不掌控的构建链，
而且为了让中文出现，还要往上游 crate 里塞代码——这正是 0001 拒绝的形态。构建产物与官方包会长期分叉。

### B. 在父文档里给 iframe 打补丁（否决）

egui 把整个界面画在一张 `<canvas>` 里，没有可供父文档改写的 DOM。`postMessage` 也进不到 Rust 的绘制循环。

### C. 换上游版本（选定）

`v0.19.0` 同时满足两件事，且都是官方发布物：

- **箭头**：`crates/ui-egui/src/panels/toolbar.rs:88-103` 把那一块改成
  `ui.allocate_exact_size(vec2(bx, 14.0), Sense::click())`，点击翻转用户偏好 `panels.toolbar_double`，
  图标在 `shrink`/`grow` 之间切换、hover 变色，并带 `WidgetInfo::labeled(Role::Button, true, "Toolbar")`。
  而我们钉的 `0.2.0` 在 `crates/ui-egui/src/panels.rs:64-70` 是 `Sense::hover()` —— **它压根不是按钮**，
  `double` 由 `toolbar_needs_double(slots, sections, bx, pro, avail_h)`（`panels.rs:237`）按可用高度自动翻转。
  用户点它没反应、它自己却会变，这就是「异常」。
- **语言**：`crates/ui-egui/src/i18n.rs` 的 `LANGUAGES: [LangInfo; 27]`，其中 `zh-hans`（`简体中文`，
  `complete_menus: true`）的 catalog 是 `crates/ui-egui/src/i18n/zh-hans.tsv`，125,869 B。

## 3. 决策

**D1 pin 是上游 `v0.19.0` 的官方 web 包，不自建、不 fork。**
`payload/manifest.json` 记 `version:"0.19.0"`、`size:13433636`、
`sha256:"74047f06da706c5b7c9dee77e05379a0928c52b5a7ea1e821e55c69851b0bd01"`，
源仍是 `upstream` + 一个镜像（0008 的结构不变，只换主机上的文件名与清单）。

**D2 用户可见的修理由上游版本提供，插件不写兼容代码去模仿它们。**
箭头是原生控件了；中文是官方 catalog。插件这边只负责把这两个能力**打开**（箭头靠版本、中文靠 0011）。

**D3 官方包自己起不来，hub 补一条路径别名。**
`app/photocraft-web.js` 顶部是
`import { egui_text_agent_activate } from './snippets/eframe-d31a8450ea12dfc1/inline0.js'`，
即按模块 URL 解析成 `app/snippets/eframe-d31a8450ea12dfc1/inline0.js`；而 `packaging/web/package.sh:59-62`
只 `cp -R "$BOOT/."` 到站点根、再 `cp "$GLUE" "$WORK/$NAME/app/photocraft-web.js"`——**app 侧的 `snippets/`
目录从未被复制**。于是整张 ES 模块图在 import 处断掉，页面永远停在 `Loading PhotoCraft…`
（Observed：`wasmBindings` 为 `undefined`、`<canvas>` 停在默认 300×150、控制台 404 指向上面那个 URL）。

hub 的 `resolveEntry()` 因此多一条规则：`app/snippets/<rest>` 找不到时，用 `snippets/<rest>` 的同一份字节作答。
**不做字节改写，不重打包 zip**；`app/parts.txt`、`.wasm`、SRI 都不受影响。这是路径层面的兼容，
清单里仍然是官方的 13,433,636 B / 同一个 sha256。

**D4 0.19 的加载方式变了，但 0007 的假设没变。**
新包把 wasm gzip 后切成 `app/*.part-aa`（13,328,607 B），由根目录的 boot 模块拼起来；`_bg.wasm`（102,668 B）
承载 boot 自身。实测确认：分片用的是普通 `fetch`，**不依赖 `Range`**（js 里所有 `Range` 命中都是 WebGL API）；
仍不需要 COOP/COEP；`index.html` 带 `integrity="sha384-…"` 的 preload，hub 不压缩、不改写，所以 SRI 成立。

**D5 注入点保持两个位置，且都必须是纯插入。**
`<head>` 之后写语言种子（0011），`</body>` 之前写 bridge。0.19 的 `index.html` 结构变了
（`<head>` 里直接是 `type="module"` 的内联启动代码），所以「先于所有脚本」这个约束变成了硬要求：
seed 必须在 `<head ...>` 闭合尖括号之后、上游 module 之前。

## 4. 后果

- **好处一**：两条用户反馈都变成「换版本」，插件代码里没有一行去模仿上游控件。
- **好处二**：中文、RTL 支持、以及后续 26 种语言的 catalog 都在同一份官方字节里。
- **代价一**：体积从 10,755,523 B 涨到 13,433,636 B（仍是 100 MB 解压上限内的小零头），
  首次启动的下载与解包多几秒。
- **代价二**：多一条路径别名（D3）。上游一旦修好打包脚本，这条规则就退化成死代码——留一条注释说明来由，
  不删，因为旧缓存里仍可能有 0.19.0。
- **代价三**：`app/photocraft-web.js` 的 glue 与 `_bg.wasm` 变成两份 wasm 相关的文件，
  0005 里「一个 `.wasm`」的说法需要按 0.19 更新。

## 5. 证据与未验证

Observed（本机，2026-11-03）：

- `v0.19.0` 的 `photocraft-web-0.19.0.zip` 下载后为 13,433,636 B，sha256 与钉值逐字一致；19 个条目，
  单一顶层目录。
- 条目：`app/photocraft-web-<hash>.part-aa` 13,328,607 B、`app/photocraft-web.js` 179,066 B、
  `photocraft-web-boot-<hash>.js` 26,999 B、`photocraft-web-boot-<hash>_bg.wasm` 102,668 B、
  `index.html` 2,527 B、`app/parts.txt` 59 B、`_headers` 704 B、`snippets/…/inline0.js` 280 B。
- 别名生效前：`/app/snippets/eframe-d31a8450ea12dfc1/inline0.js` → 404，`typeof window.wasmBindings === "undefined"`，
  `#photocraft_loading` 仍可见，canvas 300×150。
- 别名生效后：`wasmBindings` 为 object、canvas 2206×1152、界面出现中文菜单（`文件(F) 编辑(E) 图像(I) 图层(L) …`）。
- 箭头：在 (20,78) 点一下后 `localStorage["photocraft.preferences"].panelLayout.panels.toolbar_double`
  从 `false` 变 `true`——它现在真的可点、且是用户偏好；0.2.0 的同一位置在源码里没有点击语义。
- 上游 `main` 的 `packaging/web/package.sh` 仍然只复制 glue，D3 的缺陷未被修。

未验证：

1. 13.3 MB 的 `part-aa` 在宿主 Electron 里从取回到实例化完成的耗时；
2. 旧版本缓存（`0.2.0` 的 zip）在用户数据目录驻留时，hub 的 `adopt()` 是否会按新 sha 正确拒绝并重新下载
   （按 0008 D3 应当拒绝，但未在真实升级路径上实测）；
3. `?webgl` / `?cpu` 两个降级开关在 0.19 里仍然存在（源码里 `query()` 分支未变），但未逐个实机跑过。
