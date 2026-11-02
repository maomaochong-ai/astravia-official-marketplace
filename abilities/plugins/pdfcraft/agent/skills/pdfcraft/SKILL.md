---
name: pdfcraft
alias: PDFCraft PDF 工作台
description: Work on PDFs in PDFCraft inside Astravia: read, reorder, merge, split, rotate and secure documents. Use when the task is assembling or fixing a PDF, extracting pages, or applying encryption.
---

# PDFCraft

PDFCraft is a PDF reader and editor. The tab runs upstream's own web build unmodified; the plugin adds the doorway so a PDF in the workspace can be opened and the resulting bytes written back.

## 在对话里怎么用它

这些工具都打到正在运行的页面上，所以**标签页必须先开着**。用户说"帮我打开某个文件"时，
先 `pdfcraft_open_editor`，拿到 `ready: true` 再谈别的；页面没起来（`ready: false`）时，
把工具返回的 `error` 如实报给用户，不要猜原因。

| | | ` ` | 用 |
| | | ` ` | - |
| 打开编辑器并看它现在什么状态 | `pdfcraft_open_editor` | `{open, url, ready, canvas, secure, staged}` |
| 只问状态，不打开任何东西 | `pdfcraft_editor_status` | `{open, ready, canvas, …}` 或 `{open:false}` |
| 把画布当前画面存成 PNG | `pdfcraft_capture_canvas` | 保存对话框；取消时回 `save-cancelled` |
| 把工作区里的文件交给编辑器 | `pdfcraft_open_workspace_file` | `{ok, staged, bytes}`，之后在应用里点打开 |
| 把同一个页面放到浏览器里 | `pdfcraft_open_in_browser` | `{url, where}` |

## 硬规则

- **不要替用户点界面**。工具能做的是打开、观察、取图、投文件；编辑本身在编辑器里做。
- `pdfcraft_open_workspace_file` 只是**把字节暂存进页面**。用户还要在应用里按打开；
  只有在用户明确说"打开"之后，才能说它已经打开了。返回里的 `next` 就是给用户看的那句话。
- **保存属于用户**。不要声称自己保存了文档；`capture_canvas` 存的是当前画面的 PNG 快照，
  不是工程文件。
- 浏览器入口（`pdfcraft_open_in_browser`）**没有工作区绑定**：那里打开文件走浏览器选择框，
  保存走浏览器下载。要处理项目文件，就说清楚得用 Astravia 标签页。
- 工具回 `open: false` 表示标签页没开，不表示插件没装。

## 参考资料

这些是上游 `storytold/pdfcraft` 自带的文档，随插件一起发布。
按任务打开相关那一篇，不要凭记忆描述上游功能。

| 主题 | 文件 |
| --- | --- |
| PdfCraft architecture | `references/architecture.md` |
| Batch conversion, OCR and compression | `references/cli-batch.md` |
| Contributors in the About window | `references/contributors.md` |
| Developing PdfCraft | `references/development.md` |
| Editing existing text and source subsets | `references/editing-existing-text.md` |
| Editing existing images and figures | `references/editing-images.md` |
| Move several objects together | `references/editing-multiple-objects.md` |
| Current integration — 2026-10-25 | `references/egui-037-migration-plan.md` |
| File format parity | `references/file-format-parity.md` |
| AcroForm JavaScript performance | `references/form-performance.md` |
| Where PdfCraft falls short of Acrobat Pro | `references/gaps.md` |
| Hardware and platform parity | `references/hardware-parity.md` |
| PdfCraft integration candidate, 2026-10-30 | `references/integration-20261030.md` |
| Source licensing self-check | `references/licensing-self-check.md` |
| Localization parity | `references/localization-parity.md` |
| Interface language | `references/localization.md` |
| MCP conventions | `references/mcp.md` |
| Continuous page display | `references/page-display.md` |
| PDF specification and standards parity | `references/pdf-spec-parity.md` |
| Releasing PdfCraft | `references/releasing.md` |
| PdfCraft roadmap: milestones and what's next | `references/roadmap.md` |
| PdfCraft parity with Adobe Acrobat Pro | `references/target-app-parity.md` |
| UI and interaction parity | `references/ui-parity.md` |
| Windows renderer startup errors and the OpenGL fallback | `references/windows-renderer-startup.md` |
| Word count | `references/word-count.md` |
