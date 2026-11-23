# LogoCreator 插件 — 智能体工作手册

这份文件写给**在本目录里干活的智能体**（宿主对话里的 agent，或另一个人接手）。它只回答三件事：
这里的东西怎么摆、改之前要知道什么、改完怎么证明没坏。产品说明写给用户，不放这里。

---

## 1. 一句话定位

把一句品牌描述变成**可用、可重建、可交付**的标识：本地矢量引擎负责「不需要密钥、不联网也能出图」，
宿主已配置的图像服务负责「要质感、要插画」的那一类。两条路都落在同一个设计历史里。

## 2. 目录与职责（改东西前先确认落点）

```
plugin.json          身份：id/version/icon/权限/agent 贡献（改版本要同步 5 个文件，见 §6）
src/index.tsx        activate：注册 tab、工具、卡片、system prompt、文件树动作；每步单独 try
src/tab-ids.ts       工具与 tab 的 id 常量，全仓库唯一来源
src/contributions.ts 交给宿主渲染的字符串与 id（%key% 或字面值，见 §5）
src/domain/          **纯逻辑**：spec、调色板、引擎（geometry/glyphs/motifs/recipes/compose）、
                     设计目录与 .astravia-log、备注、历史存储、AI 提示词与宿主媒体调用
src/features/canvas/ 面板：components（UI）、hooks（状态）、services（导出）
src/tools/           Agent 工具：design / brand-kit / catalog / notes / plan / image
src/shared/          跨面复用：图标（Solar 生成）、tokens、格式化
agent/skills/        技能与参考文档（宿主加载，见 §7）
locales/             zh.json / en.json，键必须一一对应
scripts/             sync-icons.mjs（唯一保留的脚本，见 §8）
harness/             本地可视化外壳：把面板单挂在浏览器里调样式
```

规则：**UI 文件不写业务判断**，判断放 `domain/`；**domain 不 import React**。
`.tsx` 只导出组件，一个文件一个组件；文件名表达职责（不要 `utils.tsx`、`ui.tsx`）。

## 3. 产物形状（改动前必须知道）

一次设计 = 一个目录，目录名带后缀，和宿主内置设计插件同一种读法：

```
<project>/<slug>.logocreator-design/
  design.astravia-log     唯一真相：spec、调色板、每个变体、套件清单、时间
  mark.svg                主变体
  variants/1.svg …        每次生成的变体
  kit/…                   品牌套件（跑过 brand_kit 才有）
```

- 旧文件名 `design.json` 仍可读（`LEGACY_MANIFEST`），不要删这段兼容。
- `design.astravia-log` 是**合并写**：第二次生成追加变体、更新 spec，不覆盖上一次；套件只在真产出时替换。
- 工具签名与目录约定是契约：`logocreator_design` / `logocreator_brand_kit` 的描述里写着这套形状，
  改目录就必须同时改描述与 `features/canvas/router-prompt.ts`，否则 agent 会自己发明路径。

## 4. 两条生成路径（别把它们混成一条）

| | 矢量（默认） | 图像服务（宿主已配置时自动选中） |
| --- | --- | --- |
| 入口 | `logocreator_design` / 面板「生成」 | `logocreator_image` / 面板「图像标志」 |
| 依赖 | 无（引擎是纯函数） | `ctx.media` + `ctx.jobs` + `ctx.artifacts`（要 `media.generate`） |
| 产物 | SVG，可无限放大、可重建 | PNG，存宿主 blob，记录只保留 blobId |
| 能力边界 | 26 个母题；画不出写实角色 | 画质取决于用户连接的模型，按次计费 |

**宿主媒体请求的硬约束**：`inputs` 永远是数组（文生图给 `[]`）。SDK 的 TS 类型写成可选，
宿主的运行时 schema 却把它列在必填项里 —— 省掉会得到
`Capability input validation failed: / Expected union value`。这条别再踩。

## 5. 给宿主渲染的字符串

- `%key%` 只在**每次渲染都会重新解析**的地方用（tab 标签、输入栏徽标、工具名）。
- **会被存进消息/历史**的字段（`skillPresentation.displayName`、编辑器标签）用**字面值**：
  某条宿主路径不解析 `%…%` 时，用户读到的是 `%name%`（真实发生过）。
- 中英文两份词表键集必须相同；新增键同时写 `zh.json` 与 `en.json`。
- 字体只有七档（9.5 / 10.5 / 11.5 / 12 / 13 / 14 / 18），`text-[Npx]` 不许出现第八档。

## 6. 版本与发布（只做源码，别手工碰索引）

```bash
# 只改本插件时要动这 5 份，版本必须同步且递增（按 0.0.1 步长）：
#   abilities/plugins/logocreator/plugin.json
#   abilities/plugins/logocreator/ability.json
#   abilities/plugins/logocreator/package.json（+ package-lock.json）
#   .astravia/marketplace.source.json（只改 logocreator 那一条）
```

- 正式 `.astraviapkg` 由 CI 构建，`dist/`、`release/` 不入库。
- 本工作区可能同时有别人的未提交改动：**只 add 本目录与索引里那一条**，不要整文件提交别人的版本号。
- 发布后核对 gh-pages 上 `releases[-1].version` 与 `artifact.sha256`，不要以本地构建产物为准
  （打包非确定位，两边 sha 会不同）。

## 7. 技能与参考文档（agent/skills/logocreator/**）

- `SKILL.md` 是**路由**：什么请求走哪条路、什么时候必须问、什么时候不要用本插件。
- `references/*.md` 是**方法**：结构怎么选、风格怎么定、反例在哪、交付物清单。
- 判断类内容写在 references，不要堆进 SKILL.md（技能每次都要读，references 按需读）。
- 这里不放「欢迎使用」「本插件很强大」这类话：读者是 agent，不是访客。

## 8. 脚本策略

`scripts/` 只留**产物必需或机器可校验**的：

- `sync-icons.mjs` — 从 `@iconify-json/solar` 生成 `src/shared/components/icons.generated.ts`；
  `--check` 可在 CI 里比对。**图标不许手绘**，改用途就改映射再同步。
- 一次性排查脚本用完删除，不入库；需要留证据就把**输出**贴进 `docs/`。

## 9. 改完必须跑

```bash
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run      # 34 文件 / 264 条（2026-11 基线）
node scripts/sync-icons.mjs --check
```

契约类断言在 `src/test/` 里按主题分文件，改结构就同步改断言，**不要为了让测试变绿而放宽断言**；
如果旧断言与当前决定冲突，先改决定（写进 `docs/adr/`）再改断言。

## 10. 硬性禁令

- 不引 HTTP 客户端、不存密钥、不直连 provider：图像一律走 `ctx.media`。
- 不把 `dist/`、`release/`、`.tmp/`、截图、日志提交进仓库。
- 不在面板里读宿主配置文件或别的插件的 `node_modules`。
- 不用 `find`/`rg --files` 找代码：用仓库工具（dir_tree / glob / grep）。
- 发布前不得跳过上面的三条校验；红着不发。
