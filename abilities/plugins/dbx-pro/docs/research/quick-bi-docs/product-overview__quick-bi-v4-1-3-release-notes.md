## 发布日期
2021年12月16日

## 重点升级概览
* 可视化升级 Tab组件新增备注能力，线柱面系列图表、词云图、指标趋势图、地图等样式配置均有能力升级。

* 多端能力 支持自定义移动端微应用，包括底部导航栏和banner\&轮播消息，企业手机门户更加个性化。

* 权限管理 支持一键同步用户权限状态到其他新用户。

## 变更内容
* Tab组件的样式中，基础信息区域的备注支持富文本输入框样式。![tab](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3218680461/p378668.png)
* 词云图的高级选项中，新增跳转功能。![跳转功能](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3218680461/p378628.png)
* 线柱图允许取消所有图例选中状态。![图例](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3218680461/p378662.png)
* 升级指标趋势图的样式。  
  在 高级配置中开启副指标展示后，在 对比内容选择区域，新增以下样式：
  * 在自动计算页签，允许自定义小数位数。![指标趋势图](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6262470461/p371297.png)
  * 在新增字段页签，允许自定义小数位数和自定义副指标的前后缀。![前后缀](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9740680461/p378455.png)
* 在色彩地图和气泡地图的地图样式中，增加手动调整地图大小，用于解决缩放的地图比例无法保存的问题。![色彩地图_4.13](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4326474561/p448085.png)
* 即席分析中，新增查询控件。  
  支持将日期、文本和数值类型的字段拖拽生成查询条件，默认为下拉列表的样式。如果是日期字段，支持配置 日期选择。 ![即席分析_4.13](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2081500461/p371912.gif)
* 组织管理员支持配置移动端微应用，方便个性化定制移动端导航。![配置微应用4.13](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0891420461/p373596.png)请参见[配置移动端微应用导航](https://help.aliyun.com/document_detail/377548.html#concept-mnz-jcy-ngb "移动端底部导航栏默认包含首页、常用、数据和我的这四个导航，为了个性化地展示移动端报表，Quick BI推出自定义企业的微应用底部导航。组织管理员可以将长显报表信息配置在自定义导航中，也可以定制化推送重要数据内容。例如，在传统IT强管控的组织中，当IT部门上新了某个核心指标或者核心报表，希望能够快速通知到所有使用BI的人，可以添加主推报表组、图片banner组和轮播消息。本文介绍如何创建自定义导航、配置个性化导航样式等。")。  
  为了个性化地展示移动端报表，Quick BI推出自定义企业的微应用底部导航。组织管理员可以将长显报表信息配置在自定义导航中，也可以定制化推送重要数据内容。
  * 创建自定义企业的微应用底部导航。![创建自定义导航](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6262470461/p377347.gif)
  * 在常用导航中，添加主推报表组、图片banner组和轮播消息。![1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2105850461/p374427.png)
    * 图片banner组：用于推送重要的数据内容，常用于广告位投放等。  
      您可以在banner组配置多个图片banner，配置样式图如下。 ![卡片配置](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2317520461/p375209.png)配置效果示例如下。 ![配置效果图1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2317520461/p375239.gif)
    * 主推报表组：用于呈现推荐用户关注的报表，常用于放置组织管理员推荐用户重点查看的报表，例如大盘数据等。  
      **说明** 主推报表组下添加的报表无个数限制，但为了微应用展示效果，建议结合实际需要控制主推报表数量。
      ![主推报表](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3317520461/p375329.gif)
    * 轮播消息：用于设置重要消息提醒，常用于功能上新，提醒全员关注。![轮播消息](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3317520461/p375335.gif)
* 新建的计算字段也可以直接被引用再做二次计算，满足您复杂计算的场景。  
  例如， `利润金额 = 订单金额 - 成本金额`； `利润率 = 利润金额 / 订单金额`。 ![引用的计算字段_413](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3058750461/p377006.gif)
* 新增从用户的视角管控权限。  
  从用户、用户组两个粒度展示该用户在企业下所有对象权限状态，并可以一键同步权限到其他用户。 ![1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3633960461/p377434.gif)
  请参见[概述](https://help.aliyun.com/document_detail/383254.html#concept-2165656 "多个部门共用一个数据决策系统，权限管理员统一给部门员工分配指定权限。Quick BI支持从用户视角管理权限，从用户和用户组两个维度展示该用户在企业下所有工作空间的资源权限状态，以及一键同步权限到其他用户。")。

## 体验升级
* 支持拖拽智能机器人。![智能机器人](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7262470461/p372066.gif)
* 新增Quick引擎带参数的SQL数据集不支持加速的提示信息，使得界面交互更加友好。
  * 数据集包含占位符、参数、系统参数（Tag）时，不支持离线加速。![1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4386952461/p376188.png)
  * 数据集存在跨源查询时，不支持离线加速。![2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4386952461/p376190.png)