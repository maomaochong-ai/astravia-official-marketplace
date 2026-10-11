# API 踩坑记录（大屏常见问题速查）

## 🚨 多组件绑定数据集禁止 shell 并行调 `dataset_ops.py bind`（实测 2026-04-27）

**触发场景**：一次给 ≥2 个组件分别绑数据集时，AI 倾向于在多个 Bash 调用里并行执行 `dataset_ops.py bind`。

**根因**：每次 `bind` 流程是「`query_page` → 改自己 target 的 config → `save_page` 整页提交」。并发多次 save 时各进程用各自的快照覆盖整张表，互相 clobber，**非 target 组件的 option 会被脏写到不可解释的中间值**——实测 5 个 bind 并行后 JRingProgress 的 `option.valueFontSize` 被改为 `38`、`option.lineHeight` 被改为 `0`，KPI 数值整体被压出可视区，"86%" 不显示。单次 `bind` 重做即可恢复正常值（22/24），即可证明并发是唯一变量。

**正确做法**：≥2 个组件统一走 `dataset_ops.py bind-batch --batch-file <items.json>`：一次 `query_page` → 内存里改 N 个 target → 一次 `save_page` 提交，从机制上规避竞争。`batch-file` 每项 `{comp_name, dataset_id, dataset_name, dataset_type, mapping?|field_map?|header_keys?}`。

**禁止**：在 shell 里并行起多个 `dataset_ops.py bind` 子进程（即使每条命令本身能跑通也不行，副作用只在并发时显现）。

---



> **spec_builder 用户无需关注本文件**。本文件记录**手写 bi_utils 脚本 / 直接调 comp_ops.py** 场景下的踩坑。
> spec_builder 自动规避的坑（饼图 xAxis/yAxis、JDragBorder 剥离、chartData 序列化、透明 bg、pie 变体后缀、compareState、ECharts 轴样式、颜色合法性）不再列于此。
> 已修复的历史问题（JStackBar series:[]、comp_ops.py delete 报成功未删、高级组件 `__ref:`、queryFieldBy* 自动调用）已从本文件移除，不再单列。
> SKILL.md "Top 8" 已覆盖的条目本文件不再重复叙述，只保留额外技术细节。

## 目录（按场景跳读）

| 如果你遇到这类问题 | 跳到 |
|-------------------|------|
| 组件名/类型匹配错误 | §组件类型匹配踩坑 / §组件名称匹配踩坑 |
| 地图类组件不渲染 / 空白 | `references/map-guide.md`（完整地图踩坑已下沉） |
| 数据源/数据集创建失败 | §数据源相关 / §数据集相关 |
| 文件/WebSocket/FILES 数据集 | §文件数据集相关 / §完整工作流：YApi Mock |
| 组件渲染但没数据 / option 结构错 | §组件相关 / §Online 表单 / 设计器表单图表渲染异常 |
| 模板复制/覆盖异常 | §模板相关 |
| 脚本参数 / bi_utils API 用法 | §脚本参数相关 / §bi_utils 内部结构相关 |
| Windows 编码 / Git Bash 路径 | §环境相关 |
| 自写 Java 接口 → API 数据集 → 批量图表 | §完整工作流：自写API接口 + API数据集 + 批量图表 |
| 页面背景/水印/分辨率 | §页面配置相关 |
| YApi Mock 完整流程 | §完整工作流：YApi Mock |
| 弹窗/联动/钻取场景特殊坑 | §弹窗场景：bi_utils.save_page + query_page |
| SQL 表名来源 / dataset_ops.py edit | §SQL数据集表名必须来自真实数据库 / §dataset_ops.py edit 不写入字段列表 |
| SQL FreeMarker 运行时参数传参 / 钻取 API 调用 | §`getAllChartData` 运行时传参唯一正确格式 |

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
| **⚠️ 禁止在自定义脚本内用 subprocess 调用 comp_ops.py 再二次直接调用** | 在 Python 脚本中通过 `subprocess.run(comp_ops.py add ...)` 添加组件后，**禁止**在脚本外再单独执行一次 `py comp_ops.py add` 相同命令。两次调用都会成功，导致大屏出现两个位置和名称完全相同的重复组件。正确做法：创建数据集用自定义脚本，添加组件**只用一种方式**——要么在脚本内 subprocess 调用，要么脚本外直接调用，二选一。推荐：**脚本只负责创建数据集，组件添加统一用脚本外 `py comp_ops.py add --dataset-name`**，流程最清晰不易出错。 |
| **⚠️ 创建数据集前必须询问数据来源（Step 0.1 强制流程）** | 用户未明确说明数据来源时，**禁止**擅自使用公开 mock API 或任何默认 URL 创建数据集。必须先问：①使用 mock 系统还是自己编写代码？②接口需要实现什么业务需求？可跳过的情况：用户已提供 mock 地址/账号、已指定 Controller 文件路径、已指定已有数据集或 SQL 数据源、任务不涉及数据集创建。 |
| **⚠️ 创建 API 数据集后必须回写字段列表（onlDragDatasetItemList）** | 创建 API 类型数据集后，系统不会自动解析字段。必须：①调 `POST /drag/onlDragDatasetHead/getAllChartData` 解析字段；②用 `GET /drag/onlDragDatasetHead/queryById` 获取完整数据集实体；③构建 `onlDragDatasetItemList`（含 fieldName/fieldTxt/fieldType/izShow/orderNum）；④调 `POST /drag/onlDragDatasetHead/edit` 回写。不回写则数据集字段配置为空，设计器无法选字段，fieldOption 也为空。完整代码：`items = [{'fieldName':k,'fieldTxt':k,'fieldType':'String','izShow':'Y','izWhere':'N','izTotal':'N','orderNum':i} for i,k in enumerate(field_names)]; ds_full = bi_utils._request('GET','/drag/onlDragDatasetHead/queryById',params={'id':DS_ID})['result']; ds_full['onlDragDatasetItemList']=items; bi_utils._request('POST','/drag/onlDragDatasetHead/edit',data=ds_full)` |
| **⚠️ "数据条数"字段是 `dataNum`，不是 `dataCount`（2026-05-14）** | UI 面板"数据条数(0:返回全部)"绑定的是 `formState.dataNum`（DataSource.vue:75），写入 config 的顶层字段名为 `dataNum`。**禁止写 `dataCount`**——写错不报错，但 UI 读不到值，输入框始终为空，多条数据照样全部返回导致仪表盘指针/标题重叠。仪表盘类组件（JGauge/JAntvGauge/JColorGauge/JSemiGauge/JLiquid/JRingProgress/JRoundProgress/JProgress/JCustomProgress）接 API 数据集且 API 返回多条时，必须设 `cfg['dataNum'] = 1`。 |
| `POST /drag/page/edit` 乐观锁 | 必须传 `updateCount`（当前数据库值） |
| **chartData 必须是 JSON 字符串** | `config.chartData` 的值必须是 `json.dumps(...)` 后的字符串 |
| **dataMapping 的 filed 拼写** | 系统中 `filed` 不是 `field`（少一个 d） |
| **所有颜色字段统一用 hex（含 8 位 alpha 写法），禁止 rgba()** | 平台颜色选择器（Ant Design ColorPicker）以 hex 为存取格式：rgba 字符串可能解析失败或被替换为默认色（最早暴露案例：`rgba(0,0,0,0)` 被解析成红色，必须改写为 `#FFFFFF00`）。带透明度时使用 `#RRGGBBAA`（如半透明黑 `#00000080`、10% 白线 `#FFFFFF1A`、80% 深蓝 `#000259CC`、全透明 `#FFFFFF00`）。alpha 转换：`alpha_hex = round(alpha * 255)` 转两位 16 进制。覆盖场景：组件 background、ECharts option 内 backgroundColor / shadowColor / itemStyle.color / lineStyle.color / axisLine.color / splitLine.color / 表格 header_bg / body_bg / 滚动表格 border 等所有颜色位置。 |
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
| **需要直连 DB 执行 DDL/DML（建表、灌测试数据）时怎么拿密码** | 平台 dataset/parseSql 等接口都只允许 SELECT，无法跑 CREATE/INSERT。但接口 **`GET /drag/onlDragDataSource/queryById?id=<DS_ID>`** 直接返回 `dbPassword` 明文（与 `dbUrl/dbUsername` 同 result 对象）。`datasource_ops.py detail --id <ID> --show-password` 已封装（默认 mask，加 flag 才显示）。拿到后用 pymysql 直连建表/插数据，再用 `dataset_ops.py edit --db-source <ID> --sql ...` 把数据集切到真表。⚠️ 不要把明文密码写入脚本/日志，仅在内存中使用。|
| **⚠️ MongoDB 集合字段名不能用 `value` 等 SQL 保留字（Calcite 限制，2026-05-15 实测）** | MongoDB 数据集走 `select ... from mongo.<coll>` 经 Apache Calcite SQL 解析，`value` 是 Calcite 保留字（与 `VALUES` 子句冲突），原始查询 `select name, value from mongo.zhu_zhuang_tu` 报 `parse failed: Encountered "value" at line 1, column 14`。后台日志看到 `JmCalciteHandler.findList 执行sql:... parse failed: Encountered "value"`。**修复**：把 MongoDB 集合字段重命名为非保留字（如 `val`/`amount`/`cnt`），再相应改数据集 SQL 与组件 dataMapping。Calcite 保留字一览参考官方文档，常见保留字：`VALUE/VALUES/USER/TIME/DATE/TYPE/POSITION` 等。命名前先避开这些。|
| **⚠️ Redis 数据源的 SQL 数据集：`querySql` 字段填的是 Redis Key 名，不是 SQL（2026-05-15 实测）** | 平台对 Redis 数据源（`dbType=redis`）创建 `dataType=sql` 数据集时，**`querySql` 字段不写 SQL，而是 Redis 中的 Key 名**（例如 `orderinfo`）——后端读该 key 的值作为结果集；`datasetItemList` 可留空，前端按值结构推断字段。**AI 踩坑**：习惯按关系型库写 `SELECT ... UNION ALL` 静态 SQL 或 `SELECT ... FROM ...`，并把 `--db-source` 留空依赖默认连接 → 在 Redis 场景预览空白。**正解**：先确认 Redis 里有目标 key 及对应可解析的值，再 `dataset_ops.py create-sql --db-source <redis_ds_id> --sql "<key_name>" --fields "<name>:<type>,..."`（`--sql` 参数装的就是 key 名）。MongoDB 走 Calcite 解析真 SQL（见上一条），同为 NoSQL 但语义路径完全不同，不可混淆。|

## 数据集相关

> **字段映射机制（类型 A/B/D/无映射、filed 语义键、option 下 6 种子位置等）请直接读 `references/data-binding-mapping.md`**。本节只保留**该文档未覆盖**的零散 API 坑（参数格式、返回值兼容、限流、权限等）。

| 问题 | 说明 |
|------|------|
| **"数据源连接失败"** | 直接调用 API `POST /drag/onlDragDatasetHead/add` 创建 SQL 数据集时报"数据源连接失败"，但数据源测试 (`datasource_ops.py test`) 显示连接成功。**原因**：直接调 API 时请求体格式与预置脚本不同，可能缺少某些必填字段或格式不匹配。**解决方案**：始终使用 `comp_ops.py add --create-sql` 或 `dataset_ops.py create-sql` 预置脚本创建 SQL 数据集，禁止直接调 `/drag/onlDragDatasetHead/add` API。comp_ops.py 内部封装了正确的请求体格式和字段处理逻辑。若必须直接调 API，需确保包含完整字段：`dataType: 'sql', dataName, dbSource, querySql, dataRemark, parentId`（示例数据集 parentId=`1516743332632494082`），并检查 dbSource 是否为有效数字 ID 字符串。 |
| **"数据源不存在"** | SQL 数据集未设置 `dbSource`，或误用了 `dbKey`（无效字段）。直接调 `/drag/onlDragDatasetHead/add` 时字段必须是 `dbSource`，值是数据源 **数字 ID**（不是 code 字符串）。正确：`{'dbSource': '1199611644876644352', ...}`；错误：`{'dbKey': '1199611644876644352', ...}` |
| **⚠️ `dataset_ops.py create-sql --db-source` 留空 ≠ 默认数据源（2026-05-13 实测）** | CLI help 旧文案 "默认空=使用默认数据源" 是误导。实测：留空时 `dbSource` 字段被存为空字符串，后端**不会**自动 fallback 到任何数据源。**SELECT 字面值 / UNION ALL 静态 SQL**（如 `SELECT 'A' AS x, 1 AS y UNION ALL SELECT 'B', 2`）此时仍能 `getAllChartData` 返回（后端可在无 DB 连接下执行常量 SELECT）；但 **SELECT FROM 真表** 必报 `数据源不存在` —— 因为没数据源连不上库。**正解**：创建数据集时必须显式 `--db-source <ID>`（用 `datasource_ops.py list` 查 ID）；若先用静态 SQL 建好数据集再 edit 为真表 SELECT，必须**同时** `dataset_ops.py edit --db-source <ID>` 补 dbSource，否则前端绑定后图表空白 |
| **⚠️ `getAllChartData` 接口的参数字段名是 `params`（2026-05-13 实测）** | 测试钻取/联动 SQL 数据集时，给 `POST /drag/onlDragDatasetHead/getAllChartData` 传 FreeMarker 参数的字段名是 **`params`**（dict 或 JSON 字符串均可），不是 `paramJson` / `paramList` / `dataParams` / `paramData` / `queryParams`。**字段名写错时不报错也不警告**——只是 FreeMarker 里 `isNotEmpty(level)` 始终为 false，永远走默认分支，看起来"3 级钻取 SQL 全部返回 L0 数据"。**正解**：`payload = {'id': ds_id, 'params': {'level': '2024'}}` 或 `{'id': ds_id, 'params': '{"level":"2024"}'}`。用 `dataset_ops.py test` 不传 params，无法独立测试钻取 SQL 各级分支——需手写脚本调 `bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={'id':..., 'params':{...}})` 验证 |
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
| **⚠️ SQL 数据集创建后字段为空（手动点查询解析才出现字段）** | 调 `/add` 时未传 `onlDragDatasetItemList`，系统不会自动解析 SQL 字段。**修复①（推荐，add 时一并传入）**：在 add 请求体中加 `"onlDragDatasetItemList": [{"fieldName":"name","fieldTxt":"日期","fieldType":"String","izShow":"Y","sort":0}, {"fieldName":"value","fieldTxt":"数量","fieldType":"Integer","izShow":"Y","sort":1}]`。**修复②（事后补救，通过 edit 回写）**：先 `getAllChartData` 拿第一行数据 → 推断字段类型（int/float→Integer，其余→String）→ `queryById` 获取完整数据集实体 → 将 `onlDragDatasetItemList` 填入实体 → `edit` 保存。代码：`items=[{'fieldName':k,'fieldTxt':k,'fieldType':'Integer' if isinstance(v,(int,float)) else 'String','izShow':'Y','sort':i} for i,(k,v) in enumerate(test_data[0].items())]; ds=bi_utils._request('GET','/drag/onlDragDatasetHead/queryById',params={'id':ds_id})['result']; ds['onlDragDatasetItemList']=items; bi_utils._request('POST','/drag/onlDragDatasetHead/edit',data=ds)` |
| **⚠️ 直接调 `/drag/onlDragDataSource/add` 时 result 是字符串 ID** | 响应体 `result` 直接是字符串（如 `"1199640199413063680"`），非包含 `id` 字段的对象。直接用 `DS_ID = add_resp.get('result')` 即可。**禁止用 `getOptions` 按名称查找**（同名重复时会取到旧数据源，返回错误 ID）。MySQL 8.x 的 `dbType` 填 `MYSQL8`（不是 `MYSQL5.7`） |
| **queryAllById 返回 result=null** | 权限或数据隔离问题，不要依赖此接口 |
| **编辑数据集字段名与查询不同** | `queryAllById` 返回 `onlDragDatasetItemList`，`edit` 需要 `datasetItemList` |
| **comp_ops.py --dataset-name 绑定后无数据** | list 接口不返回字段列表，已修复：自动从 getAllChartData 推断 |
| **字典翻译用 jimu_dict 不是 sys_dict** | 大屏字典 API 为 `/jmreport/dict/*`，不是 `/sys/dict/*`。`/sys/dict/getDictItems/` 需要签名且是系统字典表，大屏不使用 |
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
| **🚨 JTabToggle 仅支持静态数据，禁止绑定数据集** | 导航切换组件虽有 `dataMapping` 字段，但组件本身**不支持动态数据集**，只能使用静态 `chartData`。绑定数据集不生效（2026-04-21 明确） |
| **⚠️ 批量绑定数据集：缺少 fieldOption** | 不设 `fieldOption` 会导致前端字段选项面板为空，用户无法在设计器中修改字段映射。格式：`[{"label":"name","text":"name","type":"String","value":"name","show":"Y"},...]` |
| **✅ 已修 · `dataset_ops.py bind/bind-batch` 自动注入 fieldOption + JCommonTable.option.columns + 清空静态 chartData（2026-04-27）** | 旧版 `_apply_binding` 只写 `dataType/dataSetId/dataMapping/dataSetApi/dataSetMethod`，**漏写 `fieldOption`/`paramOption`/`dataSetIzAgent`，且未清空 `chartData`，对 JCommonTable 还漏写 `option.columns`**。**JCommonTable 渲染列的真相源是 `option.columns`（每项 `{izShow, dataIndex, title}`）**——不是 dataMapping 也不是 fieldOption。手动 UI 拖入并绑数据集时前端 watcher 会自动按 fieldOption 填 columns，脚本路径不走该 watcher 故必须显式写。已修复：bind 时优先从 `fetch_dataset_detail` 取 `datasetItemList`，缺失则回退到 `getAllChartData` 第一行 keys 推断字段；构造 fieldOption + 当 `comp_type=='JCommonTable'` 时按字段拼 `option.columns`；同时把 `cfg['chartData']='[]'`。验收：reset 后 `bind-batch` 一次成功，前端表格正常渲染 API 字段。 |
| **⚠️ 数据集分组：用 `parentId`，不是 `groupCode`** | 分组节点的特征：`dataType=null`（无 dbSource/querySql）。创建数据集时 `parentId = 分组id`。**正确查询流程**：①`GET /drag/onlDragDatasetHead/getAllGroup`（⚠️ 不是 `/drag/onlDragDatasetGroup/getAllGroup`，后者 404）②该接口返回所有记录，**必须过滤 `dataType=None` 才是分组节点** ③从分组节点中找 `name='示例数据集'` 取其 `id` ④不存在则 `POST /drag/onlDragDatasetHead/addGroup` 创建再重查。`示例数据集` 固定 id = `1516743332632494082` |
| **🚨 `addGroup` 的 parentId 必须传 null，不能是 '0'（2026-05-11 重大修正）** | **前一版本的修正描述是错的**——getAllGroup 实际是合法的"分组列表接口"，76 条全是分组节点（无 dbSource）。**真正的 bug 在 addGroup 的 payload**：旧脚本传 `parentId='0'`（字符串），后端 add 成功但建出来的分组 `parentId='0'`，被 getAllGroup 内部过滤逻辑滤掉（getAllGroup 只返 parentId IS NULL 的顶层分组），同时 `queryById` 也返 null（同样的过滤）。结果：下次 `_resolve_group_id` 永远命中不到 → 重复 addGroup → 数据集管理页累积同名空分组（实测一晚上建 3 条"联动示例"）。**对比**：平台预置的"示例数据集"和所有合法用户分组都是 `parentId=None`，与我建的 `parentId='0'` 是两类节点。**正解**：addGroup payload 写 `'parentId': None`（Python None → JSON null），不要写 `'0'`。`_resolve_group_id` 已更新：优先 getAllGroup → list?name= 兜底（应对历史 parentId='0' 脏数据） → addGroup(parentId=None)。历史 parentId='0' 的孤儿分组可用 `DELETE /drag/onlDragDatasetHead/deleteGroup?id=<>` 清理。 |
| **⚠️ SQL 数据集必须在创建后立即测试** | 创建 SQL 数据集后，**必须立即**调 `POST /drag/onlDragDatasetHead/getAllChartData`（data: `{'id': DS_ID}`）验证 SQL 可执行。若返回 `success=false` 或 `message` 含 `bad SQL grammar`，立刻停止生成图表并报错，否则所有绑定该数据集的图表都会显示"暂无数据" |
| **⚠️ API 数据集创建后必须调 getAllChartData 触发查询解析** | `POST /drag/onlDragDatasetHead/add` 仅保存元数据配置，**不会**触发系统对接口响应的解析。必须随后调 `POST /drag/onlDragDatasetHead/getAllChartData`（data: `{'id': DS_ID}`）触发一次查询解析，系统才能缓存字段 schema。跳过此步导致：图表绑定后显示"暂无数据"、设计器字段面板为空、dataMapping 无法生效。**在 `create_api_dataset()` 函数末尾必须加此调用**：`bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={'id': ds_id})` |
| **🚨 `getAllChartData` 向 SQL FreeMarker 注入运行时参数的唯一有效格式：`params: {'key': 'value'}` 直接字典（实测 2026-05-20，仅限 SQL 数据集）** | **适用范围**：SQL 数据集含 FreeMarker 变量（`${drill!}` / `<#if isNotEmpty(drill)>`）时，手动调 `getAllChartData` 传入运行时参数。**注意：本条仅验证了 SQL 类型，API/JSON/文件数据集未验证，勿跨类型套用。** 以下格式对 SQL FreeMarker 全部无效（均只读 DB 存储的 `datasetParamList.paramValue` 默认值）：`paramList:[{name,value}]`、`paramList:[{paramName,paramValue}]`、`dataSetParam:[...]`、`queryInfo:{...}`、`onlDragDatasetParamList:[...]`、顶层直接加参数名。**SQL FreeMarker 有效格式**：`{'id': DS_ID, 'params': {'drill': '华东区'}}`（`params` 是字典，key=FreeMarker 变量名，value=注入值）。SQL 逻辑正确性建议先用 pymysql 直连验证，再通过 `params:{}` 格式验证 API 层。 |
| **⚠️ API 数据集 getAllChartData 必须 try/except 包裹（后端未重启时返回 null）** | 自写 Java 接口需要重启后端才能访问。在重启前调 `getAllChartData` 时，接口 404/500 导致响应为 `{"result": {"data": null}}`。**必须用 try/except 包裹，失败时打印提示并继续，不能让脚本崩溃**。正确模式：`try: parse_r = bi_utils._request(...); rows = ((parse_r.get('result') or {}).get('data') or []); print(f'解析: {len(rows)} 条') except Exception as e: print(f'解析跳过({e})，后端重启后自动生效')`。**绝对不能让 getAllChartData 失败阻断整个脚本执行** |
| **⚠️ API 数据集 onlDragDatasetItemList 已在 /add 时传入，禁止再 queryById + edit 回写（浪费 4 个请求）** | 创建 API 数据集时 `/add` 请求体已包含 `onlDragDatasetItemList`，字段已一次性保存到数据库。**禁止**再做 `queryById` → 填 `onlDragDatasetItemList` → `edit` 这三步回写——这是完全多余的操作，浪费 4 个 HTTP 请求（2个数据集 × 2次请求），且在后端未重启时还会因 getAllChartData 返回空而得到无意义的字段列表。正确做法：`/add` 时一次性传字段，随后只做 `getAllChartData`（try/except 包裹）即可 |
| **⚠️ JeecgBoot 大屏记录表名是 `jmreport_big_screen`，不是 `drag_page`** | `drag_page` 表在默认 jeecgbootsy 库中不存在。统计大屏创建情况时正确表名为 `jmreport_big_screen`（字段含 `screen_name`、`create_time`、`type` 等）。另：`onl_drag_page` 是 drag 模块的新页面表（存在，216+条记录），两个表用途不同 |
| **⚠️ 批量绑定数据集：缺少必要字段** | 完整绑定配置除 `dataType/dataSetId/dataMapping/fieldOption` 外，还需要：`dataSetName`（设计器显示用）、`dataSetType`（`"sql"`）、`dataSetApi`（querySql）、`dataSetMethod`（`"get"`）、`dataSetIzAgent`（`"1"`）、`paramOption`（`[]`）、`viewLoading`（`True`）、`chartData`（`"[]"`）。缺少任一字段均可能导致绑定在设计器中显示异常 |
| **⚠️ 双轴图（DoubleLineBar）的 slot_labels 是 `['分组','维度','数值']`** | 经源码验证，DoubleLineBar 的 dataMapping 是 `['分组','维度','数值']`（不是 `['维度','数值','数值2']`）。数据中 type 字段映射到"分组"，name 映射到"维度"，value 映射到"数值" |
| **⚠️ `dataset_ops.py create-api` 必填 `--code`** | 文档未提及，但 `--code` 是必填参数（数据集唯一编码，如 `mock_monthly_orders`），漏传直接报 usage 错误 |
| **⚠️ `dataset_ops.py create-api` 不支持 `--data-path`** | 该命令无 `--data-path` 参数，无法配置 JSON 提取路径。若接口返回包装格式 `{"code":200,"result":[...]}` 则 `dataset test` 显示 `data: null` |
| **⚠️ API 数据集接口必须返回裸数组** | API 接口应直接返回 JSON 数组（如 `[{"name":"1月","value":320},...]`），**不要包装成** `{"code":200,"result":[...]}` 格式。包装格式需要配置 data-path 才能解析，而该工具不支持此参数。Java 接口返回类型写 `String`，直接 `return "[{...}]"` 最简单 |
| **⚠️ API 数据集 `datasetItemList` 初始 payload 会被后端丢弃，必须二次 edit 回写** | `POST /drag/onlDragDatasetHead/add` 传 `datasetItemList` 后端不落库（queryById 返回空数组）。运行时不影响（组件只看 `dataMapping`/`option.fieldMap` 等），但 BI 设计器里数据集详情看不到字段。**正确做法**：add 后立即调 `POST /drag/onlDragDatasetHead/queryFieldByApi` 解析接口响应，再 `queryById` → 填 `datasetItemList` → `edit` 回写。`dataset_ops.py cmd_create_api` 已内置；自写脚本可复用公共 helper `_refresh_api_dataset_fields(ds_id, url, method)`。**该条覆盖"线 150 禁止 queryById+edit 回写"的旧描述**——实测 2026-04-23：不回写 datasetItemList 始终为空 |
| **⚠️ 回写 datasetItemList/datasetParamList 必须用 POST `/edit`（不是 PUT）** | `dataset_ops.py cmd_edit`（PUT 路径）只改 `querySql / name / code` 等 head 表字段，**不写子表 onl_drag_dataset_item / onl_drag_dataset_param**。手写脚本回填字段/参数时若用 `PUT /drag/onlDragDatasetHead/edit` 接口表面 `success=true`，但子表 0 行，UI 数据集详情字段 tab 仍空，且 SQL 含 `${region}` 这类 FreeMarker 时联动 `getAllChartData(params={region:'北京'})` 抛 NPE `Cannot invoke "Object.toString()" because the return value of "java.util.Map.get(Object)" is null`。**正确**：用 `POST /drag/onlDragDatasetHead/edit` data=ds_record，把 `datasetItemList` + `datasetParamList` 直接放进 ds_record 顶层（不是字符串 `paramOption`），后端会同步写入子表。实测 2026-05-07 |
| **⚠️ datasetParamList 元素必须传 `widgetType`（驼峰），否则子表 widget_type=NULL 触发后端 NPE** | 创建/编辑数据集时 `datasetParamList` 元素若只填 `paramName/paramTxt/defaultVal`（缺 widget_type），后端写入子表 `onl_drag_dataset_param.widget_type=NULL`，之后任何 `getAllChartData` 都报 `Cannot invoke "Object.toString()" because the return value of "java.util.Map.get(Object)" is null`（NPE 源自 widget_type 不应为 null 的反射读取）。**正解**：每个 param 元素加 `'widgetType':'String'`（其他可选字段 paramValue/orderNum/izSearch/searchMode 留 None 不影响）。完整最小元素：`{'paramName':'region','paramTxt':'地区','paramValue':'','widgetType':'String'}`。**绕路方案**：`DELETE FROM onl_drag_dataset_param WHERE head_id='<ds>'` 直接清空——SQL 文本里 `<#if isNotEmpty(region)>` FreeMarker 也能自动声明 region 联动可用，但 UI 数据集详情→参数字段 tab 显示空，联动配置面板"接受参数"下拉为空。**正解优于绕路**：UI 完整可配。实测 2026-05-07 |
| **⚠️ datasetParamList 元素字段名是驼峰（paramName/paramTxt/widgetType/paramValue），不是下划线** | payload 字段：`paramName, paramTxt, widgetType, paramValue, orderNum, izSearch, searchMode, dictCode`（驼峰，与子表 snake_case 列名不同——后端 ORM 映射）。写错（如用 `param_name` 或 `defaultVal`）后端不报错但**字段被丢弃**写入 NULL，又触发上一条 NPE |
| **⚠️ 批量建 API 数据集推荐用 `dataset_ops.py create-api-batch`（并发回写字段）** | 10 个数据集：逐个调 create-api 串行耗时 ~7.3s；新增子命令并发（workers=10）~4.6s（本地代理环境下约 37% 提速）。用法：`py dataset_ops.py create-api-batch $API $TOKEN --batch-file items.json --out-file results.json --workers 10`。batch-file 每项：`{name, code, url, method?, fields, agent?}`。**/add 保持串行**（后端对 code 唯一性检查并发易撞），**只并发 queryFieldByApi + edit 回写**。瓶颈是本地代理对外网 HTTPS 的并发吞吐——无代理环境可接近 5× 提速 |
| **⚠️ `datasource_ops.py create` 示例命令必须含 `--code`** | pitfalls.md 有记录但 SKILL.md 示例未展示，实际运行时必须提供。完整示例：`py datasource_ops.py create $API_BASE $TOKEN --name "名称" --code "唯一编码" --db-type MYSQL5.7 --host 127.0.0.1 --port 3306 --db dbname --user root --password root` |
| **✅ 已修 · `bi_utils._request` 自动签名（2026-04-24）** | 新版大屏后端给 `queryFieldBySql / queryFileFieldBySql / queryAllById / getDictByCodes / getMapDataByCode / getDataForDesign / getTotalData / getTotalDataByCompId / generate*Sse / page/addVisitsNumber` 等接口加了 `@SignatureValidation`，无签名头直接 500 "签名验证失败:X-TIMESTAMP为空"。**已在 `bi_utils._request` 内置白名单 `_SIGNED_PATHS` + `_compute_signature_headers`**（签名算法见 `signing-datasource-guide.md`），命中路径自动附加 `X-TIMESTAMP / X-Sign / V-Sign`。现象：早前 `dataset_ops.py create-sql` 创建后"查询解析异常: 500"，现在正常输出 `查询解析成功: N 个字段`。调用方无需改动，已有 `_request` 调用全部自动受益。若后端后续再加 `@SignatureValidation` 接口，扩充 `_SIGNED_PATHS` 即可。 |
| **✅ 已修 · `dataset_ops.py` 自动建组 parentId 兼容 dict 返回（2026-04-24）** | `/drag/onlDragDatasetHead/addGroup` 的 `result` 在当前版本是**整个分组对象**（含 id/name/code/parentId），老脚本直接 `gid = resp.get('result')` 再塞进后续 `/add` 的 `parentId` 字段，被 Jackson 拒绝："Cannot deserialize value of type String from Object value" (HTTP 400)。**已在 `_resolve_group_id` 兼容**：`if isinstance(gid, dict): gid = gid.get('id')`。现象：早前 `create-sql --group "新名"` 首次调用（分组不存在需新建）必失败；现在一次成功。已回归：`--parent-id` 显式传参分支不受影响。 |
| **✅ 已修 · `dataset_ops.py create-sql` 二次 edit 不要清空 datasetParamList 子表（2026-05-11）** | **真实原因（前版本误判已纠正）**：`/add` 接口**完全支持** datasetItemList / datasetParamList 子表入库——实测 add 后 `/drag/onlDragDatasetParam/list?headId=<id>` 立刻能看到记录。原以为"add 丢子表"是错的，实际是看错了 list/queryById 接口的返回（这俩接口本来就不返子表，见 #125）。**真正的 bug 在二次 edit**：cmd_create_sql 用 queryFieldBySql 解析字段后通过 `queryById → ds_record → edit` 回写 datasetItemList，但 **/edit 是"整体替换"语义——ds_record 缺哪个子表字段就清哪个**（queryById 返回的 ds_record 不含子表）。实测：add 后 param 子表 1 条 → edit 只传 datasetItemList → param 子表归零。**已修复**：cmd_create_sql 二次 edit 时若 `param_list` 非空，同时把 `datasetParamList` 一并写回到 ds_record 顶层，防止 edit 清空 add 时已写入的参数子表。`_parse_sql_params` 同时扩展 `--params` 支持第 5 段 `widgetType`（取值 string/number/date，默认 string）。 |
| **⚠️ `/drag/onlDragDatasetHead/edit` 整体替换语义：子表字段缺失=清空对应子表（2026-05-11 新增）** | 与"调用方对 head/item/param 分别更新"的直觉相反。`queryById` 返回的 ds_record **不包含** `datasetItemList` / `datasetParamList`（这两个子表只在 list 不返、queryById 也不返，需各自调 `/drag/onlDragDatasetItem/list` `/drag/onlDragDatasetParam/list?headId=`）。手写 edit 脚本只填 datasetItemList → datasetParamList 子表被清空；反之只填 datasetParamList → item 子表也会被清空。**正确做法**：edit 前若需要保留某子表，必须先单独查一次该子表再放进 ds_record 顶层。pitfalls #174 老规则"用 POST /edit 把两个子表直接放顶层"今后请按此条理解——POST 没问题，问题是必须**同时**带两份。 |
| **✅ 已修 · `dataset_ops.py bind/bind-batch` 自动回填 paramOption（2026-05-11）** | 旧版 `_apply_binding` 对 paramOption 只写 `cfg.setdefault('paramOption', [])`（空数组）。UI 设计器拖入组件 + 绑带参数的数据集时，前端 watcher 会按 `datasetParamList` 自动填 `paramOption=[{label,text,value,defaultVal,type}, ...]`；API 路径不走该 watcher，故脚本必须显式从数据集参数子表反查回填。**现象**：联动 `linkage:[{source:'id', target:'dictId'}]` 看似配好，组件 config 里 paramOption 仍是空数组 → 设计器"接收参数"下拉空，UI 上看不到参数（运行时 target=dictId 仍可触发数据集查询，但任何二次编辑都会因下拉空而被覆盖丢失）。**已修复**：bind 时调 `GET /drag/onlDragDatasetParam/list?headId=<datasetId>` 拿子表记录，转成 `{label:paramTxt, text:paramTxt, value:paramName, defaultVal:paramValue, type:widgetType}`。验收：与 UI 操作产生的 save payload `paramOption` 字段一致。 |

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
| **⚠️ 文件数据集（JSON/CSV/Excel）的字段名必须用英文（2026-05-09 实测）** | JSON 文件的 key、CSV 和 Excel 首行列名必须用英文（如 `date`、`count`），**禁止使用中文**（如 `日期`、`注册数量`）。平台底层用 H2/Calcite 解析文件为虚拟表，中文列名可能导致字符识别异常或后续 SQL 查询时映射失败。正确示例：`[{"date":"2025-05-01","count":120}]`；dataMapping 中 `mapping` 对应英文字段名：`{"filed":"维度","mapping":"date"}`, `{"filed":"数值","mapping":"count"}`。 |
| **⚠️ `files_ops.py --mock-data` 历史上默认生成 CSV（BOM）导致中文字段名失效（已修复 2026-05-09）** | 根因三处：① `json_to_csv_file` 用 `encoding='utf-8-sig'`（BOM），H2 将第一列名解析为 `﻿日期`，dataMapping `mapping: '日期'` 匹配不上；② `upload_file` Content-Type 硬编码 `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`（xlsx MIME），不匹配 CSV/JSON 实际格式（平台通过**文件名后缀**判断格式，.json→`_json`表，.csv→`_csv`表，Content-Type 不影响类型识别，但应规范）；③ `add_chart_to_page` 依赖不存在的 `default_configs.json`，导致 FileNotFoundError；④ `init_bi` 只把 `scripts/` 加入 sys.path，`bi_utils.py` 在父目录 `references/`，直接调 `python files_ops.py` 报 `ModuleNotFoundError`。**修复内容**：`init_bi` 同时插入父目录；`json_to_csv_file` 改为 `encoding='utf-8'`（无BOM）；新增 `json_to_json_file`；`upload_file` Content-Type 按后缀映射；`add_chart_to_page` 改从 `defaults/<CompType>.json` 加载；`--mock-data` 默认格式改为 `json`，可用 `--file-format csv` 切回 CSV。 |

## 组件相关

| 问题 | 说明 |
|------|------|
| **⚠️ 严禁直接用 bi_utils.add_xxx + save_page** | `add_component` 内部初始化空列表 `_page_components[page_id] = []`，不会加载已有组件。`save_page` 会用这个空列表+新组件覆盖整个页面，**导致已有组件全部丢失**。必须用 `comp_ops.py add` 或手动先执行 `bi_utils._page_components[PAGE_ID] = page.get('template', [])` |
| **⚠️ dataType=4 表单图表（online/design）添加时必须先 query_page 加载已有模板（2026-04-10 实测）** | comp_ops.py 不支持 dataType=4，只能用自定义脚本。但直接 `bi_utils.add_component()` 后 `save_page()` 会清空已有组件。**强制三步走**：①`page = bi_utils.query_page(PAGE_ID)` ②`bi_utils._page_components[PAGE_ID] = page.get('template', [])` ③`bi_utils.add_component(PAGE_ID, ...)` + `bi_utils.save_page(PAGE_ID)`。跳过步骤①②直接调 add_component，页面只剩新图表，其余全部丢失（已观测严重事故） |
| **⚠️ 批量添加多组件到现有页面的安全模式** | 需要一次性添加多个组件且只保存一次时，正确顺序：①`page = bi_utils.query_page(PAGE_ID)` ②`bi_utils._page_components[PAGE_ID] = page.get('template', [])` ③循环调 `bi_utils.add_component(...)` ④最后 `bi_utils.save_page(PAGE_ID)`。跳过步骤②会导致已有组件被清空 |
| **添加组件必须用 comp_ops.py add** | comp_ops.py 在 cmd_add 中会先 `load_template` 再赋值 `_page_components`，安全保留已有组件。直接调 bi_utils 函数是危险操作 |
| **新增组件不显示** | config 不完整或被背景图遮挡，将新组件 `insert(0, ...)` 到数组开头 |
| **comp_ops.py add 渲染失败** | 缺少 `default_configs.json`，使用 add 时必须同时复制 |
| **⚠️ 自定义脚本添加图表必须从 `defaults/CompType.json` 加载默认 config** | 手写 option/series/legend 等配置容易遗漏字段导致渲染异常。正确做法：`d = json.load(open('defaults/JPie.json'))` 读单文件（返回新 dict，无需 deepcopy），再覆盖 chartData/option 等字段 |
| **JGroup 子组件存储位置** | 在 `comp.props.elements` 中 |
| **JGroup 子组件缺少 groupStyle** | 必须按百分比计算 |
| **联动必须设 linkType** | 必须同时设置 `linkType: 'comp'` 和 `linkageConfig` |
| **联动 linkageId 必须精确** | 值是目标组件的 `i` 字段（UUID） |
| **source 字段来自 ECharts params** | `name`/`value`/`type` 对应 ECharts 点击事件 params |
| **多系列 chartData 格式** | 需要 `type` 字段：`[{"name":"1月","value":10,"type":"系列A"}]` |
| **⚠️ 替换图表类型时共通配置未继承** | delete+add 替换图表类型时，仅继承数据集绑定字段（dataSetId/dataMapping 等）是不够的。用户在旧图表中定制的 `option` 字段（标题文字、坐标轴显隐、图例位置、配色等）也必须合并到新图表。使用 `merge_common_option()` 辅助函数，见下方「图表类型替换」章节 |
| **⚠️ JBar 柱体颜色：`option.color[0]` 不生效，必须同时改 `series[0].itemStyle.color`** | ECharts 中 `series[0].itemStyle.color` 的优先级高于 `option.color` 数组。JBar 默认配置中 `itemStyle.color` 硬编码了蓝色（`#64b5f6`），仅设置 `option.color[0]` 无法覆盖柱体颜色。**正确做法**：必须同时设置两个字段：`--set "option.color[0]=目标色" --set "option.series[0].itemStyle.color=目标色"`（2026-04-09 实测） |
| **⚠️ 以下组件颜色必须通过 `option.customColor` 设置，`option.color` 无效** | 组件列表：`JRadioButton / JRadialBar / JActiveRing / JRing / JPyramidFunnel / JFunnel / JBubble / DoubleLineBar / JMultipleLine / JArea / JLine / JRotatePie / JRose / JPie / JMixLineBar / JPercentBar / JMultipleBar / JCapsuleChart / JStackBar / JQuadrant`。**正确格式**：`option.customColor = [{"color1":"#FF0000","color":"#FF0000"},...]`（`color1` 与 `color` 值相同）。`option.color` 对这些组件无效。配色规范（含系统默认9色）见 skill.md「图表配色规范」章节 |
| **⚠️ 散点家族（JBubble / JQuadrant）defaults.series 为空，禁止注入 `[{type:"bar"}]`** | JBubble / JQuadrant / JBarGroup3d / JDynamicBar / JGender / JMixLineBar / JNegativeBar / JPictorial / JPictorialBar / JStackBar / DoubleLineBar 等 11 个组件 defaults.option.series 为 `[]`，平台前端按 componentName 自行推断渲染（散点 / 多柱 / 堆叠等）。spec_builder 旧版 `_apply_series_shortcuts` 强制把 series 升级为 `[{type:'bar'}]`，导致 JBubble / JQuadrant 渲染成柱形而非散点。**正确策略**：defaults.series 为空且用户未显式给 series 级覆盖（barWidth/smooth/gradient/color）时直接 return，让平台自治；用户给了 color 时按 comp_type 选 chart_type（scatter 家族 → `'scatter'` 而非 `'bar'`）。已在 spec_builder.handle_cartesian + _apply_series_shortcuts 修复 |
| **⚠️ JScatter / JBubble 默认 xAxis.splitLine.show 缺失，会被 ECharts 默认 `show=true` 渲染纵向网格** | JBubble / JScatter defaults.xAxis 不含 splitLine 配置（仅 axisLabel.color），但 ECharts 对 `value` 类型轴的 splitLine 默认 show=true，导致散点图出现密集纵向网格线，与平台拖拽渲染不一致。JQuadrant defaults 已显式 `splitLine:{show:false}` 不受影响。**修复**：spec_builder.handle_cartesian 末尾对 `comp_type in ('JScatter','JBubble')` 注入 `xAxis.splitLine.show=False`（用 setdefault，不覆盖用户显式配置） |
| **⚠️ JScrollRankingBoard：rowNum = data_count → 永远不滚动（实测 2026-04-28）** | 组件将容器等分为 rowNum 行渲染，`data_count > rowNum` 才触发轮播。若两者相等（如数据10条、rowNum=10），所有行一次展示完毕、没有剩余行可滚。**rowNum 推荐公式**：`rowNum = floor(h / 40)`（每行约 40-50px 视觉舒适）— 实测 h=195 → rowNum=4，h=300 → rowNum=7。**数据条数**建议 ≥ rowNum + 3，确保滚动明显。写 spec 时"默认 rowNum=10"与"数据也给了10条"是最常见的不滚陷阱 |
| **⚠️ JRingProgress / JLiquid / JScrollRankingBoard 等单值组件 `option.color` 必须是 string，写 array 直接 fallback 默认色或报错** | 这些组件是自定义渲染（不是 ECharts palette 模式），渲染器把 `option.color` 当**单一颜色值**读，期望 `"#RRGGBB"`。但色板逻辑（style_ops set-palette / spec_builder palette）按 ECharts 习惯写 `option.color = [c1,c2,...]` 数组：JRingProgress / JLiquid 是 silent fallback（深色/默认色，无报错）；**JScrollRankingBoard 直接抛运行时错 `Color: Invalid Input of #a,#b`（数组被 toString 成逗号串传给底层 color parser）**。判断依据：`defaults/<Type>.json` 中 `option.color` 默认就是 string。**修复**：① `style_ops.STRING_COLOR_TYPES` 集合（已含 JRingProgress / JLiquid / JScrollRankingBoard）+ 写入前类型分支（spec_builder._apply_named_palette / cmd_set_palette 已修）；② `handle_JScrollRankingBoard` 默认值改为单字符串 `p['subtitle']`（旧版默认 `[subtitle, title]` 二色数组是历史 bug），同时兼容旧 spec 传 list 自动取首色（2026-05-13 实测） |
| **⚠️ JLiquid 水波纹不显示 / 渲染异常 — config.w/h 与外层 comp.w/h 不一致** | defaults/<Type>.json 顶层有 `w/h`（JLiquid 默认 450×300），bi_utils.add_component 通过 `_deep_merge` 把它们合到 config 里，但外层 comp.w/h 用的是用户 spec 给的尺寸（如 560×440）。多数组件不读 config.w/h 不影响，但 **JLiquid 渲染器用 config.w/h 算水波动画路径**（length=128, count=4 等是基于 config 内尺寸的相对值），内外不一致时水纹画在视野外、肉眼看不到。**修复**：bi_utils.add_component 末尾强制 `default_config['w'] = px_w / 'h' = px_h / 'size' = {width:px_w, height:px_h}`，确保 config 内层尺寸始终等于外层 |

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
  - Mock 接口：`<后端项目路径>\jeecg-boot-platform\jeecg-boot-module-drag\src\main\java\org\jeecg\modules\drag\controller\OnlDragMockController.java`
  - 已有接口：`/drag/mock/visitorFlow`（单系列）、`/drag/mock/visitorFlowMulti`（多系列）、`/drag/mock/salesFlowDouble`（双轴）等

### Step 2：编写 Java 接口

**关键规则（强制）：**
- 返回类型必须是 `String`，直接返回裸 JSON 数组字符串
- **严禁包装格式**（不要 `{"code":200,"result":[...]}`，API 数据集无法配置 data-path）
- 必须免鉴权，否则大屏预览时被拦截 401。**免鉴权方式因项目而异**：
  - **有 `@JimuNoLoginRequired`（积木平台自带控制器）**：加该注解
  - **普通 JeecgBoot 项目（无 `@JimuNoLoginRequired`）**：加 `@IgnoreAuth`（`org.jeecg.config.shiro.IgnoreAuth`），该注解通过 `InMemoryIgnoreAuth` 被 `JwtFilter` 识别放行；同时在 `ShiroConfig.filterChainDefinitionMap` 加 anon 条目（双保险）。**不要只加 anon 不加 @IgnoreAuth**——JwtFilter 走自己的白名单，不读 filterChainDefinitionMap
- 写完接口后**必须重启后端**，API 数据集才能拿到数据

**单系列模板**（适用：折线图/柱形图/饼图/面积图等）：
```java
// 数据字段：name=维度, value=数值
@IgnoreAuth  // JeecgBoot 普通项目用这个；有 @JimuNoLoginRequired 的平台控制器用那个
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

## Online 表单 / 设计器表单图表渲染异常（2026-04-10 实测）

以下 4 个组件在 online 表单或设计器表单模式（dataType=4）下有特殊 option/字段结构，使用通用模板会导致渲染异常。

| 组件 | 问题 | 正确做法 |
|------|------|---------|
| **⚠️ JFunnel（基础漏斗图）** | 错误地使用 yAxis/xAxis 的通用 base_option → 渲染完全异常，漏斗消失 | 必须使用漏斗专属 option：`reversal`/`legend`/funnel `series`（含 `type:'funnel'`, `sort:'descending'`, `label`, `labelLine`, `itemStyle`, `emphasis`），`tooltip.trigger='item'`，`formatter='{a} <br/>{b} : {c}%'`。**绝对不能有 yAxis/xAxis** |
| **⚠️ JPyramidFunnel（金字塔漏斗图）** | 同 JFunnel，错误注入 yAxis/xAxis | 同上，但 `series[0].sort='ascending'`（从小到大，呈金字塔形） |
| **⚠️ JRing（基础环形图）** | `option.series:[]`（空数组）→ ECharts 无法识别环形图，渲染空白 | series 必须预填充完整环形配置：`[{type:'pie', radius:['40%','70%'], avoidLabelOverlap:False, label:{show:False, position:'center'}, labelLine:{show:False}, emphasis:{label:{show:True, fontSize:14, fontWeight:'bold'}}, data:[]}]`，**不能留空 []** |
| **⚠️ JRing 环形图尺寸：`outRadius`/`innerRadius` 像素值优先于 `series[0].radius` 百分比** | 通过 API 修改 `series[0].radius`（如 `["28%","48%"]`）对已渲染页面无效——Vue 组件优先读 `option.outRadius`/`option.innerRadius`（像素整数）；一旦 UI 交互过，这两个字段会被写入并永久覆盖百分比路径 | **通过 API 调整 JRing 大小必须用像素字段**：`option.outRadius`（外径像素）/ `option.innerRadius`（内径像素）。defaults JSON 只记录初始百分比，不记录这两个运行时字段——无法从 `--schema --full` 发现。**诊断方法**：UI 改一次尺寸后 query_page，看 `outRadius`/`innerRadius` 实际值，再用脚本对应修改这两个字段。（实测 2026-04-28） |
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
```

## 🚨 SQL数据集表名必须来自真实数据库，严禁自行猜测（2026-04-15）

### 事故经过

用户要统计"每年大屏创建数量"，直接假设表名为 `jimu_drag_page`（JeecgBoot 文档中常见写法），实际数据库中该表不存在，导致数据集创建成功但查询无数据。

### 强制规则

| 规则 | 说明 |
|------|------|
| **🚨 严禁自行猜测或编造表名** | 不得用任何"常见命名"、"文档写法"、"经验推断"代替真实表名 |
| **创建SQL数据集前必须先确认表存在** | 通过 pymysql 直连执行 `SHOW TABLES` 或先查询数据源连接信息，确认表名后再写 SQL |
| **数据源连接信息获取** | `datasource_ops.py detail --id <DS_ID>` 可获取 host/port/db/user，再向用户索取密码直连验证 |

### 正确操作流程（强制）

```python
# Step 1: 获取数据源连接信息
# py datasource_ops.py detail API TOKEN --id DS_ID
# → 得到 host/port/db/user，向用户询问密码

# Step 2: pymysql 直连查询实际表名
import pymysql
conn = pymysql.connect(host='...', port=3306, db='...', user='root', password='用户提供', charset='utf8mb4')
cur = conn.cursor()
cur.execute('SHOW TABLES')
tables = [r[0] for r in cur.fetchall()]
# 过滤关键词（drag/page/bi/screen/report 等）找目标表
drag_tables = [t for t in tables if any(k in t.lower() for k in ['drag','page','screen','report'])]
print(drag_tables)

# Step 3: 确认表存在 + 确认字段后再写 SQL
cur.execute('DESCRIBE onl_drag_page')
# 验证有 create_time 字段后再写 SELECT YEAR(create_time) ...
```

### 实际表名对照（JeecgBoot 大屏模块，2026-04-15 确认）

| 功能 | 实际表名（非猜测） |
|------|----------------|
| 大屏页面 | `onl_drag_page` |
| 大屏组件 | `onl_drag_comp` / `onl_drag_page_comp` |
| 大屏数据集（头） | `onl_drag_dataset_head` |
| 大屏数据集（字段） | `onl_drag_dataset_item` |
| 大屏分享 | `onl_drag_share` |

---

## 🚨 dataset_ops.py edit 不写入字段列表，必须用自定义脚本（2026-04-15）

### 问题描述

用 `dataset_ops.py edit --sql "..."` 修改 SQL 后，数据集字段列表（`datasetItemList`）为空，前端图表数据映射全部失效，组件无法正常显示数据。

### 根因

`dataset_ops.py edit` 命令不支持 `--fields` 参数，只更新 SQL 不写字段，导致数据集字段为空。

### 强制规则

| 场景 | 正确做法 |
|------|---------|
| **修改 SQL 的同时必须更新字段列表** | 禁止只调 `dataset_ops.py edit --sql`，必须同时写入 `datasetItemList` |
| **使用自定义脚本** | `queryById` 取实体 → 设置 `ds['querySql']` + `ds['datasetItemList']` → `edit` 保存 |

### 正确模板

```python
r = bi_utils._request('GET', '/drag/onlDragDatasetHead/queryById', params={'id': DS_ID})
ds = (r.get('result') or {})
ds['querySql'] = 'SELECT YEAR(create_time) as name, COUNT(*) as value FROM onl_drag_page ...'
ds['datasetItemList'] = [
    {'fieldName': 'name',  'fieldTxt': '年份', 'fieldType': 'String',  'izShow': 'Y', 'orderNum': 0},
    {'fieldName': 'value', 'fieldTxt': '数量', 'fieldType': 'Integer', 'izShow': 'Y', 'orderNum': 1},
]
bi_utils._request('POST', '/drag/onlDragDatasetHead/edit', data=ds)
```

---

## 🚨 JRing 不显示：缺少 `series[0].type:"pie"`（实测 2026-04-28）

### 问题描述

用 spec_builder 生成的 JRing（环形图）完全不渲染，UI 手动拖入的 JRing 正常显示。

### 根因

**直接原因**：`option.series[0].type:"pie"` 缺失。ECharts 靠 `type` 判断图表类型，没有 `type` 时什么都不渲染。

UI 拖入的组件默认 JSON 里带 `series[0].type:"pie"`；spec_builder 早期生成的没有 → 渲染失败。

**次要发现（理解 ring.vue 行为，非 bug）**：

ring.vue 在初始化时会**硬覆盖** ECharts 的 series 属性：
```js
// ring.vue line 98 — 从 option.grid.left/top 计算中心（百分比）
chartOption.series[0].center = [(option?.grid?.left || 50) + '%', (option?.grid?.top || 50) + '%']
// ring.vue line 102 — 从 option.outRadius/innerRadius 计算半径（像素值）
chartOption.series[0].radius = [option?.innerRadius || 60, option?.outRadius || 100]
```

因此：
- `series[0].radius/center` 写百分比无效，实际由 `option.outRadius`/`option.innerRadius`（px）和 `option.grid.left/top`（数字视为百分比）控制
- 默认 `outRadius=100` 在矮容器（h≤200）中会撑满容器，被 title 覆盖显得"消失"

### spec_builder 已内置的规则（fix 2026-04-28）

短容器 h<260：
- `series[0].type = "pie"`（必须）
- `outRadius = max(20, int(h*0.55)-37)`，`innerRadius = outRadius*0.55`
- `grid.left = 38`（图例右置时环心左移），`grid.top = 50`
- `legend.orient = "vertical"`，`legend.right = "2%"`

正常容器 h≥260：
- `series[0].type = "pie"`（必须）
- `outRadius = max(30, int(h*0.35))`，`innerRadius = outRadius*0.6`
- `grid.left = 50`，`grid.top = 46`

### 手动修复已有组件

```python
opt['series'] = [{"type": "pie", "label": {"show": False}, "labelLine": {"show": False}}]
opt['outRadius'] = 73    # max(20, int(h*0.55)-37)，h=200 时
opt['innerRadius'] = 40  # max(10, int(73*0.55))
opt['legend'] = {"orient": "vertical", "right": "2%", "top": "middle", "left": "auto"}
opt.setdefault('grid', {}).update({'left': 38, 'top': 50})
```

---

## 🚨 ECharts option 的 formatter 字段禁止写 JS 函数字符串（实测 2026-05-20，出现两次）

### 问题描述

在 JBar / JLine / JPie 等标准 ECharts 组件的 `option` 中，将 `xAxis.axisLabel.formatter`（或 `yAxis`、`tooltip`、`label` 等的 formatter）设为 JavaScript 函数字符串，如：

```python
cfg['option']['xAxis']['axisLabel']['formatter'] = "function(v){return v.split('::').pop();}"
```

保存后，x 轴标签会把整个函数字符串原文渲染出来，图表无法正常显示标签。

### 根因

ECharts 5 的 `setOption()` 接收纯 JSON 对象。当 `formatter` 是字符串时，ECharts 将其视为**模板字符串**（占位符形如 `{value}`、`{a}`、`{b}`），**不会 eval / new Function**。JeecgBoot 大屏平台在传入 ECharts 之前也不做函数字符串预处理，因此函数代码被当作模板原文展示。

### 正确做法（按场景选一）

| 场景 | 正确做法 |
|------|---------|
| 截取 / 拼接显示值 | **在 SQL 中处理**：用 `CONCAT`、`SUBSTRING_INDEX`、`CASE WHEN` 等让返回的 `name` 字段本身就是可读值，不依赖 formatter |
| 加单位（静态） | ECharts 模板字符串：`"formatter": "{value}元"` 或 `"formatter": "{b}: {c}%"`（合法） |
| 钻取编码值显示 | 用可读分隔符（如 `/`）让编码值本身可读（"华东区/销售一部"），无需 formatter 二次处理 |
| 确实需要动态逻辑 | 改用 **`JCommon` 组件**（菜单"通用组件"），其 `customOption` 是 JS 字符串，平台会执行，可以写真正的函数 |

### 速查：哪些 formatter 写法合法

```python
# ✅ ECharts 模板字符串（合法）
cfg['option']['yAxis']['axisLabel']['formatter'] = '{value}万元'
cfg['option']['tooltip']['formatter'] = '{b}: {c}%'

# ✅ JCommon 组件的 customOption（唯一可写函数的地方）
cfg['customOption'] = """
option = {
    xAxis: { axisLabel: { formatter: function(v){ return v.split('/').pop(); } } }
};
return option;
"""

# ❌ 所有标准组件（JBar/JLine/JPie 等）的 option 内禁止写函数字符串
cfg['option']['xAxis']['axisLabel']['formatter'] = "function(v){...}"  # 原文显示
```

---

## JGroup 弹窗子组件限制：必须直接注入 option；passthrough 自定义组件无法挂载（实测 2026-05-21）

**触发场景 A — 图表空白**：在弹窗 JGroup 内放 JLine/JBar 等图表，chartData 有数据但图表完全空白。

**触发场景 B — 表格无数据**：在 JGroup 内放 JScrollList_3、JScrollTable 等 passthrough 自定义组件，渲染结果为完全空白或乱码。

**根因**：
- JGroup 内子组件直接使用 `config.option`（ECharts 原生 option），不走平台 "chartData → series/xAxis.data" 自动处理流程。
- Passthrough 自定义组件（JScrollList/JScrollTable 等）的 Vue 组件实例在 JGroup 弹窗上下文内无法正常挂载。

**正确做法**：
1. **ECharts 类子组件**（JLine/JBar/JPie 等）：在 `config.option` 中直接注入完整的 series 数据和 xAxis.data。
2. **JScrollBoard（builtin handler）**：可用于弹窗内，但 chartData/option 格式必须严格正确（见下方专项说明）。
3. **其他表格类**（JScrollList/JScrollTable，passthrough）：改用 `JCommon + customOption`（ECharts graphic API 绘制表格）。

```python
# ✅ JLine 在弹窗内：option 中直接注入完整 series
cfg['option'] = {
    'xAxis': {'type': 'category', 'data': sh},    # 真实 x 轴数据（非 []）
    'series': [
        {'name': '服装', 'type': 'line', 'data': cl, 'smooth': True},
        {'name': '电子', 'type': 'line', 'data': el, 'smooth': True},
    ],
}
# chartData 保留但不影响渲染（JGroup 内不被处理）

# ✅ 弹窗内滚动表格：用 JScrollBoard（builtin handler，可挂载）
# 见下方"弹窗内 JScrollBoard 正确写法"章节

# ✅ 弹窗内表格（passthrough 替代方案）：JCommon + graphic
custom_js = """
var rows = [['01','李某某','08:23','虚假宣传','王监察','1.5小时','已退款'], ...];
var hdr = ['序号','被投诉人','投诉时间','投诉原因','处理人','处理时长','处理结果'];
var els = [];
[hdr].concat(rows).forEach(function(row, ri) {
    var bg = ri===0 ? '#1a3a5a' : (ri%2===1 ? '#050e1a' : '#0d2235');
    els.push({type:'rect',left:0,top:ri*38,right:0,height:37,style:{fill:bg}});
    row.forEach(function(cell, ci) {
        els.push({type:'text',left:colX[ci],top:ri*38+12,
            style:{text:cell,fill:ri===0?'#FFD700':'#d4e8ff',fontSize:ri===0?13:12}});
    });
});
option = {backgroundColor:'transparent', graphic:{elements:els}};
return option;
"""
# 子组件 config:
# {'component': 'JCommon', 'config': {'customOption': custom_js, 'option': {}, ...}}

# ❌ 禁止在 JGroup 内放 JScrollList/JScrollTable（passthrough，无法挂载，空白或乱码）
# ✅ JScrollBoard 有 builtin handler，可以在弹窗内正常渲染（但格式必须正确，见下方）
```

---

## 弹窗内 JScrollBoard 正确写法：chartData=纯二维数组，列头放 option.header（实测 2026-05-21）

**触发场景**：在 JGroup 弹窗内放 JScrollBoard 滚动表格，组件可见但完全无数据（列配置为空，表格空白）。

**根因**：手写 popup 子组件不经过 spec_builder，容易把 chartData 写成 `{"columns": [...], "rows": [...]}` 对象。但 JScrollBoard 的 `chartData` 只认**纯二维数组**（rows only），列定义必须写在 `option.header`，不是 `option.columns`。

**正确写法**：

```python
header_cols = [
    {"label": "序号",    "key": "", "width": 50},
    {"label": "被投诉人","key": "", "width": 90},
    {"label": "投诉时间","key": "", "width": 130},
    {"label": "投诉原因","key": "", "width": 160},
    {"label": "处理人",  "key": "", "width": 80},
    {"label": "处理时长","key": "", "width": 80},
    {"label": "处理结果","key": "", "width": 100},
]

rows_data = [
    ["1", "张明华", "06-18 08:12", "商品破损", "李晓燕", "1.5h", "已解决"],
    ["2", "王芳",   "06-18 08:35", "发货延迟", "赵伟",   "2.0h", "已解决"],
    # ... 更多行
]

cfg['chartData'] = json.dumps(rows_data, ensure_ascii=False)  # ← 纯二维数组

cfg['option'] = {
    'header':      header_cols,      # ← 列定义在 option.header，不是 option.columns
    'headShow':    True,
    'index':       False,
    'headerBGC':   '#1a2a4a',
    'headerHeight': 36,
    'oddRowBGC':   '#0d1b2a',
    'evenRowBGC':  '#122030',
    'rowNum':      10,
    'waitTime':    2000,
    'carousel':    'single',
    'hoverPause':  True,
    'headFontSize': 13,
    'bodyFontSize': 12,
}
```

**错误写法（导致列配置为空、表格无数据）**：
```python
# ❌ chartData 不能是对象
cfg['chartData'] = json.dumps({'columns': header_cols, 'rows': rows_data})

# ❌ 列定义不能放在 option.columns
cfg['option'] = {'columns': header_cols, 'rows': rows_data}
```

---

## JStatsSummary：单位字段是 `suffix` 不是 `unit`，compareState 必须用 `"1"`/`"0"`（实测 2026-05-21）

**触发场景**：手写 chartData（绕过 spec_builder 直接 patch）时，KPI 数值正常显示但单位消失，或 spec_builder 建屏后再 patch 时单位/涨跌方向不生效。

**根因**：  
- 单位字段名称是 `suffix`，不是 `unit`（defaults/JStatsSummary_1.json 实测）。写 `unit` 不报错但静默忽略。  
- `compareState` 在 chartData 里必须是字符串 `"1"`（上涨）/ `"0"`（下跌），写 `"up"`/`"down"` 无效（spec_builder 会自动转换，直接写 chartData 不会）。  
- 同比/环比标签字段是 `compareLabel`（如 `"同比"`），缺少时箭头旁无文字。

**正确写法**：
```python
new_data = [
    {"name": "累计GMV", "value": 4.82, "suffix": "亿元",
     "compareValue": "35.2%", "compareState": "1", "compareLabel": "同比"},
    ...
]
cfg['chartData'] = json.dumps(new_data, ensure_ascii=False)
```

**禁止**：`"unit": "亿元"`（静默无效）、`"compareState": "up"`（直接写 chartData 时无效）。

---

## JFlyLineMap：`{from/to}` 城市名简写不可靠，必须传完整经纬度坐标（实测 2026-05-21）

**触发场景**：用 `{"from": "上海", "to": "杭州", "value": 3200}` 格式写飞线数据，大屏显示为同心圆气泡群而非飞线地图。

**根因**：  
- 平台内置城市坐标查找表在 spec_builder 生成时可能未正确触发 fromLng/fromLat 解析，handler 将数据当作散点气泡处理。  
- `value` 值过大（如 3200）会直接映射为气泡半径，导致覆盖全图的超大圆圈。

**正确格式**（必须提供完整经纬度）：
```python
flyline = [
    {"fromName": "上海", "fromLng": 121.47, "fromLat": 31.23,
     "toName":   "杭州", "toLng":   120.15, "toLat":   30.28, "value": 320},
    ...
]
```

**value 取值范围**：建议 100–420，过大（>1000）气泡会遮盖地图，过小（<50）飞线不可见。

**禁止**：`{"from": "城市名", "to": "城市名", "value": 大数值}` 格式（表面可解析，实际渲染为气泡散点图）。

---

## JScrollList variant=3：fieldMapping.key 必须手动对齐数据字段名（实测 2026-05-21）

**触发场景**：spec_builder 建好库存预警类滚动列表后，显示的是默认演示数据（如"车牌号/违规次数"），自定义数据不渲染。

**根因**：spec_builder 从 `defaults/JScrollList_3.json` 读取默认 fieldMapping，其 `key` 是演示字段名（如 `id`/`name`/`type`），与用户自定义数据的字段名不一致，渲染引擎找不到对应列。

**正确做法**：建屏后必须 patch option.fieldMapping，将每一项的 `key` 改为实际数据的字段名：
```python
opt['fieldMapping'] = [
    {"key": "gname",  "name": "商品名称", "width": 220, ...},
    {"key": "gstock", "name": "剩余库存", "width": 100, ...},
    {"key": "geta",   "name": "预计售罄", "width": 100, ...},
]
cfg['chartData'] = json.dumps([
    {"gname": "限量版礼盒", "gstock": "12件", "geta": "~5分钟"},
    ...
], ensure_ascii=False)
```

`fieldMapping.key` 必须和 chartData 每条记录的 JSON key 完全一致（区分大小写）。

---

## JColorBlock：value 必须是纯整数/浮点数，字符串格式导致 NAN（实测 2026-05-21）

**触发场景**：直播间实时数据等 JColorBlock 组件显示 "NAN"，而非期望的数值。

**根因**：JColorBlock 渲染时对 `value` 调用 `Number()` 转换。字符串格式（含逗号 `"128,500"`、中文单位 `"238万"`、百分号 `"18.6%"`）均返回 `NaN`。

**正确写法**：
```python
new_data = [
    {"name": "当前在线人数", "value": 128500,   "backgroundColor": "#1a2860"},
    {"name": "累计观看人次", "value": 2380000,  "backgroundColor": "#1a2860"},
    {"name": "直播间GMV",   "value": 34200000, "backgroundColor": "#3a1a2a"},
]
```

若需显示带单位的文字，用 `JStatsSummary`（支持 `suffix`）替代，或在 `name` 字段里注明单位（不影响 value 解析）。

**禁止**：`"value": "128,500"`、`"value": "238万"`、`"value": "3,420万"` 等任何非纯数字字符串。

---

## JBar/JLine 等图表组件：spec 写 `option.series` 只含 itemStyle，柱体/折线消失（实测 2026-05-21）

**触发场景**：spec JSON 里写了 `"option": {"series": [{"itemStyle": {"color": "#FEF08A"}}]}`，大屏 X 轴标签正常，但柱体完全消失。

**根因**：  
前端 JBar handler 发现 `option.series` 已存在时，不再从 chartData 自动填充 `series.data`：
- `xAxis.data` 单独从 chartData.name 解析 → 正常（所以 X 轴标签有）
- `series.data` 依赖 `option.series` → 只有 itemStyle，无 type/data → 柱体空白

**正确做法（二选一）**：

① 只改颜色 → 用 `option.color`，**禁止写 option.series**：
```json
"option": { "color": ["#FEF08A"] }
```

② 必须自定义 series → 包含完整 `type + data + itemStyle`，data 从 chartData 取值：
```python
chart_data = json.loads(cfg['chartData'])
values = [d['value'] for d in chart_data]
cfg['option']['series'] = [{
    'type': 'bar',
    'data': values,
    'itemStyle': {'color': '#FEF08A'}
}]
```

**禁止**：`"option": {"series": [{"itemStyle": {"color": "..."}}]}`（缺 type/data 的残缺 series）

适用组件：JBar / JLine / JSmoothLine / JArea / JStackBar / JMultipleBar 等所有 ECharts builtin 组件。

**禁止**：`"value": "128,500"`、`"value": "238万"`、`"value": "3,420万"` 等任何非纯数字字符串。
