# 上游命令与菜单（从 cadcraft 自己的源码导出）

这个文件不是转述，是从上游 cadcraft 仓库的 Rust 源码里读出来的条目：菜单路径、显示名、默认快捷键、
命令 id。判断"这个应用到底有哪些功能、叫什么名字"以这里和编辑器里实际看得到的界面为准，不要凭记忆编。

| 事实 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/storytold/cadcraft |
| 钉住的发布版本 | v0.17.0 |
| 站点来源 | `cadcraft-web-0.17.0.zip`（sha256 `161e9ca625a3d061…`） |
| 许可 | Apache-2.0 或 MIT（仓库内 LICENSE-APACHE / LICENSE-MIT） |
| 提取自 | `crates/ui-egui/src/menus*.rs`、`crates/engine/src/cmd/**` 等命令表 |
| 上游自述 | Computer-aided design and drafting; an open-source 2D and 3D CAD application. Command line, object snaps, layers, dimensions, hatches, blocks and DXF drawings. |

## 菜单与命令

显示名与快捷键是上游的原文。命令 id 在两点上有用：它说明这条命令存在且是这一层级的正式入口；
面板里没有命令总线，所以**不要**指望把 id 当参数发过去——它是"要找的东西叫什么"的索引。

### View

| Item | Shortcut | Command id |
| --- | --- | --- |
| Named Views... |  | `view` |
| Set View |  | `view.set` |
| Get View |  | `view.get` |

### Insert

| Item | Shortcut | Command id |
| --- | --- | --- |
| Block... |  | `insert` |

### Layer

| Item | Shortcut | Command id |
| --- | --- | --- |
| Layers |  | `layer` |
| New Layer |  | `layer.new` |
| Set Layer Properties |  | `layer.set` |
| Make Current |  | `layer.current` |
| Delete Layer |  | `layer.delete` |

### Select

| Item | Shortcut | Command id |
| --- | --- | --- |
| Select |  | `select` |

### Text

| Item | Shortcut | Command id |
| --- | --- | --- |
| Single Line Text |  | `text` |

### Table

| Item | Shortcut | Command id |
| --- | --- | --- |
| Table Breaks |  | `table.break` |
| Set Table Cell Style |  | `table.cellstyle` |
| Insert Table Formula |  | `table.formula` |
| Recalculate Table Formulas |  | `table.recalc` |
| Table... |  | `table` |
| Set Table Cell |  | `table.set` |
| Insert Row |  | `table.insertrow` |
| Delete Row |  | `table.deleterow` |
| Insert Column |  | `table.insertcol` |
| Delete Column |  | `table.deletecol` |
| Merge Cells |  | `table.merge` |
| Unmerge Cells |  | `table.unmerge` |

### Image

| Item | Shortcut | Command id |
| --- | --- | --- |
| Raster Images |  | `image` |

### Color

| Item | Shortcut | Command id |
| --- | --- | --- |
| Color... |  | `color` |

### Document

| Item | Shortcut | Command id |
| --- | --- | --- |
| Switch Drawing |  | `document.switch` |
| Drawing as bytes |  | `document.bytes` |

### Drawing

| Item | Shortcut | Command id |
| --- | --- | --- |
| Inspect Drawing |  | `drawing.inspect` |

### Export

| Item | Shortcut | Command id |
| --- | --- | --- |
| Export... |  | `export` |

### Import

| Item | Shortcut | Command id |
| --- | --- | --- |
| Import... |  | `import` |

### Interface

| Item | Shortcut | Command id |
| --- | --- | --- |
| Cmd+8 |  | `ui.toggle.quickcalc` |
| Cmd+Q |  | `ui.quit` |
| Use System Setting |  | `ui.animations.system` |
| On |  | `ui.animations.on` |
| Off |  | `ui.animations.off` |

### Other commands

| Item | Shortcut | Command id |
| --- | --- | --- |
| Scale List... |  | `scalelistedit` |
| Add/Delete Scales... |  | `objectscale` |
| Add Current Scale |  | `aiobjectscaleadd` |
| Delete Current Scale |  | `aiobjectscaleremove` |
| Synchronize Multiple-scale Positions |  | `annoreset` |
| Annotative Update |  | `annoupdate` |
| Current Scale Only |  | `annovisible.current` |
| All Scales |  | `annovisible.all` |
| Annotation Visibility |  | `annovisible.toggle` |
| Linear |  | `dimlinear` |
| Aligned |  | `dimaligned` |
| Radius |  | `dimradius` |
| Diameter |  | `dimdiameter` |
| Angular |  | `dimangular` |
| Arc Length |  | `dimarc` |
| Ordinate |  | `dimordinate` |
| Continue |  | `dimcontinue` |
| Baseline |  | `dimbaseline` |
| Quick Dimension |  | `qdim` |
| Dimension |  | `dim` |
| Multileader |  | `mleader` |
| Leader |  | `leader` |
| Update |  | `dimstyle.update` |
| Override |  | `dimoverride` |
| Reassociate Dimensions |  | `dimreassociate` |
| Disassociate Dimensions |  | `dimdisassociate` |
| Home |  | `dimtedit.home` |
| Angle |  | `dimtedit.angle` |
| Left |  | `dimtedit.left` |
| Center |  | `dimtedit.center` |
| Right |  | `dimtedit.right` |
| Dimension Text Edit |  | `dimtedit` |
| Dimension Space |  | `dimspace` |
| Dimension Edit |  | `dimedit` |
| Oblique |  | `dimedit.oblique` |
| Jogged |  | `dimjogged` |
| Jogged Linear |  | `dimjogline` |
| Dimension Break |  | `dimbreak` |
| Inspection |  | `diminspect` |
| Edit Array |  | `arrayedit` |
| Close Array Editing |  | `arrayclose` |
| Array |  | `array` |
| Rectangular Array |  | `arrayrect` |
| Polar Array |  | `arraypolar` |
| Array |  | `-array` |
| Audit |  | `audit` |
| Recover... |  | `recover` |
| Drawing Recovery Manager... |  | `drawingrecovery` |
| Single... |  | `attedit` |
| Global |  | `-attedit` |
| Attribute Display |  | `attdisp` |
| Normal |  | `attdisp.normal` |
| On |  | `attdisp.on` |
| Off |  | `attdisp.off` |
| Synchronize Attributes |  | `attsync` |
| Block Attribute Manager... |  | `battman` |
| Block Editor |  | `bedit` |
| Save Block |  | `bsave` |
| Save Block As |  | `bsaveas` |
| Close Block Editor |  | `bclose` |
| Replace Block... |  | `blockreplace` |
| Explode Attributes to Text |  | `burst` |
| Block Description... |  | `blocks.description` |
| Data Extraction... |  | `dataextraction` |
| Data Extraction... |  | `eattext` |
| Edit Reference In-Place |  | `refedit` |
| Working Set |  | `refset` |
| Save Reference Edits |  | `refclose` |
| Write Block |  | `wblock` |
| Write Block |  | `-wblock` |
| DWG Reference... |  | `xattach` |
| Reference Manager |  | `xref` |
| External References |  | `-xref` |
| Bind... |  | `xbind` |
| Open Xref |  | `xopen` |
| Make... |  | `block` |
| Create Block |  | `-block` |
| Multiple Insert |  | `minsert` |
| Define Attributes... |  | `attdef` |
| Base |  | `base` |
| Dynamic Block Data |  | `blocks.dynamic` |
| Dynamic Block Reference |  | `blocks.reference` |
| Set Dynamic Property |  | `blocks.reference.set` |
| Dynamic Block Grips |  | `blocks.reference.grips` |
| Drag Dynamic Grip |  | `blocks.reference.grip` |
| Purge |  | `purge` |
| List Blocks |  | `blocks.list` |
| Geometric Constraint |  | `geomconstraint` |
| AutoConstrain |  | `autoconstrain` |
| Constraint Bars |  | `constraintbar` |
| Show All Constraint Bars |  | `constraintbar.showall` |
| Hide All Constraint Bars |  | `constraintbar.hideall` |
| Dimensional Constraint |  | `dimconstraint` |
| Linear |  | `dclinear` |
| Dynamic Dimensions |  | `dcdisplay` |
| Show All Dynamic Dimensions |  | `dcdisplay.showall` |
| Hide All Dynamic Dimensions |  | `dcdisplay.hideall` |
| Delete Constraints |  | `delconstraint` |
| Parameters Manager |  | `parameters` |
| Constraint Settings |  | `constraintsettings` |
| Infer Constraints |  | `constraintinfer` |
| Inspect Constraints |  | `constraints.inspect` |
| Degrees of Freedom |  | `constraints.dof` |
| Line |  | `line` |
| Polyline |  | `pline` |
| Circle |  | `circle` |
| Arc |  | `arc` |
| Rectangle |  | `rectang` |
| Polygon |  | `polygon` |
| Ellipse |  | `ellipse` |
| Point |  | `point` |
| Multiple Point |  | `point.multiple` |
| Construction Line |  | `xline` |
| Ray |  | `ray` |
| Spline |  | `spline` |
| Donut |  | `donut` |
| 2D Solid |  | `solid` |
| Multiline Text |  | `mtext` |
| Break-line Symbol |  | `breakline` |
| Multiline |  | `mline` |
| Multiline Style... |  | `mlstyle` |
| Multiline... |  | `mledit` |
| Start, Center, End |  | `arc.sce` |
| Start, Center, Angle |  | `arc.sca` |
| Start, Center, Length |  | `arc.scl` |
| Start, End, Angle |  | `arc.sea` |
| Start, End, Direction |  | `arc.sed` |
| Start, End, Radius |  | `arc.ser` |
| Center, Start, End |  | `arc.cse` |
| Center, Start, Angle |  | `arc.csa` |
| Center, Start, Length |  | `arc.csl` |
| Continue |  | `arc.continue` |
| Center, Diameter |  | `circle.cd` |
| 2 Points |  | `circle.2p` |
| 3 Points |  | `circle.3p` |
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
