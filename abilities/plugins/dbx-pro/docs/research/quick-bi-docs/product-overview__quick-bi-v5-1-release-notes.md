<br />

## **发布日期**
2024年4月11日

## 重点升级概览
* 数据源\&数据集能力拓展

  * 支持在数据集内自定义配置业务财年，上层报表的数据展示、日期筛选、同环比计算等均按照财年生效。

  * API数据源支持直连查询，能实时更新数据，适用于实时性要求高的小数据量场景。

* 可视化效果能力优化

  * 交叉表数据条展示逻辑进行优化，正负值线条长度会以相同标准进行计算。

  * 电子表格隐藏的网格线支持保存。

  * 仪表板图标更新优化。

* 查询控件相关能力增强

  * 支持日期查询控件的级联能力：日期选择来源于数据集字段时支持和其他下拉列表类控件级联\&多个日期之间可直接级联。

  * 卡片收藏至卡片看板时，可带入仪表板级、Tab级和组件级查询控件并支持修改。

* 开放平台

  * 开放平台场景解决方案输出，新增多租户数据安全隔离、企业资源集中化管控、自定义企业审批流、轻量化的增强嵌入、企业统一登录门户和报表密级管控等6个场景方案。

    **说明**

    多租户数据安全隔离、企业资源集中化管控、企业统一登录门户和报表密级管控仅独立部署支持，具体方案输出，请联系产品运营同学。
  * 支持通过访问控制，授予指定用户API调用权限。

  * 自定义组件添加demo组件流程优化，demo组件可在线调试。

  * 自定义菜单功能入口及注册流程优化。

  * 拆分报表嵌入统计和API调用统计页面，优化部分展示\&交互体验细节。

* 智能运维能力增强

  * 新增健康巡检功能，通过提供白屏化运维能力，了解组织内存在的风险及待优化事项，并提供合理建议，实现自助运维。

  * 统计分析能力优化，支持在资源分析和用户分析里下载操作类型对照表。

  * 为保证产品使用性能及系统稳定性，增加了部分使用规格限制。

* 协同办公体验优化

  * 推送渠道新增推送配置，钉钉和企业微信支持设置自定义链接打开方式为工作台、侧边栏、跳转浏览器或弹窗。

  * 受企微方面技术变更影响，在使用部分功能前需进行登录操作，具体影响模块已开设登录入口。

* 新增智能问数，即问即答，更智能（定邀测试中）

  * 快速问答，支持PC、手机、PAD端，随时随地了解数据。

  * 灵活展示，自由切换图表样式，全屏查阅，支持导出分享。

  * 透明验证，一键查看AI取数过程，确保数据准确性符合预期。

## 变更内容
* **数据源\&数据集能力拓展**

  * 支持在数据集内自定义配置业务财年，上层报表的数据展示、日期筛选、同环比计算等均按照财年生效。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9044372171/p789875.png)

    请参见[创建并管理数据集](https://help.aliyun.com/document_detail/61151.html)。
  * API数据源支持直连查询，能实时更新数据，适用于实时性要求高的小数据量场景。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9044372171/p789872.png)

    请参见[创建API数据源](https://help.aliyun.com/document_detail/409330.html)。
* **可视化效果能力优化**

  * 交叉表数据条展示逻辑进行优化，正负值线条长度会以相同标准进行计算。

    请参见[交叉表](https://help.aliyun.com/document_detail/200338.html)。
  * 电子表格隐藏的网格线支持保存。

    ![222.gif](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9044372171/p790126.gif)

    请参见[电子表格配置操作](https://help.aliyun.com/document_detail/101221.html)。
* **查询控件相关能力增强**

  * 支持日期查询控件的级联能力：日期选择来源于数据集字段时支持和其他下拉列表类控件级联\&多个日期之间可直接级联。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9044372171/p790127.png)

    请参见[配置条件级联](https://help.aliyun.com/document_detail/160352.html#6434197898peu)。
  * 卡片收藏至卡片看板时，可带入仪表板级、Tab级和组件级查询控件并支持修改。

    请参见[卡片看板](https://help.aliyun.com/document_detail/2594877.html)。
* **开放平台**

  * 开放平台场景解决方案输出，新增多租户数据安全隔离、企业资源集中化管控、自定义企业审批流、轻量化的增强嵌入、企业统一登录门户和报表密级管控等6个场景方案。

    想要了解各方案详情，可参见：<https://das.base.shuju.aliyun.com/openplatform/public/solutions>。  
    **说明**

    多租户数据安全隔离、企业资源集中化管控、企业统一登录门户和报表密级管控仅独立部署支持，具体方案输出，请联系产品运营同学。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4779507171/p805682.png)
  * 支持通过访问控制，授予指定用户API调用权限。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9044372171/p790130.png)

    请参见[访问控制](https://help.aliyun.com/document_detail/144990.html#87f1f96d3bw96)。
  * 自定义组件添加demo组件流程优化，demo组件可在线调试。

    请参见[管理自定义组件](https://help.aliyun.com/document_detail/413967.html)。
  * 自定义菜单功能入口及注册流程优化。

    请参见[基本概念](https://help.aliyun.com/document_detail/2743690.html)。
  * 拆分报表嵌入统计和API调用统计页面，优化部分展示\&交互体验细节。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9044372171/p790133.png)

    请参见[报表嵌入统计](https://help.aliyun.com/document_detail/2743711.html)、[API调用统计](https://help.aliyun.com/document_detail/151450.html)。
* **智能运维能力增强**

  * 新增健康巡检功能，通过提供白屏化运维能力，了解组织内存在的风险及待优化事项，并提供合理建议，实现自助运维。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9044372171/p790138.png)

    请参见[健康巡检](https://help.aliyun.com/document_detail/2742996.html)。
  * 统计分析能力优化，支持在资源分析和用户分析里下载操作类型对照表。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9044372171/p790140.png)

    请参见[资源分析](https://help.aliyun.com/document_detail/449526.html)、[用户分析](https://help.aliyun.com/document_detail/452192.html)。
  * 为保证产品使用性能及系统稳定性，增加了部分使用规格限制。

    请参见[规格明细](https://help.aliyun.com/document_detail/2624018.html)。
* **协同办公体验优化**

  * 推送渠道新增推送配置，钉钉和企业微信支持设置自定义链接打开方式为工作台、侧边栏、跳转浏览器或弹窗。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9044372171/p790141.png)

    请参见[管理推送渠道](https://help.aliyun.com/document_detail/390213.html#59e39d2e72x3m)。
  * 受企微方面技术变更影响，在使用部分功能前需进行登录操作，具体影响模块已开设登录入口。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9044372171/p790145.png)
* 新增智能问数，即问即答，更智能（定邀测试中）

  * 快速问答，支持PC、手机、PAD端，随时随地了解数据。

  * 灵活展示，自由切换图表样式，全屏查阅，支持导出分享。

  * 透明验证，一键查看AI取数过程，确保数据准确性符合预期。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6188367171/p808533.png)请参见[智能问数操作说明](https://help.aliyun.com/document_detail/2715112.html)。