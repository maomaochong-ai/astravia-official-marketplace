# ADR 0012：用 ToDesk 官方文档校正决策，并把工具层拆出可测的支撑模块

- **状态：** 已接受（校正 ADR 0010/0011 的修法文案，不改变其工具面与边界）
- **日期：** 2026-11-18
- **版本：** 插件 `todesk` 0.4.14
- **前因：** 前两轮决策都建立在「本机取证」上（CLI 输出、`devlist`、`config.ini`）。用户指出还有一处没查：**ToDesk 官网自己的文档**。查完发现有三处需要校正。

## 一、调研方法（可复现，Observed）

帮助中心是 Nuxt 服务端渲染，`<title>` 对所有页面都是同一个首页标题，所以抓标题没用；正文在 `window.__NUXT__` 的 `doc_info.content` 里，是 Markdown。取法：

```powershell
# 1) 官方站点图：300 条 URL，其中 96 条是帮助中心/FAQ
(Invoke-WebRequest https://www.todesk.com/sitemap.xml -UseBasicParsing).Content

# 2) 任意一页的目录树（89 条），拿到 id → 标题
node -e "fetch('https://www.todesk.com/faq/85.html').then(r=>r.text()).then(h=>{const b=h.slice(h.indexOf('__NUXT__=')+10);eval(b.slice(0,b.indexOf('</script>')))})"

# 3) 单篇正文：/faq/<id>.html 的 doc_info.content
```

本轮取用了 16 篇：无人值守、临时密码与安全密码、隐私屏、禁用被控键鼠、文件传输、远程开机、带宽、画质、日志、设备列表隐私，以及故障库里的「允许控制本设备」「等待对方手动授权」「黑白名单」「自动锁定」。

## 二、官方文档说了什么（Observed，逐条对应 faq id）

| # | 官方原文要点 | 对本插件的影响 |
| --- | --- | --- |
| 16 | 无人值守 = **开机启动**（默认开启）+ **安全密码** | 与我们 readiness 的 `autostart` + `unattended-password` 判定一致；本机 `autostart=0` 属于偏离默认，warn 正确 |
| 17 | 「打开客户端，在**高级设置的安全设置**，可以选择临时密码和安全密码」；临时密码可定时刷新；安全密码是无人值守的固定密码 | **修法路径写错了**：我们此前写「设置 → 安全 → …」，官方路径是「高级设置 → 安全设置」。已全量改正 |
| 19 | 担心别人看到设备列表：**高级设置 → 显示设置 → 界面锁定** | 解释了「客户端被锁定时读不到 `devlist`」的一种可能（Inferred） |
| 102 / 35 | 隐私屏在**远程窗口 → 屏幕 → 隐私屏**；同账号无需被控同意，不同账号需被控本机同意；被控多显示器需系统 > 20H2 | 会话内功能，**无 CLI**；插件只指路，不实现 |
| 27 | 「点击悬浮球菜单，在**控制 → 禁用被控端键鼠**」 | 同上：会话内功能，无 CLI |
| 30 | 文件传输三种方式（右键复制粘贴 / 拖拽 / 文件传输窗口）；Mac 仅支持文件窗口，Linux 需 ≥ 4.7.2.0 | 证伪「插件可以做文件传输」：CLI 无接口，官方也只描述会话 UI |
| 57 | 远程开机四条件：仅 Windows、同局域网另有一台 ToDesk 在线设备、主板 BIOS 开 WOL、网卡驱动开 WOL；**笔记本基本不支持** | 「设备不在线」时不能承诺唤醒；只能讲条件 |
| 29 / 28 | 带宽限制：悬浮球 → 显示 → 高级设置 → 带宽限制；画质：悬浮球 → 显示 → 画质调整（专业版） | 会话内功能，无 CLI |
| 73 | 客户端日志在安装目录的 `Logs` 文件夹 | 与我们读 `%LOCALAPPDATA%\ToDesk\Logs` 与 `Program Files\ToDesk\Logs` 一致；确认不解析二进制日志的决定合理 |
| 94 / 95 / 93 / 96 | 「对方连不上/连上后异常」的四个真实原因：被控关闭**允许控制本设备**、开启**非同账号连接需本设备手动同意**、**黑白名单**、**非同账号连接自动锁定客户端** | 这四条**在本机文件里读不到**（见下），所以进技能排查顺序，不进 readiness 条目 |

### 关键的反向取证

`C:\Program Files\ToDesk\config.ini` 共 61 个键，与连接许可相关的只有：

```
PrivateScreenLockScreen, autoLockScreen, tempAuthPassEx, minsizelock, loginlock,
InactiveLockTime, isStrangeConnectionLock, AuthMode, authPassEx
```

**没有** allow-control / blacklist / manual-approval 这一类键。所以：官方能查到的那四个原因，插件**不能**自动诊断——只能让用户去界面里看。这条写进 ADR，避免以后有人「顺手加个检查」编出一个读不到的字段。

## 三、决策修订

1. **修法文案改为官方路径**：`高级设置 → 安全设置 → 安全密码 / 临时密码 / 二次安全验证 / 连接限制`。改在 `client-posture.ts`（agent 侧 `fix`）、`remote-readiness.ts`、`locales/{en,zh}.json`（面板文案），共 4 个文件、12 处。
2. **四类官方故障原因进技能，不进工具**：`SKILL.md` 增加「对方连不上我」的排查顺序（先 94 允许控制 → 95 手动同意 → 93 黑白名单 → 96 自动锁定），并注明「插件读不到这些开关」。
3. **官方功能指路表进技能**：隐私屏、禁用被控端键鼠、文件传输、远程开机、带宽/画质。每个都写清「会话内 / 硬件条件」与官方菜单路径，避免模型自己造路径。
4. **不新增工具**：官方文档里没有一条能通过 CLI 或本地文件变成新能力的——这正是「11 个工具就是当前上限」的外部验证。

## 四、工程化（本轮同时做）

| 问题 | 处理 |
| --- | --- |
| `register-tools.ts` 400+ 行，既是注册又是工具基础设施 | 抽出 `src/tools/tool-support.ts`：`ToolBridge`、`ToolKey`、能力闸门、两个标准失败应答、`readStatus`、`verifyConnection`、`storeOf` |
| 读客户端存储的接线重复 6 处（`readTextFile` + `listDirectory`） | 收敛为 `storeOf(bridge)`，一处改动生效 |
| 能力闸门是安全边界，却没有独立测试（只能通过 11 个工具间接验证） | 新增 `tool-support.test.ts` 11 项：文件类工具不依赖命令授权、命令类工具依赖、显式 `false` 优先、显式 `true` 绕过探测、全局开关否决、设置读失败不崩、`host_error` 原文透传、`storeOf` 返回错误而不抛、`verifyConnection` 的 unknown 分支 |
| 注册文件职责混杂 | 现在只剩「声明 11 个工具 + 汇总 dispose」，行为全在 domain/support |

模块方向：`domain/`（纯函数：解析、判定、排序）← `features/console/services/`（I/O 组合）← `tools/`（对外契约）。闸门与应答只在 support 里出现一次。

## 五、验证

| 项 | 结果 |
| --- | --- |
| `tsc --noEmit` | 0 |
| `vitest run` | **86 通过**（75 + 11 项闸门/应答测试） |
| 官方路径改正后的测试 | `client-posture` / `remote-readiness` 的 `fix` 断言全部通过（`-setpasswd` 与 `-autostart on` 仍是可执行命令） |
| `node scripts/marketplace.mjs check` | 通过 |
| `node --test tests/*.test.mjs` | 166 通过 / 0 失败 |
| 构建 | `todesk-0.4.14.astraviapkg` |
