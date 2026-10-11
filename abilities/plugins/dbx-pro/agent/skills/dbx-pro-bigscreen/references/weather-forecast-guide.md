# JWeatherForecast 天气预报组件完整脚本

> comp_ops.py 不支持 JWeatherForecast，必须用自定义脚本直接操作 template 数组添加。
> dataType 必须为 1（自动获取天气数据），不是 0。chartData 为 `"[]"`。

## 完整脚本模板

```python
import sys, json, os
os.environ['no_proxy'] = '*'
os.environ['NO_PROXY'] = '*'
sys.path.insert(0, '.')
import bi_utils
bi_utils.API_BASE = API_BASE
bi_utils.TOKEN = TOKEN

page = bi_utils.query_page(PAGE_ID)
tmpl = page.get('template', [])
bi_utils._page_components[PAGE_ID] = tmpl

W, H = 311, 47

# ⚠️ 关键：dataType/chartData/size 必须放在 config 内部，config 必须是 JSON 字符串
cfg = {
    "dataType": 1,
    "chartData": "[]",
    "size": {"width": W, "height": H},
    "background": "#FFFFFF00",
    "borderColor": "#FFFFFF00",
    "card": {"title": ""},
    "option": {
        "city": "",
        "template": 11,  # 改这个值切换版本（见版本表）
        "num": 2,
        "fontSize": 16,
        "fontColor": "#fff",
        "bgColor": "#ffffff00",
        "url": ""
    }
}

comp = {
    "i": bi_utils._gen_uuid(),
    "component": "JWeatherForecast",
    "componentName": "天气预报-滚动版",
    "x": 50, "y": 280, "w": W, "h": H,
    "visible": True,
    "orderNum": 0,
    "config": json.dumps(cfg, ensure_ascii=False),  # ⚠️ 必须 json.dumps，不能是 dict
    "dataMapping": {}
}

bi_utils._page_components[PAGE_ID].insert(0, comp)
bi_utils.save_page(PAGE_ID)
```

## 常见错误（实测 2026-04-21）

| 错误写法 | 正确写法 | 后果 |
|---------|---------|------|
| `comp["dataType"] = 1`（顶层） | `cfg["dataType"] = 1`（config内） | 组件不渲染 |
| `comp["chartData"] = "[]"`（顶层） | `cfg["chartData"] = "[]"`（config内） | 组件不渲染 |
| `"config": {...}`（dict） | `"config": json.dumps({...})`（JSON字符串） | 组件不渲染 |
| 漏写 `size` | `cfg["size"] = {"width": w, "height": h}` | 组件不渲染 |
| 漏写 `visible: True` | 顶层加 `"visible": True` | 组件隐藏 |
| 漏缓存 template | `bi_utils._page_components[PAGE_ID] = tmpl` | 清空已有组件 |

## 使用说明

- `option.template` 值决定版本样式（见 SKILL.md 版本表）
- 切换版本只需修改 `template` 数值和 `componentName`
- `option.city` 留空时自动定位城市

## ⚠️ city 字段格式（实测 2026-04-21）

`option.city` 必须是**数组** `["省份code", "城市拼音"]`，不能是字符串。

**原因**：组件内部取 `city[1]` 作为天气 iframe URL 的 `py` 参数（`https://i.tianqi.com?...&py=zhuzhou`）。若传字符串 `"株洲"`，则 `"株洲"[1]` = `"洲"`，天气接口无法识别。

```python
# ✅ 正确
cfg['option']['city'] = ['430000', 'zhuzhou']   # 湖南省株洲市

# ❌ 错误（city[1] 取到单个汉字"洲"，不生效）
cfg['option']['city'] = '株洲'
```

**常用城市参考（省份code + 城市拼音，来自 city_data.ts）：**

| 城市 | 值 |
|------|-----|
| 北京 | `['110000', 'beijing']` |
| 上海 | `['310000', 'shanghai']` |
| 广州 | `['440000', 'guangzhou']` |
| 深圳 | `['440000', 'shenzhen']` |
| 杭州 | `['330000', 'hangzhou']` |
| 长沙 | `['430000', 'changsha']` |
| 株洲 | `['430000', 'zhuzhou']` |
| 武汉 | `['420000', 'wuhan']` |
| 成都 | `['510000', 'chengdu']` |
| 西安 | `['610000', 'xian']` |

其他城市拼音可在 `packages/utils/areaData/city_data.ts` 中查找对应 `value` 字段。
