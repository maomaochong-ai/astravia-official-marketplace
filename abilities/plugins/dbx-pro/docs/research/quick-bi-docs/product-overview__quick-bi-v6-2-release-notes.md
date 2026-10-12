<br />

## **发布日期**
2026年5月7日

## 重点升级概览
* **智能小Q**

  * **智能小Q Skill**

    * Quick BI 智能分析Skill可接入各大AI Agent应用平台，您可在悟空、Qoderwork 、OpenClaw等Agent工具中一键安装或通过对话调用小Q问数、小Q报表、小Q解读和小Q报告的能力，构建一站式分析链路。

  * **Quick BI CLI**

    * 新增 Quick BI CLI，作为Quick BI 基于 OpenAPI 的命令行工具，支持在 Claude Code、OpenClaw、Qoderwork、QClaw、悟空等 AI 原生平台高效管理组织权限、数据资源、嵌入分析及审计日志。

  * **智能体工坊**：支持接入HiAgent。

  * **个人知识库**：支持按照分析思路、内容模板分别添加知识内容，且知识内容添加后可按需编辑管理。

  * **主题定制**：智能小Q新增"主题定制"功能，支持按企业品牌规范灵活配置界面元素，实现与品牌调性高度统一，强化企业身份识别。

  * **小Q报告**

    * 新增预生成任务功能。配置预生成任务后，可定时提前更新报告数据，避免预览报告时加载时间过长。

    * 小Q报告支持评论，并支持通过监听事件推送。

    * 洞察分析思维链路优化，支持在执行解读时查看大模型的数据分析过程，以验证生成结果的可信度。

  * **小Q解读**：新增小Q解读订阅能力，可将仪表板数据解读设为定时任务，按日、周等周期自动生成解读，并通过站内消息或钉钉、飞书、企业微信、邮件等渠道主动推送给您。

  * **小Q问数**：分析主题支持追问。

* **数据构建**

  * **数据源**

    * 阿里云数据源RDS MySQL DuckDB支持数据填报、复杂表格填报。

    * 应用数据源Dataphin新增StarRocks引擎类型。

  * **数据集**：关系模型支持自动生成关联字段，并支持创建自定义计算作为关联字段。

* **数据分析**

  * **仪表板**：字段显示内容支持配置链接，配置后点击即可跳转至对应页面。

  * **可视化图表**

    * 百分比堆积类图表的移动端图例、数据标签、工具提示及移动端图例配置优化：百分比设置不再继承或受坐标轴配置的影响，与坐标轴配置完全解耦，将仅受到样式面板中对应配置项的独立控制。

    * 指标趋势图中辅助趋势图的数值展示格式支持独立于主图单独配置，提升副指标数据表达的灵活性与精确性。

    * 气泡图、散点图、动态条形图的辅助线支持展示设定值和名称。

  * **电子表格**

    * AI函数功能优化：

      * 支持对AI函数区块内生成错误的单元格进行重新生成操作。

      * 「生成中」状态标识优化，帮助您更好地识别AI函数的处理进程。

      * 数据范围编辑体验提升，支持在编辑AI函数时修改数据范围。

  * **电子表格填报**

    * 填报下发任务支持多选sheet页。

    * 支持设置仅允许通过填报任务提交，开启后，用户只能通过填报任务入口提交，从工作台或直接打开电子表格将无法提交。

  * **查询控件**：支持在配置每个查询条件时，设置其枚举值是否显示空值。

  * **数据门户**：移动端平铺布局支持配置标题字体大小。

* **企业级能力**

  * **智能运维**：资源包新增支持即席分析。

* **开放平台**

  * **嵌入JS SDK**：小Q问数和小Q报告支持嵌入SDK能力。

  * **以下OpenAPI更新**：

    * WorexportRecords接口增加小Q报告类型和探索分析类型的导出记录。

## 变更内容
* **智能小Q**

  * **智能小Q Skill**

    * Quick BI 智能分析Skill可接入各大AI Agent应用平台，您可在悟空、Qoderwork 、OpenClaw等Agent工具中一键安装或通过对话调用小Q问数、小Q报表、小Q解读和小Q报告的能力，构建一站式分析链路。

      请参见[智能小Q Skill操作手册](https://help.aliyun.com/document_detail/3026669.html)。
  * **Quick BI CLI**

    * 新增 Quick BI CLI，作为Quick BI 基于 OpenAPI 的命令行工具，支持在 Claude Code、OpenClaw、Qoderwork、QClaw、悟空等 AI 原生平台高效管理组织权限、数据资源、嵌入分析及审计日志。

      请参见[Quick BI CLI 安装与使用指南](https://help.aliyun.com/document_detail/3027271.html)。
  * **智能体工坊**：支持接入HiAgent。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4486308771/p1070772.png)

    请参见[智能体管理](https://help.aliyun.com/document_detail/2876539.html)。
  * **个人知识库** ：支持按照分析思路、内容模板分别添加知识内容，且知识内容添加后可按需编辑管理。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7339013771/p1056811.png)请参见[小Q报告创建](https://help.aliyun.com/document_detail/2948531.html)。

  * **主题定制** ：智能小Q新增"主题定制"功能，支持按企业品牌规范灵活配置界面元素，实现与品牌调性高度统一，强化企业身份识别。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4486308771/p1069846.png)请参见[主题定制](https://help.aliyun.com/document_detail/3029889.html)。

  * **小Q报告**

    * 新增预生成任务功能。配置预生成任务后，可定时提前更新报告数据，避免预览报告时加载时间过长。

    * 小Q报告支持评论，并支持通过监听事件推送。

    * 洞察分析思维链路优化，支持在执行解读时查看大模型的数据分析过程，以验证生成结果的可信度。

    请参见[报告内AI助手](https://help.aliyun.com/document_detail/2949377.html)、[小Q报告管理](https://help.aliyun.com/document_detail/2948530.html)。
  * **小Q解读**：新增小Q解读订阅能力，可将仪表板数据解读设为定时任务，按日、周等周期自动生成解读，并通过站内消息或钉钉、飞书、企业微信、邮件等渠道主动推送给您。

    请参见[小Q解读订阅](https://help.aliyun.com/document_detail/3027552.html)。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4743516771/p1067233.png)
  * **小Q问数**：分析主题支持追问。

* **数据构建**

  * **数据源**

    * 阿里云数据源RDS MySQL DuckDB支持数据填报、复杂表格填报。

    * 应用数据源Dataphin新增StarRocks引擎类型。

    请参见[数据源高阶功能项支持列表](https://help.aliyun.com/document_detail/2642723.html)、[阿里云数据源RDS MySQL DuckDB](https://help.aliyun.com/document_detail/2999770.html)、[创建应用数据源Dataphin](https://help.aliyun.com/document_detail/166152.html)。
  * **数据集**：关系模型支持自动生成关联字段，并支持创建自定义计算作为关联字段。

    请参见[关系模型操作说明](https://help.aliyun.com/document_detail/3017351.html)。
* **数据分析**

  * **仪表板**：字段显示内容支持配置链接，配置后点击即可跳转至对应页面。

    请参见[配置图表字段](https://help.aliyun.com/document_detail/65847.html)。
  * **可视化图表**

    * 百分比堆积类图表的移动端图例、数据标签、工具提示及移动端图例配置优化：百分比设置不再继承或受坐标轴配置的影响，与坐标轴配置完全解耦，将仅受到样式面板中对应配置项的独立控制。

      请参见[线图](https://help.aliyun.com/document_detail/55053.html)、[面积图](https://help.aliyun.com/document_detail/68315.html)、[柱图](https://help.aliyun.com/document_detail/55596.html)。
    * 指标趋势图中辅助趋势图的数值展示格式支持独立于主图单独配置，提升副指标数据表达的灵活性与精确性。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4486308771/p1070774.png)请参见[指标趋势图](https://help.aliyun.com/document_detail/126497.html)。

    * 气泡图、散点图、动态条形图的辅助线支持展示设定值和名称。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4486308771/p1070775.png)请参见[分析预警](https://help.aliyun.com/document_detail/114244.html)。

  * **电子表格**

    * AI函数功能优化：

      * 支持对AI函数区块内生成错误的单元格进行重新生成操作。

      * 「生成中」状态标识优化，帮助您更好地识别AI函数的处理进程。

      * 数据范围编辑体验提升，支持在编辑AI函数时修改数据范围。

      请参见[AI函数配置](https://help.aliyun.com/document_detail/3023358.html)。
  * **电子表格填报**

    * 填报下发任务支持多选sheet页。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8546308771/p1069863.png)

      请参见[填报任务下发](https://help.aliyun.com/document_detail/2618423.html)。
    * 支持设置仅允许通过填报任务提交，开启后，用户只能通过填报任务入口提交，从工作台或直接打开电子表格将无法提交。

      请参见[电子表格配置操作](https://help.aliyun.com/document_detail/101221.html)。
  * **查询控件**：支持在配置每个查询条件时，设置其枚举值是否显示空值。

    请参见[报表配置](https://help.aliyun.com/document_detail/2252060.html)、[文本查询控件](https://help.aliyun.com/document_detail/151453.html)。
  * **数据门户**：移动端平铺布局支持配置标题字体大小。

    请参见[创建移动端数据门户](https://help.aliyun.com/document_detail/2846231.html)。
* **企业级能力**

  * **智能运维**：资源包新增支持即席分析。

    请参见[资源包概述](https://help.aliyun.com/document_detail/145013.html)。
* **开放平台**

  * **嵌入JS SDK**：小Q问数和小Q报告支持嵌入SDK能力。

    请参见[嵌入JS SDK API](https://help.aliyun.com/document_detail/2883315.html)、[路由键一览表](https://help.aliyun.com/document_detail/2883317.html)。
  * **以下OpenAPI更新**：

    * WorexportRecords接口增加小Q报告类型和探索分析类型的导出记录。