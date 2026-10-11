# 信号与消息事件配置

> 从 SKILL.md 提取，按需读取。包含 6 种事件类型的完整配置说明。

## 信号事件（Signal Event）概述

信号是**广播**机制，同一信号可以有**多个订阅者**，所有匹配的订阅者都会被触发。信号被捕获后**不会被消耗**。

| 事件类型 | XML 元素 | 触发方式 | 说明 |
|---------|---------|---------|------|
| 信号捕获事件 | `intermediateCatchEvent` + `signalEventDefinition` | 引擎自动（等待匹配信号） | 流程暂停等待信号 |
| 信号抛出事件 | `intermediateThrowEvent` + `signalEventDefinition` | 引擎自动（执行到节点即广播） | 发出信号后继续流转 |
| 信号边界事件 | `boundaryEvent` + `signalEventDefinition` | 引擎自动（等待附属任务期间） | 附加在 userTask 上 |

**信号 vs 消息的关键区别：**

| 特性 | 信号（Signal） | 消息（Message） |
|------|--------------|----------------|
| 订阅者 | **多个**（广播） | **唯一一个** |
| 消耗 | 捕获后**不消耗**，所有订阅者都收到 | 消耗后只有一个订阅者处理 |
| 作用范围 | **全局**（可跨流程实例） | 通过关联规则确定唯一订阅者 |
| 匹配规则 | 可选（匹配规则不同则忽略） | **必选**（`消息名 + 捕获规则` 全局唯一） |

## 信号捕获事件（Signal Intermediate Catching Event）

执行到此节点时暂停，等待流程内的抛出信号事件或 API 发出匹配信号后继续。

**JSON 节点配置：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 是 | 节点唯一ID |
| `type` | 是 | 固定为 `signalCatch` |
| `name` | 是 | 节点名称 |
| `signalName` | 是 | 要订阅的信号名（与抛出事件/API 保持一致） |
| `matchRule` | 否 | 可选匹配规则，如 `vip`；信号名相同但规则不匹配则忽略 |

**JSON 示例：**
```json
{
  "id": "signal_catch_1",
  "type": "signalCatch",
  "name": "等待CRM订单信号",
  "signalName": "CRM-Order",
  "matchRule": "vip"
}
```

## 信号抛出事件（Signal Intermediate Throwing Event）

执行到此节点时，向系统内部广播一个信号，所有匹配的订阅者都会被触发，之后流程继续。

**JSON 节点配置：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 是 | 节点唯一ID |
| `type` | 是 | 固定为 `signalThrow` |
| `name` | 是 | 节点名称 |
| `signalName` | 是 | 要发出的信号名 |
| `matchRule` | 否 | 可选匹配规则；订阅者规则不同则不处理 |

**JSON 示例：**
```json
{
  "id": "signal_throw_1",
  "type": "signalThrow",
  "name": "发出审批完成信号",
  "signalName": "ApprovalDone"
}
```

## 信号边界事件（Signal Boundary Interrupting Event）

附加在 `userTask` 上，在任务执行期间等待匹配信号。收到信号后中断任务（或非中断模式），按后继路线继续。

**在 userTask 节点上添加 `signalBoundary` 字段：**

| 字段 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `signalName` | 是 | — | 要订阅的信号名 |
| `matchRule` | 否 | — | 可选匹配规则 |
| `cancelActivity` | 否 | `true` | `true`=中断型（中断依附的任务），`false`=非中断型 |
| `boundaryTarget` | 否 | — | 触发后路由到的节点 ID |
| `eventId` | 否 | `signal_boundary_{nodeId}` | 边界事件ID |

**JSON 示例：**
```json
{
  "id": "task_approval",
  "type": "userTask",
  "name": "经理审批",
  "assignee": {"type": "role", "value": "manager"},
  "signalBoundary": {
    "signalName": "CancelOrder",
    "cancelActivity": true,
    "boundaryTarget": "end"
  }
}
```

> **重要特性：** 信号边界事件为**全局作用域**，不限于当前流程范围。不同流程实例发出的相同信号也能触发此边界事件。信号被捕获后**不会消耗**，多个活跃的信号边界事件订阅同一信号时，全部都会被触发。

---

## 消息事件（Message Event）概述

消息是**单播**机制，每条消息只允许**唯一一个**订阅者。通过 `消息名 + 关联规则` 确定唯一订阅者。

**配置消息的前提：** 必须在流程属性的 `消息` 中定义消息变量名，确保消息变量名与订阅/抛出事件一致。

## 消息捕获事件（Message Intermediate Catch Event）

执行到此节点时暂停，等待匹配消息后继续。与信号不同，每条消息只允许一个订阅者，关联规则用于确定唯一目标。

**JSON 节点配置：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 是 | 节点唯一ID |
| `type` | 是 | 固定为 `messageCatch` |
| `name` | 是 | 节点名称 |
| `messageName` | 是 | 要订阅的消息名（需与流程属性中定义的变量名一致） |
| `correlationKey` | 是 | **必选**关联规则，如订单号 `201702040007`，与消息名组合保证全局唯一 |

**JSON 示例：**
```json
{
  "id": "msg_catch_1",
  "type": "messageCatch",
  "name": "等待Alibaba订单消息",
  "messageName": "Alibaba-B2B-Order",
  "correlationKey": "201702040007"
}
```

## 消息抛出事件（Message Intermediate Throwing Event）

执行到此节点时，向系统内部发送一条消息或调用外部系统接口，之后继续流转。

**JSON 节点配置：**

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 是 | 节点唯一ID |
| `type` | 是 | 固定为 `messageThrow` |
| `name` | 是 | 节点名称 |
| `messageName` | 是 | 要发出的消息名（需在流程属性中定义，与订阅事件的消息名一致） |

**JSON 示例：**
```json
{
  "id": "msg_throw_1",
  "type": "messageThrow",
  "name": "发送订单确认消息",
  "messageName": "Alibaba-B2B-Order"
}
```

## 消息边界事件（Message Boundary Interrupting Event）

附加在 `userTask` 或子流程上，在任务执行期间等待匹配消息。可以是中断型（默认）或非中断型。

**在 userTask 节点上添加 `messageBoundary` 字段：**

| 字段 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `messageName` | 是 | — | 要订阅的消息名 |
| `correlationKey` | 是 | — | 必选关联规则，保证唯一订阅者 |
| `cancelActivity` | 否 | `true` | `true`=中断型，`false`=非中断型（任务继续，同时也触发边界路线） |
| `boundaryTarget` | 否 | — | 触发后路由到的节点 ID |
| `eventId` | 否 | `message_boundary_{nodeId}` | 边界事件ID |

**JSON 示例：**
```json
{
  "id": "task_wait",
  "type": "userTask",
  "name": "等待付款",
  "assignee": {"type": "role", "value": "finance"},
  "messageBoundary": {
    "messageName": "PaymentReceived",
    "correlationKey": "${orderId}",
    "cancelActivity": true,
    "boundaryTarget": "task_ship"
  }
}
```

> **注意：** 消息边界事件**既可以是中断型，也可以是非中断型**。非中断型触发后依附的任务仍然继续执行，适合并行通知场景。消息边界事件还可以通过 JMS、HTTP/SOAP 等外部系统触发。
