# 中文来自外壳，画布交给上游

> **已被取代**：注入 `navigator.language` 的前提是上游自己带语言表，而十六支里有多支
> 在 Web 端根本没有可选的语言。现行做法是自己渲染文案与字形，见
> `craft-0012-chinese-is-rendered-here.md`。下文保留原文，用于说明当时为什么那样做。

## 问题

用户要的是"编辑器默认中文，同时支持英文"。这句话里有两个完全不同的东西，混在一起就会做出错误承诺：

- **插件的壳**：标签标题、状态条、准备页、能力详情、工具描述、报错文案。这些是我们的代码。
- **画布里的界面**：菜单、面板、对话框。这些是上游的 Web 构建，我们一个字节都不改。

## 决定

### 壳：默认中文，跟随宿主

`src/features/editor/strings.ts` 一份 `EditorStrings` 接口 + `en` / `zh` 两份完整文案，
按 `ctx.i18n.locale` 的 `zh` 前缀切换。不建 `locales/` 目录：文案就在用它的代码旁边，
改一句话不需要跨三个文件。`plugin.json` 的 `defaultLocale` 仍是 `en`（英文界面的用户看到英文），
中文是显式覆盖——这和 photocraft 一致。

### 画布：能透传的透传，不能的不假装

`useCraftEditor` 把宿主语言拼进 URL：`?webgl|cpu&nosw&hl=zh|en`。hub 侧：

- `hl=zh` 时，如果 `payload/manifest.json` 的 `app.locale` 有值，就在返回的 HTML `<head>` 里种一段
  极小的脚本，把 `navigator.language` / `navigator.languages` 换成中文。
- `app.locale` 为空则什么都不注入。

这条种子存在的原因是那些构建每次加载都会重算"匹配系统语言"并把结果**持久化**，
而 hub 的端口每次不同、origin 随之变、localStorage 按 origin 隔离——不种，用户每次都要重新选一次。

### 判定依据：语言表 + 字形，逐个应用实测

`app.locale` 是每个应用自己的一个字段：有值才注入语言种子，为空什么都不做。判据是两件事——
构建里有没有中文语言表，以及**有没有中文字形**。对 15 个 release 的 zip 中央目录逐个查过（Observed）：

| 应用 | zh 语言表 | 中文字形 |
| --- | --- | --- |
| photocraft | `zh-hans` | 内嵌在 13 MB 的 wasm 分包里，画布实测是中文 |
| lightcraft | `ZhHans`（`crates/ui-egui/locales/zh-hans.json`） | 单独发 `lightcraft_zh_hans.otf`，16,437,364 B |
| designcraft / effectcraft / filmcraft / pdfcraft / vectorcraft / wordcraft / gridcraft / texturecraft / craft-anything | 有（`zh` / `zh-hans` / `zh-cn` / `zh-Hans`） | 查不到字形文件，只有 `OFL-noto-sans-cjk-sc.txt` 许可证文本 |
| cadcraft / deckcraft / figcraft / materialcraft | 无 | 无 |

那份许可证文本**不能当证据**：materialcraft 根本没有中文语言表，它的包里照样有
`OFL-noto-sans-cjk-sc.txt`。它由 `copy_font_licences` 统一复制，与字形有没有进包无关。

第二轮又按**语言选择机制**逐个仓库看过（见下节），把六支能确认读 `navigator` 的应用一并开启，
现在 `app.locale: "zh"` 有八支：photocraft、lightcraft、effectcraft、pdfcraft、vectorcraft、
gridcraft、wordcraft、craft-anything。其余七支保持 `null`——不是保守，是它们的构建根本没有中文路径。

**它们有可能本来就能显示中文**——字体也能编进 wasm，craft-anything 的 6.1 MB wasm 里查不到字形文件
却带着 `zh-hans` 表。这件事只能看画布：确认文案变成中文且不出方框，再改该应用
`payload/manifest.json` 的 `app.locale` 为 `"zh"`、`npm run build:hub`、抬版本。**没看过就不要改。**

## 第二轮：语言选择机制决定命运

上一轮按"包里有没有中文语言表"判断，把十一支都留在 `null`，理由是字形查不到。这一轮换了个更靠前的判据：
**这个构建从哪里决定界面语言**。只有拿得到 `navigator.languages` 的构建，`headSeed` 那三行脚本才起作用；
不读 `navigator` 的，种了也是空操作。逐个仓库查了源码（Observed）：

| 应用 | 语言从哪来 | 中文表 | 结论 |
| --- | --- | --- | --- |
| effectcraft | `sys_locale`（wasm 侧即 `navigator.language`） | `zh-hans` | 开启 |
| pdfcraft | `navigator.languages` 取前 31 个 tag | `zh-hans` | 开启 |
| vectorcraft | web host 传 `navigator.languages` 进 `set_system_locales` | `zh-hans` | 开启 |
| gridcraft | `Language::system()` 走 `sys_locale`；已存 `ui.json` 的 `language` 优先 | `zh` | 开启 |
| wordcraft | `detect_system_lang` → `sys_locale::get_locales` | `zh-hans` | 开启 |
| craft-anything | `sys_locale` | `zh-hans` | 开启 |
| filmcraft | 宿主注入的 `hooks.system_languages` 闭包，web 侧没有赋值点 | `zh-cn` | **不开**：拿不到 tag，只会退英文 |
| figcraft | `Services::system_language()` 返回 `None` | `zh-Hans.toml`（机器草稿，注明待母语审校） | **不开**：`system` 偏好落空 |
| designcraft | `crates/ui-egui/src/i18n/` 只有 `ar cs de fr hu it ja ka pl pt_br ru sv uk` | 无 `zh*.rs` | **不开**：没有中文目录 |
| cadcraft / deckcraft / materialcraft | 没有 i18n 层 | 无 | **不开** |
| texturecraft | 没有 i18n 层 | 无 | **不开** |

这里有一条容易踩的坑：`grep -l "简体中文\|zh-hans"` 会把 `theme.rs` 的 CJK 字形回退表和
`crates/doc/attrs/language.rs` 的**文档语言属性**一起命中，看起来像"有中文"。designcraft 就是这么被骗过一轮——
它的 `i18n/` 目录里根本没有中文文件。判据必须是**语言表目录里存在 zh 文件**，不是字符串出现在包里。

### 仍然没有证据的那一半

这一轮的验证停在"界面文字会走中文分支"，**没有**验证"字形画得出"。中文串配缺字形，结果是英文菜单旁边
多出几个空方框，比纯英文更难看。能不能画，取决于该构建的 wasm 里有没有编进 CJK 字体——这件事只能看画布。

所以这六支的开启是**可回滚的两行改动**：画面出现方框，就把对应 `payload/manifest.json` 的
`app.locale` 改回 `null`、`npm run build:hub`、抬版本再发一版。插件侧不动上游一个字节，
所以回滚也不会碰到 payload 的 sha256。

### 为什么现在敢开

因为种子只改 `navigator`，不改任何上游逻辑：上游照样走自己的"匹配系统语言"代码路径，只是它读到的
系统语言是中文。英文界面的用户 `hl=en`，种子不注入，他们看到自己的系统语言。这不是翻译层，
是让上游以为自己的宿主是中文系统——与 lightcraft 上一轮的做法完全同一条路。

## 为什么不做重编译

仓库里曾经有过一条管线（`tools/craft/i18n/`），把上游 Rust 源码改出中文串、重编 wasm。它被删除了，
理由是四条，每条都独立成立：

1. **上游没有可翻译的字符串表。** 没有语言表的构建把界面文字直接写在 egui 代码里，改一处就要改源码，
   而且每次上游发版都要重来。
2. **字形进不去。** epaint 用 `ab_glyph`，它不读 CFF/OTF；`NotoSansSC-Regular.otf` 正是 CFF。
   要中文字形就得转 TTF 并打包进去，制品从 26 MB 涨到 60–90 MB。
3. **成本不成比例。** 每支 × 每次 10–30 分钟编译，而收益只覆盖菜单文字。
4. **它把"跑上游原样构建"这条底线破了。** 一旦开始重编，payload 的 sha256 就不再是上游发布的那个字节，
   所有关于来源与可复现的说明都要重写。

管线归档在仓库之外（`/tmp/craft-i18n`），**不要再把它引回插件目录**。这条写进了每个插件的 `AGENTS.md`。

## 所以现在的真实状态

| 位置 | 语言 |
| --- | --- |
| 插件标签标题、状态条、准备页、错误文案 | 中文（英文界面用户看到英文），`strings.ts` |
| 技能的展示名与正文 | `SKILL.md` 的 `alias` 双语名 + 中文正文 |
| 能力详情页 | `detail.json` / `detail.zh.json`，默认英文、中文覆盖 |
| **画布内部的菜单与面板** | **上游自己的语言**（八支开了中文种子，七支没有中文表） |

## 验证与未验证

- Observed：`strings.ts` 两份文案键完全对应，`npx tsc --noEmit` 通过。
- Observed：`payload/manifest.json` 里 designcraft 的 `app.locale` 为 `null`，photocraft 与 lightcraft 为
  `"zh"`；hub 只在有值时注入种子。
- Observed：15 个 zip 的中央目录（HTTP Range 读 EOCD + 目录，未整包下载）：只有 lightcraft 含
  `lightcraft_zh_hans.otf`；其余只有 `OFL-*.txt` 许可证。
- Inferred：`hl=zh` 在没有语言表的构建上是空操作——**没有**逐个应用截图确认过
  "切英文之后界面变了吗"，因为预期就是不变。真要确认，改宿主语言后看画布文案是否变化即可。
