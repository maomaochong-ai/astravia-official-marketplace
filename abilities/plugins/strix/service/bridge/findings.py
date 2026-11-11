"""Findings a host agent files while it works, and the report it leaves behind.

Strix's own scanner keeps findings in a run directory; here the agent loop belongs
to the host, so the plugin keeps the same shape itself: one JSON list beside the
service data, plus a Markdown report rendered from it.

The shape deliberately follows Strix's finding schema (severity, cvss, cwe, poc,
remediation, evidence) so a finding filed here reads the same as one from
``strix`` itself, and SARIF/Markdown consumers see no new vocabulary.
"""

from __future__ import annotations

import json
import time
import uuid
from pathlib import Path
from typing import Any

SEVERITIES = ("critical", "high", "medium", "low", "info")


def _root() -> Path:
    base = Path(__import__("os").environ.get("ASTRAVIA_SERVICE_DATA_DIR") or ".")
    directory = base / "findings"
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
    return {"finding": finding, "count": len(findings)}


def list_findings(session_id: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    findings = load(session_id)
    severity = str((params or {}).get("severity") or "").strip().lower()
    if severity:
        findings = [item for item in findings if item.get("severity") == severity]
    order = {name: index for index, name in enumerate(SEVERITIES)}
    findings.sort(key=lambda item: order.get(str(item.get("severity")), len(SEVERITIES)))
    tally = {name: 0 for name in SEVERITIES}
    for item in findings:
        tally[item.get("severity", "info")] = tally.get(item.get("severity", "info"), 0) + 1
    return {"count": len(findings), "bySeverity": tally, "findings": findings}


def report(session_id: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """Markdown report, laid out like the one Strix writes at the end of a scan."""
    findings = load(session_id)
    targets = [str(item) for item in ((params or {}).get("targets") or []) if str(item)]
    order = {name: index for index, name in enumerate(SEVERITIES)}
    findings.sort(key=lambda item: order.get(str(item.get("severity")), len(SEVERITIES)))

    lines = ["# Penetration test report", ""]
    if targets:
        lines += ["## Targets", ""] + [f"- {target}" for target in targets] + [""]
    lines += [f"## Findings ({len(findings)})", ""]
    if not findings:
        lines.append("No findings were filed.")
    for index, finding in enumerate(findings, start=1):
        lines += [
            f"### {index}. {finding.get('title')}",
            "",
            f"- Severity: **{finding.get('severity')}**",
        ]
        if finding.get("target"):
            lines.append(f"- Target: `{finding['target']}`")
        if finding.get("cvss") is not None:
            lines.append(f"- CVSS: {finding['cvss']}")
        if finding.get("cwe"):
            lines.append(f"- CWE: {finding['cwe']}")
        if finding.get("cve"):
            lines.append(f"- CVE: {finding['cve']}")
        if finding.get("confidence"):
            lines.append(f"- Confidence: {finding['confidence']}")
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
    return {"markdown": markdown, "path": str(path), "count": len(findings)}


def clear(session_id: str) -> dict[str, Any]:
    save(session_id, [])
    return {"cleared": session_id}
