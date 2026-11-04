# 上游命令与菜单（从 effectcraft 自己的源码导出）

这个文件不是转述，是从上游 effectcraft 仓库的 Rust 源码里读出来的条目：菜单路径、显示名、默认快捷键、
命令 id。判断"这个应用到底有哪些功能、叫什么名字"以这里和编辑器里实际看得到的界面为准，不要凭记忆编。

| 事实 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/storytold/effectcraft |
| 钉住的发布版本 | v0.20.0 |
| 站点来源 | `effectcraft-web-0.20.0.zip`（sha256 `24189ed0dc8e9b5e…`） |
| 许可 | Apache-2.0 或 MIT（仓库内 LICENSE-APACHE / LICENSE-MIT） |
| 提取自 | `crates/ui-egui/src/menus*.rs`、`crates/engine/src/cmd/**` 等命令表 |
| 上游自述 | Motion graphics and visual effects; an open-source professional motion graphics and VFX studio. Compositions, keyframes, effects and expressions. |

## 菜单与命令

显示名与快捷键是上游的原文。命令 id 在两点上有用：它说明这条命令存在且是这一层级的正式入口；
面板里没有命令总线，所以**不要**指望把 id 当参数发过去——它是"要找的东西叫什么"的索引。

### File

| Item | Shortcut | Command id |
| --- | --- | --- |
| One.ecproj |  | `file.openRecent` |

### Edit

| Item | Shortcut | Command id |
| --- | --- | --- |
| undo |  | `edit.undo` |
| redo |  | `edit.redo` |

### View

| Item | Shortcut | Command id |
| --- | --- | --- |
| New Viewer |  | `view.newViewer` |
| View Options… |  | `view.layerControls` |
| Show Grid |  | `view.grid` |
| Title/Action Safe |  | `view.safeMargins` |

### Text

| Item | Shortcut | Command id |
| --- | --- | --- |
| text.sourceText.style |  | `text.sourceText.style` |

### Timeline

| Item | Shortcut | Command id |
| --- | --- | --- |
| timeline.layer.*.row |  | `timeline.layer.12.row` |
| timeline.layer.*.row |  | `timeline.layer.12.bar` |

### Application

| Item | Shortcut | Command id |
| --- | --- | --- |
| Composition Settings… |  | `app.compSettings` |

### Dialogs

| Item | Shortcut | Command id |
| --- | --- | --- |
|   Revert   |  | `dialog.unsaved.revert` |
|    Save    |  | `dialog.unsaved.save` |

## 同一源码里出现的其它命令 id

这些是在 `crates/ui-egui/src` 里被点名过的命令，按出现次数排序。菜单表没有收入它们（分布在上下文菜单、
面板命令、快捷键表里），但名字是真的：用它确认某个功能存在，再回到界面上找它的入口。

| 命令 id | 出现次数 |
| --- | --- |
| `layer.setBlendMode` | 522 |
| `window.panel` | 453 |
| `layer.addTextAnimator` | 251 |
| `app.settings` | 237 |
| `edit.label` | 224 |
| `window.workspace` | 203 |
| `layer.setSwitch` | 168 |
| `layer.create` | 133 |
| `view.simulateOutput` | 130 |
| `layer.applyTextPreset` | 108 |
| `layer.transform` | 96 |
| `view.panelBackground` | 94 |
| `layer.trackMatte` | 92 |
| `edit.purge` | 91 |
| `layer.mask.mode` | 91 |
| `layer.setTransform` | 82 |
| `layer.new3dPrimitive` | 78 |
| `layer.arrange` | 57 |
| `layer.newSolid` | 52 |
| `help.docs` | 52 |
| `layer.mask.set` | 40 |
| `file.findMissing` | 39 |
| `layer.mask.motionBlur` | 39 |
| `layer.quality` | 39 |
| `layer.frameBlending` | 39 |
| `text.addSelector` | 39 |
| `view.layout` | 39 |
| `app.quit` | 31 |
| `layer.select` | 31 |
| `layer.newNull` | 31 |
| `layer.addItem` | 29 |
| `file.saveAs` | 28 |
| `file.close` | 28 |
| `file.import` | 27 |
| `app.templates` | 27 |
| `app.keyboardShortcuts` | 27 |
| `help.inAppTutorials` | 27 |
| `file.createProxy` | 26 |
| `layer.mask.featherFalloff` | 26 |
| `layer.sampling` | 26 |
| `layer.expressions` | 26 |
| `view.convertGuides` | 26 |
| `layer.settings` | 24 |
| `layer.newText` | 22 |
| `file.revealInFinder` | 22 |
| `file.open` | 22 |
| `file.newCompFromSelection` | 22 |
| `file.interpretFootage` | 22 |
| `edit.clear` | 21 |
| `edit.deselectAll` | 21 |
| `edit.paste` | 20 |
| `edit.duplicate` | 20 |
| `layer.revealInFinder` | 19 |
| `file.newProject` | 19 |
| `file.revert` | 19 |
| `edit.copy` | 19 |
| `layer.enableTimeRemap` | 19 |
| `layer.newCamera` | 18 |
| `help.discord` | 18 |
| `window.resetWorkspace` | 18 |
| `window.saveWorkspaceAs` | 18 |
| `window.editWorkspaces` | 18 |
| `file.runScript` | 18 |
| `edit.cut` | 18 |
| `layer.newLight` | 18 |
| `layer.precompose` | 18 |
| `view.customRgb` | 18 |
| `layer.addMarker` | 17 |
| `window.saveWorkspace` | 17 |
| `file.newFromTemplate` | 17 |


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
