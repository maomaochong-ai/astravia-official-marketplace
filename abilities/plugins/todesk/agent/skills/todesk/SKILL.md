---
name: todesk
description: Remote work through ToDesk from a conversation — check whether this computer is reachable before you leave, pick a saved machine by name and connect, verify the session actually came up, diagnose why the far side cannot get in, harden the access settings, and wrap up. Use when the user is about to travel, asks to reach another computer of theirs, asks for this machine's code, asks why a connection fails, asks whether remote access here is safe, or asks to hang up. Do NOT use for controlling this computer (that is the host's own shell and file tools) and do NOT promise to see or click inside the remote desktop: ToDesk renders it in its own window, which this plugin cannot read.
---

# ToDesk, driven from the conversation

Six jobs. Each one starts with the tool that answers the question, not with a verb.

## 1. 出门前自检 — "我回来还能连进来吗"

`todesk_readiness` → one verdict and a list, each item carrying the fix.

| verdict | 怎么说 |
| --- | --- |
| `ready` | 可以离开；外面连得进来，你也连得出去。 |
| `degraded` | 先读 items 里的 warn，逐条把 `fix` 给用户；其中 `autostart` 和 `temp-password` 是真正会让"回来连不上"的两条。 |
| `blocked` | 说清哪一条卡住，并给出 `fix`。不要自己动手改设置（见 §6）。 |

## 2. 选机器 — "连我办公室那台"

`todesk_devices`（不带 query）**一次**，按 `pinned` 优先、`last_connected_at` 倒序读。名字命中一台才继续；命中多台就把 `candidates` 读给用户选；一台都没有就请用户给 9 位码。

## 3. 连接并验证 — "连上了吗"

`todesk_connect { device }`（已存凭据时不需要密码）或 `{ device_id, password }`（陌生机器，**两个都要**）。

返回里的 `established` 是唯一可信的"连上了"：

| `established` | 能说的话 |
| --- | --- |
| `true` | 会话起来了（客户端设备行的连接时间推进了）。 |
| `false` | 命令被接受了，但设备行还没推进——可能仍在协商，让用户看 ToDesk 窗口。 |
| `unknown` | 没有本地设备行可比对，判断不了；不要宣称成功。 |

`ok: true` 只表示命令被接受，**永远不要**把它说成"已连接"。

## 4. 对方连不上我 — "为什么进不来"

`todesk_readiness` 先看有没有 `blocked`（客户端没运行 / 没设备码 / 两道门都关）。再 `todesk_posture` 拿逐条 findings；把 `fix` 原样转述，别自己发明设置路径。最常见的一对：没有安全密码 + 临时密码关着 = 无人值守时根本进不来。

## 5. 安全加固 — "要不要更安全点"

`todesk_posture` 的 `locked-down` 之外的每条都带 `fix`。按严重度说话：`stranger-devices-allowed` 和 `no-unattended-password` 先说，`no-autostart` 属于可用性不是安全。

## 6. 收尾与不代做的事

- 结束会话：`todesk_disconnect`（`-exit` 会关掉整个客户端），需要的话 `todesk_open_client` 拉回来，或 `todesk_tray` 收进托盘。
- `todesk_account`：先确认登的是哪个号——已存设备列表属于那个号。
- **不代跑** `-setpasswd`：写的是本机无人值守密码，值会进进程命令行。给命令：`ToDesk.exe -setpasswd <新密码>`，或界面 设置 → 安全 → 安全密码。
- **不改** `-proxy` / `-signout`：那是系统级或账号级动作，没有必须自动化的场景。

## 边界（说出来，不要绕）

命令行只有会话生命周期；鼠标、键盘、截图只存在于 ToDesk 自己的 MCP 通道，正常安装下关闭（ADR-0003/0005/0006/0009）。因此：

- 能**发起**和**结束**会话，不能**看**远端画面，不能**在远端操作**。
- 说"会话已交给 ToDesk，画面在它的窗口里"，不说"我连上并做了 X"。
- `IsConnected` / `RecentConnectTime` 是客户端写下的快照，只能当旁证，不能当实时状态。

## 失败话术

| 返回 | 意思 |
| --- | --- |
| `host_error: "…command disabled by user…"` | 宿主没授权 `ToDesk.exe`：设置 → 插件 → ToDesk → 命令 → 允许。 |
| `reason: "ToDesk control is switched off in the plugin panel"` | 用户在面板诊断里关了这个能力。 |
| `reason: "a temporary password is required"` | 该设备没有已存凭据；要对方机器上显示的临时密码。 |
| `reason: "more than one saved device matches"` | 读 `candidates` 让用户挑。 |
| `reason: "no ToDesk data directory under C:\\Users"` | 客户端从未在这台机器跑过，或用 `todesk_status` 兜底。 |
| `verdict: "blocked"` + `client-stopped` | 先 `todesk_open_client`，再复查。 |
