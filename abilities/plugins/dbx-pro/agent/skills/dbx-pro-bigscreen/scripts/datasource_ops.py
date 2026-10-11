# -*- coding: utf-8 -*-
"""
数据源管理工具 —— 列表、详情、新增、编辑、测试连接、删除、SQL解析
================================================================

使用方式（命令行）：

  # 列出可用数据源
  py datasource_ops.py list <API_BASE> <TOKEN>

  # 查看数据源详情
  py datasource_ops.py detail <API_BASE> <TOKEN> --id "707437208002265088"

  # 新建 JDBC 数据源
  py datasource_ops.py create <API_BASE> <TOKEN> --name "测试库" --code "test_db" --db-type MYSQL5.7 --host <db_host> --port 3306 --db mydb --user root --password root

  # 新建 NoSQL 数据源（MongoDB）
  py datasource_ops.py create <API_BASE> <TOKEN> --name "MongoDB数据源" --code "mongodb_jeecg" --db-type mongodb --host <db_host> --port 27017 --db jeecg --user jeecg --password 123456

  # 新建 NoSQL 数据源（Redis）
  py datasource_ops.py create <API_BASE> <TOKEN> --name "Redis数据源" --code "redis_ds" --db-type redis --host <db_host> --port 6379

  # 新建 NoSQL 数据源（Elasticsearch）
  py datasource_ops.py create <API_BASE> <TOKEN> --name "ES数据源" --code "es_ds" --db-type es --host <db_host> --port 9200

  # 编辑数据源 —— 按名称查找，追加 JDBC 参数（解决 SSL 证书校验问题等）
  py datasource_ops.py edit <API_BASE> <TOKEN> --name "jeecgbootbpm" --add-jdbc-param "trustServerCertificate=true"

  # 编辑数据源 —— 按 ID 查找，直接替换完整 dbUrl
  py datasource_ops.py edit <API_BASE> <TOKEN> --id "<datasource_id>" --set-url "jdbc:sqlserver://<db_host>:1433;SelectMethod=cursor;DatabaseName=jeecgbootbpm;trustServerCertificate=true;"

  # 编辑数据源 —— 修改用户名/密码
  py datasource_ops.py edit <API_BASE> <TOKEN> --name "jeecgbootbpm" --user newuser --password newpass

  # 测试数据源连接（用已有ID）
  py datasource_ops.py test <API_BASE> <TOKEN> --id "707437208002265088"

  # 测试数据源连接（用参数）
  py datasource_ops.py test <API_BASE> <TOKEN> --db-type MYSQL5.7 --host <db_host> --port 3306 --db mydb --user root --password root

  # 删除数据源
  py datasource_ops.py delete <API_BASE> <TOKEN> --id "707437208002265088"

  # 解析SQL字段
  py datasource_ops.py parse-sql <API_BASE> <TOKEN> --db-source "707437208002265088" --sql "SELECT name, value FROM table"

接口说明（需要签名）：
  GET  /drag/onlDragDataSource/getOptions            列出所有数据源（返回 [{value:id, label:name, text:name}]）
  GET  /drag/onlDragDataSource/queryById?id=xxx      查询数据源完整信息
  POST /drag/onlDragDataSource/add                   新增数据源
  POST /drag/onlDragDataSource/edit                  编辑数据源（需传完整对象）
  POST /drag/onlDragDataSource/testConnection        测试连接
  DELETE /drag/onlDragDataSource/delete?id=xxx       删除数据源
  POST /drag/onlDragDatasetHead/parseSQL             解析SQL字段列表
"""

import sys, json, os, argparse, hashlib, time
import urllib.request
import urllib.error

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
# 签名实现
# ============================================================
SIGNATURE_SECRET = 'dd05f1c54d63749eda95f9fa6d49v442a'


def get_sign(url_path, params=None):
    """根据 URL 路径和查询参数生成 X-Sign 签名"""
    json_obj = {}
    if '?' in url_path:
        qs = url_path.split('?', 1)[1]
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
    sign_str = json.dumps(sorted_obj, ensure_ascii=False, separators=(',', ':')) + SIGNATURE_SECRET
    return hashlib.md5(sign_str.encode('utf-8')).hexdigest().upper()


def get_vsign(data, sign):
    """根据请求体数据和 sign 生成 V-Sign 签名"""
    json_obj = dict(data) if data and isinstance(data, dict) else {}
    json_obj['sign'] = sign
    sign_param_obj = {k: v for k, v in json_obj.items() if v and isinstance(v, str)}
    sorted_obj = dict(sorted(sign_param_obj.items()))
    sign_str = json.dumps(sorted_obj, ensure_ascii=False, separators=(',', ':')) + SIGNATURE_SECRET
    return hashlib.md5(sign_str.encode('utf-8')).hexdigest().upper()


def signed_request(method, path, data=None, params=None):
    """发送带签名头的请求"""
    # 构建带查询参数的完整路径
    if params:
        qs = urllib.parse.urlencode(params)
        full_path = f'{path}?{qs}' if '?' not in path else f'{path}&{qs}'
    else:
        full_path = path

    url = f'{bi_utils.API_BASE}{full_path}'
    timestamp = str(int(time.time() * 1000))
    sign = get_sign(full_path, None)  # params already in path

    headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Access-Token': bi_utils.TOKEN,
        'X-TIMESTAMP': timestamp,
        'X-Sign': sign,
    }

    body = None
    if method == 'POST' and data is not None:
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        vsign = get_vsign(data, sign)
        headers['V-Sign'] = vsign
    elif method == 'PUT' and data is not None:
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        vsign = get_vsign(data, sign)
        headers['V-Sign'] = vsign

    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp_data = json.loads(resp.read().decode('utf-8'))
            return resp_data
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8') if e.fp else ''
        print(f'HTTP 错误 {e.code}: {err_body}')
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f'请求失败: {e.reason}')
        sys.exit(1)


def simple_get(path, params=None):
    """发送不带签名的 GET 请求（用于不需要签名的接口）"""
    if params:
        qs = urllib.parse.urlencode(params)
        full_path = f'{path}?{qs}' if '?' not in path else f'{path}&{qs}'
    else:
        full_path = path

    url = f'{bi_utils.API_BASE}{full_path}'
    headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Access-Token': bi_utils.TOKEN,
    }

    req = urllib.request.Request(url, headers=headers, method='GET')

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp_data = json.loads(resp.read().decode('utf-8'))
            return resp_data
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8') if e.fp else ''
        print(f'HTTP 错误 {e.code}: {err_body}')
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f'请求失败: {e.reason}')
        sys.exit(1)


# ============================================================
# JDBC 模板和驱动映射
# ============================================================
JDBC_TEMPLATES = {
    'MYSQL5.7': 'jdbc:mysql://{host}:{port}/{db}?characterEncoding=UTF-8&useUnicode=true&useSSL=false&tinyInt1isBit=false&allowPublicKeyRetrieval=true&serverTimezone=Asia/Shanghai',
    'MYSQL5.5': 'jdbc:mysql://{host}:{port}/{db}?characterEncoding=UTF-8&useUnicode=true&useSSL=false',
    'ORACLE': 'jdbc:oracle:thin:@{host}:{port}:{db}',
    'SQLSERVER': 'jdbc:sqlserver://{host}:{port};SelectMethod=cursor;DatabaseName={db};trustServerCertificate=true;',
    'POSTGRESQL': 'jdbc:postgresql://{host}:{port}/{db}',
}

DB_DRIVERS = {
    'MYSQL5.7': 'com.mysql.cj.jdbc.Driver',
    'MYSQL5.5': 'com.mysql.jdbc.Driver',
    'ORACLE': 'oracle.jdbc.OracleDriver',
    'SQLSERVER': 'com.microsoft.sqlserver.jdbc.SQLServerDriver',
    'POSTGRESQL': 'org.postgresql.Driver',
}

DEFAULT_PORTS = {
    'MYSQL5.7': 3306,
    'MYSQL5.5': 3306,
    'ORACLE': 1521,
    'SQLSERVER': 1433,
    'POSTGRESQL': 5432,
    'mongodb': 27017,
    'redis': 6379,
    'es': 9200,
}

# NoSQL 数据源类型集合（不使用 JDBC URL，dbDriver 为空）
# dbUrl 格式：host:port/database（MongoDB）、host:port（Redis/ES）
NOSQL_TYPES = {'mongodb', 'redis', 'es'}

# NoSQL dbUrl 模板
NOSQL_URL_TEMPLATES = {
    'mongodb': '{host}:{port}/{db}',   # 如 <db_host>:27017/jeecg
    'redis': '{host}:{port}',           # 如 <db_host>:6379
    'es': '{host}:{port}',              # 如 <db_host>:9200
}

# 所有支持的数据库类型（JDBC + NoSQL）
ALL_DB_TYPES = list(JDBC_TEMPLATES.keys()) + list(NOSQL_TYPES)


def build_jdbc_url(db_type, host, port, db):
    """根据数据库类型构建 JDBC URL"""
    tpl = JDBC_TEMPLATES.get(db_type)
    if not tpl:
        print(f'不支持的数据库类型: {db_type}，支持: {", ".join(JDBC_TEMPLATES.keys())}')
        sys.exit(1)
    return tpl.format(host=host, port=port, db=db)


def build_nosql_url(db_type, host, port, db):
    """根据 NoSQL 类型构建 dbUrl（不带协议前缀）"""
    tpl = NOSQL_URL_TEMPLATES.get(db_type)
    if not tpl:
        print(f'不支持的 NoSQL 类型: {db_type}，支持: {", ".join(NOSQL_TYPES)}')
        sys.exit(1)
    return tpl.format(host=host, port=port, db=db or '')


def build_datasource_data(args):
    """从命令行参数构建数据源请求体"""
    db_type = args.db_type
    host = args.host
    port = args.port or DEFAULT_PORTS.get(db_type, 3306)
    db = args.db
    user = args.user
    password = args.password

    if db_type in NOSQL_TYPES:
        # NoSQL：dbDriver 为空，dbUrl 为 host:port/db 格式
        db_url = build_nosql_url(db_type, host, port, db)
        driver = ''
    else:
        # JDBC：构建标准 JDBC URL
        db_url = build_jdbc_url(db_type, host, port, db)
        driver = DB_DRIVERS.get(db_type, '')

    data = {
        'name': getattr(args, 'name', '') or '',
        'code': getattr(args, 'code', '') or '',
        'dbType': db_type,
        'dbDriver': driver,
        'dbUrl': db_url,
        'dbUsername': user,
        'dbPassword': password,
    }
    return data


# ============================================================
# 命令实现
# ============================================================
def cmd_list(args):
    """列出可用数据源"""
    resp = simple_get('/drag/onlDragDataSource/getOptions')
    if not resp or not resp.get('success'):
        print(f'获取数据源列表失败: {resp.get("message", "未知错误") if resp else "无响应"}')
        return

    records = resp.get('result', [])
    if not records:
        print('暂无数据源')
        return

    print(f'共 {len(records)} 个数据源：\n')
    print(f'{"序号":<4} {"ID":<24} {"名称":<20}')
    print('-' * 52)
    for i, ds in enumerate(records):
        # getOptions 返回 {value: id, label: name, text: name}
        ds_id = ds.get('value', ds.get('id', '?'))
        ds_name = ds.get('label', ds.get('text', ds.get('name', '?')))
        print(f'{i+1:<4} {ds_id:<24} {ds_name:<20}')


def cmd_detail(args):
    """查看数据源详情"""
    if not args.id:
        print('请提供 --id 参数')
        return

    resp = signed_request('GET', f'/drag/onlDragDataSource/queryById', params={'id': args.id})
    if not resp or not resp.get('success'):
        print(f'获取数据源详情失败: {resp.get("message", "未知错误") if resp else "无响应"}')
        return

    ds = resp.get('result', {})
    print('数据源详情：')
    print(f'  ID:       {ds.get("id", "?")}')
    print(f'  名称:     {ds.get("name", "?")}')
    print(f'  编码:     {ds.get("code", "?")}')
    print(f'  类型:     {ds.get("dbType", "?")}')
    print(f'  驱动:     {ds.get("dbDriver", "?")}')
    print(f'  JDBC URL: {ds.get("dbUrl", "?")}')
    print(f'  用户名:   {ds.get("dbUsername", "?")}')
    if getattr(args, 'show_password', False):
        # ⚠️ /drag/onlDragDataSource/queryById 接口直接返回明文密码（dbPassword 字段）
        # 默认不打印；显式 --show-password 才显示，避免误泄到日志/截屏
        print(f'  密码:     {ds.get("dbPassword", "?")}')
    else:
        pwd = ds.get('dbPassword') or ''
        masked = ('*' * len(pwd)) if pwd else '(empty)'
        print(f'  密码:     {masked}  (加 --show-password 查看明文)')
    print(f'  创建时间: {ds.get("createTime", "?")}')
    print(f'  更新时间: {ds.get("updateTime", "?")}')


def cmd_create(args):
    """创建新数据源"""
    if not args.name or not args.code or not args.db_type or not args.host or not args.db or not args.user:
        print('创建数据源需要: --name, --code, --db-type, --host, --db, --user, --password')
        return

    data = build_datasource_data(args)
    resp = signed_request('POST', '/drag/onlDragDataSource/add', data=data)

    if not resp or not resp.get('success'):
        print(f'创建数据源失败: {resp.get("message", "未知错误") if resp else "无响应"}')
        return

    result = resp.get('result', {})
    ds_id = result.get('id', '?') if isinstance(result, dict) else result
    print(f'创建成功！')
    print(f'  名称: {data["name"]}')
    print(f'  编码: {data["code"]}')
    print(f'  类型: {data["dbType"]}')
    print(f'  JDBC: {data["dbUrl"]}')
    if isinstance(result, dict) and result.get('id'):
        print(f'  ID:   {result["id"]}')


def cmd_test(args):
    """测试数据源连接"""
    if getattr(args, 'name', None) and not args.id:
        # 通过名称查找后测试
        data = _find_ds_by_name(args.name)
    elif args.id:
        # 先获取详情，再测试
        detail_resp = signed_request('GET', '/drag/onlDragDataSource/queryById', params={'id': args.id})
        if not detail_resp or not detail_resp.get('success'):
            print(f'获取数据源详情失败: {detail_resp.get("message", "未知错误") if detail_resp else "无响应"}')
            return
        data = detail_resp.get('result', {})
    elif args.db_type and args.host and args.db and args.user:
        data = build_datasource_data(args)
    else:
        print('请提供 --id 或连接参数 (--db-type, --host, --db, --user, --password)')
        return

    test_data = {
        'dbType': data.get('dbType', ''),
        'dbDriver': data.get('dbDriver', ''),
        'dbUrl': data.get('dbUrl', ''),
        'dbUsername': data.get('dbUsername', ''),
        'dbPassword': data.get('dbPassword', ''),
    }

    resp = signed_request('POST', '/drag/onlDragDataSource/testConnection', data=test_data)

    if not resp:
        print('测试连接失败: 无响应')
        return

    if resp.get('success'):
        print('连接测试成功！')
        print(f'  消息: {resp.get("message", "")}')
    else:
        print(f'连接测试失败: {resp.get("message", "未知错误")}')


def _find_ds_by_name(name):
    """通过名称从 getOptions 找到数据源 ID，再 queryById 返回完整对象"""
    resp = simple_get('/drag/onlDragDataSource/getOptions')
    if not resp or not resp.get('success'):
        print(f'获取数据源列表失败: {resp.get("message", "") if resp else "无响应"}')
        sys.exit(1)
    items = resp.get('result', [])
    ds = next((r for r in items if r.get('label') == name or r.get('text') == name), None)
    if not ds:
        print(f'未找到名称为 "{name}" 的数据源，已有数据源：')
        for r in items:
            print(f'  {r.get("value","?")}  {r.get("label","?")}')
        sys.exit(1)
    ds_id = ds['value']
    detail = signed_request('GET', '/drag/onlDragDataSource/queryById', params={'id': ds_id})
    if not detail or not detail.get('success'):
        print(f'获取数据源详情失败: {detail.get("message", "") if detail else "无响应"}')
        sys.exit(1)
    return detail.get('result', {})


def cmd_edit(args):
    """编辑数据源（按名称或 ID 定位，支持追加 JDBC 参数 / 替换 URL / 改用户名密码）"""
    if not args.id and not args.name:
        print('请提供 --id 或 --name 参数')
        return

    # 获取完整数据源对象
    if args.id:
        detail = signed_request('GET', '/drag/onlDragDataSource/queryById', params={'id': args.id})
        if not detail or not detail.get('success'):
            print(f'获取数据源详情失败: {detail.get("message", "") if detail else "无响应"}')
            return
        full_ds = detail.get('result', {})
    else:
        full_ds = _find_ds_by_name(args.name)

    changed = False

    # --set-url：直接替换完整 dbUrl
    if args.set_url:
        print(f'旧 dbUrl: {full_ds.get("dbUrl", "")}')
        full_ds['dbUrl'] = args.set_url
        print(f'新 dbUrl: {full_ds["dbUrl"]}')
        changed = True

    # --add-jdbc-param：向 dbUrl 末尾追加 JDBC 参数（格式 key=value）
    if args.add_jdbc_param:
        old_url = full_ds.get('dbUrl', '')
        param = args.add_jdbc_param.strip(';')
        key = param.split('=')[0]
        if key in old_url:
            # 已存在则替换同名参数
            import re
            new_url = re.sub(rf'{re.escape(key)}=[^;]*', param, old_url)
        else:
            new_url = old_url.rstrip(';') + ';' + param + ';'
        print(f'旧 dbUrl: {old_url}')
        print(f'新 dbUrl: {new_url}')
        full_ds['dbUrl'] = new_url
        changed = True

    # --user / --password
    if args.user:
        full_ds['dbUsername'] = args.user
        changed = True
    if args.password:
        full_ds['dbPassword'] = args.password
        changed = True

    if not changed:
        print('未指定任何修改项，可用参数：--set-url / --add-jdbc-param / --user / --password')
        return

    resp = signed_request('POST', '/drag/onlDragDataSource/edit', data=full_ds)
    if not resp or not resp.get('success'):
        print(f'编辑失败: {resp.get("message", "未知错误") if resp else "无响应"}')
        return
    print(f'编辑成功！数据源: {full_ds.get("name", full_ds.get("dbName", "?"))}')


def cmd_delete(args):
    """删除数据源"""
    if not args.id:
        print('请提供 --id 参数')
        return

    resp = signed_request('DELETE', '/drag/onlDragDataSource/delete', params={'id': args.id})

    if not resp or not resp.get('success'):
        print(f'删除失败: {resp.get("message", "未知错误") if resp else "无响应"}')
        return

    print(f'删除成功！ID: {args.id}')


def cmd_parse_sql(args):
    """解析SQL获取字段列表"""
    if not args.db_source or not args.sql:
        print('请提供 --db-source 和 --sql 参数')
        return

    data = {
        'dbSource': args.db_source,
        'sql': args.sql,
    }

    resp = signed_request('POST', '/drag/onlDragDatasetHead/parseSQL', data=data)

    if not resp or not resp.get('success'):
        print(f'SQL解析失败: {resp.get("message", "未知错误") if resp else "无响应"}')
        return

    fields = resp.get('result', [])
    if not fields:
        print('未解析到字段')
        return

    print(f'解析到 {len(fields)} 个字段：\n')
    print(f'{"序号":<4} {"字段名":<30} {"字段类型":<15} {"备注":<20}')
    print('-' * 72)
    for i, f in enumerate(fields):
        fname = f.get('fieldName', f.get('name', '?'))
        ftype = f.get('fieldType', f.get('type', '?'))
        fremark = f.get('fieldRemark', f.get('remark', ''))
        print(f'{i+1:<4} {fname:<30} {ftype:<15} {fremark:<20}')


# ============================================================
# CLI 入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='数据源管理工具')
    subparsers = parser.add_subparsers(dest='command', help='操作类型')

    # 通用参数（不含 page_id）
    def add_common(sub):
        sub.add_argument('api_base', help='API 地址')
        sub.add_argument('token', help='X-Access-Token')

    # 连接参数
    def add_conn_params(sub):
        sub.add_argument('--db-type', choices=ALL_DB_TYPES, help='数据库类型（JDBC: MYSQL5.7/ORACLE/... NoSQL: mongodb/redis/es）')
        sub.add_argument('--host', help='数据库主机地址')
        sub.add_argument('--port', type=int, default=None, help='数据库端口')
        sub.add_argument('--db', help='数据库名称')
        sub.add_argument('--user', help='数据库用户名')
        sub.add_argument('--password', default='', help='数据库密码')

    # list
    p_list = subparsers.add_parser('list', help='列出可用数据源')
    add_common(p_list)

    # detail
    p_detail = subparsers.add_parser('detail', help='查看数据源详情')
    add_common(p_detail)
    p_detail.add_argument('--id', required=True, help='数据源 ID')
    p_detail.add_argument('--show-password', action='store_true', dest='show_password',
                          help='显示数据库明文密码（接口本身返回 dbPassword，需直连 DB 执行 DDL 时使用；默认隐藏）')

    # create
    p_create = subparsers.add_parser('create', help='创建新数据源')
    add_common(p_create)
    p_create.add_argument('--name', required=True, help='数据源名称')
    p_create.add_argument('--code', required=True, help='数据源编码')
    add_conn_params(p_create)

    # edit
    p_edit = subparsers.add_parser('edit', help='编辑数据源（修改URL/追加JDBC参数/改密码）')
    add_common(p_edit)
    p_edit.add_argument('--id', default=None, help='数据源 ID（与 --name 二选一）')
    p_edit.add_argument('--name', default=None, help='数据源名称（与 --id 二选一）')
    p_edit.add_argument('--set-url', default=None, dest='set_url', help='替换完整 dbUrl')
    p_edit.add_argument('--add-jdbc-param', default=None, dest='add_jdbc_param',
                        help='向 dbUrl 追加/替换 JDBC 参数，格式: key=value（如 trustServerCertificate=true）')
    p_edit.add_argument('--user', default=None, help='修改数据库用户名')
    p_edit.add_argument('--password', default=None, help='修改数据库密码')

    # test
    p_test = subparsers.add_parser('test', help='测试数据源连接')
    add_common(p_test)
    p_test.add_argument('--id', default=None, help='数据源 ID（使用已有数据源测试）')
    p_test.add_argument('--name', default=None, help='数据源名称（自动查询 ID 后测试，与 --id 二选一）')
    add_conn_params(p_test)

    # delete
    p_delete = subparsers.add_parser('delete', help='删除数据源')
    add_common(p_delete)
    p_delete.add_argument('--id', required=True, help='数据源 ID')

    # parse-sql
    p_parse = subparsers.add_parser('parse-sql', help='解析SQL获取字段列表')
    add_common(p_parse)
    p_parse.add_argument('--db-source', required=True, help='数据源 ID')
    p_parse.add_argument('--sql', required=True, help='SQL 语句')

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    init_api(args.api_base, args.token)

    if args.command == 'list':
        cmd_list(args)
    elif args.command == 'detail':
        cmd_detail(args)
    elif args.command == 'create':
        cmd_create(args)
    elif args.command == 'edit':
        cmd_edit(args)
    elif args.command == 'test':
        cmd_test(args)
    elif args.command == 'delete':
        cmd_delete(args)
    elif args.command == 'parse-sql':
        cmd_parse_sql(args)


if __name__ == '__main__':
    main()
