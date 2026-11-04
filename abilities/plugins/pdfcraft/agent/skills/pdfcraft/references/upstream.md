# 上游命令与菜单（从 pdfcraft 自己的源码导出）

这个文件不是转述，是从上游 pdfcraft 仓库的 Rust 源码里读出来的条目：菜单路径、显示名、默认快捷键、
命令 id。判断"这个应用到底有哪些功能、叫什么名字"以这里和编辑器里实际看得到的界面为准，不要凭记忆编。

| 事实 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/storytold/pdfcraft |
| 钉住的发布版本 | v0.17.0 |
| 站点来源 | `pdfcraft-web-0.17.0.zip`（sha256 `393420ab35e25afc…`） |
| 许可 | Apache-2.0 或 MIT（仓库内 LICENSE-APACHE / LICENSE-MIT） |
| 提取自 | `crates/ui-egui/src/menus*.rs`、`crates/engine/src/cmd/**` 等命令表 |
| 上游自述 | The PDF workbench; an open-source PDF reader and editor. Read, organise, combine, split, annotate and secure PDFs. |

## 菜单与命令

显示名与快捷键是上游的原文。命令 id 在两点上有用：它说明这条命令存在且是这一层级的正式入口；
面板里没有命令总线，所以**不要**指望把 id 当参数发过去——它是"要找的东西叫什么"的索引。

### File

| Item | Shortcut | Command id |
| --- | --- | --- |
| — |  | `create.blank` |
| — |  | `file.open` |
| — |  | `file.open_recent` |
| — |  | `file.pin_folder` |
| — |  | `page.combine` |
| — |  | `file.save` |
| — |  | `file.save_as` |
| — |  | `file.revert` |
| — |  | `file.close` |
| — |  | `file.close_all` |
| — |  | `optimize.reduce` |
| — |  | `optimize.advanced` |
| — |  | `file.properties` |
| — |  | `file.word_count` |
| — |  | `print.dialog` |

### Edit

| Item | Shortcut | Command id |
| --- | --- | --- |
| — |  | `edit.undo` |
| — |  | `edit.redo` |
| — |  | `edit.copy` |
| — |  | `edit.find` |
| — |  | `edit.advanced_search` |
| — |  | `edit.column_select` |
| — |  | `edit.snapshot` |
| — |  | `edit.attach` |
| — |  | `form.clear` |
| — |  | `app.preferences` |

### View

| Item | Shortcut | Command id |
| --- | --- | --- |
| palette |  | `view.read_mode` |

### Window

| Item | Shortcut | Command id |
| --- | --- | --- |
| — |  | `view.next_tab` |
| — |  | `view.previous_tab` |

### Pages

| Item | Shortcut | Command id |
| --- | --- | --- |
| — |  | `page.organize` |
| — |  | `page.insert_blank` |
| — |  | `page.insert` |
| — |  | `page.replace` |
| — |  | `page.extract` |
| — |  | `page.split` |
| — |  | `page.duplicate` |
| — |  | `page.delete` |
| — |  | `page.rotate` |
| — |  | `page.rotate_ccw` |
| — |  | `page.rotate_dialog` |
| — |  | `page.reverse` |
| — |  | `page.crop` |
| — |  | `page.boxes` |
| — |  | `page.number` |
| — |  | `page.properties` |
| — |  | `bookmark.add` |
| — |  | `bookmark.from_structure` |
| — |  | `bookmark.from_text_styles` |

### Sign

| Item | Shortcut | Command id |
| --- | --- | --- |
| — |  | `sign.fill.signature.change` |
| — |  | `sign.fill.initials.change` |
| — |  | `sign.fill.signature.remove` |
| — |  | `sign.fill.initials.remove` |
| — |  | `sign.digital` |
| — |  | `sign.certify` |
| — |  | `sign.certify_invisible` |
| — |  | `form.add.signature` |
| — |  | `sign.validate` |
| — |  | `sign.panel` |

## 同一源码里出现的其它命令 id

这些是在 `crates/ui-egui/src` 里被点名过的命令，按出现次数排序。菜单表没有收入它们（分布在上下文菜单、
面板命令、快捷键表里），但名字是真的：用它确认某个功能存在，再回到界面上找它的入口。

| 命令 id | 出现次数 |
| --- | --- |
| `out.pdf` | 17 |
| `report.pdf` | 16 |
| `a.pdf` | 13 |
| `edit.copy` | 11 |
| `export.text` | 11 |
| `fonts.conf` | 11 |
| `file.open_recent` | 10 |
| `ui.state` | 9 |
| `com.apple.quarantine` | 8 |
| `view.layout.two_up` | 7 |
| `view.continuous` | 7 |
| `protect.password` | 7 |
| `edit.undo` | 7 |
| `view.layout.single` | 6 |
| `print.dialog` | 6 |
| `file.clear_recent` | 6 |
| `view.tools_pane` | 6 |
| `page.rotate` | 6 |
| `edit.redo` | 6 |
| `com.apple.LaunchServices.OpenWith` | 6 |
| `comment.ink` | 6 |
| `conf.d` | 6 |
| `dropped.pdf` | 5 |
| `three.pdf` | 5 |
| `file.open` | 5 |
| `app.preferences` | 5 |
| `view.theme.light` | 5 |
| `view.theme.dark` | 5 |
| `view.theme.system` | 5 |
| `file.save` | 5 |
| `view.next_view` | 5 |
| `protect.remove` | 5 |
| `page.organize` | 5 |
| `page.insert` | 5 |
| `ui.click` | 5 |
| `other.pdf` | 5 |
| `b.pdf` | 5 |
| `startup.pdf` | 5 |
| `doc.pdf` | 5 |
| `page.number` | 4 |
| `page.properties` | 4 |
| `file.save_as` | 4 |
| `view.page_gaps` | 4 |
| `view.layout.cover` | 4 |
| `view.fit_one_page` | 4 |
| `view.full_screen` | 4 |
| `view.previous_view` | 4 |
| `file.close` | 4 |
| `ui.dock.reset` | 4 |
| `view.side_panel` | 4 |
| `page.delete` | 4 |
| `page.insert_blank` | 4 |
| `page.crop` | 4 |
| `page.extract` | 4 |
| `sign.fill.initials.change` | 4 |
| `ui.commands` | 4 |
| `ui.drag` | 4 |
| `source.pdf` | 4 |
| `c.pdf` | 4 |
| `sign.fill.signature` | 4 |
| `sign.fill.initials` | 4 |
| `x.pdf` | 4 |
| `file.properties` | 3 |
| `view.fit_width_scrolling` | 3 |
| `view.fit_visible` | 3 |
| `file.word_count` | 3 |
| `protect.unlock` | 3 |
| `optimize.advanced` | 3 |
| `help.about` | 3 |
| `view.palette` | 3 |


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
