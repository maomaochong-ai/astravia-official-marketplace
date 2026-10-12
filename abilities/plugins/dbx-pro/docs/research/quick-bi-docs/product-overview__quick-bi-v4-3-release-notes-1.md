## 发布日期
2022年04月14日

## 重点升级概览
* 全新上线数据准备模块，以可视化低代码的方式完成分析前的数据整理工作。
  * 支持可视化数据处理、预览，包括聚合、关联、合并、清洗加工。
  * 支持多种调度方式，包括手动调度，周期调度和动态参数调度。
  * 支持任务发布状态管理和运维管理。
* 移动端
  * 移动端图表展示支持栅格布局，一行可放置多个图表。
  * 支持布局缩放来调整单个组件尺寸和位置。
  * 支持布局个性化隐藏Tab内的单个图表。
* 可视化
  * 指标拆解树、指标趋势图、词云图等功能更新。
  * 查看数据支持原始数据。
  * 查询控件排序字段选择后允许删除，日粒度快捷区间新增上个季度。
  * 新电子表格，新增数据集跳转、支持PDF分页导出、支持分析模式。
  * 数据填报支持编辑锁功能，支持PolarDB数据源。
* 产品体验
  * 导航结构和列表优化升级。
  * 编辑抢锁机制优化。
  * 颜色选择器升级。
* 抽取加速支持Oracle数据源。
* 报表嵌入开通、嵌入配置URL生成实现产品化。

## 变更内容
*

  ### 数据准备

  数据准备（轻量ETL）可以将数据源表中的数据进行清洗、聚合、关联和合并等操作，并将加工后的数据输出，让不会写SQL代码的业务人员能够低成本完成BI可视化数据的准备。![数据分析](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4033329461/p426534.png)
  * 支持读取和写入多种数据库，包含MySQL、MaxCompute（ODPS）、SQL Server、AnalyticDB for MySQL 3.0和PostgreSQL。
  * 支持可视化数据处理、预览，包括聚合、关联、合并、清洗加工。
  * 支持多种调度方式，包括手动调度，周期调度（小时、天、周、月粒度）和动态参数调度。
  * 支持任务发布状态管理（发布态、草稿态），支持运维管理（手动触发终止任务、任务历史和日志查看）。

  请参见[数据准备](https://help.aliyun.com/document_detail/179304.html)。
*

  ### 移动端

  您可以通过下述入口，切换不同的布局模式。 ![模式_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5972620561/p430973.png)
  * 拖拽调整图表组件高度。  
    选中目标组件后，可以拖拽组件底部，上下挪动调整组件高度。 ![拖拽1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5971620561/p430970.gif)
  * 拖拽调整组件尺寸。![移动端_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4960620561/p430895.gif)
  * 拖拽调整组件顺序。![顺序_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4960620561/p430898.gif)
  * 一行展示多个图表组件![多个组件_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4960620561/p430963.png)
  请参见[移动端画布上的操作](https://help.aliyun.com/document_detail/303844.html#section-1s2-1ae-v80)。
*

  ### 可视化

  * 指标拆解树能力升级。  
    修改维度名称：鼠标悬浮至图表上，修改维度的名称。 ![自定义维度名称_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4408602561/p437104.gif)  
    显示占比：支持配置是否展示占比。 ![显示占比_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4408602561/p437096.gif)
    请参见[指标拆解树](https://help.aliyun.com/document_detail/163227.html#concept-k5j-cr2-vdb "指标拆解树通过分解核心指标，可以定位影响指标的关键渠道或关键成员。例如，指标拆解树可以方便的查看多个维度中的各个成员对整体的贡献，您也可以将度量值分解至一个或多个组，分析每个组的数据情况。本文为您介绍如何为指标拆解树添加数据并配置样式。仅专业版群空间支持创建指标拆解树。")。
  * 指标趋势图新增显示图表标签和数据标签展示方式。![标签展示_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8828802561/p437146.gif)请参见[指标趋势图](https://help.aliyun.com/document_detail/126497.html#concept-1305704 "指标趋势图可以展示多个指标最新日期的数据或阶段汇总数据，以及指标在某一段时间内的变化趋势。本文为您介绍如何为指标趋势图添加数据并配置样式。")。
  * 词云图新增分词模式，用于将智能拆解的例句根据拆解后词频次呈现词大小。![词云模式_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9952612561/p437662.png)请参见[词云图](https://help.aliyun.com/document_detail/55279.html#concept-lnr-m3f-vdb "词云图由词汇组成类似云的彩色图形，用于展示大量文本数据。例如，制作用户画像，对用户进行聚类，实现精细化营销。本文为您介绍如何为词云图添加数据并配置样式。")。
  * 图表支持查看原始数据。![查看数据_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3361432561/p437167.png)  
    查看的数据格式支持 格式化数据和 原始数据。
    * 格式化数据：经过数据库加工处理（例如，小数位较多时四舍五入仅展示小数后两位，或者数值太大时携带单位等）的数据。![格式化数据_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9648060561/p432671.png)
    * 原始数据：未经过加工处理的数据库数据。![元数据_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9648060561/p432673.png)
  * 查询控件中，日粒度快捷区间增加上个季度。![查询控件_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1542762561/p439423.png)
  * 电子表格支持导出PDF格式。![导出PDF_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3361432561/p437930.png)
  * 数据填报支持PolarDB数据源。请参见[概述](https://help.aliyun.com/document_detail/104514.html#concept-ktg-ytz-ngb "数据填报是专为业务的数据字段录入提供的功能，您可以将业务人员录入数据存放在业务库中，并进行二次数据分析。仅专业版和高级版群空间支持数据填报。")。
*

  ### 产品体验

  * 个人首页新增我的看板。![我的看板_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9004622561/p438334.png)
  * 企业门户新增排行榜、活跃达人和排序筛选。![企业门户_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9004622561/p438376.png)
  * 导航结构和列表优化升级。![管理资源_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9004622561/p438407.png)
  * 编辑抢锁机制优化。请参见[协同编辑仪表板](https://help.aliyun.com/document_detail/65854.html#section-9z7-fae-fwu)
  * 颜色选择器升级。  
    若已有图表的默认色系为 当前仪表板时，已有图表的色系随主题色系变化而变化。 ![当前仪表板_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3361432561/p438712.png)
*

  ### Quick引擎

  抽取加速支持Oracle数据源。请参见[配置Quick引擎](https://help.aliyun.com/document_detail/409908.html#task-2186693 "为了更好的优化数据集性能，Quick BI推出Quick引擎，Quick引擎支持直连模式、抽取加速、实时加速、查询缓存和维值加速5种计算模式，本文为您介绍如何配置Quick引擎。")。
*

  ### 开放集成

  ![开发者中心_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9004622561/p438408.png)
  * 报表嵌入配置升级。
    * 更新开通入口。![报表嵌入_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5031371561/p433727.png)
    * 嵌入配置URL生成实现产品化。![生成Ticket_4.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4031371561/p435898.png)请参见[报表嵌入数据权限控制和传参的安全增强方案](https://help.aliyun.com/document_detail/391291.html#task-2171649 "本文将为您介绍如何使用Ticket报表嵌入方案免登嵌入到第三方系统，同时可控制嵌入至第三方系统的Quick BI报表权限，以及如何通过票据管理有效防止链接被恶意分享数据泄露的问题。")。
  * 专业版下，组织管理员支持自定义组件和自定义模版。请参见[快速开始](https://help.aliyun.com/document_detail/410948.html#concept-2189439 "在Quick BI 中, 除了系统内置的图表组件之外, 您还可以开发自己的自定义组件，供您或您的组织使用。")和[自定义模版](https://help.aliyun.com/document_detail/410949.html#task-2189444 "本文为您介绍如何基于已有的仪表板或者电子表格，创建自定义模版。")。
  * API调用统计增加公共云POP API以及独立部署API的使用统计。![统计调用](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7403862561/p439451.png)
  * 新增报表嵌入统计分析。![开放统计](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7403862561/p439448.png)