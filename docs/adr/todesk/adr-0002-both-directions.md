# ADR 0002：两个方向，不是「手机专属」

- **状态：** 提议
- **日期：** 2026-11-18
- **背景：** 插件 `todesk` 0.2.0；ToDesk **4.8.8.4**；本机 CLI 实测 + 官网帮助中心
- **修订：** [ADR 0001](adr-0001-integration-is-the-local-mcp-server.md) 的「形态选择」（MCP 是主体、单插件、工作区视图）仍然成立；**场景与界面分工需要纠正**

## 一、ADR 0001 错在哪

ADR 0001 把集成目标写成「从手机远控这台电脑」，于是面板被设计成一块**单机身份牌**：设备码、临时密码在哪看、手机怎么扫。这个模型漏掉了两件事：

1. **ToDesk 是对称的。** 同一个客户端既当被控端也当出控端；「远程连接自家的电脑，用另一台电脑控制我的电脑」是这个产品的常规用法，不是边缘场景。
2. **ToDesk 给 MCP 的是「账号设备」模型，不是「这台机器」模型。** `todesk_list_devices` 返回的是账号下所有设备；`todesk_connect` 的入参是 `target_device_id`。也就是说，MCP 通道天生就是**出控**用的，ADR 0001 却只拿它来报「通道开没开」。

所以缺口不是文案，是**能力面**：面板没有「我的其它电脑」这一块，用户看不到账号设备，也没法从这台机器发起控制。

## 二、新取证

### 2.1 官网帮助中心（正文实测，非宣传语）

| 文章 | 观察到的说法 | 对设计的约束 |
| --- | --- | --- |
| solo-290「如何远控连接」 | 输入**对方 9 位设备代码** → 连接 → 弹出密码框 → 输入密码 | 设备码 + 密码是无需账号的通用入口 |
| solo-253「怎么查看所有设备」 | 左侧**设备列表**，按分组列出设备 | 账号路径是「设备列表 → 双击」，与设备码路径并列 |
| solo-263「无人值守」 | 三件套：登录账号、设置**安全密码**、**开机自启**；外加**必须禁用系统休眠** | 「远程连回家里的电脑」的真正前提，面板必须检查这四项 |
| solo-213「怎么使用命令行参数」 | Windows 4.0.0+：`-getid`、`-version`、`-status`、`-control -id <id> -passwd <pwd>`（**仅支持设备列表里已解锁设备**）、`-autostart on/off`、`ToDesk://connect&<id>&<pwd>` | 有一条**不需要 MCP 通道**的出控路径，且本机事实有权威来源 |

### 2.2 本机实测（4.8.8.4，Observed）

```
ToDesk.exe -status   →
  ToDesk ID:123456789
  ToDesk 4.8.8.4 for windows
  Start ToDesk with Windows: ON
  PID:7332   C:\Program Files\ToDesk\ToDesk.exe
  Server:authds.todesk.com  Port:443
  Uptime:2026-11-18 00:59:59
```

两个必须写进实现的坑：

1. **成功也返回 1。** 三条命令的 `$LASTEXITCODE` 都是 1，退出码不能当判据，只能解析输出。
2. **答案和噪声在同一行。** `-getid` 实际输出 `123456789[libusb] Info: Unloaded UsbRDstCore.dll`；按「整行以 `[libusb]` 开头才丢弃」的规则会把设备码一起丢掉。`cleanCliOutput` 改为「行内出现即截断，行首出现才整行丢」。

### 2.3 MCP 侧的出控形状（ToDesk 自带 schema）

- `todesk_list_devices` → `{success,total,online_count,devices[]}`，`DeviceInfo = {device_id,device_name,os,status}`，`status ∈ online|offline|busy|locked`。
- `todesk_connect {target_device_id}` → `{success,session_id,deep_link,status}`，`deep_link` 形如 `todesk://connect?session=xxx&token=yyy`，官方描述是「拉起本地 ToDesk 客户端的协议链接」。

结论：**出控的正路是先 `tools/call` 拿 `deep_link`，再把链接交给本机客户端**；不是我们自己去拼 URL。

## 三、决定

### 3.1 面板从「单机身份牌」改成「两个方向、四块」

| 区块 | 回答的问题 | 依据 |
| --- | --- | --- |
| 本机 | 我是谁（设备码）、客户端在不在跑、**开机自启开没开**、无人值守四件套是否齐 | `-status` + solo-263 |
| 入站 | 手机怎么进来、**另一台电脑怎么进来** | solo-290 / solo-253 |
| 通道 | Agent 通道开没开、要不要 Token | 8899 探针 |
| 出站 | 账号里有哪些电脑、现在能不能连；通道关着时用设备码连 | `todesk_list_devices` / solo-213 |

入站与出站各写各的步骤，因为它们的第一步不同：手机要装 App，另一台电脑多半已有客户端，只差设备出现在列表里。

### 3.2 本机事实优先走 CLI，`config.ini` 退为兜底

`ToDesk.exe -status` 是权威来源，还顺带给出 `Start ToDesk with Windows: ON`——这是无人值守的必要条件，`config.ini` 里没有这个语义（有的只是 `isOpenTempPass` 之类的开关位）。`config.ini` 只在 CLI 不可用时兜底，且**仍只取设备码与版本**，不碰 `Token` / `authPassEx` / `tempAuthPassEx`。

### 3.3 出控两条路，按通道状态自动选

```
通道 ready  → tools/call todesk_connect {target_device_id}
              → deep_link → ToDesk.exe "<deep_link>"
通道 关     → ToDesk.exe -control -id <9位> -passwd <密码>
```

第二条是官方文档写明的，所以通道关着也能用；但它限「设备列表里已解锁的设备」，界面上就这么写，不承诺任意设备码都能连。

### 3.4 开机自启做成动作，不是一行状态

`-autostart on/off` 是文档化命令，「远程连回家」失败最常见的原因就是这行是 OFF。面板因此给按钮，并在无人值守清单里点名「关掉系统休眠」——那是 ToDesk 管不到的一步。

## 四、不做什么

- **不代装 ToDesk、不改系统电源设置。** 前者是商业软件安装器，后者属于系统级改动；面板只把「该关休眠」讲清楚。
- **不读密码、不存密码。** 设备码是公开的，密码不是；`-control` 的密码在输入框里用完即弃，不写 `secrets`。
- **不拼 `todesk://` 链接。** 浏览器式 `ToDesk://connect&id&pwd` 只作为文档引用保留在领域层函数里，界面走 `deep_link`。
- **不把设备列表当实时。** 状态是快照，面板写明这一点，并提供刷新。

## 五、代价与边界

1. **`-control` 要密码**，且仅对已解锁设备有效；`deep_link` 路径要通道开着。两条都不通的机器，只能用 ToDesk 自己的界面——面板会明说。
2. **`-status` 的字段集是 4.8.8.4 实测的**。ToDesk 改输出时 `parseStatus` 会退化为「只有设备码」或走 `config.ini`，不会崩。
3. **开机自启按钮改变系统状态**，所以只在 CLI 报告了该字段（`source === "cli"`）时才出现，避免对未知版本盲发命令。
4. **`exitCode` 恒为 1** 已经在类型注释和 README 里写死，后续改动不要拿它判成败。

## 六、验证

- `npm run check`：0。
- `npx vitest run`：6 文件 / 69 项。
  - `todesk-cli.test.ts`（13）：用**实测输出原文**当 fixture，覆盖 libusb 同行截断、`ON/OFF/缺失`三态、`-control` 参数拼装与非法设备码拒绝。
  - `mcp-tools.test.ts`（18）：`content[0].text` 解包、`isError`、`devices[]` 收窄、`deep_link` 提取（拒绝 http）、`tools/call` 请求体与 401/断连。
  - `console-view.test.tsx`（10）：通道关闭/401/ready 三态、设备列表渲染、离线设备禁用连接、点击连接 → 启动客户端携带 `deep_link`、设备码手动连接 → `-control … -passwd …`、开机自启切换发出 `-autostart off`。
- `node scripts/marketplace.mjs check` 与仓库测试：见交付说明。
