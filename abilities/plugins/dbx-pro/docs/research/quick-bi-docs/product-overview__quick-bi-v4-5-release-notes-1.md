<br />

## **发布日期**
2022年11月8日

## 重点升级概览
* **自助取数模块优化**

  * 支持导出csv格式。

  * 支出导出带部分格式。

  * 支持按指标筛选内容自由筛选。

  * 仪表板创建取数支持预览。

  * 数据面板/样式面板升级，支持浅色主题。

  <br />

* **体验优化**

  * 品牌色/主题色-新增\&微调。

  * 企业门户配成页面嵌入时支持隐藏左侧导航。

  * 列表页支持双击重命名。

  * 即席分析页面UI优化。

  <br />

* **数据分析能力升级**

  * 数据大屏图表优化，地图动效支持Tooltips轮播。

  * 数据大屏交互式分析能力增强，支持联动、钻取、跳转。

  * 查询控件相对时间新增T的时间粒度选择。

  * 仪表板跳转能力增强，携带的查询控件支持度量、参数和占位符。

  <br />

* **数据构建模块优化**

  * 数据准备支持PolarDB for MySQL 及 PolarDB for POSTGRE。

  * 数据准备（轻量ETL）数据源和数据集列表页增加入口，日期格式字段聚合结果类型优化。

  * 新增对于本地文件、clickhouse、ADB3.0、SQLServer数据源的特殊日期格式识别。

  * Quick引擎抽取加速支持按月周抽取。

## 变更内容
* **自助取数**

  * 自助取数支持导出纯数据Excel、带格式Excel和CSV。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1458827661/p510422.png)

    请参见[创建与管理下载任务](https://help.aliyun.com/document_detail/113019.html)。
  * 自助取数支持按指标筛选内容自由筛选。![1版本](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1458827661/p510435.gif)

    请参见[配置自助取数](https://help.aliyun.com/document_detail/460308.html)。
  * 仪表板创建取数支持预览。![2版本](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1458827661/p510447.gif)

    请参见[创建与管理下载任务](https://help.aliyun.com/document_detail/113019.html)。
* **品牌主题色系**调整。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7319637661/p511336.png)

  请参见[管理企业推荐主题](https://help.aliyun.com/document_detail/144981.html)。
* 企业门户配成**页面嵌入** 时支持**隐藏左侧导航**。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7319637661/p511343.png)

  请参见[通过页面嵌入定制企业门户](https://help.aliyun.com/document_detail/393352.html#section-tp9-efx-bwk)。
* 列表页支持名称双击进行**重命名**。

  ![列表页重命名](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7319637661/p511351.gif)

  请参见[重命名仪表板](https://help.aliyun.com/document_detail/65854.html#0b22aa5059lov)。
* 即席分析页面优化，实现度量排序。

  ![即席分析-度量列](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1929257661/p512237.gif)

  请参见[字段选择](https://help.aliyun.com/document_detail/276070.html#section-gk4-tec-j6l)。
* **数据大屏** 图表优化，**地图动效** 支持**Tooltips轮播**。

  ![气泡地图-tooltip2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7319637661/p511354.gif)

  请参见[色彩地图](https://help.aliyun.com/document_detail/446629.html)、[气泡地图](https://help.aliyun.com/document_detail/452004.html)、[符号地图](https://help.aliyun.com/document_detail/452005.html)、[飞线地图](https://help.aliyun.com/document_detail/452736.html)。
* **数据大屏** 交互式分析能力增强，支持**联动、钻取、跳转**。

  ![大屏联动效果图](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7319637661/p511356.gif)

  请参见[联动、钻取和跳转](https://help.aliyun.com/document_detail/461307.html)。
* **查询控件** 相对时间新增T的时间粒度选择。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0458827661/p510485.png)请参见[日期查询](https://help.aliyun.com/document_detail/151454.html)。

* **跳转** 携带的查询控件支持度量、参数和占位符。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1458827661/p510488.png)

  请参见[钻取、联动和跳转](https://help.aliyun.com/document_detail/90045.html)。
* **数据准备（轻量ETL）**

  * 新增从**数据源** 创建数据准备。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1458827661/p510457.png)

  * 新增从**数据集** 列表页创建数据准备。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0458827661/p510454.png)

    请参见[数据准备快速入门](https://help.aliyun.com/document_detail/408650.html)。
* **Quick引擎** 抽取加速支持按月周抽取。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0458827661/p510464.png)请参见[配置Quick引擎](https://help.aliyun.com/document_detail/409908.html)。