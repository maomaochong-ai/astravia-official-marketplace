**阻塞性缺陷：有。** 共 3 条，全部落在新增的自持引擎 `service/**`：**B1** 注释剥离污染**被执行**的 SQL，可静默写坏数据；**B2** 单个坏路径即可把整个引擎进程永久卡死、且 SIGTERM 无法停止；**B3** 引擎密钥缺失/为空时鉴权静默关闭（fail-open）。UI 增量、`providers.services` 契约、打包与测试真实性三域均未见阻塞（详见第四、五节）。

审计人：@auditor（只读）。修订快照见第八节。

---

## 一、结论速览

| 审计域 | 判定 | 关键依据 |
| --- | --- | --- |
| A 引擎安全/诚实（写闸门、鉴权、绑定、路径、密钥泄漏） | **有阻塞（B1/B2/B3）** | 见第二节；写闸门本身无旁路，绑定仅 `127.0.0.1`，错误不回显密码 |
| B `providers.services` 契约 | **通过** | 逐键对齐 SDK schema；sha256 独立复算一致；5 平台声明同一对产物，纯 JS 同字节 |
| C UI 增量 | **无阻塞**（3 条轻微） | 过滤框/状态点/上下文菜单/索引表/CSV 导出均在位；N9 引号与 BOM、N4 无 shebang |
| D 测试真实性 | **通过** | 5 变异体全部被抓，且各自命中**不同**命名子用例；套件级 TAP 缺陷已消失（63/63，无 `not ok`） |
| E 打包/市场合规 | **通过（1 条卫生项）** | artifacts 302431 B / 22 文件；无 `src/`、无符号链接；N5 开发脚本进包 |

---

## 二、阻塞缺陷

### B1 注释剥离把字符串字面量改成空格，并执行被改后的 SQL → 静默写坏数据
- **位置**：`service/src/engine/query-guard.mjs:47`（`stripSqlComments`，字符串字面量无感知）、`:114`（`splitStatements` → 同样先剥离）、`:122-125`（`classifySql`）；执行侧 `service/src/engine/request-router.mjs:195`（`guardQuery` 返回 `classified.statements`）、`:204` / `:209`（`handle.query({ sql: statement })` **逐条执行被剥离后的原文**）。
- **复现**（源码入口与构建产物 `service/main.mjs` 各跑一轮，结果相同）：
  - `SELECT 'a/*b*/c' AS v` → **200**，`{"v":"a c"}`；同一文件用 `node:sqlite` 直读为 `a/*b*/c`。
  - `INSERT INTO t VALUES ('p/*q*/r', 2)`（`allowWrites:true` + 逐字节确认）→ **200**，回读该行得到 **`p r`**。
  - `SELECT 'a--b' AS v` → **502 `DRIVER_ERROR`** `unrecognized token: "'a"`。
- **影响**：把只读查询的返回值改写为错误值（用户看不出），把写入的**数据永久写坏**（评测/对账类场景直接失真）。`query-guard.mjs:45` 的注释声称该行为「方向上偏保守…保留该行为」——该论证对**只读分类**成立，对**被执行 SQL** 不成立，属注释与事实不符。
- **建议修法**：把注释剥离改为字符串字面量感知（单引号/双引号/反引号/方括号内的 `--`、`/* */` 不参与），并且**只**用剥离结果做分类；**不要**回退成执行原始 SQL（那会重新打开 `/*'; DROP …; SELECT '*/` 的真实旁路）。分类与执行两处共用一个剥离函数，补一条「字符串内注释符不被改写」的用例。

### B2 单个坏路径即可永久卡死引擎进程，`/health` 无响应，SIGTERM 无效
- **位置**：`service/src/drivers/sqlite-driver.mjs:137`（`spec.readOnly === true ? new DatabaseSync(file, {readOnly:true}) : new DatabaseSync(file)`，**默认读写打开**）；`:129-131` 只挡「文件不存在」，不挡「文件存在但不是数据库」；`service/src/http-server.mjs:199-213`（SIGTERM 走 JS 侧 `shutdown()`）。
- **复现**（`node /tmp/audit3/char.mjs`，ENTRY=`service/src/http-server.mjs`）：
  1. 最小复现：`new DatabaseSync("/etc/passwd")` **≥150 s 不返回、不抛错**（6 s / 60 s / 180 s 三次独立复现；`/private/etc/passwd` 同）。同内容的副本拷到 `/tmp` 则 80 ms 内如实报 `ERR_SQLITE_ERROR file is not a database`；`/etc/hosts`、纯文本、zip、目录均 <120 ms 如实报错；同一路径 `{readOnly:true}` **99 ms** 返回 `file is not a database`。
  2. 引擎级：发出该连接的一次 `/query` 后，`GET /health` 在 t=2 s / 6 s / 12 s **全部无响应**（引擎单线程，同步 open 卡住事件循环）；随后发 SIGTERM，**3 s 后进程仍存活**（`exitCode/signalCode = null/null`），只有 SIGKILL 能终止。
- **判定边界**：`ls -lO` 显示 `/etc/passwd` 带 macOS `compressed` 标志，同目录其它文件没有 → 触发条件【推断】为「默认读写打开 + `compressed` 文件标志」，机制本身【未知】；但**可观测行为是【实证】**，且用户完全可能把一个系统文件/被标记的旧文件当库文件选中。
- **影响**：一次错误输入 = 整个数据库功能进程假死（所有连接句柄失效、宿主健康探针失败、服务无法优雅退出，只能 SIGKILL）。`timeoutMs` 预算对此无效（同步调用，`shouldAbort` 检查不到）。
- **建议修法**（择一或叠加）：
  1. 打开前做**头校验**：文件大小 > 0 且前 16 字节不是 `SQLite format 3\0` 时直接返回 `CONNECTION_ERROR`（连带解决「把系统文件当库」的一类误操作）；
  2. 把 open/首条语句放进 `worker_threads`（或带 `timeout` 的子进程）执行，超时即失败并回收，保证进程不被拖死；
  3. 至少先用 `{readOnly:true}` 试探打开一次再决定是否可写。
  另建议补一条覆盖「存在的非数据库文件」的用例（现有引擎用例只覆盖「文件不存在」）。

### B3 引擎密钥缺失/为空时，鉴权静默关闭（fail-open）
- **位置**：`service/src/http-server.mjs:54`（`enabled = !disabled && typeof token === "string" && token.length > 0`）、`:177`（`auth-disabled`，reason `no-secret`）、`:194`（`auth: "disabled"`）。
- **复现**（`ENTRY=… node /tmp/audit3/auth.mjs`，源码与产物各一轮）：
  - `ASTRAVIA_SERVICE_SECRET_ENGINE_KEY=""` → 启动日志 `auth: "disabled"`；**无 Authorization 头**的 `POST /query` 返回 **200 并一路执行到 SQL 层**（`502 table t already exists` 即证明闸门与鉴权都未拦住）。
  - 密钥存在时：无头 / 错令牌 / 空 `Bearer` → **401**，正确令牌 → 200；产物入口一致。
- **影响**：一旦宿主注入凭据失败（环境变量名不匹配、凭据未生成、手工 `start()`），回环引擎即对**本机任意进程**开放；配合 `allowWrites` + 逐字节确认可执行写入。与 B2 叠加时攻击面更大。
- **建议修法**：密钥缺失时**拒绝启动**（非零退出 + `phase: failed`），把「调试关闭鉴权」收敛为显式 `--auth-disabled` 开关；或在缺失时退化为只读闸门（服务端强制 `allowWrites=false`）。

---

## 三、非阻塞缺陷

| 编号 | 缺陷 | 位置 / 证据 | 影响与建议 |
| --- | --- | --- | --- |
| N1 | 超限请求体不返回 413 | `http-server.mjs:78-82`：`reject(PAYLOAD_TOO_LARGE)` 后立刻 `req.destroy()`，抢在 `send(413)`（`:139` 映射）之前。实测发 9 MiB 体 → 客户端 `TypeError: fetch failed`，无状态码 | 调用方只能看到网络错误而非「体太大」。建议先 `res.end()` 再 `destroy()`，或在收体阶段 `req.resume()` 后正常回 413 |
| N2 | 合法只读被误判为写 | `SELECT 'a;b' AS v` → **403 `WRITE_BLOCKED`**（与 B1 同根因，`splitStatements` 先剥离/切分） | 影响可用性；修 B1 时一并覆盖 |
| N3 | 截断字段未在 UI 呈现 | 引擎诚实返回 `truncated`（`sqlite-driver.mjs:112-113`）、`row_limit`（`protocol.mjs:15-16`：默认 500 / 上限 5000）；`grep truncated src/features src/index.tsx` → 无 | 当前面板走 `query-service.ts`（sqlite3 CLI，**无行数上限**），大表会整表进内存；D2 接引擎时必须渲染截断提示 |
| N4 | 产物无 shebang | `service/main.mjs` 首字节为 `// dbx-pro engine bundle`；而 `plugin.json` 5 个平台的 `executable` 均指 `service/main.mjs` | `host-node` 下 `executable` 语义【未知】；加 `#!/usr/bin/env node` 是零成本加固（会改 sha256 → 需重跑 `build-engine.mjs --write` 并回填） |
| N5 | 开发脚本进制品 | 包内 22 个文件含 `scripts/build-engine.mjs`；另有 `dist/assets/detail.json`、`dist/assets/detail.zh.json` 重复打包 | 打包卫生问题，非安全洞。建议把 `scripts/` 移出分发集合 |
| N6 | 引擎已声明但**未接线** | `grep -rn "engine-client\|bindEngineServices\|services\." src/`（排除测试）→ **零命中**；无任何代码调用 `ctx.services.install/start/request`；`dbx-pro-panel.tsx:281` 硬编码 `allowWrites:false`；非 sqlite 类型经 `query-service.ts:46` 抛 `ENGINE_NOT_READY` | **交付说明不得写「引擎已可用」**。安装链路（`templates[]` 落 data 目录 → `readDataFile` → `install([{destination, data}])`）在 SDK 契约下可行且**不需要 `fs.read`**，但端到端【未知】。属 D2 范围 |
| N7 | `templates[].mode:"create"` 语义与「分发运行时入口」不匹配 | `plugin.json:127-138` 用 `templates` 送 `service/main.mjs`，而 `runtime.entry` / `executable` 指运行时根 | 与 N6 同源；当前是唯一能进包的通道，需 D2 用真实宿主验证 |
| N8 | 备用鉴权头未直接验证 | `http-server.mjs:62` 支持 `x-dbx-token`；我的 A5 用例实际未发出该头（等价于「无头」用例） | 仅源码级证据【推断】；建议测试补一条 |
| N9 | CSV 导出细节 | `dbx-pro-panel.tsx` 导出：引号规则 `/["\,\n]/` 不含 `\r`；无 UTF-8 BOM；`revokeObjectURL` 紧跟 `click()` | 轻微：CR 内嵌会破列、Excel 中文可能乱码 |
| N10 | 连接密码明文落盘 | `connection-config.ts:161-162` + `connection-form.tsx:299-301` → `connections.json` | 沿用 audit-1 的 N5（非阻塞加固）；宿主有 `ctx.secrets` |

---

## 四、门禁独立复核（均由我本人重跑，非采信自述）

| 门禁 | 我的实测结果 | 判定 |
| --- | --- | --- |
| `npx tsc --noEmit` | exit 0 | 通过 |
| `node --experimental-strip-types --test src/test/*.test.js` | `# tests 63 / # pass 63 / # fail 0`，**无 `not ok`、无 `cancelledByParent`**（49 基线 + 14 引擎）；D1 期套件级 TAP 缺陷确已消除 | 通过 |
| `node scripts/build-engine.mjs --check` | exit 0，两项 sha 一致 | 通过 |
| `shasum -a 256`（独立复算） | `72d9cabe…8ae010 service/main.mjs`、`940ee01c…c9024e service/drivers/sqlite-driver.mjs`，与 `plugin.json` 5 平台声明**逐位一致** | 通过 |
| `node scripts/marketplace.mjs check` | exit 0（Validated） | 通过 |
| `npx vite build` | exit 0 → `release/dbx-pro-0.0.11.astraviapkg` **302 431 B / 22 个运行时文件**；含 `service/main.mjs`、`service/drivers/sqlite-driver.mjs`；**无 `src/`、无符号链接** | 通过 |
| 引擎 headless `/health` | 200：`sqlite tier=first-class ready=true`，其余 `experimental/out-of-scope ready=false`（如实档位） | 通过 |
| `WRITE_BLOCKED` / `DDL_BLOCKED` / `CONFIRM_MISMATCH` | 403（含大小写、`WITH…DELETE`、`PRAGMA`、`ATTACH`）；确认文本多一个尾空格即 `CONFIRM_MISMATCH` | 通过 |
| `providers.services` 契约 | 逐键对照 SDK `manifest-schema.d.ts` 通过；`templates[].mode`、`runtime.entry` 均为合法键；**无 `services.*` 权限 id**，`ctx.services` 免声明权限 | 通过 |

**写闸门旁路矩阵（12 组探针，均无旁路）**：`SELECT '/*'; DROP TABLE t; SELECT '*/'` → 200 且表未删（被替换成合法字面量 `' '`）；`UPDA/*x*/TE`、`WITH…DELETE`、小写 `drop table`、`PrAgMa journal_mode=WAL`、`ATTACH DATABASE`、`EXPLAIN ANALYZE DELETE` 均 403；`EXPLAIN QUERY PLAN DELETE FROM t` 判为 read 但**删除确实未执行**（行数不变）。
**其它负向结论**：`lsof` 实测仅 `127.0.0.1:<port> (LISTEN)`，无 `0.0.0.0`/`*`；错误体不含密码（`CONNECTION_ERROR` 仅回显路径）；`connection-pool.stats()` 只暴露 `key.slice(0,8)`；`request-router.mjs:82-83` 仅用 `sha256(password)` 前 8 位做连接身份。

---

## 五、变异测试：引擎用例有鉴别力（不是空跑）

全部在 `/tmp/dbx-mut3/` 的副本上进行（5 个变异体各一份 `tar` 拷贝，`node --test src/test/engine-service.test.js`）：

| 变异体 | 注入缺陷 | 结果 | 被抓的**具体**子用例 |
| --- | --- | --- | --- |
| m0（基线） | 无 | `14 pass / 0 fail` | — |
| m1 | `classifySql` 恒返回 `read` | `13 / 1` | `not ok 5 - 写语句默认被闸门拦下，且不产生副作用`（expected 403 / actual 200） |
| m2 | 鉴权 `verify` 直接放行 | `13 / 1` | `not ok 2 - 缺少令牌返回 401`（401 / 200） |
| m3 | BigInt 不降级为字符串 | `13 / 1` | `not ok 10 - 超大整数降级为十进制字符串…`（`'9007199254740993'` / `9007199254740992`） |
| m4 | 去掉库文件存在性校验 | `13 / 1` | `not ok 12 - 库文件不存在时拒绝连接，不静默建库`（502 / 200） |
| m5 | 零行结果集不回退表头 | `13 / 1` | `not ok 7 - 零行结果集仍返回表头`（deepStrictEqual） |

⇒ 五个变异体命中五个**不同**断言，说明该套件是逐用例判别，而非整体变红。**缺口**：无「存在的非数据库文件」用例（见 B2），无「字符串内注释符」用例（见 B1），无 `x-dbx-token` 用例（N8）。

---

## 六、已澄清的非缺陷（避免重复返工）

- `catalog.ts:83-87` 的 `listFlatIndexesSql` 已把 PRAGMA 的 `unique` 归一化为 `is_unique` = `YES`/`NO`，面板 `r.is_unique === "YES"` 映射**正确**。
- `connection-form.tsx:247` `<option key={e.dbType}>` 的 key 源唯一（85 项无重复），无 React 重复 key 问题。
- 引擎绑定 `HOST = "127.0.0.1"`（`http-server.mjs:28`、`:184`），实测无对外监听。
- `sqlite-driver.mjs:129-131` 确实挡住了「文件不存在」，且**不静默建库**（旧版 0 字节假阳性问题已修）。
- `stop()` 幂等修复：断言路径是真实 SIGTERM 路径，断言有意义；`child.exitCode ?? 0` 的兜底只在无关返回值的分支生效 → 非阻塞（轻微不精确）。
- 文案已修：`detail.zh.json:8`、`locales/zh.json:4` 已无 `60+ databases via dbx CLI`，改为「85 种连接类型 + 如实标注档位」；6 处替换与 leader 陈述一致。

---

## 七、未验证（【未知】）与范围外

【未知】：
1. 真实 Desktop 的 `install() → start() → /health` 全链路（本机无联调环境）；`templates[]` → `readDataFile` → `install()` 桥是否成立。
2. `runtime.kind:"host-node"` 下 `executable` 与 `entry` 的宿主 spawn 语义（不得读 `open-astravia` 源码，故无法核实）。
3. `MAX_TEMPLATE_BYTES` 实际上限（本包两份模板均 <32 KB）。
4. `win32-x64` / `linux-*` 真机启动（纯 JS 同字节，属推断）。
5. B2 卡死的底层机制（macOS `compressed` 标志 + 读写打开的组合）。
6. N8 `x-dbx-token` 无直接实测。
7. 宿主对已卡死引擎的处理（是否自动重启）。

范围外（不在本轮判定内）：面板硬编码中文 / i18n 未转；`package-lock.json` 不可移植（公开 npm E404，无法重生成）；多语句只显示最后一个结果集（R1）；新增测试未进 CI（R3）。

---

## 八、只读保证与修订快照

- **修订**：HEAD `bab45f8395e44ab6ed5d11d516e6233fc90a57ad`，分支 `main`；审计期间**受审源文件零漂移**（`/tmp/audit3-baseline.sha` 18 个文件，`shasum -a 256 -c` 全 `OK`，未发现任何非 OK 项）。
- **写操作**：本报告 + 授权范围内的 `npx vite build`（仅重写 gitignore 的 `dist/`、`release/`）+ `/tmp` 暂存脚本（`e2e.mjs`/`auth.mjs`/`probe.mjs`/`probe2.mjs`/`probe3.mjs`/`char.mjs`/`ro.mjs`/`etc-list.mjs`/`sqlite-open.mjs`）与 `/tmp/dbx-mut3/**` 变异副本。未改动插件源码、`plugin.json`、`package.json`、`.gitignore`；未执行 `git add/commit/checkout/reset/stash`；未触碰 `source-code/astravia`、`open-astravia`、`web-element-picker/**` 及其他插件。
- **工作树**：dbx-pro 相关改动此前已 `git add`（17 项）；非 dbx-pro 的既有改动（`cli-proxy-api/package.json`、`web-element-picker/**` 等）保持原样，未归因。
