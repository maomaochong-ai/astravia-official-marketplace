# -*- coding: utf-8 -*-
"""
大屏/仪表盘批量样式操作工具
============================

使用方式（命令行）：

  # 查看所有图表组件的颜色设置
  py style_ops.py show-colors <API_BASE> <TOKEN> <PAGE_ID>

  # 设置所有图表的标题颜色
  py style_ops.py set-title-color <API_BASE> <TOKEN> <PAGE_ID> --color "#00FF00"

  # 设置所有图表的轴标签颜色
  py style_ops.py set-axis-color <API_BASE> <TOKEN> <PAGE_ID> --color "#ffffff"

  # 设置所有图表的网格线颜色
  py style_ops.py set-grid-color <API_BASE> <TOKEN> <PAGE_ID> --color "#FFFFFF1A"

  # 设置所有图表的图例文字颜色
  py style_ops.py set-legend-color <API_BASE> <TOKEN> <PAGE_ID> --color "#ffffff"

  # 设置所有图表的调色板（按产品 UI 命名色板，与页面"配色"下拉一致）
  py style_ops.py set-palette <API_BASE> <TOKEN> <PAGE_ID> --name 复古
  #   可选名：默认/复古/淡雅/未来/渐变/简洁/商务/柔和/科技/明亮/经典/清新/活力/火红/轻快/灵动
  # 或自定义：
  py style_ops.py set-palette <API_BASE> <TOKEN> <PAGE_ID> --colors "#5470C6,#91CC75,#FAC858,#EE6666,#73C0DE"
  # 默认按组件 y/x 轮转色板，每个图首色不同；加 --no-rotate 则全部从 color[0] 开始
  py style_ops.py list-palettes

  # 设置所有图表的标题字号
  py style_ops.py set-font-size <API_BASE> <TOKEN> <PAGE_ID> --size 16

  # 设置所有组件的背景色
  py style_ops.py set-bg-all <API_BASE> <TOKEN> <PAGE_ID> --color "#FFFFFF00"

  # 批量编辑：对指定类型组件应用任意 config 路径赋值
  py style_ops.py batch-edit <API_BASE> <TOKEN> <PAGE_ID> --type JBar --path "option.series[0].itemStyle.borderRadius" --value 5
"""

import sys, json, os, argparse

# ============================================================
# 命名色板（与 jmreport 前端 "配色" 下拉一致，源自大屏设计器源码）
# ============================================================
NAMED_PALETTES = {
    '默认': ['#1e90ff', '#90ee90', '#00ced1', '#e2bd84', '#7a90e0', '#3ba272', '#2be7ff', '#0a8ada', '#ffd700'],
    '复古': ['#0780cf', '#765005', '#fa6d1d', '#0e2c82', '#b6b51f', '#da1f18', '#701866', '#f47a75', '#009db2'],
    '淡雅': ['#95a2ff', '#fa8080', '#ffc076', '#fae768', '#87e885', '#3cb9fc', '#73abf5', '#cb9bff', '#434348'],
    '未来': ['#63b2ee', '#76da91', '#f8cb7f', '#f89588', '#7cd6cf', '#9192ab', '#7898e1', '#efa666', '#eddd86'],
    '渐变': ['#71ae46', '#96b744', '#c4cc38', '#ebe12a', '#eab026', '#e3852b', '#d85d2a', '#ce2626', '#ac2026'],
    '简洁': ['#929fff', '#9de0ff', '#ffa897', '#af87fe', '#7dc3fe', '#bb60b2', '#433e7c', '#f47a75', '#009db2'],
    '商务': ['#194f97', '#555555', '#bd6b08', '#00686b', '#c82d31', '#625ba1', '#898989', '#9c9800', '#007f54'],
    '柔和': ['#5b9bd5', '#ed7d31', '#70ad47', '#ffc000', '#4472c4', '#91d024', '#b235e6', '#02ae75', '#5b9bd5'],
    '科技': ['#05f8d6', '#0082fc', '#fdd845', '#22ed7c', '#09b0d3', '#1d27c9', '#f9e264', '#f47a75', '#009db2'],
    '明亮': ['#884898', '#808080', '#82ae46', '#00a3af', '#ef8b07', '#007bbb', '#9d775f', '#fae800', '#5f9b3c'],
    '经典': ['#007bbb', '#ffdb4f', '#dd4b4b', '#2ca9e1', '#ef8b07', '#4a488e', '#82ae46', '#dd4b4b', '#bb9581'],
    '清新': ['#5f9b3c', '#75c24b', '#83d65f', '#aacf53', '#c7dc68', '#d8e698', '#e0ebaf', '#bbc8e6', '#e5e5e5'],
    '活力': ['#ef8b07', '#2a83a2', '#f07474', '#c55784', '#274a78', '#7058a3', '#0095d9', '#75c24b', '#808080'],
    '火红': ['#ff0000', '#ef8b07', '#4c6cb3', '#f8e944', '#69821b', '#9c5ec3', '#00ccdf', '#f07474', '#bb9581'],
    '轻快': ['#fae800', '#00c039', '#0482dc', '#bb9581', '#ff7701', '#9c5ec3', '#00ccdf', '#00c039', '#ff7701'],
    '灵动': ['#00a3af', '#4da798', '#57baaa', '#62d0bd', '#6ee4d0', '#86e7d6', '#aeede1', '#bde1e6', '#e5e5e5'],
}

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
# 图表组件类型列表
# ============================================================
CHART_TYPES = {
    # ECharts 笛卡尔（18 个，与 spec_builder ECHARTS_CARTESIAN 一致）
    'DoubleLineBar', 'JArea', 'JBackgroundBar', 'JBar', 'JBubble', 'JDynamicBar',
    'JHorizontalBar', 'JLine', 'JMixLineBar', 'JMultipleBar', 'JMultipleLine',
    'JNegativeBar', 'JPercentBar', 'JQuadrant', 'JScatter', 'JSmoothLine',
    'JStackBar', 'JStepLine',
    # ECharts 极坐标（11 个，与 spec_builder ECHARTS_POLAR 一致）
    'JActiveRing', 'JBreakRing', 'JCircleRadar', 'JFunnel', 'JPie',
    'JPyramidFunnel', 'JRadar', 'JRadialBar', 'JRing', 'JRose', 'JRotatePie',
    # 仪表盘/水波/胶囊（ECharts 或 AntV 渲染，但都吃 option.color / customColor）
    'JAntvGauge', 'JColorGauge', 'JGauge', 'JLiquid', 'JSemiGauge',
    'JCapsuleChart', 'JListProgress', 'JRingProgress',
    # 地图
    'JAreaMap', 'JBarMap', 'JBubbleMap', 'JFlyLineMap', 'JHeatMap',
    # 其他 ECharts 类
    'JWordCloud', 'JStackArea',
    # 兜底：保留历史列表里的其他 echarts 通用类型（可能未来扩展会用）
    'JWaterfall', 'JBoxplot', 'JHeatmap', 'JTreemap', 'JSunburst',
    'JSankey', 'JGraph', 'JTree', 'JParallel', 'JThemeRiver',
    'JCandlestick', 'JPictorialBar', 'JMap', 'JGlobe',
}


# 单值自定义渲染图表：option.color 必须是 string，写 array 会 fallback 到默认色
# （与 ECharts 类不同——ECharts 把 color 数组当作 palette 轮询，这些组件直接当颜色值读）
# 判断依据：defaults/<Type>.json 中 option.color 默认就是 string
STRING_COLOR_TYPES = {'JRingProgress', 'JLiquid', 'JScrollRankingBoard'}


# ============================================================
# 模板加载/保存（与 comp_ops 一致）
# ============================================================
def load_template(page_id):
    """加载页面模板，返回组件列表"""
    page = query_page(page_id)
    tmpl = page.get('template', [])
    if isinstance(tmpl, str):
        tmpl = json.loads(tmpl)
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
    for comp in tmpl:
        cfg = comp.get('config', {})
        if isinstance(cfg, dict):
            comp['config'] = cfg
    bi_utils._page_components[page_id] = tmpl
    save_page(page_id)


# ============================================================
# 工具函数
# ============================================================
def set_nested(obj, path, value):
    """
    按路径设置嵌套字典的值。
    支持: option.series[0].itemStyle.color, chartData.value 等
    """
    parts = []
    for p in path.split('.'):
        if '[' in p:
            key = p[:p.index('[')]
            idx = int(p[p.index('[') + 1:p.index(']')])
            parts.append(('key', key))
            parts.append(('idx', idx))
        else:
            parts.append(('key', p))

    current = obj
    for i, (kind, val) in enumerate(parts[:-1]):
        if kind == 'key':
            if isinstance(current, dict):
                if val not in current:
                    next_kind = parts[i + 1][0] if i + 1 < len(parts) else 'key'
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
            current[last_val] = _auto_type(value)
    elif last_kind == 'idx':
        if isinstance(current, list):
            while len(current) <= last_val:
                current.append({})
            current[last_val] = _auto_type(value)


def get_nested(obj, path, default=None):
    """
    按路径读取嵌套字典的值。路径不存在返回 default。
    """
    parts = []
    for p in path.split('.'):
        if '[' in p:
            key = p[:p.index('[')]
            idx = int(p[p.index('[') + 1:p.index(']')])
            parts.append(('key', key))
            parts.append(('idx', idx))
        else:
            parts.append(('key', p))

    current = obj
    for kind, val in parts:
        if current is None:
            return default
        if kind == 'key':
            if isinstance(current, dict):
                current = current.get(val)
            else:
                return default
        elif kind == 'idx':
            if isinstance(current, list) and val < len(current):
                current = current[val]
            else:
                return default
    return current if current is not None else default


def _auto_type(val):
    """字符串自动转换为合适类型"""
    if isinstance(val, str):
        if val.lower() == 'true':
            return True
        if val.lower() == 'false':
            return False
        if val.lower() == 'null' or val.lower() == 'none':
            return None
        try:
            if '.' in val:
                return float(val)
            return int(val)
        except ValueError:
            pass
        if val.startswith('{') or val.startswith('['):
            try:
                return json.loads(val)
            except:
                pass
    return val


def iter_all_components(tmpl):
    """遍历所有组件（包括 JGroup 内部），yield (comp, parent_or_None)"""
    for comp in tmpl:
        yield comp
        if comp.get('component') == 'JGroup':
            elements = comp.get('props', {}).get('elements', [])
            for el in elements:
                yield el


def is_chart(comp):
    """判断组件是否为图表类型"""
    return comp.get('component', '') in CHART_TYPES


# ============================================================
# 命令实现
# ============================================================
def cmd_show_colors(args):
    """查看所有图表组件的颜色设置"""
    tmpl = load_template(args.page_id)

    header = f'{"组件名":<20} {"类型":<18} {"标题色":<12} {"轴标签色":<12} {"图例色":<12} {"背景色":<12}'
    print(header)
    print('-' * 90)

    count = 0
    for comp in iter_all_components(tmpl):
        if not is_chart(comp):
            continue
        cfg = comp.get('config', {})
        name = comp.get('componentName', '(无名)')
        ctype = comp.get('component', '?')

        title_color = get_nested(cfg, 'option.title.textStyle.color', '-')
        x_axis_color = get_nested(cfg, 'option.xAxis.axisLabel.color', '-')
        y_axis_color = get_nested(cfg, 'option.yAxis.axisLabel.color', '-')
        # 轴标签色取 x 或 y 中有值的
        axis_color = x_axis_color if x_axis_color != '-' else y_axis_color
        legend_color = get_nested(cfg, 'option.legend.textStyle.color', '-')
        bg_color = cfg.get('background', '-')

        print(f'{name:<20} {ctype:<18} {str(title_color):<12} {str(axis_color):<12} {str(legend_color):<12} {str(bg_color):<12}')
        count += 1

    print(f'\n共 {count} 个图表组件')


def cmd_set_title_color(args):
    """设置所有图表的标题颜色"""
    tmpl = load_template(args.page_id)
    modified = 0
    for comp in iter_all_components(tmpl):
        if not is_chart(comp):
            continue
        cfg = comp.get('config', {})
        set_nested(cfg, 'option.title.textStyle.color', args.color)
        modified += 1
        print(f'  {comp.get("componentName", "")} ({comp.get("component", "")}): 标题色 -> {args.color}')

    if modified == 0:
        print('未找到图表组件')
        return
    save_template(args.page_id, tmpl)
    print(f'\n共修改 {modified} 个图表组件的标题颜色')


def cmd_set_axis_color(args):
    """设置所有图表的轴标签颜色"""
    tmpl = load_template(args.page_id)
    modified = 0
    for comp in iter_all_components(tmpl):
        if not is_chart(comp):
            continue
        cfg = comp.get('config', {})
        set_nested(cfg, 'option.xAxis.axisLabel.color', args.color)
        set_nested(cfg, 'option.yAxis.axisLabel.color', args.color)
        # 同时设置轴线颜色
        set_nested(cfg, 'option.xAxis.axisLine.lineStyle.color', args.color)
        set_nested(cfg, 'option.yAxis.axisLine.lineStyle.color', args.color)
        modified += 1
        print(f'  {comp.get("componentName", "")} ({comp.get("component", "")}): 轴标签色 -> {args.color}')

    if modified == 0:
        print('未找到图表组件')
        return
    save_template(args.page_id, tmpl)
    print(f'\n共修改 {modified} 个图表组件的轴标签颜色')


def cmd_set_grid_color(args):
    """设置所有图表的网格/分隔线颜色"""
    tmpl = load_template(args.page_id)
    modified = 0
    for comp in iter_all_components(tmpl):
        if not is_chart(comp):
            continue
        cfg = comp.get('config', {})
        set_nested(cfg, 'option.xAxis.splitLine.lineStyle.color', args.color)
        set_nested(cfg, 'option.yAxis.splitLine.lineStyle.color', args.color)
        modified += 1
        print(f'  {comp.get("componentName", "")} ({comp.get("component", "")}): 网格线色 -> {args.color}')

    if modified == 0:
        print('未找到图表组件')
        return
    save_template(args.page_id, tmpl)
    print(f'\n共修改 {modified} 个图表组件的网格线颜色')


def cmd_set_legend_color(args):
    """设置所有图表的图例文字颜色"""
    tmpl = load_template(args.page_id)
    modified = 0
    for comp in iter_all_components(tmpl):
        if not is_chart(comp):
            continue
        cfg = comp.get('config', {})
        set_nested(cfg, 'option.legend.textStyle.color', args.color)
        modified += 1
        print(f'  {comp.get("componentName", "")} ({comp.get("component", "")}): 图例色 -> {args.color}')

    if modified == 0:
        print('未找到图表组件')
        return
    save_template(args.page_id, tmpl)
    print(f'\n共修改 {modified} 个图表组件的图例颜色')


def cmd_set_palette(args):
    """设置所有图表的调色板

    同时处理三处：
      - option.customColor（jmreport 自定义色板，多系列图/饼图用）
      - option.color（ECharts 原生 palette，单系列兜底）
      - 清除 series[].itemStyle/lineStyle/areaStyle.color（否则硬编码色
        会盖住 palette，单系列柱/线/面积图表现不出色板切换）

    默认按组件 y/x 排序轮转色板：第 i 个图从 palette[i % N] 开始，
    让单色图各自不同；--no-rotate 则所有图都从 color[0] 开始。
    """
    # 1) 取色板：优先 --name
    if getattr(args, 'name', None):
        if args.name not in NAMED_PALETTES:
            print(f'未知色板 "{args.name}"；可选: {", ".join(NAMED_PALETTES.keys())}')
            return
        color_list = list(NAMED_PALETTES[args.name])
        src = f'命名色板 "{args.name}"'
    elif getattr(args, 'colors', None):
        color_list = [c.strip() for c in args.colors.split(',') if c.strip()]
        src = '自定义'
    else:
        print('必须指定 --name 或 --colors'); return

    if not color_list:
        print('色板为空'); return
    custom_color = [{'color': c, 'color1': c} for c in color_list]

    tmpl = load_template(args.page_id)
    chart_comps = [c for c in iter_all_components(tmpl) if is_chart(c)]
    # 稳定排序：左上到右下
    chart_comps.sort(key=lambda c: (c.get('y', 0), c.get('x', 0)))

    rotate = not getattr(args, 'no_rotate', False)
    for order, comp in enumerate(chart_comps):
        cfg = comp.setdefault('config', {})
        opt = cfg.setdefault('option', {})
        k = (order % len(color_list)) if rotate else 0
        # 单值自定义渲染组件 option.color 写 string；其余写 array（兼容已存为 string 的）
        if comp.get('component') in STRING_COLOR_TYPES or isinstance(opt.get('color'), str):
            opt['color'] = color_list[k]
        else:
            opt['color'] = color_list[k:] + color_list[:k]
        opt['customColor'] = custom_color[k:] + custom_color[:k]
        for s in opt.get('series', []) or []:
            if isinstance(s, dict):
                for style_key in ('itemStyle', 'lineStyle', 'areaStyle'):
                    style = s.get(style_key)
                    if isinstance(style, dict):
                        style.pop('color', None)

    if not chart_comps:
        print('未找到图表组件')
        return
    save_template(args.page_id, tmpl)
    rotate_tip = '（按 y/x 轮转）' if rotate else '（无轮转）'
    print(f'共修改 {len(chart_comps)} 个图表 → {src}{rotate_tip}: {color_list}')


def cmd_list_palettes(args):
    """列出所有命名色板"""
    for name, colors in NAMED_PALETTES.items():
        print(f'{name:4}  ' + ' '.join(colors))


def cmd_set_font_size(args):
    """设置所有图表的标题字号"""
    tmpl = load_template(args.page_id)
    modified = 0
    for comp in iter_all_components(tmpl):
        if not is_chart(comp):
            continue
        cfg = comp.get('config', {})
        set_nested(cfg, 'option.title.textStyle.fontSize', str(args.size))
        modified += 1
        print(f'  {comp.get("componentName", "")} ({comp.get("component", "")}): 标题字号 -> {args.size}')

    if modified == 0:
        print('未找到图表组件')
        return
    save_template(args.page_id, tmpl)
    print(f'\n共修改 {modified} 个图表组件的标题字号')


def cmd_set_bg_all(args):
    """设置所有组件的背景色"""
    tmpl = load_template(args.page_id)
    modified = 0
    for comp in iter_all_components(tmpl):
        cfg = comp.get('config', {})
        cfg['background'] = args.color
        modified += 1
        print(f'  {comp.get("componentName", "")} ({comp.get("component", "")}): 背景色 -> {args.color}')

    if modified == 0:
        print('未找到组件')
        return
    save_template(args.page_id, tmpl)
    print(f'\n共修改 {modified} 个组件的背景色')


def cmd_batch_edit(args):
    """批量编辑：对指定类型组件应用任意 config 路径赋值"""
    tmpl = load_template(args.page_id)
    modified = 0
    for comp in iter_all_components(tmpl):
        # 按类型过滤
        if args.type and comp.get('component') != args.type:
            continue
        # 按名称过滤
        if args.name and comp.get('componentName', '') != args.name:
            continue
        # 如果没有过滤条件，跳过（防止误操作）
        if not args.type and not args.name:
            print('错误：batch-edit 需要至少指定 --type 或 --name 过滤条件')
            return

        cfg = comp.get('config', {})
        set_nested(cfg, args.path, args.value)
        modified += 1
        print(f'  {comp.get("componentName", "")} ({comp.get("component", "")}): config.{args.path} = {args.value}')

    if modified == 0:
        print('未找到匹配的组件')
        return
    save_template(args.page_id, tmpl)
    print(f'\n共修改 {modified} 个组件')


# ============================================================
# CLI 入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='大屏批量样式操作工具')
    subparsers = parser.add_subparsers(dest='command', help='操作类型')

    def add_common(sub):
        sub.add_argument('api_base', help='API 地址')
        sub.add_argument('token', help='X-Access-Token')
        sub.add_argument('page_id', help='页面 ID')

    # show-colors
    p_show = subparsers.add_parser('show-colors', help='查看所有图表组件的颜色设置')
    add_common(p_show)

    # set-title-color
    p_title = subparsers.add_parser('set-title-color', help='设置所有图表的标题颜色')
    add_common(p_title)
    p_title.add_argument('--color', required=True, help='颜色值，如 "#00FF00"')

    # set-axis-color
    p_axis = subparsers.add_parser('set-axis-color', help='设置所有图表的轴标签颜色')
    add_common(p_axis)
    p_axis.add_argument('--color', required=True, help='颜色值，如 "#ffffff"')

    # set-grid-color
    p_grid = subparsers.add_parser('set-grid-color', help='设置所有图表的网格线颜色')
    add_common(p_grid)
    p_grid.add_argument('--color', required=True, help='颜色值，如 "#FFFFFF1A"（8 位 hex 含 alpha）')

    # set-legend-color
    p_legend = subparsers.add_parser('set-legend-color', help='设置所有图表的图例文字颜色')
    add_common(p_legend)
    p_legend.add_argument('--color', required=True, help='颜色值，如 "#ffffff"')

    # set-palette
    p_palette = subparsers.add_parser('set-palette', help='设置所有图表的调色板（命名或自定义）')
    add_common(p_palette)
    p_palette.add_argument('--name', default=None,
                           help='命名色板（16 种，见 list-palettes）：默认/复古/淡雅/未来/渐变/简洁/商务/柔和/科技/明亮/经典/清新/活力/火红/轻快/灵动')
    p_palette.add_argument('--colors', default=None,
                           help='自定义色板，逗号分隔，如 "#5470C6,#91CC75,#FAC858"')
    p_palette.add_argument('--no-rotate', action='store_true',
                           help='不按 y/x 轮转，所有图表从 color[0] 开始')

    # list-palettes
    p_list_pal = subparsers.add_parser('list-palettes', help='列出所有命名色板（无需 API/token）')

    # set-font-size
    p_font = subparsers.add_parser('set-font-size', help='设置所有图表的标题字号')
    add_common(p_font)
    p_font.add_argument('--size', type=int, required=True, help='字号大小，如 16')

    # set-bg-all
    p_bg = subparsers.add_parser('set-bg-all', help='设置所有组件的背景色')
    add_common(p_bg)
    p_bg.add_argument('--color', required=True, help='颜色值，如 "#FFFFFF00"（透明）')

    # batch-edit
    p_batch = subparsers.add_parser('batch-edit', help='批量编辑：对匹配组件应用任意 config 路径赋值')
    add_common(p_batch)
    p_batch.add_argument('--type', default=None, help='按组件类型过滤（如 JBar）')
    p_batch.add_argument('--name', default=None, help='按组件名称过滤')
    p_batch.add_argument('--path', required=True, help='config 内的属性路径，如 "option.series[0].itemStyle.borderRadius"')
    p_batch.add_argument('--value', required=True, help='要设置的值')

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    # list-palettes 不需要 API，提前处理
    if args.command == 'list-palettes':
        cmd_list_palettes(args)
        return

    init_api(args.api_base, args.token)

    commands = {
        'show-colors': cmd_show_colors,
        'set-title-color': cmd_set_title_color,
        'set-axis-color': cmd_set_axis_color,
        'set-grid-color': cmd_set_grid_color,
        'set-legend-color': cmd_set_legend_color,
        'set-palette': cmd_set_palette,
        'set-font-size': cmd_set_font_size,
        'set-bg-all': cmd_set_bg_all,
        'batch-edit': cmd_batch_edit,
    }

    handler = commands.get(args.command)
    if handler:
        handler(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
