# 求是图文导览（插件工程）

给求是方法论 skill 的详情页加一个打开图文介绍页的入口。编写顺序、命令与 SDK 手册位置见
[README.md](./README.md)；SDK 合同以 `npx astravia-plugin-cli docs` 打印的路径为准，不要凭记忆写。

- 目录职责：`src/features/illustrated-guide/` 一个 feature；`components/` 下每个文件一个组件；
  `src/shared/components/` 放跨 feature 的基础件。`src/index.tsx` 只做装配。
- 页面来源：`src/assets/preview-page.html` 是 skill 包裹里 `assets/preview/index.html` 的副本，
  用 `npm run sync:preview` 刷新；两者不一致时仓库根的 `tests/qiushi-guide.test.mjs` 会失败。
- 样式只走 Tailwind utility + 宿主主题变量（`bg-card` / `text-muted-foreground` 等），
  `src/style.css` 只保留 Tailwind 入口，业务选择器会泄漏进宿主页面。
- 验证：`npm run check`、`npm test`、`npm run build` 三件都跑过再交。
