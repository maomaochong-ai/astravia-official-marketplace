---
name: photocraft
alias: Photocraft 图片编辑
description: Work on raster images in Photocraft inside Astravia: layers, masks, selections, type, adjustment layers and PSD files. Use when the task is editing a photo or a layered image, opening or saving a .psd, or handing an image from the workspace to the editor and back.
---

# Photocraft

Photocraft is a raster image editor. The tab runs upstream's own web build in an iframe — same wasm, same JavaScript, no fork — so anything the editor can do it can do here; what this plugin adds is the doorway: a workspace file goes in, the saved bytes come back to the same path.

## 在对话里怎么用它

这些工具都打到正在运行的页面上，所以**标签页必须先开着**。用户说"帮我打开某个文件"时，
先 `photocraft_open_editor`，拿到 `ready: true` 再谈别的；页面没起来（`ready: false`）时，
把工具返回的 `error` 如实报给用户，不要猜原因。

| | | ` ` | 用 |
| | | ` ` | - |
| 打开编辑器并看它现在什么状态 | `photocraft_open_editor` | `{open, url, ready, canvas, secure, staged}` |
| 只问状态，不打开任何东西 | `photocraft_editor_status` | `{open, ready, canvas, …}` 或 `{open:false}` |
| 把画布当前画面存成 PNG | `photocraft_capture_canvas` | 保存对话框；取消时回 `save-cancelled` |
| 把工作区里的文件交给编辑器 | `photocraft_open_workspace_file` | `{ok, staged, bytes}`，之后在应用里点打开 |
| 把同一个页面放到浏览器里 | `photocraft_open_in_browser` | `{url, where}` |

## 硬规则

- **不要替用户点界面**。工具能做的是打开、观察、取图、投文件；编辑本身在编辑器里做。
- `photocraft_open_workspace_file` 只是**把字节暂存进页面**。用户还要在应用里按打开；
  只有在用户明确说"打开"之后，才能说它已经打开了。返回里的 `next` 就是给用户看的那句话。
- **保存属于用户**。不要声称自己保存了文档；`capture_canvas` 存的是当前画面的 PNG 快照，
  不是工程文件。
- 浏览器入口（`photocraft_open_in_browser`）**没有工作区绑定**：那里打开文件走浏览器选择框，
  保存走浏览器下载。要处理项目文件，就说清楚得用 Astravia 标签页。
- 工具回 `open: false` 表示标签页没开，不表示插件没装。

## 参考资料

这些是上游 `storytold/photocraft` 自带的文档，随插件一起发布。
按任务打开相关那一篇，不要凭记忆描述上游功能。

| 主题 | 文件 |
| --- | --- |
| PhotoCraft Documentation | `references/README.md` |
| Summary | `references/SUMMARY.md` |
| Automation architecture | `references/architecture/automation.md` |
| Command engine | `references/architecture/command-engine.md` |
| Crates and dependency layers | `references/architecture/crates.md` |
| Architecture overview | `references/architecture/overview.md` |
| Rendering | `references/architecture/rendering.md` |
| Command-line interface | `references/automation/cli.md` |
| Control protocol | `references/automation/control-protocol.md` |
| MCP | `references/automation/mcp.md` |
| Automation overview | `references/automation/overview.md` |
| Automation security model | `references/automation/security-model.md` |
| Dependencies | `references/development/dependencies.md` |
| Fuzzing | `references/development/fuzzing.md` |
| Release security | `references/development/release-security.md` |
| Testing | `references/development/testing.md` |
| Affinity documents | `references/formats/affinity.md` |
| Format overview | `references/formats/overview.md` |
| The `.pcraft` format | `references/formats/pcraft.md` |
| PSD and PSB | `references/formats/psd-psb.md` |
| Raster formats | `references/formats/raster-formats.md` |
| SVG | `references/formats/svg.md` |
| Building | `references/getting-started/building.md` |
| Contributing | `references/getting-started/contributing.md` |
| Installation | `references/getting-started/installation.md` |
| Credits | `references/project/credits.md` |
| Licenses | `references/project/licenses.md` |
| Roadmap | `references/project/roadmap.md` |
| Automation security | `references/security/automation-security.md` |
| Fuzzing and regression testing | `references/security/fuzzing.md` |
| Security overview | `references/security/overview.md` |
| Parser hardening | `references/security/parser-hardening.md` |
| Secure file handling | `references/security/secure-file-handling.md` |
| Threat model | `references/security/threat-model.md` |
| Trust boundaries | `references/security/trust-boundaries.md` |
| Vulnerability reporting | `references/security/vulnerability-reporting.md` |
