# 命令表（wordcraft）

这张表由同目录的 `upstream.md` 生成——每一条都是上游版本里真实存在的功能，没有一条是凭记忆写的。
两列直接就是参数：`快捷键` 填进 `wordcraft_menu` 的 `shortcut`，`path` 填进 `path`（照抄，含省略号）。

先查这张表，再决定要不要碰坐标。表里没有的功能，说明这一版上游没有。

## File

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Rename Document | — | `["File","Rename Document"]` | `file.rename` |
| New | Mod+N | `["File","New"]` | `file.new` |
| Open | Mod+O / Mod+F12 / Mod+Alt+F2 | `["File","Open"]` | `file.open` |
| Save | Mod+S / Shift+F12 / Alt+Shift+F2 | `["File","Save"]` | `file.save` |
| Save As | — | `["File","Save As"]` | `file.saveAs` |
| Encrypt with Password | — | `["File","Encrypt with Password"]` | `file.encrypt` |
| Export PDF | — | `["File","Export PDF"]` | `file.exportPdf` |
| Export Page as PNG | — | `["File","Export Page as PNG"]` | `file.exportPng` |
| Print Markup | — | `["File","Print Markup"]` | `file.printMarkup` |
| Print to PDF | — | `["File","Print to PDF"]` | `file.printPdf` |
| Print | Mod+P / Mod+Shift+F12 / Mod+F2 / Mod+Alt+I | `["File","Print"]` | `file.print` |
| Close | Mod+W / Mod+F4 | `["File","Close"]` | `file.close` |
| Close Document | — | `["File","Close Document"]` | `file.closeDocument` |
| Properties | — | `["File","Properties"]` | `file.properties` |
| Info | — | `["File","Info"]` | `file.info` |
| User Name | — | `["File","User Name"]` | `file.setAuthor` |
| Privacy Options | — | `["File","Privacy Options"]` | `file.privacyOptions` |
| Privacy Settings | — | `["File","Privacy Settings"]` | `file.privacy` |
| Options | — | `["File","Options"]` | `file.options` |
| Check Accessibility | — | `["File","Check Accessibility"]` | `file.accessibility` |
| Inspect Document | — | `["File","Inspect Document"]` | `file.inspect` |
| Protect Document | — | `["File","Protect Document"]` | `file.protect` |
| Version History | — | `["File","Version History"]` | `file.versions` |
| Recover Unsaved Documents | — | `["File","Recover Unsaved Documents"]` | `file.recover` |
| New from Template | — | `["File","New from Template"]` | `file.newFromTemplate` |
| Save as Template | — | `["File","Save as Template"]` | `file.saveTemplate` |
| AutoSave | — | — | `file.autosave` |
| Check Compatibility | — | `["File","Check Compatibility"]` | `file.compatibility` |
| Share | — | `["File","Share"]` | `file.share` |
| Personal Templates | — | `["File","Personal Templates"]` | `file.listTemplates` |

## Edit

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Undo | Mod+Z | `["Edit","Undo"]` | `edit.undo` |
| Undo Actions | — | `["Edit","Undo Actions"]` | `edit.undoTo` |
| Undo History | — | `["Edit","Undo History"]` | `edit.undoHistory` |
| Redo | Mod+Y / Mod+Shift+Z | `["Edit","Redo"]` | `edit.redo` |
| Cut | Mod+X | `["Edit","Cut"]` | `edit.cut` |
| Copy | Mod+C / Mod+Insert | `["Edit","Copy"]` | `edit.copy` |
| Spike | Mod+F3 | `["Edit","Spike"]` | `edit.spike` |
| Insert Spike | Mod+Shift+F3 | `["Edit","Insert Spike"]` | `edit.insertSpike` |
| Paste | Mod+V / Shift+Insert | `["Edit","Paste"]` | `edit.paste` |
| Paste: Keep Text Only | Mod+Shift+Alt+V | `["Edit","Paste: Keep Text Only"]` | `edit.pasteText` |
| Paste: Merge Formatting | — | `["Edit","Paste: Merge Formatting"]` | `edit.pasteMerge` |
| Clipboard Pane | — | `["Edit","Clipboard Pane"]` | `edit.clipboardPane` |
| Clipboard Items | — | `["Edit","Clipboard Items"]` | `edit.clipboardItems` |
| Paste Clipboard Item | — | `["Edit","Paste Clipboard Item"]` | `edit.pasteClipboardItem` |
| Paste All | — | `["Edit","Paste All"]` | `edit.pasteAllClipboard` |
| Delete Clipboard Item | — | `["Edit","Delete Clipboard Item"]` | `edit.deleteClipboardItem` |
| Clear All | — | `["Edit","Clear All"]` | `edit.clearClipboard` |
| Find | Mod+F | `["Edit","Find"]` | `edit.find` |
| Advanced Find | — | `["Edit","Advanced Find"]` | `edit.advancedFind` |
| Find Next | Mod+G / F3 / Shift+F4 / Mod+PageDown | `["Edit","Find Next"]` | `edit.findNext` |
| Find Previous | — | `["Edit","Find Previous"]` | `edit.findPrevious` |
| Replace | — | `["Edit","Replace"]` | `edit.replace` |
| Find and Replace | — | `["Edit","Find and Replace"]` | `edit.findReplace` |
| Replace All | — | `["Edit","Replace All"]` | `edit.replaceAll` |
| Go To | Mod+Alt+G / F5 | `["Edit","Go To"]` | `edit.goto` |
| Go Back | Shift+F5 / Mod+Alt+Z | `["Edit","Go Back"]` | `edit.goBack` |
| Format Painter | — | `["Edit","Format Painter"]` | `edit.formatPainter` |
| Copy Formatting | Mod+Shift+C | `["Edit","Copy Formatting"]` | `edit.copyFormat` |
| Paste Formatting | Mod+Shift+V | `["Edit","Paste Formatting"]` | `edit.pasteFormat` |
| Paste Special | Mod+Alt+V | `["Edit","Paste Special"]` | `edit.pasteSpecial` |
| Repeat | F4 | `["Edit","Repeat"]` | `edit.repeat` |

## View

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Field Codes | Alt+F9 | `["View","Field Codes"]` | `view.fieldCodes` |
| Immersive Reader | — | `["View","Immersive Reader"]` | `view.immersive` |
| Vertical | — | `["View","Vertical"]` | `view.vertical` |
| Side to Side | — | `["View","Side to Side"]` | `view.sideToSide` |
| Show/Hide ¶ | Mod+Shift+8 / Mod+8 | `["View","Show/Hide ¶"]` | `view.marks` |
| Print Layout | Mod+Alt+P | `["View","Print Layout"]` | `view.printLayout` |
| Web Layout | — | `["View","Web Layout"]` | `view.webLayout` |
| Draft | Mod+Alt+N | `["View","Draft"]` | `view.draft` |
| Outline | Mod+Alt+O | `["View","Outline"]` | `view.outline` |
| Read Mode | — | `["View","Read Mode"]` | `view.readMode` |
| Reading Column Width | — | `["View","Reading Column Width"]` | `view.readColumnWidth` |
| Reading Text Size | — | `["View","Reading Text Size"]` | `view.readTextSize` |
| Reading Line Spacing | — | `["View","Reading Line Spacing"]` | `view.readLineSpacing` |
| Reading Page Color | — | `["View","Reading Page Color"]` | `view.readPageColor` |
| Hide White Space | — | `["View","Hide White Space"]` | `view.hideWhiteSpace` |
| Focus | — | `["View","Focus"]` | `view.focus` |
| Full Screen View | — | `["View","Full Screen View"]` | `view.fullScreenView` |
| Ruler | — | `["View","Ruler"]` | `view.ruler` |
| Gridlines | — | `["View","Gridlines"]` | `view.gridlines` |
| Navigation Pane | — | `["View","Navigation Pane"]` | `view.navigationPane` |
| Zoom | — | `["View","Zoom"]` | `view.zoom` |
| 100% | — | `["View","100%"]` | `view.zoom100` |
| Zoom In | — | `["View","Zoom In"]` | `view.zoomIn` |
| Zoom Out | — | `["View","Zoom Out"]` | `view.zoomOut` |
| One Page | — | `["View","One Page"]` | `view.onePage` |
| Multiple Pages | — | `["View","Multiple Pages"]` | `view.multiplePages` |
| Page Width | — | `["View","Page Width"]` | `view.pageWidth` |
| Switch Modes | — | `["View","Switch Modes"]` | `view.darkMode` |
| Interface Theme | — | `["View","Interface Theme"]` | `view.interfaceTheme` |
| Styles Pane | — | `["View","Styles Pane"]` | `view.stylesPane` |
| Styles Pane Position | — | `["View","Styles Pane Position"]` | `view.stylesPaneDock` |
| Comments Pane | — | `["View","Comments Pane"]` | `view.commentsPane` |
| Accessibility Pane | — | `["View","Accessibility Pane"]` | `view.accessibilityPane` |
| Alt Text Pane | — | `["View","Alt Text Pane"]` | `view.altTextPane` |
| Format Shape Pane | — | `["View","Format Shape Pane"]` | `view.formatShapePane` |
| New Window | — | `["View","New Window"]` | `view.newWindow` |
| Switch Windows | — | `["View","Switch Windows"]` | `view.switchWindows` |
| Split | Mod+Alt+S | `["View","Split"]` | `view.split` |
| Full Screen | — | `["View","Full Screen"]` | `view.fullScreen` |
| View State | — | `["View","View State"]` | `view.state` |
| Numerals | — | `["View","Numerals"]` | `view.numeral` |
| Arrange All | — | `["View","Arrange All"]` | `view.arrangeAll` |

## Insert

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Drawing Canvas | — | `["Insert","Drawing Canvas"]` | `insert.canvas` |
| Chart | — | `["Insert","Chart"]` | `insert.chart` |
| Cross-reference | — | `["Insert","Cross-reference"]` | `insert.crossReference` |
| Equation | Alt+= | `["Insert","Equation"]` | `insert.equation` |
| Page Break | — | `["Insert","Page Break"]` | `insert.pageBreak` |
| Blank Page | — | `["Insert","Blank Page"]` | `insert.blankPage` |
| Cover Page | — | `["Insert","Cover Page"]` | `insert.coverPage` |
| Table | — | `["Insert","Table"]` | `insert.table` |
| Pictures | — | `["Insert","Pictures"]` | `insert.picture` |
| Icons | — | `["Insert","Icons"]` | `insert.icon` |
| Shapes | — | `["Insert","Shapes"]` | `insert.shape` |
| Text Box | — | `["Insert","Text Box"]` | `insert.textBox` |
| Link | Mod+K | `["Insert","Link"]` | `insert.link` |
| Remove Hyperlink | — | `["Insert","Remove Hyperlink"]` | `insert.removeLink` |
| Bookmark | Mod+Shift+F5 | `["Insert","Bookmark"]` | `insert.bookmark` |
| Delete Bookmark | — | `["Insert","Delete Bookmark"]` | `insert.deleteBookmark` |
| Header | — | `["Insert","Header"]` | `insert.header` |
| Footer | — | `["Insert","Footer"]` | `insert.footer` |
| Page Number | — | `["Insert","Page Number"]` | `insert.pageNumber` |
| Edit Header | — | `["Insert","Edit Header"]` | `insert.editHeader` |
| Edit Footer | — | `["Insert","Edit Footer"]` | `insert.editFooter` |
| Header | — | `["Insert","Header"]` | `insert.createHeader` |
| Footer | — | `["Insert","Footer"]` | `insert.createFooter` |
| Close Header and Footer | — | `["Insert","Close Header and Footer"]` | `insert.closeHeader` |
| Close Header and Footer | — | `["Insert","Close Header and Footer"]` | `insert.removeEmptyHeaders` |
| Remove Header | — | `["Insert","Remove Header"]` | `insert.removeHeader` |
| Remove Footer | — | `["Insert","Remove Footer"]` | `insert.removeFooter` |
| Date & Time | — | `["Insert","Date & Time"]` | `insert.dateTime` |
| Symbol | — | `["Insert","Symbol"]` | `insert.symbol` |
| Field | Mod+F9 | `["Insert","Field"]` | `insert.field` |
| Insert Date Field | — | `["Insert","Insert Date Field"]` | `insert.dateField` |
| Insert Time Field | — | `["Insert","Insert Time Field"]` | `insert.timeField` |
| Insert Page Field | — | `["Insert","Insert Page Field"]` | `insert.pageField` |
| Drop Cap | — | `["Insert","Drop Cap"]` | `insert.dropCap` |
| Horizontal Line | — | `["Insert","Horizontal Line"]` | `insert.horizontalLine` |
| Text from File | — | `["Insert","Text from File"]` | `insert.textFromFile` |
| SmartArt | — | — | `insert.smartArt` |
| Quick Parts | — | `["Insert","Quick Parts"]` | `insert.quickParts` |
| AutoText | — | — | `insert.autoText` |
| Document Property | — | `["Insert","Document Property"]` | `insert.docProperty` |
| Signature Line | — | `["Insert","Signature Line"]` | `insert.signatureLine` |
| Object | — | `["Insert","Object"]` | `insert.object` |
| Spreadsheet Table | — | `["Insert","Spreadsheet Table"]` | `insert.spreadsheet` |
| WordArt | — | — | `insert.wordArt` |

## Select

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Select All | Mod+A | `["Select","Select All"]` | `select.all` |
| Select Range | — | `["Select","Select Range"]` | `select.range` |
| Select Word | — | `["Select","Select Word"]` | `select.word` |
| Select Sentence | — | `["Select","Select Sentence"]` | `select.sentence` |
| Select Paragraph | — | `["Select","Select Paragraph"]` | `select.paragraph` |
| Extend Selection by Units | — | `["Select","Extend Selection by Units"]` | `select.dragUnit` |
| Select Line | — | `["Select","Select Line"]` | `select.line` |
| Select Text | — | `["Select","Select Text"]` | `select.text` |
| Collapse Selection | Escape | `["Select","Collapse Selection"]` | `select.collapse` |
| Column Selection | Mod+Shift+F8 | `["Select","Column Selection"]` | `select.column` |
| Add Object to Selection | — | `["Select","Add Object to Selection"]` | `select.addObject` |
| Select Objects | — | `["Select","Select Objects"]` | `select.objects` |
| Select Text with Similar Formatting | — | `["Select","Select Text with Similar Formatting"]` | `select.similar` |
| Extend Selection | F8 | `["Select","Extend Selection"]` | `select.extend` |

## Text

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Overtype | — | `["Text","Overtype"]` | `text.overtype` |
| Type Text | — | `["Text","Type Text"]` | `text.insert` |
| New Paragraph | Enter | `["Text","New Paragraph"]` | `text.newParagraph` |
| Line Break | Shift+Enter | `["Text","Line Break"]` | `text.lineBreak` |
| Page Break | Mod+Enter | `["Text","Page Break"]` | `text.pageBreak` |
| Column Break | Mod+Shift+Enter | `["Text","Column Break"]` | `text.columnBreak` |
| Tab | Tab | `["Text","Tab"]` | `text.tab` |
| Shift+Tab | Shift+Tab | `["Text","Shift+Tab"]` | `text.backTab` |
| Tab Character | — | `["Text","Tab Character"]` | `text.insertTab` |

