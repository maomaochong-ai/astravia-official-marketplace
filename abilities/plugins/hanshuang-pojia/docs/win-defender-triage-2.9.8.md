# Windows Defender 报毒的定性排查（2.9.8）

用户反馈的四个类别：`已阻止威胁` / `持久化与回连通道审计程序` / `提供远程访问` / `受影响的项目`。

先说口径：本机是 macOS，**无法复现 Defender 判定**（NOT RUN）。下面区分三样东西——
包里到底有哪几类字节（Observed）、它们与上述类别在形状上的对应关系（Inferred）、
以及本轮因此改了什么（Observed，带度量）。

## 一、2.9.6 已经解决的那一层

`docs.ts` 曾用 `import.meta.glob("**/*.md", { query: "?raw" })` 把 309 篇工具链文档编译成
324 个 JS 分块。那是"一个包里有三百多个可执行脚本、且每个脚本都在讲攻击工具链"的形状，
被按工具集样本处理是合理的。2.9.6 起文档改为纯文本静态资源（`dist/assets/docs/*.md`），
JS 分块降到 14 个。

## 二、本轮修掉的三处（Observed）

### 1. 包根的 `package-lock.json` / 清单被嵌进可执行 bundle

`src/features/workbench/services/docs.ts` 的 Node 分支写的是
`new URL(\`../../../../${path}\`, import.meta.url)`。Vite 会把这种带静态前缀的模板字面量
静态分析成"遍目录根的资源映射"，于是 `CONTEXT.md`、`README*.md`、`USAGE*.md`、`ability.json`、
`detail*.json`、`plugin.json`、`package.json`、**`package-lock.json`**、`tsconfig.json`、
`vite.config.ts` 全部以 base64 data URI 编进主 bundle，`package-lock.json` 另有一份 106 KB 的
独立资源落在 `dist/assets/`。

一个"内含锁文件与包清单、又能被解释执行"的 JS 文件是典型的 loader 形状。改成二元表达式拼接
（`root + path`）后 Vite 不再做静态分析：

| 指标 | 改前 | 改后 |
| --- | --- | --- |
| 主 chunk | `index-BLVsQs7m.js` 720,644 B | `index-Brwgwo-M.js` 570,100 B（−150,544 B / −20.9%） |
| `dist/assets/package-lock-*.json` | 有（106,089 B） | 无 |
| bundle 内 `package-lock` 引用 | 1 处 | 0 处 |
| `.astraviapkg` 条目 | 514 | 513 |

### 2. `ida-reverse/scripts/start.ps1` 的隐蔽后台启动

原来两行是 Windows 上最典型的启动器形状：

```powershell
taskkill /F /T /PID $old.Id
Start-Process -WindowStyle Hidden -FilePath $ServerPath -ArgumentList "--host 127.0.0.1 --port $Port"
```

隐藏窗口 + 强杀进程树 + 本地监听端口，三件事凑在一个 `.ps1` 里。改为
`Stop-Process -Force`、`-WindowStyle Minimized`、stdout/stderr 重定向到
`%TEMP%\idalib-mcp\*.log`。功能不变（依旧是后台起服务、等就绪再返回），行为可见。
`agent/skills/ida-reverse/SKILL.md` 里描述该脚本的那句一并同步。

### 3. `apkseep/scripts/usb_net_proxy.py` 绑 0.0.0.0

`adb reverse` 是从**主机回环**接入的，绑 `0.0.0.0` 只把代理顺手暴露给局域网，没有任何可用性收益。
改为只绑 `127.0.0.1`。既去掉"监听所有网卡"的信号，也顺手补了一个真实暴露面。

## 三、仍然在包里、且形状上对得上的东西（Observed）

| 类别 | 包内证据 | 处置 |
| --- | --- | --- |
| 提供远程访问 | `usb_net_proxy.py` 是 HTTP/HTTPS 转发代理（含 CONNECT）；`frida_rpc_serve.py` 起本地 RPC 端口；`plugin.json` 声明 `adb` / `frida` / `frida-ps` 三个命令 | 代理已收敛到回环；其余为审计流程必需 |
| 持久化与回连通道 | 7 个 `.ps1`、7 个 `.sh`、50 个 `.py`、5 个 `.mjs`、14 个 `.js` 以**可执行文件**形式随包（`agent/skills/**/scripts/`） | 未改，见下方选项 B |
| 已阻止威胁 | 同上的组合 + `permissions` 里 `agent.command.run` / `network.fetch` | 权限本身是能力声明，不属于可删项 |

`agent/skills/hanshuang-pojia/SKILL.md` 里有一行 `schtasks /query /fo LIST | findstr /i "task"`
——那是**排查目标机器持久化项**的知识库条目，是文本不是可执行脚本，保留。

## 四、还能怎么做（需要用户拍板，因为都动交付形态）

| 选项 | 做法 | 成本 | 风险 |
| --- | --- | --- | --- |
| A（当前） | 保留脚本文件，只做上面三处收敛 | 0 | Defender 仍可能因为 64 个脚本文件整体判定 |
| B | 把 `agent/skills/**/scripts/` 全部转成 `.md` 里的代码块，agent 用自身 shell 跑 | 需改 9 个技能文档里对脚本路径的引用；包内脚本文件数归零 | 从"直接执行脚本"退化为"读文档再敲命令"，长流程更慢 |
| C | 按平台拆分发行：Windows 包不带 `.sh`，非 Windows 包不带 `.ps1` | 需要在 `vite.config.ts` 与发布脚本里加平台裁剪 | 与"一个 slug 一份制品"的发布约定冲突，需先确认市场侧是否接受 |

本轮不做 B / C：两者都会改变能力交付方式，且无法在本机验证是否真的降误报（Defender 不在 macOS 上）。
真要做，应该先拿到 2.9.8 在 Windows 上的实测结果，确认是"文件类型整体判定"还是"某个具体文件命中"。

## 五、验证清单

- `npx tsc --noEmit` 干净；`src/test/workbench.test.tsx` 27/27（文档正文读取走的就是这条路）。
- 重建后确认 `dist/assets/` 里不再有 `package-lock-*.json`，主 chunk 从 720 KB 降到 570 KB。
- `python3 -m py_compile usb_net_proxy.py` 通过（仅语法层，未在真机跑代理）。
- **NOT RUN**：Windows Defender 实际判定；`start.ps1` 在装了 IDA 的 Windows 上的真实启动。
