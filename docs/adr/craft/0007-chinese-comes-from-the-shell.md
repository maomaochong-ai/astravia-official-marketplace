# 中文来自外壳，画布交给上游

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

六支 craft 插件的 `app.locale` 目前都是 `null`，因为它们的构建里**既没有中文文案，也没有内嵌中文字形**
（`unzip -l` 只有一个 `OFL-noto-sans-cjk-sc.txt` 许可证文本）。强切中文的结果是英文界面 + 一屏空方框，
比英文更糟。photocraft 是例外：它的构建自带字形和语言表，`app.locale: "zh"`，所以它的画布真的是中文。

## 为什么不做重编译

仓库里曾经有过一条管线（`tools/craft/i18n/`），把上游 Rust 源码改出中文串、重编 wasm。它被删除了，
理由是四条，每条都独立成立：

1. **上游没有可翻译的字符串表。** 六支构建的界面文字直接写在 egui 代码里，改一处就要改源码，
   而且每次上游发版都要重来。
2. **字形进不去。** epaint 用 `ab_glyph`，它不读 CFF/OTF；`NotoSansSC-Regular.otf` 正是 CFF。
   要中文字形就得转 TTF 并打包进去，制品从 26 MB 涨到 60–90 MB。
3. **成本不成比例。** 六支 × 每次 10–30 分钟编译，而收益只覆盖菜单文字。
4. **它把"跑上游原样构建"这条底线破了。** 一旦开始重编，payload 的 sha256 就不再是上游发布的那个字节，
   所有关于来源与可复现的说明都要重写。

管线归档在仓库之外（`/tmp/craft-i18n`），**不要再把它引回插件目录**。这条写进了七支的 `AGENTS.md`。

## 所以现在的真实状态

| 位置 | 语言 |
| --- | --- |
| 插件标签标题、状态条、准备页、错误文案 | 中文（英文界面用户看到英文），`strings.ts` |
| 技能的展示名与正文 | `SKILL.md` 的 `alias` 双语名 + 中文正文 |
| 能力详情页 | `detail.json` / `detail.zh.json`，默认英文、中文覆盖 |
| **画布内部的菜单与面板** | **上游的英文**（photocraft 除外） |

## 验证与未验证

- Observed：`strings.ts` 两份文案键完全对应，`npx tsc --noEmit` 通过。
- Observed：`payload/manifest.json` 里 designcraft 的 `app.locale` 为 `null`，photocraft 为 `"zh"`；
  hub 只在有值时注入种子。
- Inferred：`hl=en` / `hl=zh` 在没有语言表的上游构建上是空操作——**没有**逐个应用截图确认过
  "切英文之后界面变了吗"，因为预期就是不变。真要确认，改宿主语言后看画布文案是否变化即可。
