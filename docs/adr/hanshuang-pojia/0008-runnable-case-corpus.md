# ADR 0008：案例语料从「方法摘要」升级为「可执行先例」

- 日期：2026-10-27
- 状态：已采纳（2026-10-27 制定，同日落地；初拟编号 ADR 001，迁入仓库根后统一为 0008）
- 核对：2026-10-27（版本 2.11.0），见文末「实现核对」
- 关联：[ADR 0006](0006-case-contract-v2-and-precedent-library.md)、[ADR 0007](0007-case-corpus-layer.md)、
  [契约](../../../abilities/plugins/hanshuang-pojia/docs/contract/case-corpus.md)

## 背景

ADR 0007 把上游 `Tool/cases/` 的**文本**搬了进来，但只搬了结论层：14 案变成 14 份方法摘要 +
24 篇复盘正文，判定式、补丁表、否证记录都在，**但一件能执行的东西都没有**。

上游 `Tool/cases/项目X` 的实际形态是「工程现场」：

```text
项目J/
├── docs/reverse-engineering.md      叙事（我们也搬了）
├── docs/protocol-and-patch.md       证据表（我们也搬了）
├── src/Patcher.cs                   能编译、能打补丁的工程
└── tools/*.ps1 / *.py               能直接跑一遍拿结论的脚本
```

本地现在只有前两类。后果是三处可测的差距：

1. **不能直接跑**。读「把 `0x004A1F32` 的 `0F 85` 改成 `0F 84`」之后，操作者仍要自己写扫描器、
   自己算 RVA、自己校验回滚；上游那份 `scan_aob.py` 抬手就用。
2. **两案明显缩水**。`proxy-dll-license-state-machine`（项目A）技术正文只到上游 49%、
   `aob-signature-cross-version`（项目D）只到 41%——丢的正是工程现场那部分。
3. **5 个包是草图**。`client-auth-gate` / `elf-packed-loader` / `apk-dex-unpack` /
   `android-ssl-pin-bypass` / `js-sign-chain` 只有 2.4–2.7 KB `method.md`，无深读、无工具，
   深度不到其余 14 包的三分之一。

另有一处与内容无关、但同样致命的问题：**先例库没有入口**。`agent/prompts/SYSTEM.md`
零次提到 `search_cases`，`kit-docs/tool-index.json` 也没收录它。是否被发现 100% 取决于模型
自己读工具描述后决定调用。上游恰好相反——`softseep/SKILL.md` 的判型表有 3 行把
「授权/许可」「算法还原」「出报告」直接路由到 `project-paradigms.md`，是主动把模型推向语料。
19 个包躺在包里没人调，等于没做。

## 决策

### D1 两个同名目录的职责重新划死

| 目录 | 回答的问题 | 形态 |
| :--- | :--- | :--- |
| `cases/<slug>/` | **怎么在新目标上再跑一次** | 先例包 + `tools/` 真实脚本（可执行） |
| `src/content/docs/cases/<slug>/` | **这个案子当时怎么判断的** | 叙事与证据（补丁表、算法推导、否证记录） |

上游一个目录同时承担两件事（`src/` 能跑、`docs/` 能读）。本地把它拆成两个物理位置——
因为两者发布机制不同（脚本要落到磁盘才能跑，正文要惰性 fetch 才不会撑大 JS chunk）——
但**两边都必须齐**，缺一边就是本 ADR 要修的形态。

### D2 可执行层用真实文件，不内联

```text
cases/_shared/hpkit/           共享原语（不是包，不参与排名）
cases/<slug>/tools/manifest.json   工具清单：id / entry / runtime / purpose / args / expect / platforms
cases/<slug>/tools/<name>.py       真脚本
```

- 构建：`vite.config.ts` 的 `hanshuang-pojia-runtime-resources` 增加一条 `assets/cases/**` 的
  `emitFile`，镜像 docs 的做法（纯文本资源，不进 JS 分块）。
- 运行：新工具 `scaffold_case` 把 `<slug>/tools/*` 与 `_shared/hpkit/*` 写进项目内目录
  （默认 `<root>/<name>/tools/`），返回确切命令行。
- **不内联进 `precedents.generated.ts`**：该文件已 401 KB，脚本再内联会让主 chunk 翻倍；
  而且脚本必须落盘才可执行，内联没有收益。

### D3 语言基线：Python 3 标准库，PowerShell 只在必须调 Win32 时

- 全部脚本零第三方依赖，Python 3.9+ 标准库即可跑。执行命令统一 `python3`，Windows 上回退
  `py -3` / `python`，由 `manifest.json` 的 `runtime` 与 scaffold 返回的命令覆盖。
- 只在确实需要 Windows API（注册表、服务、WMI、PE 加载）时写 `.ps1`，且 manifest 标
  `platforms: ["win32"]` 并提供 Python 只读等价路径。**不写 `.bat`**（Windows-only、不可测试）。
- 不把上游 C#/Rust 工程源码搬进来：它们的价值是「判定逻辑」，用 Python 重写成等价判据工具，
  比搬一个无法在 CI 编译的 `.csproj` 更接近「能跑」。

### D4 每个工具必须自证可跑（`--self-test`）

每个脚本必须实现 `--self-test`：用**代码生成的合成样本**（合成 PE/ELF/DEX 头 + 已知字节 +
已知特征码）验证解析、扫描、打补丁、回滚四处正确，退出码 0。

校验器 `check-precedent-package.mjs --all` 对每个工具跑一次 `--self-test`（`--no-tools` 可跳过）。
这条把「能跑」从口号变成门禁——没有它，几个月后没人知道这些脚本还能不能用。

合成样本是代码生成的、只存在于临时目录，**不提交任何二进制**（`FORBIDDEN_FILE` 规矩不变）。

### D5 共享原语 `cases/_shared/hpkit/`

| 模块 | 职责 |
| :--- | :--- |
| `cli.py` | 参数解析、报告渲染、退出码、`--self-test` 脚手架 |
| `pe.py` | PE/ELF 头、节表、RVA↔文件偏移、导入表、版本资源定位 |
| `scan.py` | AOB 通配扫描、多构建对照、命中偏移归一 |
| `patch.py` | 补丁表应用 / 校验 / 回滚，sha256 前后对照 |
| `dex.py` | DEX 头、字符串池、方法表最小解析 |
| `fixtures.py` | 合成样本生成（仅 self-test 用） |

`_shared` 不是先例包：`precedentDirs()` 跳过它，校验器单独校验它只含 `.py`。

### D6 消灭「缩水」与「草图」

- `proxy-dll-license-state-machine` 补 `docs/version-evolution.md`（四代演进与判据变化）；
  `aob-signature-cross-version` 补 `docs/pipeline.md`（八步判据链的工程实现）；
  两者各配可跑工具。
- 5 个自写包各补一篇 ≥ 3000 字符深读，并至少 1 个可跑工具。
- 校验器加严：`caseDocs` 每篇 ≥ 3000 字符（原 1000）；**没有 `source` 的包也必须写 `caseDocs`**
  ——「方法摘要 + 无复盘」不再合法。

### D7 发现性：三处显式路由

1. `agent/prompts/SYSTEM.md` 新增判型路由表，对齐上游 3 行语义（授权/许可/卡密 → 先例；
   算法还原 → 先例；出报告 → 报告模板），并点名 `search_cases` / `scaffold_case`。
2. ~~`src/content/docs/kit-docs/tool-index.json` 收录 `search_cases` 与 `scaffold_case`~~ —— **已否**：
   该文件是外部工具链**二进制**目录（42 项 + `available`/`resolved_path`），由
   `src/domain/toolchain/catalog.ts` 生成，受 `src/test/tool-index.test.ts` 的 json/catalog/parity
   三方一致性守街；把 agent 工具塞进去会污染语义并直接砸测试。可发现性改由 agent 侧文档承担：
   `SYSTEM.md` + `SKILL.md` + `plugin-handbook` §6.1 + README 工具表。
3. `agent/skills/hanshuang-pojia/SKILL.md` 与 `references/plugin-handbook.md` 增「先例与可执行工具」节。

## 影响

- 先例包：19 → 19（结构升级，每包至少 1 个可跑工具）；深读文档 24 → 30 篇（每个先例包至少 1 篇）。
- `search_cases` 渲染增加 `- tools:` 行，agent 一眼看到能跑什么。
- 新增工具 `scaffold_case`（31 个）；`plugin.json` 不承载工具清单，注册真值只在 `src/tools/register-tools.ts`。
- 版本 `2.10.0 → 2.11.0`；文档计数、README、handbook、`marketplace.source.json` 同步。
- 新增运行时资源目录 `dist/assets/cases/**`。

## 不做

- 不搬上游 `.dll` / `.exe` / `.bat` / `samples/`；不搬含真实产品名与用户路径的脚本原文。
- 不新增 `plugin.json` 的 `commands`：脚本由 Agent 自己的 shell 执行，插件不代跑。
- 不改 `search_cases` 的排名权重、`limit` 语义与两个检索源分开排名的规则。
- 不让 scaffold 越过授权门：先例仍 `auth.status=pending`，scaffold 只写文件、不执行。
- 不为「能跑」引入任何第三方 Python 依赖或 `pip install` 步骤。

## D5 补记（2026-10-27）：`pe.Image.exports()` 改为 ordinal-complete

初版只按名字表遍历，槽位数多于名字数时 ordinal-only 导出整批消失，只在「零具名导出」时兜底一条。这对 `proxy_forward_plan` / `qt_export_diff` 是硬缺陷：代理 DLL 必须把 NONAME 序号导出一起转发，否则调用方按序号寻址就断链。已改为逐函数槽遍历、反向查名字表，无名槽 `name=None`；夹具加 `ordinal_only` 参数，kit 自检补三条断言（数量 / 无名 / 序号），断言数 44 → 47。

同一批还修了两处会静默骗人的地方：`hpkit/selftest.py` 缺 `__main__` 守卫，`python3 -m hpkit.selftest` 什么都不跑却退 0；`check-precedent-package.mjs` 的 `tools=` 读的是 `case.json` 而非 `tools/manifest.json`，恒为 0。

## 实现核对（2026-10-27，版本 2.11.0）

本篇制定当天就已落地：19 个包每个都有可跑工具，`--all` 会把每个工具跑一遍自检。状态从“正在落实”改为已落地。

重跑：

```bash
cd abilities/plugins/hanshuang-pojia
node scripts/check-precedent-package.mjs --all              # 19 packages checked with tool self tests
node scripts/check-precedent-package.mjs --all --no-tools   # 只校验文档与元信息
npm run verify:generated                                    # precedents ok: 19 packages
cd cases/_shared && python3 -m hpkit.selftest               # 47/47 assertions passed
```

| 决策 | 当前落点（Observed） | 结论 |
| --- | --- | --- |
| D1 工具不内联正文，另发真文件 | `vite.config.ts:56` `assets/cases/<slug>/tools/<file>`、`:67` `assets/cases/_shared/hpkit/<file>` | 成立 |
| D2 包内工具目录结构 | `cases/client-auth-gate/tools/` 下就是 `gate_scan.py` + `manifest.json`（各包同形） | 成立 |
| D3 不能用 `--self-test` 的工具不得入包 | `src/domain/case/scaffold.ts:52-56` 把 `--self-test` 当成命令前缀；`scripts/lib/precedent-package.mjs:125`/`:144` 强制跑；`scripts/check-precedent-package.mjs:24` `--no-tools` 是唯一绕道 | 成立 |
| D4 `_shared/hpkit` 八个模块随包发 | `scaffold.ts:20` `HPKIT_FILES` 共 8 项；`src/test/case-scaffold.test.ts` 与磁盘对齐 | 成立 |
| D5 `pe.Image.exports()` 改 ordinal-complete | 断言总数 44 → **47**，实跑 `47/47 assertions passed` | 成立 |
| D6 工具清单不写进 `case.json` | `cases/client-auth-gate/case.json` 键为 `schemaVersion/slug/title/summary/signals/preset/fieldNotes/caseDocs/docs`，**无 `tools`**；清单在 `tools/manifest.json` | 成立 |
| D7 修 `check-precedent-package.mjs` 误读 `case.json` | 同一脚本现在同时校文档与工具，`--all` 19 包全过 | 成立 |
| 影响：先例包 19 个都有工具 | 19（`precedents ok: 19 packages`） | 成立 |
| 影响：生成物体量 | `src/domain/case/precedents.generated.ts` **446,185** 字节 | 成立，比本文估的 401 KB 大 |

一条读代码才知道的约束：`manifest.json` 里的 `runtime` 决定命令前缀（`python3` 还是 `node`，`scaffold.ts:55`），
写成 Python 却把 `runtime` 填 `node` 时脚手架会给出跑不起来的命令，而校验器只查文件存在与体量。将来加工具时这条没人拦。

