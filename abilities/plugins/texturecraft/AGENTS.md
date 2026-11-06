# texturecraft 插件工作须知

这个目录是**手写源码**，不是产物。craft 家族十五支插件共享同一份宿主侧代码，`src/**` 逐字节相同；
一致性由 `tests/craft-parity.test.mjs` 守住，改一处就要改另外十四处。
理由与边界写在 [`docs/adr/texturecraft/craft-0001-seven-copies-and-a-parity-test.md`](../../../../docs/adr/texturecraft/craft-0001-seven-copies-and-a-parity-test.md)。

编辑器本体**不是我们写的**：`web/` 就是上游为 `payload/manifest.json` 钉住的那一版发出来的
`<app>-web-<version>.zip`——打包前下载、校验 sha256、剥掉外层目录后原样装进包里。我们不编译它，
也不改它一个字节。为什么站点走 `srcdoc` 而不是导航进去，见
[`docs/adr/texturecraft/craft-0001-seven-copies-and-a-parity-test.md`](../../../../docs/adr/texturecraft/craft-0001-seven-copies-and-a-parity-test.md)、
[`docs/adr/texturecraft/craft-0012-the-site-is-upstreams-release-bundle.md`](../../../../docs/adr/texturecraft/craft-0012-the-site-is-upstreams-release-bundle.md)。

## 开工

```bash
cd abilities/plugins/texturecraft
npm install
npm run check      # tsc --noEmit
npm run build      # dist/ 供本地预检，正式 .astraviapkg 由 CI 构建
node scripts/build-craft-web.mjs   # 下载并校验上游站点（加 --if-missing 可跳过已就位的）
```

## 改东西的正确位置

| 想改什么 | 改哪里 |
| --- | --- |
| 标签页、状态条、文件桥、Agent 工具的行为 | `src/features/**`、`src/bridge/**`（十五支同步） |
| 帧文档的拼装：`<base>`、`replaceState`、语言种子、bridge 注入 | `src/features/editor/services/site-document.ts`（十五支同步） |
| 页面里的 open/save 钩子、暂停闸门、手势注入 | `src/bridge/host-bridge.js`（十五支同步） |
| 这个应用的名字、版本、站点目录、语言种子 | `src/app.config.ts`、`plugin.json`、`payload/manifest.json`、`locales/*.json` |
| 技能的说明文字 | `agent/skills/texturecraft/SKILL.md` |
| 编辑器界面本身 | 不改；那是上游 `apps/texturecraft-web` 的构建产物 |

改完跑：

```bash
node --test tests/craft-parity.test.mjs tests/craft-manifest.test.mjs tests/craft-docs.test.mjs   # 在仓库根
npm run build
```

## 硬约束

- **`web/` 不进 git**：`abilities/plugins/*/web/` 在 .gitignore 里，CI 在打包前从上游 release 下载。
  手改会在下一次打包时被覆盖，也不能提交；要换版本就改 pin，别改字节。
- **上游字节保真**：不改 wasm、不改 JS、不改 `index.html` 的 SRI。我们只在拼 `srcdoc` 时注入
  `<base>`、一段垫 URL 的脚本、语言种子和 bridge。
- **站点只能是相对路径**：页面要能在任意前缀下加载，`web/web/index.html` 里不允许
  `src="/…"` 这种根绝对路径（`scripts/build-craft-web.mjs` 会直接拒绝）。
- **文件桥只认 `event.source === iframe.contentWindow`**，不要放宽。
- **改了 `src/**`、`plugin.json`、`locales/` 或 `scripts/` 就要抬版本**，否则 CI 的 `--strict` 会红。
  `payload/manifest.json` 是构建期的来源声明，不进包也不触发这条门禁——但改了它通常意味着要重发一版站点。
