# 模板差异对比记录

本文件记录 SKILL `templates/` 目录与后端源目录 `code-template-online/` 之间的差异及原因。

后端源目录：`jeecg-module-system/jeecg-system-biz/src/main/resources/jeecg/code-template-online`

---

## 一、不收录的模板

### 1. 所有风格的 Vue 2 前端模板（`vue/` 子目录）

**状态：** 故意不收录

**原因：** 本 SKILL 定位为只生成 vue3 / vue3Native 前端代码，Vue 2 已不在支持范围内。

**涉及路径（后端源中存在，SKILL 中不收录）：**

| 风格 | 不收录的 vue2 文件 |
|------|-------------------|
| `default/one/…/vue/` | `${entityName}List.vuei`, `modules/${entityName}Form.vuei`, `modules/${entityName}Modal.vuei`, `modules/${entityName}Modal__Style#Drawer.vuei` |
| `default/onetomany/…/vue/` | `${entityName}List.vuei`, `modules/${entityName}Form.vuei`, `modules/${entityName}Modal.vuei`, `modules/[1-n]Form.vuei` |
| `default/tree/…/vue/` | `${entityName}List.vuei`, `modules/${entityName}Modal.vuei` |
| `erp/onetomany/…/vue/` | `${entityName}List.vuei`, `[1-n]List.vuei`, `modules/${entityName}Modal.vuei`, `modules/[1-n]Modal.vuei` |
| `inner-table/onetomany/…/vue/` | `${entityName}List.vuei`, `modules/${entityName}Form.vuei`, `modules/${entityName}Modal.vuei`, `modules/[1-n]Form.vuei`, `subTables/[1-n]SubTable.vuei` |
| `jvxe/onetomany/…/vue/` | `${entityName}List.vuei`, `modules/${entityName}Form.vuei`, `modules/${entityName}Modal.vuei`, `modules/[1-n]Form.vuei` |
| `tab/onetomany/…/vue/` | `${entityName}List.vuei`, `modules/${entityName}Form.vuei`, `modules/${entityName}Modal.vuei`, `modules/[1-n]Form.vuei` |

### 2. `default/onetomany` 的 vue3 前端

**状态：** 后端源中本就不存在 vue3 模板，`codegen.py` 中 `STYLE_FRONTEND_SUPPORT` 设为空集

**原因：** jeecg 官方枚举 `CgformEnum.MANY` 仅支持 vue2，没有 vue3 模板。用户若要此布局，推荐改用 `tab/onetomany` 或 `inner-table/onetomany`。

### 3. Vue 2 目录内的 `menu_insert.sql`

**状态：** 随 `vue/` 子目录一起不收录

**原因：** 这些 SQL 文件位于各风格的 `vue/` 目录下，内容均为 `<#include "/common/sql/menu_insert.ftl">`。SKILL 中的 vue3 / vue3Native 目录下已各自包含相同内容的 `menu_insert.sql`，公共模板 `common/sql/menu_insert.ftl` 也已收录，功能无缺失。

---

## 二、当前对齐状态

排除上述"故意不收录"的部分后，SKILL `templates/` 与后端源 `code-template-online/` 的文件集合完全一致（差异为 0）。

最后校验时间：2026-06-22
