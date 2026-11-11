"""Bridge entry point: JSON lines in, JSON lines out.

Started by ``service/main.mjs`` as a child process. The Node side owns HTTP and
MCP; this process owns Python-only work - importing strix, driving its sandbox,
loading its skills, persisting findings. Keeping the split this way means the
plugin never has to bundle a Python interpreter into a platform artifact.

There is no agent loop here on purpose: the host application runs the agent, this
bridge supplies Strix's capabilities to it.
"""

from __future__ import annotations

import asyncio
import os
import sys
import threading
from typing import Any

from . import environment, findings
from .protocol import Protocol
from .tools import Sandbox, list_skills, load_skills


def _install_guard() -> None:
    try:
        import strix  # noqa: F401
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            "strix-agent is not importable in this Python environment; install it with "
            "`uv tool install strix-agent` or point STRIX_PYTHON at a Python that has it"
        ) from exc


async def serve() -> None:
    protocol = Protocol()
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()

    def reader() -> None:
        while True:
            payload = protocol.read()
            loop.call_soon_threadsafe(queue.put_nowait, payload)
            if payload is None:
                return

    threading.Thread(target=reader, name="bridge-reader", daemon=True).start()

    def emit(payload: dict[str, Any]) -> None:
        protocol.emit(payload)

    sandbox = Sandbox(emit)
    protocol.emit({"event": "bridge_ready", "pid": os.getpid()})

    while True:
        request = await queue.get()
        if request is None:
            break
        if not request:
            continue
        request_id = request.get("id")
        op = str(request.get("op") or "")
        params = request.get("params") or {}
        try:
            result = await dispatch(op, params, sandbox)
            protocol.reply(request_id, result)
            if op == "shutdown":
                break
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 - every failure is a reply, never a crash
            protocol.fail(request_id, str(exc))


async def dispatch(op: str, params: dict[str, Any], sandbox: Sandbox) -> Any:
    if op == "ping":
        return {"pong": True}
    if op == "probe":
        return environment.probe()

    if op == "sandbox_start":
        _install_guard()
        return await sandbox.start(params)
    if op == "sandbox_status":
        return sandbox.status()
    if op == "sandbox_exec":
        return await sandbox.exec(params)
    if op == "sandbox_stop":
        return await sandbox.stop()

    if op == "skills_list":
        _install_guard()
        return list_skills(params)
    if op == "skills_load":
        _install_guard()
        return load_skills(params)

    session_id = str(params.get("sessionId") or sandbox.status()["sessionId"] or "default")
    if op == "findings_add":
        return findings.add(session_id, params)
    if op == "findings_list":
        return findings.list_findings(session_id, params)
    if op == "findings_clear":
        return findings.clear(session_id)
    if op == "report":
        return findings.report(session_id, params)

    if op == "shutdown":
        await sandbox.stop()
        return {"bye": True}
    raise ValueError(f"unknown op: {op}")


def main() -> int:
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        asyncio.run(serve())
    except KeyboardInterrupt:
        return 0
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
