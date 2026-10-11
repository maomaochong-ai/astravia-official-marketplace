#!/usr/bin/env python3
"""
report_builder.py — dbx-pro report SQL → 行列表 + 分组合计

用法：
  python3 scripts/report_builder.py --connection <name> --sql "SELECT ..." [--groupBy a,b] [--format csv|table]

与 jimureport 的 26 个 Python 脚本同构，但用 dbx MCP 直连而非 JeecgBoot API。
"""
from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
import urllib.request


DEFAULT_PORT = int(os.environ.get("DBX_PRO_PORT", "38123"))


def api_call(port: int, path: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def format_table(columns: list[str], rows: list[dict]) -> str:
    if not rows:
        return "(空结果)"
    widths = [max(len(c), *(len(str(r.get(c, ""))) for r in rows)) for c in columns]
    header = " | ".join(c.ljust(widths[i]) for i, c in enumerate(columns))
    sep = "-+-".join("-" * w for w in widths)
    lines = [header, sep]
    for row in rows:
        cells = [str(row.get(c, "")).ljust(widths[i]) for i, c in enumerate(columns)]
        suffix = ""
        if row.get("_isSubtotal"):
            suffix = "  (小计)"
        elif row.get("_isGrandTotal"):
            suffix = "  (合计)"
        lines.append(" | ".join(cells) + suffix)
    return "\n".join(lines)


def format_csv(columns: list[str], rows: list[dict]) -> str:
    buf = io.StringIO()
    w = csv.writer(buf, quoting=csv.QUOTE_MINIMAL)
    w.writerow(columns)
    for row in rows:
        if row.get("_isSubtotal") or row.get("_isGrandTotal"):
            continue
        w.writerow([row.get(c, "") for c in columns])
    return buf.getvalue()


def main() -> int:
    parser = argparse.ArgumentParser(description="dbx-pro report builder")
    parser.add_argument("--connection", required=True, dest="connectionName")
    parser.add_argument("--sql", required=True)
    parser.add_argument("--groupBy", default="", help="分组字段（逗号分隔）")
    parser.add_argument("--format", default="table", choices=["table", "csv"])
    parser.add_argument("--maxRows", type=int, default=1000)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    args = parser.parse_args()

    body = {
        "connectionName": args.connectionName,
        "sql": args.sql,
        "maxRows": args.maxRows,
        "options": {"groupBy": [s.strip() for s in args.groupBy.split(",") if s.strip()]},
    }

    try:
        resp = api_call(args.port, "/api/report/exec", body)
    except Exception as e:
        print(f"❌ 报告执行失败: {e}", file=sys.stderr)
        return 3

    if not resp.get("ok", True):
        print(f"❌ API error: {resp.get('error')}", file=sys.stderr)
        return 2

    data = resp.get("data", resp)
    columns = data.get("columns", [])
    rows = data.get("rows", [])

    if args.format == "csv":
        sys.stdout.write(format_csv(columns, rows))
    else:
        sys.stdout.write(format_table(columns, rows))

    print(f"\n📊 共 {len(rows)} 行（含小计/合计）", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
