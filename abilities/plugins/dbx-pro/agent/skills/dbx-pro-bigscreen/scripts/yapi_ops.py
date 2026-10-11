"""
yapi_ops.py — YApi Mock 接口管理预置脚本
=========================================
统一使用 claude AI 项目（proj_id=57，catid=1157，basepath=/claude）

命令：
  create-mock        创建 mock 接口（支持 --advmock-script 一步启用高级脚本）
  create-mock-batch  批量创建（条目支持 advmock_script/advmock_file 字段）
  set-advmock        给已有接口启用/更新高级 mock 脚本（联动/钻取必备）
  list               列出项目中的接口
  delete             删除接口（按标题）
  update             更新接口 res_body

用法示例：
  py yapi_ops.py create-mock YAPI_BASE EMAIL PASSWORD \
      --title "折线图单系列数据" \
      --path "/line_single" \
      --body '[{"name":"一月","value":120}]'

  # 一步创建 + 启用高级脚本（支持联动/钻取动态返参）
  py yapi_ops.py create-mock YAPI_BASE EMAIL PASSWORD \
      --title "品牌销量-按品牌过滤" --path "/brand_sales" \
      --body '[{"name":"深圳","value":100}]' \
      --advmock-script 'if(params.brand=="比亚迪"){mockJson={"data":[{"name":"深圳","value":300}]}}else{mockJson={"data":[{"name":"深圳","value":100}]}}'

  # 给已有接口启用/更新高级脚本
  py yapi_ops.py set-advmock YAPI_BASE EMAIL PASSWORD \
      --iface-id 5933 --script-file /tmp/advmock.js

  py yapi_ops.py list YAPI_BASE EMAIL PASSWORD

  py yapi_ops.py delete YAPI_BASE EMAIL PASSWORD --title "折线图单系列数据"

──【高级 Mock 脚本（联动/钻取核心）】────────────────────────────────────
必须用 /api/plugin/advmock/save（禁止用 /api/interface/up 的 isOpen/script 字段，不生效）。
脚本规则：
  · 用 params.xxx 读取 URL query 参数（大屏联动时参数由源组件点击值透传）
  · 用 mockJson = {...} 赋值返回体（不是 return）
  · 必须写兜底 else 分支（确保无参数时有数据）
  · 字段名须与图表 dataMapping / fieldMap 保持一致
示例：
  if (params.brand === '比亚迪') {
      mockJson = {"data":[{"name":"深圳","value":380},{"name":"上海","value":320}]}
  } else if (params.brand === '特斯拉') {
      mockJson = {"data":[{"name":"上海","value":280}]}
  } else {
      mockJson = {"data":[{"name":"深圳","value":150},{"name":"上海","value":140}]}  // 兜底
  }
──────────────────────────────────────────────────────────────────────

单系列数据模板（--template single）：
  [{"name":"一月","value":120},{"name":"二月","value":200},
   {"name":"三月","value":150},{"name":"四月","value":300},
   {"name":"五月","value":280},{"name":"六月","value":350}]

多系列数据模板（--template multi）：
  [{"type":"系列A","name":"一月","value":120},{"type":"系列A","name":"二月","value":200},
   {"type":"系列A","name":"三月","value":150},{"type":"系列A","name":"四月","value":280},
   {"type":"系列A","name":"五月","value":350},
   {"type":"系列B","name":"一月","value":80}, {"type":"系列B","name":"二月","value":160},
   {"type":"系列B","name":"三月","value":220},{"type":"系列B","name":"四月","value":180},
   {"type":"系列B","name":"五月","value":240}]
"""

import sys, json, argparse, time, http.cookiejar, urllib.request, urllib.parse

sys.stdout.reconfigure(encoding='utf-8')

# ── 固定项目参数（claude AI，禁止修改为其他项目）──────────────────────────────
PROJ_ID  = 57
CATID    = 1157
BASEPATH = '/claude'

# ── 内置数据模板 ───────────────────────────────────────────────────────────────
TEMPLATES = {
    'single': [
        {"name": "一月", "value": 120}, {"name": "二月", "value": 200},
        {"name": "三月", "value": 150}, {"name": "四月", "value": 300},
        {"name": "五月", "value": 280}, {"name": "六月", "value": 350},
    ],
    'multi': [
        {"type": "系列A", "name": "一月", "value": 120},
        {"type": "系列A", "name": "二月", "value": 200},
        {"type": "系列A", "name": "三月", "value": 150},
        {"type": "系列A", "name": "四月", "value": 280},
        {"type": "系列A", "name": "五月", "value": 350},
        {"type": "系列B", "name": "一月", "value": 80},
        {"type": "系列B", "name": "二月", "value": 160},
        {"type": "系列B", "name": "三月", "value": 220},
        {"type": "系列B", "name": "四月", "value": 180},
        {"type": "系列B", "name": "五月", "value": 240},
    ],
    'bar_multi': [
        {"type": "Q1", "name": "华北", "value": 320},
        {"type": "Q1", "name": "华南", "value": 280},
        {"type": "Q1", "name": "华东", "value": 410},
        {"type": "Q2", "name": "华北", "value": 380},
        {"type": "Q2", "name": "华南", "value": 350},
        {"type": "Q2", "name": "华东", "value": 460},
    ],
    'pie': [
        {"name": "直接访问", "value": 335},
        {"name": "邮件营销", "value": 310},
        {"name": "联盟广告", "value": 234},
        {"name": "视频广告", "value": 135},
        {"name": "搜索引擎", "value": 548},
    ],
    'gauge': [
        {"name": "总量", "value": 100},
        {"name": "当前", "value": 73},
    ],
    'table': [
        {"name": "项目A", "value": 1250},
        {"name": "项目B", "value": 980},
        {"name": "项目C", "value": 1560},
        {"name": "项目D", "value": 720},
        {"name": "项目E", "value": 1840},
    ],
}

# ── YApi HTTP 工具 ─────────────────────────────────────────────────────────────
_cookie_jar = http.cookiejar.CookieJar()
_opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(_cookie_jar))
_yapi_base = ''

def _req(method, path, data=None, params=None):
    url = _yapi_base + path
    if params:
        url += '?' + urllib.parse.urlencode(params)
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    body = json.dumps(data, ensure_ascii=False).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with _opener.open(req, timeout=20) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        print(f'[HTTP {e.code}] {path}: {body[:200]}')
        return {}
    except Exception as e:
        print(f'[请求失败] {path}: {e}')
        return {}

def _login(email, password):
    global _yapi_base
    r = _req('POST', '/api/user/login', {'email': email, 'password': password})
    if r.get('errcode') != 0:
        print(f'YApi 登录失败: {r.get("errmsg")}')
        sys.exit(1)
    uname = (r.get('data') or {}).get('username', email)
    print(f'登录成功: {uname}')
    return r

def mock_url(path):
    """生成正确的 Mock URL（含 basepath）"""
    return f"{_yapi_base}/mock/{PROJ_ID}{BASEPATH}{path}"

# ── 命令实现 ───────────────────────────────────────────────────────────────────

def _resolve_body(body=None, body_file=None, template=None):
    """三选一解析 res_body。返回 JSON 字符串，或 None 表示参数缺失。

    body 防呆（实测 2026-05-13）：YApi 后端要求 res_body 是 string，但 batch 文件里
    AI 直觉会写成 JSON 数组/对象。检测 dict/list 自动 json.dumps，避免每次都报
    "请求参数 data.res_body 应当是 string 类型"。
    """
    if template:
        if template not in TEMPLATES:
            raise ValueError(f'未知模板: {template}，可用: {list(TEMPLATES.keys())}')
        return json.dumps(TEMPLATES[template], ensure_ascii=False)
    if body:
        if isinstance(body, (dict, list)):
            return json.dumps(body, ensure_ascii=False)
        return body
    if body_file:
        with open(body_file, 'r', encoding='utf-8') as f:
            return f.read()
    return None


def _create_mock_once(title, res_body, path=None, ts_suffix=None):
    """创建单个 mock 接口（调用前确保已登录）。返回 (url, iid, errmsg)。

    ⚠️ YApi path 只接受 [字母数字-/_:.!]，含中文/空格的自动生成路径会被后端 400 拒。
    自动生成时不依赖 title，纯用时间戳+序号。

    接口已存在时（errmsg 含"已存在"）自动按 path 查已有 id → 调 interface/up 更新 res_body
    并复用 id。复用比失败更符合 AI 生成大屏的场景（重复跑不会炸）。
    """
    ts = ts_suffix if ts_suffix is not None else int(time.time())
    if path:
        iface_path = path
    else:
        iface_path = f'/mock_{ts}'
    if iface_path.startswith(BASEPATH + '/'):
        iface_path = iface_path[len(BASEPATH):]
    payload = {
        'project_id': PROJ_ID,
        'catid':      CATID,
        'title':      title,
        'path':       iface_path,
        'method':     'GET',
        'status':     'done',
        'res_body_type': 'raw',
        'res_body':   res_body,
    }
    r = _req('POST', '/api/interface/add', payload)
    if r.get('errcode') == 0:
        data = r.get('data') or {}
        actual_path = data.get('path', iface_path)
        return mock_url(actual_path), data.get('_id'), None

    errmsg = r.get('errmsg') or ''
    if '已存在' not in errmsg and 'exist' not in errmsg.lower():
        return None, None, f'errcode={r.get("errcode")} {errmsg}'

    # 已存在：查 id → 复用 + 更新 res_body
    # 翻页查找（实测 2026-05-13）：项目接口数超过单页 limit 时，单页查不到会误报
    # "接口已存在但未找到 id"。逐页扫描直到命中或扫完，最多 10 页（5000 条上限）。
    iid = None
    for page_idx in range(1, 11):
        lr = _req('GET', '/api/interface/list',
                  params={'project_id': PROJ_ID, 'page': page_idx, 'limit': 500})
        page_list = (lr.get('data') or {}).get('list') or []
        if not page_list:
            break
        for it in page_list:
            if it.get('path') == iface_path and (it.get('method') or '').upper() == 'GET':
                iid = it.get('_id')
                break
        if iid:
            break
    if not iid:
        return None, None, f'接口已存在但未找到 id: path={iface_path}'
    up_payload = {
        'id':             str(iid),
        'title':          title,
        'catid':          CATID,
        'path':           iface_path,
        'method':         'GET',
        'project_id':     PROJ_ID,
        'status':         'done',
        'tag':            [],
        'req_query':      [], 'req_headers': [], 'req_body_form': [], 'req_params': [],
        'req_body_is_json_schema': True,
        'res_body_is_json_schema': False,
        'res_body_type':  'raw',
        'res_body':       res_body,
        'switch_notice':  True,
        'api_opened':     False,
        'desc':           '', 'markdown': '',
    }
    ur = _req('POST', '/api/interface/up', up_payload)
    if ur.get('errcode') != 0:
        return None, None, f'复用更新失败: {ur.get("errmsg")}'
    return mock_url(iface_path), iid, None


def _set_advmock(iface_id, script, enable=True):
    """调用 /api/plugin/advmock/save 写入/启用高级 Mock 脚本。

    ⚠️ 正确 API 路径是 /api/plugin/advmock/save；
       禁止用 /api/interface/up 的 isOpen/script 字段——那个字段不生效。

    script 规则：
      · params.xxx 读 URL query 参数（大屏联动透传的字段名）
      · mockJson = {...} 赋返回体（不是 return）
      · 必须有兜底 else（无参数时仍有数据）
    """
    r = _req('POST', '/api/plugin/advmock/save', {
        'project_id':   PROJ_ID,
        'interface_id': str(iface_id),
        'mock_script':  script,
        'enable':       bool(enable),
    })
    if r.get('errcode') != 0:
        return False, f'errcode={r.get("errcode")} {r.get("errmsg")}'
    return True, None


def _resolve_script(script=None, script_file=None):
    """三选一解析 mock_script。返回脚本字符串或 None。"""
    if script:
        return script
    if script_file:
        with open(script_file, 'r', encoding='utf-8') as f:
            return f.read()
    return None


def cmd_create_mock(args):
    _login(args.email, args.password)
    try:
        res_body = _resolve_body(args.body, args.body_file, args.template)
    except ValueError as e:
        print(e); sys.exit(1)
    if res_body is None:
        print('必须提供 --body、--body-file 或 --template'); sys.exit(1)

    url, iid, err = _create_mock_once(args.title, res_body, path=args.path)
    if err:
        print(f'创建失败: {err}'); sys.exit(1)
    print(f'创建成功: id={iid}')
    print(f'Mock URL: {url}')

    # 可选：启用高级 Mock 脚本（联动/钻取必备）
    script = _resolve_script(
        getattr(args, 'advmock_script', None),
        getattr(args, 'advmock_file', None),
    )
    if script:
        ok, err = _set_advmock(iid, script, enable=True)
        if ok:
            print('高级 Mock 脚本已启用')
        else:
            print(f'⚠️ 高级 Mock 脚本写入失败: {err}')
    return url


def cmd_set_advmock(args):
    """给已有接口启用/更新高级 Mock 脚本。"""
    _login(args.email, args.password)
    script = _resolve_script(args.script, args.script_file)
    if script is None:
        print('必须提供 --script 或 --script-file'); sys.exit(1)
    ok, err = _set_advmock(args.iface_id, script, enable=(not args.disable))
    if not ok:
        print(f'失败: {err}'); sys.exit(1)
    state = '禁用' if args.disable else '启用'
    print(f'高级 Mock 脚本已{state}，interface_id={args.iface_id}')


def cmd_create_mock_batch(args):
    """批量创建 mock 接口：一次登录 + 循环创建。

    batch-file 格式（JSON 数组，每项一条接口）：
      [
        {"title": "销售走势", "path": "/sales/trend", "body": "[{\\"a\\":1}]"},
        {"title": "饼图占比", "template": "pie"},
        {"title": "订单表",   "body_file": "/tmp/orders.json"},
        {"title": "品牌销量联动", "path": "/brand_sales",
         "body": "[{\\"name\\":\\"深圳\\",\\"value\\":100}]",
         "advmock_script": "if(params.brand=='比亚迪'){mockJson={\\"data\\":[{\\"name\\":\\"深圳\\",\\"value\\":300}]}}else{mockJson={\\"data\\":[{\\"name\\":\\"深圳\\",\\"value\\":100}]}}"}
      ]
    字段：title (必填)；path (可选，默认自动生成)；body / body_file / template 三选一；
          advmock_script / advmock_file (可选，一步启用高级脚本，联动/钻取场景用)。
    """
    with open(args.batch_file, 'r', encoding='utf-8') as f:
        items = json.load(f)
    if not isinstance(items, list) or not items:
        print('batch-file 必须是非空 JSON 数组'); sys.exit(1)

    _login(args.email, args.password)
    ts = int(time.time())
    ok, fail, results = 0, 0, []

    for i, it in enumerate(items):
        title = it.get('title')
        if not title:
            print(f'  [{i:>3}] ✗ 缺少 title，跳过'); fail += 1
            continue
        try:
            res_body = _resolve_body(it.get('body'), it.get('body_file'), it.get('template'))
        except ValueError as e:
            print(f'  [{i:>3}] ✗ {title}: {e}'); fail += 1
            continue
        if res_body is None:
            print(f'  [{i:>3}] ✗ {title}: 需要 body/body_file/template 之一'); fail += 1
            continue

        url, iid, err = _create_mock_once(title, res_body, path=it.get('path'), ts_suffix=f'{ts}_{i}')
        if err:
            print(f'  [{i:>3}] ✗ {title}: {err}'); fail += 1
            continue

        # 可选：启用高级 Mock 脚本
        adv_script = None
        try:
            adv_script = _resolve_script(it.get('advmock_script'), it.get('advmock_file'))
        except Exception as e:
            print(f'  [{i:>3}] ⚠️ {title}: advmock 脚本读取失败 {e}')
        if adv_script:
            adv_ok, adv_err = _set_advmock(iid, adv_script, enable=True)
            if not adv_ok:
                print(f'  [{i:>3}] ⚠️ {title}: advmock 写入失败 {adv_err}')

        ok += 1
        results.append({'index': i, 'title': title, 'id': iid, 'url': url,
                        'advmock': bool(adv_script)})
        flag = ' [advmock]' if adv_script else ''
        print(f'  [{i:>3}] ✓ {title[:40]:<40} → {url}{flag}')

    print(f'\n批量完成: ✓ {ok}  ✗ {fail}  共 {len(items)}')

    # 可选：把结果写到 JSON 文件，便于后续绑定脚本引用
    if args.out_file:
        with open(args.out_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        print(f'结果写入: {args.out_file}')


def cmd_list(args):
    _login(args.email, args.password)
    r = _req('GET', '/api/interface/list', params={
        'project_id': PROJ_ID, 'page': 1, 'limit': 50
    })
    items = ((r.get('data') or {}).get('list') or [])
    if not items:
        print('（无接口）')
        return
    print(f'{"ID":<8} {"标题":<30} {"路径"}')
    print('-' * 70)
    for it in items:
        print(f'{it["_id"]:<8} {it["title"]:<30} {BASEPATH}{it["path"]}')
        print(f'         Mock URL: {mock_url(it["path"])}')


def cmd_delete(args):
    _login(args.email, args.password)
    # 查找接口 ID
    r = _req('GET', '/api/interface/list', params={
        'project_id': PROJ_ID, 'page': 1, 'limit': 100
    })
    items = ((r.get('data') or {}).get('list') or [])
    targets = [it for it in items if it.get('title') == args.title]
    if not targets:
        print(f'未找到标题为"{args.title}"的接口')
        return
    for it in targets:
        dr = _req('POST', '/api/interface/del', {'id': it['_id']})
        print(f'删除 {it["title"]} (id={it["_id"]}): errcode={dr.get("errcode")}')


def cmd_update(args):
    _login(args.email, args.password)
    # 查找接口
    r = _req('GET', '/api/interface/list', params={
        'project_id': PROJ_ID, 'page': 1, 'limit': 100
    })
    items = ((r.get('data') or {}).get('list') or [])
    targets = [it for it in items if it.get('title') == args.title]
    if not targets:
        print(f'未找到标题为"{args.title}"的接口')
        return

    if args.template:
        res_body = json.dumps(TEMPLATES[args.template], ensure_ascii=False)
    elif args.body:
        res_body = args.body
    else:
        print('必须提供 --body 或 --template')
        sys.exit(1)

    for it in targets:
        payload = dict(it)
        payload['_id'] = it['_id']
        payload['res_body'] = res_body
        payload['res_body_type'] = 'raw'
        ur = _req('POST', '/api/interface/save', payload)
        print(f'更新 {it["title"]} (id={it["_id"]}): errcode={ur.get("errcode")}')
        print(f'Mock URL: {mock_url(it["path"])}')


# ── CLI 入口 ───────────────────────────────────────────────────────────────────

def main():
    global _yapi_base
    parser = argparse.ArgumentParser(description='YApi Mock 接口管理（claude AI 项目）')
    sub = parser.add_subparsers(dest='cmd', required=True)

    # 公共参数
    def add_common(p):
        p.add_argument('yapi_base', help='YApi 地址，如 https://api.jeecg.com')
        p.add_argument('email',    help='YApi 账号 Email')
        p.add_argument('password', help='YApi 密码')

    # create-mock
    pm = sub.add_parser('create-mock', help='创建 mock 接口')
    add_common(pm)
    pm.add_argument('--title',     required=True, help='接口标题')
    pm.add_argument('--path',      help='接口路径（默认自动生成）')
    pm.add_argument('--body',      help='JSON 响应体字符串')
    pm.add_argument('--body-file', help='从文件读取响应体')
    pm.add_argument('--template',  help=f'内置数据模板: {list(TEMPLATES.keys())}')
    pm.add_argument('--advmock-script', dest='advmock_script',
                    help='高级 Mock 脚本内容（联动/钻取时按 params.xxx 分支返回，用 mockJson={...} 赋值）')
    pm.add_argument('--advmock-file',   dest='advmock_file',
                    help='从文件读取高级 Mock 脚本（--advmock-script / --advmock-file 二选一）')

    # set-advmock
    psa = sub.add_parser('set-advmock', help='给已有接口启用/更新高级 Mock 脚本')
    add_common(psa)
    psa.add_argument('--iface-id', required=True, dest='iface_id', help='接口 ID')
    psa.add_argument('--script',       help='脚本内容')
    psa.add_argument('--script-file',  dest='script_file', help='从文件读取脚本')
    psa.add_argument('--disable', action='store_true', help='禁用（默认启用）')

    # create-mock-batch: 一次登录 + 批量创建（避免多次 CLI 调用的反复登录）
    pmb = sub.add_parser('create-mock-batch', help='批量创建 mock 接口（一次登录）')
    add_common(pmb)
    pmb.add_argument('--batch-file', required=True,
                     help='JSON 数组文件，每项 {title, path?, body|body_file|template}')
    pmb.add_argument('--out-file', help='把创建结果（含 mock URL）写入此 JSON 文件，供后续脚本使用')

    # list
    pl = sub.add_parser('list', help='列出接口')
    add_common(pl)

    # delete
    pd = sub.add_parser('delete', help='删除接口')
    add_common(pd)
    pd.add_argument('--title', required=True, help='接口标题')

    # update
    pu = sub.add_parser('update', help='更新接口 res_body')
    add_common(pu)
    pu.add_argument('--title',    required=True)
    pu.add_argument('--body',     help='新的 JSON 响应体')
    pu.add_argument('--template', help='内置数据模板')

    args = parser.parse_args()
    _yapi_base = args.yapi_base.rstrip('/')

    if   args.cmd == 'create-mock':       cmd_create_mock(args)
    elif args.cmd == 'create-mock-batch': cmd_create_mock_batch(args)
    elif args.cmd == 'set-advmock':       cmd_set_advmock(args)
    elif args.cmd == 'list':              cmd_list(args)
    elif args.cmd == 'delete':            cmd_delete(args)
    elif args.cmd == 'update':            cmd_update(args)


if __name__ == '__main__':
    main()
