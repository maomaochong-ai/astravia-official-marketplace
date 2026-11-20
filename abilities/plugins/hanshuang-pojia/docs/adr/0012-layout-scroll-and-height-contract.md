# 0012：布局的三条硬契约——谁滚、谁不缩、上限多高

- **状态：** 已接受
- **日期：** 2026-11-20
- **背景：** 「文字被遮挡」「笔记本上底部卡片看不到」「拖动方向相反」三件事一起报上来，逐个修会一直复发；它们其实是同一个东西：面板没有写清滚动与尺寸的责任归属。
- **适用：** `src/style.css`、`src/features/workbench/components/**`、`scripts/check-layout.mjs`

## 问题

面板的纵向尺寸由三层共同决定：`main.fb-main`（滚动容器）、`div.fb-page`（flex 列）、卡片。三层都参与收缩计算，于是「装不下」时浏览器不会滚，而是把卡片压扁：

| 现象 | 直接原因 | 证据 |
|---|---|---|
| 卡片正文在中途消失，看不到底部 | `.fb-page` 的子项默认 `flex-shrink: 1`，长页面时被压到 0 | `src/style.css` 里当时只有 `.fb-page > * { min-width: 0 }`，没有任何收缩约束 |
| 笔记本上整个页尾不可达 | 压扁后没有溢出，`.fb-main` 无内容可滚 | 同上；`overflow-y: auto` 存在但滚动高度 = 可见高度 |
| 侧栏越拖越窄 | 把手声明 `side="left"`，数学按「往左才变宽」算 | 旧代码 `onChange(side === "left" ? start - delta : start + delta)` |
| 拒答卡看着像被裁 | 探测记录 `rows` 为空时 `<tbody>` 渲染零行，只剩表头与页脚 | `probe-refusal-card.tsx` 空态缺失 |

第四条不是布局 bug，但用户看到的是同一句话「文字显示不全」，所以一并归到本 ADR：**空数据结构必须有空态，不能让容器自己塌成一条缝。**

## 决定

### D1 滚动由 `main` 负责，卡片不许收缩

```css
.fb-page > :not(.fb-fill):not(.fb-fill-scroll) { flex: 0 0 auto; }
```

- 内容高于面板 → `.fb-page` 装不下，`main` 滚；
- 内容矮于面板 → `.fb-page` 的 `flex: 1 1 auto` 撑到底，不留白；
- 只有标了 `.fb-fill` / `.fb-fill-scroll` 的那一张卡吃剩余高度并在内部滚。

这条规则必须写在 `.fb-page > *` 之后，否则被后者的 flex 简写覆盖。

### D2 高度上限一律 `min(px, vh)`，四档

| 变量 | 值 | 用途 |
|---|---|---|
| `--fb-h-xs` | `min(168px, 22vh)` | 反汇编清单、报告小节、错误栈 |
| `--fb-h-sm` | `min(220px, 30vh)` | 拒答对照表、导入菜单 |
| `--fb-h-md` | `min(280px, 38vh)` | 自检表、注入脚本正文 |
| `--fb-h-lg` | `min(320px, 44vh)` | 反汇编正文 |

宽屏取 px（视觉稳定），矮屏取 vh（一定看得到底）。此前散落 132/168/180/220/240/280/320/160/256 共九种硬值。

### D3 列数用 `auto-fit`，不用硬档位

统计条与卡片网格统一 `grid-cols-[repeat(auto-fit,minmax(130–260px,1fr))]`；只有「宽了就两列」的容器查询写法（`@min-[560px]:grid-cols-2`）允许保留，因为它本身就是自适应的。

### D4 标题只在顶栏出现一次

面包屑里的当前页名是全页唯一可见标题，`PageHeader` 的 `h1` 改为 `sr-only`，只留描述与动作。理由：两行同样的字白占一行高度，而矮屏上这一行就是最后一张卡被顶出去的那一截。

### D5 空态代替空容器

列表/表格拿到 0 行时必须渲染一句说明（`probe.rowsEmpty` 这类键），不许输出只有表头的空表——空表在视觉上与「被裁掉」不可区分。

### D6 `side` 的语义是「栏在把手的哪一边」

`nextWidth(startValue, deltaX, side, min, max)` 抽成纯函数：`side="left"` 向右拖变宽，`side="right"` 向右拖变窄。抽出来的原因很直接——方向错了只能靠算才能确认，靠手拖会以为是自己抖。

## 不做什么

- **不做「每页一张 `.fb-fill` 卡」的统一改造。** 表单页与详情页没有天然的单一滚动区，硬套会让卡片被拉成整屏。
- **不改对话框的 `max-h-[7x–88vh]`。** 它们本来就是视口相对且有内部滚动，是正确写法。
- **不引入 CSS-in-JS 或布局库。** 三条契约靠 20 行 CSS 与一条门禁守住，加依赖是净损失。
- **不把门禁做成「猜意图」。** 它只拦四类确定写法：裸 `truncate` 无 title、`h-6..h-11` + `overflow-hidden`、`max-h-[Npx]` 非对话框、裸 `grid-cols-2..9`。
- **不因为侧栏拖拽修好了就顺手改最小/最大宽度。** `SIDEBAR_MIN` / `SIDEBAR_MAX` 是另一件事。

## 验证

已有：

| 用例 | 钉住什么 |
|---|---|
| `src/test/workbench/split-handle.test.ts` | 两个方向的符号、边界钳制、整像素取整 |
| `src/test/workbench/layout-contract.test.ts`（第 5 条） | `.fb-page` 子项不收缩 + `.fb-main` 是滚动容器 |
| `src/test/workbench/import-menu.test.tsx` | 预制模板并入导入菜单、同正文不重复插入、本地入口可达 |
| `scripts/check-layout.mjs --strict` | 四类裁切写法 + 三条 CSS 契约（缺一条就非零退出） |

待补：

- 无浏览器环境下的真实回流断言（jsdom 不算布局）。矮屏行为目前由「CSS 契约 + 门禁」保证，不是实测像素。
- macOS / Linux 上的字体度量差异仍未实测，只按字体栈推断。
