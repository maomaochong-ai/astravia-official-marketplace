本入门教程使用Quick BI专业版，通过Quick BI连接外部数据源，进行数据分析和报表搭建，为您展示如何快速上手Quick BI。  

## 入门概述
[Quick BI](https://bi.aliyun.com/home)是一款专为云上用户和企业量身打造的新一代自助式智能BI服务平台，其简单易用的可视化操作和灵活高效的多维分析能力，让精细化数据洞察为商业决策保驾护航。

为了帮助您更快地学习和上手产品，同时更好地感受智能报表在钉钉业务数据分析实践中的高效价值，下面将以一个真实的数据分析案例为场景带您开启智能报表产品之旅。

假设您是一家大型互联网新零售企业的数据分析师，您的经理刚刚拿到2019年8月份的月度运营分析数据，他发现近期企业运营状况不佳，8月份毛利额环比前几个月下滑较大，三季度毛利额存在不达标风险。

因此，需要您根据[订单信息](https://viapi-oss.oss-cn-shanghai.aliyuncs.com/doc/test/%E8%AE%A2%E5%8D%95%E4%BF%A1%E6%81%AF%E6%98%8E%E7%BB%86%E8%A1%A8.xlsx)和[流量渠道信息](https://viapi-oss.oss-cn-shanghai.aliyuncs.com/doc/test/%E6%B8%A0%E9%81%93%E4%BF%A1%E6%81%AF%E7%BB%B4%E5%BA%A6%E8%A1%A8.xlsx)等数据，分析企业8月份毛利额下滑的原因，并分享给团队，以便指导相关业务部门采取决策和行动，提高企业整体毛利额。

## 操作流程
通过Quick BI连接外部数据源，进行数据分析和报表搭建，主要分为以下步骤：

* [步骤一：连接数据源](#section-dnb-re8-qih)

  您可以连接您的数据源，进行练习并熟悉Quick BI。
* [步骤二：数据建模](#section-jad-v2v-tbl)

  连通数据源后，当需要分析的数据存储在不同的表，您可以通过数据关联，把多个表连接起来，形成模型进行数据分析。
* [步骤三：数据可视化分析](#section-gz9-wm2-ma8)

  您可以通过创建仪表板，添加不同的图表来展示数据，并通过联动进行数据可视化分析。
* [步骤四：发布共享](#section-of9-yo5-tvj)

  分析完成后，您可以将仪表板搭建成数据门户，并导出用于存档；若随着时间发展，数据又出现其他异常，您可以将仪表板分享给他人协同编辑。

![使用Quick BI](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0493742361/p325715.png)

## 报表效果
![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7479280761/p533651.png)

## 准备工作
1. 创建账号，以及完善账号信息。

   已注册阿里云账号，并完成实名认证。请参见[账号注册（PC端）](https://help.aliyun.com/document_detail/37195.html#topic-2149078)。
2. 开通Quick BI。

   已购买或申请免费试用Quick BI产品。请参见[一个月免费试用说明](https://help.aliyun.com/document_detail/60285.html#concept-q3x-cwc-5db)。
3. （可选）准备数据源。

   * 您可以在目标地域创建一个数据源。请参见[创建数据库数据源](https://help.aliyun.com/document_detail/467570.html)、[创建应用数据源Dataphin](https://help.aliyun.com/document_detail/166152.html#task-2492443)或[创建文件数据源](https://help.aliyun.com/document_detail/168026.html#task-2505852)。

   * 如果使用文件数据源，需要上传本地文件至Quick BI。本地文件样例请参见[渠道信息维度表](https://viapi-oss.oss-cn-shanghai.aliyuncs.com/doc/test/%E6%B8%A0%E9%81%93%E4%BF%A1%E6%81%AF%E7%BB%B4%E5%BA%A6%E8%A1%A8.xlsx)和[订单信息明细表](https://viapi-oss.oss-cn-shanghai.aliyuncs.com/doc/test/%E8%AE%A2%E5%8D%95%E4%BF%A1%E6%81%AF%E6%98%8E%E7%BB%86%E8%A1%A8.xlsx)。

4. 设置工作空间内作品的可操作权限。

   组织管理员设置该目标工作空间下**功能权限** 为**作品可公开** 和**作品可授权** 。请参见[新建并管理工作空间](https://help.aliyun.com/document_detail/61550.html#task-r4w-pbd-5db)。

## 步骤一：连接数据源
使用Quick BI产品进行数据分析和报表搭建之前，您需要先连接数据源。

1. 登录[Quick BI控制台](https://bi.aliyun.com)。

2. 在Quick BI控制台，按照下图指引，连接数据源。

3. 按照下图指引添加数据源

   1. 从[创建数据源入口](https://help.aliyun.com/document_detail/467570.html#91aa250072hcm)进入创建数据源界面。

   2. 选择MySQL数据源。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6943400761/p529370.png)

   3. 数据源类型选择阿里云。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5146750761/p532789.png)

4. 在**配置连接**对话框，您可以根据业务场景，完成以下配置。

   <table> <thead> <tr> <td><p><b>参数名</b></p></td> <td><p><b>描述</b></p></td> <td><p><b>示例</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>显示名称</b></p></td> <td><p>数据源配置列表的显示名称。</p><p>名称由汉字、数字、字母、下划线（_）或短划线（-）组合组成。</p></td> <td><p>Demo数据源</p></td> </tr> <tr> <td><p><b>数据库地址</b></p></td> <td><p>部署MySQL数据库的外网地址。</p></td> <td><p>rm-uf\*\*\*\*\*\*\*\*\*\*\*.mysql.rds.aliyuncs.com</p></td> </tr> <tr> <td><p><b>端口</b></p></td> <td><p>部署MySQL数据库外网地址对应的端口号。</p></td> <td><p>3306</p></td> </tr> <tr> <td><p><b>数据库</b></p></td> <td><p>部署MySQL数据库时自定义的数据库名称。 </p></td> <td><p>quickbi_\*\*\*</p></td> </tr> <tr> <td><p><b>用户名</b></p></td> <td><p>登录MySQL数据库的用户名。 </p></td> <td><p>quickbi_\*\*\*</p></td> </tr> <tr> <td><p><b>密码</b></p></td> <td><p>登录MySQL数据库的密码。</p></td> <td><p>quickbi_\*\*\*</p></td> </tr> <tr> <td><p><b>数据库版本</b></p></td> <td><p>选择数据库版本：</p> <ul> <li><p>选择<b>5.7</b>，表示兼容MySQL 5.7及以下版本。</p></li> <li><p>选择<b>8.0</b>，表示兼容MySQL 8.0版本。</p></li> </ul></td> <td><p>5.7</p></td> </tr> <tr> <td><p><b>VPC数据源</b></p></td> <td><p>如果使用阿里云VPC网络连接数据库，请选中<b>VPC数据源</b>选项并配置相关参数。</p></td> <td><p>不涉及</p></td> </tr> </tbody> </table>
5. 单击**连接测试**，进行数据源连通性测试。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6408954371/p891002.png)
6. 测试成功后，单击**确定**，完成数据源的添加。

   此时您可以在数据源列表中，看到**Demo数据源** ，表示数据源连接成功。![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3770599961/p737821.png)

## 步骤二：数据建模
连通数据源后，当需要分析的数据存储在不同的数据表，您可以通过数据关联，把多个数据表连接起来，形成模型进行数据分析。

1. 在**数据源** 页面，按照下图指引，选择目标数据表并创建数据集。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3770599961/p532811.png)

2. 在数据集编辑页面，按照下图指引，关联数据表。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8385400471/p912895.png)

3. 预览并保存数据集。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8385400471/p912898.png)

4. 在度量中新增毛利额和毛利率字段。

   按照下图指引，依次新增毛利额和毛利率字段。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2453792471/p925041.png)
   <table> <thead> <tr> <td><p><b>参数名</b></p></td> <td><p><b>描述</b></p></td> <td><p><b>示例</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>字段原名</b></p></td> <td><p>名称只能由中英文、数字及下划线、正斜线、反斜线、竖线、小括号、中括号组成，不超过50个字符。</p></td> <td> <ul> <li><p>毛利额的字段表达式为<code>SUM(\[销售额\])-SUM(\[成本额\])</code></p></li> <li><p>毛利率的字段表达式为<code>(SUM(\[销售额\]-\[成本额\]))/SUM(\[销售额\])</code></p></li> </ul></td> </tr> <tr> <td><p><b>字段表达式</b></p></td> <td><p>通过左方括号<code>\[</code>唤出列表来插入维度或度量字段名。</p></td> </tr> <tr> <td><p><b>数据类型</b></p></td> <td><p>支持的数据类型为<b>维度</b>和<b>度量</b>。</p></td> <td><p>度量</p></td> </tr> <tr> <td><p><b>字段类型</b></p></td> <td><p>支持字段类型为<b>文本</b>和<b>数值</b>类型。</p></td> <td><p>数值</p></td> </tr> <tr> <td><p><b>数值格式化</b></p></td> <td><p>支持以下数据格式展示：</p> <ul> <li><p>自动（即，保留数据默认格式）</p></li> <li><p>整数、保留1位或2位小数</p></li> <li><p>百分比、保留1位或2位百分比</p></li> <li><p>自定义或手动输入</p></li> </ul></td> <td><p>自动</p></td> </tr> <tr> <td><p><b>字段描述</b></p></td> <td><p>输入字段的描述。</p></td> <td><p>毛利额=销售额-成本额</p></td> </tr> </tbody> </table>
5. 目标字段添加成功后，单击**保存** 。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8385400471/p912903.png)

## 步骤三：数据可视化分析
您可以通过创建仪表板，添加不同的图表来展示数据，并通过联动进行数据可视化分析。

1. 在数据集编辑页面，在顶部导航栏选择**创建仪表板** 。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8385400471/p912905.png)

2. 创建指标趋势图，分析月度核心销售额、毛利额、毛利率。

   为了更好地展示各个月份销售额、毛利额、毛利率三个关键指标的走势数据，推荐您选择**指标趋势图**进行呈现。
   1. 按照下图指引，创建指标趋势图。![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3770599961/p737855.png)

   2. 在**样式** 页签下开启**副指标**，并配置指标内容及其样式。

      ![111](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8250043871/p1085824.gif)
      下表仅列出需要手动设置的参数项，其他参数项保持默认值即可。
      <table> <thead> <tr> <td><p><b>参数名</b></p></td> <td><p><b>描述</b></p></td> <td><p><b>示例</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>对比指标选择</b></p></td> <td><p>选择需要展示对比的指标。</p></td> <td><p>销售额</p></td> </tr> <tr> <td><p><b>副指标内容</b></p></td> <td><p>支持进行<b>副指标内容设置</b>，在条件格式里设置<b>快捷样式</b>。</p><p><img></p></td> <td><p>月环比</p></td> </tr> <tr> <td><p><b>配置同步至其他对比指标</b></p></td> <td><p>可以把当前指标的配置同步显示到其他指标。</p></td> <td><p>毛利额和毛利率</p></td> </tr> </tbody> </table>
3. 创建气泡图，分析渠道类别销售额和毛利数据。

   为了更好地展示不同渠道类别的销售额、毛利率、毛利额的数据，推荐您选择**气泡图**进行呈现。
   1. 按照下图指引，创建气泡图。![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0788300071/p737880.png)

   2. 按照下图操作设置过滤器，查看2019年8月的数据情况。![12122](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0788300071/p533690.gif)

      在**设置过滤器**对话框，字段日期（month）的参数示例如下。
      <table> <thead> <tr> <td><p><b>参数名</b></p></td> <td><p><b>描述</b></p></td> <td><p><b>示例</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>过滤方式</b></p></td> <td><p>支持<b>单月</b>和<b>月区间</b>。</p></td> <td><p>单月</p></td> </tr> <tr> <td><p><b>过滤条件</b></p></td> <td><p>支持选择<b>相对时间</b>和<b>精确时间</b>。</p></td> <td><p>精确时间</p></td> </tr> <tr> <td><p><b>日期</b></p></td> <td><p>支持自定义日期。</p></td> <td><p>2019-08</p></td> </tr> </tbody> </table>
   3. 在**样式** 页签，配置图表样式。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0788300071/p533691.png)

      下表仅列出需要手动设置的参数项，其他参数项保持默认值即可。
      <table> <thead> <tr> <td><p><b>配置项</b></p></td> <td><p><b>参数名</b></p></td> <td><p><b>示例</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>标题与卡片</b></p></td> <td><p><b>显示主标题</b></p></td> <td><p>选中<b>显示主标题</b></p></td> </tr> <tr> <td><p><b>标题</b></p></td> <td><p>渠道类别销售\&amp;毛利四象限图</p></td> </tr> <tr> <td><p><b>图例</b></p></td> <td><p><b>位置</b></p></td> <td><p>居右（<img>）</p></td> </tr> <tr> <td><p><b>绘图区域</b></p></td> <td><p><b>四象限</b></p></td> <td><p>选中<b>开启四象限</b></p></td> </tr> <tr> <td><p><b>象限名称</b></p></td> <td><p>设置如下：</p> <ul> <li><p><b>右上象限</b>：高毛利率高销售额</p></li> <li><p><b>左上象限</b>：低毛利率高销售额</p></li> <li><p><b>左下象限</b>：低毛利率低销售额</p></li> <li><p><b>右下象限</b>：高毛利率低销售</p></li> </ul></td> </tr> </tbody> </table>
4. 创建气泡图，分析渠道明细销售额和毛利数据。

   为了更好地展示各个渠道名称下的销售额、毛利率、毛利的详细数据，推荐您选择**气泡图**进行呈现。
   1. 按照下图指引，创建气泡图。

      为避免重复操作，本示例复制上述气泡图并替换字段渠道类型为渠道名称。![12123](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0788300071/p533698.gif)
   2. 在**样式** 页签，配置图表样式。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0788300071/p533699.png)

      下表仅列出需要手动设置的参数项，其他参数项保持默认值即可。
      <table> <thead> <tr> <td><p><b>配置项</b></p></td> <td><p><b>参数名</b></p></td> <td><p><b>示例</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>标题与卡片</b></p></td> <td><p><b>显示主标题</b></p></td> <td><p>选中<b>显示主标题</b></p></td> </tr> <tr> <td><p><b>标题</b></p></td> <td><p>渠道明细销售\&amp;毛利四象限图</p></td> </tr> </tbody> </table>
5. 联动分析2019年8月渠道明细毛利率数据。

   为了更好地分析各个渠道在2019年8月份的销售额和毛利率明细情况，推荐您配置指标趋势图到渠道类别销售\&毛利四象限图和渠道明细销售\&毛利四象限图的联动，用于查看各个渠道类别在2019年8月份的销售额和毛利率数据。
   1. 按照下图指引，配置图表联动。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5714512961/p539894.png)
   2. 在**图表联动配置** 对话框，按照下图指引，联动图表。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5714512961/p532918.png)

      联动配置完成后，单击指标趋势图中2019年8月的数据点，可以看到渠道类别销售\&毛利四象限图和渠道明细销售\&毛利四象限图中的数据已被过滤为2019年8月。![12124](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0788300071/p533703.gif)

   分析渠道类别销售\&毛利四象限图各个渠道类别在2019年8月份的销售额和毛利率数据后，发现免费渠道在高销售额低毛利率象限，属于异常区间，请继续执行下一步，分析异常受哪些渠道明细影响。
6. 分析2019年8月免费渠道下各个渠道名称的销售额和毛利率数据。

   配置渠道类别销售\&毛利四象限图到渠道明细销售\&毛利四象限图的联动，用于分析2019年8月免费渠道下各个渠道名称的销售额和毛利率数据。
   1. 按照下图指引，配置图表联动。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0788300071/p533709.png)

   2. 在**图表联动配置** 对话框，按照下图指引，联动图表。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0788300071/p533713.png)

      联动配置完成后，单击渠道类别销售\&毛利四象限图中免费渠道的数据点，可以看到渠道明细销售\&毛利四象限图中的数据，已被过滤为2019年8月份免费渠道下的数据。![12125](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0788300071/p533715.gif)分析渠道明细销售\&毛利四象限图各个渠道名称在2019年8月份的销售额和毛利率数据后，发现手淘卡券包在高销售额低毛利率象限，属于异常区间，最终导致毛利异常下降的原因。

**分析结论** ：经排查发现，由于某企业内部员工在 2019年8月集中大量利用内部优惠券，并通过**免费渠道手淘卡券包**进行空买空卖，套取利益，导致企业整体毛利额异常下滑。目前相关异常数据已移交给审计部门。次月后，企业经营恢复正常，销售额和毛利额等相关业绩再创新高。

## 步骤四：发布共享
分析完成后，您可以将仪表板搭建成数据门户，并导出用于存档；若随着时间发展，数据又出现其他异常，您可以将仪表板分享给他人协同编辑。

1. 按照下图指引，发布仪表板。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0788300071/p533720.png)

   **说明**

   第一次发布仪表板时，才会弹出**发布仪表板**对话框。
   <table> <thead> <tr> <td><p><b>参数</b></p></td> <td><p><b>描述</b></p></td> <td><p><b>示例</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>名称</b></p></td> <td><p>仪表板名称</p></td> <td><p>某零售电商毛利额异常下滑诊断分析报告</p></td> </tr> <tr> <td><p><b>位置</b></p></td> <td><p>仪表板存放位置</p></td> <td><p>根目录</p></td> </tr> <tr> <td><p><b>后续过程中开启自动保存</b></p></td> <td><p>勾选表示后续在仪表板编辑过程中会自动保存仪表板</p></td> <td><p>勾选开启</p></td> </tr> </tbody> </table>
2. 搭建数据门户。

   数据门户也叫数据产品，可以通过菜单形式将仪表板组织成复杂的带导航菜单，常用于专题类分析。您可以将创建好的仪表板集成到数据门户，并导出存档。
   1. 按照下图指引，创建数据门户。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0788300071/p532936.png)

   2. 按照下图指引，添加并设置门户菜单。![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0788300071/p737896.png)

      在**内容设置**区域，下面仅列出需要手动设置的参数项，其他参数项保持默认值即可。
      <table> <thead> <tr> <td><p><b>参数</b></p></td> <td><p><b>示例</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>菜单显示名称</b></p></td> <td><p>某零售电商毛利额异常下滑诊断分析报告</p></td> </tr> <tr> <td><p><b>内容设置</b></p></td> <td><p>选择<b>仪表板</b>，在搜索仪表板页面找到<b>某零售电商毛利额异常下滑诊断分析报告</b>。</p></td> </tr> </tbody> </table>
   3. 按照下图指引，保存数据门户。

      本例中，数据门户命名为**某零售电商毛利额异常下滑诊断分析报告** 。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0788300071/p533728.png)
3. 按照下图指引，导出数据门户。![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0788300071/p737905.png)

   <table> <thead> <tr> <td><p><b>参数</b></p></td> <td><p><b>示例</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>导出名称</b></p></td> <td><p>某零售电商毛利额异常下滑诊断分析报告</p></td> </tr> <tr> <td><p><b>文件格式</b></p></td> <td><p>选中<b>图片</b></p></td> </tr> <tr> <td><p><b>导出渠道</b></p></td> <td><p>选中<b>本地</b></p></td> </tr> </tbody> </table>
4. 共享仪表板。

   **说明**

   公开或分享仪表板前，请确保工作空间下 ，作品允许被公开和授权，请参见[新建并管理工作空间](https://help.aliyun.com/document_detail/61550.html#task-r4w-pbd-5db)。
   * 按照下图指引，公开或分享仪表板。![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0788300071/p737919.png)

     * **公开链接分享**下生成的链接可以被所有人访问，且无需登录阿里云账号。

     * **私密链接分享**下生成的链接可以被有权限的用户访问。

   * 按照下图指引，设置协同编辑仪表板。![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0788300071/p737924.png)

     请参见[授予数据作品权限](https://help.aliyun.com/document_detail/197502.html#concept-2013031)。