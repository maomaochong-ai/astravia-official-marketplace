<br />

## **发布日期**
2024年1月4日

## 重点升级概览
* 数据源能力提升

  * Starrocks、Apache Doris、ClickHouse、Alibaba PolarDB-X、Alibaba PolarDB for PostgreSQL、Alibaba PolarDB for Oracle等数据源支持上传文件功能。

  * Clickhouse数据源支持抽取加速和跨源关联。

  * impala数据源支持数据准备。

* 数据集功能优化

  * 自定义周（周开始时间）能力新增函数自动注册的功能。

* 数据填报能力升级

  * 支持深浅主题色系切换。

  * 复杂表格填报和数据填报新增Hologres数据源。

* 仪表板功能拓展

  * 交叉表和明细表，新增简约分页器模式。

  * 支持将已保存未发布的内容分享给他人预览验收。

  * 支持自定义配置"数据返回为空"时的提示信息。

  * 移动端支持将仪表板导出成图片并保存到本地。

* 查询控件功能升级

  * 支持单个报表级别配置「记住筛选条件」。

  * 新增活动对比控件支持区间对比。

  * 报表配置内新增「支持的手动输入值上限」配置 。

  * 查询条件设置中下拉列表来源于单个数据集模式下，动态函数新增「查询值字段第一项」的功能。

* 电子表格能力增强

  * 支持页面级和组件级数据集替换。

  * 支持深浅主题色系的切换。

* 订阅配置能力扩展

  * 创建订阅任务时内容选择为仪表板后，可实现组件级别的订阅方式。

  * 创建订阅任务时新增「自定义渠道」的接收方式。

  * 接收方式的配置优化，新增图片类型选择（默认选择JPEG）。

* 智能小Q（邀请测试中）

  * 对话交互引导：指令完成后增加"去调整"操作，方便调整效果。

  * 洞察：摘要后增加"参考图表"，点击高亮来源图表，方便溯源。

  * 美化：仪表板深色模式下，支持一键美化。

* 体验优化

  * 为提升数据安全管控，对数据准备的权限进行收拢和限制，数据准备输出到数据集要求用户必须拥有数据集创建权限。

  * 在删除资源或作品时，难以判断该资源是否被引用，现新增影响分析功能来提示您删除资源时的影响范围。

## 变更内容
* 数据源能力提升

  * Starrocks、Apache Doris、ClickHouse、Alibaba PolarDB-X、Alibaba PolarDB for PostgreSQL、Alibaba PolarDB for Oracle等数据源支持上传文件功能。

    请参见[数据源功能项列表](https://help.aliyun.com/document_detail/2642723.html)。
  * Clickhouse数据源支持抽取加速和跨源关联。

    请参见[配置Quick引擎](https://help.aliyun.com/document_detail/409908.html)、[构建模型](https://help.aliyun.com/document_detail/104002.html)。
  * impala数据源支持数据准备。

    请参见[数据准备快速入门](https://help.aliyun.com/document_detail/408650.html)。
* 数据集功能优化

  * 自定义周（周开始时间）能力新增函数自动注册的功能。

    ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5065743071/p750384.png)

    请参见[创建并管理数据集](https://help.aliyun.com/document_detail/61151.html)。
* 数据填报能力升级

  * 支持深浅主题色系切换。

    ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8351473071/p752128.png)

    请参见[深浅主题模式切换](https://help.aliyun.com/document_detail/106130.html#3dbbc9607e9g5)。
  * 复杂表格填报和数据填报新增Hologres数据源。

    请参见[复杂表格填报](https://help.aliyun.com/document_detail/2503231.html)、[数据填报](https://help.aliyun.com/document_detail/104514.html)。
* 仪表板功能拓展

  * 交叉表和明细表，新增简约分页器模式。

    ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8351473071/p751395.png)
  * 支持将已保存未发布的内容分享给他人预览验收。

    ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9242411071/p742463.png)

    请参见[配置图表工具栏区](https://help.aliyun.com/document_detail/609871.html)。
  * 支持自定义配置"数据返回为空"时的提示信息。

    请参见[主题设计](https://help.aliyun.com/document_detail/144964.html)。
  * 移动端支持将仪表板导出成图片并保存到本地。

    ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5396311071/p742402.png)

    请参见[新建仪表板](https://help.aliyun.com/document_detail/65851.html)。
* 查询控件功能升级

  * 支持单个报表级别配置「记住筛选条件」。

    ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8351473071/p752133.png)

    请参见[新建查询控件](https://help.aliyun.com/document_detail/151455.html)。
  * 新增活动对比控件支持区间筛选。

    ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8351473071/p752131.png)

    请参见[活动对比控件](https://help.aliyun.com/document_detail/464757.html)。
  * 报表配置内新增「支持的手动输入值上限」功能 。

    ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8351473071/p752130.png)

    请参见[报表配置](https://help.aliyun.com/document_detail/2252060.html)。
  * 查询条件设置中下拉列表来源于单个数据集模式下，动态函数新增「查询值字段第一项」的功能。

    ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8351473071/p752132.png)

    请参见[文本查询](https://help.aliyun.com/document_detail/151453.html)。
* 电子表格能力增强

  * 支持页面级和组件级数据集替换。

    请参见[替换数据集](https://help.aliyun.com/document_detail/2640111.html)。
  * 支持深浅主题色系的切换。

    ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8351473071/p752134.png)

    请参见[电子表格配置操作](https://help.aliyun.com/document_detail/101221.html#3fdf18c2a9xzl)。
* 订阅配置能力扩展

  * 创建订阅任务时内容选择为仪表板后，可实现组件级别的订阅方式。

    ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8351473071/p751408.png)
  * 创建订阅任务时新增「自定义渠道」的接收方式。

    ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8351473071/p751426.png)
  * 接收方式的配置优化，新增图片类型选择（默认选择JPEG）。

    ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8351473071/p751416.png)

  请参见[创建订阅任务](https://help.aliyun.com/document_detail/101302.html)。
* 智能小Q（邀请测试中）

  * 对话交互引导：指令完成后增加"去调整"操作，方便调整效果。

    ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8351473071/p751429.png)
  * 洞察：摘要后增加"参考图表"，点击高亮来源图表，方便溯源。

    ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8351473071/p751434.png)
  * 美化：仪表板深色模式下，支持一键美化。

* 体验优化

  * 为提升数据安全管控，对数据准备的权限进行收拢和限制，数据准备输出到数据集要求用户必须拥有数据集创建权限。

    请参见[数据准备快速入门](https://help.aliyun.com/document_detail/408650.html)。
  * 在删除资源或作品时，难以判断该资源是否被引用，现新增影响分析功能来提示您删除资源时的影响范围。

    ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8351473071/p751427.png)