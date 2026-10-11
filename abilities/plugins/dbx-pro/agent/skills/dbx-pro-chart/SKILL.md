---
name: dbx-pro-chart
description: 图表类型注册表 —— 列出所有 ECharts graphType 及其映射关系。触发：用户说"图表类型/支持什么图/graphType"。
---

# dbx-pro-chart —— 图表类型注册（jeecg-onlchart 对等）

## 触发条件

图表类型 / 支持什么图 / graphType / 图有哪些类型。

## 核心流程

```
用户问"支持什么图" → GET /api/chart/graphTypes → 返回 12+ 种 graphType → 推荐合适类型
```

## HTTP API

### GET /api/chart/graphTypes

**响应**：
```json
{
  "graphTypes": [
    { "id": "bar", "label": "柱图", "group": "柱状图" },
    { "id": "line", "label": "折线图", "group": "折线图" },
    { "id": "pie", "label": "饼图", "group": "饼图" },
    ...
  ]
}
```

## 与 jeecg-onlchart 的差异

| 维度 | jeecg-onlchart | dbx-pro-chart |
|---|---|---|
| 引擎 | JimuBI + Chart.js | 原生 ECharts 5.6.0 |
| graphType 来源 | 数据库字典表 | 硬编码 + palette 驱动 |
| API | `/sys/dict/getDictItems/graphType` | `/api/chart/graphTypes` |
