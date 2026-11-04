# 上游命令与菜单（从 wordcraft 自己的源码导出）

这个文件不是转述，是从上游 wordcraft 仓库的 Rust 源码里读出来的条目：菜单路径、显示名、默认快捷键、
命令 id。判断"这个应用到底有哪些功能、叫什么名字"以这里和编辑器里实际看得到的界面为准，不要凭记忆编。

| 事实 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/storytold/wordcraft |
| 钉住的发布版本 | v0.15.0 |
| 站点来源 | `wordcraft-web-0.15.0.zip`（sha256 `c5a02d4e4f1d3e59…`） |
| 许可 | Apache-2.0 或 MIT（仓库内 LICENSE-APACHE / LICENSE-MIT） |
| 提取自 | `crates/ui-egui/src/menus*.rs`、`crates/engine/src/cmd/**` 等命令表 |
| 上游自述 | Writing and document design; an open-source word processor. Styles, tables, sections, references, review marks and .docx files. |

## 菜单与命令

显示名与快捷键是上游的原文。命令 id 在两点上有用：它说明这条命令存在且是这一层级的正式入口；
面板里没有命令总线，所以**不要**指望把 id 当参数发过去——它是"要找的东西叫什么"的索引。

### File

| Item | Shortcut | Command id |
| --- | --- | --- |
| Rename Document |  | `file.rename` |
| New | Mod+N | `file.new` |
| Open | Mod+O / Mod+F12 / Mod+Alt+F2 | `file.open` |
| Save | Mod+S / Shift+F12 / Alt+Shift+F2 | `file.save` |
| Save As |  | `file.saveAs` |
| Encrypt with Password |  | `file.encrypt` |
| Export PDF |  | `file.exportPdf` |
| Export Page as PNG |  | `file.exportPng` |
| Print Markup |  | `file.printMarkup` |
| Print to PDF |  | `file.printPdf` |
| Print | Mod+P / Mod+Shift+F12 / Mod+F2 / Mod+Alt+I | `file.print` |
| Close | Mod+W / Mod+F4 | `file.close` |
| Close Document |  | `file.closeDocument` |
| Properties |  | `file.properties` |
| Info |  | `file.info` |
| User Name |  | `file.setAuthor` |
| Privacy Options |  | `file.privacyOptions` |
| Privacy Settings |  | `file.privacy` |
| Options |  | `file.options` |
| Check Accessibility |  | `file.accessibility` |
| Inspect Document |  | `file.inspect` |
| Protect Document |  | `file.protect` |
| Version History |  | `file.versions` |
| Recover Unsaved Documents |  | `file.recover` |
| New from Template |  | `file.newFromTemplate` |
| Save as Template |  | `file.saveTemplate` |
| AutoSave |  | `file.autosave` |
| Check Compatibility |  | `file.compatibility` |
| Share |  | `file.share` |
| Personal Templates |  | `file.listTemplates` |

### Edit

| Item | Shortcut | Command id |
| --- | --- | --- |
| Undo | Mod+Z | `edit.undo` |
| Undo Actions |  | `edit.undoTo` |
| Undo History |  | `edit.undoHistory` |
| Redo | Mod+Y / Mod+Shift+Z | `edit.redo` |
| Cut | Mod+X | `edit.cut` |
| Copy | Mod+C / Mod+Insert | `edit.copy` |
| Spike | Mod+F3 | `edit.spike` |
| Insert Spike | Mod+Shift+F3 | `edit.insertSpike` |
| Paste | Mod+V / Shift+Insert | `edit.paste` |
| Paste: Keep Text Only | Mod+Shift+Alt+V | `edit.pasteText` |
| Paste: Merge Formatting |  | `edit.pasteMerge` |
| Clipboard Pane |  | `edit.clipboardPane` |
| Clipboard Items |  | `edit.clipboardItems` |
| Paste Clipboard Item |  | `edit.pasteClipboardItem` |
| Paste All |  | `edit.pasteAllClipboard` |
| Delete Clipboard Item |  | `edit.deleteClipboardItem` |
| Clear All |  | `edit.clearClipboard` |
| Find | Mod+F | `edit.find` |
| Advanced Find |  | `edit.advancedFind` |
| Find Next | Mod+G / F3 / Shift+F4 / Mod+PageDown | `edit.findNext` |
| Find Previous |  | `edit.findPrevious` |
| Replace |  | `edit.replace` |
| Find and Replace |  | `edit.findReplace` |
| Replace All |  | `edit.replaceAll` |
| Go To | Mod+Alt+G / F5 | `edit.goto` |
| Go Back | Shift+F5 / Mod+Alt+Z | `edit.goBack` |
| Format Painter |  | `edit.formatPainter` |
| Copy Formatting | Mod+Shift+C | `edit.copyFormat` |
| Paste Formatting | Mod+Shift+V | `edit.pasteFormat` |
| Paste Special | Mod+Alt+V | `edit.pasteSpecial` |
| Repeat | F4 | `edit.repeat` |

### View

| Item | Shortcut | Command id |
| --- | --- | --- |
| Field Codes | Alt+F9 | `view.fieldCodes` |
| Immersive Reader |  | `view.immersive` |
| Vertical |  | `view.vertical` |
| Side to Side |  | `view.sideToSide` |
| Show/Hide ¶ | Mod+Shift+8 / Mod+8 | `view.marks` |
| Print Layout | Mod+Alt+P | `view.printLayout` |
| Web Layout |  | `view.webLayout` |
| Draft | Mod+Alt+N | `view.draft` |
| Outline | Mod+Alt+O | `view.outline` |
| Read Mode |  | `view.readMode` |
| Reading Column Width |  | `view.readColumnWidth` |
| Reading Text Size |  | `view.readTextSize` |
| Reading Line Spacing |  | `view.readLineSpacing` |
| Reading Page Color |  | `view.readPageColor` |
| Hide White Space |  | `view.hideWhiteSpace` |
| Focus |  | `view.focus` |
| Full Screen View |  | `view.fullScreenView` |
| Ruler |  | `view.ruler` |
| Gridlines |  | `view.gridlines` |
| Navigation Pane |  | `view.navigationPane` |
| Zoom |  | `view.zoom` |
| 100% |  | `view.zoom100` |
| Zoom In |  | `view.zoomIn` |
| Zoom Out |  | `view.zoomOut` |
| One Page |  | `view.onePage` |
| Multiple Pages |  | `view.multiplePages` |
| Page Width |  | `view.pageWidth` |
| Switch Modes |  | `view.darkMode` |
| Interface Theme |  | `view.interfaceTheme` |
| Styles Pane |  | `view.stylesPane` |
| Styles Pane Position |  | `view.stylesPaneDock` |
| Comments Pane |  | `view.commentsPane` |
| Accessibility Pane |  | `view.accessibilityPane` |
| Alt Text Pane |  | `view.altTextPane` |
| Format Shape Pane |  | `view.formatShapePane` |
| New Window |  | `view.newWindow` |
| Switch Windows |  | `view.switchWindows` |
| Split | Mod+Alt+S | `view.split` |
| Full Screen |  | `view.fullScreen` |
| View State |  | `view.state` |
| Numerals |  | `view.numeral` |
| Arrange All |  | `view.arrangeAll` |

### Insert

| Item | Shortcut | Command id |
| --- | --- | --- |
| Drawing Canvas |  | `insert.canvas` |
| Chart |  | `insert.chart` |
| Cross-reference |  | `insert.crossReference` |
| Equation | Alt+= | `insert.equation` |
| Page Break |  | `insert.pageBreak` |
| Blank Page |  | `insert.blankPage` |
| Cover Page |  | `insert.coverPage` |
| Table |  | `insert.table` |
| Pictures |  | `insert.picture` |
| Icons |  | `insert.icon` |
| Shapes |  | `insert.shape` |
| Text Box |  | `insert.textBox` |
| Link | Mod+K | `insert.link` |
| Remove Hyperlink |  | `insert.removeLink` |
| Bookmark | Mod+Shift+F5 | `insert.bookmark` |
| Delete Bookmark |  | `insert.deleteBookmark` |
| Header |  | `insert.header` |
| Footer |  | `insert.footer` |
| Page Number |  | `insert.pageNumber` |
| Edit Header |  | `insert.editHeader` |
| Edit Footer |  | `insert.editFooter` |
| Header |  | `insert.createHeader` |
| Footer |  | `insert.createFooter` |
| Close Header and Footer |  | `insert.closeHeader` |
| Close Header and Footer |  | `insert.removeEmptyHeaders` |
| Remove Header |  | `insert.removeHeader` |
| Remove Footer |  | `insert.removeFooter` |
| Date & Time |  | `insert.dateTime` |
| Symbol |  | `insert.symbol` |
| Field | Mod+F9 | `insert.field` |
| Insert Date Field |  | `insert.dateField` |
| Insert Time Field |  | `insert.timeField` |
| Insert Page Field |  | `insert.pageField` |
| Drop Cap |  | `insert.dropCap` |
| Horizontal Line |  | `insert.horizontalLine` |
| Text from File |  | `insert.textFromFile` |
| SmartArt |  | `insert.smartArt` |
| Quick Parts |  | `insert.quickParts` |
| AutoText |  | `insert.autoText` |
| Document Property |  | `insert.docProperty` |
| Signature Line |  | `insert.signatureLine` |
| Object |  | `insert.object` |
| Spreadsheet Table |  | `insert.spreadsheet` |
| WordArt |  | `insert.wordArt` |

### Select

| Item | Shortcut | Command id |
| --- | --- | --- |
| Select All | Mod+A | `select.all` |
| Select Range |  | `select.range` |
| Select Word |  | `select.word` |
| Select Sentence |  | `select.sentence` |
| Select Paragraph |  | `select.paragraph` |
| Extend Selection by Units |  | `select.dragUnit` |
| Select Line |  | `select.line` |
| Select Text |  | `select.text` |
| Collapse Selection | Escape | `select.collapse` |
| Column Selection | Mod+Shift+F8 | `select.column` |
| Add Object to Selection |  | `select.addObject` |
| Select Objects |  | `select.objects` |
| Select Text with Similar Formatting |  | `select.similar` |
| Extend Selection | F8 | `select.extend` |

### Text

| Item | Shortcut | Command id |
| --- | --- | --- |
| Overtype |  | `text.overtype` |
| Type Text |  | `text.insert` |
| New Paragraph | Enter | `text.newParagraph` |
| Line Break | Shift+Enter | `text.lineBreak` |
| Page Break | Mod+Enter | `text.pageBreak` |
| Column Break | Mod+Shift+Enter | `text.columnBreak` |
| Tab | Tab | `text.tab` |
| Shift+Tab | Shift+Tab | `text.backTab` |
| Tab Character |  | `text.insertTab` |
| … | | |


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
