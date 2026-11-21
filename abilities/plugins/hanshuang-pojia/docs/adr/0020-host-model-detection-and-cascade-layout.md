# 0020：宿主模型自动识别，以及「层叠顺序」造成的三个布局事故

- **状态：** 已接受
- **日期：** 2026-11-20
- **背景：** 五处反馈里有三处（样本页、设置页、指南工序线）看着各不相同，量下来是同一类原因：我们自己写的 CSS 与页面上的工具类同特异度，而它排在后面。另两处是拒答梯度还在让用户手输端点与模型、知识页一进去就自动弹预览。
- **适用：** `src/style.css`、`components/pages/{samples,settings,docs,guide,prompts}.tsx`、`components/prompts/probe-refusal-card.tsx`、`runtime/contributions.ts`、`hooks/use-workbench.ts`

## 问题

### 一、`.fb-page` 盖掉了页面自己的布局

构建产物里 `src/style.css` 排 Tailwind 工具类之后。`.fb-page` 是 0,1,0 特异度，写的又是 `display: flex; flex-direction: column`：

| 页面 | 页面上的类 | 实际生效 |
|---|---|---|
| 样本 | `@min-[880px]:flex-row` + 左栏 `@min-[880px]:w-[260px]` | 方向被 `.fb-page` 改回 column，宽度仍生效 → **左栏 260px，右栏整块掉到下面** |
| 设置 | `grid` + `@min-[760px]:grid-cols-[144px_1fr]` | `display` 被改回 flex → **四个分组横在顶部，两栏变上下** |

页面上写的类没有一个是错的，错在「谁后出现」。

### 二、指南工序线：`line-clamp` 用在内联元素上

`<span className="line-clamp-2">` 是内联元素，`-webkit-box` 不生效，`overflow` 也不裁 —— 文字直接溢出卡片边框，还压到右边的箭头上；卡片本身也没有 `overflow-hidden`，圆角裁不住内容。

### 三、知识页：一进去就弹预览

`useDocs` 加载后会默认选中第一篇，而阅读器的 effect 把「选中项变了」当成外部请求，于是首帧就 `setOpenId`。

### 四、筛选菜单里一行只有计数

子目录 id 可能是空串（文档直接位于组根）。渲染出来就是一行只有数字、没有名字的空行。

### 五、拒答梯度还在让人手填端点与模型

`ProbeProfile` 是空的，用户得自己知道 provider 的 baseUrl 与 model id。

## 决定

### D1 `:where(.fb-page)` —— 让页面说话

```css
:where(.fb-page) { display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; gap: var(--fb-gap); }
```

`:where()` 特异性为 0：页面给了 `grid` / `flex-row` 就听页面的，没给才用这套默认。这是「默认值」应有的语义。

### D2 页面布局写进 CSS 类，不叠工具类

- `.fb-settings`：`grid-template-columns: minmax(88px,132px) minmax(0,1fr)`，左 tab 竖排；**不用容器查询** —— 面板宽度由宿主活动栏决定，容器查询的参照宽度与用户看到的不一定一致。
- `.fb-samples` + `.fb-samples-picker`：窄屏单列（picker 上限 `min(46vh,420px)`），`@container (min-width: 820px)` 才并排成 `minmax(240px,300px) minmax(0,1fr)`。

### D3 `line-clamp` 要有块级工具类

新增 `.fb-line-clamp-2`（`-webkit-box` + `-webkit-line-clamp` + `overflow:hidden`）；工序线段卡加 `min-w-0 overflow-hidden`，段名不再 `truncate`（改成可换行，`min-w-0 flex-1`）。

### D4 预览只在「外部选中」时打开

`openedFor` 的初值取当前 `docs.selected?.id`：首帧就记为「已处理」，于是默认选中不会触发弹窗；先例页「战例研究」那种真实跳转仍然会打开。

### D5 空子目录不是目录

渲染前过滤 `sub.id.trim().length > 0`。同一位置还有一处同理：列表里的分组头已经用 `topicEntry.id ? … : null` 守住了。

### D6 宿主模型：能自动读到的三项自动填，读不到的明说

`registerSystemPromptProvider` 的 `context.model` 带着 `provider / id / api`。运行时在 handler 里写一份快照到 `workbench/host-model.json`（**只这三项**），面板读到后：

- 显示「宿主当前模型 provider / id · apiStyle」，一键「用这个」填进 profile；
- 端点仍然要手填一次，并在卡片上写明原因：SDK 的 models API 只暴露插件自己发布的 provider，用户自己配的 baseUrl 读不到；
- 密钥从不进快照、不进档案、不进简报。

## 不做什么

- **不把 `.fb-page` 整块删掉。** 20+ 页面依赖「不给布局时自动竖排 + 间距」；`:where()` 已解决冲突。
- **不为了并排去改面板宽度。** 宽度是用户的（可折叠、可拖），布局要适应它。
- **不在设置页保留「窄屏横排 tab」的分支。** 四个分组各三个字，竖着放永远放得下；两套交互只会让窄屏出现第三种模样。
- **不从插件侧读宿主配置文件拿 baseUrl。** `fs` 只放行项目内，主目录下的配置既读不到也不该读。
- **不把宿主模型快照写进探测记录。** 记录描述的是「这一次探测」，与「当前用的是什么」是两件事，混在一起会让「上次比的是谁」变得不可知。
- **不改 `agent/` 下的技能、提示词、记忆。** 本轮只动 `src/` 与 ADR。

## 验证

已有：

| 用例 | 钉住什么 |
|---|---|
| `src/test/workbench/cascade-layout.test.ts`（5 条） | `.fb-page` 必须是 `:where`；设置页两栏模板 + 左 tab；样本页 picker 上限与 820px 并排；知识页「首帧记为已处理」；空子目录被过滤 |
| `src/test/workbench/forensics-pages.test.tsx` | picker 的高度上限来自 `.fb-samples-picker`，宽屏并排来自 `@container (min-width: 820px)` |
| `src/test/workbench/guide-page.test.tsx` | 工序线一行 + 横向滚、段卡 150px |
| `scripts/check-layout.mjs --strict` · `report-unused-locale --strict` · `type-scale` | 布局 / 文案 / 字号三道门禁 |

待补：

- 「宿主当前模型」只在真实宿主里才有值，组件测试用桩（`hostModel: async () => null`）覆盖不到渲染分支。
- 820px / 760px 两个断点是按经验定的，未在 1024 / 1280 / 1440 三档真机上逐一目视。

## 关联

- 0012：布局契约（谁滚、谁不缩）
- 0016 / 0017：取证型侧栏与全侧栏一致性标尺
- 0019：拒答梯度的一等公民化（本篇补上「要测谁」的自动识别）
