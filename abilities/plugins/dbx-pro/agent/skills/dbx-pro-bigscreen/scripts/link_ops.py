# -*- coding: utf-8 -*-
"""
大屏/仪表盘组件交互配置工具（外部链接跳转 + 自定义JS脚本）
============================================================

使用方式（命令行）：

  # 查看页面所有交互配置（外部链接 + 自定义JS脚本）
  py link_ops.py show <API_BASE> <TOKEN> <PAGE_ID>

  # ==================== 外部链接跳转 ====================

  # 设置组件外部链接（按组件名称）
  py link_ops.py set <API_BASE> <TOKEN> <PAGE_ID> --name "饼图名" --url "https://www.baidu.com/s?wd=${name}&value=${value}"
  py link_ops.py set <API_BASE> <TOKEN> <PAGE_ID> --name "柱形图" --url "https://example.com/detail?category=${name}" --target "_self"

  # 设置组件外部链接（按组件类型，匹配第一个）
  py link_ops.py set <API_BASE> <TOKEN> <PAGE_ID> --type "JPie" --url "https://www.baidu.com/s?wd=${name}"

  # 设置组件外部链接（按组件 i 值）
  py link_ops.py set <API_BASE> <TOKEN> <PAGE_ID> --id "538804ec..." --url "https://www.baidu.com/s?wd=${name}"

  # 删除组件外部链接
  py link_ops.py remove <API_BASE> <TOKEN> <PAGE_ID> --name "饼图名"
  py link_ops.py remove <API_BASE> <TOKEN> <PAGE_ID> --type "JPie"

  # ==================== 自定义JS脚本 ====================
  # 参考文档：https://help.jimureport.com/biScreen/base/interactive/customJS

  # 设置自定义JS脚本（内联代码）
  py link_ops.py set-js <API_BASE> <TOKEN> <PAGE_ID> --name "基础柱形图" --js 'window.open("http://jeecg.com");return false;'

  # 设置自定义JS脚本（从文件读取，适合多行复杂脚本）
  py link_ops.py set-js <API_BASE> <TOKEN> <PAGE_ID> --type "JBar" --js-file script.js

  # 删除自定义JS脚本
  py link_ops.py remove-js <API_BASE> <TOKEN> <PAGE_ID> --name "基础柱形图"

URL 参数占位符说明（来自 ECharts 点击事件 params）：
  ${name}   - 维度名称（饼图扇区名、柱子 x 轴标签等）
  ${value}  - 数值（饼图扇区值、柱子高度等）
  ${type}   - 系列名称（多系列图表的系列标识）

打开方式（--target）：
  _blank  - 新窗口打开（默认）
  _self   - 当前窗口打开

自定义JS脚本说明：
  存储字段：config.jsConfig
  可用参数：params（点击事件数据对象）、option（ECharts图表配置，仅ECharts组件可用）
  返回值：true=继续执行后续方法（联动/跳转/钻取），false=阻断后续方法
  执行顺序：jsHandler → (return true?) → 外部链接 → 联动 → 钻取
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


def find_comp(tmpl, name=None, comp_type=None, comp_id=None):
    """按名称/类型/i值查找组件（包括 JGroup 内部），返回组件 dict 或 None"""
    def _search(comps):
        for comp in comps:
            if name and comp.get('componentName', '') == name:
                return comp
            if comp_type and comp.get('component', '') == comp_type:
                return comp
            if comp_id and comp.get('i', '') == comp_id:
                return comp
            if comp.get('component') == 'JGroup':
                result = _search(comp.get('props', {}).get('elements', []))
                if result:
                    return result
        return None
    return _search(tmpl)


def all_components(tmpl):
    """遍历所有组件（包括 JGroup 内部），yield 每个组件 dict"""
    for comp in tmpl:
        yield comp
        if comp.get('component') == 'JGroup':
            for el in comp.get('props', {}).get('elements', []):
                yield el


# ============================================================
# 命令实现
# ============================================================
def cmd_show(args):
    """显示页面所有交互配置（外部链接 + 自定义JS脚本）"""
    tmpl = load_template(args.page_id)

    found_any = False
    for comp in all_components(tmpl):
        cname = comp.get('componentName', '') or comp.get('i', '?')
        ctype = comp.get('component', '?')
        cfg = comp.get('config', {})

        link_type = cfg.get('linkType', '')
        turn_config = cfg.get('turnConfig', {})
        turn_url = turn_config.get('url', '') if isinstance(turn_config, dict) else ''
        js_config = cfg.get('jsConfig', '')

        has_link = link_type == 'url' and turn_url
        has_js = bool(js_config)

        if has_link or has_js:
            found_any = True
            print(f'组件: {cname} ({ctype})')
            if has_link:
                target = turn_config.get('type', '_blank')
                print(f'  [外部链接] {turn_url}')
                print(f'  打开方式: {target}')
            if has_js:
                # 截断过长的脚本显示
                js_preview = js_config.replace('\n', '\\n')
                if len(js_preview) > 120:
                    js_preview = js_preview[:120] + '...'
                print(f'  [自定义JS] {js_preview}')
            print()

    if not found_any:
        print('页面中没有配置外部链接或自定义JS脚本的组件。')


def cmd_set(args):
    """设置组件外部链接"""
    tmpl = load_template(args.page_id)

    comp = find_comp(tmpl, name=args.name, comp_type=args.type, comp_id=args.id)
    if not comp:
        label = args.name or args.type or args.id
        print(f'未找到组件: {label}')
        return

    cfg = comp.get('config', {})
    cfg['linkType'] = 'url'
    cfg['turnConfig'] = {
        'url': args.url,
        'type': args.target or '_blank'
    }
    comp['config'] = cfg

    cname = comp.get('componentName', '') or comp.get('i', '?')
    ctype = comp.get('component', '?')
    print(f'设置外部链接: {cname} ({ctype})')
    print(f'  链接地址: {args.url}')
    print(f'  打开方式: {cfg["turnConfig"]["type"]}')

    save_template(args.page_id, tmpl)
    print('保存成功')


def cmd_remove(args):
    """删除组件外部链接"""
    tmpl = load_template(args.page_id)

    comp = find_comp(tmpl, name=args.name, comp_type=args.type, comp_id=args.id)
    if not comp:
        label = args.name or args.type or args.id
        print(f'未找到组件: {label}')
        return

    cfg = comp.get('config', {})
    cfg['turnConfig'] = {'url': '', 'type': '_blank'}
    # linkType 保持 'url'（默认值），只清空 turnConfig.url
    comp['config'] = cfg

    cname = comp.get('componentName', '') or comp.get('i', '?')
    print(f'已清除组件 {cname} 的外部链接')

    save_template(args.page_id, tmpl)
    print('保存成功')


def cmd_set_js(args):
    """设置组件自定义JS脚本"""
    tmpl = load_template(args.page_id)

    comp = find_comp(tmpl, name=args.name, comp_type=args.type, comp_id=args.id)
    if not comp:
        label = args.name or args.type or args.id
        print(f'未找到组件: {label}')
        return

    # 获取JS代码：从文件或命令行参数
    if args.js_file:
        with open(args.js_file, 'r', encoding='utf-8') as f:
            js_code = f.read()
    elif args.js:
        js_code = args.js
    else:
        print('错误：必须提供 --js 或 --js-file 参数')
        return

    cfg = comp.get('config', {})
    cfg['jsConfig'] = js_code
    comp['config'] = cfg

    cname = comp.get('componentName', '') or comp.get('i', '?')
    ctype = comp.get('component', '?')
    js_preview = js_code.replace('\n', '\\n')
    if len(js_preview) > 120:
        js_preview = js_preview[:120] + '...'
    print(f'设置自定义JS: {cname} ({ctype})')
    print(f'  脚本内容: {js_preview}')

    save_template(args.page_id, tmpl)
    print('保存成功')


def cmd_remove_js(args):
    """删除组件自定义JS脚本"""
    tmpl = load_template(args.page_id)

    comp = find_comp(tmpl, name=args.name, comp_type=args.type, comp_id=args.id)
    if not comp:
        label = args.name or args.type or args.id
        print(f'未找到组件: {label}')
        return

    cfg = comp.get('config', {})
    cfg['jsConfig'] = ''
    comp['config'] = cfg

    cname = comp.get('componentName', '') or comp.get('i', '?')
    print(f'已清除组件 {cname} 的自定义JS脚本')

    save_template(args.page_id, tmpl)
    print('保存成功')


# ============================================================
# CLI 入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='大屏组件外部链接跳转配置工具')
    subparsers = parser.add_subparsers(dest='command', help='操作类型')

    # 通用参数
    def add_common(sub):
        sub.add_argument('api_base', help='API 地址')
        sub.add_argument('token', help='X-Access-Token')
        sub.add_argument('page_id', help='页面 ID')

    # 组件定位参数（三选一）
    def add_selector(sub):
        g = sub.add_mutually_exclusive_group(required=True)
        g.add_argument('--name', help='组件名称（componentName）')
        g.add_argument('--type', help='组件类型（如 JPie, JBar）')
        g.add_argument('--id', help='组件 i 值')

    # show
    p_show = subparsers.add_parser('show', help='查看所有外部链接配置')
    add_common(p_show)

    # set
    p_set = subparsers.add_parser('set', help='设置外部链接')
    add_common(p_set)
    add_selector(p_set)
    p_set.add_argument('--url', required=True,
                        help='跳转 URL，支持 ${name}/${value}/${type} 占位符')
    p_set.add_argument('--target', default='_blank', choices=['_blank', '_self'],
                        help='打开方式（默认 _blank 新窗口）')

    # remove
    p_remove = subparsers.add_parser('remove', help='删除外部链接')
    add_common(p_remove)
    add_selector(p_remove)

    # set-js
    p_set_js = subparsers.add_parser('set-js', help='设置自定义JS脚本')
    add_common(p_set_js)
    add_selector(p_set_js)
    js_group = p_set_js.add_mutually_exclusive_group(required=True)
    js_group.add_argument('--js', help='JS脚本代码（内联）')
    js_group.add_argument('--js-file', help='从文件读取JS脚本代码')

    # remove-js
    p_remove_js = subparsers.add_parser('remove-js', help='删除自定义JS脚本')
    add_common(p_remove_js)
    add_selector(p_remove_js)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    init_api(args.api_base, args.token)

    if args.command == 'show':
        cmd_show(args)
    elif args.command == 'set':
        cmd_set(args)
    elif args.command == 'remove':
        cmd_remove(args)
    elif args.command == 'set-js':
        cmd_set_js(args)
    elif args.command == 'remove-js':
        cmd_remove_js(args)


if __name__ == '__main__':
    main()
