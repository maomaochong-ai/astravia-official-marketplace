---
name: dbx-pro-dashboard
description: 数据仪表盘生成器 —— 与 dbx-pro-bigscreen 共享 spec_builder 编译链，换亮色主题 + 24 栅格布局。触发：用户说"仪表盘/dashboard/工作台/首页看板"。
---

# dbx-pro-dashboard —— 数据仪表盘（dbx-pro 品牌化）

> **与 dbx-pro-bigscreen 同一个 spec_builder，只是 palette 用亮色、布局用 24 栅格、组件高度更紧凑（220px vs bigscreen 280px）。**

## 触发条件

仪表盘 / dashboard / 工作台 / 首页看板 / 数据看板 / 运营看板。

## 核心流程

```
用户描述 → 确认数据源 → 确认布局（自由栅格）→ 写 spec → POST /api/bigscreen/generate（palette=biz-light 或自定义亮色）→ 返回 HTML
```

## 与 bigscreen 的差异

| 维度 | bigscreen | dashboard |
|---|---|---|
| 主题 | 深色为主 | 亮色为主 |
| 栅格 | 12 栅格 / 全宽 | 24 栅格 / 自由布局 |
| 组件高度 | 280px+ | 220px（紧凑）|
| 色板默认 | tech / gov | biz / 自定义亮色 |
| 典型场景 | 展厅大屏 / 监控中心 | 工作台首页 / 运营看板 |

## HTTP API

### POST /api/bigscreen/generate（同 bigscreen，只是 palette 不同）

```json
{
  "spec": {
    "page": { "name": "运营仪表盘", "theme": "light" },
    "palette": "biz",
    "components": [
      { "type": "JStatsSummary", "title": "今日指标", "variant": "2", ... },
      { "type": "JLine", "title": "趋势", ... },
      { "type": "JPie", "title": "占比", ... }
    ]
  }
}
```

## 服务端代码

- 复用 `server/src/engine/bigscreen-compiler.mjs` + `server/src/api/bigscreen-api.mjs`
- 无独立 engine 模块

## scripts/

- `scripts/dashboard-builder.mjs` —— Agent 侧 CLI（通过 fetch 调 `/api/bigscreen/generate`）
