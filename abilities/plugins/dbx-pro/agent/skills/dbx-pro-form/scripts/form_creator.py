#!/usr/bin/env python3
"""
form_creator.py — dbx-pro 表单设计 JSON CRUD。

用法：
  python3 scripts/form_creator.py --action save    --name "用户表单" --data '{...}'
  python3 scripts/form_creator.py --action query   --id <uuid>
  python3 scripts/form_creator.py --action list    [--keyword 关键词]
  python3 scripts/form_creator.py --action delete  --id <uuid>

对应 JeecgBoot /desform/add /desform/queryById /desform/head/list。
插件侧存 DuckDB JSON blob，AI 侧由宿主 open-astravia 处理表单渲染/执行。
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request


DEFAULT_PORT = int(os.environ.get("DBX_PRO_PORT", "38123"))


def api(port: int, path: str, body: dict | None = None) -> dict:
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    p = argparse.ArgumentParser(description="dbx-pro form design CRUD")
    p.add_argument("--action", choices=["save", "query", "list", "delete"], required=True)
    p.add_argument("--name", help="表单名称（save 必填）")
    p.add_argument("--data", help="表单设计 JSON 字符串或文件路径（save 必填）")
    p.add_argument("--id", help="记录 id（query/delete 必填）")
    p.add_argument("--keyword", default="", help="列表关键词")
    p.add_argument("--port", type=int, default=DEFAULT_PORT)
    p.add_argument("--data-file", help="从文件读 data（优先于 --data 字符串）")
    args = p.parse_args()

    body: dict = {}
    if args.action == "save":
        if not args.name:
            print("❌ --name 必填", file=sys.stderr); return 1
        data = None
        if args.data_file:
            with open(args.data_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        elif args.data:
            try: data = json.loads(args.data)
            except json.JSONDecodeError: data = args.data  # XML 字符串也允许
        if data is None:
            print("❌ --data 或 --data-file 必填", file=sys.stderr); return 1
        body = {"name": args.name, "data": data}
        if args.id: body["id"] = args.id
    elif args.action == "query":
        if not args.id: print("❌ --id 必填", file=sys.stderr); return 1
        body = {"id": args.id}
    elif args.action == "list":
        body = {"keyword": args.keyword}
    elif args.action == "delete":
        if not args.id: print("❌ --id 必填", file=sys.stderr); return 1
        body = {"id": args.id}

    try:
        resp = api(args.port, f"/api/form/{args.action}", body)
    except Exception as e:
        print(f"❌ 调用失败: {e}", file=sys.stderr); return 3

    if not resp.get("ok", True):
        print(f"❌ API error: {resp.get('error')}", file=sys.stderr); return 2

    data = resp.get("data", resp)
    print(json.dumps(data, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
