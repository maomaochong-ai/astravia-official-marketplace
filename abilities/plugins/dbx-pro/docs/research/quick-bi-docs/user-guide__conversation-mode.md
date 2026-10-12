智能对话分析是 Quick BI AIPro 的核心功能模块。您可以用自然语言描述分析需求，AI 将自动完成数据查询、计算分析，并返回结构化的分析结果。支持多轮追问、作品输出、一键订阅等能力。本文将为您详细介绍如何使用该模式。  

## **前提条件**
* 您已开通 Quick BI AIPro 服务并完成登录。

* 您至少拥有Quick BI AIPro的**基础功能**权限。

* 您已拥有至少一个可访问的数据资产（数据集、数据表或上传文件）。

## 功能简介
Quick BI AIPro对话模式的主要能力如下：

* **自然语言查询**：直接用业务语言提问，无需编写 SQL。

* **结构化输出**：自动生成表格、图表、文字结论。

* **多轮追问**：在同一对话中持续追问，逐步深入分析。

* **作品输出**：支持下载、分享、保存为「我的分析」。

* **一键订阅**：将分析结果转为定时推送任务。

* **可视化报表生成**：生成支持动态更新数据、联动下钻分析的仪表板。

* **HTML 报告生成**：无论是单轮复杂问题，还是包含综合分析的单轮请求，均可生成美观的可视化分析报告。

* **PPT 文稿生成**：基于文件数据提取分析思路，生成 PPTX 演示文稿。

* **归因分析**：基于已配置的指标洞察逻辑，对指标波动进行多维度根因分析，并输出归因洞察内容。

* **数据故事生成**：通过"数据故事"技能，以动画叙事形式逐步解读数据，帮助您快速把握数据全貌。

## 操作步骤
### 功能入口

登录 Quick BI AIPro，进入产品首页或单击左侧导航栏中的**新建任务**。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0984864871/p1088323.png)

### 选择提问模式

单击对话框右下角的模型选择器，可以选择本次分析使用的提问模式。提问模式决定可用的能力范围。

<br />

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6872778871/p1100606.png)
<table> <thead> <tr> <td><p><b>提问模式</b></p></td> <td><p><b>适用场景</b></p></td> <td><p><b>可用能力</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p>标准</p></td> <td><p>需要组合模型、技能与外部工具完成报告生成、跨系统取数、趋势归因等复合任务。</p></td> <td><p>可自行选择大模型，技能、MCP 连接器和联网检索均可使用。</p></td> </tr> <tr> <td><p>极速</p></td> <td><p>面向基于已有数据资产的快速取数问答。</p></td> <td><p>由系统托管大模型，仅支持数据问答；技能、MCP 连接器和联网检索不可用。</p></td> </tr> </tbody> </table>

* 选择**标准**时，模式右侧展示当前使用的模型，单击可展开模型列表并切换。模型列表默认展开并选中默认模型，会话进行中也可以随时更换模型。

* 选择**极速** 时，大模型由系统托管，无需也无法自行选择。切换到 极速 后，对话框左下角仅保留**添加数据**，已引用的技能和 MCP 连接器会被清除，已选择的数据资产保留。

**说明**

提问模式是会话级属性，会话开始后不再变更：

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1781409871/p1100610.png)

* 在首页（尚未开始提问时），两种模式均可自由切换。

* 进入已有会话后切换模式时，模式右侧显示**创建新会话**，单击将以所选模式新建一个会话，当前会话的模式保持不变。

* 切换提问模式后，系统记住您最近一次选择的模式，下次新建会话时自动沿用并呈现对应的工具栏。该记录只保存模式，不保存所选模型。

* 独立部署环境中，如果已配置自定义模型，可在**标准**模式的模型列表中选择。

### 选择分析主题

**分析主题**用于提供特定业务场景的数据、知识和扩展上下文。选择主题后，您可以基于预设的业务口径进行分析。

* 默认使用主题配置的数据和扩展，需要结合个人内容分析时，可在数据资产或扩展选择面板的个人页签手动选择。

* 主题是否允许选择个人数据、个人扩展、上传个人文件或联网检索，取决于主题的功能配置。

* 若主题数据集按成员个人权限取数而您暂无权限，按界面提示申请，审批通过后下一轮对话即可使用。

1. 在对话框输入框下方的主题选择器中，选择一个可用的分析主题。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1781409871/p1100620.png)

   选择主题后，对话框展示该主题的欢迎语和推荐问题。您可以直接选择推荐问题，或继续输入自己的分析需求。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1781409871/p1101749.png)

   主题选择器中提供主题预览：可查看主题名称与描述、推荐问题（单击推荐问题可直接以该问题触发提问）以及主题内数据的预览，便于判断主题是否匹配当前分析场景。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1781409871/p1101750.png)
2. 如果当前没有可用主题，单击主题选择器中的**主题广场**，查看组织内已发布的主题并申请使用权限。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1781409871/p1100621.png)
3. 您也可以先在**主题广场** 中选择主题并单击**使用**。系统将打开主对话并自动选中该主题。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1781409871/p1100622.png)

**说明**

支持在对话过程中切换主题。

### 选择数据

**说明**

选择数据并非必需步骤。若用户已拥有相关数据资产，系统可通过对话直接调用与问题关联的数据资产，无需手动选择。

* 单击对话框左下角的![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0961204871/p1086089.png)图标，选择您的数据资产。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0984864871/p1088324.png)

  您也可以直接在对话框里输入"@"符号，选择数据资产。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0984864871/p1088325.png)

  选择仪表板作为数据资产时，分析仅使用仪表板中已呈现的数据。若需要使用仪表板中没有的维度做深度拆解，建议同时添加其底层数据集。添加仪表板只需具备该仪表板的权限，无需具备其底层数据集的权限。

  ![执行过程中加载数据环节展示的仪表板与右侧仪表板呈现结果](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6016628871/p1098951.png)  
  **说明**

  单次分析最多使用 2 个仪表板。匹配到的仪表板超过 2 个时，系统按匹配度取前 2 个；您手动选择了多个仪表板时，也在所选范围内取匹配度最高的前 2 个。
* 若您需要上传本地文件进行分析，可以单击**上传文件**，也可以将本地文件直接拖拽到对话框中。

  * 上传后，文件以卡片形式显示在对话框中。Word、CSV、PDF、PPT、图片、HTML、Excel 文件均支持单击卡片预览内容。

    ![对话框中上传的文件卡片列表](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6016628871/p1098946.png)
  * 发送后，您仍可在消息中单击文件卡片查看预览。![单击文件卡片后打开的文件预览窗口](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6016628871/p1099176.png)

* 支持设置**常驻数据**。

  * 在选择数据时，您可以单击数据右侧的![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088328.png)图标，设置**常驻数据**。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088327.png)

    设置完成后，本轮对话将优先使用该范围内的数据。您可以在对话框上面查看该常驻数据。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088331.png)

    <br />

  * 若您无需该常驻数据，您可以单击右侧![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0984864871/p1088333.png)图标，**清空常驻数据**。

    ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0984864871/p1088332.png)您也可以在选择数据时，单击常驻数据右侧的![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0984864871/p1088335.png)图标，**取消常驻** 。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0984864871/p1088329.png)

**说明**

* 使用**极速**模式提问时，必须先选择数据资产，可以通过输入「@」快捷引用数据资产，未选择数据资产前无法发送提问。 极速 模式下选择的数据资产默认设为常驻数据，后续提问持续使用该范围；不再需要时，可以按上文方式取消常驻或清空常驻数据。

  <br />

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6872778871/p1100604.png)
* **标准**模式不做该校验，未选择数据资产时系统仍可通过对话直接调用与问题关联的数据资产。

<br />

### 联网搜索

单击对话框左下角的![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088339.png)图标，可开启联网搜索。开启后，支持通过URL访问互联网，进行搜索并分析内容。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088337.png)  
**说明**

* 仅公共云环境支持联网搜索，独立部署环境暂不支持。

* 联网检索仅在**标准**提问模式下可用。

### 选择技能

单击对话框左下角的![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0961204871/p1086096.png)图标，选择需要使用的技能。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088343.png)

您也可以直接在对话框里输入"/"符号，选择所需技能。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088344.png)

若您需要添加新的技能，您可以单击**添加技能** ，跳转到[技能管理](https://help.aliyun.com/document_detail/3045440.html)页面进行添加。

技能仅在**标准**提问模式下可用。

### 选择MCP连接器

单击对话框左下角的![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0961204871/p1086102.png)图标，选择需要的MCP连接器。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088345.png)

MCP 连接器仅在**标准**提问模式下可用。

### 提问和回答

**说明**

AIPro 通过对话意图识别，将用户在对话中输入的自然语言自动映射到相应的下游操作（如"数据查询"、"可视化"、"诊断"、"生成报告"或"创建定时任务"等），根据提问内容的不同，系统可返回相应的分析结果。详情请参见下文[获取分析结果](#806f426701b3k)。

此处仅描述提问和回答的操作步骤。

1. 您可以在输入框中用自然语言输入您的分析问题，例如："本月各区域销售额同比变化情况"。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088347.png)

   支持单击![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5631204871/p1086110.png)图标可进行**语音输入**。  
   **说明**

   仅公共云环境支持语音输入，独立部署环境暂不支持。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7857315871/p1088348.png)

   支持单击![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5631204871/p1086111.png)图标可进行**实时对话**。  
   **说明**

   仅公共云环境支持实时对话，独立部署环境暂不支持。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0984864871/p1088349.png)
2. 输入问题后，您可以按**Enter** 键或单击**发送**按钮，等待 AI 返回分析结果。

   支持在返回过程中**停止生成** 。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0984864871/p1088350.png)
3. 返回结果。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0984864871/p1088351.png)
4. 支持**多轮追问**。

   您可以根据需要，继续在输入框中以自然语言继续提出分析相关的问题。系统将结合上下文，持续为您提供连贯、准确的解答，助您深入探索所需信息。

### 使用消息队列

分析任务运行期间，您无需等待当前任务结束即可继续提问。新发送的消息会排入当前会话的消息队列，并在当前任务结束后按队列顺序自动执行，便于连续提出多个分析问题。

1. 在任务运行期间，在输入框中输入新的分析问题并发送。

   消息排入当前会话的消息队列，不打断正在执行的当前轮任务。消息队列面板固定在输入框上方，默认展开，最多同时展示 3 条待执行消息，超出部分可在面板内滚动查看。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1301887871/p1096901.png)
2. 在消息队列中管理待执行的消息。

   1. 支持移除单条消息。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6531887871/p1096905.png)

      并在弹出的二次确认框中单击**删除**。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6531887871/p1096906.png)
   2. 支持清空整个队列。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6531887871/p1096908.png)

      并在弹出的二次确认框中单击**清空**。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6531887871/p1096910.png)
   3. 支持拖拽调整待执行消息的顺序及置顶执行消息，后续按调整后的顺序执行。不需要查看队列时，支持手动收起。

      ![438](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6531887871/p1096920.gif)
3. 当前任务结束后，系统自动从队首取一条消息继续执行，逐条执行不合并。

**说明**

* 单击**停止生成** 或当前轮执行出错后，当前轮任务停止，消息队列保留但不再自动执行；此时队首消息会回填到输入框中，您可以单击**发送**，从队首恢复执行。

* 消息队列归属于会话，每个会话各自维护一条队列。切换会话仅改变查看对象，不会停止或清空任何会话的队列，切回时队列与执行进度按会话真实状态还原。

### 结果查看及操作

* 支持**智能生成图表**。

  将鼠标移动至分析结果上，并单击![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9861204871/p1086935.png)图标生成图表。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1001966871/p1094631.png)

  生成后，支持进行图表切换。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2001966871/p1094633.png)
* 在查看数据的同时，还支持以下功能。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6144628871/p1099076.png)

  <table> <thead> <tr> <td><p><b>序号</b></p></td> <td><p><b>功能项</b></p></td> <td><p><b>说明</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>①</b></p></td> <td><p><b>点赞点踩</b></p></td> <td><p>单击<img>进行点赞，单击<img>进行点踩，点踩时支持填写反馈建议。</p><p><img></p></td> </tr> <tr> <td><p><b>②</b></p></td> <td><p><b>复制</b></p></td> <td><p>复制分析结果的内容。</p></td> </tr> <tr> <td><p><b>③</b></p></td> <td><p><b>分析产物</b></p></td> <td> <ul> <li><p>支持查看对话中的分析产物。<img></p> <ul> <li><p>将鼠标移动至分析产物后单击右侧<img>图标并单击<b>导出</b>按钮可导出当前分析产物。</p><p><img></p></li> <li><p>单击当前分析产物可进行数据预览。</p><p><img></p></li> </ul></li> <li><p>您也可以单击对话页面右上角的<img>图标，查看当前对话中生产的所有分析产物。<img></p> <ul> <li><p>点击目标分析产物可<b>预览</b>并<b>定位</b>到其所在的对话位置。</p></li> <li><p>支持输入产物名称进行<b>搜索</b>。</p></li> <li><p>支持<b>筛选</b>不同类型的分析产物。</p><p><img></p></li> </ul></li> </ul></td> </tr> <tr> <td><p><b>④</b></p></td> <td><p><b>分享</b></p></td> <td><p>单击<img>图标后，您可以选择单个或多个对话进行分享。支持<b>私密链接</b>和<b>公开链接</b>分享。</p> <ul> <li><p><b>私密链接</b>：仅系统内登录用户可通过链接查看对话内容（包括对话中的数据作品）。</p></li> <li><p><b>公开链接</b>：任何人通过链接均可查看，无需登录。</p></li> </ul><p><img></p><p>打开对话分享链接后，打开链接后，您可以查看对话中的数据作品（如仪表板、HTML 报告等）。</p><p><img></p> <div> <div> <i></i> </div> <div> <strong>说明 </strong> <p>通过分享链接打开的数据作品仅支持查看，不支持<b>编辑</b>、<b>去往我的分析</b>、<b>版本记录</b>等操作。</p> </div> </div><p>您也可以单击页面右上角的<img>图标并选择单个或多个对话进行分享。</p><p><img></p></td> </tr> <tr> <td><p><b>⑤</b></p></td> <td><p><b>转为文档</b></p></td> <td><p>单击<b>转为文档</b>后，系统会自动触发相应指令并生成文档。您可以对当前分析结果进行<b>编辑</b>、<b>保存为作品</b>、<b>下载</b>、<b>全屏</b>等操作。具体操作请参见<a href="#d4dacba6d2b12">生成文档报告</a>。</p><p><img></p></td> </tr> <tr> <td><p><b>⑥</b></p></td> <td><p><b>取数过程</b></p></td> <td><p>支持查看取数过程，检验取数结果是否符合您的需求。</p> <div> <div> <i></i> </div> <div> <strong>说明 </strong> <p>并非每次对话都会包含取数过程，仅当问题返回结果中实际执行了取数操作时，才会显示相关取数信息。</p> </div> </div><p><img></p></td> </tr> <tr> <td><p><b>⑦</b></p></td> <td><p><b>复制Trace_ID</b></p></td> <td><p>支持复制Trace_ID，可辅助售后排查问题。</p></td> </tr> <tr> <td><p><b>⑧</b></p></td> <td><p><b>删除</b></p></td> <td><p>单击<b>删除</b>按钮，删除本次对话消息，包括问题和回复。</p><p><img></p></td> </tr> </tbody> </table>
* 支持使用**会话快捷索引**快速定位历史问答。

  在长对话场景下，对话区侧边会显示快捷索引。将鼠标悬停在索引项上可预览该轮问答内容，单击后即可定位到对应的问答位置。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9652095871/p1092911.png)  
  **说明**
  * 快捷索引默认隐藏，当会话消息轮数大于等于 3 轮，或对话内容总高度超过 2 屏时才会显示。

  * 快捷索引仅用于定位查看，不支持编辑、删除、重命名等操作。

## 获取分析结果
AIPro 通过对话意图识别，将用户在对话中输入的自然语言自动映射到相应的下游操作（如"数据查询""可视化""诊断""生成报告"或"创建定时任务"），无需用户手动切换至具体功能页面。根据提问内容的不同，系统可返回相应的分析结果。具体如下：

### 生成文档报告

基于图表和解读文字，可生成文档式分析结果，支持高自由度的文档编辑。

1. 将分析结果**转为文档** 。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1001966871/p1094644.png)

2. 系统会自动触发相应指令并生成文档。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088360.png)
3. 您可以对当前分析结果进行**编辑** 、**保存为作品** 、**下载** 、**全屏**等操作。

   1. 单击**编辑**按钮进入文档编辑页面后，您可以进行以下操作。

      <table> <thead> <tr> <td><p><b>序号</b></p></td> <td><p><b>操作项</b></p></td> <td><p><b>说明</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>①</b></p></td> <td><p><b>分析助手</b></p></td> <td><p>单击<b>分析助手</b>按钮，可添加分析助手对话框。您可以在对话框里进行提问和分析，也可以直接选中报告内容进行更精准的分析。<img></p></td> </tr> <tr> <td><p><b>②</b></p></td> <td><p><b>添加图表</b></p></td> <td><p>单击<b>添加图表</b>按钮，可将仪表板中的图表添加至当前报表。</p></td> </tr> <tr> <td><p><b>③</b></p></td> <td><p><b>拓展样式</b></p></td> <td><p>除了基本的文本样式设置，您还可以在<b>更多</b>中使用高亮块、分栏等丰富的拓展样式，使得报告不仅仅是文字的堆砌，而是通过多样化的表达形式，将数据信息更有效地传递给报告查看者。</p><p><img></p></td> </tr> <tr> <td><p><b>④</b></p></td> <td><p><b>文本编辑</b></p></td> <td><p>对报告的文本内容进行编辑、修改，支持设置文本样式，例如标题、序号、加粗、颜色等。</p><p><img></p></td> </tr> <tr> <td><p><b>⑤</b></p></td> <td><p><b>引用资源</b></p></td> <td><p>单击工具栏上的<b>引用资源</b>图标，可以查看当前报告引用的资源。</p> <div> <div> <i></i> </div> <div> <strong>说明 </strong> <p>目前仅支持仪表板图表的引用。</p> </div> </div></td> </tr> <tr> <td><p><b>⑥</b></p></td> <td><p><b>图表操作</b></p></td> <td> <ul> <li><p>支持图表切换。<img></p></li> <li><p>支持是否<b>显示标题</b>、<b>重命名</b>和<b>全屏查看</b>。</p><p><img></p></li> </ul></td> </tr> <tr> <td><p><b>⑦</b></p></td> <td><p><b>页面宽度</b></p></td> <td><p>支持设置页面宽度为紧凑、常规、超宽及全宽。</p><p><img></p></td> </tr> <tr> <td><p><b>⑧</b></p></td> <td><p><b>查看大纲</b></p></td> <td><p>支持显示大纲内容，查看报告整体框架。</p><p><img></p></td> </tr> <tr> <td><p><b>⑨</b></p></td> <td><p><b>更新数据</b></p></td> <td><p>单击右上角<b>更新</b>按钮，系统会自动更新报告内引用的资源。</p><p>更新过程中，报告内容会逐步流式呈现，您可实时查看更新进展，无需等待全部内容生成后统一展示。</p><p><img></p></td> </tr> <tr> <td><p><b>⑩</b></p></td> <td><p><b>保存</b></p></td> <td><p>单击右上角<b>保存</b>按钮，保存当前报告。</p><p><img></p></td> </tr> <tr> <td><p><b>⑪</b></p></td> <td><p><b>前往我的分析</b></p></td> <td><p>单击右上角<img>图标，进入<b>我的分析</b>页面。</p></td> </tr> <tr> <td><p><b>⑫</b></p></td> <td><p><b>全屏</b></p></td> <td><p>单击右上角<img>图标，可全屏查看当前报告。</p></td> </tr> <tr> <td><p><b>⑬</b></p></td> <td><p><b>关闭</b></p></td> <td><p>单击<img>图标，可退出编辑页。</p></td> </tr> </tbody> </table>

      报告中的**智能问答** 、**洞察分析**等动态模块，支持通过模块左上角的入口查看和修改生成该模块内容的提示词，修改后可重新生成模块内容。
   2. 单击**保存为作品** ，将当前文档保存至**我的分析**。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088363.png)保存后，该分析结果将会以**报告** 的形式保存在**我的分析** 中。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088364.png)
   3. 单击右上角的![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0961204871/p1086290.png)图标，可将报告下载到本地，支持**图片** 、**Word** 、**PDF** 和**PPT**四种格式。

      ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6144628871/p1098967.png)
      * 选择**图片** 、**Word** 或**PDF**时，系统直接生成对应文件并下载到本地。

      * 选择**PPT**时，系统通过对话生成演示文稿：

        1. 在下载菜单中选择**PPT**。系统自动在输入框中引用当前报告，并选中内置的 PPT 生成技能，同时带入默认指令"基于报告内容，生成布局合理、风格简单的PPT"。

           ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6144628871/p1098970.png)
        2. （可选）在默认指令的基础上补充要求，例如风格偏好或页数要求。

        3. 发送指令。AI 基于报告内容和您的指令生成演示文稿，生成完成后在对话中以下载卡片的形式提供结果，单击即可下载 PPTX 文件。

           ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6144628871/p1099004.png)

      **说明**
      * 在对话中编辑报告时，系统在侧边栏新建一条生成 PPT 的消息；在**我的分析**中编辑报告时，系统自动新建一个会话。

      * 每次导出基于当前查看的报告内容生成。如果报告数据已更新，请先更新报告再导出。

   4. 单击右上角![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088398.png)图标，可全屏查看当前报告。

### 生成可视化报表

支持基于数据资产中的多个数据集、Excel、数据表或 API 数据源组合生成报表（上限 10 个），并支持数据动态更新、筛选、联动和下钻分析。

1. 输入生成报表相关的指令。

   例如："帮我生成一个包含月度销售趋势的仪表板"。您也可以在已有分析结果上输入："将以上结果生成可视化报表"；或上传已有 HTML，要求将其转换为可视化报表。AI 不仅会复刻 HTML 的页面样式，还会理解并复刻其中的数据，同时根据您的补充要求调整报表内容。

   此时，AI 将生成一个可持续更新的可视化仪表板。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0984864871/p1088415.png)
2. 生成完成后，您可以进行以下操作。

   <table> <thead> <tr> <td><p><b>序号</b></p></td> <td><p><b>操作项</b></p></td> <td><p><b>说明</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>①</b></p></td> <td><p><b>编辑</b></p></td> <td><p>单击进入编辑页面，可选中报表上的组件进行针对性编辑。<img></p><p>您也可以在<b>我的分析</b>中打开目标报表，直接进入编辑态。</p><p>在编辑态下，您可以通过<b>配置项编辑</b>和<b>批注</b>两种方式修改报表。配置项修改的效果会直接生效在组件上；对话式的编辑会先以批注的方式标注在组件上，您可积攒多条批注一起发送给模型，减少等待时间。</p><p><img></p><p><b>对话</b></p><p>单击报表中的一个组件，弹出就近的输入面板。</p><p><b>添加批注</b></p><p><img></p> <ol> <li><p>在组件旁的输入框中输入修改需求并按 Enter，即生成一条批注。</p></li> <li><p>重复上述操作可连续添加多条批注，同一组件也支持添加多条。单击已添加的批注，可修改或删除该条批注的内容。</p></li> </ol><p><b>修改批注</b></p><p>单击报表中已添加的批注，弹出编辑框，可修改批注内容或删除该条批注；鼠标悬停在批注上可查看已输入的需求原文。</p><p><img></p><p><b>撤销、重做和清空</b></p> <ul> <li><p>在编辑态中支持撤销和重做批注与配置修改。撤销按操作顺序逆序逐条回退；重做按操作顺序将被撤销的操作逐条恢复。</p></li> <li><p>单击<b>清空批注</b>图标，可一次性删除当前编辑态中已添加的全部批注和尚未应用的配置修改。</p></li> <li><p>注意：退出编辑态时，尚未应用的批注和配置修改不保留。</p></li> </ul><p><img></p><p><b>发送修改</b></p><p><img></p><p>单击<b>发送</b>，本轮的全部批注和配置修改一起提交给 AI 执行。发送后：</p> <ul> <li><p>对话流中只追加一条记录：批注记录您的需求原文，配置修改以修改摘要的形式记录在同一条对话中，同一组件的多处配置修改合并为一条摘要。</p></li> <li><p>AI 执行期间不支持编辑报表，执行完成后可继续编辑。</p></li> <li><p>已应用的批注和配置修改如需撤回，可通过<b>版本记录</b>回退到修改前的版本，详情请参见下文<b>版本记录</b>。</p></li> </ul><p><b>配置项编辑</b></p><p>单击输入框左侧的<b>配置</b>按钮，展开配置区。配置按钮可在图表组件与标题组件上展开。</p><p><b>配置项编辑</b>支持直接修改图表的数据与样式、切换图表类型，以及修改报表标题、章节标题和图表标题。</p><p><b>图表类型切换</b></p><p>单击<b>图表类型</b>选择器，可切换为其他图表类型。<img></p><p><b>属性</b></p><p>属性对应配置区中的<b>数据</b>与<b>样式</b>两类页签，分别配置图表的字段与数据、展示样式。</p><p><b>数据</b>：在<b>数据</b>页签中配置图表的字段与数据相关配置项，具体配置项因图表类型而异。</p><p><img></p><p><b>样式</b>：在<b>样式</b>页签中配置图表的配色、图例、数据标签、坐标轴等样式。</p><p><img></p><p><b>代码</b></p><p><b>代码</b>：在<b>代码</b>页签中可查看和修改图表的实现代码。</p> <div> <div> <i></i> </div> <div> <strong>说明 </strong> <ul> <li><p>查询控件、导航和章节（section）不支持配置项编辑，仍可通过批注修改。</p></li> <li><p>全屏状态下编辑报表时，可收起左侧导航栏和对话栏。</p></li> </ul> </div> </div></td> </tr> <tr> <td><p><b>②</b></p></td> <td><p><b>保存为作品</b></p></td> <td><p>按照下图步骤将分析结果保存为作品。</p><p><img></p><p>保存后，您可以在"<b>我的分析</b>"模块中进行查看及相关操作。</p><p><img></p><p>您可以单击<img>图标前往<b>我的分析</b>。</p><p><img></p></td> </tr> <tr> <td><p><b>③</b></p></td> <td><p><b>版本记录</b></p></td> <td><p>点击查看<b>版本记录</b>。</p><p><img></p><p>支持将报表回退至指定历史版本，即把报表恢复到之前某一版本时的状态，撤销该版本之后的修改： </p> <ul> <li><p>查看最新版本时，版本记录中的各历史版本均提供<b>回退</b>按钮，您可以按需将报表回退至目标版本。</p></li> <li><p>查看历史版本时，您可以单击顶部的<b>回退</b>按钮，回退到当前版本。</p></li> <li><p>在<b>我的分析</b>预览页查看报表时，不支持回退。</p></li> </ul><p>在版本记录中展开某个版本，可查看该版本的操作记录，包括批注原文和配置修改明细。</p></td> </tr> <tr> <td><p><b>④</b></p></td> <td><p><b>全屏</b></p></td> <td><p>全屏显示当前仪表板。</p><p><img></p></td> </tr> <tr> <td><p><b>⑤</b></p></td> <td><p><b>关闭</b></p></td> <td><p>关闭显示当前仪表板。</p></td> </tr> <tr> <td><p>⑥</p></td> <td><p><b>生成数据故事</b></p></td> <td><p>将鼠标移动至图表上，并单击<img>图标生成数据故事。</p><p><img></p></td> </tr> <tr> <td><p>⑦</p></td> <td><p><b>数据刷新</b></p></td> <td><p>将鼠标移动至图表上，单击<img>图标并点击<b>数据刷新</b>，可刷新当前图表数据。<img></p></td> </tr> <tr> <td><p>⑧</p></td> <td><p><b>查看SQL</b></p></td> <td><p>将鼠标移动至图表上，单击<img>图标并点击<b>查看SQL</b>，即可在<b>SQL</b>弹窗中查看图表所对应的底层查询语句，便于数据逻辑验证。<img></p></td> </tr> <tr> <td><p>⑨</p></td> <td><p><b>异常检测</b></p></td> <td><p>将鼠标移动至图表上，单击<img>图标并点击<b>异常检测</b>，即可在对话流中查看具体的异常详情。</p><p><img>若存在对应的异常检测结果会回显在仪表板图表上供查看。</p><p><img></p></td> </tr> <tr> <td><p>⑩ </p></td> <td><p><b>趋势预测</b></p></td> <td><p>将鼠标移动至图表上，单击<img>图标并点击<b>趋势预测</b>，即可在对话流中查看具体的预测详情。</p><p><img>对应的预测结果会回显在当前报表的对应图表上，您还可以进行预测期数的选择。</p><p><img></p></td> </tr> <tr> <td><p>⑪</p></td> <td><p><b>归因分析</b></p></td> <td><p>将鼠标移动至图表上，单击<img>图标并点击<b>归因分析</b>。</p><p><img>选择图表上要归因的元素，选择完毕后点击归因按钮。</p><p><img>左侧对话中即执行归因，供您进行归因详情查看。</p><p><img></p></td> </tr> </tbody> </table>

**说明**

数据来源为数据集的可视化报表支持配置行列权限，行列权限在数据集中配置。报表分享给他人时，系统按查看者各自的行列权限展示对应数据，实现千人千面：

* 列级权限：当您对报表中的字段（含维度、度量及计算字段）没有查看权限时，您可以申请该字段的权限。

* 报表中的解读内容基于查看者有权限的数据自动刷新，分享场景下仅呈现查看者行列权限范围内有权限的数据。

#### **使用自定义图表**

除平台内置图表外，您还可以在报表生成与二次编辑中使用组织内发布的自定义图表。使用前，请先在**图表广场** 安装目标图表，并在**我的图表** 中保持其启用状态，具体请参见[我的图表](https://help.aliyun.com/document_detail/3055221.html)。

* **生成报表时**：在指令中直接写明图表名称即可精确匹配；描述与图表名称或描述语义相近的分析诉求时，系统也会自动匹配对应的自定义图表。

* **二次编辑时**：对话编辑和配置项编辑均支持切换为自定义图表。切换时，系统按该图表的字段结构自动完成数据字段映射。

### 生成 HTML 报告

可视化呈现本次分析结论，常用于一次性的探索分析、个性化报表制作。

1. 输入生成HTML 报告相关的指令。

   例如，在多轮对话完成后，输入："将以上分析总结为一份完整报告"。

   此时，AI 将把多轮对话中的分析结果汇总为一份 HTML 可视化分析报告。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0984864871/p1088428.png)
2. 报告生成后，您可以单击报告右上角的![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0961204871/p1086290.png)图标可将报告下载到本地。

3. 单击右侧![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0961204871/p1086281.png)图标可展开报告。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0961204871/p1086280.png)

   <br />

4. 展开后，您可以进行以下操作。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0984864871/p1088430.png)
   <table> <thead> <tr> <td><p><b>序号</b></p></td> <td><p><b>操作项</b></p></td> <td><p><b>说明</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>①</b></p></td> <td><p><b>保存为作品</b></p></td> <td><p>您可以将该报告<b>保存为作品</b>。</p><p><img></p><p>保存后，您可以在"<b>我的分析</b>"模块中查看该报告。</p></td> </tr> <tr> <td><p><b>②</b></p></td> <td><p><b>下载</b></p></td> <td><p>将报告下载到本地。</p></td> </tr> <tr> <td><p><b>③</b></p></td> <td><p><b>全屏</b></p></td> <td><p>全屏显示当前HTML报告。</p></td> </tr> <tr> <td><p><b>④</b></p></td> <td><p><b>关闭</b></p></td> <td><p>关闭显示当前HTML报告。</p></td> </tr> </tbody> </table>
5. 支持通过对话修改并重新生成一份新的 HTML 报告，可灵活更换主题色或调整内容。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088434.png)

### 深度洞察分析

深度洞察分析包含异常检测、趋势预测和归因分析三项能力，帮助您定位指标波动原因、发现数据异常并预判指标走势。在对话中，您可以通过选择**指标归因分析**技能触发，也可以直接提出相关问题。  
**说明**

* 洞察分析需要指定数据集。

* 若目标指标已配置指标洞察，系统按配置执行归因分析；若未配置，则按默认规则分析。指标洞察的配置方法，请参见**洞察归因** \>**指标洞察**。

1. 选择深度洞察分析使用的数据资产，操作方法请参见上文[选择数据](#572ecb2ab2byi)。

2. 在输入框中输入深度洞察相关的问题。

   您可以按以下方式提问：
   * 归因类问题。例如："上个月GMV为什么跌了？""帮我分析一下本月销售额异常的原因"。

   * 直接调用已配置的归因逻辑。例如："调用GMV归因逻辑看看结果"。

   * 异常检测或趋势预测类问题。例如："最近一周GMV有哪些异常波动？""预测接下来6个月销售额的走势"。

3. 系统完成分析后，在对话中呈现深度洞察结果：异常检测和趋势预测以对应图表呈现，归因分析以文字说明与数据表格（或对应图表）呈现，两期数据按**当前周期/对比周期**对比展示；图表形式的洞察结果支持切换为表格查看数据。

异常示例：![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1781409871/p1101556.png)

归因示例：![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1781409871/p1101542.png)

预测示例：![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1781409871/p1101557.png)  
**说明**

* 深度洞察结果在当前对话中呈现，您可以在会话历史中回看分析过程和结果。

<br />

除对话外，报表中的部分图表也支持在图表侧触发深度洞察：将鼠标移动至图表上，单击图标后选择**异常检测** 、**趋势预测** 或**归因分析** ，详见上文[结果查看及操作](#80247a0de8uwz)中的操作⑨-⑪。能力支持范围：异常检测和趋势预测仅支持时间维度的折线图；归因分析支持折线图、柱图、条形图、饼图、排行榜、组合图和气泡散点图。

### 生成数据故事

当数据量较大或具有层次结构时，您可以通过"数据故事"技能，以动画叙事的形式逐步解读数据，帮助您快速理解数据全貌。

1. 选择需要分析的数据资产，并在对话框中提出分析问题。

2. 在对话框中输入包含"数据故事"的指令，或在技能列表中选择技能。

3. AI 根据当前数据和问题生成数据故事内容，并在对话中展示。

   ![430](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3820966871/p1094552.gif)
4. 查看数据故事内容，按动画叙事顺序理解数据变化、结构关系或关键结论。

**说明**

* **触发方式**：在对话框中输入包含"数据故事"的指令，或手动选择"数据故事"技能。例如："用数据故事带我看各区域销售额变化趋势""这份数据有点复杂，一步步带我看看重点"。

* **产物**：数据故事以动画形式嵌在对话中展示，暂不支持下载或保存。

### 生成PPT文稿

基于数据资产的分析结果生成 PPTX 文件，可直接用于业务汇报。

1. 输入生成PPT文稿相关的指令。

   例如，输入："基于这份数据生成月度汇报PPT"。
2. AI 将提取文件数据中的分析思路，生成 PPTX 格式的演示文稿。

3. 生成完成后，单击下载获取 PPTX 文件。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088426.png)

### 生成订阅任务

在获得满意的分析结果后，您可以将当前分析转为定时推送任务。

1. 输入创建订阅相关的指令。

   例如，输入："每天早上9点推送这个分析结果给我"。系统将自动创建订阅。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6093264871/p1088425.png)
2. 创建完成后可在"**我的订阅** "模块中进行查看和管理。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0331204871/p1086297.png)

### 生成技能

将分析过程生成可复用的技能，便于后续调用。

1. 输入生成技能相关的指令。

   例如，输入："帮我将以上分析逻辑生成一个技能"。系统将自动创建技能。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1984864871/p1088424.png)
2. 生成后，您可以修改技能名称，单击**确认保存** 后，该技能将被封装并供调用。您可以在**我的技能**中进行管理。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9861204871/p1086341.png)
3. 保存后，系统会为该技能生成一张**技能卡片**，卡片上展示技能名称与使用方式，便于后续查看与复用。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0613446871/p1094419.png)

## 后续操作
* 进入**画布模式** 进行自由排布、组合呈现。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1001966871/p1094636.png)![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2001966871/p1094637.png)

* 进入**我的分析**查看分析作品。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5031204871/p1086439.png)
* 进入**我的订阅**查看订阅任务。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0331204871/p1086530.png)

## 会话使用建议
在对话模式中，一次提问与 AI 助手的回答构成一轮**对话消息** ，同一会话内的历史对话消息会作为**上下文**参与后续回答，帮助 AI 助手更准确地理解您的分析意图。为获得更佳的使用体验，建议遵循以下使用方式：

* **按话题新建会话**：当开启新话题或新的分析场景时，建议新建会话，避免旧话题的上下文干扰新问题的分析结果，同时便于后续按会话查看和复用历史问答。

* **避免长期只在 1-2 个会话中对话**：会话内的历史消息会持续作为上下文参与每次回答，历史消息越多，上下文越大，不仅回答质量可能下降，还会消耗更多 Credit。

* **及时开启新会话**：当发现回答开始偏离预期或上下文过大时，建议新建会话重新开始，清理不再需要的上下文。

* **会话生命周期管理**：超过 180 天无新消息的会话将自动下线并从历史记录移除，会话中已保存的产物不受影响：

  ![历史会话区与会话保留提醒](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8530849871/p1102155.png)
  * 会话内已保存的产物（如已保存的报表、报告）不受影响，仍可按原有方式查看和管理。

  * 会话内未保存的产物随会话一并清理，不再保留。

  * 该会话已分享的链接同步失效，打开链接后页面将提示会话已删除。

* 您可以使用最基础的超市零售问题开始体验，如"分析本月各品类销售额的分布情况"。