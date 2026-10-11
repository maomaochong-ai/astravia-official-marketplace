# 手工分支（意见分支）

手工分支（也叫意见分支）是 JeecgBoot BPM 中一种特殊的分支模式，用户在审批时手动选择走哪条线，而不是由条件表达式自动判断。

## 与条件分支的区别

| 特性 | 条件分支 | 手工分支（意见分支） |
|------|---------|-------------------|
| 网关 | 需要 `exclusiveGateway` | 不需要网关 |
| 条件表达式 | 每条线有 `conditionExpression` | 线上无条件 |
| 选择方式 | 系统根据条件自动选择 | 用户在审批时手动选择 |
| 连线名称 | 用于标识（如"通过"/"拒绝"） | 显示为选项供用户选择 |
| BPMN 结构 | userTask → gateway → 多目标 | userTask 直接引出多条 sequenceFlow |

## JSON 配置方式

手工分支不需要额外配置，只需让一个 userTask 有多条无条件的出线即可。`bpmn_creator.py` 会**自动检测**并使用水平布局。

**检测规则：** 当一个 `userTask` 有 2 条或以上的出线（flows），且所有出线都不带 `conditions` 字段时，自动识别为手工分支。

```json
{
  "processName": "手工分支示例",
  "nodes": [
    {"id": "start", "type": "startEvent", "name": "开始"},
    {"id": "task_draft", "type": "userTask", "name": "填写申请", "draft": true,
     "assignee": {"type": "expression", "value": "applyUserId"}},
    {"id": "task_a", "type": "userTask", "name": "经理审批",
     "assignee": {"type": "role", "value": "manager"}},
    {"id": "task_b", "type": "userTask", "name": "总监审批",
     "assignee": {"type": "role", "value": "director"}},
    {"id": "task_c", "type": "userTask", "name": "HR审批",
     "assignee": {"type": "role", "value": "hr"}},
    {"id": "end", "type": "endEvent", "name": "结束"}
  ],
  "flows": [
    {"id": "f1", "source": "start", "target": "task_draft"},
    {"id": "f2", "source": "task_draft", "target": "task_a", "name": "经理审批"},
    {"id": "f3", "source": "task_draft", "target": "task_b", "name": "总监审批"},
    {"id": "f4", "source": "task_draft", "target": "task_c", "name": "HR审批"},
    {"id": "f5", "source": "task_a", "target": "end"},
    {"id": "f6", "source": "task_b", "target": "end"},
    {"id": "f7", "source": "task_c", "target": "end"}
  ]
}
```

**关键点：**
- 分支出线的 `name` 字段会显示为用户选择的选项名称，必须填写
- 所有分支目标最终汇聚到同一个 `endEvent`
- 分支源节点通常设为 `"draft": true`（草稿节点，自动提交）

## 自动布局

脚本检测到手工分支后，自动使用水平布局：

```
开始(col1) → 填写节点(col2) ──┬── "经理审批" → 经理审批(col3) ──┬── 结束(col4)
                               ├── "总监审批" → 总监审批(col3) ──┤
                               └── "HR审批"  → HR审批(col3)   ──┘
```

布局坐标：
- 开始事件: x=142
- 分支源节点: x=230
- 分支目标节点: x=570，纵向间距=110
- 结束事件: x=912

## BPMN XML 特征

手工分支的 XML 有以下特征（与条件分支不同）：

1. **分支源 userTask 有多个 `<bpmn2:outgoing>`**
2. **结束事件有多个 `<bpmn2:incoming>`**
3. **sequenceFlow 上无 `conditionExpression`**
4. **无 `exclusiveGateway` 节点**

## 参考

- 真实示例: `references/example/手工分支流程.bpmn`
- 脚本实现: `scripts/bpmn_creator.py` 中的 `calc_layout_manual_branch` 和 `gen_edge_xml_manual_branch` 函数
