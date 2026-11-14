# 在这个插件目录里工作

契约手册在仓库根的 `AGENTS.md` 和 `docs/plugin-project-structure.md`。这里只写这个包特有的部分。

## 定位

定位分两层，不要混：

- **连接器**（默认）：把用户已经装好的 magpie 接进来——探 `/api/version`、读 `/v1/models`、写宿主模型注册表。
- **可选的一键安装**（0.1.4 起）：用户点「安装并启动」才发生。包体仍然不带任何二进制（五平台各 15–25 MB，硬上限 50 MB）；插件做的是“取回 → 核 sha256 → 落到用户目录 → 拉起子进程”，而且只在点到按钮时。

执行面有两套（`src/platform-shell.ts`）：POSIX 用 `sh`，Windows 用 `powershell`。生命周期由 `src/runtime-manager.ts` 持有，经 `ctx.command` 执行——`ctx.command` 必须由宿主授权，未授权时面板给 `runtime.denied` 而不是静默失败。

改这块前先想清：**这个改动会让插件开始默认拥有 magpie 的生命周期吗？** 不应谈——默认仍是不托管，自启只在用户曾经点过「运行」之后（`runtime.json` 的 `desiredRunning`）。

## 目录职责

```text
src/gateway-endpoint.ts   设置类型、默认值、URL 拼装、fail-closed 归一化（纯函数）
src/gateway-client.ts     两个 HTTP 调用的唯一出口，失败原因收敛成封闭枚举
src/model-catalog.ts      /v1/models 解析、宿主模型映射、统计、过滤、格式化（纯函数）
src/platform-shell.ts       执行面（sh / powershell）、两套脚本、同一套行协议（纯函数）
src/runtime-manager.ts      二进制探测 / 安装 / 启动 / 停止，只经 ctx.command
src/controller.ts         状态机：探活 → 读目录 → 发布/移除；视图与工具共用
src/tools/                两个只读 Agent 工具（ctx.agent.registerTool）
src/features/gateway-view/components/   一个文件一个组件
src/plugin-ids.ts         视图 id / provider id / 工具 id
```

新端点加进 `gateway-endpoint.ts`，新调用加进 `gateway-client.ts`。不要在组件里直接 `ctx.network.request`，也不要让组件自己拼 URL。

## 两条硬约束

1. **写入必须来自用户的点击。** `controller.publish()` / `disconnect()` 只由按钮调用；`hydrate()` 与 `refresh()` 永远不写宿主模型注册表。这有测试守着（`test/controller.test.ts`）。
2. **空目录不写。** 空白名单会被当成「删除全部」，所以空目录返回 `error.emptyModels` 而不是写空表。

## 幂等与掩码

`ctx.models.listOwnedProviders()` 回读的 `apiKey` 是掩码，不能继承。发布时先读回一次，只沿用 `displayName`，凭据永远写本次设置里的真实值。

## 验证

```bash
npm run check            # tsc --noEmit
npx vitest run           # 49 个用例：解析 / 归一化 / 状态机 / 发布
npm run build            # 产出 release/magpie-<version>.astraviapkg
```

本地构建不会真的连网关；`test/controller.test.ts` 里的假 ctx 覆盖了在线、拒绝连接、超时、冒充、目录报错、空目录、发布与移除。
