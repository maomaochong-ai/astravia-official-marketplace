<br />

## **发布日期**
2025年8月28日

## 重点升级概览
* **智能小Q**

  * **小Q超级框**：智能小Q重磅升级，集问数、报告、解读、搭建、搜索、发现等多Agent于一体，让每位用户都拥有「超级数据分析师」。

  * **小Q报告**

    * 支持将小Q报告一键导出为图片、PDF 或 Word 格式，便于分享与汇报。

    * 报告内数据可与执行过程面板联动，支持定位到具体数据生成过程，便于数据溯源与准确性验证。

    * 编辑页支持拖拽调整执行过程面板宽度，布局更灵活，操作更便捷。

  * **小Q问数**：升级追问能力，大幅提升追问准确率。

  * 支持购买**Token增值包**，灵活扩展资源配额。

* **数据构建**

  * **数据源**：新增AWS Databricks、Azure Databricks数据源。

  * **数据集**：系统内置函数支持的数据源扩充：达梦、SAP HANA。

  * **表单填报**：对外审批电子流的自定义渠道消息中，新增填报入库的消息内容，可传递每个填报控件的名称、类型及对应填报数据。

* **数据分析**

  * **仪表板**

    * **可视化图表**

      * 瀑布图支持设置Y轴的轴值范围与间隔。

      * 色彩地图及使用自定义GeoJSON字段的地图图表，在样式中设置为关闭轮廓层时，将不再显示轮廓线。

      * 移动端色彩底图及经纬度模式下的地图图表，支持选择是否开启底图。

    * **交互式分析**：支持同步下钻功能，一次操作即可实现已配置过联动的多个图表间的同步下钻。

    * **查询控件**：默认值为动态函数时支持按排序字段生效。

    * **高级计算**：新增支持多字段组合计算，支持基于多个字段结果值的二次计算。

    * **Tab**：支持自定义Tab内组件间距值。

  * **电子表格**

    * 支持在Sheet页名称中输入空格，但不支持仅输入空格。

    * 支持将查询控件设置为默认展开全部筛选条件。

  * **数据大屏**

    * 新增支持气泡图、桑基图、仪表盘。

    * 下拉列表控件中的选项值展示个数上限值增加到1000，同时支持通过输入关键来模糊搜索相关选项值。

  * **导出**：导出文件自定义名称支持增加随机字符串以防止文件名重复。

* **开放平台**

  * 支持通过JS JDK的方式嵌入特定页面。

  * 以下OpenAPI接口更新

    * 新增数据源连接（AddDataSource）

    * 检查给定的cubeId是否存在（CheckDatasetExisted）

    * 判断用户是否属于组织（CheckOrganizationMember）

    * 根据自定义sql创建数据集（CreateCubeBySql）

    * 根据物理表名称创建数据集（CreateDataset）

    * 查询用户所有空间角色列表（ListWorkspaceUserRolesByUserId）

    * 更新自定义sql数据集（UpdateCubeBySql）

    * 修改数据源配置（UpdateDataSource）

* **服务支持**

  为了保证系统性能和稳定性，我们将在V6.0增加了趋势分析表/多维分析表的用量规格限制，避免单个查询占用过多机器资源导致使用卡顿甚至系统崩溃。若升级后您的趋势分析表、多维分析表因超出用量规格而报错，请适当减少字段数、时间周期数，给您带来的不便深表歉意。

## 变更内容
* **智能小Q**

  * **小Q超级框**：集问数、报告、解读、搭建、搜索、发现等多Agent于一体，打造统一交互入口，基于用户意图识别，自动规划相应专家Agent执行操作，一句话直达关键洞察，让数据分析触手可得。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8800826571/p1001556.png)请参见[智能小Q操作指南](https://help.aliyun.com/document_detail/2974823.html)。
  * **小Q报告**

    * 支持将小Q报告一键导出为图片、PDF 或 Word 格式，便于分享与汇报。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6684826571/p1001848.png)请参见[小Q报告管理](https://help.aliyun.com/document_detail/2948530.html)。

    * 报告内数据可与执行过程面板联动，支持定位到具体数据生成过程，便于数据溯源与准确性验证。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8800826571/p1001401.gif)

      请参见[文档编辑](https://help.aliyun.com/document_detail/2950244.html)。
    * 编辑页支持拖拽调整执行过程面板宽度，布局更灵活，操作更便捷。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8800826571/p1001432.gif)

  * **小Q问数**：升级追问能力，大幅提升追问准确率。

  * 支持购买**Token增值包**，灵活扩展资源配额。

    请参见[Quick BI计费方式](https://help.aliyun.com/document_detail/53282.html)。
* **数据构建**

  * **数据源**：新增AWS Databricks、Azure Databricks数据源。

    请参见[AWS数据源Databricks](https://help.aliyun.com/document_detail/2974792.html)、[微软云数据库Azure Databricks](https://help.aliyun.com/document_detail/2974803.html)。
  * **数据集**：系统内置函数支持的数据源扩充：达梦、SAP HANA。

    请参见[数据源功能项列表](https://help.aliyun.com/document_detail/2642723.html)。
  * **表单填报**：对外审批电子流的自定义渠道消息中，新增填报入库的消息内容，可传递每个填报控件的名称、类型及对应填报数据。

    请参见[自定义渠道](https://help.aliyun.com/document_detail/390197.html)。
* **数据分析**

  * **仪表板**

    * **可视化图表**

      * 瀑布图支持设置Y轴的轴值范围与间隔。

        请参见[瀑布图](https://help.aliyun.com/document_detail/126237.html)。
      * 色彩地图及使用自定义GeoJSON字段的地图图表，在样式中设置为关闭轮廓层时，将不再显示轮廓线。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8800826571/p995256.gif)

        请参见[色彩地图](https://help.aliyun.com/document_detail/55653.html)。
      * 移动端色彩底图及经纬度模式下的地图图表，支持选择是否开启底图。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8800826571/p995270.gif)

        请参见[色彩地图](https://help.aliyun.com/document_detail/55653.html)。
    * **交互式分析** ：支持同步下钻功能，一次操作即可实现已配置过联动的多个图表间的同步下钻。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8800826571/p999823.gif)请参见[联动](https://help.aliyun.com/document_detail/468061.html)。

    * **查询控件**：默认值为动态函数时支持按排序字段生效。

      请参见[文本查询控件](https://help.aliyun.com/document_detail/151453.html)。
    * **高级计算**：新增支持多字段组合计算，支持基于多个字段结果值的二次计算，比如：多个高级计算字段的加减乘除、数据集组合跨数据集字段间的计算分析。

      请参见[多字段组合](https://help.aliyun.com/document_detail/2974935.html)。
    * **Tab**：支持自定义Tab内组件间距值。

      请参见[主题设计](https://help.aliyun.com/document_detail/144964.html)。
  * **电子表格**

    * 支持在Sheet页名称中输入空格，但不支持仅输入空格。

      请参见[电子表格配置操作](https://help.aliyun.com/document_detail/101221.html)。
    * 支持将查询控件设置为默认展开全部筛选条件。

      请参见[添加查询控件](https://help.aliyun.com/document_detail/61840.html)。
  * **数据大屏**

    * 新增支持气泡图、桑基图、仪表盘。

      请参见[气泡图](https://help.aliyun.com/document_detail/2972646.html)、[桑基图](https://help.aliyun.com/document_detail/2972647.html)、[仪表盘](https://help.aliyun.com/document_detail/2975033.html)。
    * 下拉列表控件中的选项值展示个数上限值增加到1000，同时支持通过输入关键来模糊搜索相关选项值。

      ![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2042634571/p992306.gif)

      请参见[下拉列表](https://help.aliyun.com/document_detail/446201.html)。
  * **导出**：导出文件自定义名称支持增加随机字符串以防止文件名重复。

    请参见[导出控制](https://help.aliyun.com/document_detail/172232.html)。
* **开放平台**

  * 支持通过嵌入JS SDK，在自有业务系统中快速集成Quick BI系统的特定页面，并通过参数配置的模式灵活自定义相关页面的显示内容及跳转逻辑。

    请参见[嵌入JS SDK使用指南](https://help.aliyun.com/document_detail/2883312.html)。
  * 以下OpenAPI接口更新

    * 新增数据源连接（AddDataSource）

    * 检查给定的cubeId是否存在（CheckDatasetExisted）

    * 判断用户是否属于组织（CheckOrganizationMember）

    * 根据自定义sql创建数据集（CreateCubeBySql）

    * 根据物理表名称创建数据集（CreateDataset）

    * 查询用户所有空间角色列表（ListWorkspaceUserRolesByUserId）

    * 更新自定义sql数据集（UpdateCubeBySql）

    * 修改数据源配置（UpdateDataSource）

* **服务支持**

  为了保证系统性能和稳定性，我们将在V6.0增加了趋势分析表/多维分析表的用量规格限制，避免单个查询占用过多机器资源导致使用卡顿甚至系统崩溃。若升级后您的趋势分析表、多维分析表因超出用量规格而报错，请适当减少字段数、时间周期数，给您带来的不便深表歉意。