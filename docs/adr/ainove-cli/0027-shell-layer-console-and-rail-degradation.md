# ADR 0027：外壳层与运行台——按设计稿第二轮的六处落地决定

- 状态：已接受（2026-10-30）
- 决策对象：`abilities/plugins/mahua-writing-team/src/features/`（新增
  `shared/components/StudioChrome.tsx`、`studio/components/StudioRail.tsx`、
  `studio/components/ConsolePane.tsx`；重写 `library/components/{BookCover,LibraryShelf,BookDetail,ChapterIndex,LibraryCatalog,LibraryFilterRow,ReaderPane,ThreadLedger}.tsx`、
  `shared/components/PageBar.tsx`、`studio/components/{BookHead,StudioWorkspaceView}.tsx`）、
  `src/features/library/hooks/use-library-route.ts`、`locales/{en,zh}.json`（244 → 284 键）
- 依据：`ui-mock/mahua-novel-studio.astravia-design` 的 `theme.css` / `components/*` / `frames/*`
  逐帧实读；宿主 `.tooling/open-astravia/apps/desktop/src/renderer/styles.css` 令牌实测；
  `node_modules/@astravia-org/plugin-sdk/src/tailwind-theme.css` 的 24 个别名
- 延续：ADR 0006（只用宿主令牌）、0011（无输入框）、0016（阅读字号五档）、0020（窄面板折法）、
  0025（活动标签入口与其 §1 主/次按钮语义）、0026（第一轮重排与 §7 的 tonal 降级）

## 1. 运行台（`console`）只呈现落盘事实，不呈现运行时

设计稿的 `console` 帧是一块实时监控板：工具调用事件流、上下文占用百分比（「上下文 67%」）、
模型名（`mimo-v2.5-pro`）、编辑队列深度、「裁定者空闲」。这些数据**没有一项**能从标签页拿到：
宿主的 agent 运行时不在插件 API 里，队列与上下文占用只存在于会话进程内。

照抄这四块等于在界面里写死一组假数——它们会一直显示「67%」，永远不动，读者却会当真。
所以运行台改为三列，每列都用仓储里能查到的数据：

| 列 | 数据源 | 说明 |
| --- | --- | --- |
| 章节脊柱 | `book.chapters` | 逐章 `ChapterDot` + 章号 + 标题 + 字数，点一行读那一章 |
| 落盘时间线 | `book.checkpoints` | 时间、章号、`noteKey`（已翻译）、当时的阶段 |
| 概览 / 团队 / 最近评审 | `progress`、`STUDIO_MEMBERS`、`reviews/<n>.json` | 进度与总字数、四位的职责、七维分数 |

结论：**设计稿的字段名可以借，数据不能编**。这一页没有任何写操作，也没有输入框。

## 2. 左侧导航在 400px 面板里降级成图标栏

设计稿是 208px 固定栏 + 主纸区 + 右栏。标签页最窄只有 400px：拿掉 208px 后正文只剩 192px，
任何书页都读不下去。落地取两档：

- `<lg`：`w-11`（44px）图标栏，每颗按钮带 `title`，分组标题不占行；
- `≥lg`：`w-[188px]` 文字栏，含「在写的这本」卡片（`BookCover size="mini"` + `rail.now` + 3px 进度条）
  与底部凭证状态。

设计稿底部的「写作者 正在写 · 2m 14s」不复刻：插件拿不到团队计时。只留凭证状态——
它是能离线校验的真事实（ADR 0004）。

## 3. 封面：`DefaultCover` 降为底纹，不再承担识别

设计稿的 `Cover` 是「纸色 + 首字 + 底纹」，没有具象插画。而 `covers.generated.ts` 被
`library-model.ts` 与 `test/library.test.ts` 直接 import（`COVER_PLATES` / `coverVariant`），删不掉。

处理方式：`BookCover` 改为 `bg-muted` 纸底 + `DefaultCover` 以 `opacity-[0.18]` 作底纹 +
`coverMark(title)` 首字 + 可选 caption。旧的 `variant` / `progress` 两个 prop **已删除**，
尺寸改由 `size: "shelf" | "row" | "detail" | "mini" | "thumb"` 五档表达（对应设计稿五档）。
书的进度条从封面上移到卡片里——封面是识别物，不是仪表。

## 4. 台账列随宽度增开，书名与进度永不被收

设计稿书库是六列 `grid-cols-[1fr_86px_68px_88px_104px_108px]`。400px 里六列硬塞，
每列只剩三十几像素，书名被截成三个字。落地按容器宽度分三档：

| 宽度 | 列 |
| --- | --- |
| 基础 | 书名（含缩略封面）+ 进度 |
| `min-[620px]` | + 章数、更新日期 |
| `min-[880px]` | + 阶段、字数 |

页脚把「第几页 / 共几页」与每页容量（`LIBRARY_PAGE_SIZE`）写在一起；分页仍走 `goPage`，
筛选变化才 `page: 1`——否则翻页按钮点了等于没点（ADR 0020 §1 的回归修复）。

## 5. 阅读页：正文是一张浮在画布上的纸

`theme.css` 把正文列定义为 `surface` 抬在 `canvas` 上。落地为 `bg-muted/40` 画布内
`article max-w-[648px] rounded-[13px] border bg-card shadow-sm`，正文行高缩进仍来自
`readerType(scale)` 五档（ADR 0016 契约，`READER_SCALES = [16,20,24,28,32]` 未动）。
评审栏 318px 只在 `xl` 出现：窄面板里正文优先。

## 6. 伏笔账本：统计上提为四格，行在窄面板折成两行

设计稿 `ledger` 帧是「四格统计 + 左台账 + 右决策日志」。四格统计（总数 / 未结 / 逾期 / 未结率）
直接采用，因为它们全部来自 `audit`。台账行只在 `min-[760px]` 铺成
「正文 / 章 / 权重 / 状态」的多列，窄下来改回「正文 + 一行事实」——
章号与权重写在第二行，任何时候都不会被挤掉（ADR 0026 §6 的判断继续成立）。

## 7. 外壳：面包屑 + 主纸区，红绿灯不复刻

新增 `StudioChrome`（36px 面包屑条，`/` 分隔，末段加重）与主纸区
`rounded-[18px] border bg-background shadow-sm`；整页底色改为 `bg-muted/40`，
让「纸」浮起来。设计稿的 `WindowChrome` 三个红黄绿圆点**不复刻**：标签页没有窗口边框，
那是整窗截图的构图元素，不是应用控件。

## 8. 新增的 locale 键（40 个 × 2）

`rail.now` / `rail.credential`；`shelf.meta` / `shelf.nowWriting` / `shelf.progressTitle` /
`shelf.live` / `shelf.others` / `shelf.openConsole`；`book.brief*` 六个 + `book.legend*` 四个 +
`book.volume`；`console.*` 九个；`library.column.stage` / `library.hint` / `library.footer`；
`nav.works` / `nav.craft` / `nav.shelf` / `nav.library` / `nav.book` / `nav.reader` /
`nav.console` / `nav.ledger`。中英同步，键数各 284。

## 9. 未做的事（明确记录，不静默）

- `StudioStrip` 不复刻设计稿的「团队正在写 · 2m 14s」「编辑排队 · 裁定者空闲」——没有计时与队列数据；
- 运行台不做事件流、不做上下文占用百分比、不显示模型名——同上；
- 不做应用内视觉验证：本仓库的 `vitest.config.ts` 固定 `environment: "node"`，
  守卫测试依赖 `import.meta.url`，加 `jsdom`/`happy-dom` 会破坏它们。本轮验证为
  `tsc --noEmit` + 182 例单测 + `npm run build` + 市场 `check` + 仓库级 `tests/*.test.mjs`，
  真机观感仍需在桌面端手动确认。
- 设计稿目录本身不在版本库里（`git log -- ui-mock/mahua-novel-studio.astravia-design` 为空），
  本轮比对只能逐帧实读，无法给出 diff。
