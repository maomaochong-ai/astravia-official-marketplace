<br />

## **发布日期**
2025年3月27日

## 重点升级概览
* **智能小Q**

  * 智能小Q新增支持多个智能体模型，本期接入Dify模型。

  * 智能问数数据集预览界面展示优化。

  * 新增仪表板数据解读功能，能够智能解析报表数据、自动分析业务趋势，并一键生成关键洞察报告，助力实现高效决策。

  * 智能问数支持长思维模式。

  * 支持设置样例数据集是否展示。

* **数据构建**

  * **数据源**

    * 新增支持AWS Aurora数据源、Redshift数据源。

    * 新增支持瓴羊One·分析数据源，帮助商家在Quick BI上接入各电商平台的数据，以进行专题分析。

    * ClickHouse企业版集群支持VPC数据源。

    * MaxCompute支持MaxQA，提升查询性能。

  * **数据集**

    * 数据集新增预览页，支持在数据集列表中选择数据集进行数据预览，便于分析师更精准地定位需要使用的数据集。

    * 新增数据集版本管理能力，支持恢复历史版本。

    * 新建计算字段优化：计算字段类型自动化识别，无需用户手动指定；新增函数解释面板，固定展示函数语法、用途、使用示例等内容。

  * **Quick引擎**

    * 新增Quick BI容量管理模块，统一数据集加速、探索空间、API数据源、应用数据源等存储用量管理，支持查看组织内个人、空间用量排行榜及明细，并进行容量告警设置。

    * 开启SSH的自建数据源支持抽取加速。

* **数据分析**

  * **可视化图表**

    * 指标看板样式布局能力大升级，新增多种布局样式。

    * 柱图和条形图支持绘图区域中图形填充。

    * 排行榜能力升级：支持设置图表中每列元素的宽度及列标题的对齐方式；支持显示提示标签，用于展示图表指标在初始状态下的原始值，及被联动筛选后的值。

    * 移动端表格类图表、地图类图表及指标关系图上线"视图锁定"功能，避免手势冲突锁。

    * 支持根据用户所选的图表色系主题，匹配不同的默认语义色。

    * 气泡图、符号地图样式能力升级。

    * 表格类图表默认样式的配置项升级。

  * **查询控件**

    * 查询字段、显示字段不一致时支持使用动态函数设置筛选默认值。

    * 数值查询支持选择百分比类型。

    * 日期区间支持使用动态函数设置默认值。

    * 查询控件的"查询"、"清空"、"重置"按钮，支持调整展示顺序。

  * **高级计算**：在下钻、维度组切换、交叉表字段筛选场景下，同环比的计算配置支持跟随粒度变化。

* **企业级能力**

  * **办公协同**

    * PC微应用支持在工作台进行报表搭建，通过办公软件同步进来（钉钉/企微/飞书）且拥有编辑权限的账号，支持在PC端微应用中创建和编辑各类数据作品。

    * 钉钉审批支持自定义审批模板，帮助用户基于现有的审批流，实现加签、增加审批流程等操作。

## 变更内容
* **智能小Q**

  * 智能小Q新增支持多个智能体模型，本期接入Dify模型。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8730814471/p939428.png)

    请参见[我的智能体](https://help.aliyun.com/document_detail/2876496.html)。
  * 智能问数数据集预览界面展示优化。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4525792471/p933303.png)

    请参见[预览和选择数据集](https://help.aliyun.com/document_detail/2715112.html#d24bdd7428udx)。
  * 新增仪表板数据解读功能，能够智能解析报表数据、自动分析业务趋势，并一键生成关键洞察报告，助力实现高效决策。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4525792471/p933306.png)

    请参见[仪表板问数](https://help.aliyun.com/document_detail/2861350.html)。
  * 智能问数支持长思维模式。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8730814471/p939433.png)

    请参见[推理和解读方式](https://help.aliyun.com/document_detail/2715112.html#02ca6947537nk)。
  * 支持设置样例数据集是否展示。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8730814471/p939430.png)

    请参见[预览和选择数据集](https://help.aliyun.com/document_detail/2715112.html#d24bdd7428udx)。
* **数据构建**

  * **数据源**

    * 新增支持AWS Aurora数据源、Redshift数据源。

      具体请参见[AWS数据源Aurora MySQL](https://help.aliyun.com/document_detail/2873025.html)、[AWS数据源Aurora PostgreSQL](https://help.aliyun.com/document_detail/2873023.html)、[AWS数据源RedShift](https://help.aliyun.com/document_detail/2873024.html)。
    * 新增支持瓴羊One·分析数据源，帮助商家在Quick BI上接入各电商平台的数据，以进行专题分析。

      具体请参见[创建瓴羊One·分析数据源](https://help.aliyun.com/document_detail/2875135.html)。
    * ClickHouse企业版集群支持VPC数据源。

      具体请参见[自建数据源ClickHouse](https://help.aliyun.com/document_detail/467997.html)。
    * MaxCompute支持MaxQA，提升查询性能。

  * **数据集**

    * 数据集新增预览页，支持在数据集列表中选择数据集进行数据预览，便于分析师更精准地定位需要使用的数据集。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4525792471/p933309.png)

      请参见[数据集预览页](https://help.aliyun.com/document_detail/61151.html#ab601015f5vg7)。
    * 新增数据集版本管理能力，支持恢复历史版本。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4525792471/p933310.png)

      请参见[恢复历史版本](https://help.aliyun.com/document_detail/61151.html#4d2adc9278ey5)。
    * 新建计算字段优化：计算字段类型自动化识别，无需用户手动指定；新增函数解释面板，固定展示函数语法、用途、使用示例等内容。

      请参见[新建计算字段](https://help.aliyun.com/document_detail/169390.html)。
  * **Quick引擎**

    * 新增Quick BI容量管理模块，统一数据集加速、探索空间、API数据源、应用数据源等存储用量管理，支持查看组织内个人、空间用量排行榜及明细，并进行容量告警设置。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4525792471/p933321.png)

      请参见[容量管理](https://help.aliyun.com/document_detail/2873801.html)。
    * 开启SSH的自建数据源支持抽取加速。

      请参见[数据源功能项列表](https://help.aliyun.com/document_detail/2642723.html)。
* **数据分析**

  * **可视化图表**

    * 指标看板样式布局能力大升级，新增多种布局样式。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2418692471/p927033.png)

      具体请参见[指标看板](https://help.aliyun.com/document_detail/55685.html)。
    * 柱图和条形图支持绘图区域中图形填充。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1608692471/p926929.png)

      具体请参见[柱图](https://help.aliyun.com/document_detail/55596.html)、[条形图](https://help.aliyun.com/document_detail/68320.html)。
    * 排行榜能力升级：支持设置图表中每列元素的宽度及列标题的对齐方式；支持显示提示标签，用于展示图表指标在初始状态下的原始值，及被联动筛选后的值。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1553792471/p933265.png)

      具体请参见[排行榜](https://help.aliyun.com/document_detail/126552.html)。
    * 移动端表格类图表、地图类图表及指标关系图上线"视图锁定"功能，避免手势冲突。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7697692471/p929821.gif)

      具体请参见[移动端展示](https://help.aliyun.com/document_detail/607408.html)。
    * 支持根据用户所选的图表色系主题，匹配不同的默认语义色。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0028692471/p927848.gif)

      具体请参见[主题设计](https://help.aliyun.com/document_detail/144964.html)。
    * 气泡图、符号地图样式能力升级。

      具体请参见[气泡图](https://help.aliyun.com/document_detail/118641.html)、[符号地图](https://help.aliyun.com/document_detail/202744.html)。
    * 表格类图表默认样式的配置项升级。

      具体请参见[交叉表](https://help.aliyun.com/document_detail/200338.html)、[明细表](https://help.aliyun.com/document_detail/473447.html)、[趋势分析表](https://help.aliyun.com/document_detail/330807.html)、[多维分析表](https://help.aliyun.com/document_detail/2673762.html)。
  * **查询控件**

    * 查询字段、显示字段不一致时支持使用动态函数设置筛选默认值。

      请参见[文本查询](https://help.aliyun.com/document_detail/151453.html)。
    * 数值查询支持选择百分比类型。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4525792471/p933323.png)

      请参见[数值查询](https://help.aliyun.com/document_detail/151452.html)。
    * 日期区间支持使用动态函数设置默认值。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4525792471/p933324.png)

      请参见[日期查询](https://help.aliyun.com/document_detail/151454.html)。
    * 查询控件的"查询"、"清空"、"重置"按钮，支持调整展示顺序。

      请参见[配置查询控件样式](https://help.aliyun.com/document_detail/2586366.html)。
  * **高级计算** ：在下钻、维度组切换、交叉表字段筛选场景下，同环比的计算配置支持跟随粒度变化。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8648692471/p929355.gif)

    具体请参见[同环比](https://help.aliyun.com/document_detail/177518.html)。
* **企业级能力**

  * **办公协同**

    * PC微应用支持在工作台进行报表搭建，通过办公软件同步进来（钉钉/企微/飞书）且拥有编辑权限的账号，支持在PC端微应用中创建和编辑各类数据作品。

      请参见[（公共云）开通钉钉微应用](https://help.aliyun.com/document_detail/607098.html)、[（公共云）开通企业微信微应用](https://help.aliyun.com/document_detail/607162.html)、[（公共云）开通飞书微应用](https://help.aliyun.com/document_detail/2398309.html)。
    * 钉钉审批支持自定义审批模板，帮助用户基于现有的审批流，实现加签、增加审批流程等操作。

      请参见[自定义模板配置](https://help.aliyun.com/document_detail/607156.html#fafb6e4659vxk)。