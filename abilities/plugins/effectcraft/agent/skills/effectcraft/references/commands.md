# 命令索引（effectcraft）

这张表是这个插件自己的命令索引：每一条都是编辑器里真实存在的功能，`path` 一列直接就是
`effectcraft_menu` 的参数，`快捷键` 一列填进它的 `shortcut`。

先查表决定「用哪个功能」，再决定要不要碰坐标。表里没有的，多半是这一版没有，也可能是它只在面板上——以界面为准。

## （名称在导出时残缺，只能用快捷键或 id 定位）

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| One.ecproj | — | — | `file.openRecent` |
## Edit

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| undo | — | `["Edit","undo"]` | `edit.undo` |
| redo | — | `["Edit","redo"]` | `edit.redo` |
## View

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| New Viewer | — | `["View","New Viewer"]` | `view.newViewer` |
| View Options… | — | `["View","View Options…"]` | `view.layerControls` |
| Show Grid | — | `["View","Show Grid"]` | `view.grid` |
| Title/Action Safe | — | `["View","Title/Action Safe"]` | `view.safeMargins` |
## （名称在导出时残缺，只能用快捷键或 id 定位）

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| text.sourceText.style | — | — | `text.sourceText.style` |
| timeline.layer.*.row | — | — | `timeline.layer.12.row` |
| timeline.layer.*.row | — | — | `timeline.layer.12.bar` |
## Application

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Composition Settings… | — | `["Application","Composition Settings…"]` | `app.compSettings` |
## Dialogs

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Revert | — | `["Dialogs","Revert"]` | `dialog.unsaved.revert` |
| Save | — | `["Dialogs","Save"]` | `dialog.unsaved.save` |
