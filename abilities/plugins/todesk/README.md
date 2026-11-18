# ToDesk Remote

用 ToDesk 从对话或面板里控制你自己名下的电脑：说一句设备名就能连，出门前一句话体检"回来还能连进来吗"，连不上时按官方故障库的顺序定位原因。

- **面板**：侧边栏页 + 对话右侧标签页（输入栏的 ToDesk 按钮打开），按"这台电脑 → 已存设备 → 手动连接 → 就绪体检"排列。
- **对话**：11 个 `todesk_*` 工具 + 一份配套技能，Agent 不需要用户点名技能也能用。
- **不依赖 MCP、不联网**：只走 ToDesk 官方命令行与客户端自己的本地状态。

## 安装

1. 能力 → 发现 → ToDesk → 安装（或在能力 → 我的 → `+` → 导入 `release/todesk-<version>.astraviapkg`）。
2. 批准弹窗里勾选**权限**与 **`ToDesk.exe` 命令**。
3. 装好后跑一次自检：

```powershell
node scripts/preflight.mjs          # 插件目录内；--json 可机读
```

```
就绪    |  todesk 0.4.15
客户端  |  C:\Program Files\ToDesk\ToDesk.exe  v4.8.8.4  运行中
本机码  |  <9位设备码>   开机自启 OFF
工具    |  todesk_status  todesk_readiness  todesk_devices  …（共 11 个）
```

## 装完还要过一次闸：宿主命令授权

宿主对 `plugin.json#commands` 的每条命令单独授权（`~/.astravia/plugins-manifest.json` 的 `grantedCommandNames`）。没授权时命令会被拒绝并原话返回：

```
Plugin todesk command disabled by user: ToDesk.exe
```

授权点：图形安装的批准弹窗，或「设置 → 插件 → ToDesk → 命令」。授权后覆盖安装不丢。

## 对话里能做什么

| 你说 | 工具 | 底层 |
| --- | --- | --- |
| 看下我的设备码 / 客户端状态 | `todesk_status` | `ToDesk.exe -status` |
| 我回来还能连进来吗 | `todesk_readiness` | 合成 verdict（ready / degraded / blocked）+ 逐条修法 |
| 连我办公室那台 | `todesk_devices` → `todesk_connect { device }` | 客户端设备列表 + `-control -id` |
| 连接 123 456 789，密码 … | `todesk_connect { device_id, password }` | `-control -id <code> -passwd <pwd>` |
| 连上了吗 | - | `established`：读客户端设备行是否推进；读不到答 `unknown` |
| 我今天连了几次 / 最常连哪台 | `todesk_usage` | `recentusage_*.json` 按天计数 |
| 这台安全吗 / 别人为什么进不来 | `todesk_posture` | `config.ini` 开关位（只报有无，不返回值） |
| 我登的是哪个账号 | `todesk_account` | `-user` |
| 开机后还要能连进来 | `todesk_autostart` | `-autostart on/off`，设完回读并核对是否生效 |
| 把 ToDesk 叫出来 / 收进托盘 | `todesk_open_client` / `todesk_tray` | `ToDesk.exe` / `-tray` |
| 断开 | `todesk_disconnect` | `-exit`（关客户端，随之结束所有会话） |

只读的五个工具（status / readiness / devices / usage / posture）**不需要命令授权**也能答——宿主拒绝 `ToDesk.exe` 时，它们正是排查"为什么连不上"的入口。

## 面板

| 区块 | 内容 |
| --- | --- |
| 这台电脑 | 设备码（明文、可复制、可刷新）、运行状态、开机自启开关、打开/收起客户端 |
| 已存设备 | 客户端记住的机器：名字、置顶/已存凭据标记、设备码、上次连接；有凭据的行一键直连，没有的把码填到下面一行 |
| 手动连接 | `[设备码] [临时密码] [连接]` 同一行；设备码明文，只有密码是掩码输入 |
| 就绪体检 | verdict + 逐条清单；修法给命令或界面路径 |
| 诊断（折叠） | 11 个能力开关、宿主命令授权状态、最近一条命令 |

除"连接"在设备码不足 9 位时禁用外，其余按钮默认都可点；能力开关默认全开，可逐项关掉。

## 连不上时：按官方故障库顺序问

`config.ini` 里没有这几项，插件读不到，只能逐条确认：

1. 被控是否勾了**允许控制本设备**（关闭时提示"该设备已关闭允许控制功能"）。
2. 被控是否开了**非同账号连接需本设备手动同意**（默认关；开启后停在"等待对方手动授权"）。
3. 被控是否设了**黑白名单**（提示"被控拒绝了连接请求"）。
4. 连上后被控是否**自动锁定**（安全设置里的"非同账号连接自动锁定客户端"）。

安全密码 / 临时密码 / 二次安全验证都在**高级设置 → 安全设置**。

## 边界（写清楚，不含糊）

- **画面在 ToDesk 自己的窗口里**。插件不镜像、不截图、不注入鼠标键盘；也不要声称"看到了远端画面"或"在远端点了按钮"。
- **没有单会话断开**：命令行只有 `-exit`（关客户端，实测 `-close` 无作用）。
- **不代设安全密码**：会让密码进入进程命令行。给命令：`ToDesk.exe -setpasswd <新密码>`，或界面里改。
- **会话内功能**（隐私屏、禁用被控端键鼠、传文件、远程打印、摄像头、多屏切换、画质/带宽）只有远程窗口的悬浮球里有，插件只指路。

## 权限

| 权限 | 用途 |
| --- | --- |
| `ui.slot.workspace-view` / `ui.slot.activity-tab` / `ui.slot.input-action` | 侧边栏页、对话标签页、输入栏按钮 |
| `agent.tools.register` / `agent.toolHandler.execute` | 11 个 `todesk_*` 工具 |
| `agent.skills.control` / `agent.systemPrompt.write` | 配套技能与每轮提示块 |
| `agent.command.run`（`commands: ["ToDesk.exe"]`） | `-status` / `-control` / `-autostart` / `-exit` / `-tray` / `-user` |
| `storage.read` / `storage.write` | 记住能力开关与最近一次探测结果 |
| `fs.read` | 读 `config.ini`、设备列表与使用计数 |
| `shell.openExternal` | 打开 ToDesk 下载页 |

## 开发

```bash
npm install
npm run check     # tsc --noEmit
npm test          # vitest
npm run build     # → release/todesk-<version>.astraviapkg
```

版本号按末位递增（0.4.14 → 0.4.15）。

`@astravia-org/plugin-sdk` 与 `plugin-vite` 不在公共 registry 上，本地安装时指向
`../../../.tooling/plugins/plugin-sdk` 所在目录（与其它插件一致）。

## 排错

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `disabled by user: ToDesk.exe` | 宿主未授权该命令 | 设置 → 插件 → ToDesk → 命令，允许后刷新 |
| 设备码显示 `—` | CLI 与 `config.ini` 都读不到 | 直接在 ToDesk 窗口里看 |
| 「读不到客户端保存的设备」 | 客户端被锁定，或数据目录不在默认位置 | 高级设置 → 显示设置 → 解锁客户端后复查 |
| 点「连接」客户端没反应 | 目标号不存在 / 未登录 / 通道被旧会话占用 | 确认对方在线；`todesk_readiness` 看是否还有标记为已连接的设备 |
| 连上后要密码 | 对方设了安全密码或临时密码 | 在客户端弹出的密码框里输入 |
| 自启设了没生效 | Windows「快速启动」会干扰 | 控制面板 → 电源选项 → 关闭快速启动后重启核对 |
