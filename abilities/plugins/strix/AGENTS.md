# Strix 插件 · 开发说明

工作目录就是本目录，所有命令在这里执行。上游引擎是 [usestrix/strix](https://github.com/usestrix/strix)，本插件是它的薄集成层。

## 命令

```bash
npm install
npm run test        # vitest：severity / bridge-client / console-panel
npm run build       # vite build（v3 预检，dist/ 不提交）

# 不依赖宿主 SDK 的两条冒烟检查（本机可直接跑）
STRIX_PYTHON=/path/to/python python scripts/check-bridge.py
STRIX_PYTHON=/path/to/python node scripts/check-service.mjs
```

仓库级：`node scripts/marketplace.mjs check`、`node --test tests/*.test.mjs`。

## 分层

| 位置 | 职责 |
|---|---|
| `src/index.tsx` | 只做装配：activity tab + input action |
| `src/runtime.ts` | `strix-bridge` 生命周期（`ctx.services`） |
| `src/domain/bridge-client.ts` | 桥接 HTTP + SSE 客户端 |
| `src/features/scan-console/` | 启动表单、实时时间线、面板 |
| `src/features/findings/` | 严重度汇总、发现项列表与卡片 |
| `src/shared/` | 跨功能复用：严重度格式化、状态样式 |
| `service/main.mjs` | host-node 服务：HTTP API + `/mcp` |
| `service/bridge/*.py` | Python 侧：import strix、驱动扫描、读运行目录 |
| `agent/skills/` | 上游 9 个对外技能，原样拷贝 |

`src/runtime-contract.ts` 只描述宿主与服务的最小类型边界，业务协议不要写进去。

## 已定决策与理由

1. **库级集成，不是 CLI 包装。** 上游没有服务模式、没有本地 HTTP API、没有 JSON 事件流（`--json` 只存在于 `strix cloud`）。唯一能流式观察扫描的入口是 `run_strix_scan(event_sink=…)`，所以桥接进程直接调用它。
2. **事件用上游自己的投影。** `event_sink` 给的是 OpenAI Agents SDK 对象；`service/bridge/scan.py` 用上游的 `TuiLiveView`（其 Go TUI 用的同一套解释器）投影后再序列化，避免我们自己维护一份平行解析。
3. **host-node 壳 + Python 子进程。** 宿主只提供 `host-node` 与 `managed-binary`；把 Python 打成各平台二进制意味着每平台约百 MB 工件与校验维护。`service/main.mjs` 拉起 `python -m bridge` 并用 JSON 行通信，上游改动落在 `service/bridge/`。
4. **面板默认不显示。** `registerActivityTab({ initiallyVisible: false })`：安装只增加一个菜单项，不在对话框下方常驻。两个入口（标签页菜单、`strix.activate` 输入框按钮）打开同一面板，激活靠 `decoratePrompt` 往下一条 prompt 注入插件指令，不再依赖技能名。
5. **技能是插件内部实现，不是产品条目。** `skillPresentation.defaultVisibility: "hidden"`：对外 9 个技能仍随 `agent.skillPaths` 加载、Agent 可调用，但不会以单独条目出现在能力中心、智能体能力配置、命令菜单或 Skill 选择器——用户装的是 Strix，看到的是 Strix 的图标和描述。内部 78 个（`strix/skills/<category>/<name>.md`）留在 strix 包内由它自己的 `load_skill` 加载。
6. **面板就是上游 TUI 的复刻。** 左侧带边框的对话轨迹（`▍ You:` / `→ Using tool` / `✓ Done`）+ 下方启动表单，右侧 stats / targets / agents / findings 四个圆角方框；配色照搬 `render/styles.go`（`#0a0a0a` 底、`#d4d4d4` 文字、`#22c55e` 强调），不用宿主主题变量，所以在浅色主题下也保持同一副面孔。
7. **模型凭据由 strix 自己持有。** 不读宿主凭据：provider 命名体系不同，映射出来的「看起来配好了」会导致扫描 401。
8. **不提交 `release/`。** 与 `docs/plugin-project-structure.md:52` 冲突时以 `.gitignore` + `scripts/stage-plugin-release.py` 为准。

## 改动时注意

- 改了 `service/` 或 `src/` 就要抬版本，并同步 `plugin.json`、`ability.json`、`package.json`、锁文件、`.astravia/marketplace.source.json`。
- 改了 `service/` 下任何文件都要重算摘要：`npm run stamp-service`（宿主按 `plugin.json` 里声明的**全部**工件逐个校验 SHA-256，只声明入口会把 Python 半边漏装）。
- 服务就绪语义：`/api/health/ready` 一旦监听就回 200，Python 是否可用放 body。非 2xx 会被宿主当成进程坏掉并重启。
- `detail.json` 的 `showcase` 文案必须短：宿主用固定高度卡片 + `line-clamp-3` 渲染，长文案会挤出容器（`tests/excalidraw-plugin.test.mjs` 有回归断言）。
- 图标是上游官方位图（`docs/logo/strix.png`），不要用相似的 Iconify 图形替代。
