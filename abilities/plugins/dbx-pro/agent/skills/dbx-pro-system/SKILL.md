---
name: dbx-pro-system
description: >-
  主数据查询与系统管理知识库 —— jeecg-system 对等，字典/角色/权限/部门 SQL 模板。
  触发：用户说"字典/角色/权限/系统配置/部门/用户管理"。
---

# dbx-pro-system —— 主数据与系统管理（jeecg-system 对等）

> **dbx-pro 提供主数据 SQL 查询能力（字典 / 角色 / 权限 / 部门 / 用户），
> 不自己实现用户认证授权。知识层参考 jeecg-system 的表结构和查询模式。**

## 触发条件

字典 / 角色 / 权限 / 系统配置 / 部门 / 用户管理 / 组织机构 / 菜单权限 / data permission。

## 核心流程

```
用户问"查一下所有角色" / "字典里 gender 有哪些值"
  ↓
① 确定查询的主数据表（sys_dict_item / sys_role / sys_depart ...）
  ↓
② 用 dbx_execute_query 或 dbx_query_full 执行
  ↓
③ 返回结果 + 可选渲染为下拉选择面板
```

## 主数据表查询 SQL 模板

### 字典查询

```sql
-- 字典类型列表
SELECT code, name, description, create_time
FROM sys_dict_type
WHERE deleted = FALSE
ORDER BY sort;

-- 指定字典的字典项
SELECT value, label, sort, color
FROM sys_dict_item
WHERE type_code = 'emp_status' AND deleted = FALSE
ORDER BY sort;

-- 字典 + 外键联查（带字典 label）
SELECT e.name, e.status, di.label AS status_label
FROM employee e
LEFT JOIN sys_dict_item di ON di.value = e.status AND di.type_code = 'emp_status'
WHERE e.deleted = FALSE;
```

### 角色与权限

```sql
-- 角色列表
SELECT r.id, r.name, r.code, r.description, r.create_time
FROM sys_role r WHERE r.deleted = FALSE ORDER BY r.sort;

-- 角色 → 权限菜单
SELECT r.name AS role, m.name AS menu, m.path, m.permission
FROM sys_role r
JOIN sys_role_permission rp ON rp.role_id = r.id
JOIN sys_permission p ON p.id = rp.permission_id
JOIN sys_permission m ON m.id = p.parent_id
WHERE r.id = ? AND r.deleted = FALSE
ORDER BY m.sort;

-- 用户 → 角色（多对多）
SELECT u.name AS user, r.name AS role
FROM sys_user u
JOIN sys_user_role ur ON ur.user_id = u.id
JOIN sys_role r ON r.id = ur.role_id
WHERE u.id = ? AND u.deleted = FALSE;
```

### 部门树

```sql
-- 部门树（CTE 递归）
WITH RECURSIVE dept_tree AS (
  SELECT id, name, parent_id, sort, 0 AS level
  FROM sys_depart WHERE parent_id IS NULL AND deleted = FALSE
  UNION ALL
  SELECT d.id, d.name, d.parent_id, d.sort, dt.level + 1
  FROM sys_depart d JOIN dept_tree dt ON d.parent_id = dt.id
  WHERE d.deleted = FALSE
)
SELECT * FROM dept_tree ORDER BY level, sort;
```

### 数据权限范围

```sql
-- 用户可见的部门范围
SELECT DISTINCT d.* FROM sys_depart d
WHERE d.deleted = FALSE AND (
  d.id IN (SELECT dept_id FROM sys_user WHERE id = ?)    -- 本部门
  OR d.parent_id IN (SELECT dept_id FROM sys_user WHERE id = ?) -- 本部门下级
);
```

## 与 jeecg-system 的差异

| 维度 | jeecg-system | dbx-pro-system |
|---|---|---|
| 认证 | Spring Security + JWT | 宿主平台认证 |
| 存储 | 数据库表 sys_* | 读取已有的 sys_* 表 |
| API | `/sys/user/*` / `/sys/role/*` | 无独立 API，用 dbx_execute_query |
| 数据权限 | @DataScope 注解 | SQL WHERE 条件拼接 |

## 服务端代码

无独立 server 模块。通过 dbx_execute_query 查主数据表。

## references/

| 文件 | 内容 |
|---|---|
| references/api-reference.md | JeecgBoot 系统管理模块完整 API 参考（用户 / 角色 / 权限 / 部门 / 字典 / 日志等）|
