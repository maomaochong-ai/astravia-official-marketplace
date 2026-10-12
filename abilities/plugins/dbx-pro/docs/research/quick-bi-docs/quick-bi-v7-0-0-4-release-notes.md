<br />

## **发布日期**
2026年9月15日

## 本期概览
本期一句话概览：**AIPro 围绕技能管控与对话体验持续升级：管理员可统一管理内置技能，文件预览支持多 Tab 对照，产品使用问题可直接查到帮助手册答案，Skill 与 MCP 支持一键安装到外部 Agent；数据源方面，RedShift 支持 VPC 内网连接，窗口函数支持 ADB for MySQL 3.0 数据源**。

### 本期亮点

1. **内置技能可管可控**：管理员可以在管理中心的技能管理中统一设置内置技能的启用状态与可见范围，企业可按需控制向组织成员开放哪些内置能力。

2. **文件预览支持多 Tab 切换**：对话中打开多个文件预览时，每个产物以独立 Tab 展示，可快捷切换对照，多产物对比查看更方便。

3. **产品问题直接查手册**：想「了解 AIPro 怎么用」时直接提问，即可获得基于产品帮助手册的解答并附原文链接，上手更快。

## Quick BI AIPro 功能更新
### 问数与对话

* **文件预览支持多 Tab 切换** ：在对话中连续打开多个文件预览时，每个文件以独立 Tab 展示，可单击 Tab 快捷切换对照不同产物；关闭预览即全部清空，界面不堆积。AI 报表产物的 Tab 会带上版本号后缀（如「零售销售分析 V1」），方便区分版本。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4040849871/p1102314.png)

* **思考过程展示召回的资产** ：对话作答时，思考过程中会展示 AI 参考了哪些数据资产，单击即可预览对应数据集或仪表板，回答依据更透明、更可信。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4040849871/p1102179.png)

* **内置产品功能答疑能力**：当您想了解产品能力、操作步骤、计费规则或版本差异时（如「如何把对话中的分析结果保存为作品？」），直接提问即可获得基于产品帮助手册的结构化解答，并附手册原文链接便于深入查阅。

  ![产品帮助手册技能命中效果：结构化答案与手册原文链接](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4040849871/p1102189.png)
* **分析主题配置的资产状态自动更新**：当分析主题引用的数据集、仪表板等来源被删除或下线时，主题内会同步移除或标记不可用，关联知识以飘红提示，避免继续看到失效内容；在 Quick BI 中删除仪表板或数据集后，AIPro 中对应的个人资产也会同步清理，无需手工维护。

* **会话生命周期管理**：公共云环境历史会话保留近 180 天内有消息的会话；超过 180 天没有新消息的会话会自动从历史记录中移除，会话中已保存的产物不受影响，仍可正常使用。

  ![历史记录会话保留提醒](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8530849871/p1102155.png)

  请参见[对话模式](https://help.aliyun.com/document_detail/3045431.html)。

### 我的订阅

* **定时任务推送卡片支持 Markdown 表格** ：定时任务推送到群聊的分析结果卡片支持渲染 Markdown 表格，推送内容中的数据以表格形式呈现，结构清晰易读。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4040849871/p1102306.png)

### 知识广场

* **我的记忆支持清除单条**：在个人中心的「我的记忆」中，可逐条清除不再需要的记忆，操作前二次确认防止误删，记忆管理更精细。

  ![我的记忆单条清除入口与二次确认](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8830849871/p1102067.png)

  请参见[Quick BI AIPro概述](https://help.aliyun.com/document_detail/3045450.html)。

### 管理后台

适用对象：平台管理员 / 数据管理员

* **内置技能纳入技能管理**：管理员进入管理中心的「技能管理」，即可看到置顶展示的系统内置技能（创建人显示为「官方」），并设置启用状态与可见范围。技能被停用或收窄可见范围后，相关用户的技能列表中该技能显示为已强制下线、不可使用，企业可按需控制向组织成员开放的内置能力。

  ![技能管理中的内置技能](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5730849871/p1102209.png)

  请参见[技能管理](https://help.aliyun.com/document_detail/3045440.html)、[我的技能](https://help.aliyun.com/document_detail/3045430.html)。
* **运营管理支持包含完整消息问答的快照**：运营管理员在「运营管理」中单击用户问题，即可查看问答快照。

  ![运营管理页面中「问题」列的问答文字链](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5630849871/p1102226.png)

  请参见[运营管理](https://help.aliyun.com/document_detail/3045442.html)。

### 开放与接入

* **AIPro Skill 与 MCP 支持一键安装** ：在**个人设置** 中单击**获取个人识别码** ，在打开的**个人识别码**面板中，Skill 卡片和 MCP 卡片新增「一键复制」入口，安装文案即复制到剪贴板，直接粘贴到目标 Agent 客户端的对话中，即可自动完成安装与密钥配置，无需手工填写参数；能力范围覆盖问数、AI 报表（可视化报表）与文档报告生成。

  ![个人识别码区域 Skill/MCP 一键复制入口](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2930849871/p1102157.png)

  请参见[AIPro Skill操作手册](https://help.aliyun.com/document_detail/3055222.html)。

## Quick BI 功能更新
### 数据源

* **RedShift 数据源支持 VPC 内网连接** ：创建 RedShift 数据源时支持选择 VPC 内网连接，可绑定 VPC 实例或传统型负载均衡 CLB，部署在专有网络内的数据库无需暴露公网即可接入分析。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4040849871/p1102284.png)

  请参见[AWS数据源RedShift](https://help.aliyun.com/document_detail/2873024.html)。

### 数据集

* **窗口函数新增支持 ADB for MySQL 3.0 数据源**：排名、偏移、首尾值等常用窗口计算可直接在 ADB 3.0 数据集上配置使用。

  请参见[窗口函数](https://help.aliyun.com/document_detail/3049855.html)。

### 平台与生态

* **数据集详情开放接口增强**：数据集详情开放接口（QueryDatasetInfo）新增返回合并表的物理表属性，通过 OpenAPI 集成时可获取更完整的数据集结构信息。

  请参见[查询数据集信息](https://help.aliyun.com/document_detail/415144.html)。