## 发布日期
2022年01月25日

## 重点升级概览
* 可视化组件\&控件升级
  * 富文本、LBS飞线地图、来源去向图等，样式配置均有能力升级。
  * 查询控件支持一键拖拽自动生成。
  * 移动端排行榜支持联动，整体图表图例效果升级。
* 仪表板发布效率提升工具，可快速设置样式。
* 即席分析提供更多个性化配置如合并单元格、取消总计等。
* 订阅性能优化提升；订阅电子表格支持PDF附件。
* Quick 引擎的抽取加速模式开放给高级版用户，支持SQL Server数据源。
* 全新推出安全增强的免登报表嵌入方案，链接、访问、看数等多场景一站式安全管控。

## 变更内容
* 可视化组件\&控件升级
  * 富文本新增全局置顶的能力。![富文本](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6708065461/p402511.gif)
  * LBS飞线地图中，新增自定义形状，支持自定义出发点或者到达点的图形形状。
  * 来源去向表中，在图表样式中新增可视化颜色配置，支持配置来源和去向线条的颜色。![来源去向表](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6708065461/p402506.png)
  * 拖拽字段并自动生成查询条件。  
    通过拖拽某个字段至查询控件，可以快捷生成查询条件。请参见 [新建查询控件](https://help.aliyun.com/document_detail/151455.html#task-2383818 "通过查询控件可以生成一个或多个查询条件，帮助您查询单个或多个图表中的数据，一个仪表板中可以添加多个查询控件，但只支持一个查询控件置顶。")。 ![自动拖拽](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8943105461/p403172.gif)
  * 移动端图例展示效果升级。![移动端图例](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6708065461/p402762.gif)
  * 移动端新增默认选中最多显示一行图例功能，您可以根据需要选择是否选中一行显示。![一行图例](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6708065461/p403074.gif)
  * 移动端排行榜支持联动。请参见[移动端展示](https://help.aliyun.com/document_detail/162915.html#concept-2482950 "本文为您介绍移动端界面及基本操作。")。
* 仪表板发布效率提升工具包
  * 批量样式设置 支持批量设置同一仪表板中图表的样式，同一样式操作更快捷、配置更高效。

    选中多个图表时，系统默认将相同配置项在样式中显示，您可以根据需要选择配置，效果图如下。 ![批量设置](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0826084461/p401168.gif)
  * 格式刷  
    通过格式刷快速将已有图表样式同步至其它图表上，高效编辑图表。
    * 刷新样式至相同图表![同类](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9296754461/p401070.gif)
    * 刷新样式至不同图表  
      源图表和目标图表有相同样式配置项时，可以刷新样式至新图表。 ![不同](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9296754461/p401093.gif)
  * 复用其他仪表板内组件  
    在同一工作空间下，支持复用其他仪表板的组件至当前仪表板，省时省力。 图 1. 复用单个组件 ![单个](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8296754461/p400717.gif) 图 2. 批量复用组件 ![批量](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8296754461/p400739.gif)
  * 使用快捷键高效制作仪表板。 选中目标组件，通过快捷键即可快速复制、粘贴和删除图表组件。

    不同操作系统下，快捷键有所差异。 <table> <caption></caption> <colgroup> <col> <col> <col> </colgroup> <thead> <tr> <th>快捷键</th> <th>Windows系统</th> <th>Mac系统</th> </tr> </thead> <tbody> <tr> <td>复制</td> <td>Ctrl+C</td> <td>Command（⌘）+C</td> </tr> <tr> <td>粘贴</td> <td>Ctrl+V</td> <td>Command（⌘）+V</td> </tr> <tr> <td>删除</td> <td>Backspace（←）</td> <td>Delete（⌫）</td> </tr> </tbody> </table>
  * 新建仪表板时，提示应用新模板。  
    **说明** 仅专业版支持该能力。
    ①：直接应用模板；②：进入模板市场获取更多模板。![新建仪表板提示](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1826084461/p401312.png)

  请参见[工具栏功能配置](https://help.aliyun.com/document_detail/352184.html#section-ycu-xi9-al2)。
* 即席分析
  * 在页面设置中支持合并单元格。  
    为了更清楚地展示数据分组情况，默认为合并单元格。但当您有查看明细数据等不需要合并单元格的情况时，可以在页面设置中取消勾选。 ![合并单元格](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7262294461/p402456.png)
    请参见[即席分析中的页面设置](https://help.aliyun.com/document_detail/410331.html#concept-2188172 "您可以在即席分析页面中，配置导出、合并单元格、显示总计等操作。")。
  * 在页面设置中新增显示总计。  
    为了方便地查看按照不同维度拆解的合计数据，默认每个维度为显示总计。您可以在功能导航条取消 [单个维度的总计](https://help.aliyun.com/document_detail/276071.html#section-b35-sj4-vhk)。若您想要快速取消页面上全部总计选项时，可以在 页面设置中，去勾选 显示总计。此时，整个页面中所有的总计均不显示，不仅仅针对某个维度。 ![显示总计](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9736065461/p408278.gif)
    请参见[即席分析中的页面设置](https://help.aliyun.com/document_detail/410331.html#concept-2188172 "您可以在即席分析页面中，配置导出、合并单元格、显示总计等操作。")。
* 订阅电子表格
  * 订阅内容为电子表格时，支持发送PDF附件，当内容较多时，您可以根据需要选择横向或纵向导出为PDF附件。![订阅](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5708065461/p400639.png)请参见[创建订阅任务](https://help.aliyun.com/document_detail/101302.html#task-2448819 "本文介绍如何创建订阅任务，并通过邮件、钉钉工作通知、钉钉群、企业微信、飞书等方式推送订阅任务。")。
  * 订阅任务中增加中止按钮，请参见[管理订阅任务](https://help.aliyun.com/document_detail/101326.html#concept-wfc-ylr-ggb "订阅任务创建完成后，您可以在订阅任务管理页面对订阅任务进行管理。")。![中止](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5708065461/p400483.png)
* Quick引擎
  * 抽取加速支持SQL Server数据源。
  * 抽取加速开放给高级版用户。
  * 抽取加速容量限制：
    * 高级版支持抽取加速容量2 GB。
    * 专业版抽取加速容量调整为10 GB。
  * 数据集查询结果缓存中，新增定时清除缓存功能。![清理缓存](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7708065461/p408049.png)

  请参见[配置Quick引擎](https://help.aliyun.com/document_detail/409908.html#task-2186693 "为了更好的优化数据集性能，Quick BI推出Quick引擎，Quick引擎支持直连模式、抽取加速、实时加速、查询缓存和维值加速5种计算模式，本文为您介绍如何配置Quick引擎。")。
* 嵌入分析  
  全新推出安全增强的免登报表嵌入方案，链接、访问、看数等多场景一站式安全管控。请参见 [报表嵌入数据权限控制和传参的安全增强方案](https://help.aliyun.com/document_detail/391291.html#task-2171649 "本文将为您介绍如何使用Ticket报表嵌入方案免登嵌入到第三方系统，同时可控制嵌入至第三方系统的Quick BI报表权限，以及如何通过票据管理有效防止链接被恶意分享数据泄露的问题。")。  
  **说明** 仅适用于专业版。
* 新增Spark SQL数据源。请参见[自建数据源Spark SQL](https://help.aliyun.com/document_detail/406444.html#task-2046445 "添加Spark SQL数据源用于连通Spark SQL数据库与Quick BI，连接成功后，您可以在Quick BI上进行数据的分析与展示。Quick BI支持以公网或阿里云VPC的方式连接Spark SQL数据库（3.0及以上版本），本文为您介绍如何添加Spark SQL自建数据源。")。