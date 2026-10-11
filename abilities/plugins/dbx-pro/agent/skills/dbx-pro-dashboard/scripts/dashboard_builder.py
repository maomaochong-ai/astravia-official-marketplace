#!/usr/bin/env python3
"""
dashboard_builder.py — dbx-pro dashboard spec → JimuBI 组件 JSON

与 bigscreen 共享 compile 引擎，只是默认 palette=biz（亮色主题）、theme=light。
Agent 调用同 spec_builder.py，只加了 --palette / --theme 默认值。
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request


DEFAULT_PORT = int(os.environ.get("DBX_PRO_PORT", "38123"))


def api_call(base: str, path: str, body: dict) -> dict:
    url = f"{base}{path}"
    req = urllib.request.Request(
        url, data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description="dbx-pro dashboard builder（默认亮色 biz 主题）")
    parser.add_argument("--spec", required=True)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--dry", action="store_true")
    parser.add_argument("-o", "--output")
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--palette", default="biz", help="默认 biz（亮色）")
    parser.add_argument("--theme", default="light", help="默认 light")
    args = parser.parse_args()

    with open(args.spec, "r", encoding="utf-8") as f:
        spec = json.load(f)

    # 强制应用 dashboard 默认值（可被 spec 内字段覆盖）
    spec.setdefault("page", {})
    spec["page"].setdefault("theme", args.theme)
    spec.setdefault("palette", args.palette)

    try:
        endpoint = "/api/bigscreen/render" if args.render else "/api/bigscreen/compile"
        resp = api_call(f"http://127.0.0.1:{args.port}", endpoint, {"spec": spec, "engine": "echarts"})
    except RuntimeError as e:
        print(f"❌ 构建失败: {e}", file=sys.stderr)
        return 3

    if not resp.get("ok", True):
        print(f"❌ API error: {resp.get('error')}", file=sys.stderr)
        return 2

    data = resp.get("data", resp)

    if args.render:
        html = data.get("html", "")
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(html)
            print(f"✅ Dashboard HTML 预览已写入 {args.output}（{len(html):,} 字节）")
        else:
            sys.stdout.write(html)
        return 0

    if args.dry:
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0

    page = data.get("page") or {}
    components = data.get("components") or []
    print(f"📊 Dashboard: {page.get('name', 'untitled')} "
          f"({page.get('width', '?')}×{page.get('height', '?')}, {spec.get('palette')})")
    print(f"📦 组件数: {len(components)}")
    for c in components:
        if c.get("error"):
            print(f"  ❌ {c.get('type')}: {c['error']}")
        else:
            cfg = c.get("cfg") or {}
            print(f"  ✅ {c.get('type', '?'):<22} w={cfg.get('w')} h={cfg.get('h')}")

    if args.output:
        payload = [{"type": c.get("type"), "title": c.get("title"), "cfg": c.get("cfg")} for c in components]
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"\n✅ 组件 JSON 已写入 {args.output}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
