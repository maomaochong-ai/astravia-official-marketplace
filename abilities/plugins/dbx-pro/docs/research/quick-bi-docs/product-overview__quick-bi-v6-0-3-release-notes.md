<br />

## **发布日期**
2025年12月23日

## 重点升级概览
* **智能小Q**

  * 小Q解读

    * 仪表板解读组件新增快捷模板配置，优化解读结果正文的样式展示，并支持组件图标的自定义替换。

    * 仪表板小Q解读结果样式美化，支持红升绿降语义色样式。

  * 小Q报告

    * 小Q报告编辑页的预览状态支持归档和查看归档记录。

    * 仪表板图表插入到小Q报告后，在动态引用模式下生成的洞察分析内容，支持跟随图表动态更新；若解除了动态引用，则该图表将作为静态数据进行洞察，后续洞察内容不会跟随图表更新。

    * 小Q报告在更新数据时，支持保留报告制作者在添加仪表板组件时手动选择的筛选值（时间类筛选条件除外）。

* **数据构建**

  * **数据源**

    * 新增阿里云数据源RDS MySQL DuckDB。

    * 阿里云数据源Lindorm支持VPC。

    * 内置函数新增支持数据源：IBM DB2 LUW、SAP IQ (Sybase IQ)、Gbase 8a、Vertica、神通、SLS、Elasticsearch、Lindorm。

* **数据分析**

  * **仪表板**

    * 移动端图例及工具提示（Tooltip）全面升级，本次更新范围覆盖支持图例、工具提示功能的全部图表类型：

      * 更丰富的图例模式：图例样式新增支持「常规图例」和「图例标签」两种模式，满足不同信息展示场景。同时开放了图例排列布局及文本样式自由配置的能力。

      * 更强大的工具提示（Tooltip）：移动端新增支持配置工具提示字段，通过更轻量的交互即可呈现全面的数据上下文，同时开放了工具提示样式自由配置的能力。

      * 更流畅的交互式分析，融合交互式分析动作条与工具提示，用户悬停查看数据详情的同时，即可直接执行关联的分析操作，提升分析流畅性。

    * 线面图及柱条图支持配置滚动轴。

    * 交叉表、明细表可分区设置行高，支持单独配置表头和数据区域的行高。

    * 在仪表板主题设置中配置的自定义标题背景，可生效至Tab组件内的图表。

    * 故事线组件新增样式个性化配置能力，支持对节点文本、选中块等的样式进行自定义设置。

    * 支持为富文本组件中除「图表所选字段」外的其他查询字段设置条件格式。

* **企业级能力**

  * **权限管理**

    * 报表发布时可配置审批流程，确保内容合规后生效。

    * 用户标签关联授权时，支持同一用户多行标签分别计算。

* **开放平台**

  * **以下OpenAPI接口更新**

    * 添加成员到指定工作空间（AddUserToWorkspace）：请求参数增加RoleId，支持添加成员时指定自定义角色。

    * 获取组织下的工作空间列表（QueryOrganizationWorkspaceList）：返回参数新增realOwnerAccountName字段，用于返回工作空间所有者的账户名称。

  * **监听事件（专业版）**：公共云上线监听事件，支持在内部业务事件中提供多渠道的对外信息推送能力。

  * **嵌入分析**

    * 授权指定用户调用API时，支持按照指定用户的账号权限去访问被嵌入作品。

    * 在组织管理中被禁用和删除的用户，不支持继续生成Ticket。

    * 嵌入JS SDK新增after-component-rendered-event事件，支持将嵌入报表打开成功与否的状态推送出去。

* **服务与支持**

  * 国际站与国内公共云平台已实现账号互通，并支持双向资源购买。

## 变更内容
* **智能小Q**

  * 小Q解读

    * 仪表板解读组件新增快捷模板配置，优化解读结果正文的样式展示，并支持组件图标的自定义替换。

      ![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0074736671/p1035156.gif)
    * 仪表板小Q解读结果样式美化，支持红升绿降语义色样式。

    请参见[仪表板解读组件](https://help.aliyun.com/document_detail/2997496.html)。
  * 小Q报告

    * 小Q报告编辑页的预览状态支持归档和查看归档记录。

      请参见![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7080936671/p1036792.png)[小Q报告管理](https://help.aliyun.com/document_detail/2948530.html)。
    * 仪表板图表插入到小Q报告后，在动态引用模式下生成的洞察分析内容，支持跟随图表动态更新；若解除了动态引用，则该图表将作为静态数据进行洞察，后续洞察内容不会跟随图表更新。

      请参见[洞察分析](https://help.aliyun.com/document_detail/2949377.html#8536d95242nho)。
    * 小Q报告在更新数据时，支持保留报告制作者在添加仪表板组件时手动选择的筛选值（时间类筛选条件除外）。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3584736671/p1034774.png)

      请参见[添加仪表板图表](https://help.aliyun.com/document_detail/2949378.html)、[已有内容添加至小Q报告](https://help.aliyun.com/document_detail/2948620.html)。
* **数据构建**

  * **数据源**

    * 新增阿里云数据源RDS MySQL DuckDB。

      请参见[阿里云数据源RDS MySQL DuckDB](https://help.aliyun.com/document_detail/2999770.html)。
    * 阿里云数据源Lindorm支持VPC。

      请参见[阿里云数据源Lindorm](https://help.aliyun.com/document_detail/2845292.html)。
    * 内置函数新增支持数据源：IBM DB2 LUW、SAP IQ (Sybase IQ)、Gbase 8a、Vertica、神通、SLS、Elasticsearch、Lindorm。

      请参见[聚合函数](https://help.aliyun.com/document_detail/2833139.html)、[文本函数](https://help.aliyun.com/document_detail/2833141.html)、[日期函数](https://help.aliyun.com/document_detail/2833144.html)、[转换函数](https://help.aliyun.com/document_detail/2833145.html)、[分析函数（LOD函数）](https://help.aliyun.com/document_detail/2402055.html)。
* **数据分析**

  * **仪表板**

    * 移动端图例及工具提示（Tooltip）全面升级，本次更新范围覆盖支持图例、工具提示功能的全部图表类型：

      * 更丰富的图例模式：图例样式新增支持「常规图例」和「图例标签」两种模式，满足不同信息展示场景。同时开放了图例排列布局及文本样式自由配置的能力。

      * 更强大的工具提示（Tooltip）：移动端新增支持配置工具提示字段，通过更轻量的交互即可呈现全面的数据上下文，同时开放了工具提示样式自由配置的能力。

      * 更流畅的交互式分析，融合交互式分析动作条与工具提示，用户悬停查看数据详情的同时，即可直接执行关联的分析操作，提升分析流畅性。

    * 线面图及柱条图支持配置滚动轴。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5880836671/p1032669.png)

    * 交叉表、明细表可分区设置行高，支持单独配置表头和数据区域的行高。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2621836671/p1033571.png)请参见[交叉表](https://help.aliyun.com/document_detail/200338.html)、[明细表](https://help.aliyun.com/document_detail/473447.html)。

    * 在仪表板主题设置中配置的自定义标题背景，可生效至Tab组件内的图表。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3812836671/p1032908.png)[主题设计](https://help.aliyun.com/document_detail/144964.html)。

    * 故事线组件新增样式个性化配置能力，支持对节点文本、选中块等的样式进行自定义设置。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7080936671/p1036795.png)请参见[故事线](https://help.aliyun.com/document_detail/184196.html)。

    * 支持为富文本组件中除「图表所选字段」外的其他查询字段设置条件格式。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3612836671/p1033286.gif)请参见[富文本控件](https://help.aliyun.com/document_detail/111273.html)。

* **企业级能力**

  * **权限管理**

    * 报表发布时可配置审批流程，确保内容合规后生效。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3805736671/p1032095.png)

      请参见[新建并管理工作空间](https://help.aliyun.com/document_detail/61550.html)。
    * 用户标签关联授权时，支持同一用户多行标签分别计算。

      请参见[类型二：标签授权](https://help.aliyun.com/document_detail/325414.html)。
* **开放平台**

  * **以下OpenAPI接口更新**

    * 添加成员到指定工作空间（AddUserToWorkspace）：请求参数增加RoleId，支持添加成员时指定自定义角色。

    * 获取组织下的工作空间列表（QueryOrganizationWorkspaceList）：返回参数新增realOwnerAccountName字段，用于返回工作空间所有者的账户名称。

  * **监听事件（专业版）**：公共云上线监听事件，支持在内部业务事件中提供多渠道的对外信息推送能力。

    请参见[监听事件](https://help.aliyun.com/document_detail/3000279.html)。
  * **嵌入分析**

    * 授权指定用户调用API时，支持按照指定用户的账号权限去访问被嵌入作品。

    * 在组织管理中被禁用和删除的用户，不支持继续生成Ticket。

      请参见[报表嵌入的基础方案](https://help.aliyun.com/document_detail/452609.html)、[报表嵌入数据权限控制和传参的安全增强方案](https://help.aliyun.com/document_detail/391291.html)。
    * 嵌入JS SDK新增after-component-rendered-event事件，支持将嵌入报表打开成功与否的状态推送出去。

      请参见[嵌入JS SDK API](https://help.aliyun.com/document_detail/2883315.html)。
* **服务与支持**

  * 国际站与国内公共云平台已实现账号互通，并支持双向资源购买。