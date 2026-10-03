**阻塞性缺陷：无。**（第四轮独立复验：B1/B2/B3 三条已修复并端到端复现通过）

# dbx-pro 自持引擎 · 第四轮独立复验（B1/B2/B3 修复验证）

**阻塞性缺陷：无。** 第三轮审计的 3 条阻塞缺陷（B1 注释剥离污染被执行 SQL / B2 坏路径永久卡死引擎 / B3 密钥缺失时鉴权静默关闭）均在源码与构建产物中修复，并已由我端到端独立复现通过；引擎另有 6 条非阻塞残余（第七节），其中 2 条须在交付说明中如实披露。**本报告全部结论来自我自己重跑，未采信 `fix-1-report.md` / `fix-3-report.md` 及修复方任何汇报。**

---

## 一、结论速览

| 项 | 结论 | 我的实证 |
| --- | --- | --- |
| B1 字符串感知注释剥离 | **已修复** | 源码入口 + 构建产物双入口 9/9 通过；`SELECT 'a/*b*/c','d--e'` 原样返回；`INSERT …('p/*q/*r')` 落库原样；`SELECT 'a;b'` 由 403 → 200 且 statement_count=1 |
| B2 打开前头校验 | **已修复** | `/etc/passwd`、`/private/etc/passwd` 由 ≥150s 挂死 → **2–3 ms** 返回 502 `CONNECTION_ERROR "不是有效的 SQLite 数据库文件"`；目录/`/dev/null` → "不是普通文件"；合法头+垃圾 → 1 ms 报错；之后 `/health` 与查询正常 |
| B3 密钥缺失 fail-closed | **已修复** | 未设/空串环境变量 → **exit 1 + `NO_SECRET`**（不再启动）；`--auth-disabled` 才放行；空白密钥虽进入 enabled 但任何令牌都匹配不上（拒绝，非绕过） |
| 写闸门 / 鉴权回归 | **无旁路** | 14/14 闸门探针符合预期；无令牌/错令牌/伪造 `x-dbx-token` → 401，正确 `x-dbx-token` → 200 |
| 新测试有效性 | **有鉴别力** | 3 个定点变异体各只挂**对应**的 1 个子用例（10/11/12），无连带失败 |
| 门禁 | **全部独立复跑通过** | tsc exit 0；单测 `# tests 66 / # suites 9 / # pass 66 / # fail 0`（无 `not ok`）；`build-engine.mjs --check` 两项 `ok`；`shasum -a 256` 与 `plugin.json` 声明逐位一致（包内亦一致）；`marketplace.mjs check` exit 0 `Validated`；`vite build` exit 0 |

复验入口：`service/src/http-server.mjs`（源码）与 `service/main.mjs`（构建产物），结果一致。

---

## 二、B1 · 字符串感知注释剥离

**修复形态【实证】**：`service/src/engine/query-guard.mjs`（264 行，原 179 行）新增 `QUOTE_CLOSERS`（`' " \` [`）与分段扫描器 `scanSql(sql, {onCode, onLiteral})`：单/双/反引号/方括号内的内容视为数据（`''`/`""` 双写转义），`--` 与 `/* */` **仅在字面量之外**被替换为空格；`stripSqlComments` 与 `splitStatements` 都改为委托 `scanSql`，执行的是 **保留字面量原文** 的语句（不是剥离后文本）。

**我的复现（`/tmp/audit4/e2e.mjs`，双入口同结果）**

| 探针 | 结果 |
| --- | --- |
| `SELECT 'a/*b*/c' AS v, 'd--e' AS w` | 200，`{"v":"a/*b*/c","w":"d--e"}`（第三轮为 `"a c"`） |
| `INSERT INTO t VALUES (3,'p/*q*/r')` + 回读 | 200，落库 `p/*q*/r`（第三轮被静默写成 `p r`） |
| `SELECT 'a;b' AS v` | 200，`statement_count=1`，值 `a;b`（第三轮误 403 `WRITE_BLOCKED`） |
| `SELECT 'it''s -- fine'` | 200，值 `it's -- fine` |
| `SELECT 'x;y' AS a; SELECT 2 AS b` | 200，`statement_count=2`，顶层镜像最后一条 |
| `SELECT 1 AS [a--b]` | 200，列名 `a--b` |
| `SELECT/*c*/1 AS one` | 200（代码区注释仍被剥离） |
| `SELECT 'abc`（未闭合） | 502 `DRIVER_ERROR`，不误放行写；随后 `SELECT 1` 仍 200 |
| `SELECT 'a/*' ; DROP TABLE t; SELECT '*/b'` | 403 `DDL_BLOCKED`，表 `t` 仍在 |
| 写闸门 14 组（`DROP`/`drop`/`INSERT`/`UPDA/*x*/TE`/`WITH…DELETE`/`PRAGMA`/`ATTACH`/`EXPLAIN ANALYZE`/`/*!…*/`/`--\n;DROP`/确认文本） | 14/14 符合预期，无旁路 |

**变异验证**：把 `splitStatements` 的 `onLiteral` 改回「字面量内注释也被剥离」（复现旧缺陷的被执行文本形态）→ 引擎套件 `16 pass / 1 fail`，唯一失败子用例 = `not ok 10 - 字符串里的注释符是数据，不被判定层剥离（B1）`。**该用例有鉴别力【实证】。**

---

## 三、B2 · 打开前头校验（防引擎永久卡死）

**修复形态【实证】**：`service/src/drivers/sqlite-driver.mjs:53-79` 新增 `assertOpenableSqliteFile(file)`：`statSync` → 非普通文件直接拒 → 0 字节放行（合法新库）→ 读取 16 字节与 `SQLITE_MAGIC = "SQLite format 3\0"` 比对 → 不符抛 `CONNECTION_ERROR`；调用点 `:173`，在 `new DatabaseSync(...)`（`:178`）**之前**；`:168-171` 保留「文件不存在」拒绝，不静默建库。

**我的复现（`/test` 与 `/query` 同路径）**

| 目标 | 第三轮 | 本轮 |
| --- | --- | --- |
| `/etc/passwd` | ≥150 s 不返回、进程挂死、SIGTERM 无效 | **3 ms** 502 `CONNECTION_ERROR` |
| `/private/etc/passwd` | 同上 | **1 ms** 502 |
| 纯文本文件 | 80–120 ms 报错 | 0 ms 502 |
| 目录 | `unable to open database file` | 0 ms 502「不是普通文件」 |
| `/dev/null` | 按 0 字节打开（幽灵成功） | 1 ms 502「不是普通文件」（行为变更，见第七节） |
| 合法头 + 全零（4080 B） | 未测 | **1 ms** 502 `DRIVER_ERROR file is not a database` |
| 合法头 + 随机（5040 B） | 未测 | **1 ms** 502 `DRIVER_ERROR file is not a database` |
| 0 字节文件 | 允许（新库） | 200（保持） |
| 已有合法库 | 200 | 200 |
| 全部坏文件之后 `/health` + `SELECT 1` | 进程已挂死 | 200 / 200（**引擎不再被一个坏路径带走**） |

---

## 四、B3 · 密钥缺失拒绝启动（fail-closed）

**修复形态【实证】**：`service/src/http-server.mjs:171-183`，`main()` 在构造 `createEngineServer` **之前**读取 `ASTRAVIA_SERVICE_SECRET_ENGINE_KEY`，缺失或空串且未显式传 `--auth-disabled` → `emit("server-error",{code:"NO_SECRET"})` + `process.exit(1)`。

**我的复现**

| 场景 | 结果 |
| --- | --- |
| 环境变量未设置 | **exit code 1**，stdout 事件 `server-error/NO_SECRET`，无 `listening` |
| 环境变量为空串 | exit code 1 + `NO_SECRET` |
| `--auth-disabled`（无密钥） | 正常启动，`/health` 如实报 `auth:"disabled"`，无令牌 `/query` 200（显式调试通道） |
| 密钥仅空白 `"   "` | 启动且 `auth:"enabled"`；无令牌 401、任意令牌 401 ⇒ **拒绝而非放行**（见第七节 4） |
| 密钥正常：无令牌 / 错令牌 / 伪造 `x-dbx-token` | 401 / 401 / 401 |
| 密钥正常：正确 `x-dbx-token` | 200（第三轮仅由源码推断的等价鉴权通道，**本轮已实测成立**） |
| `plugin.json#process.args` | 未注入 `--auth-disabled`（宿主不会意外关鉴权）【实证，逐字核对】 |

---

## 五、门禁独立复核（全部我自己重跑）

| 门禁 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | **exit 0** |
| `npm test` | `# tests 66 / # suites 9 / # pass 66 / # fail 0`，**无 `not ok`、无 `cancelledByParent`**（D1 期套件级 TAP 缺陷保持消除） |
| `node scripts/build-engine.mjs --check` | **exit 0**；`service/main.mjs` 29748 B `dbe2350b…` ok；`service/drivers/sqlite-driver.mjs` 11977 B `f22a82ca…` ok |
| 独立 `shasum -a 256` vs `plugin.json` | 5 个平台的 2 条声明与实测**逐位一致**；**解包后包内两个文件哈希同样一致** |
| `node scripts/marketplace.mjs check`（须在仓库根执行） | **exit 0 / `Validated source entries for astravia-official-marketplace`** |
| `npx vite build` | **exit 0，`release/dbx-pro-0.0.11.astraviapkg` = 307 382 B / 22 个运行时文件**；包内含 `service/main.mjs` 与驱动分片，**不含 `service/src`、无符号链接** |
| 版本一致性 | `protocol.mjs:12 ENGINE_VERSION "0.1.1"` ↔ `plugin.json runtime.version "0.1.1"`（插件版本 0.0.11 独立）【实证】 |

**测试真实性（变异测试，全部在 `/tmp/audit4/mut/**` 副本执行）**

| 变异体 | 注入 | 结果 |
| --- | --- | --- |
| m0 基线 | 无 | 17 pass / 0 fail |
| m1 | `splitStatements` 的 `onLiteral` 恢复为「剥离字面量内注释」 | 16/1，失败子用例 = `not ok 10 …（B1）` |
| m2 | `sqlite-driver.mjs:173` 头校验调用短路 | 16/1，失败子用例 = `not ok 11 …（B2）` |
| m3 | `http-server.mjs:175` fail-closed 条件短路 | 16/1，失败子用例 = `not ok 12 …（B3）` |

三个变异体各自只挂对应子用例，**新用例具备鉴别力，不是空跑【实证】**。

---

## 六、我重跑过程中的自查（避免把工具缺陷算成引擎缺陷）

- 首轮 harness 未先建表 `t`，导致 4 条探针被误判失败（`no such table: t`）；建表后 **14/14** 全部通过 → 属 harness 缺陷，已修正。
- 首轮把常驻引擎用「等待退出」的函数启动，触发 `--auth-disabled` 用例超时 → 改为常驻启动，通过。
- 在途阻塞探针首版被前一步的 SIGTERM 交叉污染（引擎已优雅退出 → `/health` `TypeError`）；改成分离的 A/B 两个探针后结论清晰（见第七节 1）。
- `marketplace.mjs` 位于**仓库根**，在插件目录执行会 `MODULE_NOT_FOUND`（CWD 假象，非合规失败）。

---

## 七、非阻塞残余（须披露，不阻断交付）

1. **无界语句仍可长时间阻塞引擎（单线程同步 `node:sqlite` 固有局限）**【实证】。语句执行不可中断：`WITH RECURSIVE c(x) AS (…无终止条件…) SELECT count(*)` 实测使 `/health` 无响应、**SIGTERM 在 3 s 后仍不被履行（仅 SIGKILL 可停）**。死线（默认 30 s，可由 `timeoutMs` 指定）对**聚合类**语句非抢占式：1 s 死线的重聚合实测 **~5 s** 后才返回 504 `TIMEOUT`；随后 `/health` 200、查询 200（**无永久卡死**）。有界语句下 SIGTERM 被推迟但最终履行（实测 exitCode=0，延迟≈4.55 s）。宿主侧请求超时是唯一兜底。**建议**：把 open 与语句执行放进 `worker_threads`/子进程并施加硬超时。**交付说明应表述为「打开前的坏文件不再能卡死引擎」，不得表述为「引擎可随时被中断」。**
2. **`PAYLOAD_TOO_LARGE` 413 仍不可达**（audit-3 N1 未变）【实证】：`http-server.mjs:80` reject 后紧接 `:81 req.destroy()` → 9 MiB 请求实测客户端 `TypeError: fetch failed`，无 413 响应。属诚实性缺口。修法：先回包再销毁，或不销毁。
3. **B3 的库级残余**：`createEngineServer` / `createAuth` 仍导出，空 token 下 `enabled:false`（fail-open）；grep 证明二者只被同文件 `main()` 引用（无外部/测试 import）⇒ CLI 入口是唯一路径，故非阻塞。另 `:191` 的 `reason:"no-secret"` 已成死值（只有 `"flag"` 可达）。
4. **空白字符串密钥**：`token.length > 0`（无 `trim()`）使其进入 `auth:"enabled"`，但呈现值总被 `:62` trim，任何令牌都匹配不上 ⇒ **fail-closed（拒绝，不是绕过）**，安全上无碍；建议 `token.trim()`。
5. **`/dev/null` 行为变更**【实证】：字符设备现被拒（"不是普通文件"），此前按 0 字节打开形成「幽灵成功」。属改进，但需知会调用方。
6. **CI 仍未执行本次新增测试**（audit-2 R3 残留）：`.github/workflows` 无 `npm test` 调用；本机 Node v22.22.2 下 `npm test` 通过。

---

## 八、未验证清单【未知】（不得当作已完成）

- 真实 Desktop 宿主 `install() → start() → /health` 全链路，与 `templates → readDataFile → install` 桥（无联调环境；`open-astravia` 禁止触碰）。
- `host-node` 下 `executable` 的 spawn 语义、产物无 shebang 是否影响启动。
- `MAX_TEMPLATE_BYTES` 实际取值；`win32-x64` / `linux-*` 真机启动（本机 arm64 macOS）。
- 宿主对「引擎被无界语句卡住」的处理（是否有更硬的中断/重拉策略）。
- 引擎虽已声明并自证，但 **UI 侧仍未接线**（`engine-client.ts` 在 `src/` 零引用，面板硬编码 `allowWrites:false`）——交付说明不得表述为「引擎已可用」。

---

## 九、只读保证与修订快照

- 复验对象 18 个文件的 sha256 基线 = `/tmp/audit4-baseline.sha`；终检（在插件目录执行）**非 OK 行数 0**，零漂移。
- 本轮写入范围：仅本报告、`/tmp/audit4/**` 临时基线与变异副本；以及一次经任务授权的 `npx vite build`（只重写被 gitignore 的 `dist/`、`release/`）。**未改**任何源码、`plugin.json`、`package.json`、`.gitignore`；**未执行**任何 `git add/commit/checkout/reset/stash`；**未触碰** `source-code/astravia`、`open-astravia`、`web-element-picker/**` 及其它插件。
- 快照：HEAD `bab45f8395e44ab6ed5d11d516e6233fc90a57ad`，分支 `main`；`git status --porcelain | wc -l` = 51（含他人 WIP `cli-proxy-api/package.json`、`web-element-picker/src/kernel/*`，与本次重构无关）。

**放行建议**：B1/B2/B3 已闭环，可放行进入 D2；第七节 1、2 两条须写入交付说明的风险清单，1 建议进入下游排期（worker 化）。
