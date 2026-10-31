# 0023 — 依赖回归版本号、README 双语，以及发布前的验证口径

- 状态：已接受（2026-10-29）
- 相关：AGENTS.md（抬版本与发布规则）、ADR 0018（身份改名）

## 背景

两件工程债：

1. `package.json` 的 `devDependencies` 里有三条 `file:` 依赖，指向本机
   `../../../.tooling/open-astravia/packages/plugins/*`。开发时用它把宿主 SDK 的改动直接链进来很方便，
   但**它不能进仓库**：CI 里没有 `.tooling/`，`npm ci` 会直接失败，插件也就发布不出去。
2. `README.md` 只有中文。市场详情页已经双语（`detail.json` / `detail.zh.json`），
   README 是给「想看源码怎么说」的人看的，同样需要两份。

## 决策

### 1. 依赖改回发布版本

| 包 | 旧 | 新 |
| --- | --- | --- |
| `@astravia-org/plugin-sdk` | `file:../../../.tooling/...` | `^0.3.10` |
| `@astravia-org/plugin-vite` | `file:../../../.tooling/...` | `^0.2.4` |
| `@astravia-org/plugin-cli` | `file:../../../.tooling/...` | `^0.1.7` |

版本取值不是拍的：仓库里另外四个插件（`hanshuang-pojia`、`open-ai-canvas`、`web-element-picker`、
`build-apple-apps`）用的是同一组版本，`^0.3.10` 是当前 sdk 的最高已用版本，`^0.2.4` / `^0.1.7` 同理。

**锁文件不能手改。** `@astravia-org/*` 没有发布到公开 npm，本机与 CI 都靠
`scripts/marketplace.mjs` 在构建时把这三个包临时改写成 `file:` 指向 `.tooling/open-astravia` 再装。
结果是 `package-lock.json` 里这三条会一直写成 `../../../.tooling/...` + `link: true`——
仓库里另外四个插件的锁文件也是这个样子。因此：

- `package.json` 必须是版本范围（这是声明，也是别人 `npm ci` 时读的东西）；
- `package-lock.json` 保持 `link: true`，不伪造 registry 的 `resolved` / `integrity`；
- **验收只查 `package.json`**：`grep -n "file:" package.json` 无输出，`npm run check` / `npm test` /
  `npm run build` 全绿。

### 2. README 两份

- `README.md`：英文（默认语言），`README.zh.md`：中文；
- 顶部互相链接（`[中文](README.zh.md)` / `[English](README.md)`）；
- 两份内容同构：这是什么 → 装完看到什么 → 智能体分工 → 工具面一览 → 数据放在哪 → 开发与验证命令 → 许可证与来源；
- 不把 `agent/` 的写作方法论抄进 README，那是技能的内容，README 只指向它。

`plugin.json` 的 `description` 与市场 `detail.*` 已经是双语的，README 不改它们。

### 3. 发布口径（一次性写清，避免每轮重议）

发布判定按 `AGENTS.md`：运行内容变化 → 抬版本 → 普通源码 PR → CI 发布到 `gh-pages`。
本轮因为身份改名，版本 `0.1.0 → 0.2.0`，五份身份文件同步：

```
plugin.json#version
package.json#version
package-lock.json（npm install 自动同步）
ability.json#version
.astravia/marketplace.source.json 的 abilities[] 条目 version
```

本地发布前验证顺序（缺一不可）：

1. `node scripts/build-reference-library.mjs`（技能 references 改了就必须先跑，否则工具读的是旧数据）
2. `npm run check`
3. `npm test`
4. `npm run build`（产出 `release/mahua-writing-team-0.2.0.astraviapkg`）
5. `npm run validate`
6. 仓库根 `node scripts/marketplace.mjs check`
7. 仓库根 `node --test tests/*.test.mjs`

### 4. 提交与推送

- 只暂存本轮相关路径（插件目录、`.astravia/marketplace.source.json`、`docs/adr/mahua-writing-team/0018-0023`）；
  工作树里与本轮无关的改动（`dbx-pro` 的 `file:` 依赖、`ui-mock` 的 design.json）不碰、不提交；
- 提交信息按仓库习惯：`feat(mahua-writing-team): 0.2.0 — 工程改名、技能化 agent 目录、书库页与伏笔台账`；
- 推送目标 `main`：CI 的 `publish-marketplace.yml` 只在 `push` 到 `main` 时触发（`branches: [main]`，
  job 里还有 `if: github.ref == 'refs/heads/main'`）。推到其它分支不会发布，这一点要写在交付说明里。

## 后果

- 开发时想再链本地 SDK，用 `npm link` 或临时 `npm install --no-save`，不要提交 `file:`。
- README 两份意味着改一处要改两处；两边的**结构**必须一致，措辞可以各自自然。
- 若 `main` 有分支保护导致直接推送被拒，交付说明里如实写「需要 PR」，不绕。
