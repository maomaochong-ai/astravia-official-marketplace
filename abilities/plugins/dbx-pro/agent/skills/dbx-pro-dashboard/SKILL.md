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
用户描述 → 确认数据源 → 确认布局（自由栅格）→ 写 spec
  → POST /api/bigscreen/compile（spec.palette=biz / theme=light）
  → 拿到 JimuBI 组件 JSON
  → POST /api/bigscreen/render（可选，直接要 HTML）
```

## 与 bigscreen 的差异

| 维度 | bigscreen | dashboard |
|---|---|---|
| 主题 | 深色为主 | 亮色为主 |
| 栅格 | 12 栅格 / 全宽 | 24 栅格 / 自由布局 |
| 组件高度 | 280px+ | 220px（紧凑）|
| 色板默认 | tech / gov | biz / 自定义亮色 |
| 典型场景 | 展厅大屏 / 监控中心 | 工作台首页 / 运营看板 |
| API 完全共享 | ✅ 同 /api/bigscreen/compile + render | ✅ 同 |

## HTTP API

### POST /api/bigscreen/compile（先编译拿组件 JSON，可选后续 render）

```json
{
  "page": { "name": "运营仪表盘", "theme": "light" },
  "palette": "biz",
  "components": [
    { "type": "JStatsSummary", "title": "今日指标", "variant": "2", ... },
    { "type": "JLine", "title": "趋势", ... },
    { "type": "JPie", "title": "占比", ... }
  ]
}
```

### POST /api/bigscreen/render（直接要完整 HTML）

同 spec，返回 `{ html: "<!DOCTYPE html>..." }`。

## 服务端代码

- 复用 `server/src/engine/bigscreen-compiler.mjs` + `server/src/api/bigscreen.mjs`
- 无独立 engine 模块，API 端点与 bigscreen 完全相同（compile/render/templates）

## scripts/

- `scripts/dashboard_builder.py` —— Agent 侧 CLI（调 `/api/bigscreen/compile` 或 `--render` 调 `/api/bigscreen/render`）

## references/

| 文件 | 内容 |
|---|---|
| references/api-dataset-examples.md | 92 条 API mock 接口参考库（GET，无需鉴权）|
| references/bi-comp-option-config.md | 仪表盘组件配置选项路径参考（来源 config.ts getOptionConfig）|
| references/bi-component-types.md | 仪表盘实际可用组件类型完整参考（menuData 激活项）|
| references/dataset-guide.md | 数据集管理（动态数据源：SQL / API / JSON / WebSocket）|
| references/datasource-dataset-chart-guide.md | 从零创建数据源 → SQL 数据集 → 图表组件完整操作流程 |
| references/dict-guide.md | 大屏字典表 jimu_dict / jimu_dict_item 管理（非 sys_dict）|
| references/linkage-drill-guide.md | 组件联动（linkageConfig）与钻取配置 |
| references/map-guide.md | 地图组件 GeoJSON 数据管理（AreaMap / FlyLineMap / BubbleMap 等）|
| references/map-static-data.md | 省份 GDP / 城市散点 / 飞线等静态演示数据（禁止自行设计简陋数据）|
| references/online-design-form-chart-guide.md | Online 表单 / 设计器表单生成图表技术指南 |
| references/page-config-guide.md | 页面级配置（背景色 / 水印 / 背景图 / 宽高 / 名称）|
| references/pitfalls.md | API 踩坑记录（组件类型匹配等常见问题）|
| references/qqy-guide.md | 敲敲云（QQY）仪表盘专用配置与 qqyMenuData 组件列表 |
| references/signing-datasource-guide.md | @SignatureValidation 接口签名机制与数据源管理 |
| references/template-copy-guide.md | 模板复制创建大屏（备选方案，视觉布局精确还原时用）|
