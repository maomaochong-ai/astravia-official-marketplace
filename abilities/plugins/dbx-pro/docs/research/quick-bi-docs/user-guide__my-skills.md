技能是封装好的分析能力单元，您可以在对话中通过 "/ "指令等方式调用，实现特定场景的分析任务。本文将为您介绍如何查看并添加**我的技能**。  

## **功能入口**
登录 Quick BI AIPro，进入**我的** \>**我的技能**。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1920966871/p1094382.png)

## 内置技能
Quick BI AIPro支持以下内置技能，内置技能的卡片带有**系统内置**标记：
<table> <thead> <tr> <td> <p><b>技能名称</b></p> </td> <td> <p><b>说明</b></p> </td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td> <p><b>智能数据分析</b></p> </td> <td> <p>用自然语言对数据集、仪表板或者上传数据文件提问，快速获取数据洞察。</p> <ul> <li> <p><b>核心能力</b>：基于数据集数据或者仪表板数据，结合用户问题智能分析，给出分析结果。</p> </li> <li> <p><b>典型触发语句</b>：「这个月销售额同比增长多少」「帮我分析各区域业绩」。</p> </li> </ul> </td> </tr> <tr> <td> <p><b>可视化报表生成</b></p> </td> <td> <p>基于数据资产一键生成可视化报表。</p> <ul> <li> <p><b>核心能力</b>：一键生成含指标概览与维度拆解的完整报表。</p> </li> <li> <p><b>典型触发语句</b>：「帮我基于这个数据集生成报表」「一键生成仪表板」「 自动做一个可视化看板」。</p> </li> </ul> </td> </tr> <tr> <td> <p><b>定时任务管理</b></p> </td> <td> <p>周期性推送与自动化任务的定时调度。</p> <ul> <li> <p><b>核心能力</b>：定时任务创建与调度、任务暂停与移除。</p> </li> <li> <p><b>典型触发语句</b>：「针对以上分析生成报告并每天早上9点推送给我」。</p> </li> </ul> </td> </tr> <tr> <td> <p><b>自定义技能构建</b></p> </td> <td> <p>无需写代码、对话即可沉淀业务流程为可复用能力的自定义技能。</p> <ul> <li> <p><b>核心能力</b>：基于自然语言对话生成符合规范的 skill 配置。</p> </li> <li> <p><b>典型触发语句</b>：「把这套流程封装成 skill」「我想自定义一个新技能」。</p> </li> </ul> </td> </tr> <tr> <td> <p><b>PPT文稿生成</b></p> </td> <td> <p>一键生成结构清晰、风格统一可编辑 PPT 的演示文稿。</p> <ul> <li> <p><b>核心能力</b>：基于主题或大纲智能生成汇报内容、自动匹配模板与版式、输出可直接编辑的PPT文件。</p> </li> <li> <p><b>典型触发语句</b>：「帮我做一份 PPT」「根据这个大纲生成演示文稿」「一键生成汇报 PPT」。</p> </li> </ul> </td> </tr> <tr> <td> <p><b> 钉钉工作空间 </b></p> </td> <td> <p>连接并管理钉钉工作空间中的内容与协作资产，包括在线文档、AI表格、知识库、群聊、审批等。</p> <ul> <li> <p><b>核心能力</b>：在对话中通过自然语言指令，让AI直接在钉钉文档/表格中定位相关信息，或操作更新文档。</p> </li> <li> <p><b>典型触发语句</b>：「查一下'销售数据'表格中销售额Top3」「将本次分析内容更新到'月度销售分析报告'文档中」</p> </li> </ul> <div> <div> <i></i> </div> <div> <strong>说明 </strong> <p>首次使用需完成钉钉账号授权。<img></p> </div> </div> <p>如需解除授权，支持以下两种方式：</p> <ul> <li> <p><b>技能卡片</b>：在<b>我的技能</b>或<b>技能广场</b>的技能卡片上，单击<b>更多</b>图标后单击<b>解除授权</b>，登出后技能状态与未安装时保持一致。<img></p> </li> <li> <p><b>对话指令</b>：在对话中输入"退出钉钉登录""断开DWS""切换钉钉账号"等指令，即可解除当前钉钉账号的授权。</p> </li> </ul> </td> </tr> <tr> <td> <p><b>数据故事生成</b></p> </td> <td> <p>将复杂数据转化为图文并茂的动画解读，帮助您更直观地理解数据背后的含义。</p> <ul> <li> <p><b>核心能力</b>：基于对话中的数据或表格，自动拆解关键指标与维度，生成分步叙事的动画数据故事。</p> </li> <li> <p><b>典型触发语句</b>：「用数据故事带我看天猫vs抖音差异」「数据太多抓不住重点，挑关键的讲给我」「这份数据有点复杂，一步步带我看看重点」。</p> </li> </ul> </td> </tr> </tbody> </table>

内置技能由管理员在[技能管理](https://help.aliyun.com/document_detail/3045440.html)中统一维护。当某个内置技能被管理员下线，或您被移出该技能的可见范围后：

* 该技能的卡片将显示**已强制下线**且不可使用。

  ![我的技能：内置技能「系统内置」标记与「已强制下线」态](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4830849871/p1102208.png)
* 在对话中选择技能时，该技能不会再显示。

待管理员重新上线该技能或将您重新纳入可见范围后，技能恢复可用。

## 添加技能
单击**添加技能**图标，上传并创建技能。  
**说明**

仅支持 .zip（≤5MB）和 .md / .markdown（≤10MB）格式。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8287035871/p1088569.png)

## 查看技能
* 支持查看**全部** 、**我安装的** 、**我创建的**技能。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1920966871/p1094382.png)
  * **我安装的** ：在**技能广场**中安装的技能和内置技能。

  * **我创建的** ：在**我的技能** 及**对话**中创建的技能。

    ![我的技能中的技能卡片](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1920966871/p1094198.png)
* 支持输入**关键词搜索**我的技能。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8287035871/p1088571.png)
* 支持修改**排序**。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8287035871/p1088572.png)

## 管理技能
* 您可以在**我的技能**页面，对创建的技能进行以下操作。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8287035871/p1088573.png)
  <table> <thead> <tr> <td> <p><b>序号</b></p> </td> <td> <p><b>操作项</b></p> </td> <td> <p><b>说明</b></p> </td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td> <p><b>①</b></p> </td> <td> <p><b>开启技能</b></p> </td> <td> <p>开启后，该技能才可被正常调用。</p> </td> </tr> <tr> <td> <p><b>②</b></p> </td> <td> <p><b>添加到对话</b></p> </td> <td> <p>单击后自动勾选当前技能并跳转到新建任务页面。</p> <p><img></p> </td> </tr> <tr> <td> <p><b>③</b></p> </td> <td> <p><b>查看</b></p> </td> <td> <p>查看<b>技能详情</b>。</p> <p><img></p> </td> </tr> <tr> <td> <p><b>④</b></p> </td> <td> <p><b>编辑</b></p> </td> <td> <p>编辑当前技能的名称、描述等信息。</p> </td> </tr> <tr> <td> <p><b>⑤</b></p> </td> <td> <p><b>上架企业</b></p> </td> <td> <p>上架到<b>技能广场</b>，支持设置可见范围为<b>全员可见</b>或<b>指定可见</b>。</p> <div> <div> <i></i> </div> <div> <strong>说明 </strong> <p>仅管理员（即拥有AIPro集中管理权限的用户）才可以上架。</p> </div> </div> <p><img></p> <p>上架后，可以在<b>技能广场</b>查看该技能。</p> <p><img></p> </td> </tr> <tr> <td> <p><b>⑥</b></p> </td> <td> <p><b>删除</b></p> </td> <td> <p>在弹出的二次确认框中单击<b>删除</b>，删除后不可恢复。</p> <p><img></p> </td> </tr> </tbody> </table>
* 对**安装** 的技能，支持添加到对话、查看及卸载。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8287035871/p1088574.png)

* 对**内置技能**，仅支持添加到对话及查看。