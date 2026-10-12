<br />

## **发布日期**
2026年8月25日

## 本期概览
本期一句话概览：**AI 报表二次编辑与阅读体验全面增强，问数支持消息排队，数据资产可授权给用户组，Credit 额度管理更省心**。

### 本期亮点

1. **AI 报表能力扩展**：支持在报表任意位置插入 AI 文字解读；表格支持开启图表快捷过滤，用于数据快速筛选；每个图表可查看 SQL 取数记录；二次编辑支持连续编辑和多选编辑。

2. **数据资产/数据作品支持授权给用户组**：数据资产、数据作品的授权对象从「单个成员」扩展到「用户组」，一次授权即可覆盖整组成员，权限维护成本大幅降低。

3. **问数支持消息排队**：任务运行过程中可继续发送新消息，系统自动排队接续处理，无需等待上一轮结束，多轮分析更流畅。

## Quick BI AIPro 功能更新
### 问数与对话

* **消息队列与排队管理**：任务运行时可继续发送消息，新消息自动进入队列排队处理，当前任务结束后逐条执行；队列面板支持移除单条、清空和拖拽排序；手动停止或执行出错时，队列转为暂停状态、不再自动执行，输入框回填队首问题，确认后可继续；队列随会话保留，切换会话不影响其执行进度。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1301887871/p1096901.png)

  请参见[对话模式](https://help.aliyun.com/document_detail/3045431.html)。
* **反问会话「待回复」状态提示**：当会话触发反问、等待您回复时，左侧边栏对应会话名称右侧显示「待回复」标记，回复完成后自动消失，多会话场景下可快速识别哪些会话有反问待处理。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1301887871/p1097228.png)

  请参见[对话模式](https://help.aliyun.com/document_detail/3045431.html)。
* **双工语音交互支持语音自动挂断**：实时语音对话中，说出「拜拜」「结束对话」等挂断意图的话术即可自动结束对话，无需手动点击。

* **技能卡片交互优化**：对话中保存后的技能卡片支持点击展开「技能查看」弹窗，查看名称、描述、内容、版本等详情；未保存/已保存状态互斥展示，已保存提示不再长期驻留遮挡内容。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1301887871/p1097229.png)

  请参见[对话模式](https://help.aliyun.com/document_detail/3045431.html)。

### AI 报表

* **文字解读支持放置到任意位置**：AI 报表中的文字解读不再固定位置，支持通过对话放到报表的任意位置，排版更自由。

* **表格默认开启图表快捷过滤**：AI 报表中的表格默认开启快捷过滤，无需额外配置即可对表格数据快速筛选。

* **图表新增 SQL 取数记录**：每个图表右上角「更多」按钮中新增「SQL 取数记录」，可查看该图表的取数 SQL，数据来源更透明、便于排查。

* **二次编辑支持连续编辑和多选编辑**：AI 报表进入编辑态后，可通过批注提出修改需求；支持按住 Shift 选择多个组件后统一编辑。可连续添加多条批注后一次性提交给 AI 执行，适合集中处理多处报表修改。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9589097871/p1098358.png)

  请参见[对话模式](https://help.aliyun.com/document_detail/3045431.html)。
* **查询控件下拉选项支持平铺配置**：AI 报表的查询控件除下拉选择器外，支持配置为胶囊平铺样式，维度值铺开展示、点击即可切换。

### 报告

* **报告编辑器体验优化**：

  * 报告内图表高度支持拖拽自由调节并持久化保存。

  * 报告内智能问答所用的数据资产支持右侧浮窗预览，便于确认数据来源。

### 我的订阅

* **定时任务推送支持截图形式**：定时任务中推送 AI 报表、HTML 和 AI 报告时，会以截图的形式发送到对应的订阅渠道，便于在订阅消息中直接查看内容预览。

  ![定时任务以截图形式推送 AI 报表、HTML 和 AI 报告](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/9589097871/p1098326.png)

  请参见[我的订阅](https://help.aliyun.com/document_detail/3045428.html)。

### 数据资产与知识

* **知识支持批量启用与禁用**：知识管理中支持多选知识后批量启用或禁用（即批量上线/下线知识），执行前弹窗确认并提示本次影响的知识条数，无需逐条操作，知识条目较多时管理效率更高。

  ![知识批量启用与禁用](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1301887871/p1097075.png)
* **我的语义知识页支持搜索与批量操作**：语义知识页面新增搜索框，支持按业务定义、同义词、数据集关联等关键词检索；新增多选功能，支持批量删除、编辑，知识条目多时可快速定位。

* **数据资产工作手册生效范围支持多选数据集**：企业工作手册中编辑「数据资产工作手册」时，生效范围的数据集从单选改为多选，同一段规则可同时生效于多个数据集，配置和维护更省心。

* **知识弹窗与列表展示优化**：通用/专用知识未选择资产来源时仅回显文件夹；已选择资产时增加 hover 提示显示资产来源；专业知识选择单一资产时直接在列表展示，减少冗余信息。

* **数据资产/数据作品支持授权给用户组**：数据资产、数据作品的授权对象支持选择用户组，一次授权覆盖整组成员；同时新增「全部组织成员」选项，可一次性授权给组织内全部成员。

  ![数据资产/数据作品授权给用户组](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1301887871/p1097206.png)

  请参见[数据管理](https://help.aliyun.com/document_detail/3045437.html)、[我的分析](https://help.aliyun.com/document_detail/3045427.html)。

### MCP 管理

* **MCP 测试连通性优化**：MCP 测试连接时，需在沙箱中成功连通并获取到工具列表才判定为连通，否则返回具体报错原因；npx、uvx 类连接器在安装完成后测试连通，不通则判定安装失败。

### 管理后台

**说明**

适用对象：组织管理员和 AIPro 管理员。

* **额度管理优化与样式改造**：Credit 额度管理支持批量修改额度。

  请参见[Credit管理](https://help.aliyun.com/document_detail/3045425.html)。

## Quick BI 功能更新
### 数据建模

* **计算字段支持窗口函数**：数据集计算字段新增 ROW_NUMBER、RANK、DENSE_RANK、LAG、LEAD、FIRST_VALUE、LAST_VALUE 七个窗口函数，组内排名、同比环比等跨行比较指标无需在数据源侧写 SQL 预处理，可直接在计算字段中完成。问数、小Q 问数场景同步适配，支持 MySQL 8.0+、PostgreSQL、ClickHouse、MaxCompute、Oracle、Hive、SQL Server 等数据源。

  请参见[窗口函数](https://help.aliyun.com/document_detail/3049855.html)。
* **数据集字段备注支持只同步链接部分**：数据集字段备注同步到仪表板时新增配置项，可选择只同步备注内容为链接的部分，避免大量非链接备注被一并带出。

  请参见[字段配置](https://help.aliyun.com/document_detail/2883432.html)、[新建并管理工作空间](https://help.aliyun.com/document_detail/61550.html)。

### 数据集

* **数据集列表页支持按 ID 搜索**：数据集列表页支持通过数据集 ID 检索，快速定位目标数据集。

  请参见[管理数据集](https://help.aliyun.com/document_detail/103979.html)。

### 数据准备

* **数据准备支持 Doris 数据源**：数据准备支持 Doris 数据源。

  请参见[数据源高阶功能项支持列表](https://help.aliyun.com/document_detail/2642723.html)。

### 数据源

* **自建 Apache Doris 支持 2.1.4 版本**

  请参见[数据源高阶功能项支持列表](https://help.aliyun.com/document_detail/2642723.html)。
* **E-MapReduce Serverless StarRocks 支持 3.5 版本**

  请参见[数据源高阶功能项支持列表](https://help.aliyun.com/document_detail/2642723.html)。
* **数据源支持转让所有者**：数据源支持将所有者转让给其他成员，人员变动时无需重建数据源。

  请参见[管理数据源](https://help.aliyun.com/document_detail/106545.html)。
* **数据源支持按数据表分配使用权限**：数据表类数据源在协同授权时，可支持分配指定数据表的使用权限，从而满足对不同用户的数据表使用范围进行管理需求。

### 仪表板

* **查询控件条件级联新增双向联动模式**：查询控件的条件级联新增双向联动模式，支持同源数据集内的查询条件相互联动。

  请参见[文本查询控件](https://help.aliyun.com/document_detail/151453.html)、[配置条件级联](https://help.aliyun.com/document_detail/160352.html)。
* **交叉表字段选择面板支持平铺展示**：交叉表的字段筛选面板支持字段分组，可配置为平铺展示全部字段或仅展示默认选中的字段，给报表预览者更自由的字段查看操作。

  请参见[字段配置](https://help.aliyun.com/document_detail/2883432.html)。
* **字段描述链接支持配置打开方式与弹窗大小**：图表字段描述中的链接支持配置打开方式（当前页、新窗口或弹窗）以及弹窗大小。

  请参见[报表配置](https://help.aliyun.com/document_detail/2252060.html)、[配置图表字段](https://help.aliyun.com/document_detail/65847.html)。

### 小Q报告

* **一键生成报告的数据集上限提升至 10 个**：小Q报告在一键生成报告时，可添加的数据集个数上限增加到 10 个。

  请参见[小Q报告创建](https://help.aliyun.com/document_detail/2948531.html)。
* **小Q报告支持按组织大模型配置生效** ：小Q报告功能所使用的大模型，支持按照**组织管理 \> 大模型配置**中所设置的模型生效。

  请参见[大模型配置](https://help.aliyun.com/document_detail/2976346.html)。
* **小Q报告支持导出至飞书文档**：小Q报告支持导出至飞书文档，后续团队成员可基于飞书平台对文件内容进行查阅、编辑等操作，适用于将飞书作为核心办公平台的场景。

  请参见[导出控制](https://help.aliyun.com/document_detail/172232.html)、[小Q报告管理](https://help.aliyun.com/document_detail/2948530.html)。

### 指标监控

* **自定义渠道支持选择指定人及用户组**：指标监控的自定义渠道推送时，支持选择指定人员及用户组作为接收对象。

  请参见[自定义渠道](https://help.aliyun.com/document_detail/390197.html)。

### 办公协同

* **支持记录三方账号最后登录时间**：支持记录级联钉钉、企业微信、飞书等三方账号的最后登录时间。

  请参见[管理组织用户](https://help.aliyun.com/document_detail/103210.html)。
* **支持多套 BI 绑定同个 OA 企业**：支持多套 Quick BI 系统绑定同一个 OA 企业。

### 权限与角色

* **自定义角色可分配企业知识库管理权限**：支持通过自定义角色分配企业知识库的管理权限。

* **普通用户角色的数据集使用权限支持可选**：为普通用户角色配置权限时，数据集使用权限支持按需勾选。

  请参见[角色管理](https://help.aliyun.com/document_detail/2399798.html)。

### 开放能力

* **以下 OpenAPI 更新**

  * QueryOrganizationWorkspaceList 接口返回参数新增 workspaceExportConfig 字段，用于返回工作空间的导出配置。

  * 支持 ListAuthConfigByResource 接口，用于查看资源的协同授权记录。

  * QueryWorks 接口新增全局参数相关字段。

* **JS SDK**

  * 使用嵌入 SDK 在自有门户系统中嵌入仪表板、电子表格、自助取数、即席分析模块时，可支持通过自有门户触发资源导出功能。

    请参见[嵌入JS SDK API](https://help.aliyun.com/document_detail/2883315.html)。