# NOTICE

本能力包是对 **Matt Pocock / Skills For Real Engineers** 技能集合的整合分发：

- 上游仓库：<https://github.com/mattpocock/skills>
- 上游修订：`4ae2317ddb22b046e26455e4f9c9b3aaaf62212d`
- 许可：MIT（全文见本包根目录 `LICENSE`，与上游 `LICENSE` 逐字一致）
- 版权：Copyright (c) 2026 Matt Pocock

`references/` 目录下的全部模块文件（SKILL.md、附属文档、`scripts/`、`agents/openai.yaml` 等）与上游对应文件逐字节一致，未做内容改动。本包仅新增：包级路由 `SKILL.md`、Astravia 目录元数据（`ability.json`、`detail.json`、`detail.zh.json`）、`upstream.json`、`assets/icon.svg` 与本声明文件。

本能力包内的 `assets/icon.svg` 取自 **Solar** 图标集（`solar:branching-paths-up-bold`）：

- 作者：480 Design
- 许可：CC BY 4.0（https://creativecommons.org/licenses/by/4.0/）
- 来源：https://iconify.design/collection/solar/ ，经 `https://api.iconify.design/solar/branching-paths-up-bold.svg` 获取
- 改动：仅在 SVG 内注入作用域主题色（`<style>#i{color:#2E5BFF}</style>`），图形路径数据未作修改

选取说明：上游仓库 `mattpocock/skills` 没有独立的品牌图标资产（仅 README 引用的横幅首图，含人物照片与色块，不适合做方形卡片图标），故按仓库惯例改用 Solar 专业图标。

其中 `pr` 模块在上游即标注致谢来源：skill `show-me`，作者 Dex Horthy（Humanlayer），详见 `references/engineering/pr/SKILL.md` 内的 `metadata.credits`。
