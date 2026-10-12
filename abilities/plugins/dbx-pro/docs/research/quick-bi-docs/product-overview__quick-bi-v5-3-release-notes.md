<br />

**重要**

**友情提示**：出于系统安全考虑，若您的组织内存在账号ID为空的用户，请在2024年12月31日前通知这些用户通过浏览器登录Quick BI（登录即完成ID录入）或手动帮其补录，以免影响用户登录！

## 发布日期
2024年10月24日

## 重点升级概览
* **数据构建**

  * 新增支持钉钉表格数据源。

  * 新增支持神通数据源，AnalyticDB for MySQL数据源支持Spark引擎。

  * 自定义周支持数据源扩充-Alibaba AnalyticDB for PostgreSQL、StarRocks、Alibaba AnalyticDB for MySQL 3.0、Alibaba Hologres、Impala。

* **仪表板**

  * 指标拆解树支持配置条件格式。

  * 仪表板图例进行整体样式优化。

  * 以下表格的移动端视图，支持配置表格高度动态自适应的最大值：交叉表、明细表、多维分析表、趋势分析表。

* **企业级能力**

  * 订阅：支持批量暂停订阅任务。

  * 办公协同：系统语言支持跟随浏览器设置。

    **重要**

    注意事项：如果当前账号由多人共享使用，设置为跟随浏览器语言可能会导致语言显示不一致。建议在多人共享账号时，统一设置一个固定的系统语言，以避免混淆。
  * 统计分析相关页面改版优化：

    * 独立设置审计日志页面，支持查看登录类、访问类、操作类和权限类的审计日志。

    * 统计分析界面改版，整体分为用量分析和访问分析两个模块：用量分析用于分析组织内资源的用量情况；访问分析用于分析用户访问数据。

* **智能问数**

  * 新增问数运营功能：

    * 用户可以点赞或点踩问题。

    * 运营人员能查看、筛选用户问题记录，按问题编号跟踪和分析。

    * 支持记录导出为文件。

  * 优化问答准确性：

    * 改进多指标周期表和KV表，提升问答准确率。

    * 在问数配置中，支持明细表、多维周期表、KV表。

  * 增强维值匹配：默认推理维度能力提升；支持指定维值进行强制匹配。

  * 单位自动识别和转换：适用于质量、长度、面积、体积、时间、速度、功率等。

  * 波动归因改进：支持手动配置波动归因参数。

  * 输入框联想推荐优化：提供推荐字段和推荐问题的智能联想。

* **开放平台**

  * 全新推出「智慧门店」和「自定义登录插件」两个开放场景解决方案。其中，数字门店配套相关行业模板可参见[门店客流分析应用](https://bi.aliyun.com/template/nl/preview?templateId=7b7f33b2-3cf0-41c3-9509-04d7a15401dc&useMenu=fd67fa4ea13a11ed8ecb0242ac110002)。

  * 开放控制台功能升级，支持与各功能子菜单联动，并可直达开放场景解决方案和模板共创内容。

  * 开放官网新增方案介绍、能力与版本对比等内容。

## 变更内容
* **数据构建**

  * 新增支持钉钉表格数据源。

    请参见[创建钉钉表格数据源](https://help.aliyun.com/document_detail/2850547.html)。
  * 新增支持神通数据源，AnalyticDB for MySQL数据源支持Spark引擎。

    请参见[自建数据源神通](https://help.aliyun.com/document_detail/2850540.html)、[云数据源AnalyticDB for MySQL 3.0](https://help.aliyun.com/document_detail/468034.html)。
  * 自定义周支持数据源扩充-Alibaba AnalyticDB for PostgreSQL、StarRocks、Alibaba AnalyticDB for MySQL 3.0、Alibaba Hologres、Impala。

    请参见[数据源功能项列表](https://help.aliyun.com/document_detail/2642723.html)。
* **仪表板**

  * 指标拆解树支持配置条件格式。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4232669271/p861408.png)

    请参见[指标拆解树](https://help.aliyun.com/document_detail/163227.html)。
  * 仪表板图例进行整体样式优化。

  * 以下表格的移动端视图，支持配置表格高度动态自适应的最大值：交叉表、明细表、多维分析表、趋势分析表。

    请参见[交叉表](https://help.aliyun.com/document_detail/200338.html)、[明细表](https://help.aliyun.com/document_detail/473447.html)、[多维分析表](https://help.aliyun.com/document_detail/2673762.html)、[趋势分析表](https://help.aliyun.com/document_detail/330807.html)。
* **企业级能力**

  * 订阅：支持批量暂停订阅任务。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4232669271/p861397.png)

    请参见[管理订阅任务](https://help.aliyun.com/document_detail/101326.html)。
  * 办公协同：系统语言支持跟随浏览器设置。

    **重要**

    注意事项：如果当前账号由多人共享使用，设置为跟随浏览器语言可能会导致语言显示不一致。建议在多人共享账号时，统一设置一个固定的系统语言，以避免混淆。
  * 统计分析相关页面改版优化：

    * 独立设置审计日志页面，支持查看登录类、访问类、操作类和权限类的审计日志。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4232669271/p851832.png)

      请参见[审计日志](https://help.aliyun.com/document_detail/2850499.html)。
    * 统计分析界面改版，整体分为用量分析和访问分析两个模块：用量分析用于分析组织内资源的用量情况；访问分析用于分析用户访问数据。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4232669271/p861421.png)

      请参见[用量分析](https://help.aliyun.com/document_detail/449527.html)、[访问分析](https://help.aliyun.com/document_detail/452192.html)。
* **智能问数**

  * 新增问数运营功能：

    * 用户可以点赞或点踩问题。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4232669271/p862261.png)

      请参见[与智能助手对话](https://help.aliyun.com/document_detail/2715112.html)。
    * 运营人员能查看、筛选用户问题记录，按问题编号跟踪和分析。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4232669271/p862266.png)

      请参见[问数运营](https://help.aliyun.com/document_detail/2852580.html)。
    * 支持记录导出为文件。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4232669271/p862272.png)

      请参见[问数运营](https://help.aliyun.com/document_detail/2852580.html)。
  * 优化问答准确性：

    * 改进多指标周期表和KV表，提升问答准确率。

    * 在问数配置中，支持明细表、多维周期表、KV表。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4232669271/p862262.png)

      请参见[准备数据](https://help.aliyun.com/document_detail/2836768.html)。
  * 增强维值匹配：默认推理维度能力提升；支持指定维值进行强制匹配。

  * 单位自动识别和转换：适用于质量、长度、面积、体积、时间、速度、功率等。

  * 波动归因改进：支持手动配置波动归因参数。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4232669271/p861381.png)

    请参见[波动归因](https://help.aliyun.com/document_detail/2715112.html#ee506ab8f6237)。
  * 输入框联想推荐优化：提供推荐字段和推荐问题的智能联想。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4232669271/p861382.png)

    请参见[提问和回答](https://help.aliyun.com/document_detail/2715112.html#f3b2bd1514z1y)。
* **开放平台**

  * 全新推出「智慧门店」和「自定义登录插件」两个开放场景解决方案。其中，数字门店配套相关行业模板可参见[门店客流分析应用](https://bi.aliyun.com/template/nl/preview?templateId=7b7f33b2-3cf0-41c3-9509-04d7a15401dc&useMenu=fd67fa4ea13a11ed8ecb0242ac110002)。

    请参见[开放平台场景解决方案](https://help.aliyun.com/document_detail/2747069.html)。
  * 开放控制台功能升级，支持与各功能子菜单联动，并可直达开放场景解决方案和模板共创内容。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4232669271/p861426.png)

    请参见[开放平台场景解决方案](https://help.aliyun.com/document_detail/2747069.html)、[模板共创计划](https://help.aliyun.com/document_detail/2802976.html)。
  * 开放官网新增方案介绍、能力与版本对比等内容。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4232669271/p861385.png)

    请参见[能力与版本介绍](https://das.base.shuju.aliyun.com/openplatform/public/home)。