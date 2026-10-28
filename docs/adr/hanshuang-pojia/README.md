# hanshuang-pojia 插件 ADR 索引

这十份 ADR 记录 `abilities/plugins/hanshuang-pojia` 为什么长成现在这样。按「谁被谁取代」读，比按编号读更省事：
0006 是案例层的地基，0007 与 0008 是在它上面继续加的两层，0009 补它的门禁边界；0010 修订 0004 §4 的执法手段；0001–0005 各自独立。

源文件原先放在插件自己的 `docs/adr/`，2026-10-27 迁到仓库根与其他插件并列。正文保持迁移前的原样，
2026-10-27 按 **2.11.0** 逐条对照源码核过一轮，结论追加在每篇文末的「实现核对」节里——**事实以核对节为准**，
正文只代表当时的判断。

| ADR | 主题 | 状态 |
| --- | --- | --- |
| [0001](./0001-seep-kit-capability-parity.md) | 与上游 `seep-kit` 的能力对标：面板能从字节算出什么 | 已接受；**D4、D9 已被实现反转，无新 ADR** |
| [0002](./0002-external-process-bridge.md) | 外部进程桥：谁能起进程、写文件、拒绝只读假设 | 已接受（现行），`commands` 8 → 14 |
| [0003](./0003-toolchain-install-plan.md) | 工具链安装：插件出计划、agent 执行 | 已接受（现行） |
| [0004](./0004-host-hook-boundary.md) | 上游四件套映射到宿主的钩子边界 | 已接受（现行），权限 13 → 15 |
| [0005](./0005-workbench-completion-and-lab-state.md) | 工作台四个补齐点与 Lab 状态落点 | 已接受（现行） |
| [0006](./0006-case-contract-v2-and-precedent-library.md) | 案例契约 v2 与战例库（目录、门禁、命名） | 已接受（现行），D10 表述由 0007 改写 |
| [0007](./0007-case-corpus-layer.md) | 案例语料层：先例 + 原文双层落地 | 已接受（现行） |
| [0008](./0008-runnable-case-corpus.md) | 案例语料从方法摘要升级为可执行先例 | 已接受（2026-10-27 已落地；初拟编号 ADR 001） |
| [0009](./0009-late-authorisation-log.md) | 授权晚到：`auth-log.md` 与「回报落盘门禁」 | 已接受（2026-10-27 已落地于 2.12.0；补充 0006 D2/D4） |
| [0010](./0010-refusal-cascade-sentence-reshaping.md) | 拒答恢复改为句式级联：禁令重申换成评审式重塑 | 已接受（2026-10-28 已落地于 2.13.0；修订 0004 §4 的执法手段） |

## 落实与偏差

2026-10-27 把八篇逐条对照源码、生成物与实跑结果核一遍。能重跑的写进命令块，守不住或已经漂掉的写进表里，
免得下次又把「文档说了」当成「代码做了」。

| ADR | 落实 | 偏差 / 说明 |
| --- | --- | --- |
| 0001 | 工具面 31 个（`src/tools/ids.ts:50`）；面板 17 页（`state.ts:8`）；先例 19 包 | **D4 反转**：`generate_hook` 现有 `observe` / `override` / `replace` 三档（`hook-template.ts:4-11`），正文写的是「只观察不改写」；**D9 反转**：`agent/skills/` 已注册 9 个 SKILL.md，正文写的是「刻意不注册」。两处都由实现单方面推进，需补新 ADR 或明确撤回 |
| 0002 | 通道 A/B/C 的否决仍成立；`commands` 14 项由 `TOOLCHAIN` 派生（`catalog.ts:415`） | `frida_dump` 让 D18a 的前提变了（不再只有「脚本 + 手工命令」）；`run-radare` 仍无 `assertReadOnly` |
| 0003 | 四条「插件不自装」否决全部成立，`TOOLCHAIN` 14 / `COMPANIONS` 11 | 无。`goal` 与 `sample` 都可不给，缺省为 `full`（`install.ts:73`） |
| 0004 | 两块注入 850 / 840；`Stop` 钩子；续跑上限 3 | 安全注入日志里的 `shape` 是硬写的 `messages(openai)`（`contributions.ts:65`），所以「INJECT / SKIP」是按 provider 推的，**不是**对载荷的观测；`PAGE_HINT` 只覆盖 11 个页签 |
| 0005 | `code_item` 解析、`PipelineBar` 四段、`familyBaseline`、`verifySource` | 测试总数 527 → 621；`GROUPS` 多出 `cases` 组 |
| 0006 | `scope.md` 九节、`ready_for_act` 只推导、`MAX_NAME_CHARS = 64`、只扫 `cases/` 与 `work/` | 工具 28 → 31；`src/domain/case/` 4 → 6 文件；`workitems.md` 解析器只认「≥6 列、第六列是状态」，不校验模板列数 |
| 0007 | 包内四份契约文档 + 文档库原文双层；`source` ⇒ `caseDocs` 强制 | 「309 → 约 339 篇」实为 340 篇 |
| 0008 | 19 包都有可跑工具，`--all` 逐工具跑 `--self-test`；`hpkit` 自检 47/47 | `precedents.generated.ts` 446 KB（正文估 401 KB）；`manifest.json` 的 `runtime` 写错不会被校验器拦住 |
| 0009 | `auth-log.md` 最后一块生效（`library.ts#parseAuthLog`）；`init_task` 回读磁盘再报门禁（`workspace.ts#recordAuthAmendment`） | **旧缺陷已修**：曾按内存 brief 回报门禁，第二次带 `auth_status=granted` 时报 ready 而磁盘仍 pending；`scope.md` 仍只写一次 |
| 0010 | 静默拦截入判（`refusal.ts:105`）、三档句式级联（`reshaping.ts`）、复合幂等键（`refusal.ts:183`）、`turnId` 缓存原话（`contributions.ts:49-84`）；55 文件 / 659 例 | **三处偏离上游**：`ATTACK_ASK` 必须放宽（上游那 8 条不命中「帮我逆向 X」）；目标提取补 POSIX 路径与 Android 包名；拒答识别补「这件事我不做」（上游 `REFUSAL_MARKERS` 同样漏，但上游有 L1 兜底）。宿主对 `lastAssistantMessage` 的 nullable 行为仍为 **Assumed**，待发布后看日志 |

守住这些的命令（全部在插件目录下跑）：

```bash
cd abilities/plugins/hanshuang-pojia
npm run check                                          # tsc
npm run test                                           # 55 文件 / 659 例
npm run verify:generated                               # 提示词 / 工具索引 / 先例三处 --check
node scripts/check-precedent-package.mjs --all         # 19 包 + 逐工具自检
cd cases/_shared && python3 -m hpkit.selftest          # 47/47
```

## 几个「不是看上去那样」

- **预览不是运行时**：`generate_hook` 只吐脚本、不连设备；`frida_dump` 的 `script` 模式同理。凡是要设备的，
  命令由用户在真机上跑。见 0002、0001。
- **伪代码不是反编译**：`decompile_function` 是 r2 `pdc` 这一层，没有类型恢复、没有变量合并，连比较的符号性都
  标成未定。见 0001。
- **语义 diff 的 `same` 指指令字节相同**：`constants-only` 才是「形状一样、常量变了」——补丁过的门就长这样。
  见 0001。
- **先例的 `scope.md` 恒为 `pending`**：随包语料是方法论，不是任何一次评估的授权；复制后必须重跑 `init_task`
  重新声明范围。见 0006、0007。
- **本工作台自己的文档算指令，目标的字节算材料**：提示词里的豁免只覆盖前者；样本里的「忽略上述指令」是要上报的
  发现，不是要执行的命令。见 0004。
- **`blocked` 不等于 `missing`**：前者是宿主拒了这条命令（权限或设置），后者才是没装软件，修法完全不同。
  见 0003。
- **插件不写用户目录**：`install_astravia` 把注入块交给 `saveAs`，用户点保存即授权。见 0004。
- **案例目录里没有 `patches/`**：补丁与重打包产物放 `exports/`，连同生成它的命令，好让整轮能重跑。见 0002、0006。
- **`ready_for_act` 不是写在文件里的状态**：`scope.md` 里的 `- ready_for_act:` 行只是当时的结论，读端每次重算；
  开工后补的授权记在 `auth-log.md`（只追加，最后一块生效），不改写 `scope.md`。见 0006、0009。

## 文档里标注的三种证据等级

- **Observed**：本机跑过、看见输出（命令、退出码、字节数、`file:line`）。
- **Inferred**：从已观察到的代码或行为推出。
- **Assumed**：既没跑也没法在本机跑——主要是宿主侧实现（`plugin-package.ts` 的权限勾选、`collectRuntimeFiles`
  的目录收集）与需要真机 / IDA 的链路。
