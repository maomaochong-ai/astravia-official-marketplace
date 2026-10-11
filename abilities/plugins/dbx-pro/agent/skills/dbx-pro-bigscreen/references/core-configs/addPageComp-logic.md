# 大屏组件创建逻辑参考

> 提取自 `packages/dragEngine/otherStyles/DragEngineScreen.vue`
> 描述新组件如何被添加到大屏页面。

---

## addPageComp 函数流程

**位置**: DragEngineScreen.vue 第 738-828 行

### 入参
```typescript
addPageComp(item: MenuItemConfig, position?: {x: number, y: number})
```
- `item`: 菜单项配置，含 `name`, `compType`, `compConfig`
- `position`: 可选坐标，不传则自动计算

### 执行流程

```
1. 单例组件检查 → addOnceComp 数组中的组件只能添加一个
2. 组件数量上限检查 → MAX_COMPONENT = 20
3. online/design 类型 → 路由到表单选择弹窗
4. 解析 compConfig（字符串→对象，默认 {size:{}}）
5. calcCompAttr() → 计算 w/h/maxY
6. 构建 newItem 对象
7. 特殊组件处理（JIframe/JCustomCard/JDragEditor → 弹窗）
8. 标准路径:
   a. 记录撤销历史
   b. 如果组件支持自定义颜色 → 应用 dragData.sysDefColor
   c. layoutMode=='group' → 添加到组内
   d. 否则 → componentData.unshift(newItem)
```

---

## newItem 对象结构

```javascript
let newItem = {
  componentName: item.name,          // 显示名称（如 '基础柱形图'）
  config: obj.config,                // 完整配置对象（来自 compConfig）
  component: item.compType,          // 组件类型 ID（如 'JBar'）
  i: uuid(),                         // 唯一标识符
  x: position?.x || 0,              // X 坐标（像素）
  y: position?.y || obj.maxY,       // Y 坐标（计算或指定）
  w: obj.w,                          // 宽度（像素，默认 450）
  h: obj.h,                          // 高度（像素，默认 300）
  visible: true,                     // 可见性
  orderNum: obj.maxY,               // 排序号
};
```

### 可选字段（特殊场景添加）
- `group`: 标记为组容器
- `props.elements`: 组内子组件数组
- `groupStyle`: 组内组件定位（top/left/width/height 百分比）
- `mobileX/mobileY/pcX/pcY`: 移动端/PC 响应式定位（保存时设置）

---

## calcCompAttr 位置计算

**位置**: 第 875-906 行

```javascript
function calcCompAttr(config, newComp) {
  // 1. 获取 x=0 列所有组件的 Y 值
  let yArr = dragData['componentData']
    .filter(item => item.x === 0)
    .map(item => item.y);

  // 2. 找最大 Y 值
  let currentMaxY = yArr.length > 0 ? Math.max(...yArr) : 0;

  // 3. 找到该 Y 值对应的组件
  let maxYItem = dragData['componentData']
    .filter(item => item.y === currentMaxY);

  // 4. 新组件 Y = 最底部组件的 y + h
  let maxY = maxYItem.length > 0 ? currentMaxY + maxYItem[0].h : 0;

  // 5. 确定高度（优先级: newComp.h > compConfig.h > 300）
  let h = newComp?.h || newComp?.compConfig?.h || 300;

  // 6. 非文本组件高度缩放（h<40 时 ×10）
  if (!['JText','JNumber','JCurrentTime','JWeatherForecast'].includes(newComp.compType)) {
    h = h < 40 ? h * 10 : h;
  }

  // 7. 宽度处理（默认 450，<24 时 ×40）
  config.w = config.w ?? 450;
  if (config.w < 24) config.w *= 40;

  // 8. 设置 size
  config['size'] = { height: h };

  return { w: config.w, maxY, h, config };
}
```

**关键规则**:
- 新组件默认 x=0，自动堆叠到最底部
- 文本类组件不做高度缩放
- 宽度/高度有最小阈值自动放大逻辑

---

## componentData 数组结构

```javascript
dragData.componentData = [
  {
    componentName: '基础柱形图',
    config: { w:450, h:300, dataType:1, url:'...', chartData:[...], option:{...} },
    component: 'JBar',
    i: 'uuid-string',
    x: 0,       // 像素坐标
    y: 0,       // 像素坐标
    w: 450,     // 像素宽度
    h: 300,     // 像素高度
    visible: true,
    orderNum: 0,
  },
  // ... 更多组件
]
```

**注意**: `unshift()` 添加，最新组件在数组首位。

---

## screenGlobal 全局状态

```javascript
const screenGlobal = reactive({
  showConfigPane,                    // 右侧配置面板显隐
  getData,                           // 获取全部页面数据
  setData,                           // 设置页面数据
  history: {
    canRedo, canUndo,
    add(options),                    // 添加历史记录
    redo(),                          // 重做
    undo(),                          // 撤销
  },
});
// provide('screenGlobal', screenGlobal)
```

---

## 保存流程（saveDragData）

**位置**: 第 633-717 行

### 1. 清理临时字段
从每个组件移除: `selected`, `isExpand`, `id`（递归清理 group 子组件）

### 2. 设置移动端/PC 定位
```javascript
item.mobileX = 0;
item.mobileY = index;
item.pcX = item.x;
item.pcY = item.y;
```

### 3. 构建保存对象
```javascript
{
  id: props.pageId,
  name: dragData.name,
  backgroundColor: dragData.backgroundColor,
  desJson: formatData({
    width: dragData.width || 1920,
    height: dragData.height || 1080,
    waterMark: dragData.waterMark,
    sysDefColor: dragData.sysDefColor,
    layoutMode: dragData.layoutMode,
    autoRefresh: dragData.autoRefresh,
  }),
  theme: dragData.theme || 'default',
  style: dragData.style || 'default',
  coverUrl: dragData.coverUrl,
  designType: dragData.designType || 100,
  backgroundImage: dragData.backgroundImage,
  template: JSON.stringify(componentData),  // 组件数组 JSON
  updateCount: dragData.updateCount,
}
```

### 4. API 调用 + IndexedDB 缓存

---

## 自定义颜色支持

当 `dragData.sysDefColor` 存在且组件在 `supportCustomColorComp` 列表中时：
```javascript
newItem.config.option.customColor = dragData.sysDefColor;
```

**支持自定义颜色的组件**: JBar, JLine, JPie, JFunnel, JBubble, JRadialBar, JActiveRing, JRing, JMultipleBar, JStackBar 等所有 ECharts 图表组件。

---

## 组模式（Group）处理

当 `dragData.layoutMode === 'group'` 时:
1. 查找可见的组容器: `componentData.find(item => item.group && item.visible)`
2. 计算组内最底部位置
3. 添加到组的 `props.elements` 数组
4. 调用 `updateGroupAfterAdd()` 更新组样式

---

## 关键常量（constant.ts）

| 常量 | 值 | 说明 |
|------|---|------|
| MAX_COMPONENT | 20 | 单页最大组件数 |
| excludeScreenComp | [...] | 大屏模式不可用组件 |
| addOnceComp | [...] | 只能添加一次的组件 |
| supportCustomColorComp | [...] | 支持自定义调色板的组件 |
| timeSave | [...] | 自动保存间隔选项 |
