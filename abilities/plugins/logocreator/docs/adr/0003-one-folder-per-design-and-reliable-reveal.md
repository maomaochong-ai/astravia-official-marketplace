# 0003 — 一次设计一个目录，并且真的把画布打开

- 状态：已采纳
- 日期：2026-11-22
- 版本：0.8.0
- 相关：0001（面板身份与 tab 可靠性）、0002（权限被拒不空白面板）

## 背景

用户的两条反馈是同一次运行的两个面：

1. 在对话里用完之后，**tab 没有自动打开**设计画布；
2. 对话在项目里留下的**目录很零乱**，不像参照的宿主内置设计插件那样「启动引擎 → 自动打开画布」。

## 真因

### 自动打开

`revealInCanvas` 只在调用**抛错**时才补一次带 cwd 的重试：

```ts
try { ctx.ui.setActivityTabVisible(id, true) } catch { retryWithCwd() }
```

而宿主对「cwd 与前台会话不匹配」通常是**静默无操作**，不抛错 —— 重试永远不触发，
工具却按「没抛错」报告成功。同时 SDK 文档明确写着：tool handler 应当显式传自己的 cwd
（省略 cwd 表示「宿主当前显示的会话」）；参照插件的工具也是
`setActivityTabVisible(id, true, { cwd: session.cwd })` + `openActivityTab(id, { width: "max", cwd: session.cwd })`。
我们恰好只做了另一半。

### 目录

上一版的产物形状：

```
<cwd>/logos/<slug>/<slug>.svg          ← 这次的第 1 个变体
<cwd>/logos/<slug>/<slug>-2.svg        ← 第 2 个
<cwd>/logos/<slug>/<slug>-3.svg
<cwd>/logos/<slug>-brand-kit/logo.svg …（十几个文件）
```

一次对话在项目根留下**两个平级目录**、十几到二十个散文件；同一个品牌再跑一次会往同一层覆盖混杂；
面板与后续工具只能靠猜目录里有什么。参照插件用的是另一种模型：一份设计 = 一个
`*.astravia-design/` 目录 + 里面一份 `design.json`，画布读目录，不读散文件。

## 决策

### D1 打开画布：两种目标各调一次，不靠异常做判据

```
① setActivityTabVisible(id, true, { cwd: 工具会话 })   ← SDK 对 tool handler 的约定
② setActivityTabVisible(id, true)                      ← 前台会话
③ openActivityTab(id, { width: "max", cwd: 工具会话 })
④ openActivityTab(id, { width: "max" })
```

同一个 tab 重复打开是幂等的；四次调用各自 try，任一抛错只记录、不中断其余。
`opened` 的含义从「没抛错」收紧为「所有尝试都没抛错」，并且面板侧还有两道兜底（pending 认领、
跟随最新 AI 设计）。pending id 仍写两份作用域。

### D2 产物：一个品牌一个目录 + 一份清单

```
logo-designs/<slug>/
  design.json          spec、调色板、每个变体（文件/主题/seed/风格/引擎）、套件清单、时间
  mark.svg             主变体，取用不必数序号
  variants/1.svg …     每次生成的变体各自一个文件
  kit/…                品牌套件全部产物（仅跑过 brand_kit 后出现）
```

- `design.json` 是**合并写**：第二次生成只追加变体、更新 spec，不抹掉上一次；
  套件只在真的产出时替换。变体台账上限 24 条，文件本身不删；
- 清单坏掉/版本不认识时按「不存在」处理，不抛；
- `directory` 参数仍可覆盖根目录名（默认 `logo-designs`），相对路径、去分隔符。

### D3 让对话里的 agent 也知道这个约定

`logocreator_design` / `logocreator_brand_kit` 的描述与路由块都写明目录形状，
并明确「不要把 SVG 散在项目根、不要另建导出目录」——否则 agent 会自己发明路径，
目录迟早再乱一次。

## 后果

- 一次对话在项目里只多一个 `logo-designs/`，里面每个品牌一个目录；
- 同一个品牌反复迭代落在同一处，历史变体可查（清单 + 文件都在）；
- 面板与后续工具有一份机器可读的真相，不必扫目录；
- 自动打开有两条真实路径覆盖宿主的不同实现，且失败仍会被报告。

## 不做什么

- **不读清单来恢复画布**：这一版仍以面板历史（插件存储）为准；清单目前服务于「项目里有人看」。
  下一步如果要做「打开文件夹里的设计」，那才是读清单的时机；
- **不为 AI 生图另建目录**：raster 产物在宿主 blob 里，落盘只会重复一份字节；
- **不删除旧的 `logos/` 目录**：它可能已被用户引用；新版不再写它，用户可自行清理。

## 验证

| 项 | 结果 |
| --- | --- |
| `tsc --noEmit` | 通过 |
| `vitest run`（插件） | 33 文件 / 245 条通过（本轮 +11） |
| `canvas-reveal.test.ts`（4 条） | 带 cwd / 不带 cwd 各调用一次；无 cwd 时只调前台；两份作用域都拿到 id；抛错仍继续打开 |
| `design-folder.test.ts`（10 条） | 根目录与品牌目录、`variants/N.svg`、清单读回、二次运行合并、上限、坏文件按缺失、写前建目录；两个工具的源码不再出现平铺路径与 `-brand-kit` |
| 实机：对话生成 → tab 自动打开、目录形状 | **NOT RUN**（工作区无可用 Desktop） |

实机验收：在一个有工作区的会话里让 agent「做三个 logo」→
① 面板应自己弹出并停在最新设计；② 项目里应只有 `logo-designs/<slug>/`，内含 `design.json`、
`mark.svg`、`variants/1..3.svg`；再让它出品牌套件 → 产物全部落在同一目录的 `kit/` 下，
`design.json` 里出现 `kit.files`。
