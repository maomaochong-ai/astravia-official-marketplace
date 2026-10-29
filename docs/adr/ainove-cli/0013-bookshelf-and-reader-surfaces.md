# ADR 0013：工作台改成「书架 → 书页 → 阅读页」三层导航——信息架构对齐番茄小说

- 状态：已接受（2026-10-29，随 0.0.1）
- 决策对象：`registerWorkspaceView` 注册的侧栏视图（`src/features/studio/components/StudioWorkspaceView.tsx` 及其子组件）
- 取代：ADR 0011 §2.2 的「一屏到底的工作台解剖」（0011 的三层语法、成员胶囊、指令卡仍有效）
- 相关：ADR 0003（视图是主界面）、ADR 0006（只用宿主语义 token）、ADR 0011（界面三层同构）

## 1. 背景

ADR 0011 把工作台做成了「一屏到底」的仪表盘：书头、成员胶囊、指令卡、章板、右栏正文全部同时在场。
它解决了「像宿主团队面板」，但没有解决**读**：作者写完一章，想看上一章、想翻目录、想连着读三章，
在一屏三栏里做不到——章板是任务队列，不是目录；右栏 24rem 宽，读不了正文。

用户提出的对照物是番茄小说的网页端：**书架（封面网格）→ 书页（封面 + 章节目录）→ 阅读页（正文 + 上/下一章）**。
本轮对其实际观测如下（`curl` 取到的服务端 HTML，非推测）：

| 观测 | 证据（真实 class / 文字） | 我们取什么 |
| --- | --- | --- |
| 首页是封面网格 | `muye-book-cover` / `book-cover-img` / `book-text`（内含 `title`、`author`）、`muye-tab-item`（男/女频分区） | 书架 = 封面网格 + 分区 |
| 首页还有「最近更新」行表 | `update-item`、`update-item-chapter`、`chapter-name`、`author-name` | 书架顶部保留「最近更新」行表 |
| 书页 = 封面 + 元信息 + 主按钮 + 目录 | `page-header` > `book-cover`、`info-name`、`info-label`、`info-count-word`、`info-last`、`byte-btn byte-btn-primary`（「开始阅读」）、`author`；目录为 352 个 `chapter-item` / `chapter-item-title` / `chapter-item-lock` | 书页 = 封面 + 书名 + 阶段 + 进度 + 「继续阅读」+ 目录 |
| 阅读页 = 顶部书名导航 + 章节头 + 段落正文 | `muye-reader` > `muye-reader-nav`（返回图标 + `muye-reader-nav-title` 书名）> `muye-reader-box` > `muye-reader-box-header`（`muye-reader-title` = 章名，`muye-reader-subtitle` 内 `desc-item` = 「本章字数：2047字」「更新时间：刚刚」）> `muye-reader-content`（一段一个 `<p>`） | 阅读页 = 书名导航 + 章标题 + 字数/更新时间 + 一段一 `<p>` |
| 阅读页底部有翻页按钮 | `muye-reader-btns` + `byte-btn`「上一章」 | 阅读页底部「上一章 / 下一章」 |
| 阅读器工具栏有四项：加书架、目录、夜间、字号 | `reader-toolbar-item` ×4（文字分别为「加书架」「目录」「夜间」「字号」）；字号是滑杆，档位标示 `16 / 20 / 24 / 28 / 32` | 只取「字号」；其余见 §2.5 |
| 正文容器宽度与字号由类名控制 | `muye-reader-content-16`，字号档同时改行高 | 字号档用宿主尺度类，五档 |

## 2. 决策

### 2.1 视图内部三层导航，不进 URL、不进存储

```
surface = shelf ──openBook(id)──▶ book(bookId) ──openChapter(id, n)──▶ reader(bookId, n)
              ◀──backToShelf──┘            ◀──backToBook──┘
```

- 路由是**视图内 state**（`use-library-route.ts`），不写宿主路由、不写 `storage`：
  宿主没有「视图 A 跳到视图 B」的 API，写存储只会让侧栏位置随上次阅读漂移。
- 三层共用同一个 `useStudioState()`：架子读 `books`，书页读 `book`，阅读页读 `chapterText` + `review`。
  **不新增第二条读路径**（ADR 0005 的账本仍是唯一事实源）。
- 每次进阅读页先 `selectBook` 再 `selectChapter`（前者会把章序清空），顺序写死在视图里，避免读到上一本的书。

### 2.2 书架：封面网格 + 最近更新

- 网格用 `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`，断点跟内容宽度走，不跟窗口走。
- **封面没有图片**，做排版型封面（`BookCover.tsx`）：书名首字作大字、题材一行、底部一条进度。
  这是对「没有封面资源」的诚实处理——不伪造插画，不放占位灰块。
- 封面用到的颜色全部是宿主语义 token（`bg-accent` / `bg-muted` / `border-border` / `text-foreground`），
  明暗随宿主翻转（ADR 0006）。
- 「最近更新」取 `updatedAt` 最新的 5 部，点击直达阅读页的**当前章**。

### 2.3 书页：先能读，再能写

自上而下：返回条 → 封面 + 书名 + 阶段徽章 + 进度 + 「继续阅读」主按钮 → 成员胶囊条 + 凭证胶囊 →
指令卡（`InstructionCard`，原样复用）→ 目录（`ChapterIndex`）。

- 「继续阅读」的目标是 `progress.currentChapter`：它不是「最后一章」，而是**下一件要做的事**所在的章。
- 目录一行一章：章号、章名、字数、状态药丸（`StatusPill`）。点行 = 进阅读页。
- 目录与指令卡**并列而不是互斥**：作者读一章的原因常常是核对评审判定，所以指令卡留在书页上方，
  阅读页只留正文与评审。

### 2.4 阅读页：番茄的解剖，宿主的骨架

| 位置 | 内容 | 对应番茄 |
| --- | --- | --- |
| 顶栏 | ← 返回目录 · 书名（`aria-label` 带书名） | `muye-reader-nav` |
| 章头 | `Chapter N` + 章名 + 「{{count}} 字」+「更新于 …」 | `muye-reader-box-header` |
| 正文 | 一段一个 `<p>`，行高放宽（`leading-7`），左右留白 `mx-auto max-w-2xl` | `muye-reader-content` |
| 评审块 | 有评审才显示：总分 + 必改项（复用现有文案） | 番茄没有，属我们自己的信息 |
| 底栏 | 上一章 · 字号五档 · 下一章 | `muye-reader-btns` + 字号滑杆 |

- 正文分割用 `/\r?\n+/`：中文小说一段一行，按空行分会把整章粘成一块。
- 翻页在章序边界禁用（第 1 章没有「上一章」，最后一章没有「下一章」），**不做循环**。
- 字数与更新时间读 `chapter.words` / `chapter.updatedAt`，不由界面重算。

### 2.5 只复刻「字号」，不复刻夜间、加书架、VIP 锁

| 番茄控件 | 我们的处理 | 理由 |
| --- | --- | --- |
| 夜间 | **不做** | 明暗由宿主主题决定，插件自己再切一次会与宿主打架（ADR 0006） |
| 加书架 | **不做** | 书一旦创建就在架子上，没有「未收藏」态 |
| 目录（抽屉） | **改成页内切换** | 面板槽禁止 `fixed` / portal（`docs/plugin-project-structure.md`） |
| 字号 | **做** | 纯尺度，不影响颜色与布局契约 |
| 扫码下载 App / VIP 解锁 | **不做** | 商业形态不同 |

字号五档取 `text-sm / text-base / text-lg / text-xl / text-2xl`，默认第三档（`text-lg`），
状态存在视图内（不持久化；跨会话记忆需要一个存储键，本轮不做，见 §4）。

### 2.6 组件职责（文件名即职责）

```
src/features/library/
  bookshelf-model.ts               纯函数：排序、分组、封面首字、字号档位
  hooks/use-library-route.ts       三层路由状态机
  components/LibraryShelf.tsx      书架（网格 + 最近更新）
  components/BookCover.tsx         排版型封面
  components/BookDetail.tsx        书页（封面 + 元信息 + 成员 + 指令 + 目录）
  components/ChapterIndex.tsx      目录列表
  components/ReaderPane.tsx        阅读页（顶栏 + 章头 + 正文 + 评审 + 底栏）
  components/ReaderControls.tsx    上一章 / 字号 / 下一章
```

`StudioWorkspaceView.tsx` 退化成**路由壳**：凭证判断 → 三层分派。原 `BookRail` / `ChapterBoard` /
`ChapterReader` 删除——书架取代左栏、目录取代章板、阅读页取代右栏，留着就是三份真相。

## 3. 后果

- 一屏三栏的任务仪表盘没了：**写**的入口从「章板 + 指令卡」变成「书页的指令卡」，少一次扫视。
  这是自觉的取舍——0.0.1 的目标是「写得出来也读得下去」，不是控制台。
- 阅读页占满整块视图，`overflow` 只在这一层出现：正文区 `flex-1 overflow-y-auto`，顶栏与底栏固定高度不滚。
- 目录一次渲染全量章（上限 500），不做虚拟滚动：500 个按钮在桌面端可接受，先简单。
- 字号档只在当前会话有效；重开宿主回到默认档。

## 4. 不做什么（明确留白）

1. **阅读位置持久化**（章内滚动、上次读到的章）：需要新增存储键与写路径，本轮不做。
2. **章内搜索、书签、划线笔记**：与「写作」无关，属阅读器产品范围。
3. **封面美术**：没有官方封面资源，不生成、不占位，只用排版封面。
4. **书籍分区（连载中 / 已完结 / 弃稿）的显式状态**：现有 `phase` 足够，不新增字段。
