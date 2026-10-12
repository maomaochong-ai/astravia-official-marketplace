## 发布日期
2021年04月13日

## 新增内容
* 数据集
  * 数据集支持关联ADB数据表，请参见[数据源常见问题](https://help.aliyun.com/document_detail/89493.html#concept-2423959 "本文汇总了创建数据源的常见问题。")。
  * 数据集支持替换同类型的数据源。![更换数据源](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0200666161/p254753.png)
* 可视化图表
  * 新交叉表和排行榜支持排名计算，请参见[数据排名](https://help.aliyun.com/document_detail/211446.html#task-2062624 "排名是对分组后的指标进行数值大小的排名，便于用户进行数据大小比较。数据分析中，您可以查看度量的排名，帮助您做决策。本文为您介绍如何设置数据排名。")。  
    ![交叉表排名](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4334807161/p255790.png) ![设置排名](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8740676161/p255503.png)
  * 度量字段累计计算支持历年累计，请参见[累计计算](https://help.aliyun.com/document_detail/211447.html#task-1918654 "本文为您介绍如何配置度量的累计计算。")。![day字段](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4384807161/p258809.png)  
    **说明**
    * 度量字段上未配置同环比功能。
    * 仅求和指标的字段（![求和指标](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4384807161/p258827.png)）才支持配置累计计算。
    * 维度字段上有且只有1个日期字段，且字段类型为年粒度、季粒度、月粒度、周粒度、日粒度的任意一种，才支持配置累计计算。
  * 度量字段聚合方式支持百分位、中位数，请参见[配置度量数据](https://help.aliyun.com/document_detail/65847.html#section-ete-gn7-q7s)。  
    数据源与聚合方式支持情况如下所示： <table> <caption></caption> <colgroup> <col> <col> </colgroup> <thead> <tr> <th>数据源</th> <th>聚合方式</th> </tr> </thead> <tbody> <tr> <td>可以连接Quick BI的数据源均支持</td> <td>求和、平均值、计数、去重计数、最大值、最小值</td> </tr> <tr> <td>MySQL、Vertica、SAP IQ（Sybase IQ）、SQL Server、Presto、PPAS、PostgreSQL、Oracle、MaxCompute、Hive、SAP HANA、AnalyticDB for PostgreSQL、Gbase、IBM DB2 LUW、Clivia、ClickHouse、AnalyticDB for MySQL 2.0 </td> <td>总体标准差、样本标准差、总体方差、样本方差</td> </tr> <tr> <td>Hbase</td> <td>总体标准差</td> </tr> <tr> <td>SAP IQ（Sybase IQ）、Oracle、MaxCompute、SAP HANA、IBM DB2 LUW、Presto、Hbase、AnalyticDB for PostgreSQL、PostgreSQL </td> <td>中位数</td> </tr> <tr> <td>SAP IQ（Sybase IQ）、Oracle、MaxCompute、SAP HANA、IBM DB2 LUW、ClickHouse</td> <td>百分位</td> </tr> </tbody> </table>
  * 新交叉表支持字段筛选和排序功能，请参见[新交叉表](https://help.aliyun.com/document_detail/200338.html#concept-wc5-zl2-vdb "新交叉表可以显示表中某个字段的汇总值，并对同类数据合并。其中一组列在表的左侧，另一组列在表的上部。行和列的交叉处可以对数据进行多种汇总计算，例如求和、平均值、记数、最大值和最小值。本文为您介绍如何为新交叉表添加数据并配置样式。")。
    * 在功能型配置开启字段内容筛选展示后，可指定要展示的字段，更新后生效。![图表设计312](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2387787161/p261604.png)
    * 在功能型配置开启字段内容筛选展示后，在预览状态下，您可以交叉表上单击已选字段下拉列表，对字段进行筛选或排序。![拖动交叉表1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5118687161/p261563.gif)  
      您也可以直接拖动字段调整顺序。 ![交叉表预览](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5118687161/p261667.gif)
  * 新交叉表支持钉钉事件，请参见[事件](https://help.aliyun.com/document_detail/212397.html#concept-1953472 "Quick BI中，交叉表支持数据填报和钉钉两种事件。当您在交叉表中添加数据填报事件，则可以将数据内容录入到目标数据库中，完成数据填报。当您在交叉表中添加钉钉事件时，则可以在移动端将数据内容通过Ding、待办、日程方式发送给钉钉用户。")。![钉钉事件](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6759597161/p262071.png)
  * 翻牌器支持添加icon或图片作为图标，支持自定义字号，支持添加示意图。![字号设置312](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7423627161/p259240.png)![配置修饰图312](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7423627161/p259244.png)
  * 指标看板支持添加图片，请参见[图片维度在指标看板中的应用](https://help.aliyun.com/document_detail/209173.html#section-pfp-ju5-4vw)。![商品图片312](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6009767161/p260434.png)
* 移动端
  * 在PC端配置新交叉表的钉钉事件后，在钉钉微应用中，支持将数据内容通过Ding、待办、日程方式发送给钉钉用户。  
    如果在事件配置中配置了数据负责人，则可以直接联系到数据负责人。 ![事件配置](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2387787161/p261612.png)

  请参见[添加钉钉事件](https://help.aliyun.com/document_detail/212397.html#section-e8e-1n0-8du)。
* 开放服务
  * 使用自定义组件时支持自定义背景填充。
  * 注册自定义组件时支持选择是否在移动端展示，支持配置依赖的第三方库。
  * 为了便于调试自定义组件，在仪表板编辑页URL中增加`useComponent=dev`、`useComponent=release`或`useComponent=local`参数后，工具栏的自定义组件的tooltips上将增加本地调试入口。
  * 自定义组件支持卡片自定义菜单配置，通过修改meta.js的配置来扩展菜单项。
* 交互式分析
  * 优化圈选功能。
    * 只看：您可以通过圈选交互，只查看局部选中的数据。![只看312](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2864527161/p259663.gif)
    * 排除：您可以通过圈选交互，去除一些异常点或者噪点。![排除312](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3864527161/p259668.gif)
    * 查看数据：您可以通过圈选局部区域，查看数据的明细情况。![查看数据312](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3864527161/p259669.gif)
    * 标注：您可以通过选中目标位置，添加标注。![标注312](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3864527161/p259671.gif)  
      **说明** 目前仅以下图表支持标注功能：
      * 趋势类图表：线图、面积图、堆积面积图、百分比堆积面积图、组合图
      * 比较类图表：柱图、堆积柱形图、百分比堆积柱形图、条形图、堆积条形图、百分比堆积条形图
      * 关系类图表：散点图、气泡图
      * 空间类图表：色彩地图、气泡地图
    * 通过圈选钻取功能，您可以同时圈中多个维值，并查看下一层级的数据。  
      以company_sales_record数据集为例，设置饼图的钻取效果。 ![圈选联动](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8669735161/p248316.gif)
  * 优化标注功能。
    * 散点图和气泡图支持象限标注。![气泡图312](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6804677161/p260448.png)
    * 散点图、气泡图、色彩地图和气泡地图支持标注功能。![标注效果图312](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9600954561/p260616.png)
    * 以下图表支持通过圈选有效区域添加手工标注。![散点图312](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7804677161/p259378.gif)  
      **说明** 仅以下图表支持圈选添加标注。
      * 趋势类图表：线图、面积图、堆积面积图、百分比堆积面积图、组合图
      * 比较类图表：柱图、堆积柱形图、百分比堆积柱形图、条形图、堆积条形图、百分比堆积条形图
      * 关系类图表：散点图、气泡图
  * 散点图和气泡图支持为四象限设置颜色。![气泡图开启四象限312](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3387787161/p260477.png)![配置四象限312](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2936767161/p259352.png)

## 更新内容
* 优化主题设计的配置项，请参见[管理主题模板](https://help.aliyun.com/document_detail/144981.html#concept-2341281 "本文为您介绍如何新增自定义主题模板或设置仪表板的模板主题。")。![主题设计](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3387787161/p261698.png)
* 优化数据视觉效果，请参见[新建数据门户](https://help.aliyun.com/document_detail/102067.html#task-qhl-xhs-3gb "本文为您介绍如何新建数据门户。")。![数据门户](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3387787161/p261704.png)
* 优化订阅功能。
  * 订阅设置项增加截图宽度、切图发送、邮件图片宽度、发送邮箱，对内容设置项的要求变更。
  * 订阅任务列表显示优化、查询优化。
  * 增加发送记录页签，支持查询各订阅任务的发送记录。