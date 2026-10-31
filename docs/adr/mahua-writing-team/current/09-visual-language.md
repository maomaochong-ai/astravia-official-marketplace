# 09 · 视觉语言

> 现行文本。归并自 [0006](../0006-host-tokens-only-visual-language.md)、
> [0011](../0011-workspace-anatomy-matches-host-agent-panel.md)（样式部分）、
> [0016](../0016-empty-shelf-and-reader-type-scale.md)（字号）、
> [0020](../0020-library-surface-and-default-cover.md)（封面）、
> [0024](../0024-ui-round-reader-library-covers-and-activation-facts.md)（界面）、
> [0026](../0026-design-round-five-surfaces-and-host-tokens.md)（令牌）、
> [0028](../0028-cards-roster-and-activation-design-language.md)、
> [0029](../0029-paper-language-no-hairlines.md)。2026-10-31 按 0.4.19 核对命中数。

## 一句话

一张纸的五个明度、三档墨、一条朱砂；抬起的卡靠阴影，不靠描边。

## 一、纸面

| 令牌 | 浅纸取值 | 用在哪 |
| --- | --- | --- |
| `canvas` | `#efe7d7` | 托底与缝：外壳底色，圆角外那一圈 |
| `chrome` | `#f2ebdc` | 报头与竖栏的底 |
| `surface` | `#fbf7ee` | 主区纸面（`main`） |
| `raised` | `#fffdf8` | 抬起的卡与面板 |
| `inset` | `#f4edde` | 压下去的槽、内嵌列表 |

相邻两档只差 3–4%。这点差就是全部层次——**不要再用边框补**。

## 二、规矩

1. **只用令牌，不写字面色值**。取值全部经 `--mahua-*` 间接：`@theme inline` 只把变量内联进
   本插件的工具类，不向 `:root` 发射变量，因此不改写宿主 token。
2. **避开宿主已占的名字**：`primary` / `accent` / `card` / `foreground` / `muted` / `ring` 是
   宿主桥上的名字，插件用 `raised`（抬起的纸）、`cinnabar`（朱砂）、`ink-soft` / `ink-faint`（墨的深浅）。
3. **卡片无描边**：`bg-raised` + `shadow-raise`。`border` 只出现在表头、分隔线、输入框与
   一枚描边按钮上。`grep -rn "shadow-sm" src/features` 应为 0。
4. **主按钮是墨底**（`bg-ink text-surface`）。`bg-primary` / `bg-accent` 零命中。
5. **朱砂只给三件事**：落款、当前章、正在写的那一笔。它不是强调色，是戳。
6. **字体三栈**：标题 `font-display`（Fraunces，缺位退宋体）、界面字沿用系统栈、数字用等宽。
   台账表头用小字距无衬线，不用等宽。
7. **圆角四档**：`rounded-tile` 6 / `rounded-control` 9 / `rounded-panel` 13 / `rounded-sheet` 18。
   纸是 `sheet`，卡是 `panel`，按钮是 `control`，标签是 `tile`。
8. **字号阶梯按用途命名**（`text-hero` / `display` / `title` …），正文一档从 20 起；
   阅读页另有五档（`reader.*`），因为它面对的是读一小时的人，不是扫一眼的人。
9. **深色跟随宿主**：`.mahua-root[data-mahua-mode="dark"]` 只换取值，不重新生成类。
10. **图标用 Iconify 类名**（`icon-[lucide--*]` / `icon-[solar--*]`），依赖 `@iconify-json/{lucide,solar}`
    随包离线解析。不引 SVG 组件库。

## 代码落点

```text
src/style.css                     @theme inline 令牌 + .mahua-root 取值 + 44px 竖栏降级
components/shell/Cover.tsx        封面的五档尺寸与纸色叠层
components/shell/*.tsx            外壳的圆角与投影
components/pages/*Page.tsx        各页的纸面层次
```

## 代价与边界

- 五个明度的纸在小尺寸屏幕上会糊成一片。这是密度换层次的代价，靠字号与留白补，不靠加线。
- `@theme inline` 意味着**工具类只能在本插件子树里用**。挂到 `.mahua-root` 之外会退回
  fallback 字面量（设计稿浅色），不会变透明——这是有意的兜底。
- 插件 CSS 不得作用于宿主：全部选择器以 `.mahua-root` 或 `@scope` 收口。

## 怎么验证

```bash
cd abilities/plugins/mahua-writing-team
grep -rn "bg-accent\|bg-primary" src/features | wc -l   # 期望 0
grep -rn "shadow-sm" src/features | wc -l               # 期望 0
grep -c "^	--color-" src/style.css                      # 令牌条数
```
