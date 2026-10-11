# 大屏组件右键操作 API 指南

大屏设计器中组件的右键操作（图层排序、复制、删除、锁定等），通过 API 操作 `template` 数组实现。

> **核心原理**：`template` 数组的索引顺序决定 z-index（索引越小 = 层级越高 = 越靠前），所有图层操作本质上是数组元素的位置移动。

## 操作一览表

| 操作 | action 标识 | 快捷键 | 说明 |
|------|-----------|--------|------|
| 置顶 | `top` | Ctrl+↑ | 移到数组第一位（最前面） |
| 置底 | `bottom` | Ctrl+↓ | 移到数组最后一位（最后面） |
| 上移一层 | `moveUp` | Shift+↑ | 与前一个元素交换位置 |
| 下移一层 | `moveDown` | Shift+↓ | 与后一个元素交换位置 |
| 复制 | `copy` | Ctrl+C | 深拷贝组件并粘贴到数组开头 |
| 剪切 | `cut` | Ctrl+X | 深拷贝 + 删除原组件 |
| 粘贴 | `paste` | Ctrl+V | 将复制的组件插入数组开头，偏移 10px 避免重叠 |
| 删除 | `remove` | Delete/Backspace | 从数组中移除组件 |
| 锁定/解锁 | `lock` | Ctrl+L | 切换 `disabled` 字段，锁定后不可拖拽 |
| 组合 | `group` | — | 多选组件合并为 JGroup（见 group-guide.md） |
| 拆分 | `ungroup` | — | JGroup 拆回独立组件 |
| 修改组合 | `modifyGroup` | Ctrl+M | 打开弹窗编辑 JGroup 内部子组件 |
| 预览 | `view` | — | 预览单个组件效果 |
| 编辑 | `edit` | — | 打开组件编辑面板 |
| 联动设置 | `linkageSetting` | — | 配置组件间联动 |
| 清空联动 | `clearLinkage` | — | 清除已有联动配置 |

## API 操作方式（Python）

所有操作通过修改 `template` 数组后调用 `save_page()` 实现。

### 基础准备

```python
import sys, json
sys.path.insert(0, r'引用路径')
from bi_utils import *
import bi_utils

init_api('<api_base>', '<token>')
PAGE_ID = '页面ID'

page = query_page(PAGE_ID)
tmpl = page.get('template', [])
if isinstance(tmpl, str):
    tmpl = json.loads(tmpl)
```

### 1. 置顶（top）

将目标组件移到数组第一位（z-index 最高）。

```python
def action_top(tmpl, target_id):
    """将组件移到最前面（数组索引 0）"""
    idx = next((i for i, c in enumerate(tmpl) if c['i'] == target_id), -1)
    if idx > 0:
        comp = tmpl.pop(idx)
        tmpl.insert(0, comp)
    return tmpl

# 使用
tmpl = action_top(tmpl, '目标组件ID')
bi_utils._page_components[PAGE_ID] = tmpl
save_page(PAGE_ID)
```

### 2. 置底（bottom）

将目标组件移到数组最后一位（z-index 最低）。

```python
def action_bottom(tmpl, target_id):
    """将组件移到最后面（数组末尾）"""
    idx = next((i for i, c in enumerate(tmpl) if c['i'] == target_id), -1)
    if idx >= 0 and idx < len(tmpl) - 1:
        comp = tmpl.pop(idx)
        tmpl.append(comp)
    return tmpl
```

### 3. 上移一层（moveUp）

与前一个元素交换位置，索引减 1。

```python
def action_move_up(tmpl, target_id):
    """上移一层（索引 -1，更靠前）"""
    idx = next((i for i, c in enumerate(tmpl) if c['i'] == target_id), -1)
    if idx > 0:
        tmpl[idx], tmpl[idx - 1] = tmpl[idx - 1], tmpl[idx]
    return tmpl
```

### 4. 下移一层（moveDown）

与后一个元素交换位置，索引加 1。

```python
def action_move_down(tmpl, target_id):
    """下移一层（索引 +1，更靠后）"""
    idx = next((i for i, c in enumerate(tmpl) if c['i'] == target_id), -1)
    if idx >= 0 and idx < len(tmpl) - 1:
        tmpl[idx], tmpl[idx + 1] = tmpl[idx + 1], tmpl[idx]
    return tmpl
```

### 5. 复制（copy + paste）

深拷贝组件，生成新 ID，偏移位置避免重叠，插入到数组开头。

```python
import copy

def action_copy_paste(tmpl, target_id):
    """复制组件并粘贴到数组开头"""
    idx = next((i for i, c in enumerate(tmpl) if c['i'] == target_id), -1)
    if idx < 0:
        return tmpl
    new_comp = copy.deepcopy(tmpl[idx])
    new_comp['i'] = bi_utils._gen_uuid()
    new_comp['selected'] = False
    new_comp['x'] += 10  # 偏移避免重叠
    new_comp['y'] += 10
    # 如果是组合元素，子组件也需要新 ID
    if new_comp.get('group') and new_comp.get('props', {}).get('elements'):
        for child in new_comp['props']['elements']:
            child['i'] = bi_utils._gen_uuid()
    tmpl.insert(0, new_comp)
    return tmpl
```

### 6. 删除（remove）

从数组中移除指定组件。

```python
def action_remove(tmpl, target_id):
    """删除组件"""
    idx = next((i for i, c in enumerate(tmpl) if c['i'] == target_id), -1)
    if idx >= 0:
        tmpl.pop(idx)
    return tmpl
```

### 7. 锁定/解锁（lock）

切换组件的 `disabled` 字段。锁定后组件不可拖拽、不可编辑，右键只显示"解锁"选项。

```python
def action_lock_toggle(tmpl, target_id):
    """切换锁定状态"""
    idx = next((i for i, c in enumerate(tmpl) if c['i'] == target_id), -1)
    if idx >= 0:
        tmpl[idx]['disabled'] = not tmpl[idx].get('disabled', False)
        tmpl[idx]['selected'] = False
    return tmpl
```

### 8. 批量操作示例

实际场景中经常需要批量调整图层顺序，比如把装饰类组件全部置底、数据类组件置顶：

```python
def reorder_by_priority(tmpl, top_ids=None, bottom_ids=None):
    """按优先级重排：top_ids 置顶，bottom_ids 置底，其余保持原序"""
    top_ids = top_ids or []
    bottom_ids = bottom_ids or []

    top_comps = [c for c in tmpl if c['i'] in top_ids]
    bottom_comps = [c for c in tmpl if c['i'] in bottom_ids]
    middle_comps = [c for c in tmpl if c['i'] not in top_ids and c['i'] not in bottom_ids]

    return top_comps + middle_comps + bottom_comps
```

## 组合元素内部操作

JGroup 内部子组件的操作与顶层类似，但操作的是 `props.elements` 数组而不是 `template` 数组。

```python
def action_in_group(tmpl, group_id, child_id, action_fn):
    """对组合内部子组件执行操作"""
    group_idx = next((i for i, c in enumerate(tmpl) if c['i'] == group_id), -1)
    if group_idx < 0:
        return tmpl
    elements = tmpl[group_idx].get('props', {}).get('elements', [])
    # 对子组件数组执行相同的操作函数
    tmpl[group_idx]['props']['elements'] = action_fn(elements, child_id)
    return tmpl

# 示例：将组合内某子组件置顶
tmpl = action_in_group(tmpl, 'group-id', 'child-id', action_top)
```

## 右键菜单显示规则

不同状态下右键菜单项会有差异：

| 状态 | 菜单变化 |
|------|---------|
| 组件已锁定（`disabled=True`） | 只显示"解锁"按钮 |
| 组合元素（`group=True`） | 显示"拆分"替代"组合"，显示"修改组合" |
| 非组合元素 | 隐藏"修改组合" |
| 多选状态（`selected` 多个为 true） | "组合"按钮启用 |
| 组合内部子组件 | 隐藏"锁定/解锁" |
| 图层模式为组合模式 | 仅"组合设计"可用，其余禁用 |

## 源码位置

| 文件 | 职责 |
|------|------|
| `packages/dragEngine/components/bigScreenComponents/rightMenu/useActions.ts` | 所有右键操作的核心实现 |
| `packages/dragEngine/components/bigScreenComponents/rightMenu/contextmenu/index.ts` | 右键菜单弹出逻辑，ActionType 类型定义 |
| `packages/dragEngine/components/bigScreenComponents/rightMenu/contextmenu/Menu.vue` | 右键菜单 UI 组件（floating-ui 定位） |
| `packages/dragEngine/components/bigScreenComponents/ModifyGroup/ModifyGroup.vue` | 修改组合弹窗（拆分/重组子组件） |
| `packages/dragEngine/components/bigScreenComponents/ModifyGroup/utils.ts` | `makeGroup()` / `cancelGroup()` / `calcAfterScale()` |
