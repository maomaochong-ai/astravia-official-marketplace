# fix-3 报告：第三轮审计 B1 / B2 / B3 修复

**结论（首行）**：第三轮审计的 3 条阻塞缺陷已全部修复，各有 1 条回归用例，且每条都用「真子进程 + 真 HTTP」独立复现过「修复前红 / 修复后绿」。当前门禁全绿：`tsc` exit 0；全量单测 **66/66/0**（无任何 `not ok`）；引擎套件在**源码入口与打包产物入口**各 **17/17/0**；`build-engine.mjs --check` 两项 `status: "ok"` 且与 `plugin.json` 声明逐位一致；`vite build` 产出 307 382 B / 22 runtime files；`marketplace.mjs check` → `Validated`。

责任人：leader（本轮自行修复，未回退给开发者——D1 任务已完成、用户要求加速、修复面小而可验证）。
审计范围与判定见 [audit-3-report.md](./audit-3-report.md)。

---

## 1. B1 字符串字面量里的注释符被当成真注释，且执行用的就是剥离后的文本

**现象（审计复现）**：`SELECT 'a/*b*/c'` 返回 `"a c"`；`INSERT … ('p/*q*/r')` 落库变 `p r`（写入被静默改坏）；`SELECT 'a--b'` → 502。

**根因**：`query-guard.mjs` 用正则直接 `replace` 剥注释，不区分字符串字面量；`request-router.mjs` 执行的正是 `classified.statements`（剥离后的文本），所以剥离误差直接进入语义层。

**修复**（`service/src/engine/query-guard.mjs`）：

- 新增共享扫描器 `scanSql(sql, { onCode, onLiteral })`，把 SQL 切成「字符串外 / 字符串内」两段流：
  - 单引号 `'`、双引号 `"`、反引号 `` ` ``、方括号 `[...]` 内的内容**原样保留**；`''` / `""` / ` `` ` 翻倍视为转义（方括号无转义形式）；
  - `--` 到行尾、`/* … */` 只在**字符串外**剥离，并替换为单个空格以保持词边界。
- `stripSqlComments` 与 `splitStatements` 都改为基于 `scanSql`；`splitStatements` 只在**代码段**的 `;` 上切分。
- 为什么不是「执行原文 SQL」：那会直接重开审计警告的真实旁路（注释里的写语句绕过分类）。现在的剥离结果与原 SQL **语义等价**，分类仍走剥离文本。
- 判定方向仍是保守的：`WITH` 分支对全文扫写关键字时字符串内容同样会命中，宁可误拦不可放过（与上游一致）。

**回归用例**（`src/test/engine-service.test.js`「字符串里的注释符是数据，不被判定层剥离（B1）」）：`SELECT 'a/*b*/c' AS v, 'd--e' AS w` 原样返回 → `INSERT INTO t VALUES (3,'p/*q*/r')` 后 `SELECT b` 读回 `p/*q*/r` → `SELECT 'a;b'` 返回 200 且 `statement_count = 1`。

**leader 独立实测（真子进程 + 真 HTTP）**：

```
B1 写入 -> 200 [1]
B1 落库值 -> [{"v":"p/*q*/r"}]      # 不再被改坏
B1 分号字符串 -> 200 statement_count=1 [{"v":"a;b"}]
B1 注释符字符串 -> 200 [{"v":"x/*y*/z"}]
```

## 2. B2 一个坏路径把整个引擎进程永久挂死（SIGTERM 无效）

**现象（审计复现）**：`new DatabaseSync("/etc/passwd")` ≥150 s 不返回也不抛错；引擎收到该连接一次 `/query` 后 `/health` 在 2/6/12 s 全无响应，SIGTERM 后 3 s 进程仍存活，只能 SIGKILL。

**根因**：`sqlite-driver.mjs#acquire` 直接 `new DatabaseSync(file)` 打开任意存在的路径。`DatabaseSync` 是**同步** API，遇到非数据库文件会卡在底层 open 上，一挂就把整个单线程引擎（含 `/health`）一起卡死。

**修复**（`service/src/drivers/sqlite-driver.mjs`）：

- 新增 `assertOpenableSqliteFile(file)`，在 `new DatabaseSync` **之前**校验：
  - `statSync` 不存在/不可读 → `CONNECTION_ERROR`；不是普通文件（目录、设备等）→ `CONNECTION_ERROR`；
  - **0 字节文件放行**（SQLite 语义下是合法新库，且引擎 E2E 的 `before()` 就是 `writeFileSync(dbFile, "")`）；
  - 否则读前 16 字节与 `SQLite format 3\0` 魔数比对，不符 → `CONNECTION_ERROR 不是有效的 SQLite 数据库文件`。
- `:memory:` 跳过校验；只在 `file !== ":memory:"` 时执行。

**回归用例**：「非数据库文件被拒绝，且引擎不会卡死（B2）」——临时文本文件在 `/test` 与 `/query` 上均 502 `CONNECTION_ERROR`，随后同一进程 `SELECT 1` 仍 200。

**leader 独立实测（用审计同一个 `/etc/passwd` 复现路径）**：

```
B2 /etc/passwd -> 502 CONNECTION_ERROR 耗时 102 ms
B2 之后 /health -> 200 耗时 7 ms
存活: true
```

（修复前：≥150 s 不返回、`/health` 无响应、SIGTERM 无效。）

## 3. B3 引擎密钥缺失时鉴权静默关闭（fail-open）

**现象（审计复现）**：密钥为空 → 启动日志 `auth:"disabled"`，**不带 Authorization 头**的 `/query` 返回 200 并执行到 SQL 层。

**根因**：`http-server.mjs` 的 `createAuth` 用 `enabled = !disabled && token 非空`，缺密钥即视为「调试模式」。

**修复**（`service/src/http-server.mjs`）：端口校验之后、`createEngineServer` 之前，密钥缺失或为空且**未显式** `--auth-disabled` 时，输出 `{"event":"server-error","code":"NO_SECRET", …}` 并 `process.exit(1)`（fail-closed）。本地调试的唯一开关收敛为显式 `--auth-disabled`，并在 `/health` 与启动日志中如实上报 `auth:"disabled"`。

**回归用例**：「缺少引擎密钥时拒绝启动，不静默关闭鉴权（B3）」——不设变量、设空串两种情况均退出码 1 且输出 `NO_SECRET`。

## 4. 顺带修正：引擎版本必须抬高

`build-engine.mjs --write` 明确提醒「产物内容变化必须提升 ENGINE_VERSION，否则宿主不会重装已有版本」。本轮改了引擎字节，故 `service/src/engine/protocol.mjs` 的 `ENGINE_VERSION` 由 `0.1.0` → **`0.1.1`**，`--write` 回填后 `plugin.json#providers.services[].runtime.version = 0.1.1`（`versionChanged: true`）。

> 注意：插件**包版本**仍为 `0.0.11`（`plugin.json` / `package.json` / 市场源一致）。正式发布运行内容时按仓库手册需另抬能力版本，这一步属于发布动作，本轮未做。

## 5. 修复后门禁（全部实测）

| 门禁 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | exit 0 |
| 全量单测 `npm test` | **`# tests 66 / # pass 66 / # fail 0 / # cancelled 0`**，无 `not ok` |
| 引擎套件（源码入口） | `# tests 17 / # pass 17 / # fail 0 / # cancelled 0` |
| 引擎套件（`DBX_ENGINE_ENTRY=service/main.mjs`） | `# tests 17 / # pass 17 / # fail 0 / # cancelled 0` |
| `node scripts/build-engine.mjs --check` | `service/main.mjs` 29 748 B / `dbe2350b…c814e`；`service/drivers/sqlite-driver.mjs` 11 977 B / `f22a82ca…9417f`，两项 `status: "ok"` |
| 独立 `shasum -a 256` vs `plugin.json` | 逐位一致 |
| `npx vite build` | ✓ 11.62s；`release/dbx-pro-0.0.11.astraviapkg` **307 382 B / 22 runtime files**（含两个引擎产物） |
| `node scripts/marketplace.mjs check` | `Validated source entries for astravia-official-marketplace` |

## 6. 本次仍未验证 / 未做（不得表述为已完成）

- 真实 Desktop 的 `install() → start() → /health` 全链路、`templates → readDataFile → install` 桥、`host-node` 下 `executable` 的 spawn 语义：**本机无联调环境，【未知】**。
- `MAX_TEMPLATE_BYTES` 实际值、`win32-x64` / `linux-*` 真机启动：【未知 / 推断】。
- **引擎仍未接线**：`engine-client.ts` 零引用，无 `install/start/request` 调用，面板写入闸门仍是常量 —— 交付说明不得说「引擎已可用」。
- audit-3 的非阻塞项（超限体不返回 413、产物无 shebang、包内含开发脚本、面板未渲染 `truncated` 等）与 R1–R4 维持下游排期。
- B2 的底层机制（`DatabaseSync` 为何在非数据库文件上无限阻塞）只做了行为层规避，未做根因定性。
