本文面向首次使用 Quick BI AIPro 的组织管理员与业务用户，帮助您在 30 分钟内完成从开通服务到发起第一次 AI 对话分析的全流程。  

## 背景说明
传统 BI 依赖数据分析师制作仪表板、业务用户被动消费图表；一旦业务问题超出既有报表，就需要重新提需求、排开发。Quick BI AIPro 将大模型能力与 BI 底座深度融合，让业务用户以对话方式直接驱动数据分析，覆盖「概览 → 拆解 → 归因 → 诊断 → 行动」的完整决策路径。

**Quick BI AIPro 与传统 BI 的差异如下：**
<table> <thead> <tr> <td><p><b>对比维度</b></p></td> <td><p><b>传统 BI</b></p></td> <td><p><b>Quick BI AIPro</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p>使用方式</p></td> <td><p>拖拽字段、编写 SQL、查看固定仪表板</p></td> <td><p>自然语言提问、多轮追问</p></td> </tr> <tr> <td><p>响应速度</p></td> <td><p>需求排期数天到数周</p></td> <td><p>秒级返回数据和分析结果</p></td> </tr> <tr> <td><p>分析模式</p></td> <td><p>业务依赖分析师生成归因结论</p></td> <td><p>通过AI完成问题拆解和思考问题，生成深度、全面的归因分析结论</p></td> </tr> <tr> <td><p>分析方法</p></td> <td><p>手动操作下钻、联动、人工输出分析报告</p></td> <td><p>对话探索和分析，可通过无限画布串联思路和聚焦分析。自动产出分析结果</p></td> </tr> <tr> <td><p>使用门槛</p></td> <td><p>需具备 SQL 与 BI 建模能力，熟悉各模块交互配置，有一定学习成本</p></td> <td><p>业务用户零门槛使用</p></td> </tr> <tr> <td><p>资产沉淀</p></td> <td><p>仪表板</p></td> <td><p>可动态更新数据的分析作品（报表、文档）、一次性的分析报告、周期性订阅任务</p></td> </tr> </tbody> </table>

**典型场景**：

* 业务负责人在早会前 5 分钟问「上周各区域销售同比」，直接拿到图表与归因。

* 运营同学问「为什么华东 GMV 下滑」，自动下钻到品类、渠道、门店三级归因。

* 财务同学通过对话生成「月度经营看板」，并通过对话生成每月 1 号的月报推送任务。

*** ** * ** ***

## AIPro 操作流程概览
Quick BI AIPro 的落地分为「管理员配置」与「用户使用」两条主线。建议按下图顺序完成初始化。

![aipro_flow.svg](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3128037871/p1085638.svg)

## AIPro 操作步骤（管理员配置端）
以下操作面向组织管理员或空间开发者，用于管理用户，并将企业数据、知识、技能配置到 AIPro，确保业务用户开箱即用。

### 一、用户权限

1. 组织管理员登录 Quick BI 管理中心。

2. 进入 **组织管理 → 角色管理**。

3. 为自定义角色配置AIPro的相关权限。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9425804871/p1087642.png)

   **说明**

   Quick BI提供的预置角色已默认拥有AIPro的相关权限：
   * **组织管理员** 默认拥有**集中管理权限** 、**基础功能权限**。

   * **权限管理员** 默认拥有**基础功能权限**。

   * **普通用户** 默认拥有**基础功能权限**。

4. 在**成员管理** 页面，按需为成员分配具有AIPro相关权限的角色。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9425804871/p1087646.png)

### 二、接入企业数据

**目的**：让业务用户可找到并使用企业预设的数据，包括数据表、数据集、文件、API等企业数据资产。

1. 在工作空间内创建**数据源** 和**数据集**资源

   1. 管理员进入 Quick BI 工作空间。

   2. 创建数据源：在工作台-**数据源**中添加数据库连接（MySQL、MaxCompute、PostgreSQL、Oracle 等）

   3. 创建数据集：在工作台-数据集中配置数据集

   4. 将数据集在**空间管理**中授权给需要使用的成员或角色。

2. 在AI Pro内创建**文件、数据表组合、API数据**资源

   1. 进入AI Pro-企业-数据管理

   2. 创建数据表组合、文件和API数据

   3. 选择数据资源-更多，协同授权给使用用户

<br />

### 三、预置常用数据资产（可选）

**目的**：让业务用户登录后无需自行配置和寻找数据源，直接看到部门常用的数据资产。

1. 管理员进入**管理中心 → 预配置数据资产** （路径 `ai/org/pre-asset`）。

2. 选择"新建资产包"配置需要向业务用户推荐的数据集或数据表。

3. 保存后，业务用户在对话输入框单击 **@** 时将优先看到这些数据资产。

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6190197871/p1085630.png)

<br />

### 四、配置知识中心

**目的**：将企业的业务口径、指标定义、字段说明等知识沉淀到 AIPro，让 AI 分析结果符合企业口径。

1. 进入**管理中心 → 知识管理** （路径 `/ai/org/knowledge`）。

2. 点击"新增知识"，创建包含业务逻辑的知识。

3. 单击**智能导入**支持通过解析和学习文档中的业务逻辑，导入企业知识。

4. 保存后，AI 在数据集对话时，召回和引用这些知识。

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6190197871/p1085637.png)

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085640.png)

### 五、配置分析技能（可选）

**目的**：将企业标准分析思路和方法（月度经营复盘、异常归因、门店经营看板等）沉淀为可复用的 AI 技能。

1. 进入**管理中心 → 技能管理** （路径 `/ai/org/skill`）。

2. 单击**添加技能**，上传技能的zip包

3. 设置技能的**可见范围**（全员 / 特定用户）。

4. 保存并发布后，业务用户可以在**企业 → 技能广场** 找到技能快速调用，也可以在对话输入框中输入 `/` 即可调用。

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6190197871/p1085644.png)

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085625.png)

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085635.png)

<br />

### 六、接入 MCP 连接器（可选）

**目的**：将企业外部工具（钉钉、飞书、企业内 API、行业数据源）通过 MCP（Model Context Protocol）接入 AI 分析流程，扩展分析边界。

1. 进入**管理中心 → MCP 管理** （路径 `/ai/org/mcp`）。

2. 单击**添加连接器**，添加MCP的配置信息。

3. 设置连接器的可见范围与调用权限。

4. 业务用户可在**企业 → MCP 广场**开启并在对话中调用。

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085627.png)

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085631.png)

<br />

### 七、Credit 与配额管理

**目的**：控制和审计企业内用户的资源用量。

1. 进入组织管理 **→ Credit 管理** （路径 `/org/admin/creditManage`）。

2. 查看组织内用户的 Credit 余额、消耗情况。

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085641.png)

### 八、AIPro管理权限配置

**目的**：确保数据可见性与操作权限符合企业治理要求。通过自定义角色可赋权用户成为AIPro管理员。

1. 进入**管理中心 → 组织管理 → 角色配置** （路径 `/org/admin/user/role`）。

2. Quick BI AIPro 提供以下预置角色：

<table> <thead> <tr> <td><p><b>角色</b></p></td> <td><p><b>主要权限</b></p></td> <td><p><b>AI Pro管理能力</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p>组织管理员</p></td> <td><p>组织管理员</p></td> <td><p>是</p></td> </tr> <tr> <td><p>空间管理员</p></td> <td><p>管理空间内成员、数据资产、作品与订阅</p></td> <td><p>否</p></td> </tr> <tr> <td><p>空间开发者</p></td> <td><p>制作数据集、报表、技能，将资产发布到企业</p></td> <td><p>否 </p></td> </tr> <tr> <td><p>自定义角色</p></td> <td><p>打开 AIPro 权限点配置 ，可协助组织管理员管理AIPro能力<img></p></td> <td><p>是</p></td> </tr> </tbody> </table>

## AIPro 操作步骤（用户使用端）
面向已被分配 AIPro 席位的业务用户，完成第一次 AI 对话分析。

### 一、登录 AIPro

1. 使用阿里云账号登录 Quick BI。

2. 单击顶部导航栏中的 **AIPro** ，进入 AIPro 首页。

3. 首页展示「我的」与「企业」两个视图标签，默认停留在「我的」视图。

### 二、配置数据资产

1. 进入**我的数据**

2. 添加数据：支持从企业数据广场添加企业数据，也可以上传个人的本地文件，支持excel、pdf、word、markdown、txt等类型数据文件。

3. 数据学习：添加数据后，为了让AI能理解数据语义，会先进行1至2分钟的学习过程。完成学习后可以进入**新建任务**使用数据进行分析

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085626.png)

### 三、自然语言提问

进入**新建任务，**在输入框中输入分析问题，示例：

* 「本月各区域销售额同比变化情况」

* 「华东区 GMV 下滑的主要原因」

* 「生成 2026 年 Q2 的经营分析报告」

支持多轮追问，例如：

* 「六月各品类的销售额」

* 「增长TOP 5 品类是哪些」

* 「复盘增长原因」

输入后，AI 将返回结构化分析结果（图表、表格、文本结论）。

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085646.png)

### 四、获取分析结果

根据用户的问题，生成分析结果。

* 图表和解读文字：获取数据并可视化呈现。![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085634.png)![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085629.png)

* html报表：可视化呈现本次分析结论，常用于一次性的探索分析、个性化报表制作。

  ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085639.png)
* 分析报表：支持动态更新、筛选和联动下钻分析，常用于需要定期刷新数据，组织内协同分享数据的场景。

  ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085648.png)
* 文档报告：基于图表和解读文字，可生成文档式分析结果，支持高自由度的文档编辑。

  ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085645.png)

### 五、消费分析结果

* **分享**：对话结果可分享，支持私密分享和公开分享，可配置分享有效期。

  ![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085643.png)
* **保存** ：对于文档和分析报表，可单击右上角的**保存到我的分析** ，将结果沉淀到个人作品库。![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085649.png)

* **订阅** ：通过对话方式设置订阅任务，AI Pro将定时执行并推送最新结果。支持手动修改推送频率与推送渠道。![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085628.png)

* **下载**：对于html报表和文档报告，支持下载为本地文件。

## 模块说明
Quick BI AIPro 由以下模块组成，覆盖「个人使用 → 企业资产 → 管理配置」全链路。
<table> <thead> <tr> <td><p><b>视图</b></p></td> <td><p><b>模块</b></p></td> <td><p><b>核心作用</b></p></td> <td><p><b>主要用户</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p>我的</p></td> <td><p>新建任务</p></td> <td><p>自然语言驱动 AI 分析，产出图表/报告/PPT</p></td> <td><p>业务用户</p></td> </tr> <tr> <td><p>我的</p></td> <td><p>我的分析</p></td> <td><p>沉淀个人分析作品，支持二次编辑与分享</p></td> <td><p>业务用户</p></td> </tr> <tr> <td><p>我的</p></td> <td><p>我的订阅</p></td> <td><p>管理定时推送任务，支持多渠道分发</p></td> <td><p>业务用户</p></td> </tr> <tr> <td><p>我的</p></td> <td><p>我的数据</p></td> <td><p>管理个人上传的数据文件与数据资产</p></td> <td><p>业务用户</p></td> </tr> <tr> <td><p>企业</p></td> <td><p>数据广场</p></td> <td><p>浏览企业已开放的数据集、数据表、文件、API 数据</p></td> <td><p>全员</p></td> </tr> <tr> <td><p>企业</p></td> <td><p>技能广场</p></td> <td><p>浏览企业发布的 AI 分析技能，一键启用后可在对话中使用</p></td> <td><p>全员</p></td> </tr> <tr> <td><p>企业</p></td> <td><p>MCP 广场</p></td> <td><p>浏览企业已接入的 MCP 连接器，扩展 AI 分析边界</p></td> <td><p>全员</p></td> </tr> <tr> <td><p>管理中心</p></td> <td><p>AIPro 管理</p></td> <td><p>数据、知识、技能、MCP的配置</p></td> <td><p>组织管理员、具备AIPro模块的管理角色</p></td> </tr> <tr> <td><p>管理中心</p></td> <td><p>角色配置</p></td> <td><p>组织角色与权限管理</p></td> <td><p>组织管理员</p></td> </tr> <tr> <td><p>组织管理</p></td> <td><p> Credit 管理</p></td> <td><p>查看 AI 算力包余额与消耗明细</p></td> <td><p>组织管理员 </p></td> </tr> </tbody> </table>

## 更多能力
完成基础配置与对话后，您可以进一步探索以下高级能力：

**自由画布**：将多个对话中的图表、表格、结论卡片拖拽到画布上，自由排布组合，形成主题分析看板。画布支持生成为 HTML 快照、报表、PPT。

**定时订阅推送**：将任意分析结果转为订阅任务，选择推送频率（每日、每周、每月、Cron 表达式）与推送渠道（邮件、钉钉、飞书群、Webhook），AI 将定期执行并推送最新数据快照。

**PPT 演示文稿生成**：基于数据资产的分析结果生成 PPTX 文件，可直接用于业务汇报。

## 常见问题
**Q1：业务用户登录后看不到 AIPro 入口？**

请确认用户类型为开发者或分析师，可以联系组织管理员分配对应席位。

**Q2：@ 选择数据时列表为空？**

请确认**我的数据**中至少有一个数据资产文件，且已经完成导入后的学习。

**Q3：对话中提示「额度不足」？**

您的个人月度 Credit 已耗尽，请联系组织管理员申请额外配额，或等待下一个计费周期。

**Q4：AI 返回的结果与业务口径不一致？**

可联系管理员配置企业知识。也可以配置个人知识，对分析结果满意后，可应用于企业知识。

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085636.png)

<br />

**Q5：如何将分析结果自动推送到个人邮箱、钉钉？**

在**我的订阅** 中打开**指定用户推送**，配置推送人。

![image.png](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5364133871/p1085642.png)