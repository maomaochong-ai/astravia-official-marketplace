# CADCraft 插件工作须知

这份目录是一支 craft 插件，属于「开放能力市场」官方源。开工前先读仓库根的 `AGENTS.md`。

## 你要改哪一层

- **共享层**（`src/` 除 `app.config.ts`、`server/`、`scripts/`）：与其余 craft 插件逐字节相同。
  改一处就要改全部副本，`tests/craft-parity.test.mjs` 会在漂移时报错。不要在这里引入「只对
  CADCraft 生效」的分支——那正是 parity 测试要防的事。
- **应用层**（`src/app.config.ts`）：这个应用的 id、标签页、hub 服务名与上游地址。这是唯一的
  按应用不同的源码。
- **制品层**（`payload/manifest.json`）：钉住的上游 release、大小与 sha256。升级上游时改这里，
  然后 `npm run build:hub`。
- **文案层**（`agent/skills/cadcraft/`、`detail.json`、`detail.zh.json`）：给用户和 Agent 读的东西。
  默认英文、中文放在 `zh` 覆盖里。

## 不许做的事

- 不改 `server/hub.mjs`：它是 `scripts/build-hub.mjs` 的产物。改 `hub.src.mjs` 后重新生成。
- 不改上游字节：`payload/manifest.json` 的摘要就是承诺，改包会让所有已安装用户校验失败。
- 不假装中文画布：本插件的编辑器界面语言来自上游构建，`app.locale` 保持 `null`
  （理由见 `docs/adr/cadcraft/craft-0007-chinese-comes-from-the-shell.md`）。外壳文案是中文的，
  画布是上游的——不要把两者混为一谈。
- 不把 `dist/`、`release/` 提交进源码。

## 开工命令

```bash
npm install
npm run build:hub      # 生成 server/hub.mjs 并同步 plugin.json 摘要
npm run check:hub      # 只检查 hub 是否过期
npm run check          # tsc --noEmit + check:hub
npm run build          # 本地预检；正式 .astraviapkg 由 CI 构建
```
