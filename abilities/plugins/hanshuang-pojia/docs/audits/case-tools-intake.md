# scripts/ 与 cases/tools 的现状、断点与整合方向

> 一次现状审计 + 上游 `Tool/cases` 解剖。回答三个问题：脚本各自干什么、先例工具在对话里到底能不能被调用、上游那批工程能带来什么。

## 1. `scripts/`：18 份，全部是构建期工具，没有运行时脚本

| 脚本 | 作用 | 触发点 |
|---|---|---|
| `sync-docs.mjs` | 生成文档索引 / 资产清单 / sha256（正文已外包给 gzip） | `sync:docs`、`verify:generated` |
| `sync-packs.mjs` | 生成提示词包索引（元数据） | `sync:packs`、门禁 |
| `sync-precedents.mjs` | 生成 19 个先例包的索引（只留 id，正文外置） | `sync:precedents`、门禁 |
| `sync-tool-index.mjs` | 生成 42 项工具清单 + 与 `spec/toolchain-parity.md` 对账 | `sync:tool-index`、门禁 |
| `sync-system-prompt.mjs` | `agent/prompts/SYSTEM.md` → `system-prompt.generated.ts` | `sync:system-prompt`、门禁 |
| `sync-skill-library.mjs` | 171 个技能文件的逐文件哈希 | `sync:skill-library`、门禁 |
| `sync-icons.mjs` | `assets-manifests/icon-manifest.json` → `icon-paths.ts`（54 个） | `verify:icon`、门禁 |
| `sync-routing-table.mjs` | 44 条路由表 → `routing-table.generated.json` | `verify:routes`、门禁 |
| `check-docs-deps.mjs` | `--strict`：docs/ 不得有机器读产物，spec/ 必须被读 | `verify:docs` |
| `check-precedent-package.mjs` | 19 包契约校验（含 `--with-tools` 跑 self-test） | `check:cases` |
| `report-dead-exports.mjs` | 导出符号死代码基线 | `report:dead` |
| `report-unused-locale.mjs` | 文案键使用率（识别模板拼键与 `%key%`） | `verify:locale` |
| `probe-refusal-selftest.mjs` | 本地桩跑拒答梯度（无密钥、无白名单） | `verify:probe` |
| `verify-routing.mjs` | lab 开/关/退出三态下 kernel 块是否路由到 `memory` | `verify:routing` |
| `analyze.mjs` | 把 `src/cli/analyze.ts` 打成 CLI（triage/strings/disasm/diff/hook） | `analyze` |
| `inject-matrix.mjs` | 九目标 × 安装/卸载 × 双 shell 批量出脚本 | `inject:matrix` |

**与上游的差异**：上游 `Tool/scripts/` 是**运行时运维脚本**（`install*.ps1` 直接改
`$HOME`、`master-route.ps1` 分发、`probe-refusal.py` 直连 provider、`case-init.ps1` 建目录）。
本插件的 `scripts/` 是**构建期**：只产出生成物与门禁，没有任何一份会在用户机器上改文件。
原因不是懒，是权限：宿主只放行项目内写盘，运行时的写入动作在 `src/tools/` 与生成脚本里，
而生成它的模板在 `src/domain/`。`scripts/` 不进发布包（`RUNTIME_DIRS` 无 scripts），这一点与
上游相反 —— 上游的脚本本身就是产品。

## 2. `cases/<slug>/tools` 在对话里到底怎么被调用

真实链路五步，其中**第三步是断的**：

1. `search_cases(query=…)` → 命中先例，输出里带一行
   `- tools: … — write them with scaffold_case, then run --self-test before trusting them`
   （`src/domain/case/precedents.ts:144`）。
2. `scaffold_case(precedent=<slug>)` → `planScaffold` 把 `tools/*.py` + `cases/_shared/hpkit/`
   复制进工作区（`src/domain/case/scaffold.ts:68-90`）。
3. **返回的是一段文本**（`renderScaffoldPlan`，`scaffold.ts:110`）：文件清单 +
   `python3 tools/<entry>.py --self-test`、`python3 tools/<entry>.py --args` 的命令行。
   **插件不执行它们**：`scaffold-case.ts` 只调 `context.host.fs`，全文件没有 `ctx.command`。
4. 命令交给**用户或宿主 Agent** 执行。插件声明过的 16 个可执行文件里**没有 `python`**
   （`plugin.json#commands` = r2/rabin2/radiff2/rasm2/rahash2/rax2/jadx/apktool/java/adb/apksigner/
   zipalign/frida/frida-ps/pwsh/powershell），所以连 `ctx.command.run` 都调不动它。
5. 跑出来的产物（补丁表、pin 层清单）再由 Agent 写进 `reports/` 或案例目录。

**结论**：这些工具的「经验」目前以**两种形态**存在 ——
① 可读的方法（`docs/method.md` 讲为什么这样做）；
② 可执行的脚本（`tools/*.py`，18 包各 1 个，`js-sign-chain` 2 个）。
第二种形态在对话里**没有闭环**：没有任何插件工具能跑它们，除 `check:cases --with-tools`
（构建期）之外没人验证过它们能跑。说它们「没价值」我不认同，说它们「当前不可达」是准确的。

## 3. 上游 `Tool/cases` 解剖（248 文件 / 14 工程）

构成：`.ps1` 56、`.md` 47、`.py` 40、`.txt` 27、`.cs` 23、`.dll` 6、`.c` 6、`.rs` 5、其他若干。
分布极不均：`项目A` 一个占 24 个文件，`项目C` 是**空目录**，`项目D` 只有 1 个文件。

四类真正有价值的资产（与「一次性手稿」区分开）：

| 资产 | 例子 | 为什么值钱 |
|---|---|---|
| **打通链条的脚本组** | `make_payload.py`(9.7K) + `loader.py` + `injector.py` + `项目APatch.c` | 一条从构造载荷到注入到补丁的**完整链**，不是单点脚本 |
| **防御侧成品** | `defense_hardening.c` / `.h` / `defense_hardening_spec.md`(7.1K) | 修复建议的可编译样例 + 规格，比散文强 |
| **交付话术** | `final_dialog_text.txt` | 结案怎么措辞，直接影响报告能不能被采纳 |
| **载荷块与状态** | `lic_block2.txt`、`verify_no_ini.txt`、`read_state.ps1` | 真实样本上的「这一段长什么样」 |

同质化证据（这类东西必须归一化）：`项目A` 里 `ocr_any/ocr_crop/ocr_en/ocr_gb/ocr_hex/
ocr_tmp/ocr_tmp2/ocr_tmp3` **八个 OCR 脚本**，哈希两两不同但只差参数；`run_about_ocr.ps1` 与
`run_ocr_target.ps1` 是同一件事的两个入口。这正是「战例目录 ≠ 工程体系」的地方。

## 4. 整合建议（按投入产出排序）

1. **把 `python` / `node` 加进 `plugin.json#commands`，并新增 `run_case_tool`**（P0）。
   参数：`slug`、`tool`、`args`；行为固定三步 —— 先跑 `--self-test`（不过就停，不碰真样本）、
   再跑真命令、把 stdout 与退出码交给调用方。路径限制在工作区内、超时 120 s。
   这一步把第 2 节的断点 3/4 接上，**先例工具从「读得懂」变成「跑得动」**。
2. **上游四类资产各提炼一份模板**（P1）：
   `defense_hardening` → 先例包的 `docs/defense.md` 增加「可编译样例」段；
   `final_dialog_text` → 报告模板的结案措辞；
   payload/loader/injector 三件套 → 抽成一个先例包 `payload-chain`（当前 19 包里没有这一类）；
   OCR 八脚本 → 归一成 `ocr.ps1 --mode hex|gb|en|crop`，作为**一个**工具进包。
3. **先例包契约加一列 `scenario`**（P1）：哪些是「方法演示」、哪些是「工程现场」、哪些是「语料」。
   上游 `项目A` 是现场、`项目C` 是空壳 —— 现在我们的 19 包全是同类，读者分不出该读还是该跑。
4. **门禁补一条**（P2）：`check:cases --with-tools` 现在只在手动跑；把它并入
   `verify:generated`（需要第 1 条先落地，否则等于在构建机上要求 python）。

## 5. 工程体系改造的落点

```
src/domain/case/        先例索引与外置正文（已有）
src/tools/case/         对话里的入口：search / scaffold / record（已有）+ run_case_tool（待加）
cases/<slug>/tools/     可执行脚本 + manifest.json（已有，18/19 包有）
cases/_shared/hpkit/    标准库实现，脚本自己解析（已有）
scripts/                只放构建期工具，不进包（保持不变）
```

不做的：不把上游 248 个文件搬进来。`项目C` 是空的、`项目A` 的八个 OCR 脚本只差参数、
23 个 `.cs` 是同一个修复样例的迭代 —— 搬进来只会得到「目录里有文件、机器上跑不了」的死重量，
这与 ADR 0010 §5.1「契约搬、产物不搬」的判断一致。
