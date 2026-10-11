# -*- coding: utf-8 -*-
"""
大屏模板操作工具 —— 列表、预览、搜索、复制
=============================================

使用方式（命令行）：

  # 列出所有可用模板
  py template_ops.py list

  # 预览模板结构
  py template_ops.py preview --template "集团综合数据大屏_1151069555267260416.json"

  # 搜索模板（按文件名和组件名称）
  py template_ops.py search --keyword "销售"

  # 从模板创建新大屏页面（基础）
  py template_ops.py copy <API_BASE> <TOKEN> --template "xxx.json" --name "新大屏名称"

  # 从模板创建 + 文本替换 + JGroup标题 + 轮播表数据（一步完成，无需编写脚本）
  py template_ops.py copy <API_BASE> <TOKEN> --template "xxx.json" --name "新大屏名称" --bg-image "/img/bg/bg4.png" --replace '{"旧文本":"新文本","旧标题":"新标题"}' --group-titles "标题1,标题2,标题3" --board-data '{"header":["列1","列2"],"data":[["值1","值2"]]}'
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

# 模板目录（按优先级查找：脚本相对路径 → skills 固定路径）
def _find_template_dir():
    candidates = [
        os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'templates', 'bigScreen')),
    ]
    for d in candidates:
        if os.path.isdir(d):
            return d
    return candidates[0]  # fallback

TEMPLATE_DIR = _find_template_dir()


# ============================================================
# 辅助函数
# ============================================================
def _get_template_files():
    """扫描模板目录，返回所有 JSON 文件路径列表"""
    if not os.path.isdir(TEMPLATE_DIR):
        print(f'模板目录不存在: {TEMPLATE_DIR}')
        return []
    files = [f for f in os.listdir(TEMPLATE_DIR) if f.endswith('.json')]
    files.sort()
    return files


def _load_template_json(filename):
    """读取模板 JSON 文件，返回解析后的 dict"""
    tpl_path = os.path.join(TEMPLATE_DIR, filename)
    with open(tpl_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def _get_components(tpl_data):
    """从模板数据中提取组件列表"""
    tmpl = tpl_data.get('template', [])
    if isinstance(tmpl, str):
        tmpl = json.loads(tmpl)
    return tmpl


# ============================================================
# 命令实现
# ============================================================
def cmd_list(args):
    """列出所有可用模板"""
    files = _get_template_files()
    if not files:
        print('未找到任何模板文件')
        return

    print(f'模板目录: {TEMPLATE_DIR}')
    print(f'共 {len(files)} 个模板：\n')
    print(f'{"序号":<4} {"文件名":<60} {"组件数"}')
    print('-' * 80)
    for i, fname in enumerate(files):
        try:
            tpl_data = _load_template_json(fname)
            components = _get_components(tpl_data)
            count = len(components)
        except Exception as e:
            count = f'读取失败: {e}'
        print(f'{i+1:<4} {fname:<60} {count}')


def cmd_preview(args):
    """预览模板结构"""
    tpl_path = os.path.join(TEMPLATE_DIR, args.template)
    if not os.path.exists(tpl_path):
        print(f'模板文件不存在: {tpl_path}')
        return

    tpl_data = _load_template_json(args.template)
    components = _get_components(tpl_data)

    print(f'模板: {args.template}')
    print(f'组件总数: {len(components)}\n')
    print(f'{"序号":<4} {"类型":<20} {"名称":<24} {"位置":<12} {"尺寸":<12}')
    print('-' * 80)
    for i, comp in enumerate(components):
        ctype = comp.get('component', '?')
        cname = comp.get('componentName', '')
        x, y = comp.get('x', 0), comp.get('y', 0)
        w, h = comp.get('w', 0), comp.get('h', 0)
        print(f'{i+1:<4} {ctype:<20} {cname:<24} ({x},{y}){"":<4} {w}x{h}')
        # JGroup 内部组件
        if ctype == 'JGroup':
            elements = comp.get('props', {}).get('elements', [])
            for j, el in enumerate(elements):
                etype = el.get('component', '?')
                ename = el.get('componentName', '')
                ex, ey = el.get('x', 0), el.get('y', 0)
                ew, eh = el.get('w', 0), el.get('h', 0)
                print(f'  └{j+1:<2} {etype:<20} {ename:<24} ({ex},{ey}){"":<4} {ew}x{eh}')


def cmd_search(args):
    """搜索模板"""
    keyword = args.keyword.lower()
    files = _get_template_files()
    if not files:
        print('未找到任何模板文件')
        return

    results = []
    for fname in files:
        matched_in_name = keyword in fname.lower()
        matched_comps = []
        try:
            tpl_data = _load_template_json(fname)
            components = _get_components(tpl_data)
            for comp in components:
                cname = comp.get('componentName', '')
                if keyword in cname.lower():
                    matched_comps.append(cname)
                # 检查 JGroup 内部
                if comp.get('component') == 'JGroup':
                    for el in comp.get('props', {}).get('elements', []):
                        ename = el.get('componentName', '')
                        if keyword in ename.lower():
                            matched_comps.append(ename)
        except Exception:
            pass

        if matched_in_name or matched_comps:
            results.append((fname, matched_in_name, matched_comps))

    if not results:
        print(f'未找到包含 "{args.keyword}" 的模板')
        return

    print(f'搜索关键词: "{args.keyword}"，共匹配 {len(results)} 个模板：\n')
    for fname, in_name, comps in results:
        markers = []
        if in_name:
            markers.append('文件名匹配')
        if comps:
            markers.append(f'{len(comps)} 个组件匹配')
        print(f'  {fname}  [{", ".join(markers)}]')
        for cname in comps:
            print(f'    - {cname}')


def cmd_copy(args):
    """从模板复制创建新大屏"""
    import bi_utils
    from bi_utils import init_api, create_page, save_page

    init_api(args.api_base, args.token)

    tpl_path = os.path.join(TEMPLATE_DIR, args.template)
    if not os.path.exists(tpl_path):
        print(f'模板文件不存在: {tpl_path}')
        return

    # 1. 读取模板 JSON
    with open(tpl_path, 'r', encoding='utf-8') as f:
        tpl_data = json.load(f)
    template_components = tpl_data.get('template', [])
    if isinstance(template_components, str):
        template_components = json.loads(template_components)

    if not template_components:
        print('模板中无组件数据')
        return

    print(f'模板: {args.template}，共 {len(template_components)} 个组件')

    # 2. Build old ID -> new ID mapping
    id_mapping = {}
    for comp in template_components:
        old_i = comp['i']
        id_mapping[old_i] = bi_utils._gen_uuid()

    # 3. Update component IDs and clean up
    for comp in template_components:
        comp['i'] = id_mapping[comp['i']]
        comp.pop('pageCompId', None)
        config = comp.get('config', {})
        if isinstance(config, str):
            try:
                config = json.loads(config)
            except:
                config = {}
        comp['config'] = config

    # 4. Update JTabToggle compVals references
    for comp in template_components:
        if comp['component'] == 'JTabToggle':
            for item in comp['config'].get('option', {}).get('items', []):
                item['compVals'] = [id_mapping.get(v, v) for v in item.get('compVals', [])]

    # 5. Update JGroup props.elements IDs
    for comp in template_components:
        if comp['component'] == 'JGroup':
            props = comp.get('props', {})
            elements = props.get('elements', [])
            if elements:
                el_str = json.dumps(elements, ensure_ascii=False)
                for old_id, new_id in id_mapping.items():
                    el_str = el_str.replace(old_id, new_id)
                props['elements'] = json.loads(el_str)

    # 6. Text replacements (--replace JSON)
    if args.replace:
        try:
            replacements = json.loads(args.replace)
        except json.JSONDecodeError:
            print(f'--replace JSON 解析失败: {args.replace}')
            return
        if isinstance(replacements, dict) and replacements:
            tpl_str = json.dumps(template_components, ensure_ascii=False)
            for old_text, new_text in replacements.items():
                tpl_str = tpl_str.replace(old_text, new_text)
            template_components = json.loads(tpl_str)
            print(f'文本替换: {len(replacements)} 项')

    # 7. Update JGroup titles (--group-titles comma-separated)
    if args.group_titles:
        titles = [t.strip() for t in args.group_titles.split(',') if t.strip()]
        gi = 0
        for comp in template_components:
            if comp.get('component') == 'JGroup' and gi < len(titles):
                for el in comp.get('props', {}).get('elements', []):
                    if el.get('component') == 'JText':
                        cfg = el.get('config', {})
                        if isinstance(cfg, str):
                            try: cfg = json.loads(cfg)
                            except: cfg = {}
                        cd = cfg.get('chartData', '')
                        if isinstance(cd, str):
                            try: cd = json.loads(cd)
                            except: cd = {}
                        if isinstance(cd, dict):
                            cd['value'] = titles[gi]
                            cfg['chartData'] = json.dumps(cd, ensure_ascii=False)
                        el['config'] = cfg
                gi += 1
        print(f'JGroup 标题更新: {min(gi, len(titles))} 个')

    # 8. Update JScrollBoard data (--board-data JSON)
    if args.board_data:
        try:
            board_data = json.loads(args.board_data)
        except json.JSONDecodeError:
            print(f'--board-data JSON 解析失败')
            board_data = None
        if board_data:
            for comp in template_components:
                if comp.get('component') == 'JScrollBoard':
                    cfg = comp.get('config', {})
                    if isinstance(cfg, str):
                        try: cfg = json.loads(cfg)
                        except: cfg = {}
                    cfg['chartData'] = json.dumps(board_data, ensure_ascii=False)
                    comp['config'] = cfg
            print(f'JScrollBoard 数据已更新')

    # 9. Boundary check (1920x1080)
    SCREEN_W, SCREEN_H = 1920, 1080
    max_bottom = max(c['y'] + c['h'] for c in template_components)
    if max_bottom > SCREEN_H:
        candidates = [c['y'] for c in template_components if c['y'] >= 150]
        content_min_y = min(candidates) if candidates else min(c['y'] for c in template_components)
        scale_y = (SCREEN_H - content_min_y) / (max_bottom - content_min_y)
        for comp in template_components:
            if comp['y'] >= content_min_y:
                comp['y'] = round(content_min_y + (comp['y'] - content_min_y) * scale_y)
                comp['h'] = round(comp['h'] * scale_y)
                cfg = comp.get('config', {})
                if isinstance(cfg, dict):
                    cfg['h'] = comp['h']
                    if 'size' in cfg:
                        cfg['size']['height'] = comp['h']
        print(f'边界修正: 原始底边 {max_bottom}px → 缩放至 1080px 内')

    # 10. Create page and save
    name = args.name
    bg_image = args.bg_image
    # Fix Git Bash path conversion: /img/bg/bg4.png → C:/Program Files/Git/img/bg/bg4.png
    if bg_image and ('Program Files/Git/' in bg_image or 'Program Files\\Git\\' in bg_image):
        bg_image = '/' + bg_image.split('Git/', 1)[-1].split('Git\\', 1)[-1]
    page_id = create_page(name, style='bigScreen', theme='dark', background_image=bg_image)
    # Fix: create_page 后立即 query 获取最新的 updateCount，避免乐观锁冲突
    _raw = bi_utils._request('GET', '/drag/page/queryById', params={'id': page_id})
    _p = (_raw.get('result') or {})
    bi_utils._page_info[page_id]['updateCount'] = _p.get('updateCount', 1)
    bi_utils._page_components[page_id] = template_components
    save_page(page_id)

    print(f'创建成功！')
    print(f'  页面名称: {name}')
    print(f'  页面 ID: {page_id}')
    print(f'  组件数量: {len(template_components)}')
    if bg_image:
        print(f'  背景图片: {bg_image}')
    print(f'  预览地址: {args.api_base}/drag/share/view/{page_id}?token={args.token}&tenantId=2')


# ============================================================
# CLI 入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='大屏模板操作工具')
    subparsers = parser.add_subparsers(dest='command', help='操作类型')

    # list - 列出所有模板（无需 api_base/token）
    subparsers.add_parser('list', help='列出所有可用模板')

    # preview - 预览模板结构（无需 api_base/token）
    p_preview = subparsers.add_parser('preview', help='预览模板结构')
    p_preview.add_argument('--template', required=True, help='模板文件名（如 xxx.json）')

    # search - 搜索模板（无需 api_base/token）
    p_search = subparsers.add_parser('search', help='按关键词搜索模板')
    p_search.add_argument('--keyword', required=True, help='搜索关键词（匹配文件名和组件名称）')

    # copy - 从模板创建新页面（需要 api_base/token）
    p_copy = subparsers.add_parser('copy', help='从模板复制创建新大屏')
    p_copy.add_argument('api_base', help='API 地址')
    p_copy.add_argument('token', help='X-Access-Token')
    p_copy.add_argument('--template', required=True, help='模板文件名（如 xxx.json）')
    p_copy.add_argument('--name', required=True, help='新大屏名称')
    p_copy.add_argument('--bg-image', default=None, help='背景图片路径（如 /img/bg/bg4.png）')
    p_copy.add_argument('--replace', default=None, help='文本替换 JSON（如 \'{"旧文本":"新文本"}\'）')
    p_copy.add_argument('--group-titles', default=None, help='JGroup 标题列表（逗号分隔，如 "标题1,标题2,标题3"）')
    p_copy.add_argument('--board-data', default=None, help='JScrollBoard 数据 JSON（如 \'{"header":[...],"data":[...]}\'）')

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    if args.command == 'list':
        cmd_list(args)
    elif args.command == 'preview':
        cmd_preview(args)
    elif args.command == 'search':
        cmd_search(args)
    elif args.command == 'copy':
        cmd_copy(args)


if __name__ == '__main__':
    main()
