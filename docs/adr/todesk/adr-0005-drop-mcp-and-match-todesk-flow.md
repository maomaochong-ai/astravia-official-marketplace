# ADR 0005：砍掉 MCP 这条死路，把连接流程改回 ToDesk 本身

- **状态：** 已接受
- **日期：** 2026-11-18
- **背景：** 插件 `todesk` 0.4.5；Astravia Desktop 0.5.97；ToDesk 4.8.8.4
- **修订：** [ADR 0001](adr-0001-integration-is-the-local-mcp-server.md)（MCP 为主体）、[ADR 0003](adr-0003-tools-over-cli-not-over-mcp.md)（MCP 作可选增强）、[ADR 0004](adr-0004-command-grant-is-the-real-gate.md)（未涉及 MCP）

## 一、用户的五条反馈与对应的判断

| 反馈 | 判断 |
| --- | --- |
| 「MCP 通道好像永远都连不上，这个功能到底怎么用」 | 它**确实永远连不上**，因为它不属于 ToDesk 的正常功能面。删掉。 |
| 「远程连接要输入设备码，再输入这里显示的密码，两者都要输不符合 ToDesk」 | 对。ToDesk 的产品流程是**只输设备码**，密码由客户端自己弹框问。改成只有一个必填框。 |
| 「面板很多按钮点了没反应、输入框是方的、纯摆设」 | 旧的 MCP 区块把按钮挂在从不成立的状态上。随 MCP 一起删。 |
| 「能力页看不到插件，是不是没发布成功」 | 是。见第四节。 |
| 「按 0.0.1 递增，不要跳级」 | 0.4.4 → **0.4.5**，并写进本节末的规则。 |

## 二、为什么必须删 MCP，而不是继续解释它

三轮判据叠起来只有结论：**这条路对插件无意义**。

1. 端点属于 ToDesk 的 AI 子系统（ToClaw）：`data/app.so` 里 `MCP` 命中 0 次，客户端没有开关，权限位 `USER_MCP_TOOLS` 是服务端下发的。
2. 在本机连续多轮实测中，`127.0.0.1:8899` 从未监听；无监听就意味着「未开启」是**永久状态**，不是待解决项。
3. 挂在它上面的一切都是死的：通道状态卡、Token 输入、「账号设备列表」、「一键连接」、「34 个原生工具」清单。用户看到的「纯摆设」正是这些。

**决定：**

- `plugin.json` 删除 `agent.mcpServers`、`agent.toolPolicy`；
- 删除 `network.fetch`、`secrets.read/write`、`agent.mcp.control`、`agent.tools.control` 权限与 `network.allowedHosts`（不再访问 8899）；
- 删除 `domain/mcp-endpoint.ts`、`domain/mcp-tools.ts`、`domain/tool-catalog.ts` 及其测试；
- 删除工具 `todesk_devices`（只可能经通道工作）；
- 面板删掉通道卡、Token、设备列表、工具清单，只留下诊断区的四条自带工具说明。

留下的权限收敛为：`ui.slot.workspace-view`、`ui.slot.activity-tab`、`storage.read/write`、`fs.read`、`shell.openExternal`、`agent.tools.register`、`agent.toolHandler.execute`、`agent.command.run`。**没有网络权限。**

## 三、连接流程改回 ToDesk 本身

ToDesk 官方（solo-290「如何远控连接」）的流程是：输入对方 9 位设备码 → 点连接 → **弹出密码框** → 输入密码。

对应实现：

```
ToDesk.exe -control -id <9位设备码>            ← 默认，只有这一个必填项
ToDesk.exe -control -id <code> -passwd <pwd>   ← 例外：用户主动填密码
```

- 面板只有一个必填输入（设备码），实时提示「已输入 n/9 位」；
- 密码藏在「密码」按钮后面，文案写明**只对已在设备列表里解锁的设备有用**，其余情况留空让客户端自己问；
- 入站文案改成「把这串设备码给对方；密码是本机 ToDesk 窗口里显示的那个」——这才是 ToDesk 的说法。

**实测证据（Observed）**：执行 `ToDesk.exe -control -id 123456789` 后，ToDesk 自己的日志出现

```
[Hitlog] Hitlog_AddCenterEvent success, eventid: Connect
client recv connect request  message wParam=0x09
```

说明「只给设备码」这条命令被客户端接受并进入连接流程（目标号是合成值，故随后失败）。

## 四、能力页看不到，原因不是代码

`~/.astravia/abilities.json` 里两条记录对比：

```json
"plugin:photocraft": { "version": "0.0.34",
  "origin": { "kind": "github-marketplace", ... },
  "catalogId": "github:astravia-official:plugin:photocraft" }

"plugin:todesk": { "version": "0.4.5",
  "origin": { "kind": "server" } }     // 无 catalogId
```

能力页的条目来自**市场目录**（`github:<source>:plugin:<slug>`）。本插件的目录条目写在仓库 `.astravia/marketplace.source.json` 里，但**从未发布到 `gh-pages`**，所以任何目录里都没有它；用 `install-from-path` 装进来只写 `origin.kind = "server"`，不产生 catalogId，因此能力页不显示。

三条可行路径，按代价排序：

1. **发布**：按仓库正常流程走 PR → CI 生成 `gh-pages` 索引 → 市场里出现 `ToDesk`，能力页可装可更新。这是唯一能让它出现在能力页的方式。
2. **本地静态市场**：`node scripts/marketplace.mjs build --output <dir>` 生成站点，自己托管成 URL，在「能力 → 添加市场源」里填该 URL（宿主是否接受 `http://127.0.0.1:*` 未实测）。
3. **私有安装**（当前状态）：装完可在「设置 → 插件」里启停/重载，但没有目录卡片。

## 五、UI 与输入框

- 面板只剩两块可见内容 + 一个折叠的诊断区：**这台电脑**（设备码、复制、运行、开机自启）、**连到另一台电脑**（一个输入框 + 连接）。
- 默认状态下除了「连接」（设备码未满 9 位）之外，**每个按钮都可点**；测试里直接断言这一点（`console-view.test.tsx` → `keeps every visible control usable by default`）。
- 输入框方角的根因是原生控件样式：`appearance: none` + `-webkit-appearance: none` + 显式 `border-radius: 10px`，并单独处理 `:-webkit-autofill`（密码管理器会把圆角再抹平）。

## 六、版本号规则

用户要求「按 0.0.1 递增，不要跳级」。此前一轮从 0.1.0 跳到 0.4.x，属于错误。此后：

- 修 bug / 调整界面 / 改文案：末位 +1（0.4.4 → 0.4.5）；
- 新增能力面（新的工具、新的交互）才动中间位；
- 重写（换集成方式）：才动首位。
- 这一版是 **0.4.5**。

## 七、代价与边界

- 没有账号设备列表：ToDesk 的设备列表属于账号服务，客户端不提供 CLI 查询，插件只能按设备码连。
- 没有 ToDesk 原生 34 个工具（远端截图 / GUI / 文件传输）——它们只存在于那条通道。需要这些能力时，唯一稳定做法是 ToDesk 自带的 AI 客户端，不是本插件。
- 能力页可见性依赖发布流程，代码侧无法绕过。

## 八、验证

| 项 | 结果 |
| --- | --- |
| `tsc --noEmit` | 0 |
| `vitest` | 4 文件 / 36 项通过 |
| `vite build` | `todesk-0.4.5.astraviapkg`，16 个运行时文件 |
| 安装到宿主 | `plugins.manage` install-from-path 成功，`activeVersion 0.4.5` |
| 激活探测 | `lastLaunch.ok: true`，`source: "cli"` |
| 只给设备码的连接 | ToDesk 日志出现 `eventid: Connect` / `client recv connect request` |
