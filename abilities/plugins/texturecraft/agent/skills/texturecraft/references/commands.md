# 命令表（texturecraft）

这张表由同目录的 `upstream.md` 生成——每一条都是上游版本里真实存在的功能，没有一条是凭记忆写的。
两列直接就是参数：`快捷键` 填进 `texturecraft_menu` 的 `shortcut`，`path` 填进 `path`（照抄，含省略号）。

先查这张表，再决定要不要碰坐标。表里没有的功能，说明这一版上游没有。

## File

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| New project... | Ctrl+N | `["File","New project..."]` | `ui.newProject` |
| Open... | Ctrl+O | `["File","Open..."]` | `file.open` |
| Open sample project... | — | `["File","Open sample project..."]` | `project.sample` |
| Close | Ctrl+F4 | `["File","Close"]` | `file.close` |
| Save | Ctrl+S | `["File","Save"]` | `file.save` |
| Save as... | Ctrl+Shift+S | `["File","Save as..."]` | `file.saveAs` |
| Save a copy... | — | `["File","Save a copy..."]` | `file.saveCopy` |
| Remove unused resources... | — | `["File","Remove unused resources..."]` | `file.removeUnused` |
| Import resources... | — | `["File","Import resources..."]` | `resource.import` |
| Import MaterialX material... | — | `["File","Import MaterialX material..."]` | `file.importMaterialX` |
| Import material... | — | `["File","Import material..."]` | `material.load` |
| Export Textures... | Ctrl+Shift+E | `["File","Export Textures..."]` | `ui.export` |
| Export Mesh... | — | `["File","Export Mesh..."]` | `file.exportMesh` |
| Quit | Ctrl+Q | `["File","Quit"]` | `ui.quit` |

## Edit

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Undo | Ctrl+Z | `["Edit","Undo"]` | `edit.undo` |
| Redo | Ctrl+Y | `["Edit","Redo"]` | `edit.redo` |
| Project Configuration... | — | `["Edit","Project Configuration..."]` | `ui.projectConfig` |
| Reimport mesh | Ctrl+Shift+R | `["Edit","Reimport mesh"]` | `file.reimportMesh` |
| Settings... | — | `["Edit","Settings..."]` | `ui.settings` |

## Window

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Load UI Layout | — | `["Window","Load UI Layout"]` | `ui.layout.load` |
| Hide UI | Tab | `["Window","Hide UI"]` | `ui.hideUi` |
| Reset UI | — | `["Window","Reset UI"]` | `ui.resetUi` |

## Window › Save UI Layout

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Save current layout... | — | `["Window","Save UI Layout","Save current layout..."]` | `ui.layout.save` |

## Window › Views

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Assets | — | `["Window","Views","Assets"]` | `ui.view.assets` |
| Display Settings | — | `["Window","Views","Display Settings"]` | `ui.view.display` |
| History | — | `["Window","Views","History"]` | `ui.view.history` |
| Layers | — | `["Window","Views","Layers"]` | `ui.view.layers` |
| Log | — | `["Window","Views","Log"]` | `ui.view.log` |
| Properties | — | `["Window","Views","Properties"]` | `ui.view.properties` |
| Shader Settings | — | `["Window","Views","Shader Settings"]` | `ui.view.shader` |
| Texture Set List | — | `["Window","Views","Texture Set List"]` | `ui.view.textureSetList` |
| Texture Set Settings | — | `["Window","Views","Texture Set Settings"]` | `ui.view.textureSetSettings` |

## Help

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Documentation... | — | `["Help","Documentation..."]` | `ui.help.docs` |
| Shortcuts list... | — | `["Help","Shortcuts list..."]` | `ui.help.shortcuts` |
| Join the community (Discord)... | — | `["Help","Join the community (Discord)..."]` | `ui.help.discord` |
| ArtCraft website... | — | `["Help","ArtCraft website..."]` | `ui.help.website` |
| Report a bug... | — | `["Help","Report a bug..."]` | `ui.help.bug` |
| About TextureCraft... | — | `["Help","About TextureCraft..."]` | `ui.about` |

## Mode

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Bake Mesh Maps | F8 | `["Mode","Bake Mesh Maps"]` | `ui.mode.bake` |
| Painting | F9 | `["Mode","Painting"]` | `ui.mode.paint` |
| Rendering (path traced) | F10 | `["Mode","Rendering (path traced)"]` | `ui.mode.render` |

## Viewport

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Display material | M | `["Viewport","Display material"]` | `viewport.displayMaterial` |
| Display next channel | C | `["Viewport","Display next channel"]` | `viewport.nextChannel` |
| Display previous channel | Shift+C | `["Viewport","Display previous channel"]` | `viewport.previousChannel` |
| Display next mesh map | B | `["Viewport","Display next mesh map"]` | `viewport.nextMeshMap` |
| Display previous mesh map | Shift+B | `["Viewport","Display previous mesh map"]` | `viewport.previousMeshMap` |
| UV checker | — | `["Viewport","UV checker"]` | `ui.uvChecker` |
| Show entire mesh | F | `["Viewport","Show entire mesh"]` | `viewport.frame` |
| 3D/2D views | F1 | `["Viewport","3D/2D views"]` | `ui.layout.split` |
| 3D view only | F2 | `["Viewport","3D view only"]` | `ui.layout.3d` |
| 2D view only | F3 | `["Viewport","2D view only"]` | `ui.layout.2d` |
| Enable quick mask | Y | `["Viewport","Enable quick mask"]` | `viewport.quickMask` |
| Edit quick mask | U | `["Viewport","Edit quick mask"]` | `viewport.quickMask.edit` |
| Invert quick mask | Ctrl+Shift+I | `["Viewport","Invert quick mask"]` | `viewport.quickMask.invert` |

