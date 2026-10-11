# -*- coding: utf-8 -*-
"""
大屏/仪表盘页面级配置操作工具
================================

使用方式（命令行）：

  # 查看页面信息
  py page_ops.py info <API_BASE> <TOKEN> <PAGE_ID>

  # 设置背景颜色
  py page_ops.py set-bg <API_BASE> <TOKEN> <PAGE_ID> --color "#1E90FF"

  # 设置背景图片
  py page_ops.py set-bgimg <API_BASE> <TOKEN> <PAGE_ID> --image "/img/bg/bg5.png"

  # 设置主题
  py page_ops.py set-theme <API_BASE> <TOKEN> <PAGE_ID> --theme dark

  # 配置水印
  py page_ops.py watermark <API_BASE> <TOKEN> <PAGE_ID> --show true --content "内部文档" --font-size 14 --color "#ffffff80" --angle 30

  # 重命名页面
  py page_ops.py rename <API_BASE> <TOKEN> <PAGE_ID> --name "新名称"

  # 标记/取消模板
  py page_ops.py set-template <API_BASE> <TOKEN> <PAGE_ID> --flag 1   # 1=设为模板, 0=取消

  # 删除页面
  py page_ops.py delete <API_BASE> <TOKEN> <PAGE_ID>
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
from bi_utils import init_api


# ============================================================
# 可用背景图片列表
# ============================================================
AVAILABLE_BG_IMAGES = [
    '/img/bg/defbg.png',
    '/img/bg/bg1.png',
    '/img/bg/bg2.png',
    '/img/bg/bg3.png',
    '/img/bg/bg4.png',
    '/img/bg/bg5.png',
    '/img/bg/bg6.png',
    '/img/bg/bg7.png',
    '/img/bg/bg8.png',
    '/img/bg/bg10.png',
    '/img/bg/bg12.png',
    '/img/bg/bg18.jpg',
]


# ============================================================
# 页面实体读写
# ============================================================
def load_page_entity(page_id):
    """读取完整的页面实体"""
    result = bi_utils._request('GET', '/drag/page/queryById', params={'id': page_id})
    if not result.get('success'):
        raise Exception(f"查询页面失败: {result.get('message')}")
    return result.get('result', {})


def save_page_entity(page_entity):
    """保存完整的页面实体（保留所有字段）"""
    result = bi_utils._request('POST', '/drag/page/edit', data=page_entity)
    if not result.get('success'):
        raise Exception(f"保存页面失败: {result.get('message')}")
    print('页面保存成功')
    return result


def parse_des_json(page_entity):
    """解析 desJson 字段，返回 dict"""
    raw = page_entity.get('desJson', '')
    if not raw or not isinstance(raw, str):
        return {}
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return {}


def serialize_des_json(des_dict):
    """将 dict 序列化回 desJson 字符串"""
    return json.dumps(des_dict, ensure_ascii=False)


# ============================================================
# 命令实现
# ============================================================
def cmd_info(args):
    """显示页面信息"""
    page = load_page_entity(args.page_id)

    name = page.get('name', '')
    style = page.get('style', '')
    theme = page.get('theme', '')
    bg_color = page.get('backgroundColor', '')
    bg_image = page.get('backgroundImage', '')
    update_count = page.get('updateCount', 0)

    # 解析 template 获取组件数量
    template = page.get('template', '[]')
    if isinstance(template, str):
        try:
            template = json.loads(template)
        except:
            template = []
    comp_count = len(template) if isinstance(template, list) else 0

    # 解析 desJson 获取水印信息
    des = parse_des_json(page)
    watermark = des.get('waterMark', {})

    print(f'页面信息')
    print(f'{"=" * 50}')
    print(f'  名称:       {name}')
    print(f'  风格:       {style}')
    print(f'  主题:       {theme}')
    print(f'  背景颜色:   {bg_color or "(未设置)"}')
    print(f'  背景图片:   {bg_image or "(未设置)"}')
    print(f'  更新次数:   {update_count}')
    print(f'  组件数量:   {comp_count}')

    if des:
        print(f'\n  画布尺寸:   {des.get("width", "?")} x {des.get("height", "?")}')

    if watermark:
        print(f'\n  水印配置:')
        print(f'    显示:     {watermark.get("show", False)}')
        print(f'    内容:     {watermark.get("content", "")}')
        print(f'    字号:     {watermark.get("fontSize", "")}')
        print(f'    颜色:     {watermark.get("color", "")}')
        print(f'    角度:     {watermark.get("angle", "")}')
    else:
        print(f'\n  水印:       (未配置)')


def cmd_set_bg(args):
    """设置背景颜色"""
    page = load_page_entity(args.page_id)
    old_color = page.get('backgroundColor', '')
    page['backgroundColor'] = args.color
    save_page_entity(page)
    print(f'背景颜色: {old_color or "(空)"} → {args.color}')


def cmd_set_bgimg(args):
    """设置背景图片"""
    if args.image not in AVAILABLE_BG_IMAGES:
        print(f'警告: "{args.image}" 不在已知背景图列表中，仍将设置。')
        print(f'可用背景图:')
        for img in AVAILABLE_BG_IMAGES:
            print(f'  {img}')

    image = args.image
    # Fix Git Bash path conversion: /img/bg/bg4.png → C:/Program Files/Git/img/bg/bg4.png
    if image and ('Program Files/Git/' in image or 'Program Files\\Git\\' in image):
        image = '/' + image.split('Git/', 1)[-1].split('Git\\', 1)[-1]

    page = load_page_entity(args.page_id)
    old_image = page.get('backgroundImage', '')
    page['backgroundImage'] = image
    save_page_entity(page)
    print(f'背景图片: {old_image or "(空)"} → {args.image}')


def cmd_set_theme(args):
    """设置主题"""
    valid_themes = ('dark', 'light', 'default')
    if args.theme not in valid_themes:
        print(f'无效主题: {args.theme}，可选值: {", ".join(valid_themes)}')
        return

    page = load_page_entity(args.page_id)
    old_theme = page.get('theme', '')
    page['theme'] = args.theme
    save_page_entity(page)
    print(f'主题: {old_theme or "(空)"} → {args.theme}')


def cmd_watermark(args):
    """配置水印"""
    page = load_page_entity(args.page_id)
    des = parse_des_json(page)

    # 确保 waterMark 字段存在
    if 'waterMark' not in des:
        des['waterMark'] = {
            'show': False,
            'content': '',
            'fontSize': 12,
            'color': '#ffffff',
            'angle': 45,
        }

    wm = des['waterMark']
    changes = []

    if args.show is not None:
        val = args.show.lower() in ('true', '1', 'yes')
        wm['show'] = val
        changes.append(f'显示={val}')

    if args.content is not None:
        wm['content'] = args.content
        changes.append(f'内容="{args.content}"')

    if args.font_size is not None:
        wm['fontSize'] = args.font_size
        changes.append(f'字号={args.font_size}')

    if args.color is not None:
        wm['color'] = args.color
        changes.append(f'颜色={args.color}')

    if args.angle is not None:
        wm['angle'] = args.angle
        changes.append(f'角度={args.angle}')

    if not changes:
        print('未指定任何水印参数，请使用 --show, --content, --font-size, --color, --angle')
        return

    page['desJson'] = serialize_des_json(des)
    save_page_entity(page)
    print(f'水印配置已更新: {", ".join(changes)}')


def cmd_rename(args):
    """重命名页面"""
    page = load_page_entity(args.page_id)
    old_name = page.get('name', '')
    page['name'] = args.name
    save_page_entity(page)
    print(f'页面重命名: "{old_name}" → "{args.name}"')


def cmd_set_template(args):
    """标记/取消页面为模板（izTemplate 字段）

    后端 /drag/page/edit 是 MyBatis Plus updateById 语义，只传 {id, izTemplate}
    就能单字段更新，无需回传 template/style/theme 等全字段。
    """
    result = bi_utils._request('POST', '/drag/page/edit',
                               data={'id': args.page_id, 'izTemplate': args.flag})
    if not result.get('success'):
        print(f'设置失败: {result.get("message", "未知错误")}')
        return
    action = '设为模板' if args.flag == 1 else '取消模板'
    print(f'{action}成功: {args.page_id} (izTemplate={args.flag})')


def cmd_delete(args):
    """删除页面"""
    result = bi_utils._request('DELETE', '/drag/page/delete', params={'id': args.page_id})
    if result.get('success'):
        print(f'页面已删除: {args.page_id}')
    else:
        print(f'删除失败: {result.get("message", "未知错误")}')


# ============================================================
# CLI 入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='大屏/仪表盘页面配置工具')
    subparsers = parser.add_subparsers(dest='command', help='操作类型')

    # 通用参数
    def add_common(sub):
        sub.add_argument('api_base', help='API 地址')
        sub.add_argument('token', help='X-Access-Token')
        sub.add_argument('page_id', help='页面 ID')

    # info
    p_info = subparsers.add_parser('info', help='查看页面信息')
    add_common(p_info)

    # set-bg
    p_bg = subparsers.add_parser('set-bg', help='设置背景颜色')
    add_common(p_bg)
    p_bg.add_argument('--color', required=True, help='背景颜色，如 "#1E90FF"')

    # set-bgimg
    p_bgimg = subparsers.add_parser('set-bgimg', help='设置背景图片')
    add_common(p_bgimg)
    p_bgimg.add_argument('--image', required=True,
                         help='背景图片路径，如 "/img/bg/bg5.png"')

    # set-theme
    p_theme = subparsers.add_parser('set-theme', help='设置主题')
    add_common(p_theme)
    p_theme.add_argument('--theme', required=True, choices=['dark', 'light', 'default'],
                         help='主题: dark, light, default')

    # watermark
    p_wm = subparsers.add_parser('watermark', help='配置水印')
    add_common(p_wm)
    p_wm.add_argument('--show', default=None, help='是否显示水印: true/false')
    p_wm.add_argument('--content', default=None, help='水印文字内容')
    p_wm.add_argument('--font-size', type=int, default=None, help='水印字号')
    p_wm.add_argument('--color', default=None, help='水印颜色，如 "#ffffff"')
    p_wm.add_argument('--angle', type=int, default=None, help='水印旋转角度')

    # rename
    p_rename = subparsers.add_parser('rename', help='重命名页面')
    add_common(p_rename)
    p_rename.add_argument('--name', required=True, help='新页面名称')

    # set-template
    p_tpl = subparsers.add_parser('set-template', help='标记/取消模板')
    add_common(p_tpl)
    p_tpl.add_argument('--flag', type=int, required=True, choices=[0, 1],
                       help='1=设为模板, 0=取消模板')

    # delete
    p_delete = subparsers.add_parser('delete', help='删除页面')
    add_common(p_delete)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    init_api(args.api_base, args.token)

    if args.command == 'info':
        cmd_info(args)
    elif args.command == 'set-bg':
        cmd_set_bg(args)
    elif args.command == 'set-bgimg':
        cmd_set_bgimg(args)
    elif args.command == 'set-theme':
        cmd_set_theme(args)
    elif args.command == 'watermark':
        cmd_watermark(args)
    elif args.command == 'rename':
        cmd_rename(args)
    elif args.command == 'set-template':
        cmd_set_template(args)
    elif args.command == 'delete':
        cmd_delete(args)


if __name__ == '__main__':
    main()
