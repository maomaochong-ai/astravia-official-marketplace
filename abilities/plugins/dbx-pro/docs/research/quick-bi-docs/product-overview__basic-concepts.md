本文介绍了Quick BI的核心流程、基本对象等概念。了解这些基本概念有助于您更好地使用本产品。  

## Quick BI的核心流程
![核心流程](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6574231951/p37889.png)

## Quick BI 的基本对象
* 数据源

* 数据集

* 电子表格（适用于Quick BI专业版和高级版）

* 仪表板

* 数据门户

**说明**

有关Quick BI版本的功能差别，请参见[版本对比](https://help.aliyun.com/document_detail/53282.html#92499c906edzo)。

<br />

## 数据源
您在使用 Quick BI 分析数据时，需要先指定原始数据所在的数据源。数据源就是数据所在的地方。Quick BI 中提供了多种添加数据源的方式：

* 从数据库添加数据源

* 上传本地文件

* 上传API数据源

* 上传应用数据源

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7858900071/p738375.png)

如果您想了解更多新建数据源的内容，请参见[概述](https://help.aliyun.com/document_detail/47483.html#concept-lpv-nxp-5db)。

## 数据集
您可以将各种不同的数据源中的表创建为数据集。在数据集列表中，您还可以对已添加的数据集做编辑、移动和删除操作。

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7858900071/p738376.png)

如果您想了解更多数据集的内容，请参见[概述](https://help.aliyun.com/document_detail/48637.html#concept-c4g-t2r-5db)。

## 电子表格
电子表格仅适用于高级版及专业版的群空间下。**类Excel** 的在线报表设计器，灵活个性化的报表样式配置，快捷的总小计自定义高级计算，支持在线、本地多元化的分析模式，业务人员亦可以自助完成"**格式复杂，信息量大**"的中国式报表，可实现包括但不限于各类业务明细表、分组报表、交叉报表、主子报表、分栏报表、查询类报表、填报类报表等表格的制作。

您在选中一个数据集后即可以对数据的内容进行分析。

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7858900071/p738389.png)

如果您想了解更多制作电子表格的内容，请参见[创建电子表格](https://help.aliyun.com/document_detail/61824.html#concept-txj-k2x-5db)。

## 仪表板
仪表板采用了更加灵活的磁贴式布局来显示报表数据的交互，它不仅可以将数据以可视化的方式呈现，还支持通过各种数据筛选和查询，使用各种数据展现方式，突出数据中的关键字段。

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7858900071/p738390.png)

如果您想了解更多制作仪表板的内容，请参见[概述](https://help.aliyun.com/document_detail/53408.html#concept-t2g-g3x-5db)。

## 数据门户
数据门户也叫数据产品。您可以使用数据门户功能构建例如经营分析系统的应用。数据门户不仅可以引用Quick BI中的数据结果，同时也支持外挂链接。

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7858900071/p738388.png)

如果您想了解更多数据门户的内容，请参见[数据门户概述](https://help.aliyun.com/document_detail/102066.html#concept-yqt-5hs-3gb)。

## 产品架构
Quick BI产品架构如下图所示。![能力](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4349601361/p324058.png)

Quick BI的主要模块和相关功能：

* 数据连接模块

  负责适配各种云数据源，包括但不限于 MaxCompute、RDS（MySQL、PostgreSQL、SQL Server）、Analytic DB、AnalyticDB for PostgreSQL、HybridDB for MySQL等，封装数据源的元数据/数据的标准查询接口。
* 数据建模模块

  负责OLAP多维分析模型构建，支持度量（例如业务量度量）、维度（例如日期型维度）、星型拓扑数据模型等常规语义的定义，可实现对数据源的模型进行转换。通过计算字段等功能，支持复用数据源的SQL语法，对多维分析模型的维度和度量进行数据加工处理，从而提升数据建模效率。
* 数据展示模块

  * 电子表格：负责在线电子表格（webexcel）的相关操作功能，涵盖行列筛选、普通/高级过滤、分类汇总、自动求和、条件格式等数据分析功能，并支持数据导出，以及文本处理、表格处理等丰富功能。

  * 仪表板：负责将可视化图表控件拖拽式组装为仪表板，支持线图、饼图、柱状图、漏斗图、气泡地图、色彩地图、指标看板等50多种图表；支持查询条件、TAB、IFRAME、PIC和文本框五种基本控件，支持图表间数据联动效果。

  * 数据门户：负责将仪表板拖拽式组装为数据门户，支持内嵌链接（仪表板），支持模板和菜单栏的基本设置。

  * 分享/公开：支持将电子表格、仪表板、数据门户分享给其他登录用户访问，支持将仪表板公开到互联网供非登录用户访问。

* 权限管理模块

  * 组织权限管理：负责组织和工作空间的两级权限架构体系管控，以及工作空间下的用户角色体系管控，实现基本的权限管理，实现不同的人看不同的报表内容。

  * 行级权限管理：负责数据的行级粒度权限管控，实现同一张报表，不同的人看不同的数据。