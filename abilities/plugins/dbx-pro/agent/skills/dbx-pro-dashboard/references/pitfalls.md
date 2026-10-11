# API 踩坑记录（大屏常见问题速查）

## 组件类型匹配踩坑

| 用户描述 | 错误匹配 | 正确组件 | 说明 |
|---------|---------|---------|------|
| 表格 | JScrollList | JScrollTable | 「表格」应映射到 JScrollTable（滚动表格），JScrollList 是「滚动列表」 |
| 轮播表 | JScrollTable | JScrollBoard | 「轮播表」是 JScrollBoard，不是 JScrollTable（滚动表格） |
| 发展历程 | JLine | JDevHistory | 「发展历程」有专用组件 JDevHistory，不要用折线图替代 |

## 组件名称匹配踩坑（按名称查找已有组件时）

| 规则 | 说明 |
|------|------|
| **⚠️ 禁止仅按组件类型匹配** | 页面上可能有多个同类型组件（如 2 个 JLine），仅按 `component=='JLine'` 会选错 |
| **必须按业务关键词匹配 componentName** | 用户说「智慧社区折线图」→ 匹配 `componentName` 包含「智慧社区」的组件，而非随意选一个 JLine |
| **匹配优先级** | 精确匹配 > 包含用户业务关键词 > 包含组件类型关键词 |
| **示例** | 用户说「智慧社区折线图」，页面有「基础折线图」和「智慧社区_时间分部」两个 JLine → 正确选「智慧社区_时间分部」 |

## 核心踩坑

| 问题 | 说明 |
|------|------|
| **⚠️ JBarMap（及地图类组件）表单图表必须包含 `commonOption` 和地图专属 option（2026-04-10）** | 地图类组件（JBarMap/JAreaMap/JBubbleMap 等）的 `config` 中必须包含 `commonOption`（barSize/barColor/barColor2/gradientColor/areaColor/inRange/breadcrumb）和地图专属 `option`（geo/area/visualMap/graphic）。**禁止**使用普通图表的 option 结构（yAxis/xAxis）——那是柱形图的配置，会导致地图完全不渲染。详见 `online-design-form-chart-guide.md` 中的 `_get_default_chart_option` / `_get_chart_common_option`。 |
| **⚠️ JGauge（仪表盘）表单图表：nameFields 必须为 `[]`，option 使用 gauge series（2026-04-10）** | 仪表盘不使用维度字段（nameFields=[]），只用 valueFields 中的 record_count 或数值字段。option 结构：series[0].type='gauge'，含 progress/detail/axisTick 等，**不含** yAxis/xAxis。tooltip.formatter='{a} <br/>{b} : {c}%'（字符串形式，不是 axis 形式）。chart 字段不加 isGroup。 |
| **⚠️ JLiquid（水波图）option 完全不同于普通图表（2026-04-10）** | 使用 echarts-liquidfill 插件，option 包含 `liquidType/color/borderColor/textFontSize/textColor/count/length/strokeOpacity` 等特有字段，**不含 yAxis/xAxis/series**。nameFields=[]。用普通 bar 结构会完全无法渲染。 |
| **⚠️ JProgress（环形进度图）option 使用双柱叠加结构（2026-04-10）** | 非普通 bar chart，使用两个 series（前景进度条 + 背景轨道）叠加实现进度效果。grid 全为 0（`{top:0,left:0,bottom:0,right:55}`），title.show=False，无标准 xAxis。用普通 bar 结构渲染空白。 |
| **⚠️ JHorizontalBar（水平条形图）必须设 axes type（2026-04-10）** | yAxis.type='category', xAxis.type='value' 缺一不可，否则 ECharts 默认两轴都是 value 型，坐标轴无法翻转。series 也必须有模板定义（barWidth/type）。 |
| **⚠️ option.title.text 必须为 `""`，不能填组件名（2026-04-10）** | title.text 是图表内嵌标题（用户在设计器手动设置才有值）。skill 自动填入 componentName 会导致图表内出现多余标题。组件名显示在大屏外层 componentName 字段，两者不同。 |
| **⚠️ series 不能为空 `[]`（除饼图/地图类）（2026-04-10）** | JBar/JHorizontalBar 等图表的 series 必须有模板项（含 type/barWidth/itemStyle），空数组 [] 会导致 ECharts 无法判断图表类型，数据回填后仍无法渲染。饼图/地图类通过组件内部逻辑重建 series，可以为空。 |
| **⚠️ chart.isGroup 规则（2026-04-10）** | 大多数图表需要 `isGroup: false`（JBar/JHorizontalBar/JLiquid/JProgress/JPie 等）。例外：JGauge/DoubleLineBar 等不含此字段。缺失不影响渲染但与正常手工配置不一致。 |
| **⚠️ record_count 的 widgetType 必须是 `'text'`，不是 `'count'`（2026-04-10）** | 源码 ChartSetModal.vue countField 定义：`widgetType: 'text'`。写成 `'count'` 虽不报错但与正常手工配置不一致，可能影响部分渲染逻辑。同时必须包含 `groupField: ''`。 |
| **⚠️ filterField 应从表单字段填充，不能留空（2026-04-10）** | `filterField` 对应 ChartSetModal 的 `criteriaFields`（表单所有字段）。初始为空时用户打开编辑弹窗会自动填充，但创建时应主动调 `build_filter_fields()` 填充，否则联动过滤功能无法立即使用。 |
| **⚠️ 脚本中所有显示用字段必须写汉字，严禁拼音或英文替代（2026-04-09 违规被用户指出）** | `fieldTxt`、`formName`、`componentName`、`showName`、`fieldTxt` 等所有面向用户展示的字段值，必须直接写汉字（如 `'fieldTxt': '文本框'`），禁止用拼音（`'wenbenk'`）或英文替代。Python 脚本统一加 `PYTHONIOENCODING=utf-8` 前缀，可直接写中文字符串，无编码问题。 |
| **🚨 联动源图表 fieldOption 必须用前端格式，否则设置 UI 映射字段列显示空（2026-04-24）** | `config.fieldOption` 必须用 `{value:fieldName, label:fieldTxt, text:fieldTxt, show:'Y', type:fieldType}` 格式。用 `{fieldName,fieldTxt,fieldType}` 时，`LinkConfig.vue` 第322行 `field.value==item.mapping` 过滤失败 → 联动设置弹窗"映射字段"列显示为空（功能仍运行，但 UI 中无法直观确认映射是否正确）。**正确**：`{'value':'name','label':'性别','text':'性别','show':'Y','type':'String'}`；**错误**：`{'fieldName':'name','fieldTxt':'性别','fieldType':'String'}` |
| **🚨 联动目标刷新不生效：SQL FreeMarker + paramOption + datasetParamList 三者缺一不可（2026-04-24）** | 目标图表点击后不刷新，最常见原因是三者任一缺失：① 目标数据集 SQL 缺 FreeMarker 条件 `<#if isNotEmpty(name)>WHERE f='${name}'</#if>`；② 数据集 `datasetParamList` 未声明参数 `{paramName:'name',...}`；③ 目标图表 `config.paramOption` 未包含 `{paramName:'name',...}`。联动配置本身（`linkageConfig`）可以验证正确，但不等于目标能接收参数。 |
| **🚨 SQL GROUP BY 禁止用 SELECT 别名（2026-04-24）** | `SELECT DATE_FORMAT(x,'%Y') as name ... GROUP BY name` 在 MySQL `ONLY_FULL_GROUP_BY` 模式下报 `bad SQL grammar`。必须用原表达式分组：`GROUP BY DATE_FORMAT(x,'%Y')`。同理，`SELECT sex ... GROUP BY sex`（不用别名）是安全写法。 |
| **🚨 IFNULL/COALESCE 写在 SELECT 中被 SqlInjectionUtil 拦截报错（2026-04-24）** | `SELECT IFNULL(style,'default') AS name` 等在 SELECT 列中使用空值处理函数，会被后端 `SqlInjectionUtil` 关键词检测拦截，导致查询直接报错（不是数据为空，是接口报错）。**修复**：改用 `WHERE col IS NOT NULL` 过滤，在 SELECT 中直接取原列值。❌ `SELECT IFNULL(style,'default') AS name, COUNT(*) AS value FROM t WHERE del_flag=0 GROUP BY style`；✅ `SELECT style AS name, COUNT(*) AS value FROM t WHERE del_flag=0 AND style IS NOT NULL GROUP BY style` |
| **⚠️ 禁止在自定义脚本内用 subprocess 调用 comp_ops.py 再二次直接调用** | 在 Python 脚本中通过 `subprocess.run(comp_ops.py add ...)` 添加组件后，**禁止**在脚本外再单独执行一次 `py comp_ops.py add` 相同命令。两次调用都会成功，导致大屏出现两个位置和名称完全相同的重复组件。正确做法：创建数据集用自定义脚本，添加组件**只用一种方式**——要么在脚本内 subprocess 调用，要么脚本外直接调用，二选一。推荐：**脚本只负责创建数据集，组件添加统一用脚本外 `py comp_ops.py add --dataset-name`**，流程最清晰不易出错。 |
| **⚠️ 创建数据集前必须询问数据来源（Step 0.1 强制流程）** | 用户未明确说明数据来源时，**禁止**擅自使用公开 mock API 或任何默认 URL 创建数据集。必须先问：①使用 mock 系统还是自己编写代码？②接口需要实现什么业务需求？可跳过的情况：用户已提供 mock 地址/账号、已指定 Controller 文件路径、已指定已有数据集或 SQL 数据源、任务不涉及数据集创建。 |
| **⚠️ 创建 API 数据集后必须回写字段列表（onlDragDatasetItemList）** | 创建 API 类型数据集后，系统不会自动解析字段。必须：①调 `POST /drag/onlDragDatasetHead/getAllChartData` 解析字段；②用 `GET /drag/onlDragDatasetHead/queryById` 获取完整数据集实体；③构建 `onlDragDatasetItemList`（含 fieldName/fieldTxt/fieldType/izShow/orderNum）；④调 `POST /drag/onlDragDatasetHead/edit` 回写。不回写则数据集字段配置为空，设计器无法选字段，fieldOption 也为空。完整代码：`items = [{'fieldName':k,'fieldTxt':k,'fieldType':'String','izShow':'Y','izWhere':'N','izTotal':'N','orderNum':i} for i,k in enumerate(field_names)]; ds_full = bi_utils._request('GET','/drag/onlDragDatasetHead/queryById',params={'id':DS_ID})['result']; ds_full['onlDragDatasetItemList']=items; bi_utils._request('POST','/drag/onlDragDatasetHead/edit',data=ds_full)` |
| `POST /drag/page/edit` 乐观锁 | 必须传 `updateCount`（当前数据库值） |
| **⚠️ `query_page` 不填充 `_page_components`，向已有页面追加组件必须手动初始化（2026-04-15）** | `query_page(page_id)` 只更新 `_page_info`（含 updateCount），**不会**把服务端 template 写入 `_page_components`。若直接调 `add_chart` 等函数，会报 `KeyError: 'page_id'` 或把已有组件全部清空。**正确做法**：`page = query_page(PAGE_ID); tmpl = page.get('template') or []; tmpl = json.loads(tmpl) if isinstance(tmpl, str) else tmpl; bi_utils._page_components[PAGE_ID] = tmpl`，然后再调 `add_chart` / `save_page`。|
| **⚠️ 模板复制：`create_page` 后直接 `save_page` 报"仪表盘内容不是最新"（2026-04-15）** | `create_page()` 内部调用 `/drag/page/add` 后 `_page_versions[page_id]` 缓存的 `updateCount` 与服务端不一致（服务端可能已自增）。复现：新建页面 → 立即设置 `_page_components` → `save_page()` 报 `操作失败，仪表盘内容不是最新，请刷新后操作~`。**修复**：在设置 `_page_components` 之前先调一次 `bi_utils.query_page(page_id)`，让 `_page_versions` 与服务端同步，再赋值组件并 `save_page()`。正确顺序：`page_id = create_page(...)` → `query_page(page_id)` → `_page_components[page_id] = template_components` → `save_page(page_id)`。|
| **chartData 必须是 JSON 字符串** | `config.chartData` 的值必须是 `json.dumps(...)` 后的字符串 |
| **dataMapping 的 filed 拼写** | 系统中 `filed` 不是 `field`（少一个 d） |
| **严禁使用 `rgba(0,0,0,0)` 作为背景色** | Ant Design 颜色选择器将其解析为红色。必须用 `#FFFFFF00` |
| **background 字段位置** | `config` 的顶层字段（与 `option` 同级），不是在 `option` 内部 |
| **图表标题去重** | `option.card.title` 必须为空字符串，标题仅通过 `option.title.text` 显示 |
| **图层顺序由数组索引决定** | `template` 数组索引 0=最顶层，`orderNum` 不控制 z-index |

## 数据源相关

| 问题 | 说明 |
|------|------|
| **`--db-type` 必须大写** | `sqlserver` 报 `invalid choice: sqlserver`，必须写 `SQLSERVER`；MySQL 用 `MYSQL5.7`，不是 `mysql`/`MySQL`/`MYSQL` |
| **`--code` 为必填参数** | `datasource_ops.py create` 漏传 `--code` 直接报 usage 错误，必须提供唯一编码（如 `bigscreen_stat`） |
| **`--host/--port/--db` 必须分开传** | `--db` 只接受数据库名（如 `jeecg-boot`），不能传 `host:port/dbname` 格式；主机和端口分别用 `--host` 和 `--port` 传 |
| **`comp_ops.py add` 指定数据源用 `--db-source`** | `--db-key` 不是合法参数，会报 `unrecognized arguments`，正确参数名是 `--db-source` |
| **需先 list 拿 ID 再传 --db-source** | `datasource_ops.py create` 不返回 ID 到命令行，需通过 `datasource_ops.py list` 查询 ID 后传给 `comp_ops.py add --db-source` |
| **datasource_ops.py create 返回值是 ID 字符串** | `result` 直接是数据源 ID 字符串，不是对象（与数据集 create 返回对象不同） |
| **⚠️ 创建SQL数据集前必须询问用户选择数据源** | 即使刚创建了数据源，也不能自动使用，必须：①`datasource_ops.py list` 列出所有数据源 ②`AskUserQuestion` 让用户选择 ③用选中的 ID 执行 `comp_ops.py add --create-sql --db-source <ID>` |

## 数据集相关

| 问题 | 说明 |
|------|------|
| **🚨 comp_ops.py add 不支持 --create-sql 等参数（2026-04-15 实测）** | `comp_ops.py add` 实际只支持 `--comp/--title/--x/--y/--w/--h/--config`。`--create-sql`/`--sql-file`/`--ds-name`/`--fields`/`--db-source` 均不存在，使用会直接报 `unrecognized arguments`。创建SQL数据集+绑定图表必须用 singleFile 脚本，参见 skill.md「SQL数据集 + 图表绑定 singleFile 完整模板」 |
| **🚨 getAllGroup 字段是 name 不是 groupName（2026-04-15 实测）** | `getAllGroup` 返回的节点字段名是 `name`（不是 `groupName`）。用 `item.get('groupName')` 永远是 None，导致永远触发 `addGroup` → 重复创建分组或唯一约束报错。必须用 `item.get('name') == '示例数据集'`，且过滤 `dataType is None` 的纯分组节点。`addGroup` 的 result 返回 null，不能直接拿 id，必须重查 getAllGroup 再取 `id` 作 `parentId` |
| **🚨 创建数据集后必须调 queryFieldBySql+edit 回写字段，再调 getAllChartData 存 dictOptions（2026-04-15 实测）** | 直接创建数据集后图表不渲染，原因：①字段列表未通过签名接口解析写回（组件 fieldOption 为空）；②组件 config 缺少 `dictOptions`（从 `getAllChartData` 的 `result.dictOptions` 取）。完整流程：`/add` 创建 → `queryFieldBySql`(签名) 解析 → `/edit` 回写 `datasetItemList` → `getAllChartData` 验证+取 `dictOptions` → 将 `dictOptions` 写入组件 `config.dictOptions` |
| **"数据源连接失败"** | 直接调用 API `POST /drag/onlDragDatasetHead/add` 创建 SQL 数据集时报"数据源连接失败"，但数据源测试 (`datasource_ops.py test`) 显示连接成功。**原因**：直接调 API 时请求体格式与预置脚本不同，可能缺少某些必填字段或格式不匹配。**解决方案**：始终使用 `comp_ops.py add --create-sql` 或 `dataset_ops.py create-sql` 预置脚本创建 SQL 数据集，禁止直接调 `/drag/onlDragDatasetHead/add` API。comp_ops.py 内部封装了正确的请求体格式和字段处理逻辑。若必须直接调 API，需确保包含完整字段：`dataType: 'sql', dataName, dbSource, querySql, dataRemark, parentId`（示例数据集 parentId=`1516743332632494082`），并检查 dbSource 是否为有效数字 ID 字符串。 |
| **"数据源不存在"** | SQL 数据集未设置 `dbSource`，或误用了 `dbKey`（无效字段）。直接调 `/drag/onlDragDatasetHead/add` 时字段必须是 `dbSource`，值是数据源 **数字 ID**（不是 code 字符串）。正确：`{'dbSource': '1199611644876644352', ...}`；错误：`{'dbKey': '1199611644876644352', ...}` |
| **`onlDragDatasetItemList` vs `datasetItemList`** | 直接调 add API 时用 `onlDragDatasetItemList` 可以创建成功，但字段有时会被忽略；`comp_ops.py --create-sql` 内部用 `datasetItemList`。如果数据集创建后字段为空，改用 `datasetItemList` |
| **⚠️ 自定义脚本创建SQL数据集禁止用 `dbKey`** | `dbKey` 是 comp_ops.py / datasource_ops.py 的 CLI 参数名，不是 API 字段名。直接写 API 时必须用 `dbSource`（数据源 ID），否则 getAllChartData 报"数据源不存在" |
| **⚠️ 验证表名时别从其他数据库的数据集推断** | 不同数据源连接不同的库，A 数据源有 `jmreport_big_screen` 不代表 B 数据源的库也有。验证表名应：先创建测试数据集 → getAllChartData → 成功则表名正确，失败换下一个候选表 |
| **jeecg-boot 主库大屏相关表名速查** | `onl_drag_page`（大屏页面）、`onl_drag_dataset`（数据集）。`jmreport_big_screen` 通常在单独的统计库（非 jeecg-boot 主库）中 |
| **⚠️ 禁止用 `py -` heredoc 执行动态脚本** | `py -` 读 stdin 时 Python 的 `sys.path.insert(0,'.')` 指向的是进程启动目录而非当前 shell 目录，导致 `import bi_utils` 报 ModuleNotFoundError。必须先 Write 脚本到文件再 `py script.py` 执行 |
| **⚠️ 删除数据集可能报"没有权限"** | 某些系统配置下非超级管理员无法删除已有数据集；脚本中删除操作失败不影响新建流程，可跳过报错继续执行 |
| **⚠️ `getAllGroup` 分组节点字段是 `name` 不是 `groupName`** | `getAllGroup` 返回的条目字段是 `name`（非 `groupName`）。用 `item.get('groupName')` 永远是 None，导致找不到"示例数据集"→ 触发 `addGroup` → 报唯一约束失败 → `parentId=''` → 数据集落入根目录（显示"0"）。必须用 `item.get('name') == '示例数据集'`，且仅匹配分组节点（`dataType is None AND dbSource is None`）。本环境"示例数据集"固定 id=`1516743332632494082`，可直接硬编码 |
| **编辑数据集 510 权限错误** | 确保用户 Token 拥有 `drag:dataset:save` 权限 |
| **API 地址存在 querySql 字段** | API 数据集没有独立 url 字段，`querySql` 存 API URL |
| **API 数据集不需要 dbSource** | `dbSource` 设为 `None` |
| **创建数据集 parentId 含义** | `parentId='0'` 表示根目录（无分组）；指定分组时 `parentId` = 分组节点的 `id`。**注意：分组关联用 `parentId`，不是 `groupCode`**（groupCode 是另一个字段，通常为 null） |
| **数据集创建返回值二义性** | `POST /drag/onlDragDatasetHead/add` 的 `result` 可能是包含 `id` 的对象，也可能直接是 ID 字符串。**必须同时兼容两种格式**：`DS_ID = result.get('id') if isinstance(result, dict) else result` |
| **数据源创建返回值是 string** | `result` 直接是数据源 ID 字符串 |
| **`onlDragDatasetItemList` 是创建时的正确字段名** | `POST /drag/onlDragDatasetHead/add` payload 中用 `onlDragDatasetItemList`（不是 `datasetItemList`）传字段列表；但 `queryAllById` 返回的字段名也是 `onlDragDatasetItemList` |
| **⚠️ 创建数据集后必须调用查询解析API（强制流程）** | 创建数据集后，**必须**调用对应的查询解析API，这是前端"查询解析"按钮的逻辑。**【2026-04-03 已修复】** comp_ops.py 和 dataset_ops.py 已内置自动调用。<br><br>**SQL数据集**：调用 `POST /drag/onlDragDatasetHead/queryFieldBySql`，data: `{'sql': SQL, 'dbCode': 数据源ID, 'paramArray': '[]'}`<br>**API数据集**：调用 `POST /drag/onlDragDatasetHead/queryFieldByApi`，data: `{'api': URL, 'method': 'get/post', 'paramArray': '[]'}`<br>**JSON数据集**：直接解析JSON字符串提取字段名（无需API调用）<br>**FILES/文件数据集**：调用 `POST /drag/onlDragDatasetHead/queryFileFieldBySql` <br><br>**正确流程**：① `POST /add` 创建数据集 → ② 调用对应 queryFieldBy* 解析字段 → ③ `POST /edit` 保存字段到数据集。**注意**：字段保存到 `datasetItemList`（不是 `onlDragDatasetItemList`）。已修复记录在 comp_ops.py 和 dataset_ops.py 中。 |
| **⚠️ SQL 数据集创建后字段为空（手动点查询解析才出现字段）** | 调 `/add` 时未传 `onlDragDatasetItemList`，系统不会自动解析 SQL 字段。**修复①（推荐，add 时一并传入）**：在 add 请求体中加 `"onlDragDatasetItemList": [{"fieldName":"name","fieldTxt":"日期","fieldType":"String","izShow":"Y","sort":0}, {"fieldName":"value","fieldTxt":"数量","fieldType":"Integer","izShow":"Y","sort":1}]`。**修复②（事后补救，通过 edit 回写）**：先 `getAllChartData` 拿第一行数据 → 推断字段类型（int/float→Integer，其余→String）→ `queryById` 获取完整数据集实体 → 将 `onlDragDatasetItemList` 填入实体 → `edit` 保存。代码：`items=[{'fieldName':k,'fieldTxt':k,'fieldType':'Integer' if isinstance(v,(int,float)) else 'String','izShow':'Y','sort':i} for i,(k,v) in enumerate(test_data[0].items())]; ds=bi_utils._request('GET','/drag/onlDragDatasetHead/queryById',params={'id':ds_id})['result']; ds['onlDragDatasetItemList']=items; bi_utils._request('POST','/drag/onlDragDatasetHead/edit',data=ds)` |
| **⚠️ 直接调 `/drag/onlDragDataSource/add` 时 result 是字符串 ID** | 响应体 `result` 直接是字符串（如 `"1199640199413063680"`），非包含 `id` 字段的对象。直接用 `DS_ID = add_resp.get('result')` 即可。**禁止用 `getOptions` 按名称查找**（同名重复时会取到旧数据源，返回错误 ID）。MySQL 8.x 的 `dbType` 填 `MYSQL8`（不是 `MYSQL5.7`） |
| **queryAllById 返回 result=null** | 权限或数据隔离问题，不要依赖此接口 |
| **编辑数据集字段名与查询不同** | `queryAllById` 返回 `onlDragDatasetItemList`，`edit` 需要 `datasetItemList` |
| **comp_ops.py --dataset-name 绑定后无数据** | list 接口不返回字段列表，已修复：自动从 getAllChartData 推断 |
| **字典翻译用 jimu_dict 不是 sys_dict** | 大屏字典 API 为 `/jmreport/dict/*`，不是 `/sys/dict/*`。`/sys/dict/getDictItems/` 需要签名且是系统字典表，大屏不使用 |

## 数据集批量绑定相关（SQL/API）

| 问题 | 说明 |
|------|------|
| **SQL 最大返回 1000 条** | 后端限制 |
| **⚠️ list 接口不返回 datasetItemList/datasetParamList** | `GET /drag/onlDragDatasetHead/list` 返回的记录中 `datasetItemList` 和 `datasetParamList` 始终为空数组，但数据实际已保存。验证方式：调用 `getAllChartData` 检查 `dictOptions` 是否生效 |
| **⚠️ dataset_ops.py create-sql 参数名必须是 --db-source** | 命令行参数 `--db-source` 对应脚本内部 `args.db_source`（下划线），但脚本内部错误引用了 `args.dbsource`（无下划线）导致 `AttributeError`。**正确做法**：使用自定义脚本直接调用 API 创建数据集，避免依赖 dataset_ops.py 的参数问题。参考代码：
```python
# 先获取或创建"示例数据集"分组
resp = bi_utils._request('GET', '/drag/onlDragDatasetHead/getAllGroup')
result = resp.get('result')
parent_id = None
if isinstance(result, list):
    for item in result:
        if item.get('name') == '示例数据集' and item.get('dataType') is None and item.get('dbSource') is None:
            parent_id = item.get('id')
            break
if not parent_id:
    add_resp = bi_utils._request('POST', '/drag/onlDragDatasetHead/addGroup', data={
        'name': '示例数据集', 'code': 'example_dataset', 'parentId': '0'
    })
    parent_id = add_resp.get('result')
# 创建SQL数据集时设置 parentId
payload = {
    'name': '数据集名称', 'code': 'ds_xxx', 'dataType': 'sql',
    'dbSource': '数据源ID', 'querySql': 'SELECT ...',
    'parentId': parent_id,  # 关键：设置为示例数据集分组ID
    'datasetItemList': [...]
}
bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data=payload)
``` |
| **⚠️ SQL数据集必须创建在"示例数据集"分组下（强制流程）** | 创建任意类型数据集时，分组必须使用"示例数据集"（`parentId='1516743332632494082'`），禁止创建在根目录（`parentId='0'`）或其他分组。**流程**：①调用 `GET /drag/onlDragDatasetHead/getAllGroup` 查询分组；②找到 `name='示例数据集'` 且 `dataType is None` 的节点，取其 `id` 作为 `parentId`；③如不存在则调用 `POST /drag/onlDragDatasetHead/addGroup` 创建后再使用；④创建数据集时将 `parentId` 设为分组ID。**本环境固定ID**：`示例数据集 = 1516743332632494082`，可直接硬编码使用。 |
| **⚠️ 带 FreeMarker 的 SQL 禁止通过 bash 命令行传递** | `${age}` 被 shell 解释为空变量，`<#if>` 中的 `>` 被解释为重定向。**必须用 `--sql-file sql.txt`** 将 SQL 写入文件再传给 comp_ops.py / dataset_ops.py，或写自定义 Python 脚本在代码内部定义 SQL 字符串 |
| **⚠️ FreeMarker 判空必须用 `isNotEmpty()`** | JimuReport 内置函数 `isNotEmpty(param)` 判断 null 和空字符串均返回 false。正确：`<#if isNotEmpty(age)>`。**错误：`<#if age?? && age?length gt 0>`**（标准 FreeMarker 语法但 JimuReport 不支持，会导致条件不生效） |
| **⚠️ `${}` 和 `#{}` 不可混用** | `${param}` 是查询参数占位符，`#{sys_user_code}` 是系统变量。混用会导致解析失败 |
| **⚠️ 数据集字典绑定在 datasetItemList 中** | 字典翻译通过 `datasetItemList[].dictCode` 绑定（如 `'dictCode': 'sex'`），不是在组件 config 中手动构建 `dictOptions`。绑定后 `getAllChartData` 会自动返回 `dictOptions` |
| **⚠️ 组件 dictOptions 必须从 getAllChartData 获取** | 创建组件时，先调 `getAllChartData` 获取数据集的 `dictOptions`，再写入组件 `config.dictOptions`。手动构建 dictOptions 容易遗漏格式（需包含 value/text/color/label/title 等字段） |
| **⚠️ 批量绑定数据集：API 端点错误** | 获取数据集字段不能用 `GET /drag/view/getAllChartData`（该接口返回格式不同，`result` 为 None 导致报错）。**必须用 `POST /drag/onlDragDatasetHead/getAllChartData`**，data 传 `{'id': DS_ID}`，从 `result.data[0]` 的 key 推断字段列表 |
| **⚠️ 批量绑定数据集：dataMapping 格式错误** | `dataMapping` 的 `filed` 字段是**语义槽位标签**（如 `"维度"/"数值"/"分组"`），不是字段名本身。字段名放在 `mapping` 键中。错误：`{"filed":"name","mappingField":"name"}`。正确：`{"filed":"维度","mapping":"name"}` |
| **⚠️ 批量绑定数据集：缺少 fieldOption** | 不设 `fieldOption` 会导致前端字段选项面板为空，用户无法在设计器中修改字段映射。格式：`[{"label":"name","text":"name","type":"String","value":"name","show":"Y"},...]` |
| **⚠️ 数据集分组：用 `parentId`，不是 `groupCode`** | 分组节点的特征：`dataType=null`（无 dbSource/querySql）。创建数据集时 `parentId = 分组id`。**正确查询流程**：①`GET /drag/onlDragDatasetHead/getAllGroup`（⚠️ 不是 `/drag/onlDragDatasetGroup/getAllGroup`，后者 404）②该接口返回所有记录，**必须过滤 `dataType=None` 才是分组节点** ③从分组节点中找 `name='示例数据集'` 取其 `id` ④不存在则 `POST /drag/onlDragDatasetHead/addGroup` 创建再重查。`示例数据集` 固定 id = `1516743332632494082` |
| **⚠️ `getAllGroup` 只返回部分分组（非全量）** | `GET /drag/onlDragDatasetHead/getAllGroup` 无分页但有内部过滤（按租户/权限），可能不返回已存在的分组。不要因为 getAllGroup 里没有就重复 addGroup——否则唯一约束报错。正确：先查，再 addGroup（失败时说明已存在），再通过 `getAllGroup?groupName=xxx` 反查同组数据集的 parentId |
| **⚠️ SQL 数据集必须在创建后立即测试** | 创建 SQL 数据集后，**必须立即**调 `POST /drag/onlDragDatasetHead/getAllChartData`（data: `{'id': DS_ID}`）验证 SQL 可执行。若返回 `success=false` 或 `message` 含 `bad SQL grammar`，立刻停止生成图表并报错，否则所有绑定该数据集的图表都会显示"暂无数据" |
| **⚠️ API 数据集创建后必须调 getAllChartData 触发查询解析** | `POST /drag/onlDragDatasetHead/add` 仅保存元数据配置，**不会**触发系统对接口响应的解析。必须随后调 `POST /drag/onlDragDatasetHead/getAllChartData`（data: `{'id': DS_ID}`）触发一次查询解析，系统才能缓存字段 schema。跳过此步导致：图表绑定后显示"暂无数据"、设计器字段面板为空、dataMapping 无法生效。**在 `create_api_dataset()` 函数末尾必须加此调用**：`bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={'id': ds_id})` |
| **⚠️ API 数据集 getAllChartData 必须 try/except 包裹（后端未重启时返回 null）** | 自写 Java 接口需要重启后端才能访问。在重启前调 `getAllChartData` 时，接口 404/500 导致响应为 `{"result": {"data": null}}`。**必须用 try/except 包裹，失败时打印提示并继续，不能让脚本崩溃**。正确模式：`try: parse_r = bi_utils._request(...); rows = ((parse_r.get('result') or {}).get('data') or []); print(f'解析: {len(rows)} 条') except Exception as e: print(f'解析跳过({e})，后端重启后自动生效')`。**绝对不能让 getAllChartData 失败阻断整个脚本执行** |
| **⚠️ API 数据集 onlDragDatasetItemList 已在 /add 时传入，禁止再 queryById + edit 回写（浪费 4 个请求）** | 创建 API 数据集时 `/add` 请求体已包含 `onlDragDatasetItemList`，字段已一次性保存到数据库。**禁止**再做 `queryById` → 填 `onlDragDatasetItemList` → `edit` 这三步回写——这是完全多余的操作，浪费 4 个 HTTP 请求（2个数据集 × 2次请求），且在后端未重启时还会因 getAllChartData 返回空而得到无意义的字段列表。正确做法：`/add` 时一次性传字段，随后只做 `getAllChartData`（try/except 包裹）即可 |
| **⚠️ JeecgBoot 大屏记录表名是 `jmreport_big_screen`，不是 `drag_page`** | `drag_page` 表在默认 jeecgbootsy 库中不存在。统计大屏创建情况时正确表名为 `jmreport_big_screen`（字段含 `screen_name`、`create_time`、`type` 等）。另：`onl_drag_page` 是 drag 模块的新页面表（存在，216+条记录），两个表用途不同 |
| **⚠️ 批量绑定数据集：缺少必要字段** | 完整绑定配置除 `dataType/dataSetId/dataMapping/fieldOption` 外，还需要：`dataSetName`（设计器显示用）、`dataSetType`（`"sql"`）、`dataSetApi`（querySql）、`dataSetMethod`（`"get"`）、`dataSetIzAgent`（`"1"`）、`paramOption`（`[]`）、`viewLoading`（`True`）、`chartData`（`"[]"`）。缺少任一字段均可能导致绑定在设计器中显示异常 |
| **⚠️ dataMapping 槽位标签必须从项目源码获取** | `dataMapping.filed` 的值必须是**项目源码中定义的语义槽位标签**，严禁自行创建不存在的标签（如 `"数值2"`、`"分组2"`）。源码位置：`references/core-configs/data.ts`。常见正确标签：`维度`、`数值`、`分组`、`总计`、`已用`、`名称`、`起点名称`、`终点名称`、`内容`、`数值1`、`数值2`、`总量`、`当前`。具体映射规则见下方「组件 dataMapping 槽位配置速查表」 |
| **⚠️ 双轴图（DoubleLineBar）的 slot_labels 是 `['分组','维度','数值']`** | 经源码验证，DoubleLineBar 的 dataMapping 是 `['分组','维度','数值']`（不是 `['维度','数值','数值2']`）。数据中 type 字段映射到"分组"，name 映射到"维度"，value 映射到"数值" |
| **⚠️ 不同图表类型有不同的 slot_labels** | 批量生成全组件时，每个组件类型的 dataMapping 槽位数量和标签不同。单系列图表（维度+数值）≠ 多系列图表（分组+维度+数值）。**必须为每个组件单独设置 dataMapping**，禁止全局统一配置 |
| **组件 dataMapping 槽位配置速查表** | 源码文件：`packages/dragEngine/components/bigScreenComponents/data.ts`。单系列（2槽位）：`['维度','数值']` → JBar/JPie/JLine/JArea/JSmoothLine/JStepLine/JFunnel/JRadar/JRing 等；多系列（3槽位）：`['分组','维度','数值']` → JStackBar/JMultipleBar/JNegativeBar/JPercentBar/JMixLineBar/JMultipleLine/DoubleLineBar/JBubble/JBarGroup3d；仪表盘：`['总计','已用']` → JGauge/JColorGauge/JAntvGauge/JSemiGauge；表格列表：`['名称','数值']` → JScrollBoard/JScrollTable/JCommonTable/JList/JScrollRankingBoard；翻牌器：`['数值']` → JCountTo；颜色块：`['数值']` → JColorBlock |
| **⚠️ `dataset_ops.py create-api` 必填 `--code`** | 文档未提及，但 `--code` 是必填参数（数据集唯一编码，如 `mock_monthly_orders`），漏传直接报 usage 错误 |
| **⚠️ `dataset_ops.py create-api` 不支持 `--data-path`** | 该命令无 `--data-path` 参数，无法配置 JSON 提取路径。若接口返回包装格式 `{"code":200,"result":[...]}` 则 `dataset test` 显示 `data: null` |
| **⚠️ API 数据集接口必须返回裸数组** | API 接口应直接返回 JSON 数组（如 `[{"name":"1月","value":320},...]`），**不要包装成** `{"code":200,"result":[...]}` 格式。包装格式需要配置 data-path 才能解析，而该工具不支持此参数。Java 接口返回类型写 `String`，直接 `return "[{...}]"` 最简单 |
| **⚠️ `datasource_ops.py create` 示例命令必须含 `--code`** | pitfalls.md 有记录但 SKILL.md 示例未展示，实际运行时必须提供。完整示例：`py datasource_ops.py create $API_BASE $TOKEN --name "名称" --code "唯一编码" --db-type MYSQL5.7 --host 127.0.0.1 --port 3306 --db dbname --user root --password root` |
| **🚨 YApi mock 自定义 res_body 必须是纯数组，禁止嵌套包装** | 手写 mock body 时（不用 `yapi_ops.py` 内置模板），必须直接返回 JSON 数组 `[{"name":"...","value":...}]`。**禁止**包装成 `{"result":{"data":[...]}}` 或 `{"code":200,"data":[...]}` 格式——JeecgBoot API 数据集默认不解析嵌套路径，`getAllChartData` 会返回 `data: null`，所有绑定该 mock 的图表显示"暂无数据"。这与行 166 「API接口必须返回裸数组」一致，但在 YApi 场景下极易忽视（2026-04-24 实踩）|
| **🚨 YApi `/api/interface/up` 更新接口时 payload 用 `id` 字段，不是 `_id`** | YApi MongoDB 文档中接口 ID 字段是 `_id`，但 `/api/interface/up` REST API 接收的 payload 字段名是 `id`（无下划线）。用 `_id` 会收到 `errcode=400: 请求参数 data 应当有必需属性 id`。正确用法：`payload = {'id': iid, 'project_id':..., 'title':..., 'path':..., 'res_body':...}` （2026-04-24 实踩）|
| **🚨 API 数据集 `izAgent='0'` 时，`getAllChartData` 服务端返回 `data: null` 是正常行为，禁止视为错误** | `izAgent='0'`（前端直连模式）下，后端不代理访问外部 API，`getAllChartData` 的服务端调用会得到 `{"result":{"dictOptions":{},"data":null}}`。这**不代表**数据集配置错误或图表无法显示——实际数据由用户浏览器直接从 mock URL 获取渲染。**禁止**因此 0 条去修改 `izAgent`、删除重建数据集或调试响应格式，浪费大量时间。判断 API 数据集是否工作正常的唯一标准是在前端预览页面查看图表渲染结果（2026-04-24 实踩）|

## 文件数据集相关（singleFile / FILES）

| 问题 | 说明 |
|------|------|
| **⚠️ 文件数据集 `dbSource` 含义完全不同** | 文件数据集（FILES/singleFile）的 `dbSource` 是**大屏页面 ID（reportId）**，不是 SQL 数据源 ID，**也不是上传接口返回的文件记录 `id`**。填成文件记录 `id` 同样报"数据源不存在" |
| **⚠️ 解析接口必须用 `queryFileFieldBySql`** | 文件数据集字段解析必须调 `POST /drag/onlDragDatasetHead/queryFileFieldBySql`，**不是** `/queryFieldBySql`。用后者会因找不到对应 SQL 数据库连接而报错 |
| **⚠️ SQL 表名 = 文件名（含扩展名）** | 文件名即虚拟表名，必须写完整扩展名：`SELECT * FROM employees.xlsx`，写 `FROM employees` 会报表不存在 |
| **⚠️ FILES 类型不在前端 dataType 下拉中** | 前端 dataType 选择器只有 sql/api/json/websocket 四项，FILES 需通过 `showModal(id, pid, 'FILES')` 明确传入。直接 API 创建时 `dataType` 传字符串 `'FILES'` |
| **⚠️ `getAllChartData` 文件数据集支持传 `dataMapping`** | 文件数据集的 `getAllChartData` 请求体中额外的 `dataMapping` 字段会被传入 `getFileData()`，影响字段映射；SQL/API/JSON 数据集忽略此字段 |
| **⚠️ 删除文件前必须检查引用** | 直接删除文件数据库中的文件可能导致现有数据集查询失败。必须先调 `GET /drag/onlDragDatasetHead/getDbSetByCodeAndDb?code=filename&dbSource=fileDbId` 确认无引用后再删 |
| **singleFile vs FILES 区别** | `singleFile` 关联单个文件（一张虚拟表）；`FILES` 关联多文件（多张虚拟表），SQL 可跨文件 JOIN。后端两者都路由到 `getFileData()` 处理 |
| **`queryFileFieldBySql` 参数结构** | body 参数：`{sql: 'SELECT ...', dbCode: 'FILE_DB_ID', paramArray: '[]'}`，`dbCode` 传的是文件数据库 ID（非 SQL 数据源 ID） |
| **文件列表从 `dbUrl` 字段解析** | `getFileDbById(reportId)` 返回的 `result.dbUrl` 是 JSON 字符串，需 `JSON.parse()` 后得到文件数组 |
| **组件 dataSetIzAgent 文件数据集用 `'1'`** | 文件数据集走后端代理（与 SQL 数据集一样），`dataSetIzAgent` 设为 `'1'` |
| **⚠️ singleFile 数据集 `code` 必须等于上传返回的实际表名（核心坑）** | Calcite 引擎将数据集 `code` 直接用作 FROM 子句的虚拟表名（`FROM {code}`）。若 `code` 是自定义字符串（如 `ds_file_default_xxx`），Calcite 找不到对应表，图表渲染报错。**创建时必须从上传接口返回的 `dbUrl[0].name` 中取值赋给 `code`**（格式：`jmf.{SheetName}_{文件名去后缀}_excel`，如 `jmf.Sheet1_default_excel`）。`querySql` 保持 `select * from {tableName}` 即可，不影响 FROM 子句构建 |
| **⚠️ 文件上传接口三要素缺一不可** | `POST /jmreport/source/datasource/files/add` 必须同时传：`reportId`=大屏页面ID、`isSingle`=true（单文件）、`file`=文件内容（multipart）。**必须用 `requests.post(..., files=...)` 直接调用，不能用 `bi_utils._request()`**（后者无 `files` 参数，调用报 `TypeError: _request() got an unexpected keyword argument 'files'`）。正确写法：`requests.post(f'{API_BASE}/jmreport/source/datasource/files/add', headers={'X-Access-Token': TOKEN}, params={'reportId': PAGE_ID, 'isSingle': 'true'}, files={'file': (filename, file_data, 'application/octet-stream')})` |
| **⚠️ 上传响应中表名必须从 `result.dbUrl` 解析，不是 `result.tableName`（2026-04-09实测）** | `/jmreport/source/datasource/files/add` 上传成功后，响应 `result` 是文件数据源记录对象，**不含 `tableName` 字段**。实际表名（带 `jmf.` 前缀）在 `result.dbUrl` 中以 JSON 字符串存储：`"[{\"fileName\":\"xxx.xls\",\"name\":\"jmf.Sheet1_xxx_excel\"}]"`。**正确提取方式**：`import json; db_url_items = json.loads(result.get("dbUrl","[]")); table_name = db_url_items[0].get("name") if db_url_items else None`。错误方式：`result.get("tableName")` / `result.get("table")` / `result.get("code")` → 全为 None → 猜出的表名缺少 `jmf.` 前缀 → `getAllChartData` 返回0行 |
| **⚠️ singleFile SQL 表名必须含 `jmf.` Schema 前缀** | `querySql` 必须写 `select * from jmf.Sheet1_default_excel`，**不能**写 `select * from Sheet1_default_excel`（无前缀）。无 `jmf.` 前缀时 Calcite 找不到虚拟表，`getAllChartData` 返回0行，`fields_meta` 为空，饼状图字段映射为默认 name/value 无法展示真实数据。同时 `code` 字段也应设为含 `jmf.` 前缀的全名 |
| **⚠️ singleFile `dataSetIzAgent` 必须是空字符串 `''`，不是 `'1'`** | FILES 多文件数据集用 `'1'`；singleFile 单文件数据集必须用空字符串 `''`（空字符串，不是 `'0'`/`'1'`/`None`）。用错会导致前端代理判断错误，图表无法正确加载数据。来源：SKILL.md「单文件数据集创建标准流程」条目（2026-04-09实测）|
| **⚠️ comp_ops.py 参数顺序：子命令在前，API_BASE/TOKEN/PAGE_ID 随后** | 正确：`py comp_ops.py add API_BASE TOKEN PAGE_ID --comp JPie ...`；错误：`py comp_ops.py API_BASE TOKEN PAGE_ID add --comp JPie ...`。颠倒顺序时 argparse 把 API_BASE URL 当作 subcommand 解析，报 `argument command: invalid choice: 'http://...'`（2026-04-09 实测） |
| **⚠️ `files_ops.py add-chart` 必须同时传 `--ds-name`，否则数据集绑定 label 为空（2026-04-10 实测）** | `add-chart` 子命令的 `--ds-name` 默认为空字符串，不传时组件 `config.dataSetName=''`，设计器数据集绑定 label 无回显。**正确用法**：先 `queryById` 获取数据集名称，再加 `--ds-name "数据集名称"` 参数。若已添加缺名称的组件，修复方式：`queryById`（数据集）取 `name` → `query_page` 找组件 → `cfg['dataSetName']=name` → `page/edit` 保存 |
| **⚠️ `files_ops.py add-chart` 的映射参数是 `--fields`，不是 `--col-name/--col-type/--col-sales`（2026-04-10 实测）** | `add-chart` 子命令通过 `--fields "field1:文本:类型,field2:文本:类型,..."` 构建 dataMapping/fieldOption（格式：字段名:显示文本:类型，逗号分隔）。`--col-name/--col-type/--col-sales` 是 `create-bind` 专用参数，`add-chart` 完全忽略这三个参数，导致 dataMapping/fieldOption 均为空，图表字段映射空白、数据集绑不上。**正确用法**：`py files_ops.py add-chart API TOKEN PAGE --ds-id DS_ID --comp JStackBar --title "标题" --x 50 --y 100 --w 900 --h 450 --fields "region:大区:String,category:品类:String,sales:销售额:Integer"`（三字段时自动按 分组→第1字段, 维度→第2字段, 数值→第3字段 的顺序映射，需按 分组/维度/数值 的语义顺序排列 `--fields`）。若已添加映射为空的组件，需手动写修复脚本：`query_page` → 找 JStackBar → 修改 `cfg['dataMapping']/cfg['fieldOption']` → `page/edit` 保存 |
| **⚠️ 自定义脚本内 subprocess 调用其他脚本禁止使用 `/c/Users/...` Unix 路径** | Python subprocess 在 Windows 下不经过 Git Bash 路径转换，`/c/Users/<用户名>/.../comp_ops.py` 被直接拼成 `C:\c\Users\<用户名>\...`，报 `can't open file ... No such file or directory`。正确做法：提前 `cp` 目标脚本到当前工作目录，subprocess 直接用脚本文件名调用，无需绝对路径（2026-04-09 实测） |

## 组件相关

| 问题 | 说明 |
|------|------|
| **⚠️ 严禁直接用 bi_utils.add_xxx + save_page** | `add_component` 内部初始化空列表 `_page_components[page_id] = []`，不会加载已有组件。`save_page` 会用这个空列表+新组件覆盖整个页面，**导致已有组件全部丢失**。必须用 `comp_ops.py add` 或手动先执行 `bi_utils._page_components[PAGE_ID] = page.get('template', [])` |
| **⚠️ dataType=4 表单图表（online/design）添加时必须先 query_page 加载已有模板（2026-04-10 实测）** | comp_ops.py 不支持 dataType=4，只能用自定义脚本。但直接 `bi_utils.add_component()` 后 `save_page()` 会清空已有组件。**强制三步走**：①`page = bi_utils.query_page(PAGE_ID)` ②`bi_utils._page_components[PAGE_ID] = page.get('template', [])` ③`bi_utils.add_component(PAGE_ID, ...)` + `bi_utils.save_page(PAGE_ID)`。跳过步骤①②直接调 add_component，页面只剩新图表，其余全部丢失（已观测严重事故） |
| **⚠️ 批量添加多组件到现有页面的安全模式** | 需要一次性添加多个组件且只保存一次时，正确顺序：①`page = bi_utils.query_page(PAGE_ID)` ②`bi_utils._page_components[PAGE_ID] = page.get('template', [])` ③循环调 `bi_utils.add_component(...)` ④最后 `bi_utils.save_page(PAGE_ID)`。跳过步骤②会导致已有组件被清空 |
| **添加组件必须用 comp_ops.py add** | comp_ops.py 在 cmd_add 中会先 `load_template` 再赋值 `_page_components`，安全保留已有组件。直接调 bi_utils 函数是危险操作 |
| **新增组件不显示** | config 不完整或被背景图遮挡，将新组件 `insert(0, ...)` 到数组开头 |
| **comp_ops.py add 渲染失败** | 缺少 `default_configs.json`，使用 add 时必须同时复制 |
| **⚠️ 高级组件添加后无渲染（已修复）** | 胶囊图、列表进度图、圆形进度图、半圆仪表盘、日历、卡片轮播、统计概览、滚动列表等非 ECharts 组件，其 default_configs.json 中的 chartData/option 原先是 `__ref:` 占位符，`_clean_ref_values()` 将其替换为 None 导致数据丢失。**已修复**：所有 `__ref:` 已内联为实际 JSON 数据 |
| **⚠️ 自定义脚本添加图表必须从 default_configs.json 加载默认 config** | 手写 option/series/legend 等配置容易遗漏字段导致渲染异常。正确做法：`json.loads(json.dumps(defaults['JPie']))` 深拷贝默认配置，再覆盖动态数据字段（dataType/dataSetId/dataMapping 等） |
| **JGroup 子组件存储位置** | 在 `comp.props.elements` 中 |
| **JGroup 子组件缺少 groupStyle** | 必须按百分比计算 |
| **联动必须设 linkType** | 必须同时设置 `linkType: 'comp'` 和 `linkageConfig` |
| **联动 linkageId 必须精确** | 值是目标组件的 `i` 字段（UUID） |
| **source 字段来自 ECharts params** | `name`/`value`/`type` 对应 ECharts 点击事件 params |
| **多系列 chartData 格式** | 需要 `type` 字段：`[{"name":"1月","value":10,"type":"系列A"}]` |
| **⚠️ 替换图表类型时共通配置未继承** | delete+add 替换图表类型时，仅继承数据集绑定字段（dataSetId/dataMapping 等）是不够的。用户在旧图表中定制的 `option` 字段（标题文字、坐标轴显隐、图例位置、配色等）也必须合并到新图表。使用 `merge_common_option()` 辅助函数，见下方「图表类型替换」章节 |
| **⚠️ JBar 柱体颜色：`option.color[0]` 不生效，必须同时改 `series[0].itemStyle.color`** | ECharts 中 `series[0].itemStyle.color` 的优先级高于 `option.color` 数组。JBar 默认配置中 `itemStyle.color` 硬编码了蓝色（`#64b5f6`），仅设置 `option.color[0]` 无法覆盖柱体颜色。**正确做法**：必须同时设置两个字段：`--set "option.color[0]=目标色" --set "option.series[0].itemStyle.color=目标色"`（2026-04-09 实测） |
| **⚠️ 以下组件颜色必须通过 `option.customColor` 设置，`option.color` 无效** | 组件列表：`JRadioButton / JRadialBar / JActiveRing / JRing / JPyramidFunnel / JFunnel / JBubble / DoubleLineBar / JMultipleLine / JArea / JLine / JRotatePie / JRose / JPie / JMixLineBar / JPercentBar / JMultipleBar / JCapsuleChart / JStackBar / JQuadrant`。**正确格式**：`option.customColor = [{"color1":"#FF0000","color":"#FF0000"},{"color1":"#00FF00","color":"#00FF00"},{"color1":"#FFFF00","color":"#FFFF00"}]`（`color1` 与 `color` 值相同，数组长度对应颜色数量）。`option.color` 数组和顶层 `customColor` 对这些组件均无效，必须用 `option.customColor`（2026-04-10 实测） |

### 图表类型替换（更换图表种类时保留共通配置）

**问题**：将基础柱形图换成基础折线图时，原图表中用户定制的标题文字、X轴显隐、图例位置等共通配置项未被保留，新图表展示默认配置。

**原因**：替换时直接从 `default_configs.json` 加载新图表的默认 option，没有将旧图表 option 中的共通字段合并过来。

**fix：merge_common_option 辅助函数（替换场景必用）**

```python
import copy

# 可安全跨图表类型继承的 option 字段（跳过 series，series.type 是图表类型专属）
COMMON_OPTION_KEYS = ['title', 'xAxis', 'yAxis', 'legend', 'grid', 'color', 'tooltip', 'backgroundColor']

def merge_common_option(old_opt, new_opt):
    """将旧图表 option 的共通字段合并到新图表 option（以旧值覆盖新值中的同名字段）"""
    if not isinstance(old_opt, dict) or not isinstance(new_opt, dict):
        return new_opt
    result = copy.deepcopy(new_opt)
    for key in COMMON_OPTION_KEYS:
        if key not in old_opt or key not in result:
            continue
        old_val = old_opt[key]
        new_val = result[key]
        if isinstance(old_val, dict) and isinstance(new_val, dict):
            # dict 字段：以旧值更新新值（保留新图表特有字段）
            merged = copy.deepcopy(new_val)
            merged.update(old_val)
            result[key] = merged
        else:
            # 非 dict（如 color 数组、backgroundColor 字符串）：直接替换
            result[key] = copy.deepcopy(old_val)
    return result
```

**完整替换流程（正确模式）：**

```python
# 1. 获取旧图表 option
bar_cfg = json.loads(bar_cfg_raw) if isinstance(bar_cfg_raw, str) else bar_cfg_raw
old_opt = bar_cfg.get('option', {})
if isinstance(old_opt, str):
    try: old_opt = json.loads(old_opt)
    except: old_opt = {}

# 2. 加载新图表 defaults
line_cfg = json.loads(json.dumps(defaults.get('JLine', {})))
new_opt = line_cfg.get('option', {})
if isinstance(new_opt, str):
    try: new_opt = json.loads(new_opt)
    except: new_opt = {}

# 3. 合并共通配置（核心步骤，不可省略）
line_cfg['option'] = merge_common_option(old_opt, new_opt)
```

**典型继承场景：**

| 字段 | 说明 |
|------|------|
| `option.title.text` | 用户改过的标题文字 |
| `option.title.show` | 是否显示标题 |
| `option.xAxis.show` | X 轴显隐 |
| `option.yAxis.show` | Y 轴显隐 |
| `option.legend.show` | 图例显隐 |
| `option.color` | 自定义配色方案 |
| `option.grid` | 图表内边距 |
| `option.tooltip` | 悬浮提示配置 |

**严禁继承的字段：** `series`（图表类型专属，继承会导致折线图渲染为柱形图）

## 模板相关

| 问题 | 说明 |
|------|------|
| **页签切换不工作** | JTabToggle 的 `compVals` 引用了旧 ID，必须建 ID 映射 |
| **模板组件超出 1920x1080** | 预览不支持滚动，复制后必须做边界检查 |
| **替换数据量与原模板不一致** | 保持数据条数一致，避免溢出 |

## 脚本参数相关

| 问题 | 说明 |
|------|------|
| **datasource_ops.py create 参数名** | `--db`（不是 `--db-name`），`--user`（不是 `--username`），`--host`/`--port`/`--db` 分开传（不能合并为 `host:port/dbname`） |
| **datasource_ops.py create --db-type 枚举值** | 必须从 `MYSQL5.7`/`MYSQL5.5`/`ORACLE`/`SQLSERVER`/`POSTGRESQL`/`es`/`redis`/`mongodb` 中选，全部大写，用 `mysql` 会报 `invalid choice` |
| **datasource_ops.py test 不支持 --name** | 只能用 `--id` 或直接传连接参数（`--db-type --host --port --db --user --password`） |
| **datasource_ops.py 创建+测试不能链式执行** | test 不支持按名称查找，创建后需用连接参数重复传递来测试 |
| **⚠️ `response.get('result', {})` 返回 None 陷阱** | Python 的 `.get(key, default)` 只在 key **不存在**时才返回 default；当 JSON 响应中 `"result": null` 时，`.get('result', {})` 返回 `None` 而非 `{}`，导致后续 `.get(...)` 报 `AttributeError: 'NoneType' has no attribute 'get'`。**正确写法**：`result = response.get('result') or {}`（None 和不存在均安全）。注意：`add_r.get('result', {}).get('groupCode', '')` 是典型错误模式 |
| **⚠️ `.get('data', [])` 默认值对 null 值无效（TypeError: NoneType has no len）** | `.get(key, default)` 的 default 只在 key **不存在**时生效；当响应为 `{"result": {"data": null}}` 时，`result` 是一个 dict（非 None），`or {}` 不触发，`.get('data', [])` 返回 `None`（key 存在但值为 null），后续 `len(rows)` 报 `TypeError: object of type 'NoneType' has no len()`。**这是比 result=null 更隐蔽的陷阱**。正确写法：在链末加 `or []`：`rows = ((resp.get('result') or {}).get('data') or [])`。适用于所有可能返回 `{"data": null}` 的嵌套响应字段，如 `getAllChartData`、`queryById` 等 |
| **⚠️ cp 依赖文件必须用绝对目标路径，严禁 `.`（强制）** | `cp ... bi_utils.py .` 中 `.` 依赖 shell 启动目录，Git Bash 下不可靠，文件会复制到意外位置，导致 `py script.py` 报 `ModuleNotFoundError: No module named 'bi_utils'`，引发 3 轮额外调用。**强制规范（违反此规则是严重错误）**：目标路径必须写绝对路径：`cp "...bi_utils.py" "C:/Users/<用户名>/" && cp "...default_configs.json" "C:/Users/<用户名>/" && ls "C:/Users/<用户名>/bi_utils.py" "C:/Users/<用户名>/default_configs.json"`，脚本也必须写到同一目录：`Write file_path=C:/Users/<用户名>/script.py`，执行时：`cd "C:/Users/<用户名>" && py script.py` |
| **⚠️ 并行 Bash+Write 时 Bash 失败会取消 Write** | 同一轮中 Bash 和 Write 并行执行，若 Bash 报错，Write 工具调用也会被取消（`Cancelled: parallel tool call...errored`）。需要将 cp（依赖） 和 Write（脚本文件）分开两轮，或在 cp 成功后再 Write |
| **⚠️ information_schema 被 SQL 注入保护拦截** | 大屏系统对数据集 SQL 做注入检测，`information_schema`/`SHOW TABLES` 等 DDL/元数据查询会触发 `操作失败，请注意，值可能存在SQL注入风险`。**无法通过 BI 系统的数据集接口查表结构**，只能用 trial-and-error：对已知候选表名逐一执行 `SELECT COUNT(*) FROM table LIMIT 1` 判断表是否存在 |
| **⚠️ JeecgBoot 大屏常见表名候选列表** | 当 SQL 报 `bad SQL grammar` 时，按以下优先级试：① `jmreport_big_screen`（大屏页面，JimuReport 历史版本）② `onl_drag_page`（drag 模块新版本）③ `drag_page`（不存在）。`jmreport_big_screen` 字段：`screen_name, create_time, type, status, tenant_id` 等 |

## bi_utils 内部结构相关

| 问题 | 说明 |
|------|------|
| **bi_utils 没有 init() 方法** | 直接赋值模块级全局变量：`bi_utils.API_BASE = '...'`、`bi_utils.TOKEN = '...'` |
| **组件列表在 `page['template']` 中** | `query_page()` 返回的组件列表字段是 `template`（已经是 list），**不是** `pageTemplate`（那个是空字符串） |
| **组件 ID 字段是 `i` 不是 `id`** | 每个组件的唯一标识存储在 `comp['i']` 中，不是 `comp['id']`（`id` 字段不存在） |
| **组件名称字段是 `componentName`** | 中文显示名存储在 `comp['componentName']`，不是 `label` 也不是 `name`（这两个字段不存在） |
| **template 字段已经是 list** | 无需 `json.loads()`，直接 `page.get('template', [])` 即可使用 |
| **page 主要 keys** | `id, name, path, desJson, template, coverUrl, backgroundColor, backgroundImage, theme, style, designType, type, izTemplate, ...` |

## 环境相关

| 问题 | 说明 |
|------|------|
| **Windows Git Bash 找不到 python** | 用 `py xxx.py`（不是 `python`） |
| **Git Bash 路径自动转换** | `/img/bg/bg5.png` 被转为 `C:/Program Files/Git/...`。预置脚本已修复，自定义脚本在 Python 内部赋值 |
| **Git Bash `!` 转义** | SQL 中 `!=` 变成 `\!=`。必须用 Python 脚本传递 SQL |
| **⚠️ Git Bash shell 变量传递给 py 脚本为空** | `API_BASE="http://..." && py script.py "$API_BASE"` 变量可能为空（尤其含特殊字符的长 JWT token）。**必须直接内联字面值**：`py script.py "http://..." "eyJ..."` |
| **⚠️ comp_ops.py list 中文乱码** | Git Bash 终端默认编码非 UTF-8，`comp_ops.py list` 输出的中文组件名全部乱码。**解决方案：不要单独调 list 查看名称，直接在自定义 Python 脚本中用 `query_page()` + `json.dumps(ensure_ascii=False)` 输出，或用 `py -X utf8` 执行** |
| **⚠️ Git Bash 下 cp 目标路径必须用 `/c/Users/` 格式（2026-04-09 实测）** | `cp "C:/Users/<用户名>/.../bi_utils.py" "C:/Users/<用户名>/"` 在 Git Bash 中**静默成功但文件实际不存在**——`cp` 无报错、`ls` 命令也看似通过，但随后 `py script.py` 报 `No such file or directory` 或 `ModuleNotFoundError`。**必须用 Unix 格式路径**：`cp "/c/Users/<用户名>/.../bi_utils.py" "/c/Users/<用户名>/bi_utils.py"`。同理：`ls /c/Users/<用户名>/bi_utils.py` 验证（不是 `ls C:/Users/<用户名>/bi_utils.py`）。这一个错误会导致额外 2-3 轮修复调用。 |
| **签名验证失败：时间戳为空** | 需要 `X-TIMESTAMP` + `X-Sign` + `V-Sign`，见 `signing-datasource-guide.md` |
| **HTTPS 连接问题** | api3.boot.jeecg.com 使用 HTTP 协议 |
| **后端项目目录不存在** | bi_utils.py 复制到当前工作目录 |

---

## 完整工作流：自写API接口 + API数据集 + 批量图表（标准流程）

> 适用场景：用户想用自己写的后端 API 接口作为大屏数据来源，并批量生成多个图表

### Step 1：询问三个关键信息（开始前必须问）

> **⚠️ 严禁用 find/Glob/Grep/Bash 自行搜索 Controller 文件路径**（路径未知时必须询问用户，不得自行探索文件系统）

1. **接口写在哪个文件？**（Java Controller 完整路径，**必须直接问用户**）
2. **接口展示什么数据？**（业务含义，如"访客流量"、"每月销售额"）
3. **需要几个接口？**（单系列 / 多系列 / 双轴 → 影响字段设计和 dataMapping）

**已知可复用接口（可直接使用，无需询问）：**
  - Mock 接口：`<后端源码路径>\jeecg-boot-platform\jeecg-boot-module-drag\src\main\java\org\jeecg\modules\drag\controller\OnlDragMockController.java`
  - 已有接口：`/drag/mock/visitorFlow`（单系列）、`/drag/mock/visitorFlowMulti`（多系列）、`/drag/mock/salesFlowDouble`（双轴）等

### Step 2：编写 Java 接口

**关键规则（强制）：**
- 返回类型必须是 `String`，直接返回裸 JSON 数组字符串
- **严禁包装格式**（不要 `{"code":200,"result":[...]}`，API 数据集无法配置 data-path）
- 必须加 `@JimuNoLoginRequired` 注解，否则大屏预览时被鉴权拦截 401
- 写完接口后**必须重启后端**，API 数据集才能拿到数据

**单系列模板**（适用：折线图/柱形图/饼图/面积图等）：
```java
// 数据字段：name=维度, value=数值
@JimuNoLoginRequired
@RequestMapping(value = "/xxxFlow", method = RequestMethod.GET)
public String getXxxFlow() {
    return "[{\"name\":\"1月\",\"value\":1280},{\"name\":\"2月\",\"value\":1050},...{\"name\":\"12月\",\"value\":3120}]";
}
```

**多系列模板**（适用：对比折线图、分组柱形图，+ type 字段）：
```java
// 数据字段：name=维度, value=数值, type=分组（一组数据重复 N 次，每次 type 不同）
@JimuNoLoginRequired
@RequestMapping(value = "/xxxFlowMulti", method = RequestMethod.GET)
public String getXxxFlowMulti() {
    return "["
        // 线上渠道（12条）
        + "{\"name\":\"1月\",\"value\":680,\"value2\":68,\"type\":\"线上\"},"
        // ... 线下渠道（12条）
        + "{\"name\":\"1月\",\"value\":380,\"value2\":45,\"type\":\"线下\"},"
        // ... APP渠道（12条）
        + "{\"name\":\"1月\",\"value\":220,\"value2\":35,\"type\":\"APP\"},"
        // ...
        + "{\"name\":\"12月\",\"value\":350,\"value2\":62,\"type\":\"APP\"}"
        + "]";
}
```

> `value2` 字段可选，同时支持双轴图（双 Y 轴）；`type` 字段用于多系列分组

**接口 URL 规律**：`http://{host}:{port}/jeecg-boot/drag/mock/{methodPath}`

### Step 3：在自定义 Python 脚本中创建 API 数据集

> **用自定义脚本（不是 dataset_ops.py）**，原因：dataset_ops.py create-api 的 `--code` 为必填，且 1 次只能创建 1 个数据集；自定义脚本可一次创建多个并获取 ID 用于后续绑定

```python
def get_dataset_group_id(group_name='示例数据集'):
    """
    ⚠️ 正确端点是 /drag/onlDragDatasetHead/getAllGroup（不是 /drag/onlDragDatasetGroup/getAllGroup，后者 404）
    ⚠️ 该接口返回所有记录（含数据集和分组），必须过滤 dataType=None 才是分组节点
    ⚠️ 示例数据集固定 id = 1516743332632494082
    """
    r = bi_utils._request('GET', '/drag/onlDragDatasetHead/getAllGroup')
    all_records = (r.get('result') or [])
    # 分组节点特征：dataType is None
    groups = [x for x in all_records if x.get('dataType') is None]
    grp = next((g for g in groups if g.get('name') == group_name), None)
    if grp:
        return grp['id']
    # 尝试创建（用 addGroup，不是 /drag/onlDragDatasetGroup/add）
    add_r = bi_utils._request('POST', '/drag/onlDragDatasetHead/addGroup',
                               data={'name': group_name})
    r2 = bi_utils._request('GET', '/drag/onlDragDatasetHead/getAllGroup')
    groups2 = [x for x in (r2.get('result') or []) if x.get('dataType') is None]
    grp2 = next((g for g in groups2 if g.get('name') == group_name), None)
    return grp2['id'] if grp2 else '0'

def create_api_dataset(name, api_url, fields):
    # 先查是否已存在（幂等）
    resp = bi_utils._request('GET', '/drag/onlDragDatasetHead/list', params={'pageNo': 1, 'pageSize': 200})
    records = (resp.get('result') or {}).get('records', [])
    existing = next((r for r in records if r.get('name') == name), None)
    if existing:
        return existing['id']

    # ⚠️ 正确字段是 parentId（不是 groupCode），值为分组节点的 id
    group_id = get_dataset_group_id('示例数据集')

    body = {
        "name": name,
        "dataType": "api",        # ⚠️ 字符串 'api'，不是数字
        "querySql": api_url,      # ⚠️ URL 存在 querySql 字段，没有独立 url 字段
        "apiMethod": "get",
        "parentId": group_id,     # ⚠️ 用 parentId 不是 groupCode
        "onlDragDatasetItemList": fields   # ⚠️ 创建时用 onlDragDatasetItemList
    }
    result = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data=body)
    r = (result.get('result') or {})
    # ⚠️ 返回值二义性：result 可能是 dict{id:...} 也可能是 id 字符串
    return r.get('id') if isinstance(r, dict) else r
```

**字段定义示例：**
```python
single_fields = [
    {"fieldName": "name",   "fieldTxt": "月份",  "fieldType": "String",  "izShow": "Y"},
    {"fieldName": "value",  "fieldTxt": "访客量", "fieldType": "Integer", "izShow": "Y"},
]
multi_fields = [
    {"fieldName": "name",   "fieldTxt": "月份",  "fieldType": "String",  "izShow": "Y"},
    {"fieldName": "value",  "fieldTxt": "访客量", "fieldType": "Integer", "izShow": "Y"},
    {"fieldName": "value2", "fieldTxt": "转化率", "fieldType": "Integer", "izShow": "Y"},
    {"fieldName": "type",   "fieldTxt": "渠道",  "fieldType": "String",  "izShow": "Y"},
]
```

### Step 4：构建 dataMapping（不同图表类型 slot labels 不同）

```python
def make_ds_config(ds_id, ds_name, api_url, fields, slot_labels):
    return {
        'dataType': 2,              # 数据集模式
        'dataSetId': ds_id,
        'dataSetName': ds_name,
        'dataSetType': 'api',
        'dataSetApi': api_url,
        'dataSetMethod': 'get',
        'dataSetIzAgent': '1',
        'chartData': '[]',
        'viewLoading': True,
        'paramOption': [],
        # ⚠️ filed 是语义槽位标签（不是字段名！），mapping 才是字段名
        'dataMapping': [
            {'filed': slot_labels[i] if i < len(slot_labels) else f'字段{i}', 'mapping': f['fieldName']}
            for i, f in enumerate(fields[:len(slot_labels)])
        ],
        # ⚠️ fieldOption 必须设置，否则设计器字段选项面板为空
        'fieldOption': [
            {'label': f['fieldName'], 'text': f.get('fieldTxt', f['fieldName']),
             'type': f.get('fieldType', 'String'), 'value': f['fieldName'], 'show': f.get('izShow', 'Y')}
            for f in fields
        ],
    }

# ⚠️ 不同图表类型的 slot labels（必须按此对应，否则绑定后无数据）
single_cfg = make_ds_config(..., slot_labels=['维度', '数值'])           # JLine/JSmoothLine/JArea/JStepLine
multi_cfg  = make_ds_config(..., slot_labels=['维度', '数值', '分组'])   # JMultipleLine（对比折线图）
double_cfg = make_ds_config(..., slot_labels=['维度', '数值', '数值2'])  # DoubleLineBar（双轴图）
```

### Step 5：批量添加图表（自定义脚本，1次保存）

> **必须先加载已有页面组件，再追加新组件**，否则已有组件全部丢失

```python
# ⚠️ 关键：先加载已有组件到 _page_components，再调 add_component（不初始化为空）
page = bi_utils.query_page(PAGE_ID)
bi_utils._page_components[PAGE_ID] = page.get('template', [])

charts = [
    ('JLine',         '基础折线图', single_cfg),
    ('JSmoothLine',   '平滑曲线图', single_cfg),
    ('JStepLine',     '阶梯折线图', single_cfg),
    ('JArea',         '面积图',     single_cfg),
    ('JMultipleLine', '对比折线图', multi_cfg),
    ('DoubleLineBar', '双轴图',     double_cfg),
]
COLS, W, H, MARGIN = 2, 900, 380, 20
for idx, (comp_type, name, ds_cfg) in enumerate(charts):
    x = 20 + (idx % COLS) * (W + MARGIN)
    y = 20 + (idx // COLS) * (H + MARGIN)
    cfg = json.loads(json.dumps(defaults.get(comp_type, {})))
    cfg.pop('w', None); cfg.pop('h', None)
    cfg['background'] = '#FFFFFF00'; cfg['borderColor'] = '#FFFFFF00'
    # ⚠️ option.title 可能是 str，需检查类型后转为 dict
    opt = cfg.get('option', {})
    if isinstance(opt, str): opt = json.loads(opt); cfg['option'] = opt
    t = opt.get('title')
    if isinstance(t, str): opt['title'] = {'text': name, 'show': True}
    elif isinstance(t, dict): t['text'] = name
    else: opt['title'] = {'text': name, 'show': True}
    cfg.update(copy.deepcopy(ds_cfg))
    if not isinstance(cfg.get('chartData', '[]'), str):
        cfg['chartData'] = json.dumps(cfg['chartData'], ensure_ascii=False)
    bi_utils.add_component(PAGE_ID, comp_type, name, x, y, W, H, cfg)

bi_utils.save_page(PAGE_ID)
```

### Step 6：脚本末尾必须输出接口地址和重启提示（强制）

> **每次写完 Java 接口后，必须在脚本末尾打印接口地址和重启提示，让用户知道下一步操作**

```python
# ── 最后输出 ─────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("✅ 大屏组件已生成完成！")
print("="*60)
print("\n📌 已写入的 API 接口地址（需重启后端后生效）：")
print(f"  单系列：{API_BASE}/drag/mock/visitorFlow")
print(f"  多系列：{API_BASE}/drag/mock/visitorFlowMulti")
print("\n⚠️  请重启 Spring Boot 后端服务，接口才能生效！")
print("   重启后 API 数据集将自动拉取数据，图表即可显示。")
print("\n🔗 大屏预览地址：")
print(f"   {API_BASE}/drag/share/view/{PAGE_ID}?token={TOKEN}&tenantId=2")
print("="*60)
```

### 踩坑速查

| 步骤 | 常见问题 | 解决方案 |
|------|---------|---------|
| Step 2 | Java 接口返回 `JSONObject`/`Result<T>`（包装格式） | 改为返回 `String`，直接拼裸 JSON 数组字符串 |
| Step 2 | 大屏访问接口 401 | 加 `@JimuNoLoginRequired` 注解 |
| Step 3 | `dataset_ops.py create-api` 的 `--code` 漏传 | 改用自定义 Python 脚本，或补加 `--code "唯一编码"` |
| Step 3 | `dataType` 填了数字（如 3） | 必须是字符串 `'api'`，不是整数 |
| Step 3 | 返回值取 ID 报错 | 兼容两种格式：`r.get('id') if isinstance(r, dict) else r` |
| Step 4 | 图表绑定后显示"暂无数据" | 检查 slot_labels 是否与图表类型匹配；确认服务已重启 |
| Step 4 | `option.title` 是 str 类型报 TypeError | `if isinstance(t, str): opt['title'] = {'text': name, 'show': True}` |
| Step 5 | 已有组件被清空 | 必须先 `bi_utils._page_components[PAGE_ID] = page.get('template') or []`（注意用 `or []` 而非 `get('template', [])`，因为 template 字段存在但值为 null 时 `get(..., [])` 仍返回 None） |
| Step 6 | 用户不知道下一步操作 | 脚本末尾必须打印接口地址 + 重启提示 + 预览地址 |

## 页面配置相关

| 问题 | 说明 |
|------|------|
| **页面级配置用 _request** | `query_page()` 只返回组件信息，修改背景色/水印等需用 `_request('GET', '/drag/page/queryById')` |
| **desJson 是 JSON 字符串** | 修改前 `json.loads()`，修改后 `json.dumps()` |
| **水印在 desJson.waterMark 中** | 不是页面顶层字段 |
| **数据集绑定必须设 dataSetName** | 缺少导致设计器中数据集下拉框显示为空 |

## 地图相关

| 问题 | 说明 |
|------|------|
| **地图空白** | 后端没有对应 adcode 的地图数据 |
| **addMapData 的 name 格式** | 存储 adcode（`"650000"`），不是中文名 |
| **china 地图不走后端** | 前端内置，不需要上传 |
| **area.value 是数组** | `["650000"]`，取最后一个元素 |
| **🚨 地图组件 config 禁止手工构造，必须从 default_configs.json 深拷贝（2026-04-10 严重事故）** | 手工构造 option/commonOption/dataMapping 会导致所有地图组件全部报错不渲染。根本原因：地图组件的 option 结构（geo/area/visualMap/series/timeline 等字段）和 commonOption（barSize/barColor/areaColor/inRange/breadcrumb/heat 等字段）极为复杂，各组件差异大，手写必然遗漏或填错字段。**强制做法：** `cfg = copy.deepcopy(defaults['JAreaMap']); cfg.pop('w',None); cfg.pop('h',None); cfg['chartData'] = json.dumps(data, ensure_ascii=False)` — 只替换 chartData 和标题文字，其余全部保持默认值不动。 |
| **🚨 地图 chartData 格式各不相同，禁止跨组件套用（2026-04-10 严重事故）** | 每种地图组件的 chartData 格式完全不同，混用导致全部渲染失败。各组件正确格式如下：<br>• **JAreaMap / JBubbleMap / JBarMap**：`[{"name":"省名","value":数字}]` — 只有 name+value，系统内置地理坐标库自动匹配<br>• **JHeatMap**：`[{"name":"城市名","value":数字}]` — 同上，只需 name+value<br>• **JFlyLineMap**：`[{"fromName":"城市","toName":"城市","fromLng":数字,"fromLat":数字,"toLng":数字,"toLat":数字,"value":数字}]` — 必须用 `fromLng/fromLat/toLng/toLat` 四个独立字段，**禁止用 `coords:[[lng,lat],[lng,lat]]` 数组格式**<br>• **JTotalFlyLineMap**：同 JFlyLineMap 格式 + `"group":"分组名"` 字段（**禁止用 `type` 替代 `group`**）<br>• **JTotalBarMap**：`[{"name":"地区","lng":数字,"lat":数字,"value":数字,"group":"分类"}]` — 必须用 `lng/lat` 独立字段（**禁止用 `coords:[lng,lat]` 数组**），分组用 `group`（**禁止用 `type`**） |

## 完整工作流：YApi Mock 系统创建 API 数据集（标准流程）

> 适用场景：用户选择使用 mock 系统（YApi）来提供大屏数据，而非自写后端接口。
> YApi 是 API 管理 + Mock 服务，可在线配置接口返回数据，无需重启后端。

### Step 1：询问两个关键信息（开始前必须问）

1. **mock 系统访问地址**（如 `https://api.jeecg.com`，注意是根域名，不是 `/login` 页面）
2. **账号 + 密码**（用于登录 YApi 后台创建接口）
3. **接口需要实现的业务需求**（如"2025年度成交量统计"，按季度/月份/分类）

> 用户提供的是登录页 URL（如 `https://api.jeecg.com/login`），去掉 `/login` 路径即为 `YAPI_BASE`。

### Step 2：查看大屏组件，确认数据格式

**先用 `comp_ops.py list` + 自定义脚本查看组件 config，确认：**
- 组件类型（JFunnel / JBar / JPie 等）→ 决定 `name+value` / `x+y` / 多字段格式
- 当前 dataType 和 dataSetId（如已有数据集，可复用 ID 直接更新）
- chartData 静态示例（参考格式设计 mock 返回值）

**数据格式参考（按图表类型）：**

| 图表类型 | 字段格式 | 示例 |
|---------|---------|------|
| 漏斗图/饼图/柱形图（单系列） | `[{name, value}]` | `[{"name":"Q1","value":1200}]` |
| 折线图/对比柱形图（多系列） | `[{name, value, type}]` | `[{"name":"1月","value":800,"type":"2024年"}]` |
| 散点图/双轴图 | `[{x, y}]` 或 `[{name, value, value2}]` | |
| 轮播表/数据表格 | 任意字段 | `[{month, amount, growth}]` |

### Step 3：使用 urllib 脚本完成全流程

**重要：使用 `urllib` 而非 `requests`**（Windows 环境 requests 常未安装，urllib 是标准库，必须用 urllib）。

**完整脚本模板：**

```python
import sys, json, urllib.request, urllib.parse, http.cookiejar
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, '.')
import bi_utils

YAPI_BASE  = 'https://api.jeecg.com'   # 去掉 /login 路径
YAPI_EMAIL = 'xxx@xxx.com'
YAPI_PWD   = 'xxx'
MOCK_PATH  = '/drag/yourApiPath'        # 自定义路径，建议 /drag/ 前缀

# ── YApi HTTP 工具（带 cookie session） ──────────────────────────────
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

def yapi_post(path, payload):
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        f'{YAPI_BASE}{path}', data=body,
        headers={'Content-Type': 'application/json'}
    )
    with opener.open(req, timeout=15) as resp:
        return json.loads(resp.read().decode('utf-8'))

def yapi_get(path, params=None):
    url = f'{YAPI_BASE}{path}'
    if params:
        url += '?' + urllib.parse.urlencode(params)
    with opener.open(urllib.request.Request(url), timeout=15) as resp:
        return json.loads(resp.read().decode('utf-8'))

# ── Step 1: 登录 ─────────────────────────────────────────────────────
d = yapi_post('/api/user/login', {'email': YAPI_EMAIL, 'password': YAPI_PWD})
assert d.get('errcode') == 0, f'YApi 登录失败: {d}'
print(f'登录成功: {d["data"].get("username","")}')

# ── Step 2: 找第一个可用项目 ────────────────────────────────────────
proj_id = None
for g in yapi_get('/api/group/list').get('data', []):
    projects = yapi_get('/api/project/list', {'group_id': g['_id'], 'page': 1, 'limit': 20}).get('data', {}).get('list', [])
    if projects:
        proj_id = projects[0]['_id']
        print(f'使用项目: {projects[0]["name"]} (id={proj_id})')
        break
assert proj_id, '未找到项目'

# ── Step 3: 获取分类 ID ──────────────────────────────────────────────
cats = yapi_get('/api/interface/getCatMenu', {'project_id': proj_id}).get('data', [])
cat_id = cats[0]['_id'] if cats else yapi_post('/api/interface/add_cat', {
    'name': '大屏数据', 'project_id': proj_id, 'desc': '大屏数据接口'
}).get('data', {}).get('_id')

# ── Step 4: 创建或更新 Mock 接口 ─────────────────────────────────────
MOCK_DATA = [
    {"name": "四季度", "value": 38920},
    {"name": "三季度", "value": 29870},
    # ... 根据业务需求填充
]

iface_payload = {
    'title': '接口标题',
    'path': MOCK_PATH,
    'method': 'GET',
    'project_id': proj_id,
    'catid': cat_id,
    'status': 'done',
    'res_body_type': 'raw',                                    # ⚠️ 必须 raw，不是 json
    'res_body': json.dumps(MOCK_DATA, ensure_ascii=False),
}

# 先查是否已存在同路径
try:
    existing_list = yapi_get('/api/interface/list_menu', {'project_id': proj_id, 'catid': cat_id}).get('data', {}).get('list', [])
    existing = next((i for i in existing_list if i.get('path') == MOCK_PATH), None)
except:
    existing = None

if existing:
    iface_payload['_id'] = existing['_id']
    yapi_post('/api/interface/save', iface_payload)            # 更新用 save
    print(f'接口已更新 id={existing["_id"]}')
else:
    r = yapi_post('/api/interface/add', iface_payload)         # 新建用 add
    assert r.get('errcode') == 0, f'创建失败: {r}'
    print(f'接口已创建 id={r["data"]["_id"]}')

MOCK_URL = f'{YAPI_BASE}/mock/{proj_id}{MOCK_PATH}'
print(f'Mock 地址: {MOCK_URL}')

# ── Step 5: 验证 Mock 可访问 ─────────────────────────────────────────
try:
    with urllib.request.urlopen(MOCK_URL, timeout=8) as resp:
        rows = json.loads(resp.read().decode('utf-8'))
    print(f'Mock 验证 OK，返回 {len(rows)} 条')
except Exception as e:
    print(f'Mock 验证失败: {e}')

# ── Step 6: 在 JimuBI 创建/更新 API 数据集 ──────────────────────────
# 方案A：已有数据集（如旧 WebSocket 数据集）→ 直接 edit 改类型
ds = bi_utils._request('GET', '/drag/onlDragDatasetHead/queryById', params={'id': DS_ID})['result']
ds.update({
    'dataType': 'api',
    'querySql': MOCK_URL,
    'apiMethod': 'get',
    'onlDragDatasetItemList': [
        {'fieldName': 'name', 'fieldTxt': '名称', 'fieldType': 'String', 'izShow': 'Y', 'izWhere': 'N', 'orderNum': 1},
        {'fieldName': 'value', 'fieldTxt': '数值', 'fieldType': 'String', 'izShow': 'Y', 'izWhere': 'N', 'orderNum': 2},
    ]
})
bi_utils._request('POST', '/drag/onlDragDatasetHead/edit', data=ds)

# 方案B：新建 API 数据集（无已有数据集时）
# dataset_ops.py create-api --code "deal2025" --name "2025成交量" --url "MOCK_URL" --method get --fields "name:String:名称,value:String:数值"

# ── Step 7: 触发查询解析（强制，不可跳过）─────────────────────────────
# ⚠️ /add 仅保存配置，不触发解析。必须随后调 getAllChartData 让系统缓存字段 schema，
#    否则图表绑定后显示"暂无数据"，设计器字段面板为空。
for ds_id in [DS_ID_1, DS_ID_2, DS_ID_3]:   # 所有新建的 API 数据集 ID
    r = bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData',
                          data={'id': ds_id})
    ok  = r.get('success') or r.get('code') == 200
    rows = (r.get('result') or {}).get('data', [])
    print(f'解析 {ds_id}: {"OK" if ok else "FAIL"} ({len(rows)} 条)')
    if not ok:
        print(f'  错误: {r.get("message")}')
```

### 踩坑记录

| 问题 | 说明 |
|------|------|
| **⚠️ API 数据集 /add 后必须调 getAllChartData 触发解析** | `/add` 只写元数据，不执行接口调用，系统不知道字段结构。必须在 `create_api_dataset()` 末尾立即调 `POST /drag/onlDragDatasetHead/getAllChartData`（data: `{'id': ds_id}`）。跳过导致图表无数据、设计器字段面板为空。本坑在 YApi Mock 流程中实测复现（2026-04-02） |
| **⚠️ 禁止 import requests** | Windows 环境通常未安装 `requests`，必须用 `urllib`（标准库）。否则 `ModuleNotFoundError` |
| **⚠️ sys.stdout.reconfigure(encoding='utf-8')** | Windows 默认 GBK 编码，print 中文 + Unicode 特殊字符（✓ ✗ 等）直接报 `UnicodeEncodeError`。脚本第 2 行必须加此行 |
| **⚠️ YAPI_BASE 去掉 /login 路径** | 用户提供的是登录页 URL（`https://api.jeecg.com/login`），API 基址是 `https://api.jeecg.com`，直接用会导致所有接口 404 |
| **⚠️ res_body_type 必须是 'raw'** | 使用 `'raw'` + `res_body` 字符串直接返回 JSON 数据。`'json'` 类型是 JSON Schema，mock 返回的不是实际数据 |
| **⚠️ 新建接口用 add，更新接口用 save** | 同路径接口已存在时调 `add` 会报重复错误，必须先查询再决定用 `add` 还是 `save`（save 需传 `_id`） |
| **⚠️ cookie 必须用 HTTPCookieProcessor** | YApi 登录后通过 cookie 维持 session，必须用 `CookieJar + build_opener`，否则后续请求 401 |
| **⚠️ WebSocket 数据集改 API 类型** | `dataType: 'websocket'` → `'api'`，`querySql` 从 ws:// 地址改为 https:// Mock URL，直接 edit 原数据集即可，组件无需重新绑定 |
| **⚠️ 字段列表 onlDragDatasetItemList 不能空** | API 数据集编辑时必须同步提交字段定义，否则数据集测试返回数据但前端字段选项面板为空，dataMapping 无法配置 |
| **Mock URL 格式** | `{YAPI_BASE}/mock/{project_id}{interface_path}`，project_id 是整数，interface_path 必须以 `/` 开头 |
| **YApi 登录字段** | 字段名为 `email`（不是 `username`），与 JeecgBoot 登录不同 |
| **⚠️ yapi_ops.py `--path` 必须以 `/` 开头** | `--path bar_charts_data` 会报 `errcode=400: path第一位必需为 /`。**必须写**：`--path /bar_charts_data`（2026-04-10 实测） |
| **⚠️ Git Bash 下 `--path /xxx` 被转成 Windows 路径** | 在 Git Bash 中以 `/` 开头的参数（如 `--path /bar_charts_data`）会被自动转换为 `C:\bar_charts_data`，YApi 收到后格式不合法。**必须在命令前加 `MSYS_NO_PATHCONV=1`**：`MSYS_NO_PATHCONV=1 PYTHONIOENCODING=utf-8 py yapi_ops.py create-mock ... --path /bar_charts_data`（2026-04-10 实测，浪费 2 轮修复） |

## JTabToggle 导航切换组件

| 问题 | 说明 |
|------|------|
| **⚠️ chartData/dataType 必须在 config 内部** | 前端通过 `:config="item.config"` 传 props，`useDataSource`（useDataSource.ts）通过 `props.config.chartData` 和 `props.config.dataType` 读取数据源。自定义脚本创建 JTabToggle 时，`chartData`、`dataType`、`dataMapping`、`containDataType`、`timeOut`、`turnConfig`、`linkType`、`linkageConfig`、`size`、`chart` 等字段**必须放在 `config` JSON 字符串内部**（和 JBar/JPie 等组件一致），不能放在组件顶层。放在顶层会导致：数据源绑定失败（tab 项不渲染）、显隐关联不生效 |
| **chartData 格式** | `[{"label":"柱形图","value":"1"},{"label":"折线图","value":"2"}]`，每项需有 `label`（显示文本）和 `value`（唯一标识） |
| **option.items 与 chartData 的 value 必须匹配** | `option.items[n].value` 必须与 `chartData[n].value` 一一对应，`handleVisible()` 通过 `cfg.value == selectedVal.value` 判断显隐 |
| **option.items[n].compVals** | 数组，存储被关联组件的 `i`（UUID），如 `["1774961844288_201693"]`。切换 tab 时对应组件 `visible=true`，其他 tab 的组件 `visible=false` |
| **containDataType 固定为 [1]** | JTabToggle 只支持静态数据类型（dataType=1），不支持数据集 |
| **option 使用 normal/active 嵌套结构** | 样式配置在 `option.normal`（通用）和 `option.active`（高亮）中，各含 `fontSize`、`color`、`backgroundColor`、`borderColor`、`borderWidth`、`gradient` 等。不是扁平的 `fontColor`/`activeFontColor` |
| **被关联组件应位置重叠** | 被导航切换控制的多个组件应放在相同坐标（x/y/w/h 一致），通过切换显隐实现"同位切换"效果 |

## 本次实战 checklist（数据源+SQL数据集+批量图表 完整流程踩坑）

> 记录一次完整的「创建数据源 → 创建 SQL 数据集 → 批量绑定图表」操作中遇到的所有坑，供下次参考。

### 执行顺序陷阱

| 步骤 | 容易踩的坑 | 正确做法 |
|------|-----------|---------|
| cp 脚本文件 | cp 静默失败但显示 "done"，后续报 ModuleNotFoundError | cp 后立即 `ls bi_utils.py` 验证 |
| 并行 cp + Write | Bash 失败时 Write 被取消 | cp 成功后再单独 Write 脚本 |
| 创建数据源 | 忘记 `--code` 参数 | 必须传 `--code` 唯一编码 |
| addGroup 返回值 | `response.get('result', {}).get('id')` 报 AttributeError | 用 `response.get('result') or {}` |
| SQL 表名 | 猜测 `drag_page` 不存在 | 用 `SELECT COUNT(*) FROM 候选表` 逐一试 |
| SQL 测试 | 创建数据集后未测试直接绑定图表 | 必须 `getAllChartData` 验证成功后再绑定 |
| 分组字段 | 用 `groupCode` 而非 `parentId` | 分组节点 id 赋给 `parentId` 字段 |

### 关键 Python 代码模式

```python
# 错误：result=null 时返回 None，后续 .get() 报 AttributeError
result = response.get('result', {}).get('id')

# 正确：or {} 处理 null
result = (response.get('result') or {}).get('id')

# 错误：groupCode
data['groupCode'] = group_id

# 正确：parentId
data['parentId'] = group_id or '0'

# 创建数据集后立即测试 SQL
test_r = bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={'id': DS_ID})
if not (test_r.get('success') or test_r.get('code') == 200):
    print(f"SQL 失败: {test_r.get('message')}"); sys.exit(1)
```

## API 数据集创建踩坑（YApi Mock + 批量折线图，2026-04-03）

### 踩坑记录

| 问题 | 错误做法 | 正确做法 |
|------|---------|---------|
| **⚠️ `/add` 返回的 `result` 是完整 dict，不是 ID 字符串** | `DS_ID = add_r.get('result')` → DS_ID 是整个对象 dict | `DS_ID = (add_r.get('result') or {}).get('id')` 或 `add_r['result']['id']` |
| **⚠️ `edit` 接口保存字段列表用 `datasetItemList`，不是 `onlDragDatasetItemList`** | `ds['onlDragDatasetItemList'] = fields` → 字段不生效，静默丢失 | `ds['datasetItemList'] = fields`（后端 VO 字段名是 `datasetItemList`） |
| **⚠️ `queryFieldByApi` 对外部 URL 可能返回空列表** | 解析到空就停止 | fallback 到 `getAllChartData` 从实际数据推断字段类型：`int/float → Integer，其余 → String` |
| **⚠️ `queryAllById` 需要签名验证，bi_utils 签名与其不兼容** | 用 `queryAllById` 检查已保存字段 | 用 `queryById` 获取实体（只含头部字段），字段列表通过 `getAllChartData` 验证 |
| **⚠️ 先改前端 Vue 代码再排查后端返回结构** | 假设后端返回 `onlDragDatasetItemList`，修改 `initFormData` 的字段映射 → 反而清空字段显示 | **先调 API 确认后端实际返回字段名，再决定是否改前端** |

### 正确的 API 数据集创建 + 字段保存完整模板

```python
# ── 1. 创建 API 数据集（正确提取 DS_ID）──────────────────────────────
add_r = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={
    'name': '数据集名', 'code': 'ds_xxx', 'dataType': 'api',
    'querySql': MOCK_URL, 'apiMethod': 'get', 'parentId': parent_id,
    'datasetItemList': [  # ⚠️ 字段名必须是 datasetItemList，不是 onlDragDatasetItemList
        {'fieldName': 'name',  'fieldTxt': '名称', 'fieldType': 'String',  'izShow': 'Y', 'orderNum': 0},
        {'fieldName': 'value', 'fieldTxt': '数值', 'fieldType': 'Integer', 'izShow': 'Y', 'orderNum': 1},
        {'fieldName': 'type',  'fieldTxt': '分组', 'fieldType': 'String',  'izShow': 'Y', 'orderNum': 2},
    ]
})
DS_ID = (add_r.get('result') or {}).get('id')  # ⚠️ result 是 dict，需取 .id
assert DS_ID, f'创建失败，result={add_r.get("result")}'

# ── 2. 触发解析（强制），queryFieldByApi 可能返空，fallback getAllChartData ──
fields = (bi_utils._request('GET', '/drag/onlDragDatasetHead/queryFieldByApi',
    params={'url': MOCK_URL, 'method': 'get'}).get('result') or [])
if not fields:
    rows = ((bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData',
        data={'id': DS_ID}).get('result') or {}).get('data') or [])
    if rows:
        fields = [{'fieldName': k, 'fieldTxt': k,
                   'fieldType': 'Integer' if isinstance(v, (int, float)) else 'String',
                   'izShow': 'Y', 'orderNum': i}
                  for i, (k, v) in enumerate(rows[0].items())]

# ── 3. 若字段解析后与创建时不同，回写（用 datasetItemList）─────────────
if fields:
    ds = (bi_utils._request('GET', '/drag/onlDragDatasetHead/queryById',
        params={'id': DS_ID}).get('result') or {})
    ds['datasetItemList'] = fields  # ⚠️ 必须用 datasetItemList
    bi_utils._request('POST', '/drag/onlDragDatasetHead/edit', data=ds)
```

### 字段名对照表（后端 API ↔ 前端表单）

| 含义 | 后端 VO / API 字段名 | 前端 formState 字段名 |
|------|--------------------|--------------------|
| 数据集字段列表 | `datasetItemList` | `datasetItemList` |
| 数据集参数列表 | `datasetParamList` | `datasetParamList` |
| 查询全部（含子表）| `queryAllById` | — （需签名验证，bi_utils 不兼容） |
| 查询头部信息 | `queryById` | — |

---

## Online 表单图表全组件批量生成踩坑（2026-04-03）

> 源码参考：`packages\utils\constant.ts`（chartConfig 函数）
> 源码参考：`packages\dragEngine\modal\chartset\hooks\useChartBiz.ts`（onlyValueChart 逻辑）
> 源码参考：`packages\dragEngine\modal\chartset\components\FieldConfig.vue`（字段槽位显示条件）

### ⚠️ chart.category 必须与 constant.ts chartConfig 中的父级 type 一致

**错误原因**：category 填错导致后端 `getTotalDataByCompId` 无法正确处理数据，图表一直加载中。

**权威分类映射（来自 constant.ts chartConfig，不得自行猜测）：**

| 组件类型 | category | 常见错误 |
|---------|---------|---------|
| JBar/JStackBar/JMultipleBar/JNegativeBar/JDynamicBar/JMixLineBar/JCapsuleChart/JPercentBar/JBackgroundBar | `Bar` | — |
| JHorizontalBar/JRankingList/JTotalProgress | `HorizontalBar` | ~~`Bar`~~ |
| JLine/JArea/JMultipleLine/DoubleLineBar/JStepLine/JSmoothLine | `Line` | — |
| JCustomProgress/JProgress/JLiquid/JListProgress/JRoundProgress | `Progress` | — |
| JPictorialBar/JPictorial/JGender | `Pictorial` | — |
| **JPie/JRing/JBreakRing**/JRose/JRotatePie | `Pie` | **JRing 是 `Pie` 不是 `Ring`！** |
| JFunnel/JPyramidFunnel/JPyramid3D | `Funnel` | — |
| JRadar/JCircleRadar | `Radar` | — |
| JRingProgress/JActiveRing/JRadialBar | `Ring` | — |
| JRectangle | `Rectangle` | — |
| **JBar3d/JBarGroup3d** | `threeD` | ~~`Bar3d`~~ |
| JColorGauge/JGauge/JAntvGauge/JSemiGauge | `Gauge` | — |
| JNumber/JCountTo/JColorBlock/JStatsSummary/JOrbitRing | `Number` | — |
| JScatter/JBubble/JQuadrant | `Scatter` | — |
| JPivotTable | `Table` | — |
| JAreaMap/JBubbleMap/JHeatMap/JBarMap | `Map` | — |
| JWordCloud/JImgWordCloud/JFlashCloud | `WordCloud` | — |

### ⚠️ onlyValueChart 的精确判断条件（来自 useChartBiz.ts 源码）

```typescript
// useChartBiz.ts 第173-175行
const onlyValueChart = computed(() => {
  return ['Gauge', 'Number'].includes(selectedChart.category) || ['JTotalProgress', 'JLiquid'].includes(selectedChart.subclass);
});
```

**onlyValueChart=true（这些组件 nameFields 必须为空！）：**
- category='Gauge'：JColorGauge、JGauge、JAntvGauge、JSemiGauge
- category='Number'：JNumber（以及归入 Number 类的 JCountTo、JColorBlock、JStatsSummary、JOrbitRing）
- subclass='JTotalProgress'（即使 category 是 HorizontalBar）
- subclass='JLiquid'（即使 category 是 Progress）

**⚠️ 注意**：Ring 和 Progress 分类的图表 **不是** onlyValueChart，它们仍然需要 nameFields：
- JRingProgress/JActiveRing/JRadialBar（Ring 类）→ 需要 nameFields
- JCustomProgress/JProgress/JListProgress/JRoundProgress（Progress 类）→ 需要 nameFields

### ⚠️ isGroup 图表必须设置 typeFields（来自 constant.ts chartConfig）

typeFields 的显示条件（FieldConfig.vue 第 217 行）：
```
v-if="(valueFields.length < 2 && isGroup && !onlyValueChart) || chartObj.component == 'JPivotTable'"
```

**isGroup=true 的完整组件列表（必须设置 typeFields）：**

| 分类 | 组件 |
|------|------|
| Bar | JStackBar、JMultipleBar、JNegativeBar、JMixLineBar、JPercentBar |
| Line | JMultipleLine |
| Radar | JRadar、JCircleRadar |
| Scatter | JBubble、JQuadrant |
| Table | JPivotTable |
| threeD | JBarGroup3d |
| Line（特殊）| DoubleLineBar（特殊处理，见下） |

**规则**：当 valueFields 只有1个时，isGroup 图表显示 typeFields 区域。若有2个以上 valueFields，typeFields 区域隐藏。批量生成时用单 valueField，所以一律设置 typeFields。

### ⚠️ DoubleLineBar 双轴图特殊字段结构

双轴图切换时前端会清空 nameFields，结构与其他图表完全不同：

```python
# DoubleLineBar 正确字段配置
cfg_double = {
    'nameFields':       [],                      # 必须为空！切换时前端清空
    'valueFields':      [VALUE_FIELD.copy()],    # 主 Y 轴数值
    'typeFields':       [NAME_FIELD.copy()],     # 主分组（维度作分组）
    'assistYFields':    [VALUE_FIELD.copy()],    # 辅助 Y 轴（FieldConfig.vue 第176行：v-if="component == 'DoubleLineBar'"）
    'assistTypeFields': [NAME_FIELD.copy()],     # 辅助分组（第292行：v-if="assistYFields.length < 2 && subclass == 'DoubleLineBar'"）
}
```

### ⚠️ record_count 字段的 fieldType 必须是 'count'，不能是 'int'（2026-04-09 实测）

**错误现象**：图表报错 `SQL: SELECT sum(*) record_count ... `，`SUM(*)` 语法非法。

**根本原因**：`record_count` 是系统虚拟字段，不是数据库真实列。后端根据 `fieldType` 决定聚合函数：
- `fieldType: 'count'` → 生成 `COUNT(*) as record_count` ✅
- `fieldType: 'int'` / `'double'` / `'String'` → 生成 `SUM(record_count)` → 展开为 `SUM(*)` → SQL 报错 ❌

**正确写法（强制）：**
```python
# ✅ 正确
RECORD_COUNT_FIELD = {
    'fieldName': 'record_count',
    'fieldTxt':  '记录数量',
    'fieldType': 'count',    # ← 必须是 'count'，不能是 'int'/'String'/'double'
    'widgetType': 'count',
    'dictCode': '',
}

# ❌ 错误（会生成 SUM(*) 报错）
# {'fieldName': 'record_count', 'fieldType': 'int', ...}
```

**规则**：凡是把 `record_count` 放进 `valueFields` / `nameFields` / `typeFields` 的场景，`fieldType` 必须是 `'count'`。

---

### Online 表单图表字段配置速查表（全量）

```python
# 完整的字段配置逻辑（直接复制使用）

IS_GROUP = {
    'JStackBar', 'JMultipleBar', 'JNegativeBar', 'JMixLineBar', 'JPercentBar',
    'JMultipleLine', 'DoubleLineBar',
    'JRadar', 'JCircleRadar',
    'JBubble', 'JQuadrant',
    'JPivotTable',
    'JBarGroup3d',
}

# category in ['Gauge','Number'] 或 subclass in ['JTotalProgress','JLiquid']
ONLY_VALUE_COMPS = {
    'JGauge', 'JColorGauge', 'JAntvGauge', 'JSemiGauge',    # Gauge
    'JNumber', 'JCountTo', 'JColorBlock', 'JStatsSummary', 'JOrbitRing',  # Number
    'JTotalProgress', 'JLiquid',                              # 特殊 subclass
}

def get_fields(comp_type, NAME_FIELD, VALUE_FIELD):
    if comp_type == 'DoubleLineBar':
        return dict(nameFields=[], valueFields=[VALUE_FIELD], typeFields=[NAME_FIELD],
                    assistYFields=[VALUE_FIELD], assistTypeFields=[NAME_FIELD])
    elif comp_type in ONLY_VALUE_COMPS:
        return dict(nameFields=[], valueFields=[VALUE_FIELD], typeFields=[],
                    assistYFields=[], assistTypeFields=[])
    elif comp_type in IS_GROUP:
        return dict(nameFields=[NAME_FIELD], valueFields=[VALUE_FIELD], typeFields=[NAME_FIELD],
                    assistYFields=[], assistTypeFields=[])
    else:
        return dict(nameFields=[NAME_FIELD], valueFields=[VALUE_FIELD], typeFields=[],
                    assistYFields=[], assistTypeFields=[])
```

---

## ⚠️ comp_ops.py delete 报成功但实际未删除（已修复 2026-04-08）

**现象**：`comp_ops.py delete --name "XXX"` 输出"删除成功"，但刷新大屏后组件仍存在。

**根因（已定位）**：`bi_utils.save_page` 第 303 行的 `if not components:` 是罪魁祸首：删除所有组件后 `_page_components[page_id] = []`，而 `if not []:` 为 True，导致 `save_page` 从服务端重新拉取旧模板并覆盖，等效于删除从未发生。（次要问题：save_page 内部额外调一次 `query_page` 增加延迟；payload 未含 `desJson` 可能导致页面宽高丢失。）

**已修复**（`bi_utils.py`，2026-04-08）：
- `if not components:` → `if page_id not in _page_components:`（区分"主动清空"与"未设置"）
- 移除 `save_page` 内部的多余 `query_page` 调用，节省 1 次 API 往返
- `query_page` 同步缓存 `desJson`；`save_page` payload 新增 `desJson` 字段回传

**当前版本 `comp_ops.py delete/edit/move` 均可直接使用，无需自定义脚本。**

历史应急方案（升级后不再需要，留档备查）：删除组件时用自定义脚本，一次 `queryById` 取到最新 `updateCount`，直接调 `edit` 保存：

```python
import json
import bi_utils

bi_utils.API_BASE = 'http://...'
bi_utils.TOKEN = '...'
PAGE_ID = '...'

# 1. 一次性获取完整页面实体（含 updateCount）
raw = bi_utils._request('GET', '/drag/page/queryById', params={'id': PAGE_ID})
page_entity = (raw.get('result') or {})
update_count = page_entity.get('updateCount', 1)

# 2. 解析 template
tmpl_raw = page_entity.get('template') or '[]'
tmpl = json.loads(tmpl_raw) if isinstance(tmpl_raw, str) else (tmpl_raw or [])

# 3. 按 componentName 删除
target_name = '目标组件名'
tmpl = [c for c in tmpl if c.get('componentName') != target_name]

# 4. 直接调 edit 保存（使用同一次 queryById 拿到的 updateCount，无二次请求）
payload = {
    'id': PAGE_ID,
    'name': page_entity.get('name', ''),
    'template': json.dumps(tmpl, ensure_ascii=False),
    'updateCount': update_count,
    'style': page_entity.get('style', 'bigScreen'),
    'theme': page_entity.get('theme', 'dark'),
    'backgroundImage': page_entity.get('backgroundImage', ''),
    'designType': page_entity.get('designType', 100),
    'desJson': page_entity.get('desJson', ''),
}
bi_utils._request('POST', '/drag/page/edit', data=payload)
```

## 自定义脚本文件写入踩坑（2026-04-09 新增）

> 当需要在工作流中动态写入 Python 脚本文件时，常见以下问题。

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| **⚠️ bash heredoc `<< 'EOF'` 在 Python 内容含单引号时必定失败** | 单引号定界的 heredoc 中不能有 `'`（单引号），而 Python 代码大量使用单引号字符串，导致 heredoc 被截断报 `unexpected EOF` | **必须用 `Write` 工具写脚本文件**，彻底避免 bash heredoc。流程：`Read` 目标文件（不存在也要 Read，拿到"不存在"错误即可）→ `Write` 写入完整内容。全程不经过 bash，无转义问题 |
| **⚠️ `Write` 工具写新文件前必须先 `Read`** | Claude 工具系统要求"对任何文件写入前需先读取"，包括不存在的文件。直接调 `Write` 报 `File has not been read yet` | 先 `Read` 目标路径（即使文件不存在或为空），再 `Write` 覆盖写入 |
| **⚠️ 通过 `py -c` / bash 生成的 Python 文件中，`b"\r\n"` 被写为实际 CR+LF 字节** | bash 中外层 Python 字符串的 `\\r\\n` 被解析为 `\r`（0x0D）+`\n`（0x0A）实际字节，写入目标文件后 Python 解释器遇到第一个 `\r` 就认为行结束，报 `SyntaxError: unterminated string literal` | 在 Python 脚本中**永远不要写 `b"\r\n"`**，改用 `bytes([13, 10])`。例如 multipart 编码器的分隔符：`CRLF = bytes([13, 10]); return CRLF.join(parts)` |
| **⚠️ `py -` stdin 方式导致 `import bi_utils` 失败** | `py -` 从 stdin 读取时，Python 不会自动将 shell cwd 加入 `sys.path` | 先 Write 脚本文件再 `py script.py`；`py script.py` 模式下 Python 自动处理路径，无需 `sys.path.insert` |

**最优写脚本流程（无任何 bash 转义问题）：**

```
轮次1：Read 目标脚本路径（获取读取权限，文件不存在时也需执行）
轮次2：Write 工具直接写入完整 Python 内容（支持所有字符，无转义限制）
轮次3：Bash: cp bi_utils.py + ls验证 + py 执行 + rm 清理（一条命令链）
```

**注意**：Write 工具写入文件时无需转义单引号、双引号、反斜杠、`\r\n` 等特殊字符，是写 Python 脚本的唯一可靠方式。

## 自写Java接口场景踩坑（2026-04-10 新增）

### 大型Controller文件读取策略

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| **⚠️ 直接 Read 大型Controller文件分4-5段，浪费~4轮+18s** | 文件超10000 token上限，Read失败后不得不分段：失败→offset=1→offset=80→offset=200→offset=300→Grep→offset=710，共7次工具调用 | **先1次Grep定位插入点，再1次定向Read目标区域**。典型命令：`Grep "readJson\|private\|^}" controller.java`（找到结尾行号），然后 `Read offset=结尾-30 limit=30`（只读末尾30行）。合计2次调用，无分段 |
| **⚠️ 读取pitfalls.md对"自写接口"场景是多余的** | SKILL.md主文档已内联关键规则（`@JimuNoLoginRequired`、`String`返回裸数组、`try/except`包裹getAllChartData），跑到pitfalls.md又读100行 | 自写接口场景**直接按SKILL.md内联规则执行**，无需读pitfalls.md，省1轮+5s |

**正确的大型Controller文件操作流程（2轮）：**
```
轮次1（并行）: Read凭据 + Grep controller文件关键词（如 readJson/private/^}）
轮次2: Read controller末尾N行（基于Grep结果定向）+ Edit插入新方法（依赖轮次1结果则串行）
```

### dataset_ops.py create-api 必填参数

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| **⚠️ `dataset_ops.py create-api` 缺 `--code` 报错，浪费1轮** | `--code`（数据集唯一编码）是必填参数，首次调用遗漏直接报 `error: the following arguments are required: --code` | 每次写 `create-api` 命令时，必须同时传 `--name`、`--code`、`--url`、`--fields` 四个必填参数。`--code` 建议用下划线小写英文（如 `jd_product_sales_2025`） |

**同样适用于**：任何使用 `bi_utils.save_page()` 后发现保存未生效的场景（组件编辑、位移等），都应改用此模式。

---

## comp_ops.py / py -c 常见误用（2026-04-24 实测）

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| **⚠️ `comp_ops.py list` 当成"查页面列表"调用，报 `page_id required`** | `comp_ops.py list` 是查**某页面内的组件列表**，`page_id` 是必填参数；查所有页面应调 `/drag/page/list` API | 查页面列表：`bi_utils._request('GET', '/drag/page/list', params={'pageNo':1,'pageSize':50,'style':'default'})`；查某页面组件：`comp_ops.py list API_BASE TOKEN PAGE_ID` |
| **⚠️ `py -c "sys.path.insert(0, '$HOME/...')"` 报 `ModuleNotFoundError: No module named 'bi_utils'`** | Git Bash 将 `$HOME` 展开为 Unix 格式路径（`/c/Users/25067/...`），Windows Python 无法识别该路径，`sys.path.insert` 实际无效 | 改用 `PYTHONPATH` 环境变量让系统自动处理路径转换：`SKILL_REFS="$HOME/.claude/skills/jimubi-dashboard/references"; PYTHONIOENCODING=utf-8 PYTHONPATH="$SKILL_REFS:$SKILL_REFS/scripts" py -c "import bi_utils; ..."` |

---

## Online 表单 / 设计器表单图表渲染异常（2026-04-10 实测）

以下 4 个组件在 online 表单或设计器表单模式（dataType=4）下有特殊 option/字段结构，使用通用模板会导致渲染异常。

| 组件 | 问题 | 正确做法 |
|------|------|---------|
| **⚠️ JFunnel（基础漏斗图）** | 错误地使用 yAxis/xAxis 的通用 base_option → 渲染完全异常，漏斗消失 | 必须使用漏斗专属 option：`reversal`/`legend`/funnel `series`（含 `type:'funnel'`, `sort:'descending'`, `label`, `labelLine`, `itemStyle`, `emphasis`），`tooltip.trigger='item'`，`formatter='{a} <br/>{b} : {c}%'`。**绝对不能有 yAxis/xAxis** |
| **⚠️ JPyramidFunnel（金字塔漏斗图）** | 同 JFunnel，错误注入 yAxis/xAxis | 同上，但 `series[0].sort='ascending'`（从小到大，呈金字塔形） |
| **⚠️ JRing（基础环形图）** | `option.series:[]`（空数组）→ ECharts 无法识别环形图，渲染空白 | series 必须预填充完整环形配置：`[{type:'pie', radius:['40%','70%'], avoidLabelOverlap:False, label:{show:False, position:'center'}, labelLine:{show:False}, emphasis:{label:{show:True, fontSize:14, fontWeight:'bold'}}, data:[]}]`，**不能留空 []** |
| **⚠️ DoubleLineBar（双轴图）** | ①`nameFields:[]`（维度字段缺失）→ X 轴无法渲染；②缺少 `seriesType` 字段 → 系列类型无法识别 | nameFields 必须含维度字段（name/category 类字段）；必须设置 `seriesType:[]`（即使为空数组，不能完全缺失字段）；assistYFields 必须与 valueFields 相同；assistTypeFields 必须与 typeFields 相同 |

### DoubleLineBar Online 表单完整字段结构

```python
# ✅ 正确：DoubleLineBar 在 online 表单模式下的字段结构
{
    'nameFields':       [NAME_FIELD],        # ✅ 维度字段（X 轴），不能为空 []
    'valueFields':      [VALUE_FIELD],       # 主 Y 轴数值
    'typeFields':       [TYPE_FIELD],        # 分组字段（如 sex, status）
    'assistYFields':    [VALUE_FIELD],       # ✅ 必须与 valueFields 相同，不能为 []
    'assistTypeFields': [TYPE_FIELD],        # ✅ 必须与 typeFields 相同，不能为 []
    'seriesType':       [],                  # ✅ 必须有此字段（空数组即可，但不能完全缺失）
}
# ❌ 错误写法（skill 曾生成）：nameFields:[], seriesType 字段完全缺失
```

### JRing option 正确结构

```python
# ✅ JRing online 表单 option 正确结构
{
    'grid': {'top': 50, 'left': 50, 'show': False},
    'series': [{
        'data': [], 'name': 'Access From',
        'avoidLabelOverlap': False,
        'emphasis': {'label': {'show': True, 'fontSize': 14, 'fontWeight': 'bold'}},
        'label': {'show': False, 'position': 'center'},
        'labelLine': {'show': False},
        'type': 'pie',
        'radius': ['40%', '70%']   # ✅ 关键：环形图必须有 radius，不能为空 series
    }],
    'tooltip': {'trigger': 'item', 'textStyle': {'color': '#EEF1FA'}},
    'title': {'textAlign': 'left', 'show': True, 'text': '', 'textStyle': {'fontWeight': 'normal'}},
    'card': {'rightHref': '', 'size': 'default', 'extra': '', 'title': ''}
}
```

### JFunnel / JPyramidFunnel option 正确结构

```python
# ✅ JFunnel online 表单 option 正确结构（JPyramidFunnel 将 sort 改为 'ascending'）
{
    'reversal': False,
    'legend': {'orient': 'horizontal'},
    'grid': {'bottom': 115},
    'series': [{
        'type': 'funnel', 'left': '10%', 'right': '10%', 'bottom': '5%', 'gap': 2,
        'name': 'Funnel', 'sort': 'descending',  # JPyramidFunnel 用 'ascending'
        'label': {'show': True, 'position': 'inside'},
        'labelLine': {'lineStyle': {'width': 1, 'type': 'solid'}, 'length': 10},
        'itemStyle': {'borderColor': '#fff', 'borderWidth': 1},
        'emphasis': {'label': {'fontSize': 20}}
    }],
    'tooltip': {'formatter': '{a} <br/>{b} : {c}%', 'trigger': 'item', 'textStyle': {'color': '#EEF1FA'}},
    'title': {'textAlign': 'left', 'show': True, 'text': '', 'textStyle': {'fontWeight': 'normal'}},
    'card': {'rightHref': '', 'size': 'default', 'extra': '', 'title': ''}
    # ❌ 绝对不能有 yAxis / xAxis / axisPointer 等坐标轴字段
}

---

## JSelectRadio 选项卡：按 componentName 匹配组件时 Unicode 转义极易出错

**场景**：编写自定义脚本，通过 `componentName` 匹配特定组件（如"折柱图"）来获取其 `i` 字段，
用于填充 `compShowConfig.compVals`。

**踩坑过程（2026-04-10 实测）**：

```python
# ❌ 错误写法：手写 Unicode 转义，\u6f31 是"漱"，不是"柱"(\u67f1)
mix_id = next((c['i'] for c in tmpl if c.get('componentName') == '\u6298\u6f31\u56fe'), None)
# 结果：mix_id = None，assert 报错，脚本中断
```

输出显示 `componentName='折漱图' ID: None`，名称渲染出来才能看出写错了，
但程序已经崩溃，需要额外一轮修复。

**根因**：中文字符的 Unicode 码位极难手记，`柱=\u67f1` 与 `漱=\u6f31` 仅差一个十六进制位，
在代码编辑时肉眼几乎无法区分。

**正确做法（强制选择其中一种）**：

```python
# ✅ 方案1：按 component 字段（Vue 组件类型名）匹配，不依赖中文名
mix_id    = next((c['i'] for c in tmpl if c.get('component') == 'JMixLineBar'), None)
other_ids = [c['i'] for c in tmpl if c.get('component') != 'JMixLineBar']

# ✅ 方案2：直接写中文字面量（文件头必须有 # -*- coding: utf-8 -*-，执行时 PYTHONIOENCODING=utf-8）
mix_id    = next((c['i'] for c in tmpl if c.get('componentName') == '折柱图'), None)
```

**优先使用方案1**：`component` 是固定的英文 compType，不会因中文渲染问题出错，
且与 `comp_ops.py list` 输出的"类型"列直接对应（列出后复制即可）。

**规律**：凡需要按名称查找组件时，优先按 `component`（compType）匹配，
仅在同类型有多个组件需区分时才用 `componentName`（中文名），且必须直接写字面量而非 Unicode 转义。

---

## 弹窗场景：bi_utils.save_page + query_page 可能返回空 template 导致覆盖已有组件

**场景**：添加弹窗（JText + JGroup）时，调用 `bi_utils.query_page` 取已有组件，
追加新组件后调 `bi_utils.save_page` 保存。

**踩坑过程（2026-04-10 实测）**：

```python
page = bi_utils.query_page(PAGE_ID)
tmpl = page.get('template', [])        # ← 实测返回 []，即使页面有 8 个组件
new_tmpl = [text_comp, group_comp] + tmpl  # 结果只有 2 个
bi_utils._page_components[PAGE_ID] = new_tmpl
bi_utils.save_page(PAGE_ID)            # ← 保存了 2 个组件，覆盖掉原有的 8 个
```

输出：`[bi_utils] 页面保存成功: 测试组件 (2 个组件)` — 已有 8 个地图组件全部丢失。

**根因**：`bi_utils.query_page` 在某些情况下（如页面 template 通过直接 `_request edit` 保存而
非 `save_page` 时）返回空 template，原因尚未完全定位。

**强制修复方案（弹窗及所有"追加到已有组件"场景）：**

```python
# ✅ 正确：直接调 queryById + edit，完全绕过 save_page，避免缓存污染
raw = bi_utils._request('GET', '/drag/page/queryById', params={'id': PAGE_ID})
p   = (raw.get('result') or {})
tmpl_raw = p.get('template')
existing = json.loads(tmpl_raw) if isinstance(tmpl_raw, str) and tmpl_raw else (tmpl_raw or [])
print(f"现有组件: {len(existing)} 个")  # 验证：应与实际数量一致

# 构建新模板
new_template = [text_comp, group_comp] + existing   # 或其他顺序

# 直接 edit 保存（传 updateCount 避免乐观锁失败）
bi_utils._request('POST', '/drag/page/edit', data={
    'id': PAGE_ID,
    'name': p.get('name', ''),
    'template': json.dumps(new_template, ensure_ascii=False),
    'updateCount': p.get('updateCount', 1),
    'style': p.get('style', 'bigScreen'),
    'theme': p.get('theme', 'dark'),
    'backgroundImage': p.get('backgroundImage', ''),
    'designType': p.get('designType', 100),
    'desJson': json.dumps(des, ensure_ascii=False),
})
```

**适用场景**：所有需要在已有组件基础上新增组件的自定义脚本（弹窗、选项卡、连线等），
均应使用 `queryById + edit` 代替 `query_page + save_page`，除非能确认 template 读取正确。

---

## 联动（Linkage）完整端到端配置（2026-04-24 验证）

> 适用场景：创建两个 SQL 数据集图表，点击源图表某项 → 目标图表按该值过滤刷新。

### 三要素清单（缺一不可）

| 要素 | 位置 | 说明 |
|------|------|------|
| ① FreeMarker SQL | 目标数据集 `querySql` | 含 `<#if isNotEmpty(param)>AND col='${param}'</#if>` 条件 |
| ② datasetParamList | 目标数据集创建时 `datasetParamList` | 声明参数名、类型，否则 FreeMarker 不被执行 |
| ③ paramOption | 目标图表 `config.paramOption` | 联动触发时前端将值注入此处，缺少则值无法传入 SQL |

以及联动 UI 正确显示映射字段：
| 要素 | 位置 | 说明 |
|------|------|------|
| ④ fieldOption 格式 | 源图表 `config.fieldOption` | 必须用 `{value, label, text, show:'Y', type}` 格式，否则联动设置弹窗映射字段列为空 |

### 完整工作流脚本模板（已验证可用）

```python
import sys, os, json, time, random, copy
sys.path.insert(0, os.path.join(os.path.expanduser('~'), '.claude', 'skills', 'jimubi-dashboard', 'references'))
sys.path.insert(0, os.path.join(os.path.expanduser('~'), '.claude', 'skills', 'jimubi-dashboard', 'references', 'scripts'))
import bi_utils

API_BASE  = '<api_base>'
TOKEN     = '<token>'
PAGE_ID   = '<page_id>'
DB_SOURCE = '<datasource_id>'

bi_utils.API_BASE = API_BASE
bi_utils.TOKEN    = TOKEN

def _key():
    return f'{int(time.time()*1000)}_{random.randint(100000,999999)}'

# Step 1: 缓存已有组件（必须！防止 save_page 覆盖）
page = bi_utils.query_page(PAGE_ID)
tmpl = page.get('template') or []
if isinstance(tmpl, str): tmpl = json.loads(tmpl)

# Step 2: 获取/创建「示例数据集」分组
groups = (bi_utils._request('GET', '/drag/onlDragDatasetHead/getAllGroup').get('result') or [])
parent_id = next((g['id'] for g in groups
                  if g.get('name') == '示例数据集' and g.get('dataType') is None), '0')
if parent_id == '0':
    bi_utils._request('POST', '/drag/onlDragDatasetHead/addGroup', data={'groupName': '示例数据集'})
    groups = (bi_utils._request('GET', '/drag/onlDragDatasetHead/getAllGroup').get('result') or [])
    parent_id = next((g['id'] for g in groups
                      if g.get('name') == '示例数据集' and g.get('dataType') is None), '0')

# Step 3: 创建联动源数据集（柱形图，简单 GROUP BY，无 FreeMarker）
# ⚠️ 禁止用 IFNULL/COALESCE，改用 WHERE col IS NOT NULL 过滤空值
SQL_SOURCE = (
    "SELECT dim_col AS name, COUNT(*) AS value "
    "FROM your_table WHERE del_flag=0 AND dim_col IS NOT NULL "
    "GROUP BY dim_col ORDER BY value DESC"
)
src_ds = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={
    'name': '源数据集名称', 'code': f'src_ds_{int(time.time())}',
    'dataType': 'sql', 'dbSource': DB_SOURCE,
    'querySql': SQL_SOURCE, 'apiMethod': 'GET', 'parentId': parent_id,
    'datasetItemList': [
        {'fieldName': 'name',  'fieldTxt': '维度', 'fieldType': 'String',  'izShow': 'Y', 'orderNum': 0},
        {'fieldName': 'value', 'fieldTxt': '数值', 'fieldType': 'Integer', 'izShow': 'Y', 'orderNum': 1},
    ],
    'datasetParamList': []   # 源数据集无需参数
})
SRC_DS_ID = (src_ds.get('result') or {}).get('id')

# Step 4: 创建联动目标数据集（饼图，含 FreeMarker 条件 + datasetParamList）
# 三要素之 ① + ②
SQL_TARGET = (
    "SELECT sub_col AS name, COUNT(*) AS value "
    "FROM your_table WHERE del_flag=0 AND sub_col IS NOT NULL "
    "<#if isNotEmpty(name)>AND dim_col='${name}'</#if> "   # ① FreeMarker 条件
    "GROUP BY sub_col ORDER BY value DESC"
)
tgt_ds = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={
    'name': '目标数据集名称', 'code': f'tgt_ds_{int(time.time())}',
    'dataType': 'sql', 'dbSource': DB_SOURCE,
    'querySql': SQL_TARGET, 'apiMethod': 'GET', 'parentId': parent_id,
    'datasetItemList': [
        {'fieldName': 'name',  'fieldTxt': '维度', 'fieldType': 'String',  'izShow': 'Y', 'orderNum': 0},
        {'fieldName': 'value', 'fieldTxt': '数值', 'fieldType': 'Integer', 'izShow': 'Y', 'orderNum': 1},
    ],
    'datasetParamList': [   # ② 声明 FreeMarker 参数
        {'paramName': 'name', 'paramTxt': '过滤值', 'paramType': 'String',
         'defaultValue': '', 'izNotNull': 'N', 'orderNum': 0}
    ]
})
TGT_DS_ID = (tgt_ds.get('result') or {}).get('id')

# Step 5: 加载默认配置
cfg_path = os.path.join(os.path.expanduser('~'), '.claude', 'skills', 'jimubi-dashboard',
                        'references', 'scripts', 'default_configs.json')
with open(cfg_path, encoding='utf-8') as f:
    defaults = json.load(f)

# Step 6: 构建源图表 config
# 三要素之 ④ fieldOption 必须用 {value,label,text,show,type} 格式
SRC_FIELD_OPTION = [
    {'value': 'name',  'label': '维度', 'text': '维度', 'show': 'Y', 'type': 'String'},
    {'value': 'value', 'label': '数值', 'text': '数值', 'show': 'Y', 'type': 'Integer'},
]
src_cfg = copy.deepcopy(defaults.get('JBar', {}))
src_cfg.update({
    'dataType': 2, 'dataSetId': SRC_DS_ID, 'dataSetName': '源数据集名称',
    'dataSetType': 'sql', 'dataSetApi': SQL_SOURCE, 'dataSetMethod': 'GET', 'dataSetIzAgent': '',
    'dataMapping': [{'filed': '维度', 'mapping': 'name'}, {'filed': '数值', 'mapping': 'value'}],
    'fieldOption': SRC_FIELD_OPTION,   # ④ 正确格式
    'dictOptions': {}, 'paramOption': [], 'chartData': '[]',
})
src_cfg.setdefault('option', {})['title'] = {'show': True, 'text': '源图表标题（点击联动）'}
src_cfg['option'].setdefault('card', {})['title'] = ''

# Step 7: 构建目标图表 config
# 三要素之 ③ paramOption
TGT_FIELD_OPTION = [
    {'value': 'name',  'label': '维度', 'text': '维度', 'show': 'Y', 'type': 'String'},
    {'value': 'value', 'label': '数值', 'text': '数值', 'show': 'Y', 'type': 'Integer'},
]
tgt_cfg = copy.deepcopy(defaults.get('JPie', {}))
tgt_cfg.update({
    'dataType': 2, 'dataSetId': TGT_DS_ID, 'dataSetName': '目标数据集名称',
    'dataSetType': 'sql', 'dataSetApi': SQL_TARGET, 'dataSetMethod': 'GET', 'dataSetIzAgent': '',
    'dataMapping': [{'filed': '维度', 'mapping': 'name'}, {'filed': '数值', 'mapping': 'value'}],
    'fieldOption': TGT_FIELD_OPTION,
    'dictOptions': {},
    'paramOption': [   # ③ 联动注入点，paramName 必须与 FreeMarker 参数名一致
        {'paramName': 'name', 'paramTxt': '过滤值', 'paramType': 'String', 'paramValue': ''}
    ],
    'chartData': '[]',
})
tgt_cfg.setdefault('option', {})['title'] = {'show': True, 'text': '目标图表标题'}
tgt_cfg['option'].setdefault('card', {})['title'] = ''

# Step 8: 添加组件到页面
max_y = max((c.get('y', 0) + c.get('h', 0) for c in tmpl), default=0)
SRC_NAME = '联动源柱形图'
TGT_NAME = '联动目标饼图'

tmpl.append({'component': 'JBar', 'componentName': SRC_NAME, 'visible': True,
             'i': _key(), 'x': 0,  'y': max_y, 'w': 12, 'h': 35,
             'orderNum': (len(tmpl)+1)*10, 'config': src_cfg})
tmpl.append({'component': 'JPie', 'componentName': TGT_NAME, 'visible': True,
             'i': _key(), 'x': 12, 'y': max_y, 'w': 12, 'h': 35,
             'orderNum': (len(tmpl)+2)*10, 'config': tgt_cfg})

bi_utils._page_components[PAGE_ID] = tmpl
bi_utils.save_page(PAGE_ID)
print('组件已添加，正在配置联动...')
```

然后用 `linkage_ops.py` 添加联动（mapping 中 src=源图表字段名, tgt=目标数据集 FreeMarker 参数名）：

```bash
SKILL_REFS="$HOME/.claude/skills/jimubi-dashboard/references"
PYTHONIOENCODING=utf-8 PYTHONPATH="$SKILL_REFS:$SKILL_REFS/scripts" py "$SKILL_REFS/scripts/linkage_ops.py" add-linkage \
  $API_BASE $TOKEN $PAGE_ID \
  --source "联动源柱形图" --target "联动目标饼图" --mapping "name=name"
```

### SQL 安全规范（联动场景）

| 场景 | 错误写法 | 正确写法 |
|------|---------|---------|
| 处理 NULL 维度值 | `SELECT IFNULL(col,'default') AS name` | `SELECT col AS name ... WHERE col IS NOT NULL` |
| 处理 NULL 维度值 | `SELECT COALESCE(col,'x') AS name` | `SELECT col AS name ... WHERE col IS NOT NULL` |
| GROUP BY | `SELECT x AS name ... GROUP BY name` | `SELECT x AS name ... GROUP BY x`（用原表达式） |
| FreeMarker 条件 | `WHERE col='${name}'`（无判空） | `<#if isNotEmpty(name)>AND col='${name}'</#if>` |

---

## 钻取（Drill-Down）完整配置指南

> 验证日期：2026-04-24；数据类型：dataType=2（SQL 数据集）

### 钻取工作原理

用户点击图表（如柱子） → ECharts 触发点击事件，`params.name` = X 轴标签值 →
前端读取 `config.drillData` 找到 `source=name` 的映射 → 把 `params.name` 赋给 `target` 指定的 SQL 参数 →
重新调用数据集查询（带参数）→ 图表刷新，左上角出现回退按钮 ↩

### drillData 正确格式（必须写入 config 顶层）

```python
"drillData": [{"source": "name", "target": "name"}]
# source = ECharts 点击事件 params 的字段名（通常是 "name"）
# target = SQL FreeMarker 参数名（与 <#if isNotEmpty(target)> 中的名称一致）
```

### fieldOption 必须用前端 DataSource.vue 格式

```python
# ✅ 正确（前端 EventConfig.vue 第134行：field.value == item.mapping）
"fieldOption": [
    {"value": "name",  "label": "名称", "text": "名称", "show": "Y", "type": "String"},
    {"value": "value", "label": "数量", "text": "数量", "show": "Y", "type": "String"}
]

# ❌ 错误（后端字段格式，前端读不到 value 键 → 钻取配置"原始"下拉为空）
"fieldOption": [
    {"fieldName": "name", "fieldTxt": "名称", "fieldType": "String"}
]
```

### SQL FreeMarker 模板（两级钻取示例）

```sql
SELECT
<#if isNotEmpty(name)>
  -- 有参数时：下钻到明细维度（如男女分布）
  CASE sex WHEN '1' THEN '男' WHEN '2' THEN '女' ELSE '未知' END AS name,
<#else>
  -- 无参数时：顶层汇总（如年龄段）
  age AS name,
</#if>
COUNT(*) AS value
FROM demo
WHERE sex IS NOT NULL AND sex != ''
<#if isNotEmpty(name)>
AND age = '${name}'
</#if>
GROUP BY
<#if isNotEmpty(name)>
sex
<#else>
age
</#if>
ORDER BY value DESC
LIMIT 8
```

### 可钻取图表的完整 config 结构（对标前端参考 JSON）

```python
correct_config = {
    "w": 12, "h": 35,
    "dataType": 2,
    "timeOut": 0,
    "turnConfig": {"url": ""},
    "linkageConfig": [],
    "dataMapping": [
        {"filed": "维度", "mapping": "name"},
        {"filed": "数值", "mapping": "value"}
    ],
    "chartData": "[]",
    "option": {
        "grid": {"show": False, "top": 90, "bottom": 115, "containLabel": True},
        "card": {"title": "", "extra": "", "rightHref": "", "size": "default"},
        "title": {"text": "图表标题", "show": True, "textStyle": {"fontWeight": "normal"}},
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "yAxis": {"yUnit": "", "splitLine": {"interval": 2}},
        "series": [{"data": [], "type": "bar", "barWidth": 40,
                    "itemStyle": {"color": "#64b5f6", "borderRadius": 0}}]
    },
    "size": {"height": 385},
    "background": "#FFFFFF",
    "borderColor": "#FFFFFF",
    "viewLoading": True,
    "dataSetId": "<DS_ID>",
    "dataSetName": "<数据集名>",
    "dataSetIzAgent": None,          # ← null，不是 ""
    "dataSetApi": "<SQL>",
    "dataSetType": "sql",
    "dataSetMethod": "GET",
    "seriesType": [],
    "fieldOption": [                  # ← 必须用 value/label/text/show/type 格式
        {"value": "name",  "label": "name",  "text": "name",  "show": "Y", "type": "String"},
        {"value": "value", "label": "value", "text": "value", "show": "Y", "type": "String"}
    ],
    "paramOption": [],               # ← 空数组，不要放 FreeMarker 参数对象
    "query": [],
    "drillData": [                   # ← 钻取映射，必须在此处
        {"source": "name", "target": "name"}
    ],
    "dictOptions": {},
    "actionConfig": {"modalName": "", "url": "", "operateType": "modal"}
}
```

### 完整端到端脚本（创建数据集 + 绑定图表 + 配置钻取，一次保存）

```python
# -*- coding: utf-8 -*-
import sys, os, json, time, random, hashlib, urllib.request

sys.path.insert(0, os.path.join(os.path.expanduser('~'), '.claude', 'skills', 'jimubi-dashboard', 'references'))
sys.path.insert(0, os.path.join(os.path.expanduser('~'), '.claude', 'skills', 'jimubi-dashboard', 'references', 'scripts'))
import bi_utils

API_BASE  = '<api_base>'
TOKEN     = '<token>'
PAGE_ID   = '<page_id>'
DB_SOURCE = '<datasource_id>'
SECRET    = 'dd05f1c54d63749eda95f9fa6d49v442a'

bi_utils.API_BASE = API_BASE
bi_utils.TOKEN    = TOKEN

# Step 1: 缓存已有组件
page = bi_utils.query_page(PAGE_ID)
tmpl = page.get('template') or []
if isinstance(tmpl, str): tmpl = json.loads(tmpl)
bi_utils._page_components[PAGE_ID] = tmpl

# Step 2: 获取/创建「示例数据集」分组
groups = (bi_utils._request('GET', '/drag/onlDragDatasetHead/getAllGroup').get('result') or [])
parent_id = next((g['id'] for g in groups if g.get('name') == '示例数据集' and g.get('dataType') is None), '0')
if parent_id == '0':
    bi_utils._request('POST', '/drag/onlDragDatasetHead/addGroup', data={'groupName': '示例数据集'})
    groups = (bi_utils._request('GET', '/drag/onlDragDatasetHead/getAllGroup').get('result') or [])
    parent_id = next((g['id'] for g in groups if g.get('name') == '示例数据集' and g.get('dataType') is None), '0')

# Step 3: 创建 FreeMarker SQL 数据集（两级钻取）
SQL = """SELECT
<#if isNotEmpty(name)>
  CASE sex WHEN '1' THEN '男' WHEN '2' THEN '女' ELSE '未知' END AS name,
<#else>
  age AS name,
</#if>
COUNT(*) AS value
FROM demo
WHERE sex IS NOT NULL AND sex != ''
<#if isNotEmpty(name)>
AND age = '${name}'
</#if>
GROUP BY
<#if isNotEmpty(name)>
sex
<#else>
age
</#if>
ORDER BY value DESC
LIMIT 8"""

ds_resp = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={
    'name': '钻取示例-年龄段人数',
    'code': f'drill_age_{int(time.time())}',
    'dataType': 'sql', 'dbSource': DB_SOURCE,
    'querySql': SQL, 'apiMethod': 'GET',
    'parentId': parent_id,
    'datasetItemList': [
        {'fieldName': 'name',  'fieldTxt': '名称', 'fieldType': 'String',  'izShow': 'Y', 'orderNum': 0},
        {'fieldName': 'value', 'fieldTxt': '数量', 'fieldType': 'Integer', 'izShow': 'Y', 'orderNum': 1},
    ],
    'datasetParamList': [{'paramName': 'name', 'paramTxt': '钻取参数', 'paramType': 'String', 'paramValue': ''}],
})
result = ds_resp.get('result', {})
DS_ID = result.get('id') if isinstance(result, dict) else result
                  'fieldType': f.get('fieldType', 'String'), 'izShow': 'Y', 'orderNum': i}
                 for i, f in enumerate(raw)]
if parsed_fields:
    ds_full = bi_utils._request('GET', '/drag/onlDragDatasetHead/queryById', params={'id': DS_ID})
    ds_obj = ds_full.get('result', {}); ds_obj['datasetItemList'] = parsed_fields
    bi_utils._request('POST', '/drag/onlDragDatasetHead/edit', data=ds_obj)

# Step 5: 构建正确格式的完整 config（含 drillData）
# ⚠️ 必须在同一脚本同一次 save_page 中写入，不能分两步
comp_config = {
    "w": 12, "h": 35,
    "dataType": 2, "timeOut": 0,
    "turnConfig": {"url": ""},
    "linkageConfig": [],
    "dataMapping": [{"filed": "维度", "mapping": "name"}, {"filed": "数值", "mapping": "value"}],
    "chartData": "[]",
    "option": {
        "grid": {"show": False, "top": 90, "bottom": 115, "containLabel": True},
        "card": {"title": "", "extra": "", "rightHref": "", "size": "default"},
        "title": {"text": "可钻取基础柱形图", "show": True, "textStyle": {"fontWeight": "normal"}},
        "tooltip": {"trigger": "axis", "axisPointer": {"type": "shadow"}},
        "yAxis": {"yUnit": "", "splitLine": {"interval": 2}},
        "series": [{"data": [], "type": "bar", "barWidth": 40,
                    "itemStyle": {"color": "#64b5f6", "borderRadius": 0}, "label": {"position": "top"}}]
    },
    "size": {"height": 385},
    "background": "#FFFFFF", "borderColor": "#FFFFFF", "viewLoading": True,
    "dataSetId": DS_ID,
    "dataSetName": "钻取示例-年龄段人数",
    "dataSetIzAgent": None,
    "dataSetApi": SQL,
    "dataSetType": "sql", "dataSetMethod": "GET",
    "seriesType": [],
    # ⚠️ fieldOption 必须用 {value, label, text, show, type}
    "fieldOption": [
        {"value": "name",  "label": "name",  "text": "name",  "show": "Y", "type": "String"},
        {"value": "value", "label": "value", "text": "value", "show": "Y", "type": "String"}
    ],
    "paramOption": [],
    "query": [],
    # ⚠️ drillData 和 config 必须在同一次 save_page 写入
    "drillData": [{"source": "name", "target": "name"}],
    "dictOptions": {},
    "actionConfig": {"modalName": "", "url": "", "operateType": "modal"}
}

# Step 6: 追加组件并保存
import random
max_y = max((c.get('y', 0) + c.get('h', 0) for c in tmpl), default=0)
comp = {
    'component': 'JBar', 'componentName': '可钻取基础柱形图',
    'visible': True, 'i': f'{int(time.time()*1000)}_{random.randint(100000,999999)}',
    'x': 0, 'y': max_y, 'w': 12, 'h': 35,
    'orderNum': len(tmpl) * 10 + 10,
    'config': comp_config
}
tmpl.append(comp)
bi_utils._page_components[PAGE_ID] = tmpl
bi_utils.save_page(PAGE_ID)
print(f'完成！预览: {API_BASE}/drag/page/view/{PAGE_ID}')
```

### 踩坑清单（钻取专项）

| 问题 | 原因 | 解决 |
|------|------|------|
| 钻取配置面板「原始」下拉为空 | fieldOption 用了 `{fieldName}` 而非 `{value}` | 改用 `{value, label, text, show, type}` |
| 钻取配置面板「暂无数据」 | drillData 未写入 config，或被后续 save_page 覆盖 | 在同一次 save_page 中同时写 drillData 和数据集 config |
| 点击柱子无反应 | dataType=1 静态数据无法重查 | 必须用 FreeMarker SQL 数据集 |
| 点击后数据不变 | FreeMarker 参数名与 drillData.target 不一致 | target 必须与 SQL 中 `isNotEmpty(xxx)` 的参数名一致 |
| 分两步写入 drillData 总是丢失 | 第二次 save_page 覆盖 config，drillData 不在新 config 中 | 必须一步完成，dataset + drillData 写在同一个 config，一次 save_page |

---

## singleFile 文件数据集踩坑（2026-05-09 实踩）

### 🚨 后端会按 datasetItemList 字段名重建 SQL，字段名必须是表中真实列名

**现象**：设置 SQL 为 `SELECT bsl_pi_name AS name, count(*) AS cnt FROM table GROUP BY bsl_pi_name`，`datasetItemList` 中字段名写 `name`/`cnt`（SQL别名），保存后前端执行变成 `SELECT name, SUM(cnt) AS cnt FROM table GROUP BY name`，报错 `Column 'name' not found in any table`。

**根本原因**：singleFile（及 FILES）数据集保存时，后端会用 `datasetItemList` 中的 `fieldName` 重建执行 SQL（形如 `SELECT {f1}, SUM({f2}) AS {f2} FROM table GROUP BY {f1}`）。如果 `fieldName` 是 SQL 别名（`name`/`cnt`），这些列在 H2 表中根本不存在，查询必然报错。

**正确做法**：singleFile 数据集的 SQL 必须用真实列名，`datasetItemList` 的 `fieldName` 也必须是真实列名：

```python
# ✅ 正确：SQL 用真实列名，fieldName 也是真实列名
ds['querySql'] = f'select * from {table_name}'
ds['datasetItemList'] = [
    {'fieldName': 'bsl_pi_name', 'fieldTxt': '产品名称', 'fieldType': 'String',  'izShow': 'Y', 'orderNum': 0},
    {'fieldName': 'bsl_amount',  'fieldTxt': '数量',     'fieldType': 'Integer', 'izShow': 'Y', 'orderNum': 1},
]
# dataMapping 也用真实列名
cfg['dataMapping'] = [
    {'filed': '维度', 'mapping': 'bsl_pi_name'},
    {'filed': '数值', 'mapping': 'bsl_amount'},
]

# ❌ 错误：SQL 用别名，fieldName 也用别名
ds['querySql'] = f'select bsl_pi_name as name, count(*) as cnt from {table_name} GROUP BY bsl_pi_name'
ds['datasetItemList'] = [
    {'fieldName': 'name', ...},   # 'name' 不是表中真实列，后端重建 SQL 报错
    {'fieldName': 'cnt',  ...},
]
```

### 🚨 禁止在 singleFile 数据集中使用 count(*) 等无别名聚合函数

**现象**：SQL 用 `select bsl_pi_name, count(*) from table GROUP BY bsl_pi_name`，H2 引擎把 `count(*)` 列命名为 `EXPR$1`，若把 `EXPR$1` 写入 `fieldName`，后端重建 SQL 变成 `SELECT bsl_pi_name, SUM(EXPR$1) AS EXPR$1 FROM table GROUP BY bsl_pi_name`，`EXPR$1` 是 H2 内部名，真实表中不存在，必报错。

**根本原因**：`EXPR$N` 是 H2/Calcite 引擎对无别名表达式的内部列名，不是真实列名，不能作为 `fieldName` 使用。

**正确做法**：singleFile 数据集**禁止 GROUP BY 聚合**。直接 `select *` 取全量数据，由图表前端展示明细行（饼图会按维度字段自动聚合同名值）：

```python
# ✅ 正确：select * 取全量，图表前端自动处理
ds['querySql'] = f'select * from {table_name}'

# ❌ 错误：GROUP BY 导致聚合列变成 EXPR$N
ds['querySql'] = f'select bsl_pi_name, count(*) from {table_name} GROUP BY bsl_pi_name'
```

### singleFile 数据集完整正确流程总结

| 步骤 | 正确做法 | 禁止 |
|------|---------|------|
| 上传文件 | `isSingle=true`，从返回的 `dbUrl` 取 `table_name` | 用 FILES 模式上传单文件 |
| 解析字段 | `queryFileFieldBySql`（**需签名**），参数 `dbCode=PAGE_ID` | 用 `queryFieldBySql`（SQL数据库接口，不适用于文件） |
| SQL | `select * from {table_name}` | GROUP BY、别名、聚合函数 |
| datasetItemList fieldName | 必须是 H2 表中**真实存在的列名** | SQL 别名、H2 内部名（EXPR$N） |
| code 字段 | 必须等于 `table_name`（如 `jmf.Sheet1_xxx_excel`） | 自造随机字符串 |
| dataSetIzAgent（组件 config） | 空字符串 `''` | `'0'` 或 `'1'` |
| dataMapping.mapping | 真实列名 | SQL 别名 |
| dataSetIzAgent 用 `""` 导致行为异常 | SQL 数据集该字段应为 null | 赋值 `None`（Python）→ JSON null |
