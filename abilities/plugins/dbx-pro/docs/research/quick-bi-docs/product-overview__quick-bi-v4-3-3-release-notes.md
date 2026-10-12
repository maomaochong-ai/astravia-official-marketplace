<br />

## 发布日期
2022年06月21日

## 重点升级概览
* 首页企业门户、类目管理支持仅显示当前用户有权限的内容，精细化管理报表。
* 数据大屏新增iFrame、支持通过空白模版新建大屏。
* 数据准备能力升级。
  * 新增MySQL8.0、Oracle、ClickHouse、Hologres数据源。
  * 清洗加工节点支持合并和拆分字段编辑。
  * 新增日期、时间类型，扩展日期转换格式。
* 电子表格支持数据集条件格式、批量配置区块样式等，增强报表分析能力，提高制表效率。
* 移动端支持国际化语言。
* API数据源支持分页请求，查看数据更方便。

## 变更内容
* 类目管理新增只显示有权限内容开关。 <table> <caption></caption> <colgroup> <col> <col> </colgroup> <thead> <tr> <th>优化前</th> <th>优化后</th> </tr> </thead> <tbody> <tr> <td><img></td> <td><img></td> </tr> </tbody> </table>
* 数据大屏的媒体组件中，新增iframe。![内嵌页面](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3132907561/p463663.png)
* 数据准备中，清洗加工环节字段优化。
  * 经过合并或拆分的字段支持编辑操作。 图 1. 编辑合并字段 ![修改合并字段_4.3.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3132907561/p462374.png) 图 2. 编辑拆分字段 ![编辑拆分字段_4.3.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3132907561/p462445.png)
  * 字段类型新增日期类型。![字段类型转换](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/3132907561/p462520.png)  
    **说明** 转换为日期字段时，支持以下3种日期类型：
    * 日期：仅日期格式。 例如，yyyy-MM-dd

    * 日期时间：日期+时间格式。 例如，yyyy-MM-dd HH:mm:ss

    * 时间：仅时间格式。 例如，HH:mm:ss

    您也可以自定义日期格式。
* 电子表格样式升级
  * 为提升电子表格报表区块样式配置的效率，支持批量配置区块样式，同时支持多选区块分区。例如，同时选中行头区、数据区进行样式配置等。 图 3. 批量选择区块 ![电子表格批量选择_4.3.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6414946561/p461305.gif) 图 4. 全局配置边框 ![配置边框_4.3.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6414946561/p461317.gif) 图 5. 配置多区块字体加粗 ![字体加粗_4.3.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6414946561/p461329.gif)
  * 新增数据集条件格式。  
    为增强电子表格的分析能力，帮助您提升数据的可解读性，需要打造数据集条件格式，以满足各类复杂报表场景。 ![设置条件格式_4.3.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6414946561/p461268.png)
  * 新增自定义区块名称。  
    您可以自定义区块名称，方便设置全局参数或跳转时，快速找到该区块。 ![配置效果样例_4.3.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/6414946561/p461349.png)
* API数据源中，建立API连接时，支持在普通参数中设置分页请求参数。  
  您可以单击 添加参数，通过普通参数传参。例如，对于数据量过大的API接口，您可以通过分页的方式请求，提供一个动态参数 `${PageIndex} `进行传参。 ![分页参数_4.3.3](https://help-static-aliyun-doc.aliyuncs.com/assets/img/zh-CN/8142107561/p462502.png)  
  **说明** 仅当第一个参数值为 `${PageIndex} `时，设置的分页才会生效。