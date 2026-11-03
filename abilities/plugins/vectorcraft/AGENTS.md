# VectorCraft 插件工作须知

这个目录是**手写源码**，不是产物。craft 家族七支插件（含 photocraft）共享同一份宿主侧代码，逐字节相同；
一致性由 `tests/craft-parity.test.mjs` 守住，改一处就要改另外六处。
理由与边界写在 [`docs/adr/craft/0001-seven-copies-and-a-parity-test.md`](../../../../docs/adr/craft/0001-seven-copies-and-a-parity-test.md)。

## 开工

```bash
cd abilities/plugins/vectorcraft
npm install
npm run build:hub          # 由 hub.src.mjs + bridge + payload 生成 server/hub.mjs，并写回 plugin.json 的 sha256
npm run check:hub          # server/hub.mjs 与 plugin.json 两边是否都新鲜
npm run check              # tsc --noEmit + 上面那条
npm run build              # 打包
```

## 改东西的正确位置

| 想改什么 | 改哪里 |
| --- | --- |
| 标签页、状态条、文件桥、Agent 工具的行为 | `src/features/**`、`src/bridge/**`（七支同步） |
| hub 的取包、缓存、注入逻辑 | `server/hub.src.mjs`（七支同步） |
| 页面里的 open/save 钩子、暂停闸门、手势注入 | `src/bridge/host-bridge.js`（七支同步） |
| 这个应用的名字、版本、payload、文案 | `src/app.config.ts`、`plugin.json`、`payload/manifest.json`、`src/features/editor/strings.ts` |
| 技能的说明文字 | `agent/skills/vectorcraft/SKILL.md` |

改完跑：

```bash
node --test tests/craft-parity.test.mjs tests/craft-manifest.test.mjs   # 在仓库根
npm run build
```

## 硬约束

- **hub 每次重建 sha256 都会变**，`plugin.json` 里五个平台的 `artifacts[].sha256` 必须一起变。
  `npm run build:hub` 现在既写 `server/hub.mjs` 也写这五条；`--check` 两个方向都校验，
  所以不要手工改摘要。
- `build-hub.mjs` 用 JSON 注入，源码里的反引号会破坏它；hub 侧拼 HTML 一律用 `+`。
- 上游字节一律保真：不改 wasm、不改 JS、不改 `index.html` 的 SRI，否则浏览器会拒绝加载。
  中文化的重编译管线已经删除，不要再把它引回插件目录（见 ADR 0007）。
- 文件桥只认 `event.source === iframe.contentWindow`，不要放宽。
