# ADR 0028：卡片、团队行与激活页——设计语言收口的六处决定

- 状态：已接受（2026-10-30）
- 决策对象：`abilities/plugins/mahua-writing-team/src/features/`（重写
  `shared/components/{ActivationPanel,InstructionSummary}.tsx`、
  `studio/components/{InstructionCard,MemberRoster,CredentialChip,PhaseTimeline,NewBookForm}.tsx`；
  改 `studio/components/StudioWorkspaceView.tsx` 的凭证分支）、
  `locales/{en,zh}.json`（284 → 302 键）
- 依据：`ui-mock/mahua-novel-studio.astravia-design` 的 `frames/activation.tsx`（151 行）、
  `frames/book.tsx`（280 行）、`theme.css`、`components/*` 逐帧实读；
  宿主 `.tooling/open-astravia/apps/desktop/src/renderer/styles.css` 令牌实测；
  `@iconify-json/solar` 图标名逐个核对（8859 项）
- 延续：ADR 0006（只用宿主令牌）、0011（§2.1/§2.2 卡片与团队行）、
  0016（阅读字号五档）、0024 §5（凭证来源必须说清）、
  0025 §1（主/次按钮语义）、0026 §7（无 success/warning 令牌时的 tonal 降级）

## 1. 朱砂是 `primary`，不是 `accent`

`InstructionSummary` 的 worker 签原先写 `bg-accent text-accent-foreground`。它读起来正常，
但含义是错的：宿主 24 个别名里 `accent` 是**悬停面**（浅一档的灰），`primary` 才是设计稿的朱砂。
结果是一枚「灰底灰字」的小签，与设计里那枚朱砂小签不是一回事。

决定：朱砂一律 `primary`（浅底用 `bg-primary/10 text-primary`），`accent` 只留给宿主原生的悬停语义，
本插件各处 hover 统一写 `hover:bg-muted/60 hover:text-foreground`，不再用 `hover:bg-accent`。
依据是 `tailwind-theme.css` 的别名定义，与 `LibraryFilterRow` 选中态、`PageBar` 主按钮已有的口径一致。

## 2. 「下一步」卡片：设计稿没有这枚卡，按语言对齐而非照搬布局

`frames/book.tsx` 里没有成员行、也没有指令卡——两者是插件自有（ADR 0011 §2.1/§2.2）。
所以这两处**不做像素复刻**，只借设计的语言：13px 卡圆角、`border-border/60` + `shadow-sm` 抬一层、
标题用 serif、元信息用 9–10px 等宽小字、按钮 32px 高 / 9px 圆角。
主按钮取设计稿的墨底（`bg-ink` → `bg-foreground text-background`），次按钮是描边款（`border-border`）。

`outline-chapter` 的「开始写作」从主按钮降为次按钮：它不改状态，只是把章纲交给写作者，
主按钮该留给真正的推进动作。空态改成虚线描边（`border-dashed`），与书页的伏笔提示卡同一处理。

## 3. 团队行与凭证签：同高、同层、不抢标题

成员胶囊 24px 高、11px 正文，领队带 9px 等宽「lead」角标；凭证签也 24px 高，但走 10px 等宽字——
它是一枚状态签，不是按钮。两者都落在书页的元信息层，不会把 serif 标题压过去。
未激活时凭证签才升到警示层（`border-destructive/40 bg-destructive/10 text-destructive`）。

阶段时间线同步收窄到 20px 高、10px 字：当前格墨底反白，已过格浅纸色，未到格弱化。
宿主没有 success/warning 令牌（ADR 0026 §7），所以不追设计稿的绿/红语义，只做明暗三层。

## 4. 激活页：左牌按容器降级，失败清单只列真实三类

设计帧是左 420px 品牌牌 + 右 `max-w-[560px]` 表单。标签页最窄 400px，左牌在 `lg` 以下整块隐藏——
品牌信息让位给凭证输入框，而不是把两栏压成两条细柱。左牌收到 300px。
三条规矩、引语、脚注照设计稿的意思写，但**内容按本插件的事实改**：
凭证只依赖签名与到期（不读账号、不上报），到期前 30 天凭证签转为待处理。

设计稿的失败清单写 `expired` / `bad-signature` / `machine-mismatch`。本插件**不绑机器**，
`machine-mismatch` 永远不会出现；写上去就是承诺一个不存在的失败形态。故只列真实的三类：
`expired`、`signature-mismatch`、`unknown-key-id`，文案取自 `verifyEntitlement` 的实际 reason 集合。

同理，设计稿的「从文件导入」按钮没有对应能力（插件不读文件系统的凭证文件），
换成真实存在的动作「移除我的凭证」，且只在当前生效凭证来自用户自己时才出现。

## 5. 开书表单：去掉卡片边框，改成「一页纸」

原表单是「一个框里塞四个字段」。改为无边框竖排：书名是唯一的大输入（40px、serif 15px），
题材与前提各占一行，目标章数用三个 24px 档位芯片 + 一个 16 宽的数字框，
提交按钮占满宽度。字段标签统一 9px 等宽大写 + 0.12em 字距——这是设计稿里所有小标签的写法。

输入框底色从 `bg-transparent` 改为 `bg-card`：画布是 `bg-muted/40`，纸色输入框才立得起来。

## 6. 键与图标

locale 新增 18 键（`activation.*` 16、`instruction.title`、`board.step`），en/zh 同键数 302，
中文写在 `zh`，默认仍是英文。图标一律 `@iconify-json/solar`，且逐个用 `icons.json` 验名：
`shield-check-linear`、`key-minimalistic-linear`、`trash-bin-minimalistic-linear`、
`info-circle-linear`、`add-circle-linear`、`check-circle-linear`、`checklist-minimalistic-linear`、
`flag-2-linear`、`document-add-linear`、`arrow-right-linear`、`alt-arrow-left-linear`。
设计的 `lucide--*` 名无法离线解析，继续不采用。

## 7. 验证与未验证

已跑：`npx tsc --noEmit` 干净；`npx vitest run` 182/182；`npm run build` 成功（56 runtime files）；
`node scripts/marketplace.mjs check` 通过；`node --test tests/*.test.mjs` 80/80；
禁用模式复查 0 命中（`\bfixed\b` / `createPortal` / `#hex`+`rgb()`+`hsl()` / `z-[2147483647]` /
视图内 `<input`+`<textarea` / `sendPrompt`）。locale 键集相等且仍为制表符缩进。

未做：应用内视觉验证。`vitest.config.ts` 固定 `environment: "node"`，devDependencies 无
jsdom/testing-library（happy-dom 会破坏守卫测试里 `import.meta.url` 的用法），加依赖需要网络。
所以上述尺寸与层次都是**读设计稿推出来的**，真机观感需在桌面端「活动面板 → + → 插件」手动看一眼。
这一条是 Assumed，不是 Observed。
