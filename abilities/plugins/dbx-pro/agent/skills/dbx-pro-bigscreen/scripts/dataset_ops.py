# -*- coding: utf-8 -*-
"""
大屏/仪表盘数据集操作工具 —— 增、删、改、查、测试、绑定
======================================================

使用方式（命令行）：

  # 列出数据集
  py dataset_ops.py list <API_BASE> <TOKEN> --page-size 20

  # 创建 SQL 数据集（--group 默认 "示例数据集"，自动查询/创建分组）
  py dataset_ops.py create-sql <API_BASE> <TOKEN> --name "销售数据" --code "sale_data" --db-source "707437208002265088" --sql "SELECT name, value FROM table" --fields "name:String,value:String"

  # 创建带 FreeMarker 查询参数的 SQL 数据集
  py dataset_ops.py create-sql <API_BASE> <TOKEN> --name "年龄统计" --sql-file sql.txt --fields "name:String,value:String" --params "sex:性别::sex"

  # 创建 API 数据集（--group 默认 "示例数据集"）
  py dataset_ops.py create-api <API_BASE> <TOKEN> --name "天气数据" --code "weather_data" --url "https://api.example.com/data" --method get --agent 0 --fields "name:String,value:String"

  # 批量并发创建 API 数据集（含字段回写，10 路并发比逐条串行快约 40%）
  # --batch-file: JSON 数组，每项 {name, code, url, method?, fields, agent?}
  # --out-file:   可选，写入含数据集 ID / 字段列表 / 原 URL 的结果 JSON，便于后续绑定脚本复用
  py dataset_ops.py create-api-batch <API_BASE> <TOKEN> --batch-file /tmp/ds_batch.json --out-file /tmp/ds_results.json --workers 10

  # 修改数据集属性（重命名、改SQL、改编码等）
  py dataset_ops.py edit <API_BASE> <TOKEN> --id "dataset_id" --name "新名称"
  py dataset_ops.py edit <API_BASE> <TOKEN> --id "dataset_id" --name "新名称" --code "new_code" --sql "SELECT ..."

  # 测试数据集
  py dataset_ops.py test <API_BASE> <TOKEN> --id "dataset_id"

  # 删除数据集
  py dataset_ops.py delete <API_BASE> <TOKEN> --id "dataset_id"

  # 绑定数据集到组件（单组件）
  py dataset_ops.py bind <API_BASE> <TOKEN> --page PAGE_ID --comp-name "基础柱形图" --dataset-id "xxx" --dataset-name "销售数据" --dataset-type sql --mapping "维度=name,数值=value"

  # 批量绑定（一次 query → 内存改 N 个 → 一次 save，避免并行 bind 的 race condition）
  # ⚠️ 多个 bind 切勿用 shell 并行调用：每次 bind 都整页提交，并发会互相覆盖快照，
  #    导致非 target 组件的 option 出现脏写（实测 JRingProgress 的 valueFontSize/lineHeight 被改）。
  py dataset_ops.py bind-batch <API_BASE> <TOKEN> --page PAGE_ID --batch-file /tmp/binds.json
"""

import sys, json, os, argparse, re, hashlib

# ============================================================
# bi_utils 加载（自动查找）
# ============================================================
def _find_bi_utils():
    """按优先级查找 bi_utils.py"""
    candidates = [
        os.path.dirname(os.path.abspath(__file__)),                     # 同目录
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'), # 上级目录(references/)
        os.getcwd(),                                                     # 当前工作目录
    ]
    for d in candidates:
        p = os.path.join(d, 'bi_utils.py')
        if os.path.exists(p):
            return d
    return None

_bu_dir = _find_bi_utils()
if _bu_dir:
    sys.path.insert(0, _bu_dir)
import bi_utils
from bi_utils import init_api, query_page, save_page


# ============================================================
# 辅助函数
# ============================================================
def _parse_fields(fields_str):
    """
    解析 --fields "name:String,value:String" 为 datasetItemList 格式。

    返回:
        [{"fieldName":"name","fieldTxt":"name","fieldType":"String","izShow":"Y","orderNum":0}, ...]
    """
    items = []
    for idx, part in enumerate(fields_str.split(',')):
        part = part.strip()
        if ':' not in part:
            print(f'警告: 忽略无效字段定义 "{part}"（需要 name:Type 格式）')
            continue
        field_name, field_type = part.split(':', 1)
        field_name = field_name.strip()
        field_type = field_type.strip()
        items.append({
            'fieldName': field_name,
            'fieldTxt': field_name,
            'fieldType': field_type,
            'izShow': 'Y',
            'orderNum': idx,
        })
    return items


def _parse_mapping(mapping_str):
    """
    解析 --mapping "维度=name,数值=value" 为 dataMapping 格式。

    注意: 后端使用 'filed'（不是 'field'）。

    返回:
        [{"filed":"维度","mapping":"name"}, {"filed":"数值","mapping":"value"}]
    """
    items = []
    for part in mapping_str.split(','):
        part = part.strip()
        if '=' not in part:
            print(f'警告: 忽略无效映射定义 "{part}"（需要 filed=mapping 格式）')
            continue
        filed, mapping = part.split('=', 1)
        items.append({
            'filed': filed.strip(),
            'mapping': mapping.strip(),
        })
    return items


# ============================================================
# 命令实现
# ============================================================
def cmd_list(args):
    """列出数据集"""
    params = {
        'pageNo': 1,
        'pageSize': args.page_size,
    }
    result = bi_utils._request('GET', '/drag/onlDragDatasetHead/list', params=params)
    if not result.get('success'):
        print(f'查询失败: {result.get("message", "")}')
        return

    data = result.get('result', {})
    records = data.get('records', [])
    total = data.get('total', 0)

    print(f'共 {total} 个数据集（当前显示 {len(records)} 个）：\n')
    print(f'{"序号":<4} {"ID":<24} {"编码":<20} {"名称":<20} {"类型":<8} {"数据源":<24}')
    print('-' * 110)
    for i, rec in enumerate(records):
        ds_id = rec.get('id', '?')
        code = rec.get('code', '')
        name = rec.get('name', '')
        data_type = rec.get('dataType', '')
        db_source = rec.get('dbSource', '') or ''
        print(f'{i+1:<4} {ds_id:<24} {code:<20} {name:<20} {data_type:<8} {db_source:<24}')


def _auto_code(name):
    """根据名称自动生成编码：英文转小写下划线，中文用拼音首字母+短哈希"""
    # 提取英文/数字部分
    ascii_part = re.sub(r'[^a-zA-Z0-9]', '_', name).strip('_').lower()
    ascii_part = re.sub(r'_+', '_', ascii_part)
    if ascii_part and len(ascii_part) >= 3:
        return ascii_part
    # 中文名：用 md5 短哈希
    short_hash = hashlib.md5(name.encode('utf-8')).hexdigest()[:8]
    return f'ds_{short_hash}'


def _resolve_group_id(group_name):
    """
    根据分组名称查找 parentId，不存在则自动创建。
    用于 create-sql / create-api 的 --group 参数。

    🚨 addGroup payload 的 `parentId` 必须传 **null**（不是字符串 '0'）。
    实测 2026-05-11：传 parentId='0' 也能 add 成功，但建出来的分组节点
    parentId='0' → 被 getAllGroup 内部过滤掉、queryById 返 null，下次 _resolve
    永远命中不到 → 重复 addGroup → 数据集管理页累积同名空分组。传 parentId=None
    建出来 `parentId is None`（与平台预置的"示例数据集"同型），下次 getAllGroup
    立刻返回。

    查询顺序：① getAllGroup（官方分组列表接口，最快） ② list?name= 兜底
    （后端按租户/parentId 过滤遗漏时） ③ 都没有再 addGroup(parentId=None)。
    """
    # ① 先走官方 getAllGroup 接口
    resp = bi_utils._request('GET', '/drag/onlDragDatasetHead/getAllGroup')
    result = resp.get('result')
    if isinstance(result, list):
        for item in result:
            if item.get('name') == group_name and item.get('dbSource') is None:
                return item.get('id')
    # ② 兜底：用 list?name= 查（应对历史脏数据 parentId='0' 等被 getAllGroup 滤掉的情况）
    resp2 = bi_utils._request('GET', '/drag/onlDragDatasetHead/list',
                              params={'name': group_name, 'pageSize': 50})
    records = (resp2.get('result') or {}).get('records') or []
    candidates = [r for r in records
                  if r.get('name') == group_name
                  and r.get('dataType') is None
                  and r.get('dbSource') is None]
    if candidates:
        candidates.sort(key=lambda r: r.get('createTime') or '')
        gid = candidates[0].get('id')
        if len(candidates) > 1:
            extra_ids = [c.get('id') for c in candidates[1:]]
            print(f'⚠️ 检测到 {len(candidates)} 个同名分组"{group_name}"（list 兜底命中）'
                  f'，沿用最早 id={gid}；冗余 {extra_ids} 多半是历史 parentId=\'0\' 脏数据，'
                  f'可手动迁移子项后删除')
        return gid
    # ③ 不存在则创建（关键：parentId=None 不是 '0'）
    import re, hashlib
    code = re.sub(r'[^a-zA-Z0-9_]', '_', group_name).strip('_') or hashlib.md5(group_name.encode()).hexdigest()[:8]
    add_resp = bi_utils._request('POST', '/drag/onlDragDatasetHead/addGroup',
                                  data={'name': group_name, 'code': code, 'parentId': None})
    gid = add_resp.get('result')
    # 兼容后端返回 dict（含 id/name/code 等）的情况——直接用整个 dict 做 parentId 会导致后续 /add 报
    # "Cannot deserialize value of type String from Object"（HTTP 400）
    if isinstance(gid, dict):
        gid = gid.get('id')
    if gid:
        print(f'已自动创建数据集分组: {group_name} (id={gid})')
        return gid
    return None


_WIDGET_TYPES = {'string', 'number', 'date'}


def _parse_sql_params(params_str):
    """
    解析 --params 参数字符串为 datasetParamList 格式。

    格式: "paramName:paramTxt:defaultValue:dictCode:widgetType" 多个用逗号分隔
    - paramTxt/defaultValue/dictCode/widgetType 可省略
    - widgetType 取值: string(文本,默认) | number(数值) | date(日期)
      对应 UI"类型"下拉的三个 option.value（小写；UI 列 defaultValue 显示 'String' 仅是占位文案）
    - 示例:
      "sex:性别::sex"            → sex(性别,无默认值,字典sex, string)
      "age:年龄:::number"        → age(年龄, 无默认, 无字典, number)
      "birth::::date"            → birth(无中文名, 无默认, 无字典, date)

    返回:
        [{'paramName':'sex','paramTxt':'性别','paramValue':'','dictCode':'sex',
          'widgetType':'string'}, ...]

    ⚠️ widgetType 默认 'string'，与 UI 新增参数后保存的行为一致；为 null 时
    旧版本后端在 FreeMarker `<#if isNotEmpty(x)>` 联动路径会触发 NPE（见 pitfalls #175），
    保留默认值更稳。
    """
    if not params_str:
        return []
    result = []
    for part in params_str.split(','):
        part = part.strip()
        if not part:
            continue
        segments = part.split(':')
        param_name = segments[0].strip()
        param_txt = segments[1].strip() if len(segments) > 1 and segments[1].strip() else param_name
        param_value = segments[2].strip() if len(segments) > 2 else ''
        dict_code = segments[3].strip() if len(segments) > 3 else ''
        widget_type = segments[4].strip().lower() if len(segments) > 4 and segments[4].strip() else 'string'
        if widget_type not in _WIDGET_TYPES:
            print(f'警告: widgetType "{widget_type}" 不在 {_WIDGET_TYPES} 内，回退 string')
            widget_type = 'string'
        result.append({
            'paramName': param_name,
            'paramTxt': param_txt,
            'paramValue': param_value,
            'dictCode': dict_code,
            'widgetType': widget_type,
        })
    return result


def cmd_create_sql(args):
    """创建 SQL 数据集"""
    # --sql-file 优先级高于 --sql
    sql_file = getattr(args, 'sql_file', None)
    if sql_file and os.path.isfile(sql_file):
        with open(sql_file, 'r', encoding='utf-8') as f:
            args.sql = f.read().strip()
        print(f'从文件读取 SQL: {sql_file}')
    if not args.sql:
        print('错误: 必须通过 --sql 或 --sql-file 提供 SQL 语句')
        return

    if not args.code:
        args.code = _auto_code(args.name)
    field_list = _parse_fields(args.fields)
    if not field_list:
        print('错误: 至少需要一个字段定义')
        return

    # 解析查询参数
    param_list = _parse_sql_params(getattr(args, 'params', None))
    if param_list:
        print(f'查询参数: {[p["paramName"] for p in param_list]}')

    # 解析分组
    group_name = getattr(args, 'group', '示例数据集') or '示例数据集'
    parent_id = getattr(args, 'parent_id', None) or _resolve_group_id(group_name)

    payload = {
        'name': args.name,
        'code': args.code,
        'dataType': 'sql',
        'dbSource': args.db_source,
        'querySql': args.sql,
        'parentId': parent_id,
        'datasetItemList': field_list,
        'datasetParamList': param_list,
    }

    result = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data=payload)
    if not result.get('success'):
        print(f'创建失败: {result.get("message", "")}')
        return

    ds = result.get('result', {})
    ds_id = ds.get('id', '') if isinstance(ds, dict) else ds
    print(f'SQL 数据集创建成功: {args.name} (编码: {args.code})')
    print(f'数据集ID: {ds_id}')
    print(f'分组: {group_name} (parentId={parent_id})')

    # /add 已经把 datasetItemList / datasetParamList 写入子表，仅当需要二次 edit
    # 回写字段（queryFieldBySql 解析结果覆盖最初的占位字段）时才走 edit。
    #
    # ⚠️ /edit 接口对子表是"整体替换"——ds_record 缺哪个子表字段就清哪个。queryById
    # 返回的 ds_record 不含 datasetItemList / datasetParamList，直接 edit 会清空子表。
    # 实测 2026-05-11：add 后 param 子表已有 1 条 → edit 仅传 datasetItemList → param 子表归零。
    # 故二次 edit 必须把 param_list 一起带上，否则刚写入的参数会被清空。
    if args.db_source:
        try:
            parse_resp = bi_utils._request('POST', '/drag/onlDragDatasetHead/queryFieldBySql', data={
                'sql': args.sql or '',
                'dbCode': args.db_source,
                'paramArray': '[]'
            })
            if parse_resp.get('success') and parse_resp.get('result', {}).get('fieldList'):
                parsed_fields = parse_resp['result']['fieldList']
                print(f'查询解析成功: {len(parsed_fields)} 个字段')
                ds_detail = bi_utils._request('GET', '/drag/onlDragDatasetHead/queryById', params={'id': ds_id})
                ds_record = ds_detail.get('result') or {}
                ds_record['datasetItemList'] = parsed_fields
                if param_list:
                    # 防止 edit 清空 add 时已写入的参数子表
                    ds_record['datasetParamList'] = param_list
                bi_utils._request('POST', '/drag/onlDragDatasetHead/edit', data=ds_record)
        except Exception as e:
            print(f'查询解析异常: {e}')


def cmd_create_json(args):
    """创建 JSON 数据集 — querySql 字段直接存 JSON 字符串作为数据源。

    后端识别 dataType='json' 时，运行时 getAllChartData 把 querySql 当 JSON 解析返回。
    与 SQL/API 不同：无 db_source / url，不需要 queryFieldBySql 字段回写。
    """
    # --json-file 优先级高于 --json
    json_file = getattr(args, 'json_file', None)
    if json_file and os.path.isfile(json_file):
        with open(json_file, 'r', encoding='utf-8') as f:
            args.json_data = f.read().strip()
        print(f'从文件读取 JSON: {json_file}')
    if not args.json_data:
        print('错误: 必须通过 --json 或 --json-file 提供 JSON 数据')
        return

    # 校验 JSON 合法性，避免前端运行时解析报错
    try:
        json.loads(args.json_data)
    except json.JSONDecodeError as e:
        print(f'JSON 解析失败: {e}')
        return

    if not args.code:
        args.code = _auto_code(args.name)
    field_list = _parse_fields(args.fields)
    if not field_list:
        print('错误: 至少需要一个字段定义')
        return

    group_name = getattr(args, 'group', '示例数据集') or '示例数据集'
    parent_id = getattr(args, 'parent_id', None) or _resolve_group_id(group_name)

    payload = {
        'name': args.name,
        'code': args.code,
        'dataType': 'json',
        'querySql': args.json_data,
        'parentId': parent_id,
        'datasetItemList': field_list,
        'datasetParamList': [],
    }

    result = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data=payload)
    if not result.get('success'):
        print(f'创建失败: {result.get("message", "")}')
        return

    ds = result.get('result', {})
    ds_id = ds.get('id', '') if isinstance(ds, dict) else ds
    print(f'JSON 数据集创建成功: {args.name} (编码: {args.code})')
    print(f'数据集ID: {ds_id}')
    print(f'分组: {group_name} (parentId={parent_id})')


def _refresh_api_dataset_fields(ds_id, url, method='get'):
    """调 queryFieldByApi 解析接口响应并 edit 回写 datasetItemList。

    背景：
      POST /drag/onlDragDatasetHead/add 时传的 datasetItemList 会被后端丢弃，
      保存下来是空数组。datasetItemList 不影响运行时（只看组件 dataMapping），
      但 BI 设计器数据集详情需要它展示字段列表——故创建完必须二次回写。

    返回:
      (ok: bool, field_names: list[str], err_msg: str)

    ⚠️ 踩坑：queryFieldByApi 的 result 本身就是**字段定义数组**，每项形如
      {"fieldName":"dim","fieldTxt":"dim","fieldType":"String","izShow":true,"orderNum":1}
      早期实现误将 result[0].keys() 当字段名 → 回写的永远是
      ['id','fieldName','fieldTxt','fieldType','izShow','orderNum']（元数据本身）。
    """
    try:
        parse_resp = bi_utils._request('POST', '/drag/onlDragDatasetHead/queryFieldByApi', data={
            'api': url, 'method': method, 'paramArray': '[]'
        })
        if not parse_resp.get('success'):
            return False, [], parse_resp.get('message', 'queryFieldByApi 失败')
        raw = parse_resp.get('result')
        if not isinstance(raw, list):
            return False, [], f'返回结构非预期（type={type(raw).__name__}）'
        parsed = [{
            'fieldName': f.get('fieldName'),
            'fieldTxt':  f.get('fieldTxt') or f.get('fieldName'),
            'fieldType': f.get('fieldType', 'String'),
            'izShow':    'Y' if f.get('izShow') in (True, 'Y', 1) else 'N',
            'orderNum':  idx,
        } for idx, f in enumerate(raw) if f.get('fieldName')]
        if not parsed:
            return False, [], '解析结果为空'
        # 先 queryById 拿完整 record，再 edit 写回（否则会丢其他字段）
        detail = bi_utils._request('GET', '/drag/onlDragDatasetHead/queryById', params={'id': ds_id})
        rec = detail.get('result') or {}
        rec['datasetItemList'] = parsed
        edit = bi_utils._request('POST', '/drag/onlDragDatasetHead/edit', data=rec)
        if not edit.get('success'):
            return False, [], edit.get('message', 'edit 失败')
        return True, [p['fieldName'] for p in parsed], ''
    except Exception as e:
        return False, [], str(e)


def cmd_create_api(args):
    """创建 API 数据集"""
    field_list = _parse_fields(args.fields)
    if not field_list:
        print('错误: 至少需要一个字段定义')
        return

    # 解析查询参数（联动/钻取场景必需）
    param_list = _parse_sql_params(getattr(args, 'params', None))
    if param_list:
        print(f'查询参数: {[p["paramName"] for p in param_list]}')
        # ⚠️ apiUrl 末尾必须带 ${paramName} 占位符，否则参数传不到 YApi advmock 脚本
        if '${' not in args.url:
            names = [p['paramName'] for p in param_list]
            qs = '&'.join(f'{n}=${{{n}}}' for n in names)
            sep = '&' if '?' in args.url else '?'
            print(f'⚠️ URL 缺少 ${{paramName}} 占位符，建议改为:')
            print(f'   {args.url}{sep}{qs}')

    # 解析分组
    group_name = getattr(args, 'group', '示例数据集') or '示例数据集'
    parent_id = getattr(args, 'parent_id', None) or _resolve_group_id(group_name)

    payload = {
        'name': args.name,
        'code': args.code,
        'dataType': 'api',
        'dbSource': None,
        'querySql': args.url,
        'apiMethod': args.method,
        'izAgent': str(args.agent),
        'parentId': parent_id,
        'datasetItemList': field_list,
        'datasetParamList': param_list,
    }

    result = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data=payload)
    if not result.get('success'):
        print(f'创建失败: {result.get("message", "")}')
        return

    ds = result.get('result', {})
    ds_id = ds.get('id', '') if isinstance(ds, dict) else ds
    print(f'API 数据集创建成功: {args.name} (编码: {args.code})')
    print(f'数据集ID: {ds_id}')

    ok, fields, err = _refresh_api_dataset_fields(ds_id, args.url, args.method)
    if ok:
        print(f'查询解析成功: {len(fields)} 个字段 ({fields})')
    else:
        print(f'字段回写失败: {err}')


def cmd_create_api_batch(args):
    """批量并发创建 API 数据集（含字段回写）。

    batch-file 格式（JSON 数组）:
      [
        {"name": "销售走势", "code": "sales_trend",
         "url":  "https://api.jeecg.com/mock/51/salesTrend",
         "method": "get", "agent": 0,
         "fields": "name:String,value:Integer"},
        ...
      ]

    流程：
      1) 串行 /add（后端对 code 唯一性有检查，并发建易撞）
      2) 并发 queryFieldByApi + edit 回写字段（IO 密集，可并发）

    实测：10 个数据集，串行 ~7.3s，10 路并发 ~4.6s（代理环境下约 37% 提速；
    无代理环境理论可到 5×）。瓶颈通常是本地代理对外网 HTTPS 的并发吞吐。
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    with open(args.batch_file, 'r', encoding='utf-8') as f:
        items = json.load(f)
    if not isinstance(items, list) or not items:
        print('batch-file 必须是非空 JSON 数组')
        sys.exit(1)

    group_name = getattr(args, 'group', '示例数据集') or '示例数据集'
    parent_id = getattr(args, 'parent_id', None) or _resolve_group_id(group_name)

    results = []
    for i, it in enumerate(items):
        name = it.get('name'); code = it.get('code')
        url  = it.get('url');  method = it.get('method', 'get')
        fields_spec = it.get('fields')
        if not all([name, code, url, fields_spec]):
            print(f'  [{i:>2}] ✗ 缺少 name/code/url/fields')
            results.append({'index': i, 'name': name, 'ok': False, 'err': 'missing required field'})
            continue
        payload = {
            'name': name, 'code': code,
            'dataType': 'api', 'dbSource': None,
            'querySql': url, 'apiMethod': method,
            'izAgent': str(it.get('agent', 0)),
            'parentId': parent_id,
            'datasetItemList': _parse_fields(fields_spec),
            'datasetParamList': _parse_sql_params(it.get('params')),
        }
        r = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data=payload)
        if not r.get('success'):
            print(f'  [{i:>2}] ✗ {name:20s}: {r.get("message", "")}')
            results.append({'index': i, 'name': name, 'ok': False, 'err': r.get('message', '')})
            continue
        obj = r.get('result', {})
        ds_id = obj.get('id') if isinstance(obj, dict) else obj
        print(f'  [{i:>2}] + {name:20s} → {ds_id}')
        results.append({'index': i, 'name': name, 'ok': True, 'id': ds_id,
                        'url': url, 'method': method, 'code': code})

    ok_items = [r for r in results if r.get('ok')]
    if ok_items:
        print(f'\n并发回写字段 ({len(ok_items)} 个, workers={args.workers})...')
        with ThreadPoolExecutor(max_workers=args.workers) as ex:
            futs = {ex.submit(_refresh_api_dataset_fields, r['id'], r['url'], r['method']): r
                    for r in ok_items}
            for fut in as_completed(futs):
                r = futs[fut]
                ok, fields, err = fut.result()
                r['fields'] = fields
                r['refresh_ok'] = ok
                if ok:
                    print(f'  ✓ {r["name"]:20s} {len(fields)} 字段: {fields}')
                else:
                    print(f'  ✗ {r["name"]:20s} 回写失败: {err}')

    ok_cnt = sum(1 for r in results if r.get('ok') and r.get('refresh_ok'))
    partial_cnt = sum(1 for r in results if r.get('ok') and not r.get('refresh_ok'))
    fail_cnt = sum(1 for r in results if not r.get('ok'))
    print(f'\n批量完成: ✓ 完全成功 {ok_cnt}  ⚠ 建成但回写失败 {partial_cnt}  ✗ 创建失败 {fail_cnt}  共 {len(items)}')

    if args.out_file:
        with open(args.out_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f'结果写入: {args.out_file}')


def cmd_test(args):
    """测试数据集"""
    payload = {
        'id': args.id,
    }

    result = bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data=payload)
    if not result.get('success'):
        print(f'测试失败: {result.get("message", "")}')
        return

    data = result.get('result', [])
    print(f'测试成功，返回 {len(data) if isinstance(data, list) else 1} 条数据：\n')
    print(json.dumps(data, ensure_ascii=False, indent=2))


def cmd_edit(args):
    """修改数据集属性（重命名、改SQL、改编码等）"""
    # 先查询获取当前数据
    result = bi_utils._request('GET', '/drag/onlDragDatasetHead/list',
                               params={'pageNo': 1, 'pageSize': 200})
    if not result.get('success'):
        print(f'查询失败: {result.get("message", "")}')
        return

    records = result.get('result', {}).get('records', [])
    target = None
    for r in records:
        if r.get('id') == args.id:
            target = r
            break

    if not target:
        print(f'未找到数据集: {args.id}')
        return

    old_name = target.get('name', '')

    # 按需更新字段
    if args.name:
        target['name'] = args.name
    if args.code:
        target['code'] = args.code
    if args.sql:
        target['querySql'] = args.sql
    if args.db_source:
        target['dbSource'] = args.db_source

    edit_result = bi_utils._request('PUT', '/drag/onlDragDatasetHead/edit', data=target)
    if not edit_result.get('success'):
        print(f'修改失败: {edit_result.get("message", "")}')
        return

    print(f'数据集修改成功:')
    if args.name:
        print(f'  名称: {old_name} → {args.name}')
    if args.code:
        print(f'  编码: → {args.code}')
    if args.sql:
        print(f'  SQL: → {args.sql}')
    print(f'  ID: {args.id}')


def cmd_delete(args):
    """删除数据集"""
    result = bi_utils._request('DELETE', '/drag/onlDragDatasetHead/delete', params={'id': args.id})
    if not result.get('success'):
        print(f'删除失败: {result.get("message", "")}')
        return

    print(f'数据集删除成功: {args.id}')


def _find_comp_by_name(tmpl, name):
    """在页面 template（含 JGroup 嵌套）中按 componentName 找组件，命中第一个返回。

    顺带把扫描过的 comp/elements 的 config 字符串解析成 dict（便于上层后续修改），
    避免在 cmd_bind / cmd_bind_batch 各处重复处理 string→dict。
    """
    for comp in tmpl:
        cfg = comp.get('config', {})
        if isinstance(cfg, str):
            try:
                comp['config'] = json.loads(cfg)
            except Exception:
                comp['config'] = {}
        if comp.get('componentName', '') == name:
            return comp
        if comp.get('component') == 'JGroup':
            elements = comp.get('props', {}).get('elements', [])
            for el in elements:
                el_cfg = el.get('config', {})
                if isinstance(el_cfg, str):
                    try:
                        el['config'] = json.loads(el_cfg)
                    except Exception:
                        el['config'] = {}
                if el.get('componentName', '') == name:
                    return el
    return None


def _find_comp_by_id(tmpl, comp_id):
    """按 comp['i']（如 '1778642357153_262076'）查找组件，含 JGroup 嵌套。

    用途（实测 2026-05-13）：spec_builder 部分 handler 把 title 写入 componentName 覆盖
    spec 顶层值；JStatsSummary 默认 componentName 为空。bind-batch 按 name 查找会失败，
    AI 又能通过 comp_ops.py list 拿到稳定的 i 值，故支持按 id 兜底定位。
    """
    for comp in tmpl:
        cfg = comp.get('config', {})
        if isinstance(cfg, str):
            try:
                comp['config'] = json.loads(cfg)
            except Exception:
                comp['config'] = {}
        if comp.get('i') == comp_id:
            return comp
        if comp.get('component') == 'JGroup':
            for el in comp.get('props', {}).get('elements', []):
                el_cfg = el.get('config', {})
                if isinstance(el_cfg, str):
                    try:
                        el['config'] = json.loads(el_cfg)
                    except Exception:
                        el['config'] = {}
                if el.get('i') == comp_id:
                    return el
    return None


def _apply_binding(target, dataset_id, dataset_name, dataset_type,
                   mapping='', field_map='', header_keys='', field_mapping_keys='',
                   content_keys=''):
    """把单个数据集绑定写入 comp.config（in-place 修改），返回 applied 描述列表。

    映射机制分三类（与 defaults/<组件>.json 对应，详见 data-binding-mapping.md）：
      A · 顶层 dataMapping —— 大多数图表
      B.1 · option.fieldMap —— JStatsSummary 类
      B.7 · option.header[*].key —— JScrollBoard 类
    """
    cfg = target.get('config', {})
    if isinstance(cfg, str):
        try:
            cfg = json.loads(cfg)
        except Exception:
            cfg = {}
        target['config'] = cfg

    cfg['dataType']     = 2
    cfg['dataSetId']    = dataset_id
    cfg['dataSetName']  = dataset_name
    cfg['dataSetType']  = dataset_type

    # dataSetApi/dataSetMethod：从数据集详情取（空字符串会导致部分组件渲染异常）
    if dataset_type == 'api':
        ds_detail = bi_utils._request('GET', '/drag/onlDragDatasetHead/queryById',
                                       params={'id': dataset_id})
        ds_rec = ds_detail.get('result') or {}
        cfg['dataSetApi']    = ds_rec.get('querySql', '')
        cfg['dataSetMethod'] = ds_rec.get('apiMethod', 'get')
        cfg['dataSetIzAgent'] = ds_rec.get('izAgent', '0')
    elif dataset_type in ('FILES', 'singleFile'):
        # 文件数据集：dataSetApi 写入 SQL 语句（jmf.xxx 表名）便于前端展示，method=GET
        ds_detail = bi_utils._request('GET', '/drag/onlDragDatasetHead/queryById',
                                       params={'id': dataset_id})
        ds_rec = ds_detail.get('result') or {}
        cfg['dataSetApi']    = ds_rec.get('querySql', '')
        cfg['dataSetMethod'] = 'GET'
        cfg['dataSetIzAgent'] = '1'
    else:  # sql / json
        cfg['dataSetApi']    = ''
        cfg['dataSetMethod'] = ''
        cfg['dataSetIzAgent'] = '1'

    # fieldOption：UI 字段下拉数据 + JCommonTable/JList 等无 dataMapping 组件渲染列依赖
    # 优先从数据集 datasetItemList 取；list/queryById 不返回时退化用 getAllChartData 第一行 keys
    field_names: list[str] = []
    field_meta:  dict[str, dict] = {}
    try:
        ds_full = bi_utils.fetch_dataset_detail(dataset_id) or {}
        items = ds_full.get('onlDragDatasetItemList') or ds_full.get('datasetItemList') or []
        for it in items:
            fn = it.get('fieldName')
            if not fn:
                continue
            field_names.append(fn)
            field_meta[fn] = it
        if not field_names:
            data_resp = bi_utils._request(
                'POST', '/drag/onlDragDatasetHead/getAllChartData',
                data={'id': dataset_id})
            rows = (data_resp.get('result') or {}).get('data') or []
            if rows and isinstance(rows[0], dict):
                field_names = list(rows[0].keys())
    except Exception:
        pass
    if field_names:
        cfg['fieldOption'] = [{
            'label': fn,
            'text':  field_meta.get(fn, {}).get('fieldTxt', fn),
            'type':  field_meta.get(fn, {}).get('fieldType', 'String'),
            'value': fn,
            'show':  field_meta.get(fn, {}).get('izShow', 'Y'),
        } for fn in field_names]
    # paramOption：UI 字段下拉，联动/钻取的 target 字段必须列在这里组件才识别。
    # 实测 2026-05-11：bind 漏写时 linkageConfig.linkage[*].target=dictId 看似生效，
    # 但组件 config 无 paramOption 条目 → UI 设置面板"接收参数"下拉空，且 URL 联动重载
    # 数据集时找不到形参名（API 路径不会触发 dataSetCompService 在保存时的回填）。
    try:
        pr = bi_utils._request('GET', '/drag/onlDragDatasetParam/list',
                               params={'headId': dataset_id, 'pageSize': 50})
        param_records = (pr.get('result') or {}).get('records') or []
    except Exception:
        param_records = []
    if param_records:
        cfg['paramOption'] = [{
            'label':      p.get('paramTxt') or p.get('paramName'),
            'text':       p.get('paramTxt') or p.get('paramName'),
            'value':      p.get('paramName'),
            'defaultVal': p.get('paramValue', '') or '',
            'type':       p.get('widgetType') or 'string',
        } for p in param_records if p.get('paramName')]
    else:
        cfg.setdefault('paramOption', [])
    # 切到动态数据集后清空静态 chartData，避免组件继续显示样例数据
    cfg['chartData'] = '[]'

    # JCommonTable 渲染列真相源：option.columns（不是 dataMapping/fieldOption）。
    # 实测 2026-04-27：UI 拖入 JCommonTable + 绑数据集时 columns 自动填入；脚本绑定漏写则表头/列都不显示
    comp_type = target.get('component', '')
    if comp_type == 'JCommonTable' and field_names:
        opt_t = cfg.setdefault('option', {})
        existing_cols = opt_t.get('columns') or []
        existing_titles = {col.get('dataIndex'): col for col in existing_cols if isinstance(col, dict)}
        opt_t['columns'] = [
            existing_titles.get(fn, {'izShow': 'Y', 'dataIndex': fn,
                                     'title': field_meta.get(fn, {}).get('fieldTxt', fn)})
            for fn in field_names
        ]

    applied = []
    if field_map:
        opt = cfg.setdefault('option', {})
        fm = dict(opt.get('fieldMap') or {})
        for kv in field_map.split(','):
            if '=' in kv:
                k, v = kv.split('=', 1)
                fm[k.strip()] = v.strip()
        opt['fieldMap'] = fm
        cfg['dataMapping'] = []
        applied.append(f'option.fieldMap={fm}')
    elif header_keys:
        opt = cfg.setdefault('option', {})
        keys = [k.strip() for k in header_keys.split(',') if k.strip()]
        hdr = opt.get('header') or []
        if not hdr:
            hdr = [{'label': f'列{i+1}', 'align': 'center'} for i in range(len(keys))]
        for i, k in enumerate(keys):
            if i < len(hdr):
                hdr[i]['key'] = k
            else:
                hdr.append({'label': f'列{i+1}', 'key': k, 'align': 'center'})
        opt['header'] = hdr
        cfg['dataMapping'] = []
        applied.append(f'option.header[*].key={keys}')
    elif field_mapping_keys:
        # B.5: option.fieldMapping[*].key — JScrollList / JScrollTable
        # defaults 里已有完整列配置（含 name/textStyle/width/compose 等样式），
        # 这里只覆盖 key 字段，保留原有样式。列数不足时按 name="列N" 补占位。
        opt = cfg.setdefault('option', {})
        keys = [k.strip() for k in field_mapping_keys.split(',') if k.strip()]
        fm = opt.get('fieldMapping') or []
        if not fm:
            fm = [{'name': f'列{i+1}', 'textStyle': {}} for i in range(len(keys))]
        for i, k in enumerate(keys):
            if i < len(fm):
                fm[i]['key'] = k
            else:
                fm.append({'name': f'列{i+1}', 'key': k, 'textStyle': {}})
        opt['fieldMapping'] = fm
        cfg['dataMapping'] = []
        applied.append(f'option.fieldMapping[*].key={keys}')
    elif content_keys:
        # B.4: option.contentFieldMapping[*].key — JCardScroll / JCardCarousel
        # defaults 里 contentFieldMapping 是每张卡片上的字段槽位列表（含 name/showLabel/
        # showValue/itemConfig/omitConfig 等样式），这里只覆盖 key 到 API 字段名，保留样式。
        opt = cfg.setdefault('option', {})
        keys = [k.strip() for k in content_keys.split(',') if k.strip()]
        cfm = opt.get('contentFieldMapping') or []
        if not cfm:
            cfm = [{'name': f'字段{i+1}', 'showLabel': True, 'showValue': True}
                    for i in range(len(keys))]
        for i, k in enumerate(keys):
            if i < len(cfm):
                cfm[i]['key'] = k
            else:
                cfm.append({'name': f'字段{i+1}', 'key': k,
                             'showLabel': True, 'showValue': True})
        opt['contentFieldMapping'] = cfm
        cfg['dataMapping'] = []
        applied.append(f'option.contentFieldMapping[*].key={keys}')
    else:
        cfg['dataMapping'] = _parse_mapping(mapping)
        applied.append(f'dataMapping={cfg["dataMapping"]}')
    return applied


def cmd_bind(args):
    """绑定单个数据集到组件（单 target 简化版；多组件请用 bind-batch 避免并发竞争）"""
    page = query_page(args.page)
    tmpl = page.get('template', [])
    if isinstance(tmpl, str):
        tmpl = json.loads(tmpl)

    target = _find_comp_by_name(tmpl, args.comp_name)
    if not target:
        print(f'未找到组件: {args.comp_name}')
        return

    applied = _apply_binding(
        target, args.dataset_id, args.dataset_name, args.dataset_type,
        mapping=args.mapping, field_map=args.field_map,
        header_keys=args.header_keys, field_mapping_keys=args.field_mapping_keys,
        content_keys=args.content_keys,
    )

    bi_utils._page_components[args.page] = tmpl
    save_page(args.page)

    print('数据集绑定成功:')
    print(f'  组件: {args.comp_name}')
    print(f'  数据集: {args.dataset_name} ({args.dataset_id})')
    print(f'  类型: {args.dataset_type}')
    for line in applied:
        print(f'  {line}')


def cmd_bind_batch(args):
    """批量绑定（一次 query_page → 内存里改 N 个 target → 一次 save_page）。

    用途：替代"5 个进程并行 bind"——并行多次 save_page 整页提交会互相覆盖快照，
    导致 option 等无关字段出现脏写（实测：JRingProgress 的 valueFontSize/lineHeight 被
    意外改写为非默认值，单值数字渲染异常）。本子命令一次保存彻底规避竞争。

    --batch-file 格式（JSON 数组）：
      [
        {"comp_name":"...", "dataset_id":"...", "dataset_name":"...", "dataset_type":"api|sql",
         "mapping":"维度=x,数值=y"},                         # 类型 A
        {"comp_name":"...", "dataset_id":"...", "dataset_name":"...", "dataset_type":"api",
         "field_map":"label=title,value=amt"},               # 类型 B.1
        {"comp_name":"...", "dataset_id":"...", "dataset_name":"...", "dataset_type":"sql",
         "header_keys":"c1,c2,c3"}                           # 类型 B.7
      ]
    定位方式（实测 2026-05-13）：每项**优先按 comp_id 找**（comp['i']，可由 comp_ops.py list 拿到），
    缺失时回退到 comp_name（componentName）。原因：spec_builder 部分 handler 用 spec.title 覆盖
    componentName，JStatsSummary 默认 componentName 为空，按 name 找会全失败；按 i 找稳定。
    """
    with open(args.batch_file, 'r', encoding='utf-8') as f:
        items = json.load(f)
    if not isinstance(items, list) or not items:
        print(f'batch-file 必须是非空 JSON 数组: {args.batch_file}')
        return

    page = query_page(args.page)
    tmpl = page.get('template', [])
    if isinstance(tmpl, str):
        tmpl = json.loads(tmpl)

    success, fail = [], []
    for idx, it in enumerate(items):
        cid = it.get('comp_id', '')
        cn = it.get('comp_name', '')
        target = _find_comp_by_id(tmpl, cid) if cid else None
        if not target and cn:
            target = _find_comp_by_name(tmpl, cn)
        label = cid or cn or f'item[{idx}]'
        if not target:
            fail.append((idx, label, '未找到组件'))
            print(f'  [{idx:>3}] ✗ {label}: 未找到组件（comp_id 与 comp_name 都未命中）')
            continue
        try:
            applied = _apply_binding(
                target,
                it['dataset_id'], it['dataset_name'], it['dataset_type'],
                mapping=it.get('mapping', ''),
                field_map=it.get('field_map', ''),
                header_keys=it.get('header_keys', ''),
                field_mapping_keys=it.get('field_mapping_keys', ''),
                content_keys=it.get('content_keys', ''),
            )
            success.append((idx, label, applied))
            print(f'  [{idx:>3}] ✓ {label} → {it["dataset_name"]} ({it["dataset_id"]})')
        except KeyError as e:
            fail.append((idx, label, f'缺少字段: {e}'))
            print(f'  [{idx:>3}] ✗ {label}: 缺少字段 {e}')

    if not success:
        print(f'\n全部失败（{len(fail)} 项），不提交保存')
        return

    bi_utils._page_components[args.page] = tmpl
    save_page(args.page)
    print(f'\n批量完成: ✓ {len(success)}  ✗ {len(fail)}  共 {len(items)}（一次 save_page）')


# ============================================================
# CLI 入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='大屏数据集操作工具')
    subparsers = parser.add_subparsers(dest='command', help='操作类型')

    # 通用参数（api_base + token）
    def add_common(sub):
        sub.add_argument('api_base', help='API 地址')
        sub.add_argument('token', help='X-Access-Token')

    # list
    p_list = subparsers.add_parser('list', help='列出数据集')
    add_common(p_list)
    p_list.add_argument('--page-size', type=int, default=20, help='每页数量（默认 20）')

    # create-sql
    p_sql = subparsers.add_parser('create-sql', help='创建 SQL 数据集')
    add_common(p_sql)
    p_sql.add_argument('--name', required=True, help='数据集名称')
    p_sql.add_argument('--code', default=None, help='数据集编码（不传则根据 name 自动生成）')
    p_sql.add_argument('--db-source', default='', help='数据源 ID。⚠️ 留空 → dbSource 字段为空字符串（不会自动绑默认数据源）。SELECT 字面值 / UNION ALL 静态 SQL 不依赖 DB 时可留空；SELECT FROM 真表必须显式传 ID（见 datasource_ops.py list），否则 getAllChartData 报"数据源不存在"')
    p_sql.add_argument('--sql', default=None, help='SQL 查询语句')
    p_sql.add_argument('--sql-file', default=None, dest='sql_file',
                        help='从文件读取 SQL（解决 bash 对 FreeMarker 特殊字符的转义问题，优先级高于 --sql）')
    p_sql.add_argument('--fields', required=True, help='字段定义，格式: name:String,value:String')
    p_sql.add_argument('--params', default=None,
                        help='SQL 查询参数（FreeMarker），格式: paramName:paramTxt:defaultValue:dictCode（后三项可省略，多个逗号分隔，如 "sex:性别::sex,age:年龄"）')
    p_sql.add_argument('--group', default='示例数据集', help='数据集分组名称（默认"示例数据集"，自动查询/创建）')
    p_sql.add_argument('--parent-id', default=None, dest='parent_id', help='直接指定分组 parentId（优先于 --group）')

    # create-json
    p_json = subparsers.add_parser('create-json', help='创建 JSON 数据集（querySql 存 JSON 字符串）')
    add_common(p_json)
    p_json.add_argument('--name', required=True, help='数据集名称')
    p_json.add_argument('--code', default=None, help='数据集编码（不传则根据 name 自动生成）')
    p_json.add_argument('--json', dest='json_data', default=None, help='JSON 字符串数据（数组/对象）')
    p_json.add_argument('--json-file', default=None, dest='json_file',
                        help='从文件读取 JSON（含中文/换行/复杂内容时优选，优先级高于 --json）')
    p_json.add_argument('--fields', required=True, help='字段定义，格式: name:String,value:String')
    p_json.add_argument('--group', default='示例数据集', help='数据集分组名称（默认"示例数据集"）')
    p_json.add_argument('--parent-id', default=None, dest='parent_id', help='分组 parentId（优先于 --group）')

    # create-api
    p_api = subparsers.add_parser('create-api', help='创建 API 数据集')
    add_common(p_api)
    p_api.add_argument('--name', required=True, help='数据集名称')
    p_api.add_argument('--code', required=True, help='数据集编码')
    p_api.add_argument('--url', required=True, help='API URL')
    p_api.add_argument('--method', default='get', help='HTTP 方法（默认 get）')
    p_api.add_argument('--agent', type=int, default=0, help='是否使用代理（0=否，1=是，默认 0）')
    p_api.add_argument('--fields', required=True, help='字段定义，格式: name:String,value:String')
    p_api.add_argument('--params', default=None,
                       help='查询参数（联动/钻取必须），格式: paramName:paramTxt:defaultValue:dictCode（后三项可省略，多个逗号分隔，如 "brand:品牌,province:省份"）。⚠️ URL 需同步加占位符，如 ?brand=${brand}&province=${province}')
    p_api.add_argument('--group', default='示例数据集', help='数据集分组名称（默认"示例数据集"，自动查询/创建）')
    p_api.add_argument('--parent-id', default=None, dest='parent_id', help='直接指定分组 parentId（优先于 --group）')

    # create-api-batch（批量并发创建 API 数据集）
    p_abatch = subparsers.add_parser('create-api-batch', help='批量并发创建 API 数据集（含字段回写）')
    add_common(p_abatch)
    p_abatch.add_argument('--batch-file', required=True,
                          help='JSON 数组文件，每项 {name, code, url, method?, fields, agent?}')
    p_abatch.add_argument('--out-file', default=None,
                          help='把结果写入此 JSON 文件（含 id/fields/url），供后续绑定脚本使用')
    p_abatch.add_argument('--group', default='示例数据集', help='数据集分组名称（默认"示例数据集"）')
    p_abatch.add_argument('--parent-id', default=None, dest='parent_id', help='分组 parentId（优先于 --group）')
    p_abatch.add_argument('--workers', type=int, default=10, help='字段回写并发线程数（默认 10）')

    # test
    p_test = subparsers.add_parser('test', help='测试数据集')
    add_common(p_test)
    p_test.add_argument('--id', required=True, help='数据集 ID')

    # edit
    p_edit = subparsers.add_parser('edit', help='修改数据集属性')
    add_common(p_edit)
    p_edit.add_argument('--id', required=True, help='数据集 ID')
    p_edit.add_argument('--name', default=None, help='新名称')
    p_edit.add_argument('--code', default=None, help='新编码')
    p_edit.add_argument('--sql', default=None, help='新 SQL 语句')
    p_edit.add_argument('--db-source', default=None, help='新数据源 ID')

    # delete
    p_del = subparsers.add_parser('delete', help='删除数据集')
    add_common(p_del)
    p_del.add_argument('--id', required=True, help='数据集 ID')

    # bind
    p_bind = subparsers.add_parser('bind', help='绑定数据集到组件（单组件）')
    add_common(p_bind)
    p_bind.add_argument('--page', required=True, help='页面 ID')
    p_bind.add_argument('--comp-name', required=True, help='组件名称')
    p_bind.add_argument('--dataset-id', required=True, help='数据集 ID')
    p_bind.add_argument('--dataset-name', required=True, help='数据集名称')
    p_bind.add_argument('--dataset-type', required=True,
                        choices=['sql', 'api', 'json', 'singleFile', 'FILES'],
                        help='数据集类型（FILES/singleFile=文件数据集，SQL 写在数据集 querySql；不在 choices 内的会被 argparse 拒绝）')
    p_bind.add_argument('--mapping', default='', help='类型A: 顶层 dataMapping，格式 "维度=name,数值=value"（filed 必须是 defaults 里的中文语义键）')
    p_bind.add_argument('--field-map', default='', help='类型B.1（JStatsSummary 类）: option.fieldMap，格式 "label=title,value=amt,unit=tail"')
    p_bind.add_argument('--header-keys', default='', help='类型B.7（JScrollBoard 类）: option.header[*].key，格式 "c1,c2,c3"')
    p_bind.add_argument('--field-mapping-keys', default='', dest='field_mapping_keys',
                        help='类型B.5（JScrollList / JScrollTable）: option.fieldMapping[*].key，格式 "col1_key,col2_key,col3_key"（按列顺序对应 API 字段名，原列样式/name 保留）')
    p_bind.add_argument('--content-keys', default='', dest='content_keys',
                        help='类型B.4（JCardScroll / JCardCarousel）: option.contentFieldMapping[*].key，格式 "k1,k2,k3"（按卡片字段槽位顺序对应 API 字段名，原字段样式/name/showLabel 保留）')

    # bind-batch
    p_bbatch = subparsers.add_parser(
        'bind-batch',
        help='批量绑定（一次 query → 改 N 个 target → 一次 save，避免并行 bind 的 race）',
    )
    add_common(p_bbatch)
    p_bbatch.add_argument('--page', required=True, help='页面 ID')
    p_bbatch.add_argument('--batch-file', required=True,
                          help='JSON 数组，每项 {comp_name, dataset_id, dataset_name, dataset_type, mapping?|field_map?|header_keys?}')

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    init_api(args.api_base, args.token)

    if args.command == 'list':
        cmd_list(args)
    elif args.command == 'create-sql':
        cmd_create_sql(args)
    elif args.command == 'create-json':
        cmd_create_json(args)
    elif args.command == 'create-api':
        cmd_create_api(args)
    elif args.command == 'create-api-batch':
        cmd_create_api_batch(args)
    elif args.command == 'test':
        cmd_test(args)
    elif args.command == 'edit':
        cmd_edit(args)
    elif args.command == 'delete':
        cmd_delete(args)
    elif args.command == 'bind':
        cmd_bind(args)
    elif args.command == 'bind-batch':
        cmd_bind_batch(args)


if __name__ == '__main__':
    main()
