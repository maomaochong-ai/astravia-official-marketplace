# Video Downloader

插件 `abilities/plugins/video-downloader` 的领域语言。它把「一个页面地址」变成「磁盘上的文件」，
中间的每一步都有确定的名称；面板文案、服务端字段与 ADR 一律使用这里的词。

## 语言

### 解析

**Source URL**：
用户在面板里粘贴的页面地址，是任务的起点，不是媒体本身的地址。
_Avoid_: 链接、video url、输入

**Media Item**：
一次解析产出的一个可下载对象，携带标题、封面、时长与格式列表。一个页面可能有多个（播放列表、图文多图）。
_Avoid_: 视频、资源、结果项

**Format**：
Media Item 里一个具体可取的流，用 `id` 标识，交由下载引擎的 `-f` 选择。
_Avoid_: 清晰度、stream、variant

**Extraction Path**：
一个 Media Item 是被哪条路径解析出来的，取值 `engine` / `adapter` / `direct`，三者互斥。
_Avoid_: 解析方式、来源（来源另指 adapter 的出处）

**Engine**：
内置的 yt-dlp 二进制及其 1752 个提取器。解析与下载的默认路径。
_Avoid_: 解析器、后端、ytdlp

**Site Capability**：
某个站点在 Engine 下的解析能力：有没有提取器、是否需要登录 Cookie、上游是否已坏、是否本身就是媒体直链。
_Avoid_: 站点支持、支持列表

**Tool Capability**：
yt-dlp / ffmpeg 这两个可执行文件在本机是否可用。与站点无关。
_Avoid_: 能力（单独出现时一律指本词或 Site Capability，容易混淆，必须写全）

**Direct Media**：
一个本身就是媒体文件的地址，可以跳过解析直接下载。
_Avoid_: 直链（口语可用，字段与文案用 Direct Media）

### 适配器

**Adapter**：
一段声明式元数据加一个提取函数，在目标页面的真实渲染环境里执行，把页面状态归结为一个 Media Item。
只提取，不下载。

**Adapter Match**：
Adapter 声明它负责哪些地址形态，语法取 userscript `@match` 的子集。
_Avoid_: 适用范围、规则

**Adapter Grant**：
Adapter 被允许做的少量副作用，取值 `fetch` / `storage` / `none`。不声明即 `none`。
_Avoid_: 权限（与宿主的 plugin permission 同名不同层）

**Adapter Run**：
对一个 Source URL 执行一次 Adapter：加载页面、注入准备脚本、求值探针、把结果规整为 Media Item。
一次 Run 对应一次用户动作，不是常驻。

**Adapter Failure**：
Adapter Run 没有产出 Media Item 的原因，区别于 Engine 的失败码。
_Avoid_: 报错、异常

### 下载与呈现

**Download Task**：
一次下载的全部状态，从排队到落盘。
_Avoid_: 任务（在需要区分 Adapter Run 时必须写 Download Task）

**Queue**：
当前会话里所有非终态 Download Task 的集合，只在内存与 `tasks.json` 里。
_Avoid_: 列表、下载列表

**Coverage**：
Site Capability 的全景快照，回答「这 53 个站点各自能不能解析」。是参考数据，不是操作入口。
_Avoid_: 支持情况、站点列表
