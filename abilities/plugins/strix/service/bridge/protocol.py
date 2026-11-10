"""Newline-delimited JSON helpers shared by the bridge process and its parent.

The bridge speaks one JSON object per line on stdin (requests) and stdout
(events and replies). Keeping the framing this dumb means the Node shell never
has to parse partial writes from the Python child, and it stays debuggable by
hand: `python -m bridge` accepts the same lines from a terminal.
"""

from __future__ import annotations

import json
import sys
import threading
from typing import Any


class Protocol:
    """Reads requests from stdin and writes replies/events to stdout."""

    def __init__(self) -> None:
        self._out = sys.stdout
        self._lock = threading.Lock()
        self._closed = False

    def read(self) -> dict[str, Any] | None:
        line = sys.stdin.readline()
        if not line:
            return None
        line = line.strip()
        if not line:
            return {}
        try:
            payload = json.loads(line)
        except json.JSONDecodeError as exc:
            self.emit({"event": "protocol_error", "message": f"invalid JSON: {exc}"})
            return {}
        return payload if isinstance(payload, dict) else {}

    def _write(self, payload: dict[str, Any]) -> None:
        if self._closed:
            return
        with self._lock:
            self._out.write(json.dumps(payload, ensure_ascii=False, default=str) + "\n")
            self._out.flush()

    def emit(self, payload: dict[str, Any]) -> None:
        self._write(payload)

    def reply(self, request_id: Any, result: Any) -> None:
        self._write({"id": request_id, "ok": True, "result": result})

    def fail(self, request_id: Any, message: str, code: str = "error") -> None:
        self._write({"id": request_id, "ok": False, "code": code, "error": message})

    def close(self) -> None:
        self._closed = True
