"""
files_ops.py — FILES 多文件数据集操作预置脚本
用法:
  py files_ops.py create-bind API_BASE TOKEN PAGE_ID
      --files file1.xlsx file2.xlsx ...   # 可省略，配合 --mock-data 自动生成文件
      --mock-data '[{"name":"华北","sales":100},...]'  # --files 为空时自动生成文件并上传
      --file-format json|csv          # 默认 json（--mock-data 无文件时的生成格式）
      --join-on product_id            # JOIN 键（两表同名列）
      --group-by region,category      # GROUP BY 字段（逗号分隔，格式 table_alias.col 或 col）
      --agg amount                    # SUM 聚合字段
      --comp JMultipleBar             # 组件类型
      --title "各大区各品类销售额"
      --x 50 --y 100 --w 1820 --h 520
      [--ds-name "数据集名称"]        # 默认从 title 生成
      [--parent-id "示例数据集ID"]    # 默认 1516743332632494082
      [--col-name  name]              # 第1个 group-by 字段别名 (默认 name)
      [--col-type  type]              # 第2个 group-by 字段别名 (默认 type)
      [--col-sales sales]             # 聚合字段别名 (默认 sales)
      [--no-chart]                    # 仅创建数据集，不添加图表

  py files_ops.py upload API_BASE TOKEN PAGE_ID --files file1.xlsx ...
      # 仅上传文件，列出表名

  py files_ops.py list-tables API_BASE TOKEN PAGE_ID
      # 列出当前大屏已上传的文件及表名

  py files_ops.py add-chart API_BASE TOKEN PAGE_ID
      --ds-id  DS_ID
      --ds-name "数据集名称"
      --comp JMultipleBar
      --title "图表标题"
      --x 50 --y 100 --w 1820 --h 520
      --fields "name:大区:String,type:品类:String,sales:销售额:Integer"

示例（完整一步，提供文件）:
  py files_ops.py create-bind <api_base> <token> <page_id> \\
      --files products.xlsx orders.xlsx \\
      --join-on product_id \\
      --group-by region,category \\
      --agg amount \\
      --comp JMultipleBar \\
      --title "各大区各品类销售额"

示例（无文件，自动生成 JSON，默认）:
  py files_ops.py create-bind <api_base> <token> <page_id> \\
      --mock-data '[{"name":"华北","sales":120},{"name":"华南","sales":200}]' \\
      --comp JBar \\
      --title "区域销售额"

示例（无文件，自动生成 CSV，兼容旧行为）:
  py files_ops.py create-bind <api_base> <token> <page_id> \\
      --mock-data '[{"name":"华北","sales":120},{"name":"华南","sales":200}]' \\
      --file-format csv \\
      --comp JBar \\
      --title "区域销售额"
"""
import sys, json, os, time, uuid, argparse, subprocess, csv, tempfile
import urllib.request

# ── 工具函数 ─────────────────────────────────────────────────────────────────

def init_bi(api_base, token):
    # 同时把 scripts/ 和 references/（父目录）加入 path，确保找到 bi_utils.py
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, here)
    sys.path.insert(0, os.path.dirname(here))
    import bi_utils as _bu
    _bu.API_BASE = api_base
    _bu.TOKEN    = token
    return _bu

def json_to_csv_file(data: list, name: str = 'mock') -> str:
    """将 JSON 数组写成临时 CSV 文件（UTF-8 无 BOM），返回文件路径。"""
    if not data:
        raise ValueError('mock-data 为空，无法生成 CSV')
    tmp = tempfile.NamedTemporaryFile(
        mode='w', suffix='.csv', prefix=name + '_',
        delete=False, encoding='utf-8', newline=''   # 不用 utf-8-sig，避免 BOM 污染首列名
    )
    headers = list(data[0].keys())
    writer = csv.DictWriter(tmp, fieldnames=headers)
    writer.writeheader()
    writer.writerows(data)
    tmp.close()
    print(f'[auto] 已生成临时 CSV: {tmp.name}  ({len(data)} 行, 列: {headers})')
    return tmp.name

def json_to_json_file(data: list, name: str = 'mock') -> str:
    """将 JSON 数组写成临时 JSON 文件（UTF-8 无 BOM），返回文件路径。
    平台通过文件名后缀 .json 识别格式，表名后缀为 _json，字段名原样保留（无 BOM 问题）。
    """
    if not data:
        raise ValueError('mock-data 为空，无法生成 JSON')
    tmp = tempfile.NamedTemporaryFile(
        mode='w', suffix='.json', prefix=name + '_',
        delete=False, encoding='utf-8'
    )
    json.dump(data, tmp, ensure_ascii=False, indent=2)
    tmp.close()
    print(f'[auto] 已生成临时 JSON: {tmp.name}  ({len(data)} 行, 列: {list(data[0].keys())})')
    return tmp.name

def upload_file(bi, page_id, file_path):
    boundary  = 'bnd_' + uuid.uuid4().hex
    base      = os.path.basename(file_path)
    name, ext = os.path.splitext(base)
    # 文件名加 uuid 后缀（无下划线），避免 H2 按下划线截断表名导致冲突
    # 例如 products.xlsx → productsA1B2C3D4.xlsx → jmf.Sheet1_productsA1B2C3D4_excel
    ts        = uuid.uuid4().hex[:8].upper()
    filename  = f'{name}{ts}{ext}'
    with open(file_path, 'rb') as f:
        data = f.read()
    body = b''
    body += ('--' + boundary + '\r\n').encode()
    body += ('Content-Disposition: form-data; name="reportId"\r\n\r\n').encode()
    body += (page_id + '\r\n').encode()
    body += ('--' + boundary + '\r\n').encode()
    body += ('Content-Disposition: form-data; name="file"; filename="' + filename + '"\r\n').encode()
    # Content-Type 按扩展名区分；平台实际通过文件名后缀判断格式（.json→_json表，.csv→_csv表，.xlsx→_excel表）
    _CTYPES = {
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls':  'application/vnd.ms-excel',
        '.csv':  'text/csv',
        '.json': 'application/json',
    }
    ctype = _CTYPES.get(ext.lower(), 'application/octet-stream')
    body += (f'Content-Type: {ctype}\r\n\r\n').encode()
    body += data + b'\r\n'
    body += ('--' + boundary + '--\r\n').encode()
    url = bi.API_BASE + '/jmreport/source/datasource/files/add'
    req = urllib.request.Request(url, data=body)
    req.add_header('Content-Type',   'multipart/form-data; boundary=' + boundary)
    req.add_header('X-Access-Token', bi.TOKEN)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode('utf-8'))

def get_file_tables(bi, page_id):
    r      = bi._request('GET', '/jmreport/source/datasource/files/get', params={'reportId': page_id})
    result = r.get('result') or {}
    return json.loads(result.get('dbUrl', '[]'))   # [{"fileName":..., "name":"jmf.Sheet1_xxx"}]

def find_col(cols, keywords):
    for kw in [k.lower() for k in keywords]:
        for c in cols:
            if kw in c.lower():
                return c
    return None

def discover_cols(bi, ds_id, ds_entity, table):
    """临时将 SQL 设为 SELECT * LIMIT 3，调 getAllChartData 获取列名列表"""
    payload = dict(ds_entity)
    payload['querySql'] = f'SELECT * FROM {table} LIMIT 3'
    bi._request('POST', '/drag/onlDragDatasetHead/edit', data=payload)
    r    = bi._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={'id': ds_id})
    rows = ((r.get('result') or {}).get('data') or [])
    return list(rows[0].keys()) if rows else []

def get_or_create_group(bi, group_name='示例数据集', default_id='1516743332632494082'):
    r      = bi._request('GET', '/drag/onlDragDatasetHead/getAllGroup')
    groups = r.get('result') or []
    if isinstance(groups, dict):
        groups = groups.get('records', [])
    for g in (groups if isinstance(groups, list) else []):
        if g.get('name') == group_name and g.get('dataType') is None:
            return g.get('id', default_id)
    # 创建
    cr = bi._request('POST', '/drag/onlDragDatasetHead/addGroup', data={'name': group_name})
    return (cr.get('result') or {}).get('id', default_id)

def add_chart_to_page(bi, page_id, comp_type, title, x, y, w, h,
                       ds_id, ds_name, data_mapping, field_option,
                       defaults_path=None):
    """将组件添加到页面（安全：先加载已有 template）"""
    # 优先从 defaults/<CompType>.json 加载；defaults_path 参数保留向后兼容但不再使用
    scripts_dir    = os.path.dirname(os.path.abspath(__file__))
    comp_json_path = os.path.join(scripts_dir, 'defaults', f'{comp_type}.json')
    if os.path.exists(comp_json_path):
        with open(comp_json_path, encoding='utf-8') as _f:
            cfg = json.load(_f)
    elif defaults_path and os.path.exists(defaults_path):
        all_defaults = json.load(open(defaults_path, 'r', encoding='utf-8'))
        cfg = json.loads(json.dumps(all_defaults.get(comp_type, {})))
    else:
        cfg = {}  # 找不到 defaults 时使用空配置，平台会用前端默认值渲染
    cfg.pop('w', None); cfg.pop('h', None)
    cfg['background']  = '#FFFFFF00'
    cfg['borderColor'] = '#FFFFFF00'
    opt = cfg.get('option', {})
    if isinstance(opt, str):
        try:    opt = json.loads(opt)
        except: opt = {}
    t = opt.get('title')
    if isinstance(t, str):
        opt['title'] = {'text': title, 'show': True}
    elif isinstance(t, dict):
        t['text'] = title
    cfg['option'] = opt
    cfg.update({
        'dataType':       2,
        'dataSetId':      ds_id,
        'dataSetName':    ds_name,
        'dataSetType':    'FILES',
        'dataSetApi':     '',
        'dataSetMethod':  'get',
        'dataSetIzAgent': '1',
        'chartData':      '[]',
        'viewLoading':    True,
        'paramOption':    [],
        'dataMapping':    data_mapping,
        'fieldOption':    field_option,
        'size':           {'width': w, 'height': h},
        'chart':          {'subclass': comp_type, 'category': 'Bar'},
        'turnConfig':     {},
        'linkageConfig':  [],
    })
    page = bi.query_page(page_id)
    tmpl = page.get('template', [])
    comp = {
        'i':             bi._gen_uuid(),
        'component':     comp_type,
        'componentName': title,
        'x': x, 'y': y, 'w': w, 'h': h,
        'dataType':      2,
        'config':        json.dumps(cfg, ensure_ascii=False),
        'dataMapping':   {},
        'size':          {'width': w, 'height': h},
        'chart':         {'subclass': comp_type, 'category': 'Bar'},
        'turnConfig':    {},
        'linkageConfig': [],
    }
    tmpl.insert(0, comp)
    bi._page_components[page_id] = tmpl
    bi.save_page(page_id)
    return comp['i']

# ── 子命令实现 ────────────────────────────────────────────────────────────────

def cmd_list_tables(bi, args):
    file_list = get_file_tables(bi, args.page_id)
    if not file_list:
        print('[!] 该大屏暂无上传文件')
        return
    print(f'大屏 {args.page_id} 已上传文件:')
    for f in file_list:
        print(f'  {f.get("fileName","?"):30s} -> {f.get("name")}')

def cmd_upload(bi, args):
    t0 = time.time()
    for fp in args.files:
        print(f'上传: {fp} ...')
        r = upload_file(bi, args.page_id, fp)
        print(f'  {r.get("message","ok")}')
    file_list = get_file_tables(bi, args.page_id)
    print('当前表名:')
    for f in file_list:
        print(f'  {f.get("name")}')
    print(f'耗时: {time.time()-t0:.1f}s')

def cmd_add_chart(bi, args):
    t0 = time.time()
    # 解析 --fields "name:大区:String,type:品类:String,sales:销售额:Integer"
    data_mapping = []
    field_option = []
    SLOT_MAP_3 = ['分组', '维度', '数值']
    SLOT_MAP_2 = ['维度', '数值']
    raw_fields = [f.strip() for f in args.fields.split(',') if f.strip()]
    slots = SLOT_MAP_3 if len(raw_fields) >= 3 else SLOT_MAP_2
    for i, part in enumerate(raw_fields):
        parts = part.split(':')
        fname = parts[0].strip()
        ftxt  = parts[1].strip() if len(parts) > 1 else fname
        ftype = parts[2].strip() if len(parts) > 2 else 'String'
        slot  = slots[i] if i < len(slots) else fname
        data_mapping.append({'filed': slot, 'mapping': fname})
        field_option.append({'label': fname, 'text': ftxt, 'type': ftype, 'value': fname, 'show': 'Y'})
    comp_id = add_chart_to_page(
        bi, args.page_id, args.comp, args.title,
        args.x, args.y, args.w, args.h,
        args.ds_id, args.ds_name,
        data_mapping, field_option
    )
    print(f'[OK] 组件已添加: {comp_id}')
    url = f'{bi.API_BASE}/drag/share/view/{args.page_id}?token={bi.TOKEN}&tenantId=2'
    print(f'预览地址:\n{url}')
    print(f'耗时: {time.time()-t0:.1f}s')

def cmd_create_bind(bi, args):
    t0 = time.time()
    ds_name   = args.ds_name or args.title
    parent_id = args.parent_id or get_or_create_group(bi)

    # ── 0. 无文件时自动生成文件（默认 JSON，--file-format csv 可切换为 CSV）
    auto_tmp = None
    if not args.files:
        if not args.mock_data:
            print('[error] 未提供 --files 也未提供 --mock-data，无法创建文件数据集')
            sys.exit(1)
        try:
            mock_rows = json.loads(args.mock_data)
        except json.JSONDecodeError as e:
            print(f'[error] --mock-data 不是合法 JSON: {e}')
            sys.exit(1)
        safe_name = ds_name.replace(' ', '_')[:20] if ds_name else 'mock'
        fmt = getattr(args, 'file_format', 'json').lower()
        if fmt == 'csv':
            auto_tmp = json_to_csv_file(mock_rows, name=safe_name)
        else:
            auto_tmp = json_to_json_file(mock_rows, name=safe_name)
        args.files = [auto_tmp]

    # ── 1. 创建空 FILES 数据集
    add_r = bi._request('POST', '/drag/onlDragDatasetHead/add', data={
        'name':     ds_name,
        'code':     'files_' + uuid.uuid4().hex[:8],
        'dataType': 'FILES',
        'dbSource': args.page_id,
        'querySql': '',
        'parentId': parent_id,
    })
    ds_id = (add_r.get('result') or {}).get('id')
    print(f'[1] 数据集已创建: {ds_id}')
    if not ds_id:
        print(f'    失败: {add_r}'); sys.exit(1)

    # ── 2. 上传文件
    for fp in args.files:
        print(f'[2] 上传: {os.path.basename(fp)}')
        r = upload_file(bi, args.page_id, fp)
        print(f'    {r.get("message","ok")}')

    # ── 3. 获取表名
    file_list = get_file_tables(bi, args.page_id)
    print(f'[3] 表名: {[f["name"] for f in file_list]}')

    # ── 4. queryById 取实体
    qb_r      = bi._request('GET', '/drag/onlDragDatasetHead/queryById', params={'id': ds_id})
    ds_entity = (qb_r.get('result') or {})

    # ── 5. 自动推断列名（如未指定 SQL）
    col_name  = args.col_name  or 'name'
    col_type  = args.col_type  or 'type'
    col_sales = args.col_sales or 'sales'

    if args.group_by and args.agg and len(args.files) >= 2:
        # 多文件 JOIN 模式
        kws = [k.strip() for k in args.group_by.split(',')]
        join_col = args.join_on

        # 匹配表：按文件名关键词
        ordered_tables = []
        for fp in args.files:
            kw = os.path.splitext(os.path.basename(fp))[0].lower()
            tbl = next((f['name'] for f in file_list if kw in f['name'].lower()),
                       f'jmf.Sheet1_{kw}_excel')
            ordered_tables.append(tbl)

        # 探查每张表列名
        all_cols = {}
        for i, tbl in enumerate(ordered_tables):
            cols = discover_cols(bi, ds_id, ds_entity, tbl)
            alias = chr(ord('a') + i)
            all_cols[alias] = (tbl, cols)
            print(f'[4] 表 {tbl} 列: {cols}')

        # 推断 GROUP BY 和 AGG 字段所在表
        aliases = list(all_cols.keys())
        group_exprs = []
        group_aliases = [col_name, col_type][:len(kws)]
        for i, kw in enumerate(kws):
            found = None
            for alias in aliases:
                _, cols = all_cols[alias]
                col = find_col(cols, [kw])
                if col:
                    found = (alias, col)
                    break
            if found:
                group_exprs.append(f'{found[0]}.{found[1]} as {group_aliases[i]}')
            else:
                group_exprs.append(f'{kw} as {group_aliases[i]}')

        agg_field = None
        for alias in aliases:
            _, cols = all_cols[alias]
            agg_field = find_col(cols, [args.agg])
            if agg_field:
                agg_alias = alias
                break
        agg_expr = f'SUM({agg_alias}.{agg_field}) as {col_sales}' if agg_field else f'SUM({args.agg}) as {col_sales}'

        # 构建 JOIN
        a0, (t0_tbl, _) = list(all_cols.items())[0]
        a1, (t1_tbl, _) = list(all_cols.items())[1]
        agg_sql = (
            f"SELECT {', '.join(group_exprs)}, {agg_expr}\n"
            f"FROM {t0_tbl} {a0}\n"
            f"JOIN {t1_tbl} {a1} ON {a0}.{join_col} = {a1}.{join_col}\n"
            f"GROUP BY {', '.join(g.split(' as ')[0] for g in group_exprs)}\n"
            f"ORDER BY {', '.join(g.split(' as ')[0] for g in group_exprs)}"
        )
    elif len(args.files) == 1:
        # 单表聚合
        kw  = os.path.splitext(os.path.basename(args.files[0]))[0].lower()
        tbl = next((f['name'] for f in file_list if kw in f['name'].lower()),
                   f'jmf.Sheet1_{kw}_excel')
        cols = discover_cols(bi, ds_id, ds_entity, tbl)
        print(f'[4] 表 {tbl} 列: {cols}')
        agg_sql = f'SELECT * FROM {tbl} LIMIT 50'
    else:
        agg_sql = f"SELECT * FROM {ordered_tables[0]} LIMIT 50"
        cols = []

    print(f'[5] SQL:\n{agg_sql}')

    # ── 6. 更新数据集（写 SQL + 字段列表）
    # 优先使用实际发现的列名（cols）；cols 为空时回退到 col_name/col_sales 参数
    num_groups = len(kws) if args.group_by else 1
    if cols and not args.group_by:
        # 单表：用真实列名构建 datasetItemList
        fields = []
        for i, c in enumerate(cols):
            # 最后一列默认当数值型，其余当字符串
            ftype = 'Integer' if i == len(cols) - 1 else 'String'
            fields.append({'fieldName': c, 'fieldTxt': c, 'fieldType': ftype, 'izShow': 'Y', 'orderNum': i})
    else:
        fields = [{'fieldName': col_name, 'fieldTxt': '维度1', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 0}]
        if num_groups >= 2:
            fields.append({'fieldName': col_type, 'fieldTxt': '维度2', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 1})
        fields.append({'fieldName': col_sales, 'fieldTxt': '数值', 'fieldType': 'Integer', 'izShow': 'Y', 'orderNum': len(fields)})

    payload = dict(ds_entity)
    payload['querySql']        = agg_sql
    payload['datasetItemList'] = fields
    bi._request('POST', '/drag/onlDragDatasetHead/edit', data=payload)

    # 自动解析：调用 queryFileFieldBySql 回写实际字段（修复平台丢弃 datasetItemList 问题）
    try:
        parse_r = bi._request('POST', '/drag/onlDragDatasetHead/queryFileFieldBySql', data={
            'sql': agg_sql, 'dbCode': args.page_id, 'paramArray': '[]'
        })
        # 返回结构：result.fieldList（非直接 list）
        raw_result = parse_r.get('result') or {}
        parsed = raw_result.get('fieldList') if isinstance(raw_result, dict) else (raw_result if isinstance(raw_result, list) else [])
        if parsed:
            qb_r2 = bi._request('GET', '/drag/onlDragDatasetHead/queryById', params={'id': ds_id})
            ds2   = qb_r2.get('result') or {}
            ds2['datasetItemList'] = parsed
            bi._request('POST', '/drag/onlDragDatasetHead/edit', data=ds2)
            print(f'    自动解析回写 {len(parsed)} 个字段: {[f.get("fieldName") for f in parsed]}')
    except Exception as _e:
        print(f'    [warn] queryFileFieldBySql 跳过: {_e}')

    # ── 7. 验证
    val_r    = bi._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={'id': ds_id})
    val_data = ((val_r.get('result') or {}).get('data') or [])
    print(f'[6] 验证: {len(val_data)} 条数据')
    if val_data:
        print(f'    样本: {val_data[:2]}')

    # ── 8. 添加图表（用真实列名构建 dataMapping）
    if not args.no_chart:
        if cols and not args.group_by:
            # 单表：用实际发现的列名，首列→维度，末列→数值
            actual_dim = cols[0]
            actual_val = cols[-1]
            data_mapping = [
                {'filed': '维度', 'mapping': actual_dim},
                {'filed': '数值', 'mapping': actual_val},
            ]
            field_option = [
                {'label': actual_dim, 'text': actual_dim, 'type': 'String',  'value': actual_dim, 'show': 'Y'},
                {'label': actual_val, 'text': actual_val, 'type': 'Integer', 'value': actual_val, 'show': 'Y'},
            ]
        elif num_groups >= 2:
            data_mapping = [
                {'filed': '分组', 'mapping': col_type},
                {'filed': '维度', 'mapping': col_name},
                {'filed': '数值', 'mapping': col_sales},
            ]
            field_option = [
                {'label': col_name,  'text': '大区',  'type': 'String',  'value': col_name,  'show': 'Y'},
                {'label': col_type,  'text': '品类',  'type': 'String',  'value': col_type,  'show': 'Y'},
                {'label': col_sales, 'text': '数值',  'type': 'Integer', 'value': col_sales, 'show': 'Y'},
            ]
        else:
            data_mapping = [
                {'filed': '维度', 'mapping': col_name},
                {'filed': '数值', 'mapping': col_sales},
            ]
            field_option = [
                {'label': col_name,  'text': '维度', 'type': 'String',  'value': col_name,  'show': 'Y'},
                {'label': col_sales, 'text': '数值', 'type': 'Integer', 'value': col_sales, 'show': 'Y'},
            ]

        comp_id = add_chart_to_page(
            bi, args.page_id, args.comp, args.title,
            args.x, args.y, args.w, args.h,
            ds_id, ds_name, data_mapping, field_option
        )
        print(f'[7] 图表已添加: {comp_id}')

    url = f'{bi.API_BASE}/drag/share/view/{args.page_id}?token={bi.TOKEN}&tenantId=2'
    print(f'\n预览地址:\n{url}')
    print(f'耗时: {time.time()-t0:.1f}s')
    if auto_tmp and os.path.exists(auto_tmp):
        os.remove(auto_tmp)

# ── CLI 入口 ──────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description='FILES 多文件数据集操作')
    p.add_argument('command',   choices=['create-bind','upload','list-tables','add-chart'])
    p.add_argument('api_base')
    p.add_argument('token')
    p.add_argument('page_id')
    p.add_argument('--files',      nargs='+', default=[])
    p.add_argument('--mock-data',  default='', dest='mock_data',
                   help='JSON 数组字符串，--files 为空时自动生成 CSV 并上传')
    p.add_argument('--join-on',    default='')
    p.add_argument('--group-by',   default='')
    p.add_argument('--agg',        default='')
    p.add_argument('--comp',       default='JMultipleBar')
    p.add_argument('--title',      default='图表')
    p.add_argument('--x',          type=int, default=50)
    p.add_argument('--y',          type=int, default=100)
    p.add_argument('--w',          type=int, default=1820)
    p.add_argument('--h',          type=int, default=520)
    p.add_argument('--ds-name',    default='')
    p.add_argument('--ds-id',      default='')
    p.add_argument('--parent-id',  default='')
    p.add_argument('--col-name',   default='name')
    p.add_argument('--col-type',   default='type')
    p.add_argument('--col-sales',  default='sales')
    p.add_argument('--fields',     default='')   # 仅 add-chart 用
    p.add_argument('--no-chart',   action='store_true')
    p.add_argument('--file-format', default='json', dest='file_format',
                   choices=['json', 'csv'],
                   help='--mock-data 无文件时的生成格式，默认 json（字段名原样保留，无 BOM 问题）')
    args = p.parse_args()

    # bi_utils 与本脚本同目录
    scripts_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, scripts_dir)
    bi = init_bi(args.api_base, args.token)

    if   args.command == 'list-tables':  cmd_list_tables(bi, args)
    elif args.command == 'upload':       cmd_upload(bi, args)
    elif args.command == 'add-chart':    cmd_add_chart(bi, args)
    elif args.command == 'create-bind':  cmd_create_bind(bi, args)

if __name__ == '__main__':
    main()
