# 节点完整参考

每种节点的完整配置（options、inputParams/outputParams、校验规则、特殊行为与使用要点），编辑节点前必须先查本文档对应片段。

> **start 和 end 节点的常用配置已内联到 SKILL.md**（因为每个流程都需要这两个节点）。本文档仅包含它们的进阶配置（定时触发、cardConfig、子流程输出行为）。

> **查阅方式**：按 SKILL.md 中的 `NODE_OPTIONS_INDEX` 索引表给出的 `offset` / `limit` 直接 `Read`，只读该片段、勿全量读（索引失效时用 `Grep` 搜索 `## <节点type>` 兜底定位）。

---

## start — 定时触发配置

> start 节点的 inputParams、type 枚举、校验规则等常用配置见 SKILL.md，此处仅记录定时触发（cronTrigger）的详细配置。

### options.cronTrigger 字段

| 参数 | 类型 | 默认值 | 可选值/范围 | 说明 |
|------|------|--------|------------|------|
| `cronTrigger.enabled` | boolean | `false` | — | 是否启用定时触发 |
| `cronTrigger.cronType` | string | `'day'` | `'minute'` / `'hour'` / `'day'` / `'custom'` | Cron 类型 |
| `cronTrigger.cronExp` | string | `'0 0 0 * * ?'` | 6段 Cron 表达式 | Cron 表达式（秒 分 时 天 月 星期） |
| `cronTrigger.beginTime` | string\|null | `null` | `'YYYY-MM-DD HH:mm:ss'` | 有效开始时间 |
| `cronTrigger.endTime` | string\|null | `null` | `'YYYY-MM-DD HH:mm:ss'` | 有效结束时间 |
| `cronTrigger.inputParams` | object | `{}` | 键值对 | 定时触发时的默认输入参数值 |
| `cronTrigger.custom` | object | 见下方 | — | 自定义 Cron 配置（cronType='custom' 时使用） |

**cronType 对应的 Cron 表达式生成规则：**

| cronType | 生成的 cronExp | 说明 |
|----------|--------------|------|
| `'minute'` | `{s} 0/1 * * * ?` | 每分钟触发（s 取自 beginTime 的秒） |
| `'hour'` | `{s} {m} 0/1 * * ?` | 每小时触发（s/m 取自 beginTime） |
| `'day'` | `{s} {m} {h} * * ?` | 每天触发（s/m/h 取自 beginTime，默认 0 0 0） |
| `'custom'` | 由 custom 对象生成 | 自定义组合 |

**custom 对象结构：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `custom.time.second` | number(0-59) | 秒 |
| `custom.time.minute` | number(0-59) | 分 |
| `custom.hour.mode` | string | `'every'`(每小时) / `'range'`(范围) / `'value'`(指定) / `'interval'`(间隔) |
| `custom.hour.range` | [number,number] | mode='range' 时，小时范围 0-23 |
| `custom.hour.values` | number[] | mode='value' 时，指定小时列表 |
| `custom.hour.interval` | {start,step} | mode='interval' 时，起始小时和间隔 |
| `custom.day.type` | string | `'day'`(按天) / `'week'`(按星期) |
| `custom.day.day.mode` | string | `'every'` / `'range'` / `'value'` / `'interval'` / `'last'`(月末) |
| `custom.day.week.values` | number[] | 星期值 1-7（周一至周日） |
| `custom.month.mode` | string | `'every'`(每月) / `'value'`(指定月份) |
| `custom.month.values` | number[] | 指定月份 1-12 |

---

## end — 进阶配置

> end 节点的 outputType 模式、校验规则等常用配置见 SKILL.md，此处仅记录 cardConfig 结构和子流程输出行为。

### cardConfig 结构（outputType='card' 时）

| 参数 | 类型 | 说明 |
|------|------|------|
| `cardConfig.style` | number | 卡片样式（共 4 种样式可选） |
| `cardConfig.title` | string | 标题字段（引用 LLM 输出变量名） |
| `cardConfig.content` | string | 内容字段（引用 LLM 输出变量名） |
| `cardConfig.image` | string | 图片字段（引用 LLM 输出变量名） |
| `cardConfig.linkUrl` | string | 跳转路径字段（引用 LLM 输出变量名） |
| `cardConfig.enableLink` | boolean | 是否启用点击跳转 |

### 作为子流程时的输出行为

| outputType | 子流程支持 | 下游节点可引用的输出 |
|-----------|-----------|-------------------|
| `'default'` | 支持 | end 节点的所有 outputParams 变量 |
| `'text'` | 支持 | 固定输出一个 `outputText` 变量（内容为 outputContent 拼装后的文本） |
| `'card'` | **不支持** | 选择子流程时会被拦截，无法选中 |

---

## llm — 大模型节点

### options 字段

| 参数 | 类型 | 默认值 | 可选值/范围 | 说明 |
|------|------|--------|------------|------|
| `model.modeId` | string | `''` | 系统 AI 模型 ID | **必填**。通过 `list_llm_models()` 获取可用模型列表，取返回值中的 `value` 字段。修改时必须同步更新 `params.model` |
| `model.params.model` | string | `''` | — | **必填**。模型名称标签，设为 `list_llm_models()` 返回值中对应的 `text` 字段。前端依赖此字段显示模型名称，留空会导致界面不显示模型名。必须与 `modeId` 同步设置 |
| `model.params.temperature` | number\|null | `null` | 0.1-1 步长0.1 | 温度：越大越随机创意，越小越精准。null 表示使用模型默认值 |
| `model.params.topP` | number\|null | `null` | 0.1-1 步长0.1 | 词汇多样性：越小越单调，越大越多样 |
| `model.params.presencePenalty` | number\|null | `null` | -2 到 2 步长0.1 | 话题惩罚：控制新话题引入 |
| `model.params.frequencyPenalty` | number\|null | `null` | -2 到 2 步长0.1 | 重复惩罚：避免重复用词 |
| `model.params.maxTokens` | number\|null | `null` | 1-16000 | 最大回复长度：普通聊天500-800，长文4000+ |
| `model.params.timeout` | number | `60` | 1-3600 | 超时时间（秒） |
| `history` | number | `3` | 0+ | 携带历史记录条数（多轮对话上下文） |
| `messages[0].role` | string | `'system'` | 固定值 | 系统提示词角色 |
| `messages[0].content` | string | 李白角色模板 | 任意文本 | 系统提示词内容（定义 AI 的角色和行为） |
| `messages[1].role` | string | `'user'` | 固定值 | 用户提示词角色 |
| `messages[1].content` | string | `''` | 支持变量引用 | 用户提示词（用 `{{变量name}}` 引用 inputParams 中绑定的变量） |
| `systemPromptMode` | string | `'fill'` | `'fill'` / `'ref'` | 系统提示词模式：fill=手动输入，ref=关联提示词库 |
| `systemPromptRefId` | string | `''` | 提示词库 ID | ref 模式下关联的提示词 ID |
| `systemPromptRefName` | string | `''` | — | ref 模式下提示词名称（展示用） |
| `plugins` | array | `[]` | — | MCP 插件列表 |
| `plugins[i].pluginId` | string | — | MCP ID | MCP 插件唯一标识 |
| `plugins[i].pluginName` | string | — | — | MCP 插件名称 |
| `plugins[i].category` | string | `'mcp'` | `'mcp'` / `'plugin'` | 插件类别：mcp=MCP 服务，plugin=普通插件 |
| `showToolExecution` | boolean | `false` | — | 是否展示工具调用过程（仅流式输出有效） |
| `structuredOutput` | boolean | `false` | — | 是否启用结构化输出（启用后 AI 返回 JSON） |
| `structuredOutputFields` | array | `[]` | — | 结构化输出字段定义 |
| `structuredOutputFields[i].field` | string | — | 字母/数字/下划线 | 字段编程名（后续节点引用用） |
| `structuredOutputFields[i].name` | string | — | — | 字段显示名称 |
| `structuredOutputFields[i].type` | string | `'string'` | `'string'`/`'number'`/`'boolean'`/`'object'`/`'array'`/`'string[]'`/`'number[]'`/`'object[]'` | 字段类型 |
| `structuredOutputFields[i].desc` | string | `''` | — | 字段描述（注入到 AI 提示词中辅助理解） |

### outputParams

| 场景 | outputParams |
|------|-------------|
| structuredOutput=false（默认） | `[{field: 'text', name: '回复内容', type: 'string'}]` |
| structuredOutput=true | 从 structuredOutputFields 动态映射生成 |

### 校验规则

| 条件 | 错误消息 |
|------|---------|
| model.modeId 为空 | `必须选择模型` |
| structuredOutput=true 且字段列表为空 | `启用结构化输出时，至少需要配置一个输出字段` |
| structuredOutput=true 且某字段 field 为空 | `结构化输出字段名不能为空` |

### 提示词中的变量引用

messages 的 system content 和 user content 都支持 `{{变量名}}` 引用。变量名来自 inputParams 中的 `name` 字段。

**引用流程**：
1. 在 inputParams 中绑定变量：`{"field": "content", "name": "用户问题", "nodeId": "start-node"}`
2. 在 messages content 中用 `{{用户问题}}` 引用
3. 后端执行时自动将 `{{用户问题}}` 替换为上游节点的实际值（简单字符串替换）

**没有内置系统变量**。如需域名等信息，需通过前置 code 或 http 节点获取后传入 inputParams。

### 插件/MCP 配置

`plugins` 数组用于给 LLM 节点挂载工具调用能力。配置后 AI 可在对话中动态调用这些工具。`showToolExecution=true` 时流式输出中会展示工具调用过程。

### 特殊行为

- systemPromptMode='ref' 但 systemPromptRefId 为空时，自动降级为 'fill' 模式
- model.params 中 null 值表示该参数未启用，使用模型默认值
- messages 数组固定 2 个元素，第一个 system 第二个 user，不可增删

---

## switch — 条件分支节点

### options 字段

| 参数 | 类型 | 默认值 | 可选值 | 说明 |
|------|------|--------|--------|------|
| `if` | array | 见下方 | — | IF 分支条件数组，至少 1 个 |
| `if[i].logic` | string | `'AND'` | `'AND'` / `'OR'` | 同一分支内多条件的逻辑关系 |
| `if[i].conditions` | array | 见下方 | — | 该分支的条件列表 |
| `if[i].conditions[j].nodeId` | string | `''` | 前置节点 ID | 条件数据来源节点 |
| `if[i].conditions[j].field` | string | `''` | 输出字段名 | 条件数据来源字段 |
| `if[i].conditions[j].operator` | string | `'EQUALS'` | 见下方操作符表 | 比较操作符 |
| `if[i].conditions[j].value` | string | `''` | 任意 | 比较值 |
| `if[i].remarks` | string | `''` | 任意 | 分支备注/标签 |
| `if[i].next` | string | `''` | 节点 ID | **必填**。该分支的下游节点 ID，必须与 edges 中的目标节点一致 |
| `else` | object | `{next: ''}` | — | ELSE 分支 |
| `else.next` | string | `''` | 节点 ID | **必填**。ELSE 的下游节点 ID，必须与 edges 中的目标节点一致 |

**完整操作符表：**

| operator | 标签 | 含义 | 值类型 |
|----------|------|------|--------|
| `EQUALS` | 等于 | `field == value` | 字符串/数字 |
| `NOT_EQUALS` | 不等于 | `field != value` | 字符串/数字 |
| `CONTAINS` | 包含 | `field.includes(value)` | 字符串 |
| `NOT_CONTAINS` | 不包含 | `!field.includes(value)` | 字符串 |
| `GT` | 大于 | `field > value` | 数字 |
| `GTE` | 大于等于 | `field >= value` | 数字 |
| `LT` | 小于 | `field < value` | 数字 |
| `LTE` | 小于等于 | `field <= value` | 数字 |
| `LEN_EQ` | 长度等于 | `field.length == value` | 数字 |
| `LEN_GT` | 长度大于 | `field.length > value` | 数字 |
| `LEN_GTE` | 长度大于等于 | `field.length >= value` | 数字 |
| `LEN_LT` | 长度小于 | `field.length < value` | 数字 |
| `LEN_LTE` | 长度小于等于 | `field.length <= value` | 数字 |
| `EMPTY` | 为空 | `field == null \|\| field == ''` | 不需要 value |
| `NOT_EMPTY` | 不为空 | `field != null && field != ''` | 不需要 value |

### outputParams

| field | name | type |
|-------|------|------|
| `index` | 分支索引 | number |

### 校验规则

| 条件 | 错误消息 |
|------|---------|
| if 数组为空 | `"IF"分支条件不能为空` |
| 某个分支未连接下游节点 | `"CASE X"分支未连接下一个节点` |

### 动态锚点

| 分支 | sourceAnchorId 格式 | Y 坐标 |
|------|-------------------|--------|
| 第 1 个 IF | `{nodeId}_source_if` | rightAnchor.y + 34 |
| 第 N 个 ELIF (N≥2) | `{nodeId}_case_{N}` | rightAnchor.y + 34 + 26×(N-1) |
| ELSE | `{nodeId}_source_else` | rightAnchor.y + 34 + 26×(分支总数-1) |

### 使用要点

1. **每个分支都必须有边**：IF/ELIF/ELSE 每个分支都必须有一条带对应 `sourceAnchorId` 的边连接到下游节点，不能遗漏任何分支（尤其是 ELSE），即使多个分支指向同一个目标节点也需要各自独立的边。
2. **next 字段必须和 edges 一致**：`if[i].next` / `else.next` 的值必须与 edges 中的 `targetNodeId` 一致。
3. **互斥分支汇合时用 varMerge**：当多个分支各自产出结果后需要汇合到同一个下游节点时，不要让下游节点直接分别引用各分支的输出变量（运行时只有一个分支执行，其他变量为空）。正确做法是在汇合处插入 `varMerge` 节点聚合。

---

## classifier — 分类器节点

### options 字段

| 参数 | 类型 | 默认值 | 可选值/范围 | 说明 |
|------|------|--------|------------|------|
| `model.modeId` | string | `''` | 系统 AI 模型 ID | **必填**。通过 `list_llm_models()` 获取，取 `value` 字段。修改时必须同步更新 `params.model` |
| `model.params.model` | string | `''` | — | **必填**。模型名称标签，取 `list_llm_models()` 返回的 `text` 字段。前端依赖此字段显示模型名称，必须与 `modeId` 同步设置 |
| `model.params.temperature` | number | `0.7` | 0.1-1 步长0.1 | 温度（推荐 0.5-0.8） |
| `model.params.topP` | number\|null | `null` | 0.1-1 步长0.1 | 词汇多样性 |
| `model.params.presencePenalty` | number\|null | `null` | -2 到 2 步长0.1 | 话题惩罚 |
| `model.params.frequencyPenalty` | number\|null | `null` | -2 到 2 步长0.1 | 重复惩罚 |
| `model.params.maxTokens` | number\|null | `null` | 1-16000 | 最大回复长度 |
| `categories` | array | 2 个空分类 | — | 分类列表，至少 1 个 |
| `categories[i].category` | string | `''` | 任意文本 | **必填**。分类主题描述 |
| `categories[i].next` | string | `''` | 节点 ID | **必填**。该分类的下游节点 ID，必须与 edges 一致 |
| `else` | object | `{next: ''}` | — | ELSE 分支（无匹配时） |
| `else.next` | string | `''` | 节点 ID | **必填**。ELSE 的下游节点 ID，必须与 edges 一致 |

### outputParams

| field | name | type |
|-------|------|------|
| `index` | 分类索引 | number |
| `content` | 分类描述 | string |

### 动态锚点

| 分支 | sourceAnchorId 格式 | Y 坐标间距 |
|------|-------------------|-----------|
| 第 N 个分类 | `{nodeId}_case_{N}` | 44px |
| ELSE | `{nodeId}_case_else` | 44px |

### 校验规则

| 条件 | 错误消息 |
|------|---------|
| model.modeId 为空 | `必须选择模型` |
| categories 为空 | `至少需要一个分类` |
| 某个分类的 category 为空 | `分类描述不能为空` |
| 某个分支未连接下游节点 | `分类"xxx"未连接下一个节点` |

### 使用要点

1. **每个分类 + ELSE 都必须有边**：每个 category 和 ELSE 分支都必须有一条带对应 `sourceAnchorId` 的边，不能遗漏（尤其是 ELSE）。
2. **next 字段必须和 edges 一致**：`categories[i].next` / `else.next` 的值必须与 edges 中的 `targetNodeId` 一致。
3. **互斥分支汇合时用 varMerge**：同 switch 节点规则，多个分类分支的结果需要通过 varMerge 聚合后再给下游使用。

---

## knowledge — 知识库检索节点

### options 字段

| 参数 | 类型 | 默认值 | 可选值/范围 | 说明 |
|------|------|--------|------------|------|
| `knowIds` | string[] | `[]` | 非空数组 | **必填**。通过 `list_knowledge_bases()` 获取知识库列表，取其中的 `id` 字段。支持多个 |
| `topNumber` | number | `5` | 1-10 | Top K 检索数量（全局设置，每个知识库也可单独配置覆盖） |
| `similarity` | number\|null | `0.7` | 0-1 步长0.01，或 null | Score 阈值。null 表示禁用过滤（每个知识库也可单独配置覆盖） |

### inputParams

至少 1 个查询变量（从前置节点的输出参数中选择）。

### outputParams

| field | name | type |
|-------|------|------|
| `documents` | 文档列表 | object[] |
| `data` | 文档内容 | string |

### 校验规则

| 条件 | 错误消息 |
|------|---------|
| knowIds 为空 | `必须选择至少一个知识库` |
| inputParams 无查询变量 | `查询变量: 必填` |

---

## knowledgeWrite — 知识库写入节点

### options 字段

| 参数 | 类型 | 默认值 | 可选值/范围 | 说明 |
|------|------|--------|------------|------|
| `writeType` | string | `'text'` | `'text'` / `'file'` | 写入模式。file 模式支持：txt/md/pdf/docx/doc/xlsx/xls/pptx/ppt，不支持的扩展名会抛异常 |
| `knowIds` | string[] | `[]` | 长度为 1 | 知识库 ID（仅支持单个） |
| `content` | string | `''` | 支持变量引用 | 文本内容（writeType='text' 时） |
| `fileSources` | array | `[]` | — | 文件来源（writeType='file' 时） |
| `fileSources[i].nodeId` | string | — | 前置节点 ID | 文件变量所在节点 |
| `fileSources[i].field` | string | — | type='file' 的字段 | 文件变量字段名 |
| `segmentStrategy` | string | `'auto'` | `'auto'` / `'custom'` | 分段策略（auto 隐藏详细配置） |
| `separator` | string | `'\\n'` | `'\\n'`/`'\\n\\n'`/`'。'`/`'！'`/`'？'`/`'.'`/`'!'`/`'?'`/`'custom'` | 分段标识符 |
| `customSeparator` | string | `''` | 任意 | separator='custom' 时的自定义分隔符 |
| `maxSegment` | number | `800` | 100-5000 | 分段最大长度（字符） |
| `overlap` | number | `10` | 0-90 | 分段重叠度（%） |
| `textRules` | string[] | `[]` | `'cleanSpaces'` / `'removeUrlsEmails'` | 文本预处理规则 |
| `waitForVectorize` | boolean | `false` | — | 是否等待向量化完成 |
| `waitTimeout` | number | `300` | 30-1800 | 等待超时（秒） |
| `vectorizeFailStrategy` | string | `'ignore'` | `'error'` / `'ignore'` | 向量化失败/超时策略 |

**textRules 可选值：**

| 值 | 含义 |
|----|------|
| `'cleanSpaces'` | 替换连续空格、换行符和制表符 |
| `'removeUrlsEmails'` | 删除所有 URL 和电子邮箱地址 |

### outputParams

| field | name | type |
|-------|------|------|
| `documentId` | documentId | string |
| `documentIds` | documentIds | string[] |

---

## code — 脚本执行节点

### options 字段

| 参数 | 类型 | 默认值 | 可选值 | 说明 |
|------|------|--------|--------|------|
| `codeType` | string | `'javascript'` | `'javascript'` / `'python'` / `'groovy'` / `'aviator'` | 脚本语言 |
| `code` | string | JS 模板 | 非空 | **必填**。脚本内容 |

**各语言的函数签名和返回值规范：**

| codeType | 函数签名 | 返回值 |
|----------|---------|--------|
| `javascript` | `function main(params) { return {...} }` | 返回对象，键对应 outputParams 的 field |
| `python` | `resp = {"result": ...}` （直接赋值 resp 变量） | 字典，键对应 outputParams 的 field |
| `groovy` | `def main(params) { return [...] }` | Map 对象 |
| `aviator` | `let resp = seq.map("key", value);` | 通过 `seq.map` 构建 |

### inputParams（可自定义）

| field | name | nodeId | 说明 |
|-------|------|--------|------|
| （自定义） | arg1 | （前置节点ID） | 通过 `params.arg1` 访问 |
| （自定义） | arg2 | （前置节点ID） | 通过 `params.arg2` 访问 |

### outputParams（可自定义）

默认 `[{field: 'result', name: '返回结果', type: 'string'}]`，可自由编辑字段名和类型。

### 特殊行为

- 节点 ID 自动加前缀 `code_`（如 `code_7467906976467390464`）
- inputParams 和 outputParams 都可完全自定义

---

## http — HTTP 请求节点

### options 字段

| 参数 | 类型 | 默认值 | 可选值/范围 | 说明 |
|------|------|--------|------------|------|
| `http.url` | string | `''` | 支持变量引用 | **必填**。请求地址 |
| `http.method` | string | `'GET'` | `'GET'` / `'POST'` / `'PUT'` / `'DELETE'` | HTTP 方法 |
| `http.headers` | object | `{}` | 键值对 | 请求头（值支持变量引用） |
| `http.requestParams` | object | `{}` | 键值对 | URL 查询参数（值支持变量引用） |
| `http.requestBody.type` | string | `'none'` | `'none'` / `'json'` / `'form-data'` / `'x-www-form-urlencoded'` / `'raw'` | 请求体类型 |
| `http.requestBody.body` | string | `''` | 支持变量引用 | 请求体内容 |
| `http.timeout` | number | `120` | ≥0 | 超时时间（秒），0=不限 |
| `http.retriesTimes` | number | `0` | ≥0 | 失败重试次数 |

### outputParams

| field | name | type |
|-------|------|------|
| `body` | 回复内容 | string |
| `statusCode` | 状态码 | number |

### 特殊行为

- 系统会自动在请求头中注入当前登录用户的 `X-Access-Token` 和租户标识 `X-Tenant-Id`，调用内部接口时无需手动设置鉴权头
- URL 中可使用 `{{domainURL}}` 引用当前域名（系统内置变量，无需在 inputParams 中绑定）
- 支持自定义输出变量：除固定的 `body` 和 `statusCode` 外，可通过添加自定义 outputParams 从 `body` 中提取特定字段

### 校验规则

| 条件 | 错误消息 |
|------|---------|
| http.url 为空 | `请求地址必须填写` |

---

## sql — SQL 查询节点

### options 字段

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sql.dataSourceId` | string | `''` | **必填**。通过 `list_data_sources()` 获取数据源列表，取返回值中的 `id` 字段 |
| `sql.dataSourceName` | string | `''` | **必填**。数据源名称，取返回值中的 `name` 字段 |
| `sql.dataSourceCode` | string | `''` | **必填**。数据源编码，取返回值中的 `code` 字段。后端运行时通过此编码连接数据源，为空会报"缺少必要参数" |
| `sql.outputSql` | string | `''` | **必填**。SQL 语句（支持 `{{变量name}}` 引用） |

**数据源选择**：通过 `query -w <workId> --resource datasources` 获取可用数据源列表，每条记录包含 `id`、`name`、`code` 三个字段，sql 节点必须同时填写这三个值。

### outputParams

| field | name | type |
|-------|------|------|
| `body` | sql执行返回结果 | string（可切换为 number 或 object[]） |

**输出类型选择**：点击 type 可切换为 `string`、`number`、`object[]` 三种类型。

| SQL 类型 | 可用输出类型 | 返回内容 |
|---------|-----------|---------|
| SELECT 查询 | string 或 object[] | JSON 集合对象 |
| INSERT/UPDATE/DELETE | string 或 number | 受影响的行数 |

---

## subflow — 子流程节点

### options 字段

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `subflowId` | string | `''` | **必填**。子流程 ID（通过子流程选择器获取） |

### inputParams 特殊字段

subflow 的 inputParams 除标准字段外，还有 `nameText`（子流程中该参数的原始显示名称）：
```json
{"name": "content", "nameText": "用户问题", "field": "content", "nodeId": "start-node"}
```
- `name` — 子流程中定义的参数名（编程名）
- `nameText` — 子流程中定义的参数显示名称

### 特殊行为

- inputParams/outputParams 从选中的子流程自动继承
- inputParams 过滤掉 `history` 字段
- 不能选择 endOutputType='card' 的流程
- 不能选择自身流程
- **子流程输出类型影响可引用的变量**：JSON 格式暴露所有 outputParams；文本格式固定输出 `outputText` 变量（内容为 end 节点拼装后的文本）

---

## enhanceJava — Java 增强节点

### options 字段

| 参数 | 类型 | 默认值 | 可选值 | 说明 |
|------|------|--------|--------|------|
| `enhance.type` | string | `'class'` | `'class'` / `'spring'` | class=Java 类完整路径，spring=Spring Bean 名称 |
| `enhance.path` | string | `''` | 非空 | 类路径（如 `com.example.MyEnhancer`）或 Bean 名称 |

### inputParams/outputParams

默认各 2 个 input（arg1, arg2）和 1 个 output（result），可自定义。

### 开发要求

- 增强类必须实现接口 `org.jeecg.modules.airag.flow.component.enhance.IAiRagEnhanceJava`
- 业务逻辑写在 `Map<String, Object> process(Map<String, Object> inputParams)` 方法中
- 使用 `@Component` 注解可注册为 Spring Bean（方便注入其他服务）
- 增强类必须与流程后端代码在同一项目中，否则运行时无法找到

---

## tools — 工具调用节点

### options 字段

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `tools.pluginId` | string | `''` | **必填**。插件/MCP 的 ID |
| `tools.pluginName` | string | `''` | 插件名称（选择时自动填充） |
| `tools.pluginCategory` | string | `'plugin'` | `'plugin'`(插件) / `'mcp'`(MCP 协议) |
| `tools.toolName` | string | `''` | **必填**。选中的工具名称 |
| `tools.toolDescr` | string | `''` | 工具描述（自动填充） |
| `tools.toolParameters` | array | `[]` | 工具参数配置 |
| `tools.toolParameters[i].name` | string | — | 参数名称 |
| `tools.toolParameters[i].description` | string | — | 参数描述 |
| `tools.toolParameters[i].required` | boolean | — | 是否必填 |
| `tools.toolParameters[i].type` | string | — | 参数类型（String/Number/Boolean 等） |
| `tools.toolParameters[i].location` | string | `'Query'` | 参数位置（Query/Path/Body） |
| `tools.toolParameters[i].value` | string | `''` | 参数值（支持 `{{变量name}}` 引用（需先在 inputParams/outputParams 中绑定）） |
| `tools.endpoint` | string | `''` | API 端点（选择插件时自动填充） |
| `tools.path` | string | `''` | 请求路径（选择工具时自动填充） |
| `tools.method` | string | `''` | HTTP 方法（自动填充） |
| `tools.headers` | object | `{}` | 请求头（自动填充） |

### outputParams

| field | name | type |
|-------|------|------|
| `result` | 执行结果 | string |

---

## braveSearch — Brave 搜索节点

### options 字段

| 参数 | 类型 | 默认值 | 可选值/范围 | 说明 |
|------|------|--------|------------|------|
| `braveSearch.count` | number | `5` | 1-20 | 返回结果数量 |
| `braveSearch.country` | string | `''` | 两位国家代码（CN/US 等） | 国家/地区过滤（可选） |
| `braveSearch.searchLang` | string | `''` | `'zh-hans'` / `'zh-hant'` / `'en'` / `'ja'` | 搜索语言（可选） |
| `braveSearch.freshness` | string | `''` | `'pd'`(24h) / `'pw'`(周) / `'pm'`(月) / `'py'`(年) | 时效过滤（可选，空=不限） |

### inputParams

至少 1 个搜索关键词变量（required=true）。搜索词长度不超过 400 字符，超长时建议在前置 LLM 节点中提取关键词再传入。

### outputParams

| field | name | type |
|-------|------|------|
| `result` | 搜索结果 | object[] |

### 使用要点

推荐的典型流程模式：`start → LLM(提取搜索关键词) → braveSearch → LLM(总结搜索结果) → end`。直接将用户原始问题作为搜索词往往效果不佳，通过前置 LLM 提取精练关键词可以显著提升搜索质量。

---

## reply — 直接回复节点

### options 字段

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `content` | string | `''` | **必填**。回复内容（支持 `{{变量name}}` 引用（需先在 inputParams/outputParams 中绑定）） |
| `stream` | boolean | `false` | 是否启用流式输出（见下方说明） |

### 与 end 节点的区别

| 维度 | reply | end |
|------|-------|-----|
| 终止流程 | 否，流程继续执行后续节点 | 是，流程到此结束 |
| 流式输出 | 支持（stream=true） | 不支持 |
| 使用场景 | 中间回复、LLM 流式输出 | 最终输出 |

### 核心用途：开启 LLM 流式输出

reply 节点最重要的用途是**让 LLM 节点实现流式输出**。LLM 节点本身没有流式输出开关，默认是阻塞模式（等全部生成完才返回）。要实现打字机效果（逐字输出），需要在 LLM 节点后面接一个 reply 节点：

1. reply 节点的 `stream` 设为 `true`
2. reply 节点的 `inputParams` 中绑定 LLM 输出（如 `{field:"text", name:"回复内容", nodeId:"<llm节点ID>", type:"string"}`），`content` 中用 `{{回复内容}}` 引用
3. 系统检测到 reply 引用了 LLM 的输出且开启了 stream，会自动将被引用的 LLM 节点切换为流式输出模式

**示例流程**：`start → llm → reply(stream=true, inputParams绑定llm输出, content="{{回复内容}}") → end`

这个流程中，LLM 生成的回复会以流式方式逐字推送给用户，而不是等全部生成完再一次性返回。

### 使用要点

- reply 的内容在流程结束后**会被丢弃**，不保留在最终结果中。需要保留输出时必须用 end 节点。
- reply 主要用于两个场景：1) 配合 LLM 开启流式输出；2) 在流程中间给用户推送进度信息。
- **错误用法**：用 reply 代替 end 来结束某个分支。运行时用户在流式传输中能看到内容，但最终结果为空。
- **流式非阻塞副作用**：开启 stream 后，被引用的 LLM 节点从阻塞式变为非阻塞式（不等待大模型完全返回就执行下一步）。如果其他节点也引用了该 LLM 的输出变量，可能拿到空值。设计流程时需注意只让 reply 节点引用该 LLM 输出，或确保其他引用在 reply 之后的路径上。

### 校验规则

| 条件 | 错误消息 |
|------|---------|
| content 为空 | `回复内容不能为空` |

---

## loop — 循环节点

### options 字段

| 参数 | 类型 | 默认值 | 可选值/范围 | 说明 |
|------|------|--------|------------|------|
| `type` | string | `'counted'` | `'counted'` / `'infinite'` / `'array'` | 循环类型 |
| `maxLoopTimes` | number | `3` | 1-1000 | type='counted' 时的循环次数 |
| `loopParams` | array | `[]` | — | 循环变量列表 |
| `loopParams[i].name` | string | — | — | 循环变量名称 |
| `loopParams[i].nodeId` | string | — | 前置节点 ID | 变量来源节点（可选） |
| `loopParams[i].field` | string | — | — | 变量来源字段 |
| `loopParams[i].customValue` | any | — | — | 自定义初始值 |
| `loopParams[i].isCustom` | boolean | — | — | 是否使用自定义值 |
| `loopItemsParam` | object | `{}` | — | type='array' 时的迭代数组变量 |
| `loopItemsParam.nodeId` | string | — | 前置节点 ID | 数组来源节点 |
| `loopItemsParam.field` | string | — | — | 数组来源字段 |
| `loopItemsParam.type` | string | — | 必须以 `[]` 结尾 | 必须是数组类型（string[]/number[]/object[]） |

**三种循环模式对比：**

| 模式 | 终止条件 | 固定参数 | 必要条件 |
|------|---------|---------|---------|
| `counted` | 达到 maxLoopTimes | `currentLoopTimes`(当前次数，从 1 开始) | maxLoopTimes > 0 |
| `infinite` | 手动 break | `currentLoopTimes`(从 1 开始) | 循环体内必须有 break 节点 |
| `array` | 数组遍历完 | `currentLoopTimes`(从 1 开始) + `currentLoopItem`(当前项) | loopItemsParam 必须是数组类型 |

### 循环体内可用的子节点

| 类型 | 用途 |
|------|------|
| `loopBreak` | 终止循环（infinite 模式必须有） |
| `loopContinue` | 跳过当前迭代，进入下一次 |
| `setLoopVar` | 设置循环变量值 |

**setLoopVar 的 options：**

| 参数 | 类型 | 说明 |
|------|------|------|
| `targetField` | string | 目标循环变量名（必须是 loopParams 中定义的） |
| `sourceVar.nodeId` | string | 来源节点 ID |
| `sourceVar.field` | string | 来源字段 |
| `sourceVar.customValue` | any | 或自定义值 |

### 校验规则

| 条件 | 错误消息 |
|------|---------|
| type='counted' 且 maxLoopTimes ≤ 0 | `请设置大于 0 的循环次数` |
| type='infinite' 且循环体内无 break 节点 | `无限循环必须在循环体内添加"终止循环"节点` |
| type='array' 且 loopItemsParam 未选择 | `请选择迭代数组变量` |
| type='array' 且变量类型不是数组 | `迭代变量必须是数组类型` |

### 使用要点

**自动联动**：创建 loop 节点时，脚本自动创建配套的 loopBody（循环体）节点和连接边（`type="base-line-edge"`），不需要手动传入 loopBody。删除 loop 或 loopBody 时，另一个及其内部子节点会被级联删除。

**循环变量与输出**：loop 的 `options.loopParams` 定义循环变量（如 `summaryResult`），循环体内通过 `setLoopVar` 修改这些变量的值。**如果下游节点需要引用循环变量的最终值，必须在 loop 节点的 `outputParams` 中声明对应的输出**（不引用则不需要声明）：

```json
// loop 节点的 options.loopParams 定义循环变量
"loopParams": [{"name": "summaryResult", "customValue": "", "isCustom": true}]

// loop 节点的 outputParams 必须同步声明（否则下游无法引用）
"outputParams": [{"field": "summaryResult", "name": "摘要汇总", "nodeId": "<loopNodeId>", "type": "string"}]
```

---

## loopBody — 循环体节点

> 内部节点，由 loop 节点自动创建，不可手动添加/删除。

循环体是一个分组容器，循环体内的子节点（如 code、llm、setLoopVar 等）放在 loopBody 内部。loopBody 有一个 `children` 数组记录其内部子节点 ID。

### options 字段

无自定义 options。

### 特殊字段

| 参数 | 类型 | 说明 |
|------|------|------|
| `children` | array | 循环体内部子节点 ID 列表，由系统维护 |

### inputParams / outputParams

无默认参数。

### 校验规则

无自定义校验。

### 使用要点

**循环体内的连线规则**：
- loop→loopBody 的边：`type="base-line-edge"`（直线，由脚本自动生成）
- loopBody→第一个子节点：`sourceAnchorId="{bodyId}_loop_start"`，`type="base-line-edge"`
- 子节点之间的连线：普通 `base-edge`
- 循环体内最后一个子节点**不需要连回 loopBody**（连回会导致 chain 生成死循环）

**循环体内节点布局**：循环体内的子节点 x 坐标应适当靠左，避免与主流程（loop 右侧）的节点产生横向重叠。建议循环体内第一个节点的 x ≈ loop.x - 600，后续节点按 X_GAP(400) 递增。

**循环体内可用的节点类型**：loopBreak、loopContinue、setLoopVar，以及其他通用节点（code、llm、http 等），但不能放 loop 和 end。

---

## loopBreak — 终止循环节点

> 内部节点，只能放在循环体内部。用于提前终止整个循环。

### options 字段

无自定义 options。

### inputParams / outputParams

无默认参数。

### 校验规则

无自定义校验。

---

## loopContinue — 继续循环节点

> 内部节点，只能放在循环体内部。用于跳过当前迭代，直接进入下一次循环。

### options 字段

无自定义 options。

### inputParams / outputParams

无默认参数。

### 校验规则

无自定义校验。

---

## setLoopVar — 设置循环变量节点

> 内部节点，只能放在循环体内部。用于将循环体内的处理结果写回循环变量，供循环结束后下游节点引用。

### options 字段

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `targetField` | string | `""` | 目标变量名，对应 loop 节点 loopParams 中的 field |
| `sourceVar` | object | `{}` | 来源变量引用 |
| `sourceVar.nodeId` | string | `""` | 引用的源节点 ID |
| `sourceVar.field` | string | `""` | 引用的源节点输出字段 |
| `sourceVar.customValue` | string | `""` | 自定义值（与 nodeId 二选一） |

### inputParams / outputParams

无默认参数。

### 校验规则

| 条件 | 错误消息 |
|------|---------|
| targetField 为空 | `目标字段不能为空(targetField)` |
| sourceVar.nodeId 和 customValue 都为空 | `来源变量必须选择引用节点或填写自定义值(sourceVar)` |
| sourceVar.nodeId 有值但 field 为空 | `来源变量已选择节点但缺少字段(sourceVar.field)` |

---

## varExtract — 变量提取器节点

### options 字段

| 参数 | 类型 | 默认值 | 可选值/范围 | 说明 |
|------|------|--------|------------|------|
| `model.modeId` | string | `''` | 系统 AI 模型 ID | **必填**。通过 `list_llm_models()` 获取，取 `value` 字段。修改时必须同步更新 `params.model` |
| `model.params.model` | string | `''` | — | **必填**。模型名称标签，取 `list_llm_models()` 返回的 `text` 字段。前端依赖此字段显示模型名称，必须与 `modeId` 同步设置 |
| `model.params.temperature` | number | `0.3` | 0.1-1 | 温度（比 LLM 默认低，更精准） |
| `model.params.timeout` | number | `60` | 1-3600 | 超时秒数 |
| `variables` | array | `[]` | 最多 10 个 | 提取变量定义列表 |
| `variables[i].name` | string | — | 最长 40 字符 | 变量名称 |
| `variables[i].field` | string | — | 自动等于 name | 字段名 |
| `variables[i].type` | string | `'string'` | `'string'` / `'number'` / `'boolean'` | 变量类型 |
| `variables[i].description` | string | `''` | 最长 120 字符 | 变量描述（指导 LLM 提取） |
| `variables[i].required` | boolean | `false` | — | 是否必填 |
| `variables[i].failTip` | string | `''` | 最长 80 字符 | required=true 时的失败提示 |
| `success` | object | `{next: ''}` | — | 提取成功分支 |
| `success.next` | string | `''` | 节点 ID | **必填**。成功分支的下游节点 ID，必须与 edges 一致 |
| `fail` | object | `{next: ''}` | — | 提取失败分支 |
| `fail.next` | string | `''` | 节点 ID | **必填**。失败分支的下游节点 ID，必须与 edges 一致 |

### inputParams

默认 1 个：`{field: 'input', name: '', nodeId: '', type: 'string'}`。实际使用时 `field` 应填写上游节点的输出字段名（如循环体内引用 `currentLoopItem`），`nodeId` 填上游节点 ID，`name` 填显示名称。

### outputParams（动态生成）

从 variables 映射 + 固定的失败输出：

| field | name | type | 来源 |
|-------|------|------|------|
| `{变量name}` | {变量name} | {变量type} | 每个 variables 条目 |
| `failVarName` | 失败变量名 | string | 固定（fail 分支） |
| `failMessage` | 失败提示 | string | 固定（fail 分支） |

### 双分支锚点

| 分支 | sourceAnchorId | Y 偏移 |
|------|---------------|--------|
| success | `{nodeId}_success` | rightAnchor.y + 34 |
| fail | `{nodeId}_fail` | rightAnchor.y + 60 |

两个分支都必须连接下游节点。

### 使用要点

1. **success 和 fail 两个分支都必须有边**：分别使用 `sourceAnchorId="{nodeId}_success"` 和 `"{nodeId}_fail"` 连接下游。
2. **next 字段必须和 edges 一致**：`success.next` / `fail.next` 的值必须与 edges 中的 `targetNodeId` 一致。

---

## varMerge — 变量聚合节点

### options 字段

| 参数 | 类型 | 默认值 | 可选值/范围 | 说明 |
|------|------|--------|------------|------|
| `varGroups` | array | 1 个空分组 | 最多 20 个 | 分组列表 |
| `varGroups[i].name` | string | `'group_1'` | 1-20 字符，唯一 | 分组名称（也是输出字段名） |
| `varGroups[i].type` | string | `''` | 由第一个变量决定 | 分组类型 |
| `varGroups[i].vars` | array | `[]` | — | 按优先级排列的变量来源 |
| `varGroups[i].vars[j].nodeId` | string | — | 前置节点 ID | 变量来源节点 |
| `varGroups[i].vars[j].field` | string | — | — | 变量来源字段 |
| `varGroups[i].vars[j].customValue` | any | — | — | 自定义值（isCustom=true 时） |
| `varGroups[i].vars[j].isCustom` | boolean | `false` | — | 是否使用自定义值 |

**取值策略**：按 vars 数组从上到下，首个非空值作为该组的输出。若整组均为空，则清除该分组在当前节点的上下文值。

**空值判定规则（按类型）：**

| 类型 | 视为"空"的条件 |
|------|--------------|
| string | null 或空字符串 |
| number | null |
| boolean | null |
| object | null 或不是 Map/Object 或为空对象 |
| array（含 string[]/number[]/object[]） | null 或不是数组或为空数组 |

**变量列表约束**：
- 每组的第 1 个变量**必须选择上游节点的输出**（不允许自定义值）
- 自定义兜底值**只能放在末尾位置**，且仅支持 string/number 类型的分组

### outputParams（动态生成）

每个 varGroup 生成一个输出：`{field: group.name, name: group.name, type: group.type}`

### 使用要点

varMerge 的核心场景是**互斥分支汇合**：当 switch/classifier 的多个分支各自产出结果后需要汇合，运行时只有一个分支执行，其他分支的变量为空。varMerge 按优先级取首个非空值，从而将各分支的同类输出聚合为一个变量。

---

## chatVarGet — 变量读取节点

### options 字段

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `variables` | array | `[{name: ''}]` | 要读取的变量名列表（至少 1 个，变量名不能重复） |
| `variables[i].name` | string | `''` | 变量名（需与 AI 应用中定义的变量名严格一致，区分大小写） |

### outputParams（动态生成）

每个 variable 生成：`{field: name, name: name, type: 'string'}`。若变量不存在或未赋值，返回空字符串。

### 使用要点

- 应用变量是**按用户隔离**的，不同用户读取到各自独立的值
- 必须在 AI 应用中关联流程后使用，否则节点报错

---

## chatVarSet — 变量赋值节点

### options 字段

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `variables` | array | `[{name: ''}]` | 要赋值的变量列表（至少 1 个，变量名不能重复） |
| `variables[i].name` | string | `''` | 变量名 |
| `variables[i].nodeId` | string | — | 来源节点 ID（isCustom=false 时，仅支持 string 类型的上游变量） |
| `variables[i].field` | string | — | 来源字段（isCustom=false 时） |
| `variables[i].customValue` | string | — | 自定义值（isCustom=true 时） |
| `variables[i].isCustom` | boolean | `false` | false=从上游节点取值，true=使用自定义常量 |

### 使用要点

- 应用变量是**按用户隔离**的
- 同一变量名被多次赋值时，后赋的值会覆盖先赋的值
- 必须在 AI 应用中关联流程后使用

---

## chatMemoryGet — 记忆检索节点

### options 字段

| 参数 | 类型 | 默认值 | 可选值/范围 | 说明 |
|------|------|--------|------------|------|
| `content` | string | `''` | 支持变量引用 | 检索关键词/语句 |
| `topNumber` | number | `5` | 1-10 | Top K 返回数量 |
| `similarity` | number\|null | `0.7` | 0-1 步长0.01，或 null | 相似度阈值。null=禁用过滤 |

### outputParams

| field | name | type |
|-------|------|------|
| `documents` | 文档列表 | object[] |
| `data` | 文档内容 | string |

**前置条件**：必须在 AI 应用中配置记忆库才能使用。

---

## chatMemorySet — 记忆写入节点

### options 字段

| 参数 | 类型 | 默认值 | 可选值/范围 | 说明 |
|------|------|--------|------------|------|
| `title` | string | `''` | 任意 | 写入标题（留空自动生成） |
| `content` | string | `''` | 支持变量引用 | **必填**。写入内容 |
| `waitForVectorize` | boolean | `false` | — | 是否等待向量化完成 |
| `waitTimeout` | number | `300` | 30-1800 | 等待超时（秒） |
| `vectorizeFailStrategy` | string | `'ignore'` | `'error'` / `'ignore'` | 向量化失败策略 |

### outputParams

| field | name | type |
|-------|------|------|
| `documentId` | documentId | string |
| `documentIds` | documentIds | string[] |

---

## sysGetUserinfo — 当前用户信息节点

### options 字段

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `fields` | string[] | `['username', 'realname']` | 需要获取的字段列表 |

**可用字段完整列表：**

| field 值 | 显示名 | type | 默认勾选 |
|----------|--------|------|---------|
| `username` | 账号 | string | 是 |
| `realname` | 姓名 | string | 是 |
| `id` | 用户ID | string | 否 |
| `orgCode` | 部门编码 | string | 否 |
| `orgId` | 部门ID | string | 否 |
| `roleCode` | 角色编码 | string | 否 |
| `avatar` | 头像 | string | 否 |
| `workNo` | 工号 | string | 否 |
| `post` | 职务 | string | 否 |
| `email` | 邮箱 | string | 否 |
| `phone` | 手机号 | string | 否 |
| `telephone` | 座机号 | string | 否 |
| `sex` | 性别(1男2女) | number | 否 |
| `birthday` | 生日 | string | 否 |

### outputParams（动态生成）

按勾选的 fields 生成：`{field: field值, name: 显示名, type: type}`

### 特殊行为

- 无输入变量，节点直接从当前请求的登录上下文（JWT Token / 会话缓存）中读取用户信息
- **必须在已登录状态下执行**：若流程在未登录环境中运行（如通过匿名接口调用），节点将抛出异常
- `birthday` 字段输出格式为 `yyyy-MM-dd`

### 校验规则

| 条件 | 错误消息 |
|------|---------|
| fields 为空 | `请至少勾选一个输出字段` |
