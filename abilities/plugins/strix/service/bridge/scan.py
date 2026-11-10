"""Driving one Strix scan in-process.

The scan runs inside this process through ``run_strix_scan`` rather than as a
subprocess. Two consequences matter for the plugin:

* Strix's own agent loop, sandbox and 78 internal skills are used unchanged;
  nothing here reimplements scanning.
* Stream events arrive through ``event_sink`` as the OpenAI Agents SDK objects
  upstream passes around. They are projected with ``TuiLiveView`` - Strix's own
  event interpreter, the same class its Go TUI consumes - and the resulting
  normalized records are what we serialize, so the panel reads upstream's
  interpretation instead of a parallel one.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import traceback
from typing import Any

from . import artifacts


class ScanRunner:
    """Owns at most one active scan inside the bridge process."""

    def __init__(self, emit) -> None:
        self._emit = emit
        self._task: asyncio.Task[None] | None = None
        self._coordinator: Any = None
        self._live_view: Any = None
        self._run_name: str | None = None
        self._workspace: str | None = None

    @property
    def run_name(self) -> str | None:
        return self._run_name

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    async def start(self, params: dict[str, Any]) -> dict[str, Any]:
        if self.running:
            raise RuntimeError("a scan is already running; cancel it first")

        workspace = str(params.get("workspace") or "")
        targets = [str(item) for item in (params.get("targets") or []) if str(item).strip()]
        if not targets:
            raise ValueError("at least one target is required")

        args = self._build_args(params, targets)
        self._workspace = workspace or None

        from strix.interface.scan_setup import build_targets_info, prepare_run

        build_targets_info(args)
        prepare_run(args)

        self._run_name = args.run_name
        self._emit({"event": "scan_queued", "runName": self._run_name, "scanMode": args.scan_mode})

        from strix.core.runner import run_strix_scan
        from strix.interface.tui.live_view import TuiLiveView

        self._live_view = TuiLiveView()
        self._live_view.set_user_instruction(args.instruction or "")
        self._scan_config = {
            "scan_id": args.run_name,
            "targets": args.targets_info,
            "user_instructions": args.instruction or "",
            "run_name": args.run_name,
            "diff_scope": getattr(args, "diff_scope", {"active": False}),
            "scan_mode": args.scan_mode,
        }

        self._task = asyncio.create_task(self._drive(args))
        return {
            "runName": self._run_name,
            "runDir": artifacts.run_dir(workspace or None, self._run_name),
            "scanMode": args.scan_mode,
        }

    def _build_args(self, params: dict[str, Any], targets: list[str]) -> argparse.Namespace:
        return argparse.Namespace(
            target=targets,
            target_list=[],
            workspace_files=[],
            resume=None,
            instruction=str(params.get("instruction") or ""),
            scan_mode=str(params.get("scanMode") or "deep"),
            scope_mode=str(params.get("scopeMode") or "auto"),
            diff_base=params.get("diffBase") or None,
            non_interactive=not bool(params.get("interactive")),
            interactive=bool(params.get("interactive")),
            max_turns=int(params.get("maxTurns") or 500),
            max_budget_usd=params.get("maxBudgetUsd") or None,
            local_sources=[],
            targets_info=[],
            run_name=None,
        )

    async def _drive(self, args: argparse.Namespace) -> None:
        from strix.core.runner import run_strix_scan
        from strix.report.state import get_global_report_state

        def on_event(agent_id: str, event: Any) -> None:
            self._project(agent_id, event)

        def on_status(phase: str) -> None:
            self._emit({"event": "scan_status", "runName": self._run_name, "phase": phase})

        workspace = self._workspace
        self._emit({"event": "scan_started", "runName": self._run_name})
        try:
            await run_strix_scan(
                scan_config=self._scan_config,
                scan_id=args.run_name,
                image=self._image(),
                local_sources=getattr(args, "local_sources", None) or [],
                interactive=bool(args.interactive),
                max_turns=args.max_turns,
                max_budget_usd=args.max_budget_usd,
                event_sink=on_event,
                status_sink=on_status,
            )
            state = get_global_report_state()
            record = getattr(state, "run_record", None) or {}
            self._emit(
                {
                    "event": "scan_finished",
                    "runName": self._run_name,
                    "status": record.get("status") or "completed",
                    "summary": artifacts.run_summary(self._run_path()) if self._run_path() else None,
                }
            )
        except asyncio.CancelledError:
            self._emit({"event": "scan_cancelled", "runName": self._run_name})
            raise
        except Exception as exc:  # noqa: BLE001 - reported to the panel verbatim
            self._emit(
                {
                    "event": "scan_failed",
                    "runName": self._run_name,
                    "error": str(exc),
                    "traceback": traceback.format_exc(limit=6),
                }
            )

    def _image(self) -> str:
        from strix.config import load_settings

        try:
            return str(load_settings().runtime.image or "strix-sandbox:latest")
        except Exception:  # noqa: BLE001 - settings may be unavailable in probe-only runs
            return "strix-sandbox:latest"

    def _run_path(self):
        from pathlib import Path

        if not self._run_name:
            return None
        return Path(artifacts.run_dir(self._workspace, self._run_name))

    def _project(self, agent_id: str, event: Any) -> None:
        view = self._live_view
        if view is None:
            return
        before = len(view.events)
        try:
            view.ingest_sdk_event(agent_id, event)
        except Exception as exc:  # noqa: BLE001 - a projection bug must not kill a scan
            self._emit({"event": "projection_error", "message": str(exc)})
            return
        for record in view.events[before:]:
            self._emit({"event": "scan_event", "runName": self._run_name, "record": record})

    async def cancel(self) -> dict[str, Any]:
        if not self.running or self._task is None:
            return {"cancelled": False, "reason": "no active scan"}
        self._task.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await self._task
        return {"cancelled": True, "runName": self._run_name}


def install_guard() -> None:
    """Fail loudly if the engine is missing instead of surfacing an ImportError."""
    try:
        import strix  # noqa: F401
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(
            "strix-agent is not importable in this Python environment; "
            "install it with `uv tool install strix-agent` or point the plugin at a "
            "Python that has it"
        ) from exc
