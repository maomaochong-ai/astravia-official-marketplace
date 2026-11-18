# ADR 0010：把「对话里能干的事」从 5 个动词扩到 10 个，靠的是客户端自己的本地状态

- **状态：** 已接受（修订 ADR 0008 的「密码必填」范围）
- **日期：** 2026-11-18
- **版本：** 插件 `todesk` 0.4.12；Astravia Desktop 0.5.97；ToDesk 4.8.8.4
- **前因：** 用户的问题——"对话里能干的事为什么这么少？能力太少，就没有理由用宿主 AI 去控制远程电脑。"

## 一、为什么之前能干的少：我们只用了命令行，没读客户端自己的状态

0.4.11 之前，插件 5 个工具全部落在 ToDesk 的**命令行**上：`-status`、`-control`、`-autostart`、`-exit`、无参启动。可是用户真正在 ToDesk 界面里做的事，命令行从来不覆盖：

| 用户手动做的事 | 0.4.11 之前 | 真实原因 |
| --- | --- | --- |
| "连我办公室那台" —— 从设备列表选一台 | ❌ 必须背 9 位设备码 | 设备列表在客户端本地 JSON 里，我们没有读 |
| 已存设备免密连接 | ❌ 每次都要对方临时密码 | 客户端为每台设备存了凭据（`PassEx`），我们没有用 |
| "哪台最常用 / 今天连了几次" | ❌ | `recentusage_*.json` 有按天计数，没有读 |
| "这台安不安全 / 为什么别人连不上" | ❌ | `config.ini` 里有无人值守密码、临时密码、2FA、陌生设备锁的开关位，没有读 |
| "我登的是哪个账号" | ❌ | `-user` 一直存在，只是没用 |
| "把窗口收进托盘" | ❌ | `-tray` 一直存在，只是没用 |

也就是说：**能力少不是因为 ToDesk 少，是因为我们只接了一条通道。** 命令行负责「动作」，客户端本地状态负责「上下文」；缺了上下文，Agent 只能说"给我九个数字"，那不叫控制。

## 二、取证（Observed，2026-11-18，本机 ToDesk 4.8.8.4）

### 2.1 命令行比我们以为的多

`ToDesk.exe -help` 原文参数表：

```
-help  -getid  -setpasswd <password>  -autostart  -user  -signout
-control  -setproxy  -proxy  -version  -status  -tray  -exit
```

`ToDesk.exe -help -control`：

```
Parameter:-id <device ID> -passwd <secure password>
Example : ToDesk -control -id 123456789 -passwd 123456
```

我们此前只用了其中 5 个。`-user`、`-tray` 是本轮直接采用的；其余见第四节「刻意不用」。

### 2.2 客户端本地状态（`%LOCALAPPDATA%\ToDesk\`）

```
devlist_<账号>.json      已存设备（每账号一份）
recentusage_<账号>.json  按天的连接计数
config.ini (Program Files) 客户端设置，含开关位与凭据派生值
Logs/*.xlog              WebRTC/ZRTC 二进制日志（不解析）
```

`devlist_*.json` 顶层为 `{ "DeviceInfo": [ … ] }`，每台设备的字段里与本决策相关的：

| 字段 | 用途 | 是否入库/入会话 |
| --- | --- | --- |
| `UserId` | 9 位设备码 | 是（公开标识） |
| `UserName` | 设备名（"Mac-B0L7Z7" 这种） | 是 |
| `RecentConnectTime` | 上次连接，epoch ms | 是 |
| `IsConnected` | 最近一次是否连通 | 是 |
| `PassEx` | **已存连接凭据**（24 位十六进制） | **只报「有/没有」** |
| `HostLogonPass` | 对方锁屏登录密码 | **只报「有/没有」** |

`recentusage_*.json` 形状：

```json
[{ "date": "20261118", "usageinfo": [{ "count": 3, "deviceid": "<9位>" }] }]
```

`config.ini` 中与本决策相关的键（值一律不返回，只转成布尔）：

| 键 | 含义 | 结论变量 |
| --- | --- | --- |
| `authPassEx` | 无人值守（安全）密码已设 → 非空 | `unattendedPasswordSet` |
| `isOpenTempPass` | 临时密码是否对外提供 | `tempPasswordEnabled` |
| `TfaForConn` | 连接二次验证 | `twoFactorForConnect` |
| `isStrangeConnectionLock` | 只允许已知设备连接 | `strangerConnectionLock` |
| `autoStart` | 开机自启 | `autostart` |
| `LoginType` / `LoginEmail` / `LoginPhone` | 账号类型与标识 | `accountType` / `accountHint`（掩码） |

**明确不进代码路径的**：`Token`、`NewToken`、`authPassEx` 与 `tempAuthPassEx` 的**值**、`PrivateData`。这几个键的存在说明这台机器能被连上，它们的值说明怎么被连上——后者不需要出现在任何会话、面板状态或剪贴板里。

### 2.3 插件拿不到环境变量，所以目录要自己找

插件 API 只有 `ctx.fs.readFile` / `readDir`（绝对路径），没有 home/env 查询。`%LOCALAPPDATA%` 因此靠列 `C:\Users` 逐个探 `AppData\Local\ToDesk`，优先选含 `devlist_*.json` 的那个。这也顺手解决了多账号机器（客户端按账号分文件）。

## 三、决定

### 3.1 工具面从 5 个扩到 10 个

| 工具 | 类型 | 回答什么 |
| --- | --- | --- |
| `todesk_status` | CLI | 本机码、版本、是否运行、是否自启 |
| `todesk_devices` | 本地状态 | 客户端记住的机器：名字↔设备码、上次连接、**是否已存凭据**；可按名字解析 |
| `todesk_connect` | CLI | 按 `device`（名字）或 `device_id`（9 位）发起；有已存凭据时**不需要密码** |
| `todesk_usage` | 本地状态 | 近 N 天每台设备的连接次数 |
| `todesk_posture` | 本地状态 | 无人值守密码有没有设、临时密码、2FA、陌生设备锁、自启、账号（掩码）+ 结论条目 |
| `todesk_account` | CLI | `-user`：当前登录账号 |
| `todesk_autostart` | CLI | `-autostart on/off` |
| `todesk_open_client` | CLI | 调出客户端窗口 |
| `todesk_tray` | CLI | `-tray`：收进托盘 |
| `todesk_disconnect` | CLI | `-exit` |

只读工具（`devices` / `usage` / `posture` / `status`）**不依赖命令授权**：宿主没给 `ToDesk.exe` 时它们照样能答，这正是排查"为什么连不上"时最需要的那部分。

### 3.2 密码策略的修订（改 ADR 0008 的适用范围）

ADR 0008 定的是「密码必填，设备码明文」。本轮把必填收窄为：

- 用 `device_id` 连**陌生设备** → 密码仍然必填（原规则不变）；
- 用 `device` 连**已存设备且 `saved_credential: true`** → 密码可省，由客户端用它自己存的凭据。

理由不是放宽安全，而是**减少暴露面**：原规则让用户把对方临时密码打进对话（进 transcript、进模型上下文、进日志）；已存凭据路径让这个密码根本不出现。密码从不被读取，也从不被存储——`PassEx` 只以布尔形式出现。

### 3.3 名字解析宁可失败，不许猜

`todesk_devices { query }` 与 `todesk_connect { device }` 的匹配顺序：精确设备码 → 精确设备名（忽略大小写）→ 唯一前缀。命中多台时返回 `candidates` 让用户选，**不挑一台连上去**——连错机器的代价远大于多问一句。

## 四、刻意不做，与原因

| 旗标 / 能力 | 为什么不做 |
| --- | --- |
| `-setpasswd <password>` | 写的是这台机器的无人值守密码，值会进进程命令行（任务管理器、审计日志可见）。而且验证它会真的改掉用户当前的远程访问凭据。给人留命令，不替人执行：`ToDesk.exe -setpasswd <新密码>`；界面里改是掩码输入，更合适。 |
| `-proxy` / `-setproxy` | 改的是客户端网络出口，属于系统级配置，不是"控制远程电脑"的场景需求。 |
| `-signout` | 会解绑账号并清掉设备列表语境；没有必须自动化的场景。 |
| 远端画面 / 远端点击输入 | 见 ADR 0009：没有窗口捕获权限、没有输入注入权限、客户端无流式接口。本轮不改变结论。 |
| 解析 `Logs/*.xlog` | 二进制 WebRTC 日志，格式未公开、每次升级会变；用它做"会话日志"会得到一个看起来很确定、实际会漂移的结论。`todesk_usage` 的按天计数是可验证的替代品。 |

## 五、应用场景（这是本决策真正的产出）

| 用户说 | 工具链 | 之前 |
| --- | --- | --- |
| "连我办公室那台" | `todesk_devices` → `todesk_connect { device }` | 让他背 9 位码，再要密码 |
| "我下班了，断开并收拾干净" | `todesk_disconnect` → `todesk_tray` | 只能断开 |
| "我这台电脑别人能连吗？安全吗？" | `todesk_posture` → 按 findings 给加固建议 | 完全不能答 |
| "我这边没人连得上，为什么？" | `todesk_posture`（无人值守密码 / 临时密码两个 warn）+ `todesk_status` | 只能说"去界面看看" |
| "把安全密码设复杂点" | 给命令 `ToDesk.exe -setpasswd <新密码>` + 面板掩码输入 | 无 |
| "我今天连了几次远程？" | `todesk_usage { days: 1 }` | 不能答 |
| "我最常连哪台？" | `todesk_usage { days: 30 }` | 不能答 |
| "这个客户端登的是谁的号？" | `todesk_account` | 不能答 |
| "先确认我登对账号，再连我那台" | `todesk_account` → `todesk_devices` → `todesk_connect` | 不能答 |
| "开机后还要能连进来" | `todesk_autostart { enabled: true }` → `todesk_status` 复核 | 已有 |
| "帮我把 ToDesk 窗口调出来读临时密码" | `todesk_open_client` | 已有 |

这一组场景的共同点：**Agent 先有上下文（哪台、什么状态、安不安全），再动手。** 5 个纯动作工具做不到这一点，10 个带上下文的可以。

## 六、代价与边界

- **设备列表是账号作用域的**：换了账号，`todesk_devices` 就会给出另一批机器；`todesk_account` 是唯一的交叉验证手段。
- **`devlist` 是快照**：客户端退出时写入，刚连过的设备可能要下次写入才可见。
- **`posture` 读的是设置文件，不是实时判定**：显示"无人值守密码已设"不代表服务端此刻可达（网络、服务端状态不在文件里）。
- **`usage` 是计数不是日志**：能证明"连过 N 次"，不能证明"连上了并出画"。
- **`saved_credential: true` 不等于一定能连上**：凭据可能过期，或对方换了临时密码。
- 面板多了 5 个能力开关（诊断面板折叠区），默认全开，显式 `false` 才关。

## 七、验证

| 项 | 结果 |
| --- | --- |
| `tsc --noEmit` | 0 |
| `vitest run` | **63 项通过**（新增 `device-store` 10 项、`usage-store` 6 项、`client-posture` 8 项；工具面从 5 断言改为 10） |
| 凭据不外泄 | 单元测试断言 `JSON.stringify(posture/describeDevice)` 不含 `PassEx` 值、不含真实手机号 |
| `node scripts/marketplace.mjs check` | 通过 |
| `node --test tests/*.test.mjs` | 166 通过 / 0 失败 |
| 构建 | `todesk-0.4.12.astraviapkg` |
