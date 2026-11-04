# 上游命令与菜单（从 filmcraft 自己的源码导出）

这个文件不是转述，是从上游 filmcraft 仓库的 Rust 源码里读出来的条目：菜单路径、显示名、默认快捷键、
命令 id。判断"这个应用到底有哪些功能、叫什么名字"以这里和编辑器里实际看得到的界面为准，不要凭记忆编。

| 事实 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/storytold/filmcraft |
| 钉住的发布版本 | v0.16.0 |
| 站点来源 | `filmcraft-web-0.16.0.zip`（sha256 `79da0f879f86f452…`） |
| 许可 | Apache-2.0 或 MIT（仓库内 LICENSE-APACHE / LICENSE-MIT） |
| 提取自 | `crates/ui-egui/src/menus*.rs`、`crates/engine/src/cmd/**` 等命令表 |
| 上游自述 | Video editing, colour and sound; an open-source professional non-linear video editor. Timeline, trim, transitions, scopes and render. |

## 菜单与命令

显示名与快捷键是上游的原文。命令 id 在两点上有用：它说明这条命令存在且是这一层级的正式入口；
面板里没有命令总线，所以**不要**指望把 id 当参数发过去——它是"要找的东西叫什么"的索引。

### File

| Item | Shortcut | Command id |
| --- | --- | --- |
| Sequence… |  | `file.newSequence` |
| Adjustment Layer… |  | `file.newAdjustmentLayer` |
| Bars and Tone… |  | `file.newBarsAndTone` |
| Black Video… |  | `file.newBlackVideo` |
| Color Matte… |  | `file.newColorMatte` |
| Universal Counting Leader… |  | `file.newCountingLeader` |
| Transparent Video… |  | `file.newTransparentVideo` |
| Demo Footage |  | `file.importDemoFootage` |

### File › Export

| Item | Shortcut | Command id |
| --- | --- | --- |
| Export | Cmd+M | `mode.export` |

### Edit

| Item | Shortcut | Command id |
| --- | --- | --- |
| Keyboard Shortcuts… | Cmd+Alt+K | `app.keyboardShortcuts` |
| Cut |  | `edit.cut` |
| Copy |  | `edit.copy` |
| Paste Attributes… |  | `edit.pasteAttributes` |
| Remove Attributes… |  | `edit.removeAttributes` |
| Clear |  | `edit.clear` |
| Ripple Delete |  | `edit.rippleDelete` |
| Edit Original |  | `edit.editOriginal` |
| Label |  | `edit.label` |

### Edit › Language

| Item | Shortcut | Command id |
| --- | --- | --- |
| English |  | `app.language.english` |
| Bahasa Indonesia |  | `app.language.indonesian` |
| Bosanski |  | `app.language.bosnian` |
| Čeština |  | `app.language.czech` |
| Deutsch |  | `app.language.german` |
| Español |  | `app.language.spanish` |
| Français |  | `app.language.french` |
| Italiano |  | `app.language.italian` |
| Polski |  | `app.language.polish` |
| Português (Brasil) |  | `app.language.portuguese` |
| Svenska |  | `app.language.swedish` |
| Türkçe |  | `app.language.turkish` |
| Русский |  | `app.language.russian` |
| Українська |  | `app.language.ukrainian` |
| 日本語 |  | `app.language.japanese` |
| 简体中文 |  | `app.language.chinese` |
| 한국어 |  | `app.language.korean` |

### Edit › Preferences

| Item | Shortcut | Command id |
| --- | --- | --- |
| General… | Cmd+, | `app.settings.general` |
| Appearance… |  | `app.settings.appearance` |
| Audio… |  | `app.settings.audio` |
| Audio Hardware… |  | `app.settings.audioHardware` |
| Auto Save… |  | `app.settings.autoSave` |
| Color… |  | `app.settings.color` |
| Graphics… |  | `app.settings.graphics` |
| Labels… |  | `app.settings.labels` |
| Media… |  | `app.settings.media` |
| Media Analysis & Transcription… |  | `app.settings.mediaAnalysis` |
| Media Cache… |  | `app.settings.mediaCache` |
| Memory… |  | `app.settings.memory` |
| Playback… |  | `app.settings.playback` |
| Plugins… |  | `app.settings.plugins` |
| Timeline… |  | `app.settings.timeline` |
| Trim… |  | `app.settings.trim` |

### View

| Item | Shortcut | Command id |
| --- | --- | --- |
| Zoom In | = | `view.zoomIn` |
| Zoom Out | - | `view.zoomOut` |
| Zoom to Sequence | \\ | `view.zoomToSequence` |
| Reset Interface Zoom |  | `view.resetInterfaceZoom` |
| High Quality Playback |  | `view.highQualityPlayback` |
| Show Rulers |  | `view.showRulers` |
| Show Guides |  | `view.showGuides` |
| Lock Guides |  | `view.lockGuides` |
| Add Guide… |  | `view.addGuide` |
| Clear Guides |  | `view.clearGuides` |
| Snap in Program Monitor |  | `view.snapInProgramMonitor` |
| Dynamic Audio Waveforms |  | `view.dynamicAudioWaveforms` |
| Multi-Camera View | Shift+0 | `multicam.toggleView` |

### View › Appearance

| Item | Shortcut | Command id |
| --- | --- | --- |
| Darkest |  | `view.theme.dark` |
| Dark |  | `view.theme.medium` |
| Light |  | `view.theme.light` |
| Next Appearance Mode |  | `view.appearanceMode.next` |

### View › Display Mode

| Item | Shortcut | Command id |
| --- | --- | --- |
| Composite Video |  | `view.display.composite` |
| Alpha |  | `view.display.alpha` |
| Red |  | `view.display.red` |
| Green |  | `view.display.green` |
| Blue |  | `view.display.blue` |
| Multi-Camera |  | `view.display.multicam` |
| Audio Waveform |  | `view.display.audioWaveform` |
| Comparison View |  | `view.display.comparison` |
| Video and Audio Waveform Split |  | `view.display.videoAndWaveform` |

### View › Guide Templates

| Item | Shortcut | Command id |
| --- | --- | --- |
| Safe Margins |  | `view.safeMargins` |
| Save Guides as Template… |  | `view.guideTemplates.save` |
| Manage Guides… |  | `view.guideTemplates.manage` |

### View › Magnification

| Item | Shortcut | Command id |
| --- | --- | --- |
| Fit |  | `view.magnification.fit` |
| 10% |  | `view.magnification.10` |
| 25% |  | `view.magnification.25` |
| 50% |  | `view.magnification.50` |
| 75% |  | `view.magnification.75` |
| 100% |  | `view.magnification.100` |
| 150% |  | `view.magnification.150` |
| 200% |  | `view.magnification.200` |
| 400% |  | `view.magnification.400` |
| 800% |  | `view.magnification.800` |
| 1600% |  | `view.magnification.1600` |

### View › Paused Resolution

| Item | Shortcut | Command id |
| --- | --- | --- |
| Full |  | `view.pausedRes.full` |
| 1/2 |  | `view.pausedRes.half` |
| 1/4 |  | `view.pausedRes.quarter` |
| 1/8 |  | `view.pausedRes.eighth` |
| 1/16 |  | `view.pausedRes.sixteenth` |

### View › Playback Resolution

| Item | Shortcut | Command id |
| --- | --- | --- |
| Full |  | `view.playbackRes.full` |
| 1/2 |  | `view.playbackRes.half` |
| 1/4 |  | `view.playbackRes.quarter` |
| 1/8 |  | `view.playbackRes.eighth` |
| 1/16 |  | `view.playbackRes.sixteenth` |

### Timeline

| Item | Shortcut | Command id |
| --- | --- | --- |
| roll |  | `timeline.roll` |
| trim |  | `timeline.trim` |
| range-marker-timeline |  | `timeline.marker` |
| timeline |  | `timeline.markerMenu.properties` |

### Window

| Item | Shortcut | Command id |
| --- | --- | --- |
| New Project Panel |  | `projectPanel.newPanel` |

### Window › Workspaces

| Item | Shortcut | Command id |
| --- | --- | --- |
| Editing | Alt+Shift+1 | `window.workspace.editing` |
| Assembly | Alt+Shift+2 | `window.workspace.assembly` |
| Color | Alt+Shift+3 | `window.workspace.color` |
| Effects | Alt+Shift+4 | `window.workspace.effects` |
| Audio | Alt+Shift+5 | `window.workspace.audio` |
| Captions and Graphics | Alt+Shift+6 | `window.workspace.captionsandgraphics` |
| All Panels |  | `window.workspace.allpanels` |
| Vertical |  | `window.workspace.vertical` |
| Reset to Saved Layout | Alt+Shift+0 | `window.workspace.reset` |
| Save Changes to this Workspace |  | `window.workspace.saveChanges` |
| Save as New Workspace… |  | `window.workspace.saveAs` |
| Edit Workspaces… |  | `window.workspace.edit` |
| Learning | Alt+Shift+7 | `window.workspace.learning` |
| Review | Alt+Shift+8 | `window.workspace.review` |

### Help

| Item | Shortcut | Command id |
| --- | --- | --- |
| Join the ArtCraft Discord… |  | `help.discord` |
| ArtCraft Website |  | `help.website` |
| FilmCraft on getartcraft.com |  | `help.appPage` |
| FilmCraft on GitHub |  | `help.github` |
| Report an Issue… |  | `help.reportIssue` |
| Reveal Log Files… |  | `help.revealLogFiles` |
| System Compatibility Report… |  | `help.systemCompatibilityReport` |
| Check for Updates… |  | `app.checkForUpdates` |
| About FilmCraft |  | `app.about` |
| FilmCraft Help… | F1 | `help.filmcraftHelp` |

### Clipping

| Item | Shortcut | Command id |
| --- | --- | --- |
| clip.mov |  | `clip.mov` |
| Replace With Clip From Source Monitor |  | `clip.replaceFromSource` |
| Enable |  | `clip.enable` |
| Link |  | `clip.link` |
| Group |  | `clip.group` |
| Ungroup |  | `clip.ungroup` |
| Synchronize… |  | `clip.synchronize` |
| Merge Clips… |  | `clip.mergeClips` |
| Nest… |  | `clip.nest` |
| Multi-Camera |  | `clip.multicam` |
| Speed/Duration… |  | `clip.speedDuration` |
| Scene Edit Detection… |  | `clip.sceneEditDetection` |
| Frame Hold Options… |  | `clip.frameHoldOptions` |
| Add Frame Hold |  | `clip.frameHold` |
| Insert Frame Hold Segment |  | `clip.insertFrameHoldSegment` |
| Field Options… |  | `clip.fieldOptions` |
| Scale to Frame Size |  | `clip.scaleToFrameSize` |
| Fit to frame |  | `clip.fitToFrame` |
| Fill frame |  | `clip.fillFrame` |
| Reveal in Project |  | `clip.revealInProject` |

### Other commands

| Item | Shortcut | Command id |
| --- | --- | --- |
| LumetriScopes |  | `scopes.wrench` |


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
