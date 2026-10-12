## **发布日期**
2025年5月13日

## 重点升级概览
* **智能小Q**

  * 支持仪表板分图表组件数据解读。

  * 支持用户自助接入大模型。

* **数据构建**

  * **数据源**

    * 自建数据源IBM DB2 LUW新增支持V10.5.3版本。

    * GaussDB数据源支持抽取加速。

    * 自建数据源Apache Doris支持使用Quick引擎。

    * 新增支持以下数据库使用系统内置函数：Oracle、Hive、Impala、MongoDB、SelectDB。

  * **数据集**

    * 增加文本转数值时保留的数据精度，同时可通过计算字段的方式实现更低精度。

    * 数据建模时支持表级别的切换数据源。

* **数据分析**

  * **仪表板**

    * **交互式分析**

      * 支持在联动筛选面板中直接切换联动值，以快速对比不同联动值下的数据表现。

    * **高级计算**：新增支持差异计算、移动计算。

      * 差异计算：用于比较两个数据点之间在不同维度值下的差异。

      * 移动计算：基于滑动窗口技术对数据执行一系列计算的方法。

  * **电子表格**

    * 支持数据集表格跨区块对齐能力，将不同区块的数据按照一定的对齐规则进行匹配。

    * 导出电子表格时，支持选择需要导出的Sheet页。

* **数据导出**

  * 导出控制优化，导出配置可同步控制自助取数。

* **企业级能力**

  * **配置管理**

    * 新增回收站功能，可查看最近15天内删除的资源并恢复。

    * 新建工作空间时，支持选择空间所有者。

* **开放平台**

  * **嵌入分析**

    * 设置报表嵌入配置时，支持将报表页面语言设定为中文或英文。

## 变更内容
* **智能小Q**

  * 支持仪表板**分图表组件数据解读**，用户自定义解读范围，实时预估数据字符数，更好地解决了大模型 Token 限制与数据量间的矛盾；智能解读、总分结合，多种解读方式支持你的分析层层深入。

  * 支持**用户自助接入大模型**，在智能问数、仪表板问数以及仪表板数据解读等场景中进行深度推理和数据解读。

  * **Token显性化**：支持查看内置大模型的剩余Token，用户可以添加并使用自定义大模型。

* **数据构建**

  * **数据源**

    * 自建数据源IBM DB2 LUW新增支持V10.5.3版本。

      请参见[自建数据源IBM DB2 LUW](https://help.aliyun.com/document_detail/468010.html)。
    * GaussDB数据源支持抽取加速。

      请参见[数据源功能项列表](https://help.aliyun.com/document_detail/2642723.html)。
    * 自建数据源Apache Doris支持使用Quick引擎。

      请参见[数据源功能项列表](https://help.aliyun.com/document_detail/2642723.html)。
    * 新增支持以下数据库使用系统内置函数：Oracle、Hive、Impala、MongoDB、SelectDB。

      请参见[数据源功能项列表](https://help.aliyun.com/document_detail/2642723.html)、[系统内置函数](https://help.aliyun.com/document_detail/2831119.html)。
  * **数据集。**

    * 增加文本转数值时保留的数据精度（默认保留10位小数），若您需要保留更低的精度，可通过计算字段的方式实现文本转数值的逻辑。

    * 数据建模时支持表级别的切换数据源。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8706107471/p951599.png)

      请参见[构建模型](https://help.aliyun.com/document_detail/104002.html)。
* **数据分析**

  * **仪表板**

    * **交互式分析**

      * 支持在联动筛选面板中直接切换联动值，以快速对比不同联动值下的数据表现。![p950468](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8706107471/p951591.gif)

        请参见[联动](https://help.aliyun.com/document_detail/468061.html)。
    * **高级计算**：新增支持差异计算、移动计算。

      * 差异计算：用于比较两个数据点之间在不同维度值下的差异。

        请参见[差异计算](https://help.aliyun.com/document_detail/2881659.html)。
      * 移动计算：基于滑动窗口技术对数据执行一系列计算的方法。

        请参见[移动计算](https://help.aliyun.com/document_detail/2881662.html)。
  * **电子表格**

    * 支持数据集表格跨区块对齐能力，将不同区块的数据按照一定的对齐规则进行匹配。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8706107471/p951244.png)请参见[电子表格配置操作](https://help.aliyun.com/document_detail/101221.html)。

    * 导出电子表格时，支持选择需要导出的Sheet页。 ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8706107471/p951243.png)

      请参见[电子表格配置操作](https://help.aliyun.com/document_detail/101221.html)。
* **数据导出**

  * 导出控制优化，导出配置可同步控制自助取数。

    请参见[导出控制](https://help.aliyun.com/document_detail/172232.html)、[设置工作空间下的导出控制](https://help.aliyun.com/document_detail/425440.html)。
* **企业级能力**

  * **配置管理**

    * 新增回收站功能。在回收站中，您可以查看最近15天内删除的资源，并可便捷地进行恢复，消除误删除带来的顾虑。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8706107471/p951600.png)

      请参见[回收站](https://help.aliyun.com/document_detail/2881802.html)。
    * 新建工作空间时，支持选择空间所有者。

      请参见[新建并管理工作空间](https://help.aliyun.com/document_detail/61550.html)。
* **开放平台**

  * **嵌入分析**

    * 设置报表嵌入配置时，支持将报表页面语言设定为中文或英文。

      请参见[报表嵌入数据权限控制和传参的安全增强方案](https://help.aliyun.com/document_detail/391291.html)。