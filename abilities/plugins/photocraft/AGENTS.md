# Photocraft（插件工程）

把上游 Photocraft 的官方 web 构建接进 Astravia 活动面板。**先读根目录 `AGENTS.md` 与本目录 `README.md`**，
决策与证据在 [`docs/adr/photocraft/`](../../../docs/adr/photocraft/)。

## 第一步：装依赖，然后确认 SDK 手册

```bash
npm install
npx astravia-plugin-cli docs
```

SDK 与 `plugin-vite` 在 `package.json` 里走**仓库内 `file:` 链接**（`.tooling/open-astravia/packages/plugins/*`），
不走公网 registry——公开版落后于宿主，装了会对不上合同。不要把它们换成 semver。

`docs` 打印随 SDK 装进 `node_modules` 的手册绝对路径与对应 SDK 版本。**不要硬编码这个路径**。
本文件与手册冲突时以手册为准。

## 开发闭环

```bash
npm run check   # tsc --noEmit + hub 漂移检查（提交前必跑）
npm run build   # 重建 hub → tsc → vite build → release/photocraft-0.0.3.astraviapkg
```

没有 `dev` 服务器：插件的活动面板只有一个 iframe 加一条信息栏，热更新收益小于它带来的
Module Federation 时序问题；调试走 `npm run build` 后装包，或在浏览器里直接开 hub 地址。

## 三条硬约束

- **改了 hub 就要回写 sha256。** `server/hub.mjs` 是 `scripts/build-hub.mjs` 的生成物，源码是
  `payload/manifest.json` + `server/hub.src.mjs` + `src/bridge/host-bridge.js`。宿主安装服务时按
  `plugin.json` 里的 sha256 校验字节，改完必须把新值同步到五个平台条目并重建。`check:hub` 只拦漂移，
  拦不住漏改 sha——那要到桌面端安装时才以 `SHA-256 mismatch` 暴露。
- **hub 必须内联在 bundle 里。** 打包器的运行时文件白名单不含 `providers.services[*].runtime.entry`，
  裸文件在市场安装包里会静默缺失。现在靠 `import … from "../../server/hub.mjs?raw"`；改成运行时读包内
  文件会在安装版上直接失效，而在 dev-link 工程目录里仍然能跑——最难查的那种不一致。
- **桥只在两个 DOM 接缝上动手，且先判形状再拦截。** `HTMLInputElement.prototype.click`（打开）与
  `HTMLAnchorElement.prototype.click`（保存）。判不上就放行，宁可退化成原版 Photocraft 也不要拦坏。
  上游 `.wasm` / `.js` 必须逐字节不变。

## 不要做的事

- 不要 fork 或重写编辑器。这个插件的价值就是「用原版」，任何上游改动都要先有 ADR。
- 不要用 `solar:` 图标糊弄品牌位：`assets/icon.png` 是上游官方位图。
- 不要给浏览器入口假装工作区绑定：那两个页面拿不到 `ctx.fs`，这是硬边界（0007 D3）。
- 不要为了绕网络限制放宽 sha256 校验，也不要把某个镜像写成默认下载。镜像方不需要被信任，正是因为
  每份字节都过 `payload/manifest.json` 钉住的值（0008 D3）；`sources[]` 只收 `https:`，构建脚本会拦。
- 不要在这里写业务 CSS：样式走 Tailwind `className`，`src/style.css` 只允许 `@import "tailwindcss"`。
- 不要把 `dist/`、`release/` 提交进 Git——正式包由 CI 构建。

## 市场登记

改版本要同时动四份身份文件（`plugin.json`、`ability.json`、`package.json`、市场源条目），回仓库根跑：

```bash
node scripts/marketplace.mjs check
node --test tests/*.test.mjs
```

只改 `README.md`、`detail*.json`、`ability.json` 的展示字段不需要抬版本；改了 `src/`、`server/`、
`scripts/`、`plugin.json` 就必须抬。
