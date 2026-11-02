# Agent 工具打到运行中的那个页面，不另开一条控制通道

每个插件注册五个工具：`<id>_open_editor`、`<id>_editor_status`、`<id>_capture_canvas`、
`<id>_open_workspace_file`、`<id>_open_in_browser`。它们不直接操作应用状态，而是把一条
`craft:*` 消息投进 iframe，等页面回一条 `craft:reply`，再把结果作为 JSON 文本返回。

**为什么不让工具自己"做事"。** 应用状态在 wasm 里，插件拿不到；唯一能读的人就是页面里的
`host-bridge.js`。所以工具的价值不是执行，而是**把用户的一句话翻译成一个可验证的观察**：
`ready` 来自画布真的有了像素，`canvas` 来自 `toDataURL`，`staged` 来自页面真的收到了字节。
这比"调用成功即认为成功"诚实——0.0.2 的 startup 曾显示 `wasmBindings: undefined` 而面板
以为一切正常（Observed，Round2 诊断）。

**代价与边界。** 工具全部 fail-closed 地声明 `scope_use: ["conversation","project"]`：
其他场景里它们不激活，而不是激活后行为未定义。超时是明确的（打开 60 s、状态 20 s、
截图 30 s、暂存 10 s），超时返回 `frame-timeout` 而不是挂住对话。
`_open_workspace_file` 只做"暂存"，因为应用里的打开动作属于用户——工具返回的 `next`
字段就是那句要转述给用户的话。同理，`_capture_canvas` 存的是画面快照，不是工程文件。

**证据与未验证。** Observed：宿主 `registerTool` 需要同时具备 `agent.tools.register` 与
`agent.toolHandler.execute`，缺一个就静默不注册（`RootOverlayViews-B3o5AIhT.js`），所以
两份权限都写进了 `plugin.json`；`agent.skillPaths` 会经 `listPluginManifestResources()`
进包，实测 `.astraviapkg` 内含 `agent/skills/<id>/SKILL.md` 与 `references/**`。
Inferred：五个工具在真实对话里被模型选中的准确率没有测过；本仓库只证明了它们能被注册、
参数合法、返回值可序列化。
