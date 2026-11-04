# 上游命令与菜单（从 designcraft 自己的源码导出）

这个文件不是转述，是从上游 designcraft 仓库的 Rust 源码里读出来的条目：菜单路径、显示名、默认快捷键、
命令 id。判断"这个应用到底有哪些功能、叫什么名字"以这里和编辑器里实际看得到的界面为准，不要凭记忆编。

| 事实 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/storytold/designcraft |
| 钉住的发布版本 | v0.16.0 |
| 站点来源 | `designcraft-web-0.16.0.zip`（sha256 `1e74074b32d59185…`） |
| 许可 | Apache-2.0 或 MIT（仓库内 LICENSE-APACHE / LICENSE-MIT） |
| 提取自 | `crates/ui-egui/src/menus*.rs`、`crates/engine/src/cmd/**` 等命令表 |
| 上游自述 | Page layout and publishing; an open-source desktop publishing studio. Frames, stories, styles, master pages and print-ready export. |

## 菜单与命令

显示名与快捷键是上游的原文。命令 id 在两点上有用：它说明这条命令存在且是这一层级的正式入口；
面板里没有命令总线，所以**不要**指望把 id 当参数发过去——它是"要找的东西叫什么"的索引。

### File

| Item | Shortcut | Command id |
| --- | --- | --- |
| — |  | `file.clearRecent` |
| — |  | `file.close` |
| — |  | `file.revert` |
| — |  | `file.info` |
| — |  | `file.newSample` |

### Edit

| Item | Shortcut | Command id |
| --- | --- | --- |
| — |  | `edit.stepAndRepeat` |
| — |  | `edit.undo` |
| — |  | `edit.redo` |
| — |  | `edit.cut` |
| — |  | `edit.copy` |
| — |  | `edit.paste` |
| — |  | `edit.pasteInto` |
| — |  | `edit.pasteInPlace` |
| — |  | `edit.pasteWithoutFormatting` |
| — |  | `edit.selectAll` |
| — |  | `edit.clear` |
| — |  | `edit.duplicate` |
| — |  | `edit.deselectAll` |
| — |  | `edit.dynamicSpelling` |

### View

| Item | Shortcut | Command id |
| --- | --- | --- |
| rulers |  | `view.rulers` |
| frameEdges |  | `view.frameEdges` |
| guides |  | `view.guides` |
| baselineGrid |  | `view.baselineGrid` |
| documentGrid |  | `view.documentGrid` |
| textThreads |  | `view.textThreads` |
| — |  | `view.hiddenCharacters` |
| — |  | `view.zoomIn` |
| — |  | `view.zoomOut` |
| — |  | `view.fitPage` |
| — |  | `view.fitSpread` |
| — |  | `view.actualSize` |
| — |  | `view.firstPage` |
| — |  | `view.previousPage` |
| — |  | `view.nextPage` |
| — |  | `view.lastPage` |
| — |  | `view.nextSpread` |
| — |  | `view.previousSpread` |
| — |  | `view.goToPage` |
| — |  | `view.goBack` |
| — |  | `view.goForward` |
| — |  | `view.overprintPreview` |
| — |  | `view.proofColors` |
| — |  | `view.flattenerPreview` |
| — |  | `view.fitSelection` |
| — |  | `view.entirePasteboard` |
| — |  | `view.fastDisplay` |
| — |  | `view.typicalDisplay` |
| — |  | `view.highQualityDisplay` |
| — |  | `view.lockGuides` |
| — |  | `view.lockColumnGuides` |
| — |  | `view.snapToGuides` |
| — |  | `view.snapToDocumentGrid` |
| — |  | `view.smartGuides` |
| — |  | `view.taggedFrames` |
| — |  | `view.tagMarkers` |
| — |  | `view.storyEditorDepthRuler` |

### Select

| Item | Shortcut | Command id |
| --- | --- | --- |
| — |  | `select.firstAbove` |
| — |  | `select.nextAbove` |
| — |  | `select.nextBelow` |
| — |  | `select.lastBelow` |
| — |  | `select.container` |
| — |  | `select.content` |
| — |  | `select.previousInGroup` |
| — |  | `select.nextInGroup` |

### Type

| Item | Shortcut | Command id |
| --- | --- | --- |
| — |  | `type.fillWithPlaceholder` |
| — |  | `type.createOutlines` |
| — |  | `type.pathOptions` |
| — |  | `type.tateChuYoko` |
| — |  | `type.kenten` |
| — |  | `type.warichu` |

### Table

| Item | Shortcut | Command id |
| --- | --- | --- |
| — |  | `table.insertRowAbove` |
| — |  | `table.insertRowBelow` |
| — |  | `table.insertColumnLeft` |
| — |  | `table.insertColumnRight` |
| — |  | `table.deleteRow` |
| — |  | `table.deleteColumn` |
| — |  | `table.delete` |
| — |  | `table.selectRow` |
| — |  | `table.selectColumn` |
| — |  | `table.selectTable` |
| — |  | `table.merge` |
| — |  | `table.unmerge` |
| — |  | `table.splitHorizontally` |
| — |  | `table.splitVertically` |
| — |  | `table.textCell` |
| — |  | `table.convertRowsToHeader` |
| — |  | `table.convertRowsToBody` |
| — |  | `table.convertRowsToFooter` |
| — |  | `table.distributeRows` |
| — |  | `table.distributeColumns` |

### Object

| Item | Shortcut | Command id |
| --- | --- | --- |
| — |  | `object.cornerOptions` |
| textWrap |  | `object.textWrap` |
| — |  | `object.group` |
| — |  | `object.ungroup` |
| — |  | `object.lock` |
| — |  | `object.unlockAll` |
| — |  | `object.hide` |
| — |  | `object.showAll` |
| — |  | `object.textFrameOptions` |
| — |  | `object.bringToFront` |
| — |  | `object.bringForward` |
| — |  | `object.sendBackward` |
| — |  | `object.sendToBack` |
| — |  | `object.primaryTextFrame` |
| — |  | `object.clearFittingOptions` |
| — |  | `object.dropShadow` |
| — |  | `object.innerShadow` |
| — |  | `object.outerGlow` |
| — |  | `object.innerGlow` |
| — |  | `object.bevel` |
| — |  | `object.satin` |
| — |  | `object.feather` |
| — |  | `object.directionalFeather` |
| — |  | `object.exportOptions` |
| — |  | `object.caption` |
| — |  | `object.makeCompoundPath` |
| — |  | `object.releaseCompoundPath` |

### Path

| Item | Shortcut | Command id |
| --- | --- | --- |
| — |  | `path.join` |
| — |  | `path.reverse` |

### Window

| Item | Shortcut | Command id |
| --- | --- | --- |
| — |  | `window.newWindow` |
| — |  | `window.split` |
| — |  | `window.nextDocument` |
| — |  | `window.previousDocument` |
| — |  | `window.workspace` |
| — |  | `window.taskBar` |
| — |  | `window.controlBar` |
| — |  | `window.hidePanels` |
| — |  | `window.hidePanelsExceptTools` |
| — |  | `window.toolsDoubleColumn` |
| — |  | `window.brightness` |
| — |  | `window.panel` |

### Help

| Item | Shortcut | Command id |
| --- | --- | --- |
| DesignCraft page |  | `help.appPage` |
| GitHub |  | `help.github` |
| getartcraft.com |  | `help.website` |
| — |  | `help.discord` |
| — |  | `help.issues` |
| — |  | `help.checkForUpdates` |
| — |  | `help.about` |

### Application

| Item | Shortcut | Command id |
| --- | --- | --- |
| character |  | `app.characterPanel` |
| paragraph |  | `app.paragraphPanel` |
| glyphs |  | `app.glyphsPanel` |
| characterStyles |  | `app.characterStylesPanel` |
| paragraphStyles |  | `app.paragraphStylesPanel` |
| table |  | `app.tablePanel` |
| — |  | `app.storyEditor` |
| — |  | `app.newDocumentDialog` |
| — |  | `app.openDialog` |
| — |  | `app.save` |
| — |  | `app.saveDialog` |
| — |  | `app.saveCopyDialog` |
| — |  | `app.placeDialog` |
| — |  | `app.placeWithOptions` |
| — |  | `app.exportPdf` |
| — |  | `app.packageDialog` |
| — |  | `app.printBooklet` |
| — |  | `app.exportPng` |
| — |  | `app.exportIdml` |
| — |  | `app.exportEpub` |
| — |  | `app.exportFixedEpub` |
| — |  | `app.exportInteractivePdf` |
| — |  | `app.exportHtml` |
| — |  | `app.exportPptx` |
| — |  | `app.exportXml` |
| — |  | `app.exportText` |
| — |  | `app.quit` |
| — |  | `app.placeAndLink` |
| — |  | `app.findChange` |
| — |  | `app.userDictionary` |
| — |  | `app.colorSettings` |
| — |  | `app.palette` |
| … | | |


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
