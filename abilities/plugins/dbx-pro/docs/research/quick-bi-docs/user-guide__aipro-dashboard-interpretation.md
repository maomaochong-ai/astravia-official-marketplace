仪表板AIPro支持用自然语言描述分析需求，AI 将自动完成数据查询、计算分析，并返回结构化的分析结果，支持多轮追问、作品输出、一键订阅等能力。本文将为您介绍如何在仪表板中使用 AIPro。  

## **应用场景**
仪表板是报表消费的核心场景。 AIPro基于当前仪表板的数据进行分析，帮助您：

* 一句话生成可汇报的文档报告。

* 对报表数据进行总结，形成包含指标异动与归因分析的摘要。

* 识别报表中的异常指标并给出归因分析。

* 基于上一轮结果层层追问，获得更深入的数据洞察。

## 使用限制
* 仅 Quick BI AIPro 版本（含已开通 AIPro 试用的组织）支持仪表板AIPro。

* 在**嵌入场景**中，仪表板AIPro不支持以下功能：

  * **订阅任务**。

  * 分析产物的**编辑** 和**保存**。

  * **选择数据**。

  * 跳转至**Quick BI AIPro**界面 。

  * 对话流的会话**分享**功能。

## 前提条件
* 已开通 Quick BI AIPro 版本或 AIPro 试用。

* 已获得 AIPro 的**基础功能**权限。

* **报表配置** 中的查看态功能已勾选**AIPro**。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101131.png)
* 已具有目标仪表板的查看权限并且该仪表板已**启用AIPro**。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101135.png)

## 操作步骤
### 功能入口

在仪表板预览页，单击**AIPro** 图标进入仪表板**AIPro**界面。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101436.png)

### 选择提问模式

单击对话框右下角的模型选择器，可以选择本次分析使用的提问模式。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101529.png)

您可以根据不同的使用场景选择不同的提问模式，两种提问模式的**适用场景** 和**可用能力**范围如下：
<table> <thead> <tr> <td><p><b>提问模式</b></p></td> <td><p><b>适用场景</b></p></td> <td><p><b>可用能力</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p>标准</p></td> <td><p>需要组合模型、技能与外部工具完成报告生成、跨系统取数、趋势归因等复合任务。</p></td> <td><p>可自行选择大模型，技能、MCP 连接器和联网检索均可使用。</p></td> </tr> <tr> <td><p>极速</p></td> <td><p>面向基于已有数据资产的快速取数问答。</p></td> <td><p>由系统托管大模型，仅支持数据问答；技能、MCP 连接器和联网检索不可用。</p></td> </tr> </tbody> </table>

### 选择数据

**说明**

选择数据并非必须步骤，默认对当前仪表板上的数据进行解读分析。若用户需要结合其他数据进行洞察分析，可以手动选择其他相关数据。

您可以按照以下操作选择您所要分析的数据资产。

* 单击对话框左下角的![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0961204871/p1086089.png)图标，选择您的数据资产。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101438.png)

  您也可以直接在对话框里输入"@"符号，选择所需使用的数据资产。
* 若您需要上传本地文件进行分析，可以单击从**本地文件添加**，也可以将本地文件直接拖拽到对话框中进行添加。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101439.png)您也可以单击**去企业广场添加** 跳转至[数据广场](https://help.aliyun.com/document_detail/3045433.html)界面添加所需数据。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101440.png)
* 

### 选择拓展能力

#### **选择技能**

* 单击对话框左下角的![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0961204871/p1086096.png)图标，按照下图步骤选择需要使用的技能。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101451.png)

* 您也可以直接在对话框里输入"/"符号，选择所需技能。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101452.png)

* 若您需要添加新的技能，您可以单击**从本地文件添加** 或**去企业广场添加** 跳转至相应界面进行操作。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101455.png)

#### **选择连接器**

* 单击对话框左下角的![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0961204871/p1086096.png)图标，按照下图步骤选择需要使用的连接器。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101454.png)

* 您也可以直接在对话框里输入"/"符号，选择所需连接器。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101457.png)

* 若您需要添加新的连接器，您可以单击**添加连接器** 或**去企业广场添加** 跳转至相应界面进行操作。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101458.png)

### 联网搜索

单击对话框左下角的![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088339.png)图标，可开启联网搜索。开启后，支持通过URL访问互联网，进行搜索并分析内容。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101459.png)  
**说明**

仅公共云环境支持联网搜索，独立部署环境暂不支持。

### 提问和回答

仪表板AIPro可以通过对话意图识别，将您在对话中输入的自然语言自动映射到相应的下游操作（如"数据查询""可视化""诊断""生成报告"或"创建定时任务"），根据提问内容的不同，系统可返回相应的分析结果，如文档报告、可视化报表、HTML报告、PPT文档、生成技能等，具体请参见[获取分析结果](https://help.aliyun.com/document_detail/3045431.html#f0b796fe13oiw)。  
**说明**

此处仅描述提问和回答的操作步骤。

1. 您可以在输入框中用自然语言输入您的分析问题，例如："上月各区域销售额同比变化情况"。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101461.png)

   支持单击![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5631204871/p1086110.png)图标进行**语音输入**。  
   **说明**

   仅公共云环境支持语音输入，独立部署环境暂不支持。

   支持单击![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5631204871/p1086111.png)图标进行**实时对话**。  
   **说明**

   仅公共云环境支持实时对话，独立部署环境暂不支持。
2. 输入问题后，您可以按**Enter** 键或单击**发送**按钮，等待 AI 返回分析结果。

   支持在返回过程中**停止生成**。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101462.png)
3. 返回结果。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101463.png)
4. 支持**多轮追问**。

   您可以根据需要，继续在输入框中以自然语言继续提出分析相关的问题。系统将结合上下文，持续为您提供连贯、准确的解答，助您深入探索所需信息。

### 结果查看及操作

* 支持**智能生成图表**。

  将鼠标移动至分析结果上，并单击![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9861204871/p1086935.png)图标生成图表。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101465.png)

  生成后，支持进行图表切换。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101466.png)
* 在查看数据的同时，还支持以下功能。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101471.png)  
  **说明**

  仪表板AIPro界面暂不支持**转为文档** ，如需操作，可单击右上角![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101485.png)图标前往**Quick BI AIPro**界面进行处理。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101483.png)
  <table> <thead> <tr> <td><p><b>序号</b></p></td> <td><p><b>功能项</b></p></td> <td><p><b>说明</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>①</b></p></td> <td><p><b>点赞点踩</b></p></td> <td><p>单击<img>进行点赞，单击<img>进行点踩，点踩时支持填写反馈建议。</p><p><img></p></td> </tr> <tr> <td><p><b>②</b></p></td> <td><p><b>复制</b></p></td> <td><p>复制分析结果的内容。</p></td> </tr> <tr> <td><p><b>③</b></p></td> <td><p><b>分享</b></p></td> <td><p>单击<img>图标后，您可以选择单个或多个对话进行分享。支持<b>私密链接</b>和<b>公开链接</b>分享。</p><p><img></p> <ul> <li><p><b>私密链接</b>：仅系统内登录用户可通过链接查看对话内容（包括对话中的数据作品）。</p></li> <li><p><b>公开链接</b>：任何人通过链接均可查看，无需登录。</p></li> </ul><p>打开对话分享链接后，打开链接后，您可以查看对话中的数据作品（如仪表板、HTML 报告等）。</p> <div> <div> <i></i> </div> <div> <strong>说明 </strong> <p>通过分享链接打开的数据作品仅支持查看，不支持<b>编辑</b>、<b>去往我的分析</b>、<b>版本记录</b>等操作。</p> </div> </div></td> </tr> <tr> <td><p><b>④</b></p></td> <td><p><b>取数过程</b></p></td> <td><p>支持查看取数过程，检验取数结果是否符合您的需求。</p> <div> <div> <i></i> </div> <div> <strong>说明 </strong> <p>仅当问题返回结果中实际执行了取数操作时，才会显示相关取数信息。</p> </div> </div><p><img></p></td> </tr> <tr> <td><p><b>⑤</b></p></td> <td><p><b>复制Trace_ID</b></p></td> <td><p>支持复制Trace_ID，可辅助售后排查问题。</p></td> </tr> <tr> <td><p><b>⑥</b></p></td> <td><p><b>删除</b></p></td> <td><p>单击<b>删除</b>按钮，删除本次对话消息，包括问题和回复。</p><p><img></p></td> </tr> </tbody> </table>

## 会话管理
### 新建会话

单击![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101495.png)图标可进入新的会话界面。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101492.png)

### 查看历史会话

在 AIPro面板中单击![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101496.png)图标可查看**历史会话**。  
**说明**

* **仪表板AIPro** 中的对话记录会同步到**Quick BI AIPro**的会话列表中。

* **Quick BI AIPro**

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101494.png)

在历史会话列表中，可对会话执行以下操作：

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101497.png)

* **重命名**：修改会话名称。

* **置顶**：将会话固定在列表顶部。

* **删除**：删除该会话。

## 订阅任务
仪表板AIPro支持创建和管理定义任务。您可以为当前仪表板创建定时任务，按周期自动执行分析并推送结果。

### 查看和管理定时任务

1. 单击右上角![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101501.png)图标，打开**订阅任务**面板。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101498.png)
2. 在**订阅任务**列表中查看当前仪表板的任务。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101502.png)
3. 支持对目标任务进行以下操作：

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101508.png)
   <table> <thead> <tr> <td><p><b>配置项</b></p></td> <td><p><b>说明</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>① 开启</b> / <b>关闭</b></p></td> <td><p>控制任务是否运行。</p></td> </tr> <tr> <td><p><b>② 设置</b></p></td> <td><p>单击后进入编辑面板，修改任务配置。</p></td> </tr> <tr> <td><p><b>③ 立即执行</b></p></td> <td><p>立即执行当前订阅任务。</p></td> </tr> <tr> <td><p><b>④ 执行记录</b></p></td> <td><p>查看当前任务的执行记录。</p></td> </tr> <tr> <td><p><b>⑤ 删除</b></p></td> <td><p>点击<b>删除</b>并在弹出的二次确认框中单击<b>确认</b>后，删除当前订阅任务。</p></td> </tr> </tbody> </table>
4. 点击目标订阅任务可进入编辑界面。

   您可以根据业务需要修改**任务名称** 、**执行时间** 、**任务描述** ，并设置**指定用户推送**。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101505.png)

### 新建定时任务

1. 在订阅任务面板中单击**创建订阅任务**按钮。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101523.png)
2. 在创建订阅任务界面，配置以下信息。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101522.png)
   <table> <thead> <tr> <td><p><b>配置项</b></p></td> <td><p><b>说明</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>任务名称</b></p></td> <td><p>自定义任务名称。</p></td> </tr> <tr> <td><p><b>执行计划时间</b></p></td> <td><p>设置订阅任务的执行时间。</p><p><img></p></td> </tr> <tr> <td><p><b>任务描述</b></p></td> <td><p>用自然语言描述您想让分析助手定期执行的分析任务。支持选择需要分析的<b>数据资产（①）</b>、<b>技能（②）、联网搜索（③）</b>及<b>大模型（④）</b>。<img></p> <div> <div> <i></i> </div> <div> <strong>说明 </strong> <p>仅公共云环境支持联网搜索，独立部署环境暂不支持。</p> </div> </div></td> </tr> <tr> <td><p><b>指定用户推送</b></p></td> <td><p>支持将订阅任务推送到<b>钉钉</b>、<b>飞书</b>、<b>企微</b>及<b>邮件</b>。其中，钉钉、飞书、企微渠道支持推送至<b>个人</b>和<b>群组</b>。</p></td> </tr> </tbody> </table>

## 进入Quick BI AIPro
若您想要使用更多的AIPro能力，您可以进入**Quick BI AIPro**进行操作。

1. 单击右上角![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101485.png)图标。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101483.png)

2. 进入**Quick BI AIPro** 界面。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0913409871/p1101531.png)Quick BI AIPro界面的相关操作请参见[对话模式](https://help.aliyun.com/document_detail/3045431.html)、[画布模式](https://help.aliyun.com/document_detail/3045432.html)。