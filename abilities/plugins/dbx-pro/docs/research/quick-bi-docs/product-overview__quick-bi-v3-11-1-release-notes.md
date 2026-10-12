## 发布日期
2021年03月02日

## 新增内容
* 新增自建数据源Snowflake。 请参见[自建数据源Snowflake](https://help.aliyun.com/document_detail/205712.html#task-2492443 "新建Snowflake数据源用于连通Snowflake数据源与Quick BI。如果业务数据来源于Snowflake数据源，则在您开始基于Quick BI开发数据前，需要新建Snowflake数据源。本文为您介绍新建Snowflake类型的自建数据源。")。

* 自助取数新增支持Clickhouse数据源。 请参见[概述](https://help.aliyun.com/document_detail/113013.html#concept-y2f-5ky-ghb "自助取数功能可以帮助您将所需数据以Excel的形式下载到本地。目前支持对数据源MySQL、MaxCompute、Oracle、AnalyticDB for MySQL 3.0、Clickhouse的自助取数下载。")。

* 移动端指标卡趋势图、色彩地图、气泡地图支持指标筛选器。 请参见[开启指标筛选展示效果](https://help.aliyun.com/document_detail/162915.html#section-zh3-s34-526)。

## 更新内容
* 管理员才能创建数据源，开发者无数据源创建权限。 请参见[数据源权限列表](https://help.aliyun.com/document_detail/197503.html#concept-1995599 "本文为您介绍数据源的操作权限列表。")。

* 优化查询控件。
  * 当隐藏级联条件中的查询条件时，除了隐藏第一层级时级联配置会保留，其余情况级联配置都会清空。 请参见[配置条件级联](https://help.aliyun.com/document_detail/160352.html#task-2455905 "您要进行查询控件间的关联，例如控件A中选择了地域，控件B中的省份列表就只有控件A已选定的地域下的省份，则需要配置控件A和控件B的关联关系。您也可以配置同一控件中几个条件的关联关系。本文主要为您介绍如何通过配置条件级联来进行查询控件之间的关联。")。

  * 查询控件中选择平铺样式时，支持设置筛选器宽度。  
    请参见 [新建查询控件](https://help.aliyun.com/document_detail/151455.html#task-2383818 "通过查询控件可以查询单个或多个图表中的数据，一个仪表板中可以添加多个查询控件，但只支持一个查询控件置顶。")。 ![设置筛选器宽度](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3892764161/p244633.png)
* 在桑基图中，数据面板中支持添加的节点类别/维度字段从5个增加到20个。  
  请参见 [桑基图](https://help.aliyun.com/document_detail/126372.html#concept-1305366 "本文为您介绍桑基图的使用场景、配置样式和删除桑基图。仅高级版和专业版群空间支持创建桑基图。")。 ![桑基图](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3892764161/p244638.png)
* 线柱图视觉效果优化。 <table> <caption></caption> <colgroup> <col> <col> <col> <col> </colgroup> <thead> <tr> <th>图表</th> <th>优化点</th> <th>优化前</th> <th>优化后</th> </tr> </thead> <tbody> <tr> <td>线图</td> <td>加深轴标签颜色</td> <td><img></td> <td><img></td> </tr> <tr> <td>柱图</td> <td>缩小分组柱图的间距</td> <td><img></td> <td><img></td> </tr> </tbody> </table>
* 优化跳转功能。
  * 支持时间参数跳转。![跳转-1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4892764161/p244991.png)
  * 支持圈选多维值跳转。![跳转-2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4892764161/p244993.gif)
  * 支持跳转时在弹窗打开。![跳转-3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4892764161/p244994.gif)
* 在自定义组件平台注册或修改组件时增加开启Shadow DOM选项。

  Shadow DOM是一个浏览器功能，开启后可以实现样式隔离。

## 下线功能
* 下线透视表：透视表从导航栏下线，新创建的交叉表代替透视表。已创建的透视表未变，仍可继续使用，也可以从样式版本切换升级到新版本交叉表。