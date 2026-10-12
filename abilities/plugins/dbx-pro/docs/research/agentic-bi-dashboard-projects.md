# 智能体生成 BI 仪表板 / 数据大屏 — 开源项目清单

调研时间：2026-10-11
调研范围：GitHub 上「AI Agent / LLM 驱动的 BI 仪表板与数据大屏生成」相关开源项目

## 调研方法与数据来源

每个条目都通过 GitHub REST API (`/repos/{owner}/{repo}` 或 `/search/repositories`) 实地核实，
链接、星数、许可证、推送时间均取自 API 的真实返回值，非记忆或推测：

- 字段来源：`stargazers_count`、`license.spdx_id`、`created_at`、`pushed_at`、`archived`
- 星数为查询时刻快照；`pushed_at` 用于判断项目是否仍在维护
- 已剔除检索命中的无关仓库（GitHub 关键词检索存在噪声）

**核验口径（重要）**：所有仓库的存在性、名称、星数、许可证、推送时间均来自 API 权威响应；
但 `archived`（归档）字段只对重点条目逐一查了 `/repos/{owner}/{repo}`，其余条目取自检索结果。
写归档状态时我只写了已确认的（如 vanna、TaskWeaver），未逐条排除“其余也归档”的可能。
另外本次环境中 `github.com` 网页端点不可达（返回 000），故无法用网页双重校验，只能依赖 API。

---

## 一、结论速览：按需求选型

| 你的需求 | 首选 | 备选 |
| --- | --- | --- |
| 智能体对话生成完整 **BI 仪表板** | WrenAI | Lightdash、DB-GPT、SQLBot |
| 智能体**一句话生成数据大屏**（中文生态） | JimuReport / JimuChatBI | DataRoom、jeecgboot/skills |
| 让现有 Agent（Claude Code 等）**直接出图表** | antvis/mcp-server-chart | VMind、lieflat-charts |
| 让智能体**操作已有 BI 平台** | googleapis/mcp-toolbox | metabase-mcp 系列、powerbi-mcp |
| 大屏前端**可视化底座**（自行接智能体） | AJ-Report | OpenDataV、GoView |

---

## 二、GenBI / 智能体数据问答与仪表板生成

这一类的共同特征：智能体基于语义层/上下文层，把自然语言变成 SQL → 图表 → 仪表板。

| 项目 | 星数 | 许可证 | 最近推送 | 说明 |
| --- | --- | --- | --- | --- |
| [Canner/WrenAI](https://github.com/Canner/WrenAI) | 17839 | NOASSERTION | 2026-10-09 | 自称 GenBI：面向 AI Agent 的受治理 text-to-SQL + 开放上下文层，本方向最主流选择 |
| [OtterMind/Chat2DB](https://github.com/OtterMind/Chat2DB) | 28310 | NOASSERTION | 2026-10-09 | 原 Chat2DB，跨平台数据库客户端/SQL 工作台，含 AI 出图能力（仓库已迁移，勿用旧地址） |
| [eosphoros-ai/DB-GPT](https://github.com/eosphoros-ai/DB-GPT) | 20114 | MIT | 2026-10-04 | 开源 agentic AI 数据助手，AI + Data 全家桶 |
| [microsoft/data-formulator](https://github.com/microsoft/data-formulator) | 17552 | MIT | 2026-10-08 | 微软，交互式 AI 数据分析与可视化生成 |
| [Kanaries/pygwalker](https://github.com/Kanaries/pygwalker) | 15983 | Apache-2.0 | 2026-09-05 | 把 DataFrame 变成可交互可视化界面，常被 Agent 当出图后端 |
| [evidence-dev/evidence](https://github.com/evidence-dev/evidence) | 7000 | MIT | 2026-10-09 | BI as code：用 SQL + Markdown 构建交互式可视化，对智能体改写友好 |
| [dataease/SQLBot](https://github.com/dataease/SQLBot) | 6880 | NOASSERTION | 2026-10-10 | 基于大模型 + RAG 的智能问数系统，DataEase 团队出品 |
| [lightdash/lightdash](https://github.com/lightdash/lightdash) | 6182 | NOASSERTION | 2026-10-11 | 自我定位 "Agentic BI" |
| [rilldata/rill](https://github.com/rilldata/rill) | 2937 | Apache-2.0 | 2026-10-10 | 自我定位 "the fastest BI tool for humans and agents" |
| [sqlchat/sqlchat](https://github.com/sqlchat/sqlchat) | 5843 | MIT | 2026-04-21 | 对话式 SQL 客户端与编辑器 |
| [apconw/Aix-DB](https://github.com/apconw/Aix-DB) | 2253 | - | 2026-10-10 | 基于 LangChain/LangGraph + MCP Skills 多智能体协作，实现自然语言到数据洞察的端到端转换 |
| [FalkorDB/QueryWeaver](https://github.com/FalkorDB/QueryWeaver) | 1080 | AGPL-3.0 | 2026-10-07 | 用图驱动的 schema 理解做 Text2SQL |
| [zhongyu09/openchatbi](https://github.com/zhongyu09/openchatbi) | 664 | MIT | 2026-10-07 | 对话式 BI，中文语境支持好 |
| [holoviz/lumen](https://github.com/holoviz/lumen) | 316 | BSD-3-Clause | 2026-10-10 | 明确以 agent framework 形式，把自然语言变成 SQL / 图表 / 仪表板 / 报告 |
| [luguanglong/Magic-Insight](https://github.com/luguanglong/Magic-Insight) | 546 | AGPL-3.0 | 2024-11-06 | 一站式数据智能体，**已近两年无更新** |
| [Wilson-ZheLin/Streamline-Analyst](https://github.com/Wilson-ZheLin/Streamline-Analyst) | 491 | MIT | 2024-08-10 | LLM 驱动的数据分析全流程智能体，**已近两年无更新** |
| [bagofwords1/bagofwords](https://github.com/bagofwords1/bagofwords) | 459 | NOASSERTION | 2026-10-10 | 对话式数据问答，内置记忆、规则与可观测性 |
| [xuwei95/ezdata](https://github.com/xuwei95/ezdata) | 293 | MIT | 2026-08-14 | AI-native 数据平台，60+ 连接器、ETL 与调度 |
| [visivo-io/visivo](https://github.com/visivo-io/visivo) | 103 | GPL-3.0 | 2026-10-10 | 端到端版本控制的仪表板，CLI 开箱即用（BI as code） |

**已归档，谨慎使用：**

| 项目 | 星数 | 状态 |
| --- | --- | --- |
| [vanna-ai/vanna](https://github.com/vanna-ai/vanna) | 23821 | **ARCHIVED**（2026-02-02 最后推送）。本方向引用率最高的项目之一，但已停止维护 |
| [microsoft/TaskWeaver](https://github.com/microsoft/TaskWeaver) | 6164 | **ARCHIVED**（2026-03-23 最后推送）。微软 code-first 数据分析 Agent 框架 |

---

## 三、AI 直接生成「数据大屏」/ 报表（中文生态，最贴合大屏场景）

| 项目 | 星数 | 许可证 | 最近推送 | 说明 |
| --- | --- | --- | --- | --- |
| [jeecgboot/jimureport](https://github.com/jeecgboot/jimureport) | 8518 | GPL-3.0 | 2026-09-23 | **JimuChatBI**：宣称首款免费开源对话式智能数据分析产品，一句话生成报表和数据大屏，支持对话式 AI 修改 |
| [Zafer-Liu/Data-Analysis-Agent](https://github.com/Zafer-Liu/Data-Analysis-Agent) | 2605 | NOASSERTION | 2026-10-09 | 对话式交互自动生成可视化报表与商业洞察 |
| [gcpaas/DataRoom](https://github.com/gcpaas/DataRoom) | 867 | Apache-2.0 | 2026-09-29 | AI 对话式生成大屏、页面，几十种炫酷图表，20+ 数据源 |
| [jeecgboot/skills](https://github.com/jeecgboot/skills) | 240 | Apache-2.0 | 2026-09-17 | Claude Code Skills：一句话生成代码/表单/流程/报表/图表/**大屏**/仪表盘 |
| [jeecgboot/JeecgBoot](https://github.com/jeecgboot/JeecgBoot) | 48150 | Apache-2.0 | 2026-09-22 | 低代码平台，AI Skills 一句话画流程、设计表单、生成报表、大屏（如需平台级集成） |
| [TWILIGHT-wyf/Vela](https://github.com/TWILIGHT-wyf/Vela) | 11 | - | 2026-04-21 | Vue3 大屏低代码搭建 + AI 智能生成（新项目，规模小） |
| [xiaofuqing13/echarts-bigscreen-skill](https://github.com/xiaofuqing13/echarts-bigscreen-skill) | 8 | MIT | 2026-07-12 | AI 大屏生成 Claude Code Skill，输出单文件 HTML，支持内网离线部署（规模小但场景精准） |

---

## 四、Agent 图表生成：MCP Server / Skill（最小接入路径）

这一类不生成完整仪表板，而是让智能体具备直接输出图表/可视化 HTML 的能力，接进任何 Agent 最省事。

| 项目 | 星数 | 许可证 | 最近推送 | 说明 |
| --- | --- | --- | --- | --- |
| [antvis/mcp-server-chart](https://github.com/antvis/mcp-server-chart) | 4393 | MIT | 2026-08-27 | **AntV 官方**可视化 MCP + Skills，25+ 图表类型，含地图，面向图表生成与数据分析 |
| [larashero3-dotcom/lieflat-charts](https://github.com/larashero3-dotcom/lieflat-charts) | 6037 | NOASSERTION | 2026-09-05 | 面向 AI Agents 的数据可视化 Skill，输出可交互 HTML 图表 |
| [markdown-viewer/skills](https://github.com/markdown-viewer/skills) | 3358 | CC-BY-4.0 | 2026-10-05 | 让 AI 编码智能体直接在 Markdown 里产出图表与可视化 |
| [microsoft/lida](https://github.com/microsoft/lida) | 3284 | MIT | 2024-08-08 | 微软，用 LLM 自动生成可视化与信息图（学术向，更新已缓） |
| [VisActor/VMind](https://github.com/VisActor/VMind) | 470 | MIT | 2026-09-22 | 字节 VisActor 出品，基于 LLM 的智能数据可视化生成系统 |
| [opengeos/GeoAgent](https://github.com/opengeos/GeoAgent) | 507 | MIT | 2026-10-05 | 地理空间数据分析与交互可视化多模态 Agent（垂直场景） |
| [VisActor/vchart-mcp-server](https://github.com/VisActor/vchart-mcp-server) | 52 | MIT | 2026-03-26 | VChart 的 MCP server，让 AI 助手生成交互式图表 |
| [graphene-data/graphene](https://github.com/graphene-data/graphene) | 216 | - | 2026-10-01 | 把编码智能体变成数据分析师（Skill 形态） |

---

## 五、MCP 连接器：把已有 BI 平台交给智能体操作

适合「BI 平台已经建好了，想让智能体来查/建仪表板」的场景。

| 项目 | 星数 | 许可证 | 最近推送 | 说明 |
| --- | --- | --- | --- | --- |
| [googleapis/mcp-toolbox](https://github.com/googleapis/mcp-toolbox) | 16643 | Apache-2.0 | 2026-10-08 | **Google 官方**数据库 MCP server，本类里最权威、维护最好 |
| [sulaiman013/powerbi-mcp](https://github.com/sulaiman013/powerbi-mcp) | 123 | MIT | 2026-07-23 | Power BI 数据集的自然语言交互 MCP |
| [jerichosequitin/metabase-mcp](https://github.com/jerichosequitin/metabase-mcp) | 89 | MIT | 2026-09-22 | Metabase MCP，含资源管理能力 |
| [easecloudio/mcp-metabase-server](https://github.com/easecloudio/mcp-metabase-server) | 82 | MIT | 2026-05-14 | Metabase MCP，70+ 工具 |
| [CognitionAI/metabase-mcp-server](https://github.com/CognitionAI/metabase-mcp-server) | 63 | NOASSERTION | 2026-08-17 | Cognition 官方 Metabase MCP |
| [enessari/metabase-ai-assistant](https://github.com/enessari/metabase-ai-assistant) | 49 | Apache-2.0 | 2026-09-03 | 111+ 工具，含 AI SQL 生成与**仪表板自动化** |
| [yimindev/dati](https://github.com/yimindev/dati) | 64 | Apache-2.0 | 2026-10-08 | 把数据库变成面向 agent 的语义化 MCP 工具 |
| [c-cf/BI-Chart-MCP-Server](https://github.com/c-cf/BI-Chart-MCP-Server) | 13 | Apache-2.0 | 2025-03-31 | BI 图表 MCP server（规模小） |

---

## 六、大屏 / 可视化搭建平台（本身多无 AI，可作为智能体的输出底座）

| 项目 | 星数 | 许可证 | 最近推送 | 说明 |
| --- | --- | --- | --- | --- |
| [DataV-Team/DataV](https://github.com/DataV-Team/DataV) | 9714 | MIT | 2024-06-14 | Vue 大屏组件库（类阿里 DataV），**近两年半无更新** |
| [iGaoWei/BigDataView](https://github.com/iGaoWei/BigDataView) | 5348 | - | 2025-10-24 | 100+ 套大数据可视化大屏 HTML5 模板 |
| [edp963/davinci](https://github.com/edp963/davinci) | 5011 | Apache-2.0 | 2023-09-05 | DVsaaS 数据可视化平台，**已停更三年** |
| [jackchen0120/vueDataV](https://github.com/jackchen0120/vueDataV) | 2178 | MIT | 2024-03-30 | Vue + ECharts 可视化平台与大屏模板 |
| [TurboWay/big_screen](https://github.com/TurboWay/big_screen) | 1883 | MIT | 2026-01-22 | 数据大屏可视化 |
| [raodv/report](https://github.com/raodv/report) | 1422 | Apache-2.0 | 2026-08-13 | **AJ-Report**：拖拽三步完成大屏（配数据源 → 写 SQL 配数据集 → 拖拽生成），仍在维护 |
| [AnsGoo/openDataV](https://github.com/AnsGoo/openDataV) | 1369 | Apache-2.0 | 2026-09-29 | 纯前端拖拽式低代码大屏开发平台，支持自定义组件接入 |
| [DataV-Team/DataV-React](https://github.com/DataV-Team/DataV-React) | 996 | MIT | 2022-07-14 | DataV 的 React 版，**已停更四年** |
| [dromara/go-view](https://github.com/dromara/go-view) | 969 | MIT | 2025-12-25 | Vue3 低代码数据可视化开发平台 |
| [JohnYan2017/SmartCharts](https://github.com/JohnYan2017/SmartCharts) | 766 | Apache-2.0 | 2026-09-28 | 支持 ECharts/SQL/API/Vue，可用于 Jupyter 的大屏方案 |
| [MrXujiang/v6.dooring.public](https://github.com/MrXujiang/v6.dooring.public) | 715 | GPL-3.0 | 2025-07-06 | 可视化大屏编辑引擎 |

---

## 七、通用 BI 底座（智能体接入的常见目标平台）

| 项目 | 星数 | 许可证 | 最近推送 | 说明 |
| --- | --- | --- | --- | --- |
| [grafana/grafana](https://github.com/grafana/grafana) | 77229 | AGPL-3.0 | 2026-10-10 | 可观测性 + 数据可视化平台 |
| [apache/superset](https://github.com/apache/superset) | 75100 | Apache-2.0 | 2026-10-10 | Apache 数据可视化与数据探索平台 |
| [metabase/metabase](https://github.com/metabase/metabase) | 49607 | NOASSERTION | 2026-10-11 | 易用型开源 BI，Metabase MCP 生态最丰富 |

---

## 八、Text2SQL 学习资源与综述（非工具，用于选型与补课）

| 资源 | 星数 | 许可证 | 最近推送 | 说明 |
| --- | --- | --- | --- | --- |
| [eosphoros-ai/Awesome-Text2SQL](https://github.com/eosphoros-ai/Awesome-Text2SQL) | 3764 | MIT | 2026-01-26 | LLM / Text2SQL / Text2DSL / Text2Vis 教程与资源合集 |
| [HKUSTDial/NL2SQL_Handbook](https://github.com/HKUSTDial/NL2SQL_Handbook) | 1608 | - | 2026-08-31 | 持续更新的 NL2SQL 技术手册，跟踪最新进展 |
| [DEEP-PolyU/Awesome-LLM-based-Text2SQL](https://github.com/DEEP-PolyU/Awesome-LLM-based-Text2SQL) | 1374 | MIT | 2026-08-03 | TKDE2025 综述配套资源列表 |
| [antgroup/Agentar-Scale-SQL](https://github.com/antgroup/Agentar-Scale-SQL) | 478 | Apache-2.0 | 2026-05-09 | 蚂蚁集团，可扩展计算的 Text2SQL 框架 |

---

## 九、同名 / 易混淆地址汇总（避免拿到死链）

| 你可能拿到的旧地址 | 实际可用地址 | 说明 |
| --- | --- | --- |
| `Chat2DB/Chat2DB` | [OtterMind/Chat2DB](https://github.com/OtterMind/Chat2DB) | 组织迁移 |
| `anji-plus/AJ-Report` | [raodv/report](https://github.com/raodv/report) | 项目改名并迁移 |
| `OpenBB-finance/OpenBB` | [openbq-org/OpenBB](https://github.com/openbq-org/OpenBB) | 组织迁移（74087★，非 fork）；属金融数据平台，非本清单主题 |
| `antvis/GPTVis` | — | 已 404，不存在 |
| `datagear/datagear` | — | 已 404，不存在 |

---

## 十、注意事项

1. **本方向两个标杆项目已归档**：`vanna-ai/vanna`（23821★）与 `microsoft/TaskWeaver`（6164★）都已 ARCHIVED。
   网上大量教程仍在推荐它们，选型时务必确认这一点。

2. **仓库已迁移/已消失，旧链接会失效**（完整对照见 第九节）：Chat2DB → `OtterMind/Chat2DB`；AJ-Report → `raodv/report`；OpenBB → `openbq-org/OpenBB`。而 `antvis/GPTVis`、`datagear/datagear` 已 404。旧地址返回 301，直接 clone 可能失败。

3. **大屏组件库普遍停更**：DataV（2024-06）、DataV-React（2022-07）、davinci（2023-09）都处于长期停滞。
   若要做新项目，优先选仍在维护的 AJ-Report、OpenDataV、GoView。

4. **新仓库的星数需要自己再判断**：`lieflat-charts`、`markdown-viewer/skills`、`Zafer-Liu/Data-Analysis-Agent`
   都是 2026 年新出现的高星仓库，创建时间很短（1~9 个月）而星数已达数千。我核对了它们的体积、fork 数与
   订阅数（数据正常，非明显刷星），但长期可靠性尚无时间检验，不建议作为关键路径依赖。

5. **许可证差异**：JimuReport 是 GPL-3.0，DataRoom/Magic-Insight 是 AGPL-3.0，商用集成前请确认合规边界。

6. **星数会变**：本文所有数字为 2026-10-11 的 API 快照。

---

## 附：本次使用的检索方式

复现或扩充清单可用：

```bash
# 按关键词检索，按星数排序
curl -s -G "https://api.github.com/search/repositories" \
  --data-urlencode "q=text-to-sql dashboard" \
  --data-urlencode "sort=stars" --data-urlencode "order=desc" \
  --data-urlencode "per_page=20" | jq -r '.items[] | "\(.stargazers_count)★ \(.full_name)"'

# 核实单个仓库（含归档状态）
curl -s "https://api.github.com/repos/Canner/WrenAI" \
  | jq -r '"\(.stargazers_count)★ \(.pushed_at) archived=\(.archived) \(.full_name)"'
```

用到的关键词：`text-to-sql dashboard`、`AI agent data visualization`、`大屏 可视化`、`mcp server chart`、
`LLM dashboard generator`、`natural language BI`、`data analyst agent`、`text2sql`、`低代码 大屏`、`chatbi`、
`对话式 报表 大屏`、`AI 生成 大屏`、`智能问数`、`数据驾驶舱`、`metabase mcp server`、`generative BI`。
