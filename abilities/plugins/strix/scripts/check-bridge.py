"""Smoke-test the Python bridge over its real stdin/stdout protocol."""

from __future__ import annotations

import json
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SERVICE = ROOT / "service"
PYTHON = sys.executable


def run(lines: list[dict]) -> list[dict]:
    payload = "".join(json.dumps(line) + "\n" for line in lines)
    completed = subprocess.run(  # noqa: S603 - fixed argv
        [PYTHON, "-m", "bridge"],
        cwd=SERVICE,
        input=payload,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )
    if completed.returncode != 0 and not completed.stdout.strip():
        raise SystemExit(f"bridge exited {completed.returncode}\n{completed.stderr}")
    replies = []
    for raw in completed.stdout.splitlines():
        raw = raw.strip()
        if raw:
            replies.append(json.loads(raw))
    return replies


def main() -> int:
    replies = run(
        [
            {"id": "1", "op": "ping", "params": {}},
            {"id": "2", "op": "probe", "params": {}},
            {"id": "3", "op": "sandbox_status", "params": {}},
            {"id": "4", "op": "nope", "params": {}},
            {"id": "5", "op": "shutdown", "params": {}},
        ]
    )
    by_id = {reply.get("id"): reply for reply in replies if reply.get("id")}
    assert replies[0]["event"] == "bridge_ready", replies[0]
    assert by_id["1"]["ok"] is True and by_id["1"]["result"]["pong"] is True, by_id.get("1")
    probe = by_id["2"]["result"]
    # No model key here on purpose: the host agent owns the model.
    assert set(probe) >= {"python", "engine", "docker", "ready"}, probe
    assert isinstance(probe["docker"]["ready"], bool), probe
    assert by_id["3"]["ok"] is True and by_id["3"]["result"]["running"] is False, by_id.get("3")
    assert by_id["4"]["ok"] is False and "unknown op" in by_id["4"]["error"], by_id.get("4")
    assert by_id["5"]["result"]["bye"] is True, by_id.get("5")
    print("python bridge ok:", json.dumps({"probe": probe, "sandbox": by_id["3"]["result"]})[:400])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
