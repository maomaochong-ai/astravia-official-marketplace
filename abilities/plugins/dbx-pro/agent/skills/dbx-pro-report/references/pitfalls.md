# 已知坑点速查

遇到报错先查「症状速查」，用 `Read(offset=N, limit=40)` 只读该节，**禁止每次全读**。

## 症状速查

| 现象 / 关键词 | 节 | offset |
|-------------|-----|--------|
| 预览全空 / `#{}` 不渲染 / dbCode / jsonData / fieldList / save_db 报错 | §数据集保存 | 15 |
| 图表空白 / extData / series / apiStatus / colors / qurest | §图表渲染 | 60 |
| 图表重叠/覆盖表格 / 折线图盖住表头 / chart row=1 / chart_bottom 位置 / virtualCellRange | §图表渲染 | 60 |
| 样式不生效 / border / merge / merges / col0 / align / 留白 | §样式布局 | 88 |
| GBK崩溃 / ModuleNotFoundError / python -c / deadlock / sleep 浪费 | §脚本执行 | 115 |
| 404 / 签名失败 / Session / report_urls / make_designer / 参数名 | §API接口 | 138 |
| Access denied / 连接失败 / dbSource / 密码 / 建表库不对 | §数据库数据源 | 176 |
| ES Object not found / parse failed / Calcite 保留字 / position 转义 / creator 不适用 ES / es. 前缀 | §数据库数据源 | 176 |
| 循环块不展开 / loopBlock / 主子表错位 / zonedEdition / loopTime | §循环块分组 | 189 |
| UPPER / CEIL / DBSUM / LIKE / FreeMarker / widgetType / 下拉控件 / 范围查询控件不渲染 / searchMode=2 / update_db snake_case | §表达式查询控件 | 210 |
| 执行太慢 / 多读文件 / 一键脚本被拒后重发 | §执行效率 | 226 |
| 明细报表合计行 / funcname 无效 / 计算规则 / filterNegative / 合计行不出现 | §数据集保存 | 15 |
| 套打背景图不显示 / imgList / bgImg / commonBackend / 套打设置面板空白 | §套打背景图 | 292 |
| 钻取明细数据无过滤 / 参数名猜测 / leibie / category / API 钻取传参不生效 | §数据集保存 | 15 |

---

## §数据集保存

| 坑 | 现象 | 解决 |
|----|------|------|
| dbCode 格式非法 | 预览全空、保存异常或绑定失败 | dbCode 规则：**只含字母和数字，且不能以数字或 `_` 开头**；推荐字母开头驼峰如 `employeeDs`；**禁止** `gen_code()` 直接作为 dbCode（它生成纯数字串）；**禁止** JS/Java 保留字（`return/for/if/while` 等）；**禁止** `_/-/.` 等特殊字符 |
| rows/cols 被 json.dumps | 设计器空白 | 只 dumps designerObj，rows/cols/styles 传 dict |
| isPage:"1" + 分组 | 合并/合计不完整 | 分组报表数据集 isPage:"0" |
| dbSource 传名称不传 ID | 数据源下拉不显示 | 先 getDataSourceByPage 查 ID |
| SQL 数据集 dbSource 留空 | 界面看不出用哪个库 | SQL 数据集必须传 `dbSource` 数据源 ID |
| customRows 缺 datasetCode | build_table_rows 报 KeyError | 即使用 customRows，table 里也必须有 `"datasetCode":""` 占位 |
| 文件数据集 dataType 写 "sql" | 图表空白，报 "reportDb is null" | 文件数据集（dbType=5/6）chart_entry 必须传 `data_type="files"` |
| 文件数据集(dbType=5) fieldList 丢失 | UI「字段名」列全空，图表不渲染 | 拿到 db_id 后立即做第二次 `/saveDb`（payload 加 `"id": db_id`）；条目必须带 `fieldNamePhysics` |
| save_db 重复创建 | 多次运行后出现多个同名数据集 | 更新时必须传 `db_id=<已有ID>`；`save_db` 不传 id 始终 INSERT 新行 |
| save_db 返回值误用 | `r["result"]["id"]` TypeError | `save_db()` 直接返回 ID 字符串，直接 `db_id = save_db(...)` |
| save_db 修改已有仍新增 | 每次调 save_db 都 INSERT 新行 | **更新**已有数据集用 `update_db(session, db_id, ...)`，而非再次调 save_db |
| 修改数据集单个字段用 save_db 全量重传 | 代码繁琐 | 用 `update_db(session, db_id, isPage="1")`；内部先取回原始数据，只改指定字段 |
| update_db 传新 paramList 没带原项 id | 响应 `success:true` 但 dbDynSql/paramList 都没落库 | 后端按 `(jimuReportHeadId + paramName)` 唯一约束 INSERT 冲突 → 整事务回滚连带 dbDynSql 也丢。**新 paramList 含与原表同 paramName 的项必须保留原 id**；`update_db` 已自动按 paramName 回填原 id，但手写 `/saveDb` payload 时务必自查 |
| paramList `searchMode` 与 SQL 自写条件**重复处理**导致查询失效 | 模糊查不到、日期范围报 `Incorrect DATE value: ''` 等 | **当 SQL 里自己用 FreeMarker `${param}` + `IFNULL/NULLIF` 兜底处理空值时，paramList 的 `searchMode` 一律留 null（不设）**——不让引擎对值做任何加工。误用现象：`searchMode=5`（模糊）引擎会自动给值加 `%`，跟手写 `LIKE CONCAT('%','${x}','%')` 重复加；`searchMode=2`（日期范围）引擎把空值渲染成 `''` 字面量塞进 SQL（不是 `?` 占位绑定），`IFNULL('', default)` 抓不住空串报 `Incorrect DATE value`。**日期范围必须拆成两个独立参数 `xxx_begin` / `xxx_end`（widgetType=date，searchMode=null）**，别用 `searchMode=2` 让引擎自动拆。模板：`WHERE col LIKE CONCAT('%', IFNULL(NULLIF('${col}', ''), ''), '%') AND date_col >= IFNULL(NULLIF('${date_begin}', ''), '1900-01-01') AND date_col <= IFNULL(NULLIF('${date_end}', ''), '9999-12-31')` |
| JSON json_data 传 list/dict | `Cannot deserialize value of type java.lang.String` | 必须 `json.dumps({"data": raw_list}, ensure_ascii=False)`；`json_data` 是**字符串** |
| JSON jsonData 单对象而非数组 | 字段解析失败或预览无数据 | 必须 `{"data": [...]}`，即使只有一条也包在数组里 |
| JSON jsonData 裸数组 | `#{db.field}` 全部为空 | 引擎从 `data` 键取行；裸数组找不到 `data`，全空；正确：`{"data": [...]}` |
| JSON 数据集绑定多系列/数组值图表 | legend 显示 undefined，只渲染一个点 | scatter.bubble/radar 等复杂静态数据必须用 `_NONE()`（不绑数据集），config 里的静态数据才能直接渲染 |
| **API 数据集 YApi mock 未加 data 包裹** | 字段无法解析或预览无数据 | 无论 `isList:"0"`（对象）还是 `isList:"1"`（集合），mock 返回数据必须包裹在 `{"data": [...]}` 中；对象类型引擎取 `data[0]`，集合类型取整个 `data` 数组；直接返回裸对象/裸数组均导致字段解析失败 |
| **条件隐藏行用 rowcolor() 实现** | 行仍占空间，视觉残留，非真正隐藏 | 必须用 `hidden.conditions.rows`：`base_save(..., hidden={"rows":[],"cols":[],"conditions":{"rows":{"rowIdx:rowIdx":"dbCode.field>value"},"cols":{}}})`；key 格式为 `"行索引:行索引"`（0-indexed），value 为不带 `=` 的条件表达式；单元格内容保持正常绑定，无需任何表达式 |
| API 分页缺分页参数 | 不分页或字段解析失败 | api_url 末尾带 `?pageSize='${pageSize}'&pageNo='${pageNo}'`，param_list 加两条 searchFlag=0 分页参数，默认值不能留空 |
| API 数据集图表调 /qurestSql | 返回 0 行 | API 数据集必须调 `/qurestApi`，返回值路径 `resp["result"]["data"]`；SQL 才用 `/qurestSql` |
| save_db 省略 field_list | TypeError（必填参数缺失） | 第6个位置参数 field_list 为必填；每个字段含 `fieldName/fieldText/widgetType/isShow/isQuery` |
| paramList 字段键名用 fieldName/fieldTxt | `Column 'param_name' cannot be null` | 正确键名：`paramName/paramTxt/paramValue/searchFlag/widgetType/searchMode` |
| JavaBean 数据集 dbType 用 "0" | 显示为「SQL数据集」而非「JavaBean数据集」 | dbType 必须 **"2"**；chart_entry data_type 必须 **"javabean"** |
| SQL field_list=[] 传空 | 字段明细「暂无数据」，图表无法绑定 | 先调 `parse_sql(session, sql, db_source=ds_id)` 拿字段列表再传给 save_db |
| **SQL 数据集未验证表存在性**（含用户自定义表名） | 报表创建成功但预览空白；或 `parse_sql` 返回空字段列表 | **无论表名来自文档示例还是用户指定，一律必须**：① `resolve_db_source` 取数据源 ID → ② `get_ds_connection(session, ds_id)` 取 MySQL 凭证 → ③ `execute_ds(session, ds_id, "SHOW TABLES LIKE 'xxx'")` 验证表存在 → 不存在则先建表（含字段定义）并插测试数据 → ④ 表存在但 `COUNT(*)=0` 也须插测试数据 → ⑤ 再调 `parse_and_save_dataset`。**此流程对所有 SQL 类报表强制，不得跳过** |
| **API 数据集钻取参数名假设错误** | 钻取到明细报表后数据无过滤，全量显示 | 用户已提供 API URL 时，**不得假设参数名**（如 `?leibie=` / `?name=` 等）。必须先用不同参数名实际 HTTP 调用 API，对比返回条数，确认哪个参数名触发过滤后，再写 `api_url=...?param=${param}` 和 `paramList`。测试示例：`urllib.request.urlopen(url + '?category=' + enc)` 与无参数返回条数对比；条数减少即为正确参数名 |

---

## §图表渲染

| 坑 | 现象 | 解决 |
|----|------|------|
| map.simple 图表背景色设置 | 首次创建时 ECharts config 根级的 `backgroundColor` 被后端过滤丢失；`backgroud.enabled/color` 在初次创建时未启用则无效 | 正确做法：**创建时**设 `"backgroud": {"enabled": True, "color": "#颜色值", "image": ""}` 来启用容器背景色；**patch 已有报表时**用 `get_report` → 修改 `chart["backgroud"]["enabled"]=True` 并同时在 config 根级加 `"backgroundColor":"#颜色值"` → `base_save` 回写，两者均可持久化 |
| 图表 linkIds 放顶层 | 钻取/联动无效 | 放 extData 内部 |
| 联动目标图表无默认值 | 初始页面图表空白 | paramList 必须设 paramValue |
| bar.multi 用 apiStatus:"1" | 图表渲染异常 | 静态数据必须用 apiStatus:"0" |
| paramValue 用图表字段名 | 图表钻取无值 | 用 name/value/seriesName |
| 图表 extData.id 为 None | 预览图表不渲染/消失 | `chartId` 和 `id` 必须同时赋值为 `layer_id` |
| 只改 `color[]` 设置颜色 | 颜色不生效 | 饼图改3处(data[i].itemStyle/label/colors[])，柱形图改2处(series[i].itemStyle/colors[]) |
| **用切片/改数据集类型限制图表数据条数** | 数据集被破坏，API 类型变 JSON 后动态查询失效 | **⚠️ 禁止**改数据集类型或切片数据；图表 config 根级设 `"dataFilter":{"filterCount":N}`，对应 UI「数据过滤→显示X轴前N项」，引擎渲染时自动截取 |
| **横向图/象形图 xAxis 缺 `"type":"value"`** | `parallel_fill_charts` 把分类名称错误填入 xAxis，柱子全挤左侧 | 象形图/横向柱图 xAxis **必须**显式写 `"type":"value"`，yAxis 显式写 `"type":"category"`；fill 逻辑优先用 yAxis.type=="category" 正向判断，缺省 type 会误命中 xAxis 分支 |
| 象形图 symbol URL 拼错 | 图标看不到 | upload 返回 `message="jimureport/x.png"`；symbol 写 `f"image://{BASE_URL}/img/{message}"` |
| 象形图用 symbolClip 补全 | 补全不生效 | 补全背景虚影用 `"double": True`，不是 symbolClip |
| 雷达图 series 传空字符串 | 系列属性「请选择」，legend 显示 undefined | SQL `'' AS type` 只是占位，chart_entry series 仍必须填 `"type"` |
| 雷达图 legend.data 为空数组 | 图例空白方块 | `legend.data` 必须预填系列名列表，引擎不自动填充 |
| 雷达图 SQL type 字段传空字符串 | 图例空白、tooltip 显示 series0 | 必须传实际名称如 `'综合评分' AS type`，与 legend.data 和 series[].data[].name 三处一致 |
| 单系列图表 series 传了 "type" | 预览不自动加载，需手动点「运行」 | 单系列图表 series 必须传 `""`；"type" 仅用于多系列且数据集有该字段时 |
| 多系列图表 series 为空数组 | 所有带 type 字段图表全部空白 | 所有多系列图表 series 必须提供至少一个带 itemStyle 的占位条目，禁止 `"series":[]`；水平堆叠图分类数据写 yAxis 不写 xAxis |
| graph.simple 误配 extData | 绑数据集/设 apiStatus 导致图表不渲染 | extData 只需 `{"chartId":layer_id,"chartType":"graph.simple"}`；节点+边全部内嵌 config；不需要数据集 |
| bar.background extData.chartType 写错 | 柱体数据全部消失 | extData.chartType 保持 `bar.simple`；带背景只在 echarts series 层配 showBackground |
| API 图表字段名不是 name/value | 设计器「运行」后图表空白 | extData 设 `"isCustomPropName": True`，`xText` 设实际分类字段名，`yText` 设实际值字段名 |
| JavaBean 图表调 /qurestSql 回填 | 返回 result:null | JavaBean 不支持设计态填充；/qurestSql/Api/Bean 均无效；**创建 JavaBean 图表时跳过回填** |
| SQL 图表 config 无初始数据 | 设计器 ECharts 空白 | 创建 SQL 图表后必须调 `/qurestSql` 回填：转换后写入 config.xAxis.data/series[i].data/legend.data 再 /save |
| **JSON 数据集图表不传 json_records_map** | 预览图表全部空白（只显示标题文字）| `parallel_fill_charts` 无 JSON 查询接口，默认跳过 dbType=3 图表。**必须传** `json_records_map={dbCode: records}` 触发本地填充，或在 `chart_entry` 前手动预填 ECharts config（xAxis.data / series[0].data / legend.data）。静态内嵌数据（scatter/radar/graph/map）设 apiStatus="0" + _NONE() 不受此影响 |
| SQL/API 散点图用 `parallel_fill_charts` 回填 | scatter.simple 只见一行点贴在 y 轴/x 轴；scatter.bubble 多系列错位 | `parallel_fill_charts` 默认把单系列图按 `cfg.series[0].data = y_data`（1D）回填，散点图 data 必须是 `[[x,y], ...]` 二元对。**scatter.simple / scatter.bubble 必须自定义回填**：单系列 `series[0].data = [[r[axisX], r[axisY]] for r in rows]`；多系列按 series 字段分组，每系列独立 `[[x,y]]` 数组并设 `legend.data` |
| 图表「启用背景」只改 `chart.backgroud` | 背景色 UI 显示已启用但实际渲染没出现 | 图表背景**存两份**且必须同步：`chartList[i].backgroud.color`（积木存储字段，注意拼写少 n）+ `config.backgroundColor`（ECharts 根级，**真正控制渲染**）。设计器 UI 手动改时两处自动同步；AI 走 patch 必须**两处一起写**，否则 backgroud.enabled=true 也不出效果。颜色支持 `#hex` / `rgba(r,g,b,a)` |
| **map.scatter `geo.map` 用了 `"100000"`** | 预览页面图表完全空白（设计页正常）；`"100000"` 是 `map.simple` 区域地图的内部编码，ECharts 不识别 | `map.scatter` 的 `geo.map` 必须用 `"china"`（字符串）；同时**禁止**带 `mapCode/mapName/mapLevel/mapType` 字段——这四个字段是 `map.simple` 专用，加在 `map.scatter` 上会导致地图无法加载 |
| **图表 row 行号与数据行展开冲突（重叠/折叠）** | 图表标题或内容叠加在数据行上，图表和表格混在一起 | 图表 `row` 是**绝对坐标**，数据行展开时不推移其他行，而是直接用后续行号填充。例如数据行在 row=4，共4条数据，实际占用 row=4~7；图表若设在 row=6 则与第3条数据重叠。**正确做法**：`chart_start_row = 数据起始行 + max_data_rows + 缓冲`（至少 +3）。分页时用 `chart_start_row = 数据起始行 + page_size + 缓冲`。virtualCellRange 只放第一行锚点 `[[chart_start_row-1, 0]]`（0-based） |
| **🚨 图表绝对禁止与表格重叠（chart_bottom/chart_top 布局）** | 折线图/柱图覆盖在标题+表头+数据行之上（图表 `row=1` 落在表头行，按 height(px) 绝对浮动渲染，盖住整张表） | **图表 `row` 必须放在表格所有行（标题+表头+数据，含数据展开行）的下方，不得为 1。** 计算：`chart_row = 表格最后一行索引 + 1`（明细列表含展开则 `+ page_size`）。同时三处必须同步：① `chart["row"]=chart_row`；② `chart["virtualCellRange"]=[[chart_row, c] for c in range(col_start, col_end+1)]`；③ rows 里新增 `rows[str(chart_row)]={"cells":{str(c):{"text":" ","virtual":layer_id} for c in ...}}` 锚定占位 + 图表下方一行留白行。patch 已有重叠报表同此三步。chart_top 同理：表格 row 整体下移到图表 height 对应行数之后 |

---

## §样式布局

| 坑 | 现象 | 解决 |
|----|------|------|
| cell 直接写 align/font/valign | 样式不生效 | 对齐+字体放入顶层 `styles[]` 数组，cell 用 `style` 整数索引引用 |
| color 写在 font 内 | 表头白字不显示 | `color` 必须在 style 顶层与 font/bgcolor 同级：`{"font":{...},"color":"#FFF","bgcolor":"..."}` |
| border 写在 style 顶层（展开写法） | 部分边框方向不渲染 | `bottom/top/left/right` **必须嵌套在 `"border"` key 下**，不能展开到顶层 |
| border 写成 `{"style":1}` 对象格式 | 整张表渲染空白 | border 每个方向必须是**数组**：`["thin","#000000"]`；不能是 `{"style":1}` |
| 表格 styles 未加边框 | 预览无边框 | 所有 style 对象默认必须加 border（底部/顶部/左/右各 `["thin","#BFBFBF"]`） |
| **分组行用静态 merge 做动态合并** | 分组列旁的标签格未合并或错位 | 分组数据行的静态标签列（如"基本信息"）必须用 `"dynamicMerge": 1`，禁止用 `merge:[N,0]`——行数不固定，静态 merge 无效。同时标签列插 col1，group 列从 col2 开始右移，标题 merges 从 C 列起（`"C1:G1"`） |
| merge 不加 merges 顶层数组 | 合并区域在设计器未合并 | cell 设 `merge:[rowSpan,colSpan]` 同时，**必须**在顶层 `merges` 加 Excel 范围字符串（UI 行号=code 行号+1） |
| merge 与 merges 列范围不一致 | 单元格合并只到部分列，右侧留空白 | `merge:[0,4]` 起始列为 C 时应为 `"C?:G?"`；**改 merge 必须同步核查 merges 字符串** |
| 斜线表头 style 含 valign/align | 标签错位，合并单元格内大片空白 | 斜线表头 style **只能有** border+bgcolor+color，**禁止加 align/valign** |
| 报表无左侧留白 | 内容紧贴左边框 | col0 固定 30px 留空白格；标题从 col1 开始合并，merges 写 `"B1:F1"` 不含 A 列 |
| rows dict 缺 "len" key | 设计器列数/行数异常，图表位置偏移 | rows 必须带 `"len": 200`：`{"len": 200, "1": {"height": 25, "cells": {}}, ...}` |
| 同行图表水平重叠 | 左图溢出覆盖右图 | `width`（px）必须 ≤ `colspan × 列宽`；设 width 与列宽必须同步校验 |
| 多行图表垂直重叠 | 下方图表盖在上方图表上 | height=420 实际占≈17行；下一图表 row ≥ 上一图表 row + ceil(height/行高) + 间距（保守估算 row_step=20）；**必须初始化所有行 height=25** |
| loopTime 标题列范围含尾部空白列 | 标题偏窄，右侧留白 | 标题行的 merge 和 merges 不应包含 loopTime 末尾间距列 |
| 主子表列数不统一 | 主表比子表宽，视觉不对齐 | 主表和子表必须使用**完全相同的列范围** |
| 纵横组合缺二级子列表头 | 月份列下无子列标题 | 需4行布局：标题行+双层表头行+数据行；row2 静态表头 `merge:[1,0]` 纵跨2行，groupRight `merge:[0,N-1]` 横跨N子列 |
| 纵横组合 merges 只写标题 | 静态表头不合并，与子列行错位 | 必须同时写 `"B3:B4"` 跨行 + `"D3:F3"` 月份模板跨列，三处缺一不可 |
| groupRight 月份列头字母序错误 | "10月"排在"1月"前面 | 月份字段用零填充：`CONCAT(LPAD(month_no,2,'0'),'月')` → "01月"~"12月" |
| 条件隐藏行/列被同时加到 hidden.rows/cols | 设置后变成"始终隐藏"，条件不生效（永远隐藏） | 条件隐藏**只放** `hidden.conditions.rows` / `hidden.conditions.cols`，**禁止**同时往 `hidden.rows` / `hidden.cols` 列表里加同样的 key——`hidden.rows/cols` 是静态隐藏机制，与条件机制独立，混用会被引擎当成始终隐藏 |
| hidden 范围 key 误用 0-based 物理位置 | 隐藏行/列错位（隐藏了表头而非数据行） | 范围 key 直接对应 `rows` / `cols` dict 的 **key 数字**，不是 0-based 物理位置：rows 从 `"1"` 开始时，rows["2"] → `"2:2"`；cols["2"] → `"2:2"`。详见 `references/misc-config.md` §「隐藏行与隐藏列」 |
| **打印布局默认必须纵向（portrait）** | 用户打开打印设置发现勾选了「横向」而期望「纵向」 | 默认就是纵向，**不要传 `printConfig`**——`base_save` 内置默认 `{"paper":"A4","width":210,"height":297,"layout":"portrait",...}` 已正确。仅当用户**明确**说「横向打印 / 横向布局 / 横版」才覆盖 |
| **横向打印误把 width/height 对调** | 设了 `width=297,height=210` 后，UI「像素宽高」显示与原生勾选横向不一致 | 实测对比 UI 原生勾选纵向 vs 横向两份空白报表：**纵横唯一区别就是 `layout` 字段**（`"portrait"` ↔ `"landscape"`），`width=210, height=297` **永远不变**——引擎按 layout 自行旋转。其他在 landscape 报表里看到的 watermark/header/footer/pagination 字段以及顶层 `dataRectWidth`/`excel_config_id` 都是 UI 其他操作的附带产物，与纵横切换无关，patch 时**不要补**。最小正确 patch：`design["printConfig"]["layout"] = "landscape"` 即可（其他字段一律保留原样） |

---

## §脚本执行

| 坑 | 现象 | 解决 |
|----|------|------|
| Windows Python stdout GBK | `UnicodeEncodeError: 'gbk' codec` 崩溃重试 | 每个脚本开头必须加：`import sys; sys.stdout.reconfigure(encoding='utf-8')` |
| python -c 跑到后台 | 命令自动进入 background，输出丢失 | 永远 Write .py 文件后 `python /path/to/file.py` 执行，禁止 `python -c` |
| 导入 JimuSession / JimuReportSession | `ImportError` 整个脚本挂掉 | 唯一正确写法：`from jimureport_utils import Session, gen_id, gen_layer, make_styles, base_save, save_db, make_designer, chart_entry, virtual_row, print_summary, get_report, report_urls, parallel_save_dbs, ensure_datasource, parse_and_save_dataset` |
| 工具库模块名写错 | ModuleNotFoundError | 正确导入：`from jimureport_utils import Session, gen_id, gen_code, save_db, make_designer, base_save` |
| 脚本走系统代理 | 连接失败 | Session 已封装 trust_env=False |
| 诊断命令用 run_in_background | 用户等待超时 | 诊断/计时命令必须前台同步执行，禁止 run_in_background |
| 脚本多次并发启动 | 连接池耗尽，`Could not open JDBC Connection` | 脚本只启动一次，用一次 TaskOutput(block=true) 等结果；超时后**不要重新启动**，等原进程完成 |
| gen_code() 同秒重复 | INSERT code 唯一键冲突 | 用毫秒+随机：`str(time.time()*1000)+str(random.randint(100,999))`；多报表顺序创建时加 sleep(2) |
| save_db 之间加 sleep | 脚本慢 1~2 秒 | `save_db` 内部用 `gen_id()`（毫秒+随机），同一报表多数据集之间**不需要 sleep** |
| 首次 save 后 sleep | 白白增加延迟 | `/save` 是同步请求，完成即可立即调 `save_db`，不需要 sleep |
| report_tools.py 参数名 | unrecognized arguments | 用 `--base-url`，不是 `--api-base` |
| parallel_save_dbs deadlock | `Deadlock found when trying to get lock`，部分数据集失败 | 多数据集保存改为**串行** `[save_db(session, **a) for a in save_args]` |
| 预调外部 API 验证字段 | 网络慢或超时，白等 | 直接按用户提供的字段写脚本，不预调 API |
| YApi init_yapi() 后 create_mock 报"请登录" | `urllib` 多 Set-Cookie 头只取了第一条 | 已在 `yapi_mock.py` 修复；升级后可正常串联使用 |
| 自写 urllib/requests 调 SIGNED_PATHS | `签名验证失败: 签名参数不存在` | **所有接口必须用 `session.request()` 或 `session.upload()`**；自写 urllib 不带 X-Sign/X-TIMESTAMP，`/queryFieldBySql`、`/executeSelectApi` 等 SIGNED_PATHS 直接返回 1001 签名错误 |
| yapi_mock.create_mock 重复 path | `RuntimeError: 已存在的接口` 中断流程 | `yapi_mock.py` 已修复：errmsg 含「已存在」时自动复用 id |

---

## §API接口

| 坑 | 现象 | 解决 |
|----|------|------|
| Session base_url 缺 /jmreport | `session.request("/save",...)` 返回 404 | 初始化必须传含 `/jmreport` 的完整路径：`http://host:port/jmreport` |
| save 返回值取错路径 | `resp.get("id")` 返回 None | 正确路径：`resp["result"]["id"]` |
| 预览/设计器 URL 用 `?id=` | 页面可能加载但报表为空 | 正确格式：`/jmreport/view/{id}` 和 `/jmreport/index/{id}`（路径参数） |
| getDataSourceByPage GET 签名失败 | `签名校验失败，参数有误！` | GET 签名必须先把 `token` 加入 params，再对完整 params 计算 X-Sign |
| `Session.get('/getDataSourceByPage?pageNo=1')` 签名失败 | 报错 `签名验证失败: 签名参数不存在`；改 POST 又报 405 | **`Session.request` 签名只在 `data` 是 dict 时生效**——把参数拼在 path 里 querystring，函数 `data=None` 直接跳过签名。所有 SIGNED_PATHS（含 `/getDataSourceByPage`、`/getDataSourceById`、`/queryFieldBySql`、`/executeSelectApi`、`/loadTableData`、`/testConnection`、`/dictCodeSearch`、`/download/image`）调用必须用：`s.request('/getDataSourceByPage', {'pageNo':1,'pageSize':100}, method='GET')`，**不能** `s.get('/getDataSourceByPage?pageNo=1')`，**不能**改 POST（接口仅支持 GET，会 405）|
| 改数据源凭密码用 /initDataSource | 取不到 dbUrl/dbUsername/dbPassword，只有 id+name | `/initDataSource` 是免签名简版，仅返回 `id+name`；**修改数据源（重命名/改密码）必须用 `/getDataSourceByPage`** 拿全字段（dbUrl/dbDriver/dbUsername/dbPassword），再 POST `/addDataSource` 带 id 编辑回写 |
| executeSelectApi 调用方式 | 接口不通 | POST + query string，不是 JSON body；result 直接是 fieldList 数组；用 `parse_api(session, url)` |
| 修改已有报表用 `**design` | design 含 name 等字段冲突，图表消失 | 始终显式传 `rows=design['rows'], cols=design['cols'], styles=..., merges=..., chartList=...` |
| rpbar 用 json.dumps 字符串 | 保存成功但预览工具条设置不生效 | rpbar 必须用 **dict 对象**，不能 `json.dumps()`；字段名是 `rpbar` 不是 rqbar |
| get_report 对新报表失败 | 刚 /save 创建的报表调 get_report 返回 None | 改为从 create 响应手动构建 designer dict |
| 只改报表展示配置也调 save_db | 多调一次接口 | 修改 rpbar/样式/合并等**纯报表配置**时，直接 `get_report` → 改配置 → `/save` 两步 |
| get_report 删行后按行号修改 | 行号计算出错，改错行 | 删行/移行后，按 col1 文本内容匹配目标行，而非依赖行号索引 |
| /link/saveAndEdit 参数格式错误 | 关联不生效，子表数据不展开 | 正确格式：`reportId` + `mainReport/subReport`（dbCode别名）+ `parameter`（JSON字符串含 main/sub/subReport 数组）+ `linkType:"4"` |
| make_designer 参数顺序写错 | TypeError 或 id 用了报表名 | 正确签名：`make_designer(report_id: str, name: str, **extra)`；新建时 report_id 传 `""` |
| save_db 参数名用了 db_ch_name | `TypeError: unexpected keyword argument` | 第4个参数名是 `db_name`，不是 `db_ch_name` |
| base_save 用关键字参数传 report_id | `TypeError: missing positional argument` | 前两个是位置参数：`base_save(report_id, designer_obj, **overrides)` |
| report_urls 参数顺序写反 | 预览链接指向错误 id | 正确签名：`report_urls(report_id, base_url, token)`，id 在前 |
| report_urls 返回值当 dict 用 | `TypeError: tuple indices must be integers or slices, not str` | `report_urls` 返回 **tuple**；用 `preview, design = report_urls(...)` 或 `[0]`/`[1]` |
| /save 新建 result.id 为 null | 无法构造预览链接 | 新建时用 `gen_id()` 预生成，`rid = resp["result"].get("id") or report_id` |
| 首次 /save 返回值当字符串 | `str(resp["result"])` 得到整个 dict 字符串 | `/save` 新建时 `resp["result"]` 是 **dict**，需要 `resp["result"]["id"]` |
| 工具函数签名靠记忆 | 运行才发现写错，多轮重试 | 写主脚本前先 `python -c "from jimureport_utils import X; help(X)"` 确认签名 |
| 单报表误用首次占位 /save | 多一次 HTTP | 推荐：`gen_id()` 预生成 report_id → `parse_and_save_dataset(orphan report_id)` → 最终 `/save` 首次创建 |
| DBSUM/DBAVERAGE/DBMIN/DBMAX 不出数 | 预览结果为空，无报错 | `base_save` 必须同时传 `dbexps=["=DBSUM(ds.field)",...]`，修改已有报表用 `dbexps=design.get("dbexps",[])` 透传 |
| 报表存在性验证走错接口 | queryById/reportList 均 404 | 最简验证：`curl http://BASE/jmreport/index/{id}` 返回 HTML 即存在 |
| 猜测不存在的 JimuReport 接口 | 调自造接口返回 404 | 不确定哪个接口时，**直接问用户**或查 references/ 文档，严禁凭感觉拼接路径 |
| SQL 别名已知仍调 parse_sql | 签名失败或中文报错，浪费数十分钟 | SQL 字段别名已确定时，**直接硬编码 fieldList**；`parse_sql` 仅用于别名未知的情况 |
| parse_sql SQL 含中文导致签名失败 | `签名校验失败，请重新登录` | 必须调 parse_sql 时，传**纯 ASCII 简化 SQL**（`SELECT col1 FROM table LIMIT 1`），完整业务 SQL 只传给 save_db |
| queryFieldByBean 返回结构误判 | `AttributeError: 'list' object has no attribute 'get'` | `result` 直接是字段数组（list），不是 `{"fieldList":[...]}` dict；正确：`raw_fields = resp["result"]` |

---

## §数据库数据源

| 坑 | 现象 | 解决 |
|----|------|------|
| DB 凭证未知时猜测 | 连接失败→修改→重试，浪费多轮 | DB host/password 不确定时，写代码前先问用户，1 句话拿到信息比反复重试快 |
| DB 密码错误不立即问 | `Access denied` 后继续猜，耗费多轮 | 首次连接失败且密码来自记忆（可能过时），**立刻停下来问用户** |
| 脚本执行失败猜测数据库配置 | 数据源名称/库名猜错导致多次失败，产生脏数据 | 失败涉及数据库/数据源配置时，**立刻停下来问用户** |
| MySQL Docker 中文乱码 | `docker exec ... mysql` 默认 `character_set_client=latin1`，中文字节被错误编码存入，报表预览显示乱码 | 插入/更新中文数据必须加 `--default-character-set=utf8mb4`：`docker exec <container> mysql -uroot -pXXX --default-character-set=utf8mb4 <db> -e "..."` |
| query_mysql 执行 DML/DDL 数据不落库 | INSERT/DELETE 看似成功但 COUNT 仍为 0 | `query_mysql` 无 commit，只适合 SELECT；写数据必须用 pymysql：`conn.execute(...); conn.commit()` |
| MySQL 密码从 memory 或 get_ds_connection 猜测 | `Access denied` 反复重试 | get_ds_connection 返回的密码可能加密；memory 记录可能过时；**首次失败立刻问用户** |
| 建表数据库与 JimuReport 默认数据源不一致 | `Table 'xxx.table' doesn't exist` | JimuReport 默认数据源连的库才是 dbSource="" 时的目标；**建表必须在该库**，不确定先看 application.yml。指定 dbSource 时先调 `get_ds_connection(session, ds_id)` 确认目标 host/port/db，再决定在哪个 Docker 容器建表 |
| 用户指定 API URL 时擅自调 create_mock | 原有 mock 数据被覆盖 | 用户提供了完整 API URL 直接填 `save_db(api_url=...)`；**禁止**调 init_yapi/create_mock |
| pymysql SUM() 返回 Decimal 导致 json.dumps 报错 | `TypeError: Object of type Decimal is not JSON serializable`，出现在把查询结果直接放入 ECharts config 时 | `cur.fetchall()` 的 SUM/AVG 列返回 `decimal.Decimal`；构建图表初始数据时必须显式转型：`int(r[1])` 或 `float(r[1])` |
| **Redis 数据源 JSON 字段名驼峰不渲染** | 列数据全部为空，其他全小写字段正常 | JimuReport 读取 Redis JSON 时将字段名**强制转小写**；存入 Redis 的 JSON key 必须全小写（如 `productname`），`fieldList` 的 `fieldName` 和单元格绑定 `#{db.fieldName}` 也必须保持全小写一致；驼峰（如 `productName`）会导致绑定失败 |
| **Redis 数据源 `dbType` 用 `"Redis"` 或 `"REDIS"`** | 前端「数据源类型」下拉显示空，驱动类也显示空 | `addDataSource` 的 `dbType` 必须用全小写 **`"redis"`**；`"Redis"`/`"REDIS"` 后端能存但前端枚举匹配失败显示空。完整参数：`db_type="redis", db_driver="redis.clients.jedis.Jedis", db_url="host:port"`（已通过用户手动验证） |
| **MongoDB 数据集 SQL 不加 `mongo.` 前缀** | `/queryFieldBySql` 报 `Object 'xxx' not found`；预览无数据 | MongoDB 数据源的 SQL **必须**用 `select * from mongo.集合名` 格式；直接写 `select * from 集合名` 会被 Calcite 适配器报找不到对象。同时 Calcite 需要集合中至少存在一条文档才能解析字段 |
| **Elasticsearch 数据集 SQL 不加 `es.` 前缀** | 预览无数据或报错 | ES 数据源的 SQL **必须**用 `SELECT * FROM es.索引名` 格式，与 MongoDB 的 `mongo.` 前缀规律一致；直接写 `SELECT * FROM 索引名` 不生效（已通过用户手动验证） |
| **Elasticsearch 数据源 `dbUrl` 含 `http://` 前缀** | `addDataSource` 报完整性约束错误或连接失败 | ES dbUrl 必须只写 `host:port`（如 `192.168.1.6:9200`），**不含** `http://` 前缀和尾部 `/`；`dbDriver` 填 `"/"`，`dbType` 用 `"es"` |
| **Elasticsearch 字段名与 Calcite SQL 保留关键字冲突** | `parse failed: Encountered "position ," at line 1` SQL 解析报错，数据集无法保存 | Calcite 将 `POSITION`/`DATE`/`VALUE`/`TIME`/`TYPE`/`YEAR`/`LEFT`/`RIGHT`/`RANK` 等视为 SQL 函数/关键字；字段名冲突时必须用反引号转义：`` SELECT `position`, `date` FROM es.索引名 ``；`SELECT *` 完全不受影响（不逐列列出，Calcite 不校验列名） |
| **ES/MongoDB/Redis 数据集用普通 `"0"` dbType + 手写 SQL 时忘加 schema 前缀** | `parse_sql` 报 `Object '索引名' not found` | creator 原生支持 `dbType:"es"/"mongo"/"mongodb"/"redis"`，自动补前缀；或在 JSON 配置中用简写字段 `esIndex`/`mongoCollection` 代替写全 SQL；手动写 SQL 则必须带前缀（`FROM es.索引名` / `FROM mongo.集合名`） |

---

## §循环块分组

| 坑 | 现象 | 解决 |
|----|------|------|
| 主子表循环块用两个 loopBlock | 子表不展开 | **只有一个 loopBlockList，db=主表**；子表行（`#{sub.field}`）嵌入同一循环块模板 |
| loopBlockList eri 设太大 | 预览页出现大片空白 | eri 设为**模板内容末行 + 2~3 行缓冲**；引擎按数据量自动扩展 |
| 循环块 db 别名与 dbCode 不一致 | 预览数据全空 | `DB_ALIAS` 必须等于完整 dbCode；单元格 `#{alias.field}`、loopBlockList.db、displayConfig.text 三处保持一致 |
| 分版误用 loopBlockList | 并列多数据集表格数据错乱 | 分版禁止用 loopBlockList；正确：第一个表自然展开，右侧表单元格加 `zonedEdition:N`，顶层加 `zonedEditionList`，loopBlockList 留空 `[]` |
| 多源报表误做成两个独立表格 | 主子字段无法同行显示 | 多源报表 = 同一行混合 `#{aa.*}` 和 `#{bb.*}`；**不需要 loopBlockList**；必须调 `/link/saveAndEdit`(linkType="4") |
| loopTime 标题列范围含尾部空白列 | 标题偏窄，右侧留白 | 标题 merge/merges 不应包含 loopTime 末尾间距列（如 col9） |
| 纵向分组报表缺顶层 isGroup/groupField | 预览报 `For input string: "cells"`（Java NumberFormatException） | 含 `#{db.group(field)}` 时，base_save 必须传 `isGroup=True, groupField="dbCode.fieldName"` |
| 分组聚合列缺少 subtotal:"-1" | funcname:"SUM" 设了但合计行数值空白 | 聚合列必须**同时**设 `funcname:"SUM"` + `subtotal:"-1"`；只设 funcname 不够 |
| 主子表 /link/saveAndEdit 参数格式 | 关联不生效，子表不展开 | 正确格式：reportId + mainReport/subReport（dbCode别名）+ parameter（JSON字符串）+ linkType:"4" |

---

## §表达式查询控件

| 坑 | 现象 | 解决 |
|----|------|------|
| CEIL(n) / FLOOR(n) 无结果 | JimuReport 内置函数不含这两个 | 去掉；若需要取整只能用 `math.ceil()`/`math.floor()` |
| UPPER/LOWER 内使用 `#{}` | 展开后变 `UPPER(Hello World)` 无引号，Aviator 解析失败 | 改用字符串字面量：`=UPPER('hello world')`；不要在 UPPER/LOWER 内用 `#{}` |
| **字符串字段 `#{}` 未加单引号** | `=CONCAT(#{db.name}, ...)` → FreeMarker展开后变 `=CONCAT(张三, ...)`，Aviator 将 `张三` 识别为标识符变量→ null，整列显示 "null null" | **必须在 `#{}` 外加单引号**：`=CONCAT('#{db.name}', '#{db.city}')` → 展开后 `=CONCAT('张三', '深圳市')` → 正确。规则：凡是字符串字段用 `#{}` 绑定且在 Aviator 表达式里使用（CONCAT、IF 比较、CASE 等），外面都必须加 `'...'` 单引号；纯数字字段不受影响（`#{db.amount}` → `12345.67` 本身是合法数值字面量） |
| 表达式列写 `=` 开头 | 后端将文本当公式求值 | 说明列去掉 `=` 前缀，只写 `ABS(-88.5)` 而非 `=ABS(-88.5)` |
| FreeMarker 空值判断 | 条件不生效 | 用 `isNotEmpty(x)` 而非 `x??` 或 `x?has_content`；后两者无法过滤空串 `""` |
| LIKE 模糊查询写法 | 绑定失败 | 必须 `LIKE CONCAT('%','${x}','%')`，不能 `LIKE '%${x}%'` |
| 文本参数 widgetType 用 "text" | 控件渲染异常 | 应为 `"string"`，不是 `"text"` |
| 下拉控件 widgetType 用 "sel_search" | 控件渲染异常 | 下拉单选：`widgetType:"String"` + `searchMode:4`；下拉多选：`widgetType:"String"` + `searchMode:3` |
| DBSUM/DBAVERAGE 不出数 | 预览结果为空 | `base_save` 必须同时传 `dbexps=["=DBSUM(ds.field)",...]`（见 §API接口 详解） |
| `querySetting` 传 JSON 字符串 | `/save` 返回 success:true，但 `izOpenQueryBar/izDefaultQuery` 前端不生效（查询栏不展开等） | `base_save` override 时必须传 **dict**（如 `querySetting={"izOpenQueryBar": True, "izDefaultQuery": True}`），**禁止 `json.dumps()` 包成字符串**。GET 报表时 jsonStr 内嵌套显示为字符串是 jsonStr 二次 JSON 化的副产品，与 /save 入参格式无关 |
| **`update_db` kwargs 用 snake_case** | 字段属性未更新，服务端 fieldList 保持原值（响应仍 success:true） | `update_db(**kwargs)` 内部直接 `db.update(kwargs)` 后 POST `/saveDb`；kwargs key 名必须与 API payload 字段名完全一致（camelCase）：`fieldList=`、`paramList=`、`dbDynSql=` 等，**禁止** `field_list=`、`param_list=` 等 snake_case 写法 |
| **范围查询 `searchMode=2` widgetType 未匹配字段类型** | 查询栏不渲染最小/最大两个输入框，或日期范围显示为数字框 | `widgetType` 必须与字段实际数据类型一致：数值字段（成绩/年龄/金额）→ `"number"`；日期 → `"date"`；日期时间 → `"datetime"`；默认 `"String"` 不会渲染范围控件。`parse_sql` 返回的 widgetType 不可直接沿用，需按字段类型覆盖 |

---

## §执行效率

| 坑 | 现象 | 解决 |
|----|------|------|
| 纵向分组+自定义排序读了无关文件 | 读 misc-config.md 等浪费 30s+ | 自定义排序只需读 `examples/vertical-group-custom-sort.md`，关键字段 `textOrders:"华北\|华南\|华东"` |
| 横向分组不读模板直接写脚本 | groupRight 与 customGroup 混用，布局错误 | 凡涉及横向分组**必须先读** `references/horizontal-grouping.md`，确认类型后再写脚本 |
| 创建表达式报表前读多余文件 | 超时 | 表达式报表：只读 `references/expressions.md`；**严禁** grep/Read jimureport_utils.py 查签名 |
| 「全图表/所有图表」绕开一键脚本手拼 JSON | 25 张图表手写几百行 JSON，反复出错 | 命中「全图表」「图表大全」「测试三种数据集」时，**第一反应**直接 `python scripts/generate_all_reports.py ...` |
| 一键脚本被中断后原样重发等审批 | 用户拒绝后重发 N 次，每次等几十秒 | 用户中断后**立刻读反馈消息找原因**，按反馈修改后再执行；不能盲目重发 |
| 上下文已含命令信息却仍 `--help` 探查 | share / unshare / copy / delete 等子命令已在本会话 grep 或调用过，又多花 1-2 秒查 `--help` | **有上下文就直接调 API/CLI**：本会话已经 grep 过源码、用过同名子命令、看过 SKILL「工具脚本」表，参数清楚就一步执行；只有真正不确定（如新增/陌生子命令）才查 `--help`。常用确定参数：`unshare --name`/`copy <id> <new_name>`/`delete <id>`/`share --name --validity --lock --password`/`share_report(verify="0")` 关闭 token 校验 |

| 文本参数 widgetType | 控件渲染异常 | 应为 `"string"`，不是 `"text"` |
| LIKE 模糊查询写法 | 必须用 `LIKE CONCAT('%','${x}','%')`，不能用 `LIKE '%${x}%'`；后者 `${x}` 展开为 JDBC 占位符后嵌在字符串字面量里无法绑定 |
| 下拉控件配置 | 下拉单选：`widgetType:"String"` + `searchMode:4`；下拉多选：`widgetType:"String"` + `searchMode:3`；`widgetType` 不能用 `"sel_search"`，否则控件渲染异常 |
| loopTime 标题列范围含尾部空白列 | 标题偏窄，右侧留白，与内容区不对齐 | loopTime 分栏时若循环块末尾有间距列（如 col4=20px），第2张卡片复制后产生 col9（尾部空白）；**标题行的 merge 和 merges 不应包含该列**。正确范围：A1:I1（col0-col8），内容区 col0-col3+col4间距+col5-col8 = 820px 对齐；col9（尾部空白）排除在外 |
| 分版用 loopBlockList | 并列多数据集表格数据错乱/联动 | 分版场景禁止用 loopBlockList；正确做法：第一个表无标记（`#{}` 自然展开），右侧表单元格加 `zonedEdition:N`，顶层加 `zonedEditionList`（结构同 loopBlockList，含 db 字段），loopBlockList 留空 `[]` |
| 多系列图表（bar.multi/stack/line.multi等）series 为空数组或回填后丢失 itemStyle | 前端 `getSeriesItemStyle` 读 `seriesConfig[0].itemStyle` 崩溃，所有带 type 字段的图表全部空白 | ① **所有多系列图表** config 初始 `series` 必须提供至少一个带 `itemStyle` 的占位条目，禁止写 `"series":[]`；② fill_chart 多系列重建时强制补 itemStyle：先 `base_s=cfg["series"][0]`，重建后若缺 itemStyle 强制填入默认值 `{"color":"","barBorderRadius":0}`；③ 水平堆叠图（bar.stack.horizontal/bar.multi.horizontal）分类数据必须写到 `yAxis`，不能写 `xAxis`——用 `type=="category"` 判断而非 `"xAxis" in cfg` |
| 文件数据集图表 dataType 写成 "sql" | 运行时调 /qurestSql，报 "reportDb is null"，图表空白 | 文件数据集（dbType=5/6）的 chart_entry 必须传 `data_type="files"`；"sql" 只用于 MySQL SQL 数据集 |
| 文件数据集(dbType=5) fieldList 丢失 | 首次 `/saveDb`（无 id）不持久化 fieldList，UI「字段名」列全空，图表不渲染 | 拿到 db_id 后立即做第二次 `/saveDb`（payload 加 `"id": db_id`）；fieldList 条目必须带 `fieldNamePhysics` 才能正确写入 |
| save_db 重复创建数据集 | 不传 `db_id` 时每次都 INSERT 新记录，多次运行后报表内出现多个同名数据集；**更新时必须传 `db_id=<已有ID>`** |
| save_db 返回值误用 | `save_db()` 直接返回数据集 ID 字符串，不是 dict；错误用 `r["result"]["id"]` 会 TypeError | 直接用 `db_id = save_db(...)` |
| 主子表循环块用两个 loopBlock | 以为要分别配主表和子表各一条 loopBlockList → 无效，子表不展开 | **只有一个 loopBlockList，db=主表**；子表行（`#{sub.field}`）嵌入同一循环块模板，引擎靠 link 关联自动展开 |
| 主子表循环块 sri 从行1开始 | 技术上 sri:1 也可行，但主子表+循环块模式约定从 **sri:0** 开始（含标题行）；统一从0起可避免部分版本引擎的兼容问题 | 主子表循环块 loopBlockList 的 `sri` 固定写 `0`，`eri` 设为模板末行（通常是间隔行） |
| 主子表循环块 eri 设得过小 | eri 恰好等于模板末行（如 eri=6）→ 循环块展开空间不足，预览空白或渲染异常 | 主子表循环块 `eri` 应给足缓冲，建议设为模板行数 × 预估最大主表条数（如 `40`），引擎按实际数据量渲染，不会因 eri 大而截断 |
| loopBlockList eri 设太大 | eri=35/36 等很大值 → 子表记录少时预览页出现大片空白 | eri 设为**模板内容末行 + 2~3 行缓冲**即可；引擎自动按数据量扩展，数据多不截断，数据少不留白 |
| `/link/saveAndEdit` 参数格式错误 | 用 `mainDbId/subDbId/paramList` → 关联不生效，子表数据不展开 | 正确格式：`reportId` + `mainReport/subReport`（dbCode别名）+ `parameter`（JSON字符串含 main/sub/subReport 数组）+ `linkType:"4"` |
| 主子表循环块列数不统一 | 主表标题跨 A-G（7列），子表只用 B-F（5列）→ 预览时子表比主表窄，视觉不对齐 | 主表和子表必须使用**完全相同的列范围**（如都用 col0-col5）；主表标题 `merge:[0,5]`，子表表头和数据行也铺满同样的列范围 |
| 条形码/二维码 | 用 `displayConfig` + 单元格 `display/config` 实现；详见 `references/chart-components.md` §4-6 和 `references/report-design.md` §7 |
| `python -c` 跑到后台 | 命令自动进入 background，输出丢失，反复轮询浪费时间 | 永远 Write .py 文件后 `python /path/to/file.py` 执行，禁止 `python -c` |
| JSON 数据集 `json_data` 传 list 或 dict 而非字符串 | `saveDb` 失败：`Cannot deserialize value of type java.lang.String from Object value`（传 dict）或保存异常（传 list） | `save_db(..., json_data=json.dumps({"data": raw_list}, ensure_ascii=False))`；`json_data` 参数是**JSON 字符串**，传 Python list 或 dict 均不行，必须 `json.dumps()` |
| 纵向分组+自定义排序读了无关文件 | 读 `misc-config.md`/`dataset-core.md` 浪费 30s+ 无收获 | 自定义排序场景只需读 `examples/vertical-group-custom-sort.md`，关键字段 `textOrders:"华北\|华南\|华东"` 加在分组单元格上即可；`misc-config` 无排序内容 |
| 预调外部 API 验证字段 | 网络请求慢或超时，白等 | 直接按用户提供的字段写脚本，不预调 API 验证 |
| Windows Python stdout GBK 编码 | `UnicodeEncodeError: 'gbk' codec` 导致脚本崩溃重试 | 每个脚本开头必须加：`import sys; sys.stdout.reconfigure(encoding='utf-8')` |
| 首次 save 后 sleep | `time.sleep()` 白白增加延迟 | 首次 `/save` 是同步请求，完成即可立即调 `save_db`，不需要任何 sleep |
| DB 凭证未知时猜测 | 连接失败→修改→重试，浪费多轮 | DB host/password 不确定时，写代码前先问用户，1 句话拿到信息比反复重试快得多 |
| DB 密码错误不立即问 | `Access denied` 后继续猜密码重试，耗费多轮 | 首次连接失败且密码来自记忆（可能过时），**立刻停下来问用户**，不要尝试其他密码 |
| 脚本执行失败后猜测数据库/数据源配置 | 数据源名称、库名、表名等猜错导致多次失败重试，产生脏数据或重复资源 | 脚本执行失败涉及数据库/数据源相关配置（数据源名称、库名、连接信息等）时，**立刻停下来问用户**，不要自行猜测其他值重试 |
| 工具函数签名靠记忆 | `make_designer(name)` / `save_db(dbSource=...)` 等写错，运行才发现，多轮重试 | 写主脚本前先 `python -c "from jimureport_utils import X; help(X)"` 确认所有关键函数签名，不依赖文档示例或记忆 |
| graph.simple 误配 extData | 绑定数据集/设 apiStatus/设 dataId/设 dataId1 导致图表不渲染 | extData 只需 `{"chartId": layer_id, "chartType": "graph.simple"}`；节点+边全部内嵌 config 的 series[0].data/links；virtualCellRange 只放一行锚点；**不需要任何数据集** |
| Session base_url 缺 /jmreport | `session.request("/save",...)` 实际请求 `BASE_URL/save` 返回 404 | `Session` 初始化必须传含 `/jmreport` 的完整路径：`http://host:port/jmreport` |
| report_urls 参数顺序写反 | 预览链接指向错误 id | 正确签名：`report_urls(report_id, base_url, token)`，id 在前，base_url 在后 |
| `report_urls` 返回值当 dict 用 | `TypeError: tuple indices must be integers or slices, not str`（如 `urls['preview']`） | `report_urls` 返回 **tuple**（preview_url, design_url），不是 dict；正确用法：`preview, design = report_urls(report_id, BASE_URL, TOKEN)` 或 `urls[0]`/`urls[1]` |
| 创建表达式报表前读多余文件 | 读 expressions.md + pitfalls.md + jimureport_utils.py = 多次 Read，超时 | 表达式报表：只需读 `references/expressions.md`（含全部函数）+ `references/pitfalls.md`，其余文件不用读；**严禁** grep/Read jimureport_utils.py 查函数签名，签名须熟记：`make_designer(report_id, name)`、`save_db(session, report_id, db_code, db_name, sql, field_list, *, db_type, is_list, is_page, json_data)`、`base_save(report_id, designer, **overrides)`、`report_urls(report_id, base_url, token)` |
| 导入 `JimuSession` / `JimuReportSession` 等 | `ImportError: cannot import name 'JimuReportSession'`，整个脚本挂掉 | 唯一正确写法：`from jimureport_utils import Session, gen_id, gen_layer, make_styles, base_save, save_db, make_designer, chart_entry, virtual_row, print_summary, get_report, report_urls, parallel_save_dbs, ensure_datasource, parse_and_save_dataset`；模块路径：`<skill_base_dir>\scripts\jimureport_utils.py` |
| 单报表误用首次占位 /save | 串行 `/save`（占位）→ `parse_sql` → `saveDb` → 最终 `/save`，多一次 ~0.5-2s HTTP | 推荐 3-step：`ensure_datasource` → `gen_id()` 预生成 report_id → `parse_and_save_dataset(orphan report_id OK)` → 最终 `/save` 首次创建；省掉占位 save。saveDb 对 orphan report_id 不会报错，后续 /save 以此 id 首次建报表时数据集自动绑定。 |
| DBSUM/DBAVERAGE/DBMIN/DBMAX 不出数 | cell 里写了 `=DBSUM(ds.field)` 但预览结果为空，无报错 | `base_save` 必须同时传 `dbexps=["=DBSUM(ds.field)",...]`，引擎才会执行；修改已有报表时用 `dbexps=design.get("dbexps",[])` 透传，否则已有 DBSUM 也会失效 |
| 工具库模块名写错 | `from jimureport_session import JimuReportSession` 或 `from report_builder import ...` 均报 ModuleNotFoundError | 正确导入：`from jimureport_utils import Session, gen_id, gen_code, save_db, make_designer, base_save` |
| /save 新建报表 result.id 为 null | `resp["result"]["id"]` 返回 None，无法构造预览链接 | 新建时用 `gen_id()` 预生成 report_id，保存成功后直接用该 ID；`rid = resp["result"].get("id") or report_id` |
| 报表存在性验证走错接口 | `queryById`/`reportList`/`queryReportList` 均 404 或无权限 | 最简验证：`curl http://BASE/jmreport/index/{id}` 返回 HTML 即表示报表存在 |
| 循环块 db 别名与 dbCode 不一致 | 单元格绑定 `#{emp.field}` 但 dbCode 是 `emp_xxx`，预览数据全空 | `DB_ALIAS` 必须等于完整 dbCode；单元格 `#{alias.field}`、`loopBlockList.db`、`displayConfig` 的 text 三处保持一致 |
| API 分页数据集缺少分页参数 | 报表预览不分页或字段解析失败 | `api_url` 末尾带 `?pageSize='${pageSize}'&pageNo='${pageNo}'`（固定格式），`param_list` 加两条 `searchFlag=0` 的分页参数，**必须设默认值** `pageSize="20"`、`pageNo="1"`，留空不生效 |
| 斜线表头 style 含 `valign`/`align` | 标签被垂直居中，合并单元格内产生大片空白，"地区"等标签错位 | 斜线表头（lineStart）的 style **只能有** `border + bgcolor + color`，**禁止加 `align`/`valign`**；否则标签定位失效 |
| 表格 styles 未加边框 | 预览效果无边框，表格难以辨认 | 创建任何表格报表时，所有 style 对象**默认必须加边框**：`"border": {"bottom": ["thin","#BFBFBF"], "top": ["thin","#BFBFBF"], "left": ["thin","#BFBFBF"], "right": ["thin","#BFBFBF"]}`；标题行可用深色边框，数据行用灰色即可 |
| `border` 写在 style 顶层（展开写法） | 部分边框方向不渲染，设计器看起来缺一条线 | `bottom/top/left/right` **必须嵌套在 `"border"` key 下**：`{"border": {"bottom":[...],...}, "align":"center"}` ✅；`{"bottom":[...],"align":"center"}` ❌ 顶层展开不生效 |
| 报表无左侧留白 | 内容紧贴左边框，视觉拥挤 | **所有报表** col0（A 列）固定宽度 30px 作为左边距，始终放空白格（`{"text":"","style":margin_style}`）；标题/分区标题从 col1 开始合并（`merge:[0,N-1]`），merges 写 `"B?:F?"` 而非 `"A?:F?"` |
| 多源报表误解为双独立表格或 loopBlock | 做成两个分开的表格/循环块，或用 loopBlockList 嵌套 → 主子字段无法同行显示 | 多源报表 = 同一数据行混合 `#{aa.*}`（主表）和 `#{bb.*}`（子表），引擎按子表记录数展开行，主表字段同行重复；**不需要 loopBlockList**；必须调 `/link/saveAndEdit` (linkType="4") 配置 mainField→subParam 关联 |
| save_db 省略 field_list | 调用报 TypeError（必填参数缺失） | `save_db` 第6个位置参数 `field_list` 为必填，不可省略；每个字段用 `{"fieldName":..,"fieldText":..,"widgetType":"String","isShow":"1","isQuery":"0"}` |
| 纵横组合动态列缺少二级子列表头 | 月份列下无"销售额/捐赠额"等标题，视觉混乱 | 需4行布局：标题行+双层表头行+数据行；row2 静态表头用 `merge:[1,0]` 纵跨2行，groupRight 用 `merge:[0,N-1]` 横跨N子列；row3 填静态子列名（在 groupRight 作用域内，引擎自动随月份重复）；row4 填 group+dynamic |
| 纵横组合 merges 只写标题不写静态表头跨行 | 静态表头（大区/省份）不合并，与子列行错位 | 必须同时写 `"B3:B4"` 等跨行合并 + `"D3:F3"` 等月份模板跨列合并，三处缺一不可 |
| groupRight 月份列头字母序错误 | "10月"排在"1月"前面（字母序："10月" < "1月"） | 月份字段用零填充：`CONCAT(LPAD(month_no,2,'0'),'月')` → "01月"~"12月"，字母序=时间序；不要用 `CONCAT(month_no,'月')` |
| `make_designer` 参数顺序写错 | `make_designer(name, styles)` → `TypeError` 或 id 用了报表名 | 正确签名：`make_designer(report_id: str, name: str, **extra)`；新建报表 report_id 传空字符串 `""`：`make_designer("", REPORT_NAME)` |
| `save_db` 参数名用了 `db_ch_name` | `TypeError: unexpected keyword argument 'db_ch_name'` | 正确位置参数顺序：`save_db(session, report_id, db_code, db_name, sql, field_list, ...)`；第4个参数名是 `db_name`，不是 `db_ch_name` |

---

## §套打背景图

| 坑 | 现象 | 解决 |
|----|------|------|
| 套打图片放在 `printConfig.bgImg` | 设计器"套打设置"面板看不到图，打印/导出 PDF 也无背景 | **套打图片必须放在 `imgList`**，不是 `printConfig.bgImg`（该字段对套打无效）；`printConfig.bgImg` 保持空字符串即可 |
| `imgList` 缺少 `commonBackend: True` | 图片后端 PDF 渲染有，但设计器预览看不到背景图 | `imgList` 条目必须同时设 `"isBackend": True`（后端渲染）和 `"commonBackend": True`（设计器预览显示），缺一不可 |
| row0 单元格未加 `virtual` 键 | 图片与单元格脱钩，保存后背景图丢失或位置偏移 | row0 所有列的单元格（col 0 到 colspan-1）必须加 `"virtual": layer_id`，与 imgList 条目的 `layer_id` 一致 |
| `virtualCellRange` 包含所有行列 | 数据量大时 JSON 体积膨胀 | `virtualCellRange` 只需列出 **row0 的所有列** `[[0,0],[0,1],...,[0,N-1]]`，不需要列出所有 rowspan 行 |

> 完整代码模板见 `references/misc-config.md` §套打imgList配置
| `base_save` 用关键字参数传 `report_id`/`designer` | `TypeError: missing positional argument 'designer_obj'` | `base_save` 前两个是位置参数：`base_save(report_id, designer_obj, **overrides)`；禁止写成 `base_save(report_id=..., designer=...)` |
| 首次 `/save` 返回值当字符串用 | `str(resp["result"])` 得到整个 dict 的字符串表示 | `/save` 新建时 `resp["result"]` 是 **dict**，需要 `resp["result"]["id"]`；若 id 为 None 则用预生成的 `gen_id()` |
| `rows` dict 缺 `"len"` key | 设计器列数/行数异常，图表位置偏移 | rows 必须带 `"len": 200`：`rows = {"len": 200, "1": {"height": 25, "cells": {}}, ...}` |
| YApi `init_yapi()` 后 `create_mock()` 报"请登录" | `urllib` 多 Set-Cookie 头只取了第一条，`_yapi_uid` 丢失 | 已在 `yapi_mock.py` 修复（`get_all('Set-Cookie')`）；升级后 `init_yapi()` + `create_mock()` 可正常串联使用 |
| API 数据集图表用 `/qurestSql` 回填 | 返回 0 行，图表 config 中数据为空 | API 数据集（`dataType="api"`）必须调 `/qurestApi`，返回值路径是 `resp["result"]["data"]`；SQL 数据集才用 `/qurestSql`（返回 `resp["result"]` 直接是列表）|
| API 图表字段名不是 name/value | 设计器「运行」后图表空白，分类/值属性无法绑定 | 字段名不是 `name`/`value`/`type` 时，必须在 `extData` 中设置 `"isCustomPropName": True`，并将 `xText` 设为实际分类字段名、`yText` 设为实际值字段名，`axisX`/`axisY` 同步跟随；`chart_entry` 调用后立即追加这三个字段（服务端确实会保存，放在 extData 位置正确） |
| 单元格自动换行用 `wordWrap` | 预览不换行，长文本溢出 | 自动换行**必须**写在 **style 对象**里：`{"border":{...}, "align":"left", "valign":"middle", "textwrap": True}`；单元格属性 `wordWrap:"break-word"` 或 `wordWrap:1` 均无效。长文本列建议 `align:"left"`，配合 `isAdaptive:1`（行自适应高度）使用 |
| `query_mysql` 执行 DML/DDL 数据不落库 | INSERT/DELETE/CREATE TABLE 看似成功但 COUNT 仍为 0 | `query_mysql` 内部无 `conn.commit()`，只适合 SELECT；**写数据必须直接用 pymysql**：`conn = pymysql.connect(...); cur.execute(...); conn.commit()` |
| MySQL 密码从 memory 或 get_ds_connection 猜测 | `Access denied` 后反复重试浪费多轮 | `get_ds_connection` 返回的密码可能加密；memory 记录的密码可能过时；**首次连接失败立刻停下来问用户**，不要尝试其他密码 |
| SQL 数据集 `field_list=[]` 传空 | 数据集保存成功但字段明细「暂无数据」，图表无法绑定字段 | 必须先调 `parse_sql(session, sql, db_source=ds_id)` 拿到字段列表再传给 `save_db`；不能传空数组 `[]` |
| `paramList` 字段键名用 fieldName/fieldTxt/defaultVal | `Column 'param_name' cannot be null` 报错，数据集保存失败 | `paramList` 正确键名：`paramName`（参数名）、`paramTxt`（显示名）、`paramValue`（默认值）、`searchFlag`、`widgetType`、`searchMode`；不要用 fieldName/fieldTxt/defaultVal |
| JSON 数据集 jsonData 用单对象而非数组 | 数据集保存后字段解析失败或预览无数据 | jsonData 格式必须是 `{"data": [...]}` 数组，即使只有一条记录也要包在数组里：`{"data": [{"name":"张三",...}]}`；`isList:"0"`（不勾选集合）只影响绑定方式（`${}`），不影响 jsonData 格式 |
| `border` 写成 `{"style":1}` 对象格式 | 设计器整张表渲染空白（前端 JS 解析异常） | `border` 每个方向必须是**数组**格式：`["thin","#000000"]`；正确：`"border":{"top":["thin","#000"],...}`；错误：`"border":{"top":{"style":1},...}` |
| 纵向分组报表缺少顶层 `isGroup/groupField` | 预览报 `For input string: "cells"`（Java NumberFormatException）；设计器正常但预览崩溃 | 含 `#{db.group(field)}` 绑定的报表，`base_save` 必须传 `isGroup=True, groupField="dbCode.fieldName"`；缺少这两个字段时后端走标准引擎，遇到行内 `"cells"` 子对象 key 尝试 `parseInt` 失败 |
| 纵向分组数值列小计为空 | 合计行薪资空白，不论 API/JSON/SQL 数据集 | **数值列禁止加任何 funcname 或 subtotal 属性**，引擎对数值型字段自动聚合求和。只要写了 `funcname:"SUM"`、`subtotal:"-1"` 或 `subtotal:"groupField"` 中的任意一个，都会覆盖自动逻辑导致空白。正确写法：`{"text":"#{db.salary}","style":N}`，什么都不加，仅有 text 和 style |
| 纵向分组报表分组单元格缺少 `aggregate:"group"` | 分组不生效，每行独立显示，不合并相同部门 | 分组单元格必须同时设置四个属性：`aggregate:"group"`、`subtotal:"groupField"`（固定字面量，非字段名）、`funcname:"-1"`、`subtotalText:"合计"`；缺少 `aggregate:"group"` 时分组引擎不识别该列为分组列 |
| 分组聚合列缺少 `subtotal:"-1"` | 设置了 `funcname:"SUM"` 但合计行数值仍为空白 | 分组聚合列（非分组键列）必须**同时**设置 `funcname:"SUM"` + `subtotal:"-1"`，引擎才会在合计行渲染 SUM 值；只设 funcname 不够。分组键列：`subtotal:"groupField"` + `funcname:"-1"` + `subtotalText:"合计"`；聚合列：`subtotal:"-1"` + `funcname:"SUM"` |
| SQL 图表 config 无初始数据 | 设计器页面 ECharts 空白，预览正常但设计态看不到图 | **创建 SQL 图表后必须调 `/qurestSql` 回填数据**：`session.request("/qurestSql", {"apiSelectId": db_id, "chartSetting": {..."run":1}})` 返回原始行列表，转换后写入 `config.xAxis.data` / `config.series[i].data` / `config.legend.data`，再调 `/save` 保存；具体转换见下方「SQL 图表数据回填」代码片段 |
| bar.background extData.chartType 写错 | 坐标轴正常但柱体数据全部消失 | extData.chartType 必须保持 `bar.simple`，不能写 `bar.background`；带背景效果只需在 echarts series 层配置 showBackground |
| 同行图表水平重叠 | 左图溢出覆盖右图 | `width`（px）必须 ≤ `colspan × 列宽`；公式：`列宽 ≥ ceil(width / colspan)`。示例：width=560、colspan=6 → 列宽需 ≥ 94px。**设定 width 与列宽时必须同步校验，不能独立设值** |
| 多行图表垂直重叠 | 下方图表盖在上方图表上 | rowspan 默认 14，height=420px 实际占 ≈17 行；下一行图表的 row ≥ 上一行 row + ceil(height/行高) + 间距，保守估算：height=420 时 row_step=20；**同时必须初始化所有行 height=25，否则缺失行高度不确定导致位置计算失准** |
| JavaBean 数据集 `dbType` 用 `"0"` | 设计器中数据类型显示为「SQL数据集」而非「JavaBean数据集」 | JavaBean 数据集 `saveDb.dbType` 必须为 **`"2"`**（不是 `"0"`）；`chart_entry` 的 `data_type` 必须为 **`"javabean"`**（不是 `"sql"`）；两者缺一不可 |
| JavaBean 图表调 `/qurestSql` 回填 | 返回 `result: null`，所有 `dataType` 值均无效 | JavaBean 数据集**不支持设计态填充**，`/qurestSql`、`/qurestApi`、`/qurestBean` 均无效；数据由运行时引擎在 `/view/{id}` 时直接调 Bean 的 `createData()` 提供；**创建 JavaBean 图表时跳过回填步骤** |
| `queryFieldByBean` 返回结构误判 | `resp["result"].get("fieldList")` 报 `AttributeError: 'list' object has no attribute 'get'` | `queryFieldByBean` 的 `result` 直接是字段数组（`list`），不是 `{"fieldList": [...]}` 的 dict；正确写法：`raw_fields = resp["result"]` |
| SQL 别名已知却仍调 `parse_sql` | 遇到签名失败/中文字符报错后反复调试，浪费数十分钟 | SQL 字段别名已确定（如 `name/value/type`）时，**直接硬编码 fieldList**，禁止调 `parse_sql`；`parse_sql` 仅用于别名未知的情况。硬编码模板：`{"fieldName":"name","fieldText":"名称","fieldType":"String","orderNum":0,"isShow":"1","isQuery":"0","widgetType":"String","searchMode":"1","searchFormat":""}` |
| `parse_sql` SQL 含中文字符导致签名失败 | `签名校验失败，请重新登录` —— 中文字符（WHERE 条件/SELECT 字面量）影响签名计算 | 若必须调 `parse_sql`，传**纯 ASCII 的简化 SQL**（`SELECT col1, col2 FROM table LIMIT 1`），不含中文 WHERE 条件或字符串字面量；完整业务 SQL 只传给 `save_db`（不经过 SIGNED_PATHS） |
| 横向分组不读模板直接写脚本 | `groupRight` 与 `customGroup` 混用，布局完全错误；或忽略 `direction:"right"`/`rendered:""`/`isDrag:true` 等必要属性导致不渲染 | 凡涉及横向分组（groupRight / customGroup / 横向自定义分组）**必须先读** `references/horizontal-grouping.md` + `examples/horizontal-group.md`，确认类型和属性后再写脚本；禁止凭印象直接写 |
| 建表数据库与 JimuReport 默认数据源不一致 | `parse_sql`/SQL 数据集 预览报 `Table 'xxx.table' doesn't exist` | JimuReport 默认数据源连接的库（见 application.yml 的 `spring.datasource.url`）才是 `dbSource=""` 时查询的目标；**建表必须在该库**，或为 `save_db` 指定正确的 `dbSource` ID。不确定时先问用户看配置文件，不要猜 |
| 猜测不存在的 JimuReport 接口 | 调自造接口（如 `/testConnect/list`）返回 404，浪费一轮调试 | 不确定 JimuReport 有哪个接口时，**直接问用户**或查 `references/` 文档，严禁凭感觉拼接接口路径 |
| JSON 数据集绑定多系列/数组值图表 | 气泡散点图 legend 显示 "undefined"、只渲染一个点；雷达图数据丢失 | JimuReport 渲染时用 JSON 数据集的实际数据覆盖 ECharts config，导致多系列/`value:[...]` 数组格式的硬编码数据被单条记录替换。**scatter.bubble、radar.basic、radar.custom 等复杂静态数据图表必须用 `_NONE()`（不绑数据集）**，config 里的静态数据才能直接渲染 |
| 「全图表/全部图表/SQL+API+JSON 测试」绕开一键脚本自己拼 JSON | 25 张图表手写 chart_entry 几百行 JSON，反复出错回头读模板，10 分钟以上 | 命中关键词「全图表」「所有图表」「测试三种数据集」「图表大全」时，**第一反应**直接 `python scripts/generate_all_reports.py --base-url --token --name --mysql-*`，3 秒完成，禁止重新组装 JSON。脚本内置：建表 + YApi mock + 25 图表 + 三类数据集；图表类型不够补 `CHARTS` + `tpl_xxx` 函数即可 |
| 一键脚本被中断后原样重发等审批 | 用户拒绝后命令重发 N 次，每次等几十秒，比直接执行慢一个量级 | 用户中断/拒绝后**立刻读反馈消息找原因**（参数错？前置失败？），按反馈修复后再执行；不能盲目原样重发等审批，那是用户已经否决的动作 |
| `parallel_save_dbs` 触发 jimu_report_db_field deadlock | `Deadlock found when trying to get lock` Spring 异常栈，部分数据集保存失败 | 多数据集保存改为**串行** `[save_db(session, **a) for a in save_args]`；`generate_all_reports.py` 已修复，新写脚本不要再用 `parallel_save_dbs` |
| `yapi_mock.create_mock` 重复 path 直接报错 | `RuntimeError: 创建接口失败: 已存在的接口:/xxx[GET` 中断整个流程 | `yapi_mock.py` 已修复：errmsg 含「已存在」时调 `/api/interface/list` 找出 id 后调 `update_mock` 复用，业务无需变更 |
| JSON 数据集 jsonData 裸数组导致渲染空白 | 数据集保存成功、字段也正常，但预览时 `#{db.field}` 全部为空 | jsonData **必须**包裹 `{"data":[...]}` 外层对象，引擎从 `data` 键取行数据；直接传裸数组（如 `[{"name":"张三"}]`）引擎找不到 `data` 键，数据全空。正确：`json.dumps({"data": rows}, ensure_ascii=False)`；dbexps 里的 jsonData 字段同样要用此格式 |
| save_db 修改已有数据集仍新增记录 | 每次调 `save_db` 都 INSERT 新行，报表内出现多个同名 dbCode 数据集 | **更新**已有数据集必须用 `update_db(session, db_id, jsonData=...)`，而非再次调 `save_db`；`save_db` 不传 `db_id` 时始终新增 |
| 用户指定 API URL 时擅自调用 create_mock 修改数据 | 原有 mock 数据被覆盖，用户未要求却丢失数据 | 用户提供了完整 API URL 即表示接口已存在，直接将 URL 填入 `save_db(api_url=...)` 即可；**禁止**调用 `init_yapi` / `create_mock`，除非用户明确说「帮我创建 mock 数据」或「帮我修改 mock 数据」 |
| 明细报表合计行误用 funcname 分组机制 | 设了 `funcname:"SUM"` 但预览无合计行，越调越复杂甚至引入不必要的分组 | **明细列表（非分组报表）的合计行直接在模板里多加一行，用 Excel 公式 `=SUM(C3)` / `=AVERAGE(D3)`**；`funcname` + 自动生成合计行只在分组报表（`isGroup:true` + `group()` 绑定）下生效；`filterNegative`/`filterEmptyValue`/`filterZeroValue`/`noCalculate` 是数据绑定单元格上的元数据属性，与合计行公式是两件独立的事，不要混为一谈 |