# 自带工具链对照：2.0 便携版 vs 本插件（2.8.0）

问题：**插件激活后，是否自带工具链？** 与上游 2.0 便携版逐项对照。

参照对象：`/Users/zhugeyue/Desktop/tmp/hanshuang-pojia-2.0`（Electron 便携版，随包 `resources/seep-kit`，`VERSION 1.6.0`）。
被测对象：`abilities/plugins/hanshuang-pojia`，`plugin.json` **2.8.0**（实测于 2026-10-23）。

相关文档：[工具链对照表（42 项逐条判定）](../reference/toolchain-parity.md)、
[ADR 0002 外部进程桥](../adr/0002-external-process-bridge.md)、
[ADR 0003 插件出计划、agent 执行](../adr/0003-toolchain-install-plan.md)。

---

## 1. 结论

**不自带。** 插件容器里没有任何外部工具的可执行制品；它只**声明**自己可能启动哪些可执行文件
（`plugin.json#commands` 14 项），真正运行时由宿主 `ctx.command.run` 到**用户自己的机器**上找；
找不到就如实报"未安装"，宿主拒绝就报"被宿主拒绝"。插件自带的是**自己写的分析引擎（TypeScript）**和
**随包知识（309 篇文档 + 9 个技能）**，不是第三方逆向工具链。

上游 2.0 正好相反：**第三方工具链整包塞进安装包**（`resources/seep-kit` 310 MB / 4502 文件，含 Windows
radare2 全套 14 个 exe、jadx 1.5.6、apktool.jar、nmap），再由 PowerShell 部署脚本一次性铺到机器上。

一句话：**上游是"把工具装进产品"，本插件是"把产品装进工具"**——插件不改变用户机器上的任何东西。

---

## 2. 「自带」分三层看，混淆这三层是误判的根源

| 层 | 含义 | 上游 2.0 | 本插件 2.8.0 |
|---|---|---|---|
| A. 引擎二进制 | 第三方可执行文件（r2 / jadx / apktool / nmap …） | **自带**，310 MB 随包 | **零**，一个都不带 |
| B. 随包脚本 | 仓库自带的 `.py` / `.ps1` / `.sh` 辅助脚本 | 自带（`setup/` 15 个脚本 + `Tool/scripts`） | 自带（包内 50 个 `.py`、7 个 `.ps1`、7 个 `.sh`，均在技能目录下） |
| C. 随包知识 | 手册、清单、案例、技能 | 自带（`MANUAL` 10 篇、`Tool/docs` 8 份、`Tool/skill` 5 套、`Tool/cases` 14 个项目） | 自带（309 篇文档、9 个技能、`agent/prompts/skill-library.sha256`） |

只有 A 层是"自带工具链"的争议点。**B、C 两层两边都自带**，但 B 层脚本自身仍要靠用户机器上的
python / bash / PowerShell 才能跑——它带的是"脚本"，不是"解释器"。

---

## 3. 对照 A：随包制品

### 3.1 上游 2.0 实际带进来的东西（实测体积）

| 制品 | 位置（相对 `resources/seep-kit/`） | 体积 | 性质 |
|---|---|---|---|
| radare2 Windows 构建 | `Tool/mcp/Tool/safe/radare2/` | 38 MB，**14 个 `.exe`**（radare2 / rabin2 / radiff2 / rasm2 / rahash2 / rax2 / rafind2 / ragg2 / rarun2 / rasign2 / ravc2 / r2r / r2pm / r2agent） | 引擎 |
| jadx | `Tool/mcp/Tool/safe/jadx/` | 75 MB，`lib/jadx-1.5.6-all.jar`（74.6 MB）+ `bin/jadx(.bat)` | 引擎（jar） |
| apktool | `Tool/mcp/Tool/safe/apktool/` | 23 MB，`apktool.jar`（23.3 MB）+ `apktool.bat` | 引擎（jar） |
| ida-pro-mcp | `Tool/mcp/Tool/safe/ida-pro-mcp/` | 27 MB，含 `venv.zip`（21 MB） | Python 环境快照 |
| js-reverse-mcp | `Tool/mcp/Tool/safe/js-reverse-mcp/` | 53 MB，含 `node_modules.zip`（52.3 MB） | Node 依赖快照 |
| playwright-mcp | `Tool/mcp/Tool/safe/playwright-mcp/` | 8.7 MB，含 `node_modules.zip`（8.5 MB） | Node 依赖快照 |
| nmap | `Tool/upstream/open-tgtylab/tools/windows/nmap/` | `nmap.exe` / `nping.exe` / `ncat.exe` / `npcap-1.50.exe` / `VC_redist.x86.exe` | 引擎（另装驱动） |
| 脱敏案例 | `Tool/cases/` | 14 个项目，含编译产物 `.dll` / `.jar` | 样本（不是引擎） |

合计：`du -sh` = **310 MB**，`find -type f | wc -l` = **4502**；全树 `.exe` 计数 **19**。

**仍然不自带**（`find` 逐名未命中）：`adb`、`apksigner`、`zipalign`、`frida`、`node`、`npm`、`python`、`java`。
即上游也要用户机器上先有 Python（跑 MCP server）、Node（跑 `npx`）、Java（跑 jadx / apktool）。

### 3.2 本插件实际带进来的东西

| 制品 | 位置 | 数量 | 性质 |
|---|---|---|---|
| 可执行 / 压缩制品 | 全包 | **0**（`.exe` / `.jar` / `.so` / `.dll` / `.zip` 全为 0） | — |
| 自身分析引擎 | `dist/assets/*.js`（5.5 MB） | TypeScript 编译产物 | 自带引擎（不是第三方工具） |
| 技能脚本 | `agent/skills/**` | 50 `.py` / 7 `.ps1` / 7 `.sh` | 脚本，需用户解释器 |
| 签名材料 | `agent/skills/apk-reverse/debug.keystore` | 1 | 演示用自签材料 |
| 知识库 | `src/content/docs/index.json` | 309 篇（`kb` 292 / `kit-docs` 7 / `manual` 10） | 文档 |

制品实测：`release/hanshuang-pojia-2.8.0.astraviapkg` = **7.67 MB / 519 条目**（本地构建产物，按仓库规则不入库）。
同一个 `unzip -l` 里 `.exe|.jar|.so|.dylib|.dll|.zip` 命中数为 **0**。

代码里的自陈（可作权威证据）：

- `src/domain/toolchain/catalog.ts:1-6` — “**Nothing here is bundled with the plugin: every entry names a tool the user installs.**”
- `README.md:3` — “the package bundles no engine: radare2, jadx and apktool are borrowed from the machine, and only when they are already there.”

---

## 4. 对照 B：运行时怎么把工具拿到手

| 维度 | 上游 2.0 | 本插件 2.8.0 |
|---|---|---|
| 调用主体 | 自带的 Python MCP server（`Tool/mcp/seep_mcp_server.py`，23 个 `@server.tool()`） | 宿主进程（`ctx.command.run`，`execFile` 语义） |
| 工具定位顺序 | **先内置，后 PATH**：`seep_mcp_server.py:33-44` 先找 `Tool/mcp/Tool/safe/<tool>`，找不到再 `shutil.which()`；`:71-72` 把 `safe/radare2/bin` 前置进 `PATH`；`:173` java 用 `shutil.which()` | **只有 PATH**：`src/features/workbench/services/toolchain.ts:20-29` 把调用转给 `ctx.command.run`，没有"内置优先"这一层 |
| 声明形态 | `.mcp.json`：`seep` → `command: "python"`，`args: ["Tool/mcp/seep_mcp_server.py"]`；`js-reverse` → `command: "npx"`, `args: ["-y","js-reverse-mcp"]` | `plugin.json#commands` 14 条（r2 / rabin2 / radiff2 / rasm2 / rahash2 / rax2 / jadx / apktool / java / adb / apksigner / zipalign / frida / frida-ps），与 `catalog.ts#COMMANDS` 逐字节一致（`src/test/toolchain.test.ts`） |
| 真起进程的工具数 | 23 个 MCP 工具共享一个 Python 进程 | **4 个**：`probe_environment` / `install_toolchain` / `run_radare` / `decompile_android`（穷举 `src/tools/*.ts` 中引用 `createCommandRunner` 的文件） |
| 缺工具时的行为 | `seep_status` 报 `Missing` + 该探的路径（`seep_mcp_server.py:217-241`） | `probe_environment` 把“宿主拒绝”与“未安装”分开报（`BLOCKED_PATTERN` vs `NOT_FOUND_PATTERN`，`probe.ts:50-52`）；未找到时报 `install_toolchain` 引导安装（`services/toolchain.ts` 的 `describeCommandFailure`），不再只问“缺了什么”
| 无权限时 | 不适用（没有权限模型） | `createCommandRunner` 返回 `null`，不抛错，工具输出"本实例无外部命令通道"（`services/toolchain.ts:21-23`、`src/tools/install-toolchain.ts:57`） |

---

## 5. 对照 C：安装 / 部署动作

| 维度 | 上游 2.0 | 本插件 2.8.0 |
|---|---|---|
| 触发 | 面板按钮 → IPC `seep:install` → `runPowerShell(["-File", install.ps1, "-NonInteractive"])`（`electron/main.cjs:514-521`） | 无部署步骤。`install_toolchain` 返回命令并由 Agent 经宿主对话逐条执行、逐条报进度（`src/tools/install-toolchain.ts`）；面板自检页有「经对话一键安装缺失工具」入口（`selfcheck.tsx` 触发 `install` prompt 动作） |
| 装什么 | 解压 `node_modules.zip` / `venv.zip`（`setup/extract-deps.ps1`）+ `python -m pip install` 协议依赖（`setup/install-python.ps1:34`，走清华镜像）+ 写各宿主 `mcp.json`（`setup/generate-configs.ps1:21,37`） | 系统包管理器命令，由**用户或用户自己的 agent** 执行：brew / apt / winget / scoop / pipx，按 `goal` 过滤、按平台取 recipe |
| 装到哪 | 包内 `Tool/mcp/Tool/safe/`（就地解压）+ `~/.pi/agent`（配置）；`seepState()` 以 `~/.pi/agent/mcp.json` 是否含 `"seep"` 判定已部署（`electron/main.cjs:188-204`） | 系统装到哪就哪，插件不知道也不关心 |
| 网络 | 需要：`pip install` 走镜像；`npx -y js-reverse-mcp` 首次运行要联网 | 插件**零网络**；命令由用户自己跑，走用户自己的网络与镜像 |
| 可分步/可审计 | 脚本内部写死，`-Force` 才重下（`setup/repair-tools.ps1`） | 每条命令在对话里可见，用户逐条同意后由 agent 执行 |
| 卸载 | `seep:uninstall` → `uninstall.ps1 -Yes`（`main.cjs:523-529`） | 不需要卸载：插件从未在你的机器上放东西 |
| 自检 | `seep:verify` → `verify.ps1 -Detailed`，四栏看板（`main.cjs:533-539`；`setup/verify.ps1:149-175` 检查架构/版本等） | `probe_environment` 每个工具跑一次 `--version`，缓存 60 s（`services/toolchain.ts:16, 36-42`） |

---

## 6. 对照 D：运行时依赖与离线可用性

| 依赖 | 上游 2.0 | 本插件 2.8.0 |
|---|---|---|
| 自带引擎可用性 | 离线可用（二进制随包），但 jadx / apktool 仍需用户 Java | 不存在"自带引擎"，故无此问题 |
| Python | **需要**用户安装（MCP server 是 Python 写的；`install.ps1:54` 检测失败即记 `$script:Failed += 'Python'`，`:112` 汇总报错） | 建议项（`COMPANIONS` 里的 python3），只在安装计划里出现，插件从不 spawn |
| Node | **需要**（`npx -y js-reverse-mcp`） | 建议项，同样不 spawn |
| Java | **需要，但从不检查**：jadx / apktool 的 jar 都要 JRE，而 `setup/verify.ps1` 全文 `grep -i java` **零命中**（9 组自检无这一项）；`jadx/bin/jadx.bat:22-33` 到运行期才报 `ERROR: JAVA_HOME is not set…`，`apktool.bat` 只有一行 `java -jar "%~dp0apktool.jar" %*` | 已声明（`java` 在 commands 里），由 `probe_environment` 实跑 `java -version`；缺 JRE 时报 `exited with 1`，不当成"可用"（`probe.ts:66-90`） |
| PowerShell | **需要**（所有部署/自检脚本都是 `.ps1`） | 不需要 |
| Windows | 事实上的唯一目标（内置 `.exe` / `.bat`；POSIX 侧只有 `.sh` 脚本） | 三平台 recipe（`catalog.ts` 中 darwin / linux / windows 各 17 处 recipe 字段） |
| 插件的自我运行 | — | 无外部依赖：分析引擎是内置 TypeScript，`dist/` 里没有任何运行时 npm 依赖 |

---

## 7. 对照 E：权限与安全边界

| 维度 | 上游 2.0 | 本插件 2.8.0 |
|---|---|---|
| 权限模型 | 无细粒度授权：面板点一下就用 `runPowerShell` 跑脚本；MCP 的 `seep_r2_cmd` 直接把用户字符串拼进 `r2 -c`（零限制） | 双层：`plugin.json#commands` 静态白名单 + `agent.command.run` 用户授权；`run_radare` 的 `cmd` 对等上游零限制直通（2.9.0 反转 D16 只读守卫），保持参数数组完整、不走 shell |
| 安装权限 | 部署脚本要管理员/UAC | 插件**零**安装权限：不持有 brew / apt / winget / pipx（`install-toolchain.ts:30`）。安装命令由 Agent 经宿主对话执行，宿主按其授权门逐条放行，管理员提权由宿主负责询问——这既是权限收紧（插件无权直装），也和上游“面板点一下即装”对等（用户仍只需一次确认） |
| 样本执行 | 工具链本身可以运行样本（r2 debug、frida、IDA） | 从不执行样本；样本只经宿主 `fs` 读取（≤32 MiB） |
| 补丁/重签 | 上游带 `Tool/cases` 与 PoC 脚手架，鼓励落地 | `init_task` 不建 `patches/`（ADR 0002 D17）；`write_assessment_report` 不引用 `patches/`（D19） |
| 网络 | 需要（pip / npx / 重下工具） | 插件零网络；IDA 常驻会话（`127.0.0.1:13337`）明确不移植（ADR 0002 :81） |

---

## 8. 对照 F：元数据、版本与体积

| 维度 | 上游 2.0 | 本插件 2.8.0 |
|---|---|---|
| 版本锚点 | `resources/seep-kit/VERSION` = `1.6.0`；App 版本 4.5.0（`asar` 内 `package.json`） | `plugin.json` / `package.json` / `package-lock.json` / `ability.json` / `.astravia/marketplace.source.json` 五处同版本；市场制品不可覆盖，改动即提升版本 |
| 升级方式 | 换便携包，或用 `setup/update.ps1` 覆盖 `resources/` | 市场内升级插件包；外部工具的升级**不归插件管**（由用户的包管理器负责） |
| 分发体积 | 整包 **618 MB**（`resources/` 350 MB，其中 `seep-kit` 310 MB；Electron 本体 `寒霜破甲工具.exe` 188 MB + `app.asar` 41.7 MB 不属工具链） | `.astraviapkg` 7.67 MB |
| 工具元数据来源 | `Tool/docs/tool-index.json`（42 项）+ `repair-tools.ps1` 的下载表 | `src/domain/toolchain/catalog.ts`：`TOOLCHAIN` 14 项（进 commands）+ `COMPANIONS` 11 项（零权限，只出现在计划里） |

> 注：ADR 0001 D8 写作时的声明是 8 个可执行文件，2.5.0 起扩到 14 个，以 ADR 0003 §4 与 `catalog.ts` 为准。

---

## 9. 为什么不做成"自带"

四条理由（详见 ADR 0003 §2，逐条都能单独否决）：

1. `plugin.json#commands` 是**静态白名单**。要自带安装能力就得声明 `brew` / `apt-get` / `winget` / `pipx` / `scoop`
   各一个授权位——五个"什么都能干"的权限换一个"装个 jadx"，权限面换得不划算。
2. 安装**需要交互**：`sudo` 要密码、winget 要 UAC；`ctx.command.run` 无 shell、无 TTY，跑到超时就挂。
3. 平台差异无法统一：同一个 jadx 在三个平台是三个包名、三种命令、三种失败形态。
4. 自动安装**不可审计**：用户看不到装了什么、从哪来。

另外，插件也不具备承载 310 MB 二进制的分发条件（`.astraviapkg` 是市场制品，不是安装器）。

---

## 10. 证据清单（可复现）

上游：

```
find /Users/zhugeyue/Desktop/tmp/hanshuang-pojia-2.0/resources/seep-kit -type f \( -iname '*.exe' -o -iname '*.jar' -o -iname '*.zip' \) | wc -l
du -sh .../resources/seep-kit                      # 310M
cat  .../resources/seep-kit/.mcp.json              # python / npx
sed -n '33,72p;170,245p' .../Tool/mcp/seep_mcp_server.py
sed -n '148,200p;515,537p' /Users/zhugeyue/Desktop/tmp/asar-extract/electron/main.cjs
```

插件：

```
node -e 'const j=require("./plugin.json");console.log(j.version, j.commands.length)'   # 2.8.0 14
unzip -l release/hanshuang-pojia-2.8.0.astraviapkg | grep -ciE '\.(exe|jar|so|dylib|dll|zip)$'   # 0
grep -rl "createCommandRunner" src/tools                                               # 4 个文件
node -e 'console.log(require("./src/content/docs/index.json").length)'                  # 309
```

---

## 11. 残余风险与未验证

- **宿主的 PATH 解析语义未在真实宿主内实测**：`ctx.command.run` 由宿主进程 spawn，本文件只验证到"插件不内置、
  一律交宿主"这一层。宿主是否使用受限 PATH、是否限定 cwd，需以宿主实现为准。
- **本机缺 r2 / rabin2 / radiff2 / rasm2 / jadx / apktool**（`frida 17.24.1` 可用），故"借用用户二进制"的
  端到端行为只在"探针判定 + 参数构造"层验证（同 ADR 0002 §5）。
- **上游依赖的版本敏感信息未核**：`.mcp.json` 用裸 `python`，实际取到哪个解释器由用户 PATH 决定；`npx -y`
  每次可能取到不同上游版本。这是上游的既存风险，本插件不复制这种做法。
- 上游体积/条目数取自当前解包目录，若上游换版需重测。
- **本文件只引上游脚本行为，不引上游 `MANUAL/PREREQUISITES.md`**：该文件 :44-52 让用户「若 `install-tools.ps1` 失败就手动下载」，
  但 `setup/` 里**没有这个文件**（实际是 `repair-tools.ps1`，且 `install.ps1` 从不调用它，只在 :85 提一句提示），
  包内工具也早已内置、正常部署链一行都不下载。引用该 md 会把上游的文档缺陷当成事实。

---

## 12. 一句话交付

| 问题 | 答案 |
|---|---|
| 插件激活后自带工具链吗？ | **不带**。零可执行制品；14 个名字只是声明，靠用户的机器提供二进制 |
| 上游带吗？ | **带**。310 MB 内置 radare2 / jadx / apktool / nmap + 依赖快照 |
| 那插件靠什么工作？ | 自带 TypeScript 分析引擎 + 309 篇随包文档 + 9 个技能；需要外部工具时**借用**，缺了就如实说缺 |
| 缺工具怎么办？ | 面板自检页「经对话一键安装」→ 触发 `install` prompt → Agent 调 `install_toolchain` 拿命令 → 经宿主对话逐条执行并报进度 → `probe_environment` 再探一次复核；也可单独问对话里的 Agent 让它跑完整流程 |
| 代价换到哪了？ | 上游用体积换免安装（整包 618 MB，且 Python 缺失即部署失败、Java 零检测）；本插件用用户自装换体积（制品 7.67 MB，缺什么当场报） |
