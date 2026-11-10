"""Environment probing: can this machine run a Strix scan, and with which model?

Nothing here imports strix; probing must not pay the cost of loading the agent
engine, and the UI has to be able to answer "not installed yet" without one.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

STRIX_CONFIG = Path.home() / ".strix" / "cli-config.json"
SANDBOX_IMAGE = "ghcr.io/usestrix/strix-sandbox:1.4.0"


def _read_strix_config() -> dict[str, Any]:
    try:
        raw = STRIX_CONFIG.read_text(encoding="utf-8")
    except OSError:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    env = parsed.get("env")
    return env if isinstance(env, dict) else {}


def _docker_ready() -> tuple[bool, str]:
    binary = shutil.which("docker")
    if not binary:
        return False, "docker is not on PATH"
    try:
        completed = subprocess.run(  # noqa: S603 - fixed argv, no shell
            [binary, "info", "--format", "{{.ServerVersion}}"],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return False, f"docker did not answer: {exc}"
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip().splitlines()
        return False, detail[0] if detail else "docker daemon is not reachable"
    return True, ""


def _python_version() -> str:
    import platform

    return platform.python_version()


def _engine_installed() -> tuple[bool, str]:
    try:
        import strix  # noqa: F401
    except Exception as exc:  # noqa: BLE001 - any import failure means "not installed"
        return False, str(exc)
    version = ""
    try:
        from importlib.metadata import version as pkg_version

        version = pkg_version("strix-agent")
    except Exception:  # noqa: BLE001
        pass
    return True, version


def probe() -> dict[str, Any]:
    """Everything the settings and launch surfaces need, in one round trip."""
    config_env = _read_strix_config()
    installed, detail = _engine_installed()
    docker_ok, docker_detail = _docker_ready()

    llm = os.environ.get("STRIX_LLM") or str(config_env.get("STRIX_LLM") or "")
    api_key = os.environ.get("LLM_API_KEY") or str(config_env.get("LLM_API_KEY") or "")
    key_source = "env" if os.environ.get("LLM_API_KEY") else ("config" if api_key else "missing")

    return {
        "python": {"version": _python_version(), "executable": os.sys.executable},
        "engine": {"installed": installed, "version": detail},
        "docker": {"ready": docker_ok, "detail": docker_detail, "image": SANDBOX_IMAGE},
        "llm": {
            "model": llm,
            "configured": bool(llm and api_key),
            "keySource": key_source,
        },
        "configPath": str(STRIX_CONFIG),
        "ready": bool(installed and docker_ok and llm and api_key),
    }
