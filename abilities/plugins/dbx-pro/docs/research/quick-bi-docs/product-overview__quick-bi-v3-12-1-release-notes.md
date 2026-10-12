## 发布日期
2021年05月13日

## 变更内容
* 数据源
  * 新增Kylin数据源，请参见[自建数据源Kylin](https://help.aliyun.com/document_detail/216049.html#task-2046445 "新建Kylin数据源用于连通Kylin数据源与Quick BI。如果业务数据来源于Kylin数据源，则在您开始基于Quick BI开发数据前，需要新建Kylin数据源。本文为您介绍新建自建数据源Kylin。")。
  * Quick BI支持通过阿里云VPC网络连接云数据源ClickHouse、AnalyticDB for MySQL 3.0、RDRS，请参见[云数据源ClickHouse](https://help.aliyun.com/document_detail/181217.html#task-2492443 "本文为您介绍如何创建云数据源ClickHouse。仅专业版和高级版群空间支持创建ClickHouse数据源。")。![3.12.1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2253160261/p271759.png)
  * 自助取数支持Impala数据源，请参见[概述](https://help.aliyun.com/document_detail/113013.html#concept-y2f-5ky-ghb "自助取数功能可以帮助您将所需数据以Excel的形式下载到本地。目前支持对数据源MySQL、MaxCompute、Oracle、AnalyticDB for MySQL 3.0、Clickhouse、Impala的自助取数下载。")。
* 查询控件
  * 文本输入框中新增结尾是和非空文本规则。![新增规则](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3596090261/p272627.png)
  * 文本控件中，下拉列表和树形下拉新增预先查询功能。  
    打开仪表板后预先查询下拉列表的内容值，能够按照行级权限的配置展示各个账号对应的下拉列表值，且每个人的默认值也会根据对应行级权限的配置而有所不同。 ![单个数据集312.1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0562920261/p270904.png)

  请参见[文本查询](https://help.aliyun.com/document_detail/151453.html#task-2384036 "查询控件支持查询文本字段，本文为您介绍如何设置一个文本查询控件，用于查询文本字段。")。
* 新增模板市场。![进入模式市场312.1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9950280261/p271334.png)
  * Quick BI个人空间不支持市场模板。
  * Quick BI高级版群空间仅支持查看模板效果，不支持一键式应用模板。
  * Quick BI专业版群空间支持查看模板效果，也支持一键式应用模板。
* 可视化图表
  * 线图新增数据对比功能，请参见[数据对比分析](https://help.aliyun.com/document_detail/216048.html#task-2078234 "本文为您介绍如何配置度量的数据对比。")。![效果示意图312.1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7348160261/p271687.png)
  * 线型图：鼠标移动到辅助线上，显示辅助线名称。![辅助线](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3596090261/p272650.png)
  * 当图表配置颜色图例时，支持在数据面板的字段批量设置上设置字段。 <table> <caption></caption> <colgroup> <col> <col> </colgroup> <thead> <tr> <th>优化前</th> <th>优化后</th> </tr> </thead> <tbody> <tr> <td><img></td> <td><img></td> </tr> </tbody> </table>
* 优化饼图样式展示，请参见[饼图](https://help.aliyun.com/document_detail/55621.html#concept-gwq-4f2-vdb "本文为您介绍饼图应用场景、配置样式和如何删除饼图。")。
  * 在图表样式中，新增设置完成占比小数位数。![占比312.1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6273370261/p272670.png)
  * 在功能配置中，新增开启指标筛选展示。![饼图312.1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6273370261/p272675.png)
* 优化交叉表样式，请参见[新交叉表](https://help.aliyun.com/document_detail/200338.html#concept-wc5-zl2-vdb "本文您介绍新版交叉表的基本操作、常用配置及效果展示。")。
  * 保留空数据表头。
    * 若数据返回为空，则保留表头；若表头包括指标分组，则指标分组也要保留。
    * 若用户本来设置的就是没有列表头，则列表头直接不显示。

    ![空表头](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4596090261/p273344.png)
  * 数据配置端支持全局排序
    * 所有度量均支持配置升序、降序、组内升序、组内降序。
    * 全局排序的指标只能有一个，其他指标均为组内排序。
    * 若某个指标选择了全局排序，则其他指标变为组内排序。

    ![组内排序](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4596090261/p273353.png)![全局排序](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4596090261/p273354.png)
  * 树状无须再往下展开。  
    若某个根结点无数据，则直接在根节点上展示数值。 ![无需展开](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4596090261/p273361.png)
  * 维度筛选恢复初始配置。  
    开启字段内容筛选展示后，当已选字段仅包含维度字段时，在图表右上角出现 ![撤销312.1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4596090261/p273364.png)图标，去勾选 ![撤销312.1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4596090261/p273364.png)后，筛选就会恢复初始配置。 ![撤销312.1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4596090261/p273366.png)
* 优化组织管理页面。  
  组织管理页面中，有以下变更：
  * 组织成员页签变更为用户页签。
  * 批量添加组织成员选项变更为批量添加。

    批量添加的附件模板有变更，请获取批量添加用户信息模板，下载最新模板。
  * 添加组织成员选项变更为添加用户。

    添加用户时，支持配置所属用户组。
  * 新增批量导出、批量更新选项。
  * 支持删除用户，您可以选择并批量删除用户。
* 移动端跳转。  
  跳转到弹窗时，在当前页面打开弹窗，不再整个页面跳转。 ![移动端2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4596090261/p273448.gif)