# 一个应用一个容器名

> **已被取代**：容器（hub 进程 + loopback HTTP + iframe）整体删除，见
> `craft-0011-the-engine-is-ours.md` 与 `craft-0013-nothing-runs-in-the-background.md`。
> 下文保留原文。

> 这一条是整族共用的，每支 craft 插件都带一份逐字节相同的副本。
> 起因是一个从模板复制过来的字符串，直到装上第二支才看得见。

## 问题

`vite.config.ts` 里那一行的 `name` 是从 designcraft 复制来的字面量：

```ts
astraviaPluginFederation({ name: "designcraft", entry: "./src/index.tsx" })
```

十四支非 designcraft 的插件因此把自己的构建也叫做 `designcraft`。`dist/mf-manifest.json` 里
`id`、`name`、`metaData.globalName` 全是 `designcraft`，连 shared scope 的前缀也成了
`designcraft:@astravia-org/plugin-sdk`、`designcraft:react`：

```text
cadcraft 0.0.1  →  {"id":"designcraft","name":"designcraft","metaData":{"globalName":"designcraft"}…}
```

而各支 `plugin.json` 声明的 `moduleFederation.remoteName` 是自己的 id（`cadcraft`、`gridcraft`…）。
**声明与制品对不上。**

## 为什么这件事重要

宿主的加载路径在 `apps/desktop/src/renderer/domains/plugins/runtime/plugin-module-loader.ts`：

```ts
const remote = { name: moduleFederation.remoteName, alias: plugin.id, entry: plugin.entryUrl };
host.registerRemotes([remote]);
const loaded = await host.loadRemote(`${moduleFederation.remoteName}/${expose}`, { from: "runtime" });
```

remote 用 `remoteName` 注册，再按 `remoteName/expose` 取模块，而 `entry` 指向的是那份自称
`designcraft` 的 manifest。craft 插件是设计成可以一次装好几支的（同一套引擎、同一个宿主标签区），
所以"所有容器都叫 designcraft"不是命名口味问题：容器名是 Federation 认 remote 的键，同名的两支
会互相顶替——后加载的那份覆盖先注册的那份，表现是标签页里出现别人的界面、或者打开一支插件时
宿主去重新解析另一支的容器。用户侧看到的就是"装了几支 craft 之后，打开其中一个会跳对话、卡"。

## 决定

**联邦容器名从唯一的按应用差异文件里取。**

```ts
import { APP } from "./src/app.config";
…
astraviaPluginFederation({ name: APP.id, entry: "./src/index.tsx" })
```

`src/app.config.ts` 本来就是每支插件唯一不同的源码（见 `craft-0001`），容器名属于"这个应用是谁"，
放在那里正好。`vite.config.ts` 因此仍然逐字节相同，`tests/craft-parity.test.mjs` 继续把它当成
共享文件守护——修的是取值来源，不是给每支插件开一个新的差异点。

`craft-anything` 是唯一带连字符的 id。宿主 schema 允许（`^[A-Za-z_$][A-Za-z0-9_$-]{0,63}$`），
所以把它的 `remoteName` 从 `craftanything` 改成 `craft-anything`，让 manifest、`plugin.json`、
`APP.id` 三者对齐，而不是为它单独写一个例外。

## 验证

- Observed：改前本地构建 cadcraft，`dist/mf-manifest.json` 的 `name` 与 `globalName` 都是
  `designcraft`；改后重新构建，两者都是 `cadcraft`，shared scope 前缀随之变成 `cadcraft:`。
- Observed：craft-anything 改后 `name` / `globalName` 都是 `craft-anything`，构建通过
  （`✓ built in 11.75s`），产物 17 个运行文件。
- Observed：`node --test tests/craft-parity.test.mjs tests/craft-manifest.test.mjs tests/craft-docs.test.mjs`
  12 通过、1 跳过（宿主 schema 那条只在装了 SDK 时跑）。
- 未验证：两支 craft 插件同时安装时宿主里的实际表现——手上没有把 15 支全装上的宿主会话，
  这一条只能等用户在「能力」里确认。修的是键冲突，不是猜出来的症状。

## 版本

`vite.config.ts` 不在严格的运行内容清单里（`plugin.json`、`package.json`、`src/`、`agent/`、
`cases/`、`locales/`、`assets/`、`scripts/`），只改它既不会被判为"该抬版本"，也就永远不会被重建。
所以这一批是显式抬版本发布的：photocraft 0.0.10，其余各支停在 0.0.6 / 新八支 0.0.2。

## 与 `craft-0001` 的关系

`craft-0001` 说"没有生成器了，共享行为必须每份都改"。这一条是它的第一个真实代价：
一个写死的应用名在十五份副本里活了三个版本，直到有人去看构建产物才发现。
parity 测试保证十六份 `src/` 一致，但它**管不到** `vite.config.ts` 里的字面量——
这正是"共享文件逐字节相同"与"共享文件内容正确"之间的缝隙。
