# 0024 — 界面第三轮：番茄阅读/书库保真、默认封面换成公有领域墨迹、激活页说清「现在用的是谁的凭证」

- 状态：已接受（2026-10-30）
- 相关：ADR 0004（离线门禁）、ADR 0006（只用宿主语义令牌）、ADR 0013（书架/阅读三层）、
  ADR 0016（空架与字号）、ADR 0020（书库与默认封面，本 ADR 取代其 §3/§4 的具体做法）

## 背景

上一轮把书架、书库、阅读页、激活页做出来了，但都停在「能看」：字号五档写在类名里没法按档给
行高与缩进，书库卡片是有边框的小盒子、封面只有排版母题，激活页在凭证坏掉时静默回退到社区凭证。
这一轮按六条具体问题收口：

1. 智能体团队卡片把 `{count}` 原样打印出来；
2. 书架默认封面「很低级」；
3. 阅读面板字体与标题排版不协调；
4. 书库卡片设计不协调；
5. 「激活工作室」不可用；
6. 新建作品界面不协调。

## 实测

### 阅读页（`https://fanqienovel.com/reader/7665231561104556569`，obs）

外链 CSS 里五档字号各自带一套排版，单位是 `rem`，按「正文 1.8rem = 18px」反推基准 `1rem = 10px`：

| 档 | 标题 / 行高 / 下距 | 副标题 / 行高 / 下距 | 正文 / 缩进 / 行高 / 段间 |
| --- | --- | --- | --- |
| 16 | 18 / 27 / 8 | 12 / 18 / 36 | 16 / 32 / 32 / 16 |
| 20 | 22 / 33 / 10 | 14 / 21 / 44 | 20 / 40 / 39 / 18 |
| 24 | 26 / 39 / 12 | 16 / 24 / 56 | 24 / 48 / 45.6 / 20 |
| 28 | 30 / 45 / 14 | 18 / 27 / 60 | 28 / 56 / 51.8 / 22 |
| 32 | 34 / 51 / 16 | 20 / 30 / 72 | 32 / 64 / 57.6 / 24 |

`.muye-reader-content-*` 三条固定规则：`word-break:break-word`、`text-align:justify`、`line-break:anywhere`。

### 书库页（`https://fanqienovel.com/library?enter_from=menu`，obs）

`lib.css`：`.stack-book-item{width:328px}`、`.book-item-cover{float:left;width:100px;height:130px}`、
`.book-item-text{margin-left:120px;font-size:12px;line-height:17px}`、
`.book-item-title{font-size:18px;line-height:25px;font-weight:500}`、`:hover{color:#fa6725}`、
`.book-item-desc{color:rgba(0,0,0,.4);margin-top:5px}`、`.book-item-footer{position:absolute;bottom:0}`。
卡片**没有**边框、圆角与底色——它是「封面浮左 + 文字块缩进」的自由长条。

### 封面素材（obs）

| 图源 | 结果 |
| --- | --- |
| `commons.wikimedia.org` / `upload.wikimedia.org` / `zh.wikipedia.org` | `000`（连不上） |
| `api.openverse.org` | `000` |
| `collectionapi.metmuseum.org` | `410` |
| `www.metmuseum.org/api/collection/v1/search` | `429` |
| `api.artic.edu` | `403`（Cloudflare 拦截） |
| `openaccess-api.clevelandart.org` | **`200`，CC0** |

CMA 的 `?ids=` 参数会被忽略（返回无关欧美藏品），必须 `?accession_number=X&cc0=1&has_image=1` 逐件取；
`_print.jpg` 全部 `404`，只有 `_web.jpg` 可用。

### 激活链路（源码实读）

- `default-credential.ts:11` 随包社区凭证：`plan: "community"`、`entitlements: ["export","studio"]`、
  `expiresAt: 2029-12-31`、`subject: "novelwright-community"`（旧名，见「不做」）；
- `entitlement-gate.ts:load()`：先验 stored，失败则回落社区凭证；
- `verify-entitlement.ts`：只查 `entitlements` 是否含 `studio`，无 plan 等级、无配额、无座位、无联网。

即：**它是分发层的礼貌性门禁，不是付费墙**。随包凭证对所有人相同、明文可解码复用，
这一点无法靠客户端修掉——离线验签能证明「由我方私钥签发」，不能证明「持有人就是购买者」。

## 决策

### 1. `{count}` 是传参名错配，修调用点

宿主插值本身正常（同一份 locales 里 `shelf.count` 能渲染出「2 部作品」）。
`StatusToolRow.tsx:69` 传的是 `{ words: … }`，而 `board.words` 的占位符是 `{{count}}`。
改调用点，不动 locales——`board.words` 的键名是对的，别的调用点也这么用。

同时写了一个「`t()` 调用点 vs locales 占位符」的比对脚本做全量审计，9 处差异逐条复核后
只有这一处是真缺陷，其余 8 处是脚本的正则局限（多行传参被 `[^}]*` 截断、简写 `{ chapter }` 识别不到）。
脚本只作提醒，判定仍靠人工看真实调用行。

### 2. 字号档改成数据表 + 内联样式

五档映射没法用 Tailwind 任意值表达（一档十个数字、彼此还有比例关系），所以：

- `bookshelf-model.ts` 导出 `READER_SCALES = [16,20,24,28,32]`、`DEFAULT_READER_SCALE = 0`、
  `READER_TYPE: Record<ReaderScale, ReaderType>`（`body/bodyLine/bodyIndent/bodyGap/title/…` 十个字段）、
  `readerType(index)`（夹紧 0..4）；
- 组件用 `style={{ fontSize, lineHeight, textIndent, marginBottom }}` 消费它；
  **颜色仍只用宿主令牌**，不出现 `#hex`（ADR 0006）。

默认档从 24px 改成 16px：那是番茄自己的默认值，而宿主侧栏只有 360–480px 宽，24px 一行放不下几个字。

### 3. 阅读面板按「一张纸」重排

顶栏只留返回与章号（`bg-background`），正文区 `bg-muted/30` 打底，中间一张
`max-w-[800px] bg-card` 的纸：`h1` + 元信息行 + 评审块（`border-l` 引文式）+ 逐段缩进的正文列。
`text-justify` 与 `[word-break:break-word]` 复刻番茄；段与段之间靠 `marginBottom` 而不是空行。

评审块在没有 `mustFix` 时显式渲染 `reader.noMustFix`，不留一块空白。

### 4. 书库卡片去掉盒子，改成自由长条

- `LibraryCard.tsx`：`group flex w-full items-start gap-5 text-left`，无边框无底色；
  标题 18/25/500 单行截断、hover 变 `text-primary`；元信息与简介 12/17、简介两行截断；
  页脚 `mt-auto` 贴底放日期与 `h-0.5` 进度条；
- `BookCover` 新增 `list` 档：封面 `100×130`（10:13），圆角保留；
- 栅格 `grid-cols-1 / sm:grid-cols-2 / min-[1180px]:grid-cols-3`，横 36px、纵 32px。
  番茄是一行三张 328px 卡，宿主面板放不下，只保留它的比例与节奏；
- 筛选行只调间距（`gap-3` / `mt-1` / `gap-1.5`）：番茄的筛选 UI 由 `byte-*` 组件库渲染，
  类名不含 `filter`，取不到可用数值，不硬编。

### 5. 默认封面换成公有领域墨迹底版

`covers.generated.ts` 内联 6 张 CMA CC0 水墨山水（240×312、JPEG q55、base64，共 168KB 模块），
`DefaultCover` 的渲染链是：`grayscale` → `mixBlendMode: multiply` → 叠在 `accent` 底上，
再压一层 `from-accent/70 via-transparent to-accent/55` 遮罩。于是任何主题下封面只剩
「主色 + 墨迹」两色，不会与界面打架，也不引入第二种强调色。

`coverVariant(id)` 从 `motif/layer` 改成 `plate/layer`：`plate = hash % 6`，`layer = (hash / 6) % 3`
决定透明度 `0.55 / 0.7 / 0.85`。哈希模数提到 `1_000_000`，两个维度互相独立。

**为什么内联 base64**：`plugin.json#entry` 是 `dist/mf-manifest.json`，Module Federation 下额外 emit
的图片路径可能解析失败；封面是 240px 的装饰图，不值得为它增加一条资源解析路径。

### 6. 激活页说清「现在用的是谁的凭证」

门禁加两个只读事实：

- `credentialSource: "stored" | "bundled" | "none"`；
- `rejectedStored: EntitlementState | null`——用户那份被拒时的验签结果（`expired` / `invalid` + reason）。

`load()` 的回落顺序不变，但回落时**记住原因**；`activate()` 失败时也记下（不落盘）。
视图侧：

- 激活面板显示凭证事实（主体 / 计划 / 权益 / 到期 / 密钥编号），已激活时不再只写一句「已激活」；
- `source === "bundled"` 且存在被拒记录时，面板给一条「你提供的那份没有被采用 + 原因」，
  工作台顶部也给一条常驻提示；
- 新增 `clearStored()` / `StudioService.clearCredential()`：用户可以主动丢掉自己那份、回到社区凭证。
  凭证写操作仍然只走服务层（与 `activate` 同一条规矩）。

这条修的是**真缺陷**：以前 stored 凭证过期或损坏时，界面显示「已激活」，
用户没有任何线索知道生效的是社区凭证而不是自己买的那份。

### 7. 新建作品表单改成一页纸

去掉 `border` 卡片盒，改成分节留白：标题 + 一句说明、书名（唯一的大输入）、题材、一句话前提、
目标章数（`60 / 120 / 200` 三个芯片 + 仍可手填的数字框）、整宽主按钮。
字段标签与输入间距统一 `gap-6`，输入圆角与边框降至 `border-border/70`，聚焦才出现 ring。

## 不做

- **不改社区凭证的 `subject`**：`novelwright-community` 是已签名的 claims，改名要重新签名，
  而签名私钥不在仓库里（`trusted-keys.ts` 只有公钥）。留在 wire 数据里，作为可解释的历史。
- **不做服务端签发 / 座位绑定**：离线验签给不了这两件事。要真做付费墙，必须引入发证服务、
  短有效期与在线校验，那是产品决定，不是这轮的界面收口。
- **不为封面引入网络请求**：离线可用是插件的底线，底版必须随包。
- **不照抄番茄的站点框架**：导航锚点、logo、帮助中心、页脚、版权提示一律不做（ADR 0020 §5 仍成立）。

## 后果

- 阅读页的五个档位是纯数据，`test/bookshelf.test.ts` 断言档位表与默认值；
- 封面变体是纯函数，`test/library.test.ts` 断言 plate 覆盖 0..5、layer 在 0..2、同 id 稳定；
- 门禁新增三条回归：拒收时记录原因、stored 被弃用时来源是 `bundled`、`clearStored()` 之后回到 `bundled` 且存储为空；
- 6 张底版的来源与许可记在 `agent/references/ATTRIBUTION.md`（馆藏号 + 标题 + 年代 + CC0）；
- 激活页现在会暴露 subject/plan/expiresAt，等于把「人人相同、2029 年到期」这件事摆在台面上。
  这是刻意的：诚实说明能力边界，比留一句「已激活」更接近真实。
