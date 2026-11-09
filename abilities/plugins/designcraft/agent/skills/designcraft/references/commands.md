# 命令表（designcraft）

这张表由同目录的 `upstream.md` 生成——每一条都是上游版本里真实存在的功能，没有一条是凭记忆写的。
两列直接就是参数：`快捷键` 填进 `designcraft_menu` 的 `shortcut`，`path` 填进 `path`（照抄，含省略号）。

先查这张表，再决定要不要碰坐标。表里没有的功能，说明这一版上游没有。

## File

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| — | — | `["File","—"]` | `file.clearRecent` |
| — | — | `["File","—"]` | `file.close` |
| — | — | `["File","—"]` | `file.revert` |
| — | — | `["File","—"]` | `file.info` |
| — | — | `["File","—"]` | `file.newSample` |

## Edit

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| — | — | `["Edit","—"]` | `edit.stepAndRepeat` |
| — | — | `["Edit","—"]` | `edit.undo` |
| — | — | `["Edit","—"]` | `edit.redo` |
| — | — | `["Edit","—"]` | `edit.cut` |
| — | — | `["Edit","—"]` | `edit.copy` |
| — | — | `["Edit","—"]` | `edit.paste` |
| — | — | `["Edit","—"]` | `edit.pasteInto` |
| — | — | `["Edit","—"]` | `edit.pasteInPlace` |
| — | — | `["Edit","—"]` | `edit.pasteWithoutFormatting` |
| — | — | `["Edit","—"]` | `edit.selectAll` |
| — | — | `["Edit","—"]` | `edit.clear` |
| — | — | `["Edit","—"]` | `edit.duplicate` |
| — | — | `["Edit","—"]` | `edit.deselectAll` |
| — | — | `["Edit","—"]` | `edit.dynamicSpelling` |

## View

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| rulers | — | `["View","rulers"]` | `view.rulers` |
| frameEdges | — | — | `view.frameEdges` |
| guides | — | `["View","guides"]` | `view.guides` |
| baselineGrid | — | — | `view.baselineGrid` |
| documentGrid | — | — | `view.documentGrid` |
| textThreads | — | — | `view.textThreads` |
| — | — | `["View","—"]` | `view.hiddenCharacters` |
| — | — | `["View","—"]` | `view.zoomIn` |
| — | — | `["View","—"]` | `view.zoomOut` |
| — | — | `["View","—"]` | `view.fitPage` |
| — | — | `["View","—"]` | `view.fitSpread` |
| — | — | `["View","—"]` | `view.actualSize` |
| — | — | `["View","—"]` | `view.firstPage` |
| — | — | `["View","—"]` | `view.previousPage` |
| — | — | `["View","—"]` | `view.nextPage` |
| — | — | `["View","—"]` | `view.lastPage` |
| — | — | `["View","—"]` | `view.nextSpread` |
| — | — | `["View","—"]` | `view.previousSpread` |
| — | — | `["View","—"]` | `view.goToPage` |
| — | — | `["View","—"]` | `view.goBack` |
| — | — | `["View","—"]` | `view.goForward` |
| — | — | `["View","—"]` | `view.overprintPreview` |
| — | — | `["View","—"]` | `view.proofColors` |
| — | — | `["View","—"]` | `view.flattenerPreview` |
| — | — | `["View","—"]` | `view.fitSelection` |
| — | — | `["View","—"]` | `view.entirePasteboard` |
| — | — | `["View","—"]` | `view.fastDisplay` |
| — | — | `["View","—"]` | `view.typicalDisplay` |
| — | — | `["View","—"]` | `view.highQualityDisplay` |
| — | — | `["View","—"]` | `view.lockGuides` |
| — | — | `["View","—"]` | `view.lockColumnGuides` |
| — | — | `["View","—"]` | `view.snapToGuides` |
| — | — | `["View","—"]` | `view.snapToDocumentGrid` |
| — | — | `["View","—"]` | `view.smartGuides` |
| — | — | `["View","—"]` | `view.taggedFrames` |
| — | — | `["View","—"]` | `view.tagMarkers` |
| — | — | `["View","—"]` | `view.storyEditorDepthRuler` |

## Select

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| — | — | `["Select","—"]` | `select.firstAbove` |
| — | — | `["Select","—"]` | `select.nextAbove` |
| — | — | `["Select","—"]` | `select.nextBelow` |
| — | — | `["Select","—"]` | `select.lastBelow` |
| — | — | `["Select","—"]` | `select.container` |
| — | — | `["Select","—"]` | `select.content` |
| — | — | `["Select","—"]` | `select.previousInGroup` |
| — | — | `["Select","—"]` | `select.nextInGroup` |

## Type

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| — | — | `["Type","—"]` | `type.fillWithPlaceholder` |
| — | — | `["Type","—"]` | `type.createOutlines` |
| — | — | `["Type","—"]` | `type.pathOptions` |
| — | — | `["Type","—"]` | `type.tateChuYoko` |
| — | — | `["Type","—"]` | `type.kenten` |
| — | — | `["Type","—"]` | `type.warichu` |

## Table

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| — | — | `["Table","—"]` | `table.insertRowAbove` |
| — | — | `["Table","—"]` | `table.insertRowBelow` |
| — | — | `["Table","—"]` | `table.insertColumnLeft` |
| — | — | `["Table","—"]` | `table.insertColumnRight` |
| — | — | `["Table","—"]` | `table.deleteRow` |
| — | — | `["Table","—"]` | `table.deleteColumn` |
| — | — | `["Table","—"]` | `table.delete` |
| — | — | `["Table","—"]` | `table.selectRow` |
| — | — | `["Table","—"]` | `table.selectColumn` |
| — | — | `["Table","—"]` | `table.selectTable` |
| — | — | `["Table","—"]` | `table.merge` |
| — | — | `["Table","—"]` | `table.unmerge` |
| — | — | `["Table","—"]` | `table.splitHorizontally` |
| — | — | `["Table","—"]` | `table.splitVertically` |
| — | — | `["Table","—"]` | `table.textCell` |
| — | — | `["Table","—"]` | `table.convertRowsToHeader` |
| — | — | `["Table","—"]` | `table.convertRowsToBody` |
| — | — | `["Table","—"]` | `table.convertRowsToFooter` |
| — | — | `["Table","—"]` | `table.distributeRows` |
| — | — | `["Table","—"]` | `table.distributeColumns` |

## Object

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| — | — | `["Object","—"]` | `object.cornerOptions` |
| textWrap | — | — | `object.textWrap` |
| — | — | `["Object","—"]` | `object.group` |
| — | — | `["Object","—"]` | `object.ungroup` |
| — | — | `["Object","—"]` | `object.lock` |
| — | — | `["Object","—"]` | `object.unlockAll` |
| — | — | `["Object","—"]` | `object.hide` |
| — | — | `["Object","—"]` | `object.showAll` |
| — | — | `["Object","—"]` | `object.textFrameOptions` |
| — | — | `["Object","—"]` | `object.bringToFront` |
| — | — | `["Object","—"]` | `object.bringForward` |
| — | — | `["Object","—"]` | `object.sendBackward` |
| — | — | `["Object","—"]` | `object.sendToBack` |
| — | — | `["Object","—"]` | `object.primaryTextFrame` |
| — | — | `["Object","—"]` | `object.clearFittingOptions` |
| — | — | `["Object","—"]` | `object.dropShadow` |
| — | — | `["Object","—"]` | `object.innerShadow` |
| — | — | `["Object","—"]` | `object.outerGlow` |
| — | — | `["Object","—"]` | `object.innerGlow` |
| — | — | `["Object","—"]` | `object.bevel` |
| — | — | `["Object","—"]` | `object.satin` |
| — | — | `["Object","—"]` | `object.feather` |
| — | — | `["Object","—"]` | `object.directionalFeather` |
| — | — | `["Object","—"]` | `object.exportOptions` |
| — | — | `["Object","—"]` | `object.caption` |
| — | — | `["Object","—"]` | `object.makeCompoundPath` |
| — | — | `["Object","—"]` | `object.releaseCompoundPath` |

## Path

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| — | — | `["Path","—"]` | `path.join` |
| — | — | `["Path","—"]` | `path.reverse` |

## Window

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| — | — | `["Window","—"]` | `window.newWindow` |
| — | — | `["Window","—"]` | `window.split` |
| — | — | `["Window","—"]` | `window.nextDocument` |
| — | — | `["Window","—"]` | `window.previousDocument` |
| — | — | `["Window","—"]` | `window.workspace` |
| — | — | `["Window","—"]` | `window.taskBar` |
| — | — | `["Window","—"]` | `window.controlBar` |
| — | — | `["Window","—"]` | `window.hidePanels` |
| — | — | `["Window","—"]` | `window.hidePanelsExceptTools` |
| — | — | `["Window","—"]` | `window.toolsDoubleColumn` |
| — | — | `["Window","—"]` | `window.brightness` |
| — | — | `["Window","—"]` | `window.panel` |

## Help

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| DesignCraft page | — | `["Help","DesignCraft page"]` | `help.appPage` |
| GitHub | — | — | `help.github` |
| getartcraft.com | — | — | `help.website` |
| — | — | `["Help","—"]` | `help.discord` |
| — | — | `["Help","—"]` | `help.issues` |
| — | — | `["Help","—"]` | `help.checkForUpdates` |
| — | — | `["Help","—"]` | `help.about` |

## Application

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| character | — | `["Application","character"]` | `app.characterPanel` |
| paragraph | — | `["Application","paragraph"]` | `app.paragraphPanel` |
| glyphs | — | `["Application","glyphs"]` | `app.glyphsPanel` |
| characterStyles | — | — | `app.characterStylesPanel` |
| paragraphStyles | — | — | `app.paragraphStylesPanel` |
| table | — | `["Application","table"]` | `app.tablePanel` |
| — | — | `["Application","—"]` | `app.storyEditor` |
| — | — | `["Application","—"]` | `app.newDocumentDialog` |
| — | — | `["Application","—"]` | `app.openDialog` |
| — | — | `["Application","—"]` | `app.save` |
| — | — | `["Application","—"]` | `app.saveDialog` |
| — | — | `["Application","—"]` | `app.saveCopyDialog` |
| — | — | `["Application","—"]` | `app.placeDialog` |
| — | — | `["Application","—"]` | `app.placeWithOptions` |
| — | — | `["Application","—"]` | `app.exportPdf` |
| — | — | `["Application","—"]` | `app.packageDialog` |
| — | — | `["Application","—"]` | `app.printBooklet` |
| — | — | `["Application","—"]` | `app.exportPng` |
| — | — | `["Application","—"]` | `app.exportIdml` |
| — | — | `["Application","—"]` | `app.exportEpub` |
| — | — | `["Application","—"]` | `app.exportFixedEpub` |
| — | — | `["Application","—"]` | `app.exportInteractivePdf` |
| — | — | `["Application","—"]` | `app.exportHtml` |
| — | — | `["Application","—"]` | `app.exportPptx` |
| — | — | `["Application","—"]` | `app.exportXml` |
| — | — | `["Application","—"]` | `app.exportText` |
| — | — | `["Application","—"]` | `app.quit` |
| — | — | `["Application","—"]` | `app.placeAndLink` |
| — | — | `["Application","—"]` | `app.findChange` |
| — | — | `["Application","—"]` | `app.userDictionary` |
| — | — | `["Application","—"]` | `app.colorSettings` |
| — | — | `["Application","—"]` | `app.palette` |

