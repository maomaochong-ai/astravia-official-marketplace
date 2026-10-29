# ADR 0006：视觉只继承宿主语义令牌，不造配色

- 状态：已接受（2026-10-29）
- 决策对象：`abilities/plugins/novelwright/src/style.css` 与 `src/features/**/components/**`
- 依据：[styling-and-pitfalls.md](../../../../../open-astravia/packages/plugins/plugin-sdk/docs/styling-and-pitfalls.md)、[open-astravia/docs/theme](../../../../../open-astravia/docs/theme/README.md)

## 1. 背景

要求是「主题色与 open-astravia 保持协调」。宿主把外观做成可替换的主题系统
（`packages/theme-sdk` / `theme-ui` / `themes/builtin/*`，内置有 Xianxia 等），颜色是运行时
CSS 变量，用户随时可能换主题。插件如果自带十六进制色板，换主题时它会成为屏幕上唯一一块
不合群的色块。

## 2. 决策

1. **只用语义工具类**：`bg-background`、`bg-card`、`text-foreground`、`text-muted-foreground`、
   `border-border`、`bg-primary`、`bg-accent`、`ring-ring`。不出现 `#hex`、不出现
   `rgb()`、不出现自定义色名（`slate-*` / `zinc-*` 一律不用）。
2. **不导入 Desktop CSS，不写 `@theme`。** `astraviaPluginFederation` 已自动注入
   `@astravia-org/plugin-sdk/tailwind-theme.css` 的 token 契约，重复声明会和宿主抢定义。
3. **层级用不透明度与边框表达，而不是阴影色**：`border-border/60`、`bg-muted/40`。阴影只在
   浮层用 `shadow-sm`，避免在浅色主题里糊成一团。
4. **密度与圆角对齐宿主**：面板圆角 `rounded-lg`（12px 档），组内元素 `rounded-md`，
   区块间距 `gap-3` / `p-4`，列表行高 `h-9`。标题层级 `text-sm font-medium` /
   `text-xs text-muted-foreground`，不引入第三种字号。
5. **状态色只用于状态**：`draft` 灰、`reviewed` 主色、`committed` 成功色、
   `blocked` 危险色。主色块（如当前章）不加渐变、不加发光。

## 3. 与「参考 ainovel-cli 的 TUI」的界限

上游是终端界面，用色块与 ASCII 表达阶段。插件不复刻它的视觉，只复刻**信息结构**：
左侧作品轨道、中部章节看板、右下发阶段时间线。视觉语言按宿主走，结构语言按上游走。

## 4. 后果

- 换任何宿主主题（含深色、Xianxia）都不需要改插件 CSS。
- 代码审查有一条可机械检查的规则：`src/**/*.tsx` 里出现 `#` 开头的颜色字面量即视为缺陷，
  由 `test/manifest-guards.test.ts` 的 `visual language stays on host tokens` 一组扫描。
