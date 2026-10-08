# codebase-memory-mcp

[DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp)（46k★，MIT，纯 C 单二进制）的市场登记条目——**本条目只做登记，源码与二进制均在官方 release**。

## 能力

- 162 语言 tree-sitter AST 解析 + Hybrid LSP 语义解析（10 语言），构建持久知识图谱：函数、类、调用链、HTTP 路由、跨服务链接；
- 平均仓库毫秒级索引（Linux 内核 3 分钟），结构查询亚毫秒级；
- 17 个 MCP 工具：search / trace / architecture / impact 分析 / Cypher 查询 / 死代码检测 / 跨服务 HTTP 关联 / ADR 管理等；
- 100% 本地：无语言运行时、无 API key、代码不出机器；内置 3D 图谱可视化（localhost:9749）。

## 安装

安装后由 Astravia 按本机平台自动下载对应二进制（SHA-256 已随条目锁定，与官方 release 逐字节一致）。索引首次构建在仓库根执行 `install` 或由 agent 触发。

## 许可

上游 MIT。登记条目仅提供索引，不分发二进制。
