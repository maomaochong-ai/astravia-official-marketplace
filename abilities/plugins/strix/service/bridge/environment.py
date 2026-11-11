"""Environment probing: can this machine give the host agent a Strix sandbox?

Nothing here imports strix - probing must not pay the cost of loading the engine,
and the panel has to be able to say "not installed yet" without one.

There is deliberately no model check. The agent that drives these tools is the
host's own, running on the model the user already configured in Astravia; the
plugin neither reads nor needs a provider credential (docs/plugin/ai.md:3).
"""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Any

STRIX_DIR = Path.home() / ".strix"
STRIX_CONFIG = STRIX_DIR / "cli-config.json"
DEFAULT_IMAGE = "ghcr.io/usestrix/strix-sandbox:1.4.0"


def sandbox_image() -> str:
    """The image strix would use: its own setting, else the pinned default."""
    configured = os.environ.get("STRIX_IMAGE")
    if configured:
        return configured
    try:
        import json

        data = json.loads(STRIX_CONFIG.read_text(encoding="utf-8"))
        value = (data.get("env") or {}).get("STRIX_IMAGE")
        if isinstance(value, str) and value.strip():
            return value.strip()
    except (OSError, ValueError):
        pass
    return DEFAULT_IMAGE


def _docker() -> tuple[bool, str]:
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


def _engine() -> tuple[bool, str]:
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


def _image_present(image: str) -> bool | None:
    """Is the sandbox image already pulled? None when docker cannot tell."""
    binary = shutil.which("docker")
    if not binary:
        return None
    try:
        completed = subprocess.run(  # noqa: S603 - fixed argv, no shell
            [binary, "image", "inspect", image, "--format", "{{.Id}}"],
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    return completed.returncode == 0


def probe() -> dict[str, Any]:
    """Everything the panel needs, in one round trip."""
    installed, engine_detail = _engine()
    docker_ok, docker_detail = _docker()
    image = sandbox_image()
    # Fetching the image is a one-off cost; saying so up front is friendlier than
    # a first tool call that appears to hang.
    pulled = _image_present(image) if docker_ok else None

    return {
        "python": {"version": platform.python_version(), "executable": os.sys.executable, "found": True},
        "engine": {"installed": installed, "version": engine_detail},
        "docker": {
            "ready": docker_ok,
            "detail": docker_detail,
            "image": image,
            "imagePresent": pulled,
        },
        "ready": bool(installed and docker_ok),
    }
