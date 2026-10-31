# 09 · 视觉语言

> 现行文本。归并自 [0006](../0006-host-tokens-only-visual-language.md)、
> [0011](../0011-workspace-anatomy-matches-host-agent-panel.md)（样式部分）、
> [0016](../0016-empty-shelf-and-reader-type-scale.md)（字号）、
> [0020](../0020-library-surface-and-default-cover.md)（封面）、
> [0024](../0024-ui-round-reader-library-covers-and-activation-facts.md)（界面）、
> [0026](../0026-design-round-five-surfaces-and-host-tokens.md)（令牌）、
> [0028](../0028-cards-roster-and-activation-design-language.md)、
> [0029](../0029-paper-language-no-hairlines.md)。2026-10-31 按 0.4.21 核对：取值已全部改成从宿主
> 令牌派生（0031 §6），本文不再列写死的色号。2026-11-01 按 0.4.23 改成视觉 v2：凹槽与淡洗面
> 单独成对（`wash` / `well`），页面与卡片走语义类（`mahua-page` / `mahua-card` / `mahua-well`），
> 间距一个角色一个数（0033 §1–§4）。

## 一句话

一张纸的五个明度加两道洗面、三档墨、一条朱砂——全部从宿主令牌推出来；层次靠圆角容器的
嵌套与阴影，不靠描边。

## 一、纸面

五级明度与两道洗面全部是算式，不是色号（`src/style.css` 的 `.mahua-root`）：

| 令牌 | 从哪里来 | 用在哪 |
| --- | --- | --- |
| `canvas` | `--card` 混 6% `--foreground`（浅）/ `--background`（深） | 托底与缝：外壳底色，圆角外那一圈 |
| `chrome` | `--background` 混 3% 前景 / `--card` 混 6% | 报头与竖栏的底 |
| `surface` | `--card` | 主区纸面（`main`） |
| `raised` | `--background` / `--card` 混 12% 前景 | 抬起的卡与面板 |
| `inset` | `--card` 混 7% 前景 / 混 16% 底 | 骨架屏与徽记这种「贴在纸上的一小块」 |
| `well` | `--card` 混 4% 前景 / 混 4% 底 | 卡内凹槽：表头条、行组、脚注、输入区 |
| `wash` | 前景混 5%（透明底） | 卡内 hover |
| `wash-strong` | 前景混 9%（透明底） | 按下 / 选中 / 进度槽 |

相邻两档只差 3–6%。这点差就是全部层次——**不要再用边框补**。

`wash` / `wash-strong` 是**透明**的前景叠层，不是另一张纸：它们坐在 `surface` 上就是略深的纸，
坐在 `well` 里就是更深的槽。因此同一个 `hover:bg-wash` 在卡上与在槽里都成立，不用为每种底色
再配一个 hover 色（旧写法里那批 `hover:bg-canvas` / `hover:bg-inset/60` 就是这么长出来的）。

浅色实测（宿主默认主题）：`canvas #ebebeb` < `chrome #f7f7f7` < `surface #fafafa` <
`raised #ffffff`，`inset #e6e6e6`。深色同理，只是 `raised` 反过来比 `surface` 亮一点——
所以抬起的卡两色都靠 `shadow-raise` 撑着。

## 二、规矩

1. **只用令牌，不写字面色值**。取值全部经 `--mahua-*` 间接：`@theme inline` 只把变量内联进
   本插件的工具类，不向 `:root` 发射变量，因此不改写宿主 token。
2. **避开宿主已占的名字**：`primary` / `accent` / `card` / `foreground` / `muted` / `ring` 是
   宿主桥上的名字，插件用 `raised`（抬起的纸）、`cinnabar`（朱砂）、`ink-soft` / `ink-faint`（墨的深浅）。
3. **页面里不画分隔线**：卡内分段用 `gap` + `bg-well` 凹槽块，不用 `border-t` / `divide-y`。
   剩下的 `border` 只有两类：空心圆点（`border-line-strong` 画 6px 的空心标记）与输入框。
   守卫测试 `draws pages with containers instead of hairlines` 扫 `pages/**`，只放行前者。
4. **主按钮是墨底**（`bg-ink text-surface`）。`bg-primary` / `bg-accent` 零命中。
5. **朱砂只给三件事**：落款、当前章、正在写的那一笔。它不是强调色，是戳。取值是
   `--primary`（0028 §1），不是自己一个写死的色号——宿主主色变，戳跟着变。
6. **字体三栈**：标题 `font-display`（Fraunces，缺位退宋体）、界面字沿用系统栈、数字用等宽。
   台账表头用小字距无衬线，不用等宽。
7. **圆角四档**：`rounded-tile` 6 / `rounded-control` 9 / `rounded-panel` 13 / `rounded-sheet` 18。
   纸是 `sheet`，卡是 `panel`，按钮是 `control`，标签是 `tile`。
8. **字号阶梯按用途命名**（`text-hero` / `display` / `title` …），正文一档从 20 起；
   阅读页另有五档（`reader.*`），因为它面对的是读一小时的人，不是扫一眼的人。
9. **深浅交给 `light-dark()`**。宿主在 `:root,[data-mode="dark"]` 与 `[data-mode="light"]` 上都设了
   `color-scheme`，它会继承进插件子树；`.mahua-root` 把两支取值写在同一个 `light-dark()` 里，
   插件不再自己判断模式（`data-mahua-mode` 与 `use-host-mode.ts` 已删）。
10. **图标只用一个族**：全部 `icon-[solar--*]`，随包由 `@iconify-json/solar` 离线解析，不引 SVG
    组件库。旧写法混用过 `lucide--`，同一个按钮相邻出现两种笔画粗细就露馅——守卫测试断言
    `src` 里不再出现 `lucide--`，且每个 `icon-[…]` 都是 `icon-[solar--<name>]` 的形状。
    字重按尺寸分档：`size` ≥ 3.5、导航项与主按钮用 `-bold`；`size` ≤ 3 的行内注记用 `-linear`。
    Solar 没有 `plus-*` / `chevron-*` / `book-open` / `activity` / `scroll-text`，对应换成
    `add-circle-*` / `minus-circle-*` / `alt-arrow-*` / `notebook-*` / `pulse-*` / `document-text-*`。
11. **文字退让三件套**（0032 §2）：截断写 `truncate`，flex 子项再补 `min-w-0`（`min-width:auto`
    会让它拒绝收缩，整行溢出后被祖先 `overflow-hidden` 裁切、右侧元素被顶出去——这是「文字被遮住」
    的系统性根因）；带 `truncate` 的行用 `items-center`，不用 `items-baseline`（`overflow:hidden`
    子项的基线由 border box 合成，两者一碰就垂直错位）。
12. **表格丢列，不压字**。表头与行共用一份列定义（`pages/library-columns.ts`），每档模板的轨道数
    必须等于该档可见单元格数：多出来的子项会被 grid 自动排布塞进隐式第二行。守卫测试逐档核对。
13. **窄宽堆叠用 `@min-[…]` 正向声明**：基础态就是窄态，避免一层层 `@max-` 向下覆盖；
    「标签 + 值 + 右注记」一类行靠 `flex-wrap` + `gap-x/gap-y` 兜底。
14. **间距一个角色一个数**（0033 §4）：页边 `--mahua-page-pad`（20/24，窄容器 16/16/12）、
    容器之间 `--mahua-gap`（12，即 `gap-3` / `mt-3`）、卡内 `p-4`、凹槽内 `px-3 py-2`。
    页面根写 `mahua-page`，纸面容器写 `mahua-card`，凹槽写 `mahua-well`——三个语义类
    （`@layer components`）就是这三档数值的唯一来源，页面里不再逐页写 `px-7 pb-5 pt-6`。
15. **从凹槽里浮起来 = `bg-raised` + `shadow-raise`**。凹槽（`bg-well`）里可点的东西只有两种
    状态词：选中 `bg-raised shadow-raise`（真的抬起来），按下 / 激活 `bg-wash-strong`。
    从前用「黑底反白」（`bg-ink text-surface`）做筛选选中，全页因此有四块黑块在打架；
    现在黑色只留给主按钮。
16. **封面也不写色号**（0033 §3）：`--cover-bg` / `--cover-ink` / `--cover-band` 全部从
    `--mahua-raised` / `--mahua-ink` / 朱砂混出来。米色 hex 在宿主 mono 主题下会「发黄、跟不动」。

## 代码落点

```text
src/style.css                     @theme inline 令牌 + .mahua-root 取值 + 44px 竖栏降级
                                  + .mahua-drag / .mahua-traffic-lights（全屏标题栏）
components/shell/Cover.tsx        封面的五档尺寸与纸色叠层
components/shell/*.tsx            外壳的圆角与投影
components/pages/*Page.tsx        各页的纸面层次
```

语义类在 `src/style.css` 的 `@layer components`；它们必须坐在 utility 之下，否则页面上的
`p-4` / `mt-3` 修不掉默认值。页面根、卡、凹槽三处各有守卫测试盯着。

## 代价与边界

- 五个明度的纸在小尺寸屏幕上会糊成一片。这是密度换层次的代价，靠字号与留白补，不靠加线。
- `@theme inline` 意味着**工具类只能在本插件子树里用**。挂到 `.mahua-root` 之外会退回
  fallback 字面量（设计稿的米纸），不会变透明——这是有意的兜底。
- 插件 CSS 不得作用于宿主：全部选择器以 `.mahua-root` 或 `@scope` 收口。

## 怎么验证

```bash
cd abilities/plugins/mahua-writing-team
grep -rn "bg-accent\|bg-primary" src/features | wc -l   # 期望 0
grep -rn "data-mahua-mode=\|use-host-mode" src | wc -l      # 期望 0
grep -c "light-dark(" src/style.css                        # 深浅两支的处数
grep -rn "shadow-sm" src/features | wc -l               # 期望 0
grep -c "^\t--color-" src/style.css                      # 令牌条数
grep -rn "lucide--" src | wc -l                            # 期望 0（图标只用一个族）
grep -rn "border-t\|divide-y" src/features/workbench/components/pages | grep -vc ":[0-9]*: *\*"  # 期望 0（先剥掉注释行）
grep -rl "mahua-page" src/features/workbench/components/pages | wc -l  # 期望 7（每页一面纸）
```
