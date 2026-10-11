---
name: dbx-pro-codegen
description: >-
  SQL 脚手架生成器 —— jeecg-codegen-new 对等，CREATE TABLE + 字典表 + 枚举表 + 审计字段一键输出。
  触发：用户说"建表/生成 DDL/SQL 脚手架/代码生成/数据库设计"。
---

# dbx-pro-codegen —— SQL DDL 脚手架（jeecg-codegen-new 对等）

## 触发条件

建表 / 生成 DDL / SQL 脚手架 / 代码生成 / 数据库设计 / 表结构设计 / DDL 脚本。

## 核心流程

```
用户描述业务实体需求（如"做一个员工管理表"）
  ↓
① 确定字段 + 类型 + 注释
  ↓
② 套用标准模板：
   - 审计字段（created_at / updated_at / created_by）
   - 逻辑删除字段（deleted）
   - 字典值字段（status → sys_dict_item 外键）
   - 部门外键（dept_id → sys_depart）
  ↓
③ 输出 CREATE TABLE + 字典表初始化 INSERT + 枚举表
```

## 标准字段模板

### 审计字段（每表必有）

```sql
created_at TIMESTAMP NOT NULL DEFAULT NOW(),
updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  CONSTRAINT trg_updated_at CHECK (TRUE),
created_by BIGINT,
updated_by BIGINT,
deleted BOOLEAN NOT NULL DEFAULT FALSE
```

### 字典值字段

```sql
-- 字段定义
status VARCHAR(20) NOT NULL
  REFERENCES sys_dict_item(code='emp_status')
  DEFAULT 'active',

-- 字典表初始化（如果 dict 不存在）
INSERT INTO sys_dict_type (code, name) VALUES ('emp_status', '员工状态');
INSERT INTO sys_dict_item (type_code, value, label, sort) VALUES
  ('emp_status', 'active', '在职', 1),
  ('emp_status', 'resigned', '离职', 2),
  ('emp_status', 'leave', '休假', 3);
```

### 枚举表（多值关联）

```sql
-- 枚举关联表（多对多）
CREATE TABLE employee_role (
  employee_id BIGINT NOT NULL REFERENCES employee(id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES sys_role(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (employee_id, role_id)
);
```

## 完整示例

```sql
-- 员工表
CREATE TABLE employee (
  id BIGSERIAL PRIMARY KEY,
  emp_no VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(50) NOT NULL,
  gender VARCHAR(10) REFERENCES sys_dict_item(code='gender'),
  birthday DATE,
  dept_id INT REFERENCES sys_depart(id),
  position VARCHAR(50),
  salary NUMERIC(12,2),
  status VARCHAR(20) REFERENCES sys_dict_item(code='emp_status') DEFAULT 'active',
  hire_date DATE,
  remark TEXT,
  -- 审计字段
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by BIGINT,
  updated_by BIGINT,
  deleted BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX idx_employee_dept ON employee(dept_id);
CREATE INDEX idx_employee_status ON employee(status);
```

## 与 jeecg-codegen-new 的差异

| 维度 | jeecg-codegen-new | dbx-pro-codegen |
|---|---|---|
| 产物 | 后端 Java + 前端 Vue + DDL | 仅 SQL DDL 脚本 |
| 流程 | 表结构 → 实体 → Controller → Service → 前端 | 实体描述 → DDL |
| 模板 | FreeMarker 模板引擎 | 硬编码 SQL 模板库 |
| 输出目标 | 写入项目目录 | 直接返回 SQL 文本 |

## 服务端代码

无独立 server 模块。知识层 + SQL 模板输出。

## references/

| 文件 | 内容 |
|---|---|
| references/create-table-template.sql | 通用实体表模板（含注释占位符）|
| references/dict-table-template.sql | sys_dict_type / sys_dict_item 定义 + 初始化示例 |
| references/audit-fields.sql | 审计字段完整定义 + updated_at 触发器 |
| references/enum-table-patterns.sql | 多对多关联表模板 |
