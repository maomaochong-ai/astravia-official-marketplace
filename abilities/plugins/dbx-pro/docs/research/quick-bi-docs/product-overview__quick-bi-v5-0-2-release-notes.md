<br />

## **发布日期**
2024年1月30日

## 重点升级概览
* 数据源\&数据集能力拓展

  * Dataphin数据源支持JDBC连接方式。

  * 新增自定义空值展示样式能力，您可以根据业务特性设置合适的空值展示样式，可设置的样式包括："-"、"{空}"、"null"以及自定义，设置之后将会在数据集、上层报表展示以及数据导出统一生效。

  * HINT语句支持的数据源增加，新增MySQL（5.7、8.0）、AnalyticDB fo r MySQL 2.0、AnalyticDB for MySQL 3.0、 PolarDB for MySQL数据源开放HINT语句入口。

* 复杂表格填报\&数据填报能力增强

  * 电子表格支持移动端查看。

  * 复杂表格填报支持移动端录入数据。

  * 表格填报\&数据填报同时新增支持StarRocks数据源。

  * 交叉表的填报事件支持移动端录入数据。

  * 数据填报-上传文件支持批量入库审批。

* 加速引擎能力提升

  * 新个人版支持一键清理其他工作空间下的探索空间资源。

  * StarRocks支持抽取加速和跨源关联。

* 主题与体验升级优化

  * 我的看板和工作空间内的资源预览支持多个Tab切换。

  * 筛选、排序优化，筛选区域隐藏状态下支持查看、删除或清空筛选条件。

  * 工作台资源列表收起时，支持鼠标悬停展开。

  * 数据门户新增"点击目录节点选中子菜单"配置项，勾选后，点击目录节点会自动展示下一级子菜单。

* 仪表板\&自助取数能力升级

  * 新增特色表格---多维分析表，用于多维度拆解下的多周期趋势分析。

  * 仪表板支持复制私密预览链接，用于将已保存未发布的内容请他人先行验证的场景。

  * 自助取数导出格式拓展，支持带格式CSV。

* 监控告警能力优化

  * 增加连续失败停止调度功能。

  * 工作通知指标来源展示优化。

  * 指标详情页面优化，监控数据最多保留1000条。

  * 卡片看板支持创建监控。

* 开放平台-新增角色管理API。

* 智能小Q：搭建能力升级（邀测中）

  * 创建图表效果优化：模型升级，更好的理解自然语言；无需进入"创建图表"状态即可对话式创建，对话更流畅。

  * 指令集丰富，可通过对话完成复杂的报表搭建操作，提升搭建效率。

  * 新增支持多轮对话，可在上下文语境中更连贯的搭建。

  * 交互体验优化，增加推荐问题、配置项搜索、帮助文档搜索等引导，使用体验更丝滑。

## 变更内容
* 数据源\&数据集能力拓展

  * Dataphin数据源支持JDBC连接方式。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7724066071/p762681.png)

    请参见[创建应用数据源Dataphin](https://help.aliyun.com/document_detail/166152.html)。
  * 新增自定义空值展示样式能力，您可以根据业务特性设置合适的空值展示样式，可设置的样式包括："-"、"{空}"、"null"以及自定义，设置之后将会在数据集、上层报表展示以及数据导出统一生效。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7724066071/p762682.png)

    请参见[创建并管理数据集](https://help.aliyun.com/document_detail/61151.html)。
  * HINT语句支持的数据源增加，新增MySQL（5.7、8.0）、AnalyticDB fo r MySQL 2.0、AnalyticDB for MySQL 3.0、 PolarDB for MySQL数据源开放HINT语句入口。

    请参见[创建并管理数据集](https://help.aliyun.com/document_detail/61151.html)。
* 复杂表格填报\&数据填报能力增强

  * 电子表格支持移动端查看。

    请参见[移动端电子表格](https://help.aliyun.com/document_detail/2671406.html)。
  * 复杂表格填报支持移动端录入数据。

    请参见[移动端表格填报](https://help.aliyun.com/document_detail/2679661.html)。
  * 表格填报\&数据填报同时新增支持StarRocks数据源。

    请参见[数据填报概述](https://help.aliyun.com/document_detail/104514.html)、[复杂表格填报概述](https://help.aliyun.com/document_detail/2503231.html)。
  * 交叉表的填报事件支持移动端录入数据。

    ![Untitled](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6724066071/p760201.gif)
  * 数据填报-上传文件支持批量入库审批。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7724066071/p758596.png)
* 加速引擎能力提升

  * 新个人版支持一键清理其他工作空间下的探索空间资源。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6724066071/p762683.png)

    请参见[创建文件数据源](https://help.aliyun.com/document_detail/168026.html)。
  * StarRocks支持抽取加速和跨源关联。

    请参见[配置Quick引擎](https://help.aliyun.com/document_detail/409908.html)、[构建模型](https://help.aliyun.com/document_detail/104002.html)。
* 主题与体验升级优化

  * 我的看板和工作空间内的资源预览支持多个Tab切换。

    ![1.gif](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6724066071/p762687.gif)

    请参见[查看仪表板](https://help.aliyun.com/document_detail/65854.html#section-ugq-1ft-uhc)、[资源预览](https://help.aliyun.com/document_detail/330131.html#50fdc789e1c1r)。
  * 筛选、排序优化，筛选区域隐藏状态下支持查看、删除或清空筛选条件。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6724066071/p762689.png)

    请参见[查询仪表板](https://help.aliyun.com/document_detail/65854.html#75d168bbd20f3)。
  * 工作台资源列表收起时，支持鼠标悬停展开。

    ![13.gif](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7724066071/p762691.gif)

    [Quick BI产品架构界面说明](https://help.aliyun.com/document_detail/330131.html#dfea6f3c69ur0)。
  * 数据门户新增"点击目录节点选中子菜单"配置项，勾选后，点击目录节点会自动展示下一级子菜单。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5724066071/p762693.png)

    请参见[新建数据门户](https://help.aliyun.com/document_detail/102067.html)。
* 仪表板\&自助取数能力升级

  * 新增特色表格---多维分析表，用于多维度拆解下的多周期趋势分析。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6724066071/p763533.png)

    请参见[多维分析表](https://help.aliyun.com/document_detail/2673762.html)。
  * 仪表板支持复制私密预览链接，用于将已保存未发布的内容请他人先行验证的场景。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7724066071/p763630.png)
  * 自助取数导出格式拓展，支持带格式CSV。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6724066071/p762703.png)

    请参见[创建与管理下载任务](https://help.aliyun.com/document_detail/113019.html)。
* 监控告警能力优化

  * 增加连续失败停止调度功能。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7724066071/p762706.png)

    请参见[配置监控告警](https://help.aliyun.com/document_detail/114219.html)。
  * 工作通知指标来源展示优化。

  * 指标详情页面优化，监控数据最多保留1000条。

    请参见[查看告警信息](https://help.aliyun.com/document_detail/114216.html)。
  * 卡片看板支持创建监控。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7724066071/p762708.png)

    请参见[卡片看板](https://help.aliyun.com/document_detail/2594877.html)。
* 开放平台-新增角色管理API。

* 智能小Q：搭建能力升级（邀测中）

  * 创建图表效果优化：模型升级，更好的理解自然语言；无需进入"创建图表"状态即可对话式创建，对话更流畅。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6724066071/p762716.png)
  * 指令集丰富，可通过对话完成复杂的报表搭建操作，提升搭建效率。

  * 新增支持多轮对话，可在上下文语境中更连贯的搭建。

  * 交互体验优化，增加推荐问题、配置项搜索、帮助文档搜索等引导，使用体验更丝滑。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6724066071/p762714.png)