---
name: dbx-pro-form
description: >-
  表单设计知识库 —— jeecg-onlform 对等，26 种控件类型 + 主子表关联 + 表单校验模式。
  触发：用户说"表单/录入/控件/主从表/表单设计/录入界面"。
---

# dbx-pro-form —— 表单设计知识库（jeecg-onlform 对等）

> **dbx-pro 不是低代码平台，没有运行时表单引擎。本 skill 提供 jeecg-onlform 知识层，
> 指导 AI 按规范设计表结构 + 控件字段定义，用于 dbx-pro-report / dbx-pro-datalist / dbx-pro-dashboard。**

## 触发条件

表单 / 录入界面 / 控件 / 主从表 / 表单设计 / 录入页 / 主子表关联。

## 核心流程（知识层指导）

```
用户描述录入需求
  ↓
① 确定主表 + 子表（如果有主从）
  ↓
② 选择 26 种控件类型中对应的字段类型
  ↓
③ 用标准 SQL DDL 建表 + 字典值 + 审计字段
  ↓
④ 输出建表 SQL + 字典表初始化脚本
  ↓
（不执行运行时表单 —— 由宿主应用实现）
```

## 26 种控件类型 → SQL 字段映射

| 控件类型 | SQL 类型 | 校验规则 |
|---|---|---|
| input（单行文本）| VARCHAR(50-200) | 必填 / 最大长度 |
| textarea（多行文本）| TEXT | 最大长度 |
| number（数字）| NUMERIC(precision, scale) | min / max / 整数约束 |
| select（单选下拉）| VARCHAR(20) REFERENCES sys_dict_item | 字典 code 关联 |
| multiSelect（多选）| TEXT[] / VARCHAR(500) | JSON 数组 |
| radio（单选按钮）| VARCHAR(20) | 字典 code 关联 |
| checkbox（多选）| TEXT[] | JSON 数组 |
| date（日期）| DATE | 格式 YYYY-MM-DD |
| datetime（日期时间）| TIMESTAMP | 默认 NOW() |
| time（时间）| TIME | 格式 HH:MM |
| year（年）| INTEGER | 4 位整数 |
| month（月）| VARCHAR(7) | YYYY-MM |
| week（周）| VARCHAR(10) | YYYY-Www |
| upload（文件上传）| VARCHAR(500) | 存储 URL |
| imageUpload（图片上传）| VARCHAR(500) | 存储 URL |
| editor（富文本）| TEXT | HTML 内容 |
| markdown（Markdown 编辑器）| TEXT | Markdown 内容 |
| location（地理位置）| POINT / VARCHAR(200) | 经纬度 |
| department（部门选择）| INT REFERENCES sys_depart(id) | 外键 |
| user（用户选择）| BIGINT REFERENCES sys_user(id) | 外键 |
| role（角色选择）| INT REFERENCES sys_role(id) | 外键 |
| comboTable（联动表）| INT REFERENCES 目标表 PK | 外键 + 级联 |
| subTable（子表）| 独立表 + parent_id 外键 | 主子表关联 |
| linkTable（链接表）| VARCHAR(500) | JSON 存储 |
| signature（电子签名）| VARCHAR(500) | 存储图片 URL |
| password（密码）| VARCHAR(100) | bcrypt 哈希 |

## 主子表 SQL 设计模式

```sql
-- 主表
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  order_no VARCHAR(32) UNIQUE NOT NULL,
  customer VARCHAR(100),
  total NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) REFERENCES sys_dict_item(code='order_status'),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 子表（通过 parent_id 外键关联）
CREATE TABLE order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product VARCHAR(100) NOT NULL,
  qty INT DEFAULT 1,
  price NUMERIC(10,2),
  subtotal NUMERIC(12,2) GENERATED ALWAYS AS (qty * price) STORED
);
```

## 与 jeecg-onlform 的差异

| 维度 | jeecg-onlform | dbx-pro-form |
|---|---|---|
| 性质 | 运行时表单引擎 | 知识层（SQL 设计指南）|
| 存储 | 数据库表 cgform（表单定义）| 纯 DDL 输出 |
| 运行时 | JeecgBoot 动态渲染 | 由宿主应用实现 |
| 校验 | 组件属性驱动 | CHECK 约束 + 字典外键 |

## 服务端代码

无独立 server 模块。知识层，输出 SQL 脚本。

## references/

| 文件 | 内容 |
|---|---|
| references/控件类型映射表.md | 26 种控件类型完整定义 + SQL DDL 模板 |
| references/master-detail-sql.md | 主子表关联 SQL 模式 + 联查示例 |
