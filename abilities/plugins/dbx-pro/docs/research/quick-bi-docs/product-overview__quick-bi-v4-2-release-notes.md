## 发布日期
2022年01月06日

## 重点升级概览
* 移动端所见即所得，自定义能力再升级，让移动端报表制作更流畅！
  * 移动端模式下，支持编辑报表内容、调整组件高度，所见即所得。
  * 允许切换不同手机型号，即时查看展示效果。
  * 模版支持移动端预览，可直接安装进行移动端模式编辑。
* 可视分析能力持续增强。
  * 地图全新推出自定义区域。
  * 交叉表新增字段快捷筛选、移动端联动+行列混布跳转等功能。
  * 指标看板支持并列展示。
  * 指标趋势图支持切换指标默认取值。
  * 线柱图优化坐标轴数值分布等。
* 多场景协同办公，提升数据消费效率。
  * 全新推出企业门户，企业可定制自己的BI首页。
  * 订阅打通企业微信，支持灵活定义电子表格发件内容，选择用户组、转让负责人等。
  * 审批流支持对接自定义OA，通过机器人渠道，权限审批即可一键集成到客户审批流（专业版）。
* 升级平台化管理架构，高效提升业务管控力。
  * 组织管理改版升级，包含组织管理、企业安全、办公协同、功能配置、智能运维5大模块。
  * 权限管控持续升级，集中授权支持按人管理；协同授权支持组织级别控制报表公开\&协同授权；一键开关审批流等。
* Quick引擎抽取加速支持关联数据集和任务失败报警。

## 变更内容
* 移动端
  * 模版支持移动端预览，可直接安装进行移动端模式编辑，请参见[模板市场](https://help.aliyun.com/document_detail/216047.html#task-2077843 "Quick BI模板市场提供最新的零售行业、通用行业以及Quick BI应用实践等模板示例，帮助您在创建报表时，根据业务需求选择并安装模板。")。 图 1. 移动端预览 ![移动端预览](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3133742461/p385810.png) 图 2. 移动端安装 ![移动端安装](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9886242461/p385812.png) 图 3. 移动端编辑 ![移动端编辑](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5961242461/p385819.png)
  * Quick BI支持搭建移动端报表。  
    支持移动端模式直接编辑报表内容\&调整组件高度，无需再切换到PC模式调整样式，所见即所得。 ![布局入口_4.2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3220531461/p379388.png)
    * 在画布上，收起或展开菜单栏、可以为当前图表添加查询控件，也可以复制、选中或删除组件。![画布上操作](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9218631461/p379616.png)
    * 拖拽调整图表组件高度。  
      选中目标组件后，可以拖拽组件底部，上下挪动调整组件高度。 ![调整宽度](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9136181461/p383070.gif)
    请参见[搭建移动端报表](https://help.aliyun.com/document_detail/303844.html#concept-2107020 "移动办公时，用户通过移动设备访问仪表板。Quick BI推出移动编辑模式，当PC端与移动端共用一张仪表板时，您可以在移动模式下直接编辑报表在移动端的样式，无需再切换到PC模式，所见即所得。本文为您介绍在如何搭建移动端报表。")。
  * 新交叉表在移动端新增联动能力，行列混布下支持跳转。 图 4. 移动端交叉表联动效果 ![联动](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5961242461/p386168.gif) 图 5. 移动端交叉表跳转效果 ![跳转](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5961242461/p386172.gif)
  * 饼图在移动端新增指标筛选能力。![指标筛选能力](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5961242461/p386204.png)
  * 支持PC配置的自定义背景填充和标题链接跳转以弹窗形式打开。 图 6. 自定义背景填充 ![自定义背景](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6961242461/p386203.gif) 图 7. 标题链接跳转以弹窗形式打开 ![弹窗](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6961242461/p386202.gif)
* 可视化
  * 地图增加自定义地理分区。  
    色彩地图和气泡地图支持自定义地理区域，可根据业务需求定制区域划分，满足多元业务分析诉求。 ![自定义分区](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9867042461/p385417.gif)请参见 [自定义地理分区](https://help.aliyun.com/document_detail/393351.html#task-2172326 "对于一些需要灵活划分业务大区的企业，原本系统默认地理分区已不能满足要求。Quick BI推出自定义地理分区，组织管理员可以在中国范围内基于省或者直辖市自定义地理区域，帮助您有效划分区域。本文为您介绍如何自定义设置地理分区并在地图中展示分区效果。")。
  * 新交叉表在编辑和预览模式下，增加快捷筛选能力。
    * 选中开启快捷过滤复选框，图表右上角会增加过滤字样。![过滤1图表更新-合4.2需求](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4133702461/p384460.png)
    * 在功能型配置中选择开启快捷过滤后，在预览状态下，您可以在交叉表上单击过滤下拉列表，对字段进行过滤。![更新图表-合4.2需求](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7986612461/p384603.png)  
      当需要同时过滤多个字段时，您可以在弹出的对话框中添加多个条件，完成字段过滤。 ![交叉表过滤](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7986612461/p385026.gif)  
      **说明** 在预览状态下筛选的过滤条件默认不保存，当页面关闭重新打开后，需要重新筛选或设置过滤条件。
  * 指标看板支持配置指标关系和多指标可并列展示形式。 图 8. 配置指标关系（不含维度） ![新增_4.2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5660052461/p386874.gif) 图 9. 配置指标关系（含维度） ![配置指标关系](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9867042461/p385413.gif) 图 10. 配置多指标展示形式 ![3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9867042461/p385414.gif) 请参见[指标看板](https://help.aliyun.com/document_detail/55685.html#concept-k5j-cr2-vdb "指标看板可以一目了然地展示数据或销售业绩状况，以方便您及时掌握现状，从而快速制定并实施应对措施。因此，指标看板是发现并解决问题的有效地方法之一。本文为您介绍如何为指标看板添加数据并配置样式。")。
  * 指标趋势图新增阶段性汇总数据，用于展示阶段汇总值。满足您趋势图看趋势，指标卡看汇总数据的需求。![指标趋势图](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3069052461/p386907.png)  
    指标默认取值为指标卡上的数值显示，以上图的 订单数量为例：
    * 若您选择最新日期数据，则指标卡的数值为最后一天（20121230）的数据。
    * 若您选择阶段性汇总数据，则指标卡的数值为区间（20121201\~20121230）汇总的数据。
    请参见[指标趋势图](https://help.aliyun.com/document_detail/126497.html#concept-1305704 "指标趋势图可以展示多个指标最新日期的数据或阶段汇总数据，以及指标在某一段时间内的变化趋势。本文为您介绍如何为指标趋势图添加数据并配置样式。")。
  * 词云图可以自定义调整字号大小，使得文字差异化区分更加明显。![词云图](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9867042461/p385749.gif)请参见[词云图](https://help.aliyun.com/document_detail/55279.html#concept-lnr-m3f-vdb "词云图由词汇组成类似云的彩色图形，用于展示大量文本数据。例如，制作用户画像，对用户进行聚类，实现精细化营销。本文为您介绍如何为词云图添加数据并配置样式。")。
  * 支持在图表上双击修改图表标题，提高编辑效率。![双击修改标题](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3204081461/p381883.gif)请参见[新建仪表板](https://help.aliyun.com/document_detail/65851.html#concept-tt5-2ny-5db "当您需要高效创建大量图表进行可视化分析时，推荐使用常规模式新建仪表板。本文主要为您介绍如何查看图表数据、设置图表功能、布局图表等操作。")。
  * 自定义背景填充背景图片时，支持上传自定义图片。![本地上传图片](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1766242461/p386470.png)  
    **说明**

    以下组件支持上传自定义图片至背景图片。
    * **控件**

      Tab、图片
    * **指标类**

      指标看板、指标趋势图、进度条、水波图、翻牌器
    * **趋势类**

      线图、面积图、堆积面积图、百分比堆叠面积图、组合图
    * **比较类**

      柱图、堆积柱状图、百分比堆积柱状图、条形图、堆积条形图、百分比堆积条形图、环形柱状图
* 办公协同
  * 新增企业门户页面，支持企业自定义BI首页。  
    面向企业定制属于自己的数据平台首页，可以通过设置业务类目的方式来有组织的划分报表业务域，或者指定某个数据门户、链接本文定制企业门户，满足用户定制门户的需求。 ![搭建PC端门户_4.2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0618832461/p384266.png)
    * Banner：用于推送重要的数据内容，常用于广告位投放等。  
      您可以添加3个Banner，单个Banner配置样式图如下。 ![配置banner样式](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0973512461/p384564.png)  
      您可以全局调整多个Banner标题对齐方式和Banner高度。 ![全局调整](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2823512461/p384567.png)
    * 常用产品：用于呈现推荐用户关注的门户，常用于放置组织管理员推荐用户重点查看的门户，例如大盘数据等。  
      **说明** 常用产品下添加的门户无个数限制，但为了应用展示效果，建议结合实际需要控制常用门户数量。
      ![常用产品](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2823512461/p384578.png)
    * 业务类目：用于设置在Quick BI首页的业务导航展示。  
      您可以自定义显示标题和展示样式。 图 11. 展示样式 ![](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1931802461/p384610.gif)
    * 页面页脚：可以添加图片LOGO和自定义页脚。![页脚](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3823512461/p384618.png)

    请参见 [定制PC端企业门户](https://help.aliyun.com/document_detail/393352.html#concept-mnz-jcy-ngb "面向企业定制属于自己的数据平台首页，可以通过设置业务类目的方式来有组织的划分报表业务域，或者指定某个数据门户、链接本文等，本文为您介绍如何定制PC端的企业门户。")。
  * 订阅升级
    * 发送内容为电子报表时，支持以Excel附件的形式发送给用户。![附件](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8867042461/p385405.png)
    * 订阅支持修改负责人。![转让](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8867042461/p385411.png)
    * 订阅支持配置用户组。![配置用户组](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9867042461/p385407.png)

    请参见[创建订阅任务](https://help.aliyun.com/document_detail/101302.html#task-2448819 "本文介绍如何创建订阅任务，并通过邮件、钉钉工作通知、钉钉群、企业微信等方式推送订阅任务。")。
  * 监控告警支持Hologres数据源。
  * 监控告警中，告警方式新增自定义渠道。![自定义渠道](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3835052461/p386897.png)请参见[配置监控告警](https://help.aliyun.com/document_detail/114219.html#task-2423365 "您可以在仪表板浏览或编辑页面中，添加监控规则并配置监控度量和告警规则。")。
* 平台管理
  * 升级权限
    * 集中授权-按人授权\&同步到其他人：支持为用户授予数据门户资源类型的编辑菜单权限；授予用户组查看和导出菜单的权限。![数据门户_4.2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1039341461/p380539.png)
      * 若该用户被授予编辑权限后，权限生效人员访问该目标资源并编辑该门户。![编辑](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8445824361/p333217.png)
      * 若该用户被授予导出（含查看）权限后，权限生效用户访问该目标资源时，可以导出该门户。![导出门户_4.2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9929341461/p380547.png)
      * 若该用户被授予查看权限后，权限生效用户可以访问目标资源时，可以查看该门户。![仅查看_4.2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0039341461/p380548.png)

      请参见[授予某用户数据门户权限](https://help.aliyun.com/document_detail/382337.html#section-6uu-w9n-z4s)。
    * 协同授权-全局配置
      * 新增组织级开关报表公开和协同授权，权限管理员一键开启和关闭所有空间的授权入口。![功能入口_4.2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6286251461/p380803.png)  
        选中 可公开和 可授权，则该工作空间下的 功能权限中，包含 作品可公开和 作品可授权选项。 ![工作空间](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6330612461/p385011.gif)
        请参见[设置数据内容报表权限](https://help.aliyun.com/document_detail/389613.html#section-pi5-scx-0x1)。
      * 支持组织级别一键权限配置，为指定成员或组织成员配置数据作品的默认授权范围。![授权范围](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7867042461/p385312.png)
        * 报表查看及导出：支持授予全部空间成员和仅报表Owner这两个默认值。  
          授予不同的默认值，用于控制在新建工作空间时，功能权限的 作品默认授权工作空间所有人可查看选项是否被选中。 ![配置结果](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6286251461/p381006.png)
        * 报表编辑：支持授予全部空间成员(除查看权限)和私密这两个默认值。  
          授予不同的默认值，用于控制在该工作空间下新创建的报表，协同授权中编辑属性权限的默认值。 ![协同授权_报表](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0895551461/p381294.png)
        * 数据集编辑：支持授予全部空间成员(仅开发者)和私密这两个默认值。  
          授予不同的默认值，用于控制在该工作空间下新创建的数据集， 协同授权中 编辑属性权限的默认值。 ![数据集_协同_4.2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0895551461/p381436.png)
        * 数据集使用：支持授予全部空间成员(除查看权限) 和指定成员这两个默认值。  
          授予不同的默认值，用于控制在该工作空间下新创建的数据集，协同授权中使用属性权限的默认值。 ![使用数据集_4.2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0895551461/p381502.png)
        * 数据源编辑：支持授予全部空间成员(仅开发者)和私密这两个默认值。  
          授予不同的默认值，用于控制在该工作空间下新创建的数据源， 协同授权中 编辑属性权限的默认值。 ![编辑数据源_4.2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0895551461/p381636.png)
        * 数据源使用：支持授予全部空间开发者和指定成员这两个默认值。  
          授予不同的默认值，用于控制在该工作空间下新创建的数据源，协同授权中使用属性权限的默认值。 ![使用数据源_4.2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0178551461/p381640.png)

        请参见[设置空间资源默认授权](https://help.aliyun.com/document_detail/389613.html#section-vww-v92-b1n)。
    * 协同授权-QBI平台内审批流
      * 权限审批全局设置，一键开启或关闭审批流；一键开启或关闭页面权限申请；以及指定默认审批人。![审批](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8867042461/p385350.png)  
        审批入口设置包含 报表页面申请和 列级权限申请。
        * 报表页面申请：用于设置该组织下的所有工作空间中的报表是否有申请权限的入口。  
          若您未选中 报表页面申请，则用户可以在报表列表中仅能看到报表清单，无法申请报表权限。 图 12. 无申请编辑的入口 ![2](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8410071461/p381662.png) 图 13. 无申请访问的入口 ![1](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8410071461/p381660.gif)
        * 列级权限申请：用于查看脱敏数据时，是否显示申请查看脱敏字段的入口。  
        选中 列级权限申请，以线图为例，效果如下。 ![包含](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8410071461/p381668.png)  
        默认审批人包含 报表所有者和 权限管理人。
        * 选择报表所有人，则提交的审批电子流默认走给报表Owner进行审批。
        * 选择权限管理人，则提交的审批电子流时，您可以选择权限管理人并提交权限申请。

        **说明** 默认审批人一般为 报表所有者，当需要修改作品数据的默认审批人时，组织管理员可以指定权限管理人为默认审批人。
        详情请参见[授权设置](https://help.aliyun.com/document_detail/389614.html#section-4n3-a4t-lgj)。
      * QBI平台内审批流，支持查看待我审批、审批历史，以及我的申请、申请历史4个角度查看审批流，以及一键批量审批或拒绝。![审批](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8867042461/p385395.gif)
    * 协同授权-审批对接自定义OA  
      对接自定义OA，通过 机器人渠道新建自定义OA渠道，支持权限审批一键集成到客户审批流。
      * 新建自定义OA渠道![审批](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0032871461/p381670.png)
      * 权限审批一键集成到客户审批流![配置](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8737171461/p381671.png)

      请参见 [自定义渠道](https://help.aliyun.com/document_detail/390197.html#task-2170666 "机器人渠道用于管理企业推送的各个渠道，方便与企业联系。为了多渠道为企业发送告警信息和审批通知，Quick BI新增推送消息的渠道，您可以根据需要配置接收消息的外部端口，测试连通后，推送消息将发送至您配置的外部端口中。本文为您介绍如何配置自定义渠道。")。
  * 组织管理界面重构，用户视觉体验更优。![结构变化](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9867042461/p385804.gif)  
    下图以添加用户为例，查看升级后的前后界面变化。 图 14. 升级前 ![添加用户](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8712760361/p300335.png)
    图 15. 优化后 ![添加用户_升级后](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9867042461/p385806.gif)