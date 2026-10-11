#!/usr/bin/env python3
"""
spec_builder.py — dbx-pro bigscreen spec → JimuBI 组件 JSON / HTML 预览

用法：
  python3 scripts/spec_builder.py --spec ./spec.json [--port 38123] [--dry] [--output out.json] [--render]

与 jeecgboot jimubi-bigscreen 的 Python spec_builder.py 同构：
  - jeecgboot: POST /jmreport/bigscreen/page/save → 返回 JimuBI 组件 JSON
  - dbx-pro:   POST /api/bigscreen/compile       → 返回 JimuBI 组件 JSON（同构）

零外部依赖（只用 urllib / json / sys），任何 Python 3.8+ 环境可跑。
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request


DEFAULT_PORT = int(os.environ.get("DBX_PRO_PORT", "38123"))


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="dbx-pro bigscreen spec builder（JimuBI 组件 JSON 输出）",
    )
    p.add_argument("--spec", required=True, help="spec JSON 文件路径")
    p.add_argument("--port", type=int, default=DEFAULT_PORT, help=f"dbx-pro server 端口（默认 {DEFAULT_PORT}）")
    p.add_argument("--dry", action="store_true", help="只 compile 不做额外处理，输出完整 JSON")
    p.add_argument("--render", action="store_true", help="调 render 端点返回 HTML 预览（调试用）")
    p.add_argument("-o", "--output", help="输出文件（compile 默认 stdout JSON，--render 默认 stdout HTML）")
    p.add_argument("--engine", default="echarts", help="渲染引擎（默认 echarts）")
    return p


def api_call(base: str, path: str, body: dict) -> dict:
    url = f"{base}{path}"
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"连接失败：{e.reason}（dbx-pro server 是否已启动？）") from e


def main() -> int:
    args = build_parser().parse_args()
    try:
        with open(args.spec, "r", encoding="utf-8") as f:
            spec = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        print(f"❌ 读 spec 失败: {e}", file=sys.stderr)
        return 1

    endpoint = "/api/bigscreen/render" if args.render else "/api/bigscreen/compile"
    base = f"http://127.0.0.1:{args.port}"

    try:
        resp = api_call(base, endpoint, {"spec": spec, "engine": args.engine})
    except RuntimeError as e:
        print(f"❌ 构建失败: {e}", file=sys.stderr)
        return 3

    if not resp.get("ok", True):
        print(f"❌ API error: {resp.get('error')}", file=sys.stderr)
        return 2

    data = resp.get("data", resp)

    # --- render 路径 ---
    if args.render:
        html = data.get("html", "")
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(html)
            print(f"✅ HTML 预览已写入 {args.output}（{len(html):,} 字节）")
        else:
            sys.stdout.write(html)
        return 0

    # --- compile 路径 ---
    if args.dry:
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0

    page = data.get("page") or {}
    palette = data.get("palette") or {}
    components = data.get("components") or []
    warnings = data.get("warnings") or []

    print(f"📊 大屏: {page.get('name', 'untitled')} "
          f"({page.get('width', '?')}×{page.get('height', '?')}, {palette.get('name', '?')})")
    print(f"📦 组件数: {len(components)}")
    for c in components:
        if c.get("error"):
            print(f"  ❌ {c.get('type')}: {c['error']}")
        else:
            cfg = c.get("cfg") or {}
            print(f"  ✅ {c.get('type', '?'):<22} w={cfg.get('w')} h={cfg.get('h')} dataType={cfg.get('dataType')}")

    if warnings:
        print(f"\n⚠️  警告 {len(warnings)} 条:")
        for w in warnings:
            print(f"  {w}")

    # 组件 JSON 数组输出到文件
    if args.output:
        payload = [{"type": c.get("type"), "title": c.get("title"), "cfg": c.get("cfg")} for c in components]
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        print(f"\n✅ 组件 JSON 已写入 {args.output}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
