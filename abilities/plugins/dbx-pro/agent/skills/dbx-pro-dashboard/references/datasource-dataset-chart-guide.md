# 数据源 → 数据集 → 图表 完整操作指南

本指南记录从零开始「创建数据源 → 创建SQL数据集 → 生成图表组件」的完整流程，
每个步骤均可独立执行。

---

## 完整流程概览

```
步骤1：创建数据源（datasource_ops.py create）            ← ~5s
  ↓
步骤2：确认/查询数据源 ID（datasource_ops.py list）       ← ~3s
  ↓
步骤3+4：创建SQL数据集 + 绑定图表组件（comp_ops.py add）  ← ~10s
```

**总耗时目标：≤30s（含用户确认等待时间除外）**

### 实际耗时参考（本次会话 2026-04-02）

| 步骤 | 操作 | 耗时 |
|------|------|------|
| 步骤1 | 创建 SQL Server 数据源（`datasource_ops.py create`） | ~4s |
| 步骤2 | 查询数据源列表获取 ID（`datasource_ops.py list`） | ~3s |
| 步骤3+4 | 创建 SQL 数据集 + 生成柱形图（`comp_ops.py add --create-sql`） | ~8s |
| **合计** | **（不含用户回答问题的等待时间）** | **~15s** |

**依赖文件：**
```bash
# <skill_base_dir> = skill 加载时显示的 Base directory for this skill（Windows 路径，Git Bash 下需转为 /c/Users/... 格式）
# 步骤1 只需
cp "<skill_base_dir>/references/scripts/datasource_ops.py" .
cp "<skill_base_dir>/references/bi_utils.py" .

# 步骤3+4 还需
cp "<skill_base_dir>/references/scripts/comp_ops.py" .
cp "<skill_base_dir>/references/scripts/default_configs.json" .

# 执行完成后统一清理
rm datasource_ops.py comp_ops.py bi_utils.py default_configs.json
```

---

## 步骤1：创建数据源

### 询问用户的信息

| 参数 | 说明 |
|------|------|
| 数据库类型 | MySQL / SQLServer / PostgreSQL / Oracle 等 |
| JDBC URL | 完整连接串 |
| 用户名 | 数据库账号 |
| 密码 | 数据库密码 |
| 数据源名称 | 自定义中文名（如：大屏统计库） |

### 命令格式

```bash
py datasource_ops.py create "$API_BASE" "$TOKEN" \
  --name "数据源名称" \
  --code "datasource_code" \
  --db-type SQLSERVER \
  --host "<db_host>" \
  --port 1433 \
  --db "数据库名" \
  --user "用户名" \
  --password "密码"
```

### 各数据库类型命令示例

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

### ⚠️ datasource_ops.py 不支持的类型（必须直接调 API）

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

### 返回结果

成功时脚本输出：
```
创建成功:
  名称: 大屏统计库
  编码: bigscreen_stat
  类型: SQLSERVER
  JDBC: jdbc:sqlserver://<db_host>:1433;...
```

> `datasource_ops.py create` 的 `result` 返回值是数据源 ID 字符串（不是对象）

---

## 步骤2：查询数据源 ID

创建完成后，如需在 comp_ops.py 中指定数据源，需要获取其 ID：

```bash
py datasource_ops.py list "$API_BASE" "$TOKEN"
```

输出示例：
```
序   ID                       名称
----------------------------------------------------
12   1199505195651522560      大屏统计库
```

记录目标数据源 ID，下一步用 `--db-source` 传入。

---

## 步骤3+4：创建SQL数据集 + 生成图表（一步完成）

使用 `comp_ops.py add --create-sql --db-source` 一条命令完成：
**创建数据集 → 测试查询 → 绑定图表组件**

### 命令格式

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

### 参数说明

| 参数 | 说明 | 示例 |
|------|------|------|
| `--comp` | 图表组件类型 | `JBar`（柱形图）、`JLine`（折线图）、`JPie`（饼图） |
| `--title` | 组件标题（同时作为数据集默认名） | `每日大屏创建数量` |
| `--x/y/w/h` | 组件位置和尺寸（像素） | `--x 50 --y 100 --w 900 --h 450` |
| `--create-sql` | SQL 查询语句 | `SELECT day, cnt FROM ...` |
| `--ds-name` | 数据集名称（不填则用 --title） | `每日大屏创建数量统计` |
| `--fields` | 字段定义 `名称:类型` 逗号分隔 | `day:String,cnt:String` |
| `--db-source` | 数据源 ID（从步骤2获取） | `1199505195651522560` |
| `--dict` | 字段字典翻译 | `name=sex` |

### 实际案例：统计每日大屏创建数量

```bash
py comp_ops.py add "<base_url>" "$TOKEN" "1189831741968883712" \
  --comp "JBar" \
  --title "每日大屏创建数量" \
  --x 50 --y 100 --w 900 --h 450 \
  --create-sql "SELECT CONVERT(varchar(10), create_time, 120) as day, COUNT(*) as cnt FROM onl_drag_page GROUP BY CONVERT(varchar(10), create_time, 120) ORDER BY CONVERT(varchar(10), create_time, 120)" \
  --ds-name "每日大屏创建数量统计" \
  --fields "day:String,cnt:String" \
  --db-source "1199505195651522560"
```

SQL Server 日期格式化：`CONVERT(varchar(10), create_time, 120)` → `2022-03-17`

### 其他图表类型

```bash
# 折线图
--comp "JLine"

# 饼图
--comp "JPie"

# 堆叠柱形图
--comp "JStackBar"

# 条形图
--comp "JHorizontalBar"
```

---

## 仅创建数据源（独立步骤）

用户只说"创建数据源"时：

```
轮次1: cp datasource_ops.py + bi_utils.py
轮次2: py datasource_ops.py create ... && rm datasource_ops.py bi_utils.py
```

## 仅创建数据集（独立步骤，已知数据源）

用户只说"创建SQL数据集"时，需先询问：
1. 连接哪个数据源？（用 `datasource_ops.py list` 列出供选择）
2. SQL 语句是什么？
3. 字段定义？

然后用 `dataset_ops.py create-sql` 或 `comp_ops.py add --create-sql`。

---

## 踩坑速查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `invalid choice: sqlserver` | `--db-type` 必须大写 | 改为 `SQLSERVER` |
| `unrecognized arguments: --db-key` | 参数名错误 | 改为 `--db-source` |
| `error: argument --code is required` | `--code` 为必填项 | 添加 `--code "自定义编码"` |
| 数据集创建成功但图表无数据 | `--fields` 字段名与 SQL 别名不匹配 | 确保 `--fields` 中的名称与 SQL `AS` 别名一致 |
| SQL Server 连接失败 | 未信任证书 | 脚本已自动追加 `trustServerCertificate=true`，检查端口/防火墙 |
| 图表维度/数值映射错误 | `dataMapping` 槽位顺序问题 | 第一个字段→维度，第二个字段→数值，调整 `--fields` 顺序 |

---

## 批量添加多种图表类型（自定义脚本，单次保存）

当需要将**同一数据集**绑定到**多种图表类型**时，用自定义脚本比循环调 `comp_ops.py add` 更高效（1次query+1次save vs N次query+N次save）。

### 适用场景

- 同一数据集展示所有 10 种柱形图（基础/堆叠/动态/胶囊/条形/背景/对比/正负/百分比/折柱）
- 同时生成同类数据的多种可视化对比（柱形图 + 折线图 + 饼图）

### 核心模式（强制）

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
    # 设置标题
    opt = cfg.get('option', {})
    opt_title = opt.get('title')
    if isinstance(opt_title, str):
        opt['title'] = {'text': name, 'show': True}
    elif isinstance(opt_title, dict):
        opt_title['text'] = name
    # 绑定数据集
    cfg.update(copy.deepcopy(DS_CONFIG))
    if not isinstance(cfg.get('chartData'), str):
        cfg['chartData'] = json.dumps(cfg.get('chartData', []), ensure_ascii=False)
    # 计算网格位置（2列）
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

### 实战案例：统计每日大屏创建数量，生成 10 种柱形图

> 已验证（2026-04-02），大屏 ID: 1189831741968883712，数据集 ID: 1199512807784800256

**统计表**：`onl_drag_page`（大屏页面记录表）

**SQL**（写在 Python 文件内，不要通过 bash 命令行传递含 `%` 的 SQL）：
```python
SQL = "SELECT DATE_FORMAT(create_time, '%Y-%m-%d') as create_date, COUNT(*) as create_count FROM onl_drag_page GROUP BY DATE_FORMAT(create_time, '%Y-%m-%d') ORDER BY create_date"
```

**10 种柱形图列表**：
```python
BAR_CHARTS = [
    ('JBar',           '基础柱形图'),
    ('JStackBar',      '堆叠柱形图'),
    ('JDynamicBar',    '动态柱形图'),
    ('JCapsuleChart',  '胶囊图'),
    ('JHorizontalBar', '基础条形图'),
    ('JBackgroundBar', '背景柱形图'),
    ('JMultipleBar',   '对比柱形图'),
    ('JNegativeBar',   '正负条形图'),
    ('JPercentBar',    '百分比条形图'),
    ('JMixLineBar',    '折柱图'),
]
```

### 踩坑速查（批量模式专用）

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| **⚠️ SQL数据集创建后字段列表为空（"查询解析"栏目无字段）** | 调 `/add` 时未传 `onlDragDatasetItemList`，系统不会自动解析SQL字段，导致数据集打开看不到字段，需手动点击查询解析 | **两种修复方式（二选一）**：①在 `/add` 请求体中同时传 `onlDragDatasetItemList`（见核心模式 Step 1）；②或在 `getAllChartData` 后构建字段列表再调 `edit` 回写（见下方"事后回写字段列表"代码） |
| 保存后已有组件消失 | 跳过了 Step 3（先加载现有模板） | 执行 `bi_utils._page_components[PAGE_ID] = page.get('template', [])` 后再循环 |
| `result` 取 `id` 报 AttributeError | `result` 是字符串而非 dict | 用 `result.get('id') if isinstance(result, dict) else result` 兼容两种格式 |
| MySQL `DATE_FORMAT` SQL 含 `%` 被 bash 截断 | bash 命令行传递 `%Y` 时 `%` 被解释 | 将 SQL 直接写在 Python 脚本字符串里（不通过 bash 参数传递） |
| 组件超出页面高度不显示 | `desJson.height` 未更新 | 执行完后更新 `desJson.height = 总高度`，通过 `/drag/page/edit` 保存 |
| `option.title` 赋值报 TypeError | `default_configs.json` 中 `title` 是字符串不是 dict | 先检查类型：`if isinstance(opt.get('title'), str): opt['title'] = {'text': name, 'show': True}` |
| **⚠️ datasource add 直接调API时 result 是字符串ID** | `/drag/onlDragDataSource/add` 的 `result` 字段是字符串 ID（如 `"1199640199413063680"`），不是对象 | 直接用 `add_resp.get('result')` 作为 DS_SOURCE_ID；禁止用 `getOptions` 按名称查找（同名重复时会取到错误的旧数据源） |

---

## 完整两轮执行模板

```
轮次1: cp datasource_ops.py + comp_ops.py + bi_utils.py + default_configs.json（并行）
        + 询问用户：数据源连接信息

轮次（用户回复后）:
  py datasource_ops.py create ...（创建数据源）
  py datasource_ops.py list ...（获取数据源ID）
  py comp_ops.py add ... --create-sql ... --db-source ID（创建数据集+图表）
  rm 清理文件
```
