# ADR 0004：插件跑不动的原因在宿主的「命令授权」，不在路径

- **状态：** 已接受
- **日期：** 2026-11-18
- **背景：** 插件 `todesk` 0.4.2；Astravia Desktop 0.5.97；ToDesk 4.8.8.4
- **修订：** [ADR 0003](adr-0003-tools-over-cli-not-over-mcp.md) 的「装完即可用」——装完还要过一次宿主的命令授权

## 一、症状

安装后报：

```
Plugin: todesk@0.3.0 (ToDesk 远程控制)
Error: ToDesk.exe not found
    at …dist/assets/index-DyfSJO6F.js
```

`ToDesk.exe` 明明在 `C:\Program Files\ToDesk\`，而且命令行直接跑得通。所以「not found」是**我们自己的兜底文案**，把真正的原因盖住了。

## 二、取证：拿到宿主的原话

0.4.x 在激活时做一次启动探测，并把结果写进插件私有存储。装 0.4.1 后读 `~/.astravia/plugin-data/todesk/.storage/objects/*.bin`：

```json
{ "lastLaunch": { "ok": false, "source": null, "deviceId": null,
  "error": "Plugin todesk command disabled by user: ToDesk.exe",
  "at": "2026-11-17T17:27:43.020Z" } }
```

宿主自己的安装记录（`~/.astravia/plugins-manifest.json`）里：

```json
"todesk": { "version": "0.4.1", "grantedCommandNames": [], "enabled": true }
```

**结论：宿主对每条 `plugin.json#commands` 单独授权，`grantedCommandNames` 为空 = 全部拒绝。** 命令行安装（`plugins.manage` 的 `install-from-path`）只带 `grantedPermissions`，没有命令这一项，所以从 CLI 装进去的插件**一条命令都跑不了**；图形界面安装的批准弹窗里才会勾选命令。

验证：把 `grantedCommandNames` 改为 `["ToDesk.exe"]` 并 `reload`，同一次探测立刻变成

```json
{ "lastLaunch": { "ok": true, "source": "cli", "deviceId": "…", "error": null } }
```

且该授权在后续升级（0.4.2 覆盖安装）后仍然保留。

## 三、决定

### 3.1 两处调用形式都留着，但路径不再是嫌疑

宿主不会再让插件 spawn 一个项目根之外的绝对路径，所以调用形式固定为：

```
file: "ToDesk.exe"
env:  { PATH: "C:\\Program Files\\ToDesk;<原 PATH>" }
```

`ToDesk.exe` 这个**裸名字**正好也是 `commands` 白名单被校验的对象。`runTodesk()` 依次尝试两个默认安装目录，并保留宿主抛出的原始错误文本。

### 3.2 「找不到可执行文件」不再是我们编的话

- `ConsoleDeps.run` 原样返回宿主的异常文本；
- 面板检测到 `/disabled by user/i` 时，改说人话：「宿主还没给本插件授权 ToDesk.exe。授权一次即可：设置 → 插件 → ToDesk → 命令（或在安装批准弹窗里勾选），然后点检测」；
- 工具的返回值里带 `host_error`，Agent 可以复述原因而不是猜。

### 3.3 两个开关的关系写死

| 开关 | 谁拥有 | 语义 |
| --- | --- | --- |
| `grantedCommandNames` | 宿主 | 这条命令**能不能用**（安装批准或插件设置里勾选） |
| `allowCommands` | 插件面板 | 用户**要不要让 Agent 用**它（关掉即停用工具） |

默认值不再互相打架：面板开关**未设置时**跟随宿主授权（`source === "cli"` 说明命令真的跑起来了）；用户显式关掉则以用户为准。工具侧同一条规则，未设置时先探一次 `-status`。

### 3.4 安装就是授权点

用户明确要求「不要在添加时限制死，而是让用户选择命令权限」。宿主的批准弹窗本来就是那个选择点，所以：

- 插件只声明**一条**命令 `ToDesk.exe`，不夹带 `cmd` / `powershell`；
- 从命令行安装（脚本、CI、自动化）会跳过这个选择 —— 面板必须能把它找回来，这就是 3.2 的文案与 4 的验证步骤。

## 四、面板简化（同一轮）

五张卡片 + 34 行工具表挤在第一屏，日常动作（读设备码、连一台机器）被设置材料埋掉。改为：

1. **这台电脑** —— 设备码、运行状态、开机自启开关；
2. **连到另一台电脑** —— 账号设备列表（通道开时）+ 一行设备码/密码输入；
3. **高级**（默认收起）—— 命令授权说明、通道状态与 Token、入站二维码、工具清单。

## 五、代价

- 面板不再展示「宿主命令授权」的实时真值（SDK 没有查询接口），只能用「最近一次 CLI 探测是否成功」推断；文案因此写成「已允许 / 尚未授权」，而不是给出勾选框。
- 命令行安装的路径天然缺授权，这是宿主行为，插件只能补救说明，不能代替授权。

## 六、验证（本机实测，Observed）

| 步骤 | 结果 |
| --- | --- |
| `PATH` 前置安装目录后跑 `ToDesk.exe -status` | 返回 `ToDesk ID / Start ToDesk with Windows / PID`，退出码 1（正常） |
| `ToDesk.exe -autostart on` → `-status` | `Start ToDesk with Windows: OFF` → `ON`，写操作生效 |
| `ToDesk.exe -control -id <本机设备码>` | 进程正常退出（自连不会真正建立会话），参数形式被接受 |
| 0.4.1 安装后读插件存储 | `error: "Plugin todesk command disabled by user: ToDesk.exe"`（复现用户报错） |
| 授予 `grantedCommandNames` 后 `reload` | `lastLaunch.ok: true`，`source: "cli"` |
| 0.4.2 覆盖安装后复查 | 授权保留，`lastLaunch.ok: true` |
| `tsc --noEmit` / `vitest` | 0 / 77 项通过 |

> 测试用的设备码只出现在终端输出与插件私有存储里，**没有写入仓库任何文件**；ADR、README、测试夹具一律使用 `123456789`。
