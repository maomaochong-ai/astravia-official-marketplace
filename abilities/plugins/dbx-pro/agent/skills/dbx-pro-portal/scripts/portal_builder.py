#!/usr/bin/env python3
"""portal_builder.py — dbx-pro 门户设计 JSON CRUD。
对应 JeecgBoot /eoa/portalapp/portalDesign/add。
"""
from __future__ import annotations
import argparse, json, os, sys, urllib.request

PORT = int(os.environ.get("DBX_PRO_PORT", "38123"))

def api(path, body, port=PORT):
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}",
        data=json.dumps(body).encode(), headers={"Content-Type":"application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read().decode())

def main():
    p = argparse.ArgumentParser(description="dbx-pro portal design CRUD")
    p.add_argument("--action", choices=["save","query","list","delete"], required=True)
    p.add_argument("--name"); p.add_argument("--id"); p.add_argument("--keyword", default="")
    p.add_argument("--data", help="门户设计 JSON 字符串"); p.add_argument("--data-file")
    p.add_argument("--port", type=int, default=PORT)
    a = p.parse_args()

    body = {}
    if a.action == "save":
        if not a.name: print("❌ --name 必填", file=sys.stderr); return 1
        if a.data_file:
            with open(a.data_file, encoding="utf-8") as f: body["data"] = json.load(f)
        elif a.data:
            try: body["data"] = json.loads(a.data)
            except: body["data"] = a.data
        else: print("❌ --data 或 --data-file 必填", file=sys.stderr); return 1
        body["name"] = a.name
        if a.id: body["id"] = a.id
    elif a.action in ("query","delete"):
        if not a.id: print("❌ --id 必填", file=sys.stderr); return 1
        body = {"id": a.id}
    elif a.action == "list":
        body = {"keyword": a.keyword}

    try: resp = api(f"/api/portal/{a.action}", body, a.port)
    except Exception as e: print(f"❌ {e}", file=sys.stderr); return 3
    if not resp.get("ok", True): print(f"❌ {resp.get('error')}", file=sys.stderr); return 2
    print(json.dumps(resp.get("data", resp), ensure_ascii=False, indent=2)); return 0

if __name__ == "__main__": sys.exit(main())
