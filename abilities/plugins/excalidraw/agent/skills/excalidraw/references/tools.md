# 六个工具的参数与返回

工具 id 都带 `excalidraw_` 前缀（实现：`src/features/agent/editor-tools.ts`）。所有工具都作用于**已打开的那个
标签页**；没开就返回 `{ok:false, error:"editor-not-open"}` 这类可读的失败，不用猜。

## `excalidraw_open_editor`

参数：`{document?: string}`（工作区相对路径，可选）。

返回：`{open, url, ready, canvas, secure, staged, probe, next}`。`ready:false` 时另有 `error`，原样转述给用户。

## `excalidraw_editor_status`

参数：无。返回与上面同形，或 `{open:false}`。只读，不改任何状态。

## `excalidraw_scene`

参数：

| 键 | 类型 | 用于 |
| --- | --- | --- |
| `operation` | `read` \| `apply` \| `export` | 必填 |
| `elements` | 数组 | `apply`：元素骨架，或完整元素 |
| `skeleton` | 布尔 | `apply`：`true`（默认）当骨架，`false` 走 `restoreElements` |
| `mode` | `replace` \| `insert` | `apply`：替换（默认）或追加；追加时保留你给的 id |
| `fit` | 布尔 | `apply`：写完缩放到新元素，默认 `true` |
| `format` | `png` \| `svg` \| `excalidraw` | `export`，默认 `png` |
| `scale` | 数字 | `export`：像素密度 |
| `background` | 布尔 | `export`：画不画背景色，默认 `true` |
| `file_name` | 字符串 | `export`：文件名 |

返回：

- `read` → `{ok:true, scene}`
- `apply` → `{ok:true, applied:{mode, added, total}, scene}`
- `export` → `{ok:true, path, name, mime}`——字节由插件走「另存为」落盘，路径是真实写出的文件
- 失败 → `{ok:false, error}`，`error` 取值包括 `no-scene-api`（页面里没有 API，通常说明构建没走 shim）、
  `no-elements`、`empty-export`、`save-cancelled`

`export` **不**写入文档自己的保存路径：导出的是图片或另一个文件，不是那张图。

## `excalidraw_act`

参数：`{steps: Step[], stop_on_error?: boolean, probe?: boolean}`，`Step` 的 `op` 取
`click` / `move` / `drag` / `scroll` / `type` / `key` / `wait` / `ready` / `capture` / `label`。

返回：`{ok, steps, captures, elapsedMs, change, probe}`。`change` 含 `meanBefore`/`meanAfter`/`rgbDelta`/
`distance`/`changed`；`distance > 6` 才算画面变了。

## `excalidraw_probe`

参数：`{region?: {x,y,w,h}, columns?, rows?, save?, file_name?}`。

返回：`{cells, cols, rows, mean, meanRgb, contrast, width, height}`；`save:true` 时另存一张 PNG 并返回路径。

## `excalidraw_open_document`

参数：`{path: string, shortcut?: string}`（默认按平台给打开快捷键）。

返回：`{opened, probe, change}`。`opened:false` 表示编辑器没认这个文件或载入超时——如实说，不要假装打开。
