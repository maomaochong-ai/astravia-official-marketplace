# LogoCreator 插件工程

Astravia 桌面插件。开工前先按根目录 `AGENTS.md` 的手册流程装依赖、读 SDK 文档——不要凭记忆写 SDK API。

```bash
npm install
npx astravia-plugin-cli docs      # 手册绝对路径 + 对应 SDK 版本
npm run check && npm run test && npm run build
```

本工程的实际构建脚本是 `tsc --noEmit && vite build`（`@astravia-org/plugin-vite` 的 Module Federation 封装）。
本地开发机常用 bun；CI 走 npm。

## 这个工程最容易被改坏的四处

1. **演示对话的文案。** `detail.json` / `detail.zh.json` 的 showcase 用 `chat-thread`：气泡区可用高度约
   72px，两个 `compact` 气泡各占约 29px + 6px 间距。**两句话都必须单行**——中文 ≤ 22 字、英文 ≤ 44 字符。
   超了就会被 `justify-end` 从顶部裁掉，看起来像文字被圆角容器盖住。`src/test/showcase-fit.test.ts` 守着这条线。
2. **id 与版本号。** `plugin.json#id` 必须等于能力 `slug`（`logocreator`），三处 `version`（`plugin.json` /
   `ability.json` / `package.json`）与 `marketplace.source.json` 必须一致。
3. **`spec.ts` 是唯一事实源。** 任何"设计"的新字段都要先进 `LogoSpec` 与 `normalizeSpec`，
   历史记录只存它。不要在组件里另开一份表单状态。
4. **风格只写 Tailwind `className`。** `style.css` 只有 Tailwind 入口与宿主主题别名；
   插件与宿主共享同一个页面，全局选择器会污染整个 UI。

## 目录职责

见 `README.md` 的目录树。三条硬边界：

- `domain/engine/` 不许 import React，也不许读 `ctx`——它是纯函数，测试直接跑。
- `features/studio/components/` 里一个文件一个主组件；异步状态机放 `hooks/`。
- 任何会失败的操作（存储、网络、canvas、文件写入）的 catch 里必须
  `ctx.ui.notify({ message, error })`，或经 `plugin-context.ts` 的 `reportError`，不许吞掉原始 error。

## AI 路径

`network.fetch` + `allowedHosts: ["api.together.xyz"]` 已经声明。密钥只进 `ctx.secrets`，
不进 `settings.json`、不进日志、不进 `detail.json`。没有密钥时一切功能照常（内置引擎不需要它）。
