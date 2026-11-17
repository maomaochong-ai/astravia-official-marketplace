# ADR 0001：ToDesk 的集成面是它自带的本地 MCP 服务，Astravia 这边只做一块控制台

- **状态：** 提议
- **日期：** 2026-11-18
- **背景：** 插件 `todesk` 0.1.0；本机 ToDesk **4.8.8.4**（`C:\Program Files\ToDesk`，客户端在运行）
- **目标：** 在 Astravia 里集成 ToDesk，让用户能从手机远控这台电脑，并由 Agent 参与
- **关联：** [ADR 0002](adr-0002-both-directions.md) — **纠正本文件的场景与界面分工**：集成面（MCP / 单插件 / 工作区视图）不变，但 ToDesk 是对称的（同一客户端既被控也出控），面板必须同时服务「进得来」与「出得去」。官网帮助中心取证与本机 CLI 实测见该文

## 一、先说结论

| 问题 | 结论 |
| --- | --- |
| 做成纯技能？ | **不行**。技能只是给模型的指令，无法建立任何通道；它能做的只有在对话里告诉用户「去装 ToDesk」。 |
| 做成 MCP？ | **是主体**，但它不是完整产品：ToDesk 的 MCP 默认关闭，端点和 Token 需要一个落点。 |
| 做成插件？ | **对**。一个插件同时交付「MCP 通道」与「装/填/测/引导」的那块 UI。 |
| 上架形态 | **单个 plugin**（`plugin.json#agent.mcpServers` 指向 ToDesk 的本地 MCP），**不是** mcp+plugin 的 bundle。 |
| UI 形态 | **宿主侧边栏的工作区视图**（workspace view），**不是**活动面板的 tab。 |

## 二、取证：ToDesk 到底开放了什么

不是读官网宣传，是读本机这份 4.8.8.4 的二进制与运行时状态。每条都能复现。

| # | 取证位置 | 事实 | 对设计的意义 |
| --- | --- | --- | --- |
| 1 | `HKCR\todesk\shell\open\command` | `"C:\Program Files\ToDesk\ToDesk.exe" "%1"` | 只有一个 URL 协议处理器，**没有命令行接口**。 |
| 2 | `C:\Program Files\ToDesk\config.ini` | `clientId=123456789`、`Version=4.8.8.4`、`LoginPhone=…`、`Resolution=…` | 本机设备码可读；同一文件里还有 `Token`、`authPassEx`、`tempAuthPassEx`（账号凭据与临时密码密文），**插件不碰这三项**。 |
| 3 | `ToDesk.exe` 内嵌 manifest（文件偏移 ≈ 44876160） | `name: todesk-mcp`、`protocol_version: 2025-03-26`、三种传输：stdio `./todesk-mcp-server`、SSE `http://localhost:8899/sse`、streamable HTTP `http://localhost:8899/mcp`；`auth: bearer`，oauth2 授权端点在 `account.todesk.com` | **官方 MCP 服务端**，不是社区逆向出来的旁路。8899 就是它的固定端口。 |
| 4 | 同处内嵌 9 份 JSON Schema | 34 个工具：会话 3、远控 5、设备 3、文件 5、命令 3、GUI 13、通知 2；每个工具带 `required_scopes`、`risk_level`、`confirm_required` | 工具面已经由 ToDesk 定义好，插件不该复刻。 |
| 5 | 运行时 `Get-NetTCPConnection` + `curl 127.0.0.1:8899` | 无监听、连接被拒 | **默认关闭**：必须在 ToDesk 自己的设置里开启，面板必须把「未开启」当一等状态。 |
| 6 | `ToDesk.exe` 字符串 `USER_MCP_TOOLS` | MCP 能力位与 `USER_CMDLINE`、`USER_ELEVATE_PRIVILEGE` 并列 | 这是权限位，不是版本号；是否免费档可用未实测，UI 不能承诺。 |
| 7 | 同处字符串 `todesk://connect?session=xxx&token=yyy` | 只出现在 ToDesk 自己的文档示例里 | 语义未实测，**v1 不用它发起连接**。 |

一句话：**ToDesk 已经把自己做成了一个 MCP 服务端**，集成工作的 90% 是「把这个端点接上，并把开关和凭据讲清楚」。

## 三、决定一：单个插件，而不是「MCP 条目 + 插件」两件套

四种候选的实际差异：

| 形态 | 用户得到什么 | 缺什么 |
| --- | --- | --- |
| skill | 一段怎么用 ToDesk 的说明 | 没有通道、没有面板、没有安装引导 |
| mcp 条目（schema v1，`server.url = http://127.0.0.1:8899/mcp`） | 34 个工具 | 服务没开时用户看到一串永远失败的工具；Token 无处填；手机端三步没有落点 |
| plugin（`agent.mcpServers.todesk` → 同一端点） | 同样的 34 个工具 **＋** 状态面板、Token 保管、`official.mcp.upsert` 热刷新 | 需要一次构建与一个包 |
| bundle(mcp + plugin) | 同上 | 同名 server 会出现两份声明，安装结果取决于宿主合并顺序——不引入这种不确定性 |

选 **plugin**。关键能力是 `ctx.official.mcp.upsert(name, { type: "http", url, headers })`：manifest 里的 server 声明是静态的、不能带密钥，而 ToDesk 的 Token 是用户在 ToDesk 侧生成后粘贴进来的。插件把 Token 放进 `ctx.secrets`（加密保管），再用 `upsert` 把 `Authorization: Bearer …` 写进宿主那份 MCP 配置。这样「零配置可用」与「需要 Token 也能用」是同一条路径的两个状态，而不是两个包。

## 四、决定二：工作区视图，不是活动标签页

这不是口味问题，SDK 自己写了分工（`@astravia-org/plugin-sdk` 0.3.10 `ui.d.ts`）：

> workspace view：`a full-page surface … Use it for standalone workbenches that are NOT bound to one conversation (dashboards, boards, consoles). Conversation-scoped UI belongs in an activity tab.`

> activity tab：`Registering only adds the tab to the "addable pool" — it renders only after the user attaches it in the activity panel (scoped by session cwd).`

对照 ToDesk 这块面的内容：

1. **它是跨会话常量。** 「这台电脑的设备码 / MCP 通道开没开 / 手机上怎么连进来」跟当前打开哪个对话无关。活动标签页按 `cwd` 记录挂载状态，换一个会话就换一份面板——对一台机器的身份信息来说，这个语义是错的。
2. **它没有可编辑的产物。** 活动标签页在仓库里的位置是「编辑器/看板」（photocraft、boardmix、strix、craft-*）。ToDesk 面板里没有画布、没有文档，只有状态与按钮。`xiaohongshu` 的账号列表、`video-downloader` 的队列是同一判断。
3. **它要能被随手找到。** 首装后最需要的是「通道没开，去这里开」这条信息；侧边栏入口是一级导航，活动标签页要先点「+」把它加进来才存在。
4. **它要承载一个坏的默认状态。** 8899 现在没有监听（取证 #5）。这块面的一半价值是把失败讲清楚并给出下一步；这属于常驻页面，不属于一次性面板。

**什么时候该改判：** 如果将来做「实时镜像远程画面」或「命令流控制台」，那是 workbench，应当升级为活动标签页（截图类结果仍走工具结果，不上面板）。这条写在这里，是为了让下次判断有依据，而不是重新讨论一遍。

## 五、不做什么

- **不打包、不托管 ToDesk。** 客户端 82 MB 起，是商业软件，有自己的升级器。插件只连它。
- **不读 `Token` / `authPassEx` / `tempAuthPassEx`。** 那是账号凭据和临时密码的密文；读出来要么解不开，要么等于把密码抄进内存。面板只显示设备码，并明确告诉用户临时密码在 ToDesk 主界面看。
- **不猜 `todesk://connect` 的参数语义。** 只用「协议是否注册」做提示；v1 的「打开 ToDesk」是拉起客户端本体，不是发起连接。
- **不复刻 34 个工具。** 工具面归 ToDesk 的 MCP，宿主负责调用、确认与审计。插件只在面板上分组列出它们、标出高危项。
- **不做手机端。** Astravia 的桌面插件跑在这台 PC 上；手机那一端是 ToDesk 自己的 App。面板的职责是把「设备码 + 临时密码 + 下载入口」送到用户手边，不是假装能替代它。

## 六、风险与已知边界

1. **MCP 默认关闭，开关在 ToDesk 侧**（服务端下发的 WebView 设置页，本地没有可读文案）。面板把 `closed / needs-token / ready` 三态分开，`closed` 给开启路径而不是报错；文案不承诺开关在菜单里的确切位置。
2. **Token 是否强制未实测。** manifest 写的是 `auth: bearer`，但 `MCP_AUTH_TOKEN` 只出现在 stdio 的 env 列表里。实现按「无 Token 先探，401/403 才要 Token」降级，两种服务端行为都能走通。
3. **工具目录是静态快照**（4.8.8.4 / 34 个）。ToDesk 升级可能改端点或工具名；面板显示快照版本，工具本身仍以宿主的 MCP 发现结果为准。
4. **`config.ini` 可能读不到**（宿主对 `fs.read` 的工作区限制、或非默认安装路径）。设备码因此是「读得到就显示、读不到就留空并可手填」，不作为唯一事实来源。

## 七、验证方式

- 领域层单测：`config.ini` 解析（含缺键、含中文路径）、MCP 探测的状态分类（ready / 401 / 连接拒绝 / 非 MCP 响应）、工具目录与 deny 列表一致。
- 组件测试：面板在「未开启通道」下必须渲染出开启路径与「重试」，在「needs-token」下必须渲染出 Token 输入框。
- 仓库检查：`npm run check`、`npm run build`、`node scripts/marketplace.mjs check`、`node --test tests/*.test.mjs`。
- 真机联调（需用户在 ToDesk 里开启 MCP）：面板应显示 `ready`，宿主「能力」页出现 `ToDesk` 这一组工具。
