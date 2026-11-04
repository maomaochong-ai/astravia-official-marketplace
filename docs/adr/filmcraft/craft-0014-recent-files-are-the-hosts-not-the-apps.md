# 最近打开属于宿主而不是应用：上游的 Recent 列表在网页构建里是死的

用户第二次打开面板，点编辑器里 File → Open Recent 里的那个文件名，得到一行报错：
`docx: files are opened through the browser on the web`，文件照样打不开。这不是插件把路径弄坏了，
是上游自己在网页构建里拒绝了这条路径。

**根因在上游，不在桥。** wordcraft 的 `crates/engine/src/io.rs:669` 与 `:805` 对读出这条路径的分支直接返回
这句拒绝；`crates/ui-egui/src/backstage.rs:581` 与 `:615` 把它显示到界面上。deckcraft 的
`crates/engine/src/io.rs:24` 是同一句。也就是说：桌面版靠一个本机文件系统句柄重开文件，网页版没有那个句柄，
上游选择报错而不是降级。网页构建里 `open_recent` → `app.open_file(path)` → wasm 侧 `read_file` 直接 `Err`，
JS 层没有任何可注入的中间函数——Web 端只暴露文件对话框那几个 `wasm_bindgen`。

**决定一：不去 stub 上游的文件选择器。** 想让栈里的 Recent 记起路径，就得伪造 `showOpenFilePicker`
或者一个持久化的 `FileSystemHandle`。那样这条路径在编辑器里"能点"，但那不是上游的行为，是插件塞给它的假句柄；
一旦上游换了打开流程，这个谎会在别处塌。宁可让上游那条保持原样地不可用。

**决定二：最近列表改由插件状态栏提供。** `use-craft-editor.ts` 记住用户真正打开过的文件
（`craft:pickOpen` 与保存回写都会 `remember()`，去重后留 8 条，写进插件存储的 `editor/recent.json`），
`recent-files-menu.tsx` 在状态栏上把它列出来。点一条走的是与"选择文件并打开"完全相同的既有链路：
`readWorkspaceFile` → `craft:stage` → `craft:act` 按 `ctrl+o`。上游收到的仍然是一次普通的打开动作，
它不需要知道这个路径是从哪来的。

**决定三：文档里说清这是插件的列表。** 详情页与技能都写成"状态栏记住最近打开的文件"，
不宣称上游的 Recent 菜单被修好了——它没有。用户在编辑器菜单里点 Recent 仍然会看到那句报错，
那是上游在网页构建下的真实行为。

**代价。** 列表只覆盖本插件自己经手的文件：从工作区选过的、保存过的。上游菜单里的 Recent（如果宿主之前
给过路径）不会进这份列表，也无法反查。八条上限是刻意的：这是一份"接着上次干"的快捷入口，不是文件历史。

**证据与未验证。** Observed：`io.rs:669`/`:805`、`backstage.rs:581`/`:615`、`deckcraft/io.rs:24` 的拒绝分支；
`apps/photocraft-web/src/web.rs` 与 `-web-boot/src/main.rs` 的 `wasm_bindgen` 只有文件对话框；
面板里点 Recent 时返回的那行报错原文。Inferred：其余十四支只要经过同一条 `read_file` 拒绝，行为一致
（deckcraft 已用源码确认，其余按同一引擎模板判断）。NOT RUN：在真实桌面宿主里点状态栏的最近列表——
本环境无法驱动宿主 UI，需要在装了插件的桌面上复验一次。
