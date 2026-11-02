---
name: lightcraft
alias: LightCraft 照片库与显影
description: Catalog photos and develop raw files in LightCraft inside Astravia: import, cull, grade, and export. Use when the task is photo selection, raw development, or a batch of images that needs consistent treatment.
---

# LightCraft

LightCraft is a photo library and raw developer — the open-source alternative to Lightroom. The tab runs upstream's own web build unmodified; the payload is large because it carries the Chinese UI font and the raw pipeline.

## 在对话里怎么用它

这些工具都打到正在运行的页面上，所以**标签页必须先开着**。用户说"帮我打开某个文件"时，
先 `lightcraft_open_editor`，拿到 `ready: true` 再谈别的；页面没起来（`ready: false`）时，
把工具返回的 `error` 如实报给用户，不要猜原因。

| | | ` ` | 用 |
| | | ` ` | - |
| 打开编辑器并看它现在什么状态 | `lightcraft_open_editor` | `{open, url, ready, canvas, secure, staged}` |
| 只问状态，不打开任何东西 | `lightcraft_editor_status` | `{open, ready, canvas, …}` 或 `{open:false}` |
| 把画布当前画面存成 PNG | `lightcraft_capture_canvas` | 保存对话框；取消时回 `save-cancelled` |
| 把工作区里的文件交给编辑器 | `lightcraft_open_workspace_file` | `{ok, staged, bytes}`，之后在应用里点打开 |
| 把同一个页面放到浏览器里 | `lightcraft_open_in_browser` | `{url, where}` |

## 硬规则

- **不要替用户点界面**。工具能做的是打开、观察、取图、投文件；编辑本身在编辑器里做。
- `lightcraft_open_workspace_file` 只是**把字节暂存进页面**。用户还要在应用里按打开；
  只有在用户明确说"打开"之后，才能说它已经打开了。返回里的 `next` 就是给用户看的那句话。
- **保存属于用户**。不要声称自己保存了文档；`capture_canvas` 存的是当前画面的 PNG 快照，
  不是工程文件。
- 浏览器入口（`lightcraft_open_in_browser`）**没有工作区绑定**：那里打开文件走浏览器选择框，
  保存走浏览器下载。要处理项目文件，就说清楚得用 Astravia 标签页。
- 工具回 `open: false` 表示标签页没开，不表示插件没装。

## 参考资料

这些是上游 `storytold/lightcraft` 自带的文档，随插件一起发布。
按任务打开相关那一篇，不要凭记忆描述上游功能。

| 主题 | 文件 |
| --- | --- |
| faq/closing-the-window | `references/faq/closing-the-window.md` |
| faq/free-and-private | `references/faq/free-and-private.md` |
| faq/index | `references/faq/index.md` |
| faq/supported-files | `references/faq/supported-files.md` |
| getting-started/index | `references/getting-started/index.md` |
| getting-started/install | `references/getting-started/install.md` |
| guides/cull-photos | `references/guides/cull-photos.md` |
| guides/edit-a-photo | `references/guides/edit-a-photo.md` |
| guides/export-photos | `references/guides/export-photos.md` |
| guides/import-lightroom-catalog | `references/guides/import-lightroom-catalog.md` |
| guides/import-photos | `references/guides/import-photos.md` |
| guides/index | `references/guides/index.md` |
| guides/remove-distractions | `references/guides/remove-distractions.md` |
| index | `references/index.md` |
| troubleshooting/get-help | `references/troubleshooting/get-help.md` |
| troubleshooting/index | `references/troubleshooting/index.md` |
| troubleshooting/preview-only-raw | `references/troubleshooting/preview-only-raw.md` |
| troubleshooting/raw-photos-look-dull | `references/troubleshooting/raw-photos-look-dull.md` |
