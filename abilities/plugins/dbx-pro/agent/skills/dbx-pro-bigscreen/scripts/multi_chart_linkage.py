#!/usr/bin/env python3
"""
multi_chart_linkage.py - 多图表+联动批量生成脚本（优化版）

性能对比：
  传统方式（comp_ops.py x N + linkage_ops.py x M）：
    - 每个命令 = 1次query_page + 1次save_page + 进程启动开销
    - 3图+2联动 = 17次API + 5次进程启动 ≈ 35s

  本脚本（单进程批量）：
    - 1次query_page + N次并发dataset创建 + 1次save_page
    - 3图+2联动 ≈ 5次API ≈ 5-8s（节省约80%）

用法：
  py multi_chart_linkage.py <API_BASE> <TOKEN> <PAGE_ID> --db-source <DS_ID>
  py multi_chart_linkage.py <API_BASE> <TOKEN> <PAGE_ID> --db-source <DS_ID> --config my.json

config.json 格式（--config 未指定时使用内置 demo 示例）：
{
  "db_source": "数据源ID",
  "charts": [
    {
      "comp_type": "JBar",
      "title": "各年龄段人数分布",
      "x": 50, "y": 50, "w": 1820, "h": 420,
      "sql": "SELECT age as name, COUNT(*) as value FROM demo GROUP BY age LIMIT 8",
      "fields": [["name", "String"], ["value", "Integer"]],
      "slot_labels": ["维度", "数值"]
    },
    {
      "comp_type": "JPie",
      "title": "男女比例",
      "x": 50, "y": 510, "w": 880, "h": 500,
      "sql": "SELECT sex as name, COUNT(*) as value FROM demo\\n<#if isNotEmpty(name)>\\nWHERE age='${name}'\\n</#if>\\nGROUP BY sex",
      "fields": [["name", "String"], ["value", "Integer"]],
      "slot_labels": ["维度", "数值"],
      "params": "name:年龄::"
    }
  ],
  "linkages": [
    {
      "source": "各年龄段人数分布",
      "targets": [
        {"title": "男女比例", "mapping": {"name": "name"}}
      ]
    }
  ]
}
"""

import sys, os, json, time, copy, argparse
from concurrent.futures import ThreadPoolExecutor, as_completed

def _find_bi_utils():
    candidates = [
        os.path.dirname(os.path.abspath(__file__)),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'),
        os.getcwd(),
    ]
    for d in candidates:
        if os.path.exists(os.path.join(d, 'bi_utils.py')):
            return d
    return None

_bu_dir = _find_bi_utils()
if _bu_dir:
    sys.path.insert(0, _bu_dir)
import bi_utils

t0 = time.time()

PARENT_ID = '1516743332632494082'  # 示例数据集分组（固定值）


def create_dataset_sql(name, sql, field_defs, db_source, param_opts=None):
    """创建SQL数据集，返回 DS_ID。使用 bi_utils._request 直接调API。"""
    suffix = str(int(time.time() * 1000))[-6:]
    code = 'ds_' + ''.join(c if c.isalnum() else '_' for c in name)[:18] + '_' + suffix

    dataset_item_list = [
        {'fieldName': fn, 'fieldTxt': fn, 'fieldType': ft, 'izShow': 'Y', 'orderNum': i}
        for i, (fn, ft) in enumerate(field_defs)
    ]
    payload = {
        'name': name, 'code': code, 'dataType': 'sql',
        'querySql': sql, 'dbSource': db_source,
        'parentId': PARENT_ID, 'datasetItemList': dataset_item_list,
    }
    if param_opts:
        payload['paramOption'] = json.dumps(param_opts, ensure_ascii=False)

    r = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data=payload)
    ds_id = (r.get('result') or {}).get('id')
    if not ds_id:
        raise RuntimeError(f'数据集创建失败 [{name}]: {r}')
    return ds_id


def parse_param_opts(params_str):
    """解析 'name:标签:默认值:dictCode' 格式，返回 paramOption 列表。"""
    if not params_str:
        return None
    result = []
    for p in params_str.split(','):
        parts = (p.strip() + ':::').split(':')
        result.append({
            'paramName': parts[0], 'paramTxt': parts[1],
            'defaultVal': parts[2], 'dictCode': parts[3]
        })
    return result


def main():
    parser = argparse.ArgumentParser(description='多图表+联动批量生成（单脚本优化版）')
    parser.add_argument('api_base', help='API地址，如 http://192.168.x.x:8080/jeecg-boot')
    parser.add_argument('token', help='X-Access-Token')
    parser.add_argument('page_id', help='大屏页面ID')
    parser.add_argument('--db-source', help='数据源ID（覆盖config中的设置）')
    parser.add_argument('--config', help='图表+联动配置JSON文件路径')
    args = parser.parse_args()

    bi_utils.API_BASE = args.api_base
    bi_utils.TOKEN = args.token
    PAGE_ID = args.page_id

    # 加载配置
    if args.config:
        with open(args.config, encoding='utf-8') as f:
            config = json.load(f)
    else:
        config = EXAMPLE_CONFIG

    if args.db_source:
        config = dict(config)
        config['db_source'] = args.db_source

    db_source = config['db_source']
    charts = config['charts']
    linkages = config.get('linkages', [])

    print(f'[开始] {len(charts)} 个图表, {len(linkages)} 组联动, 数据源={db_source}')

    # ── Step 1: 加载页面（1次API）────────────────────────────────────────
    page = bi_utils.query_page(PAGE_ID)
    bi_utils._page_components[PAGE_ID] = page.get('template') or []
    print(f'[1] 页面加载, 现有组件: {len(bi_utils._page_components[PAGE_ID])}')

    defaults = json.load(open('default_configs.json', encoding='utf-8'))

    # ── Step 2: 并发创建数据集（N次并发API，不等待彼此）───────────────────
    def create_for_chart(chart):
        title = chart['title']
        ds_name = chart.get('ds_name', title[:30])
        field_defs = [tuple(f) for f in chart['fields']]
        param_opts = parse_param_opts(chart.get('params', ''))
        ds_id = create_dataset_sql(ds_name, chart['sql'], field_defs, db_source, param_opts)
        return title, ds_id, ds_name

    ds_map = {}   # chart_title -> ds_id
    dsname_map = {}  # chart_title -> ds_name

    with ThreadPoolExecutor(max_workers=min(len(charts), 5)) as executor:
        futures = [executor.submit(create_for_chart, ch) for ch in charts]
        for fut in as_completed(futures):
            title, ds_id, ds_name = fut.result()
            ds_map[title] = ds_id
            dsname_map[title] = ds_name
            print(f'[2] 数据集: {ds_name} -> {ds_id}')

    # ── Step 3: 批量添加组件（纯内存，不触发save）────────────────────────
    comp_ids = {}  # chart_title -> component i (UUID)

    for chart in charts:
        title = chart['title']
        comp_type = chart['comp_type']
        ds_id = ds_map[title]
        ds_name = dsname_map[title]
        slot_labels = chart.get('slot_labels', ['维度', '数值'])
        field_names = [f[0] for f in chart['fields']]
        field_types = [f[1] for f in chart['fields']]

        cfg = copy.deepcopy(defaults.get(comp_type, {}))
        cfg.pop('w', None)
        cfg.pop('h', None)
        cfg['background'] = '#FFFFFF00'
        cfg['borderColor'] = '#FFFFFF00'

        # 处理 option.title（可能是 str 或 dict）
        opt = cfg.get('option', {})
        if isinstance(opt, str):
            try:
                opt = json.loads(opt)
            except Exception:
                opt = {}
            cfg['option'] = opt
        title_opt = opt.get('title')
        if isinstance(title_opt, str):
            opt['title'] = {'text': title, 'show': True}
        elif isinstance(title_opt, dict):
            title_opt['text'] = title

        cfg.update({
            'dataType': 2, 'dataSetId': ds_id, 'dataSetName': ds_name,
            'dataSetType': 'sql', 'dataSetApi': '', 'dataSetMethod': 'get',
            'dataSetIzAgent': '0', 'chartData': '[]',
            'viewLoading': True, 'paramOption': [],
            'dataMapping': [{'filed': s, 'mapping': f}
                            for s, f in zip(slot_labels, field_names)],
            'fieldOption': [{'label': fn, 'text': fn, 'type': ft, 'value': fn, 'show': 'Y'}
                            for fn, ft in zip(field_names, field_types)],
        })
        if 'chartData' in cfg and not isinstance(cfg['chartData'], str):
            cfg['chartData'] = json.dumps(cfg['chartData'], ensure_ascii=False)

        bi_utils.add_component(PAGE_ID, comp_type, title,
                               chart['x'], chart['y'], chart['w'], chart['h'], cfg)

        # add_component 用 insert(0,...) 置顶，所以最新组件在 [0]
        tmpl = bi_utils._page_components[PAGE_ID]
        comp_ids[title] = tmpl[0]['i']
        print(f'[3] 内存组件: {title} ({comp_type}) i={comp_ids[title]}')

    # ── Step 4: 设置联动配置（纯内存修改，不触发save）───────────────────
    if linkages:
        tmpl = bi_utils._page_components[PAGE_ID]
        comp_by_title = {c.get('componentName'): c for c in tmpl}

        for lk in linkages:
            src_title = lk['source']
            src_comp = comp_by_title.get(src_title)
            if not src_comp:
                print(f'[WARN] 源组件未找到: {src_title}')
                continue

            cfg_str = src_comp.get('config', '{}')
            cfg = json.loads(cfg_str) if isinstance(cfg_str, str) else cfg_str

            linkage_entries = []
            for tgt in lk['targets']:
                tgt_id = comp_ids.get(tgt['title'])
                if tgt_id:
                    linkage_entries.append({
                        'linkageId': tgt_id,
                        'linkageField': [{'filed': k, 'mapping': v}
                                         for k, v in tgt['mapping'].items()]
                    })

            cfg['linkageConfig'] = linkage_entries
            src_comp['config'] = json.dumps(cfg, ensure_ascii=False)
            src_comp['linkageConfig'] = linkage_entries
            print(f'[4] 联动: {src_title} -> {[t["title"] for t in lk["targets"]]}')

    # ── Step 5: 单次保存（1次API）────────────────────────────────────────
    bi_utils.save_page(PAGE_ID)

    elapsed = time.time() - t0
    print(f'\n[完成] 耗时: {elapsed:.1f}s | 图表: {len(charts)} | 联动: {len(linkages)}')


# ── 内置 demo 配置（--config 未指定时使用）────────────────────────────────
EXAMPLE_CONFIG = {
    "db_source": "1199602912184721408",
    "charts": [
        {
            "comp_type": "JBar",
            "title": "各年龄段人数分布（点击触发联动）",
            "x": 50, "y": 50, "w": 1820, "h": 420,
            "sql": "SELECT age as name, COUNT(*) as value FROM demo GROUP BY age ORDER BY COUNT(*) DESC LIMIT 8",
            "fields": [["name", "String"], ["value", "Integer"]],
            "slot_labels": ["维度", "数值"]
        },
        {
            "comp_type": "JPie",
            "title": "男女比例（联动目标1）",
            "x": 50, "y": 510, "w": 880, "h": 500,
            "sql": "SELECT sex as name, COUNT(*) as value FROM demo\n<#if isNotEmpty(name)>\nWHERE age = '${name}'\n</#if>\nGROUP BY sex",
            "fields": [["name", "String"], ["value", "Integer"]],
            "slot_labels": ["维度", "数值"],
            "params": "name:年龄::"
        },
        {
            "comp_type": "JScrollBoard",
            "title": "人员薪资列表（联动目标2）",
            "x": 980, "y": 510, "w": 890, "h": 500,
            "sql": "SELECT name as name, salary_money as amount FROM demo\n<#if isNotEmpty(name)>\nWHERE age = '${name}'\n</#if>\nLIMIT 10",
            "fields": [["name", "String"], ["amount", "Integer"]],
            "slot_labels": ["名称", "数值"],
            "params": "name:年龄::"
        }
    ],
    "linkages": [
        {
            "source": "各年龄段人数分布（点击触发联动）",
            "targets": [
                {"title": "男女比例（联动目标1）", "mapping": {"name": "name"}},
                {"title": "人员薪资列表（联动目标2）", "mapping": {"name": "name"}}
            ]
        }
    ]
}


if __name__ == '__main__':
    main()
