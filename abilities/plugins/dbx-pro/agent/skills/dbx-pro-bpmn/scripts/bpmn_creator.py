#!/usr/bin/env python3
"""bpmn_creator.py — dbx-pro BPMN 流程设计存储（设计态）。
对应 JeecgBoot /act/designer/api/saveProcess — 存 BPMN XML + 节点配置 JSON。
流程部署/执行需要 Flowable 引擎 → 由宿主 open-astravia 处理。
"""
from __future__ import annotations
import argparse, json, os, sys, urllib.request

PORT = int(os.environ.get("DBX_PRO_PORT", "38123"))

def api(path, body, port=PORT):
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}",
        data=json.dumps(body).encode(), headers={"Content-Type":"application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read().decode())

def main():
    p = argparse.ArgumentParser(description="dbx-pro BPMN design CRUD（设计态存储）")
    p.add_argument("--action", choices=["save","query","list","delete"], required=True)
    p.add_argument("--name"); p.add_argument("--id"); p.add_argument("--keyword", default="")
    p.add_argument("--xml", help="BPMN XML 字符串")
    p.add_argument("--xml-file", help="BPMN XML 文件路径")
    p.add_argument("--nodes", help="节点配置 JSON")
    p.add_argument("--port", type=int, default=PORT)
    a = p.parse_args()

    body = {}
    if a.action == "save":
        if not a.name: print("❌ --name 必填", file=sys.stderr); return 1
        data = {}
        if a.xml_file:
            with open(a.xml_file, encoding="utf-8") as f: data["xml"] = f.read()
        elif a.xml:
            data["xml"] = a.xml
        if a.nodes:
            try: data["nodes"] = json.loads(a.nodes)
            except: pass
        body = {"name": a.name, "data": data}
        if a.id: body["id"] = a.id
    elif a.action in ("query","delete"):
        if not a.id: print("❌ --id 必填", file=sys.stderr); return 1
        body = {"id": a.id}
    elif a.action == "list":
        body = {"keyword": a.keyword}

    try: resp = api(f"/api/bpmn/{a.action}", body, a.port)
    except Exception as e: print(f"❌ {e}", file=sys.stderr); return 3
    if not resp.get("ok", True): print(f"❌ {resp.get('error')}", file=sys.stderr); return 2
    print(json.dumps(resp.get("data", resp), ensure_ascii=False, indent=2)); return 0

if __name__ == "__main__": sys.exit(main())
