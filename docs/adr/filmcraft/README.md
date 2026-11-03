# FilmCraft：这个应用自己的决定

共用的东西在 [`../craft/`](../craft/README.md)。这里只记与 FilmCraft 有关的部分。

## 钉住的上游

| | |
| --- | --- |
| 上游仓库 | https://github.com/storytold/filmcraft |
| Web 构建 | `filmcraft-web-0.16.0.zip`（15 MB） |
| `payload/manifest.json#app.locale` | `null` — 没有中文文案，也没有内嵌中文字形 |

为什么一个上游应用就是一个插件，论证见
[designcraft/0001](../designcraft/0001-this-app-is-a-payload-pin.md)。

## 操作要点

- 上游的 `references/` 这一支几乎全是**工程笔记**（`architecture.md`、`*-parity.md`、`gaps.md`、
  `releasing.md`）。对操作有用的只有 `keyboard.md`、`project-files.md`、`captions.md`、`transcripts.md`。
- 导出慢：一个片子可能十几分钟。启动后不要轮询截图，等用户说好了再看。
- 播放掉帧是常态。要在某一帧上判断时先 `Space` 暂停，再截图。
- 字幕、转写这类需要成段文本的东西，走文件（`.srt` / 工程）比走 `type` 靠谱——打字只有 ASCII。
