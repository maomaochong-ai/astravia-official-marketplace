# ADR 0029 — 纸面语言：卡片靠阴影而不是描边

- 状态：已采纳
- 日期：2026-10-30
- 取代：无（补充 ADR 0026 §3 与 ADR 0028 §1 未覆盖的层次问题）
- 版本：0.4.5

## 1. 问题：设计稿里几乎找不到发丝边框

把设计稿的 `theme.css` 和插件现有类名并排放，差距集中在一点上：

```css
/* 设计稿 theme.css */
--color-canvas: #efe7d7;   --color-surface: #fbf7ee;  --color-card: #fffdf8;
--color-inset:  #f4edde;   --color-line-soft: #eee7d7; --color-line: #e4dbc6;
--shadow-card: 0 1px 2px rgb(34 30 23 / 0.05);
```

设计稿的层次是「底色 → 纸面 → 抬起的纸片」三级色阶，抬起只靠 `shadow-card`。
`border border-line` 在设计稿里只出现在三类地方：`line-strong` 的次按钮、输入框、封面。

插件此前在几乎每张卡上写 `border border-border/60 ... shadow-sm`，两层都错：
多了一条设计稿没有的发丝线，阴影又比设计稿重（`shadow-sm` 是
`0 1px 3px 0 rgb(0 0 0 / 0.1)`，比 `--shadow-card` 深一倍）。

## 2. 决定

1. **卡片一律不带边框**，只用 `bg-card shadow-xs`。
   宿主的 `--shadow-xs` 是 `0 1px 2px 0 rgb(0 0 0 / 0.05)`（`tailwindcss/theme.css:407`），
   几何与设计稿 `--shadow-card` 完全一致，只有色相与不透明度略差——这是可在宿主令牌内做到的最接近值。
2. **圆角分两层**：页面级纸面 `rounded-[18px]`（设计 `--radius-sheet`），
   嵌在里面的卡 `rounded-[13px]`（`--radius-card`）。控件 9px、chip 6px 不变。
3. **边框只留给**：次按钮（`border-border`）、输入框、chip / 胶囊、封面、虚线空态、面板内的分隔线。
4. **主按钮取墨底**：`bg-foreground text-background`。设计稿的主按钮是 `bg-ink text-surface`，
   朱砂只用于强调点、徽章、进度填充，从来不做按钮底色。此前 `LibraryShelf` / `BookDetail`
   仍用 `bg-primary`，与 ADR 0028 §1 自相矛盾，本轮一并改掉。
5. **`bg-accent` 继续禁止**：`StatusToolRow` 的阶段徽章与 `StatusPill` 的 `drafting` 还留着
   `bg-accent text-accent-foreground`（宿主的 hover 面），改 `bg-primary/10 text-primary`。

## 3. 页头：一行标题，返回在上

设计稿 `components/PageHeader.tsx`：

```tsx
<div className="flex items-end gap-4 pb-5">
  {back && <Link className="mb-2.5 inline-flex ...">…</Link>}
  <div className="flex items-baseline gap-3">
    <h1 className="font-display text-display font-semibold text-ink">{title}</h1>
    {meta}
  </div>
  <div className="ml-auto ...">{right}</div>
</div>
```

三处与插件不同，全部改掉：

- 没有下边框。插件原来有 `border-b border-border/50`，等于在页头下画了一条设计稿没有的线。
- 返回在标题**上方**独立一行，不是与标题并排的方块按钮。
- 元信息与标题**同基线**：容器 `flex flex-wrap items-baseline gap-x-3 gap-y-1`，
  这样各页面传进来的 `<p>{PAGE_META}</p>` 自然落到标题基线上，页面侧一行不用改。

标题字号 24/28 → **26/30**。设计 `text-display` 在 1440px 帧上是 34px；插件最宽 1000px，
按宽度等比会得到 24 左右，等于没改，所以取中间值。

## 4. 台账表头：无衬线小字距，不要等宽

设计稿台账表头是 `text-[10px] font-semibold uppercase tracking-[0.06em] text-faint`，**没有下边框**，
行分隔靠容器 `divide-y divide-line-soft`，书名 `font-display text-body-sm font-semibold`。

插件原来是 `font-mono text-[9px] uppercase tracking-[0.12em]` + 表头下边框 + 逐行 `border-b`。
改：表头去等宽与下边框，行改 `divide-y divide-border/40`，书名 `font-serif text-[13px] font-semibold`，
进度从「两行（条 + 百分比）」收成单行 `h-[3px]` + 9.5px 等宽百分比，
页脚翻页从带边框的按钮改成纯图标按钮（设计稿是裸 chevron）。

筛选栏组名同理：设计稿 `text-micro-up font-semibold uppercase tracking-[0.08em] text-faint` 是无衬线。

## 5. 阅读控件：读数，不是五个点

设计稿字号组是「槽里嵌纸片」的分段控件——`bg-inset p-px` 的槽，选中那格 `bg-card shadow-card`，
中间是等宽数字读数 `w-8 text-center font-mono text-[10px] tabular-nums`，两侧 `−` / `+` 图标。

插件原来是 `A−` · 五个圆点 · `A+` · 复位，四段文字按钮。圆点只能看出「到第几档」，
看不出「正文现在几号字」，所以换成读数：`[−] 20 [+]` 的分段槽 + 复位。
`READER_SCALES` 五档不变（ADR 0016），槽里读的就是档位对应的 px。

同时清掉这两个文件的 `hover:bg-accent hover:text-accent-foreground`——宿主 `accent` 是 hover 面，
当品牌色用会渲染成灰 chip（ADR 0028 §1 已记过一次，这里是漏网的副按钮）。

## 6. 有意保留的偏离

| 设计稿 | 插件 | 原因 |
| --- | --- | --- |
| 书架页头 `h-8 w-48` 搜索框 | 不放 | 视图内无输入框是硬约束（ADR 0011 §2.4），会话即搜索入口 |
| `StudioRail` 208px | `<lg` 图标栏 `w-11`，`≥lg` 188px | ADR 0027：400–1000px 的 tab 里 208px 侧栏吃掉太多正文 |
| 底部「写作者 正在写 · 2m 14s」计时 | 只留凭证状态 | 插件拿不到团队计时，写上去就是假数 |
| 书架右栏 430px | `xl:w-[330px]` | 同上，窄面板降级 |
| `WindowChrome` 红绿灯 | 不复刻 | 宿主窗口按钮由桌面端负责（ADR 0026 §2） |

## 7. 验证与未验证

已验证（Observed）：

- `npx tsc --noEmit` 无输出；`npx vitest run` 182/182；`npm run build` 通过；
  `node scripts/marketplace.mjs check` 通过；`node --test tests/*.test.mjs` 80/80。
- 禁用模式复查零命中：`src/features` 下无 `#[0-9a-f]{3,8}` / `rgb(` / `hsl(`、无 `fixed`、无 `createPortal`。
- `shadow-xs` 存在性在 `node_modules/tailwindcss/theme.css:407` 实证。

未验证（Assumed，不是 Observed）：

- **没有做应用内视觉验证**。`vitest.config.ts` 固定 `environment: "node"`，没有 jsdom / testing-library，
  加依赖要联网。所以「去掉发丝线后纸面仍然分得开」是从设计稿令牌推出来的，不是看见的。
- 深色主题下 `shadow-xs` 几乎不可见，卡片只能靠 `--card` 与 `--background` 的色差分层。
  这与 ADR 0026 §7 记过的是同一件事：纸面层次无法在深浅两种模式下同时正确，本轮选了忠于设计稿的一侧。
