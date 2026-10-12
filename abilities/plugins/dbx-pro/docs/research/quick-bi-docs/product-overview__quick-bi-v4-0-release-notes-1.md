## 发布日期
2021年07月13日

## 变更功能
* 仪表板能力持续提升 全新推出模版市场提供海量行业、功能级模版，一键应用降低分析配置门槛；可视化组件持续升级，让图表配置更加灵活。

* 新增即席分析模块 重磅推出即席分析，定位为千万级别规模数量级的0门槛数据探查及分析；面向一线业务人员，以表格形式提供拖拽式的表格分析能力，让懂业务的人自助实现数据分析。

* 移动端应用升级 推出企业微信无缝对接；提升移动端交互体验，类目分类可见范围灵活配置，实现千人千面的移动端看数体验。

* 数据建模配置全面提升 数据集交互体验全面提升，拖拽式所见即所得模式让您的数据建模体验如丝般顺滑；丰富数据源，新增Oceanbase、Kylin数据源，群空间支持文件上传，让数据对接更丰富、便捷。

* 权限管控安全升级 全面升级行列权限，数据行列权限配置精细化，并灵活适配各种权限场景，让数据管控更安全。

## 变更内容
* 仪表板
  * 全新推出模版市场（仅专业版支持）  
    新增模版市场，Quick BI团队提供海量行业、功能级模版，应用至企业组织；企业组织可以自定义企业模版，支持其他用户应用模版并进行自定义修改配置，一套分析模版快速复用至多业务场景。 ![模板市场](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1012336261/p294515.png)请参见 [模板市场](https://help.aliyun.com/document_detail/216047.html#task-2077843 "Quick BI模板市场提供最新的零售行业、通用行业以及Quick BI应用实践等模板示例，帮助您在创建报表时，根据业务需求选择并一键式应用模板。")。
  * 新增6套主题模版，并支持卡片背景、颜色吸色、卡片间距、渐变模式、标题字号等配置。  
    提高用户配置灵活度满足各业务方个性化视觉需求，新增更多酷炫模版降低配置门槛。 ![主题模板](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1012336261/p294516.png)
  * 丰富图表见解能力，支持动态条件、固定值区间。![动态固定值](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1012336261/p294520.png)
  * 饼图支持调整小数位数，支持指标筛选。![饼图](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2913326261/p294522.png)请参见[饼图](https://help.aliyun.com/document_detail/55621.html#concept-gwq-4f2-vdb "本文为您介绍饼图应用场景、配置样式和如何删除饼图。")。
  * 查询控件联合行级权限，默认值可按行级权限生效。  
    基于行级权限，生成查询控件默认值，让访问端用户免切换，体验更友好。 ![查询条件设置](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1012336261/p294523.png)请参见 [文本查询](https://help.aliyun.com/document_detail/151453.html#task-2384036 "查询控件支持查询文本字段，本文为您介绍如何设置一个文本查询控件，用于查询文本字段。")。
* 即席分析（仅专业版支持）  
  重磅推出全新功能即席分析，助力业务自助分析，请参见 [即席分析概述](https://help.aliyun.com/document_detail/276068.html#concept-2094517 "即席分析只适用于Quick BI专业版的群工作空间下，个人空间不支持。")。
  * 以表格形式展示，支持直接从数据面板内拖拽字段的维值生成表格。![即席分析表格](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1012336261/p294526.png)
  * 允许不同维度的拼装，组合形成分面，实现更多维的分析场景。![拼装](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1012336261/p294527.png)
  * 支持在表格区域内直接进行多种计算、排序、格式化等操作。![格式化操作](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1012336261/p294528.png)
  * 支持直接将维值拖入控件区生成筛选条件，无需负责的条件配置。![筛选条件](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1012336261/p294529.png)
* 移动端
  * 支持企业微信微应用配置，Quick BI移动端无缝集成至企业微信（仅支持专业版）。![微信接口授权](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1012336261/p294533.png)请参见[在企业微信中绑定Quick BI微应用](https://help.aliyun.com/document_detail/272544.html#task-2092089 "为帮助企业微信用户在移动端查看报表，您可以在企业微信中绑定Quick BI微应用。企业微信管理员添加自建微应用，并在Quick BI上绑定自建微应用后，该企业的员工通过Quick BI微应用，可以在企业微信移动端查看报表。本文为您介绍如何添加Quick BI微应用、配置企业微信账号并验证微应用。")。
  * 图表跳转整体优化，支持页面呼出。![页面呼出](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3913326261/p294534.png)
  * 支持类目目录可见范围配置。![类目设置](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2012336261/p294535.png)请参见[设置钉钉微应用的展示](https://help.aliyun.com/document_detail/104139.html#concept-mnz-jcy-ngb "Quick BI中创建的仪表板、电子表格和数据门户等数据需要在钉钉微应用展示时，组织管理员可以为目标数据设置类目，设置类目后的数据会在钉钉微应用中分类展示，方便您查看类目的内容。本文介绍如何创建类目、在类目中添加数据并为目标类目设置可见范围。")。
* 数据源和数据建模
  * 群空间支持文件上传。请参见[上传文件到群空间](https://help.aliyun.com/document_detail/168026.html#section-z3g-tbb-9am)。
  * 新增数据源OceanBase。请参见[概述](https://help.aliyun.com/document_detail/47483.html#concept-lpv-nxp-5db "通常情况下，IT人员或数据研发人员基于数据源来分析数据。目前Quick BI支持云数据源、自建数据源、文件数据源和应用数据源四类，本文为您介绍Quick BI支持的数据源详情。")。
  * 连接MaxCompute时，支持开启MaxCompute查询加速。

    MaxCompute的MCQA功能可以对中、小数据量查询作业进行加速优化，将执行时间为分钟级的查询作业缩减至秒级，同时完全兼容原MaxCompute的查询功能。
    ![新增查询加速](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7601236261/p294954.png)
  * 数据建模交互升级。  
    全面提升数据建模交互体验，拖拽所见即所得的模式让建模更易读、易配置。 ![交互升级](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2012336261/p294540.png)请参见 [创建并管理数据集](https://help.aliyun.com/document_detail/61151.html#task-ubg-gfr-5db "Quick BI中数据集是可视化分析的基础，您可以将需要分析的数据表创建为数据集，Quick BI支持可视化配置或自定义SQL方式创建数据集。")。
* 平台管控  
  行列权限配置升级  
  **说明** 该功能仅对新客户生效，老客户仍为老版行列权限，后续会支持新老版本的一键迁移（需管理员手工切换）。  
  支持多条件配置，灵活的适配组织权限场景，精细化的数据管控让数据更安全。 ![1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2012336261/p294542.png) ![2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2012336261/p294543.png)

## 下线功能
在创建数据集中，下线同步表结构。  
此时，当数据源修改了表结构，数据集不能自动同步，需要您手动调整。

* 源表新增字段：在右侧字段列表中勾选新增的字段。![新增字段](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8480676261/p296469.png)
* 源表删除字段：在右侧字段列表中清除失效字段。![失效字段](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8480676261/p296470.png)