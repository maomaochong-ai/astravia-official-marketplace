## 发布日期
2022年03月04日

## 重点升级概览
* 可视化组件\&控件：
  * 饼图、线柱图等能力升级。
  * 查询控件支持展开收起。
  * 支持上传本地图片。
  * 移动端图表样式优化升级。
* 抽取加速开放给高级版用户。
* 监控告警、邮件订阅支持飞书。

## 变更内容
* 可视化组件\&控件升级
  * 在饼图的图表样式中，新增自定义总计名称。  
    **说明** 仅当选中 显示总计时，才需要自定义总计名称。
    ![饼图_4.2.2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8898536461/p409109.png)
  * 优化线柱面图的坐标轴最小值设置。  
    当度量值全部为正数时，支持在样式设置中手动设置最小值为其他数值，此时，坐标轴最小值以您手动设置的值为准。  
    **说明** 仅线图、柱图、条形图、面积图和组合图支持该功能。
    ![坐标轴](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8898536461/p409143.png)
  * 查询控件新增默认展开全部筛选条件按钮。  
    若单个控件中存在多个条件时，全部展示会使得控件框占用不少页面高度，影响视觉美观。您可以设置 默认展开全部筛选条件，可以展开收起查询控件，从而能动态调节控件框的高度。 ![查询控件](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9898536461/p409459.gif)请参见 [新建查询控件](https://help.aliyun.com/document_detail/151455.html#task-2383818 "通过查询控件可以生成一个或多个查询条件，帮助您查询单个或多个图表中的数据，一个仪表板中可以添加多个查询控件，但只支持一个查询控件置顶。")。
  * 自定义背景填充背景图片时，支持在自定义图片中上传本地图片。![上传本地图片](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3439306461/p409531.png)  
    **说明**  
    以下组件支持上传自定义图片至 背景图片。
    * **控件**

      Tab、图片
    * **指标类**

      指标看板、指标趋势图、进度条、水波图、翻牌器
    * **趋势类**

      线图、面积图、堆积面积图、百分比堆叠面积图、组合图
    * **比较类**

      柱图、堆积柱状图、百分比堆积柱状图、条形图、堆积条形图、百分比堆积条形图、环形柱状图
  * 移动端图表样式视觉效果升级。 <table> <caption></caption> <colgroup> <col> <col> <col> </colgroup> <thead> <tr> <th>图表</th> <th>升级前</th> <th>升级后</th> </tr> </thead> <tbody> <tr> <td>线图</td> <td><img></td> <td><img></td> </tr> <tr> <td>柱图</td> <td><img></td> <td><img></td> </tr> <tr> <td>面积图</td> <td><img></td> <td><img></td> </tr> <tr> <td>条形图</td> <td><img></td> <td><img></td> </tr> <tr> <td>指标看板</td> <td><img></td> <td><img></td> </tr> <tr> <td>指标趋势图</td> <td><img></td> <td><img></td> </tr> <tr> <td><img></td> <td><img></td> </tr> </tbody> </table>
  * 同环比功能升级。
    * 在同环比设置时，新增同期对比，实现月粒度的实际天数指标的对比，以满足不同业务场景的需求。![支持同期对比](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9898536461/p411081.png)  
      以下图为例，假设当前月份为2012-12，选择过滤区间为 `2012-12-01~2012-12-15`，查看订单数量的年同比。 ![同环比](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0182836461/p411101.png)
      * 若您选中同期对比，则对比时间周期为`2012-12-01~2012-12-15`同比于`2011-12-01~2011-12-15`。
      * 若您未选中同期对比，则对比时间周期为`2012-12-01~2012-12-15`同比于`2011-12-01~2011-12-31`。
    * 日粒度日期字段中，日期显示格式支持MM-DD。![展示格式](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0182836461/p411142.gif)
  * Quick引擎
    * 抽取加速开放给高级版用户，其中：
      * 免费赠送2 GB的抽取空间。
      * 单表抽取单表不超过100万行数据。
    * 抽取加速：支持配置小时级别数据抽取，调度时间配置更加灵活，数据可以快速更新。![离线加速](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9898536461/p409521.png)

    请参见[配置Quick引擎](https://help.aliyun.com/document_detail/409908.html#task-2186693 "为了更好的优化数据集性能，Quick BI推出Quick引擎，Quick引擎支持直连模式、抽取加速、实时加速、查询缓存和维值加速5种计算模式，本文为您介绍如何配置Quick引擎。")。
* 监控告警和订阅任务新增通知方式。  
  告警方式和订阅通知均支持以飞书通知和飞书群方式通知到用户。 ![监控告警](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9898536461/p409595.png)详情请参见 [配置监控告警](https://help.aliyun.com/document_detail/114219.html#task-2423365 "您可以在仪表板浏览或编辑页面中，添加监控规则并配置监控度量和告警规则。")和 [创建订阅任务](https://help.aliyun.com/document_detail/101302.html#task-2448819 "本文介绍如何创建订阅任务，并通过邮件、钉钉工作通知、钉钉群、企业微信、飞书等方式推送订阅任务。")。
* 嵌入分析ticket免登嵌入方案支持自定义控制token失效时间。