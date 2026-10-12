## **发布日期**
2025年7月17日

## 重点升级概览
* **智能小Q**

  * **小Q报告**

    * 基于本地文件、仪表板等一键生成智能数据报告，上手门槛低；

    * 支持联网搜索，可与内部数据、知识等深度融合，打造"数据+情报"的专业分析报告；

    * Al一键生成报告后也可编辑文档按需进行内容、格式的干预调整，要智能也要可控；

    * 产品内已有仪表板组件、问数、解读等数据结果可直接落入报告，减少重复建设成本；

    * 支持周期数据更新，满足各类周期性汇报、报告产出诉求。

    **说明**

    小Q报告功能属于增值模块，当前处于beta版本邀测阶段。如需试用，请您联系商务运营同学。
  * **小Q问数**：新增支持上传 Excel 本地文件进行问数。

  * **智能体**：新增支持对接百炼专属版智能体。

  * **仪表板数据解读**：数据解读开关可以细化到仪表板级别。

* **数据构建**

  * **数据源**

    * 自建数据源Apache Doris支持通过CLB方式接入多实例。

    * 创建文件数据源时，如果本地文件上传失败，支持返回到数据预览步骤中重新调整文件的字段类型等信息。

    * E-MapReduce Serverless StarRocks数据源补充以下VPC可选的region范围：青岛、乌兰察布、日本、新加坡、印度尼西亚、法兰克福、硅谷、弗吉尼亚。

  * **数据集**

    * 新增数据集组合管理面板，支持对数据组合进行编辑、复制和删除操作。

    * 数据集组合中的辅助数据集支持同环比配置。

  * **Quick 引擎**：加速引擎支持配置加速依赖，数据更新后可自动触发加速，解决底表数据延迟产出导致加速失败问题。

* **数据分析**

  * **仪表板**

    * **可视化图表**

      * 地图图表支持开启全球底图，开启后可在底图中显示全球的城市信息。

      * 指标趋势图新增支持多种布局方式。

      * 交叉表、明细表支持配置总计/小计数据的文本样式。

    * **查询控件**：查询控件支持对数据集组合中的主辅数据集同时生效。

    * **高级计算**：同环比支持灵活选择对比周期。比如：支持计算N天前、N月前环比，支持与本月初、上月末对比等。

  * **电子表格**：电子表格条件格式优化，新增色阶样式。

  * **数据大屏**：新增支持水波图，通过模拟水面波动的效果来将数据完成度或者占比情况进行可视化展示。

* **开放平台**

  * **开放API**

    * 以下OpenAPI接口更新：

      * 查询数据（QueryData）接口返回参数新增originalColumn字段，用于返回数据集里对应的字段原名。

      * 新增QueryAccelerationManageService接口，用于根据数据集ID查询Quick引擎加速任务状态。

      * 获取数据门户菜单的授权详情（ListPortalMenuAuthorization）接口支持通过返回参数中的authPointsValue字段查看菜单授权类型。

## 变更内容
* **智能小Q**

  * **小Q报告**

    * 基于本地文件、仪表板等一键生成智能数据报告，上手门槛低；

    * 支持联网搜索，可与内部数据、知识等深度融合，打造"数据+情报"的专业分析报告；

      请参见[小Q报告创建](https://help.aliyun.com/document_detail/2948531.html)。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0966873571/p991091.png)
    * Al一键生成报告后也可编辑文档按需进行内容、格式的干预调整，要智能也要可控；

      请参见[文档编辑](https://help.aliyun.com/document_detail/2950244.html)。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1459873571/p991497.png)
    * 产品内已有仪表板组件、问数、解读等数据结果可直接落入报告，减少重复建设成本；

      请参见[已有内容添加至小Q报告](https://help.aliyun.com/document_detail/2948620.html)。
    * 支持周期数据更新，满足各类周期性汇报、报告产出诉求。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6876873571/p989476.png)

      请参见[更新数据](https://help.aliyun.com/document_detail/2948530.html#f922e349a2jxl)。

    **说明**

    小Q报告功能属于增值模块，当前处于beta版本邀测阶段。如需试用，请您联系商务运营同学。
  * **小Q问数**

    * 新增支持上传本地 Excel文件进行问数。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2655723571/p987769.png)

      请参见[数据文件](https://help.aliyun.com/document_detail/2715112.html#fc751ea355nh3)。
    * 基于分析主题支持多数据集问数能力。

      请参见[选择多个数据集](https://help.aliyun.com/document_detail/2715112.html#e3286bcbd0caa)。
    * 自定义数据解读支持多步结果分别定义 Prompt 进行解读。

    * 新增支持收藏问题。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2655723571/p985187.png)

      请参见[发起问数](https://help.aliyun.com/document_detail/2715112.html)。
    * AI取数过程优化，支持查看业务逻辑SQL和执行SQL。

      请参见[发起问数](https://help.aliyun.com/document_detail/2715112.html)。
  * **仪表板数据解读**

    * 数据解读开关可以细化到仪表板级别。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5265723571/p984209.png)

      请参见[数据解读配置](https://help.aliyun.com/document_detail/2922409.html)。
  * **智能体**

    * 新增支持对接百炼专属版智能体。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9442233571/p989280.png)

      请参见[智能体管理](https://help.aliyun.com/document_detail/2876539.html)。
* **数据构建**

  * **数据源**

    * 自建数据源Apache Doris支持通过CLB方式接入多实例。

      请参见[自建数据源Apache Doris](https://help.aliyun.com/document_detail/468023.html)。
    * 创建文件数据源时，如果本地文件上传失败，支持返回到数据预览步骤中重新调整文件的字段类型等信息。

      请参见[创建文件数据源](https://help.aliyun.com/document_detail/168026.html)。
    * E-MapReduce Serverless StarRocks数据源补充以下VPC可选的region范围：青岛、乌兰察布、日本、新加坡、印度尼西亚、法兰克福、硅谷、弗吉尼亚。

  * **数据集**

    * 新增数据集组合管理面板，支持对数据组合进行编辑、复制和删除操作。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9176462571/p978458.png)

      请参见[数据集组合](https://help.aliyun.com/document_detail/2569190.html)。
    * 数据集组合中的辅助数据集支持同环比配置。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9542562571/p986128.png)

      请参见[数据集组合](https://help.aliyun.com/document_detail/2569190.html)、[同环比](https://help.aliyun.com/document_detail/177518.html)。
  * **Quick 引擎**：加速引擎支持配置加速依赖，数据更新后可自动触发加速，解决底表数据延迟产出导致加速失败问题。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9542562571/p984564.png)

    请参见[配置Quick引擎](https://help.aliyun.com/document_detail/409908.html)。
* **数据分析**

  * **仪表板**

    * **可视化图表**

      * 地图图表支持开启全球底图，开启后可在底图中显示全球的城市信息。

        请参见[色彩地图](https://help.aliyun.com/document_detail/55653.html)、[气泡地图](https://help.aliyun.com/document_detail/55644.html)、[热力地图](https://help.aliyun.com/document_detail/71925.html)、[符号地图](https://help.aliyun.com/document_detail/202744.html)、[飞线地图](https://help.aliyun.com/document_detail/85229.html)。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2570562571/p978484.gif)
      * 指标趋势图新增支持多种布局方式。

        请参见[指标趋势图](https://help.aliyun.com/document_detail/126497.html)。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9542562571/p986121.png)
      * 交叉表、明细表支持配置总计/小计数据的文本样式。

        请参见[交叉表](https://help.aliyun.com/document_detail/200338.html)、[明细表](https://help.aliyun.com/document_detail/473447.html)。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2011562571/p981202.gif)
    * **查询控件**：查询控件支持对数据集组合中的主辅数据集同时生效。

      请参见[新建查询控件](https://help.aliyun.com/document_detail/151455.html)。
    * **高级计算**：同环比支持灵活选择对比周期。比如：支持计算N天前、N月前环比，支持与本月初、上月末对比等。

      请参见[同环比](https://help.aliyun.com/document_detail/177518.html)。
  * **电子表格**：电子表格条件格式优化，新增色阶样式。

    请参见[电子表格配置操作](https://help.aliyun.com/document_detail/101221.html)。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4141562571/p981256.png)
  * **数据大屏**：新增支持水波图，通过模拟水面波动的效果来将数据完成度或者占比情况进行可视化展示。

    请参见[水波图](https://help.aliyun.com/document_detail/2936932.html)。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7531562571/p981031.png)
* **开放平台**

  * **开放API**

    * 以下OpenAPI接口更新：

      * 查询数据（QueryData）接口返回参数新增originalColumn字段，用于返回数据集里对应的字段原名。

      * 新增QueryAccelerationManageService接口，用于根据数据集ID查询Quick引擎加速任务状态。

      * 获取数据门户菜单的授权详情（ListPortalMenuAuthorization）接口支持通过返回参数中的authPointsValue字段查看菜单授权类型。

<br />