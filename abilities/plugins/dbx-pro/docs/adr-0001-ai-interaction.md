# ADR-0001: 插件侧与宿主 AI 对话的双向交互架构

## 状态
已实施（轻量级） / 待宿主扩展（完整 @ 选择器）

## 背景
dbx-pro 需要将数据库上下文（连接、表结构、查询结果）发送给宿主的 AI 对话系统，让用户在宿主 AI 对话框中直接对数据库进行分析。期望的交互方式是：用户在宿主输入框中键入 `@` 后，弹出一个选择器，可以浏览和选择已连接的数据库、schema、表等层级信息。

## 约束
- **不得修改宿主源码**（`open-astravia`）
- 仅通过插件 SDK 暴露的 `PluginContext` 门面交互
- 宿主可能没有活跃会话（用户停在新会话页、或会话已关闭）
- `sendPrompt` 在没有活跃会话时**抛错**，不能静默排队
- 宿主 `AtPanel` 的候选项（`atItems`）由各 connector 内部构造，**无插件注册扩展点**

## 现状分析

### 宿主 @ 面板机制
```
InputBarView → model.commands.atItems → AtPanel
                                  ↑
                    TeamComposerConnector 硬编码构造（基于 team.members）
```

宿主的 `AtPanel` 接收 `commands.atItems`，这些数据由 connector（如 `TeamComposerConnector`）在 `useMemo` 中构造。**plugin-sdk 当前没有暴露 `registerAtPanelItems()` 或类似的 API**，因此插件无法向宿主的 @ 选择器注册自定义候选项。

### 可行路径

| 方案 | 是否需要改宿主 | 体验 | 可行性 |
|------|---------------|------|--------|
| **A. 插件注册 @ 候选项** | ✅ 需要 | 最佳（弹出选择器） | ❌ plugin-sdk 无此 API |
| **B. insertText 插入 `@表名`** | ❌ 不需要 | 可用（无选择器，手动输入） | ✅ 当前实现 |
| **C. sendPrompt 直接发送** | ❌ 不需要 | 可用（自动发送） | ✅ 当前实现 |

**当前决策：方案 B + C 组合使用**

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

### 2. 未授权处理规范
**禁止仅 `console.warn` 后静默降级。** 当权限检查失败时：
- 通过 `ctx.ui.notify()` 展示 toast 提示用户去授权
- 同时继续降级到 `insertText`（不阻塞用户操作，但至少让用户知道权限问题）

### 3. 右键上下文注入入口
数据库工作台提供三个右键/按钮入口，将数据库对象上下文回灌到宿主 AI 对话框：

| 触发位置 | 菜单项 | 注入内容 | 函数 |
|---------|--------|---------|------|
| 连接树 → 连接节点右键 | "发送到 AI 分析" | 连接名 + 数据库类型 + 列表示意 | `sendConnectionToAi()` |
| 连接树 → 表节点右键 | "发送到 AI 分析" | 连接名 + `@schema.table` + SELECT * LIMIT 100 | `sendTableToAi()` |
| 查询结果网格工具栏 | "分析结果" | SQL 语句 + 前 20 行 JSON 样本 | `sendQueryToAi()` |

### 4. 交互流程（四级阶梯）

```
┌──────────────────────────────────────────────────────────────┐
│ 用户右键点击连接/表/结果 → 构造 prompt 文本                   │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 第 0 级：权限预检                                             │
│   getPermissions().has("agent.session.read" && "write")      │
│   → 未授权：ctx.ui.notify() 提示用户 + 继续走降级链路          │
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
│   → 失败：ctx.ui.notify() 报错，用户操作不阻断                   │
└──────────────────────────────────────────────────────────────┘
```

### 5. `@` 提及的轻量级实现
由于宿主没有暴露 @ 选择器注册 API，当前采用 **insertText 插入格式化文本** 的方式：

- 表分析 prompt 中包含 `` @`schema.table` `` 格式的提及
- 连接分析 prompt 中包含 `` @`连接名` `` 格式的提及
- agent 模型能够识别这些 `@xxx` 引用并据此查询相应数据库对象

**这不是完整的 @ 选择器体验**（无弹出列表、无键盘导航），但实现了功能等价的信息传递。

### 6. Prompt 构造规范
- **表分析**：`请帮我分析数据库连接「{name}」中的表 `@`{schema}.{table}`。可以先查看表结构（列、类型、主键），再抽样数据了解其内容与用途：\nSELECT * FROM {schema}.{table} LIMIT 100;`
- **连接分析**：`请帮我了解 {dbType} 数据库连接 `@`{name}`。可以先列出其中的表，再挑选关键表分析结构与样本数据。`
- **查询结果分析**：`我在连接「{name}」上执行了以下 SQL，请帮我分析结果：\n\`\`\`sql\n{sql}\n\`\`\`\n部分结果（JSON）：\n\`\`\`json\n{前20行}\n\`\`\``

## 后果

### 正面
- 无需修改宿主代码，完全在插件侧实现
- 右键即注入，与 dbx 桌面壳的交互习惯一致
- 有活跃会话时即时发送，无活跃会话时自动创建
- 权限缺失时给出 toast 提示 + 继续降级，不静默失败
- 四级降级链路保证至少能填入输入框

### 负面
- **没有 @ 弹出选择器**：用户无法通过 `@` 键浏览和选择数据库对象
- 自动创建会话会打断用户当前可能正在准备的新会话
- `insertText` 降级路径不自动发送，需要用户手动确认

### 风险
- 宿主 `conversation.on()` 的 replay 行为依赖宿主版本，旧版本可能不触发初始 `conversation-changed`
- 3 秒超时在宿主响应慢时可能误判为"无活跃会话"

### 待宿主支持的扩展点
| 扩展点 | 期望能力 | 依赖宿主 PR |
|--------|---------|-------------|
| `registerAtPanelItems()` | 插件向宿主 @ 面板注册自定义候选项（数据库/表/schema） | 需要 plugin-sdk + 宿主 AtPanel 支持 |
| `registerMentionProvider()` | 插件提供动态搜索回调（用户键入 `@pg` 时搜索 PostgreSQL 连接） | 需要宿主 InputBar 支持 |

## 参考
- `packages/plugins/plugin-sdk/dist/conversation.d.ts`
- `packages/plugins/plugin-sdk/dist/ui.ts` — `PluginInputActionContribution` / `PluginNewSessionContextContribution`
- `apps/desktop/src/renderer/domains/conversation/connectors/team/TeamComposerConnector.tsx` — `atItems` 构造方式
- `apps/desktop/src/renderer/domains/conversation/components/input-bar/InputBarView.tsx` — `AtPanel` 挂载点
- `abilities/plugins/web-element-picker/src/WebElementPickerPanel.tsx` — `hasActiveConversation` 实现
- `packages/plugins/presets/astravia-ui-design/src/notes/handoff.ts` — `createSession` → `sendPrompt` 模式
