# ADR 0016：空书架与阅读字号再对齐——空态三段式、字号改真像素

- 状态：已接受（2026-10-29，随 0.1.0）
- 决策对象：`src/features/library/components/LibraryShelf.tsx`、`ReaderPane.tsx`、
  `src/features/library/bookshelf-model.ts`
- 取代：ADR 0013 §2.5 末段（"字号五档取 `text-sm / text-base / text-lg / text-xl / text-2xl`"）
- 修订：ADR 0013 §2.2（书架的网格与封面决策不变，空态另行处理）
- 相关：ADR 0003（不重复画页头）、ADR 0006（只用宿主语义 token）、ADR 0011（视图内无输入框）

## 1. 背景

ADR 0013 的实测样本是**已登录**的首页与书页，空书架的样子没被观测，所以 0.0.1 的空态
是自己拍的板：把 89 行的新建表单直接铺在空架子上。

本轮按用户要求重新观测 `https://fanqienovel.com/bookshelf?enter_from=menu` 的**未登录**态
（`curl` 取到的服务端 HTML 与 CSS，不是推测），拿到两块此前没有的事实：页头结构与空态结构。

### 1.1 观测（未登录）

| 位置 | 观测到的真实结构 |
| --- | --- |
| 页头 | `.muye-header` > `.muye-header-content` > `.muye-header-logo`（svg）+ 6 个 `.nav-item`（首页 / 书库 / 书架 / 原创榜 / 作家专区 / 版权专区，每项后跟 `.nav-item-bar`，书架项带 `nav-item_active`） |
| 页头右 | `.muye-header-search`（`<input placeholder="请输入书名或作者名">` + `.search-icon`）· `.serial-divider.byte-divider.byte-divider-vertical` · `.slogin-user-avatar__buttons__item` ×2（登录 / 注册） |
| 页面容器 | `.muye.muye-bookshelf`（`background:#f6f6f6`）> `.muye-bookshelf-home-page`（`width:1224px; margin:0 auto; padding-top:95px; min-height:calc(100vh - 66px)`） |
| 空态 | `.book-shelf-empty`（`position:absolute; top:50%; left:50%; width:335px; height:236px; transform:translate(-50%,-50%); text-align:center`）> `.book-shelf-empty-image`（`padding:10px 0`，内嵌 lottie 动画 `role="button" aria-label="animation"`）+ `.book-shelf-empty-text`（`font-size:14px; line-height:22px; color:rgba(0,0,0,.4); margin-top:8px`，文案「登录账号，同步在读书籍」）+ 主按钮（`byte-btn byte-btn-primary byte-btn-size-large byte-btn-shape-square`，文案「登录番茄账号」），按钮 `margin-top:24px` |
| 样式表里存在但未渲染 | `bookshelf-tabs`、`bookshelf-list` —— 在懒加载 chunk 里，未登录态 DOM 中没有对应节点 |

`.muye-header` 在抓到的 `fq_shelf.css` 里 0 条规则，页头样式在另一份 chunk；
继续追它没有收益，见 §2.3。

### 1.2 代码与记录不一致

`bookshelf-model.ts` 的注释声称五档"对应番茄的 16 / 20 / 24 / 28 / 32"，实际取的是 Tailwind
尺度 `text-sm / text-base / text-lg / text-xl / text-2xl`，即 **14 / 16 / 18 / 20 / 24 px**。
两句话不能同时成立：注释错，或者实现错。按 ADR 0013 记录的番茄实测值，错的是实现。

## 2. 决策

### 2.1 空态改成三段式，不铺表单

```
              书架还是空的               ← 一行标题，text-foreground
      开一本新书，剩下的交给工作室。      ← 一行说明，text-muted-foreground，居中
              [ 新建作品 ]                 ← 唯一主按钮，点击就地展开表单
```

- 结构对位番茄：`.book-shelf-empty` 的**居中紧凑块 + 一行说明 + 一个主按钮**，
  三行文字替掉它原本的「插画 / 文案 / 按钮」三段。
- 尺寸关系沿用"块宽约 335px、文案 14px/22px、按钮上留 24"的节奏，在宿主里用
  `max-w-xs`（320px，最贴近 335）+ 垂直间距 + `mt-5` 表达，不写死宽度像素。
- 番茄的第一段是 lottie 插画，我们**不放图**：ADR 0006 不允许伪造美术，ADR 0013 §2.2 已定
  封面走排版型。该位置换成一行标题——空态需要的是"这里是什么"，不是装饰。
- 主按钮文案是**新建作品**，不是「登录番茄账号」：本插件没有账号体系（ADR 0004 的凭证
  管的是授权，不是登录身份），空态里唯一能做的事是开一本新书。
- 表单不再常驻：点击主按钮 → `composing = true` → 就地展开 `NewBookForm`（复用非空态
  已有的同一套状态），取消即收起。空态与有书态因此共用一条新建路径。

### 2.2 字号改真像素，行高按比例

| 档 | 类名 | 实际值 |
| --- | --- | --- |
| 1 | `text-[16px]` | 16px |
| 2 | `text-[20px]` | 20px |
| 3（默认） | `text-[24px]` | 24px |
| 4 | `text-[28px]` | 28px |
| 5 | `text-[32px]` | 32px |

- 数值取番茄字号滑杆的档位标示 `16 / 20 / 24 / 28 / 32`（ADR 0013 §1 已记录）。
- 行高从固定的 `leading-7` 改成相对的 `leading-[1.9]`：中文长文在 32px 时若仍用 28px 行距，
  字会挤在一起。相对行高让五档等比放大。
- 32px 是最大档，块宽仍是 `max-w-2xl`（42rem ≈ 672px），一行约 21 个汉字，符合中文阅读舒适区。
- 字号仍然是**视图内状态**，不持久化（ADR 0013 §4.1 的理由不变：跨会话要新增存储键）。

### 2.3 页头一律不复刻

番茄页头的 logo、六个导航项、搜索框、登录注册按钮，**全部不做**：

- 侧栏视图已经有宿主给的标题与返回位，插件再画一遍页头就是两套 chrome（ADR 0003）；
- 导航项对应的是番茄自己的信息架构（书库 / 原创榜 / 作家专区），本插件只有一本书的世界；
- 搜索框违反"视图内无输入框"（ADR 0011）：书架规模是个位数，靠扫视即可。

只取它**排布的节奏**：内容区居中、顶部留白、背景用 `bg-muted` 一级而非纯白。

### 2.4 不做分区 tab

`bookshelf-tabs`（男频 / 女频）在番茄是频道分类。本插件没有频道概念，`phase`
（briefing / planning / drafting / arc_close / completed）已经表达"写到哪了"，
再叠一层分区只会让同一本书出现在两个 tab 里（ADR 0013 §4.4 不变）。

## 3. 后果

- 空架从"一屏表单"变成"三个元素"：新用户第一次进视图看到的是一个按钮，不是十几个字段。
  代价是多一次点击才能开书——这个交换是划算的，字段在开书前也不该出现。
- 字号最大档从 24px 提到 32px，`ReaderControls` 的档位指示逻辑不变（它读 `READER_SCALES.length`）。
- `bookshelf-model.ts` 的注释改成"对应番茄字号滑杆档位 16/20/24/28/32"，不再声称是宿主尺度。
- 空态换文案后 `studio.empty.title` / `studio.empty.body` 失去引用，两个语言包里一并删掉；
  空态改用 `shelf.emptyTitle` / `shelf.emptyBody`，与书架其它 key 归在同一前缀下。
- 阅读页正文的 `leading-7` 消失，改为相对行高，`ReaderPane` 里不再有固定行距假设。

## 4. 不做什么

1. **不做登录**：用户本轮明确"先不做登录功能"。番茄空态的主按钮是登录入口，我们换成新建作品；
   凭证激活仍在设置视图，不进书架。
2. **不做空态插画 / lottie**：ADR 0006 的"不伪造美术"，以及插件包体积约束。
3. **不做书架搜索、排序切换、批量选择**：书架是单作者的书目，条目数是个位数。
4. **不做阅读位置持久化**：同 ADR 0013 §4.1。

## 5. 线上实测（未登录可见部分）

本轮用 ego-browser 打开 `https://fanqienovel.com/bookshelf?enter_from=menu`，未登录状态下可见两块：
顶部 6 个导航锚点（首页 / 书库 / 书架 / 原创榜 / 作家专区 / 版权专区）加一个搜索框，
下方是 `.bookshelf-list` 网格（匼名态只有 2 张卡）与一句“因版权问题，以下书籍暂不支持浏览器阅读”。

实测度量（观察所得，非推断）：

| 位置 | 值 |
| --- | --- |
| 列表 | `display: grid`，4 列，`gap: 10px`，容器宽 1194px |
| 卡片 | 299×295px |
| 封面 | 120×160px（**3:4**），`border-radius: 0`，无阴影 |
| 书名 | 18px / 字重 500 / 黑色 / 行高 26px |
| 进度文字 | 14px / `rgba(0,0,0,0.4)`（即 40% 黑） |
| 页面底色 | `rgb(246,246,246)` |

对照现有实现，落地结论：

1. **封面比例已经对上**：`BookCover` 的 `grid` 变体就是 `aspect-[3/4] w-full`，与实测的 120×160 同比例。不改。
2. **进度文字的层级对上了**：实测的 40% 黑就是配色里的 `muted-foreground`，不需要新颜色。
3. **网格间距 `gap-3`（12px）→ `gap-2.5`（10px）**：对齐实测值，不引入新的视觉语言。
4. **书名不跟到 18px**：侧边栏面板宽度只有番茄内容区的三分之一左右，18px 书名会跟 14px 的进度文字拉不开层次；
   插件继续用 `text-sm`（14px）/ 字重 500，保持“比正文重一档”的相对关系而不是绝对像素。
5. **不复制卡片外层宽度与页面底色**：299px 的留白与 `#f6f6f6` 底色都是整页布景，插件跑在宿主面板里，
   底色与卡片宽度由宿主语义令牌决定（ADR 0006）。
6. **不引入导航、搜索、“不支持浏览器阅读”提示**：前两项见 §4.1 与本轮不做范围；第三条属于番茄的版权策略，
   与插件的离线作品库无关。

