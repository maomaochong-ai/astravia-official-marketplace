# 中文在这里画出来

插件界面的默认语言是中文，而且不依赖任何语言开关：标签、工具栏、属性面板的文案来自
`src/features/editor/strings.ts`，画布上的中文字来自系统的中文字体栈。

> **取代**：`craft-0007-chinese-comes-from-the-shell.md`。那一篇写的是"注入
> `navigator.language`，让上游自己切语言"——上游不在了，注入点也不在了。

## 起点：为什么以前要注入

上游构建自带语言表，界面语言是它自己决定的。插件想让它显示中文，只有两条路：
改上游源码（不能，我们钉的是 sha256），或者在页面里伪造一个中文浏览器环境——
`navigator.language = "zh-CN"`、`accept-language` 头，有时还要预置 localStorage 里的
`{"version":2,"interface":{"language":"zh-hans"}}`。

这条路对 photocraft 成立，因为它的 wasm 里真的编进了中文字形，画布上量过。
对别的应用就不成立：`filmcraft` 的 `system_languages` 在 Web 端没有被赋值，
`figcraft` 的 `services.rs` 直接 `fn system_language(&self) -> Option<String> { None }`，
`designcraft` 的 `crates/ui-egui/src/i18n/` 里没有 zh 文件。开关打开也没用，
因为对面没有可切换的东西。

于是"让所有插件默认中文"这件事，在搬运架构下**根本无法完成**——不是没做，是做不到。

## 决定

**文案与字形都由我们提供。**

1. **文案**：`editorStrings(locale)` 返回整张表。`zh` 是默认值，只有 `locale` 以 `en`
   开头时才返回英文表。缺省、空字符串、未知语言都落到中文——面板在中文宿主里
   保持中文，在英文宿主里也不出现半截中文。
2. **字形**：`render.ts` 的 `FONT_STACK` 是
   `"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC",
   "Source Han Sans SC", system-ui, -apple-system, "Segoe UI", sans-serif`。
   三个平台各有一个首选，兜底到系统 UI 字体。文字用 `fillText` 逐行画，
   测量走 `measureText`，不依赖任何网络字体、不打包字体文件、不做运行时翻译。
3. **命名**：新形状的默认名走 `defaultName(shape, index)`，中文（"矩形 3"），
   因为这个名字会出现在图层列表和 Agent 的 `describe()` 里。

字体不打包是刻意的：一个 CJK 字体子集动辄几 MB，而三个桌面平台都自带中文字体。
风险是"系统没有中文字体"，那种情况下画布会显示替代字形——这是运行时观感问题，
不是代码问题，也不该用 8 MB 的子集去防。

## 为什么这比注入更可靠

| | 注入上游 | 自己渲染 |
| --- | --- | --- |
| 依赖上游是否带语言表 | 是 | 否 |
| 依赖上游是否带 CJK 字形 | 是 | 否 |
| 能验证吗 | 只能看截图 | 断言字符串表 + 看画布 |
| 十六支一致 | 每支都要试一次 | 一份代码 |

## 证据

- Observed：`editorStrings("")`、`editorStrings("zh")`、`editorStrings("zh-CN")` 都返回中文表；
  `editorStrings("en")`、`editorStrings("en-US")` 返回英文表。
- Observed：`tests/craft-manifest.test.mjs` 断言每支 `SKILL.md` 正文含中文；
  `tests/craft-kernel.test.mjs` 断言 `defaultName` 产出中文名。
- Observed：`tsc --noEmit` 通过，十六支 `strings.ts` 逐字节相同。
- Inferred：宿主在 `en` 语言下打开插件会看到英文界面；这是有意的双语，不是缺陷。
- **未验证**：三个平台上画布中文字形的实际观感（需要在界面里目视确认无空方框）。
