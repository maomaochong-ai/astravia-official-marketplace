# Strix 插件 · 开发说明

工作目录就是本目录，所有命令在这里执行。上游引擎是 [usestrix/strix](https://github.com/usestrix/strix)，本插件是它的一等公民集成。

## 命令

```bash
npm install
npm run typecheck       # tsc --noEmit，全量类型检查
npm test                # vitest：面板、桥接客户端、服务层纯函数
npm run build:service   # src/service/*.ts -> dist/service/main.mjs（esbuild 单文件）
npm run stamp-service   # 改了服务后重算工件摘要
npm run build           # vite build + build:service（顺序：先清空 dist，再写服务）
npm run check           # typecheck + test + 服务冒烟
```

仓库级：`node scripts/marketplace.mjs check`、`node --test tests/*.test.mjs`。

## 分层

| 位置 | 职责 |
|---|---|
| `src/index.tsx` | 只做装配：activity tab + input action |
| `src/runtime.ts` | `strix-bridge` 生命周期（`ctx.services`）：声明 → 安装 → 启动 → 就绪 |
| `src/runtime-contract.ts` | 宿主桥接的最小类型边界 |
| `src/domain/bridge-client.ts` | 对服务的只读客户端：state / report / stop / SSE |
| `src/features/scan-console/` | 控制台：轨迹、沙箱盒、交给 Agent 的输入条 |
| `src/features/findings/` | 发现项列表 |
| `src/shared/` | 跨功能复用：方框、严重度格式化 |
| `src/service/main.ts` | 受管服务入口：MCP 工具面 + `/api/*` + SSE |
| `src/service/sandbox.ts` | 容器生命周期与命令执行 |
| `src/service/docker.ts` | docker CLI 封装（run/exec/rm/pull） |
| `src/service/skills.ts` | 从已安装引擎读取技能库 Markdown |
| `src/service/findings.ts` | 发现项台账与 Markdown 报告 |
| `dist/service/main.mjs` | 上面这些的打包产物（生成物，随包发布，不进 Git） |
| `agent/skills/` | 上游 9 个对外技能，原样拷贝 |

`src/service/` 是对 [plugin-project-structure.md](../../../docs/plugin-project-structure.md) 的一处补充：规范里的受管服务是二进制，靠 `runtime.ts` 装配；本插件的服务是自己写的 Node 程序，所以源码单独成目录，`runtime.ts` 仍然只管生命周期。生成物放 `dist/` 而不是 `service/`，与规范「`dist/` 不提交」一致。

## 决策与理由

1. **全仓 TypeScript，生成物在 `dist/`。** 服务端没有 Python 层：沙箱走 docker CLI，技能从已安装的 `strix-agent` 包里读 Markdown。宿主只认 JavaScript 入口，所以 `scripts/build-service.mjs` 用 esbuild 打成 `dist/service/main.mjs`；构建脚本会拒绝产物目录里出现 `.py`，语言边界由构建守住。
2. **Agent 是宿主的，不是插件的。** 宿主已有模型、会话与工具循环；插件再跑一次 strix 的 agent loop 就要第二份模型凭据、两套打架的转录。插件只提供宿主缺的：沙箱与技能。
3. **复用的是资产，不是复制品。** 镜像与工具链是上游的（`ghcr.io/usestrix/strix-sandbox`），技能库是上游包的 Markdown（升级引擎即升级技能），插件只做启动与投递。
4. **面板是观察窗，不是驾驶舱。** 输入条把目标与方法写进对话（`ctx.conversation.sendPrompt`），随后由 Agent 调工具；面板订阅事件显示命令轨迹、沙箱状态与发现项。界面用宿主主题变量，浅色/深色都成立；等宽只留给命令与证据。
5. **技能是插件内部实现。** `skillPresentation.defaultVisibility: "hidden"`：9 个技能仍随 `agent.skillPaths` 加载、Agent 可调用，但能力中心、命令菜单与 Skill 选择器里只有 **Strix 的名字和图标**。
6. **服务声明全部工件。** 宿主 `resolve()` 拒绝启动未经 `install()` 写入的运行时，`install()` 要求 payload 与 `platform.artifacts` 一一对应并逐个校验 SHA-256。当前是一个打包文件，`scripts/stamp-service.mjs` 从磁盘推导摘要。
7. **就绪语义。** `/api/health/ready` 一旦监听就回 200，细节放 body：非 2xx 会被宿主当成进程坏掉并重启。

## 改动时注意

- 改了 `src/service/` 或 `src/` 就要抬版本，并同步 `plugin.json`、`ability.json`、`package.json`、锁文件、`.astravia/marketplace.source.json`。
- 改了 `src/service/` 之后必须 `npm run build && npm run stamp-service`：宿主安装的运行时摘要来自 `stamp`，而入口是 `dist/service/main.mjs`。
- 不要手写 `dist/service/main.mjs`：它是生成物，`npm run build` 会覆盖。
- 提交前跑 `npm run check`；`typecheck` 是硬门槛，不要靠 `@ts-nocheck` 绕过。
- `detail.json` 的 `showcase` 文案必须短：宿主用固定高度卡片 + `line-clamp-3` 渲染。
- 图标是上游官方位图（`docs/logo/strix.png`），不要用相似的 Iconify 图形替代。
