# ADR-0001: 插件侧与宿主 AI 对话的双向交互架构

## 状态
已实施

## 背景
dbx-pro 需要将数据库上下文（连接、表结构、查询结果）发送给宿主的 AI 对话系统，让用户在宿主 AI 对话框中直接对数据库进行分析。期望的交互方式是：用户在宿主输入框中键入 `@` 后，弹出一个选择器，可以浏览和选择已连接的数据库、schema、表等层级信息。

## 约束
- **不得修改宿主源码**（`open-astravia`）
- 仅通过插件 SDK 暴露的 `PluginContext` 门面交互
- 宿主可能没有活跃会话（用户停在新会话页、或会话已关闭）
- `sendPrompt` 在没有活跃会话时**抛错**，不能静默排队

## 现状分析

### 宿主 @ 面板机制
```
InputBarView → model.commands.atItems → AtPanel
                              ↑
            TeamComposerConnector 硬编码构造（基于 team.members）
```

宿主的 `AtPanel` 接收 `commands.atItems`，这些数据由 connector 内部构造。**plugin-sdk 当前没有暴露 `registerAtPanelItems()` 或类似的 API**，因此插件无法向宿主的 @ 选择器注册自定义候选项。

### 可行路径

| 方案 | 是否需要改宿主 | 体验 | 可行性 |
|------|---------------|------|--------|
| **A. 插件注册 @ 候选项** | ✅ 需要 | 最佳（弹出选择器） | ❌ plugin-sdk 无此 API |
| **B. Activity Tab 数据库浏览器** | ❌ 不需要 | 好（独立面板浏览） | ✅ 已实现 |
| **C. 右键弹窗选择发送方式** | ❌ 不需要 | 好（可编辑后发送） | ✅ 已实现 |
| **D. insertText 插入 `@表名`** | ❌ 不需要 | 可用 | ✅ 已实现 |

**当前决策：方案 B + C + D 组合使用**

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
- toast 必须包含具体缺失的权限名（如 `agent.session.read`）
- 同时继续降级到 `insertText`（不阻塞用户操作）

### 3. Activity Tab @ 选择器
注册独立的 activity tab `dbx-at-picker`，提供数据库浏览与 @ 注入能力：

```tsx
ctx.ui.registerActivityTab({
  id: "dbx-at-picker",
  label: "数据库",
  component: DatabaseAtPicker,
  scope_use: ["conversation", "project"],
  initiallyVisible: false,
  order: 11,
});
```

用户通过输入栏「数据库」按钮打开此面板，浏览连接 → schema → 表，点击表名后通过 `conversation.insertText()` 注入 `` @`连接:表` `` 到宿主输入草稿。

### 4. Input Action 快捷按钮
注册输入栏按钮，点击后打开 @ 数据库选择器：

```tsx
ctx.ui.registerInputAction({
  id: "dbx-at-picker-toggle",
  label: "数据库",
  icon: <DatabaseIcon />,
  defaultActive: false,
  scope_use: ["conversation", "project"],
  onToggle(active) {
    if (active) ctx.ui.openActivityTab("dbx-at-picker");
  },
});
```

### 5. 右键弹窗：选择发送方式
右键连接/表/结果时，弹出 `SendToAiDialog` 对话框，预填 prompt 文本，提供三种操作：

| 按钮 | 行为 |
|------|------|
| **直接发送** | 走 `sendPrompt` → `createSession` → `insertText` 降级链路，自动发送 |
| **仅填入输入框** | 只走 `insertText`，不自动发送，用户可手动修改后发送 |
| **取消** | 关闭对话框，不发送 |

### 6. `@` 提及格式与交互
由于宿主 AtPanel 不支持插件注册候选项，采用 **轻量级 @ 提及** 格式：

- 表引用：`` @`连接名:schema.表名` ``（如 `` @`prod:public.users` ``）
- 连接引用：`` @`连接名` ``（如 `` @`warehouse` ``）

注入到宿主输入框后，用户可以：
- **直接发送**：agent 模型识别 `@xxx` 引用并查询相应数据库对象
- **手动删除**：用户可以在输入框中按退格键或选中后按 X 按钮移除提及
- **编辑**：用户可以在发送前修改 prompt 文本

agent 侧通过 dbx-pro MCP 工具（`dbx_list_tables`、`dbx_describe_table`、`dbx_execute_query`）识别这些引用并执行对应查询。

### 7. 交互流程（四级阶梯）

```
┌──────────────────────────────────────────────────────────────┐
│ 用户右键点击连接/表/结果 → 弹出 SendToAiDialog 编辑 prompt    │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│ 用户选择发送方式：                                            │
│   - 直接发送 → 走第 1-3 级                                    │
│   - 仅填入输入框 → 走第 4 级                                  │
│   - 取消 → 关闭对话框                                        │
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

### 8. Prompt 构造规范

| 场景 | 格式 |
|------|------|
| **表分析** | `请帮我分析数据库连接 @\`{name}\` 中的表 @\`{schema}.{table}\`。\n请先查看表结构（列、类型、主键），然后抽样数据了解其内容与用途：\nSELECT * FROM {schema}.{table} LIMIT 100;` |
| **连接分析** | `请帮我了解 {dbType} 数据库连接 @\`{name}\`。\n请先列出该连接中的可用表。` |
| **查询结果分析** | `我在连接 @\`{name}\` 上执行了以下 SQL，请帮我分析结果：\n\`\`\`sql\n{sql}\n\`\`\`\n部分结果（JSON）：\n\`\`\`json\n{前20行}\n\`\`\`` |

**注意**：连接级上下文只需要列出可用表，不需要「再挑选关键表分析结构与样本数据」—— 连接本身不包含需要重新抽样的数据。

## 后果

### 正面
- 无需修改宿主代码，完全在插件侧实现
- 三种注入方式：activity tab 浏览器 / 右键弹窗 / 结果分析按钮
- 右键弹窗让用户选择发送方式，支持编辑后发送，不自动发送
- 有活跃会话时即时发送，无活跃会话时自动创建
- 权限缺失时给出 toast 提示 + 继续降级，不静默失败
- 四级降级链路保证至少能填入输入框
- @ 提及可在宿主输入框中被用户手动删除或编辑

### 负面
- **没有原生 @ 弹出选择器**：宿主 AtPanel 无插件注册扩展点，当前使用 activity tab 替代
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
- `packages/plugins/plugin-sdk/dist/ui.ts` — `PluginInputActionContribution` / `PluginActivityTabContribution`
- `apps/desktop/src/renderer/domains/conversation/connectors/team/TeamComposerConnector.tsx` — `atItems` 构造方式
- `apps/desktop/src/renderer/domains/conversation/components/input-bar/InputBarView.tsx` — `AtPanel` 挂载点
- `abilities/plugins/web-element-picker/src/WebElementPickerPanel.tsx` — `hasActiveConversation` 实现
- `packages/plugins/presets/astravia-ui-design/src/notes/handoff.ts` — `createSession` → `sendPrompt` 模式
- `packages/plugins/presets/image-gen/src/index.tsx` — `registerInputAction` 用法
