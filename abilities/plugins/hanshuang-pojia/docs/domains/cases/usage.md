# 案卷、先例与战例工程 · 怎么用

一次评估要能被复核：范围、时间线、证据、报告都在一个目录里。这一域还管两件事——
**找先例**（别人怎么打这一类）和**落骨架**（我要开工，目录先摆好）。

开发侧地图见 [dev.md](dev.md)。

## 一句话触发

```text
开个案卷，叫 com.example.app，样本在 /path/to/app.apk
有没有做过客户端鉴权旁路？给我最接近的打法
按 client-auth-gate 那个先例，把工具落到工作区
记一下：这条路径走不通，原因是证书校验在 native 层
出一份评估报告，目标写 app.example.com
```

## 四个工具各自的时机

| 时机 | 用它 | 你会拿到 |
| --- | --- | --- |
| 开工 | `init_task` | `samples/ exports/ reports/ evidence/ notes/` + `scope.md` / `timeline.md` / `README.md`，已有文件不覆盖 |
| 不知道从哪下手 | `search_cases` | 命中项给**路径与理由**（不是正文）+ 进度与证据计数；随包先例库也在内 |
| 要现成的打法脚本 | `scaffold_case` | 先例的 `tools/*.py` + 共享 `hpkit` 模块落到工作区；只写文件，不执行 |
| 要一份空工程 | `scaffold_case`（`project=A…N`） | 14 条原型的目录骨架：构建脚本、方法文档、证据门 |
| 做到一半做了选择 | `record_case_note` | 一条决策记录（implemented / rejected）+ 时间线一行 |

先例工具都支持 `--self-test`：**先自测，绿了再对真样本跑**。不跑自测就把输出当证据，是这一域最常见的错。

## 先例是方法，不是结论

随包 19 个先例包，每个四份文档：

```text
cases/<slug>/
├── README.md        # 这是什么问题、在哪个载体上出现过
├── scope.md         # 当时的范围记录（事实字段，不是开工条件）
├── docs/method.md   # 定位 → 观测 → 补丁 / 绕过 → 验证
└── docs/defense.md  # 防守侧：怎么让这个问题不存在、评审能查什么、残余风险
```

它们的作用是**缩短找定位点的时间**，不是替你判断目标。命中一个先例之后，仍然要：
用 `disassemble_range` / `decompile_function` / `decompile_android` 复核那条分支真的可达。

## 分寸

- **值得开案卷**：会产出多于一件交付物、需要隔天继续、或结论要给别人看。
- **不必开案卷**：一次性问答（「这个文件有没有壳」）。开完不用的目录只是噪音。
- **必须记 rejected 决策**：被否掉的路子最值钱——它挡住下一次重试。只记「做成了什么」的案卷，
  下一个人会把同样的死路再走一遍。

## 面板对应页

「案卷」页列当前工作区的案卷、事件时间线与证据计数；「先例」能从面板直接检索，
`scaffold` 的落盘计划也会显示将写入哪些文件（写之前可看）。

## 常见坑

| 现象 | 原因 | 怎么办 |
| --- | --- | --- |
| `init_task` 说没覆盖已有文件 | 设计如此：同目录第二次调用只补缺 | 要重开就换名字，别删已有记录 |
| `search_cases` 命中很多但都用不上 | 关键词给的是技术手段，不是目标形态 | 换成「缺陷类别 / 载体」（`client auth`、`android ssl`、`dotnet licence`） |
| `scaffold` 之后 `src/` 是空的 | 故意留空：目标特定产物在别的机器上跑不了 | 按 `docs/method.md` 自测通过后自己填 |
| 战例工程在非 Windows 上仍是 `.ps1` | 生成时平台判错 | 重新按当前平台生成；自检页 `assets.cases` 会盯这个数 |

## 相关的其他域

- 定位与取证用什么工具：[静态体检](../triage-and-disasm/usage.md)、[Android](../android/usage.md)。
- 报告怎么写、发布怎么走：[报告域](../reporting-and-release/usage.md)。
- 先例包怎么新增/修改：[案例语料契约](../../contract/case-corpus.md)、[案件契约](../../contract/case-library.md)。
