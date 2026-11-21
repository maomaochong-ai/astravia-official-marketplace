---
name: logo-studio
alias: LogoCreator
description: "Design brand logos with a deterministic vector engine and hand over a complete brand kit. Use when the user wants a logo, app icon, wordmark, monogram or badge; wants an existing mark rebuilt with the same system; or wants brand colours, SVG/PNG exports and a printable brand guide. The engine runs offline — no key, no network — and the same fields plus the same seed reproduce the same bytes. 标志设计：图形、文字标志、字母组合、徽章与品牌套件."
---

# LogoCreator

这个技能只做一件事：**把一句品牌描述变成可用的矢量标志和品牌套件，并且交付物可核对。**

引擎是全本地的：`renderLogo(spec)` 是纯函数，512×512 画布，产出独立 SVG（不依赖外部字体、图片或样式表）。
所以 `VECTOR` 不等于"大概像"，它意味着每次导出、每个尺寸、每个衍生版本都是同一份几何。

## 三个工具

| 你要做的事 | 工具 | 返回值 |
| --- | --- | --- |
| 设计标志并把 SVG 写进项目 | `logocreator_design` | `{ok, brand, subject, files[], designs[], notes[]}` |
| 生成整套品牌套件 | `logocreator_brand_kit` | `{ok, folder, files[], palette, pngSkipped, notes[]}` |
| 查引擎能画什么 | `logocreator_catalog` | `{types[], styles[], detailLevels[], subjects[], engine}` |

两个生成工具的参数一样：`brandName`（必填）、`tagline`、`type`、`style`、`detail`、`colour`、`surface`、
`monochrome`、`intent`、`seed`、`count`、`directory`。

```json
{
  "brandName": "青岚茶事",
  "type": "icon-name",
  "style": "minimal",
  "intent": "a leaf mark for a mountain teahouse, calm and organic",
  "count": 3
}
```

- **`intent` 用普通名词写**。"a leaf mark for a plant nursery" 比 "organic synergy" 有用：
  引擎匹配它认得的第一个题材词（leaf / cup / wave / mountain / flame / aperture / orbit / shield /
  gear / book / paw / creature / sun / moon / spark / droplet / house / pillar / cross / note / wing /
  compass / heart / hex / link / knot），认不出就走抽象几何。
- **`seed` 是设计的一部分**。同一组参数 + 同一个 seed = 同一份字节；换 seed 才是换一个变体。
  `count: 3` 内部就是 `seed + 0/7919/15838`，返回的 `designs[].seed` 写明了每个文件的种子。
- **`colour` 留空就是 `auto`**：引擎按品牌名与 `intent` 的题材推色（茶饮偏暖、水体偏青）。
  用户给了品牌色再传 6 位十六进制，不要自己编一个"差不多"的颜色。
- **`type` 决定结构**，不是装饰：`icon` 只有图形（做应用图标），`wordmark` 只有字体，
  `emblem` 会把名称排到圆周上——塞长名字进去会被截断。

## 判断结果

写完之后**打开一个 SVG 读一遍**，不要只看返回值说"做好了"。看三件事：

1. 图形是不是 `intent` 说的那个。`subject` 已经告诉你引擎选了哪个题材；对不上就改 `intent` 的措辞再跑一次。
2. 文字标志有没有超出画布。引擎会按字符数缩字号，但 30 个字符以上的名称该换成 `icon` + 单独的文字。
3. 颜色对背景有没有对比。`brand_kit` 返回的 `palette` 里有 `ink` 与 `surface`，正文对比不足要换 `surface`。

`logocreator_brand_kit` 的 `pngSkipped: true` 意思是这个宿主没有可用的 canvas，位图那一半没写出来——
**这时候不要说"套件完整"**，说清楚矢量文件已经在了、PNG 需要用户在面板里点一次。

## 硬规则

- **不编数值。** 颜色、seed、文件路径都来自工具返回或用户输入；没量过的对比度不要写成"已满足 WCAG"。
- **矢量归矢量。** 内置引擎的产物可以无限放大；AI 引擎（Together）返回的是位图，只能导出 PNG，
  也不能重建成更大的尺寸。用户说"要能印刷"时只能用内置引擎。
- **AI 引擎需要用户自己的密钥**，且只在用户明确要 "AI 生成" 时提。不要为了跑通任务去问用户要密钥。
- **不要覆盖用户已有的标志文件。** 目录已存在时换 `directory`，或者先问。
- **随手交付可核对的东西**：文件路径 + `subject` + palette 三行，比一段形容词有用。
