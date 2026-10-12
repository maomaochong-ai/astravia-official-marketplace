<br />

## 发布日期
2025年2月25日

## 重点升级概览
* **智能小Q**

  * 新增智汇问答板块，实现一次提问，多个大模型同步回答模式，支持 DeepSeek、Qwen、Kimi。

  * 智能问数推理过程显性化：实现大模型推理过程显性化和流式输出。

  * 智能问数连续推荐能力：每轮对话后的问题连续推荐能力。

  * 数据集问数配置智能化：降低配置门槛，提升配置质量。

* **数据构建**

  * **数据源**

    * Dataphin数据源在JDBC模式下，支持通过VPC连接。

  * **数据集**

    * 新增支持数据表合并，在数据建模时，可通过可视化拖拽的方式实现SQL语句中的Union All能力，快速实现数据的上下拼接。

    * 关联建模能力提升，新增右连接，支持更多元的关联模式；同时扩充关联键的灵活性，能够支持 "\>"、"\<" 等多种不同符号。

    * 数据集操作流程全面梳理，剔除繁琐冗余的环节，精简操作路径，提升使用体验。

  * **Quick引擎**

    * 支持增量抽取N个分区，即初始化抽取选中范围全量数据，后续每次增量最新N个分区的数据。

    * 新增"异常设置"模块，加速任务执行失败后，系统将默认重试3次，每次间隔为1小时。

    * "异常模块"下新增"忽略抽取为空"选项，开启后，抽取行数为空的任务对应状态将被置为"成功"。

    * 加速任务管控页面支持筛选功能，能够精准定位所需查看的任务状态，并对任务进行有效管理。

* **数据分析**

  * **可视化图表**

    * 新增图标库，帮助您设定更符合使用场景的各类图标。

    * 热力图能力升级，支持配置热力形状样式；支持按照维度和度量配置条件格式；支持按照维值赋热力深度颜色。

    * 趋势分析表新增目标分析功能，将实际数值与目标数值在同一图表中呈现，直观体现两者差异。

  * **查询控件**

    * 图表内查询控件和Tab内查询控件的样式面板支持收起。

    * 图表展示的日期粒度，支持跟随查询控件的粒度切换。

  * **高级计算**

    * 表格类图表新增支持按指定维度进行高级计算；线柱图类图表新增支持按组内进行高级计算。

    * 支持多种高级计算进行组合计算，可根据业务需求灵活构建复杂计算场景。

* **数据门户**

  * 移动端数据门户平铺布局菜单展示优化，层级结构更清晰。

* **企业级能力**

  * **订阅**

    * 订阅Excel附件时，支持交叉表、明细表携带数据格式及样式。

  * **权限管理**

    * 支持复制行列权限规则，可快速复用已有数据集的行列权限。

    * 行列权限界面优化，包括页面样式的调整以及白名单交互的优化等。

* **开放平台**

  * OpenAPI接口更新：QueryUserList-查询组织成员列表信息接口返回参数新增用户状态（isDeleted）。

## 变更内容
* **智能小Q**

  * 新增智汇问答板块，实现一次提问，多个大模型同步回答模式，支持 DeepSeek、Qwen、Kimi。

    具体请参见[智汇问答](https://help.aliyun.com/document_detail/2871839.html)。
  * 智能问数推理过程显性化：实现大模型推理过程显性化和流式输出。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3055730471/p919052.png)

    具体请参见[与智能助手对话](https://help.aliyun.com/document_detail/2715112.html)。
  * 智能问数连续推荐能力：每轮对话后的问题连续推荐能力。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3055730471/p919054.png)

    具体请参见[与智能助手对话](https://help.aliyun.com/document_detail/2715112.html)。
  * 数据集问数配置智能化：降低配置门槛，提升配置质量。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3055730471/p919057.png)

    具体请参见[问数配置](https://help.aliyun.com/document_detail/2836768.html#f19b3874d1xmh)。
* **数据构建**

  * **数据源**

    * Dataphin数据源在JDBC模式下，支持通过VPC连接。

      具体请参见[创建应用数据源Dataphin](https://help.aliyun.com/document_detail/166152.html)。
  * **数据集**

    * 新增支持数据表合并，在数据建模时，可通过可视化拖拽的方式实现SQL语句中的Union All能力，快速实现数据的上下拼接。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3055730471/p919026.png)

      具体请参见[构建模型](https://help.aliyun.com/document_detail/104002.html)。
    * 关联建模能力提升，新增右连接，支持更多元的关联模式；同时扩充关联键的灵活性，能够支持 "\>"、"\<" 等多种不同符号。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3055730471/p919034.png)

      具体请参见[构建模型](https://help.aliyun.com/document_detail/104002.html)。
    * 数据集操作流程全面梳理，剔除繁琐冗余的环节，精简操作路径，提升使用体验。

      具体请参见[创建并管理数据集](https://help.aliyun.com/document_detail/61151.html)。
  * **Quick引擎**

    * 支持增量抽取N个分区，即初始化抽取选中范围全量数据，后续每次增量最新N个分区的数据。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3055730471/p919036.png)
    * 新增"异常设置"模块，加速任务执行失败后，系统将默认重试3次，每次间隔为1小时。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3055730471/p919037.png)
    * "异常模块"下新增"忽略抽取为空"选项，开启后，抽取行数为空的任务对应状态将被置为"成功"。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3055730471/p919038.png)
    * 加速任务管控页面支持筛选功能，能够精准定位所需查看的任务状态，并对任务进行有效管理。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3055730471/p919035.png)

    具体请参见[配置Quick引擎](https://help.aliyun.com/document_detail/409908.html)。
* **数据分析**

  * **可视化图表**

    * 新增图标库，帮助您设定更符合使用场景的各类图标。

      具体请参见[跳转](https://help.aliyun.com/document_detail/468091.html)、[指标趋势图](https://help.aliyun.com/document_detail/126497.html)、[翻牌器](https://help.aliyun.com/document_detail/126957.html)、[指标看板](https://help.aliyun.com/document_detail/55685.html)、[创建PC端数据门户](https://help.aliyun.com/document_detail/102067.html)。
    * 热力图能力升级，支持配置热力形状样式；支持按照维度和度量配置条件格式；支持按照维值赋热力深度颜色。![p912364](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3055730471/p919402.gif)

      具体请参见[热力图](https://help.aliyun.com/document_detail/467975.html)。
    * 趋势分析表新增目标分析功能，将实际数值与目标数值在同一图表中呈现，直观体现两者差异。

      具体请参见[趋势分析表](https://help.aliyun.com/document_detail/330807.html)。
  * **查询控件**

    * 图表内查询控件和Tab内查询控件的样式面板支持收起。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3055730471/p919403.png)

    * 图表展示的日期粒度，支持跟随查询控件的粒度切换。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8576210471/p914964.gif)

      具体请参见[日期查询](https://help.aliyun.com/document_detail/151454.html)。
  * **高级计算**

    * 表格类图表新增支持按指定维度进行高级计算；线柱图类图表新增支持按组内进行高级计算。

      具体请参见[累计计算](https://help.aliyun.com/document_detail/456950.html)、[占比计算](https://help.aliyun.com/document_detail/474448.html)、[数据排名](https://help.aliyun.com/document_detail/211446.html)、[百分位](https://help.aliyun.com/document_detail/456946.html)、[TopN](https://help.aliyun.com/document_detail/457066.html)。
    * 支持多种高级计算进行组合计算，可根据业务需求灵活构建复杂计算场景。

      具体请参见[组合计算](https://help.aliyun.com/document_detail/2870340.html)。
* **数据门户**

  * 移动端数据门户平铺布局菜单展示优化，层级结构更清晰。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8146010471/p909770.png)

    具体请参见[创建移动端数据门户](https://help.aliyun.com/document_detail/2846231.html)。
* **企业级能力**

  * **订阅**

    * 订阅Excel附件时，支持交叉表、明细表携带数据格式及样式。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8556010471/p908134.png)

      具体请参见[创建订阅任务](https://help.aliyun.com/document_detail/101302.html)。
  * **权限管理**

    * 支持复制行列权限规则，可快速复用已有数据集的行列权限。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3055730471/p919046.png)

      具体请参见[复制行级权限](https://help.aliyun.com/document_detail/286884.html#922b1cc70c10y)、[复制列级权限](https://help.aliyun.com/document_detail/287022.html#0e5e385ef71ge)。
    * 行列权限界面优化，包括页面样式的调整以及白名单交互的优化等。

      具体请参见[类型一：条件组合授权](https://help.aliyun.com/document_detail/286884.html)、[类型二：标签授权](https://help.aliyun.com/document_detail/325414.html)、[列级权限](https://help.aliyun.com/document_detail/287022.html)。
* **开放平台**

  * OpenAPI接口更新：QueryUserList-查询组织成员列表信息接口返回参数新增用户状态（isDeleted）。

<br />