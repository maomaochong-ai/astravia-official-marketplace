# 0004 — 身份串不用变量、面板不许空白、设计目录带后缀

- 状态：已采纳
- 日期：2026-11-23
- 版本：0.9.0
- 相关：0001（面板身份）、0002（权限被拒）、0003（一设计一目录）

## 背景

用户在真机上看到三件事：会话里那个胶囊写着 `%name%`；tab 打开了但**面板整块是黑的**；
设计产物仍然不像宿主内置设计插件那样「从文件树里打开一份设计」。

## 真因与决策

### D1 身份串用字面值，不用 `%key%`

`%name%` 出现在**用户消息里的 skill 胶囊**上。这类文字会被写进消息 token / 历史记录，
宿主某些渲染路径（token、落盘的状态）不会重新解析 `%…%` —— 于是用户读到一个变量名。

而 tab 标签显示正常（`logo设计`），说明解析链本身是通的；差别在于 tab 每次渲染都重新解析。

所以按**用途**分流，而不是一律改字面值：

| 串 | 形态 | 理由 |
| --- | --- | --- |
| `skillPresentation.displayName` | 字面值 `LogoCreator` | 会进 token / 历史；不能有未解析风险 |
| `%tab.label%` / `%panel.title%` | 保留 `%key%` | 每次渲染重解析，且 `host-labels.test.ts` 逐条验证 |
| 工具名 / 描述 | 保留 `%key%` | 每次调用时由宿主渲染 |

`LogoCreator` 是产品专有名词，两语言同一写法 —— 与参照插件用字面值 `Astravia 设计` 同一取舍。

新增两条断言：清单里的 `displayName` 不得是 `%…%` 形态；zh / en 两个词表里**任何**值都不得是纯 `%key%`。

### D2 面板不允许渲染成空白

`h-full` 在宿主容器高度解析为 0 时也是 0，而画布的区域全是绝对定位的子元素 ——
它们被 `overflow-hidden` 裁掉，结果是一块全黑的面板，既没有报错也没有内容。

- 根节点改为 `h-full min-h-[320px]`：容器没有高度时仍然有可画面积；
- 挂载时量一次 `offsetWidth/offsetHeight` 并打日志；`height === 0` 时额外警告一句
  «host gave the panel zero height»。这是把「黑屏」变成一个可诊断的事实，而不是靠猜。

### D3 设计目录带后缀，并且能从文件树打开

上一版的 `logo-designs/<slug>/` 只是一个普通目录：宿主认不出来，用户也读不出「这是一份设计」。
改成与内置设计插件同构：

```
<project>/acme.logocreator-design/
  design.json   mark.svg   variants/1.svg …   kit/…
```

- 后缀 `DESIGN_FOLDER_SUFFIX = ".logocreator-design"`，扩展名口径 `logocreator-design`；
- `ui.file-explorer.context-menu`：目录上右键 → 「在 LogoCreator 中打开」→ 读 `design.json`、
  必要时入库、然后打开画布。这就是「启动引擎并加载引擎所在的工作目录」这条动作；
- `ui.file-explorer.decorations`：该目录在文件树里显示插件自己的图标；
- 显式传 `directory` 时才多一层容器目录（旧行为仍可用）。

`openDesignFolder` 的判断：磁盘上那份与历史里那条 **seed + 品牌 + 类型 + 风格** 相同即视为同一份，
直接开已有记录；否则新建一条 —— 否则每打开一次就在历史里堆一条同款。

## 后果

- 面板不再会因为宿主容器高度为 0 而全黑，且黑屏时日志里有数字可查；
- 消息胶囊、能力卡、tab 三处名称一致且都不会露出变量名；
- 设计文档在文件树里可见、可点开，与宿主自己的设计文档同一种读法；
- 多了两个权限（`ui.file-explorer.context-menu` / `ui.file-explorer.decorations`）。
  升级不会自动授予 —— 缺失时只是少了右键项与图标，不影响其它功能（ADR 0002 的教训）。

## 不做什么

- **不把 `%tab.label%` 也改成字面值**：它会随语言切换，改成字面值等于放弃中文界面；
- **不在面板里扫描项目找设计目录**：面板只响应用户的显式动作（工具调用 / 右键菜单），
  自动扫描会在每个项目上跑一遍 IO，且容易把别人的设计载进来；
- **不删除旧的 `logo-designs/`**：可能已被引用；新版不再写它。

## 验证

| 项 | 结果 |
| --- | --- |
| `tsc --noEmit` | 通过 |
| `vitest run`（插件） | 33 文件 / 251 条通过（本轮 +20） |
| `panel-chrome.test.ts`（18 条） | 含「identity strings never leak a variable name」三条与「面板不许空白」两条 |
| `design-folder.test.ts`（11 条） | 后缀命名、`isDesignFolder` / `slugOfFolder`、清单读写合并、上限、坏文件、工具不再写平铺路径 |
| `host-labels.test.ts` | 字面值放行、`%key%` 仍必须解析成功 |
| 实机：胶囊名称、面板渲染、右键打开 | **NOT RUN**（工作区无可用 Desktop） |

实机验收：会话里挂上插件发一句话 → 胶囊应显示 `LogoCreator`；面板应有内容（不是全黑）；
项目里应出现 `acme.logocreator-design/`；在文件树里右键它 → 「在 LogoCreator 中打开」→ 画布载入该设计。
