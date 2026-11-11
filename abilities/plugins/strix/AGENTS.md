# Strix 插件 · 开发说明

工作目录就是本目录，所有命令在这里执行。上游引擎是 [usestrix/strix](https://github.com/usestrix/strix)，本插件是它的一等公民集成。

## 命令

```bash
npm install
npm test                # vitest：面板、桥接客户端、严重度
npm run stamp-service   # 改过 service/ 后重算 7 个工件的摘要
npm run build           # vite build（dist/ 不提交）
npm run check:service   # host-node 服务：health / /mcp / /api/state
npm run check:bridge    # Python 桥协议
```

仓库级：`node scripts/marketplace.mjs check`、`node --test tests/*.test.mjs`。

## 分层

| 位置 | 职责 |
|---|---|
| `src/index.tsx` | 只做装配：activity tab + input action |
| `src/runtime.ts` | `strix-bridge` 生命周期（`ctx.services`） |
| `src/domain/bridge-client.ts` | 只读客户端：state / report / stop |
| `src/features/scan-console/` | 控制台：轨迹、沙箱盒、交给 Agent 的输入条 |
| `src/features/findings/` | 发现项列表 |
| `src/shared/` | 跨功能复用：方框、严重度 |
| `service/main.mjs` | host-node 服务：MCP 工具面 + `/api/*` + SSE |
| `service/bridge/tools.py` | 上游沙箱（`create_or_reuse` + `session.exec`）与技能（`load_skills`） |
| `service/bridge/findings.py` | 发现项台账与 Markdown 报告 |
| `service/bridge/environment.py` | 环境探测（Python / 引擎 / Docker / 镜像） |
| `agent/skills/` | 上游 9 个对外技能，原样拷贝 |

## 决策与理由

1. **Agent 是宿主的，不是插件的。** 宿主已有模型、会话与工具循环；插件再跑一个 `run_strix_scan` 就等于要第二份模型凭据、两套互相打架的对话记录。所以插件只提供宿主缺的东西：沙箱与技能。
2. **上游复用的是入口，不是复制品。** 沙箱走 `strix.runtime.session_manager.create_or_reuse`，命令走 `session.exec`，技能走 `strix.skills.get_available_skills` / `load_skills`——与 strix 自己的 runner、`load_skill` 工具同一批函数，镜像、bind mount、技能渲染都是上游的。
3. **面板是观察窗，不是驾驶舱。** 输入条只把目标和方法写进对话（`ctx.conversation.sendPrompt`），随后由 Agent 调工具；面板订阅桥接事件显示命令轨迹、沙箱状态与发现项。左侧轨迹照上游 TUI 画（`→ Using tool` / `● In progress... / ✓ Done / ✗ Failed`）。
4. **技能是插件内部实现。** `skillPresentation.defaultVisibility: "hidden"`：9 个技能仍随 `agent.skillPaths` 加载、Agent 可调用，但不出现在能力中心、命令菜单或 Skill 选择器——用户装的是 Strix。
5. **服务声明全部工件。** 宿主 `resolve()` 拒绝启动未经 `install()` 写入的运行时，`install()` 要求 payload 与 `platform.artifacts` 一一对应并逐个校验 SHA-256；只声明入口会把 Python 半边漏装。
6. **就绪语义。** `/api/health/ready` 一旦监听就回 200，Python 是否可用放 body：非 2xx 会被宿主当成进程坏掉并重启。

## 改动时注意

- 改了 `service/` 或 `src/` 就要抬版本，并同步 `plugin.json`、`ability.json`、`package.json`、锁文件、`.astravia/marketplace.source.json`。
- 增删 `service/` 下的文件必须同步 `scripts/fill-service-checksum.py` 的 `SERVICE_FILES`，再 `npm run stamp-service`。
- `detail.json` 的 `showcase` 文案必须短：宿主用固定高度卡片 + `line-clamp-3` 渲染。
- 图标是上游官方位图（`docs/logo/strix.png`），不要用相似的 Iconify 图形替代。
