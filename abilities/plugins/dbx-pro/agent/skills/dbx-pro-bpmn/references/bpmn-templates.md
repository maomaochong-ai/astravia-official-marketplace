# BPMN 模板参考文档索引

本文档已拆分为多个子文件，方便维护和查阅。按需阅读对应文件：

| 文件 | 内容 | 使用场景 |
|------|------|---------|
| [bpmn-xml-skeleton.md](bpmn-xml-skeleton.md) | XML 骨架模板 + 基本节点模板 | 每次生成流程必读 |
| [bpmn-assignee-types.md](bpmn-assignee-types.md) | 7种审批人配置 + groupType速查 + 数据来源表 + 草稿节点 | 配置审批人时必读 |
| [bpmn-countersign.md](bpmn-countersign.md) | 会签配置（规则/人员类型/完整示例） | 需要会签时阅读 |
| [bpmn-task-extend.md](bpmn-task-extend.md) | taskExtendJson 配置 + 监听器汇总 | 配置节点行为时阅读 |
| [bpmn-layout.md](bpmn-layout.md) | 节点ID命名规范 + 图形布局计算规则 | 生成 XML 布局时必读 |
| [bpmn-examples.md](bpmn-examples.md) | 完整示例 + Python调用脚本 + 6种流程模式速查 | 参考模式和调用API |
| [bpmn-advanced.md](bpmn-advanced.md) | 条件表达式 + 抄送 + 按钮 + 服务任务 + API端点 | 高级配置时阅读 |
| [bpmn-subprocess-gateway.md](bpmn-subprocess-gateway.md) | 3种网关 + 内嵌子流程 + 调用子流程 + 会签子流程 | 子流程/网关时必读 |
| [bpmn-db-config.md](bpmn-db-config.md) | 4张配置数据库表 + node_config_json结构 | 数据库配置时阅读 |

## 生产环境 BPMN 示例文件

`references/example/` 目录下包含从生产环境导出的真实流程 BPMN XML 文件，可作为生成流程时的参考模板：

| 文件 | 流程类型 | 包含特性 |
|------|---------|---------|
| `合同付款审批单.bpmn` | 审批流程 | 多级审批 |
| `采购申请单.bpmn` | 审批流程 | 多级审批 |
| `用章申请建设.bpmn` | 审批流程 | 多级审批 |
| `车辆维修保养审批单.bpmn` | 审批流程 | 多级审批 |
| `档案查借阅审批表.bpmn` | 审批流程 | 多级审批 |
| `合同审批单.bpmn` | 审批流程 | 多级审批 |
| `顺序会签流程.bpmn` | 会签 | 顺序会签（isSequential=true） |
| `并行会签测试.bpmn` | 会签 | 并行会签（isSequential=false） |
| `借款申请(子流程).bpmn` | 子流程 | 被调用的子流程定义 |
| `出差申请(主子流程).bpmn` | 主子流程 | callActivity 调用子流程 |
| `督办流程.bpmn` | 包含网关 | inclusiveGateway + 条件分支 |

**使用方式：** 生成流程前，先阅读与目标流程最相似的示例文件，学习其节点结构、审批人配置、监听器写法和布局坐标，然后参照生成新流程。

## 推荐阅读顺序

**基本流程生成：** `bpmn-xml-skeleton.md` → `bpmn-assignee-types.md` → `bpmn-layout.md` → `bpmn-examples.md`

**高级功能：** `bpmn-subprocess-gateway.md` → `bpmn-countersign.md` → `bpmn-task-extend.md` → `bpmn-advanced.md` → `bpmn-db-config.md`
