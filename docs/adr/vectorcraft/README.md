# VectorCraft：这个应用自己的决定

共用的东西在 [`../craft/`](../craft/README.md)。这里只记与 VectorCraft 有关的部分。

## 钉住的上游

| | |
| --- | --- |
| 上游仓库 | https://github.com/storytold/vectorcraft |
| Web 构建 | `vectorcraft-web-0.20.0.zip`（31 MB） |
| `payload/manifest.json#app.locale` | `null` — 没有中文文案，也没有内嵌中文字形 |

为什么一个上游应用就是一个插件，论证见
[designcraft/0001](../designcraft/0001-this-app-is-a-payload-pin.md)。

## 操作要点

- **这一支最依赖拖拽，而拖拽不在工具能力内。** 画路径、拉贝塞尔手柄、移动锚点都是按下—移动—抬起，
  而 `click` 只有按下即抬起。能做的是选工具、点菜单、在数值面板里填常数；形状本身交给用户。
- 画布是矢量，截图是位图：0.5 px 的描边差在 PNG 里看不见。需要精确值就让用户在属性面板读，
  或者直接改 SVG 文件。
- 描摹（image trace）参数多且互相影响，调一次看一次，不要连调三个参数再截图。
