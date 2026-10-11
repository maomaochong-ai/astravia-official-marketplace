# 报表导出接口

## 导出流程

1. **根据报表名称查询报表** → 拿到报表 `id` 作为 `excelConfigId`
2. **组装参数** → `sheetId` 固定传 `"default"`（当前不支持按 sheet 导出），其余参数放 `queryParam`
3. **请求导出接口** → 根据需要的格式调用对应接口，返回二进制流

## 接口列表

### 导出 Excel

**POST** `/jmreport/exportAllExcelStream`

### 导出 PDF

**POST** `/jmreport/exportPdfStream`

### 导出 Word

**POST** `/jmreport/export/word`

### 导出报表配置（跨环境迁移包，对应 UI「导出报表配置」按钮）

**GET** `/jmreport/exportReportConfig?id={id}&token={token}`

> 与 PDF/Excel/Word 不同，此接口返回 **JSON envelope**（不是文件流），需后处理解码。

| 项 | 说明 |
|----|------|
| 方法 | GET，需签名（已加入 `SIGNED_PATHS`） |
| 参数 | `id` 报表 ID，`token` 用户 token |
| 响应 | `{success, code, result: {file: <base64>}}` |
| `result.file` | base64 编码的 URL-encoded JSON：`{"jimu_report_db_list":"...","jimu_report":"..."}` |
| 后处理 | `base64.b64decode(file).decode()` 即得迁移包字符串，可直接保存为 `.json` 用于 import 还原 |

**Python 一键调用：**

```python
from report_export import export_report_config
export_report_config(BASE_URL, TOKEN, report_id, output_dir="./out",
                     as_readable=True)   # 同时生成展开 URL 编码的可读版本
```

**CLI：**

```bash
python report_export.py export-config <report_id> --output ./out [--readable]
```

> 与 `get_report` 区别：
> - `get_report` → 设计器内部 design dict（用来 `base_save` 增删改）
> - `/exportReportConfig` → **跨环境迁移包**（含数据集 + 报表本体，目标环境 import 还原）

## 请求参数

三个接口参数结构一致：

```json
{
    "excelConfigId": "报表id",
    "sheetId": "default",
    "queryParam": {
        "token": "xxx",
        "tenantId": "2",
        "pageNo": "1",
        "pageSize": 10,
        "customTableTitleSorts": [],
        "jmViewOperation": "1",
        "currentPageNo": "1",
        "currentPageSize": 10
    }
}
```

| 字段 | 说明 |
|------|------|
| `excelConfigId` | 报表 id，通过报表名称查询获得 |
| `sheetId` | 固定传 `"default"`，当前不支持按 sheet 导出 |
| `queryParam` | 查询参数，包含 token、分页等信息 |

## 响应

返回二进制流（stream），前端通过 Blob 下载：

```javascript
if (typeof window.navigator.msSaveBlob !== 'undefined') {
    window.navigator.msSaveBlob(new Blob([data]), filename)
} else {
    let url = window.URL.createObjectURL(new Blob([data]))
    let link = document.createElement('a')
    link.style.display = 'none'
    link.href = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
}
```

---

# Excel 模板导入接口

## 接口

**POST** `/jmreport/importExcel?token={token}`

## 请求参数

`Content-Type: multipart/form-data`

| 参数 | 类型 | 说明 |
|------|------|------|
| `file` | binary | Excel 文件（仅支持 .xlsx） |
| `fileName` | string | 文件名（如 `处方笺20210427190844.xlsx`） |
| `biz` | string | 固定传 `excel_online` |

## 使用流程

1. **用户提供 Excel 文件路径**（仅支持 .xlsx 格式）
2. **调用 importExcel 接口** → 上传文件，返回解析后的 JSON（styles/rows/cols/merges）
3. **将返回的 result 组装到报表 JSON 中** → 作为 save 接口的 rows/cols/styles/merges
4. **调用 /jmreport/save 保存报表**

## 响应

```json
{
    "success": true,
    "message": "",
    "code": 0,
    "result": {
        "styles": [...],    // 样式数组，按索引引用
        "rows": {...},      // 行数据（含 cells、height）
        "merges": [...],    // 合并单元格列表（如 "C3:L3"）
        "cols": {...}       // 列宽配置
    },
    "timestamp": 1775636761304
}
```

### result 字段说明

| 字段 | 说明 |
|------|------|
| `styles` | 样式数组，每个元素包含 font/border/color/align 等属性，单元格通过 `style` 索引引用 |
| `rows` | 行数据，key 为行号（0-indexed），每行包含 `cells`（列数据）和 `height`（行高） |
| `cols` | 列宽配置，key 为列号（0-indexed），值包含 `width` |
| `merges` | 合并单元格列表，格式为 Excel 范围（如 `"C3:L3"`） |

### 单元格结构

```json
{
    "style": 13,        // 引用 styles 数组的索引
    "text": "内容",     // 单元格文本
    "merge": [0, 9]     // 合并：[额外行数, 额外列数]
}
```

## 脚本用法示例

```python
import requests, os

BASE_URL = "<api_base>"
TOKEN = "xxx"

# 1. 上传 Excel 文件
filepath = r"C:\Users\<用户名>\Desktop\xxx.xlsx"
filename = os.path.basename(filepath)

s = requests.Session()
s.trust_env = False
s.headers.update({"X-Access-Token": TOKEN})

with open(filepath, "rb") as f:
    resp = s.post(
        f"{BASE_URL}/importExcel?token={TOKEN}",
        files={"file": (filename, f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
        data={"fileName": filename, "biz": "excel_online"},
    )
result = resp.json()["result"]

# 2. 提取 styles/rows/cols/merges 用于 save
styles = result["styles"]
rows = result["rows"]
cols = result["cols"]
merges = result["merges"]

# 3. 组装到 base_save 中保存报表
# session.request("/save", base_save(report_id, designer, rows=rows, cols=cols, styles=styles, merges=merges))
```


> 多 Sheet 接口详见 `multi-sheet.md`

---

# 定时导出任务接口

## 接口

**POST** `/jmreport/auto/export/job/save`

## 请求参数

```json
{
    "id": "",
    "name": "任务名称",
    "beginTime": "2026-05-07 00:00:00",
    "execInterval": "0 0 8 * * ?",
    "endTime": "2026-06-07 00:00:00",
    "exportReports": [
        {
            "reportId": "报表ID",
            "exportType": "PDF",
            "params": {},
            "sheetId": "default",
            "name": "报表显示名",
            "tableIndex": 1
        }
    ],
    "emailSend": true,
    "receiverEmail": "xxx@qq.com",
    "isSyncFile": false,
    "fileSyncPath": "",
    "reportConf": "<exportReports 的 JSON 字符串>"
}
```

| 字段 | 说明 |
|------|------|
| `id` | **空字符串 = 新建；传已有任务 ID = 修改**（创建与修改共用同一接口） |
| `execInterval` | 标准 Cron 表达式（6 位，含秒），如 `0 0/5 * * * ?` 每 5 分钟 |
| `exportType` | `PDF` / `EXCEL` / `WORD` |
| `sheetId` | 固定传 `"default"` |
| `tableIndex` | 报表在任务中的顺序（从 1 开始） |
| `emailSend` | `true` = 完成后邮件通知 |
| `isSyncFile` | `true` = 同步导出文件到 `fileSyncPath` 路径 |
| `reportConf` | `exportReports` 的 JSON 字符串（与 `exportReports` 数组内容必须保持一致） |

## 响应

```json
{"success": true, "message": "", "code": 200, "result": null, "timestamp": 1778148973808}
```

> ⚠️ **`result` 为 null**，接口不返回新建任务的 ID。若需要任务 ID，创建后调 `list_export_jobs()` 按名称查询。

## Python 调用

```python
from report_export import schedule_export_job

schedule_export_job(
    base_url="http://host:port/jeecgboot/jmreport",
    token="xxx",
    name="每日报表导出",
    exec_interval="0 0 8 * * ?",   # 每天 8 点
    begin_time="2026-05-07 00:00:00",
    end_time="2026-06-07 00:00:00",
    export_reports=[
        {"reportId": "xxx1", "exportType": "PDF",   "name": "学校信息统计"},
        {"reportId": "xxx2", "exportType": "EXCEL",  "name": "员工信息表"},
        {"reportId": "xxx3", "exportType": "WORD",   "name": "员工信息报表"},
    ],
    email_send=True,
    receiver_email="xxx@qq.com",
)
```

## CLI

```bash
python report_export.py schedule-export \
  --base-url http://host:port/jeecgboot/jmreport \
  --token TOKEN \
  --name "每日报表导出" \
  --reports '[{"reportId":"xxx1","exportType":"PDF","name":"学校信息统计"},{"reportId":"xxx2","exportType":"EXCEL","name":"员工信息表"}]' \
  --cron "0 0 8 * * ?" \
  --begin "2026-05-07 00:00:00" \
  --end "2026-06-07 00:00:00" \
  --email "xxx@qq.com"
```

---

# 定时导出任务列表查询接口

## 接口

**GET** `/jmreport/auto/export/job/query`

> ⚠️ 接口路径是 `/query`，**不是** `/list`——`/list` 会返回 404。

## 请求参数

| 参数 | 说明 |
|------|------|
| `pageNo` | 页码，从 1 开始 |
| `pageSize` | 每页条数，默认 50 |
| `token` | 用户 token |

## 响应字段

每项包含 `id`、`name`、`status`（1=运行中/0=已停止）、`execInterval`、`beginTime`、`endTime`、`createTime`。

## Python 调用

```python
from report_export import list_export_jobs

list_export_jobs(base_url, token, name="关键词")  # name 可省略，省略则列出全部
```

## CLI

```bash
python report_export.py job-list [--name 关键词] --base-url URL --token TOKEN
```

---

# 定时导出任务删除接口

## 接口

**DELETE** `/jmreport/auto/export/job/delete?id={jobId}`

> ⚠️ **必须先停止任务再删除**：对运行中（status=1）的任务直接删除会返回 code:500。`delete_export_job()` 已内置"先停止后删除"逻辑，直接调用即可。

## 响应

```json
{"success": true, "message": "删除成功！", "code": 200, "result": null}
```

## Python 调用

```python
from report_export import delete_export_job

delete_export_job(base_url, token, job_id="任务ID")
```

## CLI

```bash
python report_export.py job-delete <job_id> --base-url URL --token TOKEN
```

---

# 定时导出任务立即执行接口

## 接口

**GET** `/jmreport/auto/export/job/run/{jobId}`

## 说明

不等待 Cron 周期，立即触发一次导出任务执行。`result` 返回本次执行的**批次号**，可用于后续查询执行记录。

## 响应

```json
{"success": true, "message": "导出报表成功", "code": 200, "result": "20260507200649ShJ26W"}
```

## Python 调用

```python
from report_export import run_export_job_now

run_export_job_now(base_url, token, job_id="任务ID")
# 输出: 任务 xxx 立即执行成功
#       执行批次号: 20260507200649ShJ26W
```

## CLI

```bash
python report_export.py job-run <job_id> --base-url URL --token TOKEN
```

---

# 定时导出任务状态接口（启动/停止）

## 接口

**POST** `/jmreport/auto/export/job/status/update`

## 请求参数

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 定时导出任务 ID |
| `status` | int | `1` = 启动，`0` = 停止 |

启动：`{"id": "任务ID", "status": 1}`  
停止：`{"id": "任务ID", "status": 0}`

## 响应

```json
{"success": true, "message": "", "code": 200, "result": null}
```

## Python 调用

```python
from report_export import update_export_job_status

update_export_job_status(base_url, token, job_id="任务ID", status=1)  # 启动
update_export_job_status(base_url, token, job_id="任务ID", status=0)  # 停止
```

## CLI

```bash
# 启动
python report_export.py job-start <job_id> --base-url URL --token TOKEN
# 停止
python report_export.py job-stop  <job_id> --base-url URL --token TOKEN
```

---

# 报表配置导出/导入接口（官方平台格式，可跨环境迁移）

> 与 Excel 模板导入（视觉布局）、Excel/PDF/Word 业务数据导出**完全不同的一对接口**：用于把整张报表（含数据集、参数、布局、图表、增强等所有配置）打成一个 .json 文件，方便备份或跨环境迁移。

## 导出

**GET** `/jmreport/exportReportConfig?id={reportId}`

返回 ApiResult：

```json
{"success": true, "result": {"file": "<base64 字符串>", "success": true}}
```

> `result.file` 是 **base64 编码**的字符串（实测 2026-04-30 验证）。**必须先 base64 解码再落盘**——平台前端「导出」按钮的下载行为也是先解码再保存为 `.json` 文件。
>
> 解码后的内容是 URL-encoded JSON：`{"jimu_report_db_list":"%5B%5D","jimu_report":"%7B...%7D"}` —— 这才是 `/importReportConfig` 期望接收的格式。

```python
import base64
session = Session(BASE_URL, TOKEN)
file_b64 = session.request("/exportReportConfig", {"id": report_id}, method="GET")["result"]["file"]
decoded  = base64.b64decode(file_b64).decode("utf-8")   # ← 必须解码
with open(f"{name}_{int(time.time()*1000)}.json", "w", encoding="utf-8") as f:
    f.write(decoded)
```

## 导入

**POST** `/jmreport/importReportConfig` — `Content-Type: multipart/form-data`

| 参数 | 类型 | 说明 |
|------|------|------|
| `file` | binary | 上传上一步**解码后**的 `.json` 文件（内容即 url-encoded 的 `{jimu_report_db_list, jimu_report}` JSON 字符串，**不是** base64） |

```python
session = Session(BASE_URL, TOKEN)
with open(decoded_json_path, "rb") as f:
    r = session.upload("/importReportConfig",
                       files={"file": ("config.json", f, "application/json")})
# r["result"] == "导入成功！"
```

**实测（2026-04-30）成功条件**：
- ✅ 上传文件内容为「**解码后** url-encoded JSON 字符串」（即 export 函数保存的内容）
- ❌ 上传文件内容为 base64 原文 → 报 `导入失败！`（业务异常被吞，code 500）
- ❌ 上传 base64 + 改 id/code 重新封装 → 同样 `导入失败！`
- ⚠️ 同 id 重复导入：实测**可成功**（覆盖更新）；不同环境迁移时通常视为新增

> 直接 POST JSON body 会失败：`Current request is not a multipart request`。

## 与 get_report 落盘的区别

| 方式 | 文件内容 | 还原方式 | 用途 |
|------|---------|---------|------|
| `exportReportConfig` | base64 字符串（平台官方包） | `importReportConfig`（multipart 上传文件） | **跨环境迁移、备份**，含数据集/参数/增强等全部 |
| `get_report` 后 dump | 可读 JSON（`{"designer", "design"}`） | `base_save(report_id, designer, **design)` | 脚本内调试、二次编辑 |

需要"原样克隆一张报表到另一个环境"时**优先用 exportReportConfig/importReportConfig**；只在脚本里改字段、对同一个报表 patch 时用 get_report。

