# 校验规则参考

## 一、支持校验规则的控件

**支持 rules/required**（大多数数据输入控件）：
input, textarea, number, integer, money, select, radio, checkbox, date, time, phone, email, rate, imgupload, file-upload, select-user, select-depart, select-depart-post, org-role, area-linkage, table-dict, select-tree, hand-sign, link-record, summary, location, formula, editor, markdown

**不支持校验规则**（`notRuleTypes`，自动移除 required）：
`switch`, `auto-number`, `capital-money`, `barcode`, `text-compose`, `link-field`

**支持唯一值校验**（`allowUniqueTypes`）：
`input`, `textarea`, `email`, `phone`

## 二、限定输入格式（仅 input / textarea）

> **重要**：`options.dataType`、`options.pattern`、`options.patternMessage` 三个配置项仅 `input` 和 `textarea` 支持。其他控件的格式校验由控件自身机制保证。

### dataType — 数据类型校验

| 值 | 校验内容 |
|----|---------|
| `string` | 字符串 |
| `number` | 数字（含小数） |
| `integer` | 整数 |
| `float` | 浮点数 |
| `url` | URL 地址 |
| `email` | 邮箱 |
| `phone` | 手机号 |
| `identity` | 身份证号 |

### pattern — 自定义正则表达式

`options.pattern` 存储正则字符串（非 RegExp 对象），运行时自动转为 `new RegExp(pattern)`。

```json
{
  "type": "input",
  "options": {
    "pattern": "^[A-Z]{2}\\d{4}$",
    "patternMessage": "格式如 AB1234"
  }
}
```

### 13 个预置正则（仅 input / textarea 可用）

| 名称 | 正则 |
|------|------|
| 字母 | `^[A-Za-z]*$` |
| 字母数字 | `^[A-Za-z0-9]*$` |
| 数字 | `^(-?\\d+(\\.\\d+)?)?$` |
| 大写字母 | `^[A-Z]*$` |
| 小写字母 | `^[a-z]*$` |
| 6个字母 | `^[a-zA-Z]{6}$` |
| 6个数字 | `^\\d{6}$` |
| 邮政编码 | 中国邮政编码正则 |
| IP地址 | 标准 IPv4 正则 |
| 链接 | HTTP(S)/FTP URL 正则 |
| 车牌号 | 中国车牌号正则 |
| 身份证号 | `^\\d{17}[\\dX]$` |
| 中国护照 | 中国护照号正则 |

## 三、rules 数组格式

```json
{
  "rules": [
    {
      "required": true,
      "message": "${title}必须填写",
      "trigger": "blur"
    },
    {
      "pattern": "^[A-Za-z0-9]+$",
      "message": "只能输入字母和数字"
    },
    {
      "type": "phone",
      "message": "请输入正确的手机号码"
    }
  ]
}
```

### 规则字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `required` | boolean | 是否必填 |
| `type` | string | 内置规则类型（见下表） |
| `pattern` | string | 正则表达式字符串 |
| `message` | string | 错误提示（支持 `${title}` 占位符，替换为控件 name） |
| `trigger` | string | 触发时机：`blur` / `change` / `submit` |

### 内置规则 type

| type | 说明 | 运行时转换 |
|------|------|---------|
| `string` | 字符串 | async-validator 原生 |
| `email` | 邮箱 | async-validator 原生 |
| `url` | URL | async-validator 原生 |
| `phone` | 手机号 | 转为正则 `/^1[3456789]\d{9}$/` |
| `identity` | 身份证号 | 转为正则 `/(^\d{15}$)\|(^\d{18}$)\|(^\d{17}(\d\|X\|x)$)/` |
| `validator` | 自定义函数 | 调用 `executeValidator` |

## 四、defaultRules（控件内置规则）

| 控件 | 内置规则 |
|------|---------|
| `phone` | 手机号正则 + validator |
| `email` | 邮箱格式 + validator |
| `rate` | validator (change 触发) |

defaultRules 在运行时与 rules 合并：`finalRules = [...defaultRules, ...rules]`

## 五、唯一值校验（options.unique）

仅 `input`, `textarea`, `email`, `phone` 支持。

启用后在 blur 时调用后端接口 `GET /desform/data/checkUniqueForField/{desformCode}` 检查字段值是否重复。编辑时自动排除当前记录。

## 六、Python 脚本中设置校验

```python
# 必填
INPUT('姓名', required=True)

# 自定义正则（仅 input/textarea）
INPUT('工号', pattern='^[A-Z]{2}\\d{4}$', pattern_message='格式如 AB1234')
TEXTAREA('备注', pattern='^[\\u4e00-\\u9fa5]+$', pattern_message='只能输入中文')

# 唯一值（仅 input/textarea/email/phone）
INPUT('身份证号', unique=True)

# phone/email 自带默认规则
PHONE('手机')   # 自动包含手机号正则校验
EMAIL('邮箱')   # 自动包含邮箱格式校验

# ❌ 错误示例：number/select 不支持 pattern
NUMBER('金额', pattern='^\\d+$')   # 无效！数字范围用 min/max
SELECT('类型', [...], pattern='...')  # 无效！
```
