"""
全组件大屏生成脚本（预置脚本，勿修改）
用法:
  py gen_all_comps.py <API_BASE> <TOKEN> [页面名称]
  py gen_all_comps.py <API_BASE> <TOKEN> [页面名称] --page-id PAGE_ID
  py gen_all_comps.py <API_BASE> <TOKEN> [页面名称] --page-id PAGE_ID \\
      --ds-id DS_ID --ds-type FILES --ds-name "数据集名" \\
      --ds-fields "name:String,type:String,sales:Integer"
"""
import sys, os, json, time, subprocess, copy, argparse, datetime

def _find_bi_utils():
    candidates = [
        os.path.dirname(os.path.abspath(__file__)),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'),
        os.getcwd(),
    ]
    for d in candidates:
        if os.path.exists(os.path.join(d, 'bi_utils.py')):
            return d
    return None

_bu_dir = _find_bi_utils()
if _bu_dir:
    sys.path.insert(0, _bu_dir)
import bi_utils

parser = argparse.ArgumentParser(description='全组件大屏生成器')
parser.add_argument('api_base',    help='API地址')
parser.add_argument('token',       help='Token')
parser.add_argument('page_name',   nargs='?', default='全组件大屏', help='页面名称（新建时用）')
parser.add_argument('--page-id',   default=None, help='已有页面ID，跳过创建新页面')
parser.add_argument('--ds-id',     default=None, help='绑定数据集ID')
parser.add_argument('--ds-type',   default='api', help='数据集类型(api/FILES/singleFile等)')
parser.add_argument('--ds-name',   default='',   help='数据集名称')
parser.add_argument('--ds-fields', default='',   help='字段列表，格式: field1:Type1,field2:Type2')
args = parser.parse_args()

t0 = time.time()
API_BASE  = args.api_base.rstrip('/')
TOKEN     = args.token
PAGE_NAME = args.page_name

bi_utils.API_BASE = API_BASE
bi_utils.TOKEN    = TOKEN

defaults = json.load(open('default_configs.json', 'r', encoding='utf-8'))

# ── UI-only 组件（不绑数据集，使用静态 chartData）────────────────────────────
NO_BIND = {
    'JImg', 'JCarousel', 'JCustomIcon', 'JText', 'JCurrentTime',
    'JIframe', 'JDragEditor', 'JRadioButton', 'JForm',
    'JPermanentCalendar', 'JSelectRadio', 'JTabToggle', 'JCommon',
    'JVideoPlay', 'JVideoJs',
}

# ── 组件 dataMapping 槽位配置 ─────────────────────────────────────────────────
SLOT_CONFIGS = {
    # 单系列图表（维度+数值）
    'JBar': ['维度','数值'], 'JDynamicBar': ['维度','数值'], 'JCapsuleChart': ['维度','数值'],
    'JHorizontalBar': ['维度','数值'], 'JBackgroundBar': ['维度','数值'],
    'JPie': ['维度','数值'], 'JRose': ['维度','数值'], 'JRotatePie': ['维度','数值'],
    'JLine': ['维度','数值'], 'JSmoothLine': ['维度','数值'], 'JStepLine': ['维度','数值'],
    'JArea': ['维度','数值'],
    'JCustomProgress': ['维度','数值'], 'JProgress': ['维度','数值'], 'JListProgress': ['维度','数值'],
    'JPictorialBar': ['维度','数值'], 'JPictorial': ['维度','数值'], 'JGender': ['维度','数值'],
    'JScatter': ['维度','数值'], 'JQuadrant': ['维度','数值'],
    'JFunnel': ['维度','数值'], 'JPyramidFunnel': ['维度','数值'], 'JPyramid3D': ['维度','数值'],
    'JRadar': ['维度','数值'], 'JCircleRadar': ['维度','数值'],
    'JRing': ['维度','数值'], 'JBreakRing': ['维度','数值'], 'JRingProgress': ['维度','数值'],
    'JActiveRing': ['维度','数值'], 'JRadialBar': ['维度','数值'],
    'JRectangle': ['维度','数值'], 'JBar3d': ['维度','数值'],
    'JWordCloud': ['维度','数值'], 'JImgWordCloud': ['维度','数值'], 'JFlashCloud': ['维度','数值'],
    'JBubbleMap': ['维度','数值'], 'JBarMap': ['维度','数值'], 'JHeatMap': ['维度','数值'],
    'JAreaMap': ['维度','数值'], 'JGaoDeMap': ['维度','数值'], 'JPivotTable': ['维度','数值'],
    # 仪表盘（总计+已用）
    'JGauge': ['总计','已用'], 'JColorGauge': ['总计','已用'],
    'JAntvGauge': ['总计','已用'], 'JSemiGauge': ['总计','已用'], 'JRoundProgress': ['总计','已用'],
    # 多系列图表（分组+维度+数值）
    'JStackBar': ['分组','维度','数值'], 'JMultipleBar': ['分组','维度','数值'],
    'JNegativeBar': ['分组','维度','数值'], 'JPercentBar': ['分组','维度','数值'],
    'JMixLineBar': ['分组','维度','数值'], 'JMultipleLine': ['分组','维度','数值'],
    'DoubleLineBar': ['分组','维度','数值'],
    'JBubble': ['分组','维度','数值'], 'JBarGroup3d': ['分组','维度','数值'],
    'JTotalProgress': ['分组','维度','数值'], 'JTotalBarMap': ['分组','维度','数值'],
    # 表格列表（名称+数值）
    'JScrollBoard': ['名称','数值'], 'JScrollTable': ['名称','数值'], 'JDevHistory': ['名称','数值'],
    'JCommonTable': ['名称','数值'], 'JList': ['名称','数值'],
    'JScrollRankingBoard': ['名称','数值'], 'JFlashList': ['名称','数值'], 'JBubbleRank': ['名称','数值'],
    'JScrollList': ['名称','数值'], 'JOrbitRing': ['名称','数值'], 'JRankingList': ['名称','数值'],
    # 统计概览（数值1+数值2）
    'JStatsSummary': ['数值1','数值2'],
    # 翻牌器/颜色块（数值）
    'JCountTo': ['数值'], 'JColorBlock': ['数值'], 'JNumber': ['数值'],
    # 水波图（总量+当前）
    'JLiquid': ['总量','当前'],
    # 飞线地图
    'JFlyLineMap': ['起点名称','终点名称'],
    'JTotalFlyLineMap': ['起点名称','终点名称','分组'],
    # 卡片滚动
    'JCardScroll': ['内容'], 'JCardCarousel': ['内容'],
}

# ── 全组件列表 (key, compType, 中文名) ──────────────────────────────────────
# 排除 JDragBorder / JDragDecoration / JWeatherForecast（纯装饰/特殊API组件）
all_comps = [
    # 柱形图
    ('JBar',            'JBar',            '基础柱形图'),
    ('JStackBar',       'JStackBar',       '堆叠柱形图'),
    ('JDynamicBar',     'JDynamicBar',     '动态柱形图'),
    ('JCapsuleChart',   'JCapsuleChart',   '胶囊图'),
    ('JHorizontalBar',  'JHorizontalBar',  '基础条形图'),
    ('JBackgroundBar',  'JBackgroundBar',  '背景柱形图'),
    ('JMultipleBar',    'JMultipleBar',    '对比柱形图'),
    ('JNegativeBar',    'JNegativeBar',    '正负条形图'),
    ('JPercentBar',     'JPercentBar',     '百分比条形图'),
    ('JMixLineBar',     'JMixLineBar',     '折柱图'),
    # 饼图
    ('JPie',            'JPie',            '饼图'),
    ('JRose',           'JRose',           '南丁格尔玫瑰图'),
    ('JRotatePie',      'JRotatePie',      '旋转饼图'),
    # 折线图
    ('JLine',           'JLine',           '基础折线图'),
    ('JSmoothLine',     'JSmoothLine',     '平滑曲线图'),
    ('JStepLine',       'JStepLine',       '阶梯折线图'),
    ('JArea',           'JArea',           '面积图'),
    ('JMultipleLine',   'JMultipleLine',   '对比折线图'),
    ('DoubleLineBar',   'DoubleLineBar',   '双轴图'),
    # 进度图
    ('JCustomProgress', 'JCustomProgress', '基础进度图'),
    ('JProgress',       'JProgress',       '进度图'),
    ('JListProgress',   'JListProgress',   '列表进度图'),
    ('JRoundProgress',  'JRoundProgress',  '圆形进度图'),
    ('JLiquid',         'JLiquid',         '水波图'),
    # 象形图
    ('JPictorialBar',   'JPictorialBar',   '象形柱图'),
    ('JPictorial',      'JPictorial',      '象形图'),
    ('JGender',         'JGender',         '男女占比'),
    # 仪表盘
    ('JGauge',          'JGauge',          '基础仪表盘'),
    ('JColorGauge',     'JColorGauge',     '多色仪表盘'),
    ('JAntvGauge',      'JAntvGauge',      '渐变仪表盘'),
    ('JSemiGauge',      'JSemiGauge',      '半圆仪表盘'),
    # 散点图
    ('JScatter',        'JScatter',        '普通散点图'),
    ('JQuadrant',       'JQuadrant',       '象限图'),
    ('JBubble',         'JBubble',         '气泡图'),
    # 漏斗图
    ('JFunnel',         'JFunnel',         '普通漏斗图'),
    ('JPyramidFunnel',  'JPyramidFunnel',  '金字塔漏斗图'),
    ('JPyramid3D',      'JPyramid3D',      '3D金字塔'),
    # 雷达图
    ('JRadar',          'JRadar',          '普通雷达图'),
    ('JCircleRadar',    'JCircleRadar',    '圆形雷达图'),
    # 环形图
    ('JRing',           'JRing',           '饼状环形图'),
    ('JBreakRing',      'JBreakRing',      '多色环形图'),
    ('JRingProgress',   'JRingProgress',   '基础环形图'),
    ('JActiveRing',     'JActiveRing',     '动态环形图'),
    ('JRadialBar',      'JRadialBar',      '玉珏图'),
    # 矩形/3D
    ('JRectangle',      'JRectangle',      '矩形图'),
    ('JBar3d',          'JBar3d',          '3D柱形图'),
    ('JBarGroup3d',     'JBarGroup3d',     '3D分组柱形图'),
    # 表格/列表
    ('JScrollBoard',        'JScrollBoard',        '轮播表'),
    ('JScrollTable',        'JScrollTable',        '表格'),
    ('JDevHistory',         'JDevHistory',         '发展历程'),
    ('JCommonTable',        'JCommonTable',        '数据表格'),
    ('JList',               'JList',               '数据列表'),
    ('JScrollRankingBoard', 'JScrollRankingBoard', '排行榜'),
    ('JFlashList',          'JFlashList',          '个性排名'),
    ('JBubbleRank',         'JBubbleRank',         '气泡排名'),
    ('JScrollList_1',       'JScrollList',         '滚动列表(单行)'),
    ('JScrollList_2',       'JScrollList',         '滚动列表(多行+序号)'),
    ('JScrollList_3',       'JScrollList',         '滚动列表(带表头)'),
    # 统计/轮播
    ('JPermanentCalendar',  'JPermanentCalendar',  '日历'),
    ('JCardScroll_1',       'JCardScroll',         '卡片滚动(横向)'),
    ('JCardScroll_2',       'JCardScroll',         '卡片滚动(竖向+序号)'),
    ('JCardScroll_3',       'JCardScroll',         '卡片滚动(高亮)'),
    ('JCardCarousel',       'JCardCarousel',       '卡片轮播'),
    ('JStatsSummary_1',     'JStatsSummary',       '统计概览(卡片)'),
    ('JStatsSummary_2',     'JStatsSummary',       '统计概览(背景)'),
    ('JStatsSummary_3',     'JStatsSummary',       '统计概览(高亮)'),
    # 装饰（UI-only）
    ('JImg',                'JImg',                '图片'),
    ('JCarousel',           'JCarousel',           '轮播图'),
    ('JCustomIcon',         'JCustomIcon',         '图标'),
    # 文字
    ('JText',               'JText',               '文本'),
    ('JCountTo',            'JCountTo',            '翻牌器'),
    ('JColorBlock',         'JColorBlock',         '颜色块'),
    ('JCurrentTime',        'JCurrentTime',        '当前时间'),
    ('JNumber',             'JNumber',             '数值'),
    ('JOrbitRing',          'JOrbitRing',          '轨道环形文字'),
    # 字符云
    ('JWordCloud',          'JWordCloud',          '字符云'),
    ('JImgWordCloud',       'JImgWordCloud',       '图层字符云'),
    ('JFlashCloud',         'JFlashCloud',         '闪动字符云'),
    # 地图
    ('JBubbleMap',          'JBubbleMap',          '散点地图'),
    ('JFlyLineMap',         'JFlyLineMap',         '飞线地图'),
    ('JBarMap',             'JBarMap',             '柱形地图'),
    ('JTotalFlyLineMap',    'JTotalFlyLineMap',    '时间轴飞线地图'),
    ('JTotalBarMap',        'JTotalBarMap',        '柱形排名地图'),
    ('JHeatMap',            'JHeatMap',            '热力地图'),
    ('JAreaMap',            'JAreaMap',            '区域地图'),
    ('JGaoDeMap',           'JGaoDeMap',           '高德地图'),
    # 视频
    ('JVideoPlay',          'JVideoPlay',          '播放器'),
    ('JVideoJs',            'JVideoJs',            'RTMP播放器'),
    # 其他
    ('JSelectRadio',        'JSelectRadio',        '选项卡'),
    ('JTabToggle',          'JTabToggle',          '导航切换'),
    ('JForm',               'JForm',               '表单'),
    ('JIframe',             'JIframe',             'Iframe'),
    ('JRadioButton',        'JRadioButton',        '按钮'),
    ('JDragEditor',         'JDragEditor',         '富文本'),
    ('JCommon',             'JCommon',             '通用组件'),
    ('JCustomEchart',       'JCustomEchart',       '自定义组件'),
    ('JTotalProgress',      'JTotalProgress',      '统计进度图'),
    ('JPivotTable',         'JPivotTable',         '透视表'),
    ('JRankingList',        'JRankingList',        '排行榜(自定义)'),
]

# ── 页面：创建或使用已有 ──────────────────────────────────────────────────────
if args.page_id:
    page_id = args.page_id
    raw_info = bi_utils._request('GET', '/drag/page/queryById', params={'id': page_id})
    p_info   = (raw_info.get('result') or {})
    bi_utils._page_info[page_id] = {
        'name':            p_info.get('name', PAGE_NAME),
        'style':           p_info.get('style', 'bigScreen'),
        'theme':           p_info.get('theme', 'dark'),
        'backgroundImage': p_info.get('backgroundImage', '/img/bg/bg4.png'),
        'designType':      p_info.get('designType', 100),
    }
    existing_tmpl = p_info.get('template') or []
    if isinstance(existing_tmpl, str):
        try:    existing_tmpl = json.loads(existing_tmpl) or []
        except: existing_tmpl = []
    bi_utils._page_components[page_id] = list(existing_tmpl)
    existing_count = len(existing_tmpl)
    # 新组件追加在已有组件下方
    if existing_tmpl:
        max_bottom = max(c.get('y', 0) + c.get('h', 300) for c in existing_tmpl)
        START_Y = max_bottom + 30
    else:
        START_Y = 100
    print(f'[使用已有页面] {p_info.get("name","?")} (ID: {page_id}), 已有组件: {existing_count}个, 从y={START_Y}开始')
else:
    page_id = bi_utils.create_page(PAGE_NAME, style='bigScreen', theme='dark',
                                    background_image='/img/bg/bg4.png')
    bi_utils._page_components[page_id] = []
    START_Y = 100
    print(f'[创建页面] {PAGE_NAME} (ID: {page_id})')

# ── 数据集配置（--ds-id 时生效）─────────────────────────────────────────────
DS_CONFIG = None
DIM_F  = ''   # 单系列维度 / 表格名称 / 起点名称（通常第1个字符串字段）
GROUP_F = ''  # 多系列分组（通常最后一个字符串字段，匹配 files_ops.py 的 col_type）
VAL_F  = ''   # 数值（第1个数字字段）

if args.ds_id:
    ds_resp = bi_utils._request('GET', '/drag/onlDragDatasetHead/queryById', params={'id': args.ds_id})
    ds_info = (ds_resp.get('result') or {})

    # 解析 --ds-fields 或从数据集自带字段列表取
    ds_fields = []
    if args.ds_fields:
        for f in args.ds_fields.split(','):
            parts = f.strip().split(':')
            fn = parts[0].strip()
            ft = parts[1].strip() if len(parts) > 1 else 'String'
            ds_fields.append({'fieldName': fn, 'fieldType': ft})
    else:
        items = (ds_info.get('datasetItemList') or ds_info.get('onlDragDatasetItemList') or [])
        for it in items:
            ds_fields.append({'fieldName': it.get('fieldName',''), 'fieldType': it.get('fieldType','String')})

    # fallback: getAllChartData 推断字段
    if not ds_fields:
        test_r = bi_utils._request('POST', '/drag/onlDragDatasetHead/getAllChartData', data={'id': args.ds_id})
        rows   = ((test_r.get('result') or {}).get('data') or [])
        if rows and isinstance(rows[0], dict):
            for k, v in rows[0].items():
                ft = 'Integer' if isinstance(v, (int, float)) else 'String'
                ds_fields.append({'fieldName': k, 'fieldType': ft})

    NUM_TYPES = ('Integer','Double','Long','Float','int','double','long','float')
    str_fields = [f['fieldName'] for f in ds_fields if f['fieldType'] not in NUM_TYPES]
    num_fields = [f['fieldName'] for f in ds_fields if f['fieldType'] in NUM_TYPES]
    if not str_fields and ds_fields: str_fields = [ds_fields[0]['fieldName']]
    if not num_fields and ds_fields:  num_fields = [ds_fields[-1]['fieldName']]

    DIM_F   = str_fields[0]  if str_fields else ''   # 第1个字符串字段 → 维度/名称/起点
    GROUP_F = str_fields[-1] if str_fields else ''   # 最后一个字符串字段 → 分组（如品类）
    VAL_F   = num_fields[0]  if num_fields else ''   # 第1个数字字段 → 数值

    field_option = [
        {'label': f['fieldName'], 'text': f['fieldName'], 'type': f['fieldType'],
         'value': f['fieldName'], 'show': 'Y'}
        for f in ds_fields
    ]

    DS_CONFIG = {
        'dataType':       2,
        'dataSetId':      args.ds_id,
        'dataSetName':    args.ds_name or ds_info.get('name', ''),
        'dataSetType':    args.ds_type,
        'dataSetApi':     ds_info.get('querySql', ''),
        'dataSetMethod':  ds_info.get('apiMethod', 'get'),
        'dataSetIzAgent': '1' if args.ds_type in ('FILES', 'singleFile') else '0',
        'chartData':      '[]',
        'viewLoading':    True,
        'paramOption':    [],
        'fieldOption':    field_option,
    }

    print(f'[绑定数据集] {DS_CONFIG["dataSetName"]} (ID: {args.ds_id})')
    print(f'  字段: {[f["fieldName"] for f in ds_fields]}')
    print(f'  维度={DIM_F}, 分组={GROUP_F}, 数值={VAL_F}')

# ── 网格布局：4列，每格 440×300，间距 20px ────────────────────────────────────
COLS, COMP_W, COMP_H, MARGIN = 4, 440, 300, 20

added   = 0
skipped = []

for key, comp_type, name in all_comps:
    if key not in defaults:
        skipped.append(key)
        continue

    cfg = json.loads(json.dumps(defaults[key]))   # deep copy
    w   = cfg.pop('w', COMP_W)
    h   = cfg.pop('h', COMP_H)
    cfg['background']  = '#FFFFFF00'
    cfg['borderColor'] = '#FFFFFF00'

    # 日历组件：chartData 日期必须替换为当月，否则数据点不显示
    if comp_type == 'JPermanentCalendar':
        _now = datetime.date.today()
        _y, _m = _now.year, _now.month
        _days   = [3, 5, 8, 10, 14, 15, 18, 20, 22, 25, 28]
        _values = [620000, 265000, 564000, 120000, 565000, 120000, 88000, 102000, 315000, 120, 103]
        cfg['chartData'] = [
            {'date': f'{_y}-{_m:02d}-{_d:02d}', 'value': _v}
            for _d, _v in zip(_days, _values)
        ]

    # option 可能是 JSON 字符串，统一转为 dict
    opt = cfg.get('option', {})
    if isinstance(opt, str):
        try:    opt = json.loads(opt)
        except: opt = {}
        cfg['option'] = opt

    # 设置标题
    opt_title = opt.get('title')
    if isinstance(opt_title, str):
        opt['title'] = {'text': name, 'show': True}
    elif isinstance(opt_title, dict):
        opt_title['text'] = name

    # 绑定数据集（有 DS_CONFIG 且组件支持数据绑定时）
    if DS_CONFIG and comp_type not in NO_BIND:
        slot_labels = SLOT_CONFIGS.get(comp_type, [])
        if slot_labels:
            is_multi = '分组' in slot_labels
            data_mapping = []
            for slot in slot_labels:
                if slot == '分组':
                    field = GROUP_F             # 最后一个字符串字段（如品类）
                elif slot == '维度':
                    field = DIM_F              # 第1个字符串字段（如大区）——多系列和单系列都用
                elif slot in ('数值', '数值1', '数值2', '总计', '已用', '总量', '当前'):
                    field = VAL_F
                elif slot in ('名称', '内容', '起点名称'):
                    field = DIM_F
                elif slot == '终点名称':
                    field = GROUP_F
                else:
                    field = DIM_F
                data_mapping.append({'filed': slot, 'mapping': field})
            cfg.update(copy.deepcopy(DS_CONFIG))
            cfg['dataMapping'] = data_mapping

    # chartData 序列化
    if 'chartData' in cfg and not isinstance(cfg['chartData'], str):
        cfg['chartData'] = json.dumps(cfg['chartData'], ensure_ascii=False)

    # 网格坐标
    col = added % COLS
    row = added // COLS
    x   = MARGIN + col * (COMP_W + MARGIN)
    y   = START_Y + row * (COMP_H + MARGIN)

    bi_utils.add_component(page_id, comp_type, name, x, y, w, h, cfg)
    added += 1
    print(f'  [{added:>3}] {name} ({comp_type}) @ ({x},{y})')

if skipped:
    print(f'\n[跳过（default_configs.json 中不存在）]: {skipped}')

# ── 合并保存：queryById + edit（同时写 template + 更新页面高度，共 3 次 API）──
rows_total   = (added + COLS - 1) // COLS
total_height = START_Y + rows_total * (COMP_H + MARGIN) + 50
components   = bi_utils._page_components[page_id]

raw     = bi_utils._request('GET', '/drag/page/queryById', params={'id': page_id})
p       = (raw.get('result') or {})
des_raw = p.get('desJson')
if des_raw and isinstance(des_raw, str):
    try:    des = json.loads(des_raw)
    except: des = {}
elif isinstance(des_raw, dict):
    des = des_raw
else:
    des = {}
des['height'] = total_height
des.setdefault('width', 1920)

info    = bi_utils._page_info.get(page_id, {})
payload = {
    'id':              page_id,
    'name':            info.get('name', PAGE_NAME),
    'template':        json.dumps(components, ensure_ascii=False),
    'updateCount':     p.get('updateCount', 1),
    'style':           info.get('style', 'bigScreen'),
    'theme':           info.get('theme', 'dark'),
    'backgroundImage': info.get('backgroundImage', '/img/bg/bg4.png'),
    'designType':      info.get('designType', 100),
    'desJson':         json.dumps(des, ensure_ascii=False),
}
bi_utils._request('POST', '/drag/page/edit', data=payload)

preview_url = f'{API_BASE}/drag/share/view/{page_id}?token={TOKEN}&tenantId=2'
elapsed     = time.time() - t0

print(f'\n[保存完成] 组件数: {added}，页面高度: {total_height}px（{rows_total}行）')
print(f'页面 ID: {page_id}')
print(f'\n预览地址:')
print(preview_url)
print(f'\n耗时: {elapsed:.1f}s')

# 自动复制到剪贴板
try:
    subprocess.run('clip', input=preview_url.encode('utf-8'), shell=True)
    print('[已复制到剪贴板]')
except Exception:
    pass
