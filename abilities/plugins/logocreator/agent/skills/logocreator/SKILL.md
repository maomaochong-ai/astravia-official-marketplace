---
name: logocreator
alias: LogoCreator
description: "Design brand logos with a local vector engine and hand over a complete brand kit, or generate raster marks with the image providers the host already runs. Use when the user wants a logo, app icon, wordmark, monogram, badge or emblem; wants a mark outside the engine's vocabulary (plush, photographic, a character in a pose); or wants brand colours, SVG/PNG/WebP exports and a printable guide. 标志设计：图形、文字标志、字母组合、徽章、图像标志与品牌套件。"
---

# LogoCreator

一句话：**先判断该用哪条产线，再动手。** 两条产线都能落到同一个面板、同一份历史里，
但产出完全不同，选错了用户会拿到不能用在自己场景里的东西。

| | 矢量引擎 | 图像产线 |
| --- | --- | --- |
| 工具 | `logocreator_design` | `logocreator_image` |
| 画什么 | 26 个题材 + 8 种抽象构成 + 6 种结构 | 任意描述：毛绒质感、角色姿态、插画、拼贴 |
| 输出 | 独立 SVG，无限缩放，可做品牌套件 | PNG 位图，不能放大，没有套件 |
| 要密钥吗 | 不要，完全离线 | 用宿主已接好的图像服务，按次计费 |
| 用在哪 | 任何要印刷/刺绣/烫金/矢量交付的场合 | 探索、社媒头像、插画式标记 |

**判据只有一条**：这个图形我能在 26 个题材里找到一个说得通的原型吗？

- 能 → `logocreator_design`。哪怕只是接近（鲸鱼→`wave`，吉他→`note`）。
- 不能，且用户要的是质感/姿态/插画 → `logocreator_image`。
- 不能，但用户要矢量交付 → 先说清楚"引擎画不了这个"，给出最接近的题材，让用户选。

**不要**在没有工具的情况下说"改走 AI 路径"。这句话曾经把用户送进死胡同：
agent 说走图像生成，插件却只有一个矢量工具。现在两条路都有工具名，选一条直接调。

## 四个工具

| 要做的事 | 工具 | 返回 |
| --- | --- | --- |
| 出一版矢量标志，写进项目 | `logocreator_design` | `{ok, brand, subject, files[], designs[], notes[]}` |
| 出图像标志（宿主图像服务） | `logocreator_image` | `{ok, engine:"ai", images[], failures[], notes[]}` |
| 一句话 → 3 个具体方向 | `logocreator_plan` | `{ok, candidates[{spec, type, style, rationale}]}` |
| 整套品牌套件（矢量） | `logocreator_brand_kit` | `{ok, folder, files[], palette, pngSkipped}` |
| 读/关画布备注 | `logocreator_notes` | `{ok, pending[], resolved}` |
| 查引擎词汇表 | `logocreator_catalog` | `{types[], styles[], details[], subjects[]}` |

典型链路：`plan`（不知道选什么参数时）→ `design`（矢量）或 `image`（矢量画不了）→ `notes`（用户在图钉上提意见后收口）。

## 一轮的固定顺序

1. **读 brief，只补缺的两格**：它做什么生意（决定题材）、最先用在哪（决定结构与产线）。
2. **定产线**：按上表那条判据走。说不清就先用 `plan`，它会给出三个方向的理由。
3. **出图**：矢量 `count: 3`；图像 `count: 3`（每张都计费，不要擅自加）。
4. **看图**：矢量看 `subject` 对不对、24px 与单色是否成立；图像看有没有跑题、有没有多余文字。
5. **交付**：文件路径 + `subject` + palette + seed；图像要说明"位图，不能放大"。

## 判断结果的三个读数

1. `subject`（矢量）或 `images[].subject`（图像）—— 画的是什么。矢量返回 `abstract:*` 说明没认出题材，
   要么改 `intent` 的措辞，要么换图像产线。
2. `files[]` / `images[]` —— 真正落下的东西。没有这个列表就等于没交付。
3. `palette` —— 主色/辅色/强调色/正文色，以及它们各自的用途。

`logocreator_image` 返回 `failures` 时是**部分成功**：把成功的数量念给用户，别把整批说成全挂。

## 中文品牌名

读 `references/cjk-brand-mark.md`。三条最常踩的：
`intent` 里的题材词写英文（中文不参与匹配）；文字标志一字约 1 em，≥28 字会溢出画布 → 换 `icon`；
字母组合是**一个汉字文本节点**，字族由系统决定。

## 硬规则

- **不编数值。** 颜色、seed、路径、对比度、计费次数都来自工具返回或用户输入。
- **两条产线不混着承诺。** 图像路径没有 SVG、没有套件、不能放大；矢量路径画不出毛绒质感。
  用户说"要印刷/刺绣"时只有矢量一条路，先说清楚再动手。
- **图像按次计费**，用的是用户自己接的服务；`count` 不超过用户要求。
- **不覆盖已有品牌目录。** 目录已存在就换 `directory`，或先问。
- **`seed` 属于交付物。** 报告带上它，用户以后才能一字不差地重建。
- **保存属于用户。** 工具写进项目目录，或走 `fs.saveAs` 由用户选位置。
- **一轮只回答一个问题。** 用户在挑风格时，不要顺手改颜色。

## References (read on demand)

| 文件 | 读它的时候 |
| --- | --- |
| `references/engine-vs-image.md` | **第一步**：选矢量引擎还是宿主图像服务；宿主已配服务时面板会自动选它 |
| `references/directions.md` | brief 四栏 → 四个参数的决定顺序、该问什么 |
| `references/structure.md` | 定 `type`：六种结构的几何与长度上限 |
| `references/style-fit.md` | 定 `style`：八种风格的参数表与行业对照 |
| `references/colour.md` | 定 `colour`：auto 推导链、对比度地板、取色 |
| `references/subject-atlas.md` | 写 `intent` 前：26 个题材 + 8 种抽象构成的能力边界 |
| `references/cjk-brand-mark.md` | 名称含汉字，或客户是中文市场 |
| `references/anti-patterns.md` | 出图"哪里不对"但说不清时 |
| `references/critique.md` | 交付前：10 项可量化检查 |
| `references/deliverables.md` | 交付时：每个文件干什么、位图与矢量各自的边界 |

结论以代码为准：题材 `src/domain/engine/motifs.ts`，风格 `src/domain/engine/style-recipes.ts`，
结构 `src/domain/spec.ts`，配色 `src/domain/color-plan.ts`，规划 `src/domain/planner.ts`，
图像产线 `src/domain/ai/host-media.ts`。
