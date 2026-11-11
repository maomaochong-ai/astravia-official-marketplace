"""Strix capabilities as callable tools, for a host agent to drive.

This module deliberately contains **no agent loop and no model plumbing**. The
host application already runs an agent with the user's configured model; what it
lacks is Strix's sandbox and its skill library. So the bridge exposes exactly
those two, through the same upstream entry points the TUI uses:

* the sandbox comes from ``strix.runtime.session_manager.create_or_reuse`` - the
  function Strix's own runner calls - and commands run through ``session.exec``;
* skills come from ``strix.skills.get_available_skills`` / ``load_skills``, the
  same loader behind Strix's ``load_skill`` tool.

Nothing here reimplements a pentest: the reasoning is the host agent's, the
environment and the knowledge are Strix's.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
from typing import Any

from . import environment
from .protocol import Protocol

# Upstream caps one ``session.exec`` at ten minutes; long jobs belong to a
# background process plus repeated reads, which the tool description says.
DEFAULT_TIMEOUT_S = 300
MAX_TIMEOUT_S = 600


class Sandbox:
    """One container session, reused across tool calls until stopped."""

    def __init__(self, emit) -> None:
        self._emit = emit
        self._session: Any = None
        self._scan_id: str = ""
        self._targets: list[str] = []
        self._started_at: float = 0.0
        self._image: str = ""

    @property
    def running(self) -> bool:
        return self._session is not None

    def status(self) -> dict[str, Any]:
        return {
            "running": self.running,
            "sessionId": self._scan_id or None,
            "targets": self._targets,
            "image": self._image or None,
            "uptimeSec": int(time.time() - self._started_at) if self.running else 0,
        }

    async def start(self, params: dict[str, Any]) -> dict[str, Any]:
        if self.running:
            return self.status()

        from strix.runtime.session_manager import create_or_reuse

        targets = [str(item) for item in (params.get("targets") or []) if str(item).strip()]
        session_id = str(params.get("sessionId") or "").strip() or f"strix-{int(time.time())}"

        # Local directories the user pointed at become /workspace/<name> in the
        # container, exactly as they do for a Strix scan.
        local_sources: list[dict[str, Any]] = []
        for raw in params.get("localSources") or []:
            path = str(raw.get("path") or "").strip()
            if not path:
                continue
            local_sources.append(
                {
                    "source_path": path,
                    "workspace_subdir": str(raw.get("subdir") or os.path.basename(path.rstrip("/\\"))),
                    "read_only": bool(raw.get("readOnly")),
                }
            )

        self._emit({"event": "sandbox_starting", "sessionId": session_id, "targets": targets})
        bundle = await create_or_reuse(
            session_id,
            image=environment.sandbox_image(),
            local_sources=local_sources,
            status_sink=lambda phase: self._emit({"event": "sandbox_status", "phase": phase}),
        )
        self._session = bundle["session"]
        self._scan_id = session_id
        self._targets = targets
        self._started_at = time.time()
        self._image = environment.sandbox_image()
        self._emit({"event": "sandbox_ready", "sessionId": session_id, "status": self.status()})
        return self.status()

    async def exec(self, params: dict[str, Any]) -> dict[str, Any]:
        if not self.running:
            raise RuntimeError("no sandbox session; call strix_sandbox_start first")
        command = str(params.get("command") or "").strip()
        if not command:
            raise ValueError("command is required")
        timeout = min(int(params.get("timeoutSec") or DEFAULT_TIMEOUT_S), MAX_TIMEOUT_S)
        workdir = str(params.get("workdir") or "").strip()

        script = command if not workdir else f"cd {shell_quote(workdir)} && {command}"
        self._emit({"event": "tool_start", "tool": "exec_command", "command": command, "workdir": workdir or None})
        result = await asyncio.wait_for(self._session.exec("sh", "-c", script), timeout=timeout)
        payload = {
            "command": command,
            "workdir": workdir or None,
            "exitCode": getattr(result, "exit_code", None),
            "stdout": _text(getattr(result, "stdout", "")),
            "stderr": _text(getattr(result, "stderr", "")),
            "ok": bool(result.ok()) if hasattr(result, "ok") else True,
        }
        self._emit(
            {
                "event": "tool_end",
                "tool": "exec_command",
                "command": command,
                "ok": payload["ok"],
                "exitCode": payload["exitCode"],
            }
        )
        return payload

    async def stop(self) -> dict[str, Any]:
        if not self.running:
            return {"stopped": False, "reason": "no active session"}
        from strix.runtime.session_manager import cleanup

        session_id = self._scan_id
        try:
            await cleanup(session_id)
        finally:
            self._session = None
            self._started_at = 0.0
        self._emit({"event": "sandbox_stopped", "sessionId": session_id})
        return {"stopped": True, "sessionId": session_id}


def shell_quote(value: str) -> str:
    return "'" + value.replace("'", "'\"'\"'") + "'"


def _text(value: Any) -> str:
    if isinstance(value, bytes | bytearray):
        return bytes(value).decode("utf-8", errors="replace")
    return str(value or "")


def list_skills(_params: dict[str, Any] | None = None) -> dict[str, Any]:
    """Every user-selectable Strix skill, grouped by category (upstream loader)."""
    from strix.skills import get_available_skills

    grouped = get_available_skills()
    total = sum(len(items) for items in grouped.values())
    return {
        "total": total,
        "categories": {
            category: [{"name": item["name"], "description": item["description"]} for item in items]
            for category, items in sorted(grouped.items())
        },
    }


def load_skills(params: dict[str, Any]) -> dict[str, Any]:
    """Skill bodies by name, rendered exactly as Strix renders them for its own agents."""
    from strix.skills import load_skills as load

    names = [str(item) for item in (params.get("names") or []) if str(item).strip()]
    if not names:
        raise ValueError("names is required")
    bodies = load(names)
    return {
        "loaded": sorted(bodies),
        "missing": [name for name in names if name.split("/")[-1] not in bodies],
        "markdown": bodies,
    }


def probe(_params: dict[str, Any] | None = None) -> dict[str, Any]:
    return environment.probe()


def dump_findings(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False, indent=2)


__all__ = ["Sandbox", "list_skills", "load_skills", "probe", "shell_quote", "Protocol"]
