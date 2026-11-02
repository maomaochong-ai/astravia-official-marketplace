---
name: designcraft
alias: DesignCraft 排版出版
description: Lay out pages in DesignCraft inside Astravia: spreads, parent pages, text frames, styles, and export to PDF, PNG or EPUB. Use when the task is a brochure, report, poster or book layout, or when an IDML file has to be opened, edited and exported.
---

# DesignCraft

DesignCraft is a page-layout application — the open-source, modern desktop-publishing studio. The tab runs upstream's own web build unmodified; this plugin adds only the doorway, so a workspace file can be opened and the exported bytes written back through Astravia.

## 在对话里怎么用它

这些工具都打到正在运行的页面上，所以**标签页必须先开着**。用户说"帮我打开某个文件"时，
先 `designcraft_open_editor`，拿到 `ready: true` 再谈别的；页面没起来（`ready: false`）时，
把工具返回的 `error` 如实报给用户，不要猜原因。

| | | ` ` | 用 |
| | | ` ` | - |
| 打开编辑器并看它现在什么状态 | `designcraft_open_editor` | `{open, url, ready, canvas, secure, staged}` |
| 只问状态，不打开任何东西 | `designcraft_editor_status` | `{open, ready, canvas, …}` 或 `{open:false}` |
| 把画布当前画面存成 PNG | `designcraft_capture_canvas` | 保存对话框；取消时回 `save-cancelled` |
| 把工作区里的文件交给编辑器 | `designcraft_open_workspace_file` | `{ok, staged, bytes}`，之后在应用里点打开 |
| 把同一个页面放到浏览器里 | `designcraft_open_in_browser` | `{url, where}` |

## 硬规则

- **不要替用户点界面**。工具能做的是打开、观察、取图、投文件；编辑本身在编辑器里做。
- `designcraft_open_workspace_file` 只是**把字节暂存进页面**。用户还要在应用里按打开；
  只有在用户明确说"打开"之后，才能说它已经打开了。返回里的 `next` 就是给用户看的那句话。
- **保存属于用户**。不要声称自己保存了文档；`capture_canvas` 存的是当前画面的 PNG 快照，
  不是工程文件。
- 浏览器入口（`designcraft_open_in_browser`）**没有工作区绑定**：那里打开文件走浏览器选择框，
  保存走浏览器下载。要处理项目文件，就说清楚得用 Astravia 标签页。
- 工具回 `open: false` 表示标签页没开，不表示插件没装。

## 参考资料

这些是上游 `storytold/designcraft` 自带的文档，随插件一起发布。
按任务打开相关那一篇，不要凭记忆描述上游功能。

| 主题 | 文件 |
| --- | --- |
| faq/indesign-files | `references/faq/indesign-files.md` |
| faq/index | `references/faq/index.md` |
| faq/is-it-free | `references/faq/is-it-free.md` |
| faq/supported-systems | `references/faq/supported-systems.md` |
| getting-started/index | `references/getting-started/index.md` |
| getting-started/install | `references/getting-started/install.md` |
| guides/create-a-document | `references/guides/create-a-document.md` |
| guides/export-a-pdf | `references/guides/export-a-pdf.md` |
| guides/index | `references/guides/index.md` |
| guides/open-a-file | `references/guides/open-a-file.md` |
| guides/place-images-and-text | `references/guides/place-images-and-text.md` |
| index | `references/index.md` |
| troubleshooting/app-closes-at-start | `references/troubleshooting/app-closes-at-start.md` |
| troubleshooting/get-help | `references/troubleshooting/get-help.md` |
| troubleshooting/index | `references/troubleshooting/index.md` |
