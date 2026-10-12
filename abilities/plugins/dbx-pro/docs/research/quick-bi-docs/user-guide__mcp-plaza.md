MCP（Model Context Protocol）连接器是Quick BI AIPro中AI与外部工具/数据源之间的桥梁。通过 MCP连接器，您可以将外部系统的数据和能力接入AI分析流程，扩展平台的分析范围。在MCP广场中，您可以按需查看、搜索企业内已导入的MCP连接器，并将其添加到[新建任务](https://help.aliyun.com/document_detail/3045426.html)对话框中使用。本文将为您介绍具体操作步骤。  

## **前提条件**
* **版本购买**：您所在的组织已购买Quick BI AIPro版本。

* **权限配置** ：您至少拥有Quick BI AIPro的**基础功能**权限。

* **MCP发布** ：管理员已在管理中心导入了MCP连接器，并授权于您使用。具体操作说明请参见[MCP管理](https://help.aliyun.com/document_detail/3045441.html)。

## 功能入口
在Quick BI AIPro的**企业** 页签下，点击左侧导航栏中的**MCP广场** 。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8783518871/p1086148.png)

## 操作说明
在**MCP广场**页面中，展示了企业内已配置且您有权限使用的MCP连接器，您可以在此查看各连接器的名称、功能描述等信息，并按需进行相关操作。

1. **查看并搜索MCP连接器** ：在卡片列表中快速浏览并查找所需MCP连接器。当连接器的数量较多，无法快速浏览查找时，您可以在搜索框中输入连接器名称的关键词，以快速筛选和定位目标连接器。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2252204871/p1086168.png)

2. **操作MCP连接器** ：支持在此对MCP连接器进行以下操作。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2252204871/p1086161.png)

   <table> <thead> <tr> <td><p><b>可进行的操作</b></p></td> <td><p><b>说明</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p>① 添加到对话</p></td> <td><p>找到合适的 MCP 连接器后，将鼠标悬浮至该连接器并单击<b>添加到对话</b>按钮，即可将连接器的能力注入到新建任务对话框中，赋予大模型调用外部工具的能力。</p> <div> <div> <i></i> </div> <div> <strong>说明 </strong> <ul> <li><p>需 OAuth 授权的连接器在完成个人授权前不显示该按钮，请先按下方<b>授权并安装</b>完成授权。</p></li> <li><p>OAuth 授权的授权主体是您本人，管理员在管理中心导入连接器时不会代为授权。</p></li> </ul> </div> </div><p><img></p></td> </tr> <tr> <td><p>② 授权并安装</p></td> <td><p>部分 MCP 连接器调用第三方服务时需要 OAuth 授权，此类连接器的主按钮显示为<b>授权并安装</b>。单击后系统新开授权页面，您需要在该页面中以本人身份完成授权。授权成功后单击<b>返回MCP广场</b>，卡片标题旁显示<b>已安装</b>标签，主按钮恢复为<b>添加到对话</b>，即可正常添加到对话使用。</p></td> </tr> <tr> <td><p>③ 查看</p></td> <td><p>鼠标悬浮至某一MCP连接器，并点击<b>查看</b>按钮，即可在<b>连接器详情</b>弹窗中查看当前连接器的名称、功能描述、创建时间、更新时间等信息。<img></p></td> </tr> </tbody> </table>  
   **说明**