# Kali Linux

一个把 Kali Linux 装到用户自己机器上的技能：按操作系统自动部署，用一个命令行驱动，并用硬拦的护栏代替「靠自觉」。

## 它做什么

`scripts/kali.sh`（macOS / Linux）与 `scripts/kali.ps1`（Windows）包住一个 Kali 运行时，对外只有几个动作：

| 命令 | 作用 |
| --- | --- |
| `status` | 报告后端、就绪状态、镜像与 Kali 版本（`key=value`，恒定 exit 0） |
| `install` | 按当前系统部署 Kali；幂等，不会重复装 |
| `run "<命令>"` | 在 Kali 里跑一条命令，输出实时回传，带超时 |
| `script` | 从 stdin 读多行脚本执行 |
| `ensure <工具…>` | 用 apt 装工具，已装的跳过（`--profile headless` 装完整无头工具集） |
| `tools` | 查看关键工具的安装情况 |
| `stop` / `reset` | 停容器，或删容器 |

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

## 护栏

1. **私有网段之外的目标必须先拿到明确授权。** 非 loopback / RFC1918 / 链路本地的 IPv4 字面量，以及 `fc00::/7` 之外的 IPv6，一律以退出码 78 拒绝，直到用户明确说「这台我有权测」，并在命令里带上 `KALI_AUTHORIZED_HOSTS=<host>`。
2. **破坏性命令默认拦下** —— `rm -rf /`、`mkfs`、`dd of=/dev/…`、fork 炸弹、`wipefs`、`fdisk /dev/…`、`shutdown`/`reboot`、`curl … | sh`，除非显式设置 `KALI_ALLOW_DESTRUCTIVE=1`。
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
| `KALI_AUTHORIZED_HOSTS` | — | 用户已授权的目标，空格分隔 |
| `KALI_TARGET_AUTH` | `0` | 为 `1` 时对本次命令关闭目标检查 |
| `KALI_ALLOW_DESTRUCTIVE` | `0` | 为 `1` 时关闭破坏性命令黑名单 |

## 它明确不做的事

- **交互式工具**：没有 TTY，`msfconsole`、`sqlmap` 一律走批处理（`-x` 资源脚本、`--batch`）。写法见 [references/runbook.md](references/runbook.md)。
- **无线与 USB**：容器看不到这些设备；请用虚拟机，再让技能指向它。
- **偷装软件到用户自己的 Linux 发行版**：非 Kali 的 Linux 只走容器，不动系统包。
- **跨 `reset` 保留环境**：容器本来就可丢弃。

## 目录结构

```
ability.json          身份与详情页接线
SKILL.md              发给 Agent 的指令
detail.json           市场详情页（英文）
detail.zh.json        市场详情页（中文）
README.md             英文 README
README.zh.md          本文件
scripts/kali.sh       POSIX 驱动：docker / native / ssh 后端
scripts/kali.ps1      Windows 驱动：WSL2 后端
references/install.md 各系统安装、验证、排障、卸载
references/runbook.md 各类工具的非交互写法
references/safety.md  授权模型、黑名单、审计日志、法律提示
assets/               官方 Kali 龙图标
```

## 署名

卡片图标与对话图标由官方 Kali 龙形图栅格化而来，原图取自 <https://www.kali.org/images/kali-dragon-icon.svg>。Kali Linux 是 OffSec 的项目，该龙形标识归其所有，此处仅用于指代本技能所驱动的产品。详见 [NOTICE.md](NOTICE.md)。

技能自身的脚本与文档和市场其它部分一样采用 MIT 许可。
