# 命令表（cadcraft）

这张表由同目录的 `upstream.md` 生成——每一条都是上游版本里真实存在的功能，没有一条是凭记忆写的。
两列直接就是参数：`快捷键` 填进 `cadcraft_menu` 的 `shortcut`，`path` 填进 `path`（照抄，含省略号）。

先查这张表，再决定要不要碰坐标。表里没有的功能，说明这一版上游没有。

## View

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Named Views... | — | `["View","Named Views..."]` | `view` |
| Set View | — | `["View","Set View"]` | `view.set` |
| Get View | — | `["View","Get View"]` | `view.get` |

## Insert

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Block... | — | `["Insert","Block..."]` | `insert` |

## Layer

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Layers | — | `["Layer","Layers"]` | `layer` |
| New Layer | — | `["Layer","New Layer"]` | `layer.new` |
| Set Layer Properties | — | `["Layer","Set Layer Properties"]` | `layer.set` |
| Make Current | — | `["Layer","Make Current"]` | `layer.current` |
| Delete Layer | — | `["Layer","Delete Layer"]` | `layer.delete` |

## Select

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Select | — | `["Select","Select"]` | `select` |

## Text

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Single Line Text | — | `["Text","Single Line Text"]` | `text` |

## Table

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Table Breaks | — | `["Table","Table Breaks"]` | `table.break` |
| Set Table Cell Style | — | `["Table","Set Table Cell Style"]` | `table.cellstyle` |
| Insert Table Formula | — | `["Table","Insert Table Formula"]` | `table.formula` |
| Recalculate Table Formulas | — | `["Table","Recalculate Table Formulas"]` | `table.recalc` |
| Table... | — | `["Table","Table..."]` | `table` |
| Set Table Cell | — | `["Table","Set Table Cell"]` | `table.set` |
| Insert Row | — | `["Table","Insert Row"]` | `table.insertrow` |
| Delete Row | — | `["Table","Delete Row"]` | `table.deleterow` |
| Insert Column | — | `["Table","Insert Column"]` | `table.insertcol` |
| Delete Column | — | `["Table","Delete Column"]` | `table.deletecol` |
| Merge Cells | — | `["Table","Merge Cells"]` | `table.merge` |
| Unmerge Cells | — | `["Table","Unmerge Cells"]` | `table.unmerge` |

## Image

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Raster Images | — | `["Image","Raster Images"]` | `image` |

## Color

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Color... | — | `["Color","Color..."]` | `color` |

## Document

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Switch Drawing | — | `["Document","Switch Drawing"]` | `document.switch` |
| Drawing as bytes | — | `["Document","Drawing as bytes"]` | `document.bytes` |

## Drawing

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Inspect Drawing | — | `["Drawing","Inspect Drawing"]` | `drawing.inspect` |

## Export

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Export... | — | `["Export","Export..."]` | `export` |

## Import

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Import... | — | `["Import","Import..."]` | `import` |

## Interface

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Cmd+8 | — | `["Interface","Cmd+8"]` | `ui.toggle.quickcalc` |
| Cmd+Q | — | `["Interface","Cmd+Q"]` | `ui.quit` |
| Use System Setting | — | `["Interface","Use System Setting"]` | `ui.animations.system` |
| On | — | `["Interface","On"]` | `ui.animations.on` |
| Off | — | `["Interface","Off"]` | `ui.animations.off` |

## Other commands

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Scale List... | — | `["Other commands","Scale List..."]` | `scalelistedit` |
| Add/Delete Scales... | — | `["Other commands","Add/Delete Scales..."]` | `objectscale` |
| Add Current Scale | — | `["Other commands","Add Current Scale"]` | `aiobjectscaleadd` |
| Delete Current Scale | — | `["Other commands","Delete Current Scale"]` | `aiobjectscaleremove` |
| Synchronize Multiple-scale Positions | — | `["Other commands","Synchronize Multiple-scale Positions"]` | `annoreset` |
| Annotative Update | — | `["Other commands","Annotative Update"]` | `annoupdate` |
| Current Scale Only | — | `["Other commands","Current Scale Only"]` | `annovisible.current` |
| All Scales | — | `["Other commands","All Scales"]` | `annovisible.all` |
| Annotation Visibility | — | `["Other commands","Annotation Visibility"]` | `annovisible.toggle` |
| Linear | — | `["Other commands","Linear"]` | `dimlinear` |
| Aligned | — | `["Other commands","Aligned"]` | `dimaligned` |
| Radius | — | `["Other commands","Radius"]` | `dimradius` |
| Diameter | — | `["Other commands","Diameter"]` | `dimdiameter` |
| Angular | — | `["Other commands","Angular"]` | `dimangular` |
| Arc Length | — | `["Other commands","Arc Length"]` | `dimarc` |
| Ordinate | — | `["Other commands","Ordinate"]` | `dimordinate` |
| Continue | — | `["Other commands","Continue"]` | `dimcontinue` |
| Baseline | — | `["Other commands","Baseline"]` | `dimbaseline` |
| Quick Dimension | — | `["Other commands","Quick Dimension"]` | `qdim` |
| Dimension | — | `["Other commands","Dimension"]` | `dim` |
| Multileader | — | `["Other commands","Multileader"]` | `mleader` |
| Leader | — | `["Other commands","Leader"]` | `leader` |
| Update | — | `["Other commands","Update"]` | `dimstyle.update` |
| Override | — | `["Other commands","Override"]` | `dimoverride` |
| Reassociate Dimensions | — | `["Other commands","Reassociate Dimensions"]` | `dimreassociate` |
| Disassociate Dimensions | — | `["Other commands","Disassociate Dimensions"]` | `dimdisassociate` |
| Home | — | `["Other commands","Home"]` | `dimtedit.home` |
| Angle | — | `["Other commands","Angle"]` | `dimtedit.angle` |
| Left | — | `["Other commands","Left"]` | `dimtedit.left` |
| Center | — | `["Other commands","Center"]` | `dimtedit.center` |
| Right | — | `["Other commands","Right"]` | `dimtedit.right` |
| Dimension Text Edit | — | `["Other commands","Dimension Text Edit"]` | `dimtedit` |
| Dimension Space | — | `["Other commands","Dimension Space"]` | `dimspace` |
| Dimension Edit | — | `["Other commands","Dimension Edit"]` | `dimedit` |
| Oblique | — | `["Other commands","Oblique"]` | `dimedit.oblique` |
| Jogged | — | `["Other commands","Jogged"]` | `dimjogged` |
| Jogged Linear | — | `["Other commands","Jogged Linear"]` | `dimjogline` |
| Dimension Break | — | `["Other commands","Dimension Break"]` | `dimbreak` |
| Inspection | — | `["Other commands","Inspection"]` | `diminspect` |
| Edit Array | — | `["Other commands","Edit Array"]` | `arrayedit` |
| Close Array Editing | — | `["Other commands","Close Array Editing"]` | `arrayclose` |
| Array | — | `["Other commands","Array"]` | `array` |
| Rectangular Array | — | `["Other commands","Rectangular Array"]` | `arrayrect` |
| Polar Array | — | `["Other commands","Polar Array"]` | `arraypolar` |
| Array | — | `["Other commands","Array"]` | `-array` |
| Audit | — | `["Other commands","Audit"]` | `audit` |
| Recover... | — | `["Other commands","Recover..."]` | `recover` |
| Drawing Recovery Manager... | — | `["Other commands","Drawing Recovery Manager..."]` | `drawingrecovery` |
| Single... | — | `["Other commands","Single..."]` | `attedit` |
| Global | — | `["Other commands","Global"]` | `-attedit` |
| Attribute Display | — | `["Other commands","Attribute Display"]` | `attdisp` |
| Normal | — | `["Other commands","Normal"]` | `attdisp.normal` |
| On | — | `["Other commands","On"]` | `attdisp.on` |
| Off | — | `["Other commands","Off"]` | `attdisp.off` |
| Synchronize Attributes | — | `["Other commands","Synchronize Attributes"]` | `attsync` |
| Block Attribute Manager... | — | `["Other commands","Block Attribute Manager..."]` | `battman` |
| Block Editor | — | `["Other commands","Block Editor"]` | `bedit` |
| Save Block | — | `["Other commands","Save Block"]` | `bsave` |
| Save Block As | — | `["Other commands","Save Block As"]` | `bsaveas` |
| Close Block Editor | — | `["Other commands","Close Block Editor"]` | `bclose` |
| Replace Block... | — | `["Other commands","Replace Block..."]` | `blockreplace` |
| Explode Attributes to Text | — | `["Other commands","Explode Attributes to Text"]` | `burst` |
| Block Description... | — | `["Other commands","Block Description..."]` | `blocks.description` |
| Data Extraction... | — | `["Other commands","Data Extraction..."]` | `dataextraction` |
| Data Extraction... | — | `["Other commands","Data Extraction..."]` | `eattext` |
| Edit Reference In-Place | — | `["Other commands","Edit Reference In-Place"]` | `refedit` |
| Working Set | — | `["Other commands","Working Set"]` | `refset` |
| Save Reference Edits | — | `["Other commands","Save Reference Edits"]` | `refclose` |
| Write Block | — | `["Other commands","Write Block"]` | `wblock` |
| Write Block | — | `["Other commands","Write Block"]` | `-wblock` |
| DWG Reference... | — | `["Other commands","DWG Reference..."]` | `xattach` |
| Reference Manager | — | `["Other commands","Reference Manager"]` | `xref` |
| External References | — | `["Other commands","External References"]` | `-xref` |
| Bind... | — | `["Other commands","Bind..."]` | `xbind` |
| Open Xref | — | `["Other commands","Open Xref"]` | `xopen` |
| Make... | — | `["Other commands","Make..."]` | `block` |
| Create Block | — | `["Other commands","Create Block"]` | `-block` |
| Multiple Insert | — | `["Other commands","Multiple Insert"]` | `minsert` |
| Define Attributes... | — | `["Other commands","Define Attributes..."]` | `attdef` |
| Base | — | `["Other commands","Base"]` | `base` |
| Dynamic Block Data | — | `["Other commands","Dynamic Block Data"]` | `blocks.dynamic` |
| Dynamic Block Reference | — | `["Other commands","Dynamic Block Reference"]` | `blocks.reference` |
| Set Dynamic Property | — | `["Other commands","Set Dynamic Property"]` | `blocks.reference.set` |
| Dynamic Block Grips | — | `["Other commands","Dynamic Block Grips"]` | `blocks.reference.grips` |
| Drag Dynamic Grip | — | `["Other commands","Drag Dynamic Grip"]` | `blocks.reference.grip` |
| Purge | — | `["Other commands","Purge"]` | `purge` |
| List Blocks | — | `["Other commands","List Blocks"]` | `blocks.list` |
| Geometric Constraint | — | `["Other commands","Geometric Constraint"]` | `geomconstraint` |
| AutoConstrain | — | — | `autoconstrain` |
| Constraint Bars | — | `["Other commands","Constraint Bars"]` | `constraintbar` |
| Show All Constraint Bars | — | `["Other commands","Show All Constraint Bars"]` | `constraintbar.showall` |
| Hide All Constraint Bars | — | `["Other commands","Hide All Constraint Bars"]` | `constraintbar.hideall` |
| Dimensional Constraint | — | `["Other commands","Dimensional Constraint"]` | `dimconstraint` |
| Linear | — | `["Other commands","Linear"]` | `dclinear` |
| Dynamic Dimensions | — | `["Other commands","Dynamic Dimensions"]` | `dcdisplay` |
| Show All Dynamic Dimensions | — | `["Other commands","Show All Dynamic Dimensions"]` | `dcdisplay.showall` |
| Hide All Dynamic Dimensions | — | `["Other commands","Hide All Dynamic Dimensions"]` | `dcdisplay.hideall` |
| Delete Constraints | — | `["Other commands","Delete Constraints"]` | `delconstraint` |
| Parameters Manager | — | `["Other commands","Parameters Manager"]` | `parameters` |
| Constraint Settings | — | `["Other commands","Constraint Settings"]` | `constraintsettings` |
| Infer Constraints | — | `["Other commands","Infer Constraints"]` | `constraintinfer` |
| Inspect Constraints | — | `["Other commands","Inspect Constraints"]` | `constraints.inspect` |
| Degrees of Freedom | — | `["Other commands","Degrees of Freedom"]` | `constraints.dof` |
| Line | — | `["Other commands","Line"]` | `line` |
| Polyline | — | `["Other commands","Polyline"]` | `pline` |
| Circle | — | `["Other commands","Circle"]` | `circle` |
| Arc | — | `["Other commands","Arc"]` | `arc` |
| Rectangle | — | `["Other commands","Rectangle"]` | `rectang` |
| Polygon | — | `["Other commands","Polygon"]` | `polygon` |
| Ellipse | — | `["Other commands","Ellipse"]` | `ellipse` |
| Point | — | `["Other commands","Point"]` | `point` |
| Multiple Point | — | `["Other commands","Multiple Point"]` | `point.multiple` |
| Construction Line | — | `["Other commands","Construction Line"]` | `xline` |
| Ray | — | `["Other commands","Ray"]` | `ray` |
| Spline | — | `["Other commands","Spline"]` | `spline` |
| Donut | — | `["Other commands","Donut"]` | `donut` |
| 2D Solid | — | `["Other commands","2D Solid"]` | `solid` |
| Multiline Text | — | `["Other commands","Multiline Text"]` | `mtext` |
| Break-line Symbol | — | `["Other commands","Break-line Symbol"]` | `breakline` |
| Multiline | — | `["Other commands","Multiline"]` | `mline` |
| Multiline Style... | — | `["Other commands","Multiline Style..."]` | `mlstyle` |
| Multiline... | — | `["Other commands","Multiline..."]` | `mledit` |
| Start, Center, End | — | `["Other commands","Start, Center, End"]` | `arc.sce` |
| Start, Center, Angle | — | `["Other commands","Start, Center, Angle"]` | `arc.sca` |
| Start, Center, Length | — | `["Other commands","Start, Center, Length"]` | `arc.scl` |
| Start, End, Angle | — | `["Other commands","Start, End, Angle"]` | `arc.sea` |
| Start, End, Direction | — | `["Other commands","Start, End, Direction"]` | `arc.sed` |
| Start, End, Radius | — | `["Other commands","Start, End, Radius"]` | `arc.ser` |
| Center, Start, End | — | `["Other commands","Center, Start, End"]` | `arc.cse` |
| Center, Start, Angle | — | `["Other commands","Center, Start, Angle"]` | `arc.csa` |
| Center, Start, Length | — | `["Other commands","Center, Start, Length"]` | `arc.csl` |
| Continue | — | `["Other commands","Continue"]` | `arc.continue` |
| Center, Diameter | — | `["Other commands","Center, Diameter"]` | `circle.cd` |
| 2 Points | — | `["Other commands","2 Points"]` | `circle.2p` |
| 3 Points | — | `["Other commands","3 Points"]` | `circle.3p` |

