Quick BI AIPro支持添加MCP（Model Context Protocol）连接器作为AI与外部工具/数据源之间的连接桥梁，从而扩展AI的能力边界。在**我的MCP** 页面中，展示了**我安装的** 企业MCP与**我创建的**个人MCP，支持在此按需进行添加及管理操作。本文将为您介绍具体操作步骤。  

## **功能入口**
在Quick BI AIPro的**我的** 页签下，点击左侧导航栏**我的扩展** ，并将右侧页面切换至**我的MCP** 。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1587035871/p1088433.png)

您可以通过切换以下页签，查看不同来源的MCP连接器：

* **全部** 页签下，展示了**我创建的** 个人MCP与**我安装的**企业MCP。

* **我安装的**页签下，展示了从MCP广场安装的企业MCP。

* **我创建的**页签下，展示了自建的个人MCP。

## 我安装的
[MCP广场](https://help.aliyun.com/document_detail/3045436.html)中展示了当前账号可见的企业级通用MCP，您可以挑选实际分析业务需要使用到的MCP连接器，并安装到**我的MCP**中。安装完成后，您可以进行以下操作：

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1587035871/p1088729.png)
<table> <thead> <tr> <td><p><b>可进行的操作</b></p></td> <td><p><b>说明</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p>① 添加到对话</p></td> <td><p>将鼠标悬浮至需要使用的连接器卡片并点击<b>添加到对话</b>按钮，即可将该连接器的能力注入到新建任务对话框中。</p><p><img></p> <div> <div> <i></i> </div> <div> <strong>说明 </strong> <p>您也可以点击分析对话框工具栏中的<img>图标，在下拉选项列表中选择已启用的企业MCP。<img></p> </div> </div></td> </tr> <tr> <td><p>② 查看</p></td> <td><p>点击<b>查看</b>按钮，即可在<b>连接器详情</b>弹窗中查看当前连接器的名称、功能描述、创建时间、更新时间等信息。<img></p></td> </tr> <tr> <td><p>③ 卸载</p></td> <td><p>选择<b>卸载</b>操作，二次确认后即可移除不再需要使用的连接器。</p></td> </tr> <tr> <td><p>④ 启用状态</p></td> <td><p>连接器安装后默认为启用状态，您可以通过连接器卡片右上角的启用开关调整。</p> <div> <div> <i></i> </div> <div> <strong>说明 </strong> <p>被管理员强制下线的企业MCP，将显示为<b>强制下线</b>状态，开关置灰且不可自行启用。</p> </div> </div></td> </tr> </tbody> </table>

## 我创建的
AIPro面向分析师及技术型用户，提供了个人MCP自主创建与管理能力。当您拥有一个非组织级通用化、仅服务于个人工作流的自建MCP，希望可以在新建任务对话框中直接调用时，可以在**我的MCP**页面下添加。添加后的个人MCP将仅当前账号可见，不纳入企业级资产管理。具体操作步骤如下。  
**说明**

单个用户最多可创建50个MCP连接器。

1. 单击页面右上角的**添加MCP** 按钮。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1587035871/p1088743.png)

2. 在**添加MCP** 弹窗中，配置待添加连接器的相关信息。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1587035871/p1088744.png)

   <table> <thead> <tr> <td><p><b>配置内容</b></p></td> <td><p><b>说明</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p>① 连接器名称</p></td> <td><p>输入当前连接器的名称，用于标识该连接器。您可以输入连接器的实际业务用途，例如：Excel助手、文档智能助理。</p></td> </tr> <tr> <td><p>② 连接器描述</p></td> <td><p>输入当前连接器的描述信息，例如：功能作用、业务意义或使用事项等辅助说明内容。</p></td> </tr> <tr> <td><p>③ 配置JSON</p></td> <td><p>输入当前连接器的配置JSON，支持<b>SSE</b>和<b>Streamable HTTP</b>两种模式。 </p> <ul> <li><p><b>SSE</b>：即基于HTTP长连接，由服务器单向给客户端推送事件消息。适用于需要服务端推送数据、远程部署、多客户端共享服务等场景。配置示例代码如下。</p><pre>HELPCODEESCAPE-json<br>// SSE example:<br>{<br> "mcpServers": {<br> "sse-server-example": {<br> "url": "http://localhost:8080/sse"<br> }<br> }<br>}</pre></li> <li><p><b>Streamable HTTP</b>：即基于标准HTTP协议，通过统一的端点和会话机制实现的双向流式通信，且服务端无需维持长连接状态。适用于企业级生产环境、分布式部署、网络环境存在不稳定性等场景。配置示例代码如下。</p><pre>HELPCODEESCAPE-json<br>// Streamable HTTP example:<br>{ "httpUrl": "https://example.com/mcp" }</pre></li> </ul></td> </tr> </tbody> </table>
3. 单击**测试连接**，系统将校验配置并测试连通性。您可以根据不同的测试结果，进行相应操作。

   <table> <thead> <tr> <td><p><b>测试连接结果</b></p></td> <td><p><b>需进行的操作</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p>测试通过</p></td> <td><p>单击<b>创建</b>即可保存该连接器。保存后连接器默认为<b>启用</b>，且连接器的连接状态显示为<b>已连接</b>。</p></td> </tr> <tr> <td><p>测试失败</p></td> <td><p>系统将返回具体的失败原因，您可以根据提示修正配置后重新测试连接。测试未通过前将无法保存当前连接器。</p></td> </tr> <tr> <td><p>待授权</p></td> <td><p>对于需要用户级OAuth授权后才能使用的连接器，点击<b>创建</b>按钮后，系统将保存该连接器并自动新开授权页面，您需要在该页面中以本人身份完成授权。</p><p>授权成功后，单击<b>返回我的MCP</b>，该连接器的连接状态更新为<b>已连接</b>。</p> <div> <div> <i></i> </div> <div> <strong>说明 </strong> <p>未完成授权时，连接器卡片的连接状态显示为<b>待授权</b>，该连接器无法在新建任务对话框中选择。 </p> </div> </div></td> </tr> </tbody> </table>
4. （可选）您可以在**我创建的**页签下，对已添加的个人MCP连接器，进行以下操作：

   <table> <thead> <tr> <td><p><b>可进行的操作</b></p></td> <td><p><b>说明</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p>① 添加到对话</p></td> <td><p>将鼠标悬浮至需要使用的连接器卡片并点击<b>添加到对话</b>按钮，即可将该连接器的能力注入到新建任务对话框中。</p> <div> <div> <i></i> </div> <div> <strong>说明 </strong> <p>您也可以点击分析对话框工具栏中的<img>图标，在下拉选项列表中选择已启用的个人MCP。<img></p> </div> </div></td> </tr> <tr> <td><p>② 查看</p></td> <td><p>点击<b>查看</b>按钮，即可在<b>连接器详情</b>弹窗中查看当前连接器的名称、功能描述、配置JSON、创建时间等信息。<img></p></td> </tr> <tr> <td><p>③ 更多操作</p></td> <td><p>点击连接器卡片右下角的<img>图标，在下拉选项列表中进行以下操作。</p> <ul> <li><p>选择<b>编辑</b>操作，在<b>编辑连接器</b>弹窗中修改连接器的配置信息。</p></li> <li><p>选择<b>删除</b>操作，二次确认后即可移除不再需要使用的连接器。</p></li> </ul></td> </tr> <tr> <td><p>④ 启用状态</p></td> <td><p>连接器安装后默认为启用状态，您可以通过连接器卡片右上角的启用开关调整。</p></td> </tr> <tr> <td><p>⑤ 连接状态</p></td> <td><p>卡片右上角显示当前连接器的连接状态。</p> <ul> <li><p><b>已连接</b>表示可直接在新建任务对话框中使用。</p></li> <li><p><b>待授权</b>表示该连接器采用 OAuth 授权且您尚未完成个人授权，单击<b>去授权</b>完成授权后状态更新为<b>已连接</b>。</p></li> </ul></td> </tr> </tbody> </table>