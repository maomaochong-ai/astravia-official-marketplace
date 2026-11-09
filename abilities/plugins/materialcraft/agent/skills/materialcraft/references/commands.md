# 命令表（materialcraft）

这张表由同目录的 `upstream.md` 生成——每一条都是上游版本里真实存在的功能，没有一条是凭记忆写的。
两列直接就是参数：`快捷键` 填进 `materialcraft_menu` 的 `shortcut`，`path` 填进 `path`（照抄，含省略号）。

先查这张表，再决定要不要碰坐标。表里没有的功能，说明这一版上游没有。

## File

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Open... | Ctrl+O | `["File","Open..."]` | `file.open` |
| Save | Ctrl+S | `["File","Save"]` | `file.save` |
| Save as... | Ctrl+Shift+S | `["File","Save as..."]` | `file.saveAs` |
| Close all | — | `["File","Close all"]` | `ui.closeAll` |
| Import bitmap... | — | `["File","Import bitmap..."]` | `file.importBitmap` |
| Export outputs... | Ctrl+Shift+E | `["File","Export outputs..."]` | `ui.export` |
| Export material... | — | `["File","Export material..."]` | `file.exportMaterial` |
| Send to TextureCraft | — | `["File","Send to TextureCraft"]` | `file.sendToTextureCraft` |
| Reload resources | — | `["File","Reload resources"]` | `ui.reloadResources` |
| Exit | Ctrl+Q | `["File","Exit"]` | `ui.quit` |

## File › New

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Graph... | Ctrl+N | `["File","New","Graph..."]` | `ui.newGraph` |
| Function graph | — | `["File","New","Function graph"]` | `ui.newFunctionGraph` |
| Empty package | — | `["File","New","Empty package"]` | `file.newPackage` |

## Edit

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Undo | Ctrl+Z | `["Edit","Undo"]` | `edit.undo` |
| Redo | Ctrl+Y | `["Edit","Redo"]` | `edit.redo` |
| Copy | Ctrl+C | `["Edit","Copy"]` | `edit.copy` |
| Cut | Ctrl+X | `["Edit","Cut"]` | `edit.cut` |
| Paste | Ctrl+V | `["Edit","Paste"]` | `edit.paste` |
| Duplicate | Ctrl+D | `["Edit","Duplicate"]` | `edit.duplicate` |
| Delete | Delete | `["Edit","Delete"]` | `edit.delete` |
| Delete and relink | Backspace | `["Edit","Delete and relink"]` | `edit.deleteRelink` |
| Select all | Ctrl+A | `["Edit","Select all"]` | `edit.selectAll` |
| Preferences... | — | `["Edit","Preferences..."]` | `ui.preferences` |

## Tools

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Compute graph | F5 | `["Tools","Compute graph"]` | `graph.cook` |
| Clear cache | — | `["Tools","Clear cache"]` | `ui.clearCache` |
| Create graph from selection | — | `["Tools","Create graph from selection"]` | `graph.createFromSelection` |

## Tools › Preview size

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| 256 px | — | `["Tools","Preview size","256 px"]` | `ui.preview.256` |
| 512 px | — | `["Tools","Preview size","512 px"]` | `ui.preview.512` |
| 1024 px | — | `["Tools","Preview size","1024 px"]` | `ui.preview.1024` |
| 2048 px | — | `["Tools","Preview size","2048 px"]` | `ui.preview.2048` |
| Full size | — | `["Tools","Preview size","Full size"]` | `ui.preview.0` |

## Help

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Home screen... | — | `["Help","Home screen..."]` | `ui.home` |
| Documentation... | — | `["Help","Documentation..."]` | `ui.help.docs` |
| Shortcuts list... | — | `["Help","Shortcuts list..."]` | `ui.help.shortcuts` |
| Join the community (Discord)... | — | `["Help","Join the community (Discord)..."]` | `ui.help.discord` |
| ArtCraft website... | — | `["Help","ArtCraft website..."]` | `ui.help.website` |
| Report a bug... | — | `["Help","Report a bug..."]` | `ui.help.bug` |
| About MaterialCraft... | — | `["Help","About MaterialCraft..."]` | `ui.about` |

## Windows

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Explorer | — | `["Windows","Explorer"]` | `ui.view.explorer` |
| Graph | — | `["Windows","Graph"]` | `ui.view.graph` |
| Properties | — | `["Windows","Properties"]` | `ui.view.properties` |
| Console | — | `["Windows","Console"]` | `ui.view.console` |
| 3D View | — | `["Windows","3D View"]` | `ui.view.3d` |
| 2D View | — | `["Windows","2D View"]` | `ui.view.2d` |
| Library | — | `["Windows","Library"]` | `ui.view.library` |
| History | — | `["Windows","History"]` | `ui.view.history` |
| Reset layout | — | `["Windows","Reset layout"]` | `ui.resetLayout` |

