# 表单布局模式（Layout Modes）

表单设计器支持四种布局模式，通过 JSON 配置的 `layout` 字段或 Python `create_form()` 的 `layout` 参数指定。

## 布局模式一览

| 模式 | 说明 | 适用场景 |
|------|------|---------|
| `auto`（默认） | 字段数 >= 6 时自动切换为半行两列布局，否则整行 | 大多数表单，让系统自动决定 |
| `half` | 强制半行两列布局 | 字段较多、希望紧凑排列 |
| `full` | 强制整行布局 | 字段较少、或每个字段需要完整宽度 |
| `word` | Word 文档表格风格（带边框、标签分列） | **仅在用户明确要求时使用** |

## auto 模式

默认模式。根据字段数量自动选择布局：
- 字段数 < 6：每个字段占一整行（等同 `full`）
- 字段数 >= 6：适合的字段两两配对为半行（等同 `half`）

## half 模式

强制将适合的字段两两配对，每行放两个字段（`autoWidth: 50`）。

**保持整行的控件（不参与配对）：**
- textarea、editor、markdown
- file-upload、imgupload
- sub-table-design、divider

奇数个适合半行的控件时，最后一个保持整行。

## full 模式

所有字段强制整行显示（`autoWidth: 100`），不做半行处理。适合字段较少或每个字段内容较长的表单。

## word 模式

模拟传统 Word 文档中的表格样式，适用于需要打印或正式存档的审批单、申请表。

**视觉特征：**
- 所有字段包裹在带黑色边框的栅格表格中
- 标签在左列（独立 `text` 控件，16px，居中），控件在右列（隐藏原生标题）
- 顶部有居中加粗大标题（24px 的 `text` 控件）

**实现原理：**
- `formStyle: "word"`，Word 风格 CSS 已内置于表单设计器，自动生效
- 每行一个 Grid 容器，className = `form-grid form-grid-word-theme`
- `showHeaderTitle: false`、`disabledAutoGrid: true`

**栅格 span 分配规则：**
- 两列行（半行控件配对）：标签1 `span=6` + 控件1 `span=6` + 标签2 `span=4` + 控件2 `span=8`
- 单列行（textarea/file-upload 等宽控件）：标签 `span=6` + 控件 `span=18`

**保持整行的控件：** hand-sign、textarea、file-upload、imgupload、divider、editor、markdown、sub-table-design

**divider 特殊处理：** Word 布局下 divider 自动包裹在 `span=24`、`isWordStyle=true` 的 grid 容器中，与表格边框视觉一致。

> CSS 定制（如修改边框颜色）详见 `desform-css-enhance.md`。

## 使用方式

**JSON 配置：**
```json
{"layout": "word"}
```

**Python 工厂函数：**
```python
create_form('表单名', 'form_code', [...], layout='word')
```

> 用法示例详见 `desform-examples.md`（模式 C：半行布局、模式 G：Word 风格）。
