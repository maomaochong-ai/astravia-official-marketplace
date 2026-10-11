# -*- coding: utf-8 -*-
"""
JeecgBoot 大屏/仪表盘设计器 Python 工具库
用于通过 API 自动创建和管理大屏、仪表盘页面及其组件。

使用方式：
    from bi_utils import *
    init_api('<api_base>', '<token>')
    page_id = create_page('销售大屏', style='bigScreen')
    add_number(page_id, '销售额', x=50, y=50, w=400, h=200, value=128560)
    add_chart(page_id, 'JBar', '月度销售', x=50, y=280, w=860, h=380,
              categories=['1月','2月','3月'], series=[{'name':'销售额','data':[820,932,901]}])
    save_page(page_id)

公共函数分类索引（快速定位）
----------------------------------------
【初始化 / HTTP】
    init_api(api_base, token)                 设置 API_BASE / TOKEN
    _request(method, path, data, params)      底层 HTTP（requests.Session，缺依赖回退 urllib）

【页面 CRUD】
    create_page(name, style, theme, ...)      新建大屏/仪表盘，返回 page_id；自动缓存 _page_components
    query_page(page_id)                       拉完整页面（含 template），同步缓存 desJson
    list_pages(style, page_no, page_size)     分页列表
    save_page(page_id)                        提交组件 + desJson；_page_components 缺失时兜底查询
    delete_page(page_id, physical)            逻辑/物理删除
    recover_page(page_id)                     回收站恢复
    copy_page(page_id)                        复制

【数据集 Helper】
    find_dataset_by_name(name)                按名字查第一条（精确匹配优先）
    fetch_dataset_detail(dataset_id)          按 ID 查 list 详情

【组件通用】
    add_component(page_id, component, title, x, y, w, h, config)
                                              底层组件注入（自动生成 UUID/key/layer）
    update_page(page_id, new_components)      重置 template
    add_to_existing(page_id, fn, *args)       对已有页面调组件函数（先 query_page）

【数值 / 进度 / 指标】
    add_number / add_gauge / add_liquid / add_countdown
    add_progress / add_total_progress

【图表 / 表格 / 排行】
    add_chart(page_id, chart_type, ...)       ECharts 类（JBar/JLine/JPie/...）
    add_table / add_scroll_table
    add_ranking

【文本 / 媒体 / 装饰】
    add_text / add_image / add_current_time
    add_word_cloud / add_color_block
    add_border / add_decoration

【菜单/业务工具】
    gen_menu_sql(parent_name, children, ...)  拼菜单 SQL

【内部辅助】
    _get_mode / _make_card / _gen_key / _gen_uuid
    _resolve_comp_type / _get_category / _deep_merge

> 想查字段细节直接跳到对应 `def` — 全部函数含 docstring + 示例参数。
"""

import json
import urllib.request
import urllib.parse
import time
import random
import uuid
import hashlib

# 可选：requests 提供连接池 + Keep-Alive，单脚本内多次调用显著更快。
# 不可用时回退到 urllib，保持零依赖行为兼容（企业/离线环境）。
try:
    import requests as _requests  # type: ignore
    _SESSION = _requests.Session()
except ImportError:
    _requests = None
    _SESSION = None

# ============================================================
# 全局配置
# ============================================================
API_BASE = ''
TOKEN = ''

# 内存中缓存页面组件数据，save_page 时一次性提交
_page_components = {}  # {page_id: [component_dict, ...]}
_page_info = {}        # {page_id: {name, style, theme, ...}}


# ============================================================
# 大屏 vs 仪表盘 模式预设（颜色、样式完全不同）
# ============================================================
# 大屏（bigScreen）- 深色背景，亮色文字
_BIGSCREEN = {
    'bg': '#FFFFFF00',
    'border_color': '#FFFFFF00',
    'title_color': '#ffffff',
    'axis_color': '#ffffff',
    'grid_color': '#FFFFFF1A',
    'body_color': '#ffffff',
    'suffix_color': '#ffffff',
    'legend_color': '#ffffff',
    'tooltip_color': '#ffffff',
    'card': {'title': '', 'extra': '', 'rightHref': '', 'size': 'small'},
    'number_font_size': 32,
    # 表格
    'table_header_bg': '#0000004D',
    'table_header_color': '#ffffff',
    'table_body_bg': '#0000001A',
    'table_body_color': '#ffffff',
    'table_body_font_size': 14,
    'table_header_font_size': 14,
    # 滚动表格
    'scroll_odd_color': '#0a2732',
    'scroll_even_color': '#003b51',
    'scroll_header_bg': '#0a73ff',
    'scroll_header_color': '#ffffff',
    'scroll_body_color': '#ffffff',
    'scroll_border_color': '#FFFFFF1A',
    # 排行榜
    'ranking_color': '#1370fb',
    'ranking_text_color': '#fff',
}

# 仪表盘（default）- 亮色背景，深色文字，带卡片头
_DASHBOARD = {
    'bg': '#FFFFFF',
    'border_color': '#E8E8E8',
    'title_color': '#464646',
    'axis_color': '#909198',
    'grid_color': '#F3F3F3',
    'body_color': '#464646',
    'suffix_color': '#909198',
    'legend_color': '#464646',
    'tooltip_color': '#464646',
    'card': {
        'title': '',  # 由各函数填充
        'extra': '', 'rightHref': '',
        'size': 'default',
        'headColor': '#FFFFFF',
        'textStyle': {'color': '#464646', 'fontSize': 16, 'fontWeight': 'bold'},
    },
    'number_font_size': 32,
    # 表格
    'table_header_bg': '#FAFAFA',
    'table_header_color': '#464646',
    'table_body_bg': '#FFFFFF',
    'table_body_color': '#666666',
    'table_body_font_size': 13,
    'table_header_font_size': 14,
    # 滚动表格
    'scroll_odd_color': '#FFFFFF',
    'scroll_even_color': '#FAFAFA',
    'scroll_header_bg': '#F0F0F0',
    'scroll_header_color': '#464646',
    'scroll_body_color': '#666666',
    'scroll_border_color': '#E8E8E8',
    # 排行榜
    'ranking_color': '#1890FF',
    'ranking_text_color': '#464646',
}


def _get_mode(page_id):
    """获取页面模式预设（大屏 or 仪表盘）"""
    info = _page_info.get(page_id, {})
    style = info.get('style', 'bigScreen')
    if style == 'default':
        return _DASHBOARD
    return _BIGSCREEN


def _make_card(mode, title):
    """根据模式创建 card 配置。
    大屏模式：card.title 保持为空（标题由 ECharts option.title 显示，避免重复）
    仪表盘模式：card.title 设置标题（卡片头显示）
    """
    card = dict(mode['card'])
    if 'textStyle' in mode['card']:
        card['textStyle'] = dict(mode['card']['textStyle'])
    # 大屏不用 card 标题头，仪表盘用
    if mode is _DASHBOARD:
        card['title'] = title
    else:
        card['title'] = ''
    return card


def init_api(api_base, token):
    """初始化 API 地址和 Token"""
    global API_BASE, TOKEN
    API_BASE = api_base.rstrip('/')
    TOKEN = token
    print(f'[bi_utils] API: {API_BASE}')


# ============================================================
# HTTP 工具
# ============================================================
_SIGNATURE_SECRET = 'dd05f1c54d63749eda95f9fa6d49v442a'
_SIGNED_PATHS = {
    '/drag/onlDragDatasetHead/queryFieldBySql',
    '/drag/onlDragDatasetHead/queryFileFieldBySql',
    '/drag/onlDragDatasetHead/queryAllById',
    '/drag/onlDragDatasetHead/getDictByCodes',
    '/drag/onlDragDatasetHead/getMapDataByCode',
    '/drag/onlDragDatasetHead/getDataForDesign',
    '/drag/onlDragDatasetHead/getTotalData',
    '/drag/onlDragDatasetHead/getTotalDataByCompId',
    '/drag/onlDragDatasetHead/generateChartSse',
    '/drag/onlDragDatasetHead/updateChartOptSse',
    '/drag/onlDragDatasetHead/generateSqlSse',
    '/drag/page/addVisitsNumber',
}


def _compute_signature_headers(path, params, data):
    """为带 @SignatureValidation 的接口生成 X-TIMESTAMP/X-Sign/V-Sign 头。

    算法来自 signing-datasource-guide.md（packages/utils/encryption/signMd5Utils.js 的 Python 实现）。
    """
    json_obj = {}
    if '?' in path:
        qs = path.split('?', 1)[1]
        for kv in qs.split('&'):
            if '=' in kv:
                k, v = kv.split('=', 1)
                json_obj[k] = v
    if params:
        for k, v in params.items():
            if isinstance(v, (int, float)):
                v = str(v)
            json_obj[k] = v
    json_obj.pop('_t', None)
    sorted_obj = dict(sorted(json_obj.items()))
    sign_str = json.dumps(sorted_obj, ensure_ascii=False, separators=(',', ':')) + _SIGNATURE_SECRET
    sign = hashlib.md5(sign_str.encode('utf-8')).hexdigest().upper()

    hdrs = {
        'X-TIMESTAMP': str(int(time.time() * 1000)),
        'X-Sign': sign,
    }
    if data and isinstance(data, dict):
        vjson = dict(data)
        vjson['sign'] = sign
        sign_param_obj = {k: v for k, v in vjson.items() if v and isinstance(v, str)}
        sorted_v = dict(sorted(sign_param_obj.items()))
        vsign_str = json.dumps(sorted_v, ensure_ascii=False, separators=(',', ':')) + _SIGNATURE_SECRET
        hdrs['V-Sign'] = hashlib.md5(vsign_str.encode('utf-8')).hexdigest().upper()
    return hdrs


def _request(method, path, data=None, params=None):
    """发送 HTTP 请求。

    优先走 requests.Session（连接池复用，一次 TCP 握手服务多次请求）；
    环境缺 requests 时无缝回退到 urllib.request，保持行为不变。

    带 @SignatureValidation 的接口（见 _SIGNED_PATHS）自动附加 X-TIMESTAMP/X-Sign/V-Sign。
    """
    url = f'{API_BASE}{path}'
    headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Access-Token': TOKEN,
    }
    if path in _SIGNED_PATHS:
        headers.update(_compute_signature_headers(path, params, data))
    body = None
    if data is not None:
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')

    if _SESSION is not None:
        try:
            resp = _SESSION.request(method, url, params=params, data=body,
                                    headers=headers, timeout=30)
            if resp.status_code >= 400:
                print(f'[bi_utils] HTTP {resp.status_code}: {resp.text}')
                resp.raise_for_status()
            return resp.json()
        except _requests.RequestException as e:
            print(f'[bi_utils] Request error: {e}')
            raise

    # ---- urllib 回退路径 ----
    if params:
        url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else ''
        print(f'[bi_utils] HTTP {e.code}: {error_body}')
        raise
    except Exception as e:
        print(f'[bi_utils] Request error: {e}')
        raise


def _gen_key():
    """生成唯一 key"""
    return f'{int(time.time() * 1000)}_{random.randint(100000, 999999)}'


def _gen_uuid():
    """生成 32 位无横线 UUID"""
    return uuid.uuid4().hex


# ============================================================
# 页面管理 API
# ============================================================
def create_page(name, style='bigScreen', theme=None, background_image=None,
                type_id='0', design_type=100, protection_code=''):
    """
    创建大屏或仪表盘页面。

    Args:
        name: 页面名称
        style: 'bigScreen'=大屏, 'default'=仪表盘
        theme: 主题，默认大屏=dark，仪表盘=default
        background_image: 背景图路径，大屏默认 '/img/bg/bg4.png'
        type_id: 分类 ID，默认 '0'
        design_type: 设计类型 100=PC, 30=手机, 80=平板
        protection_code: 保护密码
    Returns:
        page_id: 页面 ID
    """
    if theme is None:
        theme = 'dark' if style == 'bigScreen' else 'default'
    if background_image is None and style == 'bigScreen':
        background_image = '/img/bg/bg4.png'

    payload = {
        'name': name,
        'type': type_id,
        'protectionCode': protection_code,
        'theme': theme,
        'style': style,
        'backgroundImage': background_image or '',
        'designType': design_type,
    }

    result = _request('POST', '/drag/page/add', data=payload)

    if not result.get('success'):
        raise Exception(f"创建页面失败: {result.get('message', json.dumps(result, ensure_ascii=False))}")

    page_data = result.get('result', {})
    page_id = page_data.get('id')
    if not page_id:
        raise Exception(f"创建页面成功但未返回 ID: {json.dumps(result, ensure_ascii=False)}")

    # 缓存页面信息
    _page_components[page_id] = []
    _page_info[page_id] = {
        'name': name,
        'style': style,
        'theme': theme,
        'backgroundImage': background_image or '',
        'designType': design_type,
        'updateCount': page_data.get('updateCount', 1),
        'path': page_data.get('path', ''),
    }

    print(f'[bi_utils] 页面创建成功: {name} (ID: {page_id})')
    return page_id


def query_page(page_id):
    """查询页面详情（含组件配置）"""
    result = _request('GET', '/drag/page/queryById', params={'id': page_id})
    if not result.get('success'):
        raise Exception(f"查询页面失败: {result.get('message')}")
    page = result.get('result', {})

    # 更新缓存（保留所有关键字段，避免 save_page 时丢失）
    if page_id not in _page_info:
        _page_info[page_id] = {}
    info = _page_info[page_id]
    info['updateCount'] = page.get('updateCount', 1)
    info['name'] = page.get('name', '')
    # 仅当服务器返回了非空值时才更新，避免覆盖 create_page 设置的值
    for field in ('backgroundImage', 'style', 'theme', 'designType'):
        server_val = page.get(field)
        if server_val is not None:
            info[field] = server_val
        elif field not in info:
            info[field] = ''
    # 缓存 desJson（页面宽高等配置），save_page 时回传避免丢失
    info['desJson'] = page.get('desJson', '') or ''

    # 解析 template
    template = page.get('template')
    if template and isinstance(template, str):
        try:
            page['template'] = json.loads(template)
        except:
            pass

    return page


def list_pages(style=None, page_no=1, page_size=50):
    """列表查询页面"""
    params = {'pageNo': page_no, 'pageSize': page_size}
    if style:
        params['style'] = style
    result = _request('GET', '/drag/page/list', params=params)
    if not result.get('success'):
        raise Exception(f"查询列表失败: {result.get('message')}")
    return result.get('result', {})


def save_page(page_id):
    """
    保存页面设计（将所有缓存的组件一次性提交）。

    通过 POST /drag/page/edit 提交，后端会：
    1. 删除所有旧的 OnlDragPageComp 记录
    2. 从 template 中提取 config 创建新的 comp 记录
    3. 更新 template（移除 config，注入 pageCompId）

    优化说明（2026-04-08）：
    - 不再在 save_page 内部调用 query_page，消除额外 API 往返和 updateCount 竞争
    - 用 `page_id in _page_components` 区分"主动设置（含空列表）"vs"未设置"，
      修复删除全部组件后 save_page 用旧模板覆盖的 bug
    - 传 desJson 避免页面宽高配置丢失
    """
    info = _page_info.get(page_id)

    # 若没有缓存的页面元数据（updateCount/name/style 等），先查询一次
    if info is None:
        try:
            query_page(page_id)
            info = _page_info.get(page_id, {})
        except Exception as e:
            print(f'[bi_utils] 查询页面警告: {e}，使用空元数据')
            info = {}

    # 取组件列表：
    #   - page_id 在 _page_components 中（含 [] 空列表）→ 使用缓存值（含有意清空的情形）
    #   - page_id 不在 _page_components 中 → 从服务端拉取，保留现有组件
    if page_id in _page_components:
        components = _page_components[page_id]
    else:
        try:
            page = query_page(page_id)
            info = _page_info.get(page_id, {})
            existing = page.get('template', [])
            components = existing if isinstance(existing, list) else []
        except Exception as e:
            print(f'[bi_utils] 查询页面警告: {e}，使用空组件列表')
            components = []

    # 构建 template JSON
    template = json.dumps(components, ensure_ascii=False)

    payload = {
        'id': page_id,
        'name': info.get('name', ''),
        'template': template,
        'updateCount': info.get('updateCount', 1),
        'style': info.get('style', 'bigScreen'),
        'theme': info.get('theme', 'dark'),
        'backgroundImage': info.get('backgroundImage', ''),
        'designType': info.get('designType', 100),
        'desJson': info.get('desJson', '') or '',
    }

    result = _request('POST', '/drag/page/edit', data=payload)

    if not result.get('success'):
        raise Exception(f"保存页面失败: {result.get('message')}")

    # 更新 updateCount（下次保存时使用最新值，无需重新 query）
    new_count = result.get('result', {})
    if isinstance(new_count, dict):
        info['updateCount'] = new_count.get('updateCount', info.get('updateCount', 1) + 1)
    else:
        info['updateCount'] = info.get('updateCount', 1) + 1

    print(f'[bi_utils] 页面保存成功: {info.get("name", page_id)} ({len(components)} 个组件)')
    return True


def delete_page(page_id, physical=False):
    """
    删除页面。

    Args:
        page_id: 页面 ID
        physical: True=物理删除（彻底），False=逻辑删除（回收站）
    """
    if physical:
        result = _request('DELETE', '/drag/page/physicalDelete', params={'id': page_id})
    else:
        result = _request('DELETE', '/drag/page/delete', params={'id': page_id})

    if not result.get('success'):
        raise Exception(f"删除页面失败: {result.get('message')}")

    # 清理缓存
    _page_components.pop(page_id, None)
    _page_info.pop(page_id, None)

    print(f'[bi_utils] 页面删除成功: {page_id} ({"物理删除" if physical else "逻辑删除"})')
    return True


def recover_page(page_id):
    """恢复回收站中的页面

    后端 /drag/page/recoveryDelete 用 @RequestParam 接 id，必须走 query string；
    传 JSON body 会 400 MissingServletRequestParameterException。
    """
    result = _request('POST', '/drag/page/recoveryDelete', params={'id': page_id})
    if not result.get('success'):
        raise Exception(f"恢复页面失败: {result.get('message')}")
    print(f'[bi_utils] 页面恢复成功: {page_id}')
    return True


# ============================================================
# 数据集查询公共 Helper
# （comp_ops.py / dataset_ops.py 及任何自写脚本都可直接复用）
# ============================================================
def find_dataset_by_name(name, page_size=10):
    """按名称查数据集，返回第一条精确匹配记录；无精确匹配回退模糊首条。

    调用方：comp_ops.add --dataset-name、自写脚本在 bind 前的"先查后建"。
    同名数据集不止一条时请用 ID 绑定避免取错。
    """
    resp = _request('GET', '/drag/onlDragDatasetHead/list',
                    params={'pageNo': 1, 'pageSize': page_size, 'name': name})
    records = resp.get('result', {}).get('records', []) or []
    for r in records:
        if r.get('name', '') == name:
            return r
    return records[0] if records else None


def fetch_dataset_detail(dataset_id, page_size=10):
    """按 ID 查数据集详情（list 接口字段表可能为空，需要的话再调 queryById）。"""
    resp = _request('GET', '/drag/onlDragDatasetHead/list',
                    params={'pageNo': 1, 'pageSize': page_size, 'id': dataset_id})
    records = resp.get('result', {}).get('records', []) or []
    for r in records:
        if r.get('id') == dataset_id:
            return r
    return records[0] if records else None


def copy_page(page_id):
    """复制页面"""
    result = _request('GET', '/drag/page/copyPage', params={'id': page_id})
    if not result.get('success'):
        raise Exception(f"复制页面失败: {result.get('message')}")
    new_page = result.get('result', {})
    new_id = new_page.get('id')
    print(f'[bi_utils] 页面复制成功: {page_id} → {new_id}')
    return new_id


# ============================================================
# 组件添加函数
# ============================================================
def _resolve_comp_type(comp_key):
    """
    将 default_configs.json 变体 key 解析为实际 Vue 组件名。
    如 JStatsSummary_1 -> JStatsSummary，JCardScroll_2 -> JCardScroll。
    _1/_2/_3 后缀只用于选择默认配置模板，不是真实 compType（实测 2026-04-22）。
    """
    import re
    m = re.match(r'^(J[A-Za-z]+)_\d+$', comp_key)
    if m:
        return m.group(1)
    return comp_key


def add_component(page_id, component, title, x, y, w, h, config=None):
    """
    添加通用组件到页面。

    Args:
        page_id: 页面 ID
        component: 组件类型，如 'JBar', 'JNumber', 'JTable'
        title: 组件标题
        x, y: 位置（大屏=像素，仪表盘=栅格）
        w, h: 尺寸（大屏=像素，仪表盘=栅格）
        config: 组件配置 dict（可选，会与默认配置合并）
    Returns:
        component dict（已加入缓存）
    """
    if page_id not in _page_components:
        _page_components[page_id] = []

    key = _gen_key()

    # 变体 key 转换为实际 compType（JStatsSummary_1 -> JStatsSummary）
    actual_component = _resolve_comp_type(component)

    # 栅格单位转换为像素（仪表盘模式）
    info = _page_info.get(page_id, {})
    style = info.get('style', 'bigScreen')
    if style == 'default':
        px_w = w * 75
        px_h = h * 11
    else:
        px_w = w
        px_h = h

    # 基础配置
    default_config = {
        'dataType': 1,
        'timeOut': 0,
        'size': {'width': px_w, 'height': px_h},
        'chart': {
            'subclass': actual_component,
            'category': _get_category(actual_component),
        },
        'option': {},
        'chartData': [],
        'linkageConfig': [],
        'turnConfig': {'url': '', 'type': '_blank'},
        'linkType': 'url',
    }

    # 合并用户配置
    if config:
        _deep_merge(default_config, config)

    # 强制同步 config.w/h/size 与外层 px_w/px_h——defaults JSON 里的尺寸（如
    # JLiquid 默认 450×300）会被合进来变成内层尺寸，与外层不一致时部分组件
    # 渲染会用内层尺寸算动画路径（典型：JLiquid 水波纹画到视野外）。外层是
    # 真相源，这里覆盖回去。
    default_config['w'] = px_w
    default_config['h'] = px_h
    default_config['size'] = {'width': px_w, 'height': px_h}

    # DoubleLineBar 特殊处理：补充 seriesType
    if actual_component == 'DoubleLineBar' and 'seriesType' not in default_config:
        default_config['seriesType'] = []

    comp = {
        'component': actual_component,
        'componentName': title,
        'visible': True,
        'i': key,
        'x': x,
        'y': y,
        'w': w,
        'h': h,
        'pcX': x,
        'pcY': y,
        'pcW': w,
        'orderNum': len(_page_components[page_id]),
        'config': json.dumps(default_config, ensure_ascii=False),
    }

    _page_components[page_id].insert(0, comp)
    return comp


def add_number(page_id, title, x, y, w, h, value=0, prefix='', suffix='',
               font_size=None, color=None, bg_color=None):
    """
    添加数字指标组件（JNumber）。
    自动根据页面模式（大屏/仪表盘）应用不同默认样式。

    Args:
        value: 显示的数值
        prefix: 前缀（如 '¥'）
        suffix: 后缀（如 '元', '%'）
        font_size: 字体大小（默认根据模式自动设置）
        color: 字体颜色（默认根据模式自动设置）
    """
    mode = _get_mode(page_id)
    if font_size is None:
        font_size = mode['number_font_size']
    if color is None:
        color = mode['body_color']

    config = {
        'dataType': 1,
        'chartData': json.dumps({'value': value}, ensure_ascii=False),
        'background': mode['bg'],
        'borderColor': mode['border_color'],
        'option': {
            'title': {'text': title, 'show': True,
                      'textStyle': {'color': mode['title_color'], 'fontSize': 14}},
            'body': {
                'text': '',
                'color': color,
                'fontSize': font_size,
                'fontWeight': 'bold',
                'marginLeft': 0,
                'marginTop': 0,
            },
            'card': _make_card(mode, title),
            'prefix': prefix,
            'prefixColor': mode['suffix_color'],
            'prefixFontSize': 14,
            'suffix': suffix,
            'suffixColor': mode['suffix_color'],
            'suffixFontSize': 14,
            'isCompare': False,
            'trendType': '1',
        },
        'analysis': {
            'isCompare': False,
            'compareType': '',
            'trendType': '1',
        },
    }
    return add_component(page_id, 'JNumber', title, x, y, w, h, config)


def add_chart(page_id, chart_type, title, x, y, w, h,
              categories=None, series=None, pie_data=None):
    """
    添加图表组件。

    支持的 chart_type: JBar, JLine, JSmoothLine, JHorizontalBar, JStackBar,
    JMixLineBar, DoubleLineBar, JPie, JRing, JRose, JFunnel, JRadar, JScatter,
    JGauge, JLiquid, JProgress, JWordCloud, JAreaMap, JFlyLineMap, 等等。

    Args:
        chart_type: 组件类型
        categories: X轴类目数据 ['一月','二月',...]（轴类图表用）
        series: 系列数据 [{'name':'系列1','data':[1,2,3]}]（轴类图表用）
        pie_data: 饼图数据 [{'name':'A','value':10}]（饼/环/玫瑰图用）
    """
    # 确定图表 ECharts 类型
    echart_type_map = {
        'JBar': 'bar', 'JHorizontalBar': 'bar', 'JBackgroundBar': 'bar',
        'JMultipleBar': 'bar', 'JNegativeBar': 'bar', 'JStackBar': 'bar',
        'JLine': 'line', 'JSmoothLine': 'line', 'JStepLine': 'line',
        'JMultipleLine': 'line',
        'JMixLineBar': 'bar',  # 混合类型
        'JPie': 'pie', 'JRing': 'pie', 'JRose': 'pie',
        'JFunnel': 'funnel',
        'JRadar': 'radar',
        'JScatter': 'scatter', 'JBubble': 'scatter',
        'JGauge': 'gauge',
    }
    echart_type = echart_type_map.get(chart_type, 'bar')

    # 构建 chartData
    chart_data = []
    if pie_data:
        chart_data = pie_data
    elif categories and series:
        if len(series) == 1:
            # 单系列：简单 name/value
            for i, cat in enumerate(categories):
                chart_data.append({
                    'name': cat,
                    'value': series[0]['data'][i] if i < len(series[0]['data']) else 0,
                })
        else:
            # 多系列：需要 type 字段区分
            for s in series:
                for i, cat in enumerate(categories):
                    chart_data.append({
                        'name': cat,
                        'value': s['data'][i] if i < len(s['data']) else 0,
                        'type': s.get('name', ''),
                    })

    mode = _get_mode(page_id)

    # 构建 ECharts option（根据模式应用不同颜色）
    option = {
        'title': {'text': title, 'show': True,
                  'textStyle': {'color': mode['title_color'], 'fontSize': 16},
                  'subtextStyle': {'color': mode['axis_color']}},
        'tooltip': {'show': True, 'textStyle': {'color': mode['tooltip_color']}},
        'legend': {'show': len(series or []) > 1 or bool(pie_data),
                   'textStyle': {'color': mode['legend_color'], 'fontSize': 12}},
        'grid': {'left': 60, 'right': 30, 'top': 70, 'bottom': 40, 'show': False},
        'card': _make_card(mode, title),
    }

    if pie_data:
        # 饼图系列
        radius = '55%'
        if chart_type == 'JRing':
            radius = ['40%', '55%']
        elif chart_type == 'JRose':
            radius = ['20%', '55%']

        option['tooltip']['trigger'] = 'item'
        if chart_type in ('JPie', 'JRing', 'JRose'):
            option['legend']['orient'] = 'vertical'
        option['series'] = [{
            'name': title,
            'type': 'pie',
            'radius': radius,
            'data': pie_data,
            'emphasis': {'itemStyle': {'shadowBlur': 10, 'shadowOffsetX': 0,
                                       'shadowColor': '#00000080'}},
        }]
    elif categories and series:
        # 轴类图表
        option['xAxis'] = {
            'type': 'category',
            'show': True,
            'data': categories,
            'axisLabel': {'color': mode['axis_color']},
            'axisLine': {'lineStyle': {'color': mode['grid_color']}},
        }
        option['yAxis'] = {
            'type': 'value',
            'show': True,
            'axisLabel': {'color': mode['axis_color']},
            'splitLine': {'lineStyle': {'color': mode['grid_color']}},
        }

        if chart_type == 'JHorizontalBar':
            option['xAxis'], option['yAxis'] = option['yAxis'], option['xAxis']
            option['yAxis']['data'] = categories
            option['yAxis']['type'] = 'category'
            option['xAxis'] = {
                'type': 'value', 'show': True,
                'axisLabel': {'color': mode['axis_color']},
                'axisLine': {'lineStyle': {'color': mode['grid_color']}},
                'splitLine': {'lineStyle': {'color': mode['grid_color']}},
            }

        option['series'] = []
        for s in series:
            series_item = {
                'name': s.get('name', ''),
                'type': echart_type,
                'data': s.get('data', []),
            }
            if chart_type == 'JSmoothLine':
                series_item['smooth'] = True
            if chart_type == 'JStepLine':
                series_item['step'] = 'middle'
            if chart_type == 'JStackBar':
                series_item['stack'] = 'total'
            option['series'].append(series_item)

    # 仪表盘模式：card.title 留空，仅用 option.title 显示标题（避免重复）
    option['card'] = _make_card(mode, '')

    config = {
        'dataType': 1,
        'chartData': json.dumps(chart_data, ensure_ascii=False),
        'background': mode['bg'],
        'borderColor': mode['border_color'],
        'option': option,
    }

    return add_component(page_id, chart_type, title, x, y, w, h, config)


def add_table(page_id, title, x, y, w, h, columns=None, data=None):
    """
    添加数据表格组件（JTable）。

    Args:
        columns: 列名列表 ['姓名', '年龄', '地址']
        data: 数据行列表 [{'姓名':'张三','年龄':'28','地址':'北京'}]
    """
    columns = columns or []
    data = data or []

    chart_data = []
    for col in columns:
        field_name = col.lower().replace(' ', '_')
        chart_data.append({
            'fieldTxt': col,
            'fieldName': field_name,
            'type': 'field',
            'isShow': 'Y',
            'isTotal': 'N',
        })

    mode = _get_mode(page_id)

    config = {
        'dataType': 1,
        'chartData': json.dumps(chart_data, ensure_ascii=False),
        'background': mode['bg'],
        'borderColor': mode['border_color'],
        'option': {
            'title': {'text': title, 'show': True,
                      'textStyle': {'color': mode['title_color'], 'fontSize': 16}},
            'bordered': True,
            'size': 'small',
            'headerBgColor': mode['table_header_bg'],
            'headerColor': mode['table_header_color'],
            'headerFontSize': mode['table_header_font_size'],
            'bodyBgColor': mode['table_body_bg'],
            'bodyColor': mode['table_body_color'],
            'bodyFontSize': mode['table_body_font_size'],
            'card': _make_card(mode, title),
            'data': data,
        },
    }

    return add_component(page_id, 'JTable', title, x, y, w, h, config)


def add_scroll_table(page_id, title, x, y, w, h, columns=None, data=None):
    """
    添加自动滚动表格组件（JScrollTable）。

    Args:
        columns: 列名列表
        data: 数据行列表（二维数组格式）
    """
    columns = columns or []
    data = data or []

    # JScrollTable expects chartData as array of objects
    # columns maps to option.fieldMapping
    field_mapping = []
    for col in columns:
        field_name = col.lower().replace(' ', '_')
        field_mapping.append({'name': col, 'key': field_name, 'width': 0})

    # Convert data rows: if data is list of lists, convert to list of dicts
    chart_data = []
    if data and isinstance(data[0], (list, tuple)):
        for row in data:
            item = {}
            for j, col in enumerate(columns):
                field_name = col.lower().replace(' ', '_')
                item[field_name] = row[j] if j < len(row) else ''
            chart_data.append(item)
    elif data and isinstance(data[0], dict):
        chart_data = data
    else:
        chart_data = data or []

    mode = _get_mode(page_id)

    config = {
        'dataType': 1,
        'chartData': json.dumps(chart_data, ensure_ascii=False),
        'background': mode['bg'],
        'borderColor': mode['border_color'],
        'option': {
            'title': {'text': title, 'show': True,
                      'textStyle': {'color': mode['title_color'], 'fontSize': 16}},
            'ranking': False,
            'textPosition': 'center',
            'lineHeight': 50,
            'fontSize': 20,
            'bodyFontSize': 18,
            'scrollTime': 50,
            'scroll': True,
            'showBorder': True,
            'borderWidth': 1,
            'borderColor': mode['scroll_border_color'],
            'borderStyle': 'solid',
            'showHead': True,
            'bodyFontColor': mode['scroll_body_color'],
            'oddColor': mode['scroll_odd_color'],
            'evenColor': mode['scroll_even_color'],
            'headerBgColor': mode['scroll_header_bg'],
            'headerFontColor': mode['scroll_header_color'],
            'fieldMapping': field_mapping,
            'card': _make_card(mode, title),
        },
    }

    return add_component(page_id, 'JScrollTable', title, x, y, w, h, config)


def add_ranking(page_id, title, x, y, w, h, data=None):
    """
    添加排行榜组件（JScrollRankingBoard）。

    Args:
        data: 排行数据 [{'name':'项目A','value':100}, ...]
    """
    data = data or []

    mode = _get_mode(page_id)

    config = {
        'dataType': 1,
        'chartData': json.dumps(data, ensure_ascii=False),
        'background': mode['bg'],
        'borderColor': mode['border_color'],
        'option': {
            'title': {'text': title, 'show': True,
                      'textStyle': {'color': mode['title_color'], 'fontSize': 16}},
            'waitTime': 2000,
            'rowNum': 5,
            'carousel': 'single',
            'sort': True,
            'fontSize': 13,
            'color': mode['ranking_color'],
            'textColor': mode['ranking_text_color'],
            'card': _make_card(mode, title),
        },
    }

    return add_component(page_id, 'JScrollRankingBoard', title, x, y, w, h, config)


def add_text(page_id, title, x, y, w, h, content='', font_size=16, color=None,
             font_weight='normal', text_align='left', letter_spacing=0):
    """
    添加文本组件（JText）。
    使用与真实模板一致的 option.body 结构 + chartData: {"value": "..."} 格式。

    Args:
        content: 文本内容
        font_size: 字体大小
        color: 字体颜色（默认根据模式自动设置）
        font_weight: 字体粗细 'normal'/'bold'
        text_align: 对齐方式 'left'/'center'/'right'
        letter_spacing: 字间距（大屏标题建议 5-8）
    """
    mode = _get_mode(page_id)
    if color is None:
        color = mode['title_color']

    text_value = content or title
    # 文本组件源码 text.vue:164-168 显式从 option.body.{color,fontSize,fontWeight,
    # textAlign,letterSpacing,marginLeft,marginTop,fontStyle,fontFamily} 取值；
    # 写在 option 顶层会被忽略，fallback 到 #000000/14px。
    config = {
        'dataType': 1,
        'chartData': {'value': text_value},
        'option': {
            'body': {
                'color': color,
                'fontSize': font_size,
                'fontWeight': font_weight,
                'textAlign': text_align,
                'letterSpacing': letter_spacing,
                'text': '',
                'marginTop': 0,
                'marginLeft': 0,
            },
            'card': {'title': '', 'extra': '', 'rightHref': '', 'size': 'default'},
            'openUrl': '',
            'isLink': False,
            'openType': '_blank',
        },
    }

    return add_component(page_id, 'JText', title, x, y, w, h, config)


def add_image(page_id, title, x, y, w, h, src=''):
    """
    添加图片组件（JImg）。

    Args:
        src: 图片 URL
    """
    config = {
        'dataType': 1,
        'chartData': src,
        'option': {
            'objectFit': 'cover',
        },
    }

    return add_component(page_id, 'JImg', title, x, y, w, h, config)


def add_gauge(page_id, title, x, y, w, h, value=0, max_val=100,
              unit='%', color='#00BAFF'):
    """
    添加仪表盘组件（JGauge）。

    Args:
        value: 当前值
        max_val: 最大值
        unit: 单位
        color: 指针颜色
    """
    mode = _get_mode(page_id)
    tail_color = '#333' if mode is _BIGSCREEN else '#E8E8E8'

    config = {
        'dataType': 1,
        'chartData': json.dumps([{'name': title, 'value': value}], ensure_ascii=False),
        'background': mode['bg'],
        'borderColor': mode['border_color'],
        'option': {
            'title': {'text': title, 'show': True,
                      'textStyle': {'color': mode['title_color'], 'fontSize': 16}},
            'card': _make_card(mode, title),
            'series': [{
                'type': 'gauge',
                'max': max_val,
                'detail': {'formatter': f'{{value}}{unit}'},
                'data': [{'value': value, 'name': title}],
                'axisLine': {
                    'lineStyle': {
                        'color': [[value / max_val, color], [1, tail_color]],
                    }
                },
            }],
        },
    }

    return add_component(page_id, 'JGauge', title, x, y, w, h, config)


def add_liquid(page_id, title, x, y, w, h, value=50, color='#00BAFF'):
    """
    添加水球图组件（JLiquid）。

    Args:
        value: 0~100 的百分比值（如 97.3 表示 97.3%）
        color: 颜色
    """
    mode = _get_mode(page_id)

    config = {
        'dataType': 1,
        'chartData': json.dumps([{'value': value}], ensure_ascii=False),
        'background': mode['bg'],
        'borderColor': mode['border_color'],
        'option': {
            'title': {'text': title, 'show': True,
                      'textStyle': {'color': mode['title_color'], 'fontSize': 16}},
            'liquidType': 'circle',
            'color': color,
            'borderWidth': 2,
            'distance': 1,
            'borderColor': color,
            'strokeOpacity': 0,
            'count': 4,
            'length': 128,
            'textColor': mode['title_color'],
            'textFontSize': 30,
            'card': _make_card(mode, title),
        },
    }

    return add_component(page_id, 'JLiquid', title, x, y, w, h, config)


def add_countdown(page_id, title, x, y, w, h, value=0, font_size=48, color='#00BAFF'):
    """
    添加数字翻牌器组件（JCountTo）。

    Args:
        value: 目标数值
        font_size: 字体大小
        color: 字体颜色
    """
    mode = _get_mode(page_id)
    if color == '#00BAFF' and mode is _DASHBOARD:
        color = mode['body_color']

    config = {
        'dataType': 1,
        'chartData': str(value),
        'background': mode['bg'],
        'borderColor': mode['border_color'],
        'option': {
            'title': {'text': title, 'show': True,
                      'textStyle': {'color': mode['title_color'], 'fontSize': 16}},
            'endVal': value,
            'fontSize': font_size,
            'color': color,
            'duration': 2000,
            'card': _make_card(mode, title),
        },
    }

    return add_component(page_id, 'JCountTo', title, x, y, w, h, config)


def add_border(page_id, x, y, w, h, border_type=1, color='#00BAFF'):
    """
    添加装饰边框组件（JDragBorder）。

    Args:
        border_type: 边框样式 1~13
        color: 边框颜色
    """
    config = {
        'dataType': 1,
        'option': {
            'borderType': border_type,
            'color': [color],
        },
    }

    return add_component(page_id, 'JDragBorder', f'边框{border_type}', x, y, w, h, config)


def add_decoration(page_id, x, y, w, h, deco_type=1, color='#00BAFF'):
    """
    添加装饰条组件（JDragDecoration）。

    Args:
        deco_type: 装饰样式 1~12
        color: 颜色
    """
    config = {
        'dataType': 1,
        'option': {
            'decorationType': deco_type,
            'color': [color],
        },
    }

    return add_component(page_id, 'JDragDecoration', f'装饰{deco_type}', x, y, w, h, config)


def add_current_time(page_id, x, y, w=280, h=33, fmt='YYYY-MM-DD hh:mm:ss',
                     show_week='show', hourly_system='12',
                     color=None, font_weight='normal', letter_spacing=0):
    """
    添加实时时钟组件（JCurrentTime）。

    Args:
        fmt: 时间格式，如 'YYYY-MM-DD hh:mm:ss'
        show_week: 是否显示星期 'show'/'hide'
        hourly_system: 时制 '12'/'24'
        color: 字体颜色（默认根据模式自动设置）
        font_weight: 字体粗细 'normal'/'bold'
        letter_spacing: 字间距
    """
    mode = _get_mode(page_id)
    if color is None:
        color = mode['title_color']

    config = {
        'dataType': 1,
        'background': mode['bg'],
        'borderColor': mode['border_color'],
        'chartData': '',
        'option': {
            'showWeek': show_week,
            'hourlySystem': hourly_system,
            'format': fmt,
            'card': {'title': '', 'extra': '', 'rightHref': '', 'size': 'default'},
            'body': {
                'text': '', 'color': color, 'fontWeight': font_weight,
                'marginLeft': 0, 'marginTop': 0, 'letterSpacing': letter_spacing,
            },
        },
    }

    return add_component(page_id, 'JCurrentTime', '实时时钟', x, y, w, h, config)


def add_word_cloud(page_id, title, x, y, w, h, data=None,
                   font_family='SimSun', color='#FFE472',
                   min_size=8, max_size=32, shape='circle'):
    """
    添加词云图组件（JWordCloud）。

    Args:
        data: 词云数据 [{'name':'词语','value':9}, ...]，默认使用内置示例数据
        font_family: 字体
        color: 文字颜色
        min_size: 最小字号
        max_size: 最大字号
        shape: 词云形状 'circle'/'cardioid'/'diamond'/'triangle'/'star' 等
    """
    mode = _get_mode(page_id)
    if data is None:
        data = [
            {'value': 9, 'name': 'AntV'}, {'value': 8, 'name': 'F2'},
            {'value': 8, 'name': 'G2'}, {'value': 8, 'name': 'G6'},
            {'value': 8, 'name': 'DataSet'}, {'value': 8, 'name': '墨者学院'},
            {'value': 6, 'name': 'Analysis'}, {'value': 6, 'name': 'Data Mining'},
            {'value': 6, 'name': 'Data Vis'}, {'value': 6, 'name': 'Design'},
            {'value': 6, 'name': 'Grammar'}, {'value': 6, 'name': 'Graphics'},
            {'value': 6, 'name': 'Graph'}, {'value': 6, 'name': 'Hierarchy'},
            {'value': 6, 'name': 'Labeling'}, {'value': 6, 'name': 'Layout'},
            {'value': 6, 'name': 'Quantitative'}, {'value': 6, 'name': 'Relation'},
            {'value': 6, 'name': 'Statistics'}, {'value': 6, 'name': '可视化'},
            {'value': 6, 'name': '数据'}, {'value': 6, 'name': '数据可视化'},
        ]

    config = {
        'dataType': 1,
        'background': mode['bg'],
        'borderColor': mode['border_color'],
        'chartData': json.dumps(data, ensure_ascii=False),
        'option': {
            'fontFamily': font_family,
            'color': color,
            'minSize': min_size,
            'maxSize': max_size,
            'padding': 8,
            'customColor': [],
            'series': [{'shape': shape}],
            'card': {'title': '', 'extra': '', 'rightHref': '', 'size': 'default'},
            'title': {
                'text': title, 'textAlign': 'left', 'show': True,
                'textStyle': {'color': mode['title_color'], 'fontWeight': 'normal'},
            },
        },
    }

    return add_component(page_id, 'JWordCloud', title, x, y, w, h, config)


def add_color_block(page_id, title, x, y, w, h, blocks=None,
                    line_num=2, font_size=16, color='#fff'):
    """
    添加色块指标卡组件（JColorBlock）。

    Args:
        blocks: 指标数据列表 [{'backgroundColor':'#67C23A','prefix':'标签','value':'12345','suffix':'元'}, ...]
                默认使用内置4个示例色块
        line_num: 每行显示几个色块
        font_size: 数值字号
        color: 文字颜色
    """
    mode = _get_mode(page_id)
    if blocks is None:
        blocks = [
            {'backgroundColor': '#67C23A', 'prefix': '朝阳总销售额', 'value': '12345', 'suffix': '亿'},
            {'backgroundColor': '#409EFF', 'prefix': '昌平总销售额', 'value': '12345', 'suffix': '亿'},
            {'backgroundColor': '#E6A23C', 'prefix': '海淀总销售额', 'value': '12345', 'suffix': '亿'},
            {'backgroundColor': '#F56C6C', 'prefix': '西城总销售额', 'value': '12345', 'suffix': '亿'},
        ]

    config = {
        'dataType': 1,
        'background': mode['bg'],
        'borderColor': mode['border_color'],
        'chartData': json.dumps(blocks, ensure_ascii=False),
        'option': {
            'whole': False, 'width': 50, 'height': 50, 'lineNum': line_num,
            'borderSplitx': 20, 'borderSplity': 20, 'decimals': 0,
            'fontSize': font_size, 'color': color, 'fontWeight': 'normal',
            'textAlign': 'center', 'padding': 5,
            'prefixFontSize': 16, 'prefixColor': color, 'prefixFontWeight': 'normal',
            'prefixSplitx': 0, 'prefixSplity': 0,
            'suffix': '', 'suffixSplitx': 40, 'suffixFontSize': 16,
            'suffixColor': color, 'suffixFontWeight': 'normal', 'prefix': '',
            'card': _make_card(mode, title),
            'body': {'text': '', 'color': color, 'fontWeight': 'bold',
                     'marginLeft': 0, 'marginTop': 0},
        },
    }

    return add_component(page_id, 'JColorBlock', title, x, y, w, h, config)


def add_progress(page_id, title, x, y, w, h, data=None,
                 bar_width=19, color='#FF9D00', bg_color='#9C9CA1',
                 border_radius=10):
    """
    添加进度条组件（JProgress）。

    Args:
        data: 进度数据 [{'name':'满意度','value':50}, ...]
        bar_width: 进度条粗细
        color: 进度条颜色
        bg_color: 背景条颜色
        border_radius: 圆角
    """
    mode = _get_mode(page_id)
    if data is None:
        data = [{'name': '满意度', 'value': 50}]

    label_color = mode['title_color']

    config = {
        'dataType': 1,
        'background': mode['bg'],
        'borderColor': mode['border_color'],
        'chartData': json.dumps(data, ensure_ascii=False),
        'option': {
            'valueXOffset': 0, 'valueYOffset': 0,
            'grid': {'show': False, 'top': 0, 'left': 0, 'right': 55,
                     'bottom': 0, 'containLabel': True},
            'yAxis': {'yUnit': '', 'axisLabel': {'show': True, 'color': label_color}},
            'title': {'text': '', 'textAlign': 'left', 'show': False, 'textStyle': {}},
            'tooltip': {'confine': True, 'trigger': 'axis',
                        'axisPointer': {'type': 'none'}},
            'series': [
                {
                    'barWidth': bar_width, 'realtimeSort': True,
                    'label': {'show': False, 'position': 'left',
                              'formatter': '{c}%', 'color': label_color, 'fontSize': 24},
                    'itemStyle': {'normal': {'barBorderRadius': border_radius}},
                    'color': color, 'zlevel': 1,
                },
                {
                    'type': 'bar', 'barGap': '-100%', 'color': bg_color,
                    'barWidth': bar_width,
                    'label': {
                        'show': True, 'valueAnimation': True, 'position': 'right',
                        'color': label_color, 'fontSize': 18,
                        'formatter': '{c}', 'offset': [0, 0],
                    },
                    'itemStyle': {'normal': {'barBorderRadius': border_radius}},
                },
            ],
            'card': _make_card(mode, title),
        },
    }

    return add_component(page_id, 'JProgress', title, x, y, w, h, config)


def add_total_progress(page_id, title, x, y, w, h, data=None,
                       bar_width=19, color='#151B87', bg_color='#eeeeee',
                       border_radius=10):
    """
    添加总进度条组件（JTotalProgress）。

    Args:
        data: 进度数据 [{'value':50}, ...]
        bar_width: 进度条粗细
        color: 进度条颜色
        bg_color: 背景条颜色
        border_radius: 圆角
    """
    mode = _get_mode(page_id)
    if data is None:
        data = [{'value': 50}]

    label_color = mode['title_color']
    if mode is _BIGSCREEN:
        bg_color = '#333333'

    config = {
        'dataType': 1,
        'background': mode['bg'],
        'borderColor': mode['border_color'],
        'chartData': json.dumps(data, ensure_ascii=False),
        'option': {
            'targetValue': {},
            'series': [
                {
                    'barWidth': bar_width,
                    'label': {
                        'show': True, 'position': 'right', 'offset': [0, -40],
                        'formatter': '{c}{a}', 'color': label_color, 'fontSize': 24,
                    },
                    'itemStyle': {'normal': {'barBorderRadius': border_radius}},
                    'color': color, 'zlevel': 1,
                },
                {
                    'type': 'bar', 'barGap': '-100%', 'color': bg_color,
                    'barWidth': bar_width,
                    'itemStyle': {'normal': {'barBorderRadius': border_radius}},
                },
            ],
            'card': _make_card(mode, title),
        },
    }

    return add_component(page_id, 'JTotalProgress', title, x, y, w, h, config)


# ============================================================
# 编辑已有页面
# ============================================================
def update_page(page_id, new_components=None):
    """
    更新已有页面的组件。

    Args:
        page_id: 页面 ID
        new_components: 新的组件列表（完全替换）
    """
    # 查询当前页面信息
    page = query_page(page_id)

    if new_components is not None:
        _page_components[page_id] = new_components
    elif page_id not in _page_components:
        # 从已有页面加载组件
        template = page.get('template', [])
        if isinstance(template, str):
            try:
                template = json.loads(template)
            except:
                template = []
        _page_components[page_id] = template

    return save_page(page_id)


def add_to_existing(page_id, component_func, *args, **kwargs):
    """
    向已有页面追加组件。先加载已有组件，再添加新组件，最后保存。

    用法：
        add_to_existing(page_id, add_number, '新指标', x=500, y=0, w=400, h=200, value=999)
    """
    if page_id not in _page_components or not _page_components[page_id]:
        # 先加载已有组件
        page = query_page(page_id)
        template = page.get('template', [])
        if isinstance(template, str):
            try:
                template = json.loads(template)
            except:
                template = []
        _page_components[page_id] = template

    # 调用组件添加函数
    return component_func(page_id, *args, **kwargs)


# ============================================================
# 菜单 SQL 生成
# ============================================================
ROLE_ID = 'f6817f48af4fb3af11b9e8bf182f618b'


def gen_menu_sql(parent_name, children, icon='ant-design:appstore-outlined', role_id=None):
    """
    生成菜单 SQL + 角色授权 SQL。

    Args:
        parent_name: 父菜单名称
        children: [(名称, page_id, sort_no), ...]
        icon: 父菜单图标
        role_id: 角色 ID，默认使用 ROLE_ID

    Returns:
        SQL 字符串
    """
    rid = role_id or ROLE_ID
    parent_id = _gen_uuid()
    lines = []

    # 父菜单
    lines.append(f"-- 父菜单: {parent_name}")
    lines.append(
        f"INSERT INTO sys_permission(id, parent_id, name, url, component, component_name, "
        f"redirect, menu_type, perms, perms_type, sort_no, always_show, icon, is_route, "
        f"is_leaf, keep_alive, hidden, hide_tab, description, status, del_flag, rule_flag, "
        f"create_by, create_time, update_by, update_time, internal_or_external) "
        f"VALUES ('{parent_id}', NULL, '{parent_name}', '/{parent_id}', "
        f"'layouts/RouteView', NULL, NULL, 0, NULL, '1', 1.00, 0, '{icon}', "
        f"1, 0, 0, 0, 0, NULL, '1', 0, 0, 'admin', now(), NULL, NULL, 0);"
    )
    rp_id = _gen_uuid()
    lines.append(
        f"INSERT INTO sys_role_permission (id, role_id, permission_id, data_rule_ids, "
        f"operate_date, operate_ip) VALUES ('{rp_id}', '{rid}', '{parent_id}', NULL, "
        f"now(), '127.0.0.1');"
    )
    lines.append('')

    # 子菜单
    for name, page_id, sort_no in children:
        menu_id = _gen_uuid()
        lines.append(f"-- 子菜单: {name}")
        lines.append(
            f"INSERT INTO sys_permission(id, parent_id, name, url, component, component_name, "
            f"redirect, menu_type, perms, perms_type, sort_no, always_show, icon, is_route, "
            f"is_leaf, keep_alive, hidden, hide_tab, description, status, del_flag, rule_flag, "
            f"create_by, create_time, update_by, update_time, internal_or_external) "
            f"VALUES ('{menu_id}', '{parent_id}', '{name}', "
            f"'/drag/page/view/{page_id}', "
            f"'super/drag/page/dashboardPreview', 'dashboardPreview', "
            f"NULL, 0, NULL, '1', {sort_no}.00, 0, NULL, 0, 1, 0, 0, 0, NULL, '1', "
            f"0, 0, 'admin', now(), NULL, NULL, 0);"
        )
        rp_id2 = _gen_uuid()
        lines.append(
            f"INSERT INTO sys_role_permission (id, role_id, permission_id, data_rule_ids, "
            f"operate_date, operate_ip) VALUES ('{rp_id2}', '{rid}', '{menu_id}', NULL, "
            f"now(), '127.0.0.1');"
        )
        lines.append('')

    return '\n'.join(lines)


# ============================================================
# 辅助函数
# ============================================================
def _get_category(component):
    """根据组件类型获取分类"""
    category_map = {
        'JBar': 'Bar', 'JHorizontalBar': 'Bar', 'JBackgroundBar': 'Bar',
        'JMultipleBar': 'Bar', 'JNegativeBar': 'Bar', 'JStackBar': 'Bar',
        'JDynamicBar': 'Bar', 'JCapsuleChart': 'Bar',
        'JLine': 'Line', 'JSmoothLine': 'Line', 'JStepLine': 'Line',
        'JMultipleLine': 'Line', 'JArea': 'Line', 'DoubleLineBar': 'Line',
        'JMixLineBar': 'MixLineBar',
        'JPie': 'Pie', 'JRing': 'Ring', 'JRose': 'Rose',
        'JGauge': 'Gauge', 'JColorGauge': 'Gauge', 'JSemiGauge': 'Gauge',
        'JProgress': 'Progress', 'JCustomProgress': 'Progress',
        'JLiquid': 'Liquid', 'JRadialBar': 'RadialBar',
        'JFunnel': 'Funnel', 'JPyramidFunnel': 'Funnel',
        'JRadar': 'Radar', 'JCircleRadar': 'Radar',
        'JScatter': 'Scatter', 'JBubble': 'Bubble',
        'JWordCloud': 'WordCloud',
        'JAreaMap': 'Map', 'JBubbleMap': 'Map', 'JFlyLineMap': 'Map',
        'JHeatMap': 'Map', 'JBarMap': 'Map',
        'JBar3d': '3D', 'JBarGroup3d': '3D',
        'JNumber': 'Number', 'JCountTo': 'CountTo',
        'JTable': 'Table', 'JScrollTable': 'ScrollTable',
        'JPivotTable': 'PivotTable',
        'JScrollRankingBoard': 'Ranking',
        'JText': 'Text', 'JImg': 'Image',
        'JCarousel': 'Carousel', 'JVideoPlay': 'Video',
        'JCustomButton': 'Button', 'JTabs': 'Tabs',
        'JDragBorder': 'Border', 'JDragDecoration': 'Decoration',
        'JIframe': 'Iframe', 'JCurrentTime': 'Time',
    }
    return category_map.get(component, 'Common')


def _deep_merge(base, override):
    """深度合并字典，override 覆盖 base"""
    for k, v in override.items():
        if k in base and isinstance(base[k], dict) and isinstance(v, dict):
            _deep_merge(base[k], v)
        else:
            base[k] = v
    return base
