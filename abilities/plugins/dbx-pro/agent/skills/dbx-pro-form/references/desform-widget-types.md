# 控件类型映射规则

用户描述关键词 → 控件 type 的完整映射表。用于 Step 1 识别字段时选择正确的控件类型。

| 用户描述关键词 | 控件 type | 说明 |
|---------------|-----------|------|
| 名称/标题/姓名/文本 | `input` | 单行文本 |
| 描述/备注/原因/详情/多行 | `textarea` | 多行文本 |
| 数量/数字/金额(无单位) | `number` | 数字输入 |
| 整数/个数/天数 | `integer` | 整数输入 |
| 金额/费用/价格 | `money` | 金额（带元单位） |
| 单选/性别/是否/状态 | `radio` | 单选框组 |
| 多选/标签/兴趣 | `checkbox` | 多选框组 |
| 下拉/选择/类型/类别 | `select` | 下拉选择框 |
| 日期/生日/入职日期 | `date` | 日期选择器 |
| 时间/几点 | `time` | 时间选择器 |
| 开关/启用/是否激活 | `switch` | 开关 |
| 评分/星级/打分 | `rate` | 评分 |
| 颜色 | `color` | 颜色选择器 |
| 滑块/进度/百分比 | `slider` | 滑块 |
| 手机/电话/手机号 | `phone` | 手机 |
| 邮箱/Email | `email` | 邮箱 |
| 图片/照片/头像 | `imgupload` | 图片上传 |
| 附件/文件/上传 | `file-upload` | 文件上传 |
| 富文本/HTML内容 | `editor` | 富文本编辑器 |
| Markdown | `markdown` | Markdown 编辑器 |
| 省市/地区/地址选择 | `area-linkage` | 省市级联动 |
| 地图/位置(地图) | `map` | 地图 |
| 定位/GPS | `location` | 定位 |
| 条码/二维码 | `barcode` | 条码 |
| 自动编号/流水号 | `auto-number` | 自动编号 |
| 选人/审批人/负责人 | `select-user` | 用户组件 |
| 部门/选部门 | `select-depart` | 部门组件 |
| 岗位/选岗位 | `select-depart-post` | 岗位组件 |
| 组织角色/角色选择/角色 | `org-role` | 组织角色选择 |
| 分类树/树选择 | `select-tree` | 下拉树 |
| 表字典/弹窗选择 | `table-dict` | 表字典（popup或模糊查询） |
| 关联记录/引用 | `link-record` | 关联其他表单的记录 |
| 他表字段/自动填充 | `link-field` | 显示关联记录的字段值 |
| 公式/自动计算 | `formula` | 公式计算（求和/均值/自定义） |
| 汇总/求和/合计(子表) | `summary` | 子表列汇总（数值类聚合，className: form-summary，model前缀: summary_） |
| 汇总日期/最早日期/最晚日期/日期汇总/日期时间汇总 | `date` + `isSummary: true` | 子表日期列的最早/最晚聚合（className: form-summary-date，model前缀: date_，不可用于子表内部）；通过 options.type 切换 date/datetime |
| 手写签名/签字 | `hand-sign` | 手写签名 |
| 大写金额/中文大写 | `capital-money` | 金额转大写 |
| 文本组合 | `text-compose` | 多字段值拼接显示 |
| 分隔符/分区 | `divider` | 表单区域分隔线 |
| 文本识别/OCR | `ocr` | 图片文字识别 |
| 子表/明细/清单/内部子表/嵌入子表/设计子表 | `sub-table-design` | 内部子表（数据嵌入主表） |
| 外部子表/独立子表/工作表子表/关联子表 | `link-record` (isSubTable=true) | 外部子表（独立工作表存储） |
| 审批意见/审批/OA意见 | `oa-approval-comments` | OA 审批意见控件 |
| 静态文本/说明文字/提示文本 | `text` | 静态展示文本（不存储数据） |
| 按钮/操作按钮 | `buttons` | 可触发事件的按钮（不存储数据） |
| 标签页/选项卡/Tabs | `tabs` | 标签页容器，分组展示 |
