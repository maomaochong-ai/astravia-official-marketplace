# 上游命令与菜单（从 lightcraft 自己的源码导出）

这个文件不是转述，是从上游 lightcraft 仓库的 Rust 源码里读出来的条目：菜单路径、显示名、默认快捷键、
命令 id。判断"这个应用到底有哪些功能、叫什么名字"以这里和编辑器里实际看得到的界面为准，不要凭记忆编。

| 事实 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/storytold/lightcraft |
| 钉住的发布版本 | v0.17.0 |
| 站点来源 | `lightcraft-web-0.17.0.zip`（sha256 `24df2d75857846ae…`） |
| 许可 | Apache-2.0 或 MIT（仓库内 LICENSE-APACHE / LICENSE-MIT） |
| 提取自 | `crates/ui-egui/src/menus*.rs`、`crates/engine/src/cmd/**` 等命令表 |
| 上游自述 | Photo library and raw development; an open-source non-destructive library and raw developer. Culling, develop, scenes and export. |

## 菜单与命令

显示名与快捷键是上游的原文。命令 id 在两点上有用：它说明这条命令存在且是这一层级的正式入口；
面板里没有命令总线，所以**不要**指望把 id 当参数发过去——它是"要找的东西叫什么"的索引。

### View

| Item | Shortcut | Command id |
| --- | --- | --- |
| Fit |  | `view.zoomFit` |
| 100% |  | `view.zoom100` |
| Zoom In |  | `view.zoomIn` |
| Zoom Out |  | `view.zoomOut` |

### Dialogs

| Item | Shortcut | Command id |
| --- | --- | --- |
| Create Album… |  | `dialog.newAlbum` |
| Create Smart Album… |  | `dialog.smartAlbum` |
| Create Smart Album from Filter… |  | `dialog.newSmartAlbum` |
| Create Folder… |  | `dialog.newFolder` |

## 同一源码里出现的其它命令 id

这些是在 `crates/ui-egui/src` 里被点名过的命令，按出现次数排序。菜单表没有收入它们（分布在上下文菜单、
面板命令、快捷键表里），但名字是真的：用它确认某个功能存在，再回到界面上找它的入口。

| 命令 id | 出现次数 |
| --- | --- |
| `ui.clickWidget` | 494 |
| `ui.key` | 339 |
| `ui.set` | 182 |
| `photo.setMeta` | 93 |
| `ui.text` | 92 |
| `develop.set` | 65 |
| `ui.hoverWidget` | 63 |
| `ui.move` | 57 |
| `ui.scroll` | 50 |
| `ui.dialog.confirm` | 50 |
| `edit.undo` | 49 |
| `app.settings` | 47 |
| `ui.click` | 46 |
| `ui.widgets` | 37 |
| `ui.pointer` | 37 |
| `app.openLibrary` | 36 |
| `panel.masking` | 35 |
| `app.newLibrary` | 34 |
| `view.survey` | 34 |
| `file.addPhotos` | 33 |
| `panel.crop` | 32 |
| `view.photoGrid` | 30 |
| `photo.delete` | 29 |
| `ui.drag` | 27 |
| `panel.edit` | 27 |
| `photo.rate` | 26 |
| `dialog.export` | 25 |
| `view.compare` | 25 |
| `view.toolOverlay` | 25 |
| `ui.dragWidget` | 24 |
| `photo.label` | 23 |
| `file.importLightroom` | 23 |
| `view.slideshow` | 23 |
| `app.export` | 22 |
| `view.sidebarSection` | 21 |
| `ui.zoom` | 19 |
| `panel.presets` | 18 |
| `view.softProof` | 18 |
| `view.detail` | 18 |
| `develop.beginInteraction` | 18 |
| `app.openSamModelFolder` | 17 |
| `app.showInFolders` | 17 |
| `view.squareGrid` | 17 |
| `photo.reload` | 16 |
| `photo.setReference` | 16 |
| `develop.endInteraction` | 16 |
| `app.shortcuts` | 16 |
| `ui.inspect` | 15 |
| `app.about` | 14 |
| `panel.remove` | 14 |
| `photo.openOriginalInExternal` | 14 |
| `photo.clearLabel` | 13 |
| `ui.menu.invoke` | 13 |
| `view.people` | 13 |
| `photo.flag` | 13 |
| `app.openLogFolder` | 13 |
| `file.findMissing` | 13 |
| `view.zoomToggle` | 13 |
| `view.maskOverlayColor` | 13 |
| `photo.pick` | 13 |
| `view.person` | 12 |
| `view.gridToggle` | 12 |
| `app.recentLibraries` | 12 |
| `view.fullScreenPreview` | 12 |
| `panel.keywords` | 12 |
| `ui.dialog.cancel` | 11 |
| `app.setShortcut` | 11 |
| `view.leftPanel` | 11 |
| `file.backupLibrary` | 11 |
| `dialog.copySettings` | 11 |


> 这个应用把大部分操作放在画布与面板上，源码里没有一张覆盖全部入口的菜单表，上面列到的是源码里真有的那些。
> 没有列到的功能，以编辑器里实际看得到的界面为准；不要因为这份表里没有就断言功能不存在。

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
