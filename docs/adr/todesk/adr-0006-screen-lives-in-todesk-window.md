# ADR 0006：远程画面由 ToDesk 自己的窗口呈现，插件不内嵌画面

- **状态：** 已接受
- **日期：** 2026-11-18
- **背景：** 插件 `todesk` 0.4.6；Astravia Desktop 0.5.97；ToDesk 4.8.8.4
- **问题：** 「远程连接电脑后，远程控制的画面能不能真的看到？用什么方案好？」

## 一、先把事实钉住

| 事实 | 取证 |
| --- | --- |
| 插件能**发起**连接 | `ToDesk.exe -control -id <code>` 被接受；ToDesk 日志出现 `[Hitlog] eventid: Connect`、`client recv connect request, myid=… destid=…`、`req->server()=<ip>` |
| 之后是否出画面，取决于 ToDesk 客户端 | 同一个请求之后，`Logs/` 下**没有**任何 `session*` / `*WEBRTC*` 会话日志生成；对方未响应或不在线时，日志到此为止 |
| 插件拿不到像素 | ToDesk 没有「截取当前会话画面」的 CLI；无会话时不产生日志，更不产生帧 |
| 唯一带截图的接口在 MCP 通道里 | `todesk_gui_screenshot` / `todesk_take_screenshot` 属于 ToDesk 的 AI 子系统；该端点在本机从未监听（ADR 0005 已删） |
| Astravia 插件不能内嵌第三方窗口 | 插件 UI 是宿主里的一个 React 页面（module federation remote），没有跨进程窗口捕获能力；宿主也没有向插件开放的屏幕捕获 API（权限清单里没有 `capture.window`） |

一句话：**连接可以发起，画面在 ToDesk 自己的窗口里，插件既看不到也拿不到。**

## 二、三个候选方案与取舍

| 方案 | 做法 | 结论 |
| --- | --- | --- |
| A. 内嵌/转发画面 | 用 Electron 的 `desktopCapturer` 截取 ToDesk 窗口，贴进面板 | **否决**。需要宿主给插件屏幕捕获权限（当前不存在）；截的是「窗口的像」，延迟一层、输入要另外对齐，断线时面板只是一块冻结的图；而且等于把用户的远程桌面画面录进另一个进程。 |
| B. 轮询截图 | 定时调 `-screenshot` 之类命令取帧，做成「低帧率监控」 | **否决**。ToDesk 没有该 CLI；MCP 里的 `todesk_take_screenshot` 取不到（通道死）。伪造一个「有画面」的面板比没有更糟。 |
| C. 只做「发起 + 交棒」 | 面板/工具负责连上；画面交给 ToDesk 客户端窗口（`ToDesk.exe` 前台），面板给一句话说明画面在哪 | **采纳**。这就是 ToDesk 的产品形态：远控画面属于客户端，不属于任何第三方界面。 |

## 三、决定

1. **插件不承载远程画面**，也不做「画面占位」。连接成功后，面板只报「已交给 ToDesk，请在客户端窗口确认」，并提供「打开 ToDesk」按钮把窗口调到前台。
2. **在界面上把这件事说清楚**：入站文案写明「密码是本机 ToDesk 窗口里显示的那个」，出站成功文案写明「请在该窗口里操作」。
3. **不再为画面预留任何半成品 UI**（缩略图框、黑屏占位、帧率条）：这些是上一版的死按钮来源，已随 ADR 0005 一并删除。
4. **若将来 ToDesk 开放会话截图 CLI**（或 MCP 通道真的可开），再评估 B；届时要满足：单帧按需、不落盘、面板明确标注「快照，非实时」。这条写在这里，免得下次重新讨论。

## 四、代价

- 用户要在两个窗口之间切换：面板发起，ToDesk 窗口看画面。这是 ToDesk 的形态，不是插件的缺陷。
- 插件无法在「连上之后」判断是否真的出画：没有会话日志就当没连上，插件只能如实说「已交给客户端」，不能承诺成功。
- 手机端同理：手机上是 ToDesk App 的画面，Astravia 面板不参与。

## 五、验证（Observed）

### 5.1 端到端截图测量（0.4.7）

方法（一次性，脚本未入库）：连接前后各取一次宿主屏幕截图 + 枚举 ToDesk 顶层窗口标题 + 列 `Logs/session*`，设备码由命令行参数传入、不落文件。下表是三处读数在连接前后的对比。

| 测量 | 连接前 | 连接后（命令后 8 s） |
| --- | --- | --- |
| ToDesk 窗口标题 | `诸葛跃的MacBook Neo` | `诸葛跃的MacBook Neo`（**无新增窗口**） |
| `Logs/session*` 新文件 | — | **无** |
| 面板状态 | 运行中，`••••••325` | 已发起的会话行 + 断开按钮 |

结论：命令被接受并进入连接流程，但**没有出现远程画面窗口**——目标端不可达时 ToDesk 不会为它建会话，插件也无从「看到」画面。截图（`.tmp/`）在 60 秒后自动删除，不入库。

### 5.2 命令行证据

以真实设备码发起（号码不写入仓库，测试后即弃）：

```
ToDesk.exe -control -id <code>
→ Logs/service*.log:
   [Hitlog] Hitlog_AddCenterEvent success, eventid: Connect
   client recv connect request, myid=<local> destid=<target>
   client recv connect request, req->server()=<server ip>
→ 5 s 内 Logs/ 无 session*/WEBRTC* 新文件
```

结论：命令链路成立；画面/会话由 ToDesk 客户端与服务端决定，插件不参与、也无法观测。
