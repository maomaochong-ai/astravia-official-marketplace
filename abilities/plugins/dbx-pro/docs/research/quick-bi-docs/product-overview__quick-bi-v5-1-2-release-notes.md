<br />

## 发布日期
2024年6月18日

## 重点升级概览
* **智能问数展示优化\&智能搭建启动售卖**

  * 智能问数支持识别并切换筛选条件。

  * 智能搭建公共云启动售卖，详情请联系 Quick BI 商务运营同学。

* **模板市场能力升级**

  * 企业内部模板可展示在模板市场中，便于企业内报表自运营。

  * 新建自定义模板时，增加「模板出品人」配置项，并最终在模板市场中展示出品人信息。

  * 全新推出"Quick BI模板共创计划"，企业用户与生态伙伴均可在申请后上架报表至官方模板市场或指定租户，享受专项福利。

* **仪表板\&电子表格条件格式能力全新升级**

  * 交叉表、电子表格度量字段置于行区域、维度字段处于列区域时，也可配置条件格式。

  * 支持基于其他字段的值配置本字段的条件规则，可利用计算字段配置复杂的条件规则（涉及交叉表、明细表、指标看板、指标趋势图、翻牌器、指标关系图）。

  * 支持为整行/整列快速配置背景色的条件规则（涉及交叉表、明细表、电子表格）。

  * 支持配置值为空/不为空时的条件规则。

  * 电子表格支持配置是否对汇总数据配置条件格式。

  * 电子表格自定义公式交互体验优化。

* **数据构建能力拓展**

  * 自建数据源StarRocks支持CLB负载均衡。

  * Dataphin数据源支持SSL、初始化SQL和HINT语句（仅JDBC连接方式）。

  * 加速引擎新增空间级别管控页面，支持批量管理空间内开启抽取加速的数据集。组织级别任务管控页面新增全局运行、失败列表。

* **图表\&仪表板配置能力增强**

  * 新增子弹图，用来展示数据与不同目标的对比结果或项目进展阶段。

  * 移动端新增布局锁功能，闭锁状态下移动端将自动同步PC端的组件布局，解锁状态下可以个性化调整移动端布局。

  * 交叉表、明细表、趋势分析表和多维分析表支持表格高度动态自适应，表格高度可根据表格内容自动调整。

  * 多维分析表格、趋势分析表的首列宽度，支持在移动端和PC端上分别配置。

  * 线图、面积图、组合图和指标趋势图的线条粗细支持调整。

  * 中国香港、中国澳门内部区域粒度匹配机制调整：中国香港、中国澳门境内的区县匹配为县粒度，中国香港、中国澳门匹配为省和市的粒度，与直辖市保持统一逻辑。

  * 图表设置联动时，搜索图表后支持在搜索结果内进行全选。

  * 支持跨仪表板复制tab。

* **电子表格公开能力增强**

  * 电子表格公开链接支持下载和自助取数（大数据量下）。

* **统计分析能力增强**

  * 访问类审计日志新增访问设备、访问来源字段；权限类审计日志的分享类型细分。

  * 新增报表级别统计分析，帮助您更好的了解您开发的作品在整个组织内的运作情况。

（用户访问日志中的访问设备信息，将从5.1.2版本开始记录）。

* **组织管理\&数据安全性提升**

  * 支持组织所有者解散或转让组织。

  * 支持设置组织级别的列级权限脱敏规则。

  * 订阅内容支持添加水印，数据安全性更有保障。

  * 自定义角色新增智能问数（含集中管理和问数）、智能搭建和工作空间管理功能权限管控。

* **性能诊断能力拓展**

  * 电子表格和数据大屏支持性能诊断。

* **开放平台**

  * 自定义组件、自定义菜单显示/隐藏的图标优化。

## 变更内容
* **智能问数展示优化\&智能搭建启动售卖**

  * 智能问数支持识别并切换筛选条件。

    ![1.gif](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8563068171/p809017.gif)

    请参见[智能问数操作说明](https://help.aliyun.com/document_detail/2715112.html)。
  * 智能搭建公共云启动售卖，详情请联系 Quick BI 商务运营同学。

    请参见[Quick BI计费方式](https://help.aliyun.com/document_detail/53282.html)。
* **模板市场能力升级**

  * 企业内部模板可展示在模板市场中，便于企业内报表自运营。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8563068171/p810894.png)

    请参见[上架自定义模板](https://help.aliyun.com/document_detail/2802996.html)。
  * 新建自定义模板时，增加「模板出品人」配置项，并最终在模板市场中展示出品人信息。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8563068171/p810916.png)

    请参见[新建自定义模板](https://help.aliyun.com/document_detail/2804590.html)。
  * 全新推出"Quick BI模板共创计划"，企业用户与生态伙伴均可在申请后上架报表至官方模板市场或指定租户，享受专项福利。

    请参见[模板共创计划](https://help.aliyun.com/document_detail/2802976.html)。
* **仪表板\&电子表格条件格式能力全新升级**

  * 交叉表、电子表格度量字段置于行区域、维度字段处于列区域时，也可配置条件格式。

    请参见[交叉表](https://help.aliyun.com/document_detail/200338.html)、[电子表格配置操作](https://help.aliyun.com/document_detail/101221.html)。
  * 支持基于其他字段的值配置本字段的条件规则，可利用计算字段配置复杂的条件规则（涉及交叉表、明细表、指标看板、指标趋势图、翻牌器、指标关系图）。

    请参见[交叉表](https://help.aliyun.com/document_detail/200338.html)、[明细表](https://help.aliyun.com/document_detail/473447.html)、[指标看板](https://help.aliyun.com/document_detail/55685.html)、[指标趋势图](https://help.aliyun.com/document_detail/126497.html)、[翻牌器](https://help.aliyun.com/document_detail/126957.html)、[指标关系图](https://help.aliyun.com/document_detail/468081.html)。
  * 支持为整行/整列快速配置背景色的条件规则（涉及交叉表、明细表、电子表格）。

    请参见[交叉表](https://help.aliyun.com/document_detail/200338.html)、[明细表](https://help.aliyun.com/document_detail/473447.html)、[电子表格配置操作](https://help.aliyun.com/document_detail/101221.html)。
  * 支持配置值为空/不为空时的条件规则。

  * 电子表格支持配置是否对汇总数据配置条件格式。

    请参见[电子表格配置操作](https://help.aliyun.com/document_detail/101221.html)。
  * 电子表格自定义公式交互体验优化。

    请参见[电子表格配置操作](https://help.aliyun.com/document_detail/101221.html)。
* **数据构建能力拓展**

  * 自建数据源StarRocks支持CLB负载均衡。

    请参见[阿里云数据源StarRocks](https://help.aliyun.com/document_detail/2584885.html)、[自建数据源StarRocks](https://help.aliyun.com/document_detail/468025.html)。
  * Dataphin数据源支持SSL、初始化SQL和HINT语句（仅JDBC连接方式）。

    请参见[创建应用数据源Dataphin](https://help.aliyun.com/document_detail/166152.html)。
  * 新增加速引擎组织级别和空间级别任务运行列表页，支持在列表页对数据集进行加速、重跑、终止任务等操作。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8563068171/p809137.png)

    请参见[配置Quick引擎](https://help.aliyun.com/document_detail/409908.html)。
* **图表\&仪表板配置能力增强**

  * 新增子弹图，用来展示数据与不同目标的对比结果或项目进展阶段。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8563068171/p805285.png)

    请参见[子弹图](https://help.aliyun.com/document_detail/2797492.html)。
  * 移动端新增布局锁功能，闭锁状态下移动端将自动同步PC端的组件布局，解锁状态下可以个性化调整移动端布局。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8563068171/p805909.png)

    请参见[搭建移动端报表](https://help.aliyun.com/document_detail/607405.html)、[移动端布局配置](https://help.aliyun.com/document_detail/609871.html#8d3996b078hen)。
  * 交叉表、明细表、趋势分析表和多维分析表支持表格高度动态自适应，表格高度可根据表格内容自动调整。

    请参见[交叉表](https://help.aliyun.com/document_detail/200338.html)、[明细表](https://help.aliyun.com/document_detail/473447.html)、[趋势分析表](https://help.aliyun.com/document_detail/330807.html)、[多维分析表](https://help.aliyun.com/document_detail/2673762.html)。
  * 多维分析表格、趋势分析表的首列宽度，支持在移动端和PC端上分别配置。

    请参见[趋势分析表](https://help.aliyun.com/document_detail/330807.html)、[多维分析表](https://help.aliyun.com/document_detail/2673762.html)。
  * 线图、面积图、组合图和指标趋势图的线条粗细支持调整。

    请参见[线图](https://help.aliyun.com/document_detail/55053.html)、[面积图](https://help.aliyun.com/document_detail/68315.html)、[组合图](https://help.aliyun.com/document_detail/113901.html)、[指标趋势图](https://help.aliyun.com/document_detail/126497.html)。
  * 中国香港、中国澳门内部区域粒度匹配机制调整：中国香港、中国澳门境内的区县匹配为县粒度，中国香港、中国澳门匹配为省和市的粒度，与直辖市保持统一逻辑。

    请参见[色彩地图](https://help.aliyun.com/document_detail/55653.html)、[气泡地图](https://help.aliyun.com/document_detail/55644.html)、[热力地图](https://help.aliyun.com/document_detail/71925.html)、[符号地图](https://help.aliyun.com/document_detail/202744.html)、[飞线地图](https://help.aliyun.com/document_detail/85229.html)。
  * 图表设置联动时，搜索图表后支持在搜索结果内进行全选。

    ![2.gif](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9563068171/p809022.gif)

    请参见[联动](https://help.aliyun.com/document_detail/468061.html)。
  * 支持跨仪表板复制tab。

* **电子表格公开能力增强**

  * 电子表格公开链接支持下载和自助取数（大数据量下）。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8563068171/p809033.png)

    请参见[导出配置](https://help.aliyun.com/document_detail/2252060.html#e64b027a83ttr)。
* **统计分析能力增强**

  * 访问类审计日志新增访问设备、访问来源字段；权限类审计日志的分享类型细分。

    请参见[资源分析](https://help.aliyun.com/document_detail/449526.html)、[用户分析](https://help.aliyun.com/document_detail/452192.html)。
  * 新增报表级别统计分析，帮助您更好的了解您开发的作品在整个组织内的运作情况。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8563068171/p809110.png)

    请参见[报表级资源分析](https://help.aliyun.com/document_detail/449526.html#66ba6e248f4g8)。

（用户访问日志中的访问设备信息，将从5.1.2版本开始记录）。

* **组织管理\&数据安全性提升**

  * 支持组织所有者解散或转让组织。

    请参见[修改组织信息](https://help.aliyun.com/document_detail/61487.html)。
  * 支持设置组织级别的列级权限脱敏规则。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9563068171/p809134.png)

    请参见[列级权限](https://help.aliyun.com/document_detail/2796842.html)。
  * 订阅内容支持添加水印，数据安全性更有保障。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8563068171/p809096.png)

    请参见[创建订阅任务](https://help.aliyun.com/document_detail/101302.html)。
  * 自定义角色新增智能问数（含集中管理和问数）、智能搭建和工作空间管理功能权限管控。

    请参见[角色管理](https://help.aliyun.com/document_detail/2399798.html)。
* **性能诊断能力拓展**

  * 电子表格和数据大屏支持性能诊断。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8563068171/p809135.png)

    请参见[性能诊断](https://help.aliyun.com/document_detail/2586353.html)。
* **开放平台**

  * 自定义组件、自定义菜单显示/隐藏的图标优化。

    请参见[显隐状态](https://help.aliyun.com/document_detail/411667.html#78e7fd60e558q)。