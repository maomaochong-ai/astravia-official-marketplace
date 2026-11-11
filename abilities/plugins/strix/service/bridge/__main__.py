"""Bridge entry point: JSON lines in, JSON lines out.

Started by ``service/main.mjs`` as a child process. The Node side owns the HTTP
and MCP surface; this process owns Python-only work (importing strix, running a
scan, reading a run directory). Keeping the split this way means the plugin
never has to bundle a Python interpreter into a platform artifact.
"""

from __future__ import annotations

import asyncio
import os
import pathlib
import sys
import threading
from typing import Any

from . import artifacts, environment
from .protocol import Protocol
from .scan import ScanRunner, install_guard


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

    runner = ScanRunner(emit)
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
            result = await dispatch(op, params, runner)
            protocol.reply(request_id, result)
            if op == "shutdown":
                break
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 - every failure is a reply, never a crash
            protocol.fail(request_id, str(exc))
    protocol.close()


async def dispatch(op: str, params: dict[str, Any], runner: ScanRunner) -> Any:
    if op == "ping":
        return {"pong": True}
    if op == "probe":
        return environment.probe()
    if op == "start_scan":
        install_guard()
        return await runner.start(params)
    if op == "cancel_scan":
        return await runner.cancel()
    if op == "list_runs":
        return artifacts.list_runs(params.get("workspace"), int(params.get("limit") or 50))
    if op == "run_summary":
        run_name = params["runName"]
        return artifacts.run_summary(
            pathlib.Path(artifacts.run_dir(params.get("workspace"), run_name))
        )
    if op == "findings":
        return artifacts.findings(params.get("workspace"), params["runName"])
    if op == "report":
        return {"markdown": artifacts.report(params.get("workspace"), params["runName"])}
    if op == "shutdown":
        await runner.cancel()
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
