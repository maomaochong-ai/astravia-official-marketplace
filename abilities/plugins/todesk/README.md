# ToDesk Remote（插件）

用 ToDesk 设备码，从面板或对话里把本机连到另一台电脑；也能让手机 / 另一台电脑连进本机。

- 集成面与 UI 形态：[ADR 0001](../../../docs/adr/todesk/adr-0001-integration-is-the-local-mcp-server.md)
- 双向场景与 CLI 实测：[ADR 0002](../../../docs/adr/todesk/adr-0002-both-directions.md)
- 为什么走命令行、不走 MCP：[ADR 0003](../../../docs/adr/todesk/adr-0003-tools-over-cli-not-over-mcp.md)、[ADR 0005](../../../docs/adr/todesk/adr-0005-drop-mcp-and-match-todesk-flow.md)
- 宿主命令授权（装完还要过的一道闸）：[ADR 0004](../../../docs/adr/todesk/adr-0004-command-grant-is-the-real-gate.md)

## 它能做什么

| 动作 | 谁来做 | 底层 |
| --- | --- | --- |
| 读本机设备码、版本、运行状态 | 面板 + `todesk_status` | `ToDesk.exe -status` |
| 连到**已存设备**（说设备名，不用敲码、不用报密码） | 面板 + `todesk_devices` → `todesk_connect { device }` | 客户端本地设备列表 `devlist_*.json` + `ToDesk.exe -control -id <code>` |
| 连到陌生设备（设备码 + 对方临时密码） | 面板 + `todesk_connect { device_id, password }` | `ToDesk.exe -control -id <code> -passwd <pwd>` |
| 谁用得最多 / 今天连了几次 | 面板 + `todesk_usage` | `recentusage_*.json` 按天计数 |
| 这台能不能被别人连、要不要加固 | 面板 + `todesk_posture` | `config.ini` 开关位（密码只报「有没有设」，不返回值） |
| 出门前一句话自检（能不能被连 / 连得出去） | 面板「就绪体检」+ `todesk_readiness` | 合成 verdict + 逐条 `fix`（命令或界面路径） |
| 当前登录的是哪个账号 | 面板 + `todesk_account` | `ToDesk.exe -user` |
| 开机自动启动开/关 | 面板 + `todesk_autostart` | `ToDesk.exe -autostart on/off` |
| 调出 / 收进托盘 | 面板 + `todesk_open_client` / `todesk_tray` | `ToDesk.exe` / `-tray` |
| 断开 | 面板 + `todesk_disconnect` | `ToDesk.exe -exit` |

官方文档核对与工具层拆分见 [ADR 0012](../../../docs/adr/todesk/adr-0012-official-docs-cross-check-and-tool-support.md)：所有修法路径改按官网（高级设置 → 安全设置），四类「对方连不上」的原因本机文件读不到，只写进技能排查顺序。

**没有 MCP、没有网络权限。** ToDesk 的 MCP 端点属于它的 AI 子系统，客户端里没有开关，实测从未监听；挂在上面的界面全是死按钮，已在 0.4.5 删除。0.4.12 起改成读客户端自己的本地状态（设备列表、使用计数、设置开关），把那批此前只能手点的动作交给 Agent（ADR-0010）。

## 连接之后

| 状态 | 面板显示 | 可以做什么 |
| --- | --- | --- |
| 刚发起 | 「已连接 `••••••333`」+ 断开按钮 | 「打开 ToDesk」看画面；「断开连接」 |
| 已断开 / 客户端退出 | 「与 … 的会话已结束」 | 重新输入设备码连接 |

**没有单会话断开**：ToDesk 命令行只有 `-exit`（关客户端），实测 `-close` 无作用。所以「断开连接」= 关闭 ToDesk 客户端，面板文案如实写明，并保留「打开 ToDesk」把它拉回来。Agent 侧对应工具是 `todesk_disconnect`。

## 对话式远控：能做到哪一步

| 层 | 对话里 | 靠什么 |
| --- | --- | --- |
| 会话生命周期：读码、按名字发起连接、断开、开关自启、调出/收起窗口 | ✅ | 11 个 `todesk_*` 工具（官方 CLI + 客户端本地状态） |
| 设备清单（置顶优先）、使用计数、访问姿态、就绪结论 | ✅ | `devlist_*.json` / `recentusage_*.json` / `config.ini`；**只报有无，不返回值** |
| 「连上了没有」 | ⚠️ 旁证 | `established` 读客户端设备行是否推进；读不到就答 `unknown`，不冒充成功 |
| 会话内的**画面** | ❌ | ToDesk 没有截图 CLI；带截图的接口只在它的 MCP 里 |
| 会话内的**输入**（点击/键盘） | ❌ | 同上，`todesk_gui_*` 只存在于那条通道 |

配套技能 `agent/skills/todesk/SKILL.md` 教 Agent 调用顺序与失败话术，并明确禁止声称「我连上并在那台机器上操作了」。详见 [ADR 0008](../../../docs/adr/todesk/adr-0008-conversation-scope-and-masking.md)。

## 隐私与画面

- **设备码明文显示**（它是念给对方听的公开标识），只有**密码**是掩码输入（`type="password"`，行内小眼睛可看）。这条规则在 0.4.8 按用户要求反转，ADR 0008 记录了理由。
- **远程画面不在本插件里**：面板只负责发起，画面在 ToDesk 自己的窗口。原因与备选方案见 [ADR 0006](../../../docs/adr/todesk/adr-0006-screen-lives-in-todesk-window.md)。

## 连接流程（跟着 ToDesk 走）

ToDesk 官方流程：输入对方 9 位设备码 → 连接 → **客户端自己弹密码框**。

所以面板只有一个必填框：

```
[9 位设备码]  [连接]  [密码]
```

- 「密码」是可选快捷键，只对**已在设备列表里解锁**的设备有用；不填就让 ToDesk 自己问。
- 反过来（别人连本机）：把这串设备码给对方，密码是本机 ToDesk 窗口里显示的那个。

## 装完还要过一次闸：宿主命令授权

Astravia Desktop 对 `plugin.json#commands` 的**每条命令单独授权**（`~/.astravia/plugins-manifest.json` 的 `grantedCommandNames`）。命令行安装不带命令授权，会被拒绝并原话返回：

```
Plugin todesk command disabled by user: ToDesk.exe
```

授权点：图形安装的批准弹窗里勾选，或「设置 → 插件 → ToDesk → 命令」。授权后覆盖安装不丢。面板检测到这条错误会直接说明，而不是显示「ToDesk.exe not found」。

## 能力页里在哪里找它

| 分段 | 是否出现 | 原因 |
| --- | --- | --- |
| **发现** | ❌ | 发现页只列**市场目录**里的条目；本插件尚未发布到 `gh-pages`，没有 `catalogId` |
| **我的** | ✅ | 已安装且 `plugin.source === "archive"`，属于「自装/本地」条目 |

所以：**能力 → 切到「我的」**。那里也能用 `+` → 「导入插件」直接选 `release/todesk-*.astraviapkg`。
完整的过滤规则与发布步骤见 [ADR 0007](../../../docs/adr/todesk/adr-0007-ability-page-scopes-and-publishing.md)。

## 为什么「发现」里没有

能力页只列**市场目录**里的条目（`abilities.json` 中 `origin.kind = "github-marketplace"` 且带 `catalogId`）。本插件的目录条目在仓库里已写好，但从未发布到 `gh-pages`；用 `install-from-path` 装进来只会得到 `origin.kind = "server"`，没有 catalogId，所以能力页不显示，**只能**在「设置 → 插件」里管理。

要出现在「发现」，唯一正规路径是发布（PR → CI 生成 gh-pages 索引）；伪造 catalogId 会让升级与校验指向错误的来源，不做。本地想先看效果，可以：

```bash
node scripts/marketplace.mjs build --output .marketplace-build
# 用任意静态服务器托管 .marketplace-build/site，然后在「能力 → 添加市场源」里填该 URL
```

（宿主是否接受 `http://127.0.0.1:*` 作为市场源未实测。）

## 两个坑（CLI 行为）

```
ToDesk.exe -status
  ToDesk ID:…            ← 设备码
  Start ToDesk with Windows: ON
  PID:7332 …
```

1. **成功也返回 1**：`-version` / `-getid` / `-status` 的退出码都是 1，判据只能是输出内容。
2. **答案与噪声同一行**：`-getid` 输出 `123456789[libusb] Info: …`，行内截断而不是整行丢弃，否则设备码一起没了。

调用形式固定为裸名 + PATH 前置：

```
file: "ToDesk.exe"
env:  { PATH: "C:\\Program Files\\ToDesk;<原 PATH>" }
```

宿主不允许 spawn 项目根之外的绝对路径，而 `ToDesk.exe` 正好也是 `commands` 白名单校验的对象。

## 面板结构

| 区块 | 内容 |
| --- | --- |
| 这台电脑 | 设备码、复制、运行状态、开机自启开关 |
| 连到另一台电脑 | **设备码 ｜ 临时密码 ｜ 连接 同一行**；两个字段都必填；旁边常显本机码与「重新读取」；连接后出现会话行与「断开连接」 |
| 诊断（折叠） | **每个能力一个开关**（读状态 / 连接 / 自启 / 调出窗口）、宿主命令授权状态、最近一次命令（掩码） |

默认状态下除「连接」在设备码不足 9 位时禁用外，所有按钮都可点；能力开关默认全开，用户可以逐项关掉，而不是被一刀切阻止。

## 权限

| 权限 | 用途 |
| --- | --- |
| `ui.slot.workspace-view` / `ui.slot.activity-tab` | 侧边栏页 + 对话侧栏标签页 |
| `agent.tools.register` / `agent.toolHandler.execute` | 十一个 `todesk_*` 工具 |
| `agent.command.run`（`commands: ["ToDesk.exe"]`） | `-status` / `-control` / `-autostart` |
| `storage.read/write` | 记住 Agent 许可与最近一次探测结果 |
| `fs.read` | CLI 不可用时读 `config.ini` 取设备码 |
| `shell.openExternal` | 打开 ToDesk 下载页 |

## 开发

```bash
npm install
npm run check     # tsc --noEmit
npm test          # vitest（36 项）
npm run build     # → release/todesk-<ver>.astraviapkg
```

版本号按末位递增（0.4.4 → 0.4.5）；改界面、修 bug 不动中间位。

`@astravia-org/plugin-sdk` 与 `plugin-vite` 不在公共 registry 上，本地安装时指向
`../../../.tooling/plugins/plugin-sdk` 所在目录（与其它插件一致）。

## 排错

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `disabled by user: ToDesk.exe` | 宿主未授权该命令 | 设置 → 插件 → ToDesk → 命令，允许后刷新 |
| 设备码显示 `—` | CLI 与 `config.ini` 都读不到 | 直接在 ToDesk 窗口里看 |
| 点「连接」客户端没反应 | 目标号不存在 / 未登录 ToDesk 账号 | 确认对方在线，或先在 ToDesk 里登录 |
| 连上后要密码 | 对方设了安全密码或临时密码 | 在客户端弹出的密码框里输入 |
| 开机自启切不了 | 该版本没报告该字段 | 直接在 ToDesk 设置里改 |
