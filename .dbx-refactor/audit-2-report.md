**无阻塞缺陷：5 项修复已闭环。**（残余 4 条非阻塞风险 R1–R4，见第五节；不含范围外事项）

# dbx-pro 修复复审报告（audit-2）

审计日期 2026-10-03 · 独立复审，未修改任何插件源码（唯一写盘文件为本报告；另按验收要求执行了 `npx vite build`，仅重建被 gitignore 的 `dist/`、`release/`）

---

## 一、被审计修订版本与漂移

| 项 | 值 |
| --- | --- |
| 仓库 | `astravia-official-marketplace` |
| HEAD | `bab45f8395e44ab6ed5d11d516e6233fc90a57ad` |
| 分支 | `main` |
| dbx-pro 暂存改动 | 17 项（与审计起点逐条一致，**无漂移**） |
| 审计起点校验和 | `/tmp/audit2-baseline.sha`（10 个文件） |
| 复检结果 | `shasum -a 256 -c` 全部 `OK`（审计开始前、构建后各一次） |

被审计的 5 项修复对应的文件：`src/shared/services/query-service.ts`、`src/domain/sqlite-output.ts`(新增)、`src/domain/connection-config.ts`、`src/features/main-panel/components/dbx-pro-panel.tsx`、`src/test/*.test.js`(3 个)、`package.json`、`package-lock.json`。

---

## 二、5 项修复逐项验证

### B1 — sqlite3 以 `--` 终止选项解析 【实证｜已闭环】

- 源码逐字核对：`src/shared/services/query-service.ts:61`
  `await getCommand().run("sqlite3", [file, "-json", "--", sql], { timeoutMs: limit })`（参数顺序 `file → -json → -- → sql` 正确）
- 端到端（真实 sqlite3，`/tmp/audit2.db`）：

```
$ sqlite3 /tmp/audit2.db -json -- "-- ⌘/Ctrl+Enter 执行
SELECT 1;"
[{"1":1}]            exit=0        ← 修复后：成功
$ sqlite3 /tmp/audit2.db -json "-- 注释
SELECT 1;"
sqlite3: Error: unknown option: - 注释 … exit=1   ← 修复前形态：确实失败
```

- 出厂默认 tab 仍以 `-- ⌘/Ctrl+Enter 执行` 开头（`dbx-pro-panel.tsx:122`）→ 原缺陷触发路径真实存在，修复确实消除它。
- 副作用扫描：全仓命令调用点仅此 1 处（`grep -rn "\.run(\|spawn(" src/` → 只有 `query-service.ts:61`），`--` 不影响其它调用。空 SQL（`-- ""`）exit 0、无输出，面板 `runSql` 已用 `!sqlText.trim()` 拦截。

### B2 — `parseResultSets` 字符串感知切分 + 取最后一个结果集 【实证｜已闭环】

- 真实 `sqlite3 -json "SELECT 1 AS a; SELECT 2 AS b, 'z]z' AS s, 'q"z' AS q; SELECT 3 AS c;"` 输出（含字符串内 `]` 与转义引号）喂给被测模块：

```
结果集个数: 3
  set[0] = [{"a":1}]
  set[1] = [{"b":2,"s":"z]z","q":"q\"z"}]
  set[2] = [{"c":3}]
取最后一个 → [{"c":3}]        columns → ["c"]
note 文案 → 已忽略前 2 个结果集，仅展示最后一个
```

- 空输出/纯空白/写语句（`INSERT`）/空结果集 → `sqlite3` stdout 为空、exit 0 → `sets=[]`、`rows=[]`，不抛异常（与旧行为一致）。
- 非 JSON 文本 → `parseResultSets` 返回 `[]`，`query-service.ts:68-70` 转为可读错误 `无法解析 sqlite3 的输出：…`（不再是 `SyntaxError`）→ 失败是**诚实**的，不是静默假成功。
- 深层嵌套（5 层数组）1 个结果集 ✓；2×1.3 MB 输入 62 ms、2 个结果集 ✓。
- `note?: string`（`connection-config.ts:198-199`）仅成功路径产生；`dbx-pro-panel.tsx:219` 写入 `runState.data`，`:323` 仅 `runState.kind === "result"` 分支渲染 → 无丢失、无错误分支误显。
- 语义确认（产品取舍，非缺陷）：多语句时展示**最后一个**结果集并如实提示被忽略的数量。

### B3 — 测试改为导入真实源码 【实证｜已闭环】

- 三个测试文件的全部 import 均指向真实源码，无手抄副本：`../domain/catalog.ts`、`../domain/connection-config.ts`、`../domain/sqlite-output.ts`。
- `npm test`（= `node --experimental-strip-types --test src/test/*.test.js`）→ **`# tests 47 / # pass 47 / # fail 0`**，exit 0；逐文件 23 + 19 + 5 = 47。
- 与 `npx tsc --noEmit` → **exit 0** 一致（类型剥离与 tsc 双通过）。

### N1 — manifest 去重 【实证｜已闭环】

真实源码实测（`node --experimental-strip-types` 导入 `connection-config.ts`）：

```
总条数: 85 / 唯一 dbType: 85 / 唯一 label: 85
重复 dbType: [] / 重复 label: []
mongodb 出现次数: 1 / cassandra: 1
```

### P1 — 锁文件绝对路径改仓库相对 【实证｜已闭环（限于本轮口径）】

- `package-lock.json:11-12` 现为 `file:../../../.tooling/open-astravia/packages/plugins/plugin-sdk|plugin-vite`，`resolved` 字段同步（`:88/:92` 等）。
- 相对路径算术正确：以包目录为基准解析 → `<repo>/.tooling/open-astravia/packages/plugins/plugin-sdk`，**该路径存在: true**。
- 已无 `file:/Users/...` 条目（section 4 grep 仅剩相对形式）。

---

## 三、变异检查（独立验证 B3 的测试是否真有效）

在 `/tmp/dbx-mut` 副本（`cp -R src/`，仓库零改动）注入 4 个变异并运行测试：

| 变异 | 内容 | 结果 |
| --- | --- | --- |
| M1 | `escapeSqlLiteral` 不再转义单引号（`catalog.ts:22`） | catalog.test.js **20/23，fail 3** ✓ 变红 |
| M2 | `parseResultSets` 改为 `sets.slice(1)`（丢首集） | sqlite-output.test.js **2/5，fail 3** ✓ 变红 |
| M3 | `inferCatalogFamily` 恒返回 `"schemas"` | connection-config.test.js **16/19，fail 3** ✓ 变红 |
| M4 | **重新引入重复 `mongodb`（复刻 audit-1 引用的反例）** | `not ok 2 - no duplicate dbType → duplicate dbType: mongodb` + `duplicate order: 281` ✓ **被抓住** |

另：`node --test src/test/does-not-exist.test.js` → `Could not find …`，**exit 1**（runner 不会在文件缺失时静默通过）。
基线对照：副本未改坏时 47/47 全绿 → 红/绿由实现决定，测试有鉴别力。

---

## 四、新增阻塞候选的排除扫描

| 候选 | 结论 |
| --- | --- |
| `parseResultSets` 静默 `catch` 吞异常 | 非阻塞：无法解析时返回 `[]`，调用方 `query-service.ts:68` 抛可读错误并原样显示，不产生假成功 |
| 非数组 JSON / 标量 JSON / 截断数组 | 非阻塞：均返回 `[]` → 同上走可读错误路径 |
| 前导游离 `]` 破坏深度计数 | 非阻塞：返回 `[]` → 可读错误（`sqlite3` stdout 只会是 JSON 数组，理论不可达） |
| `note` 类型/序列化 | 非阻塞：可选字符串，仅存在于渲染层状态，无 IPC/持久化边界 |
| `--` 对其它 sqlite3 调用（自带 `-` 参数）的影响 | 非阻塞：仅 1 个调用点，且 `-json` 位于 `--` 之前 |
| CI 无 `--experimental-strip-types` 兼容性 | 非阻塞：CI 完全不执行插件测试（`.github/workflows/` 对 `npm test`/`src/test` **零命中**）；本机 Node v22.22.2 支持该 flag；`node --test 'src/test/*.test.js'`（带引号，Windows/cmd 形态）同样 47/47 exit 0 → 跨平台安全 |
| 构建回归 | 无：`npx vite build` exit 0（11.57s），制品 `release/dbx-pro-0.0.11.astraviapkg` 244176 B / 19 文件；包内含修复（`dist/assets/dbx-pro-panel-*.js` 命中 `["sqlite3",file,"-json","--",sql]` 与 `已忽略前 ${n} 个结果集，仅展示最后一个`）；无 `src/`、无 `.ts` 残留 |
| 版本一致性 | 无：`plugin.json:5` = `ability.json:5` = `marketplace.source.json` 条目 = `0.0.11`；`minAppVersion 0.5.59` 未变 |

---

## 五、残余非阻塞项（本轮不阻塞交付，建议排期）

- **R1** 多语句只展示最后一个结果集：若用户脚本的**首个** `SELECT` 才是目标结果，会被忽略（已有 `note` 提示）。旧工作台在多结果集下的展示口径 **【未知】**，需真机对照。
- **R2** 抛出路径无单测：`query-service.ts:68-70`（非空但解析不出数组）与 `:62-64`（非零退出）没有覆盖，`sqlite-output.test.js` 只测纯函数。建议补一个 `executeQuery` 级的注入式用例。
- **R3** 测试门禁仅本地：新测试有真实鉴别力，但 CI 不运行（`AGENTS.md:19` 的仓库门禁只跑 `tests/*.test.mjs`）。建议把 `npm test` 纳入插件发布前检查。
- **R4** 锁文件仍不可移植（机器本地 `file:` 依赖 + 缺 `@astravia-org/plugin-cli`）；本轮只改相对形式，**能否重生成**属范围外。

---

## 六、范围外（本轮不判定，仅供下游参考）

1. **自持引擎未实现**：非 sqlite 类型仍抛 `ENGINE_NOT_READY`（`query-service.ts:44-50`），UI 原样展示——诚实边界，非缺陷。
2. **锁文件无法重新生成**（公共 npm `@astravia-org/*` E404）与 `package.json` 不自洽：本轮只核验相对路径改法。
3. **面板硬编码中文 / i18n 未改造**：面板中文串 133 处；`note` 文案硬编码在 `query-service.ts:82`，`locales/zh.json` 中 0 命中。
4. **市场文案仍与实现不符**（本轮未要求修复，但与仓库「不做虚假承诺」规则冲突，建议尽快改）：`detail.json` / `detail.zh.json` 仍写 `60+ databases`、`via dbx CLI`；`marketplace.source.json` 的 `description` 同样含 `60+ databases via dbx CLI`，而当前仅 SQLite 可直连。
5. 上一轮的非阻塞项 N2（连接身份用 `name`）、N3（测试连接假阳性 + 写副作用）、N4（空结果无表头）、N5（口令明文，宿主 `ctx.secrets` 可用）**状态未变**，不在本轮 5 项修复范围内。

---

## 七、未能验证项

1. 真机 Desktop 内 `sqlite3` 白名单命令链路（需启动宿主实际执行）。
2. 旧工作台的逐像素还原度与多结果集展示口径（本轮为设计还原的独立审计，不在 5 项修复内）。
3. `npm ci` 在干净 CI checkout 下的行为（CI 未装插件依赖）。
4. Windows 主机上的 `sqlite3` 与 `node --experimental-strip-types` 实测（仅验证 glob 传参形态）。
5. `vite build` 产物的运行期装配（module federation 加载面板）——本轮仅验证产出与内容。
6. R1/R2/R3 的修复效果（尚未排期实现）。

---

## 八、结论

**允许判定「5 项修复闭环」**：B1/B2 有端到端实证（修复前失败、修复后成功）；B3 经变异检查证明测试具备真实鉴别力（含 `mongodb` 重复反例重新被抓住）；N1 实测 85/85 唯一；P1 相对路径算术正确。`tsc --noEmit` exit 0、`npm test` 47/47、`vite build` exit 0 且制品含修复。无新增阻塞缺陷；R1–R4 为可排期改进，不阻塞交付（R1 需真机对照后确认口径）。

审计过程对仓库零源码改动：10 个被审计文件校验和在审计前后一致，唯一写盘为本报告与按验收要求重建的 `dist/`、`release/`（均被 gitignore）。
