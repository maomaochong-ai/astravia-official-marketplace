## 发布日期
2020年09月22日

## 更新内容
* 新增数据源
  * 新增自建数据源GBase。请参见[自建数据源Gbase](https://help.aliyun.com/document_detail/184191.html#task-2492443)。
  * 新增云数据源PolarDB for PostgreSQL。请参见[云数据源PolarDB for PostgreSQL](https://help.aliyun.com/document_detail/184192.html#task-2492443)。
  * 优化应用数据源Dataphin。  
    schema参数由必填项变更为选填项。请参见 [创建应用数据源Dataphin](https://help.aliyun.com/document_detail/166152.html#task-2492443)。 ![添加数据源](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8083500061/p166094.png)
* 优化数据集
  * 支持图片类型的字段。请参见[编辑维度](https://help.aliyun.com/document_detail/169389.html#task-2509940)。
  * 新增使用授权功能，并给指定成员授权。请参见[管理数据集](https://help.aliyun.com/document_detail/103979.html#concept-f3p-lgr-ngb)。
* 升级仪表板
  * 新增Story Builder。请参见[Story Builder](https://help.aliyun.com/document_detail/184196.html#concept-t24-rwb-dhb)。![1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0904557261/p168579.png)
  * 新增标注功能。请参见[标注](https://help.aliyun.com/document_detail/184197.html#concept-1953472)。  
    涉及的仪表板组件为线图、柱形图、堆积柱形图、百分比堆积柱形图，条形图、堆积条形图、百分比堆积条形图、面积图、堆积面积图、百分比堆积面积图和组合图。 ![1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1914050061/p167256.png)
  * 气泡图和散点图支持动态播放轴。请参见[气泡图](https://help.aliyun.com/document_detail/118641.html#concept-265020)和[散点图](https://help.aliyun.com/document_detail/55680.html#concept-w3v-cp2-vdb)。![10](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1316140061/p167088.gif)![11](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5316140061/p167096.gif)
  * 排行榜新增辅助指标度量项，且支持添加3个度量。请参见[排行榜](https://help.aliyun.com/document_detail/126552.html#concept-1322592)。![1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3716140061/p113577.png)
  * 图表样式中新增条件格式。请参见[指标看板](https://help.aliyun.com/document_detail/55685.html#concept-k5j-cr2-vdb)。  
    涉及的仪表板组件为指标看板、指标趋势图、排行榜、翻牌器和富文本。 ![25](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2312150061/p168582.gif)
  * 交叉表和排行榜支持插入图片字段。![交叉表](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2312150061/p168585.png)![排行榜](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2312150061/p168584.png)
  * 指标卡趋势图样式变更。请参见[指标趋势图](https://help.aliyun.com/document_detail/126497.html#concept-1305704)。
    * 默认样式升级为指标深色块、趋势图彩色。
    * 指标卡带小趋势图的默认样式从单色变为彩色。
    * 支持自定义背景和图片，支持展示双Y轴，且高级分析支持跳转和自定义小指标。
    <table> <caption></caption> <colgroup> <col> <col> </colgroup> <thead> <tr> <th>升级前</th> <th>升级后</th> </tr> </thead> <tbody> <tr> <td><img></td> <td><img></td> </tr> </tbody> </table>
  * 升级文本框功能：更名文本框为富文本并支持添加数据。请参见[富文本](https://help.aliyun.com/document_detail/111273.html#concept-t24-rwb-dhb)。![21](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3540050061/p168537.gif)
* 升级波动分析功能。请参见[分析预警](https://help.aliyun.com/document_detail/114244.html#concept-183353)。![12](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7816140061/p167564.png)
* 升级仪表板控件
  * 下拉列表的查询方式为多选时，支持排除功能。请参见[新建查询控件](https://help.aliyun.com/document_detail/151455.html#task-2383818)。
  * 过滤器中查询方式为多选时，支持排除功能。请参见[字段过滤](https://help.aliyun.com/document_detail/65848.html#concept-bvw-phy-5db)。

  ![12](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2312150061/p168583.png)
* 升级联动钻取效果。
  * 支持同时设置联动和钻取功能。请参见[钻取和联动效果展示](https://help.aliyun.com/document_detail/184194.html#concept-arc-kmb-bfb)。
  * 优化联动视觉效果。
  * 联动图表支持通过单击![取消联动](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3312150061/p168588.png)图标，取消联动。![14](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3312150061/p168590.png)
  * 联动功能变更：由原来的单击两次联动生效，升级为单击相应位置联动才生效，且支持单击图表的空白区取消联动。
* 主题模板新增同一套主题色。请参见[主题设计](https://help.aliyun.com/document_detail/144964.html#concept-2337005)。![色系选择](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0706140061/p96376.png)
* 升级移动端的智能小Q。 支持单聊机器人和钉钉群机器人。

* 专业版新增9个API接口。请参见[API概览](https://help.aliyun.com/document_detail/179307.html#concept-1936579)。

## 下线功能
* 文本框：旧版文本框升级为新版富文本组件。  
  其中，旧版文本框以下功能下线：
  * 下线字体：保留线上已有的文本框配置，但不允许修改，只能删除。
  * 下线删除线，保留线上已有的文本框配置，但不允许修改，只能删除。