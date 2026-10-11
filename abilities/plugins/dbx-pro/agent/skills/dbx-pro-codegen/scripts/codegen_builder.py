#!/usr/bin/env python3
"""codegen_builder.py — dbx-pro 模板代码生成。
对应 JeecgBoot codegen.py + FtlRunner.java — 表结构 → CRUD 骨架文件。
"""
from __future__ import annotations
import argparse, json, os, sys, urllib.request

PORT = int(os.environ.get("DBX_PRO_PORT", "38123"))

def api(path, body, port=PORT):
    req = urllib.request.Request(f"http://127.0.0.1:{port}{path}",
        data=json.dumps(body).encode(), headers={"Content-Type":"application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r: return json.loads(r.read().decode())

def main():
    p = argparse.ArgumentParser(description="dbx-pro template code generator")
    p.add_argument("--action", choices=["generate","save","list"], required=True)
    p.add_argument("--table", help="表名（generate 必填）")
    p.add_argument("--name", help="实体名（generate 必填，默认取 table）")
    p.add_argument("--columns", help='列 JSON，例如 \'[{"name":"id","type":"bigint"},{"name":"name","type":"varchar"}]\'')
    p.add_argument("--columns-file", help="从文件读 columns JSON")
    p.add_argument("--templates", default="controller,entity,api", help="模板列表（逗号分隔）")
    p.add_argument("--output", help="生成文件目录")
    p.add_argument("--port", type=int, default=PORT)
    a = p.parse_args()

    if a.action == "generate":
        if not a.table: print("❌ --table 必填", file=sys.stderr); return 1
        if a.columns_file:
            with open(a.columns_file, encoding="utf-8") as f: columns = json.load(f)
        elif a.columns:
            try: columns = json.loads(a.columns)
            except: print("❌ --columns 必须是有效 JSON 数组", file=sys.stderr); return 1
        else: print("❌ --columns 或 --columns-file 必填", file=sys.stderr); return 1
        body = {
            "table": a.table,
            "name": a.name or a.table,
            "columns": columns,
            "templates": [t.strip() for t in a.templates.split(",") if t.strip()],
        }
    else:
        body = {"name": a.name} if a.name else {}

    try: resp = api(f"/api/codegen/{a.action}", body, a.port)
    except Exception as e: print(f"❌ {e}", file=sys.stderr); return 3
    if not resp.get("ok", True): print(f"❌ {resp.get('error')}", file=sys.stderr); return 2

    data = resp.get("data", resp)
    if a.action == "generate" and a.output and data.get("files"):
        os.makedirs(a.output, exist_ok=True)
        for f in data["files"]:
            out_path = os.path.join(a.output, f["path"])
            os.makedirs(os.path.dirname(out_path), exist_ok=True)
            with open(out_path, "w", encoding="utf-8") as fh:
                fh.write(f["content"])
        print(f"✅ {len(data['files'])} 个文件已写入 {a.output}")
    else:
        print(json.dumps(data, ensure_ascii=False, indent=2))
    return 0

if __name__ == "__main__": sys.exit(main())
