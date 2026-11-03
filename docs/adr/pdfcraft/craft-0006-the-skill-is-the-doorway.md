# 技能就是门口

插件装好之后，用户在对话里最先碰到的东西不是标签页，也不是八个工具，而是**技能列表里的那一行**：
一个图标、一个名字、一句话描述。这一行不存在，后面的一切都无处发生。

所以这一篇说的不是文案风格，是**可见性合同**——哪些字段决定"能不能被看见"，以及哪些缺口在插件这边
根本补不上。

## 三件事必须同时成立

### 1. 技能本身出现在列表里

`agent.skillPaths` 指向 `agent/skills/<id>`；`SKILL.md` 的 frontmatter `name` **必须等于插件 id**，
否则 `skill-service` 里那条 `name` 与包身份对不上。插件提供的技能默认列出
（`skill-list-policy.ts` 里只有 `source === "market"` 才要求 manifest 显式启用）。

### 2. 在对应的"选择面"上可见

宿主按 surface 判断：

```
presentation.surfaces[surface]
  ?? presentation.defaultVisibility
  ?? (pluginProvided ? "hidden" : "visible")
```

**插件提供的技能默认是 `hidden`。** 什么都不写，管理器里看得见，选择器里看不见——
这正是"装了但选不到"的典型原因。每支插件因此都显式声明：

```json
"agent": {
  "skillPresentation": {
    "defaultVisibility": "visible",
    "surfaces": { "commandPalette": "visible", "skillPicker": "visible" }
  }
}
```

`commandPalette` 是对话输入区 `/` 那一层，`skillPicker` 是批量任务与定时任务里的技能选择器。
两个都要写，只写一个就会出现"对话里能用、批量任务里没有"这种半开状态。

`tests/craft-manifest.test.mjs` 把这两条断言住了，schema 也用宿主自己的 `PluginManifestSchema` 校验，
所以拼错的键不会等到装进宿主才发现。

### 3. 名字和图标

- **名字**：`presentation.displayName || alias || name`。各支插件沿用 photocraft 的做法——
  在 `SKILL.md` 的 frontmatter 写双语 `alias`（`alias: DesignCraft 排版出版`），不建 `locales/`。
  少一层间接，读文件就能看到用户会看到什么。
- **图标**：技能自己没有图标时，回落到**插件清单的 `icon`**，也就是 `assets/icon.png`
  （官方位图，不是随手挑的 Solar 名）。宿主把它转成
  `astravia-plugin://<id>/versions/<version>/assets/icon.png?v=<version>`；
  `theme-ui` 的 `isImageSkillIcon` 接受任意 `scheme://`，于是它作为 `<img>` 渲染。
  这条路成立的前提只有一个：**文件真的在包里**。`tests/craft-manifest.test.mjs` 会检查。

## 已知缺口（插件侧补不了）

批量任务 / 定时任务里的那个技能选择器（宿主 `SkillPickerPanelView`）渲染 `SkillTypeIcon` 时
**没有传 `resolveIcon`**，于是图标解析链在那一层断掉，显示默认立方体。
对话输入区的 `/` 面板走的是另一套（`useCommandPanelModel` → `useSkillIconMap` + `skillIconOf`），
图标正常。

这是宿主渲染层的缺口，不是清单写错了：插件已经提供了正确的 icon URL，只是那个组件没有去要。
记录在这里，是为了下一次有人看到"批量任务里图标是方块"时，不用重新查一遍。

## 另一种失败：技能写成了导览

技能文件的正文决定了 Agent 会不会真的动手。写成"这里有几个工具"的清单，Agent 就会把它们当查询接口；
写成"先看再动、动完再看"的循环，它才会去点。0005 的闭环就是为此写的，
`SKILL.md` 里的"一次完整的任务长什么样"是同一件事的另一种表述。

## 证据

- Observed：每份 `plugin.json` 都过 `PluginManifestSchema`，两个 surface 都是 `visible`
  （`node --test tests/craft-manifest.test.mjs`）。
- Observed：各支 `assets/icon.png` 存在且与上游 `app-icon/<id>-1024.png` 逐字节相同。
- Observed：`SkillPickerPanelViewProps` 没有 `resolveIcon`；`useCommandPanelModel` 有。
- Inferred：真实界面里图标确实按上面那条链渲染。没有做像素级截图比对；
  验证路径是在对话输入区打出 `/`、找到该技能，看图标是不是应用图标而不是方块。
