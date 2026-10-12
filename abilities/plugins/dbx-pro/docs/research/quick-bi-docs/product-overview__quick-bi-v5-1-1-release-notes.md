<br />

## **发布日期**
2024年5月14日

## 重点升级概览
* **数据源能力优化**

  * Spark SQL 数据源支持 CLB 负载均衡。

  * Spark SQL 数据库支持对接 Quick 引擎实现加速抽取功能。

* **数据填报能力完善**

  * 在数据管理页面完成添加数据、编辑数据操作后，支持查看操作日志。

* **自动保存\&历史版本能力调整**

  * 仪表板开启自动保存功能后，每 5 分钟即会自动保存。对于历史版本，系统最多可保留三个月内最近的 5 个发布版本和 15 个保存版本。线上超出数量限制的历史版本将会被陆续删除。

  * 电子表格最多可保留三个月内最近的 5 个发布版本和 15 个保存版本。线上超出数量限制的历史版本将会被陆续删除。

* **仪表板相关能力优化**

  * 交叉表、明细表支持识别字段中的换行符，帮助用户实现自定义换行效果。

  * 面积图支持切换图表线条为直线形式。

  * 富文本控件添加子查询后，支持设置结果展示条数。

  * 报表导出弹窗界面优化。

* **用户管理能力拓展**

  * 删除标签表交互优化。删除标签表后会影响相关标签的使用，在删除时会做出详细提示。

  * 组织角色新增智能运维角色，关联该角色的用户即拥有智能运维模块（包括统计分析、性能分析、血缘分析）的权限。

* **智能小Q能力升级**

  * 智能问数支持嵌入到其他系统中，以便和其他应用系统集成，更便捷实现业务一体化应用。

* **开放平台**

  * 新增自定义组件数、自定菜单数的规格限制。

  * 通过数据服务功能创建的 API 接口，支持在数据服务页面展示其所属工作空间、所属数据集。

  * 新增智能小Q嵌入支持接口（CreateTicket4Copilot ），用于生成智能小Q嵌入 Ticket。

  * 以下 OpenAPI 接口新增参数：

    * 首页看板收藏列表（ListFavoriteReports）：返回参数新增 FavoriteDate，表示收藏当前看板的时间。

    * 查询数据集详情（QueryDatasetInfo）：返回参数新增 OpenOfflineAcceleration，表示当前数据集是否开启抽取加速。

    * 查询工作空间数据集列表（QueryDatasetList）：返回参数新增 OpenOfflineAcceleration，表示当前数据集是否开启抽取加速。

## 变更内容
* **数据源能力优化**

  * Spark SQL 数据源支持 CLB 负载均衡。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2726855171/p799112.png)

    请参见[自建数据源Spark SQL](https://help.aliyun.com/document_detail/468021.html)。
  * Spark SQL 数据库支持对接 Quick 引擎实现加速抽取功能。

    请参见[配置Quick引擎](https://help.aliyun.com/document_detail/409908.html)。
* **数据填报能力完善**

  * 在数据管理页面完成添加数据、编辑数据操作后，支持查看操作日志。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2726855171/p799145.png)

    请参见[管理数据](https://help.aliyun.com/document_detail/105324.html#f06f6086d4s9t)。
* **自动保存\&历史版本能力调整**

  * 仪表板开启自动保存功能后，每 5 分钟即会自动保存。对于历史版本，系统最多可保留三个月内最近的 5 个发布版本和 15 个保存版本。线上超出数量限制的历史版本将会被陆续删除。

    请参见[恢复历史版本](https://help.aliyun.com/document_detail/609871.html#bef9fe4853v85)。
  * 电子表格最多可保留三个月内最近的 5 个发布版本和 15 个保存版本。线上超出数量限制的历史版本将会被陆续删除。

    请参见[恢复历史版本](https://help.aliyun.com/document_detail/151456.html#b53e4f9070j99)。
* **仪表板相关能力优化**

  * 交叉表支持识别字段中的换行符，帮助用户实现自定义换行效果。

    请参见[交叉表](https://help.aliyun.com/document_detail/200338.html)。
  * 面积图支持切换图表线条为直线形式。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8595855171/p798376.png)

    请参见[面积图](https://help.aliyun.com/document_detail/68315.html)。
  * 富文本控件添加子查询后，支持设置结果展示条数。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2726855171/p799116.png)

    请参见[富文本](https://help.aliyun.com/document_detail/111273.html)。
  * 报表导出弹窗界面优化。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6965855171/p797027.png)

    请参见[新建仪表板](https://help.aliyun.com/document_detail/65851.html)。
* **用户管理能力拓展**

  * 删除标签表交互优化。删除标签表后会影响相关标签的使用，在删除时会做出详细提示。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2726855171/p799133.png)

    请参见[管理用户标签值](https://help.aliyun.com/document_detail/324564.html)。
  * 组织角色新增智能运维角色，关联该角色的用户即拥有智能运维模块（包括统计分析、性能分析、血缘分析）的权限。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2726855171/p799134.png)

    请参见[角色管理](https://help.aliyun.com/document_detail/2399798.html)。
* **智能小Q能力升级**

  * 智能问数支持嵌入到其他系统中，以便和其他应用系统集成，更便捷实现业务一体化应用。

* **开放平台**

  * 新增自定义组件数、自定菜单数的规格限制。

    请参见 [规格明细](https://help.aliyun.com/document_detail/2624018.html)。
  * 通过数据服务功能创建的 API 接口，支持在数据服务页面展示其所属工作空间、所属数据集。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2726855171/p799150.png)

    请参见 [创建API接口](https://help.aliyun.com/document_detail/144980.html)。
  * 新增智能小Q嵌入支持接口（CreateTicket4Copilot），用于生成智能小Q嵌入 Ticket。

  * 以下 OpenAPI 接口新增参数：

    * 首页看板收藏列表（ListFavoriteReports）：返回参数新增 FavoriteDate，表示收藏当前看板的时间。

      请参见[ListFavoriteReports - 首页看板收藏列表](https://help.aliyun.com/document_detail/415152.html)。
    * 查询数据集详情（QueryDatasetInfo）：返回参数新增 OpenOfflineAcceleration，表示当前数据集是否开启抽取加速。

      请参见[QueryDatasetInfo - 查询数据集详情V2](https://help.aliyun.com/document_detail/415144.html)。
    * 查询工作空间数据集列表（QueryDatasetList）：返回参数新增 OpenOfflineAcceleration，表示当前数据集是否开启抽取加速。

      请参见[QueryDatasetList - 查询工作空间数据集列表](https://help.aliyun.com/document_detail/415146.html)。