# -*- coding: utf-8 -*-
"""
大屏/仪表盘联动与钻取配置工具
================================

使用方式（命令行）：

  # 查看页面所有联动和钻取配置
  py linkage_ops.py show <API_BASE> <TOKEN> <PAGE_ID>

  # 添加联动（从源组件到目标组件）
  py linkage_ops.py add-linkage <API_BASE> <TOKEN> <PAGE_ID> --source "饼图组件名" --target "柱形图组件名" --mapping "name=name"
  py linkage_ops.py add-linkage <API_BASE> <TOKEN> <PAGE_ID> --source "饼图" --target "柱形图" --mapping "name=name" --mapping "value=keyword"

  # 删除联动
  py linkage_ops.py remove-linkage <API_BASE> <TOKEN> <PAGE_ID> --source "饼图组件名" --target "柱形图组件名"

  # 添加钻取
  py linkage_ops.py add-drill <API_BASE> <TOKEN> <PAGE_ID> --comp "组件名" --mapping "name=category"
  py linkage_ops.py add-drill <API_BASE> <TOKEN> <PAGE_ID> --comp "组件名" --mapping "name=category" --mapping "value=amount"

  # 删除钻取
  py linkage_ops.py remove-drill <API_BASE> <TOKEN> <PAGE_ID> --comp "组件名"

联动 source 字段说明：
  name  - 维度（dimension）
  value - 数值（number）
  type  - 系列（series）
"""

import sys, json, os, argparse


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
# 核心操作函数（复用 comp_ops 的 load/save 模式）
# ============================================================
def load_template(page_id):
    """加载页面模板，返回组件列表"""
    page = query_page(page_id)
    tmpl = page.get('template', [])
    if isinstance(tmpl, str):
        tmpl = json.loads(tmpl)
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
    for comp in tmpl:
        cfg = comp.get('config', {})
        if isinstance(cfg, dict):
            comp['config'] = cfg
    bi_utils._page_components[page_id] = tmpl
    save_page(page_id)


def find_comp_by_name(tmpl, name):
    """在 template 中按名称查找组件（包括 JGroup 内部），返回组件 dict 或 None"""
    for comp in tmpl:
        if comp.get('componentName', '') == name:
            return comp
        if comp.get('component') == 'JGroup':
            for el in comp.get('props', {}).get('elements', []):
                if el.get('componentName', '') == name:
                    return el
    return None


def find_comp_by_i(tmpl, i_val):
    """在 template 中按 i 值查找组件，返回组件 dict 或 None"""
    for comp in tmpl:
        if comp.get('i') == i_val:
            return comp
        if comp.get('component') == 'JGroup':
            for el in comp.get('props', {}).get('elements', []):
                if el.get('i') == i_val:
                    return el
    return None


def all_components(tmpl):
    """遍历所有组件（包括 JGroup 内部），yield 每个组件 dict"""
    for comp in tmpl:
        yield comp
        if comp.get('component') == 'JGroup':
            for el in comp.get('props', {}).get('elements', []):
                yield el


def parse_mappings(mapping_list):
    """
    解析 --mapping 参数列表。
    每个 mapping 可以是 "src=tgt" 或 "src1=tgt1,src2=tgt2"。
    返回 [{'source': src, 'target': tgt}, ...]
    """
    result = []
    for m in mapping_list:
        pairs = m.split(',')
        for pair in pairs:
            pair = pair.strip()
            if '=' not in pair:
                print(f'无效的 mapping 格式（需要 src=tgt）: {pair}')
                continue
            src, tgt = pair.split('=', 1)
            result.append({'source': src.strip(), 'target': tgt.strip()})
    return result


def infer_field_option(cfg):
    """从组件 config 反推 fieldOption（UI 联动/钻取面板源字段下拉数据）。

    联动/钻取的 UI 配置面板通过 cfg.fieldOption 填充"字段选择器"；
    缺失/为空会导致 UI 面板字段下拉无候选，整个联动配置看起来像"未配置"。
    本函数按优先级从 cfg 各处提取可用字段名，统一产出 UI 期望格式。

    优先级（保留首次出现顺序，去重）：
      A 顶层     cfg.dataMapping[*].mapping          ← 绝大多数图表
      B.1/B.2    cfg.option.fieldMap values          ← JStatsSummary
                 cfg.option.titleMapping/valueMapping ← JSemiGauge
      B.3        cfg.option.field.dateField/valueField ← JPermanentCalendar
      B.4/B.5    cfg.option.contentFieldMapping[*].key ← JCardScroll/Carousel
                 cfg.option.fieldMapping[*].key      ← JScrollList/Table
      B.6        cfg.option.beginFields/centerTopFields/endFields[*].key ← JListProgress
      B.7        cfg.option.header[*].key            ← JScrollBoard

    返回 list[{show,label,text,value}]，无可推断字段时返回空列表。
    """
    SKIP_LITERALS = {'1', '0', ''}  # B.1 的 positiveValue/negativeValue 是枚举值非字段
    seen = []

    def _add(f):
        if not isinstance(f, str):
            return
        f = f.strip()
        if f and f not in SKIP_LITERALS and f not in seen:
            seen.append(f)

    # A 顶层 dataMapping
    for m in cfg.get('dataMapping') or []:
        _add((m or {}).get('mapping'))

    opt = cfg.get('option') or {}

    # B.1 fieldMap values（跳过 positiveValue/negativeValue 枚举键）
    fm = opt.get('fieldMap') or {}
    if isinstance(fm, dict):
        for k, v in fm.items():
            if k in ('positiveValue', 'negativeValue'):
                continue
            _add(v)

    # B.2 JSemiGauge
    _add(opt.get('titleMapping'))
    _add(opt.get('valueMapping'))

    # B.3 JPermanentCalendar
    field = opt.get('field') or {}
    if isinstance(field, dict):
        _add(field.get('dateField'))
        _add(field.get('valueField'))

    # B.4/B.5/B.6 各类 array-of-{key}
    for arr_key in ('contentFieldMapping', 'fieldMapping',
                    'beginFields', 'centerTopFields', 'endFields'):
        for item in opt.get(arr_key) or []:
            _add((item or {}).get('key'))

    # B.7 header[*].key
    for h in opt.get('header') or []:
        _add((h or {}).get('key'))

    return [{'show': 'Y', 'label': f, 'text': f, 'value': f} for f in seen]


def ensure_field_option(cfg, comp_label=''):
    """若 cfg.fieldOption 缺失/为空，则从 cfg 其他位置反推补齐。

    UI 联动/钻取配置面板必须有 fieldOption 才能显示源字段下拉——
    缺失会导致用户看不到已保存的联动配置。本函数被 add-linkage / add-drill
    在保存前自动调用，保障 UI 可见性（幂等）。
    """
    existing = cfg.get('fieldOption')
    if isinstance(existing, list) and len(existing) > 0:
        return False
    inferred = infer_field_option(cfg)
    if not inferred:
        print(f'  ⚠️ {comp_label} fieldOption 反推为空——请先完成数据集绑定（dataMapping/option）再配置联动，否则 UI 面板字段下拉无候选')
        return False
    cfg['fieldOption'] = inferred
    names = [f['value'] for f in inferred]
    print(f'  ℹ️ {comp_label} 自动补齐 fieldOption: {names}')
    return True


# ============================================================
# 命令实现
# ============================================================
def cmd_show(args):
    """显示页面所有联动和钻取配置"""
    tmpl = load_template(args.page_id)

    found_any = False

    for comp in all_components(tmpl):
        cname = comp.get('componentName', '') or comp.get('i', '?')
        ctype = comp.get('component', '?')
        cfg = comp.get('config', {})
        if isinstance(cfg, str):
            try:
                cfg = json.loads(cfg)
            except:
                cfg = {}

        linkage_config = cfg.get('linkageConfig', [])
        link_type = cfg.get('linkType', '')
        drill_data = cfg.get('drillData', [])

        has_linkage = isinstance(linkage_config, list) and len(linkage_config) > 0
        has_drill = isinstance(drill_data, list) and len(drill_data) > 0

        if not has_linkage and not has_drill:
            continue

        found_any = True
        print(f'组件: {cname} ({ctype})')

        if has_linkage:
            print(f'  联动类型: {link_type or "comp"}')
            for lk in linkage_config:
                target_i = lk.get('linkageId', '')
                target_comp = find_comp_by_i(tmpl, target_i)
                target_name = target_comp.get('componentName', target_i) if target_comp else target_i
                mappings = lk.get('linkage', [])
                mapping_str = ', '.join(f'{m.get("source","")} -> {m.get("target","")}' for m in mappings)
                print(f'  联动目标: {target_name} (i={target_i})')
                print(f'    字段映射: {mapping_str}')

        if has_drill:
            mapping_str = ', '.join(f'{m.get("source","")} -> {m.get("target","")}' for m in drill_data)
            print(f'  钻取映射: {mapping_str}')

        print()

    if not found_any:
        print('页面中没有配置联动或钻取的组件。')


def cmd_add_linkage(args):
    """添加联动配置。

    定位方式（实测 2026-05-13）：优先按 --source-id / --target-id 找（comp['i']），
    回退到 --source / --target（componentName）。原因：spec_builder 部分 handler 把
    title 覆盖 componentName，JSelectRadio / JStatsSummary / JScrollTable 默认 name 为空，
    按 name 找会全失败；按 i 找稳定。
    """
    tmpl = load_template(args.page_id)

    src_id = getattr(args, 'source_id', None)
    tgt_id = getattr(args, 'target_id', None)
    source_comp = find_comp_by_i(tmpl, src_id) if src_id else None
    if not source_comp and args.source:
        source_comp = find_comp_by_name(tmpl, args.source)
    if not source_comp:
        print(f'未找到源组件: source_id={src_id}, source={args.source}')
        return

    target_comp = find_comp_by_i(tmpl, tgt_id) if tgt_id else None
    if not target_comp and args.target:
        target_comp = find_comp_by_name(tmpl, args.target)
    if not target_comp:
        print(f'未找到目标组件: target_id={tgt_id}, target={args.target}')
        return

    target_i = target_comp.get('i', '')
    mappings = parse_mappings(args.mapping)
    if not mappings:
        print('没有有效的字段映射')
        return

    cfg = source_comp.get('config', {})
    if isinstance(cfg, str):
        try:
            cfg = json.loads(cfg)
        except:
            cfg = {}
        source_comp['config'] = cfg

    # 设置联动类型
    cfg['linkType'] = 'comp'

    # 初始化 linkageConfig
    if not isinstance(cfg.get('linkageConfig'), list):
        cfg['linkageConfig'] = []

    # 检查是否已存在到该目标的联动，存在则更新
    existing = None
    for lk in cfg['linkageConfig']:
        if lk.get('linkageId') == target_i:
            existing = lk
            break

    if existing:
        existing['linkage'] = mappings
        print(f'更新联动: {args.source} -> {args.target}')
    else:
        cfg['linkageConfig'].append({
            'linkageId': target_i,
            'linkage': mappings,
        })
        print(f'添加联动: {args.source} -> {args.target}')

    mapping_str = ', '.join(f'{m["source"]} -> {m["target"]}' for m in mappings)
    print(f'  字段映射: {mapping_str}')

    # UI 可见性保底：源组件必须有 fieldOption，否则联动面板字段下拉空白
    ensure_field_option(cfg, comp_label=f'源组件 [{args.source}]')

    save_template(args.page_id, tmpl)
    print('保存成功')


def cmd_remove_linkage(args):
    """删除联动配置"""
    tmpl = load_template(args.page_id)

    source_comp = find_comp_by_name(tmpl, args.source)
    if not source_comp:
        print(f'未找到源组件: {args.source}')
        return

    target_comp = find_comp_by_name(tmpl, args.target)
    if not target_comp:
        print(f'未找到目标组件: {args.target}')
        return

    target_i = target_comp.get('i', '')

    cfg = source_comp.get('config', {})
    if isinstance(cfg, str):
        try:
            cfg = json.loads(cfg)
        except:
            cfg = {}
        source_comp['config'] = cfg

    linkage_config = cfg.get('linkageConfig', [])
    if not isinstance(linkage_config, list):
        print(f'组件 {args.source} 没有联动配置')
        return

    new_linkage = [lk for lk in linkage_config if lk.get('linkageId') != target_i]

    if len(new_linkage) == len(linkage_config):
        print(f'未找到 {args.source} -> {args.target} 的联动配置')
        return

    cfg['linkageConfig'] = new_linkage

    # 如果没有联动了，清除 linkType
    if len(new_linkage) == 0:
        cfg.pop('linkType', None)

    save_template(args.page_id, tmpl)
    print(f'已删除联动: {args.source} -> {args.target}')


def cmd_add_drill(args):
    """添加钻取配置"""
    tmpl = load_template(args.page_id)

    comp = find_comp_by_name(tmpl, args.comp)
    if not comp:
        print(f'未找到组件: {args.comp}')
        return

    mappings = parse_mappings(args.mapping)
    if not mappings:
        print('没有有效的字段映射')
        return

    cfg = comp.get('config', {})
    if isinstance(cfg, str):
        try:
            cfg = json.loads(cfg)
        except:
            cfg = {}
        comp['config'] = cfg

    cfg['drillData'] = mappings

    mapping_str = ', '.join(f'{m["source"]} -> {m["target"]}' for m in mappings)
    print(f'添加钻取: {args.comp}')
    print(f'  字段映射: {mapping_str}')

    # UI 可见性保底：钻取源字段下拉也依赖 fieldOption
    ensure_field_option(cfg, comp_label=f'组件 [{args.comp}]')

    save_template(args.page_id, tmpl)
    print('保存成功')


def cmd_remove_drill(args):
    """删除钻取配置"""
    tmpl = load_template(args.page_id)

    comp = find_comp_by_name(tmpl, args.comp)
    if not comp:
        print(f'未找到组件: {args.comp}')
        return

    cfg = comp.get('config', {})
    if isinstance(cfg, str):
        try:
            cfg = json.loads(cfg)
        except:
            cfg = {}
        comp['config'] = cfg

    if not cfg.get('drillData'):
        print(f'组件 {args.comp} 没有钻取配置')
        return

    cfg.pop('drillData', None)

    save_template(args.page_id, tmpl)
    print(f'已删除组件 {args.comp} 的钻取配置')


# ============================================================
# CLI 入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='大屏联动与钻取配置工具')
    subparsers = parser.add_subparsers(dest='command', help='操作类型')

    # 通用参数
    def add_common(sub):
        sub.add_argument('api_base', help='API 地址')
        sub.add_argument('token', help='X-Access-Token')
        sub.add_argument('page_id', help='页面 ID')

    # show
    p_show = subparsers.add_parser('show', help='查看所有联动和钻取配置')
    add_common(p_show)

    # add-linkage
    p_add_lk = subparsers.add_parser('add-linkage', help='添加联动配置')
    add_common(p_add_lk)
    p_add_lk.add_argument('--source', default=None, help='源组件名称（或用 --source-id）')
    p_add_lk.add_argument('--target', default=None, help='目标组件名称（或用 --target-id）')
    p_add_lk.add_argument('--source-id', default=None, dest='source_id',
                          help='源组件 i 值（comp_ops.py list 拿到，优先于 --source。'
                               '用于 componentName 为空或被 title 覆盖时的稳定定位）')
    p_add_lk.add_argument('--target-id', default=None, dest='target_id',
                          help='目标组件 i 值（优先于 --target）')
    p_add_lk.add_argument('--mapping', action='append', required=True,
                           help='字段映射，格式: src=tgt（可多次使用，或逗号分隔如 name=name,value=keyword）')

    # remove-linkage
    p_rm_lk = subparsers.add_parser('remove-linkage', help='删除联动配置')
    add_common(p_rm_lk)
    p_rm_lk.add_argument('--source', required=True, help='源组件名称')
    p_rm_lk.add_argument('--target', required=True, help='目标组件名称')

    # add-drill
    p_add_dr = subparsers.add_parser('add-drill', help='添加钻取配置')
    add_common(p_add_dr)
    p_add_dr.add_argument('--comp', required=True, help='组件名称')
    p_add_dr.add_argument('--mapping', action='append', required=True,
                           help='字段映射，格式: src=tgt（可多次使用，或逗号分隔）')

    # remove-drill
    p_rm_dr = subparsers.add_parser('remove-drill', help='删除钻取配置')
    add_common(p_rm_dr)
    p_rm_dr.add_argument('--comp', required=True, help='组件名称')

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    init_api(args.api_base, args.token)

    if args.command == 'show':
        cmd_show(args)
    elif args.command == 'add-linkage':
        cmd_add_linkage(args)
    elif args.command == 'remove-linkage':
        cmd_remove_linkage(args)
    elif args.command == 'add-drill':
        cmd_add_drill(args)
    elif args.command == 'remove-drill':
        cmd_remove_drill(args)


if __name__ == '__main__':
    main()
