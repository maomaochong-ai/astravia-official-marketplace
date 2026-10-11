# 流程配置数据库表（ext_act_process 系列）

流程除了 BPMN XML 外，还需要在 4 张配置表中存储流程属性、节点配置、表单绑定和字段权限。

## 1. ext_act_process — 流程主表

| 字段 | 说明 | 取值 |
|------|------|------|
| `id` | 流程ID（主键） | 新建时返回 |
| `process_key` | 流程定义Key | `process_{timestamp}` |
| `process_name` | 流程名称 | 用户定义 |
| `process_type` | 流程分类 | 字典 `bpm_process_type` 的值，如 `oa`、`test` |
| `process_status` | 发布状态 | 0=未发布, 1=已发布 |
| `process_xml` | BPMN XML（longblob） | 完整 XML 内容 |
| `start_type` | 发起方式 | 见下表 |
| `urge_status` | 允许催办 | `0`=关, `1`=开 |
| `back_status` | 允许撤回 | `0`=关, `1`=开 |
| `graphic_status` | 显示流程图 | `0`=关, `1`=开 |
| `auto_submit_status` | 自动提交 | `0`=关, `1`=开 |
| `notify_way` | 通知方式 | 系统消息/邮件/钉钉/企微 |
| `open_status` | 启用状态 | 0=关, 1=开 |
| `run_concurrent_mode` | 并发模式 | 控制同一数据多次发起 |
| `iz_supervise` | 督办标记 | 0=否, 1=是 |

**start_type 发起方式：**

| 值 | 说明 |
|----|------|
| `manual` | 手工发起流程（默认） |
| `tableEvent` | 工作表触发（数据新增/修改时自动发起） |
| `buttonEvent` | 按钮事件触发（自定义按钮触发） |
| `timerEvent` | 定时触发 |
| `dateFieldEvent` | 根据表日期字段触发 |
| `userEvent` | 人员事件触发（如员工离职） |
| `subEvent` | 子流程触发 |

## 2. ext_act_process_form — 流程表单绑定

将流程与业务表单关联：

| 字段 | 说明 | 取值 |
|------|------|------|
| `relation_code` | 关联编码（唯一） | `onl_{表名}` / `desform_{表名}` / `dev_{表名}_001` |
| `biz_name` | 业务名称 | 可选 |
| `process_id` | 关联流程ID | 外键 |
| `form_table_name` | 表单表名 | 业务表名 |
| `form_type` | 表单类型 | 见下表 |
| `title_exp` | 标题表达式 | 如 `请假申请【${name}】` |
| `form_deal_style` | 表单处理风格 | `default` |
| `flow_status_col` | 流程状态字段 | 通常为 `bpm_status` |
| `trigger_action` | 触发动作 | `add`/`update`/`add\|update`（tableEvent 时用） |
| `report_print_url` | 积木报表打印URL（仅 formType=3 有效） | 格式：`{{DOMAIN_URL}}/jmreport/view/{报表ID}?id={{DATAID}}&token={{TOKEN}}&procInstId={{PROCINSTID}}` |

**form_type 表单类型：**

| 值 | 说明 | relation_code 格式 |
|----|------|-------------------|
| `1` | Online表单（低代码表单） | `onl_{tableName}` |
| `2` | 表单设计器（DesForm） | `desform_{formCode}` |
| `3` | 自定义开发表单 | `dev_{code}_001` |

**title_exp 标题表达式语法：** 使用 `${变量名}` 引用表单字段值，如 `请假【${name}】提交于${create_time}`。

## 3. ext_act_process_node — 节点配置

控制每个审批节点的行为：

| 字段 | 说明 | 取值 |
|------|------|------|
| `process_id` | 关联流程ID | 外键 |
| `process_node_code` | 节点ID（对应 XML 中的 userTask id） | 如 `task_apply` |
| `process_node_name` | 节点名称 | 如 `部门经理审批` |
| `model_and_view` | PC端表单路径 | **开启可编辑时必须设置**，见下方说明 |
| `model_and_view_mobile` | 移动端表单路径 | **开启可编辑时必须设置**，见下方说明 |
| `node_timeout` | 超时提醒（小时） | 0=不提醒 |
| `form_edit_status` | 表单是否可编辑 | `0`=只读, `1`=可编辑 |
| `cc_status` | 允许抄送 | `0`=关, `1`=开 |
| `selnext_user_status` | 允许选择下一步处理人 | `0`=关, `1`=开 |
| `msg_status` | 消息通知 | `0`=关, `1`=开 |
| `transfer_status` | 允许转办 | `0`=关, `1`=开 |
| `add_sign_status` | 允许加签 | `0`=关, `1`=开 |
| `smart_back_status` | 允许智能回退 | `0`=关, `1`=开 |
| `reject_status` | 允许驳回 | `0`=关, `1`=开 |
| `allow_counter_sign_add_user` | 会签允许加人 | `0`=关, `1`=开 |
| `node_config_json` | 节点扩展配置（JSON） | 包含通知设置、审批人配置等 |

**重要：form_edit_status=1 时必须同时设置表单地址**

当节点开启表单可编辑（`form_edit_status=1`）时，必须同时设置 `model_and_view` 和 `model_and_view_mobile`，否则发起人无法正确打开表单编辑页面。

| 表单类型 | model_and_view (PC) | model_and_view_mobile (移动端) |
|---------|---------------------|-------------------------------|
| 设计器表单(desform) | `{{DOMAIN_URL}}/desform/edit/{formCode}/${BPM_DES_DATA_ID}?token={{TOKEN}}&taskId={{TASKID}}&skip=false` | 同PC |
| Online表单 | `super/bpm/process/components/OnlineFormOpt` | `check/onlineForm/flowedit` |

## 4. ext_act_process_node_auth — 字段权限配置

控制每个节点上表单字段的可见性和可编辑性：

| 字段 | 说明 | 取值 |
|------|------|------|
| `process_id` | 关联流程ID | 外键 |
| `process_node_code` | 节点ID | 如 `task_apply` |
| `rule_code` | 字段编码 | 表单字段名 |
| `rule_name` | 字段名称 | 显示名称 |
| `rule_type` | 策略类型 | `1`=显示, `2`=禁用 |
| `status` | 效果模式 | `1`=正向有效, `0`=反向有效 |
| `required` | 是否必填 | `0`=否, `1`=是 |
| `form_type` | 表单类型 | `1`/`2`/`3` 同上 |
| `form_biz_code` | 表单业务编码 | 表名或表单编码 |
| `desform_com_key` | DesForm 组件Key | DesForm 专用 |

**rule_type + status 组合效果：**

| rule_type | status | 效果 |
|-----------|--------|------|
| `1`(显示) | `1`(正向) | 字段**可见** |
| `1`(显示) | `0`(反向) | 字段**隐藏** |
| `2`(禁用) | `1`(正向) | 字段**禁用**（只读） |
| `2`(禁用) | `0`(反向) | 字段**可编辑** |

## 5. node_config_json 完整结构

节点扩展配置 JSON 包含以下关键字段（来自生产数据分析）：

```json
{
  // 审批人配置
  "approverGroups": {
    "approverType": "candidateUser",
    "assigneeType": "assigneeByName|assigneeByExp",
    "approverIds": ["admin", "jeecg"],
    "approverNames": ["管理员", "jeecg"],
    "roleIds": [], "roleNames": [],
    "deptIds": [], "deptNames": [],
    "postIds": [], "postNames": [],
    "expressionsIds": ["${applyUserId}"],
    "expressionsNames": ["获取发起人"],
    "formTableType": "",
    "levelMode": "1",
    "variableContent": "", "variableTitle": "[]"
  },

  // 审批行为
  "sameMode": 0,              // 相同处理人: 0=不跳过, 1=跳过, 2=草稿
  "skipApproval": 0,          // 0=不跳过, 1=跳过审批
  "assigneeIsEmpty": 0,       // 审批人为空时: 0=不跳过
  "approvalEnabled": true,    // 启用审批
  "approvalMethod": "1",      // 审批方式

  // 节点功能开关
  "formEditStatus": false,    // 表单可编辑
  "ccStatus": true,           // 抄送
  "selnextUserStatus": true,  // 选择下一步处理人
  "msgStatus": false,         // 消息通知
  "transferStatus": true,     // 转办
  "rejectStatus": true,       // 驳回
  "allowAddSign": true,       // 加签
  "allowCountersignAddUser": false, // 会签加人

  // 会签配置
  "isSequential": false,      // 顺序/并行
  "collection": "${flowUtil.stringToList(assigneeUserIdList)}",
  "elementVariable": "assigneeUserId",

  // 分支相关
  "approveResultBranch": false, // 审批结果分支
  "hasResultBranch": false,

  // 发起人节点标记
  "applyUserNode": true,      // 是否为发起人节点

  // 超时配置
  "timeType": "timeDate",
  "level": "1",

  // 更新记录（服务节点）
  "expressionType": "delegateExpression",
  "expressionValue": "${updateRecordDelegate}",
  "formTableCode": "table_name",
  "formTableSourceTaskId": "start",
  "formTableSourceNodeType": "table",
  "updateFields": "[...]"
}
```
