# LogoCreator

在 Astravia 的活动面板里设计品牌标志：内置一套确定性的矢量引擎，从品牌名与一句话描述画出图形、文字标志、字母组合与徽章，并把整套品牌套件（SVG / PNG / 配色 / 可打印指南）导出。

引擎完全本地：不需要密钥、不联网，`renderLogo(spec)` 是纯函数，同一组参数 + 同一个 seed 永远得到同一份字节。上游 [LogoCreator](https://github.com/Nutlope/logocreator) 是 Together AI 上的 FLUX 生成器，没有本地绘图引擎——这里把它补上了，AI 生成作为可选路径保留。

## 目录

```text
src/
├── index.tsx                    插件装配：活动面板 tab + 输入栏开关 + 工具注册
├── plugin-context.ts            激活时的 ctx 与 HistoryStore 单例
├── tab-ids.ts                   tab / 工具 / 技能 id（测试直接引用真名）
├── domain/
│   ├── spec.ts                  一个设计由哪些字段决定（唯一事实源）
│   ├── catalog.ts               类型、风格、细节、预设、题材关键词
│   ├── color-plan.ts            题材 → 色相锚点 → 调色板；图片取色
│   ├── palette.ts               sRGB / HSL / WCAG 对比度
│   ├── prng.ts                  mulberry32 + xmur3（种子唯一入口）
│   ├── engine/
│   │   ├── geometry.ts          路径构造（弧、环、n 边形、Catmull-Rom）
│   │   ├── glyphs.ts            A–Z 0–9 单线几何字库（字母组合用）
│   │   ├── motifs.ts            26 个象形题材 + 8 种抽象构成
│   │   ├── style-recipes.ts     八种风格的绘制参数
│   │   └── compose.ts           图形 + 字体 + 装饰 → 独立 SVG
│   ├── render-png.ts            SVG → PNG（canvas）/ 图片取像素
│   ├── brand-kit.ts             套件内容 + zip（fflate）
│   ├── brand-guide.ts           可打印 HTML 指南 + 品牌看板
│   ├── history-store.ts         设计历史（只存参数，AI 结果存 blob）
│   ├── studio-settings.ts       模型与变体数
│   └── ai/                      Together 客户端 + 提示词构造（可选）
├── features/studio/
│   ├── hooks/                   use-logo-form / use-design-history / use-generation
│   ├── components/              面板、控件、格子、三个弹窗（一个文件一个主组件）
│   ├── services/export-files.ts 保存入口（全部走 fs.saveAs）
│   └── studio-prompt.ts         输入栏开关打开的上下文
├── shared/                      segmented / modal-dialog / tokens / 格式化
├── tools/                       design、brand_kit、catalog 三个 Agent 工具
└── test/                        引擎、调色板、历史、manifest、面板接线
```

## 引擎怎么画

1. **题材**：`subjectFor(brief)` 在 `catalog.ts` 的关键词表里找**最早出现**的那个词。顺序按句子读法决定——"leaf mark for a bakery" 是叶片，"photography studio lens" 是镜头，而不是反过来。
2. **构成**：认不出题材、或 `type: "abstract"` 时，按 `seed` 哈希在 8 种抽象构成里选一种。
3. **绘制**：题材函数收 `{rng, recipe, detail}`，在 0–100 的方框里返回带**角色**（primary / secondary / accent / paper）的路径；角色由 composer 解析成颜色，所以同一套图形在八种风格与单色下都成立。
4. **合成**：布局（图形 + 名称 / 仅图形 / 文字 / 字母组合 / 徽章 / 抽象）→ 字体按字符数估算字号 → 装饰与纹理 → 512×512 SVG。

`paper` 角色是"挖空"，取当前表面的颜色：浅色导出是白、深色导出是深、透明导出按浅色处理（套件里另有 on-dark 版本，用深色调色板重新合成）。

## 开发

```bash
bun install          # 本仓库的开发机用 bun；CI 走 npm
npx astravia-plugin-cli docs   # SDK 手册（装到 node_modules 里，别硬编码路径）
bun run check        # tsc --noEmit
bun run test         # vitest（happy-dom）
bun run build        # tsc + vite（同时产出 release/*.astraviapkg）
```

`@astravia-org/plugin-sdk` 与 `plugin-vite` 未发布到 npm：本地开发时它们来自
`.tooling/open-astravia/packages/plugins/*`，`node scripts/marketplace.mjs build` 会自己把
依赖临时指向本地再装。手动给本工程装依赖时同样需要这一手，装完记得把 `package.json` 里的
semver 声明还原。

### 演示对话不能被圆角容器裁掉

宿主在能力详情页用 `showcase` 渲染演示对话。`chat-thread` 的内框是 `h-44`（176px）：
顶栏约 40px、底部输入位约 44px、气泡区上下内边距 20px，气泡实际可用高度约 **72px**。
每个 `compact` 气泡单行约 29px、两行约 44px，间距 6px——所以**两句话都必须是单行**，
两行 + 一行的组合会被 `justify-end` 从顶部裁掉（读起来就是文字被圆角容器盖住）。

预算：气泡内宽约 330px，11px 字号下中文 ≤ 22 字、英文 ≤ 44 字符。`detail.json` /
`detail.zh.json` 里的 `user_prompt` 与 `assistant_reply` 必须各自守住这条线。
`src/test/showcase-fit.test.ts` 会按这个预算计算，改文案时不会悄悄溢出。

## 数据放在哪

| 内容 | 位置 |
| --- | --- |
| 设计历史（参数） | 插件私有存储 `designs.json` |
| AI 结果（位图） | 宿主 blob 存储，记录里只留 `blobId` |
| Together 密钥 | `ctx.secrets`（加密，不写进 JSON） |
| 模型与变体数 | `settings.json` |
| 用户导出的文件 | 用户在保存对话框里选的位置（`fs.saveAs`） |
| Agent 工具写出的标志 | 会话工作目录下的 `logos/<slug>/` |

## 排错

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 面板里没有历史 | `designs.json` 读失败或存储未授权 | 看宿主日志里的 `logocreator` 记录；重新授权 `storage.read/write` |
| AI 按钮没有反应 | 没有 Together 密钥 | 面板 → AI 设置 → 粘贴密钥；或在无关钥时继续用内置引擎 |
| AI 生成报 401/402 | 密钥无效或余额不足 | 提示里已经写明状态码；换成可用密钥 |
| `pngSkipped: true` | 工具处理器所在环境没有 canvas | 矢量与文本文件仍已写入；PNG 在面板里点一次即可 |
| 风格格子空白 | `previewUrl` 的 data URL 被 CSP 拦 | 检查宿主是否允许 `data:image/svg+xml` |

## 发布

源码在 `main` 开发，CI 构建并发布到 `gh-pages`。改了 `src/`、`plugin.json`、`locales/`、
`agent/` 或 `assets/` 就必须抬版本（`node scripts/marketplace.mjs bump --slug logocreator --apply`）。
只改 `detail.json`、`ability.json`、`README.md` 不需要抬版本。
