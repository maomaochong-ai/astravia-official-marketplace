<br />

## **发布日期**
2025年6月10日

## 重点升级概览
* **智能小Q**

  * **智能问数**

    * 智能问数采用多步流式分屏呈现，分析过程、结果分别表达更清晰。

    * 新增 Python 结果数据的可交互式呈现。

    * 知识库新增正则匹配和数据集选择两类知识。

    * 归因分析能力增强，新增分指标分别配置优先归因维度功能。

    * 智能问数新增自定义 Prompt 进行二次解读能力。

    * 新增针对不同用户批量配置推荐问题能力。

  * **智能体**

    * 我的智能体支持接入阿里云百炼智能体（公共云）。

  * **智汇问答**

    * 智汇问答新增自选模型能力，DeepSeek 思考过程可折叠。

* **数据构建**

  * **数据源**

    * 新增支持阿里云SelectDB数据源。

    * Presto数据源Trino模式下支持自定义周。

    * 系统内置函数支持的数据源扩充：OceanBase、TiDB（不支持BI_MID函数）、MariaDB。

    * 文件上传界面文案及交互优化。

  * **Quick引擎**

    * Quick引擎支持灵活数据回溯。

    * 阿里云数据源AnalyticDB MySQL 3.0支持在Spark引擎模式下使用抽取加速功能。

  * **数据集**

    * 系统内置函数新增dayofweek。

    * LOD函数复杂计算场景优化。

* **数据分析**

  * **可视化图表**

    * 漏斗图样式及配置项升级优化。

    * 明细表新增仅单列生效的全局排序模式。

  * **电子表格**

    * 支持自定义查询控件在各Sheet页上的显示逻辑。

    * 支持为数据集表格中的不同区块配置不同的单元格样式。

  * **高级计算**

    * 日期累计新增支持周累计。

* **企业级能力**

  * **办公协同**

    * 办公软件接入支持添加多个钉钉/企业微信/飞书授权企业。

* **开放平台**

  * 以下OpenAPI接口更新：

    * 查询审计日志信息（QueryAuditLog）接口请求参数新增accessSourceFlag、userAccessDevice（仅查询访问类日志时生效。）

## 变更内容
* **智能小Q**

  * **智能问数**

    * 智能问数采用多步流式分屏呈现，分析过程、结果分别表达更清晰。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2551510571/p967996.png)

      请参见[发起问数](https://help.aliyun.com/document_detail/2715112.html)。
    * 新增 Python 结果数据的可交互式呈现。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2551510571/p967953.png)
    * 知识库新增正则匹配和数据集选择两类知识。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2551510571/p968018.png)

      请参见[企业知识库管理](https://help.aliyun.com/document_detail/2715114.html)。
    * 归因分析能力增强，新增分指标分别配置优先归因维度功能。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2551510571/p968015.png)

      请参见[归因分析配置](https://help.aliyun.com/document_detail/2836768.html#f2e2f20b31cph)。
    * 智能问数新增自定义 Prompt 进行二次解读能力。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2551510571/p966604.png)

      请参见[发起问数](https://help.aliyun.com/document_detail/2715112.html)。
    * 新增针对不同用户批量配置推荐问题能力。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2551510571/p968006.png)

      请参见[快捷提问](https://help.aliyun.com/document_detail/2836768.html#c4286d140an0b)。
  * **智能体**

    * 我的智能体支持接入阿里云百炼智能体（公共云）。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2551510571/p968011.png)

      请参见[智能体管理](https://help.aliyun.com/document_detail/2876539.html)。
  * **智汇问答**

    * 智汇问答新增自选模型能力，DeepSeek 思考过程可折叠。

      请参见[智汇问答](https://help.aliyun.com/document_detail/2871839.html)。
* **数据构建**

  * **数据源**

    * 新增支持阿里云SelectDB数据源。

      请参见[阿里云数据源SelectDB](https://help.aliyun.com/document_detail/2923801.html)。
    * Presto数据源Trino模式下支持自定义周。

      请参见[数据源功能项列表](https://help.aliyun.com/document_detail/2642723.html)。
    * 系统内置函数支持的数据源扩充：OceanBase、TiDB（不支持BI_MID函数）、MariaDB。

      请参见[数据源功能项列表](https://help.aliyun.com/document_detail/2642723.html)。
    * 文件上传界面文案及交互优化。

      请参见[创建文件数据源](https://help.aliyun.com/document_detail/168026.html)。
  * **Quick引擎**

    * Quick引擎支持灵活数据回溯。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8228449471/p965333.png)

      请参见[配置Quick引擎](https://help.aliyun.com/document_detail/409908.html)。
    * 阿里云数据源AnalyticDB MySQL 3.0支持在Spark引擎模式下使用抽取加速功能。

      请参见[数据源功能项列表](https://help.aliyun.com/document_detail/2642723.html)。
  * **数据集**

    * 系统内置函数新增dayofweek。

      请参见[日期函数](https://help.aliyun.com/document_detail/2833144.html)。
    * LOD函数复杂计算场景优化，包括：

      * 函数内部过滤条件调整为只对LOD计算本身生效。

      * 部分数据源对聚合维度中的空值进行特殊处理，使空值可以被正常计算。

      版本发布之后，之前无法处理的特殊场景将能够正常计算，您图表中的数据行数可能会增加，请留意。
* **数据分析**

  * **可视化图表**

    * 漏斗图样式及配置项升级优化。

      请参见[漏斗图](https://help.aliyun.com/document_detail/55682.html)、[对比漏斗图](https://help.aliyun.com/document_detail/55280.html)。
    * 明细表新增仅单列生效的全局排序模式。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8228449471/p961826.gif)

      请参见[明细表](https://help.aliyun.com/document_detail/473447.html)。
  * **电子表格**

    * 支持自定义查询控件在各Sheet页上的显示逻辑。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8228449471/p965350.png)

      请参见[添加查询控件](https://help.aliyun.com/document_detail/61840.html)。
    * 支持为数据集表格中的不同区块配置不同的单元格样式。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8228449471/p962962.png)

      请参见[样式配置](https://help.aliyun.com/document_detail/2640037.html)。
  * **高级计算**

    * 日期累计新增支持周累计，用于计算特定度量值在一周内的累加结果。

      请参见[日期累计](https://help.aliyun.com/document_detail/211447.html)。
* **企业级能力**

  * **办公协同**

    * 办公软件接入支持添加多个钉钉/企业微信/飞书授权企业，以满足用户所属的多个独立主体（如子公司或分支机构）共同访问同一套Quick BI的需求。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8228449471/p965122.png)

      请参见[（公共云）开通钉钉微应用](https://help.aliyun.com/document_detail/607098.html)、[（公共云）开通企业微信微应用](https://help.aliyun.com/document_detail/607162.html)、[（公共云）开通飞书自建微应用](https://help.aliyun.com/document_detail/607492.html)。
* **开放平台**

  * 以下OpenAPI接口更新：

    * 查询审计日志信息（QueryAuditLog）接口请求参数新增accessSourceFlag、userAccessDevice（仅查询访问类日志时生效。）

      具体请参见[QueryAuditLog - 查询审计日志信息](https://help.aliyun.com/document_detail/2833320.html)。