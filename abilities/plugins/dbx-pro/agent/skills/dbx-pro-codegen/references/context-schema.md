# ctx.json Schema

`scripts/codegen.py` 的输入 JSON。AI 只需提供加粗字段，**其他字段 Python 端自动兜底**——但写出来更清晰、更可控。

## 顶层

```jsonc
{
  // —— 必填 ——
  "bussiPackage": "org.jeecg.modules",      // 业务包前缀
  "entityPackage": "biz",                    // 实体子包（也是前端视图目录名）
  "entityName": "BizGoods",                  // 实体类名（PascalCase）
  "tableName": "biz_goods",                  // 数据库表名（snake_case）
  "description": "商品管理",                  // 中文描述（菜单标题、Schema 注释、Excel 名称都用它）
  "primaryKeyField": "id",                   // 主键字段名（驼峰）

  // —— 主表 ——
  // ⚠️ primaryKeyField 只是告诉模板"哪个字段是主键"，id 字段本身必须在 originalColumns 里显式声明，
  //    模板才会渲染 @TableId 注解和对应的 getter/setter（Lombok @Data 只为存在的字段生成方法）。
  //    漏掉 id → 编译报错：找不到符号 方法 getId()
  "originalColumns": [ /* Column[] 见下，第一条必须是主键列，示例见下方"主键列示例" */ ],

  // —— 可选 ——
  "tableVo": {
    "ftlDescription": "商品管理",            // 默认取顶层 description
    "fieldRowNum": 1,                        // 表单列数：1=单列(span:24), 2=双列(span:12), 3, 4
    "extendParams": {
      "pidField": "pid",                     // 仅树表
      "hasChildren": "has_child",            // 仅树表
      "picker": "",                          // 日期 picker 类型：date/week/month/quarter/year
      "text": "", "store": "",               // sel_user / sel_depart 的 textField/valueField
      "cgButtonList": [],                    // 自定义按钮（高级）
      "enhanceJavaList": []                  // Java 增强类（高级）
    }
  },

  // —— 子表（仅一对多）——
  "subTables": [ /* SubTable[] 见下 */ ]
}
```

## 主键列示例（必须作为 originalColumns 第一条）

```jsonc
{
  "fieldName": "id",
  "fieldDbName": "id",
  "filedComment": "主键ID",
  "fieldDbType": "string",
  "fieldType": "java.lang.String",
  "classType": "text",
  "nullable": "N",
  "isShowList": "N",
  "isShow": "N",
  "isQuery": "N"
}
```

> `primaryKeyField: "id"` + 此 Column 共同作用：前者让模板知道哪个字段加 `@TableId`，后者让模板实际渲染该字段声明。两者缺一不可。

## Column 项

```jsonc
{
  // —— 必填 ——
  "fieldName": "name",                       // 驼峰
  "filedComment": "商品名称",                // 注意拼写：filed 不是 field（jeecg 模板就是这样写的）
  "fieldDbType": "string",                   // 见 field-mapping.md
  "fieldType": "java.lang.String",           // 全限定 Java 类型

  // —— 强烈建议显式给 ——
  "classType": "text",                       // 控件类型，见 field-mapping.md
  "nullable": "N",                           // Y / N
  "isShowList": "Y",                         // 是否在【列表】显示（模板列表列判断 isShowList）
  "isShow": "Y",                             // 是否在【表单】显示 ← 注意字段名是 isShow，不是 isShowForm！模板 formSchema/子表表格只认 isShow
  "isQuery": "N",                            // 是否参与【查询】（模板查询表单判断 isQuery）
  "queryMode": "single",                     // single / group（区间）

  // —— 可选 ——
  "fieldDbName": "name",                     // 默认 = camelToSnake(fieldName)
  "sort": "N",                               // 列表是否可排序 Y/N
  "readonly": "N",                           // 表单是否只读 Y/N
  "defaultVal": "",                          // 表单默认值（可选）。数字类型不需要默认值时省略此字段，勿传 ""，否则渲染出非法的 `defaultValue: ,`
  "fieldValidType": "",                      // 校验：* / e / m / p / n / money / s6-18 / *6-16 / only / url / ...

  // —— 字典（见 field-mapping.md "字典三剑客"）——
  "dictTable": "",
  "dictText": "",
  "dictField": "",                           // 系统字典编码 OR 表字典 valueField OR 分类字典 root code

  // —— 控件特化参数 ——
  "extendParams": {
    "picker": "",                            // 日期 picker 类型
    "text": "", "store": "",                 // sel_user 的字段映射
    "popupMulti": "",
    "imageField": ""  // link_table 专用：关联表图片字段名，用于卡片展示（对应 JLinkTableCard imageField prop）
  }
}
```

> **字段显隐三个开关，别记混：**`isShowList`→列表、`isShow`→表单、`isQuery`→查询。
> **没有 `isShowForm` 这个字段** —— 它不出现在任何模板里，写了等于没写。表单显隐只认 `isShow`。
>
> **系统字段与主键默认隐藏（默认值，非写死）：**`createBy`/`createTime`/`updateBy`/`updateTime`/`sysOrgCode` 和主键，`codegen.py` 会在你**没显式给 `isShow`** 时默认设为 `N`（表单/子表表格不显示），主键另转为 `show:false` 隐藏字段。某列显式传 `"isShow":"Y"` 即可覆盖、照常显示。

## SubTable 项（仅 onetomany）

```jsonc
{
  "tableName": "biz_order_item",
  "entityName": "BizOrderItem",
  "ftlDescription": "采购明细",
  "primaryKeyField": "id",

  // 外键（与主表 ID 关联）
  // foreignKeys 用于生成 Java setter（模板 ?cap_first → setOrderId）和前端字段名，必须 camelCase；
  // originalForeignKeys 是 snake_case 数据库列名（用于 SQL where 子句）。
  // 如果只填了 snake_case，codegen.py 会自动把 foreignKeys 规范化为 camelCase。
  "foreignKeys": ["orderId"],
  "originalForeignKeys": ["order_id"],
  "foreignRelationType": "0",

  // 子表字段（结构同主表 Column）
  // ⚠️ 子表的 id 主键列和外键列都必须出现在 originalColumns 里，缺任何一个都会编译报错。
  "originalColumns": [
    // —— 主键列：必须有这一条 ——
    {
      "fieldName": "id", "filedComment": "主键ID", "fieldDbName": "id",
      "fieldDbType": "string", "fieldType": "java.lang.String", "classType": "text",
      "nullable": "N", "isShowList": "N", "isShow": "N", "isQuery": "N"
    },
    // —— 外键列：必须有这一条，否则编译失败 ——
    {
      "fieldName": "orderId", "filedComment": "订单ID", "fieldDbName": "order_id",
      "fieldDbType": "string", "fieldType": "java.lang.String", "classType": "text",
      "isShowList": "N", "isShow": "N", "isQuery": "N"
    }
    /* , ...其余业务 Column[] */
  ]
}
```

> ⚠️ **一对多必读 — 外键字段要填两遍：**`foreignKeys` 和子表 `originalColumns` 是两条独立的线：
> - `foreignKeys` 只生成 ServiceImpl 里的 `entity.setOrderId(main.getId())` 调用 + Mapper 的 `deleteByMainId` 条件；
> - 子表 Entity 的字段（含 lombok getter/setter）**只从 `originalColumns` 渲染**。
>
> 只填 `foreignKeys`、漏了在 `originalColumns` 里补外键 Column → Entity 没有 `orderId` 字段、没有 `setOrderId` → ServiceImpl 编译报 `找不到符号 方法 setOrderId`。
> 外键 Column 一般设 `isShowList/isShow/isQuery` 全 `N`（不展示、不进表单、不查询），由后端自动回填。

## Python 兜底规则

`codegen.py` 的 `normalize_ctx` 在调 Java 前：

1. 自动算 `entityPackagePath`（点替换为斜线）
2. 自动设 `currentDate`（YYYYMMDD）
3. 每个 column 补齐 21 个默认字段（避免 Freemarker 引用未定义变量异常）
4. tableVo 补齐 `entityName` / `tableName` / `ftlDescription` / `fieldRowNum`
5. 主键 `primaryKeyField` 不传时默认 `id`
6. 子表 columns 同样兜底，子表对象额外补 `colums`（注意 jeecg 模板里这个字段拼写漏了 n）

## 直接给 Freemarker 看的字段（高级）

模板用到、但通常不用 AI 显式传的：

- `currentDate` — 自动生成 YYYYMMDD
- `entityPackagePath` — entityPackage 的斜线形式
- `columns` — 默认等于 `originalColumns`
- `originalColumns` — 字段全集（含主键和系统字段）
- 子表上下文自动展开成 `entityName` / `tableName` / `originalColumns` / `columns`，文件名里的 `[1-n]` 被 Java 渲染器替换为子表 entityName
