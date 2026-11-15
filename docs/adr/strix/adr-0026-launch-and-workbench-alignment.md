# ADR 0026：首屏与工作台的第二轮对齐（1.5.0）

- 状态：已采纳
- 日期：2026-11-15
- 关联：[ADR 0022](adr-0022-composer-is-bidirectional.md)、[ADR 0023](adr-0023-launch-is-honest-config-talk-and-paths.md)、[ADR 0024](adr-0024-backdrop-is-drawn-not-downloaded.md)
- 取代：无

## 背景

1.4.1 之后又一轮集中反馈，十四件。其中四件是**功能坏了**（不是样式），逐条查了根因：

1. 从插件发一句话，宿主开始对话，插件却停在首屏；
2. 宿主用插件发，或插件发到宿主，面板状态不同步；
3. 侧栏还带着上一个会话的发现/笔记（串会话）；
4. docker 模式下「安装位置」永远不出现。

## 四个根因

| 现象 | 根因 | 证据 |
|---|---|---|
| 发出去不跳工作台 | `belongsTo(null, id)` 返回 **false**：面板在新会话页挂载时 `mountedIn` 是 null，宿主随后建出会话，**那一轮所有事件被丢掉**（turn-start 收不到） | `session-store.ts` 原实现；`test/session-store.test.ts` 原来还断言这个行为 |
| 同上（第二层） | 换会话的 rebind 用快照的 phase 覆盖当前 phase；新会话没有快照 → 退回 `setup`，即便宿主正在跑 | `use-strix-session.ts` 的 rebind effect |
| 状态不同步 | 缓存修好之后仍只在 turn-end / tool-end 刷新；turn-start 没有刷新，于是宿主刚开跑时侧栏还是旧的 | 同上 subscribe 分支 |
| 串会话 | 服务只有一个沙箱；`refresh()` 在沙箱属于别的会话时**只跳过采纳、不清空**，于是 A 的发现/笔记/覆盖留在 B 的侧栏 | `refreshNow` 的 foreign 分支 |
| docker 安装位置不出现 | `/api/state` 的 `environment` 用的是 `resolveEnvironment(image)`（默认 auto），与用户选的 docker 无关；面板据此判断 "mode=host → 不请求安装位置" | `service/main.ts` 的 `environment()` |

## 决定

### 1. 未绑定的面板接受第一个真会话

`belongsTo(null, id)` → true。语义写清：**null 表示"还没绑"，不是"绑了一个空会话"**。
原来那条 false 把"面板刚打开、宿主刚建会话"这一整段挡掉了。

### 2. 换会话不降级正在跑的 phase

rebind 时 `phase = conversation.isStreaming ? "scanning" : snapshot?.phase ?? "setup"`。
宿主在跑就是工作台——这是"面板跟着现场走"的唯一诚实解释。

### 3. 外部沙箱：不采纳，并且清空

`foreign` 分支现在清 findings / todos / notes / coverage / sessions / scope / candidates。
宁可显示"还没有"，也不显示别人的。

### 4. turn-start 也刷新

缓存之后 `/api/state` 是 18ms；每轮开始时读一次，换来的是"宿主一开跑，侧栏就是这一轮的"。

### 5. 环境按偏好解析

`environment()` 读 `preferences.environmentMode`；显式 `docker` 而 auto 的缓存结果是 host 时，
按 docker 再解析一次。于是面板拿到的 `mode` 与下拉一致，「安装位置」才会出现。

### 6. 面板侧的十四项（其余）

- **免责声明**改成六条项目符号（长段被跳读，条目会被看完）；
- **代码雨**：首屏 46→72 列、字号 10.5→13px；工作台 58→40 列（它后面是要读的字）；
- **标题与描述**与对话框同轴：wordmark 用 `margin-inline: auto`（父级 text-align 对等宽块无效）；
- **输入框光带**：两屏共用 `.astra-strix-prompt`，渐变描边 + 呼吸（只动 opacity，走合成层）；
- **默认环境 auto**（面板与服务两处），并且打开面板时读一次服务端偏好把下拉摆对；
- **删掉首屏「技能库」那一行**：界面恒为 0，没有信息量；
- **状态带分项加冒号**（`目标: 3`），间距统一；
- **侧栏列表上限 8 → 24** 并给滚动上限：原来第 8 行就写"还有 N 行"，而侧栏本来能滚；
- **历史报告可点开**：`/api/report?key=` 读 `reports/<key>.md` 留档，面板内弹层预览；
- **关键信息渲染增强**：摘要每轮 6→10 行、每行 140→200 字，列表项/标题本身算信号；
- **流式期间不静止**：每 400ms 把"最后一句"贴成一行 live 摘要，完整答复到达时替换；
- **性能**：页面切到后台时暂停雨/极光/扫光/环（`data-quiet`）；噪点去掉 `mix-blend-mode`（overlay 每帧重混合整屏）；工作台雨列数下调。

## 代价

- 侧栏一次最多画 24 行：条目很多的评估仍会截断，但会写清"还有 N 行"，且列表自己能滚。
- live 摘要每 400ms 一次 `setState`：一轮十几秒就是二三十次渲染。已经是最小代价——
  它换来的正是"面板看起来没罢工"。
- 后台暂停有代价：切回来时动画从暂停点继续，观感上会"顿一下"。比持续占用好。

## 验证

- 单元：`session-store.test.ts`（未绑定接受第一个会话）、`conversation-isolation.test.ts`（外部清空）、
  `workbench-truth.test.ts`（流式摘要）、`launch-entries.test.tsx`（六条项目符号）、
  `skills-wired.test.ts`（11 类 75 篇与工具描述一致、library 里没有 SKILL.md）、
  `panel-navigation.test.ts`（新会话用当前项目的 cwd）。
- 全量：71+ 文件 / 462 项通过；`tsc` 干净；`check-service` tools=40。
- 真浏览器（1180/900/760/430/360）：wordmark 与 tagline 相对对话框中心偏差 **0px**；
  四个块左右边缘一致；免责声明 6 条；雨字号 13px；输入框光带在位；无横向溢出。
