<br />

## **发布日期**
2026年1月29日

## 重点升级概览
* **智能小Q**

  * **企业知识库**

    * **连接企业知识库**：支持以添加知识文档（本地文件、飞书文档）或直连三方知识库（阿里云百炼、通义点金、Dify）的形式连接企业知识内容。

    * **AI智能学习与提炼**：基于已连接的企业知识库，系统可智能学习并提炼出企业特有的业务逻辑、分析思路、内容模板等不同知识类型并保存。

    * **召回知识并生成专属分析结果**：在前台使用智能小Q能力（如小Q问数、小Q报告）时进行调用，生成企业专属分析结果。

  * **小Q问数**

    * 支持反问澄清，针对特定模糊问题，用户确认所需要素后提供更精准的回答。

    * 外嵌场景能力全面升级

      * 品牌个性化：支持上传专属LOGO，强化品牌识别与场景融合。

      * 主题自定义：可灵活配置模块外观风格，适配多样化视觉需求。

      * 欢迎语定制：支持设置欢迎语内容与样式，优化新用户引导体验。

      * 交互体验优化：对话框布局动态适配，操作更流畅自然。

      * URL智能传参：业务系统可通过URL参数自动填充问题，实现无缝跳转与预填。

    * 知识管理效率提升

      * 新增批量导出功能，一键导出业务逻辑、正则匹配规则及数据集选择规则，便于知识迁移与团队协作。

    * 查询性能与粒度增强

      * 维值加速：针对大数据量表优化模型学习效率，显著提升学习速度。

      * 细粒度时间支持：新增时、分、秒级时间维度，满足高精度数据分析需求。

  * **小Q报告**

    * **报告内支持直接唤起归因组件**，在编辑报告时，可通过报告内小Q问数对某一数据集内的指标变化，进行多维度、多步骤的归因分析，并生成归因分析组件。

* **数据构建**

  * **数据源**

    * 阿里云数据源RDS MySQL DuckDB支持5.7版本。

    * 以下数据源新增支持配置SSL：阿里云数据源RDS MySQL版、阿里云数据源RDS SQL Server版、阿里云数据源RDS MySQL DuckDB。

    * 应用数据源Dataphin新增Doris引擎类型。

    * 自建数据源Vertica支持v24.1.0-0版本。

  * **数据集**

    * 新增关系模型，用于多表关联与分析，能解决传统物理建模中效率低、准确性不足、分析灵活性差等问题，适用于复杂业务场景下的多维数据分析需求。

* **智能诊断**

  * 新增智能诊断，大模型精准解读报错，快速定位并解决问题。

* **数据分析**

  * **图表**

    * 指标拆解树样式图表配置能力整体优化，包括支持灵活展开、自定义指标块样式等。提升指标拆解树图表可用性和样式配置自由度。

    * 楼宇热力图支持用直角坐标系绘制。

    * 瀑布图支持设置动态起始值，适用于需要根据时间、业务状况等因素自动调整起始值的场景。

    * 交叉表、明细表支持分区配置自动换行。

  * **分析预警**

    * 在辅助线的自定义计算模式下，若图表支持配置主/副值轴，则可按需选择为主轴或从轴配置自定义计算方式。

  * **查询控件**

    * 日期粒度切换升级：当日期粒度字段为"年"、"季度"、"月"、"周"、"日"或"年月日时分秒"时，支持日期粒度的灵活切换。

    * 树形下拉支持按层级配置排序规则，灵活满足多级数据的展示与排序需求。

    * 新增指标筛选控件，用于对度量指标进行动态筛选和控制的交互式控件。

* **企业级能力**

  * **授权管理**：

    * 支持设置作品仅可授权给空间内用户，提升数据安全与访问可控性。

    * 数据集授权方式升级，新增组织级授权方式，与空间权限并行生效。现在，您可以将数据集使用权限授权给组织内任一具备"数据集使用"权限的用户。完成授权后，空间内成员可创建仪表板、电子表格等，其他组织成员可进行探索分析（此功能目前定向邀测中）。

  * **报表配置**：新增自定义报表字体能力，支持在系统中应用本地字体包。

  * **订阅**

    * 订阅仪表板，支持小Q解读组件。

    * 订阅仪表板，支持一次性选择多个图表组件；订阅电子表格时，支持一次性选择多个Sheet页。

* **开放平台**

  * 新增自定义页面能力，支持将本地开发的自定义页面上传至Quick BI，在Quick BI域名下原生运行，可同时实现企业级门户的深度定制与数据安全管控。

## 变更内容
* **智能小Q**

  * **企业知识库**

    * **连接企业知识库** ：支持以添加知识文档（本地文件、飞书文档）或直连三方知识库（阿里云百炼、通义点金、Dify）的形式连接企业知识内容。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6369759671/p1048262.png)

    * **AI智能学习与提炼** ：基于已连接的企业知识库，系统可智能学习并提炼出企业特有的业务逻辑、分析思路、内容模板等不同知识类型并保存。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6369759671/p1045074.png)

    * **召回知识并生成专属分析结果** ：在前台使用智能小Q能力（如小Q问数、小Q报告）时进行调用，生成企业专属分析结果。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6369759671/p1045243.png)

    请参见[知识库管理](https://help.aliyun.com/document_detail/3012765.html)、[小Q报告创建](https://help.aliyun.com/document_detail/2948531.html)。
  * **小Q问数**

    * 智能反问澄清机制：当用户提问缺失关键要素（如时间、指标）或存在多指标歧义时，小Q将主动发起反问，确认意图后再提供精准答案，显著提升问答准确率。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5699759671/p1045771.png)

      请参见[问题澄清](https://help.aliyun.com/document_detail/2715112.html#deba42db99u5v)。
    * 外嵌场景能力全面升级

      * 品牌个性化：支持上传专属LOGO，强化品牌识别与场景融合。

      * 主题自定义：可灵活配置模块外观风格，适配多样化视觉需求。

      * 欢迎语定制：支持设置欢迎语内容与样式，优化新用户引导体验。

      * 交互体验优化：对话框布局动态适配，操作更流畅自然。

      * URL智能传参：业务系统可通过URL参数自动填充问题，实现无缝跳转与预填。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1291859671/p1049338.png)

      请参见[Quick BI 智能小Q嵌入](https://help.aliyun.com/document_detail/2788828.html)。
    * 知识管理效率提升

      * 新增批量导出功能，一键导出业务逻辑、正则匹配规则及数据集选择规则，便于知识迁移与团队协作。

        ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0020859671/p1045860.png)

        请参见[问数知识管理](https://help.aliyun.com/document_detail/2715114.html)。
    * 查询性能与粒度增强

      * 维值加速：针对大数据量表优化模型学习效率，显著提升学习速度。

        ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9138149671/p1037619.png)

        请参见[数据准备](https://help.aliyun.com/document_detail/2836768.html)。
      * 细粒度时间支持：新增时、分、秒级时间维度，满足高精度数据分析需求。

  * **小Q报告**

    * **报告内支持直接唤起归因组件**，在编辑报告时，可通过报告内小Q问数对某一数据集内的指标变化，进行多维度、多步骤的归因分析，并生成归因分析组件。

      请参见[报告内AI助手](https://help.aliyun.com/document_detail/2949377.html)。
* **数据构建**

  * **数据源**

    * 阿里云数据源RDS MySQL DuckDB支持5.7版本。

      请参见[阿里云数据源RDS MySQL DuckDB](https://help.aliyun.com/document_detail/2999770.html)。
    * 以下数据源新增支持配置SSL：阿里云数据源RDS MySQL版、阿里云数据源RDS SQL Server版、阿里云数据源RDS MariaDB版、阿里云数据源RDS MySQL DuckDB。

      请参见[概述](https://help.aliyun.com/document_detail/47483.html)。
    * 应用数据源Dataphin新增Doris引擎类型。

      请参见[创建应用数据源Dataphin](https://help.aliyun.com/document_detail/166152.html)。
    * 自建数据源Vertica支持v24.1.0-0版本。

      请参见[自建数据源Vertica](https://help.aliyun.com/document_detail/468012.html)。
  * **数据集**

    * 新增关系模型，用于多表关联与分析，能解决传统物理建模中效率低、准确性不足、分析灵活性差等问题，适用于复杂业务场景下的多维数据分析需求。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1291859671/p1049346.png)

      请参见[关系模型](https://help.aliyun.com/document_detail/3014626.html)。
* **智能诊断**

  * 新增智能诊断功能，可利用大模型能力对查询链路中的复杂报错信息进行解读，精准定位报错原因，快速解决报错问题。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1291859671/p1049839.png)请参见[AI功能管理](https://help.aliyun.com/document_detail/3012711.html)。

* **数据分析**

  * **图表**

    * 指标拆解树样式图表配置能力整体优化，包括支持灵活展开、自定义指标块样式等。提升指标拆解树图表可用性和样式配置自由度。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3416659671/p850939.png)请参见[指标拆解树](https://help.aliyun.com/document_detail/163227.html)。

    * 楼宇热力图支持用直角坐标系绘制。

      请参见[楼宇热力图](https://help.aliyun.com/document_detail/2326751.html)。
    * 瀑布图支持设置动态起始值，适用于需要根据时间、业务状况等因素自动调整起始值的场景。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3120859671/p1042988.png)请参见[瀑布图](https://help.aliyun.com/document_detail/126237.html)。

    * 交叉表、明细表支持分区配置自动换行。

      请参见[交叉表](https://help.aliyun.com/document_detail/200338.html)、[明细表](https://help.aliyun.com/document_detail/473447.html)。
  * **分析预警**

    * 在辅助线的自定义计算模式下，若图表支持配置主/副值轴，则可按需选择为主轴或从轴配置自定义计算方式。

      请参见[分析预警](https://help.aliyun.com/document_detail/114244.html)。
  * **查询控件**

    * 日期粒度切换升级：当日期粒度字段为"年"、"季度"、"月"、"周"、"日"或"年月日时分秒"时，支持日期粒度的灵活切换。

      请参见[日期查询](https://help.aliyun.com/document_detail/151454.html)。
    * 树形下拉支持按层级配置排序规则，灵活满足多级数据的展示与排序需求。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3110859671/p1048968.png)

      请参见[文本查询](https://help.aliyun.com/document_detail/151453.html#d470c353a8e1s)。
    * 新增指标筛选控件，用于对度量指标进行动态筛选和控制的交互式控件。

* **企业级能力**

  * **授权管理**：

    * 支持设置作品仅可授权给空间内用户，提升数据安全与访问可控性。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1238149671/p1028255.png)

      请参见[授权设置](https://help.aliyun.com/document_detail/389613.html)。
    * 数据集授权方式升级，新增组织级授权方式，与空间权限并行生效。现在，您可以将数据集使用权限授权给组织内任一具备"数据集使用"权限的用户。完成授权后，空间内成员可创建仪表板、电子表格等，其他组织成员可进行探索分析（此功能目前定向邀测中）。

      请参见[授予数据集权限](https://help.aliyun.com/document_detail/197504.html)。
  * **报表配置**：新增自定义报表字体能力，支持在系统中应用本地字体包。

    请参见[字体配置](https://help.aliyun.com/document_detail/2252060.html#8ca345fad4hzq)。
  * **订阅**

    * 订阅仪表板，支持小Q解读组件。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0200859671/p1043586.png)
    * 订阅仪表板，支持一次性选择多个图表组件；订阅电子表格时，支持一次性选择多个Sheet页。

    请参见[创建订阅任务](https://help.aliyun.com/document_detail/101302.html)。
* **开放平台**

  * 新增自定义页面能力，支持将本地开发的自定义页面上传至Quick BI，在Quick BI域名下原生运行，可同时实现企业级门户的深度定制与数据安全管控。

    请参见[自定义可视化](https://help.aliyun.com/document_detail/3015437.html)。

**重要**

**下线功能：**

Quick BI V6.1版本升级后，**楼宇热力图**样式面板中的"地理区域"配置项将会被删去，不再支持自定义地理显示范围，所有底图默认显示范围将按照当前的图片范围展示，即原来选择"自动"时的效果。