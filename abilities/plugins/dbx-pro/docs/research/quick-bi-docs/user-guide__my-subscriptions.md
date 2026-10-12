**我的订阅**是 Quick BI AIPro 的定时分析任务管理模块。您可以将重要的分析设置为定时执行任务，系统将按照您设定的频率自动运行分析，并通过多种渠道推送结果。本文将为您介绍如何创建并管理我的订阅。  

## **功能入口**
登录 Quick BI AIPro，进入**我的** \>**我的订阅**。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0331204871/p1086530.png)

## 创建定时任务
### 通过界面创建

1. 单击**创建定时任务**按钮。

2. 在创建订阅任务界面，配置以下信息。

   ![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6093264871/p1088477.png)
   <table> <thead> <tr> <td><p><b>配置项</b></p></td> <td><p><b>说明</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>任务名称</b></p></td> <td><p>自定义任务名称。</p></td> </tr> <tr> <td><p><b>执行计划时间</b></p></td> <td><p>设置订阅任务的执行时间。</p><p><img></p></td> </tr> <tr> <td><p><b>任务描述</b></p></td> <td><p>用自然语言描述您想让分析助手定期执行的分析任务。支持选择需要分析的<b>数据资产（①）</b>、<b>技能（②）、联网搜索（③）</b>及<b>大模型（④）</b>。<img></p> <div> <div> <i></i> </div> <div> <strong>说明 </strong> <p>仅公共云环境支持联网搜索，独立部署环境暂不支持。</p> </div> </div></td> </tr> <tr> <td><p><b>指定用户推送</b></p></td> <td><p>支持将订阅任务推送到<b>钉钉</b>、<b>飞书</b>、<b>企微</b>及<b>邮件</b>。其中，钉钉、飞书、企微渠道支持推送至<b>个人</b>和<b>群组</b>。</p></td> </tr> </tbody> </table>

### 通过对话创建

1. 输入创建订阅相关的指令。

   例如，输入："每天早上9点推送这个分析结果给我"。系统将自动创建订阅。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6093264871/p1088425.png)
2. 创建完成后可在"**我的订阅** "模块中进行查看和管理。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0331204871/p1086297.png)

## 管理定时任务
您可以在**定时任务**页面，进行以下操作。

![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0331204871/p1086357.png)
<table> <thead> <tr> <td><p><b>序号</b></p></td> <td><p><b>操作项</b></p></td> <td><p><b>说明</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>①</b></p></td> <td><p><b>开启定时任务</b></p></td> <td><p>开启时，订阅任务将正常执行；若您无需定时执行，可关闭该按钮。</p></td> </tr> <tr> <td><p><b>②</b></p></td> <td><p><b>编辑任务</b></p></td> <td><p>编辑当时的订阅任务。</p></td> </tr> <tr> <td><p><b>③</b></p></td> <td><p><b>执行记录</b></p></td> <td><p>点击查看执行记录。</p><p><img></p></td> </tr> <tr> <td><p><b>④</b></p></td> <td><p><b>立即执行</b></p></td> <td><p>立即执行当前订阅任务。</p></td> </tr> <tr> <td><p><b>⑤</b></p></td> <td><p><b>删除</b></p></td> <td><p>点击<b>删除</b>并在弹出的二次确认框中单击<b>确认</b>后，删除当前订阅任务。</p><p><img></p></td> </tr> </tbody> </table>

## 查看执行记录
除了在**钉钉** 、**飞书** 、**企微** 及**邮件** 等渠道中接收订阅消息外，您还可以通过以下方式查看**执行记录**：

* 您可以在**我的订阅** \>**执行记录**中查看。

  * 单击进入**执行记录** 页面。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0331204871/p1086366.png)

  * 您可以通过**筛选任务名称** 、**执行时间** 及**状态** ，快速定位到您想要查看的执行记录。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0331204871/p1086367.png)

  * 在**执行记录** 页面，您可以选择执行记录并进行以下操作。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/0331204871/p1086365.png)

    <table> <thead> <tr> <td><p><b>序号</b></p></td> <td><p><b>操作项</b></p></td> <td><p><b>说明</b></p></td> </tr> </thead> <colgroup></colgroup> <colgroup></colgroup> <colgroup></colgroup> <tbody> <tr> <td><p><b>①</b></p></td> <td><p><b>查看对话</b></p></td> <td><p>点击查看对应订阅的对话记录。</p></td> </tr> <tr> <td><p><b>②</b></p></td> <td><p><b>重新执行</b></p></td> <td><p>重新执行该订阅任务。</p></td> </tr> <tr> <td><p><b>③</b></p></td> <td><p><b>复制TraceId</b></p></td> <td><p>复制当前执行记录的Trace_ID。</p></td> </tr> </tbody> </table>
* 您也可以在**历史记录** \>**订阅** 中进行查看。![image](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6093264871/p1088480.png)