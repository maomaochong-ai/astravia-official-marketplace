# LightCraft：这个应用自己的决定

共用的东西在 [`../craft/`](../craft/README.md)。这里只记与 LightCraft 有关的部分。

## 钉住的上游

| | |
| --- | --- |
| 上游仓库 | https://github.com/storytold/lightcraft |
| Web 构建 | `lightcraft-web-0.17.0.zip`（70 MB） |
| `payload/manifest.json#app.locale` | `null` — 没有中文文案，也没有内嵌中文字形 |

为什么一个上游应用就是一个插件，论证见
[designcraft/0001](../designcraft/0001-this-app-is-a-payload-pin.md)。

## 这一支为什么最大

70 MB，是七支里最大的一支：它要解 RAW。首次打开的准备页会停在下载那一步比较久，
准备页显示的是真实百分比，不是转圈。用户问"怎么这么慢"时，回答是"在下 70 MB 的构建"，不是"卡住了"。

## 操作要点

- 显影是视觉判断。截图能对比"两张是否一致"，读不出直方图；需要判断高光溢出、色偏时，
  让用户在显影模块里看，或者用文件的方式交给上游。
- 网格会滚动，选片靠位置。一次操作之后重新截图。
- 导入是大批量动作，跑起来之后不要每两秒截一张。
