# LogoCreator 插件工程

Astravia 桌面插件。开工前先按根目录 `AGENTS.md` 的手册流程装依赖、读 SDK 文档——不要凭记忆写 SDK API。

```bash
npm install
npx astravia-plugin-cli docs      # 手册绝对路径 + 对应 SDK 版本
npm run check && npm run test && npm run build
```

本工程的实际构建脚本是 `tsc --noEmit && vite build`（`@astravia-org/plugin-vite` 的 Module Federation 封装）。
本地开发机常用 bun；CI 走 npm。

## 这个工程最容易被改坏的六处

1. **演示对话的文案。** `detail.json` / `detail.zh.json` 的 showcase 用 `chat-thread`：气泡区可用高度约
   72px，两个 `compact` 气泡各占约 29px + 6px 间距。**两句话都必须单行**——中文 ≤ 22 字、英文 ≤ 44 字符。
   超了就会被 `justify-end` 从顶部裁掉，看起来像文字被圆角容器盖住。`src/test/showcase-fit.test.ts` 守着这条线。
2. **id 与版本号。** `plugin.json#id` 必须等于能力 `slug`（`logocreator`），三处 `version`（`plugin.json` /
   `ability.json` / `package.json`）与 `marketplace.source.json` 必须一致。
3. **`spec.ts` 是唯一事实源。** 任何"设计"的新字段都要先进 `LogoSpec` 与 `normalizeSpec`，
   历史记录只存它。不要在组件里另开一份表单状态。
4. **风格只写 Tailwind `className`。** `style.css` 只有 Tailwind 入口与宿主主题别名；
   插件与宿主共享同一个页面，全局选择器会污染整个 UI。
5. **技能的分层。** 一个 `SKILL.md` + 九份 `references/`。新增判断内容写成 reference 并在
   SKILL.md 的 `## References (read on demand)` 表里加一行；**不要为每个主题新建一个顶层技能**
   ——它们的 description 会全部命中“做个 logo”，宿主反而不知道加载哪个。
   `manifest.test.ts` 同时校验“索引里提到的文件存在”与“磁盘上的文件都被索引”。
6. **字号不是平均值。** `advanceEm()` 逐字符累加；把中文当 0.62 em 会把字标推出画布。
   改这里必须重跑 `logo-engine.test.ts` 里两条 CJK 用例。

## 目录职责

见 `README.md` 的目录树。三条硬边界：

- `domain/engine/` 不许 import React，也不许读 `ctx`——它是纯函数，测试直接跑。
- `features/studio/components/` 里一个文件一个主组件；异步状态机放 `hooks/`。
- 任何会失败的操作（存储、网络、canvas、文件写入）的 catch 里必须
  `ctx.ui.notify({ message, error })`，或经 `plugin-context.ts` 的 `reportError`，不许吞掉原始 error。

## AI 路径（不重复造宿主己有的轮子）

图像生成全部走宿主的 `ctx.media` + `ctx.jobs` + `ctx.artifacts`，只靠一个 `media.generate` 权限。
**不要**再引入自备密钥的 HTTP 客户端：那会多一个凭据库、多一条出网路径，也绕过了宿主的计费与登录。
错误码（`unauthenticated` / `quota-exhausted` / `content-rejected` …）在 `domain/ai/host-media.ts` 里
translate 成人话——新增错误分支只改那张表。

## 四个不能改回去的决定

1. 活动标签页 `initiallyVisible: true`。改成 `false` 又不去 `setActivityTabVisible`，用户装完就什么都看不到。
2. 面板**静态 import**。改成 `lazy()` 后一旦 chunk 加载失败，Suspense 永不 resolve = 空白面板。
3. 输入栏开关的 `id` 不带插件前缀（`"brand"`）。宿主自己会拼成 `<pluginId>:<id>`。
4. `plugin.json` 不得出现 `network.fetch` / `secrets.*` / `shell.openExternal`；`manifest.test.ts` 会反向断言。
## 技能与智能体

```text
agent/
├── skills/logocreator/
│   ├── SKILL.md                 技能本体（name 必须 === 目录名，也要出现在 skillPresentation）
│   └── references/*.md          判断性的深度内容，由 SKILL.md 的索引表路由
└── agents/
    ├── logo-master.md           系统提示词：六条原则 + 一轮的顺序 + 硬规则
    └── logo-master.webp         512×512 WebP（宿主只接受 ≤ 512 KB 的图片）
```

三层的分工不要混淆：

- **`agent.agents[].systemPromptPath`** — “这个人是谁”：语气、原则、边界。不写工具参数。
- **`agent.teams[].workflow`** — “这支队怎么跑”：固定流水线。单成员团队里队长即唯一入口。
- **`skills/*/SKILL.md`** — “具体怎么做”：工具契约 + 参考索引。

新增智能体时：`id` / `mentionHandle` 只用 `[a-z0-9-]`；头像与提示词必须真打包进去
（`manifest.test.ts` 校验存在性、头像方形与体积）；新增 `%key%` 必须同时补 `locales/en.json`
与 `zh.json`，否则 `%key%` 会原样上屏。
## v0.0.8 起的三条硬约束

1. **一个名字。** 能力名 / tab / 输入栏 / 技能 `name`+alias / 团队名 全是 `LogoCreator`，中英一致；
   随语言变的只有描述类文案。不要再引入 studio、design-master 之类的内部叫法。
2. **目录按用户目标分。** `features/canvas/{components,hooks,services}`，基础组件一个文件一个；
   画布容器可以组合子组件，但不要在同一文件里再定义弹窗或卡片。
3. **两个 store 同一套纪律。** `HistoryStore` 与 `NoteStore` 都是"mutation 前强制 hydrate"：
   工具在面板关着时也会写盘，缺这一步就是整文件覆盖。
