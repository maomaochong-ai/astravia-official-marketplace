---
name: vectorcraft
alias: VectorCraft 矢量插画
description: Draw vector artwork in VectorCraft inside Astravia: paths, bezier handles, fills, strokes and SVG output. Use when the task is a logo, an icon, a diagram or any illustration that has to stay sharp at every size.
---

# VectorCraft

VectorCraft is a vector illustration application. The tab runs upstream's own web build unmodified; this plugin adds the doorway so a drawing in the workspace can be opened and the SVG it produces written back.

## 在对话里怎么用它

这些工具都打到正在运行的页面上，所以**标签页必须先开着**。用户说"帮我打开某个文件"时，
先 `vectorcraft_open_editor`，拿到 `ready: true` 再谈别的；页面没起来（`ready: false`）时，
把工具返回的 `error` 如实报给用户，不要猜原因。

| | | ` ` | 用 |
| | | ` ` | - |
| 打开编辑器并看它现在什么状态 | `vectorcraft_open_editor` | `{open, url, ready, canvas, secure, staged}` |
| 只问状态，不打开任何东西 | `vectorcraft_editor_status` | `{open, ready, canvas, …}` 或 `{open:false}` |
| 把画布当前画面存成 PNG | `vectorcraft_capture_canvas` | 保存对话框；取消时回 `save-cancelled` |
| 把工作区里的文件交给编辑器 | `vectorcraft_open_workspace_file` | `{ok, staged, bytes}`，之后在应用里点打开 |
| 把同一个页面放到浏览器里 | `vectorcraft_open_in_browser` | `{url, where}` |

## 硬规则

- **不要替用户点界面**。工具能做的是打开、观察、取图、投文件；编辑本身在编辑器里做。
- `vectorcraft_open_workspace_file` 只是**把字节暂存进页面**。用户还要在应用里按打开；
  只有在用户明确说"打开"之后，才能说它已经打开了。返回里的 `next` 就是给用户看的那句话。
- **保存属于用户**。不要声称自己保存了文档；`capture_canvas` 存的是当前画面的 PNG 快照，
  不是工程文件。
- 浏览器入口（`vectorcraft_open_in_browser`）**没有工作区绑定**：那里打开文件走浏览器选择框，
  保存走浏览器下载。要处理项目文件，就说清楚得用 Astravia 标签页。
- 工具回 `open: false` 表示标签页没开，不表示插件没装。

## 参考资料

这些是上游 `storytold/vectorcraft` 自带的文档，随插件一起发布。
按任务打开相关那一篇，不要凭记忆描述上游功能。

| 主题 | 文件 |
| --- | --- |
| 3D lighting performance | `references/3d-lighting-performance.md` |
| Affinity 3 `.af`: source audit and validation boundaries | `references/affinity-validation.md` |
| Architecture | `references/architecture.md` |
| Contributors in the About window | `references/contributors.md` |
| Control protocol | `references/control-protocol.md` |
| Development | `references/development.md` |
| Dimensions | `references/dimensions.md` |
| Effects parity | `references/effects-parity.md` |
| VectorCraft — egui 0.37 migration plan | `references/egui-037-migration-plan.md` |
| File format parity | `references/file-format-parity.md` |
| Gaps | `references/gaps.md` |
| Hardware parity | `references/hardware-parity.md` |
| Adjusting an Image Trace | `references/image-trace-adjustments.md` |
| Image Trace quality | `references/image-trace-quality.md` |
| Localization parity | `references/localization-parity.md` |
| VectorCraft MCP server | `references/mcp.md` |
| PDF backend | `references/pdf-backend.md` |
| Plug-ins: the WebAssembly plug-in API (ABI v1) | `references/plugins.md` |
| Print a large poster across multiple pages | `references/print-tiling.md` |
| Releasing VectorCraft | `references/releasing.md` |
| Revolve | `references/revolve.md` |
| Roadmap: milestones and what's next | `references/roadmap.md` |
| Shaper | `references/shaper.md` |
| Parity with Adobe Illustrator | `references/target-app-parity.md` |
| Extrude & Bevel, Inflate and Rotate | `references/three-d.md` |
| Type parity | `references/type-parity.md` |
| Typography and Custom Lettering in VectorCraft | `references/typography-lettering.md` |
| UI and interaction parity | `references/ui-parity.md` |
