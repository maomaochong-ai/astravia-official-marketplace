## 发布日期
2021年11月30日

## 重点升级概览
* 可视化升级 矩形树图、组合图、排行榜、堆积柱状图、桑基图等，样式配置均有能力升级。

* 多端能力 订阅和监控告警新增企业微信通知和企业微信群两种方式，让移动办公能力更加丰富；并升级监控告警配置内容，支持应用消息发送、图片发送、企业微信中免登录打开报表。

* 权限管理 权限申请与审批新增管理中心，查看所有审批进度，并支持批量审批，提高效率。

## 变更内容
* 矩阵树图的样式配置中，当显示标签为百分比时，允许设置小数点位数。![矩形树图](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5530728361/p358474.png)
* 在组合图的图表样式中，在显示双Y轴中增加左右轴刻度数据不一致的配置项，用于解决当右坐标轴的百分比在0\~100%的范围内时，左坐标轴因数据太大而失真的问题。![组合图](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5530728361/p358414.gif)
* 在排行榜的样式配置中，升级样式。
  * 增加数据相同时并列处理的配置项，可选择为排名或者密集排名，支持两种不同的并列处理方式。  
    如下图所示，华东和华北的销售金额为100万，华南和西北的销售金额为85万，东北的销售数据为70万，华中的销售数据为60万。
    * 选择排名时，华东和华北并列第一，华南和西北并列第三，东北为第五，华中为第六。
    * 选择密集排名时，华东和华北并列第一，华南和西北并列第二，东北为第三，华中为第四。

    ![排行榜](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5530728361/p359920.gif)
  * 增加排序列名称，用于自定义排序列的名称。![排名](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5530728361/p359925.png)
* 自定义SQL新增查询默认值，当SQL数据集的数据量过大时，仅通过参数查询会使数据返回时间过长，导致数据集保存超时失败，此时建议增加SQL参数默认值。Quick BI能根据默认值快速获取数据，降低查询时间。![传参](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5530728361/p359896.png)  
  SQL参数默认值的生效范围为 仅编辑页和 全局生效。
  * 仅编辑页：配置该选项后，该默认值仅在数据集预览页面生效。  
    例如，设置 `profit_amt＞200`，则配置效果如下图。 ![5](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0890387361/p359064.gif)
  * 全局生效：配置该选项后，基于该数据集创建的报表中，默认值的生效规则如下：
    * 若报表中没有查询控件或查询控件未设置默认值，则以数据集设置的查询默认值为准。  
      例如，设置数据集查询默认值为 `华东`，则仪表板中配置效果如下图。 ![1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8694987361/p359229.gif)
    * 若报表中的查询控件设置默认值，则以查询控件中的默认值为准。  
      例如，查询控件的默认值为 西北，则仪表板中配置效果如下图。 ![4](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8694987361/p359230.gif)
  请参见[SQL参数默认值](https://help.aliyun.com/document_detail/126677.html#section-tfm-i79-xat)。
* 堆积柱状图和堆积条形图支持按堆积总和排序。![3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8536197361/p359420.png)请参见[按堆积总和排序](https://help.aliyun.com/document_detail/65849.html#section-4qz-ddw-iuu)。
* 在桑基图的图表样式中，新增连线配色和连线透明度。![5](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6530728361/p360056.gif)
* 订阅和监控告警中新增企业微信通知和企业微信群2种方式，满足多端接收订阅任务的需求。 图 1. 订阅配置 ![订阅](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6530728361/p360250.png) 图 2. 监控告警配置 ![监控告警设置412](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2271428361/p360718.png)
  * 支持在应用内直接发消息。
  * 支持发送图片。
  * 支持在企业微信中打开报表页面，免登录。

  ![1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9382438361/p361262.png)
* 升级权限申请与审批，方便用户查看任务申请进度；也方便资源Owner高效处理审批任务。
  * 用户可以在统一的入口，看到权限的申请进度。![审批中](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6530728361/p361022.png)
  * 资源Owner随时查看并审批任务。![6](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6530728361/p361086.png)
  * 资源Owner支持批量审批任务。![批量](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6530728361/p361076.png)

  请参见[申请与审批权限](https://help.aliyun.com/document_detail/357817.html#task-2148150 "在Quick BI中，普通用户可以申请资源对象的权限，资源Owner可以批量审批任务的权限。")。