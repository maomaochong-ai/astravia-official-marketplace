## 发布日期
2020年08月25日

## 更新内容
* 升级移动端图表组件展示功能。  
  以下功能在PC端配置完成后，支持在移动端显示：
  * 优化指标趋势图视觉效果。
    * 主/副指标组合指标块默认显示横向居左，与指标对齐方式默认左对齐。移动端默认1行展示3个，信息展示更紧凑。支持自行配置1行最多展示1个或2个。![1](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7039538951/p146113.png)
    * 支持全屏展示。
    * 开启日期趋势图展示，每行最多展示由2个变成3个。支持滑动和平铺两种展示形式，滑动效果更流畅。![122](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8039538951/p146515.png)
    * 副指标的值只对指标趋势图最新的日期生效，滑动到其它日期时只展示主指标的值，副指标的值不显示。
    * 优化副指标和趋势线展示视觉效果，使得小趋势图在右侧时，趋势线更平滑。![4](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8039538951/p146784.png)

    移动端升级前后整体效果图对比。 <table> <caption></caption> <colgroup> <col> <col> <col> </colgroup> <thead> <tr> <th>升级前</th> <th>升级后（浅色版）</th> <th>升级后（深色版）</th> </tr> </thead> <tbody> <tr> <td><img></td> <td><img></td> <td><img></td> </tr> </tbody> </table>
  * 升级交叉表功能。
    * 表头支持排序。![2](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9039538951/p146866.png)
    * 优化分页展示视觉效果。 <table> <caption></caption> <colgroup> <col> <col> </colgroup> <thead> <tr> <th>优化前</th> <th>优化后</th> </tr> </thead> <tbody> <tr> <td><img></td> <td><img></td> </tr> </tbody> </table>
    * 支持参数跳转和外部链接。![6](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9039538951/p146797.png)

    优化后图表效果展示。 ![22](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9039538951/p146868.png)
  * 线柱图支持不显示图例。 涉及的仪表板组件为线图、柱形图、堆积柱形图、百分比堆积柱形图，条形图、堆积条形图、百分比堆积条形图，面积图、堆积面积图和百分比堆积面积图。

  * 气泡地图和色彩地图支持联动功能。
* Tab控件升级
  * 支持图表拖拽至和拖拽出Tab中。![11](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9039538951/p143876.png)
  * 自定义Tab标签页名称。![12](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0139538951/p143883.png)
  * 新增Tab标签页。![13](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0139538951/p143885.png)
  * 调整标签页位置。![17](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0139538951/p143886.png)
  * 复制当前Tab标签页。![14](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0139538951/p143887.png)
  * 支持Tab标题置顶。![8](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0139538951/p143856.png)
  * 支持设置Tab高度为自适应高度和手动设定。![7](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0139538951/p143840.png)
  * 支持设置Tab位置为居中显示。![1](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0139538951/p144004.png)
  * 复制或删除Tab控件。![1](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0139538951/p143923.png)

  详情请参见[Tab](https://help.aliyun.com/document_detail/111275.html#concept-nry-swb-dhb "通过添加Tab控件，您可以在仪表板中以标签页的形式展示多张图表。本文为您介绍如何创建并设置Tab控件。")。
* 优化进度条和环形图视觉效果。![1](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0139538951/p144016.png)

  详情请参见[进度条](https://help.aliyun.com/document_detail/68354.html#concept-fzz-3rf-vdb "本文为您介绍进度条的使用场景、配置样式和如何删除进度条。")。
* 进度条、环形图和水波图支持两种完成占比支持两种计算方式：
  * 完成占比=实际值/目标值\*100%
  * 完成占比=\[1-(实际值/目标值-1)\]\*100%  
    **说明** 仅当目标值为负数时，该计算方式才生效。且完成占比默认值为 \[1-(实际值/目标值-1)\]\*100%。

  详情请参见[进度条](https://help.aliyun.com/document_detail/68354.html#concept-fzz-3rf-vdb "本文为您介绍进度条的使用场景、配置样式和如何删除进度条。")。
* 升级饼图功能：
  * 优化视觉效果：![2](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0139538951/p144033.png)
  * 支持设置数据标签展示方式为智能显示和全量显示。

  详情请参见[饼图](https://help.aliyun.com/document_detail/55621.html#concept-gwq-4f2-vdb "本文为您介绍饼图应用场景、配置样式和如何删除饼图。")。
* 升级雷达图功能：
  * 在数据页签新增维度作为分支标签和度量作为分支标签。![1](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0139538951/p142979.png)![2](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0139538951/p142984.png)
  * 支持设置展示方式为多边形和圆形。![2](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1139538951/p143020.png)
  * 支持设置显示图表标签为智能显示图表标签。
  * 支持设置坐标轴最大值。![5](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1139538951/p143031.png)
  * 支持设置显示垂直轴标签。![6](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1139538951/p143034.png)
  * 高级选项中支持设置辅助线。![1](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1139538951/p144043.png)

  详情请参见[雷达图](https://help.aliyun.com/document_detail/55675.html#concept-xkk-b42-vdb "本文为您介绍雷达图的使用场景、配置样式和如何删除雷达图。")。
* 升级矩形树图功能：
  * 原矩阵树图更名为矩形树图。
  * 度量升级为默认降序展示，图表升级为从左上角到右下角依次减小展示。
  * 支持设置显示标签为百分比和度量。

  ![1](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1139538951/p144044.png)

  详情请参见[矩形树图](https://help.aliyun.com/document_detail/55690.html#concept-q2y-4gf-vdb "本章节为您介绍矩形树图的应用场景、配置样式和如何删除矩形树图。")。
* 升级玫瑰图功能：
  * 原极坐标图更名为玫瑰图。
  * 度量升级为默认降序展示。
  * 优化数据标签展示方式。

  ![2](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1139538951/p144052.png)

  详情请参见[玫瑰图](https://help.aliyun.com/document_detail/55192.html#concept-wby-whf-vdb "本文为您介绍玫瑰图的应用场景、配置样式和如何删除玫瑰图。")。
* 升级环形柱状图功能：
  * 标签优化：智能显示文字标签，避免文字重叠。
  * 下线渐变色功能。

  ![5](http://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1139538951/p144056.png)

## 下线图表
* 下线树图。 关闭树图新建和图表切换入口。线上已有的存量树图可以正常显示，但不能切换，右侧的图表无选中态。

* 下线LBS轨迹地图和LBS动态轨迹地图。 线上已有的存量不能正常显示，也不支持编辑。

**说明** 您在升级版本之前，请先评估影响，如果有影响请及时联系我们。