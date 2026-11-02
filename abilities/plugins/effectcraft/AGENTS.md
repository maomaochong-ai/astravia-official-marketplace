# EffectCraft 插件工作须知

这个目录由 `tools/craft/` 生成，**不要把它当手写项目改**。共享代码在
`tools/craft/stem/`，应用数据在 `tools/craft/apps.mjs`。

## 开工

```bash
cd abilities/plugins/effectcraft
npm install
npm run check:hub        # server/hub.mjs 与 hub.src.mjs 是否同步
npm run check            # tsc --noEmit + 上面那条
npm run build            # 重新生成 hub 并打包
```

## 改东西的正确位置

| 想改什么 | 改哪里 |
| --- | --- |
| 标签页、状态条、文件桥、Agent 工具的行为 | `tools/craft/stem/src/**` |
| hub 的取包、缓存、注入逻辑 | `tools/craft/stem/server/hub.src.mjs` |
| 页面里的 open/save 钩子 | `tools/craft/stem/src/bridge/host-bridge.js` |
| 这个应用的名字、版本、payload、文案 | `tools/craft/apps.mjs` |

改完跑 `node tools/craft/generate.mjs effectcraft`，再回本目录 `npm run build`。

## 硬约束

- **hub 每次重建 sha256 都会变**，`plugin.json` 里五个平台的 `artifacts[].sha256` 必须一起更新；
  `generate.mjs` 负责写这一份，手工改就会和 `server/hub.mjs` 对不上。
- `build-hub.mjs` 用 JSON 注入，源码里的反引号会破坏它；hub 侧拼 HTML 一律用 `+`。
- 上游字节一律保真：不改 wasm、不改 JS、不改 `index.html` 的 SRI，否则浏览器会拒绝加载。
- 文件桥只认 `event.source === iframe.contentWindow`，不要放宽。
