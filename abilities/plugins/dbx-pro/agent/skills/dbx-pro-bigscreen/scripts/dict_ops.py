# -*- coding: utf-8 -*-
"""
积木报表字典操作工具（jimu_dict）—— 增、删、查、绑定
=====================================================

注意：本工具操作的是 jimu_dict（/jmreport/dict/*），不是 sys_dict（/sys/dict/*）。

⚠️ dictCode 一旦用过就永久占用：
    /jmreport/dict/delete 只做逻辑删除（del_flag=1），但 /jmreport/dict/add 的
    唯一性校验不过滤 del_flag 也不区分 tenant——历史软删/跨租户记录都会让
    新 add 返回 "字典编码已存在！"。所以同一个 code 删了不能再 add 回来。
    典型表现：add → delete → add(同 code) → 400 编码已存在。
    解决：换个新 code（如 sex → gender → gender2），或直接清库
    `DELETE FROM jimu_dict WHERE dict_code = 'xxx'`（需 DB 权限，非本 skill 范畴）。

使用方式（命令行）：

  # 列出所有字典
  py dict_ops.py list <API_BASE> <TOKEN>

  # 查看字典项
  py dict_ops.py items <API_BASE> <TOKEN> --code "sexnew"

  # 创建字典及字典项
  py dict_ops.py create <API_BASE> <TOKEN> --name "性别新" --code "sexnew" --desc "性别字典" --items "1=男性,2=女性,0=其他"

  # 给已有字典添加字典项
  py dict_ops.py add-item <API_BASE> <TOKEN> --code "sexnew" --value "3" --text "未知" --sort 4

  # 删除字典
  py dict_ops.py delete <API_BASE> <TOKEN> --code "sexnew"
  py dict_ops.py delete <API_BASE> <TOKEN> --id "dict_id"

  # 绑定字典到数据集字段
  py dict_ops.py bind <API_BASE> <TOKEN> --dataset-id "xxx" --field "name" --dict-code "sexnew"
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
from bi_utils import init_api


# ============================================================
# 辅助函数
# ============================================================
def _query_dict_by_code(code):
    """按 dictCode 查询字典，返回字典记录或 None"""
    result = bi_utils._request('GET', '/jmreport/dict/list', params={
        'dictCode': code,
        'pageNo': 1,
        'pageSize': 10,
    })
    records = result.get('result', {}).get('records', [])
    if records:
        return records[0]
    return None


def _query_dict_by_id(dict_id):
    """按 ID 查询字典，返回字典记录或 None"""
    result = bi_utils._request('GET', '/jmreport/dict/list', params={
        'id': dict_id,
        'pageNo': 1,
        'pageSize': 10,
    })
    records = result.get('result', {}).get('records', [])
    if records:
        return records[0]
    return None


def _get_dict_items(dict_id):
    """获取字典的所有字典项

    /jmreport/dictItem/list 返回 IPage：result = {records, total, pageNo, ...}
    取 result.records 才是字典项数组；老版本代码直接 `result.get('result', [])`
    会把 IPage dict 当 list，迭代出 key 字符串，后续 item['id'] 报 TypeError。
    """
    result = bi_utils._request('GET', '/jmreport/dictItem/list', params={
        'dictId': dict_id,
        'pageSize': 500,
    })
    page = result.get('result') or {}
    return page.get('records', []) or []


# ============================================================
# 命令实现
# ============================================================
def cmd_list(args):
    """列出所有字典"""
    result = bi_utils._request('GET', '/jmreport/dict/list', params={
        'pageNo': 1,
        'pageSize': 50,
    })
    if not result.get('success', True):
        print(f'查询失败: {result.get("message", "")}')
        return

    data = result.get('result', {})
    records = data.get('records', [])
    total = data.get('total', 0)

    print(f'共 {total} 个字典（当前显示 {len(records)} 个）：\n')
    print(f'{"序号":<4} {"ID":<24} {"编码":<20} {"名称":<20} {"描述":<30}')
    print('-' * 110)
    for i, rec in enumerate(records):
        did = rec.get('id', '?')
        code = rec.get('dictCode', '')
        name = rec.get('dictName', '')
        desc = rec.get('description', '') or ''
        print(f'{i+1:<4} {did:<24} {code:<20} {name:<20} {desc:<30}')


def cmd_items(args):
    """查看字典项"""
    # 先按 code 查找字典
    dict_rec = _query_dict_by_code(args.code)
    if not dict_rec:
        print(f'未找到字典: {args.code}')
        return

    dict_id = dict_rec['id']
    dict_name = dict_rec.get('dictName', '')
    print(f'字典: {dict_name} (编码: {args.code}, ID: {dict_id})\n')

    items = _get_dict_items(dict_id)
    if not items:
        print('（暂无字典项）')
        return

    print(f'{"序号":<4} {"ID":<24} {"值":<15} {"文本":<20} {"排序":<6} {"状态":<6}')
    print('-' * 80)
    for i, item in enumerate(items):
        iid = item.get('id', '?')
        val = item.get('itemValue', '')
        text = item.get('itemText', '')
        sort = item.get('sortOrder', '')
        status = item.get('status', '')
        print(f'{i+1:<4} {iid:<24} {val:<15} {text:<20} {sort:<6} {status:<6}')


def cmd_create(args):
    """创建字典及字典项"""
    # 1. 检查字典是否已存在
    dict_rec = _query_dict_by_code(args.code)
    if dict_rec:
        print(f'字典 {args.code} 已存在 (ID: {dict_rec["id"]})')
        dict_id = dict_rec['id']
    else:
        # 2. 创建字典（/jmreport/dict/add 返回 result=null，需要重新查询获取 ID）
        #    必须检查 success — 后端会在 dictCode 冲突时返回
        #    {success:false, message:"字典编码已存在！"}。不检查会把真实错因
        #    伪装成后续的"查询不到"，让人误判为查询侧 bug。
        #    注意：唯一性校验不过滤 del_flag / tenant — 历史软删/跨租户记录
        #    也会占住 code，此时需改用新 code（或清库）。
        add_resp = bi_utils._request('POST', '/jmreport/dict/add', data={
            'dictName': args.name,
            'dictCode': args.code,
            'description': args.desc or '',
        })
        if not add_resp.get('success'):
            print(f'创建字典失败: {add_resp.get("message", "未知错误")}')
            return

        # 重新查询获取字典 ID
        dict_rec = _query_dict_by_code(args.code)
        if not dict_rec:
            print(f'创建字典失败: 创建后无法查询到 {args.code}')
            return

        dict_id = dict_rec['id']
        print(f'字典创建成功: {args.name} (编码: {args.code}, ID: {dict_id})')

    # 3. 创建字典项
    if not args.items:
        print('未指定字典项，跳过')
        return

    for i, pair in enumerate(args.items.split(',')):
        pair = pair.strip()
        if '=' not in pair:
            print(f'警告: 忽略无效字典项定义 "{pair}"（需要 value=text 格式）')
            continue

        value, text = pair.split('=', 1)
        bi_utils._request('POST', '/jmreport/dictItem/add', data={
            'dictId': dict_id,
            'itemText': text.strip(),
            'itemValue': value.strip(),
            'sortOrder': i + 1,
            'status': 1,
        })
        print(f'  添加字典项: {value.strip()} = {text.strip()} (排序: {i+1})')

    print(f'字典创建完成，共 {len(args.items.split(","))} 个字典项')


def cmd_add_item(args):
    """给已有字典添加字典项"""
    # 查找字典
    dict_rec = _query_dict_by_code(args.code)
    if not dict_rec:
        print(f'未找到字典: {args.code}')
        return

    dict_id = dict_rec['id']

    bi_utils._request('POST', '/jmreport/dictItem/add', data={
        'dictId': dict_id,
        'itemText': args.text,
        'itemValue': str(args.value),
        'sortOrder': args.sort if args.sort is not None else 0,
        'status': 1,
    })

    print(f'字典项添加成功:')
    print(f'  字典: {dict_rec.get("dictName", "")} ({args.code})')
    print(f'  值: {args.value} = {args.text} (排序: {args.sort})')


def cmd_delete(args):
    """删除字典"""
    dict_rec = None
    if args.code:
        dict_rec = _query_dict_by_code(args.code)
        if not dict_rec:
            print(f'未找到字典: {args.code}')
            return
    elif args.id:
        dict_rec = _query_dict_by_id(args.id)
        if not dict_rec:
            # 即使查不到详情，也尝试用 ID 删除
            dict_rec = {'id': args.id, 'dictName': '?', 'dictCode': '?'}
    else:
        print('错误: 必须指定 --code 或 --id')
        return

    dict_id = dict_rec['id']

    # 先删除所有字典项
    items = _get_dict_items(dict_id)
    for item in items:
        bi_utils._request('DELETE', '/jmreport/dictItem/delete', params={'id': item['id']})

    if items:
        print(f'已删除 {len(items)} 个字典项')

    # 删除字典本身
    bi_utils._request('DELETE', '/jmreport/dict/delete', params={'id': dict_id})

    print(f'字典删除成功: {dict_rec.get("dictName", "")} (编码: {dict_rec.get("dictCode", "")}, ID: {dict_id})')


def cmd_bind(args):
    """绑定字典到数据集字段"""
    # 1. 查询数据集详情
    result = bi_utils._request('GET', '/drag/onlDragDatasetHead/queryById', params={
        'id': args.dataset_id,
    })
    if not result.get('success'):
        print(f'查询数据集失败: {result.get("message", "")}')
        return

    dataset = result.get('result', {})
    if not dataset:
        print(f'未找到数据集: {args.dataset_id}')
        return

    # 2. 在 datasetItemList 中找到目标字段并设置 dictCode
    item_list = dataset.get('datasetItemList', [])
    found = False
    for item in item_list:
        if item.get('fieldName') == args.field:
            item['dictCode'] = args.dict_code
            found = True
            print(f'设置字段 {args.field} 的 dictCode = {args.dict_code}')
            break

    if not found:
        print(f'未在数据集中找到字段: {args.field}')
        print(f'可用字段: {", ".join(item.get("fieldName", "") for item in item_list)}')
        return

    # 3. 保存数据集（使用 edit 接口，需要 sign 字段）
    dataset['sign'] = 'E19D6243CB1945AB4F7202A1B00F77D5'
    result = bi_utils._request('POST', '/drag/onlDragDatasetHead/edit', data=dataset)
    if not result.get('success'):
        print(f'保存失败: {result.get("message", "")}')
        return

    print(f'字典绑定成功:')
    print(f'  数据集: {dataset.get("name", "")} ({args.dataset_id})')
    print(f'  字段: {args.field}')
    print(f'  字典编码: {args.dict_code}')


# ============================================================
# CLI 入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='积木报表字典操作工具（jimu_dict）')
    subparsers = parser.add_subparsers(dest='command', help='操作类型')

    # 通用参数（api_base + token）
    def add_common(sub):
        sub.add_argument('api_base', help='API 地址')
        sub.add_argument('token', help='X-Access-Token')

    # list
    p_list = subparsers.add_parser('list', help='列出所有字典')
    add_common(p_list)

    # items
    p_items = subparsers.add_parser('items', help='查看字典项')
    add_common(p_items)
    p_items.add_argument('--code', required=True, help='字典编码')

    # create
    p_create = subparsers.add_parser('create', help='创建字典及字典项')
    add_common(p_create)
    p_create.add_argument('--name', required=True, help='字典名称')
    p_create.add_argument('--code', required=True, help='字典编码')
    p_create.add_argument('--desc', default='', help='字典描述')
    p_create.add_argument('--items', default=None,
                          help='字典项，格式: value=text,value=text（如 1=男性,2=女性,0=其他）')

    # add-item
    p_add = subparsers.add_parser('add-item', help='添加字典项')
    add_common(p_add)
    p_add.add_argument('--code', required=True, help='字典编码')
    p_add.add_argument('--value', required=True, help='字典项值（字符串）')
    p_add.add_argument('--text', required=True, help='字典项文本')
    p_add.add_argument('--sort', type=int, default=0, help='排序号')

    # delete
    p_del = subparsers.add_parser('delete', help='删除字典')
    add_common(p_del)
    p_del.add_argument('--code', default=None, help='字典编码')
    p_del.add_argument('--id', default=None, help='字典 ID')

    # bind
    p_bind = subparsers.add_parser('bind', help='绑定字典到数据集字段')
    add_common(p_bind)
    p_bind.add_argument('--dataset-id', required=True, help='数据集 ID')
    p_bind.add_argument('--field', required=True, help='字段名称（fieldName）')
    p_bind.add_argument('--dict-code', required=True, help='字典编码（dictCode）')

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    init_api(args.api_base, args.token)

    if args.command == 'list':
        cmd_list(args)
    elif args.command == 'items':
        cmd_items(args)
    elif args.command == 'create':
        cmd_create(args)
    elif args.command == 'add-item':
        cmd_add_item(args)
    elif args.command == 'delete':
        cmd_delete(args)
    elif args.command == 'bind':
        cmd_bind(args)


if __name__ == '__main__':
    main()
