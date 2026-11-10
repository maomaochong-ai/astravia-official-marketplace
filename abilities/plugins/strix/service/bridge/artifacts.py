"""Reading a finished or in-flight run directory.

Strix's machine-readable surface is the run directory, not stdout: `run.json`
carries status and metadata, `vulnerabilities.json` the findings, and
`findings.sarif` the portable export. This module only reads those files so the
panel can render a run without a second, private protocol.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

RUNS_DIR_NAME = "strix_runs"
RUN_RECORD_FILENAME = "run.json"
VULNERABILITIES_FILENAME = "vulnerabilities.json"
REPORT_FILENAME = "penetration_test_report.md"
SARIF_FILENAME = "findings.sarif"


def runs_base(workspace: str | None) -> Path:
    return Path(workspace or Path.cwd()) / RUNS_DIR_NAME


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def run_summary(run_dir: Path) -> dict[str, Any]:
    record = _read_json(run_dir / RUN_RECORD_FILENAME) or {}
    findings = _read_json(run_dir / VULNERABILITIES_FILENAME) or []
    if not isinstance(findings, list):
        findings = []
    scan_results = record.get("scan_results") or {}
    return {
        "runName": record.get("run_name") or run_dir.name,
        "runId": record.get("run_id") or run_dir.name,
        "status": record.get("status") or "unknown",
        "startTime": record.get("start_time"),
        "endTime": record.get("end_time"),
        "scanMode": record.get("scan_mode"),
        "targets": record.get("targets_info") or [],
        "instruction": record.get("instruction") or record.get("user_instruction") or "",
        "findingCount": len(findings),
        "hasReport": (run_dir / REPORT_FILENAME).is_file(),
        "hasSarif": (run_dir / SARIF_FILENAME).is_file(),
        "exitReason": scan_results.get("exit_reason") if isinstance(scan_results, dict) else None,
        "path": str(run_dir),
    }


def list_runs(workspace: str | None, limit: int = 50) -> list[dict[str, Any]]:
    base = runs_base(workspace)
    if not base.is_dir():
        return []
    candidates = [child for child in base.iterdir() if (child / RUN_RECORD_FILENAME).is_file()]
    candidates.sort(key=lambda child: (child / RUN_RECORD_FILENAME).stat().st_mtime, reverse=True)
    return [run_summary(child) for child in candidates[:limit]]


def findings(workspace: str | None, run_name: str) -> list[dict[str, Any]]:
    item = _read_json(runs_base(workspace) / run_name / VULNERABILITIES_FILENAME)
    return item if isinstance(item, list) else []


def report(workspace: str | None, run_name: str) -> str:
    path = runs_base(workspace) / run_name / REPORT_FILENAME
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


def run_dir(workspace: str | None, run_name: str) -> str:
    return str(runs_base(workspace) / run_name)
