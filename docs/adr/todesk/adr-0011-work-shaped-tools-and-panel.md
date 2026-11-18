# ADR 0011：按「远程工作」而不是按「命令」组织工具与面板

- **状态：** 已接受（在 ADR 0010 之上，不推翻它）
- **日期：** 2026-11-18
- **版本：** 插件 `todesk` 0.4.13
- **前因：** ADR 0010 把工具从 5 个扩到 10 个，解决了"数据看不到"的问题。但用户提出的下一层问题是：**这些工具是否真的覆盖了"远程工作"这件事本身？** 工具按动词排列（status / devices / connect / usage / posture / …），而人在远程工作里想的是另外五件事。

## 一、把用户的话翻译成工作问题

| 用户真正在想 | 动词式工具面（0.4.12）能不能答 | 差距 |
| --- | --- | --- |
| "我要出门了，回来后还能连进来吗？" | 分散在 4 个工具里（status + posture + autostart + devices），要模型自己拼 | 没有给"结论 + 待办"的单一入口 |
| "连哪台？" | `todesk_devices` 能列 | 没有用客户端自己的**置顶**排序，列表总是按时间 |
| "连上了没有？" | `todesk_connect` 只报"命令已交给客户端" | 没有把"真的连上"与"交出去"分开 |
| "他们连不上我，卡在哪？" | `todesk_posture` 给 findings | findings 只说"有问题"，不说**怎么改** |
| "收尾" | `todesk_disconnect` + `todesk_tray` | 需要模型自己想到组合 |

这不是工具数量问题，是**组织方式**问题：动词面迫使模型在每一轮重新推导"这个场景该按什么顺序调用"。

## 二、本轮调研到的新证据（Observed，2026-11-18，ToDesk 4.8.8.4）

`devlist_*.json` 里还有两个我们没用的字段：

| 字段 | 值样本 | 用途 |
| --- | --- | --- |
| `IsPinned` | `"0"` / `"1"` | 客户端的**置顶设备**——用户自己排过序，比按时间排更贴近"我常用的那台" |
| `HostLogonPassState` | `"0"` | 是否为该设备存了锁屏登录密码（与 `HostLogonPass` 空/非空一致） |

`config.ini` 的四个开关位已被 ADR 0010 用上，本轮补的是**它们的处置动作**：

| 位 | 现在的说法 | 本轮要补的「怎么改」 |
| --- | --- | --- |
| `authPassEx` 空 | "没人值守时连不上" | 命令 `ToDesk.exe -setpasswd <新密码>`，或界面：设置 → 安全 → 临时密码/安全密码 |
| `isOpenTempPass=0` | "临时密码关着" | 界面：设置 → 安全 → 打开临时密码 |
| `TfaForConn=0` | "没有二次验证" | 界面：设置 → 安全 → 二次验证 |
| `isStrangeConnectionLock=0` | "陌生设备也能连" | 界面：设置 → 安全 → 仅允许受信任设备 |

同时确认两件**做不到**的事（避免 ADR 写进幻想）：

- **没有文件传输 / 剪贴板同步的接口**：`-help` 无相关旗标；`devlist` 里的 `Clipboard`、`LastLocalPath` 只是该设备的偏好字段，不是通道。
- **没有"会话中"的查询接口**：`-status` 不报会话；唯一可观测的是 `devlist` 的 `IsConnected` 与 `RecentConnectTime` 在连接后变化。它只能当"事后旁证"，不能当实时状态。

## 三、决定

### 3.1 新增合成工具 `todesk_readiness`（第 11 个）

一次调用回答"我现在能不能被连 / 我能不能连出去"，返回**结论 + 清单 + 每条的修法**：

```json
{
  "ok": true,
  "verdict": "degraded",            // ready | degraded | blocked
  "device_id": "<9位>",
  "client_running": true,
  "items": [
    { "code": "unattended-password", "state": "ok",   "detail": "…" },
    { "code": "autostart",           "state": "warn", "detail": "…", "fix": "ToDesk.exe -autostart on" },
    { "code": "temp-password",       "state": "warn", "detail": "…", "fix": "设置 → 安全 → 临时密码" }
  ]
}
```

判定规则（纯函数 `assessReadiness`，可测）：`blocked` = 客户端没运行 / 没设备码 / 无人值守密码未设且临时密码关闭（两条都关时别人根本连不上）；`degraded` = 有 warn；`ready` = 其余。

### 3.2 findings 必须带 `fix`

`todesk_posture` 的每条 finding 增加 `fix`：能给的给**可执行命令**，只能手点的给**界面路径**。模型照抄，不自行发明措辞。

### 3.3 置顶设备优先

`todesk_devices` 与面板的设备列表都按 `IsPinned` 优先、再按 `RecentConnectTime` 倒序。`pinned: true` 出现在返回里。

### 3.4 `todesk_connect` 报告"是否真的连上"，且允许说不知道

发起后有界轮询本地设备列表（≤3 次 × 400 ms），看该设备的 `IsConnected`/`RecentConnectTime` 是否推进：

| 观测 | `established` |
| --- | --- |
| 字段推进 | `true` |
| 没推进 | `false`（可能仍在协商，note 里说明） |
| 读不到本地列表 | `"unknown"` |

**绝不**用 `ok: true` 冒充"连上了"——`ok` 只表示命令被接受。这条是本轮对 ADR 0006「画面在 ToDesk 窗口」的延伸：连没连上也一样，只报观测到的。

### 3.5 技能从"调用顺序"改成"六个作业手册"

`SKILL.md` 重写为场景：出门自检 / 选机器 / 连接并验证 / 对方连不上我 / 安全加固 / 收尾。每个场景给工具链、判定分支、允许说的话与禁止说的话。

### 3.6 面板按同样六个作业重排

| 位置 | 卡片 | 对应作业 |
| --- | --- | --- |
| 1 | 本机（设备码 + 自启 + 打开/托盘） | 我是什么、别人怎么连我 |
| 2 | **已存设备**（置顶优先，一键连接 / 需密码则填入下方） | 连哪台 |
| 3 | 手动连接（设备码 + 临时密码同一行） | 陌生机器 |
| 4 | **就绪体检**（verdict + 清单 + 修法） | 出门前 / 排障 |
| 5 | 诊断（折叠，能力开关） | 权限与最近命令 |

视觉不引入新语言：沿用 `td-panel` / `td-title` / `td-meta` / `td-btn` / `td-dot` 与既有 CSS 变量；只新增 `saved-devices-card` 与 `readiness-card` 两个组件文件，各自一个职责。

## 四、刻意不做

| 想法 | 为什么不 |
| --- | --- |
| 插件内定时任务（"每天 18:00 断开"） | 调度属于宿主；插件没有调度权限，硬做会得到一个只在打开面板时运行的假定时器。 |
| 文件传输 / 剪贴板同步 | CLI 无接口，`devlist` 字段是偏好不是通道。 |
| 远端画面与点击（再一次） | ADR 0009 的三条硬障碍未变。 |
| 自动设置安全密码 | `-setpasswd` 会把密码写进进程命令行；给命令，不代跑（ADR 0010 §四）。 |
| 把 `IsConnected` 当实时会话状态 | 它只是上次写入时的快照；面板/工具都按"旁证"表述。 |

## 五、验证

| 项 | 结果 |
| --- | --- |
| `tsc --noEmit` | 0 |
| 自查修正 | 三处：设置读不到时不再谎报 `ready`（改 `posture-unknown`）；设备列表读不到不再谎报「没有设备」；空 `fix` 从「一切正常」条目里删掉 |
| `vitest run` | **75 项通过**（新增 `remote-readiness` 8 项、面板 3 项断言；工具面 10 → 11） |
| 真实数据 | `assessReadiness` 在本机跑出 `degraded`：`temp-password` / `no-2fa` / `stranger-devices-allowed` / `autostart` 四条 warn，每条都带 `fix`；与本机 `config.ini` 读数一致 |
| `node scripts/marketplace.mjs check` + 仓库测试 | 见交付说明 |
| 构建 | `todesk-0.4.13.astraviapkg` |
