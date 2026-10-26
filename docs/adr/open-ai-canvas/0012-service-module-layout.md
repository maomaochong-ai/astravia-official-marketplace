# ADR-0012：服务端按职责分文件，运行时仍是单个 bundle

- 状态：已采纳
- 日期：2026-10-26
- 相关：ADR-0003（服务运行时分发）、ADR-0008（shim 自承前端）

## 背景

`server/boot.mjs` 到 3809 行时，一件事要改三个地方：常量在文件头、下载逻辑在中段、路由在尾部。它不是「一个模块太大」这么简单——它同时是：

1. 宿主拉起的进程入口（`plugin.json` 的 `runtime.entry`，5 个平台的 `artifacts` 全部指向它）；
2. 前端静态资源的分发者（ADR-0008）；
3. MCP 协议层与 20 个工具的实现；
4. 载荷下载与解包的实现。

任何按职责拆分的尝试都会立刻撞上一个硬约束：**宿主只下载并执行这一个文件**。装的时候从 Release 拿的是 `server/boot.mjs` 一个文件，没有目录树，没有 `node_modules`。所以「拆成多个模块」和「运行时只有一个文件」必须同时成立。

## 决策

1. **源在 `server/src/*.ts`，产物是 `server/boot.mjs`。** 入口为 `server/src/service.ts`，其余按职责分文件（`archive.ts` = ZIP 解包与摘要，`contract.ts` = 节点类型与 metadata 契约）。新块进来时按同样规则：一个文件一件事，文件名说明职责，不用 `utils.ts` / `helpers.ts`。
2. **用 esbuild 打成单个 ESM 文件**，`platform: node`、`target: node20`、`bundle: true`、无 sourcemap。产物写回 `server/boot.mjs`，`npm run shim` 再同步到 `public/assets/boot.mjs`。
3. **产物进版本控制**，并在产物头部标注「生成物，源在 server/src/」。理由是 `plugin.json` 的 `artifacts[].sha256` 指向它的字节，CI 打包读的也是它——产物不入库，仓库就不再是可发布的完整状态。
4. **迁移期允许一个 `@ts-nocheck`**，只给 `service.ts`。它里面大量「给流对象挂自定义属性」（`sink.statusCode = …`、`socket.bytesRead`），在 strict TS 下要先补二十几个接口定义才能过编译。处理方式是递减而不是一次重写：搬出一个块，就把对应的 nocheck 缩小一点。新拆出的模块必须通过 `tsc -p server`。
5. **`check:service-fresh` 进 `npm test`**：用 esbuild 在内存里重打一遍，与磁盘产物逐字节比对。改了源没重建时，服务会跑上一版代码而所有 `verify-*` 仍然通过——那种失败最贵。
6. **验证脚本从源切片，不从产物切片。** `verify-workflow.mjs` 读 `server/src/contract.ts` + `server/src/service.ts`，锚点同时容忍 `const`/`let`/`var` 与 `: Type` 标注，并在进 `vm` 前剥掉类型标注。

## 为什么不是「多文件直接运行」

宿主拿到的只有 entry 一个文件。要在运行时 `import "./archive.ts"`，就得让宿主把这几个文件都下载下来并保持目录结构——`artifacts` 是「文件 → 目标路径」的映射，可以做到，但那样每个新模块都要改 5 个平台的清单、每次引用都要保证顺序，而且**任何一次模块增减都是发布契约变更**。bundle 把这些复杂度收敛到构建期一次。

## 为什么不是「tsc 编译出多文件」

`tsc` 不做打包，`outDir` 出来的是多个 `.js` 加相对 import，仍然要多文件分发。要单文件就得再套一层打包器，等于多一步没有收益。

## 为什么不是「一次重写 3809 行」

拆分是搬运，重写是重新推导。前者可以用 `verify-*` 的现有断言证明行为不变（本次 18/18、26/26、17/17、14/14、24/24、41/41 全绿），后者只能靠人读。先搬完拿到结构，再逐个块补类型。

## 代价

- 新增 `esbuild` 开发依赖；`build` 与 `test` 各多一步。
- 产物 diff 噪声：改一行源，`server/boot.mjs` 的 diff 可能几百行（esbuild 会重排）。
- `@ts-nocheck` 是明账技术债，`service.ts` 现在三千多行仍然没有类型保护。递减靠人，工具只能提醒。

## 验证（Observed）

| 检查 | 结果 |
| --- | --- |
| `node scripts/build-service.mjs` | `server/boot.mjs ← 3 modules, 120716 bytes` |
| `node --check server/boot.mjs` | 通过 |
| `npx tsc -p server` | 退出 0（`service.ts` 走 nocheck，`archive.ts` / `contract.ts` 真检查） |
| `node scripts/check-service-fresh.mjs` | `OK server/boot.mjs 与 server/src 同源` |
| `npm test` | 18/18、26/26、17/17、14/14、24/24、41/41 |
| `npm run shim` | 一个 sha → 5 个平台 |

**未被自动覆盖的部分**：没有断言证明「bundle 后的运行时行为与拆分前完全一致」——那需要真机启动并跑一遍画布。现有证据是：源码块是原样搬运（不是重写）、`node --check` 通过、以及全部 `verify-*` 契约仍绿。首次真机启动仍需人工确认一次。

## 回滚

1. 把 `server/src/service.ts` 里两处 import 删掉，把 `server/src/archive.ts`、`server/src/contract.ts` 的内容按原位贴回；
2. `cp server/src/service.ts server/boot.mjs` 并去掉首行 `// @ts-nocheck`；
3. 删掉 `scripts/build-service.mjs`、`scripts/check-service-fresh.mjs`、`server/tsconfig.json`，从 `package.json` 的 `build`/`test` 里摘掉对应两步；
4. 跑 `npm run shim` 刷新 `plugin.json` 的 5 个 sha。

拆分前的文件在 git 历史里（`server/boot.mjs` 本次改动前的内容即完整实现）。
