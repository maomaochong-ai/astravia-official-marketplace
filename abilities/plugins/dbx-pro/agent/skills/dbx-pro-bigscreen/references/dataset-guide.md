# 数据集管理（动态数据源）

> **⚠️ 使用预置脚本时无需读本文件**：
> - SQL → `dataset_ops.py create-sql`
> - API → `dataset_ops.py create-api` 或 `yapi_ops.py create-mock`
> - FILES/singleFile → `files_ops.py create-bind`（一键建+绑）
> - 存储过程 → `proc_ops.py create`（需 `pip install pymysql`）
> - 数据源 → `datasource_ops.py create`
>
> **本文件适用场景**：脚本不覆盖的高级定制（动态查询参数、WebSocket、字段级翻译、端到端手写流程）。

## 快速目录（按需跳读章节）

| 你要做什么 | 跳读章节 |
|-----------|---------|
| 看 API 端点清单 | §数据集 API 端点 |
| 看数据集实体字段 | §数据集实体结构 |
| 改数据集名称 | §修改数据集属性 |
| 手写 SQL 数据集流程 | §创建 SQL 数据集 |
| 存储过程数据集 | §创建 SQL 数据集（存储过程） |
| WebSocket 实时数据 | §创建 WebSocket 数据集 |
| 单文件/多文件数据集 | §创建文件数据集 |
| API 数据集手写流程 | §创建 API 数据集 + §API 数据集端到端完整脚本示例 |
| 组件绑定数据集 | §组件绑定数据集（dataType=2） + §组件绑定数据集完整示例 |
| 数据集先查后建规则 | §数据集「先查后建」规则 |
| 带 FreeMarker 参数的 SQL | §SQL 数据集动态查询条件 + §SQL 数据集绑定图表完整端到端流程 |
| SQL+参数+字典翻译+图表 | §SQL 数据集 + 带参数查询 + 字典翻译 + 绑定图表 |
| 数据库源 ID 查表 | §数据库源 ID 参考 |
| 从零创建数据源 + SQL 数据集 + 图表（一次搞定） | §数据源 → 数据集 → 图表 端到端 |

大屏组件支持三种数据类型（`config.dataType`）：
- `1` — 静态数据（直接写在 `chartData` 中）
- `2` — 动态数据（从数据集获取，支持 SQL / API / JSON / WebSocket）
- `4` — 表单数据（从表单关联字段查询）

## 数据集 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/drag/onlDragDatasetHead/add` | POST | 创建数据集 |
| `/drag/onlDragDatasetHead/edit` | PUT | 编辑数据集（传完整实体，无需 sign） |
| `/drag/onlDragDatasetHead/delete?id=xxx` | DELETE | 删除数据集 |
| `/drag/onlDragDatasetHead/list` | GET | 分页查询数据集列表 |
| `/drag/onlDragDatasetHead/getAllChartData` | POST | 执行数据集查询（获取图表数据） |
| `/drag/onlDragDatasetHead/queryFieldBySql` | POST | 解析 SQL 返回字段列表 |
| `/drag/onlDragDatasetHead/queryFieldByApi` | POST | 解析 API 返回字段列表 |

## 数据集实体结构（OnlDragDatasetHead）

> **强制规则：创建数据集时 `parentId` 必须设为 `'0'`**（根目录分组）。不设或留空会导致数据集在管理界面中无法正确归类显示。所有预置脚本（dataset_ops.py、comp_ops.py）已内置此默认值。

```python
{
    'name': '数据集名称',
    'code': '数据集编码',
    'dataType': 'sql',             # sql / api / json / websocket / singleFile / FILES
    'dbSource': '707437208002265088',  # 数据库源 ID（SQL 类型必填！）
    'querySql': 'SELECT ...',
    'apiMethod': 'get',
    'izAgent': '0',                # 是否代理：'0'=直连, '1'=服务端代理
    'content': '',
    'parentId': '0',               # 强制设为 '0'
    'datasetItemList': [           # 注意：不是 onlDragDatasetItemList
        {'fieldName': 'name', 'fieldTxt': '名称', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 0},
        {'fieldName': 'value', 'fieldTxt': '数值', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 1}
    ],
    'datasetParamList': [          # 注意：不是 onlDragDatasetParamList
        {'paramName': 'sex', 'paramTxt': '性别', 'paramValue': '1', 'dictCode': 'sex'}
    ]
}
```

## 修改数据集属性（重命名等）

**使用 dataset_ops.py edit 命令（推荐）：**

```bash
# 重命名
py dataset_ops.py edit $API_BASE $TOKEN --id "数据集ID" --name "新名称"

# 同时修改多个属性
py dataset_ops.py edit $API_BASE $TOKEN --id "数据集ID" --name "新名称" --code "new_code" --sql "SELECT ..."
```

**API 端点：** `PUT /drag/onlDragDatasetHead/edit`，传完整实体 JSON（先 list 查到完整记录，修改目标字段后 PUT 回去）。

**操作流程（理想 2 轮）：**

| 轮次 | 操作 |
|------|------|
| 1 | Read 凭据 + cp dataset_ops.py + bi_utils.py（并行） |
| 2 | `py dataset_ops.py edit ... && rm dataset_ops.py bi_utils.py` |

**注意：** bi_utils 使用 urllib（非 requests），自定义脚本必须用 `bi_utils._request()` 发请求。

## 创建 SQL 数据集

```python
import json
import bi_utils
bi_utils.init_api('<api_base>', '<token>')

result = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={
    'name': '用户男女比例统计',
    'code': 'user_sex_ratio',
    'dataType': 'sql',
    'dbSource': '707437208002265088',
    'querySql': "SELECT sex as name, COUNT(*) AS value FROM demo WHERE sex IS NOT NULL AND sex != '' GROUP BY sex",
    'apiMethod': 'GET',
    'parentId': '0',
    'datasetItemList': [
        {'fieldName': 'name', 'fieldTxt': 'name', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 0},
        {'fieldName': 'value', 'fieldTxt': 'value', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 1}
    ],
    'datasetParamList': []
})
dataset_id = result['result']['id']

test = bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={'id': dataset_id})
print(json.dumps(test, ensure_ascii=False))
```

## 创建 SQL 数据集（存储过程）

> **参考文档：** https://help.jimureport.com/biScreen/base/data/sqlProcedure

### 概述

JimuReport SQL 数据集支持通过 `CALL procedure_name(${param})` 语法调用 MySQL 存储过程。存储过程的结果集会作为数据集的数据返回，可绑定到任意组件（表格、图表等）。

### 前置条件

**JimuReport 的 SQL 数据集 API 使用 Spring JdbcTemplate 的 `executeQuery()`，只能执行返回结果集的 SQL（SELECT / CALL），无法执行 DDL（CREATE PROCEDURE）。** 因此必须先通过其他方式在数据库中创建存储过程：
- 方法一：直接连接数据库执行 DDL（推荐，使用 pymysql）
- 方法二：通过数据库管理工具（Navicat、DBeaver 等）手动创建
- 方法三：通过 JeecgBoot 后端自定义接口执行

### 完整流程（3 步）

**Step 1：通过 pymysql 创建存储过程**

```python
import pymysql

# 连接信息从数据源 API 获取（datasource_ops.py detail --id xxx）
# 注意：JDBC URL 中的 127.0.0.1 是服务器本地地址，需替换为实际 IP
conn = pymysql.connect(
    host='<db_host>', port=3306,
    user='root', password='root',
    database='jeecg-boot', charset='utf8mb4'
)
cursor = conn.cursor()

# 先删后建（幂等）
cursor.execute("DROP PROCEDURE IF EXISTS sp_query_demo")
cursor.execute("""
CREATE PROCEDURE sp_query_demo()
BEGIN
    SELECT id, name, sex, age, birthday, salary_money, email
    FROM demo
    ORDER BY create_time DESC;
END
""")
conn.commit()

# 验证
cursor.execute("CALL sp_query_demo()")
print(f"返回 {len(cursor.fetchall())} 条记录")
cursor.close()
conn.close()
```

**带参数的存储过程：**

```sql
-- 创建带参数的存储过程
CREATE PROCEDURE sp_query_demo_by_sex(IN p_sex varchar(10))
BEGIN
    SELECT id, name, sex, age, birthday
    FROM demo
    WHERE sex = p_sex
    ORDER BY create_time DESC;
END
```

**Step 2：创建 SQL 数据集（使用 CALL 语法）**

无参数：
```bash
py comp_ops.py add $API_BASE $TOKEN $PAGE_ID \
  --comp "JCommonTable" --title "Demo数据表格" --x 50 --y 50 --w 900 --h 450 \
  --create-sql "CALL sp_query_demo()" \
  --ds-name "demo表存储过程查询" \
  --fields "id:String,name:String,sex:String,age:String,birthday:String,salary_money:String,email:String" \
  --dict "sex=sex"
```

带参数（使用 FreeMarker `${param}` 语法）：
```bash
py comp_ops.py add $API_BASE $TOKEN $PAGE_ID \
  --comp "JCommonTable" --title "Demo按性别查询" --x 50 --y 50 --w 900 --h 450 \
  --create-sql "CALL sp_query_demo_by_sex('${sex}')" \
  --ds-name "demo按性别查询" \
  --fields "id:String,name:String,sex:String,age:String,birthday:String" \
  --sql-params "sex:性别:1:sex"
```

也可用 dataset_ops.py 单独创建数据集：
```bash
py dataset_ops.py create-sql $API_BASE $TOKEN \
  --name "demo表存储过程查询" --code "sp_query_demo_ds" \
  --sql "CALL sp_query_demo()" \
  --fields "id:String,name:String,sex:String,age:String"
```

**Step 3：绑定到组件**

使用 `--dataset-name` 或 `--dataset-id` 绑定已有数据集：
```bash
py comp_ops.py add $API_BASE $TOKEN $PAGE_ID \
  --comp "JCommonTable" --title "Demo数据表格" --x 50 --y 50 --w 900 --h 450 \
  --dataset-name "demo表存储过程查询"
```

### 关键踩坑记录

| 问题 | 说明 |
|------|------|
| **JimuReport API 无法执行 CREATE PROCEDURE** | `getAllChartData` 内部用 `executeQuery()` 只能执行 SELECT/CALL，DDL 会报 `Statement.executeQuery() cannot issue statements that do not produce result sets` |
| **必须通过 pymysql 等直连数据库创建存储过程** | 安装：`py -m pip install pymysql`；JDBC URL 中 127.0.0.1 需替换为服务器实际 IP |
| **CALL 参数用 FreeMarker 语法** | `CALL sp_name('${param}')` ，不是 `CALL sp_name(?)` |
| **必须用 comp_ops.py 绑定组件** | 直接操作 bi_utils 会缺少 `dataSetId`/`dataMapping`/`fieldOption` 等关键字段，导致组件仍显示静态数据 |
| **datasource_ops.py 的 parseSQL 端点有误** | 脚本中使用 `/parseSQL` 但实际端点是 `/queryFieldBySql`（需签名） |
| **数据源 JDBC URL 中 127.0.0.1** | 这是服务器本地地址，从外部连接需替换为服务器 IP |

### pymysql 安装

```bash
py -m pip install pymysql
```

> Windows 下用 `py` 而非 `python`，Git Bash 下 `python` 命令可能不存在。

## 创建 WebSocket 数据集

> **参考文档：** https://help.jimureport.com/biScreen/base/data/websocket
>
> **预置脚本不支持 WebSocket 数据集**，必须用自定义脚本通过 `_request('POST', '/drag/onlDragDatasetHead/add')` 创建。

### 概述

WebSocket 数据集通过 WebSocket 推送技术实现图表数据的实时更新。前端组件绑定 WebSocket 数据集后，自动建立 WebSocket 连接，服务端推送数据时图表即时刷新。

### WebSocket 地址格式

```
ws://{host}:{port}/{context-path}/websocket/drag
```

- HTTP 环境用 `ws://`，HTTPS 环境用 `wss://`
- 地址存储在数据集的 `querySql` 字段中（与 API 数据集类似）

### ⚠️ socketId 关键规则（已验证，2026-04-02）

**前端 WebSocket 连接 key（socketId）= `chartId + '_' + md5(token)`**

前端源码（socketId.ts）：
```typescript
const socketId = computed(() => {
  const token = ((window as any)._CONFIG && (window as any)._CONFIG['token'])
                 || localStorage.getItem(ConfigEnum.DRAG_TOKEN);
  const wsClientId = md5(token);           // token 做 md5
  return currentPane.value.i + '_' + wsClientId;  // chartId_md5token
})
```

**服务端推送时必须使用完整 socketId，不能只用 chartId：**
```java
// 错误：webSocket.sendMessage(chartId, obj.toJSONString())
// 正确：
String wsClientId = Md5Util.md5Encode(token, "UTF-8");
String socketId = chartId + "_" + wsClientId;
webSocket.sendMessage(socketId, obj.toJSONString());
```

### 完整端到端流程（Python 脚本 + Java 推送接口）

#### Step 1：创建 WebSocket 数据集（先查后建，挂到"示例数据集"分组）

> **⚠️ getAllGroup 返回的分组记录用 `id` 字段作为 `parentId`，没有 `groupCode` 字段。**
> `addGroup` 响应的 `result` 可能为 None，需做空值处理并 fallback 到 `'0'`。

```python
import sys, json, copy
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, '.')
import bi_utils

API_BASE = '<api_base>'
TOKEN = '<token>'
PAGE_ID = 'your-page-id'
bi_utils.API_BASE = API_BASE
bi_utils.TOKEN = TOKEN

ws_url = API_BASE.replace('http://', 'ws://').replace('https://', 'wss://') + '/websocket/drag'

# ── 查询/创建 "示例数据集" 分组 ──────────────────────────────────
# getAllGroup 返回数据集列表，分组记录 dataType=null，用 id 作为 parentId
group_resp = bi_utils._request('GET', '/drag/onlDragDatasetHead/getAllGroup')
groups = group_resp.get('result', [])
sample_group = next((g for g in groups if g.get('name') == '示例数据集' or g.get('groupName') == '示例数据集'), None)
if sample_group:
    group_code = sample_group['id']
else:
    add_resp = bi_utils._request('POST', '/drag/onlDragDatasetHead/addGroup', data={'groupName': '示例数据集'})
    res = add_resp.get('result') or {}
    group_code = res.get('id') or res.get('groupCode') or '0'

# ── 先查后建（避免重复创建）────────────────────────────────────
existing = bi_utils._request('GET', '/drag/onlDragDatasetHead/list',
    params={'pageNo': 1, 'pageSize': 10, 'name': 'WebSocket实时数据'})
records = existing.get('result', {}).get('records', [])
if records:
    dataset_id = records[0]['id']
else:
    result = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={
        'name': 'WebSocket实时数据',
        'code': 'ws_realtime_data',
        'dataType': 'websocket',
        'querySql': ws_url,          # WebSocket 地址存在 querySql 字段
        'apiMethod': 'GET',
        'parentId': group_code,      # 用分组 id，fallback 为 '0'
        'datasetItemList': [
            {'fieldName': 'name', 'fieldTxt': '名称', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 0},
            {'fieldName': 'value', 'fieldTxt': '数值', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 1}
        ],
        'datasetParamList': []
    })
    dataset_id = result['result']['id']
```

#### Step 2：构建 DS_CONFIG（组件绑定配置块）

```python
DS_CONFIG = {
    'dataType': 2,
    'dataSetId': dataset_id,
    'dataSetName': 'WebSocket实时数据',
    'dataSetType': 'websocket',      # 关键：小写 websocket
    'dataSetApi': ws_url,
    'dataSetMethod': 'GET',
    'dataSetIzAgent': '0',           # WebSocket 类型用 '0'（无代理）
    'chartData': '[]',
    'viewLoading': True,
    'paramOption': [],
    'dataMapping': [
        {'filed': '维度', 'mapping': 'name'},   # filed 是槽位标签，不是 field
        {'filed': '数值', 'mapping': 'value'}
    ],
    'fieldOption': [                 # 必须包含 fieldOption，否则前端字段面板为空
        {'label': 'name', 'text': '名称', 'type': 'String', 'value': 'name', 'show': 'Y'},
        {'label': 'value', 'text': '数值', 'type': 'String', 'value': 'value', 'show': 'Y'}
    ],
}
```

#### Step 3：向现有大屏追加组件并绑定 WebSocket 数据集

```python
with open('default_configs.json', 'r', encoding='utf-8') as f:
    defaults = json.load(f)

# 查询现有大屏，追加不覆盖
page = bi_utils.query_page(PAGE_ID)
tmpl = page.get('template', [])

comp_type = 'JPie'
comp_name = '饼图'
cfg = json.loads(json.dumps(defaults[comp_type]))   # 深拷贝默认配置
w = cfg.pop('w', 450)
h = cfg.pop('h', 350)

cfg['background'] = '#FFFFFF00'
cfg['borderColor'] = '#FFFFFF00'

# 处理 option.title（可能是 str 或 dict）
opt = cfg.get('option', {})
opt_title = opt.get('title')
if isinstance(opt_title, str):
    opt['title'] = {'text': comp_name, 'show': True, 'textStyle': {'color': '#ffffff'}}
elif isinstance(opt_title, dict):
    opt_title['text'] = comp_name
    opt_title.setdefault('textStyle', {})['color'] = '#ffffff'
opt['card'] = {'title': '', 'extra': '', 'rightHref': '', 'size': 'default'}

# 注入 WebSocket 数据集绑定配置
cfg.update(copy.deepcopy(DS_CONFIG))
cfg['chartData'] = '[]'
cfg['w'] = w
cfg['h'] = h
cfg['size'] = {'width': w, 'height': h}          # config 内部必须设 size
cfg['chart'] = {'subclass': comp_type, 'category': 'pie'}
cfg.setdefault('turnConfig', {})
cfg.setdefault('linkageConfig', [])
cfg.setdefault('actionConfig', {'operateType': 'modal', 'modalName': '', 'url': ''})
cfg.setdefault('linkType', 'url')
cfg.setdefault('url', '')
cfg.setdefault('query', [])

comp_id = bi_utils._gen_uuid()   # 这就是 chartId，推送时需要用

comp = {
    'i': comp_id,                                # 组件唯一 ID（即 chartId）
    'component': comp_type,
    'componentName': comp_name,
    'visible': True,
    'x': 50, 'y': 500, 'w': w, 'h': h,
    'orderNum': len(tmpl) + 1,
    'config': json.dumps(cfg, ensure_ascii=False),  # config 必须序列化为 JSON 字符串
    'dataType': 2,
    'chart': {'subclass': comp_type, 'category': 'pie'},
    'size': {'width': w, 'height': h},           # 顶层也必须设 size
    'turnConfig': {},
    'linkageConfig': [],
}
tmpl.insert(0, comp)   # insert(0) 置顶，避免被遮挡

bi_utils._page_components[PAGE_ID] = tmpl
bi_utils.save_page(PAGE_ID)

print(f"组件已保存，chartId: {comp_id}")
print(f"推送 URL: {API_BASE}/drag/websocket/sendData?token={TOKEN}&chartId={comp_id}")
```

#### Step 4：询问是否编写 Java 推送接口（**强制，保存大屏后必须询问**）

> **⚠️ WebSocket 数据集创建完成、组件绑定后，图表数据静止不动，必须有服务端主动推送才能实时刷新。**
> 因此完成 Step 3 之后，**必须主动询问用户是否需要编写 Java 推送接口**，不得跳过。

**必须询问的两个问题：**

> **问题一：推送方式**
> - **手动触发**：生成 `POST /drag/xxx/push` 接口，可通过 Postman / 前端按钮调用
> - **定时自动推送**：在接口上加 `@Scheduled(cron="...")` 注解，服务启动后定时执行
>
> **问题二：Java Controller 文件存放路径**
> 例如：你的Java Controller存放的路径是什么？

**收到回答后，根据以下模板编写完整 Controller 文件：**

```java
package org.jeecg.modules.drag.controller;

import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import lombok.extern.slf4j.Slf4j;
import org.jeecg.modules.drag.config.common.Result;
import org.jeecg.modules.drag.config.websocket.DragWebSocket;
import org.jeecg.modules.drag.util.Md5Util;
import org.jeecg.modules.jmreport.config.client.JmReportTokenClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * XXX WebSocket 数据推送接口
 *
 * 推送地址（手动触发）：
 *   POST {API_BASE}/drag/xxx/push
 */
@Slf4j
@RestController("dragXxxPushController")
@RequestMapping("/drag/xxx")
public class DragXxxPushController {

    /** 各组件 chartId（即组件的 i 字段，由脚本生成后记录） */
    private static final String CHART_ID_1 = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
    private static final String CHART_ID_2 = "yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy";

    @Autowired
    private DragWebSocket webSocket;

    @Lazy
    @Autowired
    private JmReportTokenClient onlDragTokenClient;

    /**
     * 手动推送数据
     * POST {API_BASE}/drag/xxx/push
     */
    @PostMapping("/push")
    public Result<String> push() {
        Result<String> result = new Result<>();
        String data = buildData().toJSONString();
        String token = onlDragTokenClient.getToken();
        String wsClientId = Md5Util.md5Encode(token, "UTF-8");
        sendToChart(CHART_ID_1, data, wsClientId);
        sendToChart(CHART_ID_2, data, wsClientId);
        log.info("数据已推送：{}", data);
        result.setResult("推送成功");
        return result;
    }

    // 定时推送（按需取消注释，默认关闭避免服务启动即推送）
    // @Scheduled(cron = "0/30 * * * * ?")
    public void scheduledPush() {
        String token = onlDragTokenClient.getToken();
        String wsClientId = Md5Util.md5Encode(token, "UTF-8");
        String data = buildData().toJSONString();
        sendToChart(CHART_ID_1, data, wsClientId);
        sendToChart(CHART_ID_2, data, wsClientId);
    }

    /** socketId = chartId + '_' + md5(token)，与前端 socketId.ts 一致 */
    private void sendToChart(String chartId, String data, String wsClientId) {
        String socketId = chartId + "_" + wsClientId;
        JSONObject obj = new JSONObject();
        obj.put("chartId", chartId);
        obj.put("result", data);   // data 放在 result 字段
        webSocket.sendMessage(socketId, obj.toJSONString());
    }

    /** 构建推送数据，替换为实际业务数据或数据库查询 */
    private JSONArray buildData() {
        JSONArray array = new JSONArray();
        // update-begin--author:jeecg-boot date:xxxxxxxx for: xxx数据
        JSONObject item1 = new JSONObject(); item1.put("name", "类别A"); item1.put("value", 1000); array.add(item1);
        JSONObject item2 = new JSONObject(); item2.put("name", "类别B"); item2.put("value", 800);  array.add(item2);
        // update-end--author:jeecg-boot date:xxxxxxxx for: xxx数据
        return array;
    }
}
```

**使用规则：**
- `CHART_ID_*` 填脚本输出的 `chartId`（组件的 `i` 字段）
- 有多少个绑定了同一数据集的组件，就调多少次 `sendToChart`
- 定时推送默认注释，用户按需开启
- 重启后端后，调用 `POST /drag/xxx/push` 即可触发推送

### 数据推送

**通过已有内置接口推送（测试用）：**
```
POST {API_BASE}/drag/websocket/sendData
  chartId={chartId}
  data=[{"name":"A","value":100},{"name":"B","value":200}]
```

**推送数据格式（JSON 数组）：**
```json
[
  {"name": "类别A", "value": 1048},
  {"name": "类别B", "value": 735},
  {"name": "类别C", "value": 580}
]
```

### 后端推送接口（Java，已验证正确写法）

```java
// DragPieDataPushController.java
// 注入方式与 DragWebSocketController 保持一致
@Autowired
private DragWebSocket webSocket;

@Lazy
@Autowired
private JmReportTokenClient onlDragTokenClient;

/**
 * 正确的推送方法
 * socketId = chartId + '_' + md5(token)  ← 与前端 socketId.ts 逻辑一致
 */
private void sendToChart(String chartId, String data) {
    String token = onlDragTokenClient.getToken();
    String wsClientId = Md5Util.md5Encode(token, "UTF-8");
    String socketId = chartId + "_" + wsClientId;   // ⚠️ 必须拼 md5(token)

    JSONObject obj = new JSONObject();
    obj.put("chartId", chartId);
    obj.put("result", data);                         // data 放在 result 字段
    webSocket.sendMessage(socketId, obj.toJSONString());
}

// 手动触发推送接口
@PostMapping("/push")
public Result<String> pushData() {
    Result<String> result = new Result<>();
    String data = buildData().toJSONString();
    sendToChart("your-chart-id", data);
    result.setResult("推送成功");
    return result;
}

// 定时推送（默认注释，按需开启）
// @Scheduled(cron = "0/30 * * * * ?")
public void scheduledPush() {
    sendToChart("your-chart-id", buildData().toJSONString());
}
```

**推送消息结构（服务端发给前端的格式）：**
```json
{
  "chartId": "8472354f02e146259da9b13e68946c1d",
  "result": "[{\"name\":\"类别A\",\"value\":500}]"
}
```

### 后端实现

- **WebSocket 端点**：`@ServerEndpoint("/websocket/drag/{chartId}")`，内置 Redis pub/sub 支持集群环境
- **推送控制器**：`DragWebSocketController.sendData()`，内置接口，`chartId` 参数即组件 `i` 字段值
- **sessionMap key**：`chartId_md5(token)`，多用户各自独立连接

### 关键注意事项

| 项目 | 说明 |
|------|------|
| **dataType（数据集实体）** | `'websocket'`（小写） |
| **dataSetType（组件 config）** | `'websocket'`（小写） |
| **querySql** | 存放 WebSocket URL（`ws://host:port/path/websocket/drag`），无需 dbSource |
| **dbSource** | 不需要（无数据库关联） |
| **协议转换** | HTTP→`ws://`，HTTPS→`wss://` |
| **chartId** | 组件的 `i` 字段（UUID），在脚本中用 `bi_utils._gen_uuid()` 生成 |
| **⚠️ socketId = chartId + '_' + md5(token)** | 服务端 sendMessage 的 key 必须带 md5(token) 后缀，否则找不到连接 |
| **推送消息结构** | `{"chartId": "...", "result": "[...]"}`，data 放在 `result` 字段，不是直接传数组 |
| **config 必须为 JSON 字符串** | 手动 insert 到 template 时，`comp['config']` 必须是 `json.dumps(cfg)` 后的字符串 |
| **size/chart/turnConfig/linkageConfig** | config 内部和组件顶层都必须设置，缺失导致组件不渲染 |
| **fieldOption 必须设置** | 否则前端字段选项面板为空，用户无法修改字段映射 |
| **@Scheduled 默认注释** | 定时推送注解默认注释掉，用户按需开启，避免服务启动即推送 |
| **预置脚本** | `dataset_ops.py` 和 `comp_ops.py` 暂不支持 WebSocket 类型，需自定义脚本 |
| **⚠️ getAllGroup 返回的 parentId** | `getAllGroup` 接口返回记录列表，分组条目用 `id` 字段（**不是 `groupCode`**）作为新数据集的 `parentId`；`addGroup` 响应的 `result` 可能为 None，需 fallback 到 `'0'` |
| **⚠️ Step 3 完成后必须询问推送接口** | WebSocket 组件绑定完成后图表数据静止，**必须主动问用户**：①推送方式（手动触发 POST 接口 / @Scheduled 定时）②Java Controller 文件路径。两个问题都要问，不得遗漏 |

## 创建文件数据集（单文件 singleFile / 多文件 FILES）

### 概述

文件数据集允许上传 Excel/CSV 文件，将文件内容作为"虚拟数据表"通过 SQL 查询。系统支持两种子类型：

| 类型 | `dataType` 值 | 说明 |
|------|--------------|------|
| 单文件数据集 | `singleFile` | 只关联一个文件，文件名即表名 |
| 多文件数据集 | `FILES` | 可上传多个文件，每个文件都是一张虚拟表，SQL 可跨文件查询 |

> 后端 `getAllChartData` 同时支持两种类型，均路由到 `getFileData(dataset, params, dataMapping, token)`。

### `dbSource` 字段特殊含义（与 SQL 数据集不同！）

| 数据集类型 | `dbSource` 含义 |
|-----------|----------------|
| SQL 数据集 | SQL 数据源 ID（指向数据库连接配置） |
| 文件数据集（FILES/singleFile） | **文件数据库 ID**（`reportId`），指向文件存储记录 |

这是文件数据集最核心的差别：`dbSource` 不是数据库连接 ID，而是文件存储空间的 ID。

### 前端文件面板工作机制（DataSetFormModal.vue）

当 `dataType == 'FILES'` 时：
1. 弹窗宽度扩展为 `90%`（否则 `80%`）
2. 左侧出现文件列表面板（`izFilesDb` computed 控制显示）
3. `FileUpload` 组件：`reportId = formState.dbSource`（文件上传到当前文件数据库）
4. 文件列表通过 `getFileDbById({ reportId: formState.dbSource })` 加载，解析 `result.dbUrl`（JSON 数组）
5. 点击文件名自动填入 SQL：`select * from {filename}`
6. 文件删除前检查是否被数据集引用：`getDbSetByCodeAndDb({code: fileName, dbSource})`

> ⚠️ 注意：前端 dataType 选择器只显示 `sql/api/json/websocket` 四项，`FILES` 类型不在下拉里。打开文件数据集配置弹窗时，必须通过 `showModal(id, pid, 'FILES')` 传入第三个参数。

### SQL 写法（系统生成表名，含 `jmf.` 前缀）

> ⚠️ **表名不是原始文件名**，而是系统上传后自动生成，格式：`jmf.{SheetName}_{文件名去后缀}_excel`（Excel）、`jmf.{文件名去后缀}_csv`（CSV）。必须先上传文件，从 `result.dbUrl` 的 `name` 字段提取，不能猜测。

```sql
-- 单文件：从 dbUrl[0]['name'] 提取表名（如 jmf.Sheet1_employees_excel）
SELECT * FROM jmf.Sheet1_employees_excel

-- 指定列
SELECT name, age, department FROM jmf.Sheet1_employees_excel WHERE age > 30

-- 多文件关联查询（FILES 多文件数据集）
-- 表名均从上传响应的 dbUrl 中提取，不能用原始文件名
SELECT a.name, b.salary FROM jmf.Sheet1_employees_excel a
JOIN jmf.Sheet1_salary_csv b ON a.id = b.emp_id
```

### 参数语法（与 SQL 数据集一致）

```sql
-- ${param} 占位符
SELECT * FROM employees.xlsx WHERE department = '${dept}'

-- FreeMarker 条件
SELECT * FROM sales.xlsx
<#if isNotEmpty(year)> WHERE year = '${year}' </#if>
```

### 字段解析 API（不同于 SQL 数据集！）

| 数据集类型 | 解析 API |
|-----------|---------|
| SQL 数据集 | `POST /drag/onlDragDatasetHead/queryFieldBySql` |
| 文件数据集 | `POST /drag/onlDragDatasetHead/queryFileFieldBySql` |

`queryFileFieldBySql` 接收 `OnlDragDatasetVo` 类型（不是普通 JSONObject），参数结构：

```python
{
    'sql': 'SELECT * FROM employees.xlsx',
    'dbCode': 'file_db_id',   # 文件数据库 ID（即 dbSource 的值）
    'paramArray': '[]'
}
```

### 创建文件数据集（通过 API）

> ⚠️ **必须先上传文件，获取系统生成的真实表名，再创建数据集** — 颠倒顺序会导致 SQL 中表名未知。

```python
import json, os, time, urllib.request

# ======= Step 1：上传文件，获取真实表名 =======
# FILES 多文件：不传 isSingle；单文件：加 isSingle=true 参数
def upload_file(file_path, report_id, is_single=False):
    boundary = f'----WebKitFormBoundary{int(time.time()*1000)}'
    file_name = os.path.basename(file_path)
    with open(file_path, 'rb') as f:
        file_data = f.read()
    body_parts = [
        f'--{boundary}\r\nContent-Disposition: form-data; name="reportId"\r\n\r\n{report_id}\r\n'.encode()
    ]
    if is_single:
        body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="isSingle"\r\n\r\ntrue\r\n'.encode())
    body_parts += [
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{file_name}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode(),
        file_data,
        f'\r\n--{boundary}--\r\n'.encode()
    ]
    req = urllib.request.Request(
        f'{bi_utils.API_BASE}/jmreport/source/datasource/files/add',
        data=b''.join(body_parts),
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}', 'X-Access-Token': bi_utils.TOKEN},
        method='POST'
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode('utf-8'))

PAGE_ID = '大屏页面ID'
upload_file(r'<file_path>', PAGE_ID)  # 多文件不传 is_single

# ======= Step 2：获取文件列表，提取真实表名 =======
files_resp = bi_utils._request('GET', '/jmreport/source/datasource/files/get', params={'reportId': PAGE_ID})
file_list = json.loads(files_resp['result']['dbUrl'])
# file_list = [{"fileName": "employees.xlsx", "name": "jmf.Sheet1_employees_excel"}, ...]
emp_table = file_list[0]['name']  # → 'jmf.Sheet1_employees_excel'

# ======= Step 3：用真实表名写 SQL（避开 value 关键字）=======
query_sql = f'SELECT name, age, dept FROM {emp_table}'

# ======= Step 4：创建数据集（先用 preview 自动提取字段）=======
preview = bi_utils._request('GET', '/jmreport/source/datasource/files/preview',
    params={'reportId': PAGE_ID, 'tableName': emp_table})
records = preview.get('result') or []  # 直接是 list，无 records 键
fields = [
    {'fieldName': k, 'fieldTxt': k, 'fieldType': 'String', 'izShow': 'Y', 'orderNum': i}
    for i, k in enumerate(records[0].keys())
] if records else []

result = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={
    'name': '员工信息表',
    'code': emp_table,                              # FILES 可自定义，singleFile 必须=表名
    'dataType': 'FILES',                            # 或 'singleFile'
    'dbSource': PAGE_ID,                            # ⚠️ 页面 ID，不是 SQL 数据源 ID！
    'querySql': query_sql,
    'apiMethod': 'get',
    'content': json.dumps(file_list, ensure_ascii=False),  # ⚠️ FILES 和 singleFile 都必须传
    'parentId': '示例数据集分组ID',                  # getAllGroup 查询后取 id
    'datasetItemList': fields,
    'datasetParamList': []
})
ds_id = (result.get('result') or {}).get('id') or result['result']

# ======= Step 5：验证数据 =======
test_resp = bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={'id': ds_id})
print(test_resp.get('result', {}).get('data', [])[:3])
```

> `queryFileFieldBySql` 用于在已知数据源 ID（`dbSource`）的情况下解析复杂 SQL 字段；实际开发中直接用 `preview` API 提取字段更简单，无需额外调用。

### 组件绑定文件数据集

```python
DS_CONFIG = {
    'dataType': 2,
    'dataSetId': ds_id,
    'dataSetName': '员工信息表',
    'dataSetType': 'FILES',       # 对应 dataType
    'dataSetApi': 'SELECT * FROM employees.xlsx',  # SQL 语句
    'dataSetMethod': 'GET',
    'dataSetIzAgent': '1',        # 文件数据集走后端
    'chartData': '[]',
    'viewLoading': True,
    'paramOption': [],
    'dataMapping': [
        {'filed': '维度', 'mapping': 'name'},
        {'filed': '数值', 'mapping': 'age'}
    ],
    'fieldOption': [
        {'label': 'name', 'text': '姓名', 'type': 'String', 'value': 'name', 'show': 'Y'},
        {'label': 'age',  'text': '年龄', 'type': 'Integer', 'value': 'age', 'show': 'Y'},
    ]
}
```

### 文件数据库管理 API

| 接口 | 方法 | 说明 |
|------|------|------|
| `GET /jmreport/source/datasource/files/get?reportId=xxx` | GET | 查询文件数据库，返回 `dbUrl`（JSON 数组，含所有文件信息） |
| `GET /jmreport/source/datasource/files/preview?reportId=xxx&tableName=yyy` | GET | 预览文件数据，返回前几条记录（list） |
| `DELETE /jmreport/source/datasource/files/del?reportId=xxx&tableName=yyy` | DELETE | **多文件**：删除数据源中某个文件表，参数 `tableName`=系统生成表名 |
| `DELETE /jmreport/source/datasource/files/del/file?reportId=xxx&fileName=yyy&isSingle=true` | DELETE | **单文件**：删除单文件数据集关联文件，参数 `fileName`=原始文件名，必须带 `isSingle=true` |
| `GET /drag/onlDragDatasetHead/getDbSetByCodeAndDb?code=filename&dbSource=fileDbId` | GET | 检查文件是否被数据集引用（删除前调用） |
| `GET /drag/onlDragDatasetHead/queryByDbId?dbId=xxx` | GET | 查询使用某文件数据库的所有数据集 |

### `getAllChartData` 的 dataMapping 参数

文件数据集调用 `getAllChartData` 时，后端从请求体额外读取 `dataMapping`（JSONArray）：

```python
# 文件数据集查询时可额外传 dataMapping
result = bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={
    'id': ds_id,
    'params': {},
    'dataMapping': [
        {'filed': '维度', 'mapping': 'name'},
        {'filed': '数值', 'mapping': 'age'}
    ]
})
```

> SQL/API/JSON 数据集调用 `getAllChartData` 时忽略 `dataMapping`；文件数据集会将其传入 `getFileData()` 用于字段映射处理。

### 文件删除安全机制

系统内置文件引用保护：

```
删除文件前 → getDbSetByCodeAndDb(code=filename, dbSource=fileDbId)
  → 若有数据集引用此文件 → 返回错误"无法删除数据表,正在被数据集使用"
  → 若无引用 → 允许删除 → delFileDbById(reportId, tableName)
  → 删除成功后自动刷新文件列表
```

### 关键踩坑

| 问题 | 说明 |
|------|------|
| **`dbSource` 含义不同** | 文件数据集的 `dbSource` 是文件数据库 ID（reportId），不是 SQL 数据源 ID。填错会导致"数据源不存在"报错 |
| **解析接口不同** | 必须用 `/queryFileFieldBySql` 而非 `/queryFieldBySql`；用后者会因找不到对应数据库连接而失败 |
| **FILES 类型不在下拉里** | 前端 dataType 选择器没有 FILES 选项，通过 `showModal(id, pid, 'FILES')` 触发，API 创建时直接传 `'FILES'` |
| **SQL 表名 = 系统生成格式（含 `jmf.` 前缀）** | 格式：`jmf.{SheetName}_{文件名去后缀}_excel`；必须从上传响应 `result.dbUrl` 的 `name` 字段提取，不能用原始文件名（如 `FROM employees.xlsx` 是错的）。例：`FROM jmf.Sheet1_employees_excel` |
| **dataMapping 额外传参** | `getAllChartData` 请求体中 `dataMapping` 字段对文件数据集有效，可影响字段映射 |
| **文件与数据集强关联** | 不能随意删除文件数据库中的文件，删前必须确认没有数据集引用 |
| **多文件 SQL 跨表查询** | FILES 类型支持 JOIN 不同文件，但 singleFile 类型只针对单个文件 |

## 创建 API 数据集

```python
result = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={
    'name': '产品销量排行榜',
    'code': 'product_sales',
    'dataType': 'api',
    'dbSource': None,                   # API 类型不需要数据库源
    'querySql': 'https://api.jeecg.com/mock/31/graphreport/aiproducttest',  # API 地址存在 querySql 字段
    'apiMethod': 'get',
    'izAgent': '0',
    'parentId': '0',
    'datasetItemList': [
        {'fieldName': 'name', 'fieldTxt': 'name', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 0},
        {'fieldName': 'value', 'fieldTxt': 'value', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 1}
    ],
    'datasetParamList': []
})
dataset_id = result['result']['id']
```

## 组件绑定数据集（dataType=2）

```python
config = {
    'dataType': 2,
    'dataSetId': dataset_id,
    'dataSetName': '数据集名称',
    'dataSetType': 'sql',               # sql / api
    'dataSetApi': 'SELECT ...',         # SQL 语句或 API 地址
    'dataSetMethod': 'get',
    'dataSetIzAgent': '1',               # SQL 类型用 '1'，API 直连用 '0'
    'dataMapping': [
        {'filed': '维度', 'mapping': 'name'},   # 注意：filed 不是 field
        {'filed': '数值', 'mapping': 'value'},
    ],
    'chartData': '[]',
    'option': { ... }
}
```

### 标准字段映射规则

| 映射标签（filed） | 标准字段（key） | 说明 |
|-------------------|----------------|------|
| `维度` / `名称` | `name` | 图表类目/维度 |
| `数值` | `value` | 图表数值 |
| `分组` | `type` | 多系列区分字段 |
| `文本` | `label` | 文本标签 |

## 组件绑定数据集完整示例（SQL 饼图）

```python
pie_comp = {
    'component': 'JPie',
    'componentName': '男女比例',
    'visible': True,
    'i': bi_utils._gen_uuid(),
    'x': 750, 'y': 700, 'w': 450, 'h': 350,
    'orderNum': 300,
    'config': {
        'dataType': 2,
        'w': 450, 'h': 350,
        'size': {'width': 450, 'height': 350},
        'dataSetId': dataset_id,
        'dataSetName': '用户男女比例统计',
        'dataSetType': 'sql',
        'dataSetApi': "SELECT sex as name, COUNT(*) AS value FROM demo ...",
        'dataSetMethod': 'GET',
        'dataSetIzAgent': '1',
        'dataMapping': [
            {'filed': '维度', 'mapping': 'name'},
            {'filed': '数值', 'mapping': 'value'}
        ],
        'chartData': '[]',
        'option': { ... }
    }
}
```

## API 数据集与 SQL 数据集的关键差异

| 项目 | API 数据集 | SQL 数据集 |
|------|-----------|-----------|
| `dataType`（数据集） | `'api'` | `'sql'` |
| `dbSource` | `None`（不需要） | 必填（数据库源 ID） |
| `querySql` | 存放 **API URL** | 存放 SQL 语句 |
| `izAgent` | `'0'`=前端直连, `'1'`=后端代理 | 不使用 |
| `apiMethod` | `'get'` / `'post'` | `'GET'`（无实际意义） |
| 组件 `dataSetIzAgent` | `'0'`（直连）或 `'1'`（代理） | `'1'`（走后端代理） |

## API 数据格式要求

API 返回的数据必须是 JSON 数组：

```json
// 标准 name/value 格式
[{"name": "新洲店", "value": 8500}, {"name": "水围店", "value": 7200}]

// 多系列格式
[{"name": "1月", "value": 100, "type": "系列A"}, {"name": "1月", "value": 200, "type": "系列B"}]
```

> 如果 API 返回 `{"success":true, "result":[...]}` 嵌套结构，系统自动提取 `result` 数组。

## API 数据集端到端完整脚本示例（API 漏斗图）

```python
import json
from bi_utils import *
import bi_utils

API_BASE = '<api_base>'
TOKEN = '<token>'
PAGE_ID = '大屏页面ID'
DATA_API_URL = 'https://api.jeecg.com/mock/51/beverageSales?type=salesRanking'

init_api(API_BASE, TOKEN)

# 1. 创建 API 数据集
ds_result = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={
    'name': '门店销量排行-API',
    'code': 'store_sales_ranking_api',
    'dataType': 'api',
    'dbSource': None,
    'querySql': DATA_API_URL,
    'apiMethod': 'get',
    'izAgent': '0',
    'parentId': '0',
    'datasetItemList': [
        {'fieldName': 'name', 'fieldTxt': 'name', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 0},
        {'fieldName': 'value', 'fieldTxt': 'value', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 1}
    ],
    'datasetParamList': []
})
dataset_id = ds_result['result']['id']

# 2. 测试数据集
test = bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={'id': dataset_id})
print('数据预览:', json.dumps(test['result']['data'][:3], ensure_ascii=False))

# 3. 查询大屏，追加漏斗图组件
page = query_page(PAGE_ID)
template = page.get('template', [])
if isinstance(template, str):
    template = json.loads(template)

# 4. 构建 JFunnel 组件
funnel_config = {
    'borderColor': '#FFFFFF00',
    'background': '#FFFFFF00',
    'dataType': 2,
    'dataSetId': dataset_id,
    'dataSetName': '门店销量排行-API',
    'dataSetType': 'api',
    'dataSetApi': DATA_API_URL,
    'dataSetMethod': 'get',
    'dataSetIzAgent': '0',
    'dataMapping': [
        {'filed': '维度', 'mapping': 'name'},
        {'filed': '数值', 'mapping': 'value'}
    ],
    'fieldOption': [
        {'label': 'name', 'text': 'name', 'type': 'String', 'value': 'name', 'show': 'Y'},
        {'label': 'value', 'text': 'value', 'type': 'String', 'value': 'value', 'show': 'Y'},
    ],
    'paramOption': [],
    'chartData': '[]',
    'dataFilterNum': 5,
    'viewLoading': True,
    'timeOut': 0,
    'w': 580, 'h': 450,
    'size': {'width': 580, 'height': 450},
    'option': {
        'customColor': [
            {'color': '#5470C6'}, {'color': '#91CC75'}, {'color': '#FAC858'},
            {'color': '#EE6666'}, {'color': '#73C0DE'}
        ],
        'series': [{
            'type': 'funnel', 'name': '门店销量',
            'left': '10%', 'width': '80%', 'bottom': '5%', 'gap': 2,
            'sort': 'descending',
            'label': {'show': True, 'position': 'inside', 'color': '#ffffff', 'formatter': '{b}: {c}'},
            'labelLine': {'lineStyle': {'width': 1, 'type': 'solid'}, 'length': 10},
            'itemStyle': {'borderColor': '#FFFFFF33', 'borderWidth': 1},
            'emphasis': {'label': {'fontSize': 18}}
        }],
        'tooltip': {'trigger': 'item', 'formatter': '{b} : {c}', 'textStyle': {'color': '#EEF1FA'}},
        'legend': {'orient': 'horizontal', 't': 90, 'r': 1, 'textStyle': {'color': '#ffffff'}},
        'title': {
            'show': True, 'text': '门店销量漏斗', 'top': 5, 'left': 'center',
            'textStyle': {'color': '#ffffff', 'fontSize': 16, 'fontWeight': 'normal'}
        },
        'card': {'title': '', 'extra': '', 'rightHref': '', 'size': 'default'}
    },
    'actionConfig': {'operateType': 'modal', 'modalName': '', 'url': ''},
    'turnConfig': {'type': '_blank', 'url': ''},
    'linkType': 'url', 'linkageConfig': [], 'url': '', 'query': []
}

template.append({
    'component': 'JFunnel', 'componentName': '门店销量漏斗', 'visible': True,
    'i': bi_utils._gen_uuid(), 'x': 1300, 'y': 500, 'w': 580, 'h': 450,
    'orderNum': len(template) + 1, 'config': funnel_config
})

bi_utils._page_components[PAGE_ID] = template
save_page(PAGE_ID)
```

## JFunnel 漏斗图组件配置参考

**数据格式**：`[{name, value}]`（与饼图相同）

| 配置路径 | 说明 | 示例值 |
|----------|------|--------|
| `config.dataFilterNum` | 只取前 N 条数据（建议 3-7） | `5` |
| `option.series[0].sort` | 排序方向 | `'descending'` |
| `option.series[0].gap` | 漏斗层间距 | `2` |
| `option.series[0].left` | 漏斗左偏移 | `'10%'` |
| `option.series[0].width` | 漏斗宽度 | `'80%'` |
| `option.series[0].label.position` | 标签位置 | `'inside'` |
| `option.customColor` | 自定义配色 `[{color:'#xxx'}]` | 见示例 |

## API 数据集常用 mock 地址

| API 地址 | 返回格式 | 适用图表 |
|----------|---------|---------|
| `https://api.jeecg.com/mock/31/graphreport/aiproducttest` | `[{name,value}]` | 柱形/饼图/漏斗 |
| `https://api.jeecg.com/mock/51/beverageSales?type=salesRanking` | `[{name,value}]` 13条门店数据 | 柱形/排行榜/漏斗 |

## 数据集「先查后建」规则（强制）

**当用户指定了数据集名称时，必须先查询是否已存在同名数据集，存在则直接复用，不存在才创建。**

```python
existing = bi_utils._request('GET', '/drag/onlDragDatasetHead/list',
    params={'pageNo': 1, 'pageSize': 10, 'name': '用户指定的数据集名称'})
records = existing.get('result', {}).get('records', [])

if records:
    dataset_id = records[0]['id']
else:
    ds_result = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={...})
    dataset_id = ds_result['result']['id']
```

## SQL 数据集动态查询条件

### FreeMarker 动态条件语法

```sql
select * from sys_user where del_flag = 0
<#if isNotEmpty(realname)>
   and realname like '%${realname}%'
</#if>
<#if isNotEmpty(sex)>
   and sex = '${sex}'
</#if>
```

**语法要点：**
- `${paramName}` — 参数占位符
- `<#if isNotEmpty(paramName)>` — 当参数非空时才拼接
- `</#if>` — 条件结束标记

### 参数列表配置

```python
'datasetParamList': [
    {'paramName': 'realname', 'paramTxt': '姓名', 'paramValue': '', 'dictCode': ''},
    {'paramName': 'sex', 'paramTxt': '性别', 'paramValue': '1', 'dictCode': 'sex'}
]
```

### 组件中的参数配置（paramOption）

```python
'paramOption': [
    {'defaultVal': '', 'label': 'realname', 'text': '姓名', 'type': 'string', 'value': 'realname'},
    {'defaultVal': '', 'label': 'sex', 'text': '性别', 'type': 'string', 'value': 'sex'}
]
```

## SQL 数据集绑定图表完整端到端流程

### 完整 config 结构

```python
config = {
    'borderColor': '#FFFFFF00',
    'background': '#FFFFFF00',
    'dataType': 2,
    'dataSetId': dataset_id,
    'dataSetName': '数据集名称',
    'dataSetType': 'sql',
    'dataSetApi': DYNAMIC_SQL,
    'dataSetMethod': 'get',
    'dataSetIzAgent': '1',
    'chartData': '[]',
    'viewLoading': True,
    'timeOut': 0,
    'w': 600, 'h': 350,
    'size': {'height': 350},
    'fieldOption': [
        {'label': 'name', 'text': 'name', 'type': 'String', 'value': 'name', 'show': 'Y'},
        {'label': 'value', 'text': 'value', 'type': 'String', 'value': 'value', 'show': 'Y'}
    ],
    'paramOption': [
        {'defaultVal': '', 'label': 'name', 'text': '名称', 'type': 'string', 'value': 'name'}
    ],
    'dataMapping': [
        {'mapping': 'name', 'filed': '维度'},
        {'mapping': 'value', 'filed': '数值'}
    ],
    'option': {
        'title': {'text': '图表标题', 'show': True, 'textStyle': {'color': '#ffffff'}},
        'tooltip': {...},
        'xAxis': {'axisLabel': {'color': '#ffffff'}},
        'yAxis': {'axisLabel': {'color': '#ffffff'}, 'splitLine': {'lineStyle': {'color': '#FFFFFF1A'}}},
        'grid': {'top': 50, 'left': 10, 'bottom': 20, 'right': 30, 'containLabel': True, 'show': False},
        'series': [{'type': 'line/bar/pie', 'data': [], ...}],
        'card': {'title': '', 'extra': '', 'rightHref': '', 'size': 'default'}
    },
    'actionConfig': {'operateType': 'modal', 'modalName': '', 'url': ''},
    'turnConfig': {'type': '_blank', 'url': ''},
    'linkType': 'url',
    'linkageConfig': [],
    'seriesType': [],
    'markLineConfig': {'show': False, 'markLine': []},
    'drillData': [],
    'dictOptions': {},
    'query': [],
    'url': ''
}
```

## 文件数据集（单文件 singleFile / 多文件 FILES）

### 文件数据集 vs SQL/API 数据集的关键差异

| 项目 | 单文件 (singleFile) | 多文件 (FILES) | SQL 数据集 | API 数据集 |
|------|-------------------|---------------|-----------|-----------|
| `dataType`（数据集） | `'singleFile'` | `'FILES'` | `'sql'` | `'api'` |
| `dbSource` | **reportId**（页面 ID） | **reportId**（页面 ID） | 数据库源 ID | `None` |
| `querySql` | `select * from {tableName}` | 可跨表 SQL 查询 | SQL 语句 | API URL |
| 文件上传 | 1 个文件（`isSingle=true`） | 多个文件 | 不需要 | 不需要 |
| `content` | `JSON.stringify(fileList)` | `JSON.stringify(fileList)` | 不需要 | 不需要 |
| 字段解析 API | 自动从文件解析 | `queryFileFieldBySql` | `queryFieldBySql` | `queryFieldByApi` |
| 支持格式 | `.csv .xls .xlsx .json` | `.csv .xls .xlsx .json` | — | — |

### 文件上传 API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/jmreport/source/datasource/files/add` | POST (multipart) | 上传文件 |
| `/jmreport/source/datasource/files/get` | GET | 获取文件列表 `?reportId=xxx` |
| `/jmreport/source/datasource/files/preview` | GET | 预览文件数据 |
| `/jmreport/source/datasource/files/del` | DELETE | 删除数据源 |
| `/jmreport/source/datasource/files/del/file` | DELETE | 删除单个文件 |

### 上传 API 返回值结构

```json
{
  "success": true,
  "message": "filesDataSet/PAGE_ID/default.xls",
  "result": {
    "id": "数据源记录ID",
    "reportId": "PAGE_ID",
    "dbType": "FILES",
    "dbDriver": "filesDataSet\\PAGE_ID",
    "dbUrl": "[{\"fileName\":\"default.xls\",\"name\":\"jmf.Sheet1_default_excel\"}]"
  }
}
```

**关键字段：**
- `result.dbUrl`：JSON 字符串，包含 `fileName`（原始文件名）和 `name`（解析后的表名）
- **表名命名规则**：`jmf.{SheetName}_{文件名去后缀}_excel`（Excel）、`jmf.{文件名去后缀}_csv`（CSV）、`jmf.{文件名去后缀}_json`（JSON）

### 预览 API（获取字段列表）

```python
preview = bi_utils._request('GET', '/jmreport/source/datasource/files/preview',
    params={'reportId': PAGE_ID, 'tableName': table_name, 'pageNo': 1, 'pageSize': 5})
```

**返回值注意：** `result` 直接是**列表**（`list`），不是分页对象（无 `records` 键），与 SQL 数据集的 list API 不同。

```python
# 从预览数据自动提取字段列表
records = preview['result']  # 直接是 list，不需要 ['records']
fields = []
if records:
    for idx, key in enumerate(records[0].keys()):
        fields.append({
            'fieldName': key, 'fieldTxt': key,
            'fieldType': 'String', 'izShow': 'Y', 'orderNum': idx
        })
```

### 创建单文件数据集（singleFile）端到端（2026-04-03 更新）

```python
import sys, json, os, time
sys.path.insert(0, '.')
import bi_utils
import urllib.request

API_BASE = '<api_base>'
TOKEN = '<token>'
PAGE_ID = '大屏页面ID'
FILE_PATH = r'<file_path>'

bi_utils.API_BASE = API_BASE
bi_utils.TOKEN = TOKEN

# ======= Step 1: 上传文件（isSingle=True） =======
def upload_file(file_path, report_id, is_single=False):
    url = f'{API_BASE}/jmreport/source/datasource/files/add'
    boundary = f'----WebKitFormBoundary{int(time.time()*1000)}'
    file_name = os.path.basename(file_path)
    with open(file_path, 'rb') as f:
        file_data = f.read()
    body_parts = []
    body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="reportId"\r\n\r\n{report_id}\r\n'.encode())
    if is_single:
        body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="isSingle"\r\n\r\ntrue\r\n'.encode())
    body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{file_name}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode())
    body_parts.append(file_data)
    body_parts.append(f'\r\n--{boundary}--\r\n'.encode())
    body = b''.join(body_parts)
    headers = {
        'Content-Type': f'multipart/form-data; boundary={boundary}',
        'X-Access-Token': TOKEN,
    }
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode('utf-8'))

result = upload_file(FILE_PATH, PAGE_ID, is_single=True)
db_url = result['result']['dbUrl']
file_list = json.loads(db_url)
table_name = file_list[0]['name']

# ======= Step 2: 预览文件获取字段 =======
preview = bi_utils._request('GET', '/jmreport/source/datasource/files/preview',
    params={'reportId': PAGE_ID, 'tableName': table_name, 'pageNo': 1, 'pageSize': 5})
records = preview.get('result') or []  # 直接是 list
fields = []
if records:
    for idx, key in enumerate(records[0].keys()):
        fields.append({
            'fieldName': key, 'fieldTxt': key,
            'fieldType': 'String', 'izShow': 'Y', 'orderNum': idx
        })

# ======= Step 3: 创建数据集 =======
ds = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={
    'name': '单文件数据',
    'code': table_name,  # ⚠️ 关键：code必须等于实际表名，不能自定义
    'dataType': 'singleFile',
    'dbSource': PAGE_ID,                              # 关键：dbSource = 页面ID
    'querySql': f'select * from {table_name}',        # 简单查询，返回全部字段
    'apiMethod': 'GET',
    'content': json.dumps(file_list, ensure_ascii=False),  # 关键：必须传 content
    'parentId': '0',
    'datasetItemList': fields,
    'datasetParamList': []
})
dataset_id = ds['result']['id']

# ======= Step 4: 验证数据集 =======
test = bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={'id': dataset_id})
data = (test.get('result') or {}).get('data') or []
print(f"返回 {len(data)} 条记录")

# ======= Step 5: 绑定饼图组件 =======
# 加载默认配置
with open('default_configs.json', 'r', encoding='utf-8') as f:
    defaults = json.load(f)

query_sql = f"select * from {table_name}"

pie_cfg = json.loads(json.dumps(defaults.get('JPie', {})))
w, h = pie_cfg.pop('w', 450), pie_cfg.pop('h', 350)
pie_cfg['background'] = '#FFFFFF00'
pie_cfg['borderColor'] = '#FFFFFF00'
pie_cfg['dataType'] = 2
pie_cfg['dataSetId'] = dataset_id
pie_cfg['dataSetName'] = '单文件数据'
pie_cfg['dataSetType'] = 'singleFile'
pie_cfg['dataSetApi'] = query_sql
pie_cfg['dataSetMethod'] = 'get'
pie_cfg['dataSetIzAgent'] = ''  # ⚠️ 单文件类型为空字符串
pie_cfg['chartData'] = '[]'
pie_cfg['viewLoading'] = True
pie_cfg['paramOption'] = []

# ⚠️ 关键：从数据集字段中自动获取，dataMapping 使用实际字段名
field_names = [f.get('fieldName') for f in fields]
pie_cfg['dataMapping'] = [
    {"filed": "维度", "mapping": field_names[0] if len(field_names) > 0 else 'name'},
    {"filed": "数值", "mapping": field_names[1] if len(field_names) > 1 else 'value'}
]
pie_cfg['fieldOption'] = [
    {"label": fn, "text": fn, "type": "String", "value": fn, "show": "Y"}
    for fn in field_names
]

# 设置标题
opt = pie_cfg.get('option', {})
if isinstance(opt, str):
    opt = json.loads(opt)
    pie_cfg['option'] = opt
opt['title'] = {'text': '图表标题', 'show': True}
pie_cfg['option'] = opt

# 查询页面获取 template
page_resp = bi_utils._request('GET', '/drag/page/queryById', params={'id': PAGE_ID})
template = (page_resp.get('result') or {}).get('template', [])
if isinstance(template, str):
    template = json.loads(template)
if not template:
    template = []

pie_comp = {
    "i": bi_utils._gen_uuid(),
    "component": "JPie",
    "componentName": "图表标题",
    "x": 50, "y": 100, "w": w, "h": h,
    "dataType": 2,
    "config": json.dumps(pie_cfg, ensure_ascii=False),
    "dataMapping": pie_cfg['dataMapping'],
    "size": {"width": w, "height": h},
    "chart": {"subclass": "JPie", "category": "pie"},
    "turnConfig": {},
    "linkageConfig": []
}

template.insert(0, pie_comp)
bi_utils._page_components[PAGE_ID] = template
bi_utils.save_page(PAGE_ID)
```

### 单文件数据集踩坑记录

| 问题 | 说明 |
|------|------|
| **content 字段必传** | `content` = `json.dumps(file_list)`，不传则数据集无法关联到文件 |
| **dbSource = 页面 ID** | 不是数据库源 ID，是大屏页面 ID（reportId）。**绝对不能改成上传接口返回的文件数据源记录 `id`（如 `1199936546338988032`），否则报"数据源不存在"** |
| **预览返回 list 不是分页对象** | `preview['result']` 直接是数组，没有 `records` 键 |
| **字段自动检测** | 用预览 API 取第一条记录的 keys 即可获取全部字段，无需手动指定 |
| **表名由系统生成** | 格式 `jmf.{SheetName}_{filename}_excel`，从上传返回的 `dbUrl` 中提取 |
| **upload 必须用 multipart** | urllib 手动构建 multipart body，不能用 `_request()` |
| **isSingle 参数** | 单文件必须传 `isSingle=true`，否则按多文件(FILES)处理 |
| **组件绑定 dataSetIzAgent** | 单文件类型 `dataSetIzAgent` 设为空字符串 `''`，不是 `'0'` 或 `'1'` |
| **⚠️ `code` 字段必须等于文件实际表名** | 数据集的 `code` 字段被 Calcite 用作虚拟表名（FROM 子句）。若 `code` 是自定义字符串（如 `ds_file_default_xxx`），Calcite 找不到对应表，图表渲染报错。**必须将 `code` 设为上传返回的实际表名**（如 `jmf.Sheet1_default_excel`），Calcite 才能正确路由到文件数据。创建时直接从 `dbUrl` 中取 `name` 字段赋给 `code`** |
| **⚠️ querySql 必须用简单查询** | 单文件数据集**不需要也不应该构建复杂SQL**（如 GROUP BY 聚合）。SQL应该简单写 `select * from {table_name}`，返回文件全部原始字段。图表绑定时从数据集字段列表中自动获取实际字段名进行映射。**不要自己在 SQL 中做聚合**，否则会导致字段不匹配 |

### 多文件数据集（FILES）标准操作流程（2026-04-09 更新）

> **核心原则**：每个大屏只允许创建一个多文件数据集，重复创建会导致文件冲突。

#### 已知坑点（2026-04-09 实测）

| 坑点 | 说明 |
|------|------|
| **files/get result 是 dict 不是 list** | `result` 返回 `{"id":"...","dbUrl":"[{...}]",...}`，必须 `json.loads((resp.get('result') or {}).get('dbUrl','[]'))` 提取表名，不能直接迭代 result |
| **queryFileFieldBySql 需签名，bi_utils 报"时间戳为空"** | 无法用 bi_utils 调用此接口。替代：直接手动传 `datasetItemList` + `getAllChartData` 验证 |
| **SQL 别名不能用单引号** | `as 'type'` 解析失败，必须 `as type` |
| **Excel 表名推断规律** | `xxx.xlsx` → `jmf.Sheet1_{xxx}_excel`（如 `products.xlsx` → `Sheet1_products_excel`），files/get 解析失败时用作 fallback |

#### 正确流程（5步）

```python
import sys, json, os, time, uuid
import urllib.request
sys.path.insert(0, '.')
import bi_utils

bi_utils.API_BASE = '<api_base>'
bi_utils.TOKEN = '<token>'
PAGE_ID = '大屏页面ID'
PARENT_ID = '1516743332632494082'  # 示例数据集分组，本环境固定ID

# ======= Step 1: 创建空 FILES 数据集 =======
add_r = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={
    'name': '大区品类销售统计',
    'code': 'region_category_sales',
    'dataType': 'FILES',
    'dbSource': PAGE_ID,
    'querySql': '',
    'parentId': PARENT_ID,
})
DS_ID = (add_r.get('result') or {}).get('id')
print(f'数据集ID: {DS_ID}')

# ======= Step 2: 上传文件（不传 isSingle，带 reportId） =======
def upload_file(file_path, report_id):
    boundary = uuid.uuid4().hex
    file_name = os.path.basename(file_path)
    with open(file_path, 'rb') as f:
        file_data = f.read()
    body = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="reportId"\r\n\r\n{report_id}\r\n'
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{file_name}"\r\n'
        f'Content-Type: application/octet-stream\r\n\r\n'
    ).encode('utf-8') + file_data + f'\r\n--{boundary}--\r\n'.encode('utf-8')
    req = urllib.request.Request(
        f'{bi_utils.API_BASE}/jmreport/source/datasource/files/add', data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}',
                 'X-Access-Token': bi_utils.TOKEN}, method='POST')
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode('utf-8'))

upload_file(r'<file_path>', PAGE_ID)
upload_file(r'<file_path>', PAGE_ID)

# ======= Step 3: 获取文件列表，提取真实表名 =======
# ⚠️ result 是 dict，dbUrl 是 JSON 字符串，不能把 result 当 list！
files_resp = bi_utils._request('GET', '/jmreport/source/datasource/files/get',
                                params={'reportId': PAGE_ID})
result_dict = files_resp.get('result') or {}
file_list = json.loads(result_dict.get('dbUrl', '[]'))

# 按文件名关键词匹配（fallback 用表名推断规律 Sheet1_{xxx}_excel）
products_table = next((f['name'] for f in file_list if 'product' in f['name'].lower()),
                      'jmf.Sheet1_products_excel')
orders_table   = next((f['name'] for f in file_list if 'order'   in f['name'].lower()),
                      'jmf.Sheet1_orders_excel')
print(f'products: {products_table}, orders: {orders_table}')

# ======= Step 4: 编写 SQL 并更新数据集 =======
# ⚠️ value 是 SQL 关键字，用 sales 等替代
# ⚠️ 别名不能加单引号，用 as type 不是 as 'type'
query_sql = (
    f"SELECT p.category as type, o.region as name, SUM(o.amount) as sales "
    f"FROM {orders_table} o "
    f"JOIN {products_table} p ON o.product_id = p.product_id "
    f"GROUP BY p.category, o.region"
)

# ⚠️ queryFileFieldBySql 需签名验证（bi_utils 报"时间戳为空"），不能用。
# 直接手动传字段列表：
fields = [
    {'fieldName': 'type',  'fieldTxt': '品类',  'fieldType': 'String',  'izShow': 'Y', 'orderNum': 0},
    {'fieldName': 'name',  'fieldTxt': '大区',  'fieldType': 'String',  'izShow': 'Y', 'orderNum': 1},
    {'fieldName': 'sales', 'fieldTxt': '销售额', 'fieldType': 'Integer', 'izShow': 'Y', 'orderNum': 2},
]

# queryById 取完整实体后 edit（避免覆盖其他字段）
entity = (bi_utils._request('GET', '/drag/onlDragDatasetHead/queryById',
                             params={'id': DS_ID}).get('result') or {})
entity['querySql'] = query_sql
entity['datasetItemList'] = fields
entity['content'] = json.dumps(file_list, ensure_ascii=False)
bi_utils._request('POST', '/drag/onlDragDatasetHead/edit', data=entity)
print('数据集SQL更新完成')

# ======= Step 5: 验证并绑定图表 =======
test = bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={'id': DS_ID})
data = ((test.get('result') or {}).get('data') or [])
print(f'查询到 {len(data)} 条数据')
if data:
    print(f'示例: {data[0]}')

# ======= 添加堆叠柱形图（示例） =======
with open('default_configs.json', 'r', encoding='utf-8') as f:
    defaults = json.load(f)

config = json.loads(json.dumps(defaults['JStackBar']))
config.update({
    'dataType': 2,
    'dataSetId': DS_ID,
    'dataSetName': '大区品类销售统计',
    'dataSetType': 'FILES',
    'dataSetApi': query_sql,
    'dataSetMethod': 'get',
    'dataSetIzAgent': '1',
    'chartData': '[]',
    'viewLoading': True,
    'paramOption': [],
    'dataMapping': [
        {'filed': '分组', 'mapping': 'name'},    # 大区 -> 分组
        {'filed': '维度', 'mapping': 'type'},    # 品类 -> 维度
        {'filed': '数值', 'mapping': 'sales'}   # 销售额 -> 数值
    ],
    'fieldOption': [
        {'label': 'type', 'text': '品类', 'type': 'String', 'value': 'type', 'show': 'Y'},
        {'label': 'name', 'text': '大区', 'type': 'String', 'value': 'name', 'show': 'Y'},
        {'label': 'sales', 'text': '销售额', 'type': 'Integer', 'value': 'sales', 'show': 'Y'}
    ]
})
config['option']['title']['text'] = '各大区各品类销售额'
config['option']['title']['show'] = True

bi_utils._page_components[PAGE_ID] = []
comp = {
    'component': 'JStackBar',
    'componentName': '大区品类销售额',
    'visible': True,
    'i': bi_utils._gen_uuid(),
    'x': 50, 'y': 100, 'w': 900, 'h': 450,
    'config': config
}
page = bi_utils.query_page(PAGE_ID)
tmpl = page.get('template', []) or []
tmpl.insert(0, comp)
bi_utils._page_components[PAGE_ID] = tmpl
bi_utils.save_page(PAGE_ID)

print(f'完成！大屏地址: {bi_utils.API_BASE}/drag/share/view/{PAGE_ID}?token={bi_utils.TOKEN}&tenantId=2')
```

#### 多文件数据集踩坑记录（2026-04-03 更新）

| 问题 | 说明 | 解决方案 |
|------|------|---------|
| **⚠️ value 是 SQL 关键字** | SQL 解析器将 `value` 识别为关键字而非字段别名，导致报错 `Encountered "value" at line 2` | **避开 value 关键字**，用其他字段名如 `sales`、`amount`、`total` 等 |
| **⚠️ 重复文件冲突** | 同一页面多次上传文件导致 `Multiple entries with same key: Sheet1_3_excel` 错误 | 上传新文件前先删除旧文件，或使用全新空白页面 |
| **⚠️ 每个大屏只能有一个 FILES 数据集** | 多个 FILES 数据集共享同一文件存储空间，会互相覆盖导致查询冲突 | 同一大屏只创建一个 FILES 数据集，后续通过编辑更新 SQL |
| **⚠️ 字段映射用 sales 而非 value** | 堆叠柱形图 dataMapping 中 `mapping` 必须与 SQL 字段别名一致 | 确保 SQL 中的 `as sales` 与 dataMapping 中的 `mapping: 'sales'` 匹配 |
| **⚠️ 文件名大小写敏感** | 表名生成格式为 `jmf.Sheet1_{filename}_excel`，匹配时需注意大小写 | 使用 `f['name'].lower()` 辅助匹配，或直接遍历查找 |
| **⚠️ 上传文件必须带 reportId 参数** | 上传接口需要带 `reportId=页面ID` 参数，否则文件会传到错误的数据源 | 上传文件时必须添加 `reportId` 参数：`req.add_header('reportId', PAGE_ID)` |
| **⚠️ dbSource 必须与 reportId 一致** | FILES 数据集的 `dbSource` 必须与上传文件时用的 `reportId` 匹配，否则查询时报"表不存在" | 数据集的 `dbSource` 设为页面ID（如 `1199929624755920896`），上传时也用相同 pageId 作为 reportId |
| **⚠️ shared 数据源只有 products 表** | 上传到 shared（不传 reportId）的文件只有 products.xlsx，orders.xlsx 必须上传到页面数据源 | 多文件 JOIN 查询时，所有文件必须上传到同一数据源，使用页面ID作为 reportId 上传所有文件 |

#### 多文件数据集完整操作流程（2026-04-03 更新）

> **核心原则**：文件上传到哪个数据源（reportId），数据集的 dbSource就必须指向同一个值。

```python
import sys, json, os, time
import urllib.request
sys.path.insert(0, '.')
import bi_utils

API_BASE = '<api_base>'
TOKEN = '<token>'
PAGE_ID = '1199929624755920896'  # 大屏页面ID

bi_utils.API_BASE = API_BASE
bi_utils.TOKEN = TOKEN

# ======= Step 1: 上传文件（关键：必须带 reportId 参数） =======
def upload_file(file_path, report_id):
    """上传文件到指定 reportId 的数据源"""
    with open(file_path, 'rb') as f:
        file_data = f.read()

    boundary = f'----WebKitFormBoundary{int(time.time()*1000)}'
    file_name = os.path.basename(file_path)

    body_parts = []
    # 方式1：使用 form 字段传 reportId
    body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="reportId"\r\n\r\n{report_id}\r\n'.encode())
    body_parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{file_name}"\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'.encode())
    body_parts.append(file_data)
    body_parts.append(f'\r\n--{boundary}--\r\n'.encode())

    body = b''.join(body_parts)

    url = f'{API_BASE}/jmreport/source/datasource/files/add'
    req = urllib.request.Request(url, data=body, method='POST')
    req.add_header('X-Access-Token', TOKEN)
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')

    # ⚠️ 关键：添加 reportId header
    req.add_header('reportId', report_id)

    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode('utf-8'))

# 上传所有文件（必须使用页面ID作为 reportId）
print("上传 products.xlsx...")
result1 = upload_file(r'<file_path>', PAGE_ID)
print(f"结果: {result1.get('success')}")

print("上传 orders.xlsx...")
result2 = upload_file(r'<file_path>', PAGE_ID)
print(f"结果: {result2.get('success')}")

# ======= Step 2: 创建 FILES 数据集（关键：dbSource = PAGE_ID） =======
# ⚠️ 关键：dbSource 必须与上传时的 reportId 一致
payload = {
    'name': '大区品类销售额统计',
    'code': 'region_category_sales',
    'dataType': 'FILES',  # 大写 FILES
    'dbSource': PAGE_ID,  # ⚠️ 关键：使用页面ID作为数据源
    'querySql': "SELECT p.category as type, o.region as name, SUM(o.amount) as sales FROM jmf.Sheet1_orders_excel o JOIN jmf.Sheet1_products_excel p ON o.product_id = p.product_id GROUP BY p.category, o.region",
    'parentId': '0',
    'datasetItemList': [
        {'fieldName': 'type', 'fieldTxt': '品类', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 0},
        {'fieldName': 'name', 'fieldTxt': '大区', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 1},
        {'fieldName': 'sales', 'fieldTxt': '销售额', 'fieldType': 'Float', 'izShow': 'Y', 'orderNum': 2}
    ]
}

ds_result = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data=payload)
DS_ID = ds_result['result']['id']
print(f"数据集ID: {DS_ID}")

# ======= Step 3: 验证查询 =======
test = bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={'id': DS_ID})
if test.get('success'):
    data = test['result']['data']
    print(f"查询成功，返回 {len(data)} 条数据")
    print(f"示例: {data[0]}")
else:
    print(f"查询失败: {test.get('message')}")

# ======= Step 4: 绑定堆叠柱形图 =======
# 使用 comp_ops.py 绑定已创建的数据集
# py comp_ops.py add $API_BASE $TOKEN $PAGE_ID --comp "JStackBar" --title "各大区各品类销售额" --x 50 --y 300 --w 900 --h 400 --dataset-name "大区品类销售额统计"

print(f"\n完成！预览地址: {API_BASE}/drag/share/view/{PAGE_ID}?token={TOKEN}&tenantId=2")
```

#### 关键要点总结

| 步骤 | 关键点 |
|------|--------|
| **上传文件** | 必须带 `reportId=页面ID` 参数，否则文件传到错误的数据源 |
| **创建数据集** | `dbSource` 必须设为页面ID（与 reportId 一致） |
| **SQL 关键字** | 避开 `value` 关键字，使用 `sales`、`amount` 等 |
| **JOIN 查询** | 多个文件必须上传到同一数据源（用页面ID） |

### 创建多文件数据集（FILES）端到端

```python
# 1. 上传多个文件
upload_file(r'<file_path>', PAGE_ID)
upload_file(r'<file_path>', PAGE_ID)

# 2. 获取完整文件列表
files_resp = bi_utils._request('GET', '/jmreport/source/datasource/files/get',
                                params={'reportId': PAGE_ID})
file_list = json.loads(files_resp['result']['dbUrl'])

# 3. 创建数据集（可跨文件表查询）
ds = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={
    'name': '城市温度(多文件)',
    'code': 'city_temp_multi',
    'dataType': 'FILES',            # 关键：FILES（大写）
    'dbSource': PAGE_ID,
    'querySql': f'select city as name, temperature as value from {temp_table} order by temperature desc',
    'apiMethod': 'GET',
    'parentId': '0',
    'datasetItemList': [...],
    'datasetParamList': []
})
```

## SQL 数据集 + 带参数查询 + 字典翻译 + 绑定图表（完整端到端流程）

> **适用场景：** comp_ops.py `--create-sql` 不支持 `--sql-params`，带 FreeMarker 动态参数的 SQL 数据集必须用自定义脚本。

### 完整示例：demo 表男女比例饼图（带 age 查询参数）

```python
import sys, json
sys.path.insert(0, '.')
import bi_utils
bi_utils.API_BASE = '<api_base>'
bi_utils.TOKEN = '<token>'
PAGE_ID = '大屏页面ID'

DYNAMIC_SQL = """SELECT sex as name, COUNT(*) AS value FROM demo WHERE sex IS NOT NULL
<#if isNotEmpty(age)>
   and age = '${age}'
</#if>
GROUP BY sex"""

# ======= 1. 确保 jimu_dict 中有字典（大屏字典，非 sys_dict） =======
check = bi_utils._request('GET', '/jmreport/dict/list', params={'dictCode': 'sex', 'pageNo': 1, 'pageSize': 10})
records = check.get('result', {}).get('records', [])
sex_dict = next((r for r in records if r.get('dictCode') == 'sex'), None)

if not sex_dict:
    bi_utils._request('POST', '/jmreport/dict/add', data={
        'dictName': '性别', 'dictCode': 'sex', 'description': '性别字典'
    })
    re_query = bi_utils._request('GET', '/jmreport/dict/list', params={'dictCode': 'sex', 'pageNo': 1, 'pageSize': 10})
    sex_dict = next(r for r in re_query['result']['records'] if r.get('dictCode') == 'sex')
    dict_id = sex_dict['id']
    for item in [{'itemText': '男', 'itemValue': '1', 'sortOrder': 1}, {'itemText': '女', 'itemValue': '2', 'sortOrder': 2}]:
        bi_utils._request('POST', '/jmreport/dictItem/add', data={
            'dictId': dict_id, 'itemText': item['itemText'],
            'itemValue': item['itemValue'], 'sortOrder': item['sortOrder'], 'status': 1
        })

# ======= 2. 查数据源 ID =======
ds_options = bi_utils._request('GET', '/drag/onlDragDataSource/getOptions')
db_source = ds_options['result'][0]['id']

# ======= 3. 创建数据集（含 itemList + paramList + dictCode） =======
ds_result = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={
    'name': '男女比例统计',
    'code': 'demo_sex_ratio',
    'dataType': 'sql',
    'dbSource': db_source,
    'querySql': DYNAMIC_SQL,
    'apiMethod': 'GET',
    'parentId': '0',
    'datasetItemList': [
        {'fieldName': 'name', 'fieldTxt': 'name', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 0, 'dictCode': 'sex'},
        {'fieldName': 'value', 'fieldTxt': 'value', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 1}
    ],
    'datasetParamList': [
        {'paramName': 'age', 'paramTxt': '年龄', 'paramValue': '', 'dictCode': ''}
    ]
})
dataset_id = ds_result['result']['id']

# ======= 4. 测试数据集 → 获取 dictOptions =======
test = bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={'id': dataset_id})
dict_options = test.get('result', {}).get('dictOptions', {})
# dict_options 示例: {"name": [{"value":"1","text":"男","color":"#2196F3",...}, ...]}

# ======= 5. 从 default_configs.json 加载默认图表配置 =======
with open('default_configs.json', 'r', encoding='utf-8') as f:
    defaults = json.load(f)
config = json.loads(json.dumps(defaults['JPie']))  # 深拷贝！

# ======= 6. 覆盖动态数据相关字段 =======
config.update({
    'dataType': 2,
    'dataSetId': dataset_id,
    'dataSetName': '男女比例统计',
    'dataSetType': 'sql',
    'dataSetApi': DYNAMIC_SQL,
    'dataSetMethod': 'get',
    'dataSetIzAgent': '1',
    'chartData': '[]',
    'w': 450, 'h': 350,
    'size': {'width': 450, 'height': 350},
    'background': '#FFFFFF00',
    'borderColor': '#FFFFFF00',
    'viewLoading': True,
    'dictOptions': dict_options,  # 从 getAllChartData 获取，不要手动构建！
    'dataMapping': [
        {'filed': '维度', 'mapping': 'name'},
        {'filed': '数值', 'mapping': 'value'}
    ],
    'fieldOption': [
        {'label': 'name', 'text': 'name', 'type': 'String', 'value': 'name', 'show': 'Y'},
        {'label': 'value', 'text': 'value', 'type': 'String', 'value': 'value', 'show': 'Y'}
    ],
    'paramOption': [
        {'defaultVal': '', 'label': 'age', 'text': '年龄', 'type': 'string', 'value': 'age'}
    ],
})
config['option']['title']['text'] = '男女比例'
config['option']['title']['show'] = True
config['option']['title'].setdefault('textStyle', {})['color'] = '#ffffff'
config['option']['card'] = {'title': '', 'extra': '', 'rightHref': '', 'size': 'default'}

# ======= 7. 追加到大屏 =======
page = bi_utils.query_page(PAGE_ID)
tmpl = page.get('template', [])
tmpl.insert(0, {
    'component': 'JPie', 'componentName': '男女比例', 'visible': True,
    'i': bi_utils._gen_uuid(), 'x': 735, 'y': 365, 'w': 450, 'h': 350,
    'orderNum': len(tmpl) + 1, 'config': config
})
bi_utils._page_components[PAGE_ID] = tmpl
bi_utils.save_page(PAGE_ID)
```

### 关键注意事项

| 步骤 | 易错点 | 正确做法 |
|------|--------|---------|
| 字典 | 用了 `/sys/dict/` | 必须用 `/jmreport/dict/`（jimu_dict 表） |
| 数据集字段 | 缺少 `dictCode` | `datasetItemList[].dictCode = 'sex'` 绑定字典翻译 |
| 数据集参数 | 缺少 `datasetParamList` | FreeMarker `${age}` 需要对应的 paramList 项 |
| dictOptions | 手动构建 | 必须从 `getAllChartData` 返回值获取（含 value/text/color/label/title） |
| 图表 config | 手写 option | 必须从 `default_configs.json` 深拷贝默认配置，再覆盖动态字段 |
| list 接口验证 | 查 itemList/paramList | list 接口始终返回空数组，用 `getAllChartData` 验证 dictOptions |

## 数据库源 ID 参考

| 环境 | dbSource / dbCode | 说明 |
|------|-------------------|------|
| api3.boot.jeecg.com 主库 | `707437208002265088` | 默认 MySQL 数据库 |

> 不同环境的 dbSource ID 不同，部署到新环境时需要通过 `/drag/onlDragDataSource/getOptions` 查询可用的数据源列表。

---

## 数据源 → 数据集 → 图表 端到端（datasource_ops + comp_ops 一站式）

> 适用场景：从零创建数据源 → 创建 SQL 数据集 → 绑定图表，单次会话内完成。
> 原 `datasource-dataset-chart-guide.md` 合并于此。

### 询问用户的信息

| 参数 | 说明 |
|------|------|
| 数据库类型 | MySQL / SQLServer / PostgreSQL / Oracle 等 |
| JDBC URL | 完整连接串 |
| 用户名 | 数据库账号 |
| 密码 | 数据库密码 |
| 数据源名称 | 自定义中文名（如：大屏统计库） |

### 步骤1：创建数据源（`datasource_ops.py create`）

**SQL Server：**
```bash
py datasource_ops.py create "$API_BASE" "$TOKEN" \
  --name "大屏统计库" --code "bigscreen_stat" \
  --db-type SQLSERVER \
  --host "<db_host>" --port 1433 --db "jeecgbootbpm" \
  --user "jeecgbootbpm" --password "jeecgboot@2023"
# 脚本自动在 JDBC URL 中追加 trustServerCertificate=true
```

**MySQL：**
```bash
py datasource_ops.py create "$API_BASE" "$TOKEN" \
  --name "业务数据库" --code "biz_db" \
  --db-type MYSQL5.7 \
  --host "<db_host>" --port 3306 --db "jeecg-boot" \
  --user "root" --password "root"
```

**PostgreSQL：**
```bash
py datasource_ops.py create "$API_BASE" "$TOKEN" \
  --name "PG数据库" --code "pg_db" \
  --db-type POSTGRESQL \
  --host "<db_host>" --port 5432 --db "mydb" \
  --user "postgres" --password "postgres"
```

### 全部数据库类型配置表（dbType / dbDriver / dbUrl 模板）

> 将 `HOST`、`PORT`、`DB` 替换为实际值。MongoDB/Redis/ES 的 dbUrl 无协议前缀。

| label | dbType（value） | dbDriver | dbUrl 模板 |
|-------|----------------|----------|-----------|
| MySQL5.5 | `MYSQL5.5` | `com.mysql.jdbc.Driver` | `jdbc:mysql://HOST:3306/DB?characterEncoding=UTF-8&useUnicode=true&useSSL=false` |
| MySQL5.7+ | `MYSQL5.7` | `com.mysql.cj.jdbc.Driver` | `jdbc:mysql://HOST:3306/DB?characterEncoding=UTF-8&useUnicode=true&useSSL=false&tinyInt1isBit=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai` |
| MySQL8 | `MYSQL8` | `com.mysql.cj.jdbc.Driver` | `jdbc:mysql://HOST:3306/DB?useUnicode=true&characterEncoding=UTF-8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai` |
| TIDB | `TIDB` | `com.mysql.cj.jdbc.Driver` | `jdbc:mysql://HOST:4000/DB?useUnicode=true&characterEncoding=UTF-8&serverTimezone=GMT%2B8&tinyInt1isBit=false` |
| Oracle | `ORACLE` | `oracle.jdbc.OracleDriver` | `jdbc:oracle:thin:@HOST:1521:ORCL` |
| SQLServer | `SQLSERVER` | `com.microsoft.sqlserver.jdbc.SQLServerDriver` | `jdbc:sqlserver://HOST:1433;SelectMethod=cursor;DatabaseName=DB` |
| MariaDB | `MARIADB` | `org.mariadb.jdbc.Driver` | `jdbc:mariadb://HOST:3306/DB?characterEncoding=UTF-8&useSSL=false` |
| PostgreSQL | `POSTGRESQL` | `org.postgresql.Driver` | `jdbc:postgresql://HOST:5432/DB` |
| 达梦 | `dm` | `dm.jdbc.driver.DmDriver` | `jdbc:dm://HOST:5236/?DB&zeroDateTimeBehavior=convertToNull&useUnicode=true&characterEncoding=utf-8` |
| 人大金仓 | `kingbase8` | `com.kingbase8.Driver` | `jdbc:kingbase8://HOST:54321/DB` |
| 神通 | `oscar` | `com.oscar.Driver` | `jdbc:oscar://HOST:2003/DB` |
| DB2 | `DB2` | `com.ibm.db2.jcc.DB2Driver` | `jdbc:db2://HOST:50000/DB` |
| Hsqldb | `Hsqldb` | `org.hsqldb.jdbc.JDBCDriver` | `jdbc:hsqldb:hsql://HOST/DB` |
| Derby | `Derby` | `org.apache.derby.jdbc.ClientDriver` | `jdbc:derby://HOST:1527/DB` |
| Doris | `Doris` | `com.mysql.cj.jdbc.Driver` | `jdbc:mysql://HOST:9030/DB?useUnicode=true&characterEncoding=UTF-8&serverTimezone=GMT%2B8&tinyInt1isBit=false` |
| SQLite | `SQLite` | `org.sqlite.JDBC` | `jdbc:sqlite://opt/DB.db` |
| MongoDB | `mongodb` | `（空）` | `HOST:27017/DB` |
| Redis | `redis` | `（空）` | `HOST:6379` |
| Elasticsearch | `es` | `/` | `HOST:9200` |

> **严禁小写**：`sqlserver` 会报 `invalid choice` 错误，必须写 `SQLSERVER`

### `datasource_ops.py` 不支持的类型（必须直接调 API）

`datasource_ops.py create` 的 `--db-type` 只接受：`MYSQL5.7 / MYSQL5.5 / ORACLE / SQLSERVER / POSTGRESQL / mongodb / es / redis`

**以下类型必须直接调用 `/drag/onlDragDataSource/add` API**：`MYSQL8 / TIDB / MARIADB / dm / kingbase8 / oscar / DB2 / Hsqldb / Derby / Doris / SQLite`

**直接调 API 创建的完整流程（三步）：**

```python
import bi_utils
bi_utils.API_BASE = '<api_base>'
bi_utils.TOKEN = 'TOKEN'

# 第1步：创建（result 直接是字符串 ID，不是对象）
add_r = bi_utils._request('POST', '/drag/onlDragDataSource/add', data={
    'dbName': '数据源名称',   # ⚠️ add 接口用 dbName，但不会保存到 name 字段
    'dbType': 'MYSQL8',
    'dbDriver': 'com.mysql.cj.jdbc.Driver',
    'dbUrl': 'jdbc:mysql://127.0.0.1:3306/mydb?useUnicode=true&characterEncoding=UTF-8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai',
    'dbUsername': 'root',
    'dbPassword': 'root',
})
ds_id = add_r.get('result')  # 直接是 ID 字符串

# 第2步：edit 修复 name 字段（add 后 name=null，必须 edit）
bi_utils._request('POST', '/drag/onlDragDataSource/edit', data={
    'id': ds_id,
    'name': '数据源名称',
    'dbType': 'MYSQL8',
    'dbDriver': 'com.mysql.cj.jdbc.Driver',
    'dbUrl': 'jdbc:mysql://127.0.0.1:3306/mydb?...',
    'dbUsername': 'root',
    'dbPassword': 'root',
    'type': 'drag',
})

# 第3步：测试连接（⚠️ 必须传完整对象，仅传 id 报"URL为空"）
t = bi_utils._request('POST', '/drag/onlDragDataSource/testConnection', data={
    'id': ds_id,
    'dbType': 'MYSQL8',
    'dbDriver': 'com.mysql.cj.jdbc.Driver',
    'dbUrl': 'jdbc:mysql://127.0.0.1:3306/mydb?...',
    'dbUsername': 'root',
    'dbPassword': 'root',
})
print('连接测试:', t.get('message'))  # 数据库连接成功
```

### 步骤2：查询数据源 ID

```bash
py datasource_ops.py list "$API_BASE" "$TOKEN"
```

输出示例：
```
序   ID                       名称
----------------------------------------------------
12   1199505195651522560      大屏统计库
```

### 步骤3+4：创建 SQL 数据集 + 生成图表（一步完成）

使用 `comp_ops.py add --create-sql --db-source` 一条命令完成：
**创建数据集 → 测试查询 → 绑定图表组件**

```bash
py comp_ops.py add "$API_BASE" "$TOKEN" "$PAGE_ID" \
  --comp "JBar" \
  --title "图表标题" \
  --x 50 --y 100 --w 900 --h 450 \
  --create-sql "SELECT ... FROM 表名 GROUP BY ..." \
  --ds-name "数据集名称" \
  --fields "字段1:String,字段2:String" \
  --db-source "数据源ID"
```

| 参数 | 说明 |
|------|------|
| `--comp` | 图表组件类型（JBar / JLine / JPie / JStackBar / JHorizontalBar ...） |
| `--title` | 组件标题（同时作为数据集默认名） |
| `--x/y/w/h` | 组件位置和尺寸（像素） |
| `--create-sql` | SQL 查询语句 |
| `--ds-name` | 数据集名称（不填则用 --title） |
| `--fields` | 字段定义 `名称:类型` 逗号分隔，例：`day:String,cnt:String` |
| `--db-source` | 数据源 ID（从步骤2获取） |
| `--dict` | 字段字典翻译，例：`name=sex` |

SQL Server 日期格式化：`CONVERT(varchar(10), create_time, 120)` → `2022-03-17`

### 批量添加多种图表类型（同一数据集 × N 种图）

当需要把**同一数据集**绑定到**多种图表类型**时，用自定义脚本比循环调 `comp_ops.py add` 更高效（1 次 query + 1 次 save vs N 次 query + N 次 save）。

**适用场景**：同一数据集展示所有 10 种柱形图（基础/堆叠/动态/胶囊/条形/背景/对比/正负/百分比/折柱）；柱图 + 折线 + 饼图并列对比。

**核心模式（强制）**：

```python
import sys, json, copy
sys.path.insert(0, '.')
import bi_utils

bi_utils.API_BASE = API_BASE
bi_utils.TOKEN = TOKEN
defaults = json.load(open('default_configs.json', 'r', encoding='utf-8'))

# Step 1: 创建 SQL 数据集（含字段定义）
ds_items = [
    {"fieldName": "create_date",  "fieldTxt": "创建日期", "fieldType": "String", "izShow": "Y", "sort": 1},
    {"fieldName": "create_count", "fieldTxt": "创建数量", "fieldType": "String", "izShow": "Y", "sort": 2},
]
resp = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={
    "name": "数据集名称", "dataType": "sql",
    "querySql": SQL, "dbSource": DS_SOURCE_ID,
    "onlDragDatasetItemList": ds_items
})
result = resp.get('result')
# ⚠️ result 可能是 dict（含 id 字段）或直接是 ID 字符串，必须兼容两种格式
DS_ID = result.get('id') if isinstance(result, dict) else result

# Step 2: 构建绑定配置（dataMapping + fieldOption + 必要字段）
SLOT_LABELS = ['维度', '数值', '分组']
DS_CONFIG = {
    'dataType': 2, 'dataSetId': DS_ID, 'dataSetName': '数据集名称',
    'dataSetType': 'sql', 'dataSetApi': SQL, 'dataSetMethod': 'get',
    'dataSetIzAgent': '1', 'chartData': '[]', 'viewLoading': True, 'paramOption': [],
    'dataMapping': [{'filed': SLOT_LABELS[i], 'mapping': it['fieldName']} for i, it in enumerate(ds_items[:3])],
    'fieldOption': [{'label': it['fieldName'], 'text': it.get('fieldTxt', it['fieldName']),
                     'type': it.get('fieldType', 'String'), 'value': it['fieldName'], 'show': it.get('izShow','Y')}
                    for it in ds_items],
}

# Step 3: ⚠️ 关键！先加载现有页面模板再批量添加
page = bi_utils.query_page(PAGE_ID)
bi_utils._page_components[PAGE_ID] = page.get('template', [])

# Step 4: 循环添加组件（每个组件从 default_configs.json 深拷贝配置）
for idx, (comp_type, name) in enumerate(chart_list):
    cfg = json.loads(json.dumps(defaults[comp_type]))  # 深拷贝
    w, h = cfg.pop('w', 900), cfg.pop('h', 380)
    cfg['background'] = '#FFFFFF00'
    cfg['borderColor'] = '#FFFFFF00'
    opt = cfg.get('option', {})
    opt_title = opt.get('title')
    if isinstance(opt_title, str):
        opt['title'] = {'text': name, 'show': True}
    elif isinstance(opt_title, dict):
        opt_title['text'] = name
    cfg.update(copy.deepcopy(DS_CONFIG))
    if not isinstance(cfg.get('chartData'), str):
        cfg['chartData'] = json.dumps(cfg.get('chartData', []), ensure_ascii=False)
    col, row = idx % 2, idx // 2
    x = 20 + col * (w + 20)
    y = 100 + row * (h + 20)
    bi_utils.add_component(PAGE_ID, comp_type, name, x, y, w, h, cfg)

# Step 5: 一次保存（不是 N 次）
bi_utils.save_page(PAGE_ID)

# Step 6: 更新页面高度（组件超出 1080px 时必须更新）
rows = (len(chart_list) + 1) // 2
total_h = 100 + rows * (380 + 20) + 50
raw = bi_utils._request('GET', '/drag/page/queryById', params={'id': PAGE_ID})
p = raw['result']
des_raw = p.get('desJson')
des = json.loads(des_raw) if des_raw and isinstance(des_raw, str) else (des_raw if isinstance(des_raw, dict) else {})
des['height'] = total_h
des.setdefault('width', 1920)
p['desJson'] = json.dumps(des, ensure_ascii=False)
bi_utils._request('POST', '/drag/page/edit', data=p)
```

**批量模式踩坑速查**：

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| SQL 数据集创建后字段列表为空（"查询解析"栏目无字段） | 调 `/add` 时未传 `onlDragDatasetItemList` | `/add` 请求体同时传 `onlDragDatasetItemList`；或在 `getAllChartData` 后构建字段列表再调 `edit` 回写 |
| 保存后已有组件消失 | 跳过了 Step 3（先加载现有模板） | 执行 `bi_utils._page_components[PAGE_ID] = page.get('template', [])` 后再循环 |
| `result.get('id')` 报 AttributeError | `result` 是字符串而非 dict | `result.get('id') if isinstance(result, dict) else result` |
| MySQL `DATE_FORMAT` 含 `%` 被 bash 截断 | bash 命令行传递 `%Y` 时 `%` 被解释 | 将 SQL 直接写在 Python 脚本字符串里（不通过 bash 参数传递） |
| 组件超出页面高度不显示 | `desJson.height` 未更新 | 执行完后更新 `desJson.height = 总高度`，通过 `/drag/page/edit` 保存 |
| `option.title` 赋值 TypeError | `default_configs.json` 中 `title` 是字符串不是 dict | 先 `if isinstance(opt.get('title'), str): opt['title'] = {'text': name, 'show': True}` |
| `datasource add` 直接调 API 时 `result` 是字符串 ID | `/drag/onlDragDataSource/add` 的 `result` 字段直接是字符串 ID | 用 `add_resp.get('result')`；禁止用 `getOptions` 按名称查找（同名重复时取错） |

### 端到端踩坑速查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `invalid choice: sqlserver` | `--db-type` 必须大写 | 改为 `SQLSERVER` |
| `unrecognized arguments: --db-key` | 参数名错误 | 改为 `--db-source` |
| `error: argument --code is required` | `--code` 为必填项 | 添加 `--code "自定义编码"` |
| 数据集创建成功但图表无数据 | `--fields` 字段名与 SQL 别名不匹配 | 确保 `--fields` 中的名称与 SQL `AS` 别名一致 |
| SQL Server 连接失败 | 未信任证书 | 脚本已自动追加 `trustServerCertificate=true`，检查端口/防火墙 |
| 图表维度/数值映射错误 | `dataMapping` 槽位顺序问题 | 第一个字段→维度，第二个字段→数值，调整 `--fields` 顺序 |

---

## 数据源 → 数据集 → 图表 端到端（datasource_ops + comp_ops 一站式）

> 适用场景：从零创建数据源 → 创建 SQL 数据集 → 绑定图表，单次会话内完成。
> 原 `datasource-dataset-chart-guide.md` 合并于此。

### 询问用户的信息

| 参数 | 说明 |
|------|------|
| 数据库类型 | MySQL / SQLServer / PostgreSQL / Oracle 等 |
| JDBC URL | 完整连接串 |
| 用户名 | 数据库账号 |
| 密码 | 数据库密码 |
| 数据源名称 | 自定义中文名（如：大屏统计库） |

### 步骤1：创建数据源（`datasource_ops.py create`）

**SQL Server：**
```bash
py datasource_ops.py create "$API_BASE" "$TOKEN" \
  --name "大屏统计库" --code "bigscreen_stat" \
  --db-type SQLSERVER \
  --host "<db_host>" --port 1433 --db "jeecgbootbpm" \
  --user "jeecgbootbpm" --password "jeecgboot@2023"
# 脚本自动在 JDBC URL 中追加 trustServerCertificate=true
```

**MySQL：**
```bash
py datasource_ops.py create "$API_BASE" "$TOKEN" \
  --name "业务数据库" --code "biz_db" \
  --db-type MYSQL5.7 \
  --host "<db_host>" --port 3306 --db "jeecg-boot" \
  --user "root" --password "root"
```

**PostgreSQL：**
```bash
py datasource_ops.py create "$API_BASE" "$TOKEN" \
  --name "PG数据库" --code "pg_db" \
  --db-type POSTGRESQL \
  --host "<db_host>" --port 5432 --db "mydb" \
  --user "postgres" --password "postgres"
```

### 全部数据库类型配置表（dbType / dbDriver / dbUrl 模板）

> 将 `HOST`、`PORT`、`DB` 替换为实际值。MongoDB/Redis/ES 的 dbUrl 无协议前缀。

| label | dbType（value） | dbDriver | dbUrl 模板 |
|-------|----------------|----------|-----------|
| MySQL5.5 | `MYSQL5.5` | `com.mysql.jdbc.Driver` | `jdbc:mysql://HOST:3306/DB?characterEncoding=UTF-8&useUnicode=true&useSSL=false` |
| MySQL5.7+ | `MYSQL5.7` | `com.mysql.cj.jdbc.Driver` | `jdbc:mysql://HOST:3306/DB?characterEncoding=UTF-8&useUnicode=true&useSSL=false&tinyInt1isBit=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai` |
| MySQL8 | `MYSQL8` | `com.mysql.cj.jdbc.Driver` | `jdbc:mysql://HOST:3306/DB?useUnicode=true&characterEncoding=UTF-8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai` |
| TIDB | `TIDB` | `com.mysql.cj.jdbc.Driver` | `jdbc:mysql://HOST:4000/DB?useUnicode=true&characterEncoding=UTF-8&serverTimezone=GMT%2B8&tinyInt1isBit=false` |
| Oracle | `ORACLE` | `oracle.jdbc.OracleDriver` | `jdbc:oracle:thin:@HOST:1521:ORCL` |
| SQLServer | `SQLSERVER` | `com.microsoft.sqlserver.jdbc.SQLServerDriver` | `jdbc:sqlserver://HOST:1433;SelectMethod=cursor;DatabaseName=DB` |
| MariaDB | `MARIADB` | `org.mariadb.jdbc.Driver` | `jdbc:mariadb://HOST:3306/DB?characterEncoding=UTF-8&useSSL=false` |
| PostgreSQL | `POSTGRESQL` | `org.postgresql.Driver` | `jdbc:postgresql://HOST:5432/DB` |
| 达梦 | `dm` | `dm.jdbc.driver.DmDriver` | `jdbc:dm://HOST:5236/?DB&zeroDateTimeBehavior=convertToNull&useUnicode=true&characterEncoding=utf-8` |
| 人大金仓 | `kingbase8` | `com.kingbase8.Driver` | `jdbc:kingbase8://HOST:54321/DB` |
| 神通 | `oscar` | `com.oscar.Driver` | `jdbc:oscar://HOST:2003/DB` |
| DB2 | `DB2` | `com.ibm.db2.jcc.DB2Driver` | `jdbc:db2://HOST:50000/DB` |
| Hsqldb | `Hsqldb` | `org.hsqldb.jdbc.JDBCDriver` | `jdbc:hsqldb:hsql://HOST/DB` |
| Derby | `Derby` | `org.apache.derby.jdbc.ClientDriver` | `jdbc:derby://HOST:1527/DB` |
| Doris | `Doris` | `com.mysql.cj.jdbc.Driver` | `jdbc:mysql://HOST:9030/DB?useUnicode=true&characterEncoding=UTF-8&serverTimezone=GMT%2B8&tinyInt1isBit=false` |
| SQLite | `SQLite` | `org.sqlite.JDBC` | `jdbc:sqlite://opt/DB.db` |
| MongoDB | `mongodb` | `（空）` | `HOST:27017/DB` |
| Redis | `redis` | `（空）` | `HOST:6379` |
| Elasticsearch | `es` | `/` | `HOST:9200` |

> **严禁小写**：`sqlserver` 会报 `invalid choice` 错误，必须写 `SQLSERVER`

### `datasource_ops.py` 不支持的类型（必须直接调 API）

`datasource_ops.py create` 的 `--db-type` 只接受：`MYSQL5.7 / MYSQL5.5 / ORACLE / SQLSERVER / POSTGRESQL / mongodb / es / redis`

**以下类型必须直接调用 `/drag/onlDragDataSource/add` API**：`MYSQL8 / TIDB / MARIADB / dm / kingbase8 / oscar / DB2 / Hsqldb / Derby / Doris / SQLite`

**直接调 API 创建的完整流程（三步）：**

```python
import bi_utils
bi_utils.API_BASE = '<api_base>'
bi_utils.TOKEN = 'TOKEN'

# 第1步：创建（result 直接是字符串 ID，不是对象）
add_r = bi_utils._request('POST', '/drag/onlDragDataSource/add', data={
    'dbName': '数据源名称',   # ⚠️ add 接口用 dbName，但不会保存到 name 字段
    'dbType': 'MYSQL8',
    'dbDriver': 'com.mysql.cj.jdbc.Driver',
    'dbUrl': 'jdbc:mysql://127.0.0.1:3306/mydb?useUnicode=true&characterEncoding=UTF-8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai',
    'dbUsername': 'root',
    'dbPassword': 'root',
})
ds_id = add_r.get('result')  # 直接是 ID 字符串

# 第2步：edit 修复 name 字段（add 后 name=null，必须 edit）
bi_utils._request('POST', '/drag/onlDragDataSource/edit', data={
    'id': ds_id,
    'name': '数据源名称',
    'dbType': 'MYSQL8',
    'dbDriver': 'com.mysql.cj.jdbc.Driver',
    'dbUrl': 'jdbc:mysql://127.0.0.1:3306/mydb?...',
    'dbUsername': 'root',
    'dbPassword': 'root',
    'type': 'drag',
})

# 第3步：测试连接（⚠️ 必须传完整对象，仅传 id 报"URL为空"）
t = bi_utils._request('POST', '/drag/onlDragDataSource/testConnection', data={
    'id': ds_id,
    'dbType': 'MYSQL8',
    'dbDriver': 'com.mysql.cj.jdbc.Driver',
    'dbUrl': 'jdbc:mysql://127.0.0.1:3306/mydb?...',
    'dbUsername': 'root',
    'dbPassword': 'root',
})
print('连接测试:', t.get('message'))  # 数据库连接成功
```

### 步骤2：查询数据源 ID

```bash
py datasource_ops.py list "$API_BASE" "$TOKEN"
```

输出示例：
```
序   ID                       名称
----------------------------------------------------
12   1199505195651522560      大屏统计库
```

### 步骤3+4：创建 SQL 数据集 + 生成图表（一步完成）

使用 `comp_ops.py add --create-sql --db-source` 一条命令完成：
**创建数据集 → 测试查询 → 绑定图表组件**

```bash
py comp_ops.py add "$API_BASE" "$TOKEN" "$PAGE_ID" \
  --comp "JBar" \
  --title "图表标题" \
  --x 50 --y 100 --w 900 --h 450 \
  --create-sql "SELECT ... FROM 表名 GROUP BY ..." \
  --ds-name "数据集名称" \
  --fields "字段1:String,字段2:String" \
  --db-source "数据源ID"
```

| 参数 | 说明 |
|------|------|
| `--comp` | 图表组件类型（JBar / JLine / JPie / JStackBar / JHorizontalBar ...） |
| `--title` | 组件标题（同时作为数据集默认名） |
| `--x/y/w/h` | 组件位置和尺寸（像素） |
| `--create-sql` | SQL 查询语句 |
| `--ds-name` | 数据集名称（不填则用 --title） |
| `--fields` | 字段定义 `名称:类型` 逗号分隔，例：`day:String,cnt:String` |
| `--db-source` | 数据源 ID（从步骤2获取） |
| `--dict` | 字段字典翻译，例：`name=sex` |

SQL Server 日期格式化：`CONVERT(varchar(10), create_time, 120)` → `2022-03-17`

### 批量添加多种图表类型（同一数据集 × N 种图）

当需要把**同一数据集**绑定到**多种图表类型**时，用自定义脚本比循环调 `comp_ops.py add` 更高效（1 次 query + 1 次 save vs N 次 query + N 次 save）。

**适用场景**：同一数据集展示所有 10 种柱形图（基础/堆叠/动态/胶囊/条形/背景/对比/正负/百分比/折柱）；柱图 + 折线 + 饼图并列对比。

**核心模式（强制）**：

```python
import sys, json, copy
sys.path.insert(0, '.')
import bi_utils

bi_utils.API_BASE = API_BASE
bi_utils.TOKEN = TOKEN
defaults = json.load(open('default_configs.json', 'r', encoding='utf-8'))

# Step 1: 创建 SQL 数据集（含字段定义）
ds_items = [
    {"fieldName": "create_date",  "fieldTxt": "创建日期", "fieldType": "String", "izShow": "Y", "sort": 1},
    {"fieldName": "create_count", "fieldTxt": "创建数量", "fieldType": "String", "izShow": "Y", "sort": 2},
]
resp = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={
    "name": "数据集名称", "dataType": "sql",
    "querySql": SQL, "dbSource": DS_SOURCE_ID,
    "onlDragDatasetItemList": ds_items
})
result = resp.get('result')
# ⚠️ result 可能是 dict（含 id 字段）或直接是 ID 字符串，必须兼容两种格式
DS_ID = result.get('id') if isinstance(result, dict) else result

# Step 2: 构建绑定配置（dataMapping + fieldOption + 必要字段）
SLOT_LABELS = ['维度', '数值', '分组']
DS_CONFIG = {
    'dataType': 2, 'dataSetId': DS_ID, 'dataSetName': '数据集名称',
    'dataSetType': 'sql', 'dataSetApi': SQL, 'dataSetMethod': 'get',
    'dataSetIzAgent': '1', 'chartData': '[]', 'viewLoading': True, 'paramOption': [],
    'dataMapping': [{'filed': SLOT_LABELS[i], 'mapping': it['fieldName']} for i, it in enumerate(ds_items[:3])],
    'fieldOption': [{'label': it['fieldName'], 'text': it.get('fieldTxt', it['fieldName']),
                     'type': it.get('fieldType', 'String'), 'value': it['fieldName'], 'show': it.get('izShow','Y')}
                    for it in ds_items],
}

# Step 3: ⚠️ 关键！先加载现有页面模板再批量添加
page = bi_utils.query_page(PAGE_ID)
bi_utils._page_components[PAGE_ID] = page.get('template', [])

# Step 4: 循环添加组件（每个组件从 default_configs.json 深拷贝配置）
for idx, (comp_type, name) in enumerate(chart_list):
    cfg = json.loads(json.dumps(defaults[comp_type]))  # 深拷贝
    w, h = cfg.pop('w', 900), cfg.pop('h', 380)
    cfg['background'] = '#FFFFFF00'
    cfg['borderColor'] = '#FFFFFF00'
    opt = cfg.get('option', {})
    opt_title = opt.get('title')
    if isinstance(opt_title, str):
        opt['title'] = {'text': name, 'show': True}
    elif isinstance(opt_title, dict):
        opt_title['text'] = name
    cfg.update(copy.deepcopy(DS_CONFIG))
    if not isinstance(cfg.get('chartData'), str):
        cfg['chartData'] = json.dumps(cfg.get('chartData', []), ensure_ascii=False)
    col, row = idx % 2, idx // 2
    x = 20 + col * (w + 20)
    y = 100 + row * (h + 20)
    bi_utils.add_component(PAGE_ID, comp_type, name, x, y, w, h, cfg)

# Step 5: 一次保存（不是 N 次）
bi_utils.save_page(PAGE_ID)

# Step 6: 更新页面高度（组件超出 1080px 时必须更新）
rows = (len(chart_list) + 1) // 2
total_h = 100 + rows * (380 + 20) + 50
raw = bi_utils._request('GET', '/drag/page/queryById', params={'id': PAGE_ID})
p = raw['result']
des_raw = p.get('desJson')
des = json.loads(des_raw) if des_raw and isinstance(des_raw, str) else (des_raw if isinstance(des_raw, dict) else {})
des['height'] = total_h
des.setdefault('width', 1920)
p['desJson'] = json.dumps(des, ensure_ascii=False)
bi_utils._request('POST', '/drag/page/edit', data=p)
```

**批量模式踩坑速查**：

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| SQL 数据集创建后字段列表为空（"查询解析"栏目无字段） | 调 `/add` 时未传 `onlDragDatasetItemList` | `/add` 请求体同时传 `onlDragDatasetItemList`；或在 `getAllChartData` 后构建字段列表再调 `edit` 回写 |
| 保存后已有组件消失 | 跳过了 Step 3（先加载现有模板） | 执行 `bi_utils._page_components[PAGE_ID] = page.get('template', [])` 后再循环 |
| `result.get('id')` 报 AttributeError | `result` 是字符串而非 dict | `result.get('id') if isinstance(result, dict) else result` |
| MySQL `DATE_FORMAT` 含 `%` 被 bash 截断 | bash 命令行传递 `%Y` 时 `%` 被解释 | 将 SQL 直接写在 Python 脚本字符串里（不通过 bash 参数传递） |
| 组件超出页面高度不显示 | `desJson.height` 未更新 | 执行完后更新 `desJson.height = 总高度`，通过 `/drag/page/edit` 保存 |
| `option.title` 赋值 TypeError | `default_configs.json` 中 `title` 是字符串不是 dict | 先 `if isinstance(opt.get('title'), str): opt['title'] = {'text': name, 'show': True}` |
| `datasource add` 直接调 API 时 `result` 是字符串 ID | `/drag/onlDragDataSource/add` 的 `result` 字段直接是字符串 ID | 用 `add_resp.get('result')`；禁止用 `getOptions` 按名称查找（同名重复时取错） |

### 端到端踩坑速查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `invalid choice: sqlserver` | `--db-type` 必须大写 | 改为 `SQLSERVER` |
| `unrecognized arguments: --db-key` | 参数名错误 | 改为 `--db-source` |
| `error: argument --code is required` | `--code` 为必填项 | 添加 `--code "自定义编码"` |
| 数据集创建成功但图表无数据 | `--fields` 字段名与 SQL 别名不匹配 | 确保 `--fields` 中的名称与 SQL `AS` 别名一致 |
| SQL Server 连接失败 | 未信任证书 | 脚本已自动追加 `trustServerCertificate=true`，检查端口/防火墙 |
| 图表维度/数值映射错误 | `dataMapping` 槽位顺序问题 | 第一个字段→维度，第二个字段→数值，调整 `--fields` 顺序 |
