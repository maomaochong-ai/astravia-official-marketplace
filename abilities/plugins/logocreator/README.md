# LogoCreator

在 Astravia 的活动面板里设计品牌标志：内置一套确定性的矢量引擎，从品牌名与一句话描述画出图形、文字标志、字母组合与徽章，并把整套品牌套件（SVG / PNG / 配色 / 可打印指南）导出。

引擎完全本地：不需要密钥、不联网，`renderLogo(spec)` 是纯函数，同一组参数 + 同一个 seed 永远得到同一份字节。上游 [LogoCreator](https://github.com/Nutlope/logocreator) 是 Together AI 上的 FLUX 生成器，没有本地绘图引擎——这里把它补上了，AI 生成作为可选路径保留。

## 0.3.0 的四条行为约定

1. **没有图像模型也能用。** `domain/planner.ts` 把一句话解析成三个具体 spec（结构/风格/配色/seed）
   并给出取舍理由，引擎本地渲染；agent 侧对应 `logocreator_plan`。这条是"插件不能闲置死"的答案，
   和宿主内置设计插件同一个分工：模型选字段，本地渲染。
2. **删除真的删。** 两个 store 都写 tombstone，且每次写前先读文件：`(file ∪ mine) − tombstones`。
   陈旧实例再也复活不了已删除的记录（`history-delete.test.ts` 钉住）。
3. **备注分两级、带部位。** 局部备注解析成结构部位（图形/文字标志/标语/背景），全局备注是品牌级规则；
   交给 agent 时写进 prompt（`1. [the pictorial mark] …`），改完由 `logocreator_notes` 显式收口。
4. **一个图标集。** `shared/components/icons.tsx` 是唯一的 24px `currentColor` 字形来源，
   tab 图标也用它 —— 宿主在没有显式 icon 时会把 512px 图标缩成 16px 的小矩形。

## 目录

```text
src/
├── index.tsx                    插件装配：画布 tab + 输入栏开关 + 工具注册
├── plugin-context.ts            激活时的 ctx、设计历史与备注两个 store
├── contributions.ts             所有交给宿主渲染的 %key% 与输入栏 id
├── tab-ids.ts                   tab / 工具 id
├── domain/
│   ├── spec.ts / catalog.ts     设计由哪些字段决定；类型、风格、预设、题材词
│   ├── color-plan.ts/palette.ts 题材→色相锚点→调色板；sRGB/HSL/WCAG
│   ├── prng.ts                  mulberry32 + xmur3（种子唯一入口）
│   ├── engine/                  几何、单线字库、26 题材、8 风格、SVG 合成
│   ├── render-png.ts            SVG → PNG / 图片取像素
│   ├── brand-kit.ts             HTML 指南 + PNG/WebP + zip
│   ├── history-store.ts         设计历史（mutation 前强制 hydrate）
│   ├── notes.ts                 画布备注（锚点、状态、交给 Agent 的文案）
│   ├── settings.ts              变体数与所选图像服务
│   └── ai/                      宿主图像服务路径 + 提示词构造
├── features/canvas/
│   ├── components/
│   │   ├── logo-canvas.tsx      stage + 浮层 chrome（唯一容器）
│   │   ├── canvas-dock.tsx      底部 dock：生成/随机/设计面板/备注/套件
│   │   ├── canvas-inspector.tsx 右侧 inspector：设计页签与备注页签
│   │   ├── canvas-surface.tsx   画布本体：图形、图钉、落点输入
│   │   ├── notes-list.tsx       备注清单 + 交给 Agent
│   │   ├── canvas-controls.tsx  设计表单（在 inspector 里渲染）
│   │   ├── result-grid.tsx      结果格子（compact = 横向小卡）
│   │   └── …                    预设、类型、风格、取色、历史、套件、AI 弹窗
│   ├── hooks/                   form / history / generation / notes
│   ├── services/export-files.ts 保存入口（全部走 fs.saveAs）
│   ├── canvas-prompt.ts         输入栏开关打开的上下文
│   └── pending-design.ts        工具 → 画布的一次性"看这个"交接
├── shared/                      segmented / modal-dialog（面板内浮层）/ tokens
├── tools/                       design、brand_kit、catalog、notes 四个 Agent 工具
└── test/                        引擎、调色板、历史、备注、布局、manifest、接线

agent/
├── skills/logocreator/          技能（name === 目录名）
│   ├── SKILL.md                 操作手册：四个工具、一轮的固定顺序、硬规则
│   └── references/              9 份按需读的深度文件
└── agents/
    ├── logo-master.md           智能体系统提示词
    └── logo-master.webp         512×512 头像（与插件图标同源）
````
## 引擎怎么画

1. **题材**：`subjectFor(brief)` 在 `catalog.ts` 的关键词表里找**最早出现**的那个词。顺序按句子读法决定——"leaf mark for a bakery" 是叶片，"photography studio lens" 是镜头，而不是反过来。
2. **构成**：认不出题材、或 `type: "abstract"` 时，按 `seed` 哈希在 8 种抽象构成里选一种。
3. **绘制**：题材函数收 `{rng, recipe, detail}`，在 0–100 的方框里返回带**角色**（primary / secondary / accent / paper）的路径；角色由 composer 解析成颜色，所以同一套图形在八种风格与单色下都成立。
4. **合成**：布局（图形 + 名称 / 仅图形 / 文字 / 字母组合 / 徽章 / 抽象）→ 字体按字符数估算字号 → 装饰与纹理 → 512×512 SVG。

`paper` 角色是"挖空"，取当前表面的颜色：浅色导出是白、深色导出是深、透明导出按浅色处理（套件里另有 on-dark 版本，用深色调色板重新合成）。

字号由 `advanceEm()`（`compose.ts`）逐字符累加：CJK / 全角 1 em，大写拉丁 0.62，小写 0.52，空格 0.28。
按“平均字宽”估算会在中文名上算错——12 个汉字会被当成 7.4 em，得出来的字号能把字标推超出画布。
硬边界：**≥ 28 个汉字**时字号已到 18 下限，宽度超出 512（引擎不为中文断行），那时应该换 `type: icon`。

## 技能与智能体

插件只带**一个**技能 `logo-studio` + **一个**智能体 `logo-master`（显示名「Logo设计大师」），
再加上一个以它为队长的单成员团队 `logo-studio`。这个分层是故意的：

- **一个技能，深度靠 references。** 参考工程 `vetta-ui-design` 的做法是 `SKILL.md` 写操作流程，
  判断性的内容放 `references/` 按需读。三个工具撑不起“方向、结构、风格、配色、审图、交付、中文”
  七个主题的并列技能——那会让五个 skill 的 description 都命中同一句“做个 logo”，
  宿主反而不知道加载哪个。所以这里是一本手册 + 九份按需读的深度文件：

  | references | 解决什么 |
  | --- | --- |
  | `directions.md` | brief 四栏 → 四个参数的决定顺序、该问什么 |
  | `structure.md` | 六种结构在引擎里的真实几何与长度上限 |
  | `style-fit.md` | 八种风格的参数表、行业对照、会互相抵消的组合 |
  | `colour.md` | `auto` 推导链、对比度地板的具体数值、图片取色 |
  | `subject-atlas.md` | 26 个题材 + 8 种抽象构成各自适合什么、何时会毁掉标志 |
  | `cjk-brand-mark.md` | 中文名的字宽、单字字母组合、双语名丢字、题材词必须写英文 |
  | `anti-patterns.md` | 14 种已知失败及其成因（都是渲染时真实见过的） |
  | `critique.md` | 交付前的 10 项顺序检查 + 自检清单 |
  | `deliverables.md` | 套件里每个文件干什么、哪种请求对应哪个文件 |

- **智能体 `abilities: "own"`。** 设计师只能看到本插件的三个工具与这本技能，看不到文件编辑、
  shell、浏览器。这是硬边界而不是提示词约定：`own` 在宿主里落成 `selectionMode: custom` +
  `plugins: ["logocreator"]`，一个被要求“做个 logo”的人格不会顺手把网站也改了。
  代价是它读不了自己写的 SVG，所以提示词要求它用工具返回的 `files[]` / `subject` / `palette` 作证。
- **团队是单成员。** 第一个成员即队长，也是会话里唯一入口。交给团队 `workflow` 的是流水线
  （问完 → 四个决定 → 三个变体 → 审 → 交付），人设与判断在智能体提示词里，工具细节在技能里——
  三层不重叠。

## 名字与归属

- 能力卡的英文名是 `LogoCreator`，中文界面读 `detail.i18n.zh.name` = **标志设计**；
  `defaultLocale` 是 `zh`，所以没装语言包时先显示中文。
- 插件只注册**一个智能体**（`agent.agents[]`），**没有 teams**。@ 提及面板按这两块分组：
  写进 teams 就会出现在「团队（N 位成员）」里，那是给多角色编队用的，而这里只有一位专家。
- 内部标识统一：tab `logocreator-canvas`、工具 `logocreator_*`、技能目录 `agent/skills/logocreator`。

## 画布布局（对齐宿主内置设计插件）

tab 不是一个纵向表单，而是一块画布加浮层 chrome。这是宿主的 `astravia-ui-design` 的解剖结构，
换成 400–600px 的侧栏后更必须如此：面板只装得下一个主体。

```text
┌──────────────────────────────────────────┐
│ 标题芯片（品牌名 + 引擎徽标）   历史/AI/重置 │  ← 浮在左上/右上 (absolute, z-40)
│                                          │
│              ● 画布（stage）              │  ← relative min-h-0 flex-1，不滚动
│            点击落备注图钉                 │
│                                          │
│  [ 最近结果：横向小卡 ]                    │  ← 浮在 stage 下缘 (bottom-16)
│        ┌───────────────────────────┐     │
│        │ → ✦ │ ⚙ 备注⑶ │ ▤        │     │  ← 底部居中 dock (bottom-3, -translate-x-1/2)
│        └───────────────────────────┘     │
└──────────────────────────────────────────┘
     ⚙/备注 打开右侧 inspector（absolute inset-y-0 right-0），唯一的滚动区域
```

| 区域 | 组件 | 为什么在这里 |
| --- | --- | --- |
| stage | `logo-canvas.tsx` | `min-h-0 flex-1`，永不滚动：滚走的画布 = 在改一个看不见的图形 |
| 标题芯片 / 动作轨 | 同上 | `absolute z-40`，与参考工程同一坐标语言 |
| dock | `canvas-dock.tsx` | 四个高频动词 + 备注角标；无 `backdrop-blur`（背后画布每帧重绘） |
| inspector | `canvas-inspector.tsx` | 设计/备注两页签，`absolute right-0` **盖住** stage 而不是压缩它 |
| 结果横条 | `result-grid.tsx` 的 `compact` | 生成后立刻可见，不抢 stage |

所有弹窗用 `absolute inset-0`（面板根是 `relative`），不会盖住对话区。

## 画布备注：让宿主直接改

参考 `astravia-ui-design` 的备注机制，这里也是一个闭环：

1. 用户点画布任意位置 → 落一个锚点（0–1 分数坐标，任何预览尺寸都指得准）→ 写一句话。
2. `use-canvas-notes` 存进 `notes.json`（与设计历史同一套"先 hydrate 再写"的保护）。
3. 「把备注交给 Agent」→ `ctx.conversation.sendPrompt`，用户能在对话里看到自己写的那几句；
   发送成功后才把这几条标为 resolved，失败则留 pending 可重发。
4. Agent 手里的 `logocreator_notes` 可以 `list` 读待办、`resolve` 收口——只关它真的改过的那些。

备注不替代生成：它要求 Agent **改字段再重绘**（保持 seed），而不是重投一次赌一把。

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

## 性能

画布每次编辑都要重画预览，风格格子还要额外画 8 张。所以：

- 预览与风格格子都吃 `useDeferredValue` 后的 spec——输入框跟手，图形在 React 的空闲槽重画；
- 引擎本身有预算测试（`engine-budget.test.ts`）：单张 lockup < 20 ms、八张风格块 < 160 ms、
  两行字标 + 标语 < 30 ms、单个 SVG < 200 KB。改引擎让这些变红，就是真的变慢了。
- 设计历史与备注都只存参数，几百字节一条；重开面板时重放一遍就能重新出图。

## 数据放在哪

| 内容 | 位置 |
| --- | --- |
| 设计历史（参数） | 插件私有存储 `designs.json` |
| AI 结果（位图） | 宿主 blob 存储，记录里只留 `blobId` |
| AI 图像服务的选择 | `settings.json`（只是 providerId；密钥与账号在宿主里） |
| 变体数 | `settings.json` |
| 用户导出的文件 | 用户在保存对话框里选的位置（`fs.saveAs`） |
| Agent 工具写出的标志 | 会话工作目录下的 `logos/<slug>/` |
| 技能 / 智能体 | `agent/skills/logo-studio/`、`agent/agents/logo-master.*` |

## 排错

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 面板里没有历史 | `designs.json` 读失败或存储未授权 | 看宿主日志里的 `logocreator` 记录；重新授权 `storage.read/write` |
| AI 按钮没反应 / 提示「当前无法使用 AI 生成」 | 宿主里没有能文生图的图像服务 | 到宿主自己的设置里添加一个图像服务，再回面板 → AI 图像来源 → 刷新 |
| AI 生成报 unauthenticated / quota | 那个图像服务没登录或额度用尽 | 错误码已转成人话写在提示里；去宿主里处理，本插件不存凭据 |
| `pngSkipped: true` | 工具处理器所在环境没有 canvas | 矢量与文本文件仍已写入；PNG 在面板里点一次即可 |
| 风格格子空白 | `previewUrl` 的 data URL 被 CSP 拦 | 检查宿主是否允许 `data:image/svg+xml` |
| 智能体名单里看不到 Logo设计大师 | `agent.agents` 未解析，或头像/提示词文件不在包里 | 看 `plugin.json#agent.agents` 的 `avatar` / `systemPromptPath` 是否都打包进去了；`src/test/manifest.test.ts` 已校验这两份文件存在且头像 ≤ 512 KB |
| 智能体做起来像个通用助手 | `abilities: "own"` 被改成 `all`，或它没读技能 | 改回 `own`；提示词第一段就要求先读 `logo-studio` |
| 装完看不到 logo 工作室标签页 | `initiallyVisible` 被改回 `false`，或 `ui.slot.activity-tab` 未授权 | 两者都是硬前置：标签页不注册就什么都不显示；看主进程日志里的 `logocreator` 警告 |
| 对话框里点插件/打 `/` 没反应 | 输入栏开关注册失败（`ui.slot.input-action` 未授权）或 `activate` 抛错 | 看日志里的 `contribution skipped` 与 `logocreator ... could not be registered` |

## 宿主是怎么装外部插件的（只读结论，不改宿主）

读的是 `D:\open-source-projects\open-astravia`（**不改它**）。市场插件和内置 preset 走同一条路，只是来源不同；控制链条如下（行号对应阅读时的源码）：

1. **包 → manifest**。`apps/desktop/src/main/abilities/open-marketplace/open-marketplace-plugin.ts:45` 校验 `source.path` 必须在包内，`entry` / `styles[]` 必须是真实文件。
2. **权限账本**。`apps/desktop/src/main/plugins/plugin-permission-policy.ts` 只是去重与并集；真正的把关在渲染进程的每个贡献 API 里：`plugin-ui-context.ts:477` 的 `registerInputAction` 第一行就是 `require("ui.slot.input-action")`，**抛异常而不是降级**。所以缺权限 = 该贡献面不注册。
3. **加载**。`renderer/domains/plugins/runtime/plugin-module-loader.ts` 用 Module Federation 把 `plugin.entryUrl` 当 remote 入口，而且 `:67` 的 `assertPluginEntryFetchable` 要求这个 URL 返回 **JSON**——这正解释了为什么 `entry` 写 `dist/mf-manifest.json` 而不是 `remoteEntry.js`。`remotes: [{ name: moduleFederation.remoteName, alias: plugin.id, entry }]`。
4. **激活**。`src/index.tsx` 的 `activate(ctx)` 只做注册；每个注册返回的 Disposable 在卸载时释放。
5. **工具表是硬边界**。`scope_use` 缺省 = 不激活；运行期还能被 `setToolEnabled` 改。
6. **AI 能力**。`ctx.ai`（`ai.complete` / `ai.models.list`）是文本；**图像**走 `ctx.media` + `ctx.jobs` + `ctx.artifacts`，三者都只认一个权限：`media.generate`（`plugin-host-apis.ts:310/416/446` 三处 `require("media.generate")`）。

最后一条直接决定了本插件的网络与凭据面：既然宿主已经有受管的图像服务，就不应该再自带一个 HTTP 客户端与一个密钥库。

## 为什么现在不请求网络与密钥

0.0.2 之前，AI 路径直接打 Together（自备密钥）。对应声明是 `network.fetch` + `network.allowedHosts: ["api.together.xyz"]` + `secrets.read/write` + `shell.openExternal`。现在换成：

```
ctx.media.listProviders()  → 挑一个能 text-to-image 的
ctx.media.submit({...})    → ctx.jobs.wait(job)
ctx.artifacts.persist()     → 拿 blobId 存进历史
```

结果：**没有出网请求、没有密钥存储、没有外部网络白名单**；权限从 13 条降到 10 条；AI 按钮花的是用户已经配好的额度。`manifest.test.ts` 现在反向断言这四条不得出现。

## 发布

源码在 `main` 开发，CI 构建并发布到 `gh-pages`。改了 `src/`、`plugin.json`、`locales/`、
`agent/` 或 `assets/` 就必须抬版本（`node scripts/marketplace.mjs bump --slug logocreator --apply`）。
只改 `detail.json`、`ability.json`、`README.md` 不需要抬版本。

版本当前是 **0.0.2**：0.0.1 是初版号，技能重构属于运行内容变化（`agent/` + `plugin.json` + `src/`），
所以抬到了 0.0.2；三处身份文件（`plugin.json` / `ability.json` / `package.json`）与
`.astravia/marketplace.source.json` 必须同步。
