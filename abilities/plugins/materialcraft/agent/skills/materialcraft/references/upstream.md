# 上游命令与菜单（从 materialcraft 自己的源码导出）

这个文件不是转述，是从上游 materialcraft 仓库的 Rust 源码里读出来的条目：菜单路径、显示名、默认快捷键、
命令 id。判断"这个应用到底有哪些功能、叫什么名字"以这里和编辑器里实际看得到的界面为准，不要凭记忆编。

| 事实 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/storytold/materialcraft |
| 钉住的发布版本 | v0.1.0 |
| 站点来源 | `materialcraft-web-0.1.0.zip`（sha256 `b9362c39f0d5523a…`） |
| 许可 | Apache-2.0 或 MIT（仓库内 LICENSE-APACHE / LICENSE-MIT） |
| 提取自 | `crates/ui-egui/src/menus*.rs`、`crates/engine/src/cmd/**` 等命令表 |
| 上游自述 | Procedural materials; an open-source node-based material designer. Node graphs, functions, previews and exports. |

## 菜单与命令

显示名与快捷键是上游的原文。命令 id 在两点上有用：它说明这条命令存在且是这一层级的正式入口；
面板里没有命令总线，所以**不要**指望把 id 当参数发过去——它是"要找的东西叫什么"的索引。

### File

| Item | Shortcut | Command id |
| --- | --- | --- |
| Open... | Ctrl+O | `file.open` |
| Save | Ctrl+S | `file.save` |
| Save as... | Ctrl+Shift+S | `file.saveAs` |
| Close all |  | `ui.closeAll` |
| Import bitmap... |  | `file.importBitmap` |
| Export outputs... | Ctrl+Shift+E | `ui.export` |
| Export material... |  | `file.exportMaterial` |
| Send to TextureCraft |  | `file.sendToTextureCraft` |
| Reload resources |  | `ui.reloadResources` |
| Exit | Ctrl+Q | `ui.quit` |

### File › New

| Item | Shortcut | Command id |
| --- | --- | --- |
| Graph... | Ctrl+N | `ui.newGraph` |
| Function graph |  | `ui.newFunctionGraph` |
| Empty package |  | `file.newPackage` |

### Edit

| Item | Shortcut | Command id |
| --- | --- | --- |
| Undo | Ctrl+Z | `edit.undo` |
| Redo | Ctrl+Y | `edit.redo` |
| Copy | Ctrl+C | `edit.copy` |
| Cut | Ctrl+X | `edit.cut` |
| Paste | Ctrl+V | `edit.paste` |
| Duplicate | Ctrl+D | `edit.duplicate` |
| Delete | Delete | `edit.delete` |
| Delete and relink | Backspace | `edit.deleteRelink` |
| Select all | Ctrl+A | `edit.selectAll` |
| Preferences... |  | `ui.preferences` |

### Tools

| Item | Shortcut | Command id |
| --- | --- | --- |
| Compute graph | F5 | `graph.cook` |
| Clear cache |  | `ui.clearCache` |
| Create graph from selection |  | `graph.createFromSelection` |

### Tools › Preview size

| Item | Shortcut | Command id |
| --- | --- | --- |
| 256 px |  | `ui.preview.256` |
| 512 px |  | `ui.preview.512` |
| 1024 px |  | `ui.preview.1024` |
| 2048 px |  | `ui.preview.2048` |
| Full size |  | `ui.preview.0` |

### Help

| Item | Shortcut | Command id |
| --- | --- | --- |
| Home screen... |  | `ui.home` |
| Documentation... |  | `ui.help.docs` |
| Shortcuts list... |  | `ui.help.shortcuts` |
| Join the community (Discord)... |  | `ui.help.discord` |
| ArtCraft website... |  | `ui.help.website` |
| Report a bug... |  | `ui.help.bug` |
| About MaterialCraft... |  | `ui.about` |

### Windows

| Item | Shortcut | Command id |
| --- | --- | --- |
| Explorer |  | `ui.view.explorer` |
| Graph |  | `ui.view.graph` |
| Properties |  | `ui.view.properties` |
| Console |  | `ui.view.console` |
| 3D View |  | `ui.view.3d` |
| 2D View |  | `ui.view.2d` |
| Library |  | `ui.view.library` |
| History |  | `ui.view.history` |
| Reset layout |  | `ui.resetLayout` |


## 这些名字在面板里怎么用

- **菜单路径**（如 `File › Export`）对应编辑器顶部或 ribbon 上的同名分区，按路径点进去，坐标用 `probe` 读。
- **快捷键**里的 `Mod+` 是 Ctrl，macOS 上是 ⌘；面板收到的就是按键事件，写成 `act` 的
  `{"op":"key","key":"ctrl+o"}`（小写、用 `+` 连接）能直达同一条命令。
- **命令 id** 只作索引：确认功能是否存在、它归在哪个菜单下、上游给它配了什么键。
- 上游有些命令在网页构建里是禁用的（依赖本地文件系统、原生菜单、打印、外部程序）。点了没反应先怀疑这个，
  不要连点第三次。

## 边界

上游桌面版有一套控制协议（`127.0.0.1` 上的 JSON 行协议 + MCP 桥），网页构建**不暴露**它：页面里没有命令总线，
也没有可注入的执行入口。所以在 Astravia 里驱动编辑器只有两条真实通道——合成指针/键盘事件（`act`）
和读画布（`probe`）。打开与保存文件走插件自己的桥（`craft:stage` + Ctrl+O、以及下载接缝），
最近打开的文件由插件状态栏自己维护，因为上游泳的 Recent 列表在网页构建里按路径重开会直接失败。
