#!/usr/bin/env python3
"""
dbx-pro engine — Python server 入口。

与 Node 版 server/main.mjs 协议完全对齐：
  命令行: --port <n>  --data <dir>  --auth-disabled
  环境变量: ASTRAVIA_SERVICE_SECRET_ENGINE_KEY
  HTTP endpoints:
    GET  /health                   宿主健康检查
    POST /mcp                      MCP HTTP transport (initialize / tools/list / tools/call)
    POST /api/*                    REST API handler (Phase 3 移植)

Phase 1 实现: 入口 + 鉴权 + /health + spawn dbx-mcp + /mcp 握手通
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import signal
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

# 让 python main.py 直接可跑（server/ 即引擎根）
_SERVER_DIR = Path(__file__).resolve().parent   # .../dbx-pro/server/  ← binary 也在这的 bin/
_SERVER_PY_DIR = _SERVER_DIR
sys.path.insert(0, str(_SERVER_PY_DIR))

from engine.protocol import (  # noqa: E402 — sys.path 调整后 import
    ENGINE_VERSION,
    PROTOCOL_VERSION,
    MAX_BODY_BYTES,
    http_status_for_code,
    engine_error,
    is_engine_error,
)
from engine.dbx_mcp_client import DbxMcpClient  # noqa: E402


HOST = "127.0.0.1"
SECRET_KEY_ENV = "ASTRAVIA_SERVICE_SECRET_ENGINE_KEY"


# ─── 鉴权 ─────────────────────────────────────────────────────────────────

class Auth:
    def __init__(self, token: str | None, disabled: bool = False) -> None:
        self.enabled = not disabled and bool(token)
        self._expected = hashlib.sha256(token.encode("utf-8")).digest() if self.enabled else None

    def verify(self, headers: dict[str, str]) -> None:
        if not self.enabled:
            return
        presented = ""
        auth = headers.get("authorization") or headers.get("Authorization") or ""
        if auth:
            m = auth.strip().lower()
            if m.startswith("bearer "):
                presented = auth.strip()[7:].strip()
        if not presented:
            presented = (headers.get("x-dbx-token") or "").strip()
        if not presented or self._expected is None:
            raise engine_error("UNAUTHORIZED", "缺少或无效的引擎访问令牌")
        digest = hashlib.sha256(presented.encode("utf-8")).digest()
        if not hmac.compare_digest(digest, self._expected):
            raise engine_error("UNAUTHORIZED", "缺少或无效的引擎访问令牌")


# ─── 单例客户端 ───────────────────────────────────────────────────────────

_client: DbxMcpClient | None = None
_auth: Auth | None = None


def get_client() -> DbxMcpClient:
    global _client
    if _client is None:
        raise RuntimeError("dbx-mcp client not initialized")
    return _client


def _emit(event: str, payload: dict[str, Any] | None = None) -> None:
    msg = {"event": event, "version": ENGINE_VERSION}
    if payload:
        msg.update(payload)
    print(json.dumps(msg), flush=True)


# ─── HTTP Handler ─────────────────────────────────────────────────────────

class EngineHandler(BaseHTTPRequestHandler):
    server_version = f"dbx-pro-engine-py/{ENGINE_VERSION}"

    def log_message(self, fmt: str, *args: Any) -> None:  # noqa: D401 — 标准 hook
        # 静默日志（宿主通过 emit() 读结构化事件，不走 stderr 文本）
        pass

    # ── 通用工具 ─────────────────────────────────────────────────────────

    def _send_json(self, status: int, body: dict[str, Any]) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json; charset=utf-8")
        self.send_header("content-length", str(len(payload)))
        self.send_header("cache-control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def _read_body(self) -> Any:
        length = int(self.headers.get("content-length", "0") or 0)
        if length > MAX_BODY_BYTES:
            raise engine_error(
                "PAYLOAD_TOO_LARGE",
                f"请求体超过 {MAX_BODY_BYTES} 字节",
            )
        if length == 0:
            return None
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise engine_error("BAD_REQUEST", f"请求体不是合法 JSON：{exc}")

    # ── 路由 ────────────────────────────────────────────────────────────

    def do_GET(self) -> None:  # noqa: N802 — http.server hook
        path = self._parse_path()[0]
        try:
            if path == "/health":
                self._handle_health()
            else:
                self._send_json(404, {"ok": False, "error": {"code": "NOT_FOUND", "message": f"未实现路径: {path}"}})
        except Exception as exc:  # pragma: no cover — 异常兜底
            self._send_exception(exc)

    def do_POST(self) -> None:  # noqa: N802 — http.server hook
        path = self._parse_path()[0]
        try:
            if path == "/mcp":
                self._handle_mcp()
            elif path.startswith("/api/") or path == "/api":
                self._handle_rest()  # Phase 3 移植 stub
            else:
                self._send_json(404, {"ok": False, "error": {"code": "NOT_FOUND", "message": f"未实现路径: {path}"}})
        except Exception as exc:
            self._send_exception(exc)

    # ── 具体 handler ────────────────────────────────────────────────────

    def _parse_path(self) -> tuple[str, dict[str, str]]:
        raw = self.path or "/"
        path, _, query = raw.partition("?")
        params: dict[str, str] = {}
        if query:
            for pair in query.split("&"):
                k, _, v = pair.partition("=")
                if k:
                    params[k] = v
        return path, params

    def _send_exception(self, exc: Exception) -> None:
        if is_engine_error(exc):
            self._send_json(http_status_for_code(exc.code), {"ok": False, "error": {"code": exc.code, "message": exc.message}})
            return
        _emit("request-error", {"path": self.path, "error": str(exc)})
        self._send_json(500, {"ok": False, "error": {"code": "INTERNAL", "message": str(exc)}})

    def _handle_health(self) -> None:
        global _client
        # 后台触发 client connect（不阻塞 /health）
        if _client and _client._phase in ("idle", "connecting"):
            threading.Thread(target=_client.connect, daemon=True).start()

        client_ready = _client is not None and _client._phase == "ready"
        self._send_json(
            200,
            {
                "ok": True,
                "status": "ready" if client_ready else "starting",
                "version": ENGINE_VERSION,
                "protocol": PROTOCOL_VERSION,
                "backend": "dbx-mcp",
                "auth": _auth.enabled if _auth else False,
            },
        )

    def _handle_mcp(self) -> None:
        global _auth, _client
        if _auth:
            _auth.verify(dict(self.headers))
        rpc = self._read_body() or {}
        if not isinstance(rpc, dict):
            raise engine_error("BAD_REQUEST", "MCP 请求体必须是 JSON-RPC 2.0 对象")

        request_id = rpc.get("id")
        method = rpc.get("method")
        params = rpc.get("params", {})

        try:
            if method == "initialize":
                client = get_client()
                client.ensure_initialized()
                self._send_json(
                    200,
                    {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": {
                            "protocolVersion": "2024-11-05",
                            "capabilities": {"tools": {}},
                            "serverInfo": {"name": "dbx-pro", "version": ENGINE_VERSION},
                        },
                    },
                )
                return

            client = get_client()
            if method == "notifications/initialized":
                # 客户端已 initialize 过，不需要回 JSON-RPC
                self._send_json(202, {})
                return

            if method == "tools/list":
                tools = client.list_tools()
                self._send_json(200, {"jsonrpc": "2.0", "id": request_id, "result": {"tools": tools}})
                return

            if method == "tools/call":
                name = params.get("name") if isinstance(params, dict) else None
                args = params.get("arguments", {}) if isinstance(params, dict) else {}
                if not name:
                    self._send_json(200, {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32602, "message": "Missing tool name"}})
                    return
                try:
                    call_result = client.call_tool(name, args)
                    # MCP 规定工具级失败用 result.isError 表达，不是 JSON-RPC error
                    self._send_json(200, {"jsonrpc": "2.0", "id": request_id, "result": call_result})
                except Exception as exc:
                    _emit("mcp-error", {"method": method, "tool": name, "message": str(exc)})
                    self._send_json(
                        200,
                        {
                            "jsonrpc": "2.0",
                            "id": request_id,
                            "result": {"isError": True, "content": [{"type": "text", "text": str(exc)}]},
                        },
                    )
                return

            self._send_json(200, {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32601, "message": f"Unsupported MCP method: {method}"}})

        except Exception as exc:
            _emit("mcp-error", {"method": method, "message": str(exc)})
            self._send_json(200, {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32603, "message": str(exc)}})

    def _handle_rest(self) -> None:
        """Phase 3 之前的 stub：REST API handler 逐个移植进来。"""
        self._send_json(
            501,
            {
                "ok": False,
                "error": {
                    "code": "NOT_IMPLEMENTED",
                    "message": f"REST endpoint not yet ported to Python: {self.path}",
                },
            },
        )


# ─── 入口 ─────────────────────────────────────────────────────────────────

def _parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="dbx-engine",
        description="dbx-pro engine (dbx-mcp bridge, Python rewrite)",
        add_help=True,
    )
    p.add_argument("--port", type=int, default=0, help="Listen port (0 = random)")
    p.add_argument("--data", type=str, default=None, help="Service data directory (dbx-mcp stores dbx.db here)")
    p.add_argument("--auth-disabled", action="store_true", help="Disable token auth (local dev only)")
    return p.parse_args(argv)


def main() -> None:
    global _client, _auth

    args = _parse_args(sys.argv[1:])

    # 鉴权
    token = os.environ.get(SECRET_KEY_ENV)
    if not args.auth_disabled and (not token):
        _emit(
            "server-error",
            {"code": "NO_SECRET", "message": f"缺少引擎访问令牌（{SECRET_KEY_ENV} 未设置）；本地调试加 --auth-disabled"},
        )
        sys.exit(1)
    _auth = Auth(token, disabled=args.auth_disabled)
    if args.auth_disabled:
        _emit("auth-disabled", {"reason": "flag"})

    # 初始化 dbx-mcp client（后台 connect，不阻塞 listen）
    server_dir = _SERVER_DIR
    _client = DbxMcpClient(server_dir=server_dir, data_dir=args.data, extra_env={})
    threading.Thread(target=_client.connect, daemon=True).start()

    # HTTP server
    try:
        server = ThreadingHTTPServer((HOST, args.port), EngineHandler)
    except OSError as exc:
        _emit("server-error", {"code": "BIND_FAILED", "message": str(exc)})
        sys.exit(1)

    # 优雅关闭
    def _shutdown(_signum: int | None = None, _frame: Any = None) -> None:
        _emit("shutdown")
        try:
            server.shutdown()
        except Exception:
            pass
        try:
            if _client:
                _client.dispose()
        except Exception:
            pass
        sys.exit(0)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    address = server.socket.getsockname()
    port = address[1] if isinstance(address, tuple) else args.port
    _emit(
        "listening",
        {
            "host": HOST,
            "port": port,
            "pid": os.getpid(),
            "python": sys.version.split()[0],
            "protocol": PROTOCOL_VERSION,
            "auth": "disabled" if args.auth_disabled else "enabled",
            "dataDir": args.data or os.path.expanduser("~/.astravia-dbx-data"),
            "backend": "dbx-mcp",
        },
    )

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        _shutdown()


if __name__ == "__main__":
    main()
