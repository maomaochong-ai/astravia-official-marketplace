# 上游命令与菜单（从 gridcraft 自己的源码导出）

这个文件不是转述，是从上游 gridcraft 仓库的 Rust 源码里读出来的条目：菜单路径、显示名、默认快捷键、
命令 id。判断"这个应用到底有哪些功能、叫什么名字"以这里和编辑器里实际看得到的界面为准，不要凭记忆编。

| 事实 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/storytold/gridcraft |
| 钉住的发布版本 | v0.16.0 |
| 站点来源 | `gridcraft-web-0.16.0.zip`（sha256 `31ec624efd27db5c…`） |
| 许可 | Apache-2.0 或 MIT（仓库内 LICENSE-APACHE / LICENSE-MIT） |
| 提取自 | `crates/ui-egui/src/menus*.rs`、`crates/engine/src/cmd/**` 等命令表 |
| 上游自述 | Spreadsheets and data; an open-source spreadsheet application. Formulas, ranges, charts, conditional formats and .xlsx files. |

## 菜单与命令

显示名与快捷键是上游的原文。命令 id 在两点上有用：它说明这条命令存在且是这一层级的正式入口；
面板里没有命令总线，所以**不要**指望把 id 当参数发过去——它是"要找的东西叫什么"的索引。

### File

| Item | Shortcut | Command id |
| --- | --- | --- |
| New Workbook |  | `file.new` |
| Open… |  | `file.open` |
| Save As… |  | `file.saveAs` |

### Edit

| Item | Shortcut | Command id |
| --- | --- | --- |
| Cut |  | `edit.cut` |
| Copy |  | `edit.copy` |
| Paste |  | `edit.paste` |
| Clear Contents |  | `edit.clearContents` |

### Object

| Item | Shortcut | Command id |
| --- | --- | --- |
| Delete |  | `object.delete` |

### Other commands

| Item | Shortcut | Command id |
| --- | --- | --- |
| — |  | `pasteSpecial` |
| — |  | `insertCells` |
| — |  | `deleteCells` |
| — |  | `filterValue` |
| — |  | `newComment` |
| — |  | `newNote` |
| — |  | `formatCells` |
| — |  | `pickList` |
| — |  | `defineName` |
| — |  | `insertLink` |
| — |  | `insertPaste` |
| — |  | `series` |
| — |  | `selectData` |
| — |  | `formatChart` |
| — |  | `rowHeight` |
| — |  | `columnWidth` |

### Styles

| Item | Shortcut | Command id |
| --- | --- | --- |
| styles |  | `styles.xml` |

## 同一源码里出现的其它命令 id

这些是在 `crates/ui-egui/src` 里被点名过的命令，按出现次数排序。菜单表没有收入它们（分布在上下文菜单、
面板命令、快捷键表里），但名字是真的：用它确认某个功能存在，再回到界面上找它的入口。

| 命令 id | 出现次数 |
| --- | --- |
| `selection.set` | 37 |
| `cell.set` | 33 |
| `chart.set` | 21 |
| `view.zoom` | 19 |
| `sheet.activate` | 17 |
| `file.save` | 11 |
| `ui.pythonMode` | 11 |
| `insert.picture` | 11 |
| `edit.undo` | 10 |
| `file.close` | 9 |
| `app.language.set` | 9 |
| `review.protectSheet` | 9 |
| `insert.chart` | 8 |
| `edit.goToSpecial` | 8 |
| `edit.pasteSpecial` | 8 |
| `edit.flashFill` | 8 |
| `table.style` | 8 |
| `sheet.move` | 7 |
| `ui.edit.begin` | 7 |
| `view.gridlines` | 7 |
| `view.headings` | 7 |
| `view.switchWindows` | 6 |
| `file.saveBytes` | 6 |
| `sheet.unhide` | 6 |
| `view.zoomToSelection` | 6 |
| `file.exportPdf` | 6 |
| `selection.move` | 6 |
| `view.formulaBar` | 6 |
| `review.protectWorkbook` | 6 |
| `review.showComments` | 6 |
| `sheet.hide` | 5 |
| `file.print` | 5 |
| `ui.ribbonTab` | 5 |
| `view.theme` | 5 |
| `edit.goTo` | 5 |
| `edit.formatPainter` | 5 |
| `insert.table` | 5 |
| `insert.textBox` | 5 |
| `view.newWindow` | 4 |
| `sheet.next` | 4 |
| `sheet.previous` | 4 |
| `edit.redo` | 4 |
| `view.arrangeAll` | 4 |
| `insert.recommendedCharts` | 4 |
| `ui.printSettings` | 4 |
| `ui.printSubmit` | 4 |
| `view.collapseRibbon` | 4 |
| `view.expandFormulaBar` | 4 |
| `ui.text` | 4 |
| `ui.edit.commit` | 4 |
| `sheet.rename` | 4 |
| `edit.find` | 4 |
| `edit.autoFill` | 4 |
| `view.freezePanes` | 4 |
| `edit.fillDown` | 4 |
| `edit.fillRight` | 4 |
| `insert.symbol` | 4 |
| `review.deleteComment` | 4 |
| `view.pageLayout` | 4 |
| `view.ruler` | 4 |
| `chart.addElement` | 4 |
| `view.statusBar` | 4 |
| `window.close` | 3 |
| `app.checkForUpdates` | 3 |
| `view.darkMode` | 3 |
| `view.animations` | 3 |
| `view.interfaceScale` | 3 |
| `app.language.english` | 3 |
| `ui.dialog` | 3 |
| `review.unprotectSheet` | 3 |


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
