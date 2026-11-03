# DesignCraft：这个应用自己的决定

共用的东西在 [`../craft/`](../craft/README.md)：七份副本怎么同步、字节怎么走、非活动标签为什么停、
Agent 怎么驱动画布、中文的边界。这里只记与 DesignCraft 有关的部分。

## 钉住的上游

| | |
| --- | --- |
| 上游仓库 | https://github.com/storytold/designcraft |
| Web 构建 | `designcraft-web-0.16.0.zip`（26 MB） |
| `payload/manifest.json#app.locale` | `null` — 这个构建没有中文文案，也没有内嵌中文字形 |

## 文档

- [0001 这个应用是一个 payload 钉子](0001-this-app-is-a-payload-pin.md)

## 操作要点

- 版面、主页、段落样式这些概念在上游文档里叫 spread / parent page / text frame / paragraph style，
  和用户的说法不一定对得上。用户说"母版"，读 `references/guides/` 对词。
- 导出走编辑器自己的对话框（PDF / PNG / EPUB）。`capture_canvas` 存的只是当前画布截图。
- IDML 导入是上游的能力，插件不参与解析：把 `.idml` 用 `open_workspace_file` 递进去，
  剩下的在应用里完成。
