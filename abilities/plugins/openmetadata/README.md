# OpenMetadata 插件

将 [OpenMetadata](https://open-metadata.org/) 开源数据目录平台集成为 Astravia 桌面插件。

插件让宿主 AI Agent 能够：
- 搜索元数据资产（关键词 + 语义）
- 查看表/仪表板/管线的完整详情
- 分析数据血缘（上游/下游依赖追踪）
- 诊断数据质量根因（失败测试 → 遍历上游）
- 创建治理实体（Glossary/Domain/Metric）
- 执行 RDF 知识图谱查询（SPARQL，条件启用）

## 架构

插件启动一个薄 Node.js 代理进程（`server/main.mjs`），转发请求到用户自建的 OpenMetadata 实例。AI Agent 通过插件暴露的 13+ 个 MCP 工具与 OM 交互。

```
宿主 Agent → 插件 MCP 工具 → 本地代理进程 → 用户的 OpenMetadata /v1/* REST API
```

详见 `docs/` 目录下的 ADR 设计文档。

## 目录

```
docs/                    ADR 架构决策文档
agent/skills/openmetadata/  Agent SKILL.md + references
server/                  本地代理进程（Node.js）
src/                     插件前端
```

## 开发

```bash
npm install
npm run dev
npm run build
```

启动前先读 `AGENTS.md` 和 `docs/adr-0001-connection-model-and-auth.md`。
