# -*- coding: utf-8 -*-
"""
存储过程操作工具 —— 创建存储过程 + SQL数据集 + 组件绑定
================================================================

使用方式（命令行）：

  # 创建存储过程（通过 pymysql 直连数据库）
  py proc_ops.py create <API_BASE> <TOKEN> --db-source "707437208002265088" \
    --name "sp_query_demo" \
    --sql "SELECT id, name, sex, age FROM demo ORDER BY create_time DESC"

  # 创建带参数的存储过程
  py proc_ops.py create <API_BASE> <TOKEN> --db-source "707437208002265088" \
    --name "sp_query_demo_by_sex" \
    --params "p_sex varchar(10)" \
    --sql "SELECT id, name, sex, age FROM demo WHERE sex = p_sex ORDER BY create_time DESC"

  # 查看数据库中已有的存储过程
  py proc_ops.py list <API_BASE> <TOKEN> --db-source "707437208002265088"

  # 删除存储过程
  py proc_ops.py drop <API_BASE> <TOKEN> --db-source "707437208002265088" --name "sp_query_demo"

  # 一键：创建存储过程 + SQL数据集 + 绑定到组件（最常用！）
  py proc_ops.py bindcomp <API_BASE> <TOKEN> --db-source "707437208002265088" \
    --page "PAGE_ID" --comp "JCommonTable" --title "Demo数据表格" \
    --x 50 --y 50 --w 900 --h 450 \
    --proc-name "sp_query_demo" \
    --proc-sql "SELECT id, name, sex, age FROM demo ORDER BY create_time DESC" \
    --fields "id:String,name:String,sex:String,age:String" \
    --dict "sex=sex"

前置条件：
  - pymysql: py -m pip install pymysql
  - 数据源必须是 MySQL 类型
  - 需要数据库的直连权限（host/port/user/password 从数据源 API 获取）

核心原理：
  JimuReport SQL 数据集 API 使用 Spring JdbcTemplate 的 executeQuery()，
  只能执行返回结果集的 SQL（SELECT / CALL），无法执行 DDL（CREATE PROCEDURE）。
  因此必须通过 pymysql 直连数据库创建存储过程，再通过数据集 API 配置 CALL 语法。

参考文档：
  https://help.jimureport.com/biScreen/base/data/sqlProcedure
"""

import sys, json, os, argparse, re, hashlib, time
import urllib.request, urllib.error, urllib.parse

# ============================================================
# bi_utils 加载
# ============================================================
def _find_bi_utils():
    candidates = [
        os.path.dirname(os.path.abspath(__file__)),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'),
        os.getcwd(),
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
# 签名函数（用于获取数据源连接信息）
# ============================================================
SIGNATURE_SECRET = 'dd05f1c54d63749eda95f9fa6d49v442a'

def get_sign(url_path, params=None):
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


def signed_request(method, path, params=None):
    if params:
        qs = urllib.parse.urlencode(params)
        full_path = '%s?%s' % (path, qs)
    else:
        full_path = path
    url = '%s%s' % (bi_utils.API_BASE, full_path)
    timestamp = str(int(time.time() * 1000))
    sign = get_sign(full_path, None)
    headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Access-Token': bi_utils.TOKEN,
        'X-TIMESTAMP': timestamp,
        'X-Sign': sign,
    }
    req = urllib.request.Request(url, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print('签名请求失败: %s' % e)
        return None


def _get_db_connection_info(db_source_id):
    """从数据源 API 获取数据库连接信息"""
    resp = signed_request('GET', '/drag/onlDragDataSource/queryById',
                          params={'id': db_source_id})
    if not resp or not resp.get('success'):
        print('获取数据源详情失败: %s' % (resp.get('message', '') if resp else '无响应'))
        return None

    ds = resp.get('result', {})
    db_url = ds.get('dbUrl', '')

    # 解析 JDBC URL: jdbc:mysql://host:port/database?...
    m = re.search(r'jdbc:mysql://([^:/]+):(\d+)/([^?]+)', db_url)
    if not m:
        print('无法解析 JDBC URL: %s' % db_url)
        return None

    host = m.group(1)
    port = int(m.group(2))
    database = m.group(3)
    username = ds.get('dbUsername', '')
    password = ds.get('dbPassword', '')

    # 127.0.0.1 是服务器本地地址，需替换为 API_BASE 中的 IP
    if host in ('127.0.0.1', 'localhost'):
        api_m = re.search(r'https?://([^:/]+)', bi_utils.API_BASE)
        if api_m:
            host = api_m.group(1)
            print('数据源 JDBC 使用本地地址，已替换为: %s' % host)

    return {
        'host': host, 'port': port, 'database': database,
        'user': username, 'password': password,
    }


def _get_mysql_connection(db_source_id):
    """获取 pymysql 连接"""
    try:
        import pymysql
    except ImportError:
        print('错误: 需要安装 pymysql')
        print('运行: py -m pip install pymysql')
        return None

    info = _get_db_connection_info(db_source_id)
    if not info:
        return None

    try:
        conn = pymysql.connect(
            host=info['host'], port=info['port'],
            user=info['user'], password=info['password'],
            database=info['database'], charset='utf8mb4'
        )
        print('MySQL 连接成功: %s:%d/%s' % (info['host'], info['port'], info['database']))
        return conn
    except Exception as e:
        print('MySQL 连接失败: %s' % e)
        return None


# ============================================================
# 命令实现
# ============================================================
def cmd_create(args):
    """创建存储过程"""
    conn = _get_mysql_connection(args.db_source)
    if not conn:
        return

    proc_name = args.name
    proc_params = args.params or ''
    proc_sql = args.sql

    cursor = conn.cursor()
    try:
        # 先删后建（幂等）
        cursor.execute('DROP PROCEDURE IF EXISTS %s' % proc_name)

        # 构建 CREATE PROCEDURE
        create_sql = 'CREATE PROCEDURE %s(%s)\nBEGIN\n    %s;\nEND' % (
            proc_name, proc_params, proc_sql.rstrip(';'))
        cursor.execute(create_sql)
        conn.commit()
        print('存储过程创建成功: %s' % proc_name)

        # 验证
        call_sql = 'CALL %s(%s)' % (proc_name,
                                      ', '.join(["''" for _ in proc_params.split(',') if proc_params.strip()]) or '')
        try:
            cursor.execute(call_sql)
            rows = cursor.fetchall()
            print('验证: %s 返回 %d 条记录' % (call_sql, len(rows)))
        except Exception as e:
            print('验证失败（可能需要参数）: %s' % e)

    except Exception as e:
        print('创建存储过程失败: %s' % e)
    finally:
        cursor.close()
        conn.close()


def cmd_list(args):
    """列出数据库中的存储过程"""
    conn = _get_mysql_connection(args.db_source)
    if not conn:
        return

    cursor = conn.cursor()
    try:
        cursor.execute("SHOW PROCEDURE STATUS WHERE Db = DATABASE()")
        rows = cursor.fetchall()
        if not rows:
            print('当前数据库没有存储过程')
            return

        print('共 %d 个存储过程:\n' % len(rows))
        print('%-30s %-20s %-20s' % ('名称', '创建时间', '修改时间'))
        print('-' * 72)
        for r in rows:
            print('%-30s %-20s %-20s' % (r[1], str(r[5]), str(r[6])))
    except Exception as e:
        print('查询失败: %s' % e)
    finally:
        cursor.close()
        conn.close()


def cmd_drop(args):
    """删除存储过程"""
    conn = _get_mysql_connection(args.db_source)
    if not conn:
        return

    cursor = conn.cursor()
    try:
        cursor.execute('DROP PROCEDURE IF EXISTS %s' % args.name)
        conn.commit()
        print('存储过程已删除: %s' % args.name)
    except Exception as e:
        print('删除失败: %s' % e)
    finally:
        cursor.close()
        conn.close()


def cmd_bindcomp(args):
    """一键：创建存储过程 + SQL数据集 + 绑定到组件"""
    conn = _get_mysql_connection(args.db_source)
    if not conn:
        return

    proc_name = args.proc_name
    proc_params = args.proc_params or ''
    proc_sql = args.proc_sql

    # Step 1: 创建存储过程
    print('\n=== Step 1: 创建存储过程 %s ===' % proc_name)
    cursor = conn.cursor()
    try:
        cursor.execute('DROP PROCEDURE IF EXISTS %s' % proc_name)
        create_sql = 'CREATE PROCEDURE %s(%s)\nBEGIN\n    %s;\nEND' % (
            proc_name, proc_params, proc_sql.rstrip(';'))
        cursor.execute(create_sql)
        conn.commit()
        print('存储过程创建成功: %s' % proc_name)

        # 验证
        call_sql = 'CALL %s()' % proc_name if not proc_params else 'CALL %s(%s)' % (
            proc_name, ', '.join(["''" for _ in proc_params.split(',')]))
        cursor.execute(call_sql)
        rows = cursor.fetchall()
        print('验证: 返回 %d 条记录' % len(rows))
    except Exception as e:
        print('创建存储过程失败: %s' % e)
        cursor.close()
        conn.close()
        return
    finally:
        cursor.close()
        conn.close()

    # Step 2 & 3: 使用 comp_ops.py 创建数据集 + 添加组件
    print('\n=== Step 2&3: 创建数据集 + 添加组件 ===')

    # 构建 CALL 语句
    if proc_params:
        # 将 MySQL 参数转为 FreeMarker 参数
        # 例如 "p_sex varchar(10)" -> "${p_sex}"
        param_names = []
        for p in proc_params.split(','):
            p = p.strip()
            if p:
                pn = p.split()[0].strip()
                if pn.startswith('IN ') or pn.startswith('in '):
                    pn = pn[3:].strip()
                param_names.append(pn)
        call_params = ', '.join(["'${%s}'" % pn for pn in param_names])
        call_sql = 'CALL %s(%s)' % (proc_name, call_params)
    else:
        call_sql = 'CALL %s()' % proc_name

    # 构建 comp_ops.py 命令参数
    import subprocess
    cmd = [
        sys.executable, 'comp_ops.py', 'add',
        bi_utils.API_BASE, bi_utils.TOKEN, args.page,
        '--comp', args.comp,
        '--title', args.title,
        '--x', str(args.x),
        '--y', str(args.y),
        '--w', str(args.w),
        '--h', str(args.h),
        '--create-sql', call_sql,
        '--ds-name', args.ds_name or ('%s数据集' % proc_name),
        '--fields', args.fields,
        '--db-source', args.db_source,
    ]
    if args.dict:
        cmd.extend(['--dict', args.dict])

    # 检查 comp_ops.py 是否在当前目录
    if not os.path.exists('comp_ops.py'):
        script_dir = os.path.dirname(os.path.abspath(__file__))
        src = os.path.join(script_dir, 'comp_ops.py')
        if os.path.exists(src):
            import shutil
            shutil.copy2(src, 'comp_ops.py')
            # 也复制 default_configs.json
            dc = os.path.join(script_dir, 'default_configs.json')
            if os.path.exists(dc):
                shutil.copy2(dc, 'default_configs.json')

    result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    print(result.stdout)
    if result.stderr:
        print(result.stderr)


# ============================================================
# 主入口
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='存储过程操作工具')
    subparsers = parser.add_subparsers(dest='command')

    def add_common(p):
        p.add_argument('api_base', help='API 地址')
        p.add_argument('token', help='X-Access-Token')
        p.add_argument('--db-source', default='707437208002265088', dest='db_source',
                        help='数据源 ID（默认 707437208002265088）')

    # create
    p_create = subparsers.add_parser('create', help='创建存储过程')
    add_common(p_create)
    p_create.add_argument('--name', required=True, help='存储过程名称')
    p_create.add_argument('--params', default='', help='存储过程参数（如 "p_sex varchar(10)"）')
    p_create.add_argument('--sql', required=True, help='SELECT 语句（存储过程体）')

    # list
    p_list = subparsers.add_parser('list', help='列出存储过程')
    add_common(p_list)

    # drop
    p_drop = subparsers.add_parser('drop', help='删除存储过程')
    add_common(p_drop)
    p_drop.add_argument('--name', required=True, help='存储过程名称')

    # bindcomp
    p_bind = subparsers.add_parser('bindcomp', help='一键：创建存储过程+数据集+组件')
    add_common(p_bind)
    p_bind.add_argument('--page', required=True, help='页面 ID')
    p_bind.add_argument('--comp', default='JCommonTable', help='组件类型')
    p_bind.add_argument('--title', required=True, help='组件标题')
    p_bind.add_argument('--x', type=int, default=50, help='X 坐标')
    p_bind.add_argument('--y', type=int, default=50, help='Y 坐标')
    p_bind.add_argument('--w', type=int, default=900, help='宽度')
    p_bind.add_argument('--h', type=int, default=450, help='高度')
    p_bind.add_argument('--proc-name', required=True, dest='proc_name', help='存储过程名称')
    p_bind.add_argument('--proc-params', default='', dest='proc_params',
                        help='存储过程参数（如 "IN p_sex varchar(10)"）')
    p_bind.add_argument('--proc-sql', required=True, dest='proc_sql',
                        help='SELECT 语句（存储过程体）')
    p_bind.add_argument('--fields', default='name:String,value:String', help='字段列表')
    p_bind.add_argument('--ds-name', default=None, dest='ds_name', help='数据集名称')
    p_bind.add_argument('--dict', default=None, help='字典映射（如 "sex=sex"）')

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        return

    init_api(args.api_base, args.token)

    if args.command == 'create':
        cmd_create(args)
    elif args.command == 'list':
        cmd_list(args)
    elif args.command == 'drop':
        cmd_drop(args)
    elif args.command == 'bindcomp':
        cmd_bindcomp(args)


if __name__ == '__main__':
    main()
