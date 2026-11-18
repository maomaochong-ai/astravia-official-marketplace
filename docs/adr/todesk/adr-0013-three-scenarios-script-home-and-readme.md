# ADR 0013：三条官方场景落地，脚本归插件，README 去掉决策引用

- **状态：** 已接受
- **日期：** 2026-11-18
- **版本：** 插件 `todesk` 0.4.15

## 一、三条场景（来自 ADR 0012 末尾的性价比排序，官方篇目 90 / 104 / 26·34·46）

| 场景 | 官方依据 | 实现 | 为什么算"能做" |
| --- | --- | --- | --- |
| 残留会话占通道 | faq 90：出门忘断开，回来提示"通道限制" | `assessReadiness` 新增 `stale-session` warn：**标记为已连接且最后连接早于 12 小时**（`now` / `staleAfterMs` 可注入）才算残留；列出设备名与最后连接时间，修法 `-exit` 或 个人中心断开。近期连接的会话不报——0.4.16 补上这半条判据 | `devlist_*.json` 的 `IsConnected` 可读；本机 Mac 行至今是 `1` 而最后连接为 11-17，正是现场证据 |
| 自启设了没生效 | faq 104：Windows「快速启动」会沿用旧启动状态 | 新增 `judgeAutostart(requested, observed)`：`applied: true/false/null`，不一致时给官方 `remedy`；`-autostart` 工具返回 `applied` | `-status` 本来就回读 `Start ToDesk with Windows`，缺的只是判定 |
| 上次会话怎么显示的 | faq 26 / 34 / 46：双屏切换、分辨率、画质 | `SavedDevice.profile`（`screen / screenMode / resolution / quality / fps / hd`），`todesk_devices` 与 `describeDevice` 输出 `last_session` | `devlist` 已存 `ScreenId / ScreenMode / Width / Height / Quality / Fps / HD` |

三条都遵守同一原则：**读得到就说，读不到就说不知道**。

- 残留会话是客户端写下的快照，不是实时状态 → 判据叠加"最后连接早于阈值"，文案带上最后连接时间；两者都拿不到时按残留处理并注明"时间未知"。
- 自启字段没被报告时是 `applied: null`（未验证），不是失败。
- `Width/Height = -1` 是客户端的"未选择"标记 → 不翻译成尺寸（有测试）。

## 二、脚本归位

`scripts/todesk-preflight.mjs`（仓库根）→ `abilities/plugins/todesk/scripts/preflight.mjs`。

- 仓库根的 `scripts/` 是**市场发布工具链**（`marketplace.mjs`、`publish-marketplace.mjs`、`static-marketplace.mjs`…），插件的自检脚本放那里把两者混成一类。
- 插件目录内的 `scripts/` 属于运行内容（仓库规则：`scripts/` 变更需抬版本），所以这次抬版本是必然的。
- 用法不变，只是路径：`node scripts/preflight.mjs`（在插件目录内）。

## 三、README 去掉决策引用

README 改成标准 README：是什么、怎么装、装完要过的命令授权、对话能做什么、面板结构、连不上时按官方四类原因排查、边界、权限、开发命令、排错。**不再链接任何 ADR**——决策属于 `docs/adr/`，README 只对使用者负责。

## 四、代码审查（两轴，见交付说明）

由两个并行的子代理分别执行「仓库标准 + Fowler 气味基线」与「本轮 spec」两轴。完整结论是 **3 项硬违规 + 6 项判断项 + Spec 轴 2 处 violated**；0.4.15 只修了其中 3 处，其余 13 项已于 0.4.16 / 0.4.17 关闭（差额见 [review-backlog](review-backlog.md)）：

| 轴 | 发现 | 处理 |
| --- | --- | --- |
| Standards（目录职责） | `src/tools/tool-support.ts` 里没有工具，`tools/` 按仓库规范只放注册给 Agent 的工具 | 移到 `src/agent/tool-runtime.ts`，名字说明它是什么 |
| Standards（Duplicated Code） | `client-posture` 与 `remote-readiness` 各写一遍同样的修法字符串——上一轮路径写错就是这么来的 | 新增 `domain/access-fixes.ts`，两处共用一份 |
| Standards（Speculative Generality） | `verdictSummary()` 只被自己的测试调用，面板用的是本地化文案 | 删除函数与其测试 |

## 五、验证

| 项 | 结果 |
| --- | --- |
| `tsc --noEmit` | 0 |
| `vitest run` | **96 通过 / 10 文件**（新增 `autostart` 4 项、`stale-session` 4 项、`last_session` 3 项） |
| `node scripts/preflight.mjs`（插件内） | 退出码 0，列出 11 个工具 |
| `node scripts/marketplace.mjs check` | 通过 |
| `node --test tests/*.test.mjs` | 166 通过 / 0 失败 |
| 构建 | `todesk-0.4.15.astraviapkg` |
