---
name: effectcraft
alias: EffectCraft 动态图形
description: Animate compositions in EffectCraft inside Astravia: layers, keyframes, 3D camera and lights, effects and the render queue. Use when the task is motion graphics, an animated title, a visual effect, or rendering a frame range.
---

# EffectCraft

EffectCraft is a motion-graphics and visual-effects compositor. The tab runs upstream's own web build unmodified; upstream cannot open After Effects project files, and this plugin does not add that — it adds the doorway so a workspace file can be opened and rendered output saved back.

## 在对话里怎么用它

这些工具都打到正在运行的页面上，所以**标签页必须先开着**。用户说"帮我打开某个文件"时，
先 `effectcraft_open_editor`，拿到 `ready: true` 再谈别的；页面没起来（`ready: false`）时，
把工具返回的 `error` 如实报给用户，不要猜原因。

| | | ` ` | 用 |
| | | ` ` | - |
| 打开编辑器并看它现在什么状态 | `effectcraft_open_editor` | `{open, url, ready, canvas, secure, staged}` |
| 只问状态，不打开任何东西 | `effectcraft_editor_status` | `{open, ready, canvas, …}` 或 `{open:false}` |
| 把画布当前画面存成 PNG | `effectcraft_capture_canvas` | 保存对话框；取消时回 `save-cancelled` |
| 把工作区里的文件交给编辑器 | `effectcraft_open_workspace_file` | `{ok, staged, bytes}`，之后在应用里点打开 |
| 把同一个页面放到浏览器里 | `effectcraft_open_in_browser` | `{url, where}` |

## 硬规则

- **不要替用户点界面**。工具能做的是打开、观察、取图、投文件；编辑本身在编辑器里做。
- `effectcraft_open_workspace_file` 只是**把字节暂存进页面**。用户还要在应用里按打开；
  只有在用户明确说"打开"之后，才能说它已经打开了。返回里的 `next` 就是给用户看的那句话。
- **保存属于用户**。不要声称自己保存了文档；`capture_canvas` 存的是当前画面的 PNG 快照，
  不是工程文件。
- 浏览器入口（`effectcraft_open_in_browser`）**没有工作区绑定**：那里打开文件走浏览器选择框，
  保存走浏览器下载。要处理项目文件，就说清楚得用 Astravia 标签页。
- 工具回 `open: false` 表示标签页没开，不表示插件没装。

## 参考资料

这些是上游 `storytold/effectcraft` 自带的文档，随插件一起发布。
按任务打开相关那一篇，不要凭记忆描述上游功能。

| 主题 | 文件 |
| --- | --- |
| faq/after-effects-projects | `references/faq/after-effects-projects.md` |
| faq/index | `references/faq/index.md` |
| faq/price-and-platforms | `references/faq/price-and-platforms.md` |
| getting-started/index | `references/getting-started/index.md` |
| getting-started/install | `references/getting-started/install.md` |
| guides/add-an-effect | `references/guides/add-an-effect.md` |
| guides/animate-with-keyframes | `references/guides/animate-with-keyframes.md` |
| guides/import-footage | `references/guides/import-footage.md` |
| guides/index | `references/guides/index.md` |
| guides/make-a-composition | `references/guides/make-a-composition.md` |
| guides/render-a-video | `references/guides/render-a-video.md` |
| index | `references/index.md` |
| troubleshooting/footage-missing | `references/troubleshooting/footage-missing.md` |
| troubleshooting/gpu-not-used | `references/troubleshooting/gpu-not-used.md` |
| troubleshooting/index | `references/troubleshooting/index.md` |
