"""
dbx_mcp_client — spawn dbx-mcp Rust 二进制，走 stdio JSON-RPC 2.0。

Node 版对应 server/src/engine/dbx-mcp-client.mjs — 行为必须完全对齐：
  - spawn stdio JSON-RPC 进程：initialize → tools/list → tools/call
  - 握手 timeout 默认 60s（HANDSHAKE_TIMEOUT_MS）
  - call timeout 默认 60s（CALL_TIMEOUT_MS）
  - 子进程退出 / error → 所有 pending request reject
  - dispose() kill + 2s 宽限 + SIGKILL 兜底

当前是同步实现（subprocess.Popen + pipe 读写）。
Phase 3 REST API 需要并发时可升级 asyncio。
"""
from __future__ import annotations

import json
import os
import platform as _platform
import shutil
import signal
import subprocess
import threading
import time
from pathlib import Path
from typing import Any

HANDSHAKE_TIMEOUT_MS = 60_000
CALL_TIMEOUT_MS = 60_000
SHUTDOWN_GRACE_MS = 2_000


# ─── 平台识别与二进制路径 ──────────────────────────────────────────────────

def _detect_platform() -> str | None:
    pf = _platform.system()
    arch = _platform.machine()
    if pf == "Darwin":
        return "darwin-arm64" if arch == "arm64" else "darwin-x64"
    if pf == "Windows" and arch == "AMD64":
        return "win32-x64"
    return None


def _resolve_binary_path(server_dir: Path) -> str:
    platform_tag = _detect_platform()
    candidates = {
        "darwin-arm64": server_dir / "bin" / "dbx-mcp-darwin-arm64",
        "darwin-x64": server_dir / "bin" / "dbx-mcp-darwin-x64",
        "win32-x64": server_dir / "bin" / "dbx-mcp-win-x64.exe",
    }
    # 先选当前平台；没有就 fallback 其他有文件的
    preferred = platform_tag
    if preferred and candidates.get(preferred, Path()).exists():
        return str(candidates[preferred])
    for tag in ("darwin-arm64", "darwin-x64", "win32-x64"):
        path = candidates[tag]
        if path.exists():
            return str(path)
    raise FileNotFoundError(
        f"dbx-mcp binary not found (platform={platform_tag}); "
        f"expected one of {[str(p) for p in candidates.values()]}"
    )


def _resolve_data_dir(explicit: str | None) -> str:
    if explicit:
        d = Path(explicit)
        d.mkdir(parents=True, exist_ok=True)
        return str(d)
    d = Path.home() / ".astravia-dbx-data"
    d.mkdir(parents=True, exist_ok=True)
    return str(d)


def _ensure_engine_key(data_dir: str) -> str:
    """读取 / 生成 DBX_SECRET_KEY（对齐 Node 版 ensureEngineKey）。"""
    import stat as _stat

    d = Path(data_dir)
    d.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(d, _stat.S_IRWXU)  # 0700
    except OSError:
        pass

    secret_path = d / "service-secrets.json"
    doc: dict[str, Any] = {"schemaVersion": 1, "values": {}}
    if secret_path.exists():
        try:
            doc = json.loads(secret_path.read_text())
        except (json.JSONDecodeError, OSError):
            doc = {"schemaVersion": 1, "values": {}}

    key = doc.get("values", {}).get("engine-key")
    if not isinstance(key, str) or not key:
        import base64
        key = base64.urlsafe_b64encode(os.urandom(32)).decode("ascii")
        doc["values"]["engine-key"] = key
        secret_path.write_text(json.dumps(doc))
        try:
            os.chmod(secret_path, _stat.S_IRUSR | _stat.S_IWUSR)  # 0600
        except OSError:
            pass
    return key


def _collect_driver_env(data_dir: str) -> dict[str, str]:
    """扫描 data_dir/drivers/{dbType}/{platform}/ 收集驱动路径环境变量。"""
    env: dict[str, str] = {}
    drivers_root = Path(data_dir) / "drivers"
    platform_tag = _detect_platform()
    if not drivers_root.is_dir() or not platform_tag:
        return env
    DRIVER_MAP = {
        "duckdb": {"envVar": "DBX_DUCKDB_DRIVER_PATH", "binary": "duckdb_worker"},
    }
    for db_type, cfg in DRIVER_MAP.items():
        driver_dir = drivers_root / db_type / platform_tag
        if not driver_dir.is_dir():
            continue
        # 手动 .path 文件优先
        path_file = driver_dir / ".path"
        if path_file.exists():
            manual = path_file.read_text().strip()
            if manual and Path(manual).exists():
                env[cfg["envVar"]] = manual
                continue
        # 二进制文件 fallback
        bin_path = driver_dir / cfg["binary"]
        if cfg["binary"] and bin_path.exists():
            env[cfg["envVar"]] = str(bin_path)
    return env


# ─── DbxMcpClient ─────────────────────────────────────────────────────────

class DbxMcpClient:
    """同步版 dbx-mcp stdio JSON-RPC 客户端。"""

    def __init__(
        self,
        server_dir: Path,
        data_dir: str | None = None,
        extra_env: dict[str, str] | None = None,
        handshake_timeout_ms: int = HANDSHAKE_TIMEOUT_MS,
        call_timeout_ms: int = CALL_TIMEOUT_MS,
    ) -> None:
        self._server_dir = server_dir
        self._data_dir = _resolve_data_dir(data_dir)
        self._extra_env = extra_env or {}
        self._handshake_timeout_ms = handshake_timeout_ms
        self._call_timeout_ms = call_timeout_ms

        self._proc: subprocess.Popen[str] | None = None
        self._buffer = ""
        self._next_id = 1
        self._pending: dict[int, dict[str, Any]] = {}
        self._phase: str = "idle"          # idle / connecting / ready / error
        self._init_thread: threading.Thread | None = None
        self._init_event = threading.Event()
        self._init_error: Exception | None = None
        self._lock = threading.Lock()

    # ── 连接生命周期 ──────────────────────────────────────────────────────

    def connect(self) -> None:
        """同步 connect（block 直到 ready 或超时/失败）。"""
        with self._lock:
            if self._phase == "ready":
                return
            if self._phase == "connecting":
                # 另一个线程正在连接，等它完成
                self._init_event.wait(self._handshake_timeout_ms / 1000)
                if self._phase == "ready":
                    return
                if self._init_error:
                    raise self._init_error
                raise TimeoutError("dbx-mcp handshake timed out")
            self._phase = "connecting"
            self._init_event.clear()

        try:
            self._spawn_and_handshake()
        except Exception as exc:
            with self._lock:
                self._phase = "error"
                self._init_error = exc
            raise
        with self._lock:
            self._phase = "ready"
            self._init_error = None
            self._init_event.set()

    def ensure_initialized(self) -> None:
        if self._phase == "ready":
            return
        self.connect()

    def dispose(self) -> None:
        proc = self._proc
        self._proc = None
        self._phase = "idle"
        if proc is None:
            return
        # reject 所有 pending
        err = RuntimeError("dbx-mcp client disposed")
        with self._lock:
            for p in self._pending.values():
                if not p["event"].is_set():
                    p["error"] = err
                    p["event"].set()
            self._pending.clear()
        try:
            proc.terminate()
            try:
                proc.wait(timeout=SHUTDOWN_GRACE_MS / 1000)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=1)
        except ProcessLookupError:
            pass

    def _spawn_and_handshake(self) -> None:
        bin_path = _resolve_binary_path(self._server_dir)
        driver_env = _collect_driver_env(self._data_dir)
        # dbx-mcp 子进程需要 DBX_SECRET_KEY 才能解密 dbx.db
        engine_key = _ensure_engine_key(self._data_dir)
        env = {
            **os.environ,
            "DBX_DATA_DIR": self._data_dir,
            "DBX_SECRET_KEY": engine_key,
            **self._extra_env,
            **driver_env,
        }
        self._proc = subprocess.Popen(
            [bin_path],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,   # 不阻塞：err 丢给操作系统
            env=env,
            text=True,
            bufsize=1,                # 行缓冲
        )
        # 起线程读 stdout
        assert self._proc.stdout is not None
        assert self._proc.stdin is not None

        def _stdout_reader() -> None:
            try:
                for line in self._proc.stdout:
                    self._on_data(line)
            except ValueError:
                pass  # pipe 已关闭
            # 进程退出后 reject 所有 pending
            if self._proc and self._proc.poll() is not None:
                with self._lock:
                    exc = RuntimeError(
                        f"dbx-mcp exited (code={self._proc.returncode})"
                    )
                    for p in self._pending.values():
                        if not p["event"].is_set():
                            p["error"] = exc
                            p["event"].set()
                    self._pending.clear()

        threading.Thread(target=_stdout_reader, name="dbx-mcp-stdout", daemon=True).start()

        # 起线程盯 stderr（静默收集，可用于 debug）
        assert self._proc.stderr is not None
        def _stderr_reader() -> None:
            try:
                for _ in self._proc.stderr:
                    pass
            except ValueError:
                pass
        threading.Thread(target=_stderr_reader, name="dbx-mcp-stderr", daemon=True).start()

        # 起线程盯进程退出
        def _exit_watcher() -> None:
            assert self._proc is not None
            self._proc.wait()
        threading.Thread(target=_exit_watcher, name="dbx-mcp-exit", daemon=True).start()

        # 握手：send initialize → wait result → send notifications/initialized
        self._request(
            request_id=0,
            method="initialize",
            params={
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "dbx-pro-plugin", "version": "0.1.1"},
            },
            timeout_ms=self._handshake_timeout_ms,
        )
        self._send_notification("notifications/initialized", {})

    # ── 协议层 ────────────────────────────────────────────────────────────

    def call_tool(self, name: str, args: dict[str, Any], timeout_ms: int | None = None) -> Any:
        self.ensure_initialized()
        return self._request(
            request_id=self._next_id,
            method="tools/call",
            params={"name": name, "arguments": args},
            timeout_ms=timeout_ms or self._call_timeout_ms,
        )

    def list_tools(self, timeout_ms: int | None = None) -> list[Any]:
        self.ensure_initialized()
        result = self._request(
            request_id=self._next_id,
            method="tools/list",
            params={},
            timeout_ms=timeout_ms or self._call_timeout_ms,
        )
        return result.get("tools", []) if isinstance(result, dict) else []

    def _request(self, request_id: int, method: str, params: dict[str, Any], timeout_ms: int) -> Any:
        self._next_id = max(self._next_id, request_id + 1)
        event = threading.Event()
        holder: dict[str, Any] = {"event": event, "result": None, "error": None}
        with self._lock:
            self._pending[request_id] = holder
        try:
            self._send_message({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params})
        except Exception:
            with self._lock:
                self._pending.pop(request_id, None)
            raise

        if not event.wait(timeout_ms / 1000):
            with self._lock:
                self._pending.pop(request_id, None)
            raise TimeoutError(f"dbx-mcp request '{method}' timeout after {timeout_ms}ms")

        if holder["error"]:
            raise holder["error"]
        return holder["result"]

    def _send_notification(self, method: str, params: dict[str, Any]) -> None:
        self._send_message({"jsonrpc": "2.0", "method": method, "params": params})

    def _send_message(self, msg: dict[str, Any]) -> None:
        proc = self._proc
        if proc is None or proc.stdin is None:
            raise RuntimeError("dbx-mcp client not started")
        proc.stdin.write(json.dumps(msg) + "\n")
        proc.stdin.flush()

    def _on_data(self, line: str) -> None:
        # line 已经是行缓冲读出来的单行，但如果 JSON 本身含换行（不应该有），
        # 仍用 buffer 拼接以防万一。
        stripped = line.strip()
        if not stripped:
            return
        try:
            message = json.loads(stripped)
        except json.JSONDecodeError:
            return
        message_id = message.get("id")
        if not isinstance(message_id, int):
            return
        with self._lock:
            pending = self._pending.get(message_id)
        if not pending or pending["event"].is_set():
            return
        with self._lock:
            self._pending.pop(message_id, None)
        if "error" in message and message["error"]:
            err_obj = message["error"]
            msg_text = err_obj.get("message") if isinstance(err_obj, dict) else str(err_obj)
            pending["error"] = RuntimeError(msg_text)
        else:
            pending["result"] = message.get("result")
        pending["event"].set()
