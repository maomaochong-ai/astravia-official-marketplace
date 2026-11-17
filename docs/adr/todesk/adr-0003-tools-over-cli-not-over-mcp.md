# ADR 0003：控制能力走插件自己的工具，不押在 ToDesk 的 MCP 通道上

- **状态：** 提议
- **日期：** 2026-11-18
- **背景：** 插件 `todesk` 0.3.0；ToDesk 4.8.8.4；用户反馈三条
- **修订：** [ADR 0001](adr-0001-integration-is-the-local-mcp-server.md) 的「MCP 是主体」与 [ADR 0002](adr-0002-both-directions.md) 的通道前置假设

## 一、用户提出的三条

1. 「真的要在 ToDesk 里打开 AI / MCP 设置吗？一般配对码就行，这一步我也没看到在哪里设置。」
2. 「插件在宿主能力页刷新后没显示，对话框的『+』展开面板里也没有。」
3. 「我希望装上插件、在对话里问 AI，它就能操控电脑。」

三条都成立，而且第 1 条暴露了 ADR 0001 里的一个**未验证断言**。

## 二、第 1 条：那个开关不存在

复查取证，结论是**客户端 UI 里没有 MCP 开关**：

| 检查 | 结果 |
| --- | --- |
| `data/app.so`（Flutter UI 全部字符串） | `MCP` 命中 **0** 次 —— 界面层根本没有这项设置 |
| `ToDesk.exe` 内嵌文案 | 只有 `McpBridge` / `[PluginAdapter] Setting MCP token` / `In-process MCP HTTP server started on localhost:8899` 这类**内部日志**，没有面向用户的开关名 |
| 权限位 `USER_MCP_TOOLS` | 与 `USER_CMDLINE` / `USER_ELEVATE_PRIVILEGE` 并列，是**服务端下发的权限位**，不是本地 checkbox |
| 同族字符串 `-toclaw`、`[aiclient] open toclaw ai`、`ShowToClawServiceGuide` | 8899 上的服务属于 ToDesk 的 AI 子系统（ToClaw），由 AI 客户端激活，不是菜单项 |

所以 ADR 0001 里「在 ToDesk 的 AI / MCP 设置里打开」这句话是我编的，已从界面与文档中删除。**配对码路径本来就是官方主路径**（solo-290），不需要任何开关。

**决定：** 通道降级为「可选增强」。面板不再要求用户去找一个不存在的设置；通道关着时如实说明它属于 ToDesk 的 AI 子系统、没有本地开关，并明确「这里没有需要你配置的东西」。

## 三、第 3 条：控制能力必须由插件自己提供

这是本次最重要的结构改动。原来的实现把「Agent 能操控电脑」押在 MCP 通道上，而通道默认关、且不可由用户打开 —— 等于**默认功能为零**。

**决定：插件自己注册五个 Agent 工具，全部走 ToDesk 官方命令行**（solo-213）：

| 工具 | 作用 | 依赖 |
| --- | --- | --- |
| `todesk_status` | 设备码、版本、开机自启、客户端是否在跑、通道状态 | `ToDesk.exe -status` |
| `todesk_connect` | 按 9 位设备码发起会话（可带密码） | `-control -id -passwd`；通道开且无密码时优先走 MCP + `deep_link` |
| `todesk_devices` | 账号设备列表 | 需通道；关着时返回可执行的替代方案而不是空 |
| `todesk_autostart` | 开机自启开关 | `-autostart on/off` |
| `todesk_open_client` | 调出 ToDesk 窗口 | `ToDesk.exe` |

于是「装插件 → 在对话里说『连一下 123456789』→ Agent 调用 `todesk_connect`」成立，不需要任何 ToDesk 设置。ToDesk 的 34 个原生工具仍在通道可用时叠加，属于加分项。

工具层与面板层共用同一套解析器（`parseStatus` / `buildControlArgs` / `parseDeviceList`），不存在两套事实源。

## 四、第 2 条：为什么没显示，怎么改

两个独立原因，都得治：

1. **包里已经构建，但没装进宿主。** 仓库只产出 `.astraviapkg`；没安装自然在「能力」页看不到。现在通过宿主的 `plugins.manage`（`install-from-path`）安装，装完在 `plugins.query` 里可见。
2. **「+」面板按设计不会出现。** ADR 0001 只注册了 `registerWorkspaceView`；而「+」是**活动标签页的可添加池**（`registerActivityTab`），两者是不同的槽位。用户想在对话里打开，就必须注册标签页。

**决定：两个槽位都注册，同一个组件。**

- 工作区视图：侧边栏一级入口，跨会话常驻（身份与状态属于这台机器，不属于某次对话）；
- 活动标签页：`initiallyVisible: false`，进可添加池，用户在「+」里勾选后贴在右侧。

这不是退回 ADR 0001 的取舍，而是承认两种入口回答的是不同问题：**「我要配置这台机器」**走侧边栏，**「我在对话里，顺手看一眼」**走标签页。

## 五、代价

- 五个工具意味着插件有了**写操作面**（`-control`、`-autostart`）。写法上限定：设备码必须 9 位数字才拼命令、密码用完即弃、`toolPolicy` 仍拦掉 ToDesk 原生的 shell 与锁屏工具。
- `todesk_devices` 在无通道时是个「半个工具」，只能给出替代路径。保留它的理由是：通道真的开着时，账号设备列表是最省事的选目标方式。
- 活动标签页多一份挂载成本，因此 `retention: "warm"`（访问过的实例留在宿主 LRU 里），不做 `pinned`。

## 六、验证

- `npm run check`：0。
- `npx vitest run`：7 文件 / 76 项。新增 `plugin-registration.test.ts`（8 项）直接对着假 ctx 断言：
  - 两个槽位都注册，标签页 `initiallyVisible === false` 且 `scope_use` 含 `conversation`；
  - 五个工具 id 齐全；
  - `todesk_status` 从 CLI 读出设备码，并报 `mcp_channel: "closed"`；
  - `todesk_connect` 在通道关闭时走 `-control -id … -passwd …`；
  - 非法设备码不 spawn 进程；
  - `todesk_devices` 在通道不可用时给出 `todesk_connect` 这条替代路径；
  - `todesk_autostart` 发 `-autostart off` 并回报实测状态。
- 面板测试同步改为断言「没有要用户完成的步骤」，防止文案回潮。
