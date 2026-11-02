# Photocraft 插件

`abilities/plugins/photocraft` 的领域语言。这份词表只定义「东西叫什么」，不解释怎么实现；
实现留在各自的 ADR 里。标签页文案、字段名与错误码一律用这里的词。

## 语言

### 两端

**Photocraft**：
被嵌进宿主的那款开源图像编辑器本体——Rust + egui/wgpu。标签页里跑的是它自己的 web 构建，
不是复刻品，也不是我们包了一层的新界面。
_Avoid_: 编辑器（口语可用，文档用 Photocraft）、后端、engine（`engine` 是它内部的命令执行器）

**Host**：
宿主 Astravia 桌面端。插件、标签页、文件读写权限都由它提供。
_Avoid_: 平台、客户端

**Activity Tab**：
宿主右侧活动面板里的一个标签页（`ui.slot.activity-tab`），按会话工作目录作用域出现、可挂可摘、
同一贡献只有一个实例。它是本插件在宿主里唯一的界面（另两个入口不经过它，见 **Entry**）。
_Avoid_: 面板、侧边栏、视图（`workspace-view` 是另一种东西，不是标签页）

**Tab Shell**：
标签页里 iframe 之外的那一条信息条。只显示事实与逃生口，不复制编辑器的任何控件。
_Avoid_: 工具栏、顶栏、chrome

### 被加载的东西

**Payload**：
上游 `photocraft-web-<version>.zip` 里的那一套静态文件，由 **Hub** 在内存里持有并按需解压供给。
它不是用户资产，也不对应磁盘上的任何目录。
_Avoid_: 内置应用、runtime、安装包（zip 是 Payload 的来源，不是 Payload）

**Payload Pin**：
`payload/manifest.json` 里钉住的 `{version, size, sha256}`。它同时是「这份字节是谁的」和
「能不能用」的唯一判据；换版本就是换这几个值，尤其只看 sha256。
_Avoid_: 版本号、校验和配置

**Source List**：
Pin 里的 `sources[]`：一组带 `id` 标签、按声明顺序尝试的下载地址。`id` 只给人看，代码不按它分支。
_Avoid_: 镜像列表、备用地址、CDN 列表

**Drop-in**：
用户自己把上游 zip 放到数据目录里的那个动作（文件名写 `localFile`），目的就是让 Source List 完全不被用到。
它不需要改配置、不需要对话框，只需要一个能复制的绝对路径。
_Avoid_: 本地安装、导入、上传

**Payload Config**：
Hub 在数据目录里自己维护的那个 `payload.json`：`localFile` 指向一份可用的 zip，`sources[]` 追加自己的镜像。
它是用户在宿主里唯一能改的面，因为宿主只给服务一份白名单环境变量。
_Avoid_: 配置中心、设置项、环境变量配置

**Hub**：
插件自带的 host-node 服务，在 `127.0.0.1:<port>` 上把 Payload 当静态站点供出去。它不碰工作区、
不落盘解包、没有写接口。
_Avoid_: 后端服务、本地服务器、代理

**Fullscreen**：
标签外壳容器自己进入的浏览器全屏（`requestFullscreen()`），不是把活动面板调宽。
入口是**顶部信息条**最右侧的那个按钮，退出靠同一个按钮或平台 Esc。
_Avoid_: 最大化、满屏、面板展开

**Bridge**：
插件注入到 Payload 里的那段同文档脚本（`host-bridge.js`），是两个 DOM 接缝与宿主之间唯一的代码。
它跑在 iframe 里，和 Photocraft 同一个文档。
_Avoid_: polyfill、shim、adapter、注入器

**Locale Seed**：
Hub 在响 `index.html` 时插在 `<head>` 里的一小段脚本：只在偏好键为空时写入默认语言（中文）。
它是**初值**，不是强制值；用户在 Photocraft 的 Preferences 里选的语言优先。
_Avoid_: 语言包、汉化、i18n 开关

**Compat Alias**：
Hub 对某个官方包里缺失路径的路径级别补位（现在只有 `app/snippets/*` → 根 `snippets/*`），
字节取自同一个 zip、不改写内容，也不重打包。它存在是因为上游打包漏了一个目录。
_Avoid_: 补丁、重打包、分叉

### 三个入口

**Entry**：
同一个 Hub URL 的三个消费位置：`标签页`（宿主活动面板里的 iframe）、`内置浏览器`（宿主自带浏览器
面板）、`系统浏览器`（`shell.openExternal`）。只有标签页里有 **Tab Shell** 与 **Bridge**。
_Avoid_: 通道、模式、入口（口语可用，文档用 Entry）、入口点

**Standalone**：
「不在宿主标签页里」的那两个 Entry 的共同形态：没有父页面、没有 `postMessage` 对端、没有 `ctx.fs`，
因此没有 **File Binding**，打开与保存都是浏览器自己的行为（即 **Downgrade**）。
_Avoid_: 独立模式、外部模式、无宿主

**Message Envelope**：
Bridge 与宿主之间 `postMessage` 的消息体，`type` 以 `pc:` 开头，只有词表里列出的几个。
_Avoid_: 协议、RPC、事件总线

**Seam**：
Bridge 接管的两个 DOM 点：`<input type="file">` 的 `click`（打开）与带 `download` 的
`<a>` 的 `click`（保存/导出）。上游改了实现，Seam 就失效，Bridge 退回降级路径。
_Avoid_: hook、patch point

**Backend**：
Photocraft 实际跑起来的渲染后端：`GPU`（WebGPU）、`GL`（WebGL2）、`CPU`（软件光栅）。
它是运行期探测出来的，不是按版本号推断的。
_Avoid_: 渲染器、驱动

**Downgrade**：
Bridge 或后端不可用时退回的路径：打开走 Photocraft 自己的文件选择器，保存走浏览器下载。
功能仍然成立，只是字节不经过宿主。Downgrade 必须**可见**，不能静默发生。
_Avoid_: 回退、fallback、兼容模式

### 一次编辑

**Workspace File**：
用户项目目录里的那个真实文件。它是磁盘上的字节，是宿主的权威副本；标签页里的文档是它的一个视图。
_Avoid_: 源文件、本地文件

**File Binding**：
标签页当前绑定到哪个 Workspace File 的关系：`{workspacePath, docName, savedAt}`。
没有绑定时（新建文档）保存会走「另存为」，选完即建立绑定。
_Avoid_: 关联、映射、当前文件

**Binding Authority**：
文件路径的唯一权威在宿主（渲染进程的 `ctx.fs`），不在 Hub、也不在 Payload。Hub 永远不知道用户打开的是
哪个文件。
_Avoid_: 路径管理、文件句柄

**Save Event**：
用户按下保存/导出，Bridge 从 Seam 里截获的那一次字节交付。它是宿主能观察到的**唯一**写意图。
_Avoid_: 导出事件、写回

**Save** 与 **Export** 是两个不同的落点：Save 覆盖 File Binding 指向的 Workspace File；
Export 一律另选路径、不改变绑定。上游 web 构建里两者都表现为一次下载，区别只在我们怎么接。
_Avoid_: 保存文件、下载

**Input Since Save**：
`Save Event` 之后 iframe 里是否还有过输入。它是**启发式**：有输入不等于改了像素，没输入一定没改。
所有「可能会丢失」的确认都建立在它上面。
_Avoid_: dirty、未保存标记（宿主读不到真正的 dirty，见 ADR 0003）

**Opaque Document**：
标签页里的文档，其内部状态（图层、历史、工具、脏标记）对宿主不可读。这是形态的边界，不是待办。
_Avoid_: 黑盒、隐藏状态

**Reload**：
丢弃 iframe 里的一切、重新加载 Payload。它等同于关闭再打开，因此必须走「可能会丢失」的确认。
_Avoid_: 刷新、重启
