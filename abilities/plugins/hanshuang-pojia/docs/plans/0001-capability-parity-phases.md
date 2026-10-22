# 实施方案 0001：插件对标 seep-kit 的分阶段落地

- 依据：[ADR 0001](../adr/0001-seep-kit-capability-parity.md)
- 起点版本：2.4.0（10 个 Agent 工具、14 个工作台页面、309 篇随包文档）
- 目标：把矩阵里标为"本期补齐 / 规划"的项目按阶段实现，每一阶段可独立发布
- 纪律：改动只在 `src/domain`（纯逻辑）、`src/tools`（注册项）、`src/features/<feature>`、
  `src/cli`、`scripts`、`src/test`；命名遵循 `docs/plugin-project-structure.md`

## 阶段总览

| 阶段 | 内容 | 版本 | 状态 |
|---|---|---|---|
| P1 | 伪代码恢复、语义 diff、hook 模板、目录批量 triage、CLI | 2.4.1 | 已完成 |
| P2 | 外部进程桥（`commands` + `ctx.command.run`）：`probe_environment`、`run_radare`、`decompile_android`、`init_task` | 2.4.2 | 本次完成 |
| P3 | 指令编码器（asm ↔ bytes）、Overview 流水线状态条、DEX code-item 视图 | 2.4.3 | 规划 |
| P4 | 跨样本基线（同一家族的重复样本聚合）、报告三列对比 | 2.4.4 | 规划 |

每个阶段都必须同时完成：领域实现 → 工具注册 → 面板呈现（若该阶段有 UI）→ 测试 → 双语文案 →
版本与文档同步 → CI 发布。

---

## P1：四块离线能力 + 一个真能跑的 CLI

### P1.1 伪代码恢复（`decompile_function`）

- 模块：`src/domain/native/pseudo.ts`
- 输入：样本字节、架构、函数起点 / 上界 / 可选符号名、三档详略、字符预算
- 复用：`cfg.buildFunctionView`（基本块与边）、`deep.peekCString`（字符串引用）、`insn` 的 `flow`
- 输出：`PseudoResult { text, blocks, calls, instructions, strings, truncated, budget, warnings }`
- 规则：
  - 每个基本块一个 `L_<offset>:` 标签；条件分支渲染成 `if (<cmp>) goto L_x;`，无比较上下文时退化为
    `if (cond) goto`，绝不臆造比较对象
  - 调用渲染成 `<返回寄存器> = sub_<offset>()`；符号名已知时用符号名
  - `fold` 只保留控制流 / 调用 / 访存 / 比较；`summary` 只保留调用与分支骨架
  - 栈槽统一命名 `var_<offset>`；输出头部固定一行"寄存器级伪 C，非类型恢复"
- 工具：`src/tools/decompile-function.ts`，参数 `path`、`offset?`、`end?`、`name?`、`mode`、`budget?`
- 边界：`end` 省略时走 `symbolBoundFor`（下一个符号 → 可执行段末尾 → 8 KiB 兜底）再由
  `trimTrailingData` 剪掉 `ret` 之后的不可解码尾随数据；同一条规则被 CLI 与 `fingerprintFunctions` 共用
- 验收：aarch64 夹具（`mov` / `cmp` / `cset` / `cbz` / `bl` / `ret`）产出含标签、`if`、调用与 `return`；
  预算截断可见；`fold` 行数严格少于 `full`。

### P1.2 语义二进制 diff（`diff_functions`）

- 模块：`src/domain/native/semantic-diff.ts`
- 指纹：`exact`（指令 `hex` 串的 sha256）、`shape`（助记符 + 保留寄存器位宽与逗号位置的归一形状）、
  `calls`（被调用目标集合）
- 匹配顺序：符号名 → `shape`；每条匹配标 `same` / `constants-only` / `changed` / `renamed`，
  未配对的进 `added` / `removed`
- 工具：`src/tools/diff-functions.ts`，参数 `path`、`otherPath`、`maxFunctions?`
- 验收：改动一条立即数时 `shape` 相同、`exact` 不同 → `constants-only`；`xor eax, eax` 换成别的
  指令 → `changed`；新增函数进 `added`，删除进 `removed`；两侧架构不同直接拒绝并说明；
  两侧都指纹不出函数时不得宣称"相同"，输出显式警告。

### P1.3 Frida hook 模板（`generate_hook`）

- 模块：`src/domain/android/hook-template.ts`
- 输入：APK / DEX 路径 + 查询词 + 选项（`kind`、`backtrace`、`logReturn`、`packageName`、`limit`）
- 复用：`dex-index.searchDex`、`archive/zip` 读 `classes*.dex`
- 输出：一份可直接保存的 JS，含 `Java.perform`、`Java.use`、overload 解析、参数与返回观测、
  可选 Java 栈（`Log.getStackTraceString(Exception.$new())`）；文件头写明"观测模板，不含绕过逻辑"
- 工具：`src/tools/generate-hook.ts`，参数 `path`、`query`、`kind?`、`backtrace?`、`logReturn?`、
  `packageName?`、`limit?`
- 边界：一份脚本最多挂 `MAX_TARGETS = 12` 个目标 —— 再多就不是"看一眼"而是批量插桩
- 验收：命中方法生成对应 overload 分支；未命中退化为 `getDeclaredMethods` 枚举提示而不是空脚本；
  生成文本不包含 `return true` / `return 1;` / `Java.choose` / `implementation =` 之类的改写语句。

### P1.4 目录级批量 triage（`triage_directory`）

- 模块：`src/domain/batch.ts`（扩展名白名单、排序、汇总文本）+ `src/tools/triage-directory.ts`
- 枚举：`ctx.fs.listFilesRecursive`（宿主上限 10 000）；顺序读取、单个失败只记一行不中断
- 输出：等级降序表（等级 / 分数 / 格式 / 大小 / 发现数 c·h·m·l / 路径）、被 `limit` 截掉的候选数、
  超过 32 MiB 的跳过项；不写盘
- 验收：混合目录（ELF + APK + 文本 + 超大文件）只分析白名单扩展名；失败条目排在最后并带原因；
  空目录给出明确说明而不是空表。

### P1.5 CLI（`scripts/analyze.mjs` + `src/cli/analyze.ts`）

- 子命令：`triage`、`strings`、`symbols`、`disasm`、`decompile`、`diff`、`hook`、`docs`
- 实现：esbuild 以 `platform=node` 打包 `src/cli/analyze.ts` 到 `.cache/analyze.mjs` 再执行；
  `--json` 输出机器可读结果；不依赖插件 SDK、不联网
- 验收：在真实样本上跑通 `triage` 与 `decompile`；`--help` 列出全部子命令并退出 0；
  退出码 `0` 成功 / `1` 用法错误 / `2` 分析失败。

### P1.6 工作台自检对齐 verifier 看板

- 呈现：顶部结论条（`READY` / `DEGRADED` / `BLOCKED`）+ 分组徽标（`n / m 通过`）+ 每行状态
- 数据：`services/health.ts` 的分组增加 `passed` / `failed` 计数，不新增伪造检查项
- 验收：`failed > 0` 时结论条必须是 `BLOCKED`；只有 `warn` 时是 `DEGRADED`；全 `pass` 是 `READY`；
  双语 key 齐全。

### P1.7 文档与命名

- `references/workbench-2.0.md` → `references/plugin-handbook.md`，`SKILL.md` 只改路径引用
- 新增 ADR / 方案两份文档，`README` 补一段"CLI 与四个新工具"
- `abilities/plugins/hanshuang-pojia/docs/` 不参与打包（仅源码仓库）

### P1.8 版本与发布

- 2.4.0 → 2.4.1：`package.json`、`plugin.json`、`ability.json`、市场源条目、锁文件
- 本地链：`bun run check` → `bun run test` → `bun run build` → `node scripts/sync-docs.mjs --check`
  → 根目录 `node scripts/marketplace.mjs check`
- 发布：普通源码 PR 合入 `main` 后由 CI 构建 `.astraviapkg` 并推进 gh-pages，不手工提交 `dist/`

---

## P2：外部进程桥（2.4.2）

依据 [ADR 0002](../adr/0002-external-process-bridge.md)。三条 MCP 通道里，自建 `host-node` 服务与
`npx` stdio 都被否决，选 `plugin.json#commands` + `ctx.command.run`。

1. `src/domain/toolchain/catalog.ts`：`TOOLCHAIN`（8 项，含版本参数与安装提示）、`COMMANDS`、
   `specsForCapability`。`COMMANDS` 与 `plugin.json#commands` 逐字节一致，由测试守护。
2. `src/domain/toolchain/probe.ts`：`probeToolchain` → `ToolStatus[]` + 能力布尔表；区分「宿主拒绝」与
   「未安装」；`renderToolchain` 输出逐行对齐的可用性表。
3. `src/domain/toolchain/radare.ts`：9 个 operation 的纯函数 `planRadare`（返回 invocations + render），
   `assertReadOnly` 只读守卫，`stripNoise`/`paginate`/`branchSkeleton`/`foldStatements`/`truncateChars`。
4. `src/domain/toolchain/android.ts`：`planAndroid`（jadx / apktool）+ `searchSourceTree`（走插件 `fs`，
   不经进程）。`src/domain/toolchain/workspace.ts`：`initTaskWorkspace`（**不含 `patches/`**）。
5. `src/features/workbench/services/toolchain.ts`：把 `ctx.command.run` 适配为 `CommandRunner`，探针 60s 缓存。
   工具 handler 拿不到 `ctx.command`，只能在 `activate` 闭包里捕获。
6. 四个工具：`probe_environment`、`run_radare`、`decompile_android`、`init_task`；工具数 14 → 18。
7. `plugin.json`：`permissions` += `agent.command.run`，新增 `commands`（8 条）。
8. 验收：`toolchain.test.ts` 全绿；未装 r2 时 `probe_environment` 报 `✗ not installed` 而非权限错；
   装 r2 后 `run_radare` 对自编 aarch64 样本取 `info`/`functions`/`disasm` 有真实输出。

## P3：编码器、流水线状态条与 DEX 指令视图（2.4.3）

1. `src/domain/native/encode.ts`：x86 / x86-64 / AArch64 常见指令编码子集（`mov`/`add`/`sub`/`xor`/
   `cmp`/`jmp`/`call`/`ret`/`nop`），双向 `asm → bytes`；无法编码时明确报错并给出最接近的候选，
   不输出「大概对」的字节。
2. Overview 页流水线状态条：对照 `render_workflow.html` 的四段（画像 → 控制流 → 智库 → 验证），
   状态取自当前报告的 sections 与 settings，不引入假进度。
3. `src/domain/android/dex-code.ts`：解析 `code_item`（registers、insns、try/catch），渲染 smali 风格
   指令文本；上限 2 000 条指令，超出显式截断。
4. 验收：编码后用 `disassemble_range` 回转得到同一文本；流水线在无样本时显示「等待样本」。

## P4：跨样本基线（2.4.4）

1. 样本库增加「家族」分组：同一 `shape` 指纹集合的样本归并，报告里给出共同函数数与差异函数数。
2. `reports` 页支持两份报告并排对比（既有 `report-compare.ts` 扩展为三列：共同 / 左有 / 右有）。
3. 验收：同家族两个样本的并排视图稳定排序，新增发现高亮可解释。

---

## 测试计划

| 层 | 文件 | 覆盖 |
|---|---|---|
| 领域 | `src/test/pseudo.test.ts` | 标签、条件分支、调用、返回、三档详略、预算截断 |
| 领域 | `src/test/semantic-diff.test.ts` | 自比为零、常量变化、增删函数、架构不一致 |
| 领域 | `src/test/hook-template.test.ts` | overload 生成、未命中提示、无绕过语句 |
| 领域 | `src/test/batch.test.ts` | 扩展名过滤、排序、跳过与失败计数 |
| 工具 | `src/test/tools.test.ts` | 注册数量 18、id 清单、四个离线工具的真实调用 |
| 工具 | `src/test/toolchain.test.ts` | 可执行文件目录与 manifest 逐字节一致、探针三态、只读守卫、四个工具链工具的真实调用 |
| 领域 | `src/test/toolchain.test.ts` | `planRadare` 九种操作、`planAndroid` 两种反编译、`searchSourceTree`、`initTaskWorkspace` |
| 集成 | `src/test/cli.test.ts` | `scripts/analyze.mjs` 在临时目录对夹具跑 `triage` / `decompile` |
| 内容 | `src/test/skill-library.test.ts` | 165 文件哈希不变（改名不影响） |
| 发布 | 根 `tests/marketplace.test.mjs` | 清单与包内容一致、版本同步 |

## P1 落地记录（2.4.1）

写入时点：2.4.1 已合入源码分支，`release/hanshuang-pojia-2.4.1.astraviapkg` 由本地 `build` 生成
（正式包由 CI 构建，`dist/` / `release/` 均不入库）。

| 项 | 结果 |
|---|---|
| 工具注册 | 10 → 14，`EXPECTED_TOOL_COUNT = 14` 同时约束自检页与 `tools.test.ts` |
| 自检 | 26 个 spec 文件 / 241 条断言全绿（改动前基线 21 文件 / 186 条） |
| 类型 | `tsc --noEmit` 无输出 |
| 构建 | `vite build` 成功，498 个运行时文件 |
| 文档 | `sync-docs.mjs --check` → `309 documents`；根 `marketplace.mjs check` 通过 |
| CLI 真机验证 | `symbols` / `decompile --symbol gate` / `diff a b` / `docs frida` 在 clang 编出的 arm64 样本上给出预期输出 |

过程中修掉的真实缺陷（都属于"不修就等于工具在骗人"这一类）：

1. aarch64 解码器原先只认整字节比对，`cmp w0, w8`（`0x6b08001f`）直接掉进 `.word`；补上
   add/sub 立即数与移位寄存器、逻辑移位寄存器、`lsl` 立即数、CSEL/`cset` 五个族。
2. 函数没有 `end` 时按固定跨度读，把后面整段数据当指令；补 `symbolBoundFor` + `trimTrailingData`。
3. 指令形状把 32/64 位寄存器混同，32 位溢出回归会被误报成"只改常量"；形状改为保留位宽与逗号位置。
4. 两侧都指纹不出函数时仍报"相同"；改为至少一条匹配才允许 `identical`，否则显式警告。

## P2 落地记录（2.4.2）

写入时点：2.4.2 源码完成，工具数 14 → 18，`plugin.json` 新增 `commands`（8 条）与
`agent.command.run`，`.astravia/marketplace.source.json` 的 `configVersion` 1 → 2。

| 项 | 结果 |
|---|---|
| 工具注册 | 18，`EXPECTED_TOOL_COUNT = 18`；四个新工具各自有真实调用用例 |
| 自检 | 29 个 spec 文件 / 300 条断言全绿（P1 基线 27 / 251） |
| 类型 | `tsc --noEmit` 无输出 |
| 构建 | `vite build` 成功，500 个运行时文件 → `hanshuang-pojia-2.4.2.astraviapkg` |
| 文档 | `sync-docs.mjs --check` → `309 documents`；根 `marketplace.mjs check` 通过 |
| 根测试 | `node --test tests/*.test.mjs` → 66 pass / 0 fail |

过程中修掉的真实缺陷：

1. `failure()` 用 `stripNoise` 洗 stderr，而 r2 的诊断几乎都带 `WARN:` / `ERROR:` 前缀，于是
   “样本打不开”被退化成“no output”。改为 stderr 原样保留。
2. `SearchHit.path` 存的是相对路径，名字却与宿主的绝对 `path` 重叠；命中的渲染因此可能被误用。
   改名为 `relPath`。
3. 只读守卫只拦命令首字母，`pdf @ main|sh`、`pdf @ main > out`、`. script.r2`、`afl$(id)`、`=!id`、
   `o /etc/passwd` 全部能绕过——它们不碰 `w`/`!`，却分别能掉 shell、写文件、跑脚本、打开任意文件。
   新增“离开 r2 自身解析器”的黑名单（管道、重定向、`$(`、反引号、`=!`），并把 `o`（打开文件）与
   `.`（执行脚本）列入首字符黑名单。
4. 探针原先把 `dr` 与整个 `d`（调试）家族混同，可读寄存器的只读命令被误杀；加 `ALLOWED_COMMAND` 放行。
5. `capabilities` 的语义定死为“该能力所需的可执行文件全部可用”并有测试守护：r2 被拒时
   `radare` 必为 false，不能因为 rabin2 还能跑 `info` 就声称反汇编可用。


---

## 回滚

每个阶段一个版本。能力出问题时先降级工具注册（`register-tools.ts` 逐项 try 已有容错），再回滚
版本号与市场条目；不删除历史 release 包，CI 只追加。

## 完成定义

- 四个新工具能在真实样本上给出可复现输出，且描述里写清"不做什么"。
- CLI 至少两个子命令在终端复现同一结论。
- `check` / `test` / `build` / `sync-docs --check` / 根目录 `marketplace check` 全绿。
- ADR 矩阵里每一项仍能对上当前实现状态（无"已实现但矩阵说没做"的漂移）。
