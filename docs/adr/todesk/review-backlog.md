# 审查遗留项

来源：两轴独立审查（固定点 `e584a423` → `8fc5a74d`，Standards 轴 + Spec 轴各一个子代理）。

## 已全部关闭

| 组 | 项 | 关闭于 | 做法 |
| --- | --- | --- | --- |
| 缺陷 | `stale-session` 缺时间判据 | 0.4.16 | 标记已连接 **且** 最后连接早于 12 小时才算残留；`now` / `staleAfterMs` 可注入；近期连接的会话不报 |
| 缺陷 | `autostart` remedy 的「同上」悬空 | 0.4.16 | 两分支共用完整路径常量 |
| A1 | `src/agent/` 不在文档允许的位置 | 0.4.17 | 移到 `src/features/tooling/services/tool-runtime.ts`（文档指定的 `features/<f>/services/`） |
| A2 | 用户可见副本放在 `domain/` | 0.4.17 | 移到 `src/features/tooling/copy/access-fixes.ts` 并改为**注入**：`postureFindings(posture, fixes)`、`ReadinessInput.fixes`。`domain/` 不再持有文案 |
| A3 | 测试集中在 `src/test/` | 0.4.17 | 10 个测试文件迁到被测模块旁边；`vitest` 改为 `src/**/*.test.*`；`src/test/` 删除 |
| B1 | preflight 抄了工具 id / 安装路径 | 0.4.17 | 改为从 `src/tools/register-tools.ts` 与 `src/domain/todesk-cli.ts` 现读；新增 `tool-ids.test.ts` 断言它不得再自带清单 |
| B2 | 工具 id 由"跑命令"的模块持有 | 0.4.17 | id 回到 `tools/register-tools.ts`，并导出 `TOOL_IDS` 供漂移测试用 |
| B3 | `ResolutionX` / `ResolutionY` 声明未用 | 0.4.17 | 删除 |
| B4 | `num()` 名字没说返回值规则 | 0.4.17 | 改名 `toFiniteNumber`，补注释 |
| B5 | readiness 里两种 null 写法 | 0.4.17 | 统一为 `const saved = input.devices`，之后 `saved ?? []` / `saved !== null` |
| B6 | `client-posture` 的 import 压在文件头注释上 | 0.4.17 | import 移到注释之后 |
| B7 | `describeDevice` 手抄 profile 六个字段 | 0.4.17 | 直接 `last_session: device.profile`，字段名以类型为准 |
| C3 | ADR-0013 只列了 3 项审查结论 | 0.4.17 | 补为 3 硬违规 + 6 判断项 + Spec 轴 2 处 violated，差额指向本文件 |

## 有意保留的偏离（不是遗漏）

- **A2 的文案仍是中文**：审查建议"值改为 locales 键，由 tool 层渲染"。本轮做的是**位置与所有权**（离开 `domain/`、单一定义、调用方注入），没有把 10 条菜单路径搬进 `locales/`——agent 侧要能照抄的中文路径，面板侧要本地化文案，两者需求不同；硬合并会让 agent 收到无法执行的 i18n 键。要双语，应拆成 `fix.access.*`（面板）与英文命令/路径（agent）两套，属独立改动。
- **B1 的 `-status` 解析仍有两份**：preflight 用一条宽松正则取设备码与版本，`domain/todesk-cli.ts` 的 `parseStatus` 是权威。preflight 在**安装前**运行，不能依赖构建产物，所以保留；风险是 ToDesk 改输出格式时它先失效——那时 preflight 只报"未就绪"，不会误报就绪。

## 已知局限（不是 bug，别当 bug 修）

- `IsConnected` / `RecentConnectTime` 是客户端写下的快照，ToDesk 不提供实时会话状态；`established`、`stale-session` 都只能当旁证。
- 会话内功能（隐私屏、禁用被控键鼠、文件传输、打印、多屏、画质/带宽）无 CLI，只指路。
- 本机 `devlist` 里 `Mac-B0L7Z7` 行自 11-17 起一直是 `connected=true`。0.4.16 之后它会被判为残留会话并给出修法——这是正确行为。
