## 发布日期
2022年05月05日

## 重点升级概览
* 移动端：微应用整体优化，满足各企业更多自定义的场景需求。
  * 新增授权于我，帮助企业快速获取有权限报表数据。
  * 微应用数据类目新增了平铺布局，支持以更移动化的布局效果展示企业内的报表。
* 可视化
  * 指标拆解树、指标趋势图、词云图等能力升级。
  * 图表查看数据支持原始数据。
  * 查询控件排序字段选择后允许删除，日粒度快捷区间新增上个季度。
  * 新电子表格中，新增数据集跳转、支持PDF分页导出、支持分析模式。
  * 数据填报支持编辑锁功能，支持PolarDB数据源。
* 产品体验
  * 导航结构和列表优化升级。
  * 编辑抢锁机制优化。
  * 颜色选择器升级。
* 抽取加速支持Oracle数据源。
* 报表嵌入开通、嵌入配置URL生成实现产品化。

## 变更内容
* 移动端  
  微应用整体优化，满足各企业更多自定义的场景需求。
  * 新增授权于我，帮助企业快速获取有权限报表数据。![授权与我_4.3.2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6795514561/p442319.png)
  * 微应用数据类目新增了平铺布局，支持以更移动化的布局效果展示企业内的报表。![数据页面_4.3.2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3199833561/p442317.png)
  * 自定义微应用支持更灵活的Banner文字、主推报表组样式设置，能够上传企业个性化图片设置宣传内容。
  * 移动端TAB滚动效果优化。
  * 移动端查询控件支持排序字段、支持记住筛选条件。
* 可视化组件\&控件升级
  * 交叉表支持联动和钻取效果同时生效。![同时生效](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6795514561/p442101.png)
  * 新交叉表在非行列混布的场景下，配置了同比或环比后，分页下支持显示所有的环比或同比。![同环比](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6795514561/p442119.png)
  * 查询控件中，新增日期粒度切换，帮助您快速在一个仪表板页面中查看不同时间视角的数据信息。  
    例如，原先可能需要用多个仪表板或者用几个Tab来区分不同时间粒度，现在只需要一个控件即可。 ![切换粒度_4.3.1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3508674561/p447978.png)
* 监控告警优化。  
  支持配置数据的保留小数位数。 ![配置小数位](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6795514561/p446488.png)
* 权限升级优化
  * 资源到人交互优化。
    * 添加权限点筛选选项，且优化搜索添加体验，平衡性能，交互更明确。 图 1. 用户 ![用户](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6795514561/p444849.png) 图 2. 用户组 ![用户组](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6795514561/p444832.png)
  * 未授权时，默认空态统一。 图 3. 按资源授权时未授权样例 ![资源授权](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6795514561/p446510.png) 图 4. 按用户授权时未授权样例 ![用户授权](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6795514561/p446511.png) 图 5. 单资源授权时未授权样例 ![资源作品授权](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6795514561/p446512.png)
  * 资源集中：行列权限优化，支持日期类型。
    * 列级权限支持批量配置字段。![批量选择字段](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6795514561/p444802.png)
    * 列级权限支持配置日期粒度字段。![日期粒度](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6795514561/p444810.png)  
      **说明** 显示范围：仅支持电子表格、指标看板展示。
    * 行级权限支持手动输入添加关键字段。![手动输入](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6795514561/p444821.png)
* Quick引擎  
  自定义SQL创建的数据集支持抽取加速功能。 ![抽取加速](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3508674561/p446555.png)
* 开放集成
  * 新增开放API功能，产品化的交互帮助开发者一键调试应用API，提升系统集成的效率。![开放API](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6795514561/p446424.png)
  * 嵌入分析功能增强，全局参数支持查询控件默认传参。请参见[报表嵌入数据权限控制和传参的安全增强方案](https://help.aliyun.com/document_detail/391291.html#task-2171649 "本文将为您介绍如何使用Ticket报表嵌入方案免登嵌入到第三方系统，同时可控制嵌入至第三方系统的Quick BI报表权限，以及如何通过票据管理有效防止链接被恶意分享数据泄露的问题。")。