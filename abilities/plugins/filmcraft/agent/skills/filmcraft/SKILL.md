---
name: filmcraft
alias: FilmCraft 视频剪辑
description: Edit video in FilmCraft inside Astravia: a non-linear timeline, clips, colour, and sound. Use when the task is cutting, trimming or assembling video, or when a project has to be opened from the workspace and rendered back.
---

# FilmCraft

FilmCraft is a non-linear video editor with colour and sound. The tab runs upstream's own web build unmodified; upstream falls back from WebGPU to WebGL by reloading with a flag, and the hub passes that flag through untouched.

## 在对话里怎么用它

这些工具都打到正在运行的页面上，所以**标签页必须先开着**。用户说"帮我打开某个文件"时，
先 `filmcraft_open_editor`，拿到 `ready: true` 再谈别的；页面没起来（`ready: false`）时，
把工具返回的 `error` 如实报给用户，不要猜原因。

| | | ` ` | 用 |
| | | ` ` | - |
| 打开编辑器并看它现在什么状态 | `filmcraft_open_editor` | `{open, url, ready, canvas, secure, staged}` |
| 只问状态，不打开任何东西 | `filmcraft_editor_status` | `{open, ready, canvas, …}` 或 `{open:false}` |
| 把画布当前画面存成 PNG | `filmcraft_capture_canvas` | 保存对话框；取消时回 `save-cancelled` |
| 把工作区里的文件交给编辑器 | `filmcraft_open_workspace_file` | `{ok, staged, bytes}`，之后在应用里点打开 |
| 把同一个页面放到浏览器里 | `filmcraft_open_in_browser` | `{url, where}` |

## 硬规则

- **不要替用户点界面**。工具能做的是打开、观察、取图、投文件；编辑本身在编辑器里做。
- `filmcraft_open_workspace_file` 只是**把字节暂存进页面**。用户还要在应用里按打开；
  只有在用户明确说"打开"之后，才能说它已经打开了。返回里的 `next` 就是给用户看的那句话。
- **保存属于用户**。不要声称自己保存了文档；`capture_canvas` 存的是当前画面的 PNG 快照，
  不是工程文件。
- 浏览器入口（`filmcraft_open_in_browser`）**没有工作区绑定**：那里打开文件走浏览器选择框，
  保存走浏览器下载。要处理项目文件，就说清楚得用 Astravia 标签页。
- 工具回 `open: false` 表示标签页没开，不表示插件没装。

## 参考资料

这些是上游 `storytold/filmcraft` 自带的文档，随插件一起发布。
按任务打开相关那一篇，不要凭记忆描述上游功能。

| 主题 | 文件 |
| --- | --- |
| Agents | `references/agents.md` |
| Architecture | `references/architecture.md` |
| Captions | `references/captions.md` |
| Codec parity | `references/codec-parity.md` |
| Contributing | `references/contributing.md` |
| Contributors in the About window | `references/contributors.md` |
| Control protocol & MCP | `references/control-protocol.md` |
| FilmCraft — egui 0.37 migration plan | `references/egui-037-migration-plan.md` |
| File format parity | `references/file-format-parity.md` |
| Where FilmCraft falls short of Premiere Pro | `references/gaps.md` |
| Graphics | `references/graphics.md` |
| Hardware parity | `references/hardware-parity.md` |
| Keyboard parity with Premiere Pro | `references/keyboard.md` |
| Localization parity | `references/localization-parity.md` |
| Monitor view options | `references/monitors.md` |
| Performance | `references/performance.md` |
| Project files | `references/project-files.md` |
| Releasing FilmCraft | `references/releasing.md` |
| Roadmap detail | `references/roadmap.md` |
| Parity with Adobe Premiere Pro | `references/target-app-parity.md` |
| Testing | `references/testing.md` |
| Transcripts and text-based editing | `references/transcripts.md` |
| UI and interaction parity | `references/ui-parity.md` |
| FilmCraft on the web | `references/web.md` |
