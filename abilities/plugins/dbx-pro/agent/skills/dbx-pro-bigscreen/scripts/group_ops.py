# -*- coding: utf-8 -*-
"""
大屏/仪表盘组合（JGroup）操作工具
==================================

使用方式（命令行）：

  # 查看页面所有 JGroup 及其子组件
  py group_ops.py list <API_BASE> <TOKEN> <PAGE_ID>

  # 将已有组件组合成一个 JGroup（按名称）
  py group_ops.py create <API_BASE> <TOKEN> <PAGE_ID> --names "组件A,组件B,组件C"
  py group_ops.py create <API_BASE> <TOKEN> <PAGE_ID> --ids "id1,id2,id3" --group-name "我的组合"

  # 解散 JGroup（子组件恢复为顶层组件）
  py group_ops.py ungroup <API_BASE> <TOKEN> <PAGE_ID> --name "组合名称"
  py group_ops.py ungroup <API_BASE> <TOKEN> <PAGE_ID> --id "group_id"

  # 重命名 JGroup
  py group_ops.py rename <API_BASE> <TOKEN> <PAGE_ID> --name "旧名称" --new-name "新名称"
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
# 核心操作函数
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
            comp['config'] = cfg  # bi_utils save_page 内部会 json.dumps template
    bi_utils._page_components[page_id] = tmpl
    save_page(page_id)


# ============================================================
# 命令实现
# ============================================================
def cmd_list(args):
    """列出页面所有 JGroup 及其子组件"""
    tmpl = load_template(args.page_id)

    groups = [c for c in tmpl if c.get('component') == 'JGroup']
    if not groups:
        print('页面中没有 JGroup 组合')
        return

    print(f'页面共 {len(groups)} 个 JGroup 组合：\n')
    print(f'{"序号":<4} {"组合ID":<36} {"组合名称":<20} {"位置":<12} {"尺寸":<12} {"子组件数":<8}')
    print('-' * 100)

    for i, grp in enumerate(groups):
        gid = grp.get('i', '?')
        gname = grp.get('componentName', '')
        gx, gy = grp.get('x', 0), grp.get('y', 0)
        gw, gh = grp.get('w', 0), grp.get('h', 0)
        elements = grp.get('props', {}).get('elements', [])
        print(f'{i+1:<4} {gid:<36} {gname:<20} ({gx},{gy}){"":<4} {gw}x{gh}{"":<4} {len(elements)}')

        # 列出子组件
        for j, el in enumerate(elements):
            eid = el.get('i', '?')
            etype = el.get('component', '?')
            ename = el.get('componentName', '')
            ex, ey = el.get('x', 0), el.get('y', 0)
            ew, eh = el.get('w', 0), el.get('h', 0)
            gs = el.get('groupStyle', {})
            gs_info = ''
            if gs:
                gs_info = f' [left={gs.get("left","")}, top={gs.get("top","")}, w={gs.get("width","")}, h={gs.get("height","")}]'
            prefix = '  └' if j == len(elements) - 1 else '  ├'
            print(f'{prefix}{j+1:<2} {eid:<36} {etype:<20} {ename:<20} ({ex},{ey}) {ew}x{eh}{gs_info}')

    # 统计非组合组件
    non_groups = [c for c in tmpl if c.get('component') != 'JGroup']
    if non_groups:
        print(f'\n另有 {len(non_groups)} 个独立组件（非组合）')


def cmd_create(args):
    """将已有组件组合成一个 JGroup"""
    tmpl = load_template(args.page_id)

    # 确定目标组件
    target_set_names = set()
    target_set_ids = set()
    if args.names:
        target_set_names = set(n.strip() for n in args.names.split(',') if n.strip())
    if args.ids:
        target_set_ids = set(n.strip() for n in args.ids.split(',') if n.strip())

    if not target_set_names and not target_set_ids:
        print('请通过 --names 或 --ids 指定要组合的组件')
        return

    # 分离目标组件和其他组件（名称支持模糊匹配）
    children = []
    other_comps = []
    for comp in tmpl:
        cfg = comp.get('config', {})
        if isinstance(cfg, str):
            try:
                cfg = json.loads(cfg)
            except:
                cfg = {}
            comp['config'] = cfg

        is_target = False
        if target_set_ids and comp.get('i', '') in target_set_ids:
            is_target = True
        if not is_target and target_set_names:
            cname = comp.get('componentName', '')
            # 精确匹配优先，再尝试子串模糊匹配
            if cname in target_set_names:
                is_target = True
            else:
                for keyword in target_set_names:
                    if keyword in cname or cname in keyword:
                        is_target = True
                        break

        if is_target:
            children.append(comp)
        else:
            other_comps.append(comp)

    if len(children) < 2:
        print(f'找到 {len(children)} 个匹配组件，至少需要 2 个才能组合')
        if children:
            for c in children:
                print(f'  已找到: {c.get("componentName", "")} ({c.get("component", "")})')
        return

    # 计算包围盒
    min_x = min(c['x'] for c in children)
    min_y = min(c['y'] for c in children)
    group_w = max(c['x'] + c['w'] for c in children) - min_x
    group_h = max(c['y'] + c['h'] for c in children) - min_y

    # 避免零尺寸
    if group_w <= 0:
        group_w = 1
    if group_h <= 0:
        group_h = 1

    # 计算每个子组件的 groupStyle（百分比定位）
    for child in children:
        child['groupStyle'] = {
            'config': {},
            'width':  f'{(child["w"] / group_w) * 100:.2f}%',
            'height': f'{(child["h"] / group_h) * 100:.2f}%',
            'left':   f'{((child["x"] - min_x) / group_w) * 100:.2f}%',
            'top':    f'{((child["y"] - min_y) / group_h) * 100:.2f}%',
            'transform': f'rotate({child.get("angle", 0)}deg)',
            'position': 'absolute'
        }

    # 构建 JGroup
    group_name = args.group_name or '组合'
    max_order = max((c.get('orderNum', 0) for c in tmpl), default=0)
    group_comp = {
        'i': bi_utils._gen_uuid(),
        'component': 'JGroup',
        'componentName': group_name,
        'group': True,
        'selected': False,
        'x': min_x,
        'y': min_y,
        'w': group_w,
        'h': group_h,
        'angle': 0,
        'equalProportion': False,
        'visible': True,
        'disabled': False,
        'orderNum': max_order + 1,
        'config': {'size': {}},
        'style': {},
        'props': {'elements': children}
    }

    # 重建模板（新组合置顶，索引0=最顶层）
    new_tmpl = [group_comp] + other_comps
    save_template(args.page_id, new_tmpl)

    child_names = [c.get('componentName', c.get('component', '?')) for c in children]
    print(f'组合创建成功: "{group_name}"')
    print(f'  包含 {len(children)} 个子组件: {", ".join(child_names)}')
    print(f'  位置: ({min_x}, {min_y})  尺寸: {group_w}x{group_h}')
    print(f'  组合ID: {group_comp["i"]}')


def cmd_ungroup(args):
    """解散 JGroup，子组件恢复为顶层组件"""
    tmpl = load_template(args.page_id)

    # 查找目标 JGroup（支持模糊匹配）
    target_group = None
    target_idx = None
    for idx, comp in enumerate(tmpl):
        if comp.get('component') != 'JGroup':
            continue
        if args.id and comp.get('i') == args.id:
            target_group = comp
            target_idx = idx
            break
        if args.name:
            cname = comp.get('componentName', '')
            if cname == args.name or args.name in cname or cname in args.name:
                target_group = comp
                target_idx = idx
                break

    if not target_group:
        print('未找到匹配的 JGroup')
        return

    group_x = target_group.get('x', 0)
    group_y = target_group.get('y', 0)
    group_w = target_group.get('w', 1)
    group_h = target_group.get('h', 1)
    elements = target_group.get('props', {}).get('elements', [])

    if not elements:
        print(f'JGroup "{target_group.get("componentName", "")}" 没有子组件')
        # 仍然删除空组合
        tmpl.pop(target_idx)
        save_template(args.page_id, tmpl)
        print('已删除空组合')
        return

    # 将子组件的百分比定位转换回绝对坐标
    restored_children = []
    for child in elements:
        gs = child.get('groupStyle', {})
        if gs:
            left = gs.get('left', '0%')
            top = gs.get('top', '0%')
            width = gs.get('width', '100%')
            height = gs.get('height', '100%')

            child['x'] = round(group_x + group_w * float(left.strip('%')) / 100)
            child['y'] = round(group_y + group_h * float(top.strip('%')) / 100)
            child['w'] = round(group_w * float(width.strip('%')) / 100)
            child['h'] = round(group_h * float(height.strip('%')) / 100)

            # 从 transform 恢复角度
            transform = gs.get('transform', '')
            if 'rotate(' in transform:
                try:
                    angle_str = transform.split('rotate(')[1].split('deg')[0]
                    child['angle'] = float(angle_str)
                except:
                    pass

        # 移除 groupStyle
        if 'groupStyle' in child:
            del child['groupStyle']

        restored_children.append(child)

    # 从模板中移除 JGroup，添加子组件到顶层
    tmpl.pop(target_idx)
    tmpl.extend(restored_children)

    save_template(args.page_id, tmpl)

    group_name = target_group.get('componentName', '?')
    child_names = [c.get('componentName', c.get('component', '?')) for c in restored_children]
    print(f'已解散组合: "{group_name}"')
    print(f'  恢复 {len(restored_children)} 个子组件到顶层: {", ".join(child_names)}')


def cmd_rename(args):
    """重命名 JGroup"""
    tmpl = load_template(args.page_id)

    renamed = False
    for comp in tmpl:
        if comp.get('component') != 'JGroup':
            continue
        if args.id and comp.get('i') == args.id:
            old_name = comp.get('componentName', '')
            comp['componentName'] = args.new_name
            renamed = True
            print(f'已重命名: "{old_name}" -> "{args.new_name}"')
            break
        if args.name:
            cname = comp.get('componentName', '')
            if cname == args.name or args.name in cname or cname in args.name:
                comp['componentName'] = args.new_name
                renamed = True
                print(f'已重命名: "{cname}" -> "{args.new_name}"')
                break

    if not renamed:
        print('未找到匹配的 JGroup')
        return

    save_template(args.page_id, tmpl)


# ============================================================
# CLI 入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='大屏组合（JGroup）操作工具')
    subparsers = parser.add_subparsers(dest='command', help='操作类型')

    # 通用参数
    def add_common(sub):
        sub.add_argument('api_base', help='API 地址')
        sub.add_argument('token', help='X-Access-Token')
        sub.add_argument('page_id', help='页面 ID')

    # list
    p_list = subparsers.add_parser('list', help='列出所有 JGroup 组合及其子组件')
    add_common(p_list)

    # create
    p_create = subparsers.add_parser('create', help='将已有组件组合成 JGroup')
    add_common(p_create)
    p_create.add_argument('--names', help='按组件名称选择，逗号分隔（如 "组件A,组件B,组件C"）')
    p_create.add_argument('--ids', help='按组件 ID 选择，逗号分隔（如 "id1,id2,id3"）')
    p_create.add_argument('--group-name', default=None, help='组合名称（默认: 组合）')

    # ungroup
    p_ungroup = subparsers.add_parser('ungroup', help='解散 JGroup（子组件恢复为顶层）')
    add_common(p_ungroup)
    p_ungroup.add_argument('--name', help='按组合名称匹配')
    p_ungroup.add_argument('--id', help='按组合 ID 匹配')

    # rename
    p_rename = subparsers.add_parser('rename', help='重命名 JGroup')
    add_common(p_rename)
    p_rename.add_argument('--name', help='按组合名称匹配')
    p_rename.add_argument('--id', help='按组合 ID 匹配')
    p_rename.add_argument('--new-name', required=True, help='新名称')

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    init_api(args.api_base, args.token)

    if args.command == 'list':
        cmd_list(args)
    elif args.command == 'create':
        cmd_create(args)
    elif args.command == 'ungroup':
        cmd_ungroup(args)
    elif args.command == 'rename':
        cmd_rename(args)


if __name__ == '__main__':
    main()
