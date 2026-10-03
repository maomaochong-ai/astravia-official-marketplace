# D2 报告（进度/证据）

> 结论先行，边做边记。本文件由 @developer 维护；D1 的报告在 `d1-report.md`（当前不在工作树，见 §1）。

## 0. 结论（先行）

**D2 当前无法继续：工作树在本次执行期间被并发重置，D1 引擎产物与全部 D2 增量（含本文件之外的全部新文件）已被 `git stash` 收进 `stash@{0}`，工作树回到"尚未接入引擎"的旧状态。**
按 leader 的 D2 合同（「禁止：… 任何 git add/commit/checkout/reset/stash」），我**没有执行任何 git 写操作**，也没有重新创建这些文件——因为 `stash@{0}` 里已存在同名 untracked 文件，我重新创建会让后续 `git stash pop/apply` 因文件已存在而失败。

需要 leader 决策：**由 leader 执行 `git stash apply stash@{0}`（保留 stash 作为备份）并处理 2 处冲突，或明确授权我执行同一条命令。**

## 1. 证据（原始命令与输出）

```console
$ git status --short
 M abilities/plugins/dbx-pro/package-lock.json
?? abilities/plugins/astravia-tihu/package-lock.json
?? abilities/plugins/build-apple-apps/package-lock.json
?? abilities/plugins/cli-proxy-api/package-lock.json
?? abilities/plugins/dbx-pro/src/features/workbench-settings/     # ← 本轮新写、未被 stash 收走
?? abilities/plugins/feishu/package-lock.json
?? abilities/plugins/shimo/package-lock.json
?? abilities/plugins/web-element-picker/package-lock.json
?? abilities/plugins/xiaohongshu/package-lock.json

$ git stash list
stash@{0}: On main: local dbx-pro plugin work

$ git reflog -4
669ae47 HEAD@{0}: reset: moving to HEAD
669ae47 HEAD@{1}: commit: fix(marketplace): Step 2 localMissing 重建本地 artifact 缓存
0fcd7a9 HEAD@{2}: commit: refactor(marketplace): 彻底移除 stage-plugin-release.py — Node.js 原生 ZIP 打包
4e3b190 HEAD@{3}: reset: moving to HEAD
```

`stash@{0}` 的 untracked 清单（节选，全部为 dbx-pro 相关）：

```
.dbx-refactor/{audit-1,audit-2,audit-3,audit-4}-report.md
.dbx-refactor/{d1-report,fidelity-report,fix-1-report,fix-3-report}.md
abilities/plugins/dbx-pro/scripts/build-engine.mjs
abilities/plugins/dbx-pro/service/main.mjs
abilities/plugins/dbx-pro/service/src/**                       # 引擎 7 个源文件
abilities/plugins/dbx-pro/service/drivers/sqlite-driver.mjs
abilities/plugins/dbx-pro/src/domain/{driver-tiers,query-history,query-history-store,
   sql-write-guard,workbench-settings,workbench-settings-store}.ts
abilities/plugins/dbx-pro/src/shared/services/{engine-client,query-router,query-service}.ts
abilities/plugins/dbx-pro/src/test/{engine-service, sqlite-output}.test.js
abilities/plugins/dbx-pro/src/features/query-history/components/history-panel.tsx
```

`stash@{0}` 的 tracked 变更（`git stash show --stat`，节选）：`plugin.json +124`（`providers.services` 全部声明）、`src/index.tsx 14`、`src/runtime-contract.ts 74`、`connection-form.tsx 70`、`dbx-pro-panel.tsx 314`、`detail.json/detail.zh.json 各 27`、`locales/{en,zh}.json 各 2`、`.astravia/marketplace.source.json 4`、`package.json(+1)`。

磁盘现状（当前工作树）：

```console
$ ls abilities/plugins/dbx-pro          # 无 service/、无 scripts/
$ ls abilities/plugins/dbx-pro/service
ls: service: No such file or directory
$ grep -c "tierLabel\|queryRouter" dbx-pro/src/features/connection-management/components/connection-form.tsx
0
$ grep -c "providers" dbx-pro/plugin.json
0
```

恢复可行性（只读检查，未改任何文件）：

```console
$ git stash show -p stash@{0} | git apply --check -
error: patch failed: .astravia/marketplace.source.json:642
error: .astravia/marketplace.source.json: patch does not apply
error: patch failed: abilities/plugins/dbx-pro/package-lock.json:10
error: abilities/plugins/dbx-pro/package-lock.json: patch does not apply
```

⇒ **其余文件可干净恢复，仅 2 处冲突**：`.astravia/marketplace.source.json`（新提交改写过该文件）与 `dbx-pro/package-lock.json`（stash 里 +377 行，即已知 R4 绝对路径锁文件问题）。这两处冲突**与 D2 功能无关**：前者只需确认引擎能力条目是否仍需登记，后者可直接取当前 HEAD 版本（锁文件问题已登记为 R4，不在本轮范围）。

## 2. 对新提交管线的影响（需按新管线复验）

新提交 `0fcd7a9` 删除了 `scripts/stage-plugin-release.py`，改由 Node 原生 ZIP 打包。已核对 `scripts/static-marketplace.mjs`：

```
150: const RUNTIME_DIRS = ['dist', 'locales', 'agent', 'assets', 'service'];
151: const SKIP_DIRS = new Set(['node_modules','src','test','tests','release','.git','.vite']);
152: const MAX_BYTES = 50 * 1024 * 1024;
```

⇒ `service/**` 仍进包、`src` 仍排除、上限仍 50 MB，**D1 的打包方案（`templates[].source` 通道 + 22 runtime files）在新管线下原理不变**，但「22 个运行时文件 / 307 382 B」的实证需要在恢复后按新管线重跑一次（本报告此前记录的是旧 `stage-plugin-release.py` 的输出）。

## 3. 逐项进度（a→d）

| 项 | 状态 | 说明 |
| --- | --- | --- |
| (b) 档位标注 | 代码已写、**已被 stash 收走** | `driver-tiers.ts` + `connection-form.tsx`（选择器每项档位后缀、档位图例、当前选中项说明，均已落盘并修正过插入位置） |
| (a) 接线+降级 | 代码已写、**已被 stash 收走** | `query-router.ts`（引擎优先 + `ENGINE_FALLBACK_CODES = {ENGINE_NOT_READY, TRANSPORT_ERROR, DRIVER_UNSUPPORTED, BAD_RESPONSE}`，**不含 TIMEOUT**）、`runtime-contract.ts#getServices()`、`index.tsx#bindEngineServices` |
| (c) G1 历史 | 纯逻辑+store 已写、**已被 stash 收走**；面板已写、**已被 stash 收走** | `query-history.ts`、`query-history-store.ts`、`query-history/components/history-panel.tsx` |
| (d) G2 设置 | 纯逻辑+store 已写、**已被 stash 收走**；面板**仍在磁盘** | `workbench-settings.ts`、`workbench-settings-store.ts`；`features/workbench-settings/components/settings-panel.tsx`（4 620 B，未被 stash 收走） |
| 面板重写（tab/芯片/来源徽标） | **未开始** | `dbx-pro-panel.tsx` 现为旧版（0 处 `queryRouter`） |
| 5 个新测试文件 | **未开始** | 依赖上述模块恢复 |

## 4. 未验证【未知】

- 无法判断是否有其他参与者正在同一工作树继续操作（若 leader 正在并行恢复/再提交，我此时动手会互相覆盖）。
- `stash@{0}` 是否还包含**不属于本任务的他人 WIP**：`git stash show --stat` 显示它同时收走了 `abilities/plugins/cli-proxy-api/package.json`、`abilities/plugins/web-element-picker/src/kernel/*`、以及 7 个插件的 `package-lock.json`。**恢复时需 leader 确认这些文件是否应当一起回到工作树。**
- 新管线（`publish-marketplace.mjs`）对 `service/**` 的实际入包结果：仅静态读到 `RUNTIME_DIRS` 含 `service`，**未实证跑过**【未知】。
