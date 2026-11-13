# strix-0002 — 与上游的能力对照：补工具面与扫描模式，其余交给宿主

- **Status:** Proposed
- **Date:** 2026-11-13
- **Context:** 插件 strix 0.5.1；上游 `D:\open-source-projects\strix`（Python + Docker）
- **Related:** [0001](strix-0001-environment-without-docker.md) — 执行环境由宿主代备

## The situation

上游 Strix 是一个自成一体产品：CLI/TUI、模型矩阵、容器工具链、报告、多智能体、云与
CI 集成。插件是它在宿主里的形态，两者不可能逐项对齐——宿主办了其中一大半。但没有一张
写下来的对照表，结果是「缺什么」靠感觉判断，容易去重造宿主已有的东西（上一轮就差点把
模型选择器再写一遍）。

按代码盘出来的实际差距如下（插件侧工具 26 个，实现在 `src/agent/strix-tools.ts`）：

| 上游能力 | 插件现状 | 判断 |
| --- | --- | --- |
| 容器工具链（nmap / nuclei / ffuf / sqlmap / subfinder / naabu / Caido / trivy / gitleaks / trufflehog / jwt_tool） | 靠 `strix-agent` 镜像，工具在容器里；`host` 模式下只剩本机已装的 | **差距**：`host` 模式下一把工具都没有 |
| **Caido 代理工具**（`strix/tools/proxy`） | 0 处实现，只在 `strix_sandbox_start` 的描述里提过「镜像带 Caido」 | **差距**：能抓包但不能用代理工具面 |
| **扫描模式** deep / diff / quick / standard（`strix/skills/scan_modes`） | `skills.ts` 认得 `scan_modes` 这个分类，但没有模式概念，工具面无 `mode` 参数 | **差距** |
| 工具知识包（`strix/skills/tooling`：nmap/nuclei/ffuf/sqlmap/…13 篇） | 技能库随镜像走，插件不自带 | **差距（弱）**：容器内有，`host` 模式无 |
| 多智能体（`agents/factory.py`、`core/agents.py`、图协调） | `strix_spawn_agent` / `wait` / `view` 三个工具已在 | **半对齐**：协议在，编排是自写的 |
| 报告（`report/writer.py`、`runs.py`、`dedupe.py`、`sarif.py`） | `findings` + `strix_report` + `service/sarif.ts` | **基本对齐**（缺 dedupe） |
| 用量与成本（`report/pricing.py`、`usage.py`、预算暂停） | `usage` 仅 4 处提及，无计价、无预算闸 | **对齐到宿主**：宿主已有 token 计量 |
| 模型矩阵（9 家 provider、codex 流式、extra body/headers） | 复用 `ctx.models` / `ai.complete` | **对齐到宿主**，不复刻 |
| CLI / TUI / live viewer 前端 | 插件自带 console 面板 | **对齐到宿主**，不移植 viewer |
| 会话与恢复（`core/sessions.py`、resume picker） | 无 | **对齐到宿主**：会话在宿主侧 |
| hooks / MCP client / local sources / api-spec targets | hooks 4 处、其余无 | **部分差距**，见下 |
| telemetry / cloud / wallet / CI-CD / GitHub Actions 文档 | 无 | **不复刻** |

## The decision

**只补「工具面」和「扫描模式」两块，其余一律指向宿主；每条差距都要有明确的归属。**

1. **`host` 模式必须自己带工具清单。** 容器模式靠镜像，`host` 模式不能靠用户装。
   按 strix-0001 的两条宿主通道声明：`providers.cli` 装可执行工具，`runtime.artifacts`
   装固定字节的工具集。清单与上游镜像对齐（nmap / nuclei / ffuf / sqlmap / subfinder /
   naabu / trivy / gitleaks / trufflehog / jwt_tool）；装不上的在面板里逐个标「未装」，
   不假装可用。

2. **补 Caido 代理工具面。** 上游把代理做成结构化工具（`proxy`），插件目前只能让模型
   在容器里手敲命令。加一组 `strix_proxy_*`：`start` / `list` / `replay` / `sitemap`，
   复刻上游 `caido_api.py` 的四个动作，走同一个 MCP 出口。它只在 `docker` 模式可用
   （Caido 跑在镜像里），`host` 模式明确报不可用。

3. **补扫描模式，并让它成为会话属性。** `mode: quick | standard | deep | diff`：
   - `quick` / `standard` / `deep` 决定预算与覆盖面（时间上限、是否跑全部工具、是否要求
     覆盖闭环）；
   - `diff` 只测变更集（读宿主工作区的 diff），与上游 `diff.md` 同义。
   模式在 `strix_sandbox_start` 时快照，随会话走，中途不改——与 0001 里环境快照同一原则。

4. **工具知识包随插件发布，不随镜像。** 上游 13 篇 tooling 技能在 `host` 模式下没地方
   读，改由 `agent/skills/` 带一份，`strix_list_skills` / `strix_load_skills` 优先读插件
   自带的，容器内有更全的再叠加上去。

5. **明确「不补」的清单**，写进 README 与能力详情页，避免用户拿上游功能表对照认为缺失：
   模型矩阵、计价与预算闸、telemetry、cloud / wallet、CI-CD 与 GitHub Actions 集成、
   CLI/TUI、live viewer 前端、会话恢复。**这些的归属是宿主或上游服务，不是插件。**

6. **多智能体只保留协议，不移植编排。** 三个工具已在，但上游的 agent graph 协调
   依赖它自己的 runner。插件的 `spawn` 走宿主已有的 subagent 能力（见 strix-0003），
   不重写第二套调度。

## What this does not do

- **不承诺 `host` 模式与容器模式能力相等。** 浏览器、Caido、需要特权的工具（如需要原始
  套接字的扫描）只在容器里可用；面板按模式列出「这一形态能做什么」。
- **不移植上游的 TUI 与 viewer。** 面板是宿主的形态，不是上游前端的移植。
- **不做计价。** 宿主已经在算 token；插件再算一遍只会与宿主对不上。
- **不实现 diff 模式的变更集推导以外的东西**（不接管 git 操作）。

## The cost

- `host` 模式的工具清单要逐平台维护安装方式，弱网/无网时会有「装了但装不上」的中间态，
  面板必须能表达它（这也是 0001 的三态延续）。
- 扫描模式让「一次扫描该跑多久」从模型的自由发挥变成固定参数，灵活度下降；换来的是可
  预期的等待与可比较的报告。
- 代理工具面是新的攻击面：它能让模型对任意 URL 发请求，必须在描述里写明只对已授权目标
  使用，并且默认关闭、需用户显式开启。

## 落地顺序

1. 扫描模式（纯参数，风险最低，先把 `strix_sandbox_start` 的 `mode` 加上）；
2. 工具知识包随插件发（复制 13 篇，改 `skills.ts` 的读取顺序）；
3. `host` 模式的工具清单 + 面板的「未装」标记；
4. `strix_proxy_*`（最后做：它是新攻击面，要单独的权限与默认关闭开关）。
