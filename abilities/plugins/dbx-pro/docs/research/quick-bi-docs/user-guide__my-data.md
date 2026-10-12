**我的数据**是 Quick BI AIPro 的个人数据资产管理空间。您可以在此添加、管理、分享个人数据文件，并对数据进行预学习以提升 AI 分析的准确性。  

## **前提条件**
* 您已登录 Quick BI AIPro。

* 如需添加企业数据资产，需管理员提前完成数据授权。

## 功能入口
登录 Quick BI AIPro，进入**我的** \>**我的数据**。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7658025871/p1090758.png)

## 新建文件夹
单击**新建文件夹** 按钮，输入**文件夹名称** 并单击**确定**。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5631204871/p1086407.png)

## 添加数据
单击右上角**添加数据** 按钮，通过**企业数据广场** 、**本地上传** 、**API数据**这三个渠道添加您的数据。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7658025871/p1090759.png)

### 企业数据广场

企业数据广场集中展示企业内部所有的数据集、仪表板、数据表组合、文件等各类数据资产，并支持用户按需申请权限；同时，可通过切换空间，查看相应空间下的数据内容。

您可以按需添加到**我的数据** 中使用。具体操作请参见[数据广场](https://help.aliyun.com/document_detail/3045433.html)。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5631204871/p1086418.png)

### 本地上传

支持将本地文件上传至Quick BI AIPro的数据资产，适用于需要基于本地文件快速发起分析的场景，例如：对第三方平台中导出的Excel文件发起分析。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7658025871/p1090761.png)

具体操作步骤如下：

1. 在**本地文件**弹窗中，点击或将需要上传的文件拖拽到相应区域中。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7658025871/p1090762.png)  
   **说明**
   * 支持上传Excel、CSV、PDF、Word、Markdown、TXT、图片等多种文件格式。

   * 单文件大小限制50MB以内。

2. 支持上传多个文件。

   **说明**

   单次最多上传10个本地文件。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7658025871/p1090763.png)

   此处展示了当前已选中并准备上传的文件队列。当队列中存在误选或不再需要使用的文件时，您可以通过点击该文件右侧的![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5631204871/p1086286.png)图标移除。
3. 选择**添加到**目标文件夹。默认为根目录，支持选择已有文件夹进行归类整理。

4. 单击**确认**完成上传。系统将自动对当前上传文件进行学习，学习成功后，您可以基于该数据资产发起分析任务等操作。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7658025871/p1090764.png)

   若学习失败或数据有更新时，您可以进行**重新学习**。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7658025871/p1090765.png)

### API数据

API数据即为通过API接口接入的外部数据资产，适用于需要对接第三方系统数据的场景，例如：通过API接口拉取CRM系统中的最新客户跟进记录。

您可以在对话框里输入需要连接的 API 地址或文档。连接前，请检查API 端口，并添加IP 白名单列表。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5631204871/p1086412.png)

具体操作步骤如下：

1. 在**连接API数据** 弹窗中的输入框中，输入您想要连接的API地址或文档，点击![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5631204871/p1086329.png)图标发送，智能助手小Q即会自动解析该API中的连接参数并帮您尝试连接。

   **说明**

   连接前，请检查API端口，并添加IP白名单列表。
   * 仅支持以下端口：443、80、3306、465、587、5432、7001。

   * 您需将Quick BI不同网络环境下的IP地址段添加至 API 的白名单：47.101.108.0/24、101.132.48.0/24、47.101.107.0/24、139.224.92.0/24、139.224.4.0/24、106.15.146.0/24、106.15.145.0/24、106.15.143.0/24、106.15.14.0/24、106.15.13.0/24、11.193.48.0/24、11.197.244.0/24、10.152.69.0/24、10.152.163.0/24、100.104.0.0/16。

   支持**语音输入** 和**实时对话**。
   * 单击![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5631204871/p1086110.png)图标可进行**语音输入**。

   * 单击![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5631204871/p1086111.png)图标可进行**实时对话**。

2. 执行完毕后，小Q会为您输出连接方案及当前接口返回的字段清单，您可以在当前对话框中进行确认，无误后即可为当前API数据设置**名称** 及**保存路径** ；若方案存在需要修改的地方，也可以通过与小Q对话的方式对已生成的方案内容进行进一步调整。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5631204871/p1086360.png)

3. 点击**确认保存**即可执行连接操作。系统将对当前API数据进行学习，建议等系统完成学习后再基于该数据资产发起分析任务等操作。

## 查看和管理数据
* 支持通过**关键词搜索** 数据资源。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5631204871/p1086433.png)

* 支持通过**筛选资产类型** 和**资产分类**快速定位到您想要查看的数据资源。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5631204871/p1086434.png)
  * **资产类型**包括：文档、Excel、CSV、图片、PDF、Markdown、TXT、数据集、仪表板、API数据、数据表等多种文件格式。

  * **资产分类**包括：企业资产、个人添加、分享给我。

* 支持查看数据的资产类型、资产分类、所属空间、来源、所有者、学习状态等信息，并进行以下操作。

  **说明**

  目前仅**个人添加的数据资产** 支持**分享** 和**重命名**操作。

  ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/4183264871/p1088505.png)
  <table> <thead> <tr> <td><p><b>序号</b></p></td> <td><p><b>操作项</b></p></td> <td><p><b>说明</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>①</b></p></td> <td><p><b>预览</b></p></td> <td><p>不同类型的数据资产预览效果不同，具体效果参考如下：</p> <ul> <li><p><b>数据表</b></p><p><img></p><p>支持预览当前数据的明细，包括<b>数据预览</b>和<b>字段详情</b>。</p> <div> <div> <i></i> </div> <div> <strong>说明 </strong> <p>最多预览前100行数据。</p> </div> </div></li> <li><p><b>仪表板</b></p><p><img></p></li> <li><p><b>本地文件</b></p><p><img></p></li> <li><p><b>API数据</b></p><p><img></p></li> </ul></td> </tr> <tr> <td><p><b>②</b></p></td> <td><p><b>去分析</b></p></td> <td><p>单击后自动勾选当前数据并跳转到新建任务页面。</p><p><img></p></td> </tr> <tr> <td><p><b>③</b></p></td> <td><p><b>分享</b></p></td> <td><p>将数据<b>分享</b>给其他用户。</p><p>仅<b>个人添加</b>的文件和API数据支持分享，从数据广场中添加的数据资产不支持分享。</p><p><img></p><p>分享后，支持<b>取消分享</b>。</p><p><img></p></td> </tr> <tr> <td><p><b>④</b></p></td> <td><p><b>重命名</b></p></td> <td><p><b>重命名</b>当前文件名称。</p><p><img></p></td> </tr> <tr> <td><p><b>⑤</b></p></td> <td><p><b>移动到</b></p></td> <td><p>支持将当前数据<b>移动到</b>其他目标文件夹。</p><p><img></p></td> </tr> <tr> <td><p><b>⑥</b></p></td> <td><p><b>重新学习</b></p></td> <td><p>数据添加成功后会自动进行学习，若学习失败或数据有更新时，您可以进行重新学习。</p><p>单击<b>重新学习</b>按钮后，在弹出的二次确认框中单击<b>确定</b>，系统将重新学习当前数据。</p><p><img></p></td> </tr> <tr> <td><p><b>⑦</b></p></td> <td><p><b>删除文件</b></p></td> <td><p>单击<b>删除</b>按钮并在弹出的二次确认框中单击<b>确定</b>，当前数据将被删除。</p><p><img></p></td> </tr> <tr> <td><p><b>⑧</b></p></td> <td><p><b>批量操作</b></p></td> <td><p>支持勾选多个或全部数据集进行<b>移动到、重新学习、删除</b>等操作。</p><p><img></p></td> </tr> </tbody> </table>