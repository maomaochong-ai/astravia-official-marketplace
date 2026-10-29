# 模块：工具链、权限与宿主边界

插件自己**不带**工具链：它探测你现在有什么、给出精确的安装命令、把缺什么说清楚。
这一层还决定「哪些事插件能做、哪些必须由宿主批准」。

## 能做什么

| 工具 | 作用 |
| --- | --- |
| `probe_environment` | radare2 家族 / jadx / apktool / java / adb / apksigner / zipalign / frida 逐个 `--version`，并区分「宿主拒绝」与「没装」 |
| `install_toolchain` | 按目标（`apk` / `native` / `firmware` / `dynamic` / `full`）给出**本平台**的安装命令 |
| `ida_status` | 只报 127.0.0.1:13337 有没有在听；不启动、不驱动、不读许可 |
| `run_radare` | 用你**自己的** r2：格式信息、全节字符串、函数表、反汇编、伪 C、交叉引用、汇编、二进制比较 |

## 两种失败必须分清

`probe_environment` 的输出里，这两种长得像但成因完全相反：

- **host refused** —— 宿主没放行（`plugin.json#commands` 没声明、被关闭、`agent.command.run` 未授权）。装什么都没用。
- **not found** —— 可执行文件不在 `PATH`。`install_toolchain` 给的命令能修。

假装它们一样，会让人反复重装软件。`probe_environment` 缓存一分钟，装完东西要 `refresh=true`。

## 权限面

`plugin.json` 的 `permissions` 是**清单字符串**，不是被调用的函数名。判定一条权限是否在用，
必须按 [`@astravia-org/plugin-sdk/docs/permissions.md`](../../../node_modules/@astravia-org/plugin-sdk/docs/permissions.md)
的权限表反查 API，不能数标识符出现次数。当前三条全部在用：

| 权限 | 对应 API | 出处 |
| --- | --- | --- |
| `agent.session.read` | `ctx.conversation.on(...)` | `src/index.tsx:163` |
| `agent.session.write` | `sendPrompt` / `insertText` / `abort` | 面板发送与一键提问 |
| `ui.slot.activity-tab` | `ctx.ui.registerActivityTab(...)` | `src/index.tsx:235` |

这条方法学写在 [`../audits/capability-gap-2.13.1.md`](../../audits/capability-gap-2.13.1.md) §4.5 ——
2.13.1 那轮审计曾把这三条误判为「僵尸」，后续更正，一条都没删。

## 浏览器沙箱的硬边界

`promptContexts` 是同步、无 `ctx`、跑在浏览器里的函数。**不能出现 `node:fs`**：
CI 打包会报 `"existsSync" is not exported by "__vite-browser-external"`。需要判断文件是否存在时，
靠宿主给的 cwd 字符串与工具入参，不要在提示层做文件探测。

## 代码入口

- `src/domain/toolchain/catalog.ts` — 42 项工具、逐平台安装配方、`detectPlatform` / `resolvePlatform`。
- `src/tools/env/*.ts` — 三个环境工具；`src/tools/lib/command.ts` 是命令通道封装。
- `src/domain/native/` 之外的所有外部调用都走宿主的 `agent.command.run`，插件不自己开子进程。

## 相关文档与测试

- 事实表（**测试直接读**）：[`../reference/toolchain-parity.md`](../../reference/toolchain-parity.md)
- 时点观察：[`../audits/toolchain-bundling.md`](../../audits/toolchain-bundling.md)
- 测试：`src/test/tools/{toolchain,ida-status,tools,tool-index}.test.ts`
