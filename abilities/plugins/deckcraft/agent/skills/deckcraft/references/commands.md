# 命令索引（deckcraft）

这张表是这个插件自己的命令索引：每一条都是编辑器里真实存在的功能，`path` 一列直接就是
`deckcraft_menu` 的参数，`快捷键` 一列填进它的 `shortcut`。

先查表决定「用哪个功能」，再决定要不要碰坐标。表里没有的，多半是这一版没有，也可能是它只在面板上——以界面为准。

## File

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| New Presentation | — | `["File","New Presentation"]` | `file.new` |
| Save | — | `["File","Save"]` | `file.save` |
| Properties | — | `["File","Properties"]` | `file.properties` |
## Edit

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Cut | — | `["Edit","Cut"]` | `edit.cut` |
| Copy | — | `["Edit","Copy"]` | `edit.copy` |
| Paste | — | `["Edit","Paste"]` | `edit.paste` |
| Undo | — | `["Edit","Undo"]` | `edit.undo` |
| Redo | — | `["Edit","Redo"]` | `edit.redo` |
| Paste and Match Formatting | — | `["Edit","Paste and Match Formatting"]` | `edit.pasteText` |
| Select All | — | `["Edit","Select All"]` | `edit.selectAll` |
| Duplicate | — | `["Edit","Duplicate"]` | `edit.duplicate` |
## View

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Normal | — | `["View","Normal"]` | `view.normal` |
| Slide Sorter | — | `["View","Slide Sorter"]` | `view.sorter` |
| Notes Page | — | `["View","Notes Page"]` | `view.notesPage` |
| Outline View | — | `["View","Outline View"]` | `view.outline` |
| Reading View | — | `["View","Reading View"]` | `view.reading` |
| Slide Master | — | `["View","Slide Master"]` | `view.slideMaster` |
| Handout Master | — | `["View","Handout Master"]` | `view.handoutMaster` |
| Notes Master | — | `["View","Notes Master"]` | `view.notesMaster` |
| Ruler | — | `["View","Ruler"]` | `view.ruler` |
| Gridlines | — | `["View","Gridlines"]` | `view.gridlines` |
| Guides | — | `["View","Guides"]` | `view.guides` |
| Grid Options… | — | `["View","Grid Options…"]` | `view.gridOptions` |
| Zoom… | — | `["View","Zoom…"]` | `view.zoomDialog` |
| Zoom In | — | `["View","Zoom In"]` | `view.zoomIn` |
| Zoom Out | — | `["View","Zoom Out"]` | `view.zoomOut` |
| Fit to Window | — | `["View","Fit to Window"]` | `view.fit` |
| New Window | — | `["View","New Window"]` | `view.newWindow` |
## Insert

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| picture | — | `["Insert","picture"]` | `insert.picture` |
| audio | — | `["Insert","audio"]` | `insert.audio` |
| video | — | `["Insert","video"]` | `insert.video` |
| Text Box | — | `["Insert","Text Box"]` | `insert.textBox` |
## （名称在导出时残缺，只能用快捷键或 id 定位）

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| WordArt | — | — | `insert.wordArt` |
## Insert

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Date and Time | — | `["Insert","Date and Time"]` | `insert.dateTime` |
| Slide Number | — | `["Insert","Slide Number"]` | `insert.slideNumber` |
| Table… | — | `["Insert","Table…"]` | `insert.table` |
| Chart | — | `["Insert","Chart"]` | `insert.chart` |
| Photo Album… | — | `["Insert","Photo Album…"]` | `insert.photoAlbum` |
| Edit Photo Album… | — | `["Insert","Edit Photo Album…"]` | `insert.photoAlbumEdit` |
## Format

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Bullets | — | `["Format","Bullets"]` | `format.bullets` |
| Numbering | — | `["Format","Numbering"]` | `format.numbering` |
| Font… | — | `["Format","Font…"]` | `format.fontDialog` |
| Paragraph… | — | `["Format","Paragraph…"]` | `format.paragraphDialog` |
| Bold | — | `["Format","Bold"]` | `format.bold` |
| Italic | — | `["Format","Italic"]` | `format.italic` |
| Underline | — | `["Format","Underline"]` | `format.underline` |
| Align Left | — | `["Format","Align Left"]` | `format.alignLeft` |
| Center | — | `["Format","Center"]` | `format.alignCenter` |
| Align Right | — | `["Format","Align Right"]` | `format.alignRight` |
| Justify | — | `["Format","Justify"]` | `format.justify` |
| Right-to-Left Text Direction | — | `["Format","Right-to-Left Text Direction"]` | `format.rtl` |
## Application

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Open… | — | `["Application","Open…"]` | `app.openDialog` |
| Close | — | `["Application","Close"]` | `app.closePresentation` |
| Save As… | — | `["Application","Save As…"]` | `app.saveAsDialog` |
| Export… | — | `["Application","Export…"]` | `app.exportDialog` |
| Print… | — | `["Application","Print…"]` | `app.print` |
| Paste Special… | — | `["Application","Paste Special…"]` | `app.pasteSpecial` |
| Find… | — | `["Application","Find…"]` | `app.find` |
| Replace… | — | `["Application","Replace…"]` | `app.replace` |
| Picture from File… | — | `["Application","Picture from File…"]` | `app.insertPictureDialog` |
| Audio from File… | — | `["Application","Audio from File…"]` | `app.insertAudioDialog` |
| Video from File… | — | `["Application","Video from File…"]` | `app.insertVideoDialog` |
| About DeckCraft | — | `["Application","About DeckCraft"]` | `app.about` |
| Check for Updates… | — | `["Application","Check for Updates…"]` | `app.checkUpdates` |
| Command Palette | — | `["Application","Command Palette"]` | `app.palette` |
## Arrange

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Bring to Front | — | `["Arrange","Bring to Front"]` | `arrange.bringToFront` |
| Send to Back | — | `["Arrange","Send to Back"]` | `arrange.sendToBack` |
| Bring Forward | — | `["Arrange","Bring Forward"]` | `arrange.bringForward` |
| Send Backward | — | `["Arrange","Send Backward"]` | `arrange.sendBackward` |
| Group | — | `["Arrange","Group"]` | `arrange.group` |
| Ungroup | — | `["Arrange","Ungroup"]` | `arrange.ungroup` |
| Regroup | — | `["Arrange","Regroup"]` | `arrange.regroup` |
| Rotate Left 90° | — | `["Arrange","Rotate Left 90°"]` | `arrange.rotateLeft` |
| Rotate Right 90° | — | `["Arrange","Rotate Right 90°"]` | `arrange.rotateRight` |
| Flip Horizontal | — | `["Arrange","Flip Horizontal"]` | `arrange.flipHorizontal` |
| Flip Vertical | — | `["Arrange","Flip Vertical"]` | `arrange.flipVertical` |
## Review

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| open | — | `["Review","open"]` | `review.compare` |
## Shapes

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Close Path | — | `["Shapes","Close Path"]` | `shape.closePath` |
| Open Path | — | `["Shapes","Open Path"]` | `shape.openPath` |
| Size and Position… | — | `["Shapes","Size and Position…"]` | `shape.sizePosition` |
## Slides

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Delete Slide | — | `["Slides","Delete Slide"]` | `slide.delete` |
| New Slide | — | `["Slides","New Slide"]` | `slide.new` |
| Duplicate Slide | — | `["Slides","Duplicate Slide"]` | `slide.duplicate` |
| Hide Slide | — | `["Slides","Hide Slide"]` | `slide.hide` |
