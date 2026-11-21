---
name: logocreator
alias: LogoCreator
description: "Design brand logos with a deterministic vector engine and hand over a complete brand kit. Use when the user wants a logo, app icon, wordmark, monogram, badge or emblem; wants an existing mark rebuilt inside this system; or wants brand colours, SVG/PNG exports, a printable brand guide or a kit to hand to a client. The engine runs offline — no key, no network — and the same fields plus the same seed reproduce the same bytes. 标志设计：图形、文字标志、字母组合、徽章与品牌套件。"
---

# LogoCreator

一句话：**把品牌描述变成能用的矢量标志，并把套件交到用户手上，每一步都可核对。**

三件事决定了这套流程和别处的不同：

- **设计是参数。** `renderLogo(spec)` 是纯函数：512×512、独立 SVG、不含外部字体或图片。
  同参数同 seed = 同字节，所以"改一个字段再出一版"永远优于"重投一次赌一把"。
- **引擎只画它有词汇的东西。** 26 个象形题材、8 种抽象构成、6 种结构、8 种风格。
  词汇之外的请求不会报错，只会静默降级——`references/subject-atlas.md` 是那张词表。
- **交付物是文件，不是描述。** 没有 `files[]` 就等于没交付。

## 三个工具，各自只做一件事

| 要做的事 | 工具 | 返回 |
| --- | --- | --- |
| 出一个或几个标志，写进项目 | `logocreator_design` | `{ok, brand, subject, files[], designs[], notes[]}` |
| 整套品牌套件落盘 | `logocreator_brand_kit` | `{ok, folder, files[], palette, pngSkipped, notes[]}` |
| 查引擎的词汇表 | `logocreator_catalog` | `{types[], styles[], detailLevels[], subjects[], engine}` |

两个生成工具参数完全一样：`brandName`（必填）、`tagline`、`type`、`style`、`detail`、`colour`、
`surface`、`monochrome`、`intent`、`seed`、`count`、`directory`。

```json
{
  "brandName": "Kettle Lane",
  "type": "icon-name",
  "style": "hand-drawn",
  "detail": "balanced",
  "intent": "a warm hand-drawn cup for a coffee roastery",
  "count": 3
}
```

## 一轮的固定顺序

跳步的代价在最后一步才结算，所以顺序不要改。

1. **读 brief，只补两格**。缺的只有两类值得问：**它做什么生意**（决定题材）和**最先用在哪**
   （决定 `type` 与 `surface`）。其余都能先给一版再看。一次问完。
2. **定四个参数**（`references/directions.md`）：`intent` → `type` → `style` → `colour`。
   顺序不能换——`intent` 同时决定图形**和**自动配色的色相锚点。
3. **出图**：`logocreator_design`，`count: 3`。一个无法比较，八个是让用户做选择题。
4. **看图**（`references/critique.md`）：先看 `subject` 对不对，再看 24px、单色、对比度。
   对不上就改 `intent` 重跑，不要为一个"不是我要的"图形写解释。
5. **交付**：要套件就 `logocreator_brand_kit`；只要一个标志就存单个 SVG。
   最后三行：文件路径、`subject`、palette 主色 + 一句下一步。

## 判断结果的三个读数

允许你下结论的只有工具返回的这三样：

1. **`subject`** — 引擎画了什么。`"abstract:burst"` 表示它没认出题材，只能给几何构成；
   这时改 `intent` 的措辞，不要说成"抽象更有力量"。
2. **`files[]`** — 真正写下去的路径。清单里有几个，你就只能说几个（见 `deliverables.md`）。
3. **`palette`** — `primary` / `secondary` / `accent` / `ink` / `muted` 及其用途。

`logocreator_brand_kit` 返回 `pngSkipped: true` 表示宿主没有可用 canvas：位图那一半没写。
**这时不能说"套件完整"**，要说清矢量与文本已就位、PNG 需要在面板里点一次。

## 中文品牌名

名称含汉字时先读 `references/cjk-brand-mark.md`。三条最常踩的：

- `intent` 里的题材词必须写英文（`"a leaf mark…"`），中文描述不参与匹配，会退到抽象构成。
- 文字标志一个汉字占一个 em；**≥ 28 字会跑出画布**（引擎不为中文断行），要换 `icon`。
- 字母组合取的是**一个汉字文本节点**，字族由系统决定，不是描边字。

## 硬规则

- **不编数值。** 颜色、seed、路径、对比度都来自工具返回或用户输入。没算过的不写"符合 WCAG"。
- **矢量归矢量。** 内置引擎可无限放大；AI 路径（宿主已配置的图像服务）是位图，只能导 PNG、不能放大重绘。
  用户说"要印刷 / 要刺绣 / 要烫金"时只有内置引擎一条路，先说清楚再动手。
- **AI 引擎需要用户自己的密钥**，且只在用户明确要 AI 生成时提，不要追着要密钥。
- **不覆盖已有品牌目录。** 目录已存在就换 `directory`，或先问。
- **`seed` 属于交付物。** 报告里带上它，用户以后才能一字不差地重建同一个标志。
- **保存属于用户。** 工具写进项目目录，或走 `fs.saveAs` 由用户选位置。
- **一轮只回答一个问题。** 用户在挑风格时，不要顺手改颜色；先让他选完再动下一步。

## References (read on demand)

按需读，不要开局全读。

路径相对 `$SKILL_DIR`。每一份都是"读它的时候才读"，全部读完等于没读。

| 文件 | 读它的时候 |
| --- | --- |
| `references/directions.md` | 第 2 步：brief 四栏 → `intent`/`type`/`style`/`colour` 的决定顺序、该问什么、完整示例 |
| `references/structure.md` | 定 `type`：六种结构各自在引擎里的实际几何与长度上限（字标预算、徽章 26 字符、字母组合取字规则） |
| `references/style-fit.md` | 定 `style`：八种风格的参数表 + 行业对照 + 会互相抵消的组合 |
| `references/colour.md` | 定 `colour`：`auto` 的推导链、对比度地板的具体数值、从图片取色的规则 |
| `references/subject-atlas.md` | 写 `intent` 前：26 个题材与 8 种抽象构成各自适合什么、什么时候会毁掉一个标志 |
| `references/cjk-brand-mark.md` | 名称含汉字/假名，或客户是中文市场 |
| `references/anti-patterns.md` | 出图看起来"哪里不对"但说不清时：14 种已知失败及其成因 |
| `references/critique.md` | 交付前：10 项可量化的顺序检查 + 自检清单 |
| `references/deliverables.md` | 交付时：套件里每个文件是干什么的、哪种请求对应哪个文件 |

结论以代码为准：题材库 `src/domain/engine/motifs.ts`，风格配方 `src/domain/engine/style-recipes.ts`，
结构枚举 `src/domain/spec.ts`，配色推导 `src/domain/color-plan.ts`，字号与合成 `src/domain/engine/compose.ts`。
