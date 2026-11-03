# 清单上的名字说宿主的语言

## 起点

十五支插件的 `plugin.json` 把 `name` 与 `description` 写成英文字面量，`tab.label` 也写死在
`src/index.tsx` 的 `registerActivityTab({ label: APP.tabLabel })` 里。用户界面是中文，
能力页上这十五张卡片却全是英文——这不是"上游只有英文"的问题，是插件自己的元数据没提供译文。

同一轮里还删掉了一个入口：标签条上的"内置浏览器打开 / 外部浏览器打开"。它们开的是同一个页面，
但没有工作区绑定，打开文件走浏览器选择框、导出走浏览器下载，与插件里已经有的文件通道是两条不一致的路。
留着两个按钮，等于让用户在两条互不相通的路里选。

## 决定

### 1. 元数据走 `locales/`

宿主按目录约定读 `locales/<locale>.json`（Observed：`plugin-package.ts` 的 `readPluginLocales`），
把 `plugin.json` 里 `%key%` 形态的字符串换成译文。于是：

| 位置 | 写成 | 中文来自 |
| --- | --- | --- |
| `plugin.json` → `name` | `%plugin.name%` | `locales/zh.json` 的 `plugin.name` |
| `plugin.json` → `description` | `%plugin.description%` | `locales/zh.json` |
| `registerActivityTab` → `label` | `%tab.label%` | `locales/zh.json` |
| 工具 `label` | `%tool.open%` 等 | `locales/zh.json` |

`defaultLocale` 保持 `en`：英文界面拿 `locales/en.json`，中文界面拿 `locales/zh.json`，
两边都是完整句子，不是"英文兜底 + 中文覆盖"的半成品。

**不在 payload 里做翻译。** 编辑器自身的界面语言仍由 `payload/manifest.json` 的
`app.locale` / seed 决定（见 0007），那是上游 app 的事；`locales/` 只管宿主 UI 上属于插件的那几行字。
两套机制不要混：`%key%` 一旦被塞进 iframe 就会原样显示成 `%tool.act%`，这一点在 0009 里记过。

### 2. 删掉浏览器入口

`browser.open` / `shell.openExternal` 两个权限与 `browser.allowedHosts` 一起从清单里去掉，
`use-craft-editor.ts` 不再调 `ctx.browser`。标签条只留三个东西：

- 状态点 + 文案（准备中 / 就绪 / 失败）
- 全屏按钮
- 重载按钮

都是图标 + `title` + `aria-label`，不再有整行文字按钮。全屏优先走 `requestFullscreen`，
被宿主 iframe 拒绝时退到 CSS 覆盖层（`fixed inset-0`），Esc 或同一个按钮退出——
"能进不能退"比"进不去"更让人恼火。

## 会坏在哪里

- **`%key%` 拼错就是字面量。** 缺键不会报错，界面上直接显示 `%tool.act%`。所以每支插件的
  `locales/en.json` 与 `zh.json` 必须键集相同，且覆盖清单里所有 `%…%`。
- **搜索命中的是原文。** 中文界面下的搜索词来自 `locales`，英文的留在清单里；两边都要写全。
- **`defaultLocale` 不是"系统语言"**：它是找不到当前 locale 时的兜底。用户界面是 `zh-CN` 时
  回退到 `zh`，这条回退由宿主做，插件不需要写 `zh-CN`。

## 证据

- Observed：`plugin-package.ts:38` 逐文件读 `locales/*.json`，只收字符串值；
  `plugin-system-catalog.ts` 把 `manifest.description` 带进已安装插件条目。
- Observed：`build-apple-apps` 用同一套 `%plugin.name%` / `%tab.label%` 写法并在中文界面正确显示，
  本轮按它的形状照抄，没有自创格式。
- Observed：`node scripts/marketplace.mjs check` 与 `node --test tests/*.test.mjs` 通过
  （清单 schema、hub 摘要、版本一致性、家族逐字节一致）。
- Inferred：真实宿主里切换语言后卡片立即变化——需要在装有多支插件的宿主里目视确认一次，
  这一步本轮没有做（没有可复现的多插件会话）。

## 后果

十五支的 `plugin.json` 从此各带两份 locale 文件，改动一个工具名要同步改两个语言文件。
这是有意的：漏一个语言文件是一种可测的缺失，而"界面上混着两种语言"不是。
