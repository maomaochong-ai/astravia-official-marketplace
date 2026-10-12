## 发布日期
2020年12月2日

## 更新内容
* 数据源
  * 新增云数据源Hologres。 请参见[云数据源Hologres](https://help.aliyun.com/document_detail/184795.html#task-2492443 "添加Hologres数据源用于连通阿里云Hologres数据库与Quick BI，连接成功后，您可以在Quick BI上进行数据的分析与展示。Quick BI支持以公网连接阿里云Hologres，本文为您介绍如何添加阿里云Hologres数据源。")。

  * 文件数据源中，上传Excel文件大小限制由20 MB提高至50 MB。 请参见[创建文件数据源](https://help.aliyun.com/document_detail/168026.html#task-2505852 "Quick BI支持将本地的Excel文件和CSV文件上传至数据库中，作为文件数据源，满足您不断变化和增长的业务分析需求。本文介绍上传文件的入口、如何创建并修改文件数据源。")。

* 数据集
  * 数据集缓存时间配置项增加5分钟、2小时、4小时、12小时选项。
  * 编辑数据集时，支持展示字段备注名、表备注名。![2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2051875061/p184067.png)

    请参见[构建模型](https://help.aliyun.com/document_detail/104002.html#concept-yzb-qxr-ngb "数据关联（JOIN）用来连接不同的数据表。在数据分析时，当需要分析的数据存储在不同的表，您可以通过数据关联，把多个表连接起来，形成模型进行数据分析。")。
* 电子表格
  * 支持调整Sheet排列顺序。
  * 支持添加水印。

  请参见[电子表格配置操作](https://help.aliyun.com/document_detail/101221.html#concept-cwq-g1l-ggb "您可以在电子表格配置区对电子表格进行一系列的配置操作。")。
* 仪表板
  * 优化指标趋势图。
    * 支持双Y轴。![1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2051875061/p183959.png)
    * 支持设置双Y轴的数据格式。![2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2051875061/p183964.png)
    * 趋势图支持线图、面积图、柱图相互切换。![3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9395532161/p183967.png)
    * 升级坐标轴轴线样式、大小和排列布局。![4](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2051875061/p183973.png)
  * 翻牌器支持自定义背景颜色和背景图片。![5](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2051875061/p183975.png)
  * 优化指标看板。 支持维度拆分时支持维度高亮和维度切换。

  * 优化色彩地图和气泡地图。
    * 样式模板：新增极简背景、3D填充。
    * 地图配色
      * 填充色：默认为灰底，即区块没有颜色时的地图底色。
      * 轮廓线颜色：默认为无，您可以切换为其他颜色。
    * 显示底图：新增四种底图样式。
    * 新增3D地图。
    * 显示数据标签：支持地名和度量值一起显示。
    * 显示总计：支持自动汇总当前图表中的度量值总和，便于对比分析。
    * 色阶配置：新增按百分比区间划分。![12](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3051875061/p184012.png)
    * 最值颜色配置：新增前三名和后三名突出标记。
    * 开启指标筛选：支持在图表右上角切换不同的度量，进行多维分析。

    请参见[色彩地图](https://help.aliyun.com/document_detail/55653.html#concept-vsg-jl2-vdb "色彩地图用色彩的深浅来展示数据的大小和分布范围。本文为您介绍如何为色彩地图添加数据并配置样式。")和[气泡地图](https://help.aliyun.com/document_detail/55644.html#concept-zrl-kk2-vdb "泡地图以一个地图轮廓为背景，用附着在地图上的气泡来反映数据的大小，还可以直观地显示国家或地区的相关数据指标大小和分布范围。例如气泡地图可以展示各地旅游景点的客流量，或展示各地区的人均收入。本文为您介绍如何为气泡地图添加数据并配置样式。")。
  * 优化漏斗图
    * 样式模板：新增完美梯形，漏斗每一层的宽度不受数值大小的影响，仅用来展示漏斗流向。![14](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3051875061/p184016.png)![1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3051875061/p184020.png)![2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3051875061/p184023.png)
    * 联动高亮：联动的区块高亮显示。![16](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3051875061/p184030.png)

    请参见[漏斗图](https://help.aliyun.com/document_detail/55682.html#concept-u3s-1q2-vdb "漏斗图可以分析具有规范性、周期长和环节多的业务流程。通过漏斗图比较各环节业务数据，能够直观地发现问题。漏斗图还可以展示各步骤的转化率，适用于业务流程多的流程分析，例如通过漏斗图可以清楚地展示用户从进入网站到实现购买的最终转化率。本文为您介绍如何为对比漏斗图添加数据并配置样式。")。
  * 优化词云图
    * 词语显示规则：当词语超过卡片边界时，会显示...。![7](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1289116061/p184034.png)
    * 字体调整：词云图的字体调整为阿里普惠体。![78](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4051875061/p184037.png)
    * 联动高亮：联动的词语高亮显示。![80](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4051875061/p184041.png)

    请参见[词云图](https://help.aliyun.com/document_detail/55279.html#concept-lnr-m3f-vdb "词云图由词汇组成类似云的彩色图形，用于展示大量文本数据。例如，制作用户画像，对用户进行聚类，实现精细化营销。本文为您介绍如何为词云图添加数据并配置样式。")。
  * 优化散点图和气泡图 开启四象限后，在轴值区域支持XY轴度量中位数。

    请参见[气泡图](https://help.aliyun.com/document_detail/118641.html#concept-265020 "气泡图可以加入一个表示大小的变量进行对比，用于展示多个变量（最多6个变量）的关系。本文为您介绍如何为气泡图添加数据并配置样式。仅专业版的群空间支持创建气泡图。")。
* 升级仪表板控件
  * 新增图表内查询控件，您可以在单个图表中配置查询条件。  
    系统为您定义好模板，您可以根据需要选择，快捷地完成查询条件样式的设置，节约时间成本。 ![12](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0173875061/p184085.png) ![12](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4051875061/p183930.png)

    请参见[图表内创建查询条件](https://help.aliyun.com/document_detail/190042.html#task-2383818 "您可以在仪表板中为某个图表创建查询条件。")。
  * 支持配置报表全局功能，来实现记住当前组织内所有查询条件。请参见[报表全局配置](https://help.aliyun.com/document_detail/189990.html#task-1997212 "组织管理员可以配置报表全局功能，来实现记住当前组织内所有查询条件。")。
* 在数据面板选择维度和度量字段时，支持批量选择字段。
  * Windows/MAC系统下，按Shift+鼠标左键，可以连续选择字段。
  * MAC系统下，Command+鼠标左键，可以选择多个字段。
  * Windows系统下，Ctrl+鼠标左键，可以选择多个字段。
* 配置管理
  * 数据门户菜单授权：支持从用户组选择用户。![菜单权限管理](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9361775061/p183762.png)请参见[数据门户菜单权限](https://help.aliyun.com/document_detail/102203.html#concept-zwg-wd4-jgb "空间管理员在工作空间下可以对数据门户进行菜单权限设置。")。
  * 支持添加钉钉账号为组织成员，可单个或批量添加钉钉账号。![44](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4051875061/p184058.png)

    请参见[添加钉钉账号为组织成员](https://help.aliyun.com/document_detail/191116.html#concept-1958029 "本文为您介绍组织管理员如何添加钉钉账号至Quick BI组织中。组织管理员可以一次性添加单个或多个钉钉账号。")。
  * 血缘分析增加查询类型，支持通过报表、数据集、数据源\&数据集查询。![123](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4051875061/p184061.png)请参见[报表血缘分析](https://help.aliyun.com/document_detail/108161.html#concept-cgb-pxc-wgb "本文主要为您介绍如何查看某报表的工作空间、报表名称、报表类型、数据集、数据表和数据源名称信息。")。
* 数据填报
  * 支持将数据填报编辑权限授权给当前项目空间的所有开发者，或指定开发者。
  * 分享范围新增分享给当前工作空间下的所有成员，授权类型可选仅提交数据、提交及管理本人数据。
  * 管理表单新增批量导入、批量导出、查询等功能。

  请参见[概述](https://help.aliyun.com/document_detail/104514.html#concept-ktg-ytz-ngb "数据填报是专为业务的数据字段录入提供的功能，您可以将业务人员录入数据存放在业务库中，并进行二次数据分析。仅专业版和高级版群空间支持数据填报。")。
* 开放服务
  * 专业版新增14个API接口。
  * 开放服务支持组件管理，可添加自定义组件，用于仪表板。

  请参见[API概览](https://help.aliyun.com/document_detail/179307.html#concept-1936579 "本文为您介绍Quick BI提供的API接口。")。
* 移动端
  * 支持图表内查询控件。
  * 地图支持下钻、跳转（含参数跳转、外部链接跳转）。
  * 指标趋势图支持自定义背景颜色、背景图片。指标带小趋势图时，小趋势图支持自定义颜色。
  * 线图、柱图取消坐标轴、轴标签。
  * 移动端支持tooltips。![17](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6537875061/p184045.png)![18](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6537875061/p184093.png)

## 下线功能
词云图：数据配置面板下线度量排序功能，默认按度量降序排列，不可修改。