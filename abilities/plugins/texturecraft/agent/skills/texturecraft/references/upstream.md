# 上游命令与菜单（从 texturecraft 自己的源码导出）

这个文件不是转述，是从上游 texturecraft 仓库的 Rust 源码里读出来的条目：菜单路径、显示名、默认快捷键、
命令 id。判断"这个应用到底有哪些功能、叫什么名字"以这里和编辑器里实际看得到的界面为准，不要凭记忆编。

| 事实 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/storytold/texturecraft |
| 钉住的发布版本 | v0.3.0 |
| 站点来源 | `texturecraft-web-0.3.0.zip`（sha256 `b6229b1b75c2d007…`） |
| 许可 | Apache-2.0 或 MIT（仓库内 LICENSE-APACHE / LICENSE-MIT） |
| 提取自 | `crates/ui-egui/src/menus*.rs`、`crates/engine/src/cmd/**` 等命令表 |
| 上游自述 | 3D texture painting; an open-source texture painting application. Layers, brushes, bakes, materials and PBR channels. |

## 菜单与命令

显示名与快捷键是上游的原文。命令 id 在两点上有用：它说明这条命令存在且是这一层级的正式入口；
面板里没有命令总线，所以**不要**指望把 id 当参数发过去——它是"要找的东西叫什么"的索引。

### File

| Item | Shortcut | Command id |
| --- | --- | --- |
| New project... | Ctrl+N | `ui.newProject` |
| Open... | Ctrl+O | `file.open` |
| Open sample project... |  | `project.sample` |
| Close | Ctrl+F4 | `file.close` |
| Save | Ctrl+S | `file.save` |
| Save as... | Ctrl+Shift+S | `file.saveAs` |
| Save a copy... |  | `file.saveCopy` |
| Remove unused resources... |  | `file.removeUnused` |
| Import resources... |  | `resource.import` |
| Import MaterialX material... |  | `file.importMaterialX` |
| Import material... |  | `material.load` |
| Export Textures... | Ctrl+Shift+E | `ui.export` |
| Export Mesh... |  | `file.exportMesh` |
| Quit | Ctrl+Q | `ui.quit` |

### Edit

| Item | Shortcut | Command id |
| --- | --- | --- |
| Undo | Ctrl+Z | `edit.undo` |
| Redo | Ctrl+Y | `edit.redo` |
| Project Configuration... |  | `ui.projectConfig` |
| Reimport mesh | Ctrl+Shift+R | `file.reimportMesh` |
| Settings... |  | `ui.settings` |

### Window

| Item | Shortcut | Command id |
| --- | --- | --- |
| Load UI Layout |  | `ui.layout.load` |
| Hide UI | Tab | `ui.hideUi` |
| Reset UI |  | `ui.resetUi` |

### Window › Save UI Layout

| Item | Shortcut | Command id |
| --- | --- | --- |
| Save current layout... |  | `ui.layout.save` |

### Window › Views

| Item | Shortcut | Command id |
| --- | --- | --- |
| Assets |  | `ui.view.assets` |
| Display Settings |  | `ui.view.display` |
| History |  | `ui.view.history` |
| Layers |  | `ui.view.layers` |
| Log |  | `ui.view.log` |
| Properties |  | `ui.view.properties` |
| Shader Settings |  | `ui.view.shader` |
| Texture Set List |  | `ui.view.textureSetList` |
| Texture Set Settings |  | `ui.view.textureSetSettings` |

### Help

| Item | Shortcut | Command id |
| --- | --- | --- |
| Documentation... |  | `ui.help.docs` |
| Shortcuts list... |  | `ui.help.shortcuts` |
| Join the community (Discord)... |  | `ui.help.discord` |
| ArtCraft website... |  | `ui.help.website` |
| Report a bug... |  | `ui.help.bug` |
| About TextureCraft... |  | `ui.about` |

### Mode

| Item | Shortcut | Command id |
| --- | --- | --- |
| Bake Mesh Maps | F8 | `ui.mode.bake` |
| Painting | F9 | `ui.mode.paint` |
| Rendering (path traced) | F10 | `ui.mode.render` |

### Viewport

| Item | Shortcut | Command id |
| --- | --- | --- |
| Display material | M | `viewport.displayMaterial` |
| Display next channel | C | `viewport.nextChannel` |
| Display previous channel | Shift+C | `viewport.previousChannel` |
| Display next mesh map | B | `viewport.nextMeshMap` |
| Display previous mesh map | Shift+B | `viewport.previousMeshMap` |
| UV checker |  | `ui.uvChecker` |
| Show entire mesh | F | `viewport.frame` |
| 3D/2D views | F1 | `ui.layout.split` |
| 3D view only | F2 | `ui.layout.3d` |
| 2D view only | F3 | `ui.layout.2d` |
| Enable quick mask | Y | `viewport.quickMask` |
| Edit quick mask | U | `viewport.quickMask.edit` |
| Invert quick mask | Ctrl+Shift+I | `viewport.quickMask.invert` |


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
