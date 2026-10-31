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
> **补注（`@theme inline`，2026-10-31，0.4.10）**：§2 第 2 条的「不写 `@theme`」收窄为
> 「不写**裸** `@theme`」。工作台改用设计稿的纸面配色（`ui-mock/mahua-novel-studio.astravia-design/theme.css`），
> 需要一个 token 层把取值映射成工具类（`bg-raised`、`text-ink-soft`、`rounded-sheet`…）。
>
> 做法是 `@theme inline { … }`：
>
> - `inline` 只把取值内联进本插件的工具类，**不向 `:root` 发射变量**，宿主那边看不到任何新增定义，
>   §2 第 2 条要防的「和宿主抢定义」因此不成立；
> - 不重声明宿主已占用的名字：`card→raised`、`muted→ink-soft`、`faint→ink-faint`、`accent→cinnabar`、
>   `success/warning/danger→pass/wait/fail`、`rounded-card→rounded-panel`、`shadow-card→shadow-raise`；
>   改名表写在 `src/style.css` 文件头，守卫另有一条正则专门挡宿主同名 token。
> - `font-sans` / `font-serif` / `font-mono` 不重声明，`--font-display` 只做降级栈
>   （`"Fraunces Variable", ui-serif, "Songti SC", "Source Han Serif SC", "Noto Serif CJK SC", serif`），
>   不新增字体依赖。
>
> §4 的机械检查因此换了形状：颜色字面量仍然不许出现在 `src/features/**`（`Cover` 的调色板走
> `style.css` 的 `.mahua-cover[data-layer]`）；`@theme` 的断言改成「不许裸 `@theme {`、必须 `@theme inline`、
> 不许重声明宿主 `--color-*` 名」。同理，纯 CSS 段不能用 `var(--color-*)`（`inline` 不发射变量），
> 只能用字面值——这一条写在 `style.css` 注释里。

