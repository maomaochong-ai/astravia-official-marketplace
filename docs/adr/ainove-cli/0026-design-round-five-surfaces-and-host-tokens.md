# ADR 0026：按设计稿重排活动标签页的五个界面

- 状态：已接受（2026-10-30）
- 决策对象：`abilities/plugins/mahua-writing-team/src/features/shared/components/`（新增
  `Panel` / `PageBar` / `PhaseBadge` / `ChapterDot` / `MeterBar` / `ScoreBar`）、
  `src/features/studio/components/StudioStrip.tsx`、`src/features/library/components/`
  （`LibraryShelf` / `LibraryCatalog` / `BookDetail` / `ReaderPane` 重写，新增 `ThreadLedger`）、
  `src/features/library/hooks/{use-library-route,use-thread-ledger}.ts`、
  `src/application/studio-service.ts#decisions`
- 依据：`ui-mock/mahua-novel-studio.astravia-design`（`DESIGN.md`、`theme.css`、`frames/*`、
  `components/*`）、宿主 `.tooling/open-astravia/apps/desktop/src/renderer/styles.css`
  的令牌实测值、`node_modules/@astravia-org/plugin-sdk/src/tailwind-theme.css` 的别名表
- 延续：ADR 0006（只用宿主令牌）、ADR 0013（书架与阅读页）、ADR 0016（字号五档）、
  ADR 0020 §3/§4（窄面板折法）、ADR 0025 §2（活动标签入口）

## 1. 背景

设计稿是一套 1440×900 的整窗口稿，七个帧都在同一张「浮纸」上铺开；插件落在活动面板的标签里，
实宽 400–1000px，高度由面板决定。所以这次的需求不是「照抄像素」，而是「把同一套信息层级搬进一个
会更窄的容器」：哪些块并排、窄了先掉哪一列、哪些字段永远不能被挤掉，都要在落地时逐处决定。

设计稿自身有两处不自洽，落地时必须选一边，不能两头照抄：

- `DESIGN.md` 的「墨底」小节给了深底三栏的设想，`theme.css` 末段却写明「没有第二套底色……
  任何一帧都不允许出现深底窗口」。运行台（`console` 帧）因此不做深色窗口，`inset` 底加
  `font-mono` 足以表达「这一栏在跑」。
- `ChapterBrief.tsx` 的文件头注释说「没有任何按钮」，它的 footer 却有一颗「去侧栏看它写」。
  这个组件的职责（章目标/冲突/收尾钩 + 只读说明）被吸收进书页的指令卡与最近发生，不再单独存在。

## 2. 采纳范围

**采纳 5 层 surface**：`shelf`（书架）→ `catalog`（书库）→ `book`（书页）→ `reader`（阅读）
→ `ledger`（伏笔账本）。前四层沿用 ADR 0013 的导航，`ledger` 是本轮新增的第五层。

**新增 `ledger` 而不是复用书页的折叠块。** 台账本身是一张会长到几十行的表，决策日志是只追加的
记录，一致性体检是另一份独立结果；三样塞进书页右栏（设计稿那里只有 366px）只会互相挤。单独一层
之后的通路是：书页右栏的虚线卡 → 台账页 → 返回键回书页。

**跳过 `console` 帧。** 它要的是事件流、token 计数与四个 agent 的实时状态；插件没有这三样数据源
（`routeNovel` 只给「下一步做什么」，不给「刚刚花了多少 token」）。照帧硬造就是假数据，宁可缺一帧。

**不复刻 `StudioRail`（208px）与 `WindowChrome`。** 前者在 400px 面板里要吃掉一半宽度，导航改成
页内链接与返回键；后者是宿主窗口的标题栏，macOS 红绿灯不属于插件，ADR 0025 §1.2 已经因为页头
耦合吃过一次亏。

**保留 ADR 0016 的字号契约。** 设计帧的 `SIZES = [16,18,20,22,24,28]` 是六档，插件是五档
（`READER_SCALES = [16,20,24,28,32]`）。字号是已发布的行为，不为对齐帧而改；帧里的「字号 +/−」
交互照搬，档位数字仍来自 `readerType`。

## 3. 令牌映射

设计稿的 `@theme` 是暖纸色系，宿主是冷色系且明暗可切。两者不能并存，只能把设计稿的**层级**
映射到宿主的**语义令牌**上（ADR 0006：插件不持有一份自己的色板）：

| 设计稿 | 宿主令牌 | 用途 |
| --- | --- | --- |
| `canvas` | `background` | 面板底 |
| `surface` / `card` | `card` | 浮纸、卡片 |
| `inset` | `muted`（`bg-muted/30`–`/60`） | 槽、说明条、看板底 |
| `ink` | `foreground` | 正文 |
| `muted` | `muted-foreground` | 次要文字 |
| `faint` | `muted-foreground/60` | 极弱文字、刻度 |
| `line-soft` | `border-border/40` | 分隔线 |
| `line` | `border-border/60` | 卡片描边 |
| `line-strong` | `border-border` | 强描边 |
| `accent`（朱砂） | **`primary`** | 品牌强调、当前态、主按钮 |
| `success` | 无 | 见 §7 |
| `warning` | 无 | 见 §7 |
| `danger` | `destructive` | 破坏、逾期、阻断 |

**`accent` 与 `primary` 不是同义词。** 宿主实测 `--accent` 是 `rgb(41,41,43)`——一个 hover 面，
`--primary` 才是 `rgb(99,102,241)` 的品牌色。既有组件里的 `bg-accent`（胶囊底、hover）保持不动，
这是对的；本轮新写的「当前章」「阶段徽章」「主按钮」一律用 `primary`，否则强调色会变成一片灰。

圆角也照设计稿的层级换算：tile `rounded-md`、control `rounded-lg`、card `rounded-xl`、
sheet `rounded-2xl`。

## 4. 阅读页

正文列从 `max-w-[800px]` 收到 `max-w-[672px]`：设计帧是 648px（在 1440 宽的窗口里居中），
标签页最宽 1000px 时 672 既不空旷也不贴边，仍满足 ADR 0024 §1 的「一行 40 字上下」。

顶栏增加了三样：**字族切换**（`font-serif` / 无衬线，会话内状态，不落盘）、**目录**
（`<details>` 弹出章列表，点章即翻）、以及把「第 N 章 · 标题」并到一行（长标题 `truncate`）。

设计稿把字号控件放在顶栏右侧，插件仍留在底栏的 `ReaderControls`：那是阅读时最常碰的控件，
底栏比顶栏更近拇指，也与已有的键盘路径一致。左右两处各有取舍，这里选底栏。

评审栏（`aside w-[300px]`）只在 `xl` 出现。窄面板里正文优先，评审的结论在书页的指令卡里也能看到；
`ScoreBar` 的及格刻度固定 72，与 `mahua_save_review` 的门槛同源。

## 5. 窄面板折行

设计帧的固定宽栏在插件里全部按容器宽度降级，规则统一：

- **先掉列，再掉行。** 书库台账的「章数 / 更新 / 字数 / 进度」四列分别按 `sm` / `sm` / `md` /
  `min-[520px]` 收起，书名与点击区永远在；俯到最窄时一行仍有「书名 + 阶段 + 已完稿」。
- **筛选列独立成栏的门槛是 880px。** 不到 880px 就堆到列表上方，用同一份 DOM，不做两套渲染。
- **书页右栏 340px 的门槛是 `xl`。** 不到 `xl` 时目录、账本入口、成员行落到左栏下方。
- **长文本一律 `min-w-0` + `truncate` 或 `[overflow-wrap:anywhere]`。** 书名、章标题、伏笔正文、
  裁定问题都可能是长句，容器不允许被内容撑破。
- **显隐与布局写在同一个变体前缀下。** `hidden` 与 `min-[520px]:flex` 加 `flex-col` 混在同一
  className 里时，Tailwind 的输出顺序不可控（`block` 可能压过 `flex`），所以进度单元格写成
  `hidden min-[520px]:flex min-[520px]:flex-col`，而不是 `hidden … min-[520px]:block flex-col`。

## 6. 伏笔账本的数据来源

台账页要的四样东西（台账、体检、决策日志、一致性）此前只有三样有读接口，`decisions` 只有写。

**补一个只读方法 `StudioService.decisions(bookId?)`。** `ManuscriptRepository.readDecisions()` 返回
**原始 JSONL 行**（`string[]`），追加式语义留在仓储层；解码放在应用层，逐行 `JSON.parse`、
校验 `scenario` 是字符串、坏行跳过——一行写坏不该让整份日志打不开，也不能让已经作数的裁定消失。
读操作不进 `requireEntitlement`：门禁只拦写（ADR 0004）。

**`useThreadLedger(bookId)` 一次并发取四份只读数据**（`threads` / `checkThreads` / `decisions` /
`checkConsistency`）。**「算不算逾期」只由 `checkThreads` 的 findings 决定**
（`code === "thread.overdue"` → `detail.threadId`），视图不自己比章号。界面与 `mahua_check_threads`
必须同答，否则作者在页面上看到「逾期」、模型看到干净，两边就开始互相打脸。

台账页**没有任何写操作**。记伏笔、收伏笔、裁定都是模型的工具，人在这里是审阅者；页面上放一颗
「收一笔」按钮，它也不知道该填哪一章。

## 7. 没有 success / warning 令牌时的降级

宿主只有 `primary` / `destructive` / `muted` 三级语义，没有绿与橙。设计稿里「已提交 = 绿」「逾期 = 红」
「已回收 = 绿」三处颜色断言因此降级为层次：

- 已提交 / 已回收 → `primary` 实底或 `primary/80`、`primary/15` 的 tonal；
- 在写 → `primary` 实心点 + 外圈 `ring-primary/25`；
- 计划中 → `border border-border` 空心；
- 逾期 / 阻断 / 体检问题 → `destructive`（`/10` 底 + 正文色）。

不引入 `chart-1`（琥珀）当 warning：它是图表色，用在正文里与主色不成体系。

## 8. 验收方式

`npm run check`（`tsc --noEmit`）、`npm test`（12 文件 182 例）、`npm run build`、
`node scripts/marketplace.mjs check`、`node --test tests/*.test.mjs` 全部通过。

**没有做应用内视觉验证。** `vitest.config.ts` 是 `environment: "node"` 且没有组件测试，注释写明了
原因（happy-dom 会改写 `import.meta.url`，让守卫测试读不到源码文件）；加 jsdom / testing-library
需要联网装依赖。所以这一轮的验证边界是「类型 + 纯函数 + 构建 + 守卫」，不是「像素」。首次在
Desktop 里打开标签页时仍需要人工看一眼：文字有没有溢出、四个断点有没有掉错列。

## 9. 后果

- 界面骨架（`PageBar` / `Panel` / 徽章 / 计量条）此后由共享组件统一，页面之间不再各写一套表头。
- `LibraryCard.tsx` 删除：书库改成纯文本台账，封面只在书架主卡保留（`BookCover variant="headline"`）。
- 新增文案 54 键 ×2（`ledger.*`、`dimension.*`、`reader.family/serif/sans/review/mustFix/book`、
  `library.column.*`、`book.activity*`、`book.arc*`、`book.ledger*`、`shelf.openBook`、`strip.now`）。
- 版本 0.4.1。设计稿留在 `ui-mock/`，不参与构建，也不作为插件运行时资源。

> 0.4.2 修正：书页目录曾同时有 `Panel` 表头与 `ChapterIndex` 自带的「目录 + 章数」表头，
> 叠成两层。现去掉 `Panel` 的 `title` / `meta`，只保留目录自己的表头。面板不带标题行时
> `Panel` 只画边框，所以这次修正不引入新的形状。
