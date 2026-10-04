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

### 2. 交互流程（三级阶梯）

```
┌──────────────────────────────────────────────┐
│ 1. 检查权限 agent.session.read + .write      │
│    → 未授权：弹窗指引用户到设置页授权          │
└──────────────┬───────────────────────────────┘
               ▼
┌──────────────────────────────────────────────┐
│ 2. 探测是否有活跃会话                         │
│    conversation.on("conversation-changed")   │
│    → 有：直接走第 3 步                        │
│    → 无：走第 4 步                            │
└──────────────┬───────────────────────────────┘
               ▼
┌──────────────────────────────────────────────┐
│ 3. 发送 prompt                                │
│    conversation.sendPrompt(text)              │
│    → 成功：resolve                            │
│    → 失败/排队：继续 fallback                  │
└──────────────┬───────────────────────────────┘
               ▼
┌──────────────────────────────────────────────┐
│ 4. 创建新会话 + 发送                          │
│    conversation.createSession(".")            │
│    → resolve 后 conversation.sendPrompt(text) │
│    → 失败：最终 fallback insertText            │
└──────────────────────────────────────────────┘
```

### 3. 活跃会话探测
参考 `web-element-picker` 的做法，使用 `conversation.on()` 订阅，收到 `conversation-changed` 事件后检查 `event.conversation.id !== null`。设置 3 秒超时防止永久挂起。

### 4. 失败回退
- 如果 `createSession` 也失败（权限不足/宿主版本不支持），最后降级为 `insertText`（填入宿主输入框，不自动发送）
- 所有失败路径都通过 `console.warn` 输出日志，不阻断用户操作

## 后果

### 正面
- 无需修改宿主代码，完全在插件侧实现
- 有活跃会话时即时发送，无活跃会话时自动创建
- 权限缺失时给出明确提示，不静默失败
- 降级链路保证至少能填入输入框

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
