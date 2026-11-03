# PDFCraft：这个应用自己的决定

共用的东西在 [`../craft/`](../craft/README.md)。这里只记与 PDFCraft 有关的部分。

## 钉住的上游

| | |
| --- | --- |
| 上游仓库 | https://github.com/storytold/pdfcraft |
| Web 构建 | `pdfcraft-web-0.17.0.zip`（17 MB） |
| `payload/manifest.json#app.locale` | `null` — 没有中文文案，也没有内嵌中文字形 |

为什么一个上游应用就是一个插件，论证见
[designcraft/0001](../designcraft/0001-this-app-is-a-payload-pin.md)。

## 上游还有一条 CLI，这个插件没接

上游另发 `pdfcraft-cli`，做批量转换、OCR、压缩（`references/cli-batch.md`）。
插件只驱动标签页，**没有**装那条 CLI：装二进制要新的权限面、要跨平台产物、
要另一套版本校验，而它换来的能力（无界面批处理）用户还没提过。真要做，是另一个决定，
不是顺手加一个工具。

## 操作要点

- 加密 PDF 打开时可能停在口令框。口令只能由用户给，不要猜、不要从文件名里编。
- 改既有文字是上游的弱项（`references/editing-existing-text.md` 里有边界说明）。
  用户问"能不能改这行字"，先读那一篇再回答，不要凭印象承诺。
- 缩略图网格的分页与滚动都会改变位置，一次操作之后重新截图。
