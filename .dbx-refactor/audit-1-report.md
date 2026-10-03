阻塞性缺陷：有

# dbx-pro「旧数据库工作台重构」只读审计报告

审计对象：`abilities/plugins/dbx-pro`（HEAD `bab45f8395e44ab6ed5d11d516e6233fc90a57ad` + 工作树改动）
审计方式：只读。未修改任何插件/旧项目/宿主源码；未执行 `bun/npm install`。全部结论均有可复现命令。
报告落盘：本文件（唯一新增文件）。

---

## 一、结论摘要

- **有阻塞性缺陷，不允许以当前状态判定「重构完成」。** 两条运行时缺陷位于本次新增的数据层 `src/shared/services/query-service.ts`，且**第一条会被出厂默认 SQL 直接触发**（打开面板 → 选连接 → Ctrl+Enter 即失败）。
- 第三条阻塞项是**验证门失效**：`src/test/*.test.js` 是手抄副本而非被测源码，因此「单测 25/25 绿」这一完成证据**无法证明**真实源码正确 —— 证据中已有反例（真实 manifest 存在 2 处重复 `dbType`，而副本测试里恰恰有一条本该抓它的断言）。
- 其余 8 项为非阻塞（含 1 项安全加固、1 项还原度缺口、若干声明冗余）；架构方向（`ctx.storage` 托管持久化、`command.run` 白名单直连、诚实报错）**方向正确、无需推翻**。
- 另发现 1 项**既有**（HEAD 已存在、非本次引入）的锁文件缺陷，会使本机之外的构建不可复现。

---

## 二、阻塞级缺陷

### [阻塞] B1 以 `-` 开头的 SQL 被 sqlite3 当成命令行选项 —— 出厂默认 SQL 必然失败

- **位置**：`src/shared/services/query-service.ts:58`
  （`getCommand().run("sqlite3", [file, "-json", sql], …)`，SQL 作为**位置参数**直接跟在 `-json` 之后）
  触发点：`src/features/main-panel/components/dbx-pro-panel.tsx:122` 的默认 tab `sql: "-- ⌘/Ctrl+Enter 执行\nSELECT 1;"`，`:132` 用它初始化编辑器。
- **证据 / 验证命令**（只读，`/tmp` 沙箱）：

  ```bash
  sqlite3 /tmp/a.db -json "-- 注释
  SELECT 1;"
  # → exit 1；stderr: sqlite3: Error: unknown option: - 注释

  # 修法验证（在 SQL 前插入 -- 分隔符）
  sqlite3 /tmp/a.db -json -- "-- 注释
  SELECT 1;"
  # → [{"1":1}]；exit 0  ✅
  ```

  sqlite3 对任何以 `-` 开头的 argv 都按选项解析。默认 tab 首行正是 `-- ⌘/Ctrl+Enter 执行`。
- **影响**：开箱第一次查询即失败；用户粘贴的任何带注释 SQL（`--`）全部失败。属「功能错误」，且是默认路径必现。
- **建议修法**：`query-service.ts:58` 改为 `run("sqlite3", [file, "-json", "--", sql], …)`（已实测通过）；或在拼接前给 SQL 加一个前导空格（亦实测通过，但不如 `--` 语义明确）。

### [阻塞] B2 多语句查询输出多个 JSON 数组 → `JSON.parse` 抛 `SyntaxError`

- **位置**：`src/shared/services/query-service.ts:64`（`JSON.parse(text)`）；调用侧 `dbx-pro-panel.tsx:216` 把**整个 tab 的 SQL 原文**交给 `executeQuery`，无语句切分。
- **证据 / 验证命令**：

  ```bash
  sqlite3 /tmp/a.db -json "SELECT 1 AS a; SELECT 2 AS b;"
  # → 两段拼接输出： [{"a":1}]
  #                   [{"b":2}]
  # → JSON.parse 抛 SyntaxError: Unexpected non-whitespace character after JSON at position 10 (line 2 column 1)
  ```

  （单语句、空结果、语法错误三条路径均实测正常，问题仅限「返回两个及以上结果集」。）
- **影响**：用户写两段 `SELECT`（工作台最常见用法）会看到英文解析异常原文，而非查询结果；且异常文本对用户无解释力。
- **建议修法**：按行首 `[` 切分 stdout 得到多个 JSON 数组（取最后一个/合并显示），或对多余结果集只取首个并提示「已忽略 N 个后续结果集」。修法需补一条针对多语句的单测（见 B3）。

### [阻塞] B3 单测是手抄副本，不是被测源码 —— 完成证据不成立

- **位置**：
  - `src/test/connection-config.test.js:9-21`：硬拷贝一份 **10 条**的 `DB_TYPE_MANIFEST`，注释自陈「直接复制关键结构（与 TS 源保持一致）」，并自带 `findDbType`/`inferFamily`/`defaultPortFor` 副本；
  - `src/test/catalog.test.js`：同样硬拷贝 `escapeSqlLiteral` / `SCHEMA_SYSTEM` / `DATABASE_SYSTEM` / `filterSystemNames` / `tableObjectSql`。
  - 两个文件**均未 import** `src/domain/**`。`package.json` 无 `test` 脚本（仅 `build`/`check`）。
- **证据 / 验证命令**：

  ```bash
  grep -n "^import\|require(" src/test/*.test.js     # 无任何指向 src/domain 的导入
  grep -c "dbType" src/test/connection-config.test.js  # 副本 10 条
  grep -c '"order"' src/domain/connection-config.ts    # 真实 manifest 87 条
  node --test src/test/*.test.js                       # # pass 25 / # fail 0
  ```

  **反例已在场**：副本测试内含「no duplicate dbType」断言，而真实 manifest 有 2 处重复（见 N1）——该断言永远不会读到出问题的那份数据。
- **影响**：`node --test` 全绿与源码正确性脱钩；源码可被改坏而测试仍绿。以「25/25 绿」作为重构完成证据属「声称已完成但实际不可用」的证据。
- **建议修法**：测试改为 `import` 真实模块（或由 `tsc`/`vite` 产出 `src/domain/*.js` 后引用），删除全部硬拷贝副本；至少补 3 条针对真实源码的回归：默认 SQL 可执行（B1）、多语句结果集（B2）、manifest `dbType` 唯一（N1）。

---

## 三、非阻塞缺陷

### [非阻塞] N1 类型选择器存在重复项（真实 manifest 87 条 / 85 唯一）
- **位置**：`src/domain/connection-config.ts:43` 与 `:92`（`mongodb` × 2，字段一致仅 `order` 不同 60/280）；`:79`（"Apache Cassandra"）与 `:100`（"Cassandra"）`cassandra` × 2。
- **证据**：`key={e.dbType}` 于 `connection-form.tsx:240` → 下拉出现重复选项与重复 React key（开发期警告）。
- **影响**：用户看到两条相同项；`findDbType` 取首条，当前字段副本一致故无行为差异，属数据/UI 卫生问题，但它是 B3 的直接证据。
- **建议修法**：删除后出现的重复条目；保留一条 `order` 与展示名最合理的。

### [非阻塞] N2 连接身份用 `name` 而非 `id` —— 同名取错库、改名静默失效
- **位置**：`dbx-pro-panel.tsx:74`（`onSelectConnection(conn.name)`）、`:156`/`:181`/`:196`/`:212`（`connections.find(c => c.name === activeConn)`）、`:213`（`if (!conn) { setRunState({kind:"idle"}); return; }`）；`save()` 仅校验 `name.trim()` 非空（`connection-form.tsx:96-97`），不查重。
- **影响**：① 两条同名连接时查询会打到排序后的第一条，可能对**非用户所选的目标库**执行；② 重命名活动连接后点执行，界面无任何反馈。
- **建议修法**：以 `conn.id` 作为选择状态与查找键（存储层已按 id 读写，`dbx-storage.ts:41/50`）；`save()` 增加同名检测；`:213` 的静默返回改为报错。

### [非阻塞] N3 `testConnection` 假阳性 + 「测试连接」按钮带写副作用
- **位置**：`query-service.ts:71`（`SELECT 1 AS ok`）；`connection-form.tsx:124-127`（先 `writeConfig(c)` 再 `testConnection(c)`）。
- **证据 / 验证命令**：

  ```bash
  sqlite3 /tmp/does-not-exist.db -json "SELECT 1"
  # → [{"1":1}]，exit 0，且 /tmp/does-not-exist.db 被创建为 0 字节
  ```

  sqlite3 对不存在的库文件「创建后查询」，因此连通性探测对错误路径返回 ✅。
- **影响**：① 用户以为连通，实际是空库；② 点「测试」即把未确认的连接落盘（且 86 种非 SQLite 类型必定显示 ❌ 却已保存）。
- **建议修法**：SQLite 分支先做文件存在性判断；`test(c)` 不起草保存（探测用临时配置），保存与测试分开。

### [非阻塞] N4 空结果集丢失列信息（还原度缺口）
- **位置**：`query-service.ts:65`（`columns` 由 `rows[0]` 推导）；`result-grid.tsx`（列取自 rows）。
- **影响**：`SELECT` 命中 0 行时表格无表头，与桌面端工作台「结果区始终呈现列结构」的观感不同。
- **建议修法**：sqlite3 走 `-json` 时对空集不输出任何列信息，可在执行前用 `pragma_table_info`/`EXPLAIN` 兜底，或明确接受该差异并记录（旧工作台的实际表现**未验证**，见第六节）。
- **验证命令**：`sqlite3 /tmp/a.db -json "SELECT 1 AS x WHERE 0"` → 空 stdout、exit 0。

### [非阻塞] N5 连接口令明文落盘（宿主已提供加密 vault 可用）
- **位置**：`src/domain/connection-config.ts:161-162`（`username`/`password`）经 `dbx-storage.ts:35` `writeJsonFile` 写入插件私有 `connections.json`；`plugin.json` 未声明 `secrets.*`。
- **证据**：宿主 SDK 提供加密凭据存储 —— `node_modules/@astravia-org/plugin-sdk/dist/secrets.d.ts:14-26`（`get/has/keys/set/delete`），接入点 `dist/context.d.ts:77` `ctx.secrets`，注释明确「kept in the host credential vault … encrypted at rest」。
- **影响**：远程库口令以明文存在本机文件系统，任何同用户进程/备份/同步均可读取。
- **建议修法**：口令改存 `ctx.secrets`（键如 `conn:<id>:password`），`connections.json` 只留非敏感字段；`plugin.json` 增加 `secrets.read`/`secrets.write` 并移除 `connections.json` 中的既有明文。

### [非阻塞] N6 声明冗余与死代码（权限面/命令行）
- **位置**：`plugin.json` 的 `permissions` 中 `ui.slot.ability-detail`、`shell.openExternal`，`commands` 中的 `"dbx"`；`src/runtime-contract.ts:27` 的 `getConversation`。
- **证据**：`grep -rn "openExternal\|ability-detail\|getConversation\|\"dbx\"" src/` 仅命中 `connection-form.tsx:256` 的一处**文案**（"使用 legacy mongo shell"）与 `runtime-contract.ts` 定义本身 → 无实际调用。
- **影响**：不造成功能错误，但扩大安装时向用户展示的权限清单（信任成本），且 `dbx` 是已删除 CLI 通路（`dbx-cli.ts` 已 `D` ）的残留。
- **建议修法**：删除未使用的权限声明与 `commands` 中的 `"dbx"`；`getConversation` 若短期无用一并删除。

### [非阻塞] N7 `testConnection` 的超时参数会被连接配置覆盖
- **位置**：`query-service.ts:70-71` 传入 `10_000`，但 `:54-56` 在 `conn.query_timeout_secs > 0` 时改用配置值。
- **影响**：探测耗时随配置放大到最多 300s，UI 会有长时间无响应观感。
- **建议修法**：探测路径显式忽略配置值，取 `min(config, 10s)`。

### [非阻塞] N8 工作树含非 dbx-pro 改动（归属未确认）
- **位置**：`git status --short` 中 7 个插件新增未跟踪 `package-lock.json`（astravia-tihu / build-apple-apps / cli-proxy-api / feishu / shimo / web-element-picker / xiaohongshu，mtime 10-02 23:39~23:43）、`abilities/plugins/web-element-picker/src/kernel/*` 修改、`abilities/plugins/cli-proxy-api/package.json` 修改。
- **影响**：不在本次重构职责范围内，但会随同一次提交进入仓库；`.gitignore` 未忽略 `package-lock.json`（仅忽略 `.tooling/`、`dist/`、`release/`、`bun.lock`）。
- **建议**：提交前明确这些文件是否属于本任务；不属于则不要一起提交。

---

## 四、既有问题（HEAD 已存在，非本次重构引入，但影响可复现构建）

### [阻塞-既有] P1 `package-lock.json` 与 `package.json` 不同步 + 记录本机绝对路径
- **位置**：`abilities/plugins/dbx-pro/package-lock.json` 根 `packages[""]`
- **证据 / 验证命令**：

  ```bash
  git show HEAD:abilities/plugins/dbx-pro/package-lock.json | grep -n "file:/Users"   # HEAD 即有 2 行
  # "…/@astravia-org/plugin-sdk": "file:/Users/zhugeyue/…/.tooling/open-astravia/packages/plugins/plugin-sdk"
  node -e 'const p=require("./package.json"),l=require("./package-lock.json");
    console.log(Object.keys({...p.devDependencies}).filter(k=>!(k in {...l.packages[""].devDependencies})));'
  # → [ '@astravia-org/plugin-cli' ]（package.json 声明 ^0.1.7，锁里没有）
  git check-ignore -v .tooling      # .gitignore:5 → .tooling/ 不入库
  ```

- **影响**：`npm ci` 在本机之外必然失败（`file:` 指向不存在的绝对路径 + 缺项不同步）。当前 CI（`publish-marketplace.yml:30-37` 走 `scripts/marketplace.mjs build`）是否受此影响**未验证**。
- **建议修法**：锁文件按注册表解析重新生成，移除 `file:` 绝对路径（该依赖应由发布工具在隔离环境解析）；把 `plugin-cli` 纳入锁或从 `package.json` 移出。

---

## 五、已确认非缺陷（逐条核对通过）

| 审计项 | 结论 | 依据 |
| --- | --- | --- |
| 存储语义 vs SDK 类型 | **通过** | `readJsonFile<T>()` 返回 `T \| null`，`dbx-storage.ts:26-27` 用 `doc?.connections` + `Array.isArray` 正确兜底；`writeJsonFile` 调用形态与 `storage.d.ts` 一致；仅用声明过的 `storage.read/write` |
| SQL 注入 | **通过** | `catalog.ts` `escapeSqlLiteral` 双写单引号，全部 schema/table/db 值均作**字符串字面量**进入 `pragma_table_info`/`information_schema`，无标识符拼接 |
| 错误诚实性 | **通过** | 非 SQLite 类型抛带 `code=ENGINE_NOT_READY` 的中文可读错误（`query-service.ts:43-49`）；非零退出抛 stderr 原文（`:59-61`）；超时（`exitCode === null`）同样抛错；面板 `dbx-pro-panel.tsx:219-222,259-260` 原样渲染，无「假装成功返回空集」 |
| 单文件 SQL 端到端 | **通过** | 建表/插入/查询/`PRAGMA` 均返回合法 JSON；语法错误、目录路径两类异常均被正确处理（实测 exit 1 + stderr） |
| 构建 / 类型 | **通过** | `npx tsc --noEmit` exit 0；`release/dbx-pro-0.0.11.astraviapkg` 238135 B（远低于 25MB/100MB 限额） |
| 制品洁净（残留检查） | **通过** | 包内 19 个文件无 `src/`、无 `dbx-cli.js`/`db-env.js` 残留；`dist/style.css` 含 Tailwind 产物与 `lucide--`/`solar--` 图标 |
| 版本一致性 | **通过** | `marketplace.source.json` / `plugin.json` / `ability.json` 三者均为 `dbx-pro` + `0.0.11`（minAppVersion 0.5.59） |
| 改动范围 | **通过（附带 N8）** | 重构改动全部落在 `abilities/plugins/dbx-pro/**`；旧项目与宿主仓库零改动 |

---

## 六、未验证项（无法在本环境闭环，需真机/上游确认）

1. 真实桌面端承载下 `command.run("sqlite3")` 的**用户启用链路**：`sqlite3` 需宿主设置页启用，插件内无引导入口；首次安装后是否可发现未验证。
2. 旧工作台「空结果集是否显示表头」「列宽/状态色板」的逐像素还原度 —— 未执行旧客户端对照（N4 的还原度判据因此保留）。
3. `npm ci` 在 CI（`scripts/marketplace.mjs build`）内部的实际包管理路径 → P1 的 CI 影响未验证。
4. B1/B2 的修复是否引入 sqlite3 版本差异（仅在本机 sqlite3 实测，未跨平台）。
5. 面板在真实 MF 宿主中的并发竞态（快速切换连接时的过期响应覆盖）——仅静态阅读，未运行。
6. `connections.json` 跨版本 schema 迁移路径（当前仅 `schemaVersion: 1`，无迁移分支）。
7. 7 个非 dbx-pro 的未跟踪 `package-lock.json` 的产生者与用途。

---

## 七、git 快照（审计时点）

```
HEAD: bab45f8395e44ab6ed5d11d516e6233fc90a57ad

$ git status --short
 M abilities/plugins/cli-proxy-api/package.json
M  abilities/plugins/dbx-pro/package-lock.json
M  abilities/plugins/dbx-pro/src/domain/catalog.ts
M  abilities/plugins/dbx-pro/src/domain/connection-config.ts
D  abilities/plugins/dbx-pro/src/domain/db-env.ts
M  abilities/plugins/dbx-pro/src/domain/dbx-storage.ts
M  abilities/plugins/dbx-pro/src/features/connection-management/components/connection-form.tsx
D  abilities/plugins/dbx-pro/src/features/connection-management/services/dbx-cli.ts
M  abilities/plugins/dbx-pro/src/features/main-panel/components/dbx-pro-panel.tsx
M  abilities/plugins/dbx-pro/src/features/sql-workbench/components/sql-editor.tsx
M  abilities/plugins/dbx-pro/src/index.tsx
M  abilities/plugins/dbx-pro/src/runtime-contract.ts
A  abilities/plugins/dbx-pro/src/shared/services/query-service.ts
 M abilities/plugins/web-element-picker/src/kernel/kernel-bundle.generated.ts
 M abilities/plugins/web-element-picker/src/kernel/kernel.ts
?? abilities/plugins/astravia-tihu/package-lock.json
?? abilities/plugins/build-apple-apps/package-lock.json
?? abilities/plugins/cli-proxy-api/package-lock.json
?? abilities/plugins/feishu/package-lock.json
?? abilities/plugins/shimo/package-lock.json
?? abilities/plugins/web-element-picker/package-lock.json
?? abilities/plugins/xiaohongshu/package-lock.json
```

审计期间未修改任何源码文件；本报告为唯一新增文件。
