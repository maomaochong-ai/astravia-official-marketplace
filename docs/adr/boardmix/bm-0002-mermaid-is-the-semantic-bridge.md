# bm-0002 — Mermaid 才是语义桥：把图交给产品自己的转换器

- **Status:** Accepted
- **Date:** 2026-11-10
- **Context:** boardmix 1.8.5 的 web 构建（`index-Ddp4znH9.js` 与 `i18n-BzFOPgMg.js`）
- **Related:** [bm-0001](bm-0001-the-canvas-api-is-not-a-page-global.md)、分析记录 `.rea/boardmix-1.8.5/README.md`

## 事实

产品自带 Mermaid 转换器，读出来的是它自己的文案与图标 id：

| key | 值 |
| --- | --- |
| `mermaidDiagram` | `Mermaid 绘图` |
| `mermaidDiagramTips` | `支持解析mermaid格式的流程图、时序图、ER图、类图、饼图和象限图。` |
| `flowchartGeneratedSuccess` | `成功生成 {val} 个流程图` |
| `noMermaidContentDetected` | `未检测到支持 Mermaid 的文件内容` |
| `IMPORT_MERMAID` | 图标 id `import-mermaid` |

mermaid 库本身在包里跑（`mermaid.run`、`querySelector: ".mermaid"`）。所以"Mermaid 文本 → 原生可编辑图形"
是这个产品**已经实现**的能力，不是我们猜的。

反面也要说清楚：`粘贴为 Markdown`、`思维导图粘贴为带格式文本 / 纯文本` 是**文本粘贴的格式选项**，
不是图形合成。本插件旧技能里"画布接受粘贴 Markdown 就变图"的说法，在这次分析里**没有证据**。

## 决定

**`boardmix_diagram` 是这个插件唯一的"画图"工具，输入就是 Mermaid 文本。**

1. 工具先**落盘**：把 Mermaid 写进项目（`.boardmix/diagrams/<name>.mmd`），因为文件是这条链路上
   唯一确定的交付物——即使节后面板出问题，用户手里已经有能导入的东西。
2. 再**送进产品**：优先走产品自己的入口（`import-mermaid` 对应的创建/导入项）；入口找不到就退回
   在画布上做一次真实粘贴，粘贴内容是刚写的 Mermaid 文本。
3. 然后**核对**：`boardmix_shot` 拍一张，模型必须看了那张图才能说"画布上有了"。
4. 失败就是失败：`needsUserAction` 说明下一步是用户的点击，并把 `.mmd` 路径给他。

技能里的规则随之改写：**先产出 Mermaid，再决定送哪条路；没有截图就不许说画好了。**

## 边界与代价

- 只支持产品文案列出的那六类图（流程图、时序图、ER、类、饼、象限）。别的图型不承诺。
- 转换出来的形状归产品所有，样式以它的默认为准；我们不逐点调样式（那要看像素，见 bm-0001）。
- 元素额度仍归用户账户：免费档 150 元素/文件，工具返回里会带这次估算的元素数。
- `import-mermaid` 的界面落点本次没有点击验证（标为 unknown）；工具因此优先走"能看见的入口"，
  并且允许整体退化为"交给用户导入这个 .mmd"，这一步永远可用。
