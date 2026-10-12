## 发布日期
2021年09月23日

## 功能概览
* 分析能力
  * 查询控件新增动态函数，支撑更丰富的筛选查询场景。
  * 电子表格新增组内排序，让分析更容易。
* 安全管控 新增水印自定义能力，各类自定义水印均覆盖，让数据更加安全管理。

## 变更内容
### 可视化

* 优化查询控件。  
  查询控件中设置默认值时，新增 动态函数设置。此时客户场景随着时间推移变化时，默认值会根据函数动态变化。 ![动态函数](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1474922361/p326244.png)
* 查询控件的下拉列表中，默认支持从前10000条数据中搜索。当您搜索的数据不在前10000条时，支持从数据库中搜索，满足用户搜索数据量超过10000+的场景。![查询数据](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/1474922361/p326251.png)  
  查询控件的条件配置项在下拉列表中生效情况如下。 <table> <caption></caption> <colgroup> <col> <col> <col> </colgroup> <thead> <tr> <th>展示类型</th> <th>查询方式</th> </tr> <tr> <th>单选</th> <th>多选</th> </tr> </thead> <tbody> <tr> <td>下拉列表（自动解析）</td> <td><img></td> <td><img></td> </tr> <tr> <td>下拉列表（单个数据集）</td> <td><img></td> <td><img></td> </tr> <tr> <td>下拉列表（手工录入）</td> <td><img></td> <td><img></td> </tr> <tr> <td>树形下拉（平铺展示）</td> <td><img></td> <td><img></td> </tr> <tr> <td>树形下拉（树形展示）</td> <td><img></td> <td><img></td> </tr> <tr> <td>过滤器（按枚举过滤）</td> <td><img></td> <td><img></td> </tr> </tbody> </table>
* 仪表板新增自定义水印功能，满足安全要求较高的企业安全规范的要求。![安全配置](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2704151361/p325969.png)请参见[自定义水印](https://help.aliyun.com/document_detail/312585.html#task-2112533 "对于安全要求比较高的企业，原本是系统默认水印已不能满足要求。Quick BI推出自定义水印设置，组织管理员可以设置私密等自定义水印、也可以使用自定义公式获取IP地址、当前账号、昵称等信息，帮助您有效防止数据泄露。本文为您介绍如何定义设置水印内容并展示水印的效果。")。
* 电子表格支持升序、降序、组内升序、组内降序进行字段排序。![电子表格](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/2474922361/p326303.png)