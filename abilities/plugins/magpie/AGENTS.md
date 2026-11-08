# 在这个插件目录里工作

契约手册在仓库根的 `AGENTS.md` 和 `docs/plugin-project-structure.md`。这里只写这个包特有的部分。

## 定位

这是一个**连接器**，不是一个运行时。magpie 是用户自己装、自己启动的外部程序；插件不安装、不启动、不打包它。

所以在动手之前先想清一件事：**这个改动会让插件开始拥有 magpie 的生命周期吗？** 如果会，先停下——五平台二进制各 15–25 MB，包体硬上限 50 MB，随包分发没有可行性，单平台拆包又会破坏平台无关的包模型。README 的「What it does not do」是这条边界的正式表述。

## 目录职责

```text
src/gateway-endpoint.ts   设置类型、默认值、URL 拼装、fail-closed 归一化（纯函数）
src/gateway-client.ts     两个 HTTP 调用的唯一出口，失败原因收敛成封闭枚举
src/model-catalog.ts      /v1/models 解析、宿主模型映射、统计、过滤、格式化（纯函数）
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
