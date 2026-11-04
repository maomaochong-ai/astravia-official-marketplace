# 快捷键与工具

来源：`packages/excalidraw/components/Tools.tsx:69-160`（工具键）与
`packages/excalidraw/actions/shortcuts.ts:60-115`（动作键）。`CtrlOrCmd` 在 macOS 上是 `Cmd`，插件侧把 `ctrl`
统一翻成 `cmd`。

## 工具键

| 类型 | 字母 | 数字 |
| --- | --- | --- |
| 手形 `hand` | `h` | — |
| 选择 `selection` | `v` | `1` |
| 矩形 `rectangle` | `r` | `2` |
| 菱形 `diamond` | `d` | `3` |
| 椭圆 `ellipse` | `o` | `4` |
| 箭头 `arrow` | `a` | `5` |
| 线 `line` | `l` | `6` |
| 画笔 `freedraw` | `p` 或 `x` | `7` |
| 文字 `text` | `t` | `8` |
| 便签 `stickynote` | `n` | — |
| 图片 `image` | — | `9` |
| 橡皮 `eraser` | `e` | `0` |
| frame | `f` | — |
| 智能形状 `autoshape` | `Shift+X` | — |
| 激光笔 `laser` | `k` | — |
| 油漆桶 `bucketfill` | `b` | — |

`autoshape` 需要 Shift（`Tools.tsx:139-144`），`freedraw` 同时接受 `p` 和 `x`（`Tools.tsx:111-115`）。

## 动作键

| 动作 | 键 |
| --- | --- |
| 撤销 / 重做 | `CtrlOrCmd+Z` / `CtrlOrCmd+Shift+Z` |
| 全选 | `CtrlOrCmd+A` |
| 删除选中 | `Delete` |
| 复制选中 | `CtrlOrCmd+D` |
| 复制 / 粘贴 | `CtrlOrCmd+C` / `CtrlOrCmd+V` |
| 复制样式 / 粘贴样式 | `CtrlOrCmd+Alt+C` / `CtrlOrCmd+Alt+V` |
| 分组 / 解组 | `CtrlOrCmd+G` / `CtrlOrCmd+Shift+G` |
| 层次 | `CtrlOrCmd+[` 下移、`CtrlOrCmd+]` 上移、`CtrlOrCmd+Alt+[` 置底、`CtrlOrCmd+Alt+]` 置顶（非 mac 用 `Shift`） |
| 复位缩放 | `CtrlOrCmd+0` |
| 缩放至全部 / 选区 / 选区占满视口 | `Shift+1` / `Shift+3` / `Shift+2` |
| 禅模式 | `Alt+Z` |
| 网格 | `CtrlOrCmd+'` |
| 对象吸附 | `Alt+S` |
| 视图模式 | `Alt+R` |
| 超链接 | `CtrlOrCmd+K` |
| 锁定 / 解锁元素 | `CtrlOrCmd+Shift+L` |
| 搜索菜单 | `CtrlOrCmd+F` |
| 命令面板 | `CtrlOrCmd+/` 或 `CtrlOrCmd+Shift+P` |
| 快捷键帮助 | `?` |

`CtrlOrCmd+S` 在应用里绑的是保存场景（`shortcutMap.saveScene`），在桌面端由插件自己的保存通道负责落盘，
不要指望它写文件。

## 何时不用键

工具栏切不过去时（例如工具被禁用、或某个工具需要先有选区），改用菜单或 `excalidraw_scene` 直接写元素。
连续两次同样形状的尝试失败就换方法，不要试第三个变体。
