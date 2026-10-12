<br />

## 发布日期
2024年12月17日

## 重点升级概览
* **智能小Q**

  * 智能问数新增支持语音问数功能。

  * 新增仪表板问数功能，支持在仪表板预览界面进行智能问数。

* **数据构建**

  * **数据源**

    * 新增支持Greenplum数据库。

    * SelectDB、MongoDB新增支持趋势分析表均值/累计、自定义周。

    * ClickHouse新增支持23.8数据库版本。

    * 由于MaxCompute阿里云经典网络连接方式已于北京时间2024年11月30日下线，后续通过Quick BI新增接入MaxCompute数据库时，推荐您采用"云产品互联Endpoint"连接。

    * API数据源支持添加前置请求，用于完成调用目标API之前需要执行的请求操作，例如：身份验证、数据预处理等任务，以确保目标API的顺利执行。

    * 文件数据源追加/匹配时支持字段匹配。

  * **数据填报：**

    * 批量导入数据时支持开启规则校验。

  * **数据集**

    * 跨源关联的数据集支持切换数据源。

    * 支持批量删除数据集。

* **数据分析**

  * **仪表板**

    * **可视化图表**

      * 新增旭日图，适合于展示复杂的层次数据，例如公司的组织结构、各部门的预算分配等。

      * 水波图、进度条、子弹图新增支持条件格式，可为不同数值阶段设置不同的展示颜色。

      * 指标趋势图新增辅助趋势图功能，支持为主指标配置趋势图来辅助分析。

      * 指标趋势图副指标能力升级，升级内容包括支持同时配置同环比和计算字段、支持为副指标设置条件格式等。

      * 多维分析表、趋势分析表功能优化：支持通过查询控件联动控制表格截止日期，支持隐藏空白列提升看数体验。

    * **高级计算**：对同环比配置进行了规范，部分边界场景可能会因配置不规范导致计算失效；若遇到相关提示，建议您根据业务场景重新调整同环比配置，保证计算的有效性。

    * **页面设置**：新增全局语义色能力，可全局控制仪表板中涨跌、正负、状态等含义的配色，作用范围包括图标、数据条、文字颜色等。

    * **全局参数**：当全局参数设置为必填时，允许传入空数组。

    * **交互式分析** ：支持高亮联动，即用户在某一图表上选择特定的数据后，其他相关联图表中的对应数据会被高亮显示。

  * **电子表格**：支持隐藏电子表格预览页面的行号和列标。

  * **数据大屏**：支持携带过滤条件跳转。

* **模板市场**

  * 支持在仪表板编辑过程中直接复用模板的某个图表组件。

  * 配套上线「[Quick BI商业分析图表库](https://bi.aliyun.com/template/view?templateId=b98e768c-4822-43a1-ae16-440eddf7f76c&useMenu=fd67fa4ea13a11ed8ecb0242ac110002)」模板，可基于不同图表类型和分析类型直接复用相应组件。

* **企业级能力**

  * **权限管理**

    * 支持用户在仪表板、电子表格、自助取数、即席分析、卡片看板作品的预览页申请导出权限。

    * 条件授权支持配置规则之间的且或逻辑。

  * **配置管理**

    * 资源包支持上传文件，方便用户在数据源和探索空间上传文件之后，通过资源包导入到其他空间。

    * 用户标签新增`$ALL_VALUES$`标签，表示拥有所有标签值。在所有使用场景中会替换为"BI=BI"，意味着拥有该标签的所有权限。

    * 账号解绑链路优化，支持在账号绑定失败界面解绑账号。

    * 支持自定义PC端微应用打开方式为工作台或跳转浏览器。

    * 移动端和PC端支持邮箱绑定和解绑。

* **开放平台**

  以下OpenAPI接口更新：
  * QueryWorksBloodRelationship接口返回参数新增计算字段表达式（Expression）字段。

  * UpdateWorkspaceUserRole接口请求参数新增多个空间角色ID（RoleIds）字段，支持每次修改多个角色。

  * 新增GetDataSourceConnectionInfo接口，用于根据数据源ID获取数据源配置信息。

  * QueryReadableResourcesListByUserId接口请求参数新增工作空间（workspaceId）字段，和报表类型（workType）字段。

  * AuthorizeMenu接口请求参数新增权限点（AuthPointsValue）字段，支持选择授权菜单的权限点。

  * QueryWorksBloodRelationship接口返回参数新增组件类型中文名称（ComponentTypeCnName）字段，用于返回组件的中文名称。

* **旧版交叉表全量升级通知**

  为提升仪表板可视化能力和表现，Quick BI即将在5.3.1.版本上将所有存量的旧交叉表进行批量升级，部分仍在使用旧版交叉版的用户可能受到影响，请您关注升级后新旧表格差异点如下：
  * 总小计逻辑由基于表格展示数据计算升级为基于数据库数据计算，不再受最大取数条数限制；

  * 表格升级后会置为自适应列宽模式，如需个性化调整请在样式中配置自定义列宽；

  * 整体样式上可能存在细微差异。

## 变更内容
* **智能小Q**

  * 智能问数新增支持语音问数功能。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2276334371/p888231.png)

    请参见[与智能助手对话](https://help.aliyun.com/document_detail/2715112.html)。
  * 新增仪表板问数功能，支持在仪表板预览界面进行智能问数。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2276334371/p888234.png)

    请参见[仪表板问数](https://help.aliyun.com/document_detail/2861350.html)。
* **数据构建**

  * **数据源**

    * 新增支持Greenplum数据库。

      请参见[自建数据源Greenplum](https://help.aliyun.com/document_detail/2859742.html)。
    * SelectDB、MongoDB新增支持趋势分析表均值/累计、自定义周。

      请参见[数据源功能项列表](https://help.aliyun.com/document_detail/2642723.html)。
    * ClickHouse新增支持23.8数据库版本。

      请参见[创建ClickHouse数据源](https://help.aliyun.com/document_detail/467103.html)。
    * 由于MaxCompute阿里云经典网络连接方式已于北京时间2024年11月30日下线，后续通过Quick BI新增接入MaxCompute数据库时，推荐您采用"云产品互联Endpoint"连接。

      请参见[云数据源MaxCompute](https://help.aliyun.com/document_detail/467992.html)。
    * API数据源支持添加前置请求，用于完成调用目标API之前需要执行的请求操作，例如：身份验证、数据预处理等任务，以确保目标API的顺利执行。

      请参见[创建API数据源](https://help.aliyun.com/document_detail/409330.html)。
    * 文件数据源追加/匹配时支持字段匹配。

    * 请参见[创建文件数据源](https://help.aliyun.com/document_detail/168026.html)。

  * **数据填报：**

    * 批量导入数据时支持开启规则校验。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1912704371/p887186.png)

      请参见[数据填报页面设置](https://help.aliyun.com/document_detail/456854.html)、[管理数据](https://help.aliyun.com/document_detail/105324.html)。
  * **数据集**

    * 跨源关联的数据集支持切换数据源。

      请参见[创建并管理数据集](https://help.aliyun.com/document_detail/61151.html)。
    * 支持批量删除数据集。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2210334371/p878772.png)

      请参见[管理数据集](https://help.aliyun.com/document_detail/103979.html)。
* **数据分析**

  * **仪表板**

    * **可视化图表**

      * 新增旭日图，适合于展示复杂的层次数据，例如公司的组织结构、各部门的预算分配等。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6360334371/p884028.png)

        请参见[旭日图](https://help.aliyun.com/document_detail/2860480.html)。
      * 水波图、进度条、子弹图新增支持条件格式，可为不同数值阶段设置不同的展示颜色。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9060334371/p879381.png)

        请参见[进度条](https://help.aliyun.com/document_detail/68354.html)、[子弹图](https://help.aliyun.com/document_detail/2797492.html)。
      * 指标趋势图新增辅助趋势图功能，支持为主指标配置趋势图来辅助分析。

        请参见[指标趋势图](https://help.aliyun.com/document_detail/126497.html)。
      * 指标趋势图副指标能力升级，升级内容包括支持同时配置同环比和计算字段、支持为副指标设置条件格式等。

        请参见[指标趋势图](https://help.aliyun.com/document_detail/126497.html)、[指标关系图](https://help.aliyun.com/document_detail/468081.html)。
      * 多维分析表、趋势分析表功能优化：支持通过查询控件联动控制表格截止日期，支持隐藏空白列提升看数体验。

        请参见[多维分析表](https://help.aliyun.com/document_detail/2673762.html)、[趋势分析表](https://help.aliyun.com/document_detail/330807.html)。
    * **高级计算**：对同环比配置进行了规范，部分边界场景可能会因配置不规范导致计算失效；若遇到相关提示，建议您根据业务场景重新调整同环比配置，保证计算的有效性。

      请参见[同环比](https://help.aliyun.com/document_detail/177518.html)。
    * **页面设置**：新增全局语义色能力，可全局控制仪表板中涨跌、正负、状态等含义的配色，作用范围包括图标、数据条、文字颜色等。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2276334371/p888146.png)

      请参见[主题设计](https://help.aliyun.com/document_detail/144964.html)。
    * **全局参数**：当全局参数设置为必填时，允许传入空数组。

      请参见[配置全局参数](https://help.aliyun.com/document_detail/195461.html)。
    * **交互式分析** ：支持高亮联动，即用户在某一图表上选择特定的数据后，其他相关联图表中的对应数据会被高亮显示。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2276334371/p880944.gif)

      请参见[联动](https://help.aliyun.com/document_detail/468061.html)。
  * **电子表格**：支持隐藏电子表格预览页面的行号和列标。

    请参见[电子表格配置操作](https://help.aliyun.com/document_detail/101221.html)。
  * **数据大屏** ：支持携带过滤条件跳转。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3133054371/p890090.gif)

    请参见[联动、钻取和跳转](https://help.aliyun.com/document_detail/461307.html)。
* **模板市场**

  * 支持在仪表板编辑过程中直接复用模板的某个图表组件。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8845334371/p887017.png)

    请参见[配置图表工具栏区](https://help.aliyun.com/document_detail/609871.html)、[查看并应用模板](https://help.aliyun.com/document_detail/216047.html)。
  * 配套上线「[Quick BI商业分析图表库](https://bi.aliyun.com/template/view?templateId=b98e768c-4822-43a1-ae16-440eddf7f76c&useMenu=fd67fa4ea13a11ed8ecb0242ac110002)」模板，可基于不同图表类型和分析类型直接复用相应组件。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0753054371/p889696.png)

* **企业级能力**

  * **权限管理**

    * 支持用户在仪表板、电子表格、自助取数、即席分析、卡片看板作品的预览页申请导出权限。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2276334371/p888219.png)

      请参见[申请与审批权限](https://help.aliyun.com/document_detail/357817.html)。
    * 条件授权支持配置规则之间的且或逻辑。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2276334371/p888221.png)

      请参见[类型一：条件组合授权](https://help.aliyun.com/document_detail/286884.html)。
  * **配置管理**

    * 资源包支持上传文件，方便用户在数据源和探索空间上传文件之后，通过资源包导入到其他空间。

      请参见[资源包概述](https://help.aliyun.com/document_detail/145013.html)。
    * 用户标签新增`$ALL_VALUES$`标签，表示拥有所有标签值。在所有使用场景中会替换为"BI=BI"，意味着拥有该标签的所有权限。

      请参见[管理用户标签值](https://help.aliyun.com/document_detail/324564.html)。
    * 账号解绑链路优化，支持在账号绑定失败界面解绑账号。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2276334371/p888225.png)

      请参见[用户登录](https://help.aliyun.com/document_detail/2330937.html)。
    * 支持自定义PC端微应用打开方式为工作台或跳转浏览器。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2276334371/p888226.png)

      请参见[（公共云）开通钉钉微应用](https://help.aliyun.com/document_detail/607098.html)、[（公共云）开通企业微信微应用](https://help.aliyun.com/document_detail/607162.html)、[开通飞书微应用](https://help.aliyun.com/document_detail/2398309.html)。
    * 移动端和PC端支持邮箱绑定和解绑。

      请参见[账号绑定](https://help.aliyun.com/document_detail/2330937.html#e9847430f280a)。
* **开放平台**

  以下OpenAPI接口更新：
  * QueryWorksBloodRelationship接口返回参数新增计算字段表达式（Expression）字段。

  * UpdateWorkspaceUserRole接口请求参数新增多个空间角色ID（RoleIds）字段，支持每次修改多个角色。

  * 新增GetDataSourceConnectionInfo接口，用于根据数据源ID获取数据源配置信息。

  * QueryReadableResourcesListByUserId接口请求参数新增工作空间（workspaceId）字段，和报表类型（workType）字段。

  * AuthorizeMenu接口请求参数新增权限点（AuthPointsValue）字段，支持选择授权菜单的权限点。

  * QueryWorksBloodRelationship接口返回参数新增组件类型中文名称（ComponentTypeCnName）字段，用于返回组件的中文名称。

* **旧版交叉表全量升级通知**

  为提升仪表板可视化能力和表现，Quick BI即将在5.3.1.版本上将所有存量的旧交叉表进行批量升级，部分仍在使用旧版交叉版的用户可能受到影响，请您关注升级后新旧表格差异点如下：
  * 总小计逻辑由基于表格展示数据计算升级为基于数据库数据计算，不再受最大取数条数限制；

  * 表格升级后会置为自适应列宽模式，如需个性化调整请在样式中配置自定义列宽；

  * 整体样式上可能存在细微差异。