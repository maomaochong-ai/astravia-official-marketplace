# 模块：案卷、先例与 14 条战例工程

把「一次评估」变成可复核的目录：范围、时间线、证据、报告。工程的形状照上游
`Tool/cases/项目A…N` 的契约走，落地由插件自己的工具生成。

## 四个工具

| 工具 | 作用 | 关键约定 |
| --- | --- | --- |
| `init_task` | 建案卷目录（`samples/ exports/ reports/ evidence/ notes/` + `scope.md` / `timeline.md` / `README.md`） | 从未覆盖已有文件；声明写一次，`pending` 照写不判——没有任何字段挡住开工 |
| `search_cases` | 在本项目与随包先例里找先例 | 命中给的是路径与理由，不是正文；先例的 `scope.md` 恒为 `auth.status=pending` |
| `scaffold_case` | 落盘**先例工具**（`precedent=<slug>`）或**战例工程骨架**（`project=A…N`） | 只写文件，不执行、不读样本；已存在文件默认不覆盖并报告 |
| `record_case_note` | 记一次决策（implemented / rejected） | 被否决的路子最值钱：它挡住下一次重试 |

配套：`write_assessment_report` 产出四节报告（概要 / 判定点 / 验证证据 / 纵深防御）。

## 两种 scaffold 形态

**先例工具**：`cases/<slug>/tools/*.py` + `cases/_shared/hpkit/`（8 个模块，三系统同源）一起复制。
每个工具都支持 `--self-test`：不碰真样本也能跑，跑绿了再读目标。

**战例工程骨架**（2.14.0 新增）：

```text
<slug>/
├── README.md                     # 中英双语：内容清单、证据门、命令、回滚
├── build.ps1 | build.sh          # 按 OS 生成；只查工具、构建 src/、写 SHA256SUMS.txt
├── docs/reverse-engineering.md   # 定位 → 观测 → 补丁表 → 验证 → 未确认
├── docs/algorithm.md             # 输入输出 / 变换 / 常量 / 测试向量
├── docs/<按原型附加>.md          # 协议与补丁点、保护层、DLL 劫持、功能测试
├── src/README.md                 # **故意留空**：这里该写什么
└── tools/README.md               # 用 hpkit，先自测；不在这里放一次性 PowerShell
```

14 条原型（`src/domain/case-projects/catalog.ts`）：

| id | slug | 能力族 | 先例 |
| --- | --- | --- | --- |
| A | `auth-bypass-injection` | 注入式鉴权旁路 | `client-auth-gate` |
| B | `multiprocess-proxy-localisation` | 代理 DLL + 热补丁 | `multiprocess-proxy-hotpatch` |
| C | `binary-patch-runtime-licence` | 二进制补丁 + 运行时许可 | `cardkey-online-runtime-patch` |
| D | `numbered-script-pipeline` | 编号脚本流水线 | `aob-signature-cross-version` |
| E | `dotnet-activator-hosts-guard` | .NET 激活 + hosts 守卫 | `dotnet-license-keygen` |
| F | `prefs-writer-licence` | 偏好写入式许可 | `dotnet-license-keygen` |
| G | `python-activator-cli-gui` | Python 激活 CLI/GUI | `cardkey-online-runtime-patch` |
| H | `offline-keygen-package` | 离线 keygen + 向量 | `ed25519-offline-keygen` |
| I | `dotnet-patch-engine-rollback` | 补丁引擎 + 回滚 | `native-islicensed-patch` |
| J | `frida-dynamic-with-static-patch` | 动态观测 → 静态补丁 | `android-ssl-pin-bypass` |
| K | `installer-lifecycle-reset` | 安装 / 重置 / 卸载 | `cardkey-online-runtime-patch` |
| L | `native-hook-bridge` | 原生 hook + 导出桥 | `qt-proxy-dll-gateway` |
| M | `java-agent-dll-hijack` | Java agent + DLL 劫持 | `java-agent-dll-hijack` |
| N | `vm-protection-layer-recovery` | VM 保护三层恢复 | `themida-dotnet-delegate-recovery` |

## 为什么 `src/` 是空的

上游那 14 个目录里有 233 个目标特定产物（DLL、PNG、日志、截图），没有一件在别的机器上可执行。
把它们搬进来，得到的是「目录里有文件、审计脚本认不出、谁也跑不了」的死文件。所以骨架只带
**方法、证据门、构建脚本**，实现由操作者在自测通过之后自己填。

## 跨平台

`commands.ts` 按 `win32 | darwin | linux` 生成命令与构建脚本：Windows 用 `build.ps1` + `Get-FileHash`，
Linux/macOS 用 `build.sh` + `sha256sum`（darwin 回退 `shasum -a 256`）。硬约束三条：非 Windows 不出现
`powershell` / `.ps1` / `certutil`；不提权；不下载。`src/test/case/case-projects.test.ts` 逐条盯着。

## 代码入口

- `src/domain/case/{contract,journal,library,precedents,scaffold}.ts` — 案卷契约、事件日志、先例索引、落盘计划。
- `src/domain/case-projects/{catalog,commands,skeleton}.ts` — 14 条原型、命令生成、骨架渲染。
- `src/tools/case/*.ts` — 四个工具；`src/tools/lib/write-files.ts` 是两种形态共用的写文件层。

## 相关文档与测试

- 契约：[`../contract/case-library.md`](../../contract/case-library.md)、[`../contract/case-corpus.md`](../../contract/case-corpus.md)
- 测试：`src/test/case/{case-contract,case-journal,case-library,case-precedents,case-scaffold,case-tools,case-projects}.test.ts、src/test/report/assessment.test.ts`
- 技能侧：`agent/skills/softseep/`（判型与路由）、`agent/skills/hanshuang-pojia/`（五段交付）
