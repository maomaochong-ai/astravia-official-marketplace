# ADR-0014：激活的资源归属于激活，运行时目录键归属于字节

## 状态

已接受（2026-10-27）。修正两个已上线缺陷：侧栏入口在升级后消失、服务运行时在升级后永久失联。

## 背景

2026-10-27 00:04 装了 0.1.7 之后出现两个同时发生的现象：宿主侧边栏里 `Open AI Canvas` 的入口**不见了**，而 `service:data-read` 每 3 秒报一次错、共 290 次。两者都不是权限问题（`~/.astravia/plugins-manifest.json` 里 `grantedPermissions` 与 `permissions` 八项完全一致、`enabled=true`）。

排查后是两个独立缺陷，各自有一条完整的证据链。它们同时出现有偶然性，但根因都在「谁拥有哪份资源」这个边界上。

### 缺陷一：旧激活的 cleanup 释放了新激活的视图

宿主升级插件时的生命周期是**交叠**的，不是串行的（Observed，`~/.astravia/desktop-app/logs/main/2026-10-27.log`）：

```
00:04:24.800 activation started    (0.1.7, 54ff…)
00:04:26.541 activation completed
00:04:26.590 deactivation started  (0.1.6)
00:04:27.561 deactivation completed
00:04:29.221 activation started    (0.1.7, 28aa…)
00:04:30.008 activation completed
00:04:30.129 deactivation started  (0.1.7, 54ff…)   ← 第一轮的 cleanup 在这里
00:04:30.644 deactivation completed
```

旧写法把视图句柄放在模块作用域（`let activeView`），而 cleanup 读的是**当时的**模块变量：

```tsx
activeView = ctx.ui.registerWorkspaceView({ … });   // 第二次激活写这里
return () => { activeView?.dispose(); activeView = null; };   // 第一轮 cleanup 读到的也是它
```

时序上第二个激活先把 `activeView` 指向 V2，随后第一个激活的 cleanup 执行 `activeView?.dispose()` —— 打到的是 V2。宿主 `registerWorkspaceView` 的实现只做 `f.push(ne)`、`dispose` 里 `f.splice(oe, 1)`，没有「已被替换」的保护，于是最终注册表里 0 个工作区视图。

四个曾经被怀疑的方向都已排除（Observed）：`activation completed` 的 `count` 是 `pendingRuntimeRegistrations.length`，不含视图（0.1.6 也是 0）；`activate` 抛错会外抛成 `activation failed`，日志里没有；`registerWorkspaceView` 的五道校验（权限 `ui.slot.workspace-view`、id 正则、label 非空、component 有效、同一注册表内 id 不重复）全部满足，且 `f` 是每次激活一份，跨激活同 id 不会抛错；权限门禁若静默丢弃会写 `contribution skipped {stage:"permission-check", reason:"missing-permission"}`，而 2026-10-27 全天日志里这三个词出现 **0 次** —— 注册确实成功过，只是后来被 splice 掉了。

### 缺陷二：`runtime.version` 不随 shim 字节变，旧目录永远对不上

宿主的运行时版本号不是给人看的，是**目录键**（Observed，`app.asar`）：

```js
runtimeDirectory = …/plugin-services/<pluginId>/<serviceId>/runtime/versions/<runtime.version>/
```

`isReadyRuntime` 拿该目录里的 `.runtime.json` 与 `plugin.json` 的声明做**整对象**比较：

```js
const marker = parseMarker(JSON.parse(await readFile(..., ".runtime.json")));
if (!marker || JSON.stringify(marker) !== JSON.stringify(expected)) return false;
```

`markerFor` 的字段序是 `schemaVersion, kind, runtimeKind, version, executable, [entry], artifacts[{destination, sha256}]` —— 任何一项不同都判为未就绪，包括 `sha256`。

而 `runtime.version` 从 0.1.3 到 0.1.7 一直是 `0.2.0`，shim 字节每次发版都变（四份 `plugin.json` 的摘要依次 `88cebd51… / 3ecd811c… / f5cc6bd0… / 03f88033…`，Observed 于 `git show {7bd8b1df,2ef8b5f3,834a24f9,971311cf}:plugin.json`）。本地实测该目录：

```
runtime/versions/0.2.0/.runtime.json  sha256 = f5cc6bd01936…   ← 0.1.6 的字节
runtime/versions/0.2.0/server/boot.mjs shasum = f5cc6bd01936…   ← 一致
plugin.json (0.1.7)                   sha256 = 03f880334243…   ← 声明已变
```

于是 `resolve()` 抛错 ⇒ `getStatus().installed === false` ⇒ 服务不可能进入 ready。这不是「装坏了」，是**声明与制品永不可能再对齐**：只有 `install()` 会重写该目录，而它要用户先点「启动服务」。

两个缺陷的耦合点在这里：侧栏入口消失后，用户没有可点的「启动服务」按钮，于是第二个缺陷不会被自动修复，只能表现为持续的 `data-read` 报错。

### 一个必须先纠正的误判

排查途中曾把「`plugin.json` 声明 `server/boot.mjs`，而 `.astraviapkg` 里从来没有 `server/`」当成打包缺陷。**这个判断是错的**（Observed，`src/runtime.ts:107-111`、`:612`）：

| 名称 | 含义 | 谁读 |
| --- | --- | --- |
| `dist/assets/boot.mjs` | **包内**路径，`.astraviapkg` 里真实存在的 shim（打包器全量收 `dist/assets/**`） | 插件自己 `fetch("astravia-plugin://<id>/versions/<v>/dist/assets/boot.mjs")` |
| `server/boot.mjs` | **运行时目录内**路径，`install()` 归位后的位置 | 宿主 `spawn` 时 `cwd=runtimeDirectory` 下的 `entry` / `executable` |

两者刻意不同，中间由插件侧 `ctx.services.install(SERVICE_ID, [{destination, data}])` 完成搬运。宿主 `install(pluginId, serviceId, artifacts)` 的字节**由插件传入**，正是这一点解释了 22:50 那次能凭空写出 `runtime/versions/0.2.0/server/boot.mjs`。把它当成打包缺陷去「修」，会把本来正确的契约改坏。

## 决策

### 1. 激活创建的每一份资源由这次激活持有

`src/index.tsx` 不再用模块级句柄，改为一次激活一个 `Activation` 记录，cleanup 只释放自己那一份：

```tsx
interface Activation { controller; view; timer; released: boolean }
let current: Activation | null = null;
function release(a: Activation) { if (a.released) return; a.released = true; clearTimeout(a.timer); a.view.dispose(); void a.controller.dispose(); if (current === a) current = null; }
```

三条性质缺一不可：

- **闭包局部**：不管宿主是否共享模块实例，cleanup 都不会触到别人的视图；
- **幂等**：宿主重复调用 cleanup 不会二次 `splice`；
- **身份判定**：`if (current === a)` 让「已被替换」的那一份不去清空别人的登记。

仍保留「先撤上一份再注册新的」，避免同一 id 的入口短暂并存。

### 2. `runtime.version` 由脚本随字节递增

`scripts/sync-shim.mjs` 在写摘要时比较此前记录的 `sha256`：字节变了就 `bumpPatch(runtime.version)`，没变就不动。判断依据是**已有声明里的摘要**，不是时间戳或人工意愿，因此同一次构建重跑不会无限涨版本。

这次的实际修法是把 `0.2.0` 抬到 `0.2.2`（手改到 `0.2.1`，再用一次人为的摘要漂移验证脚本会自己推到 `0.2.2`）：历史漂移已经发生，单靠脚本只能覆盖「下次字节变化」。改键后宿主看到一个从未安装过的目录，`resolve()` 必然失败 ⇒ `installed=false` ⇒ 用户点启动即触发一次真实的 `install()`。

`scripts/check-service-platforms.mjs` 增三条静态约束，把「人能改错」的地方堵住：

- `runtime.version` 必须是 `<major>.<minor>.<patch>`；
- `runtime.kind === "host-node"` 时 `runtime.entry` 必须等于 `platforms[*].executable` / `artifacts[0].destination`（三者不同就会出现「装到 A、跑的却是 B」）；
- 成功输出里带上 `runtime.version`，让 CI 日志能直接看出这次发布换没换键。

## 后果

- 升级后侧栏入口不再依赖「宿主先拆旧再启新」这一未成立的假设；
- 服务运行时在每次 shim 变更后换目录键，最坏情况是用户仍需点一次「启动服务」重新安装，而不是永远起不来；
- 旧的 `runtime/versions/0.2.0/` 目录留在磁盘上不再被引用，无害，也不自动删除 —— 删除属于宿主的清理策略，插件无权越界；
- 代价是 `runtime.version` 与插件版本不再有任何对应关系。这是接受的：它标识的是**制品字节**，不是发布。

## 证据分级

- **Observed**：激活/反激活交叠时序；`registerWorkspaceView` 的 push/splice 实现；`isReadyRuntime` 的整对象比较与 `markerFor` 字段序；`install(pluginId, serviceId, artifacts)` 的签名；`src/runtime.ts` 的 `ARTIFACT_PATH`/`ARTIFACT_DESTINATION` 与 `astravia-plugin://` 取址；`runtime/versions/0.2.0` 的 marker 与字节；四份历史 `plugin.json` 的摘要差异；`grantedPermissions` 八项齐全；打包器只收 `dist/assets/**`。
- **Inferred**：没有侧栏入口 ⇒ 用户不会触发 `install()` ⇒ 第二个缺陷以 290 次 `data-read` 报错的形式暴露；模块级句柄在宿主「共享模块实例」时才会串味，本次日志与该推断一致（交叠窗口 515 ms 内完成替换与释放）。
- **Assumed**：宿主是否对同一插件复用同一个模块实例（本机无法观测模块注册表）；`runtime.version` 变更后宿主是否会自动清理旧目录（未在宿主代码中找到对应逻辑，故按「不清理」设计）。

## 验证

- `npm run shim` 在摘要变化时输出 `runtime.version 0.2.x → 0.2.y（shim 字节已变）`，在字节未变的重跑中不再变化（两次都跑过：先用一次人为的摘要漂移触发 `0.2.1 → 0.2.2`，随后重跑确认不涨）；
- `node scripts/check-service-platforms.mjs` 输出 `runtime 0.2.2`；
- `npm run check`（tsc）无报错；`npm test` 七组全绿（18/26/17/14/24/41/48）；`npm run build` 打出 `release/open-ai-canvas-0.1.8.astraviapkg`（32 个运行时文件）；
- **未验证**：装进真实 Desktop 后再点一次「启动服务」是否真的重建目录并进入 ready。这一步需要 UI 与一次 `spawn`，本机只能静态论证「新目录键 ⇒ `resolve()` 必失败 ⇒ `installed=false` ⇒ 点启动必走 `install()`」。已知盲区。
