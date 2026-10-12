<br />

## **发布日期**
2024年9月10日

## 重点升级概览
* **数据构建**

  * 上传文件报错信息优化，支持定位到具体出错字段。

  * 新增应用数据源"飞书电子表格"，新增支持TiDB、MariaDB、Lindorm多模SQL数据源的接入。

  * Dataphin数据源支持使用自定义驱动。

  * 系统内置函数支持的数据源扩充：PolarDB、PolarDB for PG、PolarDB for Oracle、PolarDB分布式版、AnalyticDB for PostgreSQL、Presto、Starrocks、Doris。

  * StarRocks数据源支持使用数据准备功能。

* **仪表板**

  * **图表**：

    * 新增直方图，用于展示连续型数据值的频数分布情况，能有效地揭示数据的集中趋势、分散程度、偏态和峰度等特征。

    * 指标关系图支持配置同期对比。

  * **控件**：

    * 当查询控件展示类型为下拉列表，且选项值来源于单个数据集时，支持自定义设置选项值的排列顺序。

    * 查询控件级联支持占位符类型字段。

  * **多端展示**：

    * 移动端支持一键清除联动设置。

    * 移动端交叉表、明细表支持单独设置表格列宽。

* **数据门户**

  * 移动端数据门户全新升级，重构了多级菜单在平铺布局交互展示样式，提供更丰富、更细粒度的导航框架等自定义配置项。

* **配置管理**

  * **用户管理**：在用户管理页面批量导出用户信息时，支持导出用户状态信息。

  * **协同授权** ：用户组搜索结果页面优化，新增**所在架构**列。

  * **健康巡检**：新增组织用户组用量、组织用户标签数等多项用量规格巡检项。

* **智能问数**

  * Quick BI 智能问数模块预计将于9月25日开启售卖。

  * 企业知识库中，支持配置知识的生效范围，可对部分问数资源生效。

  * 企业知识库中，支持对单条知识开启强制改写。

* **开放平台**

  * **登录认证**：支持通过对接OIDC协议，实现单点登录以及打通企业内部员工基础信息的需求。

    **说明**

    仅**独立部署**版本支持对接OIDC协议。

## 变更内容
* **数据构建**

  * 上传文件报错信息优化，支持定位到具体出错字段。

    请参见[创建文件数据源](https://help.aliyun.com/document_detail/168026.html)。
  * 新增应用数据源"飞书电子表格"，新增支持TiDB、MariaDB、Lindorm多模SQL数据源的接入。

    请参见[创建飞书电子表格数据源](https://help.aliyun.com/document_detail/2845666.html)、[自建数据源TiDB](https://help.aliyun.com/document_detail/2842385.html)、[阿里云数据源MariaDB](https://help.aliyun.com/document_detail/2844729.html)、[自建数据源MariaDB](https://help.aliyun.com/document_detail/2844730.html)、[云数据源Alibaba Lindorm](https://help.aliyun.com/document_detail/2845292.html)。
  * Dataphin数据源支持使用自定义驱动。

  * 系统内置函数支持的数据源扩充：PolarDB、PolarDB for PG、PolarDB for Oracle、PolarDB分布式版、AnalyticDB for PostgreSQL、Presto、Starrocks、Doris。

    请参见[系统内置函数](https://help.aliyun.com/document_detail/2831119.html)。
  * StarRocks数据源支持使用数据准备功能。

    请参见[数据源功能项列表](https://help.aliyun.com/document_detail/2642723.html)。
* **仪表板**

  * **图表**：

    * 新增直方图，用于展示连续型数据值的频数分布情况，能有效地揭示数据的集中趋势、分散程度、偏态和峰度等特征。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7299585271/p840937.png)

      请参见[直方图](https://help.aliyun.com/document_detail/2845406.html)。
    * 指标关系图支持配置同期对比。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7299585271/p845676.png)

      请参见[指标关系图](https://help.aliyun.com/document_detail/468081.html)。
  * **控件**：

    * 当查询控件展示类型为下拉列表，且选项值来源于单个数据集时，支持自定义设置选项值的排列顺序。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7299585271/p845681.png)

      请参见[新建查询控件](https://help.aliyun.com/document_detail/151455.html)、[文本查询](https://help.aliyun.com/document_detail/151453.html)。
    * 查询控件级联支持占位符类型字段。

      请参见[配置查询控件级联](https://help.aliyun.com/document_detail/160352.html)。
  * **多端展示**：

    * 移动端支持一键清除联动设置。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7299585271/p845566.png)

      请参见[联动](https://help.aliyun.com/document_detail/468061.html)。
    * 移动端交叉表、明细表支持单独设置表格列宽。

      请参见[交叉表](https://help.aliyun.com/document_detail/200338.html)、[明细表](https://help.aliyun.com/document_detail/473447.html)。
* **数据门户**

  * 移动端数据门户全新升级，重构了多级菜单在平铺布局交互展示样式，提供更丰富、更细粒度的导航框架等自定义配置项。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7299585271/p845684.png)

    请参见[创建移动端数据门户](https://help.aliyun.com/document_detail/2846231.html)。
* **配置管理**

  * **用户管理**：在用户管理页面批量导出用户信息时，支持导出用户状态信息。

    请参见[管理组织用户](https://help.aliyun.com/document_detail/103210.html)。
  * **协同授权** ：用户组搜索结果页面优化，新增**所在架构**列。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7299585271/p845480.png)
  * **健康巡检**：新增组织用户组用量、组织用户标签数等多项用量规格巡检项。

    请参见[健康巡检](https://help.aliyun.com/document_detail/2742996.html)。
* **智能问数**

  * Quick BI 智能问数模块免费开放公测体验（截至2024年9月24日）。

  * 企业知识库中，支持配置知识的生效范围，可对部分问数资源生效。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7299585271/p845553.png)

    请参见[企业知识库管理](https://help.aliyun.com/document_detail/2715114.html)。
  * 企业知识库中，支持对单条知识开启强制改写。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7299585271/p845483.png)

    请参见[企业知识库管理](https://help.aliyun.com/document_detail/2715114.html)。