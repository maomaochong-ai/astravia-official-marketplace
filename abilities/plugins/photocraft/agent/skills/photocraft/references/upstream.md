# 上游命令与菜单（从 photocraft 自己的源码导出）

这个文件不是转述，是从上游 photocraft 仓库的 Rust 源码里读出来的条目：菜单路径、显示名、默认快捷键、
命令 id。判断"这个应用到底有哪些功能、叫什么名字"以这里和编辑器里实际看得到的界面为准，不要凭记忆编。

| 事实 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/storytold/photocraft |
| 钉住的发布版本 | v0.19.0 |
| 站点来源 | `photocraft-web-0.19.0.zip`（sha256 `74047f06da706c5b…`） |
| 许可 | Apache-2.0 或 MIT（仓库内 LICENSE-APACHE / LICENSE-MIT） |
| 提取自 | `crates/ui-egui/src/menus*.rs`、`crates/engine/src/cmd/**` 等命令表 |
| 上游自述 | Image editing; an open-source, clean-room reimplementation of Adobe Photoshop. Layers, masks, adjustment layers, layer styles, type, vectors, brushes and real PSD files. |

## 菜单与命令

显示名与快捷键是上游的原文。命令 id 在两点上有用：它说明这条命令存在且是这一层级的正式入口；
面板里没有命令总线，所以**不要**指望把 id 当参数发过去——它是"要找的东西叫什么"的索引。

### File

| Item | Shortcut | Command id |
| --- | --- | --- |
| New… | Cmd+N | `file.new` |
| Open… | Cmd+O | `file.open` |
| Open As… | Cmd+Alt+Shift+O | `file.openAs` |
| Open EXR Parts… |  | `file.openExrParts` |
| Close | Cmd+W | `file.close` |
| Close All | Cmd+Alt+W | `file.closeAll` |
| Close Others | Cmd+Alt+P | `file.closeOthers` |
| Save | Cmd+S | `file.save` |
| Save As… | Cmd+Shift+S | `file.saveAs` |
| Save a Copy… | Cmd+Alt+S | `file.saveACopy` |
| Revert | F12 | `file.revert` |
| Place Embedded… |  | `file.placeEmbedded` |
| Place Linked… |  | `file.placeLinked` |
| Package… |  | `file.package` |
| File Info… | Cmd+Alt+Shift+I | `file.fileInfo` |
| Print… | Cmd+P | `file.print` |
| Print One Copy | Cmd+Alt+Shift+P | `file.printOneCopy` |
| Exit | Cmd+Q | `file.exit` |

### File › Automate

| Item | Shortcut | Command id |
| --- | --- | --- |
| Batch… |  | `file.automate.batch` |
| Create Droplet… |  | `file.automate.createDroplet` |
| Crop and Straighten Photos |  | `file.automate.cropAndStraightenPhotos` |
| Contact Sheet II… |  | `file.automate.contactSheetII` |
| Conditional Mode Change… |  | `file.automate.conditionalModeChange` |
| Fit Image… |  | `file.automate.fitImage` |
| Lens Correction… |  | `file.automate.lensCorrection` |
| Merge to HDR Pro… |  | `file.automate.mergeToHdrPro` |
| Photomerge… |  | `file.automate.photomerge` |

### File › Export

| Item | Shortcut | Command id |
| --- | --- | --- |
| Quick Export as PNG |  | `file.export.quickExportAsPng` |
| Export As… | Cmd+Alt+Shift+W | `file.export.exportAs` |
| Export Preferences… |  | `file.export.exportPreferences` |
| Save for Web (Legacy)… | Cmd+Alt+Shift+S | `file.export.saveForWebLegacy` |
| Artboards to Files… |  | `file.export.artboardsToFiles` |
| Artboards to PDF… |  | `file.export.artboardsToPdf` |
| Layers to Files… |  | `file.export.layersToFiles` |
| Layer Comps to Files… |  | `file.export.layerCompsToFiles` |
| Color Lookup Tables… |  | `file.export.colorLookupTables` |
| Data Sets as Files… |  | `file.export.dataSetsAsFiles` |
| Paths to Illustrator… |  | `file.export.pathsToIllustrator` |
| Render Video… |  | `file.export.renderVideo` |

### File › Generate

| Item | Shortcut | Command id |
| --- | --- | --- |
| Image Assets |  | `file.generate.imageAssets` |

### File › Import

| Item | Shortcut | Command id |
| --- | --- | --- |
| Variable Data Sets… |  | `file.import.variableDataSets` |
| Video Frames to Layers… |  | `file.import.videoFramesToLayers` |
| Notes… |  | `file.import.notes` |
| WIA Support… |  | `file.import.wiaSupport` |

### File › Scripts

| Item | Shortcut | Command id |
| --- | --- | --- |
| Image Processor… |  | `file.scripts.imageProcessor` |
| Delete All Empty Layers |  | `file.scripts.deleteAllEmptyLayers` |
| Flatten All Layer Effects |  | `file.scripts.flattenAllLayerEffects` |
| Flatten All Masks |  | `file.scripts.flattenAllMasks` |
| Script Events Manager… |  | `file.scripts.scriptEventsManager` |
| Load Files into Stack… |  | `file.scripts.loadFilesIntoStack` |
| Statistics… |  | `file.scripts.statistics` |
| Browse… |  | `file.scripts.browse` |

### Edit

| Item | Shortcut | Command id |
| --- | --- | --- |
| Assign Profile… |  | `edit.assignProfile` |
| Convert to Profile… |  | `edit.convertToProfile` |
| Color Settings… |  | `edit.colorSettings` |
| Fade… | Cmd+Shift+F | `edit.fade` |
| Content-Aware Fill… |  | `edit.contentAwareFill` |
| Content-Aware Scale | Cmd+Alt+Shift+C | `edit.contentAwareScale` |
| Define Brush Preset… |  | `edit.defineBrushPreset` |
| Define Custom Shape… |  | `edit.defineCustomShape` |
| Find and Replace Text… |  | `edit.findAndReplaceText` |
| edit.undo |  | `edit.redo` |
| edit.redo |  | `edit.undo` |
| Keyboard Shortcuts… | Cmd+Alt+Shift+K | `edit.keyboardShortcuts` |
| Menus… | Cmd+Alt+Shift+M | `edit.menus` |
| Toolbar… |  | `edit.toolbar` |
| Free Transform |  | `edit.freeTransform` |
| Scale |  | `edit.transform.scale` |
| Rotate |  | `edit.transform.rotate` |
| Skew |  | `edit.transform.skew` |
| Distort |  | `edit.transform.distort` |
| Perspective |  | `edit.transform.perspective` |
| Warp |  | `edit.transform.warp` |
| Puppet Warp |  | `edit.puppetWarp` |
| Rotate 180° |  | `edit.transform.rotate180` |
| Rotate 90° Clockwise |  | `edit.transform.rotate90Cw` |
| Rotate 90° Counter Clockwise |  | `edit.transform.rotate90Ccw` |
| Flip Horizontal |  | `edit.transform.flipHorizontal` |
| Flip Vertical |  | `edit.transform.flipVertical` |
| Cut |  | `edit.cut` |
| Copy |  | `edit.copy` |
| Paste |  | `edit.paste` |
| Check Spelling… |  | `edit.checkSpelling` |
| Delete and Fill Selection |  | `edit.deleteAndFillSelection` |
| Fill… |  | `edit.fill` |
| Stroke… |  | `edit.stroke` |
| Toggle Last State | Cmd+Alt+Z | `edit.toggleLastState` |
| Copy Merged | Cmd+Shift+C | `edit.copyMerged` |
| Clear |  | `edit.clear` |
| Search… | Cmd+F | `edit.search` |
| Perspective Warp |  | `edit.perspectiveWarp` |
| Auto-Align Layers… |  | `edit.autoAlignLayers` |
| Auto-Blend Layers… |  | `edit.autoBlendLayers` |
| Define Pattern… |  | `edit.definePattern` |

### Edit › Paste Special

| Item | Shortcut | Command id |
| --- | --- | --- |
| Paste in Place | Cmd+Shift+V | `edit.pasteSpecial.pasteInPlace` |
| Paste Into | Cmd+Alt+Shift+V | `edit.pasteSpecial.pasteInto` |
| Paste Outside |  | `edit.pasteSpecial.pasteOutside` |

### Edit › Preferences

| Item | Shortcut | Command id |
| --- | --- | --- |
| Settings… | Cmd+K | `edit.preferences.general` |
| AI Integrations… |  | `edit.preferences.integrations` |
| Interface… |  | `edit.preferences.interface` |
| Workspace… |  | `edit.preferences.workspace` |
| Tools… |  | `edit.preferences.tools` |
| History Log… |  | `edit.preferences.historyLog` |
| File Handling… |  | `edit.preferences.fileHandling` |
| Export… |  | `edit.preferences.export` |
| Performance… |  | `edit.preferences.performance` |
| Scratch Disks… |  | `edit.preferences.scratchDisks` |
| Cursors… |  | `edit.preferences.cursors` |
| Transparency & Gamut… |  | `edit.preferences.transparencyAndGamut` |
| Units & Rulers… |  | `edit.preferences.unitsAndRulers` |
| Guides, Grid & Slices… |  | `edit.preferences.guidesGridAndSlices` |
| Plug-ins… |  | `edit.preferences.plugIns` |
| Type… |  | `edit.preferences.type` |
| Enhanced Controls… |  | `edit.preferences.enhancedControls` |
| Raw Defaults… |  | `edit.preferences.rawDefaults` |

### Edit › Presets

| Item | Shortcut | Command id |
| --- | --- | --- |
| Preset Manager… |  | `edit.presets.presetManager` |
| Export/Import Presets… |  | `edit.presets.exportImportPresets` |
| Migrate Presets |  | `edit.presets.migratePresets` |

### Edit › Purge

| Item | Shortcut | Command id |
| --- | --- | --- |
| Undo |  | `edit.purge.undo` |
| Clipboard |  | `edit.purge.clipboard` |
| Histories |  | `edit.purge.histories` |
| Video Cache |  | `edit.purge.videoCache` |
| All |  | `edit.purge.all` |

### Edit › Transform

| Item | Shortcut | Command id |
| --- | --- | --- |
| Again | Cmd+Shift+T | `edit.transform.again` |
| Split Warp Horizontally |  | `edit.transform.splitWarpHorizontally` |
| Split Warp Vertically |  | `edit.transform.splitWarpVertically` |
| Split Warp Crosswise |  | `edit.transform.splitWarpCrosswise` |
| Remove Warp Split |  | `edit.transform.removeWarpSplit` |

### View

| Item | Shortcut | Command id |
| --- | --- | --- |
| FtOn |  | `view.fitOnScreen` |
| ActP |  | `view.actualPixels` |
| ZmIn |  | `view.zoomIn` |
| ZmOt |  | `view.zoomOut` |
| Proof Colors |  | `view.proofColors` |
| Gamut Warning |  | `view.gamutWarning` |
| Lock Guides |  | `view.lockGuides` |
| Clear Guides |  | `view.clearGuides` |
| Clear Canvas Guides |  | `view.clearCanvasGuides` |
| Clear Selected Artboard Guides |  | `view.clearSelectedArtboardGuides` |
| 200% |  | `view.twoHundredPercent` |
| Print Size |  | `view.printSize` |
| New Guides From Shape |  | `view.newGuidesFromShape` |
| Pixel Aspect Ratio Correction |  | `view.pixelAspectRatioCorrection` |
| 32-bit Preview Options… |  | `view.thirtyTwoBitPreviewOptions` |
| Fit Layer(s) on Screen |  | `view.fitLayersOnScreen` |
| Fit Artboard on Screen |  | `view.fitArtboardOnScreen` |
| Flip Horizontal |  | `view.flipHorizontal` |
| Extras | Cmd+H | `view.extras` |
| Rulers | Cmd+R | `view.rulers` |
| Snap | Cmd+Shift+; | `view.snap` |
| New Guide… |  | `view.newGuide` |
| New Guide Layout… |  | `view.newGuideLayout` |
| Lock Slices |  | `view.lockSlices` |
| Clear Slices |  | `view.clearSlices` |
| Pattern Preview |  | `view.patternPreview` |
| Pixel Art Preview |  | `view.pixelArtPreview` |

### View › Pixel Aspect Ratio

| Item | Shortcut | Command id |
| --- | --- | --- |
| Custom Pixel Aspect Ratio… |  | `view.pixelAspectRatio.custom` |
| Square |  | `view.pixelAspectRatio.square` |
| D1/DV NTSC (0.91) |  | `view.pixelAspectRatio.d1DvNtsc` |
| D1/DV PAL (1.09) |  | `view.pixelAspectRatio.d1DvPal` |
| D1/DV NTSC Widescreen (1.21) |  | `view.pixelAspectRatio.d1DvNtscWidescreen` |
| HDV 1080/DVCPRO HD 720 (1.33) |  | `view.pixelAspectRatio.hdv1080` |
| D1/DV PAL Widescreen (1.46) |  | `view.pixelAspectRatio.d1DvPalWidescreen` |
| DVCPRO HD 1080/HDV 1080 (1.5) |  | `view.pixelAspectRatio.dvcproHd1080` |
| Anamorphic 2:1 (2) |  | `view.pixelAspectRatio.anamorphic2To1` |

### View › Proof Setup

| Item | Shortcut | Command id |
| --- | --- | --- |
| Custom… |  | `view.proofSetup.custom` |
| Working CMYK |  | `view.proofSetup.workingCmyk` |
| Working Cyan Plate |  | `view.proofSetup.workingCyanPlate` |
| Working Magenta Plate |  | `view.proofSetup.workingMagentaPlate` |
| Working Yellow Plate |  | `view.proofSetup.workingYellowPlate` |
| Working Black Plate |  | `view.proofSetup.workingBlackPlate` |
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
