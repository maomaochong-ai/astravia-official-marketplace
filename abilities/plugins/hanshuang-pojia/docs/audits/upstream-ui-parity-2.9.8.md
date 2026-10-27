# 界面与实时面板：与上游两份参考的对等审计（2.9.8）

对比对象：

- `~/Desktop/tmp/寒霜注入工具-1.0.0-便携版/源码`（Tauri 注入控制台，`src/components/{inject,promptWorkbench,shell,seep}`）
- `~/Desktop/tmp/hanshuang-pojia-2.0`（seep-kit 提示词与脚本装置）

本文只覆盖**界面与实时信息**这一层。提示词层、工具层、知识库层的对等结论见
`docs/audits/upstream-parity-audit-2.9.3.md`。

## 一、侧栏实时区（本次补齐）

上游 `src/components/shell/Sidebar.tsx` + `src/hooks/useSidebarStatus.ts` 的形态是：
每个导航项带一枚状态标记，底部汇总「今日花费 / Token / 请求数 / 缓存命中率 / 授权是否需要重新登录」。
其中用量与授权中心依赖上游自己的代理与账号体系（`proxyApi`、`authGetStatus`、`useUsageSummary`）。

本地没有代理层，也拿不到宿主的用量与账号接口，所以对等物只能是**手头确有数据的那四个点**：

| 状态点 | 数据来源 | 语气（点色） |
| --- | --- | --- |
| 会话 | `ChatState.status` / `tool` | 流式输出 = live；未接会话 = alert |
| 本轮 | `TaskStreamEntry[]`（`turn-start` 之后数 `tool-start`）+ `stream.active` | 跑着 = live；有工具报错 = alert |
| 当前样本 | 当前 `TriageReport` 的 `target.name` / `risk.score` / `risk.grade` | A/B = idle；C = live；D/E = alert |
| 注入 | `getActivePrompt(library)` | 有激活 = live |

实现：`src/features/workbench/live-status.ts`（纯函数 `deriveLiveStatus` / `countTurnTools`）
+ `src/features/workbench/components/shell/sidebar-status.tsx`（收起成图标轨时只留语气点，展开后显示标签与值）。

**不做的部分（明确记录，不假装有）**：今日花费、Token 数、请求数、缓存命中率、账号重新授权提醒。
这些数字在宿主里没有对插件开放的读通道，编一个近似值比留空更糟。

## 二、注入块预览（本次补齐）

上游 `inject/FileInjectPanel.tsx` 直接写目标客户端的全局指令文件；`UnifiedInjectPanel` 用分段控件在
「本机文件 / 网关注入」之间切换。

宿主的边界是硬的：插件只能写项目内路径，`~/.astravia/agent/AGENTS.md` 必须由用户在保存对话框里点一次
（见 `docs/adr/hanshuang-pojia/0004-host-hook-boundary.md`（仓库根） 与 `src/domain/inject/astravia-block.ts` 的模块注释）。
因此对等物是「把块摊开 + 给落盘路径」而不是一个会静默写主目录的按钮：

- 新增 `components/prompts/inject-block-card.tsx`，挂在提示词页：显示目标路径、块来源（激活提示词或默认契约）、
  块正文、复制按钮、落盘方式与按标记摘除的还原说明。
- `DEFAULT_INJECT_BODY` 收敛进 `domain/inject/astravia-block.ts`，注入工具 `install_astravia` 与面板共用同一份，
  避免两处走样。

上游的「网关注入」在宿主没有对应物（插件不能改 `base_url`），不做。

## 三、其余界面对照

| 上游 | 本地 | 结论 |
| --- | --- | --- |
| `shell/Sidebar` 导航 + 状态 | `shell/sidebar.tsx` + `shell/sidebar-status.tsx` | 本次补齐 |
| `inject/RoleCardStrip`（当前角色卡条） | `shell/inject-status-bar.tsx` | 已有，含模式与 token 估算 |
| `inject/PromptCardPanel` | `pages/prompts.tsx` + `prompts/prompt-card.tsx` | 已有，多出搜索与备份入口 |
| `promptWorkbench/PromptWorkbench` | `pages/prompts.tsx` + `prompts/prompt-editor-dialog.tsx` | 已有 |
| 修改前自动备份 / 还原 | `prompts/backup-restore-dialog.tsx` + `domain/prompt-backup.ts` | 已有 |
| `seep/SeepToolsPage` | `pages/selfcheck.tsx` + 14 个已声明命令 | 已有，改为「探测 → 安装计划」 |
| `UsageFooter` / `*QuotaFooter` / 账号配额 | — | 不适用：需要上游代理与账号 API |
| `providers` / `proxy` / `sessions` / `workspace` 等页 | — | 不适用：上游是代理管理器，本地是审计工作台 |
| `CodexAssetsPanel` | — | 不适用：写入目标客户端的资源目录不在插件授权范围内 |

## 四、验证

- `npx tsc --noEmit` 干净。
- `src/test/live-status.test.ts`：9 条，覆盖「只数本轮」「在最新的 turn 边界停」「工具报错升级语气」
  「等级到语气的映射（A/C/E 三档）」「未接会话 = alert」「激活提示词进注入点」。
- `src/test/workbench.test.tsx`：新增「侧栏实时区跟着会话走」——turn/tool 生命周期进「本轮」，
  报错切到 alert，报告进「当前样本」；导航用例追加注入块预览断言。
- 未做桌面端实测的部分标 **NOT RUN**：侧栏在真实宿主宽度下的展开阈值、注入块复制在插件 webview 的剪贴板可用性。
