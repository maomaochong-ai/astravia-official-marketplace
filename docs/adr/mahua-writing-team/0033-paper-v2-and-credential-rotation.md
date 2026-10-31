# 0033 · 纸面语言 v2：凹槽、语义类与间距节奏；凭证轮换到 `mahua-2026-01`

> 状态：现行。2026-11-01（0.4.23）。取代 [0029](0029-paper-language-no-hairlines.md) 的分隔手段部分，
> 修正 [0026](0026-design-round-five-surfaces-and-host-tokens.md) 的明度表（多了 `well` 与两道 `wash`），
> 并记录 [0020](0020-library-surface-and-default-cover.md) 里最后一批写死色号的退场。
> **被推翻的历史决定**：0029 §2「`border` 可以出现在表头、分隔线、输入框与一枚描边按钮上」——
> 现在页面里一条分隔线都不留，只剩空心圆点与输入框；0029 §3「卡片 = `raised` + 阴影」不回退，
> 但卡**内外**的分层改由凹槽（`well`）承担，不再靠"描边加一层"。

## 1. 问题：三种灰各自为政

上一轮（0032）把线条换成"卡 + 阴影"之后，页面里剩下三种"深色块"，它们来自三处不同决定：

- 书架的「现在在写」用 `bg-canvas`——那是**缝**的颜色（圆角外面那一圈），铺进卡里就是"卡片漏了底"；
- 流水块用 `bg-inset/70`——`inset` 本来是压下去的槽，压到 70% 不透明后坐在 `raised` 上，纸和槽糊在一起；
- hover 各写一套：`hover:bg-canvas` / `hover:bg-inset/60` / `hover:bg-raised/70`。同一个动作在三个页面里
  表现为三种颜色，因为每处都得为"底是什么"重新算一次。

结果就是用户说的"有的颜色太深，过渡不自然"：`canvas` 比卡深两档，一块 `bg-canvas` 铺进卡里，
等于在纸上挖了个洞。这不是配色审美问题，是**同一个角色被赋了几个值**。

## 2. 决定：多一对令牌，少一堆例外

`.mahua-root` 新增三个取值，全部从宿主 token 混出来（算式见 `current/09` 第一节）：

```css
--mahua-wash:        color-mix(in oklab, var(--foreground) 5%, transparent);
--mahua-wash-strong: color-mix(in oklab, var(--foreground) 9%, transparent);
--mahua-well:        light-dark(
  color-mix(in oklab, var(--card) 96%, var(--foreground)),
  color-mix(in oklab, var(--card) 96%, var(--background))
);
```

两条决定值得单独写下来：

**① `wash` 必须是半透明，`well` 必须是实色。** `wash` 是"同一枚 hover 落在任何底上都只加深一点"，
所以它叠前景；`well` 要盖住底下的分区与纹样，半透明会让下面的东西透上来变成两层——所以它混实色。
`--mahua-inset` 同时调浅（`card 93% + fg` / `card 84% + background`），它现在只留给骨架屏与徽记
这类"贴在纸上的一小块"，不再当页面凹槽用。

**② 一个 hover 词管所有底。** 因为 `wash` 是叠层，`hover:bg-wash` 在 `raised`、`surface`、
`well` 上都成立。旧写法里那批 `hover:bg-canvas` / `hover:bg-inset/60` 随之全删。

`@theme inline` 相应对齐：`--color-wash` / `--color-wash-strong` / `--color-well`。

## 3. 封面：最后一批写死的色号退场

`Cover.tsx` 的米色 hex 是 0020 留下的唯一例外。它在宿主 mono 主题里会"发黄、跟不动"，
与 0031 §6「取值全部从宿主派生」冲突。改成：

```css
--cover-bg:   color-mix(in oklab, var(--mahua-raised) 88%, var(--mahua-ink));
--cover-ink:  var(--mahua-ink);
--cover-band: color-mix(in oklab, var(--mahua-ink) 24%, var(--mahua-raised));
```

封面因此成了"纸上的纸"：比卡深一点、比墨浅很多，宿主主色变它跟着变。
守卫测试 `never hard-codes a colour` 现在对 `src/features/**` 全量生效，不再有豁免。

## 4. 间距节奏：一个角色一个数

同一批页面里页边出现过 `px-7 pb-5 pt-6` / `px-7 pb-6 pt-6` / `px-6 pb-5 pt-5` 三种，
容器之间出现过 `gap-4` / `gap-5` / `mt-4` / `mt-5`。差别只有 2–4px，但七页加起来就是
"每翻一页内容都跳一下"。

收敛成三个数，落在 `@layer components` 的三个语义类上：

| 类 | 取值 | 管什么 |
| --- | --- | --- |
| `.mahua-page` | `padding: var(--mahua-page-pad)`（20/24/20，窄容器 `16/16/12`） | 页面根 |
| `.mahua-card` | `background: raised` + `shadow-raise` + `rounded-sheet` | 纸面容器 |
| `.mahua-well` | `background: well` + `rounded-panel` | 卡内凹槽 |

页面里不再写 `px-7 pb-5 pt-6`；容器之间统一 `gap-3`（= `--mahua-gap`），卡内 `p-4`，
凹槽内 `px-3 py-2`。窄档由 `.mahua-page` 自带的容器查询接管，页面不必再各写一个
`@max-[720px]:px-4`。

三个语义类必须坐在 `@layer components`（不是 `utilities` 之下、`base` 之上）：页面上的
`p-4` / `mt-3` 要能修掉默认值。

## 5. 从凹槽里浮起来

凹槽（`bg-well`）里可点的东西只留两个状态词，这是本轮真正确立的一条：

- **选中** = `bg-raised shadow-raise`（从槽里真的抬起来，与卡同料）；
- **按下 / 激活** = `bg-wash-strong`。

书库页的筛选 chip 因此从"黑底反白"改成"抬起来"。理由：`bg-ink text-surface` 是主按钮的语义，
一页里出现四块黑块之后，"哪个是主操作"就没答案了。**黑色只留给主按钮**。
卡内 hover 一律 `bg-wash`；当前书写的那一本用 `bg-cinnabar-soft`（朱砂仍只给三件事，见 0029 §5）。

## 6. 图标只留一个族

`@iconify-json/solar` 早就在 `package.json` 里（`^1.2.2`），但界面是两族混用：
导航与主按钮是 solar，行内注记还是 lucide。同一枚按钮旁边两种笔画粗细，观感对不上。

全部改到 solar，字重按尺寸分档：**`size` ≥ 3.5、导航项与主按钮用 `-bold`；`size` ≤ 3 的行内注记用 `-linear`**。

Solar 的命名坑（本地一次性核对过 8859 个名字，未进 CI）：

| 想要 | 不存在 | 改用 |
| --- | --- | --- |
| 加号 | `plus-*` / `plus-circle-*` | `add-circle-linear` |
| 减号 | `minus-*` | `minus-circle-linear` |
| 左/右箭头 | `chevron-left|right` | `alt-arrow-left|right-*` |
| 书 | `book-open` | `notebook-*` / `book-2-*` |
| 活动流 | `activity` | `pulse-*` |
| 文稿 | `scroll` / `scroll-text` | `document-text-*` |
| 日历钟 | `calendar-clock-*` | `calendar-minimalistic-*` |
| 路由 | `wifi-router-*` | `wi-fi-router-*`（拼写是 `wi-fi`） |
| 斜上箭头 | `arrow-up-right` | `arrow-right-up-*` |

全屏键用对称的一对：`maximize-square-2-bold` / `minimize-square-2-bold`；返回键 `alt-arrow-left-bold`。

## 7. 凭证轮换：`nw-2026-01` → `mahua-2026-01`

激活页显示 `novelwright-community`，那是改名前产品的 subject。改表面是改文案，改真身是**换发凭证**：

- 新密钥对 `mahua-2026-01`，公钥 `GWOdQ1z48sKwhFcQXa6gP3fRcCrwRhlKkHgc1YjJXRo`；
- 新凭证 `keyId: mahua-2026-01` / `subject: mahua-community` / `plan: community` /
  `entitlements: ["export","studio"]` / 到 `2031-12-31`；
- `TRUSTED_KEYS` **保留**旧钥 `nw-2026-01`——用户机器上已经有旧 token，删锚点等于让他们的插件失效；
- 私钥只落 `release/signing-key-mahua-2026-01.txt`（gitignored，永不入库）；
- `canonicalClaims` 的键序不可变，签发脚本按字典序拼。

界面里 `claims.subject` 是直接渲染的（`ActivationPage`），所以换凭证是这件事唯一的正确修法——
改一行渲染文案只会让"界面写的"和"签名里写的"对不上。

## 8. 守卫测试

新增 `test/manifest-guards.test.ts` 里的 `one paper language across the workbench` 三条，
以及被改写的一条旧守卫：

| 断言 | 挡什么 |
| --- | --- |
| `spells every icon in the Solar family` | `src/**/*.tsx` 里不出现 `lucide--`，且每个 `icon-[…]` 匹配 `icon-[solar--<name>]` |
| `puts every page on the shared page and card shells` | `pages/*.tsx` 七页每页都带 `mahua-page` 与 `mahua-card` |
| `draws pages with containers instead of hairlines` | `pages/**` 里只剩 `border-line-strong`（空心圆点），`border-line` / `border-line-soft` / `divide-x|y` 全清 |
| `renders one sheet per side of the console, not a raised middle`（改写） | 运行台两侧是 `bg-well`，中栏是 `mahua-card`，且不再出现 `bg-inset` |

三条都**先剥注释再扫**：注释里引一个旧类名是解说，不是用法（`ActivationPage` 的文件头就写了
`border-t` 这个词）。剥法是替换成空格而不是删除，免得行号漂移后报错指向错位置。

同批修了 `test/studio-service.test.ts` 的硬编码日期：它把 `2031-01-01` 当"凭证已过期"，
新凭证到 `2031-12-31`，于是 `expect(created.ok).toBe(false)` 变成 `true`。现在从
`decodeToken(COMMUNITY_CREDENTIAL).claims.expiresAt` 推两天（推两天不是一天：验签留了 24 小时
时钟回拨容忍窗口）。这类"写死日期"的测试坏掉时不会说"日期旧了"，只会说"门禁失效了"，
把人引到完全错的地方。

## 9. 代价

- 语义类意味着**页边与卡内留白不能就地微调**。真要调，动 `--mahua-page-pad` / `--mahua-gap`，
  不要在页面上补一个 `p-5`——那就重新长出第二套数值。
- `.mahua-card` 自带 `rounded-sheet`；卡里再放 `rounded-sheet` 的容器会同心嵌套。凹槽因此定在
  `rounded-panel`，再往里才是 `rounded-control` / `rounded-tile`。
- 半透明 `wash` 在图片或渐变上会露底。目前没有这种底，将来有的话那里要用实色。
- 图标字重按尺寸分档是经验规则，写死进守卫会让"某个按钮想用 linear"变得麻烦——所以守卫只挡
  **族**与**形状**，字重靠 code review。
