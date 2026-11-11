"""Findings a host agent files while it works, and the report it leaves behind.

Strix's own scanner keeps findings in a run directory; here the agent loop belongs
to the host, so the plugin keeps the same shape itself: one JSON list in the
plugin's data directory, plus a Markdown report rendered from it.

The shape deliberately follows Strix's finding schema (severity, cvss, cwe, poc,
remediation, evidence) so a finding filed here reads the same as one ``strix``
itself would write, and Markdown/SARIF consumers see no new vocabulary.
"""

from __future__ import annotations

import json
import os
import time
import uuid
from pathlib import Path
from typing import Any

SEVERITIES = ("critical", "high", "medium", "low", "info")

# Severity order for sorting and for the report's layout.
_RANK = {name: index for index, name in enumerate(SEVERITIES)}


def _root() -> Path:
    """The plugin's data directory.

    Never the working directory: the bridge runs from the installed package, and
    creating a folder there would end up inside the shipped archive.
    """
    base = os.environ.get("ASTRAVIA_SERVICE_DATA_DIR")
    root = Path(base) if base else Path.home() / ".astravia" / "plugin-data" / "strix"
    directory = root / "findings"
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def _path(session_id: str) -> Path:
    safe = "".join(char for char in session_id if char.isalnum() or char in "-_") or "default"
    return _root() / f"{safe}.json"


def load(session_id: str) -> list[dict[str, Any]]:
    try:
        data = json.loads(_path(session_id).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return data if isinstance(data, list) else []


def save(session_id: str, findings: list[dict[str, Any]]) -> None:
    _path(session_id).write_text(json.dumps(findings, ensure_ascii=False, indent=2), encoding="utf-8")


def _tally(findings: list[dict[str, Any]]) -> dict[str, int]:
    counts = {name: 0 for name in SEVERITIES}
    for item in findings:
        severity = str(item.get("severity", "info"))
        counts[severity] = counts.get(severity, 0) + 1
    return counts


def add(session_id: str, params: dict[str, Any]) -> dict[str, Any]:
    title = str(params.get("title") or "").strip()
    if not title:
        raise ValueError("title is required")
    severity = str(params.get("severity") or "").strip().lower()
    if severity not in SEVERITIES:
        raise ValueError(f"severity must be one of {', '.join(SEVERITIES)}")

    finding = {
        "id": str(params.get("id") or uuid.uuid4().hex[:8]),
        "title": title,
        "severity": severity,
        "target": str(params.get("target") or ""),
        "description": str(params.get("description") or ""),
        "impact": str(params.get("impact") or ""),
        "technical_analysis": str(params.get("technicalAnalysis") or ""),
        "poc_description": str(params.get("poc") or ""),
        "remediation_steps": str(params.get("remediation") or ""),
        "evidence": str(params.get("evidence") or ""),
        "cvss": params.get("cvss"),
        "cwe": str(params.get("cwe") or ""),
        "cve": str(params.get("cve") or ""),
        "confidence": str(params.get("confidence") or ""),
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    findings = load(session_id)
    findings.append(finding)
    save(session_id, findings)
    return {"finding": finding, "count": len(findings), "bySeverity": _tally(findings)}


def list_findings(session_id: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    findings = load(session_id)
    severity = str((params or {}).get("severity") or "").strip().lower()
    if severity:
        findings = [item for item in findings if item.get("severity") == severity]
    findings.sort(key=lambda item: _RANK.get(str(item.get("severity")), len(SEVERITIES)))
    return {"count": len(findings), "bySeverity": _tally(findings), "findings": findings}


def report(session_id: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """Markdown report, laid out like the one Strix writes at the end of a scan."""
    findings = load(session_id)
    findings.sort(key=lambda item: _RANK.get(str(item.get("severity")), len(SEVERITIES)))
    targets = [str(item) for item in ((params or {}).get("targets") or []) if str(item)]

    lines = ["# Penetration test report", ""]
    if targets:
        lines += ["## Targets", ""] + [f"- {target}" for target in targets] + [""]
    counts = _tally(findings)
    summary = ", ".join(f"{name}: {count}" for name, count in counts.items() if count)
    lines += [f"## Findings ({len(findings)})", ""]
    if summary:
        lines += [summary, ""]
    if not findings:
        lines.append("No findings were filed.")
    for index, finding in enumerate(findings, start=1):
        lines += [f"### {index}. {finding.get('title')}", "", f"- Severity: **{finding.get('severity')}**"]
        for label, key in (("Target", "target"), ("CWE", "cwe"), ("CVE", "cve"), ("Confidence", "confidence")):
            if finding.get(key):
                lines.append(f"- {label}: {finding[key]}")
        if finding.get("cvss") is not None:
            lines.append(f"- CVSS: {finding['cvss']}")
        lines.append("")
        for label, key in (
            ("Description", "description"),
            ("Impact", "impact"),
            ("Technical analysis", "technical_analysis"),
            ("Proof of concept", "poc_description"),
            ("Evidence", "evidence"),
            ("Remediation", "remediation_steps"),
        ):
            value = str(finding.get(key) or "").strip()
            if value:
                lines += [f"**{label}**", "", value, ""]
    markdown = "\n".join(lines).rstrip() + "\n"
    path = _root() / "report.md"
    path.write_text(markdown, encoding="utf-8")
    return {"markdown": markdown, "path": str(path), "count": len(findings), "bySeverity": counts}


def clear(session_id: str) -> dict[str, Any]:
    save(session_id, [])
    return {"cleared": session_id}
