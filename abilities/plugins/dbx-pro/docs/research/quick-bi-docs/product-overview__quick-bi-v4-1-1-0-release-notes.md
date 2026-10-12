## 发布日期
2021年11月04日

## 变更内容
* 在邮件订阅中使用自定义邮箱时，新增支持StartTLS加密方式，新增邮件协议和加密方式参数，配置更灵活。![自定义邮箱](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6665446361/p346586.png)请参见[创建订阅任务](https://help.aliyun.com/document_detail/101302.html#task-2448819 "本文介绍如何创建订阅任务，并通过邮件、钉钉工作通知和钉钉群的方式推送订阅任务。")。
* Data Lake Analytics数据源支持设置监控指标。 基于Data Lake Analytics数据源创建的仪表板，支持配置监控预警。您可以设置监控指标，进行小时、日和月粒度的实时监控，请参见[概述](https://help.aliyun.com/document_detail/114134.html#concept-nnd-pvv-jhb "监控指标用于监控图表中的指标，提供小时、日和月粒度的实时监控。您可以设置告警的接收方式，支持接收告警的方式有邮件、短信、钉钉工作通知和钉钉群。当发生告警时，可以通过设置接收告警的方式发送给用户。")。

* 查询控件
  * 日期输入框的快捷区间中，新增年初至上月和年初至本月选项。![1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6665446361/p348679.png)
    * 年初至上月：本年的第一个月到上个月。

      例如，现在是2021年11月，那么年初至上月的时间范围就是2021年1月\~2021年10月。
    * 年初至本月：本年的第一个月到本月。

      例如，现在是2021年11月，那么年初至本月的时间范围就是2021年1月\~2021年11月。

    请参见[新建查询控件](https://help.aliyun.com/document_detail/151455.html#task-2383818 "通过查询控件可以查询单个或多个图表中的数据，一个仪表板中可以添加多个查询控件，但只支持一个查询控件置顶。")。
  * 级联支持跨级联的场景。  
    假设查询控件中包含区域、省份和城市字段，您设置级联条件为 区域省份城市，则当您选择 区域为 华东，即使不选择省份，则城市中也仅呈现华东区域的城市，实现跨级级联。 ![配置](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4516866361/p348681.gif)请参见 [配置条件级联](https://help.aliyun.com/document_detail/160352.html#task-2455905 "查询控件的关联时，例如控件A中选择了地域，控件B中的省份列表就只有控件A已选定的地域下的省份，则需要配置控件A和控件B的关联关系。您也可以配置同一控件中几个条件的关联关系。本文主要为您介绍如何通过配置条件级联来关联查询控件。")。
  * 树形下拉支持全选。![树形下拉](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2141156361/p348682.gif)
* 数据集加速配置中，新增失败报警的配置。![5](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6665446361/p348684.png)
* 新增简约风格主题和色系。 图 1. 简约主题 ![简约主题](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3816256361/p348894.png) 图 2. 简约色系 ![简约色系](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3816256361/p348890.png)