# 命令表（filmcraft）

这张表由同目录的 `upstream.md` 生成——每一条都是上游版本里真实存在的功能，没有一条是凭记忆写的。
两列直接就是参数：`快捷键` 填进 `filmcraft_menu` 的 `shortcut`，`path` 填进 `path`（照抄，含省略号）。

先查这张表，再决定要不要碰坐标。表里没有的功能，说明这一版上游没有。

## File

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Sequence… | — | `["File","Sequence…"]` | `file.newSequence` |
| Adjustment Layer… | — | `["File","Adjustment Layer…"]` | `file.newAdjustmentLayer` |
| Bars and Tone… | — | `["File","Bars and Tone…"]` | `file.newBarsAndTone` |
| Black Video… | — | `["File","Black Video…"]` | `file.newBlackVideo` |
| Color Matte… | — | `["File","Color Matte…"]` | `file.newColorMatte` |
| Universal Counting Leader… | — | `["File","Universal Counting Leader…"]` | `file.newCountingLeader` |
| Transparent Video… | — | `["File","Transparent Video…"]` | `file.newTransparentVideo` |
| Demo Footage | — | `["File","Demo Footage"]` | `file.importDemoFootage` |

## File › Export

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Export | Cmd+M | `["File","Export","Export"]` | `mode.export` |

## Edit

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Keyboard Shortcuts… | Cmd+Alt+K | `["Edit","Keyboard Shortcuts…"]` | `app.keyboardShortcuts` |
| Cut | — | `["Edit","Cut"]` | `edit.cut` |
| Copy | — | `["Edit","Copy"]` | `edit.copy` |
| Paste Attributes… | — | `["Edit","Paste Attributes…"]` | `edit.pasteAttributes` |
| Remove Attributes… | — | `["Edit","Remove Attributes…"]` | `edit.removeAttributes` |
| Clear | — | `["Edit","Clear"]` | `edit.clear` |
| Ripple Delete | — | `["Edit","Ripple Delete"]` | `edit.rippleDelete` |
| Edit Original | — | `["Edit","Edit Original"]` | `edit.editOriginal` |
| Label | — | `["Edit","Label"]` | `edit.label` |

## Edit › Language

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| English | — | `["Edit","Language","English"]` | `app.language.english` |
| Bahasa Indonesia | — | `["Edit","Language","Bahasa Indonesia"]` | `app.language.indonesian` |
| Bosanski | — | `["Edit","Language","Bosanski"]` | `app.language.bosnian` |
| Čeština | — | `["Edit","Language","Čeština"]` | `app.language.czech` |
| Deutsch | — | `["Edit","Language","Deutsch"]` | `app.language.german` |
| Español | — | `["Edit","Language","Español"]` | `app.language.spanish` |
| Français | — | `["Edit","Language","Français"]` | `app.language.french` |
| Italiano | — | `["Edit","Language","Italiano"]` | `app.language.italian` |
| Polski | — | `["Edit","Language","Polski"]` | `app.language.polish` |
| Português (Brasil) | — | `["Edit","Language","Português (Brasil)"]` | `app.language.portuguese` |
| Svenska | — | `["Edit","Language","Svenska"]` | `app.language.swedish` |
| Türkçe | — | `["Edit","Language","Türkçe"]` | `app.language.turkish` |
| Русский | — | `["Edit","Language","Русский"]` | `app.language.russian` |
| Українська | — | `["Edit","Language","Українська"]` | `app.language.ukrainian` |
| 日本語 | — | `["Edit","Language","日本語"]` | `app.language.japanese` |
| 简体中文 | — | `["Edit","Language","简体中文"]` | `app.language.chinese` |
| 한국어 | — | `["Edit","Language","한국어"]` | `app.language.korean` |

## Edit › Preferences

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| General… | Cmd+, | `["Edit","Preferences","General…"]` | `app.settings.general` |
| Appearance… | — | `["Edit","Preferences","Appearance…"]` | `app.settings.appearance` |
| Audio… | — | `["Edit","Preferences","Audio…"]` | `app.settings.audio` |
| Audio Hardware… | — | `["Edit","Preferences","Audio Hardware…"]` | `app.settings.audioHardware` |
| Auto Save… | — | `["Edit","Preferences","Auto Save…"]` | `app.settings.autoSave` |
| Color… | — | `["Edit","Preferences","Color…"]` | `app.settings.color` |
| Graphics… | — | `["Edit","Preferences","Graphics…"]` | `app.settings.graphics` |
| Labels… | — | `["Edit","Preferences","Labels…"]` | `app.settings.labels` |
| Media… | — | `["Edit","Preferences","Media…"]` | `app.settings.media` |
| Media Analysis & Transcription… | — | `["Edit","Preferences","Media Analysis & Transcription…"]` | `app.settings.mediaAnalysis` |
| Media Cache… | — | `["Edit","Preferences","Media Cache…"]` | `app.settings.mediaCache` |
| Memory… | — | `["Edit","Preferences","Memory…"]` | `app.settings.memory` |
| Playback… | — | `["Edit","Preferences","Playback…"]` | `app.settings.playback` |
| Plugins… | — | `["Edit","Preferences","Plugins…"]` | `app.settings.plugins` |
| Timeline… | — | `["Edit","Preferences","Timeline…"]` | `app.settings.timeline` |
| Trim… | — | `["Edit","Preferences","Trim…"]` | `app.settings.trim` |

## View

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Zoom In | = | `["View","Zoom In"]` | `view.zoomIn` |
| Zoom Out | - | `["View","Zoom Out"]` | `view.zoomOut` |
| Zoom to Sequence | \\ | `["View","Zoom to Sequence"]` | `view.zoomToSequence` |
| Reset Interface Zoom | — | `["View","Reset Interface Zoom"]` | `view.resetInterfaceZoom` |
| High Quality Playback | — | `["View","High Quality Playback"]` | `view.highQualityPlayback` |
| Show Rulers | — | `["View","Show Rulers"]` | `view.showRulers` |
| Show Guides | — | `["View","Show Guides"]` | `view.showGuides` |
| Lock Guides | — | `["View","Lock Guides"]` | `view.lockGuides` |
| Add Guide… | — | `["View","Add Guide…"]` | `view.addGuide` |
| Clear Guides | — | `["View","Clear Guides"]` | `view.clearGuides` |
| Snap in Program Monitor | — | `["View","Snap in Program Monitor"]` | `view.snapInProgramMonitor` |
| Dynamic Audio Waveforms | — | `["View","Dynamic Audio Waveforms"]` | `view.dynamicAudioWaveforms` |
| Multi-Camera View | Shift+0 | `["View","Multi-Camera View"]` | `multicam.toggleView` |

## View › Appearance

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Darkest | — | `["View","Appearance","Darkest"]` | `view.theme.dark` |
| Dark | — | `["View","Appearance","Dark"]` | `view.theme.medium` |
| Light | — | `["View","Appearance","Light"]` | `view.theme.light` |
| Next Appearance Mode | — | `["View","Appearance","Next Appearance Mode"]` | `view.appearanceMode.next` |

## View › Display Mode

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Composite Video | — | `["View","Display Mode","Composite Video"]` | `view.display.composite` |
| Alpha | — | `["View","Display Mode","Alpha"]` | `view.display.alpha` |
| Red | — | `["View","Display Mode","Red"]` | `view.display.red` |
| Green | — | `["View","Display Mode","Green"]` | `view.display.green` |
| Blue | — | `["View","Display Mode","Blue"]` | `view.display.blue` |
| Multi-Camera | — | `["View","Display Mode","Multi-Camera"]` | `view.display.multicam` |
| Audio Waveform | — | `["View","Display Mode","Audio Waveform"]` | `view.display.audioWaveform` |
| Comparison View | — | `["View","Display Mode","Comparison View"]` | `view.display.comparison` |
| Video and Audio Waveform Split | — | `["View","Display Mode","Video and Audio Waveform Split"]` | `view.display.videoAndWaveform` |

## View › Guide Templates

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Safe Margins | — | `["View","Guide Templates","Safe Margins"]` | `view.safeMargins` |
| Save Guides as Template… | — | `["View","Guide Templates","Save Guides as Template…"]` | `view.guideTemplates.save` |
| Manage Guides… | — | `["View","Guide Templates","Manage Guides…"]` | `view.guideTemplates.manage` |

## View › Magnification

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Fit | — | `["View","Magnification","Fit"]` | `view.magnification.fit` |
| 10% | — | `["View","Magnification","10%"]` | `view.magnification.10` |
| 25% | — | `["View","Magnification","25%"]` | `view.magnification.25` |
| 50% | — | `["View","Magnification","50%"]` | `view.magnification.50` |
| 75% | — | `["View","Magnification","75%"]` | `view.magnification.75` |
| 100% | — | `["View","Magnification","100%"]` | `view.magnification.100` |
| 150% | — | `["View","Magnification","150%"]` | `view.magnification.150` |
| 200% | — | `["View","Magnification","200%"]` | `view.magnification.200` |
| 400% | — | `["View","Magnification","400%"]` | `view.magnification.400` |
| 800% | — | `["View","Magnification","800%"]` | `view.magnification.800` |
| 1600% | — | `["View","Magnification","1600%"]` | `view.magnification.1600` |

## View › Paused Resolution

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Full | — | `["View","Paused Resolution","Full"]` | `view.pausedRes.full` |
| 1/2 | — | `["View","Paused Resolution","1/2"]` | `view.pausedRes.half` |
| 1/4 | — | `["View","Paused Resolution","1/4"]` | `view.pausedRes.quarter` |
| 1/8 | — | `["View","Paused Resolution","1/8"]` | `view.pausedRes.eighth` |
| 1/16 | — | `["View","Paused Resolution","1/16"]` | `view.pausedRes.sixteenth` |

## View › Playback Resolution

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Full | — | `["View","Playback Resolution","Full"]` | `view.playbackRes.full` |
| 1/2 | — | `["View","Playback Resolution","1/2"]` | `view.playbackRes.half` |
| 1/4 | — | `["View","Playback Resolution","1/4"]` | `view.playbackRes.quarter` |
| 1/8 | — | `["View","Playback Resolution","1/8"]` | `view.playbackRes.eighth` |
| 1/16 | — | `["View","Playback Resolution","1/16"]` | `view.playbackRes.sixteenth` |

## Timeline

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| roll | — | `["Timeline","roll"]` | `timeline.roll` |
| trim | — | `["Timeline","trim"]` | `timeline.trim` |
| range-marker-timeline | — | `["Timeline","range-marker-timeline"]` | `timeline.marker` |
| timeline | — | `["Timeline","timeline"]` | `timeline.markerMenu.properties` |

## Window

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| New Project Panel | — | `["Window","New Project Panel"]` | `projectPanel.newPanel` |

## Window › Workspaces

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Editing | Alt+Shift+1 | `["Window","Workspaces","Editing"]` | `window.workspace.editing` |
| Assembly | Alt+Shift+2 | `["Window","Workspaces","Assembly"]` | `window.workspace.assembly` |
| Color | Alt+Shift+3 | `["Window","Workspaces","Color"]` | `window.workspace.color` |
| Effects | Alt+Shift+4 | `["Window","Workspaces","Effects"]` | `window.workspace.effects` |
| Audio | Alt+Shift+5 | `["Window","Workspaces","Audio"]` | `window.workspace.audio` |
| Captions and Graphics | Alt+Shift+6 | `["Window","Workspaces","Captions and Graphics"]` | `window.workspace.captionsandgraphics` |
| All Panels | — | `["Window","Workspaces","All Panels"]` | `window.workspace.allpanels` |
| Vertical | — | `["Window","Workspaces","Vertical"]` | `window.workspace.vertical` |
| Reset to Saved Layout | Alt+Shift+0 | `["Window","Workspaces","Reset to Saved Layout"]` | `window.workspace.reset` |
| Save Changes to this Workspace | — | `["Window","Workspaces","Save Changes to this Workspace"]` | `window.workspace.saveChanges` |
| Save as New Workspace… | — | `["Window","Workspaces","Save as New Workspace…"]` | `window.workspace.saveAs` |
| Edit Workspaces… | — | `["Window","Workspaces","Edit Workspaces…"]` | `window.workspace.edit` |
| Learning | Alt+Shift+7 | `["Window","Workspaces","Learning"]` | `window.workspace.learning` |
| Review | Alt+Shift+8 | `["Window","Workspaces","Review"]` | `window.workspace.review` |

## Help

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| Join the ArtCraft Discord… | — | `["Help","Join the ArtCraft Discord…"]` | `help.discord` |
| ArtCraft Website | — | `["Help","ArtCraft Website"]` | `help.website` |
| FilmCraft on getartcraft.com | — | — | `help.appPage` |
| FilmCraft on GitHub | — | `["Help","FilmCraft on GitHub"]` | `help.github` |
| Report an Issue… | — | `["Help","Report an Issue…"]` | `help.reportIssue` |
| Reveal Log Files… | — | `["Help","Reveal Log Files…"]` | `help.revealLogFiles` |
| System Compatibility Report… | — | `["Help","System Compatibility Report…"]` | `help.systemCompatibilityReport` |
| Check for Updates… | — | `["Help","Check for Updates…"]` | `app.checkForUpdates` |
| About FilmCraft | — | `["Help","About FilmCraft"]` | `app.about` |
| FilmCraft Help… | F1 | `["Help","FilmCraft Help…"]` | `help.filmcraftHelp` |

## Clipping

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| clip.mov | — | — | `clip.mov` |
| Replace With Clip From Source Monitor | — | `["Clipping","Replace With Clip From Source Monitor"]` | `clip.replaceFromSource` |
| Enable | — | `["Clipping","Enable"]` | `clip.enable` |
| Link | — | `["Clipping","Link"]` | `clip.link` |
| Group | — | `["Clipping","Group"]` | `clip.group` |
| Ungroup | — | `["Clipping","Ungroup"]` | `clip.ungroup` |
| Synchronize… | — | `["Clipping","Synchronize…"]` | `clip.synchronize` |
| Merge Clips… | — | `["Clipping","Merge Clips…"]` | `clip.mergeClips` |
| Nest… | — | `["Clipping","Nest…"]` | `clip.nest` |
| Multi-Camera | — | `["Clipping","Multi-Camera"]` | `clip.multicam` |
| Speed/Duration… | — | `["Clipping","Speed/Duration…"]` | `clip.speedDuration` |
| Scene Edit Detection… | — | `["Clipping","Scene Edit Detection…"]` | `clip.sceneEditDetection` |
| Frame Hold Options… | — | `["Clipping","Frame Hold Options…"]` | `clip.frameHoldOptions` |
| Add Frame Hold | — | `["Clipping","Add Frame Hold"]` | `clip.frameHold` |
| Insert Frame Hold Segment | — | `["Clipping","Insert Frame Hold Segment"]` | `clip.insertFrameHoldSegment` |
| Field Options… | — | `["Clipping","Field Options…"]` | `clip.fieldOptions` |
| Scale to Frame Size | — | `["Clipping","Scale to Frame Size"]` | `clip.scaleToFrameSize` |
| Fit to frame | — | `["Clipping","Fit to frame"]` | `clip.fitToFrame` |
| Fill frame | — | `["Clipping","Fill frame"]` | `clip.fillFrame` |
| Reveal in Project | — | `["Clipping","Reveal in Project"]` | `clip.revealInProject` |

## Other commands

| 功能 | 快捷键 | `_menu` path | 命令 id |
| --- | --- | --- | --- |
| LumetriScopes | — | — | `scopes.wrench` |

