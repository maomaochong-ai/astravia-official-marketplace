<br />

## **发布日期**
2025年11月18日

## 重点升级概览
* **智能小Q**

  * **小Q问数·探索版**

    * 新增小Q问数·探索版，可基于数据表进行自然语言问数，获取洞察。

      **重要**

      小Q问数·探索版当前处于邀测期，需单独申请。
  * **小Q问数**

    * 新增支持基于语义的洞察归因，可通过自然语言直接调起归因，获得小Q洞察结果。

    * 小Q洞察支持与小Q报告同步动态更新数据，确保分析结果实时准确。

  * **小Q解读**

    * 支持仪表板开发者将小Q解读结果添加至仪表板作为组件展示。

    * 小Q解读支持问题收藏和复用。

  * **小Q报告**

    * 支持在自定义角色中配置小Q报告的使用权限。

    * 支持指定成员进行协同编辑。

    * 小Q报告上线订阅功能，支持推送至邮件、钉钉、企微、飞书等渠道。

    * 新增归档功能，支持将不同时间下的报告数据进行归档。

    * 智能化生成小Q报告支持后台异步生成，无需长时间等待。

    * 报告列表管理功能整体优化。

* **数据构建**

  * **数据源**

    * 阿里云数据源Hologres支持指定时区。

    * 新增支持阿里云数据源E-MapReduce Serverless Spark版。

    * MaxCompute数据源的表列表信息，从异步加载修改为"同步加载+缓存"的策略，未命中缓存时需要等待10\~15秒完成元数据获取。

  * **数据集**

    * 新增获取时间差、新增维值别名、缺失值替换、拆分字段和合并字段的工具栏能力。

* **数据分析**

  * **高级计算**：支持基于日期占位符进行同环比计算。

  * **电子表格**：当数据集表格为明细模式时，维度字段与度量字段可灵活混排。

* **数据导出**

  * 在仪表板中操作导出Excel文件时，支持将图片字段生成为实际图片而非URL链接。

* **企业级能力**

  * **办公协同**：办公软件接入支持Teams。

  * **统计分析**：支持在访问统计中，查看在指定时间范围内未被访问过的不活跃资源。

* **开放平台**

  * **以下OpenAPI接口更新**：

    * 新增ListWhitePortalMenu接口，用于获取数据门户菜单的白名单列表。

    * 新增GetMailTaskList接口，用于获取订阅任务列表信息。

    * 新增QueryUserByMobileAccount接口，用于根据绑定的第三方账号ID查询UserId。

  * **嵌入JS SDK**

    * JS SDK新增Vue3版本的npm包，支持开发者基于Vue3框架环境开发嵌入页面。

## 变更内容
* **智能小Q**

  * **小Q问数·探索版**

    * 新增小Q问数·探索版，可针对数据库表智能构建业务分析主题，在分析主题下自然语言问数。

      **重要**

      小Q问数·探索版当前处于邀测期，需单独申请。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0418533671/p1026814.png)
  * **小Q问数**

    * 新增支持基于语义的洞察归因，可通过自然语言直接调起归因，获得小Q洞察结果。

      请参见[小Q洞察](https://help.aliyun.com/document_detail/2985099.html)。
    * 小Q洞察支持与小Q报告同步动态更新数据，确保分析结果实时准确。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0418533671/p1025867.png)

      请参见[小Q洞察插入](https://help.aliyun.com/document_detail/2948620.html#9a743f1ff3bve)。
  * **小Q解读**

    * 支持仪表板开发者将小Q解读结果添加至仪表板作为组件，便于可视化展示与共享。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5902453671/p1028172.png)

      请参见[仪表板解读组件](https://help.aliyun.com/document_detail/2997496.html)。
    * 小Q解读支持问题收藏，用于用户快捷提问。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5902453671/p1027825.png)

      请参见[仪表板小Q解读](https://help.aliyun.com/document_detail/2871898.html)。
  * **小Q报告**

    * 支持在自定义角色中配置小Q报告的使用权限，通过角色分配实现对指定用户的报告访问控制。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1440633671/p1025628.png)请参见[小Q报告管理](https://help.aliyun.com/document_detail/2948530.html)。

    * 支持协同编辑，可指定成员并开启报告的协同编辑权限。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1440633671/p1025878.png)请参见[小Q报告管理](https://help.aliyun.com/document_detail/2948530.html)。

    * 小Q报告上线订阅功能，支持推送至邮件、钉钉、企微、飞书等渠道。

      请参见[小Q报告管理](https://help.aliyun.com/document_detail/2948530.html)。
    * 新增归档功能，支持将不同时间下的报告数据进行归档。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1440633671/p1026445.png)请参见[小Q报告管理](https://help.aliyun.com/document_detail/2948530.html)。

    * 智能化生成小Q报告支持后台异步运行，在退出页面或切换至其他功能时，任务仍可持续执行，无需长时间等待，生成完成后会提示查看结果。

      请参见[小Q报告创建](https://help.aliyun.com/document_detail/2948531.html)。
    * 报告列表管理功能整体优化：支持按不同文件类型进行筛选；支持全局及文件夹内搜索；排序支持全局生效；预览和编辑显性化等。

* **数据构建**

  * **数据源**

    * 阿里云数据源Hologres支持指定时区，解决了由于服务器默认时区导致的数据提取时区差异问题。

      请参见[阿里云数据源Hologres](https://help.aliyun.com/document_detail/467996.html)。
    * 新增支持阿里云数据源E-MapReduce Serverless Spark版。

      请参见[阿里云数据源E-MapReduce Serverless Spark版](https://help.aliyun.com/document_detail/2995515.html)。
    * MaxCompute数据源的表列表信息，从异步加载修改为"同步加载+缓存"的策略，未命中缓存时需要等待10\~15秒完成元数据获取。

      请参见[阿里云数据源MaxCompute](https://help.aliyun.com/document_detail/467992.html)。
  * **数据集**

    * 新增获取时间差、新增维值别名、失值替换、拆分字段和合并字段的工具栏能力，无需学习函数及计算字段的使用方式，只需可视化面板配置即可实现对应的数据处理。

      请参见[获取时间差](https://help.aliyun.com/document_detail/2995550.html)、[缺失值替换](https://help.aliyun.com/document_detail/2995551.html)、[新增维值别名](https://help.aliyun.com/document_detail/2995553.html)、[拆分字段和合并字段](https://help.aliyun.com/document_detail/2995554.html)。
* **数据分析**

  * **高级计算** ：支持基于日期占位符进行同环比计算。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0418533671/p1024668.png)

    请参见[同环比](https://help.aliyun.com/document_detail/177518.html)。
  * **电子表格** ：当数据集表格为明细模式时，维度字段与度量字段可灵活混排。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0418533671/p1024803.png)请参见[创建电子表格](https://help.aliyun.com/document_detail/61824.html)。

* **数据导出**

  * 在仪表板中操作导出Excel文件时，支持将图片字段生成为实际图片而非URL链接。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0418533671/p1024879.png)请参见[导出控制](https://help.aliyun.com/document_detail/172232.html)。

* **企业级能力**

  * **办公协同**：办公软件接入支持Teams，包括Teams通讯录同步、微应用等能力。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0418533671/p1026818.png)

    请参见[（公共云）开通Teams微应用](https://help.aliyun.com/document_detail/2996392.html)。
  * **统计分析**：支持在访问统计中，查看在指定时间范围内未被访问过的不活跃资源，并以本地Excel的形式导出不活跃资源列表。

    请参见[访问分析](https://help.aliyun.com/document_detail/452192.html)。
* **开放平台**

  * **以下OpenAPI接口更新**：

    * 新增ListWhitePortalMenu接口，用于获取数据门户菜单的白名单列表。

    * 新增GetMailTaskList接口，用于获取订阅任务列表信息。

    * 新增QueryUserByMobileAccount接口，用于根据绑定的第三方账号ID查询UserId。

  * **嵌入JS SDK**

    * JS SDK新增Vue3版本的npm包，支持开发者基于Vue3框架环境开发嵌入页面。