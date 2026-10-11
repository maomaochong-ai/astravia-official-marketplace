# -*- coding: utf-8 -*-
"""
大屏/仪表盘组件操作工具 —— 增、删、改、查
============================================

使用方式（命令行）：

  # 查看页面所有组件
  py comp_ops.py list <API_BASE> <TOKEN> <PAGE_ID>

  # 删除组件（按名称或类型，单值）
  py comp_ops.py delete <API_BASE> <TOKEN> <PAGE_ID> --name "组件名"
  py comp_ops.py delete <API_BASE> <TOKEN> <PAGE_ID> --type "JAreaMap"
  py comp_ops.py delete <API_BASE> <TOKEN> <PAGE_ID> --id "组件i值"

  # 批量删除（逗号分隔，一次 query+save；替代多次 --type 串行）
  py comp_ops.py delete <API_BASE> <TOKEN> <PAGE_ID> --types "JPie,JRing,JAntvGauge"
  py comp_ops.py delete <API_BASE> <TOKEN> <PAGE_ID> --names "饼图1,柱图2"
  py comp_ops.py delete <API_BASE> <TOKEN> <PAGE_ID> --ids "id1,id2,id3"

  # 编辑组件属性（JSON path 赋值）
  py comp_ops.py edit <API_BASE> <TOKEN> <PAGE_ID> --name "基础柱形图" --set "option.series[0].itemStyle.color=#FFD700"
  py comp_ops.py edit <API_BASE> <TOKEN> <PAGE_ID> --type "JBar" --set "option.title.text=新标题"
  py comp_ops.py edit <API_BASE> <TOKEN> <PAGE_ID> --name "文本" --set "chartData.value=新文本内容"
  py comp_ops.py edit <API_BASE> <TOKEN> <PAGE_ID> --name "数字指标" --set "option.body.fontSize=48" --set "option.body.color=#FF0000"

  # 添加组件（静态数据，从 default_configs.json 加载默认 chartData）
  py comp_ops.py add <API_BASE> <TOKEN> <PAGE_ID> --comp "JBar" --title "新柱形图" --x 50 --y 500 --w 450 --h 300
  py comp_ops.py add <API_BASE> <TOKEN> <PAGE_ID> --comp "JText" --title "标题文本" --x 560 --y 15 --w 800 --h 60 --config '{"chartData":{"value":"大屏标题"},"option":{"body":{"color":"#ffffff","fontSize":42,"fontWeight":"bold"}}}'

  # 添加组件（绑定已有数据集，按名称自动查询）
  py comp_ops.py add <API_BASE> <TOKEN> <PAGE_ID> --comp "JLine" --title "登录趋势" --x 50 --y 200 --w 700 --h 400 --dataset-name "统计近十日的登陆次数"

  # 添加组件（绑定已有数据集，按 ID 直接绑定）
  py comp_ops.py add <API_BASE> <TOKEN> <PAGE_ID> --comp "JPie" --title "分类饼图" --x 520 --y 50 --w 400 --h 300 --dataset-id "abc123def456"

  # 一键：创建 SQL 数据集 + 添加图表（最常用！）
  py comp_ops.py add <API_BASE> <TOKEN> <PAGE_ID> --comp "JPie" --title "男女比例" --x 735 --y 365 --w 450 --h 350 --create-sql "SELECT sex as name, COUNT(*) AS value FROM demo WHERE sex IS NOT NULL AND sex != '' GROUP BY sex" --fields "name:String,value:String" --dict "name=sex"

  # 一键创建（自定义数据集名称和编码）
  py comp_ops.py add <API_BASE> <TOKEN> <PAGE_ID> --comp "JBar" --title "部门统计" --x 50 --y 200 --w 600 --h 380 --create-sql "SELECT depart as name, COUNT(*) as value FROM demo GROUP BY depart" --ds-name "部门统计数据集" --ds-code "dept_stat" --fields "name:String,value:String"

  # 一键创建带 FreeMarker 查询参数的 SQL 数据集 + 图表（--sql-params）
  py comp_ops.py add <API_BASE> <TOKEN> <PAGE_ID> --comp "JPie" --title "各年龄人数" --x 735 --y 365 --w 450 --h 350 --sql-file sql.txt --ds-name "各年龄人数统计" --fields "name:String,value:String" --sql-params "sex:性别::sex"

  # 移动/缩放组件
  py comp_ops.py move <API_BASE> <TOKEN> <PAGE_ID> --name "基础柱形图" --x 100 --y 200 --w 600 --h 400
"""

import sys, json, os, argparse

# ============================================================
# bi_utils 加载（自动查找）
# ============================================================
def _find_bi_utils():
    """按优先级查找 bi_utils.py"""
    candidates = [
        os.path.dirname(os.path.abspath(__file__)),                    # 同目录
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'),# 上级目录(references/)
        os.getcwd(),                                                    # 当前工作目录
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
# 核心操作函数
# ============================================================
def load_template(page_id):
    """加载页面模板，返回组件列表"""
    page = query_page(page_id)
    tmpl = page.get('template') or []
    if isinstance(tmpl, str):
        tmpl = json.loads(tmpl) or []
    # 确保每个组件的 config 是 dict
    for comp in tmpl:
        cfg = comp.get('config', {})
        if isinstance(cfg, str):
            try:
                comp['config'] = json.loads(cfg)
            except:
                comp['config'] = {}
    return tmpl


def save_template(page_id, tmpl):
    """保存组件列表到页面"""
    # config 转回字符串供 save_page 使用
    for comp in tmpl:
        cfg = comp.get('config', {})
        if isinstance(cfg, dict):
            comp['config'] = cfg  # bi_utils save_page 内部会 json.dumps template
    bi_utils._page_components[page_id] = tmpl
    save_page(page_id)


def find_components(tmpl, name=None, comp_type=None, comp_id=None):
    """在 template 中查找组件（包括 JGroup 内部）"""
    results = []
    for comp in tmpl:
        matched = False
        if comp_id and comp.get('i') == comp_id:
            matched = True
        elif name and comp.get('componentName', '') == name:
            matched = True
        elif comp_type and comp.get('component') == comp_type:
            matched = True
        if matched:
            results.append(('top', comp))
        # 检查 JGroup 内部
        if comp.get('component') == 'JGroup':
            elements = comp.get('props', {}).get('elements', [])
            for el in elements:
                el_matched = False
                if comp_id and el.get('i') == comp_id:
                    el_matched = True
                elif name and el.get('componentName', '') == name:
                    el_matched = True
                elif comp_type and el.get('component') == comp_type:
                    el_matched = True
                if el_matched:
                    results.append(('group', el, comp))
    return results


def set_nested(obj, path, value):
    """
    按路径设置嵌套字典的值。
    支持: option.series[0].itemStyle.color, chartData.value, option.body.fontSize
    """
    parts = []
    for p in path.split('.'):
        # 解析数组索引 如 series[0]
        if '[' in p:
            key = p[:p.index('[')]
            idx = int(p[p.index('[')+1:p.index(']')])
            parts.append(('key', key))
            parts.append(('idx', idx))
        else:
            parts.append(('key', p))

    current = obj
    for i, (kind, val) in enumerate(parts[:-1]):
        if kind == 'key':
            if isinstance(current, dict):
                if val not in current:
                    # 看下一步是数组还是字典
                    next_kind = parts[i+1][0] if i+1 < len(parts) else 'key'
                    current[val] = [] if next_kind == 'idx' else {}
                current = current[val]
        elif kind == 'idx':
            if isinstance(current, list):
                while len(current) <= val:
                    current.append({})
                current = current[val]

    last_kind, last_val = parts[-1]
    if last_kind == 'key':
        if isinstance(current, dict):
            current[last_val] = _auto_type(value, last_val)
    elif last_kind == 'idx':
        if isinstance(current, list):
            while len(current) <= last_val:
                current.append({})
            current[last_val] = _auto_type(value)


# 末尾 key 含这些词时强制保留字符串，不做数字转换
_STRING_KEY_SUFFIXES = (
    'title', 'text', 'name', 'label', 'color', 'unit',
    'url', 'href', 'image', 'prefix', 'suffix',
    'placeholder', 'content', 'subtitle', 'extra',
    'datatitle', 'maptitle', 'componentname',
)


def _auto_type(val, key=None):
    """字符串自动转换为合适类型；标题/文本类 key 强制保留字符串"""
    if isinstance(val, str):
        if val.lower() == 'true':
            return True
        if val.lower() == 'false':
            return False
        if val.lower() == 'null' or val.lower() == 'none':
            return None
        # 标题/文本/颜色类字段强制字符串，不尝试数字转换
        if key and key.lower() in _STRING_KEY_SUFFIXES:
            return val
        try:
            if '.' in val:
                return float(val)
            return int(val)
        except ValueError:
            pass
        # 尝试 JSON 解析
        if val.startswith('{') or val.startswith('['):
            try:
                return json.loads(val)
            except:
                pass
    return val


# ============================================================
# 命令实现
# ============================================================
def cmd_list(args):
    """列出页面所有组件"""
    tmpl = load_template(args.page_id)
    print(f'页面共 {len(tmpl)} 个组件：\n')
    print(f'{"序号":<4} {"组件ID":<36} {"类型":<20} {"名称":<20} {"位置":<12} {"尺寸":<12}')
    print('-' * 110)
    for i, comp in enumerate(tmpl):
        cid = comp.get('i', '?')
        ctype = comp.get('component', '?')
        cname = comp.get('componentName', '')
        x, y = comp.get('x', 0), comp.get('y', 0)
        w, h = comp.get('w', 0), comp.get('h', 0)
        print(f'{i+1:<4} {cid:<36} {ctype:<20} {cname:<20} ({x},{y}){"":<4} {w}x{h}')
        # JGroup 内部
        if ctype == 'JGroup':
            elements = comp.get('props', {}).get('elements', [])
            for j, el in enumerate(elements):
                eid = el.get('i', '?')
                etype = el.get('component', '?')
                ename = el.get('componentName', '')
                ex, ey = el.get('x', 0), el.get('y', 0)
                ew, eh = el.get('w', 0), el.get('h', 0)
                print(f'  └{j+1:<2} {eid:<36} {etype:<20} {ename:<20} ({ex},{ey}){"":<4} {ew}x{eh}')


def cmd_delete(args):
    """删除组件"""
    tmpl = load_template(args.page_id)
    original_count = len(tmpl)

    new_tmpl = []
    removed = 0
    for comp in tmpl:
        # 检查 JGroup 内部
        if comp.get('component') == 'JGroup':
            elements = comp.get('props', {}).get('elements', [])
            new_elements = []
            for el in elements:
                if _match_comp(el, args):
                    removed += 1
                    print(f'  删除(组内): {el.get("componentName", "")} ({el.get("component", "")})')
                else:
                    new_elements.append(el)
            comp['props']['elements'] = new_elements

        if _match_comp(comp, args):
            removed += 1
            print(f'  删除: {comp.get("componentName", "")} ({comp.get("component", "")})')
        else:
            new_tmpl.append(comp)

    if removed == 0:
        print('未找到匹配的组件')
        return

    save_template(args.page_id, new_tmpl)
    print(f'共删除 {removed} 个组件，剩余 {len(new_tmpl)} 个')


def cmd_edit(args):
    """编辑组件属性"""
    tmpl = load_template(args.page_id)

    edited = 0
    for comp in tmpl:
        targets = []
        if _match_comp(comp, args):
            targets.append(comp)
        # JGroup 内部
        if comp.get('component') == 'JGroup':
            for el in comp.get('props', {}).get('elements', []):
                if _match_comp(el, args):
                    targets.append(el)

        for target in targets:
            cfg = target.get('config', {})
            if isinstance(cfg, str):
                try:
                    cfg = json.loads(cfg)
                except:
                    cfg = {}
                target['config'] = cfg

            # 顶层字段列表（直接写组件顶层，不进 config）
            TOP_LEVEL_FIELDS = {'componentName', 'disabled', 'selected', 'x', 'y', 'w', 'h'}
            for s in args.set:
                if '=' not in s:
                    print(f'无效的 --set 参数（需要 key=value 格式）: {s}')
                    continue
                path, value = s.split('=', 1)
                # 防呆：用户若误写 "config.xxx" 前缀，自动剥离并提示
                # （--set 路径默认从 config 起算，加 config. 会落到 config.config.xxx）
                if path.startswith('config.'):
                    stripped = path[len('config.'):]
                    print(f'  [提示] --set 路径自动从 config 起算，已剥离前缀: {path} -> {stripped}')
                    path = stripped
                if path in TOP_LEVEL_FIELDS:
                    target[path] = value
                    print(f'  设置 {target.get("componentName","")}: {path} = {value}')
                else:
                    set_nested(cfg, path, value)
                    print(f'  设置 {target.get("componentName","")}: config.{path} = {value}')
            edited += 1

    if edited == 0:
        print('未找到匹配的组件')
        return

    save_template(args.page_id, tmpl)
    print(f'共编辑 {edited} 个组件')


def _load_default_configs(comp_key=None):
    """
    加载组件默认配置。
    - 传入 comp_key：优先从 defaults/ 目录按需加载单个组件文件（快），
      找不到时回退到完整 default_configs.json。
    - 不传 comp_key：加载完整 default_configs.json（兼容旧调用）。
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))

    if comp_key:
        # 按需加载：只读一个组件文件
        fname = comp_key.replace('/', '_').replace(' ', '_') + '.json'
        defaults_dir = os.path.join(script_dir, 'defaults')
        single_path = os.path.join(defaults_dir, fname)
        if os.path.exists(single_path):
            with open(single_path, 'r', encoding='utf-8') as f:
                return {comp_key: json.load(f)}
        # 找不到单文件时回退到完整文件
    candidates = [
        os.path.join(script_dir, 'default_configs.json'),
        os.path.normpath(os.path.join(script_dir, '..', 'scripts', 'default_configs.json')),
    ]
    for p in candidates:
        if os.path.exists(p):
            with open(p, 'r', encoding='utf-8') as f:
                return json.load(f)
    return {}


def _clean_ref_values(obj):
    """清理 __ref: 引用值，替换为合理的默认值"""
    if isinstance(obj, str) and obj.startswith('__ref:'):
        return None
    if isinstance(obj, dict):
        if '__type' in obj and obj.get('__type') == 'LinearGradient':
            return '#64b5f6'  # 渐变色降级为纯色
        return {k: _clean_ref_values(v) for k, v in obj.items() if _clean_ref_values(v) is not None}
    if isinstance(obj, list):
        cleaned = [_clean_ref_values(item) for item in obj]
        return [item for item in cleaned if item is not None]
    return obj


def _deep_merge_config(base, override):
    """深度合并配置，override 优先"""
    import copy
    result = copy.deepcopy(base)
    for k, v in override.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = _deep_merge_config(result[k], v)
        else:
            result[k] = copy.deepcopy(v)
    return result


# 数据集查询委托给 bi_utils，避免多个脚本重复实现
_query_dataset_by_name = bi_utils.find_dataset_by_name
_fetch_dataset_detail = bi_utils.fetch_dataset_detail


def _build_dataset_config(ds, base_data_mapping=None):
    """根据数据集信息构建 dataType=2 的绑定配置"""
    ds_type = ds.get('dataType', 'sql')
    ds_sql = ds.get('querySql', '')
    items = ds.get('onlDragDatasetItemList', []) or ds.get('datasetItemList', []) or []

    # list 接口不返回字段列表，需要通过 getAllChartData 推断字段
    if not items:
        ds_id = ds.get('id', '')
        if ds_id:
            try:
                test_resp = bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={'id': ds_id})
                test_data = test_resp.get('result', {}).get('data', [])
                if test_data and isinstance(test_data, list) and len(test_data) > 0:
                    sample = test_data[0]
                    if isinstance(sample, dict):
                        items = [{'fieldName': k, 'fieldTxt': k, 'fieldType': 'String', 'izShow': 'Y'}
                                 for k in sample.keys()]
                        print(f'通过数据测试推断出字段: {[it["fieldName"] for it in items]}')
            except Exception as e:
                print(f'警告: 数据集字段推断失败: {e}')

    # fieldOption
    field_option = []
    for item in items:
        fn = item.get('fieldName', '')
        ft = item.get('fieldTxt', fn)
        field_option.append({
            'label': fn, 'text': ft, 'type': item.get('fieldType', 'String'),
            'value': fn, 'show': item.get('izShow', 'Y')
        })

    # dataMapping: 用默认模板的 filed 槽位，按顺序填入字段名
    field_names = [item.get('fieldName', '') for item in items]
    if base_data_mapping and isinstance(base_data_mapping, list):
        import copy
        data_mapping = copy.deepcopy(base_data_mapping)
        for i, dm in enumerate(data_mapping):
            if i < len(field_names):
                dm['mapping'] = field_names[i]
            else:
                dm['mapping'] = ''
    else:
        data_mapping = []
        labels = ['维度', '数值', '分组']
        for i, fn in enumerate(field_names[:3]):
            data_mapping.append({'filed': labels[i] if i < len(labels) else f'字段{i}', 'mapping': fn})

    # paramOption
    params = ds.get('onlDragDatasetParamList', []) or ds.get('datasetParamList', []) or []
    param_option = []
    for p in params:
        param_option.append({
            'defaultVal': p.get('paramValue', ''), 'label': p.get('paramName', ''),
            'text': p.get('paramTxt', ''), 'type': 'string', 'value': p.get('paramName', '')
        })

    return {
        'dataType': 2,
        'dataSetId': ds.get('id', ''),
        'dataSetName': ds.get('name', ''),
        'dataSetType': ds_type,
        'dataSetApi': ds_sql,
        'dataSetMethod': ds.get('apiMethod', 'get'),
        'dataSetIzAgent': ds.get('izAgent', '0') if ds_type == 'api' else '1',
        'dataMapping': data_mapping,
        'fieldOption': field_option,
        'paramOption': param_option,
        'chartData': '[]',
        'viewLoading': True,
    }


def _parse_sql_params(params_str):
    """
    解析 --sql-params 参数字符串为 datasetParamList 格式。

    格式: "paramName:paramTxt:defaultValue:dictCode" 多个用逗号分隔
    - paramTxt/defaultValue/dictCode 可省略
    - 示例: "sex:性别::sex,age:年龄" → sex(性别,无默认值,字典sex) + age(年龄)

    返回:
        [{'paramName':'sex','paramTxt':'性别','paramValue':'','dictCode':'sex'}, ...]
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
        result.append({
            'paramName': param_name,
            'paramTxt': param_txt,
            'paramValue': param_value,
            'dictCode': dict_code,
        })
    return result


def _create_or_reuse_sql_dataset(args):
    """
    创建或复用 SQL 数据集，返回数据集记录 dict。
    支持 --create-sql, --db-source, --ds-name, --ds-code, --fields, --dict, --sql-params 参数。
    遵循「先查后建」规则。
    """
    ds_display_name = getattr(args, 'ds_name', None) or args.title or args.comp
    ds_code = getattr(args, 'ds_code', None) or ds_display_name.replace(' ', '_').lower()
    db_source = getattr(args, 'db_source', None) or '707437208002265088'
    sql = args.create_sql
    fields_str = getattr(args, 'fields', None) or 'name:String,value:String'

    # 先查后建
    existing = bi_utils._request('GET', '/drag/onlDragDatasetHead/list',
                                  params={'pageNo': 1, 'pageSize': 10, 'name': ds_display_name})
    records = existing.get('result', {}).get('records', [])
    for r in records:
        if r.get('name') == ds_display_name:
            print(f'数据集已存在，复用: {ds_display_name} (ID: {r["id"]})')
            return r

    # 解析字段
    field_list = []
    for idx, part in enumerate(fields_str.split(',')):
        part = part.strip()
        if ':' not in part:
            continue
        fn, ft = part.split(':', 1)
        item = {
            'fieldName': fn.strip(), 'fieldTxt': fn.strip(),
            'fieldType': ft.strip(), 'izShow': 'Y', 'orderNum': idx,
        }
        # 字典绑定: --dict "name=sex,age=age_dict"
        dict_str = getattr(args, 'dict', None)
        if dict_str:
            for dp in dict_str.split(','):
                dp = dp.strip()
                if '=' in dp:
                    df, dc = dp.split('=', 1)
                    if df.strip() == fn.strip():
                        item['dictCode'] = dc.strip()
        field_list.append(item)

    if not field_list:
        print('错误: 字段解析失败')
        return None

    # 解析查询参数
    sql_params_str = getattr(args, 'sql_params', None)
    param_list = _parse_sql_params(sql_params_str)
    if param_list:
        print(f'查询参数: {[p["paramName"] for p in param_list]}')

    # 查询或创建 "示例数据集" 分组
    parent_id = '0'
    try:
        grp_resp = bi_utils._request('GET', '/drag/onlDragDatasetHead/getAllGroup')
        grp_list = grp_resp.get('result') or []
        if isinstance(grp_list, list):
            for g in grp_list:
                if g.get('name') == '示例数据集' and g.get('dataType') is None:
                    parent_id = g.get('id', '0')
                    break
        if parent_id == '0':
            import re as _re
            add_g = bi_utils._request('POST', '/drag/onlDragDatasetHead/addGroup',
                                      data={'name': '示例数据集', 'code': 'example_dataset', 'parentId': '0'})
            parent_id = add_g.get('result') or '0'
            print(f'已创建数据集分组: 示例数据集 (id={parent_id})')
    except Exception as e:
        print(f'分组查询异常，使用根目录: {e}')

    # 创建数据集
    payload = {
        'name': ds_display_name,
        'code': ds_code,
        'dataType': 'sql',
        'dbSource': db_source,
        'querySql': sql,
        'apiMethod': 'GET',
        'parentId': parent_id,
        'datasetItemList': field_list,
        'datasetParamList': param_list,
    }
    result = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data=payload)
    if not result.get('success'):
        print(f'数据集创建失败: {result.get("message", "")}')
        return None

    ds = result.get('result', {})
    ds_id = ds.get('id', '') if isinstance(ds, dict) else ds
    print(f'数据集创建成功: {ds_display_name} (ID: {ds_id})')

    # 【2026-04-03 新增】调用 queryFieldBySql 进行查询解析（与前端"查询解析"按钮逻辑一致）
    try:
        parse_resp = bi_utils._request('POST', '/drag/onlDragDatasetHead/queryFieldBySql', data={
            'sql': sql,
            'dbCode': db_source,
            'paramArray': '[]'
        })
        if parse_resp.get('success') and parse_resp.get('result', {}).get('fieldList'):
            parsed_fields = parse_resp['result']['fieldList']
            print(f'查询解析成功: {len(parsed_fields)} 个字段')
            # 更新字段列表
            for idx, f in enumerate(parsed_fields):
                f['orderNum'] = idx
                f['izShow'] = 'Y'
            # 回写字段到数据集
            ds_detail = bi_utils._request('GET', '/drag/onlDragDatasetHead/queryById', params={'id': ds_id})
            ds_record = ds_detail.get('result') or {}
            ds_record['datasetItemList'] = parsed_fields
            bi_utils._request('POST', '/drag/onlDragDatasetHead/edit', data=ds_record)
            print(f'字段已更新: {[f.get("fieldName") for f in parsed_fields]}')
        else:
            print(f'查询解析跳过: {parse_resp.get("message", "未知原因")}')
    except Exception as e:
        print(f'查询解析异常: {e}')

    # 测试数据集
    test = bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={'id': ds_id})
    test_data = test.get('result', {})
    if isinstance(test_data, dict):
        rows = test_data.get('data', [])
        dict_opts = test_data.get('dictOptions', {})
        print(f'数据预览: {json.dumps(rows[:5], ensure_ascii=False)}')
        if dict_opts:
            print(f'字典翻译: {json.dumps(dict_opts, ensure_ascii=False)}')
    else:
        rows = test_data if isinstance(test_data, list) else []
        dict_opts = {}

    # 构造返回的记录（模拟 list 接口返回格式）
    record = {
        'id': ds_id if isinstance(ds_id, str) else ds.get('id', ''),
        'name': ds_display_name,
        'code': ds_code,
        'dataType': 'sql',
        'dbSource': db_source,
        'querySql': sql,
        'apiMethod': 'GET',
        'onlDragDatasetItemList': field_list,
        'onlDragDatasetParamList': param_list,
        '_dictOptions': dict_opts,  # 额外携带字典翻译供组件使用
    }
    return record


def _resolve_comp_type(comp_key):
    """
    将 default_configs.json 中的变体 key（如 JStatsSummary_1）解析为实际 Vue 组件名（JStatsSummary）。
    变体后缀 _1/_2/_3 等仅用于选择不同默认配置，不是真实组件类型。
    """
    import re
    # 匹配 CompName_后缀 格式（数字或中文），去掉后缀提取实际组件类型
    # 如 JStatsSummary_1 -> JStatsSummary, JScrollList_滚动列表(多行+序号) -> JScrollList
    m = re.match(r'^(J[A-Za-z]+)_(.+)$', comp_key)
    if m:
        return m.group(1)
    return comp_key


def cmd_add(args):
    """添加组件（支持静态数据 + 数据集绑定 + 一键创建SQL数据集）"""
    tmpl = load_template(args.page_id)
    bi_utils._page_components[args.page_id] = tmpl

    # 1. 按需加载目标组件的默认配置（只读一个文件，比加载全量快）
    all_defaults = _load_default_configs(comp_key=args.comp)
    base_config = all_defaults.get(args.comp, {})
    base_config = _clean_ref_values(base_config) or {}
    if base_config:
        print(f'已加载 {args.comp} 默认配置（含 chartData + option）')
    else:
        print(f'警告: 未找到 {args.comp} 的默认配置，使用最小配置')

    # 解析实际组件类型（去掉变体后缀，如 JStatsSummary_1 -> JStatsSummary）
    actual_comp_type = _resolve_comp_type(args.comp)

    # 2. 解析用户自定义 config（覆盖默认值）
    user_config = {}
    if args.config:
        try:
            user_config = json.loads(args.config)
        except json.JSONDecodeError as e:
            print(f'config JSON 解析失败: {e}')
            return

    # 3. 合并：默认配置 ← 用户配置
    config = _deep_merge_config(base_config, user_config) if base_config else user_config

    # 3.5 一键创建 SQL 数据集（--create-sql 或 --sql-file）
    sql_file = getattr(args, 'sql_file', None)
    if sql_file and os.path.isfile(sql_file):
        with open(sql_file, 'r', encoding='utf-8') as f:
            args.create_sql = f.read().strip()
        print(f'从文件读取 SQL: {sql_file}')
    create_sql = getattr(args, 'create_sql', None)
    if create_sql:
        ds_record = _create_or_reuse_sql_dataset(args)
        if ds_record:
            # 将创建结果注入 dataset_name 参数，复用下方绑定逻辑
            args.dataset_name = None
            args.dataset_id = ds_record['id']
            # 直接构建绑定配置（不依赖 list 接口再查一次）
            base_dm = config.get('dataMapping', None)
            ds_cfg = _build_dataset_config(ds_record, base_dm)
            # 携带字典翻译到组件 config
            dict_opts = ds_record.get('_dictOptions', {})
            if dict_opts:
                ds_cfg['dictOptions'] = dict_opts
            config = _deep_merge_config(config, ds_cfg)
            dataset_bound = True
        else:
            print('数据集创建失败，回退为静态数据')
            dataset_bound = False
    else:
        dataset_bound = False

    # 4. 数据集绑定（--dataset-name 或 --dataset-id，仅在未通过 --create-sql 绑定时执行）
    ds_name = getattr(args, 'dataset_name', None)
    ds_id = getattr(args, 'dataset_id', None)
    if not dataset_bound and (ds_id or ds_name):
        ds_record = None
        if ds_id:
            ds_record = _fetch_dataset_detail(ds_id)
            if ds_record:
                print(f'已找到数据集: {ds_record.get("name","")} (ID={ds_id})')
            else:
                print(f'警告: 未找到 ID={ds_id} 的数据集，使用静态数据')
        elif ds_name:
            ds_record = _query_dataset_by_name(ds_name)
            if ds_record:
                print(f'已找到数据集: {ds_name} (ID={ds_record["id"]})')
            else:
                print(f'警告: 未找到名称为「{ds_name}」的数据集，使用静态数据')

        if ds_record:
            base_dm = config.get('dataMapping', None)
            ds_cfg = _build_dataset_config(ds_record, base_dm)
            config = _deep_merge_config(config, ds_cfg)
            dataset_bound = True

    # 5. 大屏强制设置
    config.setdefault('background', '#FFFFFF00')
    config.setdefault('borderColor', '#FFFFFF00')
    config.setdefault('dataType', 1)
    config.setdefault('w', args.w)
    config.setdefault('h', args.h)

    # 6. chartData 序列化为 JSON 字符串（API 要求）
    if 'chartData' in config and not isinstance(config['chartData'], str):
        config['chartData'] = json.dumps(config['chartData'], ensure_ascii=False)

    # 7. 大屏模式下 card.title 必须为空
    if 'option' not in config:
        config['option'] = {}
    config['option'].setdefault('card', {'title': '', 'extra': '', 'rightHref': '', 'size': 'default'})
    if 'card' in config['option']:
        config['option']['card']['title'] = ''

    # 8. 设置图表标题（通过 option.title，非 card.title）
    if actual_comp_type not in ('JText', 'JDragBorder', 'JDragDecoration', 'JImg', 'JCurrentTime'):
        if 'title' not in config['option']:
            config['option']['title'] = {}
        if args.title:
            config['option']['title']['text'] = args.title
        config['option']['title'].setdefault('show', True)
        config['option']['title'].setdefault('textStyle', {})
        config['option']['title']['textStyle'].setdefault('color', '#ffffff')
        config['option']['title']['textStyle'].setdefault('fontSize', 14)

    from bi_utils import add_component
    comp = add_component(args.page_id, actual_comp_type, args.title or args.comp,
                         args.x, args.y, args.w, args.h, config)
    save_page(args.page_id)
    ds_info = f' [数据集: {config.get("dataSetName","")}]' if dataset_bound else ' [静态数据]'
    print(f'添加成功: {args.title} ({args.comp}) 位置({args.x},{args.y}) 尺寸{args.w}x{args.h}{ds_info}')
    print(f'组件ID: {comp["i"]}')


def cmd_move(args):
    """移动/缩放组件"""
    tmpl = load_template(args.page_id)

    moved = 0
    for comp in tmpl:
        targets = []
        if _match_comp(comp, args):
            targets.append(comp)
        if comp.get('component') == 'JGroup':
            for el in comp.get('props', {}).get('elements', []):
                if _match_comp(el, args):
                    targets.append(el)

        for target in targets:
            changes = []
            if args.x is not None:
                target['x'] = args.x
                changes.append(f'x={args.x}')
            if args.y is not None:
                target['y'] = args.y
                changes.append(f'y={args.y}')
            if args.w is not None:
                target['w'] = args.w
                changes.append(f'w={args.w}')
            if args.h is not None:
                target['h'] = args.h
                changes.append(f'h={args.h}')
            # 同步 config 中的尺寸
            cfg = target.get('config', {})
            if isinstance(cfg, str):
                try: cfg = json.loads(cfg)
                except: cfg = {}
                target['config'] = cfg
            if args.w is not None:
                cfg['w'] = args.w
                if 'size' in cfg:
                    cfg['size']['width'] = args.w
            if args.h is not None:
                cfg['h'] = args.h
                if 'size' in cfg:
                    cfg['size']['height'] = args.h
            if changes:
                print(f'  移动 {target.get("componentName","")}: {", ".join(changes)}')
                moved += 1

    if moved == 0:
        print('未找到匹配的组件')
        return

    save_template(args.page_id, tmpl)
    print(f'共移动 {moved} 个组件')


def _split_csv(val):
    """逗号分隔字符串 → 去空白的非空元素集合"""
    if not val:
        return set()
    return {x.strip() for x in val.split(',') if x.strip()}


def _match_comp(comp, args):
    """检查组件是否匹配筛选条件。

    单值 (--id/--name/--type) 与批量 (--ids/--names/--types) 共存，
    匹配任一条件即视为命中（OR 逻辑）。
    """
    # 单值匹配（向后兼容）
    if hasattr(args, 'id') and args.id and comp.get('i') == args.id:
        return True
    if hasattr(args, 'name') and args.name and comp.get('componentName', '') == args.name:
        return True
    if hasattr(args, 'type') and args.type and comp.get('component') == args.type:
        return True
    # 批量匹配
    if hasattr(args, 'ids') and args.ids and comp.get('i') in _split_csv(args.ids):
        return True
    if hasattr(args, 'names') and args.names and comp.get('componentName', '') in _split_csv(args.names):
        return True
    if hasattr(args, 'types') and args.types and comp.get('component') in _split_csv(args.types):
        return True
    return False


# ============================================================
# CLI 入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='大屏组件操作工具')
    subparsers = parser.add_subparsers(dest='command', help='操作类型')

    # 通用参数
    def add_common(sub):
        sub.add_argument('api_base', help='API 地址')
        sub.add_argument('token', help='X-Access-Token')
        sub.add_argument('page_id', help='页面 ID')

    def add_filter(sub):
        sub.add_argument('--name', help='按组件名称匹配（单值）')
        sub.add_argument('--type', help='按组件类型匹配（单值，如 JBar）')
        sub.add_argument('--id', help='按组件 ID 匹配（单值）')
        sub.add_argument('--names', help='按组件名称批量匹配（逗号分隔，如 "饼图1,柱图2"）')
        sub.add_argument('--types', help='按组件类型批量匹配（逗号分隔，如 "JPie,JRing,JAntvGauge"）')
        sub.add_argument('--ids', help='按组件 ID 批量匹配（逗号分隔）')

    # list
    p_list = subparsers.add_parser('list', help='列出所有组件')
    add_common(p_list)

    # delete
    p_del = subparsers.add_parser('delete', help='删除组件')
    add_common(p_del)
    add_filter(p_del)

    # edit
    p_edit = subparsers.add_parser('edit', help='编辑组件属性')
    add_common(p_edit)
    add_filter(p_edit)
    p_edit.add_argument('--set', action='append', required=True,
                        help='设置属性，格式: path=value（可多次使用）。⚠️ path 自动从 config 起算，'
                             '写 dataType=2 / option.field.dateField=cal_day，禁止加 config. 前缀'
                             '（误加会自动剥离并提示）。x/y/w/h/componentName 等组件顶层字段除外。')

    # add
    p_add = subparsers.add_parser('add', help='添加组件')
    add_common(p_add)
    p_add.add_argument('--comp', required=True, help='组件类型（如 JBar, JText）')
    p_add.add_argument('--title', default='', help='组件标题')
    p_add.add_argument('--x', type=int, default=50, help='X 坐标')
    p_add.add_argument('--y', type=int, default=50, help='Y 坐标')
    p_add.add_argument('--w', type=int, default=450, help='宽度')
    p_add.add_argument('--h', type=int, default=300, help='高度')
    p_add.add_argument('--config', default=None, help='自定义 config（JSON 字符串）')
    p_add.add_argument('--dataset-name', default=None, dest='dataset_name',
                        help='绑定已有数据集（按名称查询）')
    p_add.add_argument('--dataset-id', default=None, dest='dataset_id',
                        help='绑定已有数据集（按 ID 直接绑定）')
    p_add.add_argument('--create-sql', default=None, dest='create_sql',
                        help='一键创建 SQL 数据集并绑定（SQL 语句）')
    p_add.add_argument('--sql-file', default=None, dest='sql_file',
                        help='从文件读取 SQL（解决 bash 对 != 等特殊字符的转义问题，优先级高于 --create-sql）')
    p_add.add_argument('--db-source', default='707437208002265088', dest='db_source',
                        help='数据源 ID（默认 707437208002265088）')
    p_add.add_argument('--ds-name', default=None, dest='ds_name',
                        help='数据集名称（默认使用 --title）')
    p_add.add_argument('--ds-code', default=None, dest='ds_code',
                        help='数据集编码（默认自动生成）')
    p_add.add_argument('--fields', default='name:String,value:String',
                        help='字段定义（默认 name:String,value:String）')
    p_add.add_argument('--dict', default=None,
                        help='字段字典绑定，格式: fieldName=dictCode（如 name=sex）')
    p_add.add_argument('--sql-params', default=None, dest='sql_params',
                        help='SQL 查询参数（FreeMarker），格式: paramName:paramTxt:defaultValue:dictCode（后三项可省略，多个逗号分隔，如 "sex:性别::sex,age:年龄"）')

    # move
    p_move = subparsers.add_parser('move', help='移动/缩放组件')
    add_common(p_move)
    add_filter(p_move)
    p_move.add_argument('--x', type=int, default=None, help='新 X 坐标')
    p_move.add_argument('--y', type=int, default=None, help='新 Y 坐标')
    p_move.add_argument('--w', type=int, default=None, help='新宽度')
    p_move.add_argument('--h', type=int, default=None, help='新高度')

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    init_api(args.api_base, args.token)

    if args.command == 'list':
        cmd_list(args)
    elif args.command == 'delete':
        cmd_delete(args)
    elif args.command == 'edit':
        cmd_edit(args)
    elif args.command == 'add':
        cmd_add(args)
    elif args.command == 'move':
        cmd_move(args)


if __name__ == '__main__':
    main()
