# 上游命令与菜单（从 deckcraft 自己的源码导出）

这个文件不是转述，是从上游 deckcraft 仓库的 Rust 源码里读出来的条目：菜单路径、显示名、默认快捷键、
命令 id。判断"这个应用到底有哪些功能、叫什么名字"以这里和编辑器里实际看得到的界面为准，不要凭记忆编。

| 事实 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/storytold/deckcraft |
| 钉住的发布版本 | v0.15.0 |
| 站点来源 | `deckcraft-web-0.15.0.zip`（sha256 `b617413b27514cc7…`） |
| 许可 | Apache-2.0 或 MIT（仓库内 LICENSE-APACHE / LICENSE-MIT） |
| 提取自 | `crates/ui-egui/src/menus*.rs`、`crates/engine/src/cmd/**` 等命令表 |
| 上游自述 | Presentations and slide shows; an open-source presentation designer. Themes, layouts, shapes, pictures, tables, charts, transitions and animations, with .pptx files. |

## 菜单与命令

显示名与快捷键是上游的原文。命令 id 在两点上有用：它说明这条命令存在且是这一层级的正式入口；
面板里没有命令总线，所以**不要**指望把 id 当参数发过去——它是"要找的东西叫什么"的索引。

### File

| Item | Shortcut | Command id |
| --- | --- | --- |
| New Presentation |  | `file.new` |
| Save |  | `file.save` |
| Properties |  | `file.properties` |

### Edit

| Item | Shortcut | Command id |
| --- | --- | --- |
| Cut |  | `edit.cut` |
| Copy |  | `edit.copy` |
| Paste |  | `edit.paste` |
| Undo |  | `edit.undo` |
| Redo |  | `edit.redo` |
| Paste and Match Formatting |  | `edit.pasteText` |
| Select All |  | `edit.selectAll` |
| Duplicate |  | `edit.duplicate` |

### View

| Item | Shortcut | Command id |
| --- | --- | --- |
| Normal |  | `view.normal` |
| Slide Sorter |  | `view.sorter` |
| Notes Page |  | `view.notesPage` |
| Outline View |  | `view.outline` |
| Reading View |  | `view.reading` |
| Slide Master |  | `view.slideMaster` |
| Handout Master |  | `view.handoutMaster` |
| Notes Master |  | `view.notesMaster` |
| Ruler |  | `view.ruler` |
| Gridlines |  | `view.gridlines` |
| Guides |  | `view.guides` |
| Grid Options… |  | `view.gridOptions` |
| Zoom… |  | `view.zoomDialog` |
| Zoom In |  | `view.zoomIn` |
| Zoom Out |  | `view.zoomOut` |
| Fit to Window |  | `view.fit` |
| New Window |  | `view.newWindow` |

### Insert

| Item | Shortcut | Command id |
| --- | --- | --- |
| picture |  | `insert.picture` |
| audio |  | `insert.audio` |
| video |  | `insert.video` |
| Text Box |  | `insert.textBox` |
| WordArt |  | `insert.wordArt` |
| Date and Time |  | `insert.dateTime` |
| Slide Number |  | `insert.slideNumber` |
| Table… |  | `insert.table` |
| Chart |  | `insert.chart` |
| Photo Album… |  | `insert.photoAlbum` |
| Edit Photo Album… |  | `insert.photoAlbumEdit` |

### Format

| Item | Shortcut | Command id |
| --- | --- | --- |
| Bullets |  | `format.bullets` |
| Numbering |  | `format.numbering` |
| Font… |  | `format.fontDialog` |
| Paragraph… |  | `format.paragraphDialog` |
| Bold |  | `format.bold` |
| Italic |  | `format.italic` |
| Underline |  | `format.underline` |
| Align Left |  | `format.alignLeft` |
| Center |  | `format.alignCenter` |
| Align Right |  | `format.alignRight` |
| Justify |  | `format.justify` |
| Right-to-Left Text Direction |  | `format.rtl` |

### Application

| Item | Shortcut | Command id |
| --- | --- | --- |
| Open… |  | `app.openDialog` |
| Close |  | `app.closePresentation` |
| Save As… |  | `app.saveAsDialog` |
| Export… |  | `app.exportDialog` |
| Print… |  | `app.print` |
| Paste Special… |  | `app.pasteSpecial` |
| Find… |  | `app.find` |
| Replace… |  | `app.replace` |
| Picture from File… |  | `app.insertPictureDialog` |
| Audio from File… |  | `app.insertAudioDialog` |
| Video from File… |  | `app.insertVideoDialog` |
| About DeckCraft |  | `app.about` |
| Check for Updates… |  | `app.checkUpdates` |
| Command Palette |  | `app.palette` |

### Arrange

| Item | Shortcut | Command id |
| --- | --- | --- |
| Bring to Front |  | `arrange.bringToFront` |
| Send to Back |  | `arrange.sendToBack` |
| Bring Forward |  | `arrange.bringForward` |
| Send Backward |  | `arrange.sendBackward` |
| Group |  | `arrange.group` |
| Ungroup |  | `arrange.ungroup` |
| Regroup |  | `arrange.regroup` |
| Rotate Left 90° |  | `arrange.rotateLeft` |
| Rotate Right 90° |  | `arrange.rotateRight` |
| Flip Horizontal |  | `arrange.flipHorizontal` |
| Flip Vertical |  | `arrange.flipVertical` |

### Review

| Item | Shortcut | Command id |
| --- | --- | --- |
| open |  | `review.compare` |

### Shapes

| Item | Shortcut | Command id |
| --- | --- | --- |
| Close Path |  | `shape.closePath` |
| Open Path |  | `shape.openPath` |
| Size and Position… |  | `shape.sizePosition` |

### Slides

| Item | Shortcut | Command id |
| --- | --- | --- |
| Delete Slide |  | `slide.delete` |
| New Slide |  | `slide.new` |
| Duplicate Slide |  | `slide.duplicate` |
| Hide Slide |  | `slide.hide` |


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
