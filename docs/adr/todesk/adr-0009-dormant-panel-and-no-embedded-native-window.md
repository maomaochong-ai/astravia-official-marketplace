# ADR 0009：面板默认不打开，以及「把原汁原味的 ToDesk 窗口搬进面板」为什么不做

- **状态：** 已接受
- **日期：** 2026-11-18
- **背景：** 插件 `todesk` 0.4.11；Astravia Desktop 0.5.97；ToDesk 4.8.8.4
- **修订：** [ADR 0008](adr-0008-conversation-scope-and-masking.md) 的「面板默认可见」部分（0.4.10 让 tab 默认上栏，被用户判定为卡）

## 一、面板默认不打开

0.4.10 把活动标签页设成 `initiallyVisible: true`，理由是「不让用户去『+』里找」。实测反馈是**每个会话都要挂载一次面板**：一次真实的 `ToDesk.exe -status`（进程启动 + 输出解析）+ 一棵 React 树，切会话就重来一遍。为了省一次点击付出的代价明显更大。

**决定：**

| 表面 | 默认状态 | 用户动作 |
| --- | --- | --- |
| 侧边栏工作区视图 | 常驻（只是一个导航项，不挂载） | 点进来才渲染 |
| 活动标签页 | `initiallyVisible: false`（**不在栏上**） | 输入栏的 ToDesk 按钮，或侧栏面板「+」 |
| 输入栏按钮（`ui.slot.input-action`） | 常显 | 一点即开面板，且按钮**不常亮**（`onToggle` 返回 `false`） |

保留 0.4.10 的输入栏按钮：它才是「一键打开」，同时不产生常驻挂载。测试断言 `initiallyVisible: false`。

## 二、把 ToDesk 窗口搬进面板：不做，理由是可测量的

用户要的是「原汁原味：能看远端画面、能在画面里点/打字」。要做到，只有一条技术路径：**截取 ToDesk 客户端的窗口 → 贴进面板 → 把鼠标键盘坐标换算后注入该窗口**。它对宿主的要求是：

| 需要什么 | 现状 | 取证 |
| --- | --- | --- |
| 抓窗口像素 | 插件没有窗口捕获权限；宿主只提供 `capture.offscreen`（离屏渲染），不提供任意窗口捕获 | SDK 权限清单：无 `capture.window` |
| 向窗口注入输入 | 需要 `powershell`/Win32 调用，属于**额外命令授权** | 与 ADR-0004 同一套 `grantedCommandNames` 机制 |
| 稳定的窗口身份 | ToDesk 的窗口是 `H-SMILE-FRAME`，且**主窗口默认不可见**（藏托盘），会话窗口由客户端自己创建/销毁 | 见下方探测输出 |

探测方式（一次性、只读、不注入输入；脚本不入库）：`Get-Process ToDesk` 取 PID，用 `EnumWindows` 枚举这些 PID 的顶层窗口，读 `GetClassName` / `GetWindowRect` / `IsWindowVisible`。等价的现成工具是 Spy++ 或 Process Explorer 的窗口面板。输出：

```json
{ "screen": "2560x1440", "todeskProcessCount": 2,
  "topLevelWindows": [
    { "class": "H-SMILE-FRAME", "title": "ToDesk", "visible": false, "width": 900,  "height": 568 },
    { "class": "H-SMILE-FRAME", "title": "ToDesk", "visible": false, "width": 745,  "height": 608 },
    { "class": "CClipboardThread",   "visible": false },
    { "class": "DropFileWindowClass","visible": false } ],
  "cliMentionsCapture": false }
```

三条结论都能从这份输出直接读出来：

1. **窗口不可见**：要抓的是「远端画面窗」而不是托盘主窗，而它只在会话建立后、由客户端按自己的布局创建——插件没有稳定句柄可绑。
2. **尺寸与 DPI 由客户端决定**：745×608 / 900×568 两种尺寸并存，面板宽度变化时截图像素要么被拉伸要么出现黑边；点/打字的坐标换算必须跟着窗口缩放走，一次窗口拖动就会偏移。
3. **没有任何流式接口**：`-help` 里没有 screen/capture/screenshot/stream（`cliMentionsCapture: false`），所以只能「定时截图 + 合成输入」，这是在插件里手搓一个远控客户端。

**决定：不做内嵌。** 保持 [ADR 0006](adr-0006-screen-lives-in-todesk-window.md) 的口径：面板负责发起/结束会话，画面在 ToDesk 自己的窗口里；面板上用一句话说明画面在哪，并给「打开 ToDesk」按钮把它调到前台。

### 什么时候这条会被推翻

如果出现下面任一条件，重新评估（届时要写新 ADR，而不是在本文件里改口）：

- 宿主向插件开放**窗口捕获**权限（不是 `capture.offscreen`）；
- ToDesk 提供「导出会话画面」的接口（CLI 或 SDK）；
- 宿主自己实现「宿主内嵌任意窗口」的 surface。

## 三、对话形式控制：已经成立，补了每轮的提示

`todesk_*` 五个工具与「面板是否打开」无关，安装 + 宿主授权命令后即可在对话里调用。0.4.11 追加一条**每轮注入的系统提示块**（`todesk-capability`，4 行），让模型不必依赖用户点技能名：

- 先 `todesk_status`；
- `todesk_connect` 需要**设备码 + 对方临时密码**；
- `todesk_disconnect` 走 `-exit`；
- 明确禁止声称「看到了远端画面 / 在远端点过按钮」。

## 四、代价

- 用户要多点一次（输入栏按钮或侧栏「+」）才能打开面板。
- 每轮多 4 行提示词；换来的是「对话里说一句就能用」而不依赖技能选择器。
- 画面仍然只能在 ToDesk 窗口里看——这是产品边界，不是本轮取舍。

## 五、验证

| 项 | 结果 |
| --- | --- |
| `tsc --noEmit` | 0 |
| `vitest` | 40 项通过（含 `initiallyVisible: false`、输入栏按钮只开面板、提示块内容） |
| `vite build` | `todesk-0.4.11.astraviapkg`，18 个运行时文件（+1 = 提示块模块） |
| 探测 | 只读窗口枚举（一次性，未落脚本）；输出即上方 JSON，未注入任何输入 |
