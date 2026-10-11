# -*- coding: utf-8 -*-
"""
大屏/仪表盘备份与恢复工具 —— 导出、导入、克隆、对比
=====================================================

使用方式（命令行）：

  # 导出页面为 JSON 文件
  py backup_ops.py export <API_BASE> <TOKEN> --page <PAGE_ID> --output "backup_page.json"

  # 从 JSON 文件导入/恢复页面
  py backup_ops.py import <API_BASE> <TOKEN> --input "backup_page.json" --name "恢复的大屏"

  # 克隆页面（通过 API）
  py backup_ops.py clone <API_BASE> <TOKEN> --page <PAGE_ID>

  # 对比两个页面的组件差异
  py backup_ops.py diff <API_BASE> <TOKEN> --page1 <PAGE_ID1> --page2 <PAGE_ID2>
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
from bi_utils import init_api, query_page, save_page, create_page, copy_page


# ============================================================
# 辅助函数
# ============================================================
def _load_template(page_id):
    """加载页面模板，返回组件列表（config 解析为 dict）"""
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


def _remap_ids(template):
    """
    为模板中的所有组件生成新 ID，并更新 JTabToggle/JGroup 内部引用。
    返回更新后的 template。
    """
    id_mapping = {}

    # 第一遍：收集所有旧 ID，生成新 ID
    def _collect_ids(comps):
        for comp in comps:
            old_i = comp.get('i')
            if old_i:
                id_mapping[old_i] = bi_utils._gen_uuid()
            # JGroup 内部元素
            if comp.get('component') == 'JGroup':
                elements = comp.get('props', {}).get('elements', [])
                _collect_ids(elements)
            # JTabToggle tab 内部元素
            if comp.get('component') == 'JTabToggle':
                cfg = comp.get('config', {})
                if isinstance(cfg, str):
                    try:
                        cfg = json.loads(cfg)
                    except:
                        cfg = {}
                    comp['config'] = cfg
                tabs = cfg.get('option', {}).get('tabs', [])
                for tab in tabs:
                    tab_elements = tab.get('elements', [])
                    _collect_ids(tab_elements)

    _collect_ids(template)

    # 第二遍：替换 ID 并清理
    def _apply_ids(comps):
        for comp in comps:
            old_i = comp.get('i')
            if old_i and old_i in id_mapping:
                comp['i'] = id_mapping[old_i]
            comp.pop('pageCompId', None)

            # 确保 config 是 dict
            cfg = comp.get('config', {})
            if isinstance(cfg, str):
                try:
                    cfg = json.loads(cfg)
                except:
                    cfg = {}
                comp['config'] = cfg

            # JGroup 内部元素
            if comp.get('component') == 'JGroup':
                elements = comp.get('props', {}).get('elements', [])
                _apply_ids(elements)
                # 更新 groupId 引用
                for el in elements:
                    if el.get('groupId') and el['groupId'] in id_mapping:
                        el['groupId'] = id_mapping[el['groupId']]

            # JTabToggle tab 内部元素
            if comp.get('component') == 'JTabToggle':
                cfg = comp.get('config', {})
                tabs = cfg.get('option', {}).get('tabs', [])
                for tab in tabs:
                    tab_elements = tab.get('elements', [])
                    _apply_ids(tab_elements)
                    # 更新 tab 中的 parentId 引用
                    for el in tab_elements:
                        if el.get('parentId') and el['parentId'] in id_mapping:
                            el['parentId'] = id_mapping[el['parentId']]

    _apply_ids(template)
    return template


def _comp_signature(comp):
    """生成组件签名用于对比（类型+名称）"""
    return (comp.get('component', ''), comp.get('componentName', ''))


def _comp_position(comp):
    """提取组件位置和尺寸"""
    return {
        'x': comp.get('x', 0),
        'y': comp.get('y', 0),
        'w': comp.get('w', 0),
        'h': comp.get('h', 0),
    }


def _format_comp(comp):
    """格式化组件信息用于输出"""
    ctype = comp.get('component', '?')
    cname = comp.get('componentName', '')
    x, y = comp.get('x', 0), comp.get('y', 0)
    w, h = comp.get('w', 0), comp.get('h', 0)
    return f'{ctype:<20} {cname:<20} 位置({x},{y}) 尺寸{w}x{h}'


# ============================================================
# 命令实现
# ============================================================
def cmd_export(args):
    """导出页面为 JSON 文件"""
    page_id = args.page
    output_path = args.output

    # 获取完整页面实体
    raw = bi_utils._request('GET', '/drag/page/queryById', params={'id': page_id})
    if not raw.get('success'):
        print(f'查询页面失败: {raw.get("message", "")}')
        return

    page = raw['result']

    # 解析 template（如果是字符串）
    if isinstance(page.get('template'), str):
        try:
            page['template'] = json.loads(page['template'])
        except:
            pass

    # 解析 template 中各组件的 config
    template = page.get('template', [])
    if isinstance(template, list):
        for comp in template:
            cfg = comp.get('config', {})
            if isinstance(cfg, str):
                try:
                    comp['config'] = json.loads(cfg)
                except:
                    comp['config'] = {}

    # 写入文件
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(page, f, ensure_ascii=False, indent=2)

    comp_count = len(template) if isinstance(template, list) else 0
    print(f'导出成功: {page.get("name", page_id)}')
    print(f'  组件数量: {comp_count}')
    print(f'  输出文件: {os.path.abspath(output_path)}')


def cmd_import(args):
    """从 JSON 文件导入/恢复页面"""
    input_path = args.input
    name = args.name

    # 读取备份文件
    with open(input_path, 'r', encoding='utf-8') as f:
        backup = json.load(f)

    template = backup.get('template', [])
    if isinstance(template, str):
        try:
            template = json.loads(template)
        except:
            template = []

    # 确保 template 是列表
    if not isinstance(template, list):
        print(f'备份文件 template 格式异常，期望列表，实际: {type(template).__name__}')
        return

    # 为所有组件生成新 ID
    template = _remap_ids(template)

    # 使用备份中的名称（如未指定）
    if not name:
        name = backup.get('name', '导入的页面') + '_恢复'

    # 从备份中提取页面属性
    style = backup.get('style', 'bigScreen')
    theme = backup.get('theme', 'dark' if style == 'bigScreen' else 'default')
    background_image = backup.get('backgroundImage', '')

    # 创建新页面
    page_id = create_page(
        name,
        style=style,
        theme=theme,
        background_image=background_image,
    )

    # 设置组件并保存
    bi_utils._page_components[page_id] = template
    save_page(page_id)

    print(f'导入成功: {name}')
    print(f'  新页面ID: {page_id}')
    print(f'  组件数量: {len(template)}')
    print(f'  来源文件: {os.path.abspath(input_path)}')


def cmd_clone(args):
    """通过 API 克隆页面"""
    page_id = args.page

    # 先查询原页面信息
    page = query_page(page_id)
    original_name = page.get('name', page_id)

    # 调用复制 API
    new_id = copy_page(page_id)

    # 查询新页面信息
    new_page = query_page(new_id)
    new_name = new_page.get('name', new_id)
    template = new_page.get('template', [])
    if isinstance(template, str):
        try:
            template = json.loads(template)
        except:
            template = []
    comp_count = len(template) if isinstance(template, list) else 0

    print(f'克隆成功:')
    print(f'  原页面: {original_name} ({page_id})')
    print(f'  新页面: {new_name} ({new_id})')
    print(f'  组件数量: {comp_count}')


def cmd_diff(args):
    """对比两个页面的组件差异"""
    page_id1 = args.page1
    page_id2 = args.page2

    # 加载两个页面
    page1 = query_page(page_id1)
    page2 = query_page(page_id2)
    name1 = page1.get('name', page_id1)
    name2 = page2.get('name', page_id2)

    tmpl1 = page1.get('template', [])
    tmpl2 = page2.get('template', [])
    if isinstance(tmpl1, str):
        try:
            tmpl1 = json.loads(tmpl1)
        except:
            tmpl1 = []
    if isinstance(tmpl2, str):
        try:
            tmpl2 = json.loads(tmpl2)
        except:
            tmpl2 = []

    print(f'对比页面:')
    print(f'  页面1: {name1} ({page_id1}) - {len(tmpl1)} 个组件')
    print(f'  页面2: {name2} ({page_id2}) - {len(tmpl2)} 个组件')
    print()

    # 按签名（类型+名称）分组
    sigs1 = {}  # signature -> [comp, ...]
    sigs2 = {}
    for comp in tmpl1:
        sig = _comp_signature(comp)
        sigs1.setdefault(sig, []).append(comp)
    for comp in tmpl2:
        sig = _comp_signature(comp)
        sigs2.setdefault(sig, []).append(comp)

    all_sigs = set(list(sigs1.keys()) + list(sigs2.keys()))

    only_in_1 = []
    only_in_2 = []
    in_both_diff = []
    in_both_same = []

    for sig in sorted(all_sigs):
        comps1 = sigs1.get(sig, [])
        comps2 = sigs2.get(sig, [])

        if comps1 and not comps2:
            for c in comps1:
                only_in_1.append(c)
        elif comps2 and not comps1:
            for c in comps2:
                only_in_2.append(c)
        else:
            # 都有，按顺序比较位置/尺寸
            max_len = max(len(comps1), len(comps2))
            for idx in range(max_len):
                if idx >= len(comps1):
                    only_in_2.append(comps2[idx])
                elif idx >= len(comps2):
                    only_in_1.append(comps1[idx])
                else:
                    pos1 = _comp_position(comps1[idx])
                    pos2 = _comp_position(comps2[idx])
                    if pos1 != pos2:
                        in_both_diff.append((comps1[idx], comps2[idx]))
                    else:
                        in_both_same.append(comps1[idx])

    # 输出结果
    if only_in_1:
        print(f'--- 仅在页面1中存在 ({len(only_in_1)} 个) ---')
        for comp in only_in_1:
            print(f'  {_format_comp(comp)}')
        print()

    if only_in_2:
        print(f'+++ 仅在页面2中存在 ({len(only_in_2)} 个) +++')
        for comp in only_in_2:
            print(f'  {_format_comp(comp)}')
        print()

    if in_both_diff:
        print(f'~~~ 两页面都有但位置/尺寸不同 ({len(in_both_diff)} 个) ~~~')
        for c1, c2 in in_both_diff:
            sig = _comp_signature(c1)
            p1 = _comp_position(c1)
            p2 = _comp_position(c2)
            print(f'  {sig[0]:<20} {sig[1]:<20}')
            # 逐项显示差异
            for key in ('x', 'y', 'w', 'h'):
                if p1[key] != p2[key]:
                    print(f'    {key}: {p1[key]} -> {p2[key]}')
        print()

    if in_both_same:
        print(f'=== 两页面相同 ({len(in_both_same)} 个) ===')
        for comp in in_both_same:
            print(f'  {_format_comp(comp)}')
        print()

    # 汇总
    print(f'汇总: 仅页面1={len(only_in_1)}, 仅页面2={len(only_in_2)}, '
          f'位置不同={len(in_both_diff)}, 完全相同={len(in_both_same)}')


# ============================================================
# CLI 入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='大屏备份与恢复工具')
    subparsers = parser.add_subparsers(dest='command', help='操作类型')

    # export
    p_export = subparsers.add_parser('export', help='导出页面为 JSON 文件')
    p_export.add_argument('api_base', help='API 地址')
    p_export.add_argument('token', help='X-Access-Token')
    p_export.add_argument('--page', required=True, help='页面 ID')
    p_export.add_argument('--output', default='backup_page.json', help='输出文件路径（默认 backup_page.json）')

    # import
    p_import = subparsers.add_parser('import', help='从 JSON 文件导入/恢复页面')
    p_import.add_argument('api_base', help='API 地址')
    p_import.add_argument('token', help='X-Access-Token')
    p_import.add_argument('--input', required=True, help='输入 JSON 文件路径')
    p_import.add_argument('--name', default='', help='新页面名称（默认使用备份中的名称+_恢复）')

    # clone
    p_clone = subparsers.add_parser('clone', help='克隆页面（通过 API）')
    p_clone.add_argument('api_base', help='API 地址')
    p_clone.add_argument('token', help='X-Access-Token')
    p_clone.add_argument('--page', required=True, help='页面 ID')

    # diff
    p_diff = subparsers.add_parser('diff', help='对比两个页面的组件差异')
    p_diff.add_argument('api_base', help='API 地址')
    p_diff.add_argument('token', help='X-Access-Token')
    p_diff.add_argument('--page1', required=True, help='页面1 ID')
    p_diff.add_argument('--page2', required=True, help='页面2 ID')

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    init_api(args.api_base, args.token)

    if args.command == 'export':
        cmd_export(args)
    elif args.command == 'import':
        cmd_import(args)
    elif args.command == 'clone':
        cmd_clone(args)
    elif args.command == 'diff':
        cmd_diff(args)


if __name__ == '__main__':
    main()
