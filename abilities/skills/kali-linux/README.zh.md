# Kali Linux

一个把 Kali Linux 装到用户自己机器上的技能：按操作系统自动部署，用一个命令行驱动，用硬拦的护栏代替「靠自觉」，并带上一整套实战方法论——**16 个场景 playbook、14 份分类指南、270 份单工具参考**。

## 它做什么

`scripts/kali.sh`（macOS / Linux）与 `scripts/kali.ps1`（Windows）包住一个 Kali 运行时，对外只有九个动作：

| 命令 | 作用 |
| --- | --- |
| `status` | 报告后端、就绪状态、镜像与 Kali 版本（`key=value`，恒定 exit 0） |
| `doctor` | 同样的检查改成 `[PASS]`/`[WARN]`/`[FAIL]` 逐行输出，末尾给 `READY` 或 `NOT READY`（失败 exit 1）；不装、不启、不写审计 |
| `install` | 按当前系统部署 Kali；幂等，不会重复装 |
| `run "<命令>"` | 在 Kali 里跑一条命令，输出实时回传，带超时 |
| `script` | 从 stdin 读多行脚本执行 |
| `ensure <工具…>` | 用 apt 装工具，已装的跳过（`--profile headless` 装完整无头工具集） |
| `tools` | 查看关键工具的安装情况 |
| `stop` / `reset` | 停运行时，或销毁它（删容器 / 注销 WSL 发行版） |

**方法论部分。** `references/playbooks/` 每个场景一份工作流：内网、外部攻击面、Web、API、活动目录、口令审计、无线、云原生、移动应用、RFID/NFC、VoIP/ICS、后利用、取证应急、源码审计、内网协议、报告。每份都写明阶段、停止点、风险门与应交出的产物，并在发现新信号时交接给下一份。其下是 14 份分类指南（Golden Path + 决策树挑工具）与 270 份单工具参考（参数、示例、输出处理）。`references/environment/state-files.md` 定义九个状态文件，让跨会话的评估不再依赖聊天记忆。

四层阅读顺序写在 [SKILL.md](SKILL.md) 里：playbook 索引 → playbook → 分类指南 → 你即将跑的那一个工具文档。

后端由系统自动决定：

- **Windows** —— 官方 `kali-linux` WSL2 发行版（`wsl --install --distribution kali-linux`）。
- **macOS / 非 Kali 的 Linux** —— 官方 `kalilinux/kali-rolling` 容器；有 Homebrew 时会顺手把 colima 起起来。
- **本来就是 Kali** —— 直接在本机执行。
- **远端 Kali** —— 设 `KALI_SSH=user@host`，命令走 ssh（仅密钥登录）。

## 快速开始

```bash
sh scripts/kali.sh status            # 有没有现成的 Kali
sh scripts/kali.sh install           # 没有就装
sh scripts/kali.sh ensure nmap       # 只装这次任务要用的工具
sh scripts/kali.sh run "nmap -sV -Pn -oN /work/scan.txt 192.168.64.7"
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts\kali.ps1 status
powershell -ExecutionPolicy Bypass -File scripts\kali.ps1 install
```

`status` 随时可以调：它只读不写，什么都没装也照样 exit 0；缺哪一步，看 `hint=` 那一行。

## 安全姿态

1. **驱动不做目标分类，也不过滤命令。** 没有 exit 78 的门，也没有破坏性命令黑名单。范围和破坏性操作在写命令之前、靠着和用户的对话定下来；判断标准见 [references/safety.md](references/safety.md)。
2. **不隐含任何隔离。** 容器把写入限在 `/work` 和 apt 缓存卷；原生后端就是你自己的机器，在那里出错没有撤销。写破坏性命令之前，先说清自己在哪个后端。
3. **全部留痕** —— 每条命令带 UTC 时间戳、后端与退出码写进 `~/.astravia-kali/audit.log`。
4. **容器只看得到当前工作目录**（挂到 `/work`）和一份私有 apt 缓存；不上传任何数据。

动别人的系统之前，先读 [references/safety.md](references/safety.md)。

## 环境变量

| 变量 | 默认值 | 含义 |
| --- | --- | --- |
| `KALI_BACKEND` | 自动 | 强制 `docker` / `wsl` / `native` / `ssh` |
| `KALI_SSH` | — | ssh 后端的 `user@host` |
| `KALI_IMAGE` | `kalilinux/kali-rolling:latest` | 容器镜像 |
| `KALI_CONTAINER` | `astravia-kali` | 容器名 |
| `KALI_WORKDIR` | 当前目录 | 挂到 `/work` 的宿主机目录 |
| `KALI_STATE_DIR` | `~/.astravia-kali` | 审计日志与驱动状态 |
| `KALI_TIMEOUT` | `300` | 单条命令超时秒数 |

## 它明确不做的事

- **交互式工具**：没有 TTY，`msfconsole`、`sqlmap` 一律走批处理（`-x` 资源脚本、`--batch`）。写法见 [references/runbook.md](references/runbook.md)。
- **无线与 USB**：容器看不到这些设备；请用虚拟机，再让技能指向它。
- **偷装软件到用户自己的 Linux 发行版**：非 Kali 的 Linux 只走容器，不动系统包。
- **跨 `reset` 保留环境**：容器本来就可丢弃。

## 目录结构

```
ability.json            身份与详情页接线
SKILL.md                发给 Agent 的指令（四层阅读顺序）
detail.json             市场详情页（英文）
detail.zh.json          市场详情页（中文）
README.md               英文 README
README.zh.md            本文件
NOTICE.md               署名：Kali 图标与上游参考库
LICENSE-Apache-2.0.md   衍生参考库的许可证
scripts/kali.sh         POSIX 驱动：docker / native / ssh 后端
scripts/kali.ps1        Windows 驱动：WSL2 后端
references/install.md   各系统安装、验证、排障、卸载
references/runbook.md   各类工具的非交互写法
references/safety.md    为何不设技术门、各后端可触及范围、审计日志、法律提示
references/examples.md  四个完整问答范例（含越界目标那一例）
references/playbooks/   16 份场景工作流 + 决策树 + 交接图
references/environment/ 后端能力对照表、状态文件格式、上游环境笔记
references/<分类>/      14 份分类指南与 270 份单工具参考
assets/                 官方 Kali 龙图标
```

## 署名

卡片图标与对话图标由官方 Kali 龙形图栅格化而来，原图取自 <https://www.kali.org/images/kali-dragon-icon.svg>。Kali Linux 是 OffSec 的项目，该龙形标识归其所有，此处仅用于指代本技能所驱动的产品。详见 [NOTICE.md](NOTICE.md)。

playbook、分类指南与工具参考衍生自 Apache-2.0 许可的 [x-glacier/kali-pentest](https://github.com/x-glacier/kali-pentest) 项目，已改写为本技能的单命令执行模型；具体修改列在 [NOTICE.md](NOTICE.md)，许可证全文见 [LICENSE-Apache-2.0.md](LICENSE-Apache-2.0.md)。

技能自身的脚本与文档和市场其它部分一样采用 MIT 许可。
