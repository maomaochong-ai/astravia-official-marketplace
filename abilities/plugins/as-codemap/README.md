# as-codemap · 代码图谱插件

零依赖的 TypeScript/JavaScript 符号-引用图：右侧面板浏览符号与调用关系，agent 用 `code_graph_query` 精确定位，免去全树 grep。

## 能力

- **解析层**（`src/parser/symbol-graph.ts`，纯函数、零依赖）：从 ts/tsx/js/jsx/mjs/cjs 提取 function/class/method/const/interface 声明与跨文件引用计数；单文件 512KB / 5000 行 / 总数 5000 封顶，跳过 dot 目录与 node_modules/dist/out。
- **右侧面板**（workspace-view 插槽）：按工作区展示符号列表 + file:line；图谱按 workspace root 分片存 storage。
- **agent 工具 `code_graph_query`**：名称子串 + kind 过滤查询符号，附带引用计数；工具描述明示「拓扑导航用，重构级精度请读原文件」。

## 精度取舍（诚实声明）

不引入 web-tree-sitter（仓库无该依赖，插件需自带 wasm，分发体积与构建链成本高）。词法提取对 TS/JS 结构足够做导航，对同名局部变量可能有假阳性——上层描述已明示，后续可无损替换为 tree-sitter 实现（图模型与接口不变）。

## 权限

`ui.slot.workspace-view` · `agent.tools.register` · `agent.toolHandler.execute` · `fs.read` · `storage.read` · `storage.write` · `shell.openExternal`

## 许可

Apache-2.0
