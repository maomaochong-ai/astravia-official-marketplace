# dbx-pro 阻塞项修复报告（fix-1）

修复对象：`.dbx-refactor/audit-1-report.md` 判定的 3 条阻塞缺陷 + 1 条既有阻塞 + 1 条去重缺陷。
修复范围：**仅** `abilities/plugins/dbx-pro/**`（未触碰旧项目 `source-code/astravia`、未触碰宿主 monorepo `open-astravia`）。
执行者：leader（`@master`）。修复后三绿回归全部通过。

---

## 一、修复清单与证据

### B1（阻塞）sqlite3 SQL 前缺 `--`，注释开头的 SQL 直接失败

- 位置：`src/shared/services/query-service.ts` → `executeQuery` 的命令调用。
- 改法：`getCommand().run("sqlite3", [file, "-json", sql])` → `["sqlite3", file, "-json", "--", sql]`（`--` 结束 argv 选项解析），并加注释说明原因。
- 【实证】同机复现与验证：

```
$ sqlite3 /tmp/dbx-b1.db -json -- "-- 注释
SELECT * FROM t;"
[{"a":1,"b":"x"},
{"a":2,"b":"y"}]                      ← 修复后：正常返回

$ sqlite3 /tmp/dbx-b1.db -json "-- 注释
SELECT 1;"
sqlite3: Error: unknown option: - 注释   ← 修复前：报错
exit=1
```

### B2（阻塞）多语句输出为多个 JSON 数组，整段 `JSON.parse` 抛错

- 改法：把「括号深度扫描」抽成**纯函数** `parseResultSets(text)`，落在新文件 `src/domain/sqlite-output.ts`（domain 层无运行时依赖，便于单测覆盖）；`query-service.ts` 改为导入该函数。
- 行为：扫描 stdout 中全部顶层 JSON 数组（跳过字符串内部方括号、处理反斜杠转义）→ **取最后一个结果集**展示；`sets.length > 1` 时在结果上带 `note: "已忽略前 N 个结果集，仅展示最后一个"`；`text` 非空但一个数组都切不出来 → `throw new Error("无法解析 sqlite3 的输出：…")`（不静默吞、不假装空集）。
- 联动：`DbQueryResult` 新增可选 `note?: string`（`src/domain/connection-config.ts`）；面板状态栏（`dbx-pro-panel.tsx`）在同一结果 span 内联渲染 `· {note}`。
- 【实证】真实 `sqlite3 -json` 多语句输出（本机实测），并用该文本作为回归样例：

```
$ sqlite3 /tmp/dbx-b1.db -json -- "SELECT 1 AS a; SELECT 2 AS b, 'z]z' AS s;"
[{"a":1}]
[{"b":2,"s":"z]z"}]        ← 注意字符串内的方括号，正是深度扫描要处理的场景
```

### B3（阻塞）单元测试是手抄副本，测不到真实实现

- 改法（**免生成物路线**）：两个测试文件删除手抄实现，改为直接 `import` 真实 TS 源码，用 Node 内置类型擦除直跑：
  - `src/test/catalog.test.js` → `import { escapeSqlLiteral, filterSystemNames, flatColumnsSql, listFlatTablesSql, listTablesInScopeSql, tableObjectSql } from "../domain/catalog.ts"`（删除原 9–70 行手抄副本）。
  - `src/test/connection-config.test.js` → `import { DB_TYPE_MANIFEST, findDbType, defaultPortFor, inferCatalogFamily, runtimeModeFor, supportsExplain, supportsTableDataEdit } from "../domain/connection-config.ts"`（删除原 10–25 行手抄副本）。
  - `src/test/sqlite-output.test.js` **新增**：B2 解析器的 5 条回归。
- 运行脚本：`package.json` → `"test": "node --experimental-strip-types --test src/test/*.test.js"`。
- 新增覆盖：flat 族目录函数（sqlite 分支与非 sqlite 返回 `null`）、引号转义、`column` 子对象、`order` 唯一、manifest 非空与 `dbType` 唯一（即 N1 的守卫）。
- 【实证】`node --experimental-strip-types --test src/test/*.test.js` → `# tests 47 / # pass 47 / # fail 0`（修复前为手抄副本下的 25 条）。

### N1（去重）manifest 存在重复 `dbType`

- 删除 `connection-config.ts` 中重复条目：`mongodb`（order 280）、`cassandra`（label "Cassandra"，order 311）。
- 【实证】`DB_TYPE_MANIFEST` → `entries: 85, unique: 85`（修复前 87 条含 2 条重复）；新增的「`dbType` 唯一 / `order` 唯一」测试会持续守卫。

### P1（既有阻塞）`package-lock.json` 含本机绝对路径

- 改法：根 `packages[""]` 中两条 `@astravia-org/plugin-sdk` / `plugin-vite` 的 `file:/Users/zhugeyue/…` 改为**仓库相对**形式（与锁文件其余位置已有的 `../../../.tooling/…` 解析保持一致）。
- 【实证】`grep -c "file:/Users" package-lock.json` → `0`。
- **残留（如实记录）**：锁文件与 `package.json` 的 `@astravia-org/plugin-cli@^0.1.7` 仍不一致（该包在锁中无条目）；`@astravia-org/*` 在公共 npm 上不存在（E404），无法重新生成一份自洽锁文件。此项属**已知残留**，不影响本次构建与验收。

---

## 二、修复后回归证据

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型 | `npx tsc --noEmit` | `exit=0`（无错误） |
| 单测 | `npm test`（`node --experimental-strip-types --test src/test/*.test.js`） | `# tests 47 / # pass 47 / # fail 0` |
| 构建/打包 | `npx vite build` | `✓ built in 11.57s`；`Wrote …/release/dbx-pro-0.0.11.astraviapkg with 19 runtime files`（244176 B） |
| 数据通路 E2E | 本机 `sqlite3` 直连（建表 → 插入 → 查询 → 多语句 → 注释开头 SQL） | 全部符合预期，见上文 B1/B2 证据 |

---

## 三、仍未解决（不属本轮修复范围，供复审与交付说明使用）

1. **自持引擎（`providers.services` 通路）尚未实现**：现数据层仅 SQLite 真连通，其余 84 个类型一律抛 `ENGINE_NOT_READY`，界面如实展示原因。方案见 `.dbx-refactor/engine-runtime.md`，属功能缺口而非本轮缺陷。
2. **N2（连接身份用 `name` 而非 `id`）**：真实风险但改动面中等，本轮记为文档化残留。
3. **N4（空结果集无列名）**：sqlite3 `-json` 空输出不携带列信息，保持现状并文档化。
4. **N6（`runtime-contract.ts` 的 `getConversation`、`plugin.json` 冗余权限）**：低优清理项。
5. **插件 i18n 全量改造**：面板仍有硬编码中文，`locales/*.json` 仅 6 键；计划在收尾阶段处理。
