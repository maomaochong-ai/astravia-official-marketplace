# D1 报告：dbx-pro 自持引擎 + 插件侧数据层

## 0. 结论（先行）

- **headless 端到端通过：14/14**。源码入口与**构建产物**各跑一轮，均 `# fail 0`。【实证】
- **产物**：`service/main.mjs` 27 503 B / sha256 `72d9cabe…8ae010`；`service/drivers/sqlite-driver.mjs` 9 271 B / sha256 `940ee01c…c9024e`。【实证】
- **门禁**：`npx tsc --noEmit` exit 0；`npm test` **63 pass / 0 fail**（既有基线 49 + 引擎 14）；`npx vite build` 成功，包内 **22 个运行时文件**，**含 `service/**`**。【实证】
- **未验证**：真实 Desktop 的 `install() → start()` 链路——本机无 Desktop 联调环境，只做到「宿主要求的产物形态 + 容器内自证」。【未知】

## 1. 关键命令与真实输出

```bash
# 产物构建（回填 sha256）+ 校验
$ node scripts/build-engine.mjs --write
[build-engine] drivers: sqlite
{ "mode": "write", "engineVersion": "0.1.0",
  "artifacts": [
    { "destination": "service/main.mjs",                "bytes": 27503, "sha256": "72d9cabe457fbfa4ef639d573234edfb7882086ced03364889f3a66a8f8ae010" },
    { "destination": "service/drivers/sqlite-driver.mjs","bytes": 9271, "sha256": "940ee01c3ac407f77f096a684f25883bce78307929da08af6c7126b8c7c9024e" } ] }
$ node scripts/build-engine.mjs          # check：两项 status: "ok"

# 端到端（源码入口 / 构建产物）
$ node --test src/test/engine-service.test.js
# pass 14 / # fail 0 / # duration_ms 796.4055
$ DBX_ENGINE_ENTRY=service/main.mjs node --test src/test/engine-service.test.js
# pass 14 / # fail 0 / # duration_ms 646.005167

# 真实 HTTP 采样（子进程起引擎，宿主视角）
GET  /health            -> 200  auth=enabled  drivers=sqlite:true,postgres:false,…
POST /query（无令牌）    -> 401  UNAUTHORIZED
POST /query（三语句）    -> 200  statements=write,write,read  columns=["a","b"]  rows=[{"a":1,"b":"x"}]
POST /query（DELETE，无授权） -> 403  WRITE_BLOCKED
POST /catalog           -> 200  objects=[{"schema":"main","name":"t","kind":"table","system":false}]

# 打包
$ npx vite build
[astravia-plugin-vite] Wrote …/release/dbx-pro-0.0.11.astraviapkg with 22 runtime files
$ unzip -l release/dbx-pro-0.0.11.astraviapkg | grep service
   9271  service/drivers/sqlite-driver.mjs
  27503  service/main.mjs
```

## 2. a→d 进度

- **(a) 引擎服务**：`service/src/{http-server.mjs, driver-registry.mjs, engine/*.mjs, drivers/sqlite-driver.mjs}` 7 个源文件；零第三方运行时依赖；只绑 `127.0.0.1`；`node:sqlite` 免 flag。**✔ 已用真实 HTTP 自证**
- **(b) 构建与清单**：`scripts/build-engine.mjs`（esbuild 两阶段、sha256+字节、`--check`/`--write`、驱动↔registry 双向校验）；`plugin.json#providers.services`（`runtime.kind="host-node"`、`executable` 与 `entry` 同指 `service/main.mjs`、5 个平台 tag、`credentials[{id:"engine-key"}]`、`templates[]`）。**✔**
- **(c) 插件侧客户端**：`src/shared/services/engine-client.ts`（只做请求封装；显式 `timeoutMs`；`bindEngineServices/getEngineServices`；错误映射为 `EngineClientError`）。**✔**
- **(d) 接口面**：`/health`、`/test`、`/catalog`、`/describe`、`/query`；写闸门、401、多语句均由 E2E 用例覆盖。**✔**

## 3. 过程中修掉的真实缺陷

1. **首轮 14 例中 10 例红，全是同一个 502 `CONNECTION_ERROR`**：`new DatabaseSync(file, undefined)` 在 Node 22 直接抛 `The "options" argument must be an object.`。修法：`sqlite-driver.mjs:135` 改成按分支调用（`spec.readOnly === true ? {readOnly:true} : 无第二参`），**不是** `cond ? {…} : undefined`。修后 14/14。
2. **DDL 的确认语义**：`guardQuery` 在 `allowWrites:false` 时给 `DDL_BLOCKED`，在有写权限但未给确认文本时给 `CONFIRM_MISMATCH`；原测试只断言前者，已改为分别断言两种码（测试比实现错，改测试）。
3. **PRAGMA 空结果**：执行路径改由 `statement.columns()` 判定读写（`PRAGMA xxx` 会走读路径返回行），闸门仍用保守分类器——闸门与执行路径职责分开。

## 4. 与文档/任务描述的冲突（以实证为准）

| # | 文档/任务说法 | 实证 | 处理 |
| --- | --- | --- | --- |
| 1 | `${ASTRAVIA_MCP_URL}` / `${ASTRAVIA_MCP_PORT}` / `service.kind:"http-mcp"` | 那是 MCP manifest schema v3 的字段；`providers.services` 用 `${ASTRAVIA_SERVICE_PORT}` / `${ASTRAVIA_SERVICE_DATA_DIR}`（宿主 `TOKEN_PATTERN`） | 按实证实现 |
| 2 | 产物放 `dist/` | `vite build` 会清空 `dist/`（`emptyOutDir`），且宿主 `install()` 要求 payload 与声明的 sha256 逐字节一致 | 产物放 `service/`，顺序固定 `node scripts/build-engine.mjs && npm run build` |
| 3 | 引擎测试 `src/test/*.test.mjs` | 仓库既有测试全是 `.test.js`，`package.json` 的 glob 也是 `.test.js` | 用 `.test.js` |
| 4 | 测试基线 47 例 | 实测既有 49 例（不含引擎） | 按实测报告 |
| 5 | 包体上限 100 MB | `scripts/stage-plugin-release.py:19` `MAX_BYTES = 50 * 1024 * 1024` | 以 50 MB 为准 |
| 6 | 计划里的 `/context`、`/table-op` | 未实现 | 已收窄为 5 条路由，如实上报 |

## 5. 仍需注意的实现事实（每条有证据）

- **`templates[]` 是插件自有打包器唯一会收集的 `providers.services` 相关字段**（`plugin-vite/dist/pack.js` 的 `collectRuntimeFiles` 白名单 + SDK `listPluginManifestResources` 只返回 `templates.source`），`artifacts[].destination` / `entry` 从不被收集。⇒ 包体积从 19 → 22 个文件、`service/**` 出现，正是这条通道。【实证】
  - 附带：插件自有打包器**总是**收集 `scripts/`，所以 `scripts/build-engine.mjs` 也进了包（22 个文件中含它）。它不是运行时依赖，目前无害；若要收窄需在插件打包器侧处理，不在本轮范围。
- **`install()` 仍是必需的**：宿主按 `platforms[tag].artifacts` 的 destination 集合与 sha256 精确比对（`plugin-service-runtime-installer.ts` 的 `Service runtime artifact set is incomplete` / `SHA-256 mismatch`），`templates` 只写服务 data/cache 目录，不能替代。【实证】
- **鉴权**：密钥来自宿主注入的 `ASTRAVIA_SERVICE_SECRET_ENGINE_KEY`（凭据 id `engine-key` → 环境变量名规则）；`Authorization: Bearer` 或 `x-dbx-token`；`timingSafeEqual` 比较；`/health` 免鉴权但不暴露宿主路径。
- **写闸门规则集**逐条移植自 `astravia/packages/desktop-app/src/main/database/sql-safety.ts`（ESM 重写，非逐字节等价），四处有意差异已在 `query-guard.mjs` 头部说明（去掉 prod/dev 维度、保留未知首关键字默认拒绝、新增 destructive 二次确认、`VALUES` 归读）。
- **同步驱动的时间语义**：`node:sqlite` 是同步 API，单条语句无法中途抢占；`timeoutMs` 只在**语句之间**生效，已在代码注释与报告如实写明。
- **大整数**：一律 `setReadBigInts(true)`，超出 ±2^53−1 归一化为十进制字符串（E2E 用例 10 断言 `9007199254740993` → `"9007199254740993"`），避免 `ERR_OUT_OF_RANGE` 打死整条查询。
- **零行结果集仍返回表头**（`StatementSync.columns()`），修掉了旧审计项 N4；**库文件不存在不再静默建库**，直接 `CONNECTION_ERROR`（修掉旧审计项 N3）。
- **诚实边界**：除 sqlite 外的 9 类驱动只登记在 registry 里（`ready:false`），调用返回 `DRIVER_UNSUPPORTED`（501），不会用空表假装成功。

## 6. 未验证 / 未知（不得据此判定完成）

- 真实 Desktop `install() → start() → /health` 全链路：无联调环境。【未知】
- `MAX_TEMPLATE_BYTES` 实际取值：grep 路径取错未取到；两份模板各 <32 KB，任何合理上限都够。【未知】
- `win32-x64` / `linux-*` 平台声明与 darwin 同字节（引擎是纯 JS，内容确实相同），但未在真机启动验证。【推断】
- 包体、`.astraviapkg` 分发索引与 md5：属发布环节，本轮只产出插件自身包。【未知】

## 7. 本轮改动文件

- 新增：`service/src/http-server.mjs`、`service/src/driver-registry.mjs`、`service/src/engine/{protocol,query-guard,connection-pool,request-router}.mjs`、`service/src/drivers/sqlite-driver.mjs`
- 新增（构建产物，随包交付）：`service/main.mjs`、`service/drivers/sqlite-driver.mjs`
- 新增：`scripts/build-engine.mjs`、`src/test/engine-service.test.js`、`src/shared/services/engine-client.ts`
- 修改：`plugin.json`（加 `providers.services`）
- 未改动：UI、`src/index.tsx`、`src/runtime-contract.ts`、`package.json`、`.gitignore`、其他插件
