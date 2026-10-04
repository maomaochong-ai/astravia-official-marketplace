# ADR-0001: 插件侧与宿主 AI 对话的双向交互架构

## 状态
已实施

## 背景
dbx-pro 需要将数据库上下文（连接、表结构、查询结果）发送给宿主的 AI 对话系统，让用户在宿主 AI 对话框中直接对数据库进行分析。同时用户也希望在插件侧能感知宿主会话状态（是否有活跃对话、是否正在流式生成等）。

## 约束
- **不得修改宿主源码**（`open-astravia`）
- 仅通过插件 SDK 暴露的 `PluginContext` 门面交互
- 宿主可能没有活跃会话（用户停在新会话页、或会话已关闭）
- `sendPrompt` 在没有活跃会话时**抛错**，不能静默排队
- `insertText` 在没有活跃会话时也可能无效

## 决策

### 1. 权限声明
在 `plugin.json` 中声明以下权限：
```json
"permissions": [
  "agent.session.read",
  "agent.session.write",
  ...
]
```
- `agent.session.read` — 订阅会话状态变化、读取当前会话信息
- `agent.session.write` — 发送 prompt、创建会话

### 2. 右键上下文注入入口
数据库工作台提供三个右键/按钮入口，将数据库对象上下文回灌到宿主 AI 对话框：

| 触发位置 | 菜单项 | 注入内容 | 函数 |
|---------|--------|---------|------|
| 连接树 → 连接节点右键 | "发送到 AI 分析" | 连接名 + 数据库类型 + 列表示意 | `sendConnectionToAi()` |
| 连接树 → 表节点右键 | "发送到 AI 分析" | 连接名 + schema.table + SELECT * LIMIT 100 | `sendTableToAi()` |
| 查询结果网格工具栏 | "分析结果" | SQL 语句 + 前 20 行 JSON 样本 | `sendQueryToAi()` |

### 3. 交互流程（四级阶梯）

```
┌──────────────────────────────────────────────────────────────┐
│ 用户右键点击连接/表/结果 → 构造 prompt 文本                   │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 第 0 级：权限预检                                             │
│   getPermissions().has("agent.session.read" && "write")      │
│   → 未授权：console.warn 后继续走降级链路                      │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 第 1 级：探测活跃会话（最多 3 秒）                              │
│   conversation.on("conversation-changed")                     │
│   → 有（id !== null）：走第 2 级                               │
│   → 无（id === null / 超时）：走第 3 级                         │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 第 2 级：直接发送到当前会话                                     │
│   conversation.sendPrompt(prompt)                             │
│   → 成功（status="sent"/"queued"）：完成                       │
│   → 失败（status="failed"）：走第 3 级                          │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 第 3 级：新建会话 + 发送                                       │
│   conversation.createSession(".", { navigate: true })         │
│   → resolve 后 conversation.sendPrompt(prompt)                │
│   → 成功：完成                                                 │
│   → 失败：走第 4 级                                            │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 第 4 级：最终降级 — 填入输入框（不自动发送）                      │
│   conversation.insertText(prompt)                             │
│   → 成功：用户看到 prompt 已填入，可手动发送                     │
│   → 失败：console.warn 记录，用户操作不阻断                     │
└──────────────────────────────────────────────────────────────┘
```

### 4. 活跃会话探测
参考 `web-element-picker` 的做法，使用 `conversation.on()` 订阅，收到 `conversation-changed` 事件后检查 `event.conversation.id !== null`。设置 3 秒超时防止永久挂起。

### 5. Prompt 构造规范
- **表分析**：`请帮我分析数据库连接「{name}」中的表 {schema.table}。可以先查看表结构（列、类型、主键），再抽样数据了解其内容与用途：\nSELECT * FROM {schema.table} LIMIT 100;`
- **连接分析**：`请帮我了解 {dbType} 数据库连接「{name}」。可以先列出其中的表，再挑选关键表分析结构与样本数据。`
- **查询结果分析**：`我在连接「{name}」上执行了以下 SQL，请帮我分析结果：\n\`\`\`sql\n{sql}\n\`\`\`\n部分结果（JSON）：\n\`\`\`json\n{前20行}\n\`\`\``

## 后果

### 正面
- 无需修改宿主代码，完全在插件侧实现
- 右键即注入，与 dbx 桌面壳的交互习惯一致
- 有活跃会话时即时发送，无活跃会话时自动创建
- 权限缺失时给出明确提示，不静默失败
- 四级降级链路保证至少能填入输入框

### 负面
- 自动创建会话会打断用户当前可能正在准备的新会话（`createSession` 不判断复用）
- `insertText` 降级路径不自动发送，需要用户手动确认

### 风险
- 宿主 `conversation.on()` 的 replay 行为依赖宿主版本，旧版本可能不触发初始 `conversation-changed`
- 3 秒超时在宿主响应慢时可能误判为"无活跃会话"

## 参考
- `packages/plugins/plugin-sdk/dist/conversation.d.ts`
- `abilities/plugins/web-element-picker/src/WebElementPickerPanel.tsx` 的 `hasActiveConversation` 实现
- `packages/plugins/presets/astravia-ui-design/src/notes/handoff.ts` 的 `createSession` → `sendPrompt` 模式
- `src/features/database-workspace/components/connection-node.tsx` 右键菜单入口
- `src/features/database-workspace/components/result-grid.tsx` 结果分析按钮入口
