# 模块：外部 MCP 服务器

插件自己**不需要** MCP：31 个工具是宿主的原生工具，直接读字节、直接返回结果。外部 MCP 只在
「插件不拥有的能力」上才有意义——例如真要驱动 IDA Pro、要开浏览器、要跑别人的 JS 逆向链。

上游把它放在 `Tool/mcp/mcp.json.template`，注册四个服务器（`seep` / `ida` / `playwright` / `js-reverse`）。
插件对应的态度是：**前一个不需要，后三个可选**，配置给现成的，粘进宿主即可。

## 上游四个 vs 插件

| 上游服务器 | 作用 | 插件的对应物 |
| --- | --- | --- |
| `seep`（Python stdio，`Tool/mcp/seep_mcp_server.py`） | 把 r2 / jadx / apktool / Hook / 知识库包成 MCP | **不需要**：这些已经是插件原生工具（`run_radare`、`decompile_android`、`generate_hook`、`search_docs`）。多一层 Python 反而多一处版本漂移 |
| `ida`（`ida_pro_mcp`） | 借用 IDA 的反编译器与交叉引用 | 可选。`ida_status` 只探测 `127.0.0.1:13337`，不启动、不驱动 |
| `playwright`（`@playwright/mcp`） | 浏览器自动化 | 可选。插件没有任何浏览器能力 |
| `js-reverse`（`js-reverse-mcp`） | 前端签名链还原 | 可选。路由表 R3 指向的技能已在包内，工具在外 |

## 可粘贴的配置

```jsonc
{
  "mcpServers": {
    // 有 IDA Pro 时装这个；IDA 一侧要先起 ida_pro_mcp 的桥（默认 127.0.0.1:13337）
    "ida": {
      "command": "<IDA_PYTHON>",
      "args": ["<IDA_ROOT>/Lib/site-packages/ida_pro_mcp/server.py"],
      "env": { "PYTHONIOENCODING": "utf-8" },
      "transport": "stdio"
    },
    // 需要交互式页面、登录态、截图时装这个
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--extension"],
      "transport": "stdio"
    },
    // 还原前端签名链时装这个
    "js-reverse": {
      "command": "npx",
      "args": ["-y", "js-reverse-mcp"],
      "transport": "stdio"
    }
  }
}
```

三条注意：

1. 路径是**占位**。`<IDA_PYTHON>` 要指向 IDA 自带的解释器，不是系统 Python——版本不匹配会在桥接时崩。
2. 不要在插件里塞 `seep` 那份配置：它会把同一批能力以第二套工具 id 暴露出来，模型会两边各调一次。
3. 装 MCP 不需要改插件权限；它们由宿主自己管理生命周期。插件只在你问「IDA 桥通了吗」时报一个状态。

## 什么时候不要装

- 只用插件做静态体检 + APK 分析：**一个都不需要**。
- 已经用 `run_radare` 能拿到的东西（伪 C、交叉引用、字符串）：不需要 IDA，装了也不会更准，只会更慢。
- 只想验证签名 / 脱壳 / 反编译：`verify_signature`、`frida_dump`、`decompile_android` 已经覆盖。

## 相关

- 工具阶梯与探测：[`toolchain-and-limits.md`](../toolchain-and-limits/dev.md)
- 上游原文档：`Tool/docs/MCP-SETUP.md`、`Tool/docs/README_MCP.md`（在 2.0 便携包内）
- 判定表：[`../reference/toolchain-parity.md`](../../reference/toolchain-parity.md)
- 测试：`src/test/tools/ida-status.test.ts`
