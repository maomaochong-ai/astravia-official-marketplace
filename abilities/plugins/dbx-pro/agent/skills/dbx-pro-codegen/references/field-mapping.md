# 字段语义 → Freemarker 字段映射

新建表时（用户用自然语言描述字段），按此表把字段转成 ctx.json 中 column 项的 `fieldDbType` / `fieldType` / `classType`。
已有表场景从 DDL 读类型，不需要这张表。

## 类型映射

按字段中文/英文语义匹配最近一行：

| 语义关键词 | DB 类型 | fieldDbType | fieldType | classType | 说明 |
|---|---|---|---|---|---|
| 名称 / 标题 / 编码 / 编号 | varchar(100) | string | java.lang.String | text | 普通输入框 |
| 备注 / 描述 / 说明 / 详情 | text | Text | java.lang.String | textarea | 多行文本 |
| 内容（富文本）| text | Text | java.lang.String | umeditor | 富文本编辑器 |
| 金额 / 价格 / 费用 / 单价 / 总价 | decimal(10,2) | BigDecimal | java.math.BigDecimal | text | 数字输入 |
| 数量 / 个数 / 库存 / 排序 / 序号 | int | int | java.lang.Integer | text | 整数输入 |
| 状态 / 类型 / 级别 / 分类 | varchar(10) | string | java.lang.String | list | 单选下拉 + 字典 |
| 下拉搜索 / 搜索选择 / 关联搜索 | varchar(36) | string | java.lang.String | sel_search | JSearchSelect，支持输入过滤 |
| 多选 / 多分类 | varchar(50) | string | java.lang.String | list_multi | 多选 + 字典 |
| 单选按钮组 / radio | varchar(10) | string | java.lang.String | radio | Radio 按钮组 + 字典 |
| 多选复选框 / checkbox | varchar(50) | string | java.lang.String | checkbox | Checkbox 组 + 字典 |
| 是否 / 启用 / 开关 | varchar(2) | string | java.lang.String | switch | Switch 开关 |
| 密码 / 口令 | varchar(100) | string | java.lang.String | password | Input[password] |
| Markdown | text | Text | java.lang.String | markdown | Markdown 编辑器 |
| 日期 / 生日 | date | Date | java.util.Date | date | 日期选择 |
| 时间 / 时刻 | time | Time | java.util.Date | time | 时间选择 |
| 日期时间 / 创建时间 / 更新时间 | datetime | Datetime | java.util.Date | datetime | 日期时间 |
| 图片 / 头像 / 照片 | varchar(1000) | string | java.lang.String | image | JImageUpload |
| 文件 / 附件 / 文档 | varchar(1000) | string | java.lang.String | file | JUpload |
| 用户 / 操作人 / 负责人 | varchar(32) | string | java.lang.String | sel_user | JSelectUserByDept |
| 部门 / 组织 / 单位 | varchar(32) | string | java.lang.String | sel_depart | JSelectDept |
| 省市区 / 地址 | varchar(50) | string | java.lang.String | pca | 省市区联动 |
| 关联（弹窗字典） | varchar(36) | string | java.lang.String | popup_dict | JPopup 字典模式 |
| 关联（弹窗选择） | varchar(36) | string | java.lang.String | popup | JPopup 关联记录（旧版，依赖在线报表）|
| 关联（卡片选择） | varchar(36) | string | java.lang.String | link_table | JLinkTableCard，直连业务表，无需在线报表 |

## classType 与字典三剑客

字段需要字典翻译时，在 column 上同时设置 `classType` + `dictTable` + `dictText` + `dictField`，**模板会自动展开**为 Entity 注解、列表 dataIndex、表单组件、查询组件、高级查询，全套搞定。

| 字典类型 | classType | dictTable | dictText | dictField | 例子 |
|---|---|---|---|---|---|
| 系统字典（sys_dict）| `list` | `""` | `""` | `"order_status"` | 状态、类型 |
| 表字典（普通表）| `list` | `"sys_user"` | `"realname"` | `"username"` | 业务表查询 |
| 分类字典（sys_category）| `cat_tree` | `""` | `""` | `"B03"` | 区域、物料分类 |
| 自定义树字典 | `sel_tree` | `"sys_depart"` | `"id,parent_id,depart_name,has_child"` | `"<root_id>"` | 部门树 |
| 关联表（弹窗选，单字段回填）| `popup` | `"edu_teacher"` | `"teacher_name"` | `"id"` | 选教师，存 id |
| 关联表（弹窗选，多字段回填）| `popup` | `"goods_table"` | `"name,code"` | `"id,goods_code"` | 选商品后回填多列；⚠️ dictText 的每个值必须与某个字段的 fieldDbName 一一对应，否则模板 seq_index_of 返回 -1 越界崩溃 |
| 关联表（卡片选）| `link_table` | `"goods_table"` | `"name"` | `"id"` | JLinkTableCard，直连业务表；可选 extendParams.imageField 指定图片列 |

## 系统字段约定

新建表默认含五个系统字段（`originalColumns` 里直接补齐）：

| fieldName | fieldDbName | fieldDbType | classType | nullable |
|---|---|---|---|---|
| createBy | create_by | string | text | Y |
| createTime | create_time | Datetime | datetime | Y |
| updateBy | update_by | string | text | Y |
| updateTime | update_time | Datetime | datetime | Y |
| sysOrgCode | sys_org_code | string | text | Y |

**已有表场景：** 检查 DDL，只生成实际存在的系统字段。

## 树表额外字段

树表（`default/tree`）必须额外有：

| fieldName | fieldDbName | 说明 |
|---|---|---|
| pid | pid | 父节点 ID（在 `tableVo.extendParams.pidField` 中指定 `pid`） |
| hasChild | has_child | 是否有子节点（在 `tableVo.extendParams.hasChildren` 中指定 `has_child`）|

## 主键策略

| 主键定义 | fieldType | TableId 注解 | 说明 |
|---|---|---|---|
| `varchar(36)` 无自增 | `java.lang.String` | `IdType.ASSIGN_ID` | 默认（雪花 ID）|
| `int AUTO_INCREMENT` | `java.lang.Integer` | `IdType.AUTO` | DB 自增 |
| `bigint AUTO_INCREMENT` | `java.lang.Long` | `IdType.AUTO` | DB 自增 |

主键策略由 ctx.json 的 `primaryKeyField` + 主键所在 column 的 `fieldType` 推导，模板自动选注解。
