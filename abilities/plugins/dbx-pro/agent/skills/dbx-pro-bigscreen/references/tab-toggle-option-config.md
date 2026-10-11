# JTabToggle（导航切换）配置路径

> 来源：`TabToggleOption.vue`（配置面板）+ `TabToggle.vue`（渲染逻辑）
>
> 用途：点击/自动轮播切换高亮项，同时控制页面其他组件的显示/隐藏，实现多页面导航效果。

## ⚠️ 陷阱：personalizedMode=true 无图片时 Tab 不渲染

`option.personalizedMode: true` 是"个性化模式"，要求每个 item 配置独立的 `normalImgUrl` / `activeImgUrl`。**若图片 URL 为空字符串，组件会渲染一个空白框，Tab 文字完全不显示**（平台前端 TabToggle.vue 行为，不会报错）。

**正确做法**：
- 不使用图片时，保持 `personalizedMode: false`（默认值），使用通用 `normal` / `active` 样式
- 需要每项独立图片时才开启 `personalizedMode: true`，并为每个 item 提供有效 URL

`defaults/JTabToggle.json` 已修正为 `personalizedMode: false`。

---

## 基础配置

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 自动轮播 | `option.autoPlay` | `false` |
| 轮播时间（秒） | `option.time` | `60`；autoPlay=true 时生效 |
| 个性化模式（每项独立图片） | `option.personalizedMode` | `false` |
| 当前高亮项 value | `option.currentValue` | 第一项的 value |

## 通用样式（option.normal，普通态）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 字号 | `option.normal.fontSize` | `16` |
| 字重 | `option.normal.fontWeight` | `normal` / `bold` / `lighter` |
| 字体风格 | `option.normal.fontStyle` | `normal` / `italic` |
| 文字颜色 | `option.normal.color` | `#d8d8d8` |
| 背景色 | `option.normal.backgroundColor` | `#3a414d` |
| 边框颜色 | `option.normal.borderColor` | `""` |
| 边框宽度 | `option.normal.borderWidth` | `0` |
| 背景图片 URL | `option.normal.imgUrl` | `""` |
| 背景图片大小 | `option.normal.backgroundSize` | `100% 100%`（拉伸铺满）/ `cover` / `contain` / `auto` |
| 背景图片重复 | `option.normal.backgroundRepeat` | `no-repeat` / `repeat` / `repeat-x` / `repeat-y` |
| 背景图片位置 | `option.normal.backgroundPosition` | `center center` / `left top` 等 |
| 渐变启用（文字） | `option.normal.gradient.enabled` | `false` |
| 渐变类型 | `option.normal.gradient.type` | `linear` / `radial` |
| 渐变方向 | `option.normal.gradient.direction` | `to right` |
| 渐变起始色 | `option.normal.gradient.startColor` | `#000000` |
| 渐变结束色 | `option.normal.gradient.endColor` | `#FFFFFF` |

> `option.normal.imgUrl` 和 `option.personalizedMode` 任一为真时，背景图片的 `backgroundSize/Repeat/Position` 才会渲染。

## 高亮样式（option.active，高亮/选中态）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 字号 | `option.active.fontSize` | `16` |
| 字重 | `option.active.fontWeight` | 继承 `option.normal.fontWeight` |
| 字体风格 | `option.active.fontStyle` | 继承 `option.normal.fontStyle` |
| 文字颜色 | `option.active.color` | `#ffffff` |
| 背景色 | `option.active.backgroundColor` | `#0a73ff` |
| 边框颜色 | `option.active.borderColor` | `""` |
| 边框宽度 | `option.active.borderWidth` | `0` |
| 背景图片 URL | `option.active.imgUrl` | `""` |
| 背景图片大小 | `option.active.backgroundSize` | `100% 100%` |
| 背景图片重复 | `option.active.backgroundRepeat` | `no-repeat` |
| 背景图片位置 | `option.active.backgroundPosition` | `center center` |
| 渐变启用（文字） | `option.active.gradient.enabled` | `false` |
| 渐变类型 | `option.active.gradient.type` | `linear` / `radial` |
| 渐变方向 | `option.active.gradient.direction` | `to right` |
| 渐变起始色 | `option.active.gradient.startColor` | `#000000` |
| 渐变结束色 | `option.active.gradient.endColor` | `#FFFFFF` |

## 项目配置（option.items）

`option.items` 是数组，每项对应一个导航 Tab。

| 说明 | 配置路径 | 示例值 |
|------|---------|--------|
| 显示文字 | `option.items[i].label` | `销售概览` |
| 唯一标识（联动用） | `option.items[i].value` | `sales` |
| 切换时显示的组件 ID 列表 | `option.items[i].compVals` | `["comp_id_1", "comp_id_2"]` |

### 个性化模式专有字段（personalizedMode=true）

| 说明 | 配置路径 | 示例值 |
|------|---------|--------|
| 常态图片 URL | `option.items[i].normalImgUrl` | `""` |
| 高亮图片 URL | `option.items[i].activeImgUrl` | `""` |
| 自定义宽度（px，0=auto） | `option.items[i].width` | `0` |
| 左边距 | `option.items[i].marginLeft` | `0` |
| 右边距 | `option.items[i].marginRight` | `0` |
| 上边距 | `option.items[i].marginTop` | `0` |
| 下边距 | `option.items[i].marginBottom` | `0` |

> `compVals` 为空数组时该项不控制任何组件显隐；配置后，切换到该项时指定组件显示，其他项的 compVals 中包含的组件隐藏。

## chartData 格式

```python
chart_data = [
    {"label": "销售概览", "value": "sales"},
    {"label": "库存管理", "value": "inventory"},
    {"label": "客户分析", "value": "customer"},
    {"label": "财务报表", "value": "finance"},
]
# label=显示文字，value=唯一标识
```

## 完整 option 示例

```python
option = {
    "autoPlay": True,
    "time": 5,
    "personalizedMode": False,
    "currentValue": "sales",
    "normal": {
        "fontSize": 14,
        "fontWeight": "normal",
        "fontStyle": "normal",
        "color": "#d8d8d8",
        "backgroundColor": "#1e2a3a",
        "borderColor": "#2b4c6f",
        "borderWidth": 1,
        "imgUrl": "",
        "backgroundSize": "100% 100%",
        "backgroundRepeat": "no-repeat",
        "backgroundPosition": "center center",
        "gradient": {"enabled": False},
    },
    "active": {
        "fontSize": 14,
        "fontWeight": "bold",
        "fontStyle": "normal",
        "color": "#ffffff",
        "backgroundColor": "#0a73ff",
        "borderColor": "#40a9ff",
        "borderWidth": 1,
        "imgUrl": "",
        "backgroundSize": "100% 100%",
        "backgroundRepeat": "no-repeat",
        "backgroundPosition": "center center",
        "gradient": {"enabled": False},
    },
    "items": [
        {"label": "销售概览", "value": "sales",     "compVals": ["comp_id_1"]},
        {"label": "库存管理", "value": "inventory", "compVals": ["comp_id_2"]},
        {"label": "客户分析", "value": "customer",  "compVals": ["comp_id_3"]},
    ],
}
```

## 🚨 用 spec_builder 整屏建 JTabToggle 切换大屏的二步流程

`compVals` 需要填**组件 ID（`i` 字段，UUID）**，但 spec_builder 阶段组件还未入库，ID 是后端创建后才生成 → 必须分两步：

**Step1**：spec_builder 一次性建 `JTabToggle` + 所有 tab 的内容组件，`option.items[*].compVals` 先填空数组 `[]`。

**Step2**：`bi_utils.query_page(page_id)` 拿到 `template` 数组，按位置切片识别每个 tab 的成员组件 → 回填 `compVals` → `save_page`。

### ⛔ 不能靠 componentName 前缀分组

直觉做法是给内容组件起 `[T1] xxx` / `[T2] xxx` 这样的前缀名，step2 按前缀匹配。**这条死路**——

`spec_builder.py:1181` 用 `title = c.get('title') or c.get('name') or c.get('text', '')` 作为 `bi_utils.add_component()` 的 title 参数，传到后端写入 `componentName`。**spec 里的 `componentName` 字段被完全忽略**，最终入库的 `componentName = ECharts 标题文本`（图表组件）或 `''`（JStatsSummary / JScrollList / JTabToggle 等无 title 组件）。前缀全部丢失，分组拿到 0 个。

### ✅ 用 template 数组顺序切片

`bi_utils.add_component` 内部用 `insert(0)` 累积 → spec.components 越靠后，template index 越小。  
如果 spec 顺序固定为：`[顶部装饰/标题/时间, JTabToggle, T1×N, T2×N, T3×N, T4×N]`，则 template 反向：

```
template[0          : N]           = T4 (最后入 spec → index 最小)
template[N          : 2N]          = T3
template[2N         : 3N]          = T2
template[3N         : 4N]          = T1
template[tab_idx]                  = JTabToggle
template[tab_idx+1 :]              = 顶部装饰/标题
```

切片代码（每 tab N 个组件）：
```python
comps = page['template']  # query_page 后已自动 json.loads
tab_idx = next(i for i, c in enumerate(comps) if c.get('component') == 'JTabToggle')

# 反向：tab_idx 前 N 个 = T1，再前 N 个 = T2 ...
N = 6  # 每 tab 组件数
t1_ids = [c['i'] for c in comps[tab_idx-N    : tab_idx]]
t2_ids = [c['i'] for c in comps[tab_idx-2*N  : tab_idx-N]]
t3_ids = [c['i'] for c in comps[tab_idx-3*N  : tab_idx-2*N]]
t4_ids = [c['i'] for c in comps[tab_idx-4*N  : tab_idx-3*N]]
```

**前提**：每 tab 组件数相同且 spec.components 内严格按 T1→T2→T3→T4 排序，否则切片错位。变体方案：每 tab 写到 spec 时插入一个特征组件（如 spec 里写 title 含 `[TabMarker:1]` 等显式标记字符串），step2 用 marker 分组——但更繁琐，统一数量切片最稳。

### currentValue 与默认显示

`option.currentValue` 指定首次打开时高亮的 tab `value`。被高亮的 tab 的 `compVals` 组件显示，其他 tab 的 `compVals` 组件自动隐藏（前端 TabToggle.vue 控制）。**所有 tab 共用同一组坐标时，切换效果最佳**（同位置变内容，避免布局跳动）。
