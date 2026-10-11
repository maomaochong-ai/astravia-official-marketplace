---
name: dbx-pro-portal
description: >-
  门户首页生成器 —— jeecg-portal 对等，多用户共享首页布局 + 卡片编排。
  触发：用户说"门户/首页布局/portal/企业首页/系统首页"。
---

# dbx-pro-portal —— 门户首页（jeecg-portal 对等）

> **与 dbx-pro-dashboard 互补**：dashboard = 个人工作台（每个用户不同），
> portal = 多用户共享首页（如企业门户、系统首页）。
> 复用 bigscreen 的 spec_builder + 24 栅格布局，组件类型更偏向信息卡片。

## 触发条件

门户 / portal / 首页布局 / 企业首页 / 系统首页 / 门户首页 / 导航首页。

## 核心流程

```
用户描述门户需求（如"做一个公司门户首页"）
  ↓
① 确定布局：顶部导航 + 左侧菜单 + 中部卡片栅格 + 右侧公告栏
  ↓
② 确定卡片类型（8 种门户专用卡片）
  ↓
③ 写 spec → POST /api/bigscreen/compile（palette=biz，theme=light）
  ↓
④ 可选：POST /api/bigscreen/render 直接拿 HTML
  ↓
⑤ 返回门户组件 JSON（或 HTML）
```

## 门户专用卡片类型（8 种）

| 卡片 | 说明 | 数据源 |
|---|---|---|
| **JNavBanner** | 顶部导航栏（Logo + 菜单 + 搜索框 + 用户头像）| 静态或 sys_menu 表 |
| **JQuickNav** | 快捷入口（图标宫格，每个入口跳转到模块）| sys_permission 表过滤菜单 |
| **JNoticeList** | 公告列表（滚动/轮播）| sys_notice 表 |
| **JStatsCard** | 统计指标卡（数字 + 图标 + 趋势箭头）| SQL 实时查询 |
| **JChartMini** | 迷你图（sparkline / 迷你柱状）| SQL 实时查询 |
| **JNewsFeed** | 信息流（时间线样式）| sys_* 业务表 |
| **JWeather** | 天气卡（外部 API）| weather API |
| **JCalendar** | 日历卡（日历 + 日程标记）| sys_schedule 表 |

## 典型布局 spec

```json
{
  "page": { "name": "企业门户", "theme": "light" },
  "palette": "biz",
  "layout": "portal",
  "components": [
    { "type": "JNavBanner", "title": "Astravia 企业门户" },
    { "type": "JQuickNav", "cols": 8,
      "items": [
        { "label": "销售管理", "icon": "📊", "link": "/sales" },
        { "label": "审批中心", "icon": "📝", "link": "/bpmn" },
        { "label": "数据大屏", "icon": "🖥️", "link": "/bigscreen" },
        { "label": "报表中心", "icon": "📋", "link": "/report" }
      ]
    },
    { "type": "JStatsCard", "title": "今日销售", "value": "¥128,430", "trend": "+12.5%" },
    { "type": "JStatsCard", "title": "活跃用户", "value": "2,847", "trend": "+3.2%" },
    { "type": "JChartMini", "title": "近 7 日趋势", "kind": "sparkline" },
    { "type": "JNoticeList", "title": "最新公告", "maxItems": 5 },
    { "type": "JNewsFeed", "title": "动态" },
    { "type": "JCalendar", "title": "我的日程" }
  ]
}
```

## 与 dbx-pro-dashboard 的差异

| 维度 | dashboard | portal |
|---|---|---|
| 用户 | 个人工作台（每人不同）| 多用户共享首页 |
| 布局 | 24 栅格自由拖放 | 固定导航 + 卡片栅格 |
| 主题 | 亮色 / 深色可选 | 强制亮色（biz palette）|
| 组件 | 图表类型为主 | 门户卡片为主 |
| 数据源 | 个人相关 SQL | 全局 + 个人混合 |

## 与 jeecg-portal 的差异

| 维度 | jeecg-portal | dbx-pro-portal |
|---|---|---|
| 实现 | Vue + 后端接口 | 纯前端 HTML 生成 |
| 持久化 | 数据库表 portal_layout | 运行时编译，不持久化 |
| 后端依赖 | JeecgBoot 完整后端 | dbx-pro server（localhost）|

## HTTP API

### POST /api/bigscreen/compile（复用 bigscreen 编译链，返回组件 JSON）

```bash
curl -X POST http://localhost:PORT/api/bigscreen/compile \
  -H "Content-Type: application/json" \
  -d '{"page":{"name":"企业门户","theme":"light"},"palette":"biz","components":[...]}'
```

### POST /api/bigscreen/render（直接拿完整 HTML）

同 spec 结构，返回 `{ html: "<!DOCTYPE html>..." }`。

## 服务端代码

- 复用 `server/src/engine/bigscreen-compiler.mjs`
- 新增 `layout: "portal"` 模式 → 编译器自动应用门户布局模板

## references/

| 文件 | 内容 |
|---|---|
| references/api-reference.md | 门户 API 补充参考（修改默认首页等较少使用的 API）|
| references/component-configs.md | 全部 14 个门户组件的详细配置项 |
| references/full-portal-template.md | 全组件门户标准模板（14 组件 + 动态数据源查询 + build_portal.py）|
