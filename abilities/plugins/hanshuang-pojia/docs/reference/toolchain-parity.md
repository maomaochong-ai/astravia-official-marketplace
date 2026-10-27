# 工具链对照表：2.0 便携版 → 插件 2.5.0

参照对象：`hanshuang-pojia-2.0` 便携版内置的 `seep-kit/Tool/docs/tool-index.json`（42 项，`VERSION 1.6.0`）。

三档状态，含义固定：

- **探测**：写进 `plugin.json#commands`，插件对它跑 `--version` 并按结果驱动功能。占一个用户授权位。
- **建议**：只出现在 `install_toolchain` 的安装计划里，插件从不 spawn，零权限。
- **不做**：本插件没有对应能力，写清原因，避免下一次重新讨论。

| # | 2.0 工具 | 2.0 分组 | 本插件状态 | 说明 |
|---|---|---|---|---|
| 1 | r2 | radare2 | 探测 | 主分析器 |
| 2 | rabin2 | radare2 | 探测 | 二进制侦察 |
| 3 | rasm2 | radare2 | 探测 | 汇编 / 反汇编 |
| 4 | radiff2 | radare2 | 探测 | 二进制差分 |
| 5 | rahash2 | radare2 | 探测 | 哈希、熵、字节模式 |
| 6 | rax2 | radare2 | 探测 | 进制转换 |
| 7 | jadx | apk-reverse | 探测 | Java 反编译 |
| 8 | apktool | apk-reverse | 探测 | 解包 / smali |
| 9 | java | apk-reverse | 探测 | jadx 与 apktool 的前置 |
| 10 | adb | apk-reverse | 探测 | 从设备拉 APK |
| 11 | apksigner | apk-reverse | 探测 | 签名校验 |
| 12 | zipalign | apk-reverse | 探测 | 对齐校验 |
| 13 | frida | apk-reverse | 探测 | 运行时注入 |
| 14 | frida-ps | apk-reverse | 探测 | 附着前枚举进程 |
| 15 | ida | ida-reverse | 建议（商业） | 有则用，无则走 radare2 |
| 16 | binaryninja | binary-ninja-reverse | 建议（商业） | 同上 |
| 17 | jeb-pro | apk-reverse | 建议（商业） | 同上 |
| 18 | analyzeHeadless | reverse-engineering | 建议 | Ghidra 无头，IDA 的免费替代 |
| 19 | python | reverse-engineering | 建议 | 辅助脚本解释器 |
| 20 | pip | reverse-engineering | 建议 | 装 frida-tools / binwalk |
| 21 | node | js-reverse | 建议 | Frida gadget 侧脚本 |
| 22 | binwalk | firmware-pentest | 建议 | 固件切分 |
| 23 | yara | malware-analysis | 建议 | 家族规则匹配 |
| 24 | nmap | pentest-tools | 建议 | 设备端口面 |
| 25 | pwntools | reverse-engineering | 建议 | CTF 利用开发 |
| 26 | idalib-mcp | ida-reverse | 不做 | MCP 服务，需在客户端注册；不是可执行文件 |
| 27 | ida-pro-mcp | ida-reverse | 不做 | 同上 |
| 28 | r2mcp | radare2 | 不做 | 同上 |
| 29 | r2xsql | radare2 | 不做 | r2 生态插件，装它要跑 `r2pm`，属另一个授权面 |
| 30 | r2xsql-full | radare2 | 不做 | 同上 |
| 31 | radius2 | radare2 | 不做 | 符号执行，同上 |
| 32 | r2pm | radare2 | 不做 | 包管理器；插件不代跑安装器（ADR 0003 §2） |
| 33 | jshookmcp | js-reverse | 不做 | MCP 服务 |
| 34 | reqable-mcp | pentest-tools | 不做 | MCP 服务 |
| 35 | xquik-mcp | threat-intelligence | 不做 | 远程 MCP + OAuth |
| 36 | pentestswarm | pentest-tools | 不做 | MCP 服务 |
| 37 | agent-browser | browser-automation | 不做 | 浏览器自动化，超出二进制审计范围 |
| 38 | playwright | browser-automation | 不做 | 同上 |
| 39 | proxycat | pentest-tools | 不做 | 代理池，本地审计用不到 |
| 40 | seclists | pentest-tools | 不做 | 字典集，属渗透任务不属于文件审计 |
| 41 | bkcrack | reverse-engineering | 不做 | 已知明文攻击，专用工具，需要时由用户自备 |
| 42 | npx | js-reverse | 不做 | 2.0 用 npx 起 MCP；插件不跑 MCP，故无需 |

## 覆盖结论

- **25 / 42 有对应位置**：14 项探测 + 11 项建议。2.0 的四个逆向分组（radare2、apk-reverse、ida-reverse、
  binary-ninja-reverse）里所有**可执行文件**都已覆盖或被明确标为商业/建议。
- **17 项不做**：13 项是 MCP 服务或 r2 生态插件（本插件通过自己的语义化工具直接做同一件事，不再套一层 MCP），
  4 项是浏览器 / 代理 / 字典类，不属文件审计。
- **能力上的实质差异只有一处**：2.0 内置离线二进制，装完即用；本插件不捆绑任何工具，靠 `install_toolchain`
  按目标给出平台命令，由 agent 在用户同意后执行（[ADR 0003](./adr/0003-toolchain-install-plan.md)）。
  该差异在分发形态、部署动作、离线依赖与权限边界上的逐项证据见 [自带工具链对照](./toolchain-bundling.md)。

## 与 2.0 的安装机制差异

| 维度 | 2.0 便携版 | 插件 2.5.0 |
|---|---|---|
| 触发 | 一次性 `install.ps1` 部署 | 对话中按 `goal` 按需 |
| 来源 | 包内 `Tool/mcp/Tool/safe/` 离线二进制，损坏时 `repair-tools.ps1` 从 GitHub Release 重下 | 系统包管理器（brew / apt / winget / scoop / pipx） |
| 网络 | 三个镜像回退（官方 → `ghproxy.net` → `gh-proxy.com`） | 走用户自己的网络与镜像配置 |
| 平台 | Windows 为主（`.ps1`），POSIX 侧有 `.sh` 版本 | 三平台 recipe 全覆盖 |
| 审计 | 脚本内写死，`-Force` 才重下 | 每条命令都在对话里可见，用户同意后才跑 |
| 权限 | 部署脚本本身要管理员 | 插件零安装权限，只有探测权限 |
