# ADR 0001：把 Tampermonkey 的「页面内提取」收窄成 Adapter 层，解析路径三态化

- 状态：提议（2026-11-01）
- ⚠️ §2「插件不内置任何站点脚本」已由 [ADR 0003](./0003-builtin-adapters-supersede-0001.md) 超替（2.6.0 起随插件发布三个只读内置适配器）；其余章节仍然有效。
- 决策对象：`abilities/plugins/video-downloader`（2.4.0 → 2.5.0）
- 参照对象：Tampermonkey（Jan Biniok，GPLv3）`src/{parser,background,content,curtain,options,action,fire,notification}.js`、`src/cm/`、`i18n/`
- 关联文档：[CONTEXT.md](./CONTEXT.md)（术语）、[ADR 0002](./0002-panel-information-architecture.md)（面板重构）、[hanshuang-pojia ADR 0002](../hanshuang-pojia/0002-external-process-bridge.md)（同一手法：先证明宿主通道存在，再决定取舍）

## 1. 背景

插件目前的能力边界是清楚的：Engine（yt-dlp）解析 + 下载，53 条 Site Capability 解释失败，
Direct Media 旁路，Cookie 三层，代理分流。2.4.0 之后这条链路本身没有已知缺陷。

失败样本说的是另一件事。以下四条来自实测，不是推测：

| Source URL 形态 | Engine 结果 | 页面里有没有可播地址 |
| --- | --- | --- |
| 小红书笔记 | 提取器存在，`No video formats found!` | 有，在页面注入的初始状态里 |
| 快手作品 | `Unsupported URL`（无提取器） | 有，经 GraphQL 返回后写进播放器 |
| 好看视频 | `Unsupported URL`（无提取器） | 有，`/videoui/api/videoplay` 返回 |
| 抖音作品 | 403，需要 `a_bogus`/`msToken` 签名 | 有，但取用需要页面自己的签名上下文 |

四条的共同点不是「下载不了」，而是**取不到地址**。下载、转码、合并、落盘这条链路对它们全都可用。

Tampermonkey 解决的就是这一类问题：脚本在页面自己的 JS 环境里跑，页面的私有接口、全局变量、
鉴权上下文对它是可见的。本 ADR 决定把这个能力收窄后接进插件，而不是把 Tampermonkey 搬进来。

## 2. 参照对象盘点

按代码取证，Tampermonkey 由七个子系统构成（行数为该文件规模，非本次改动量）：

| 子系统 | 证据 | 对「解析下载」的价值 |
| --- | --- | --- |
| 元数据解析 | `src/parser.js`：`@name` `@namespace` `@version` `@description` `@author` `@icon` `@homepageURL` `@include` `@match` `@exclude` `@require` `@resource` `@run-at` `@grant` | 高。`@match` 是「这段代码负责哪些地址」的现成语法 |
| 页面内运行时 | `src/content.js` + `src/background.js` 分发 | 高。这是能力本体 |
| GM_* 桥 | 公开 API 20 个：`xmlhttpRequest` `getValue` `setValue` `deleteValue` `listValues` `addValueChangeListener` `removeValueChangeListener` `info` `log` `notification` `openInTab` `setClipboard` `registerMenuCommand` `getResourceURL` `getResourceText` `addStyle` `getTab` `saveTab` `getTabs` `installScript` | 中。只有 4 个与提取有关，其余服务「常驻脚本」这个前提 |
| 沙箱隔离 | `src/curtain.js` | 低。宿主离屏窗口本身已是隔离环境 |
| 编辑器 | `src/cm/`（CodeMirror + jslint + formatting + searchcursor） | 低。为「写几百行脚本」服务，适配器是单函数 |
| 更新分发 | `src/background.js:814 checkUpdate`、`:2035 downloadURL`、`server/update.php` | **负**。插件已在市场内更新，再开一个更新源就是第二条供应链 |
| 交互表面 | `src/options.html`、`action.html`、`notification.js`、`fire.js` | 中。信息架构可借用，组件不复用 |
| 云同步 | `src/syncinfo.js` | **负**。宿主无同步通道，用户数据不出本机 |

窗口期结论：Tampermonkey 的十项能力里，与「一次性把地址取出来」直接相关的只有前三项。
其余七项都建立在「脚本常驻用户浏览器、跨会话、跨设备」这个前提上，而这个前提在插件里不成立。

## 3. 三个候选形态

### 通道 A：完整移植 userscript 运行时（否决）

做法：复刻 `content.js` + GM_* 20 个 + 沙箱 + 注入生命周期 + 更新分发。

否决理由（三条独立证据）：

1. **没有注入通道。** 宿主的浏览器能力是 `PluginBrowserApi`（会话 + `snapshot`/`act`/`readText`）与
   `PluginCaptureApi.offscreen`（一次性页面抓取），两者都不是「在用户正在浏览的标签页里常驻」。
   `browser.sessions.create({ source: "attach" })` 附着的是插件自己的会话，不是用户的标签页生命周期。
2. **GM_* 有一半无法落地。** `GM_openInTab` `GM_addStyle` `GM_notification` `GM_setClipboard`
   `GM_registerMenuCommand` `GM_installScript` 都以「脚本活在浏览器里」为前提，插件侧没有对应物；
   实现它们等于在面板里重建一套浏览器 UI。
3. **会引入第二套更新与信任链。** 用户脚本一旦能 `@require` 远程 URL、能自更新，插件的代码边界
   就从「市场审核过的包」退化为「运行时可变的脚本」。这与市场「同版本运行内容不可变」的发布规则冲突。

### 通道 B：纯声明式提取规则（部分否决）

做法：适配器是一份 JSON（`urlPattern` + 若干 `steps`：选择器、正则、JSONPath），不含代码。

优点是没有执行任意代码的面。否决理由是表达力不足，四个实测样本里三个过不去：

- 快手要先等播放器把 `window.__APOLLO_STATE__` 填上，纯声明式表达不了「等一个变量出现」。
- 抖音的地址需要页面自己算的签名参数，声明式无法调用页面函数。
- 小红书的多图/视频混排在 JSON 里，需要按条件分支挑选。

保留它的价值：作为 Adapter 的**元数据形态**（`@match` 与输出映射用声明式），只有取值那一步是代码。

### 通道 C：Adapter 层——声明式元数据 + 单函数脚本 + 宿主受控执行环境（选定）

做法：

- Adapter = 元数据（`@name` `@version` `@match` `@grant` `@description`）+ 一个提取函数体。
- 执行环境 = `ctx.capture.offscreen()` 的 `prepareScript` / `probeScript`（宿主既有能力，见第 5 节）。
- 产物 = 一个 Media Item，字段与 Engine 产物完全一致，走同一条下载链路。

选它的理由是它把 Tampermonkey 的能力**收敛到一个可审计的最小面**：一次 Run、一个页面、一个 JSON 返回值。
没有常驻、没有自更新、没有跨站作用域。

## 4. 领域模型与解析路径

术语定义见 [CONTEXT.md](./CONTEXT.md)。本 ADR 只固定一条结构决策：

**一个 Media Item 必须能回答「它是被哪条路径解析出来的」**，取值三选一：

| Extraction Path | 何时走 | 现状 |
| --- | --- | --- |
| `engine` | Site Capability 有提取器且未标记上游坏 | 已有 |
| `adapter` | 无提取器、或 Engine 解析失败、或站点标记 `engine-missing` | 本 ADR 新增 |
| `direct` | Source URL 本身就是媒体文件（Direct Media） | 已有 |

两条硬约束：

1. **一个 Media Item 只有一条 Extraction Path。** 不允许「engine 拿一半、adapter 补一半」——
   混合产物会让 `failureCode` 无法归因，也让用户无从判断该报告哪一层。
2. **Adapter 永不下载。** 它只回答「地址在哪」。下载只有一条链路：Engine 的 runner。这条约束
   是「代码不冗余」的全部来源——不需要第二套 HTTP 下载器、第二套进度上报、第二套落盘逻辑。

优先级：`direct` > `engine` > `adapter`。理由是最便宜的路径优先：Direct Media 一次 HEAD 就能确认；
Engine 是一个成熟二进制；Adapter 要拉起一个 Chromium 页面，是三者里最贵的。

## 5. 执行环境的证据与边界

宿主的 `PluginCaptureApi`（`node_modules/@astravia-org/plugin-sdk/dist/capture.d.ts`，SDK 0.3.11）原文要点：

- `url`：目标页面地址，**仅允许 http(s)**。
- `prepareScript`：页面加载完成（或复用窗口）后**注入执行**的脚本。
- `readyExpression`：就绪表达式，宿主轮询到真值才继续。
- `probeScript`：在就绪 + 静置之后对页面求值，**结果经 `JSON.stringify` 回传**；求值抛错或不可序列化时
  `probe` 为 `undefined`，不影响截图。
- `sessionKey`：同 key 复用同一个离屏窗口，url 未变时跳过重新加载，SPA 可用 `prepareScript` 做路由切换。

这条 API 的设计意图写在注释里（"如插件自己 spawn 的本地 dev server"），把它对准第三方站点属于
**超出原始设计意图的用法**。因此本 ADR 附三条自律约束，不依赖宿主校验：

1. **地址白名单来自 Adapter 自己的 `@match`**，运行前在插件侧校验 Source URL 命中才发起抓取。
2. **Adapter 只能本地导入或内置**，运行时不得从网络拉取脚本正文。导入路径写入 `ctx.storage`。
3. **单次 Run 只抓一个页面**，执行完即 `releaseOffscreen(sessionKey)`，不做跨站串联。

能力可用性是**可选**的：`context.d.ts:66` 是 `capture?: PluginCaptureApi`，因此必须按运行时探测处理
（`ctx.capture` 缺失 → Adapter 入口隐藏、Site Capability 标注 `adapter-unavailable`）。这条决定
**不抬高 `minAppVersion`**（当前 `0.5.59`），代价是旧宿主上看不到 Adapter 视图，收益是不阻塞老用户升级。

### 待验证的假设

标注 **Assumed**，落地前必须用一条最小脚本验证，验证方式写在此处以免遗忘：

| 假设 | 影响 | 验证方式 |
| --- | --- | --- |
| 离屏窗口不共享用户浏览器的登录态 | 若成立，Adapter 只能救「无需登录」的站点；抖音/小红书仍需 Cookie | `probeScript: "JSON.stringify({c: document.cookie.length, ls: Object.keys(localStorage).length})"`，与用户在浏览器里的对同一站点结果比较 |
| 目标站点不因离屏 UA / 无头特征拒绝 | 若被拒，Adapter 对风控站点无效 | 对小红书笔记跑一次 Run，看 `probe` 是否拿到播放地址 |
| 播放地址在页面全局变量或 DOM 上可读 | 若只在 Web Worker 内部或内存中，`probeScript` 取不到 | 对快手跑一次 Run，`probe` 返回 `Object.keys(window)` 里是否含播放器状态 |

三条都不成立时，Adapter 层的价值退化为「对无提取器站点的静态 DOM 抓取」，仍成立但收益变小；
这一点写进 ADR 是为了避免上线后用「没效果」而不是「假设不成立」来解释。

## 6. 采纳与裁剪清单

Tampermonkey 的 20 个 GM API 里采纳 4 个，其余 16 个逐条给理由——这张表是「功能不冗余」的判据，
不是待办清单。

| GM API | 决定 | 落点 / 理由 |
| --- | --- | --- |
| `GM_xmlhttpRequest` | 采纳 | 页面内 `fetch`（Adapter 在页面上下文，同源请求天然可用） |
| `GM_getValue` `GM_setValue` `GM_deleteValue` `GM_listValues` | 采纳 | `ctx.storage` 的单个 JSON 文件，按 Adapter `@name` 分键（登录提示、上次参数） |
| `GM_info` | 采纳 | 只读元数据，Adapter 视图展示 |
| `GM_log` | 采纳 | 写入现有诊断环形缓冲，`Adapter Failure` 归因用 |
| `GM_addValueChangeListener` | 裁剪 | 无常驻，值不会在 Run 期间被外部改动 |
| `GM_notification` `GM_setClipboard` `GM_openInTab` | 裁剪 | 面板本身就是 UI，宿主已有剪贴板与打开外部链接的通道 |
| `GM_registerMenuCommand` | 裁剪 | 它服务「常驻脚本的右键菜单」；Adapter 的入口是用户在面板里贴地址 |
| `GM_getResourceText` `GM_getResourceURL` | 裁剪 | `@resource` 是打包侧能力，Adapter 单文件交付，无附属资源 |
| `GM_addStyle` | 裁剪 | Adapter 不参与页面外观 |
| `GM_getTab` `GM_saveTab` `GM_getTabs` | 裁剪 | 无标签页概念，一次 Run 一页 |
| `GM_installScript` | 裁剪 | 装脚本是面板的导入动作，不是脚本内可触发的操作 |

子系统层面同样裁掉四项：**自动更新**（市场是唯一更新源）、**云同步**（数据不出本机）、
**CodeMirror 编辑器**（适配器是单函数；MVP 用等宽 `textarea`，编辑体验不足时再按需分包引入）、
**沙箱/curtain**（离屏窗口即隔离边界）。

保留并复用的是**信息架构**，不是代码：`options.html` 的「左侧分区 + 列表-详情两级」结构对应
ADR 0002 的三视图；`fire.js` 的错误面板对应 Adapter Failure 的归因展示。

## 7. 数据契约的最小扩展

Adapter 的产物要落进现有 `MediaItem`（`src/domain/media-info.ts`），但下载命令写死针对 Source URL：

```
service/src/tasks/download-runner.ts:206
  args.push("-f", task.streamId, "-o", join(workDirectory, "%(title)s.%(ext)s"), task.url);
```

因此需要两处字段扩展，而不是一条新链路：

| 扩展 | 位置 | 作用 |
| --- | --- | --- |
| `MediaFormat.directUrl?: string` | `src/domain/media-info.ts` | Adapter 给出的可播地址；存在时下载目标是它，不是 `task.url` |
| `DownloadTask.headers?: Record<string, string>` | `service/src/tasks/types.ts` | 直链常需 `Referer` / `User-Agent`；runner 增 `--add-header` |

否决的替代方案：为 Adapter 写一套 HTTP 下载器。理由是会复制进度、并发、重试、落盘、ffmpeg 合并五处逻辑，
而 Engine 的 runner 已经全部具备，`--add-header` 是它为这种情况提供的原生能力。

`streamId` 语义保持不变：Engine 路径是 yt-dlp 的 format selector，Adapter 路径固定为 `"adapter"`，
runner 据此跳过 `-f`。

## 8. 后果

**正面**

- 无提取器站点从「必然失败」变成「有适配器就成功」，失败码从 `site_unsupported` 细分出
  `adapter-missing` / `adapter-failed`，用户能看懂下一步该做什么。
- 代码增量集中在一个新目录（`src/features/adapters/` + `service/src/adapters/` 的只读目录索引），
  下载链路零改动（除两个字段）。
- 已装 2.4.0 的用户升级后，Engine 路径行为不变；Adapter 是纯增量。

**负面**

- 引入「执行目标站点页面里的 JS」这个面。三条自律约束（`@match` 校验、只本地导入、一次一页）
  把它限制在可审计范围，但它确实比纯 yt-dlp 更难审计。
- 拉一个 Chromium 页面是秒级动作，比 Engine 慢一个数量级，因此只作为补救路径，不做默认。
- 三个 Assumed 假设未验证即写进 ADR，若第一条不成立，Adapter 对登录站点无价值。

**需要跟随**

- `plugin.json` 增 `capture.offscreen` 权限（权限枚举见 `manifest-schema.d.ts:137`）。
- Site Capability 增 `adapterId?: string` 与 `adapter-unavailable`，保持「一张表回答站点能不能解析」，
  不新开第二张登记表。
- 市场详情页需说明「适配器由用户自行导入，插件不内置任何站点脚本」——这是诚实告知，不是免责声明。

**回滚**

删除 `src/features/adapters/`、移除 `capture.offscreen` 权限、`MediaFormat.directUrl` 与
`DownloadTask.headers` 可保留（无害）。Engine 与 Direct Media 两条路径不受影响，因此回滚是删代码，
不是回退版本。
