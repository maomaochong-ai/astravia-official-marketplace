<br />

## 发布日期
2024年7月23日

## 重点升级概览
* **仪表板**

  * **图表**：多维分析表、趋势分析表支持设置默认截止日期为T-0。

  * **控件：**支持为时间查询控件中的时间粒度，配置基于昨日的本月、本周、本季度的快捷区间。

  * **交互式分析：**

    * 进行图表跳转配置时，支持在全局参数设置中绑定占位符。

    * 交叉表、明细表支持通过圈选的方式，使用只看、排除功能。

  * **格式刷及批量设置**：支持跨Tab使用。

* **数据构建**

  * 数据源新增支持飞书多维表格。

  * 文件上传支持多Sheet上传、数据预览，以及使用体验优化。

  * 新增系统内置函数，新建计算字段时可直接使用Quick BI提供的系统内置函数进行数据处理，屏蔽了底层数据库的函数差异。

  * 可支持的StarRocks数据库版本更新，目前支持的版本为：2.5.18、3.1.7、3.1.9、3.2.6。

  * Spark数据源支持趋势/多维分析表（均值/累计）。

* **填报及其相关模板**

  * 模板市场重磅推出以下电子表格填报模板：[财务预算编制](https://bi.aliyun.com/template/nl/preview?templateId=83664687-8058-438c-8b1c-5d0288041772&useMenu=ec7026ead4b246b9b35aef3784e47fc2)、[人力成本核算](https://bi.aliyun.com/template/nl/preview?templateId=2c78d0c5-e30c-4f5b-8904-0d6447c8dfae&useMenu=ec7026ead4b246b9b35aef3784e47fc2)、[工业生产巡检](https://bi.aliyun.com/template/nl/preview?templateId=4102cd68-55fd-4d34-a34c-6ee2469196d6&useMenu=ec7026ead4b246b9b35aef3784e47fc2)、[零售门店巡检](https://bi.aliyun.com/template/nl/preview?templateId=fa6ca030-c15f-43c6-9e6a-738392f31065&useMenu=ec7026ead4b246b9b35aef3784e47fc2)，帮助有线下数据收集-入库-分析诉求的用户，快速了解如何通过复杂表格进行数据填报。

  * 电子表格填报新增引导指南功能，高效指导新手体验电子表格填报创建及配置的全流程操作。

  * 表单填报及电子表格填报中的部分控件支持条件级联，简化填报过程中的信息选择操作。

* **智能小Q**

  * **场景化问数**：支持将相关数据集根据不同的业务场景，组合为分析主题，并基于分析主题问数。例如：销售分析、供应链分析。

  * **场景化嵌入**：模块嵌入时，支持圈定数据范围并自定义Logo、标题等内容，打造企业专属的问数机器人。

  * **精细化权限管控**：增加问数配置权限点，支持基于分析主题的数据授权。

    该功能目前处于测试邀请阶段，如需使用请联系Quick BI工作人员。
* **企业级能力**

  * **监控告警：**支持自定义异常告警规则，可基于业务场景选择是否忽略查询为空。

  * **订阅任务：**支持批量删除订阅任务。

  * **用户管理：**新增用户类型过滤器，可以在用户角色管理页面使用过滤器，以筛选出对应类型下的全部用户。

* **移动端**

  * **数据门户**：在移动端门户查看菜单栏时，可以通过全局搜索功能在多级菜单和子菜单中，快速定位目标。

* **开放平台：** 场景化解决方案新增[自定义图表组件](https://bi.aliyun.com/openplatform/public/solutions?id=3a7c1b6040c54adc9b311f695573c7d9)、[自定义行为事件](https://bi.aliyun.com/openplatform/public/solutions?id=853f5dfeafca4b0ab1b3edf1c04393a8)。

  * **自定义图表组件**：通过自定义图表组件的代码，定制图表样式及实现逻辑，使图表更符合企业的业务需求及品牌形象，进而完成针对行业特定属性的数据分析。

  * **自定义行为事件**：通过自定义行为事件的代码，定制事件的实现逻辑，使事件触发流程符合真实业务需求，进而达到报表质量审核、数据安全保护等个性化目标。

    **说明**

    自定义行为事件仅支持独立部署环境，为付费能力，如需使用请联系产品运营同学。

## 变更内容
* **仪表板**

  * **图表** ：多维分析表、趋势分析表支持设置默认截止日期为T-0。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5462361271/p823336.png)

  * **控件：**支持为时间查询控件中的时间粒度，配置基于昨日的本月、本周、本季度的快捷区间。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5462361271/p823061.png)

    请参见[新建查询控件](https://help.aliyun.com/document_detail/151455.html)、[日期查询](https://help.aliyun.com/document_detail/151454.html)。
  * **交互式分析：**

    * 进行图表跳转配置时，支持在全局参数设置中绑定占位符。

      请参见[跳转](https://help.aliyun.com/document_detail/468091.html)。
    * 交叉表、明细表支持通过圈选的方式，使用只看、排除功能。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6642361271/p823056.gif)

      请参见[圈选](https://help.aliyun.com/document_detail/203621.html)。
  * **格式刷及批量设置** ：支持跨Tab使用。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5462361271/p823340.png)

* **数据构建**

  * 数据源新增支持飞书多维表格。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2264992271/p829165.png)

    请参见[创建飞书多维表格数据源](https://help.aliyun.com/document_detail/2833643.html)。
  * 文件上传支持多Sheet上传、数据预览，以及使用体验优化。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5462361271/p823725.png)

    请参见[创建文件数据源](https://help.aliyun.com/document_detail/168026.html)。
  * 新增系统内置函数，新建计算字段时可直接使用Quick BI提供的系统内置函数进行数据处理，屏蔽了底层数据库的函数差异。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5462361271/p823059.png)

    请参见[系统内置函数](https://help.aliyun.com/document_detail/2831119.html)。
  * 可支持的StarRocks数据库版本更新，目前支持的版本为：2.5.18、3.1.7、3.1.9、3.2.6。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5462361271/p823329.png)

    请参见[自建数据源StarRocks](https://help.aliyun.com/document_detail/468025.html)、[阿里云数据源StarRocks](https://help.aliyun.com/document_detail/2584885.html)。
  * Spark数据源支持趋势/多维分析表（均值/累计）。

    请参见[数据源功能项列表](https://help.aliyun.com/document_detail/2642723.html)。
* **填报及其相关模板**

  * 模板市场重磅推出以下电子表格填报模板：[财务预算编制](https://bi.aliyun.com/template/nl/preview?templateId=83664687-8058-438c-8b1c-5d0288041772&useMenu=ec7026ead4b246b9b35aef3784e47fc2)、[人力成本核算](https://bi.aliyun.com/template/nl/preview?templateId=2c78d0c5-e30c-4f5b-8904-0d6447c8dfae&useMenu=ec7026ead4b246b9b35aef3784e47fc2)、[工业生产巡检](https://bi.aliyun.com/template/nl/preview?templateId=4102cd68-55fd-4d34-a34c-6ee2469196d6&useMenu=ec7026ead4b246b9b35aef3784e47fc2)、[零售门店巡检](https://bi.aliyun.com/template/nl/preview?templateId=fa6ca030-c15f-43c6-9e6a-738392f31065&useMenu=ec7026ead4b246b9b35aef3784e47fc2)，帮助有线下数据收集-入库-分析诉求的用户，快速了解如何通过复杂表格进行数据填报。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6346903271/p832270.png)

  * 电子表格填报新增引导指南功能，高效指导新手体验电子表格填报创建及配置的全流程操作。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9832361271/p817092.png)

    请参见[概述](https://help.aliyun.com/document_detail/2503231.html)。
  * 表单填报及电子表格填报中的部分控件支持条件级联，简化填报过程中的信息选择操作。![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5632361271/p821879.gif)

    请参见[配置条件级联（电子表格填报）](https://help.aliyun.com/document_detail/2834348.html)、[配置条件级联（表单填报）](https://help.aliyun.com/document_detail/2834533.html)。
* **智能小Q**

  * **场景化问数** ：支持将相关数据集根据不同的业务场景，组合为分析主题，并基于分析主题问数。例如：销售分析、供应链分析。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1361322271/p823077.png)

    请参见[系统集成](https://help.aliyun.com/document_detail/2788828.html)。
  * **场景化嵌入** ：模块嵌入时，支持圈定数据范围并自定义Logo、标题等内容，打造企业专属的问数机器人。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1361322271/p823075.png)

    请参见[系统集成](https://help.aliyun.com/document_detail/2788828.html)。
  * **精细化权限管控**：增加问数配置权限点，支持基于分析主题的数据授权。

    请参见[权限管理](https://help.aliyun.com/document_detail/2715113.html)。
* **企业级能力**

  * **监控告警：**支持自定义异常告警规则，可基于业务场景选择是否忽略查询为空。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5462361271/p823070.png)

    请参见[配置监控告警](https://help.aliyun.com/document_detail/114219.html)。
* **订阅任务：**支持批量删除订阅任务。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5462361271/p823064.png)

  请参见[管理订阅任务](https://help.aliyun.com/document_detail/101326.html)。
* **用户管理：** 新增用户类型过滤器，可以在用户角色管理页面使用过滤器，以筛选出对应类型下的全部用户。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5462361271/p823347.png)

  请参见[角色管理](https://help.aliyun.com/document_detail/2399798.html)。
* **移动端**

  * **数据门户**：在移动端门户查看菜单栏时，可以通过全局搜索功能在多级菜单和子菜单中，快速定位目标。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5462361271/p823062.png)

    请参见[新建数据门户](https://help.aliyun.com/document_detail/102067.html)。
* **开放平台** ：场景化解决方案新增自定义行为事件、自定义图表组件。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2264992271/p831609.png)

  * **自定义图表组件**：通过自定义图表组件的代码，定制图表样式及实现逻辑，使图表更符合企业的业务需求及品牌形象，进而完成针对行业特定属性的数据分析。

    请参见[自定义图表组件](https://bi.aliyun.com/openplatform/public/solutions?id=3a7c1b6040c54adc9b311f695573c7d9)**。**
  * **自定义行为事件**：通过自定义行为事件的代码，定制事件的实现逻辑，使事件触发流程符合真实业务需求，进而达到报表质量审核、数据安全保护等个性化目标。

    请参见[自定义行为事件](https://bi.aliyun.com/openplatform/public/solutions?id=853f5dfeafca4b0ab1b3edf1c04393a8)**。**  
    **说明**

    自定义行为事件仅支持独立部署环境，为付费能力，如需使用请联系产品运营同学。