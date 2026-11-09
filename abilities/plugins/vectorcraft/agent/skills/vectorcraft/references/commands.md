# 命令索引（vectorcraft）

这张表是这个插件自己的命令索引：每一条都是编辑器里真实存在的功能，`path` 一列直接就是
`vectorcraft_menu` 的参数，`快捷键` 一列填进它的 `shortcut`。

先查表决定「用哪个功能」，再决定要不要碰坐标。表里没有的，多半是这一版没有，也可能是它只在面板上——以界面为准。

## （名称在导出时残缺，只能用快捷键或 id 定位）

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| object.convertDocumentColorMode | — | — | `file.documentColorMode` |
| art.pdf | — | — | `file.saveAs` |
## File

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Export Selection… | — | `["File","Export Selection…"]` | `file.exportSelection` |
| New… | — | `["File","New…"]` | `file.newDialog` |
| New from Template… | — | `["File","New from Template…"]` | `file.newFromTemplate` |
| Open… | — | `["File","Open…"]` | `file.open` |
| Clear Recent Files | — | `["File","Clear Recent Files"]` | `file.clearRecent` |
| Show in Folder | — | `["File","Show in Folder"]` | `file.reveal` |
| Close | — | `["File","Close"]` | `file.close` |
| Close All | — | `["File","Close All"]` | `file.closeAll` |
| Save | — | `["File","Save"]` | `file.save` |
| Save a Copy… | — | `["File","Save a Copy…"]` | `file.saveCopy` |
| Save as Template… | — | `["File","Save as Template…"]` | `file.saveAsTemplate` |
| Revert | — | `["File","Revert"]` | `file.revert` |
| Place… | — | `["File","Place…"]` | `file.place` |
| Export for Screens… | — | `["File","Export for Screens…"]` | `file.exportForScreens` |
| Export As… | — | `["File","Export As…"]` | `file.exportAs` |
| Save for Web (Legacy)… | — | `["File","Save for Web (Legacy)…"]` | `file.saveForWeb` |
| Document Setup… | — | `["File","Document Setup…"]` | `file.documentSetup` |
| File Info… | — | `["File","File Info…"]` | `file.info` |
| Print… | — | `["File","Print…"]` | `file.print` |
## Edit

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Undo | — | `["Edit","Undo"]` | `edit.undo` |
| Redo | — | `["Edit","Redo"]` | `edit.redo` |
| Paste | — | `["Edit","Paste"]` | `edit.paste` |
| Cut | — | `["Edit","Cut"]` | `edit.cut` |
| Copy | — | `["Edit","Copy"]` | `edit.copy` |
| Paste in Front | — | `["Edit","Paste in Front"]` | `edit.pasteInFront` |
| Paste in Back | — | `["Edit","Paste in Back"]` | `edit.pasteInBack` |
| Paste in Place | — | `["Edit","Paste in Place"]` | `edit.pasteInPlace` |
| Paste on All Artboards | — | `["Edit","Paste on All Artboards"]` | `edit.pasteOnAllArtboards` |
| Paste without Formatting | — | `["Edit","Paste without Formatting"]` | `edit.pasteWithoutFormatting` |
| Clear | — | `["Edit","Clear"]` | `edit.clear` |
| Blend Front to Back | — | `["Edit","Blend Front to Back"]` | `edit.colors.blendFrontToBack` |
| Blend Horizontally | — | `["Edit","Blend Horizontally"]` | `edit.colors.blendHorizontally` |
| Blend Vertically | — | `["Edit","Blend Vertically"]` | `edit.colors.blendVertically` |
| Convert to CMYK | — | `["Edit","Convert to CMYK"]` | `edit.colors.toCMYK` |
| Convert to Grayscale | — | `["Edit","Convert to Grayscale"]` | `edit.colors.toGrayscale` |
| Convert to RGB | — | `["Edit","Convert to RGB"]` | `edit.colors.toRGB` |
| Invert Colors | — | `["Edit","Invert Colors"]` | `edit.colors.invert` |
| Color Settings… | — | `["Edit","Color Settings…"]` | `edit.colorSettings` |
| Assign Profile… | — | `["Edit","Assign Profile…"]` | `edit.assignProfile` |
| Keyboard Shortcuts… | — | `["Edit","Keyboard Shortcuts…"]` | `edit.keyboardShortcuts` |
| Preferences… | — | `["Edit","Preferences…"]` | `edit.preferences` |
## View

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| rulers | — | `["View","rulers"]` | `view.rulers` |
| outline | — | `["View","outline"]` | `view.outline` |
| grid | — | `["View","grid"]` | `view.grid` |
## （名称在导出时残缺，只能用快捷键或 id 定位）

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| smartGuides | — | — | `view.smartGuides` |
| boundingBox | — | — | `view.boundingBox` |
## View

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Zoom In | — | `["View","Zoom In"]` | `view.zoomIn` |
| Zoom Out | — | `["View","Zoom Out"]` | `view.zoomOut` |
| Fit Artboard in Window | — | `["View","Fit Artboard in Window"]` | `view.fitArtboard` |
| Hide Guides | — | `["View","Hide Guides"]` | `view.guides` |
| Lock Guides | — | `["View","Lock Guides"]` | `view.guides.lock` |
| Make Guides | — | `["View","Make Guides"]` | `view.guides.make` |
| Overprint Preview | — | `["View","Overprint Preview"]` | `view.overprintPreview` |
| Pixel Preview | — | `["View","Pixel Preview"]` | `view.pixelPreview` |
| Trim View | — | `["View","Trim View"]` | `view.trimView` |
| Presentation Mode | — | `["View","Presentation Mode"]` | `view.presentation` |
| Proof Colors | — | `["View","Proof Colors"]` | `view.proofColors` |
| Fit All in Window | — | `["View","Fit All in Window"]` | `view.fitAll` |
| Actual Size | — | `["View","Actual Size"]` | `view.actualSize` |
| Rotate View to Selection | — | `["View","Rotate View to Selection"]` | `view.rotateToSelection` |
| Reset Rotate View | — | `["View","Reset Rotate View"]` | `view.rotateReset` |
| Hide Edges | — | `["View","Hide Edges"]` | `view.edges` |
| Hide Artboards | — | `["View","Hide Artboards"]` | `view.artboards` |
| Show Print Tiling | — | `["View","Show Print Tiling"]` | `view.printTiling` |
| Hide Slices | — | `["View","Hide Slices"]` | `view.slices.hide` |
| Lock Slices | — | `["View","Lock Slices"]` | `view.slices.lock` |
| Hide Template | — | `["View","Hide Template"]` | `view.template` |
| Change to Global Rulers | — | `["View","Change to Global Rulers"]` | `view.globalRulers` |
| Show Video Rulers | — | `["View","Show Video Rulers"]` | `view.videoRulers` |
| Show Transparency Grid | — | `["View","Show Transparency Grid"]` | `view.transparencyGrid` |
| Hide Text Threads | — | `["View","Hide Text Threads"]` | `view.textThreads` |
| Hide Gradient Annotator | — | `["View","Hide Gradient Annotator"]` | `view.gradientAnnotator` |
| Hide Corner Widget | — | `["View","Hide Corner Widget"]` | `view.cornerWidget` |
| Show Live Paint Gaps | — | `["View","Show Live Paint Gaps"]` | `view.livePaintGaps` |
| Release Guides | — | `["View","Release Guides"]` | `view.guides.release` |
| Clear Guides | — | `["View","Clear Guides"]` | `view.guides.clear` |
| Snap to Grid | — | `["View","Snap to Grid"]` | `view.snapToGrid` |
| Snap to Pixel | — | `["View","Snap to Pixel"]` | `view.snapToPixel` |
| Snap to Point | — | `["View","Snap to Point"]` | `view.snapToPoint` |
| Snap to Glyph | — | `["View","Snap to Glyph"]` | `view.snapToGlyph` |
| New View… | — | `["View","New View…"]` | `view.saved.new` |
| Edit Views… | — | `["View","Edit Views…"]` | `view.saved.edit` |
| Rotate View | — | `["View","Rotate View"]` | `view.rotate` |
## Select

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Select All | — | `["Select","Select All"]` | `select.all` |
| Next Object Above | — | `["Select","Next Object Above"]` | `select.nextAbove` |
| Next Object Below | — | `["Select","Next Object Below"]` | `select.nextBelow` |
| Deselect | — | `["Select","Deselect"]` | `select.none` |
| All on Active Artboard | — | `["Select","All on Active Artboard"]` | `select.allOnArtboard` |
| Reselect | — | `["Select","Reselect"]` | `select.reselect` |
| Inverse | — | `["Select","Inverse"]` | `select.inverse` |
| Appearance | — | `["Select","Appearance"]` | `select.same.appearance` |
| Appearance Attribute | — | `["Select","Appearance Attribute"]` | `select.same.appearanceAttribute` |
| Blending Mode | — | `["Select","Blending Mode"]` | `select.same.blendingMode` |
| Fill & Stroke | — | `["Select","Fill & Stroke"]` | `select.same.fillAndStroke` |
| Fill Color | — | `["Select","Fill Color"]` | `select.same.fillColor` |
| Opacity | — | `["Select","Opacity"]` | `select.same.opacity` |
| Stroke Color | — | `["Select","Stroke Color"]` | `select.same.strokeColor` |
| Stroke Weight | — | `["Select","Stroke Weight"]` | `select.same.strokeWeight` |
| Graphic Style | — | `["Select","Graphic Style"]` | `select.same.graphicStyle` |
| Shape | — | `["Select","Shape"]` | `select.same.shapeType` |
| Symbol Instance | — | `["Select","Symbol Instance"]` | `select.same.symbolInstance` |
| Link Block Series | — | `["Select","Link Block Series"]` | `select.same.linkBlockSeries` |
| Font Family | — | `["Select","Font Family"]` | `select.same.fontFamily` |
| Font Family & Style | — | `["Select","Font Family & Style"]` | `select.same.fontFamilyStyle` |
| Font Family, Style & Size | — | `["Select","Font Family, Style & Size"]` | `select.same.fontFamilyStyleSize` |
| Font Size | — | `["Select","Font Size"]` | `select.same.fontSize` |
| Text Fill Color | — | `["Select","Text Fill Color"]` | `select.same.textFillColor` |
| Text Stroke Color | — | `["Select","Text Stroke Color"]` | `select.same.textStrokeColor` |
| All on Same Layers | — | `["Select","All on Same Layers"]` | `select.object.allOnSameLayers` |
| Direction Handles | — | `["Select","Direction Handles"]` | `select.object.directionHandles` |
| Brush Strokes | — | `["Select","Brush Strokes"]` | `select.object.brushStrokes` |
| Bristle Brush Strokes | — | `["Select","Bristle Brush Strokes"]` | `select.object.bristleBrushStrokes` |
| Clipping Masks | — | `["Select","Clipping Masks"]` | `select.object.clippingMasks` |
| Slices | — | `["Select","Slices"]` | `select.object.slices` |
| Stray Points | — | `["Select","Stray Points"]` | `select.object.strayPoints` |
| Open Paths | — | `["Select","Open Paths"]` | `select.object.openPaths` |
| All Text Objects | — | `["Select","All Text Objects"]` | `select.object.textObjects` |
| Point Text Objects | — | `["Select","Point Text Objects"]` | `select.object.pointText` |
| Area Text Objects | — | `["Select","Area Text Objects"]` | `select.object.areaText` |
| Start Global Edit | — | `["Select","Start Global Edit"]` | `select.globalEdit` |
| Save Selection… | — | `["Select","Save Selection…"]` | `select.save` |
| Update Selection | — | `["Select","Update Selection"]` | `select.update` |
| Edit Selection… | — | `["Select","Edit Selection…"]` | `select.editSaved` |
## Type

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Apply Bullets | — | `["Type","Apply Bullets"]` | `type.applyBullets` |
| Apply Numbers | — | `["Type","Apply Numbers"]` | `type.applyNumbers` |
| Bold | — | `["Type","Bold"]` | `type.bold` |
| Italic | — | `["Type","Italic"]` | `type.italic` |
| Convert To Area Type | — | `["Type","Convert To Area Type"]` | `type.convertToAreaType` |
| Convert To Point Type | — | `["Type","Convert To Point Type"]` | `type.convertToPointType` |
| Type on a Path Options… | — | `["Type","Type on a Path Options…"]` | `type.pathOptions` |
| Find Font… | — | `["Type","Find Font…"]` | `type.findFont` |
| Convert to Text | — | `["Type","Convert to Text"]` | `type.convertListToText` |
| Create Outlines | — | `["Type","Create Outlines"]` | `type.createOutlines` |
| Scale Text Attributes | — | `["Type","Scale Text Attributes"]` | `type.scaleTextAttributes` |
| Optical Margin Alignment | — | `["Type","Optical Margin Alignment"]` | `type.opticalMarginAlignment` |
| Fill with Placeholder Text | — | `["Type","Fill with Placeholder Text"]` | `type.fillPlaceholder` |
| Show Hidden Characters | — | `["Type","Show Hidden Characters"]` | `type.hiddenCharacters` |
| Horizontal | — | `["Type","Horizontal"]` | `type.orientation.horizontal` |
| Vertical | — | `["Type","Vertical"]` | `type.orientation.vertical` |
## Text

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Area Type Options… | — | `["Text","Area Type Options…"]` | `text.areaOptions` |
| Create | — | `["Text","Create"]` | `text.thread.create` |
| Release Selection | — | `["Text","Release Selection"]` | `text.thread.releaseSelection` |
| Remove Threading | — | `["Text","Remove Threading"]` | `text.thread.remove` |
| Fit Headline | — | `["Text","Fit Headline"]` | `text.fitHeadline` |
| Insert Inline Symbol | — | `["Text","Insert Inline Symbol"]` | `text.insertInline` |
## （名称在导出时残缺，只能用快捷键或 id 定位）

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| object.lock | — | — | `object.unlockAll` |
| object.hide | — | — | `object.showAll` |
## Object

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Cancel | — | `["Object","Cancel"]` | `object.pattern.cancel` |
| Done | — | `["Object","Done"]` | `object.pattern.done` |
| Save a Copy | — | `["Object","Save a Copy"]` | `object.pattern.saveCopy` |
| Exit Isolation Mode | — | `["Object","Exit Isolation Mode"]` | `object.exitIsolation` |
| Isolate Selected Group | — | `["Object","Isolate Selected Group"]` | `object.isolate` |
| Group | — | `["Object","Group"]` | `object.group` |
| Ungroup | — | `["Object","Ungroup"]` | `object.ungroup` |
| Make Clipping Mask | — | `["Object","Make Clipping Mask"]` | `object.clippingMask.make` |
| Release Clipping Mask | — | `["Object","Release Clipping Mask"]` | `object.clippingMask.release` |
| Make Compound Path | — | `["Object","Make Compound Path"]` | `object.compoundPath.make` |
| Objects on Path | — | `["Object","Objects on Path"]` | `object.objectsOnPath.attach` |
| Release Compound Path | — | `["Object","Release Compound Path"]` | `object.compoundPath.release` |
| Selection | — | `["Object","Selection"]` | `object.lock` |
| All Artwork Above | — | `["Object","All Artwork Above"]` | `object.lock.above` |
| Other Layers | — | `["Object","Other Layers"]` | `object.lock.otherLayers` |
| Selection | — | `["Object","Selection"]` | `object.hide` |
| All Artwork Above | — | `["Object","All Artwork Above"]` | `object.hide.above` |
| Other Layers | — | `["Object","Other Layers"]` | `object.hide.otherLayers` |
| Unselected Artwork | — | `["Object","Unselected Artwork"]` | `object.hide.unselected` |
| Rasterize… | — | `["Object","Rasterize…"]` | `object.rasterize` |
| Vector Halftone… | — | `["Object","Vector Halftone…"]` | `object.vectorHalftone` |
