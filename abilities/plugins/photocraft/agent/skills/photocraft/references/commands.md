# 命令表（photocraft）

这张表由同目录的 `upstream.md` 生成——每一条都是上游版本里真实存在的功能，没有一条是凭记忆写的。
两列直接就是参数：`快捷键` 填进 `photocraft_menu` 的 `shortcut`，`path` 填进 `path`（照抄，含省略号）。

先查这张表，再决定要不要碰坐标。表里没有的功能，说明这一版上游没有。

## File

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| New… | Cmd+N | `["File","New…"]` | `file.new` |
| Open… | Cmd+O | `["File","Open…"]` | `file.open` |
| Open As… | Cmd+Alt+Shift+O | `["File","Open As…"]` | `file.openAs` |
| Open EXR Parts… | — | `["File","Open EXR Parts…"]` | `file.openExrParts` |
| Close | Cmd+W | `["File","Close"]` | `file.close` |
| Close All | Cmd+Alt+W | `["File","Close All"]` | `file.closeAll` |
| Close Others | Cmd+Alt+P | `["File","Close Others"]` | `file.closeOthers` |
| Save | Cmd+S | `["File","Save"]` | `file.save` |
| Save As… | Cmd+Shift+S | `["File","Save As…"]` | `file.saveAs` |
| Save a Copy… | Cmd+Alt+S | `["File","Save a Copy…"]` | `file.saveACopy` |
| Revert | F12 | `["File","Revert"]` | `file.revert` |
| Place Embedded… | — | `["File","Place Embedded…"]` | `file.placeEmbedded` |
| Place Linked… | — | `["File","Place Linked…"]` | `file.placeLinked` |
| Package… | — | `["File","Package…"]` | `file.package` |
| File Info… | Cmd+Alt+Shift+I | `["File","File Info…"]` | `file.fileInfo` |
| Print… | Cmd+P | `["File","Print…"]` | `file.print` |
| Print One Copy | Cmd+Alt+Shift+P | `["File","Print One Copy"]` | `file.printOneCopy` |
| Exit | Cmd+Q | `["File","Exit"]` | `file.exit` |

## File › Automate

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Batch… | — | `["File","Automate","Batch…"]` | `file.automate.batch` |
| Create Droplet… | — | `["File","Automate","Create Droplet…"]` | `file.automate.createDroplet` |
| Crop and Straighten Photos | — | `["File","Automate","Crop and Straighten Photos"]` | `file.automate.cropAndStraightenPhotos` |
| Contact Sheet II… | — | `["File","Automate","Contact Sheet II…"]` | `file.automate.contactSheetII` |
| Conditional Mode Change… | — | `["File","Automate","Conditional Mode Change…"]` | `file.automate.conditionalModeChange` |
| Fit Image… | — | `["File","Automate","Fit Image…"]` | `file.automate.fitImage` |
| Lens Correction… | — | `["File","Automate","Lens Correction…"]` | `file.automate.lensCorrection` |
| Merge to HDR Pro… | — | `["File","Automate","Merge to HDR Pro…"]` | `file.automate.mergeToHdrPro` |
| Photomerge… | — | `["File","Automate","Photomerge…"]` | `file.automate.photomerge` |

## File › Export

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Quick Export as PNG | — | `["File","Export","Quick Export as PNG"]` | `file.export.quickExportAsPng` |
| Export As… | Cmd+Alt+Shift+W | `["File","Export","Export As…"]` | `file.export.exportAs` |
| Export Preferences… | — | `["File","Export","Export Preferences…"]` | `file.export.exportPreferences` |
| Save for Web (Legacy)… | Cmd+Alt+Shift+S | `["File","Export","Save for Web (Legacy)…"]` | `file.export.saveForWebLegacy` |
| Artboards to Files… | — | `["File","Export","Artboards to Files…"]` | `file.export.artboardsToFiles` |
| Artboards to PDF… | — | `["File","Export","Artboards to PDF…"]` | `file.export.artboardsToPdf` |
| Layers to Files… | — | `["File","Export","Layers to Files…"]` | `file.export.layersToFiles` |
| Layer Comps to Files… | — | `["File","Export","Layer Comps to Files…"]` | `file.export.layerCompsToFiles` |
| Color Lookup Tables… | — | `["File","Export","Color Lookup Tables…"]` | `file.export.colorLookupTables` |
| Data Sets as Files… | — | `["File","Export","Data Sets as Files…"]` | `file.export.dataSetsAsFiles` |
| Paths to Illustrator… | — | `["File","Export","Paths to Illustrator…"]` | `file.export.pathsToIllustrator` |
| Render Video… | — | `["File","Export","Render Video…"]` | `file.export.renderVideo` |

## File › Generate

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Image Assets | — | `["File","Generate","Image Assets"]` | `file.generate.imageAssets` |

## File › Import

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Variable Data Sets… | — | `["File","Import","Variable Data Sets…"]` | `file.import.variableDataSets` |
| Video Frames to Layers… | — | `["File","Import","Video Frames to Layers…"]` | `file.import.videoFramesToLayers` |
| Notes… | — | `["File","Import","Notes…"]` | `file.import.notes` |
| WIA Support… | — | `["File","Import","WIA Support…"]` | `file.import.wiaSupport` |

## File › Scripts

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Image Processor… | — | `["File","Scripts","Image Processor…"]` | `file.scripts.imageProcessor` |
| Delete All Empty Layers | — | `["File","Scripts","Delete All Empty Layers"]` | `file.scripts.deleteAllEmptyLayers` |
| Flatten All Layer Effects | — | `["File","Scripts","Flatten All Layer Effects"]` | `file.scripts.flattenAllLayerEffects` |
| Flatten All Masks | — | `["File","Scripts","Flatten All Masks"]` | `file.scripts.flattenAllMasks` |
| Script Events Manager… | — | `["File","Scripts","Script Events Manager…"]` | `file.scripts.scriptEventsManager` |
| Load Files into Stack… | — | `["File","Scripts","Load Files into Stack…"]` | `file.scripts.loadFilesIntoStack` |
| Statistics… | — | `["File","Scripts","Statistics…"]` | `file.scripts.statistics` |
| Browse… | — | `["File","Scripts","Browse…"]` | `file.scripts.browse` |

## Edit

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Assign Profile… | — | `["Edit","Assign Profile…"]` | `edit.assignProfile` |
| Convert to Profile… | — | `["Edit","Convert to Profile…"]` | `edit.convertToProfile` |
| Color Settings… | — | `["Edit","Color Settings…"]` | `edit.colorSettings` |
| Fade… | Cmd+Shift+F | `["Edit","Fade…"]` | `edit.fade` |
| Content-Aware Fill… | — | `["Edit","Content-Aware Fill…"]` | `edit.contentAwareFill` |
| Content-Aware Scale | Cmd+Alt+Shift+C | `["Edit","Content-Aware Scale"]` | `edit.contentAwareScale` |
| Define Brush Preset… | — | `["Edit","Define Brush Preset…"]` | `edit.defineBrushPreset` |
| Define Custom Shape… | — | `["Edit","Define Custom Shape…"]` | `edit.defineCustomShape` |
| Find and Replace Text… | — | `["Edit","Find and Replace Text…"]` | `edit.findAndReplaceText` |
| edit.undo | — | — | `edit.redo` |
| edit.redo | — | — | `edit.undo` |
| Keyboard Shortcuts… | Cmd+Alt+Shift+K | `["Edit","Keyboard Shortcuts…"]` | `edit.keyboardShortcuts` |
| Menus… | Cmd+Alt+Shift+M | `["Edit","Menus…"]` | `edit.menus` |
| Toolbar… | — | `["Edit","Toolbar…"]` | `edit.toolbar` |
| Free Transform | — | `["Edit","Free Transform"]` | `edit.freeTransform` |
| Scale | — | `["Edit","Scale"]` | `edit.transform.scale` |
| Rotate | — | `["Edit","Rotate"]` | `edit.transform.rotate` |
| Skew | — | `["Edit","Skew"]` | `edit.transform.skew` |
| Distort | — | `["Edit","Distort"]` | `edit.transform.distort` |
| Perspective | — | `["Edit","Perspective"]` | `edit.transform.perspective` |
| Warp | — | `["Edit","Warp"]` | `edit.transform.warp` |
| Puppet Warp | — | `["Edit","Puppet Warp"]` | `edit.puppetWarp` |
| Rotate 180° | — | `["Edit","Rotate 180°"]` | `edit.transform.rotate180` |
| Rotate 90° Clockwise | — | `["Edit","Rotate 90° Clockwise"]` | `edit.transform.rotate90Cw` |
| Rotate 90° Counter Clockwise | — | `["Edit","Rotate 90° Counter Clockwise"]` | `edit.transform.rotate90Ccw` |
| Flip Horizontal | — | `["Edit","Flip Horizontal"]` | `edit.transform.flipHorizontal` |
| Flip Vertical | — | `["Edit","Flip Vertical"]` | `edit.transform.flipVertical` |
| Cut | — | `["Edit","Cut"]` | `edit.cut` |
| Copy | — | `["Edit","Copy"]` | `edit.copy` |
| Paste | — | `["Edit","Paste"]` | `edit.paste` |
| Check Spelling… | — | `["Edit","Check Spelling…"]` | `edit.checkSpelling` |
| Delete and Fill Selection | — | `["Edit","Delete and Fill Selection"]` | `edit.deleteAndFillSelection` |
| Fill… | — | `["Edit","Fill…"]` | `edit.fill` |
| Stroke… | — | `["Edit","Stroke…"]` | `edit.stroke` |
| Toggle Last State | Cmd+Alt+Z | `["Edit","Toggle Last State"]` | `edit.toggleLastState` |
| Copy Merged | Cmd+Shift+C | `["Edit","Copy Merged"]` | `edit.copyMerged` |
| Clear | — | `["Edit","Clear"]` | `edit.clear` |
| Search… | Cmd+F | `["Edit","Search…"]` | `edit.search` |
| Perspective Warp | — | `["Edit","Perspective Warp"]` | `edit.perspectiveWarp` |
| Auto-Align Layers… | — | `["Edit","Auto-Align Layers…"]` | `edit.autoAlignLayers` |
| Auto-Blend Layers… | — | `["Edit","Auto-Blend Layers…"]` | `edit.autoBlendLayers` |
| Define Pattern… | — | `["Edit","Define Pattern…"]` | `edit.definePattern` |

## Edit › Paste Special

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Paste in Place | Cmd+Shift+V | `["Edit","Paste Special","Paste in Place"]` | `edit.pasteSpecial.pasteInPlace` |
| Paste Into | Cmd+Alt+Shift+V | `["Edit","Paste Special","Paste Into"]` | `edit.pasteSpecial.pasteInto` |
| Paste Outside | — | `["Edit","Paste Special","Paste Outside"]` | `edit.pasteSpecial.pasteOutside` |

## Edit › Preferences

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Settings… | Cmd+K | `["Edit","Preferences","Settings…"]` | `edit.preferences.general` |
| AI Integrations… | — | `["Edit","Preferences","AI Integrations…"]` | `edit.preferences.integrations` |
| Interface… | — | `["Edit","Preferences","Interface…"]` | `edit.preferences.interface` |
| Workspace… | — | `["Edit","Preferences","Workspace…"]` | `edit.preferences.workspace` |
| Tools… | — | `["Edit","Preferences","Tools…"]` | `edit.preferences.tools` |
| History Log… | — | `["Edit","Preferences","History Log…"]` | `edit.preferences.historyLog` |
| File Handling… | — | `["Edit","Preferences","File Handling…"]` | `edit.preferences.fileHandling` |
| Export… | — | `["Edit","Preferences","Export…"]` | `edit.preferences.export` |
| Performance… | — | `["Edit","Preferences","Performance…"]` | `edit.preferences.performance` |
| Scratch Disks… | — | `["Edit","Preferences","Scratch Disks…"]` | `edit.preferences.scratchDisks` |
| Cursors… | — | `["Edit","Preferences","Cursors…"]` | `edit.preferences.cursors` |
| Transparency & Gamut… | — | `["Edit","Preferences","Transparency & Gamut…"]` | `edit.preferences.transparencyAndGamut` |
| Units & Rulers… | — | `["Edit","Preferences","Units & Rulers…"]` | `edit.preferences.unitsAndRulers` |
| Guides, Grid & Slices… | — | `["Edit","Preferences","Guides, Grid & Slices…"]` | `edit.preferences.guidesGridAndSlices` |
| Plug-ins… | — | `["Edit","Preferences","Plug-ins…"]` | `edit.preferences.plugIns` |
| Type… | — | `["Edit","Preferences","Type…"]` | `edit.preferences.type` |
| Enhanced Controls… | — | `["Edit","Preferences","Enhanced Controls…"]` | `edit.preferences.enhancedControls` |
| Raw Defaults… | — | `["Edit","Preferences","Raw Defaults…"]` | `edit.preferences.rawDefaults` |

## Edit › Presets

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Preset Manager… | — | `["Edit","Presets","Preset Manager…"]` | `edit.presets.presetManager` |
| Export/Import Presets… | — | `["Edit","Presets","Export/Import Presets…"]` | `edit.presets.exportImportPresets` |
| Migrate Presets | — | `["Edit","Presets","Migrate Presets"]` | `edit.presets.migratePresets` |

## Edit › Purge

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Undo | — | `["Edit","Purge","Undo"]` | `edit.purge.undo` |
| Clipboard | — | `["Edit","Purge","Clipboard"]` | `edit.purge.clipboard` |
| Histories | — | `["Edit","Purge","Histories"]` | `edit.purge.histories` |
| Video Cache | — | `["Edit","Purge","Video Cache"]` | `edit.purge.videoCache` |
| All | — | `["Edit","Purge","All"]` | `edit.purge.all` |

## Edit › Transform

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Again | Cmd+Shift+T | `["Edit","Transform","Again"]` | `edit.transform.again` |
| Split Warp Horizontally | — | `["Edit","Transform","Split Warp Horizontally"]` | `edit.transform.splitWarpHorizontally` |
| Split Warp Vertically | — | `["Edit","Transform","Split Warp Vertically"]` | `edit.transform.splitWarpVertically` |
| Split Warp Crosswise | — | `["Edit","Transform","Split Warp Crosswise"]` | `edit.transform.splitWarpCrosswise` |
| Remove Warp Split | — | `["Edit","Transform","Remove Warp Split"]` | `edit.transform.removeWarpSplit` |

## View

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| FtOn | — | — | `view.fitOnScreen` |
| ActP | — | — | `view.actualPixels` |
| ZmIn | — | — | `view.zoomIn` |
| ZmOt | — | — | `view.zoomOut` |
| Proof Colors | — | `["View","Proof Colors"]` | `view.proofColors` |
| Gamut Warning | — | `["View","Gamut Warning"]` | `view.gamutWarning` |
| Lock Guides | — | `["View","Lock Guides"]` | `view.lockGuides` |
| Clear Guides | — | `["View","Clear Guides"]` | `view.clearGuides` |
| Clear Canvas Guides | — | `["View","Clear Canvas Guides"]` | `view.clearCanvasGuides` |
| Clear Selected Artboard Guides | — | `["View","Clear Selected Artboard Guides"]` | `view.clearSelectedArtboardGuides` |
| 200% | — | `["View","200%"]` | `view.twoHundredPercent` |
| Print Size | — | `["View","Print Size"]` | `view.printSize` |
| New Guides From Shape | — | `["View","New Guides From Shape"]` | `view.newGuidesFromShape` |
| Pixel Aspect Ratio Correction | — | `["View","Pixel Aspect Ratio Correction"]` | `view.pixelAspectRatioCorrection` |
| 32-bit Preview Options… | — | `["View","32-bit Preview Options…"]` | `view.thirtyTwoBitPreviewOptions` |
| Fit Layer(s) on Screen | — | `["View","Fit Layer(s) on Screen"]` | `view.fitLayersOnScreen` |
| Fit Artboard on Screen | — | `["View","Fit Artboard on Screen"]` | `view.fitArtboardOnScreen` |
| Flip Horizontal | — | `["View","Flip Horizontal"]` | `view.flipHorizontal` |
| Extras | Cmd+H | `["View","Extras"]` | `view.extras` |
| Rulers | Cmd+R | `["View","Rulers"]` | `view.rulers` |
| Snap | Cmd+Shift+; | `["View","Snap"]` | `view.snap` |
| New Guide… | — | `["View","New Guide…"]` | `view.newGuide` |
| New Guide Layout… | — | `["View","New Guide Layout…"]` | `view.newGuideLayout` |
| Lock Slices | — | `["View","Lock Slices"]` | `view.lockSlices` |
| Clear Slices | — | `["View","Clear Slices"]` | `view.clearSlices` |
| Pattern Preview | — | `["View","Pattern Preview"]` | `view.patternPreview` |
| Pixel Art Preview | — | `["View","Pixel Art Preview"]` | `view.pixelArtPreview` |

## View › Pixel Aspect Ratio

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Custom Pixel Aspect Ratio… | — | `["View","Pixel Aspect Ratio","Custom Pixel Aspect Ratio…"]` | `view.pixelAspectRatio.custom` |
| Square | — | `["View","Pixel Aspect Ratio","Square"]` | `view.pixelAspectRatio.square` |
| D1/DV NTSC (0.91) | — | `["View","Pixel Aspect Ratio","D1/DV NTSC (0.91)"]` | `view.pixelAspectRatio.d1DvNtsc` |
| D1/DV PAL (1.09) | — | `["View","Pixel Aspect Ratio","D1/DV PAL (1.09)"]` | `view.pixelAspectRatio.d1DvPal` |
| D1/DV NTSC Widescreen (1.21) | — | `["View","Pixel Aspect Ratio","D1/DV NTSC Widescreen (1.21)"]` | `view.pixelAspectRatio.d1DvNtscWidescreen` |
| HDV 1080/DVCPRO HD 720 (1.33) | — | `["View","Pixel Aspect Ratio","HDV 1080/DVCPRO HD 720 (1.33)"]` | `view.pixelAspectRatio.hdv1080` |
| D1/DV PAL Widescreen (1.46) | — | `["View","Pixel Aspect Ratio","D1/DV PAL Widescreen (1.46)"]` | `view.pixelAspectRatio.d1DvPalWidescreen` |
| DVCPRO HD 1080/HDV 1080 (1.5) | — | `["View","Pixel Aspect Ratio","DVCPRO HD 1080/HDV 1080 (1.5)"]` | `view.pixelAspectRatio.dvcproHd1080` |
| Anamorphic 2:1 (2) | — | `["View","Pixel Aspect Ratio","Anamorphic 2:1 (2)"]` | `view.pixelAspectRatio.anamorphic2To1` |

## View › Proof Setup

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Custom… | — | `["View","Proof Setup","Custom…"]` | `view.proofSetup.custom` |
| Working CMYK | — | `["View","Proof Setup","Working CMYK"]` | `view.proofSetup.workingCmyk` |
| Working Cyan Plate | — | `["View","Proof Setup","Working Cyan Plate"]` | `view.proofSetup.workingCyanPlate` |
| Working Magenta Plate | — | `["View","Proof Setup","Working Magenta Plate"]` | `view.proofSetup.workingMagentaPlate` |
| Working Yellow Plate | — | `["View","Proof Setup","Working Yellow Plate"]` | `view.proofSetup.workingYellowPlate` |
| Working Black Plate | — | `["View","Proof Setup","Working Black Plate"]` | `view.proofSetup.workingBlackPlate` |

