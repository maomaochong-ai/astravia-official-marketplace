# 标签页里跑的是上游自己的 web 构建

- 状态：已采纳（2026-11-04）
- 相关：[0002](0002-bytes-move-through-the-host.md)、
  [0005](0005-the-agent-drives-the-canvas.md)、[0009](0009-one-batch-instead-of-one-click.md)

## 问题

要把 Excalidraw 放进 Astravia，最"顺手"的路是照着它长什么样再写一个：一块 canvas、一堆图元、
一个工具条。这条路一定失败，而且失败得很晚——面板里看起来像了，用户一用就发现曲线没有压力、
文本编辑不是同一个、素材库不存在、粘贴进来的图不是同一个格式。手工模仿永远追不上上游，而它的
价值恰恰在那些细节里。

## 决定

插件不做编辑器。它做的是一层壳，壳里跑**上游自己的 `excalidraw-app` 构建**：

1. `payload/manifest.json` 钉住上游仓库与一个 40 位 commit
   （`https://github.com/excalidraw/excalidraw`，当前 `dd2f8fc32b92cbf56f4abee6a0cf3b14681b4b55`）；
2. `abilities/plugins/excalidraw/scripts/build-excalidraw-web.mjs`（配方归插件自己所有，不放在仓库根的
   `scripts/`）从那个 commit 取源码、装依赖、用一份**包装配置**
   （`vite.astravia.config.mts`：import 上游默认导出、摘掉 PWA / sitemap / checker 三个插件、
   `base: "./"`、关掉 sourcemap）跑一次上游自己的 `vite build`；
3. 产物落到 `abilities/plugins/<slug>/web/`（gitignore，只在构建/打包期间存在）；
4. 标签页把 `web/index.html` 读成字符串，拼成一份文档交给 `<iframe srcDoc>`：前面插
   `<base href>` 与一段垫 `history.replaceState` / 语言的脚本，末尾插 `host-bridge.js`。

编辑器界面里没有一个像素是我们画的，交互没有一条是我们重写的。

## 为什么不是 `src` 直接引上游包

`@excalidraw/excalidraw` 是个 React 组件库，直接引进来意味着我们得自己搭应用壳（工具栏、菜单、
导出、素材库、协作入口），那圈东西也是上游 `excalidraw-app` 的一部分——漏掉哪个，界面就对不上。
整站构建把这个风险压成零：跑起来的就是上游发布渠道里那个应用，只是资源前缀变了。

## 我们对上游字节做了什么

只有下面几件，都能在 `abilities/plugins/excalidraw/scripts/build-excalidraw-web.mjs` 里逐条读到：

- **构建期**：包装配置替换掉上游的 vite 配置（`base: "./"`、去掉 PWA/sitemap/checker、
  sourcemap 关、把 `browser-fs-access` 别名到 legacy 实现——原因见
  [0002](0002-bytes-move-through-the-host.md)）。上游源码一行不改；`web/` 里的 JS 就是它
  自己编译出来的 JS。
- **构建期（API 接缝）**：`@excalidraw/excalidraw` 的包根被别名到配方生成的
  `astravia-excalidraw-api.tsx`。那个文件 `export *` 上游包根，只包一层
  `ExcalidrawAPIProvider`，把应用自己创建的 API 对象发布到页面全局——因为上游从不把这个对象
  放到 `window` 上（细节见 [0005](0005-the-agent-drives-the-canvas.md)）。配方断言产物里
  必须出现那个全局名，没接上就失败。
- **后处理**：`index.html` 里 `EXCALIDRAW_ASSET_PATH` 指向 CDN 的那段被改成
  `document.baseURI`，CDN 的 preload 与 CSS 里的 CDN `url()` 改回包内相对路径；删掉
  `_headers`、`sw.js`、`manifest.webmanifest`、`workbox-*`；整段删掉 Simple Analytics 的
  内联加载器。最后这条不是洁癖：包必须能离线跑，而那段脚本会在加载后向外发一个
  pageview，且它的 iframe 分支引用了一个上游没定义的 `action`，帧里必然 `ReferenceError`。
  配方对它做了前后两份断言——找不到要删的段就红，删完还残留域名也红。

所以**不要**对外说"逐字节原样"：JS 是上游编译出来的、没有改动，但页面资源路径被调整过，
PWA 注册与统计脚本被剥离了。诚实表述是「编辑器本身是上游自己的构建，JS 未改动，页面资源
路径被调整为可在包内运行」。

## 为什么站点走 `srcDoc` 而不是导航进去

- 宿主把插件装在 `astravia-plugin://` 下，导航进另一个源会丢掉 `postMessage` 的直连关系，
  还要处理跨源策略；`srcDoc` 让文档与桥同源，`event.source === iframe.contentWindow` 就能成立。
- 站点要能在任意前缀下加载，所以 `base` 由壳在运行期按包根算出来（`packageRoot()` 从
  `import.meta.url` 或 `performance.getEntriesByType("resource")` 里取到
  `…/versions/<v>/`），不写死。
- PWA 注册在 `about:srcdoc` + `astravia-plugin://` 下必然失败，所以在**构建期**摘掉
  `vite-plugin-pwa`，而不是在运行期 try/catch 一个注定失败的调用。

## 为什么壳要手动把 `referrer` 清空

上游 `excalidraw-app/App.tsx` 开头有一段自嵌入防护：帧里运行时比较
`document.referrer` 与 `location.href` 的 origin，相同就认定"自己嵌了自己"，
直接 `return <h1>I'm not a pretzel!</h1>`，不渲染编辑器。

在两个非标准 scheme 下这段判定会误命中：`about:srcdoc` 与 `astravia-plugin://…` 的
origin 都是字符串 `"null"`（`new URL("about:srcdoc").origin ===
new URL("astravia-plugin://a/b").origin` 实则为 `true`）。于是宿主里一个完全正常的单层
嵌入被判成递归嵌入，页面永远停在那一行标题。

壳的做法是在文档最前面把 `document.referrer` 定义成恒为 `""`：上游紧接着的
`new URL("")` 抛 `TypeError`，落进它自己那个"不是自嵌入"的 `catch` 分支。定义在
`document` 实例上，不碰 `Document.prototype`，也不改任何字节。

这条不是理论推演：本机用同一份产物做过对照——帧里出现 `I'm not a pretzel!` 时
canvas 数为 0，加上这段 seed 后 1.2 秒内出现 `canvas.excalidraw__canvas.interactive`。

## 代价

- 站点 ~20 MB（含上游 230 个字体引用、Xiaolai 手写体 12 MB），打包后 ~16.5 MB。在
  `scripts/stage-plugin-release.py` 的 50 MB 上限内；仓库归档里没有它（gitignore）。
- 打包时要跑一次上游构建（本机热缓存约 55 s，CI 冷缓存分钟级）。excalidraw 是纯前端项目，
  没有 wasm、没有 rust 工具链，因此不会出现 craft 家族那种"单支几十分钟"的量级。
- 上游 commit 一动，字体路径、`EXCALIDRAW_ASSET_PATH` 的写法都可能变。构建脚本里的断言
  （相对路径、无 CDN 主机、字体引用 > 0 且文件齐全）就是为这件事准备的：宁可在构建期红，
  也不要发一个字体静默回退到 esm.sh 的包。

## 不做的事

- 不重写编辑器内核，也不把上游组件拆开重新拼装。
- 不修改上游源码树里的文件；本地验证用副本（`/tmp/excweb/src`），不污染用户的 clone。
- 不用运行期打补丁去"绕过"一个注定失败的调用——能删的（PWA、统计）在构建期删，
  必须改变的（语言、自嵌入判定、文件选择器）用能解释通的最小手段。
