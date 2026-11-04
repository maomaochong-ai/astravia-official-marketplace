# 上游命令与菜单（从 figcraft 自己的源码导出）

这个文件不是转述，是从上游 figcraft 仓库的 Rust 源码里读出来的条目：菜单路径、显示名、默认快捷键、
命令 id。判断"这个应用到底有哪些功能、叫什么名字"以这里和编辑器里实际看得到的界面为准，不要凭记忆编。

| 事实 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/storytold/figcraft |
| 钉住的发布版本 | v0.15.0 |
| 站点来源 | `figcraft-web-0.15.0.zip`（sha256 `b936b42ca6e49115…`） |
| 许可 | Apache-2.0 或 MIT（仓库内 LICENSE-APACHE / LICENSE-MIT） |
| 提取自 | `crates/ui-egui/src/menus*.rs`、`crates/engine/src/cmd/**` 等命令表 |
| 上游自述 | Interface design and prototyping; open source and collaborative. Frames, auto layout, components and variants, vector networks, styles, variables and prototypes. |

## 菜单与命令

显示名与快捷键是上游的原文。命令 id 在两点上有用：它说明这条命令存在且是这一层级的正式入口；
面板里没有命令总线，所以**不要**指望把 id 当参数发过去——它是"要找的东西叫什么"的索引。

### Document

| Item | Shortcut | Command id |
| --- | --- | --- |
| inspect_document |  | `document.inspect` |

### Nodes

| Item | Shortcut | Command id |
| --- | --- | --- |
| get_node |  | `node.get` |

### Panels

| Item | Shortcut | Command id |
| --- | --- | --- |
| view.designPrototype |  | `panel.designPrototype` |
| view.devMode |  | `panel.devMode` |
| view.leftSidebar |  | `panel.leftSidebar` |

## 同一源码里出现的其它命令 id

这些是在 `crates/ui-egui/src` 里被点名过的命令，按出现次数排序。菜单表没有收入它们（分布在上下文菜单、
面板命令、快捷键表里），但名字是真的：用它确认某个功能存在，再回到界面上找它的入口。

| 命令 id | 出现次数 |
| --- | --- |
| `select.set` | 196 |
| `shape.rectangle` | 148 |
| `node.set` | 82 |
| `node.create` | 78 |
| `file.new` | 52 |
| `file.open` | 41 |
| `select.none` | 36 |
| `page.select` | 34 |
| `page.add` | 31 |
| `text.create` | 31 |
| `tool.set` | 30 |
| `file.saveAs` | 27 |
| `file.import` | 24 |
| `doc.switch` | 24 |
| `edit.undo` | 23 |
| `fill.set` | 20 |
| `component.create` | 19 |
| `style.create` | 19 |
| `ui.input` | 17 |
| `edit.paste` | 15 |
| `window.new` | 14 |
| `file.close` | 14 |
| `edit.delete` | 14 |
| `effect.add` | 14 |
| `file.export` | 14 |
| `object.rename` | 13 |
| `ui.set` | 11 |
| `file.save` | 11 |
| `file.newBoard` | 11 |
| `view.set` | 11 |
| `file.openRecent` | 11 |
| `shape.ellipse` | 10 |
| `edit.copy` | 10 |
| `export.add` | 10 |
| `export.update` | 10 |
| `instance.create` | 9 |
| `edit.copyLink` | 9 |
| `fill.add` | 9 |
| `file.rename` | 9 |
| `style.apply` | 9 |
| `component.editProperty` | 9 |
| `text.style` | 9 |
| `component.combineVariants` | 8 |
| `component.addProperty` | 8 |
| `image.crop` | 7 |
| `ui.screenshot` | 7 |
| `plugin.import` | 7 |
| `page.rename` | 7 |
| `view.toggleUi` | 6 |
| `ui.inspect` | 6 |
| `view.minimize` | 6 |
| `effect.set` | 6 |
| `node.reparent` | 6 |
| `edit.copyAsCss` | 6 |
| `ui.render` | 6 |
| `object.moveToPage` | 6 |
| `view.themeDark` | 6 |
| `view.themeSystem` | 6 |
| `grid.add` | 6 |
| `view.panelWidths` | 6 |
| `stroke.set` | 5 |
| `component.detach` | 5 |
| `view.rulers` | 5 |
| `style.update` | 5 |
| `object.batchRename` | 5 |
| `edit.pasteDesignLayers` | 5 |
| `view.themeLight` | 5 |
| `object.toggleVisible` | 5 |
| `view.zoomIn` | 5 |
| `edit.redo` | 5 |


> 这个应用把大部分操作放在画布与面板上，源码里没有一张覆盖全部入口的菜单表，上面列到的是源码里真有的那些。
> 没有列到的功能，以编辑器里实际看得到的界面为准；不要因为这份表里没有就断言功能不存在。

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
