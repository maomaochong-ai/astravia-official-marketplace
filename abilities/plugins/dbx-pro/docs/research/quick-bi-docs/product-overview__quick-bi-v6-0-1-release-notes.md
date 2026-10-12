<br />

## **发布日期**
2025年10月27日

## 重点升级概览
* **智能小Q**

  * **小Q报告**

    * 支持基于已在问数配置中学习成功，且当前用户拥有使用权限的数据集一键生成报告。

    * 在报告编辑页进行小Q问数时，支持直接上传数据文件来问数。

    * 在报告编辑页进行洞察分析时：

      * 可以在生成记录面板中，查看并对比当前报告内洞察分析的历史提问、对应执行过程及生成结果。方便对比并最终应用不同prompt下生成效果更好的洞察分析内容。

      * 基于报告内章节内容或图表组件生成的洞察分析结果，在原始内容发生变化时，也支持动态更新。

    * 新增自动保存功能，开启后系统将每隔5分钟自动对比当前内容与上次保存结果是否存在差异，如有则触发自动保存。

    * 将交叉表和明细表插入报告中时，若使用了分页器功能，落入报告时可保持分页效果。

    * 在报告中插入来自仪表板的图表时，若勾选的图表可构成完整拼接块，则落入报告时可保持其原有拼接样式。

    * 小Q报告使用页面可回看精选案例，帮助您更好的了解小Q报告功能、获取制作灵感。

  * **小Q洞察**

    * 支持对单一数据集内指标变化进行多维度、多步骤的根因分析，并自动生成可视化的小Q洞察内容。同时，支持将生成的小Q洞察内容添加至已创建的小Q报告中。

      **说明**

      小Q洞察属于增值模块，需要额外购买，当前处于限时免费试用阶段。
    * 语音问数支持中英文切换。

    * 维值匹配模式：用户问题与数据集字段维值匹配时，支持不改写匹配和允许改写匹配两种方式。

    * 新增智能选表配置开关，允许用户不选表提问，系统智能选表；还允许配置二次选表是否反问。

    * Excel 文件问数支持清除相关记忆。

  * **小Q解读**：新增推荐问题功能，辅助用户快速发起仪表板解读。

* **数据构建**

  * **数据源**

    * 新增AWS Athena数据源、钉钉AI表格应用数据源。

    * 阿里云数据库AnalyticDB PostgreSQL版支持hint语句。

    * Dataphin数据源引擎类型新增AnalyticDB PostgreSQL。

    * 文档类数据源（飞书多维表格、飞书电子表格、钉钉表格、钉钉AI表格）支持通过系统内置函数新建计算字段；飞书多维表格支持自动解析复杂字段内容。

    * 文件数据源上传优化：

      * 文件中如果存在字段类型不匹配的数据，上传时将会被处理为空值，且系统会以弹窗形式进行提示。

      * 支持在报错弹窗内直接跳转查看触发当前报错的原因。

      * 字段类型判断优化：yyyyMMdd日期识别为日期；手机号码识别为文本；身份证号识别为文本。

  * **Quick引擎**

    * 数据集新增加速占位符，适配自定义 SQL 中包含时间参数的场景，Quick 引擎可在抽取阶段动态替换时间窗口。

    * 增量更新数据源拓展，Quick引擎所支持的所有数据源均可进行增量更新。

* **数据分析**

  * **仪表板**

    * **可视化图表**：地图组件的自定义显示范围支持选择全球洲和国家以及中国的区域、省份、市。

    * **查询控件：**支持自定义快捷区间。

  * **数据面板**

    * 数据集替换时，可通过拆分替换的方式解决报表内新建字段无目标字段可选的问题。

* **开放平台**

  * 嵌入JS SDK打通模块嵌入，支持通过JS SDK嵌入用户管理、成员管理、用户组管理、订阅管理等页面。

  * 以下OpenAPI接口更新

    * 新增获取指定数据集的加速任务运行日志（QueryAccelerationLogByCubeId）接口。

    * 新增获取空间下加速引擎管控页任务信息（ListAccelerationOfWorkspace）接口。

    * 新增新建工作空间（CreateWorkspace）接口。

    * 新增编辑仪表板的问数状态（SmartqOpenNl2sqlDashboard）接口。

    * 小Q问数查询（SmartqQueryAbility）：接口请求参数新增multipleCubeIds、返回参数新增dataList字段。

## 变更内容
* **智能小Q**

  * **小Q报告**

    * 支持基于已在问数配置中学习成功，且当前用户拥有使用权限的数据集一键生成报告。

      请参见[小Q报告创建](https://help.aliyun.com/document_detail/2948531.html)。
    * 在报告编辑页进行小Q问数时，支持直接上传数据文件来问数。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4888251671/p1016020.png)

      请参见[报告内AI助手](https://help.aliyun.com/document_detail/2949377.html)。
    * 在报告编辑页进行洞察分析时：![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4888251671/p1016337.png)

      * 可以在生成记录面板中，查看并对比当前报告内洞察分析的历史提问、对应执行过程及生成结果。方便对比并最终应用不同prompt下生成效果更好的洞察分析内容。

      * 基于报告内章节内容或图表组件生成的洞察分析结果，在原始内容发生变化时，也支持动态更新。

      请参见[报告内AI助手](https://help.aliyun.com/document_detail/2949377.html)。
    * 新增自动保存功能，开启后系统将每隔5分钟自动对比当前内容与上次保存结果是否存在差异，如有则触发自动保存。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6098251671/p1016193.png)

      请参见[小Q报告管理](https://help.aliyun.com/document_detail/2948530.html)。
    * 将交叉表和明细表插入报告中时，若使用了分页器功能，落入报告时可保持分页效果。

      请参见[已有内容添加至小Q报告](https://help.aliyun.com/document_detail/2948620.html)。
    * 在报告中插入来自仪表板的图表时，若勾选的图表可构成完整拼接块，则落入报告时可保持其原有拼接样式。

      请参见[已有内容添加至小Q报告](https://help.aliyun.com/document_detail/2948620.html)。
    * 小Q报告使用页面可回看精选案例，帮助您更好的了解小Q报告功能、获取制作灵感。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3459251671/p1016570.png)

  * **小Q洞察**

    * 支持对单一数据集内指标变化进行多维度、多步骤的根因分析，并自动生成可视化的小Q洞察内容。同时，支持将生成的小Q洞察内容添加至已创建的小Q报告中。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6598251671/p1007296.png)

      请参见[小Q洞察](https://help.aliyun.com/document_detail/2985099.html)。  
      **说明**

      小Q洞察属于增值模块，需要额外购买，当前处于限时免费试用阶段。
    * 语音问数支持中英文切换。

    * 维值匹配模式：用户问题与数据集字段维值匹配时，支持不改写匹配和允许改写匹配两种方式。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3459251671/p1016912.png)

      请参见[数据准备](https://help.aliyun.com/document_detail/2836768.html)。
    * 新增智能选表配置开关，允许用户不选表提问，系统智能选表；还允许配置二次选表是否反问。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3459251671/p1016916.png)

      请参见[全局配置](https://help.aliyun.com/document_detail/2920789.html)。
    * Excel 文件问数支持清除相关记忆。

      **说明**

      仅[文件](https://help.aliyun.com/document_detail/2715112.html#fc751ea355nh3)问数支持清除相关记忆。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6839251671/p1015528.png)

      请参见[发起问数](https://help.aliyun.com/document_detail/2715112.html)。
  * **小Q解读**：新增推荐问题。

    请参见[推荐问题](https://help.aliyun.com/document_detail/2871898.html#759e415b202b4)。
* **数据构建**

  * **数据源**

    * 新增AWS Athena数据源、钉钉AI表格应用数据源。

      请参见[AWS数据源Amazon Athena](https://help.aliyun.com/document_detail/2984873.html)、[创建钉钉AI表格数据源](https://help.aliyun.com/document_detail/2984880.html)。
    * 阿里云数据库AnalyticDB PostgreSQL版支持hint语句。

      请参见[数据源功能项列表](https://help.aliyun.com/document_detail/2642723.html)。
    * Dataphin数据源引擎类型新增AnalyticDB PostgreSQL。

      请参见[创建应用数据源Dataphin](https://help.aliyun.com/document_detail/166152.html)。
    * 文档类数据源（飞书多维表格、飞书电子表格、钉钉表格、钉钉AI表格）支持通过系统内置函数新建计算字段；飞书多维表格支持自动解析复杂字段内容。

    * 文件数据源上传优化：

      * 文件中如果存在字段类型不匹配的数据，上传时将会被处理为空值，且系统会以弹窗形式进行提示。

      * 支持在报错弹窗内直接跳转查看触发当前报错的原因。

      * 字段类型判断优化：yyyyMMdd日期识别为日期；手机号码识别为文本；身份证号识别为文本。

      请参见[创建文件数据源](https://help.aliyun.com/document_detail/168026.html)。
  * **Quick引擎**

    * 数据集新增加速占位符，适配自定义 SQL 中包含时间参数的场景，Quick 引擎可在抽取阶段动态替换时间窗口。

      请参见[占位符](https://help.aliyun.com/document_detail/2557888.html)。
    * 增量更新数据源拓展，Quick引擎所支持的所有数据源均可进行增量更新。

      请参见[配置Quick引擎](https://help.aliyun.com/document_detail/409908.html)。
* **数据分析**

  * **仪表板**

    * **可视化图表**：地图组件的自定义显示范围支持选择全球洲和国家以及中国的区域、省份、市。

      请参见[色彩地图](https://help.aliyun.com/document_detail/55653.html)、[气泡地图](https://help.aliyun.com/document_detail/55644.html) 、[热力地图](https://help.aliyun.com/document_detail/71925.html)、[符号地图](https://help.aliyun.com/document_detail/202744.html)、[飞线地图](https://help.aliyun.com/document_detail/85229.html)。
    * **查询控件**：支持自定义快捷区间。

      请参见[新建查询控件](https://help.aliyun.com/document_detail/151455.html)、[日期查询](https://help.aliyun.com/document_detail/151454.html)。
  * **数据面板**

    * 数据集替换时，可通过拆分替换的方式解决报表内新建字段无目标字段可选的问题。

      请参见[替换数据集](https://help.aliyun.com/document_detail/65845.html)。
* **开放平台**

  * 嵌入JS SDK打通模块嵌入，支持通过JS SDK嵌入用户管理、成员管理、用户组管理、订阅管理等页面。

    请参见[嵌入JS SDK API](https://help.aliyun.com/document_detail/2883315.html)、[路由键一览表](https://help.aliyun.com/document_detail/2883317.html)。
  * 以下OpenAPI接口更新

    * 新增获取指定数据集的加速任务运行日志（QueryAccelerationLogByCubeId）接口。

    * 新增获取空间下加速引擎管控页任务信息（ListAccelerationOfWorkspace）接口。

    * 新增新建工作空间（CreateWorkspace）接口。

    * 新增编辑仪表板的问数状态（SmartqOpenNl2sqlDashboard）接口。

    * 小Q问数查询（SmartqQueryAbility）：接口请求参数新增multipleCubeIds、返回参数新增dataList字段。