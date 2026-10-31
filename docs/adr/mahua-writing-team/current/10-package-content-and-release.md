# 10 · 包、内容与发布

> 现行文本。归并自 [0010](../0010-plugin-self-containment.md)、
> [0012](../0012-craft-library-shipped-as-data.md)、[0014](../0014-rename-to-mahua-novel.md)（身份已被 0018 定稿取代）、
> [0018](../0018-project-identity-mahua-writing-team.md)、[0019](../0019-agent-directory-and-novel-master-skills.md)（目录规模）、
> [0023](../0023-dependency-hygiene-readme-and-release-verification.md)。2026-10-31 按 0.4.19 核对。

## 一句话

一个 `.astraviapkg` 装完就能用：不联网取内容、不依赖宿主的偶然存在、不手工发版。

## 一、身份

| 项 | 值 |
| --- | --- |
| 插件 id | `mahua-writing-team` |
| 展示名 | 麻花小说网（`%plugin.name%`） |
| 入口 | `dist/mf-manifest.json`（Module Federation 远程入口） |
| 插件 API | `^2.3.0` |
| 宿主门槛 | 条目 `minAppVersion` 0.5.60（源码市场 0.5.59） |
| 版本 | `plugin.json` 与 `.astravia/marketplace.source.json` 两处必须同步 |

`0014` 定下的中文名「麻花小说」沿用，工程身份以 `0018` 为准：id、目录、工具前缀、智能体 id、
团队名全部 `mahua*`。改名不改 slug、不改配置版本。

## 二、自足

1. **内容随包**：手艺库、文风样本、提示词、locale 全部在包内，运行时不取外网。
2. **依赖显式**：`package.json` 里装的都是真的用到的（React、`@noble/curves`、Iconify JSON、
   Tailwind 4 链路）。不依赖宿主恰好有某个包，也不手写低质量替代实现。
3. **样式自限**：CSS 只作用于 `.mahua-root` 子树，选择的工具类由 `@theme inline` 内联取值，
   不改写宿主 token（09）。

## 三、发布

1. `main` 是源码分支；CI 构建固定 `.astraviapkg`，发布到 `plugin-mahua-writing-team` Release。
   已发布版本只追加，不覆盖。
2. **改了运行内容就抬版本**（`src/`、`plugin.json`、`package.json`、`locales/`、`agent/`、
   `cases/`、`assets/`、`scripts/`）。只改 README、`detail.json`、`ability.json`、`docs/` 不抬。
3. 抬版本用脚本，一次改五份身份文件：

   ```bash
   node scripts/marketplace.mjs bump --slug mahua-writing-team --apply   # 默认 dry-run
   ```

4. `dist/`、`release/` 不进 Git；`entry` 指向的路径必须由构建产出。

## 四、验收顺序

```bash
cd abilities/plugins/mahua-writing-team
npm run check      # tsc --noEmit
npm test           # vitest run
npm run build      # 生成手艺库 + vite build
npm run validate   # astravia-plugin validate
```

再做源码侧三件：

```bash
node scripts/marketplace.mjs check
node scripts/marketplace.mjs build
node --test tests/*.test.mjs
```

## 代价与边界

- 自足的代价是**包体积**与「改一行提示词就要发版」。取舍是：作者不该等下载。
- 版本要手动抬，因为「运行内容变没变」是语义判断，脚本只能提醒不能替你决定。
- 宿主门槛写死在条目里。用到宿主新 API 时必须同步抬 `minAppVersion`，否则老客户端会静默坏掉。

## 怎么验证

```bash
cd abilities/plugins/mahua-writing-team
node -e "const p=require('./plugin.json');console.log(p.id,p.version,p.entry)"
grep -rn "https://" src/ --include=*.ts --include=*.tsx | grep -v "isauth\|example" | wc -l   # 期望 0（运行时不取外网）
```
