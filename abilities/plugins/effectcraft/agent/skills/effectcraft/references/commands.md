# 命令表（effectcraft）

这张表由同目录的 `upstream.md` 生成——每一条都是上游版本里真实存在的功能，没有一条是凭记忆写的。
两列直接就是参数：`快捷键` 填进 `effectcraft_menu` 的 `shortcut`，`path` 填进 `path`（照抄，含省略号）。

先查这张表，再决定要不要碰坐标。表里没有的功能，说明这一版上游没有。

## File

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

## Text

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| text.sourceText.style | — | — | `text.sourceText.style` |

## Timeline

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
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

