# 上游命令与菜单（从 vectorcraft 自己的源码导出）

这个文件不是转述，是从上游 vectorcraft 仓库的 Rust 源码里读出来的条目：菜单路径、显示名、默认快捷键、
命令 id。判断"这个应用到底有哪些功能、叫什么名字"以这里和编辑器里实际看得到的界面为准，不要凭记忆编。

| 事实 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/storytold/vectorcraft |
| 钉住的发布版本 | v0.20.0 |
| 站点来源 | `vectorcraft-web-0.20.0.zip`（sha256 `47c98c485ec14942…`） |
| 许可 | Apache-2.0 或 MIT（仓库内 LICENSE-APACHE / LICENSE-MIT） |
| 提取自 | `crates/ui-egui/src/menus*.rs`、`crates/engine/src/cmd/**` 等命令表 |
| 上游自述 | Vector illustration; an open-source vector art application. Paths, bool operations, gradients, blends and SVG. |

## 菜单与命令

显示名与快捷键是上游的原文。命令 id 在两点上有用：它说明这条命令存在且是这一层级的正式入口；
面板里没有命令总线，所以**不要**指望把 id 当参数发过去——它是"要找的东西叫什么"的索引。

### File

| Item | Shortcut | Command id |
| --- | --- | --- |
| object.convertDocumentColorMode |  | `file.documentColorMode` |
| art.pdf |  | `file.saveAs` |
| Export Selection… |  | `file.exportSelection` |
| New… |  | `file.newDialog` |
| New from Template… |  | `file.newFromTemplate` |
| Open… |  | `file.open` |
| Clear Recent Files |  | `file.clearRecent` |
| Show in Folder |  | `file.reveal` |
| Close |  | `file.close` |
| Close All |  | `file.closeAll` |
| Save |  | `file.save` |
| Save a Copy… |  | `file.saveCopy` |
| Save as Template… |  | `file.saveAsTemplate` |
| Revert |  | `file.revert` |
| Place… |  | `file.place` |
| Export for Screens… |  | `file.exportForScreens` |
| Export As… |  | `file.exportAs` |
| Save for Web (Legacy)… |  | `file.saveForWeb` |
| Document Setup… |  | `file.documentSetup` |
| File Info… |  | `file.info` |
| Print… |  | `file.print` |

### Edit

| Item | Shortcut | Command id |
| --- | --- | --- |
| Undo |  | `edit.undo` |
| Redo |  | `edit.redo` |
| Paste |  | `edit.paste` |
| Cut |  | `edit.cut` |
| Copy |  | `edit.copy` |
| Paste in Front |  | `edit.pasteInFront` |
| Paste in Back |  | `edit.pasteInBack` |
| Paste in Place |  | `edit.pasteInPlace` |
| Paste on All Artboards |  | `edit.pasteOnAllArtboards` |
| Paste without Formatting |  | `edit.pasteWithoutFormatting` |
| Clear |  | `edit.clear` |
| Blend Front to Back |  | `edit.colors.blendFrontToBack` |
| Blend Horizontally |  | `edit.colors.blendHorizontally` |
| Blend Vertically |  | `edit.colors.blendVertically` |
| Convert to CMYK |  | `edit.colors.toCMYK` |
| Convert to Grayscale |  | `edit.colors.toGrayscale` |
| Convert to RGB |  | `edit.colors.toRGB` |
| Invert Colors |  | `edit.colors.invert` |
| Color Settings… |  | `edit.colorSettings` |
| Assign Profile… |  | `edit.assignProfile` |
| Keyboard Shortcuts… |  | `edit.keyboardShortcuts` |
| Preferences… |  | `edit.preferences` |

### View

| Item | Shortcut | Command id |
| --- | --- | --- |
| rulers |  | `view.rulers` |
| outline |  | `view.outline` |
| grid |  | `view.grid` |
| smartGuides |  | `view.smartGuides` |
| boundingBox |  | `view.boundingBox` |
| Zoom In |  | `view.zoomIn` |
| Zoom Out |  | `view.zoomOut` |
| Fit Artboard in Window |  | `view.fitArtboard` |
| Hide Guides |  | `view.guides` |
| Lock Guides |  | `view.guides.lock` |
| Make Guides |  | `view.guides.make` |
| Overprint Preview |  | `view.overprintPreview` |
| Pixel Preview |  | `view.pixelPreview` |
| Trim View |  | `view.trimView` |
| Presentation Mode |  | `view.presentation` |
| Proof Colors |  | `view.proofColors` |
| Fit All in Window |  | `view.fitAll` |
| Actual Size |  | `view.actualSize` |
| Rotate View to Selection |  | `view.rotateToSelection` |
| Reset Rotate View |  | `view.rotateReset` |
| Hide Edges |  | `view.edges` |
| Hide Artboards |  | `view.artboards` |
| Show Print Tiling |  | `view.printTiling` |
| Hide Slices |  | `view.slices.hide` |
| Lock Slices |  | `view.slices.lock` |
| Hide Template |  | `view.template` |
| Change to Global Rulers |  | `view.globalRulers` |
| Show Video Rulers |  | `view.videoRulers` |
| Show Transparency Grid |  | `view.transparencyGrid` |
| Hide Text Threads |  | `view.textThreads` |
| Hide Gradient Annotator |  | `view.gradientAnnotator` |
| Hide Corner Widget |  | `view.cornerWidget` |
| Show Live Paint Gaps |  | `view.livePaintGaps` |
| Release Guides |  | `view.guides.release` |
| Clear Guides |  | `view.guides.clear` |
| Snap to Grid |  | `view.snapToGrid` |
| Snap to Pixel |  | `view.snapToPixel` |
| Snap to Point |  | `view.snapToPoint` |
| Snap to Glyph |  | `view.snapToGlyph` |
| New View… |  | `view.saved.new` |
| Edit Views… |  | `view.saved.edit` |
| Rotate View |  | `view.rotate` |

### Select

| Item | Shortcut | Command id |
| --- | --- | --- |
| Select All |  | `select.all` |
| Next Object Above |  | `select.nextAbove` |
| Next Object Below |  | `select.nextBelow` |
| Deselect |  | `select.none` |
| All on Active Artboard |  | `select.allOnArtboard` |
| Reselect |  | `select.reselect` |
| Inverse |  | `select.inverse` |
| Appearance |  | `select.same.appearance` |
| Appearance Attribute |  | `select.same.appearanceAttribute` |
| Blending Mode |  | `select.same.blendingMode` |
| Fill & Stroke |  | `select.same.fillAndStroke` |
| Fill Color |  | `select.same.fillColor` |
| Opacity |  | `select.same.opacity` |
| Stroke Color |  | `select.same.strokeColor` |
| Stroke Weight |  | `select.same.strokeWeight` |
| Graphic Style |  | `select.same.graphicStyle` |
| Shape |  | `select.same.shapeType` |
| Symbol Instance |  | `select.same.symbolInstance` |
| Link Block Series |  | `select.same.linkBlockSeries` |
| Font Family |  | `select.same.fontFamily` |
| Font Family & Style |  | `select.same.fontFamilyStyle` |
| Font Family, Style & Size |  | `select.same.fontFamilyStyleSize` |
| Font Size |  | `select.same.fontSize` |
| Text Fill Color |  | `select.same.textFillColor` |
| Text Stroke Color |  | `select.same.textStrokeColor` |
| All on Same Layers |  | `select.object.allOnSameLayers` |
| Direction Handles |  | `select.object.directionHandles` |
| Brush Strokes |  | `select.object.brushStrokes` |
| Bristle Brush Strokes |  | `select.object.bristleBrushStrokes` |
| Clipping Masks |  | `select.object.clippingMasks` |
| Slices |  | `select.object.slices` |
| Stray Points |  | `select.object.strayPoints` |
| Open Paths |  | `select.object.openPaths` |
| All Text Objects |  | `select.object.textObjects` |
| Point Text Objects |  | `select.object.pointText` |
| Area Text Objects |  | `select.object.areaText` |
| Start Global Edit |  | `select.globalEdit` |
| Save Selection… |  | `select.save` |
| Update Selection |  | `select.update` |
| Edit Selection… |  | `select.editSaved` |

### Type

| Item | Shortcut | Command id |
| --- | --- | --- |
| Apply Bullets |  | `type.applyBullets` |
| Apply Numbers |  | `type.applyNumbers` |
| Bold |  | `type.bold` |
| Italic |  | `type.italic` |
| Convert To Area Type |  | `type.convertToAreaType` |
| Convert To Point Type |  | `type.convertToPointType` |
| Type on a Path Options… |  | `type.pathOptions` |
| Find Font… |  | `type.findFont` |
| Convert to Text |  | `type.convertListToText` |
| Create Outlines |  | `type.createOutlines` |
| Scale Text Attributes |  | `type.scaleTextAttributes` |
| Optical Margin Alignment |  | `type.opticalMarginAlignment` |
| Fill with Placeholder Text |  | `type.fillPlaceholder` |
| Show Hidden Characters |  | `type.hiddenCharacters` |
| Horizontal |  | `type.orientation.horizontal` |
| Vertical |  | `type.orientation.vertical` |

### Text

| Item | Shortcut | Command id |
| --- | --- | --- |
| Area Type Options… |  | `text.areaOptions` |
| Create |  | `text.thread.create` |
| Release Selection |  | `text.thread.releaseSelection` |
| Remove Threading |  | `text.thread.remove` |
| Fit Headline |  | `text.fitHeadline` |
| Insert Inline Symbol |  | `text.insertInline` |

### Object

| Item | Shortcut | Command id |
| --- | --- | --- |
| object.lock |  | `object.unlockAll` |
| object.hide |  | `object.showAll` |
| Cancel |  | `object.pattern.cancel` |
| Done |  | `object.pattern.done` |
| Save a Copy |  | `object.pattern.saveCopy` |
| Exit Isolation Mode |  | `object.exitIsolation` |
| Isolate Selected Group |  | `object.isolate` |
| Group |  | `object.group` |
| Ungroup |  | `object.ungroup` |
| Make Clipping Mask |  | `object.clippingMask.make` |
| Release Clipping Mask |  | `object.clippingMask.release` |
| Make Compound Path |  | `object.compoundPath.make` |
| Objects on Path |  | `object.objectsOnPath.attach` |
| Release Compound Path |  | `object.compoundPath.release` |
| Selection |  | `object.lock` |
| All Artwork Above |  | `object.lock.above` |
| Other Layers |  | `object.lock.otherLayers` |
| Selection |  | `object.hide` |
| All Artwork Above |  | `object.hide.above` |
| Other Layers |  | `object.hide.otherLayers` |
| Unselected Artwork |  | `object.hide.unselected` |
| Rasterize… |  | `object.rasterize` |
| Vector Halftone… |  | `object.vectorHalftone` |
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
