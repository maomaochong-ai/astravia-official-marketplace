# EffectCraft：这个应用自己的决定

共用的东西在 [`../craft/`](../craft/README.md)。这里只记与 EffectCraft 有关的部分。

## 钉住的上游

| | |
| --- | --- |
| 上游仓库 | https://github.com/storytold/effectcraft |
| Web 构建 | `effectcraft-web-0.20.0.zip`（21 MB） |
| `payload/manifest.json#app.locale` | `null` — 没有中文文案，也没有内嵌中文字形 |

## 文档

为什么一个上游应用就是一个插件（而不是一个插件里选应用），这份论证在家族里只写了一遍：
[designcraft/0001](../designcraft/0001-this-app-is-a-payload-pin.md)。

## 操作要点

- 渲染是**异步队列**：点下渲染之后界面照常可用，成品在队列里。不要连着截十几张图等它，
  启动后告诉用户"在跑"，隔一段时间看一次。
- 时间线要滚动才看得全。一次操作之后重新截图，旧的坐标多半已经不在原位。
- 关键帧靠拖。拖拽不在工具能力内（见 [0005](../craft/0005-the-agent-drives-the-canvas.md)），
  要精确数值就让用户拖，或者让用户在属性面板里改。
