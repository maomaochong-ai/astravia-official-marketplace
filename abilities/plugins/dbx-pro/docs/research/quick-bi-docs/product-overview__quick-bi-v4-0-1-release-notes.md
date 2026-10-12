## 发布日期
2021年07月29日

## 功能概览
* 可视化分析能力增强
  * 富文本支持多数据集指标字段，让备注能力更加丰富，灵活可配置。
  * 增加电子表格按区块着色，满足个性化绘图需求。
  * 交叉表、电子表格新增小计函数，计算便捷。
* 平台管理加强
  * 安全配置支持设置默认导出类型，带格式、不带格式数据均可支持。

## 变更内容
* 仪表板
  * 仪表板的最多支持放置图表、Tab、富文本及查询控件等的个数由100个增加至200个。请参见[一个仪表板最多支持放置多少个图表？](https://help.aliyun.com/document_detail/50645.html#section-ary-50g-ru1)
  * 优化坐标轴显百分比小数位个数显示。  
    涉及的图表为百分比堆积面积图、堆积面积图、堆积柱状图、百分比堆积柱状图、堆积条形图、百分比堆积条形图、组合图。示例图如下。 <table> <caption></caption> <colgroup> <col> <col> <col> </colgroup> <thead> <tr> <th>图表</th> <th>优化前</th> <th>优化后</th> </tr> </thead> <tbody> <tr> <td>堆积图</td> <td><img></td> <td><img></td> </tr> <tr> <td>百分比堆积图</td> <td><img></td> <td><img></td> </tr> </tbody> </table>
  * 富文本的指标支持从多个数据集中获取，请参见[富文本](https://help.aliyun.com/document_detail/111273.html#concept-t24-rwb-dhb "富文本可以输入固定文本，也支持插入指标，实时呈现指标变化情况，便于大促实时播报、周报邮件订阅、自动生成数据报告等场景。本文为您介绍如何添加并设置富文本控件。")。 <table> <caption></caption> <colgroup> <col> <col> </colgroup> <thead> <tr> <th>优化前</th> <th>优化后</th> </tr> </thead> <tbody> <tr> <td><img></td> <td><img></td> </tr> </tbody> </table>
  * Story Builder新增故事节点编辑入口，请参见[Story Builder](https://help.aliyun.com/document_detail/184196.html#concept-t24-rwb-dhb "Story Builder可以将仪表板中已创建的图表故事线展示，通常用于展示单个报表中的分析思路。本文为您介绍如何添加并配置Story Builder控件。")。

    当选择组件位置为右侧纵向时，新增故事节点编辑的入口。
    <table> <caption></caption> <colgroup> <col> <col> </colgroup> <thead> <tr> <th>优化前</th> <th>优化后</th> </tr> </thead> <tbody> <tr> <td><img></td> <td><img></td> </tr> </tbody> </table>
* 在安全配置中支持设置默认导出类型，方便您在导出交叉表时，选择是否保留表格样式。![导出格式](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5086737261/p295559.png)请参见[导出控制](https://help.aliyun.com/document_detail/172232.html#task-2534900 "Quick BI支持导出仪表板或电子表格等的报表。在实际应用时，组织管理员可以在高级版或专业版的群空间下，配置导出的数据类型和渠道。本文为您介绍如何打开并配置图表导出功能。")。
* 电子表格
  * 导出文件时，文件中存在图表支持以图片形式导出。请参见[电子表格配置操作](https://help.aliyun.com/document_detail/101221.html#concept-cwq-g1l-ggb "您可以在电子表格配置区对电子表格进行一系列的配置操作。")。
  * 在展示型配置中，增加单元格按区块着色的功能，满足用户个性化的绘图需求。![区块着色](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5086737261/p296936.png)
  * 总计配置中，分类汇总（列小计）中增加小计函数。![新增小计函数](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5086737261/p297094.png)
* 交叉表中的配置总计中，增加小计函数。![函数小计](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/7756727261/p296816.png)
* 权限功能升级：
  * 行级权限中新增行级权限名称。 添加规则名称后，您可以根据业务需求自定义规则名称，方便您快速找到规则。

    ![行级权限](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5086737261/p298431.png)请参见[类型一：条件组合授权](https://help.aliyun.com/document_detail/286884.html#task-2098116 "当需要限制某些字段的查看范围时，您可以设置行级权限，缩小字段值的可见范围。行级授权模式包含条件组合授权和标签授权两种方式。条件组合授权模式适用于组织成员较少的场景，本文为您介绍如何进行条件组合授权。")。
  * 行级权限和列级权限中新增添加白名单。  
    添加白名单用户后，该用户不受赋权规则影响，具有查询数据集所有字段的权限。 ![行级权限白名单用户](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/5086737261/p298469.png) 请参见[列级权限](https://help.aliyun.com/document_detail/287022.html#task-2098116 "当某些字段值不能透传给用户时，您可以通过设置禁止查看来隐藏目标字段。在仪表板查询字段时，该用户仅可以查看规则范围内的字段值，从而保证数据安全。")。

  **说明** 新版行级权限仅适用于2021年6月3日及之后购买或试用Quick BI的用户，不满足条件的用户请参见 [（旧版）行级权限](https://help.aliyun.com/document_detail/90310.html#concept-evp-hjl-bfb "当需要限制某些字段的查看范围时，您可以通过设置行级权限，缩小字段值的可见范围。在仪表板查询字段时，该用户仅可以查看规则范围内的字段值，从而保证数据安全。Quick BI的行级授权模式包含给用户/用户组授权和标签授权。")。
* 升级开放API。
  * 新增[ListByUserGroupId](https://help.aliyun.com/document_detail/286489.html#doc-api-quickbi-public-ListByUserGroupId "ListByUserGroupId接口用于根据用户组ID批量查询用户组信息。")。
  * 优化[DeleteUser](https://help.aliyun.com/document_detail/184205.html#doc-api-quickbi-public-DeleteUser "DeleteUser接口用于删除指定组织用户。")。