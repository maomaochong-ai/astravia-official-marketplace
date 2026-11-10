"""Fill providers.services[].runtime.platforms[*].artifacts from the shipped files.

The host's installer accepts a service runtime only when the payload set matches
the declared artifact set one-for-one and every SHA-256 verifies
(apps/desktop/src/main/plugins/plugin-service-runtime-installer.ts). A service
made of several files therefore has to declare every file, not just the entry:
declaring only `service/main.mjs` installs a runtime whose Python half is missing.

Run after touching anything under `service/`:

    python scripts/fill-service-checksum.py
"""

import hashlib
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLATFORMS = ("win32-x64", "darwin-x64", "darwin-arm64", "linux-x64", "linux-arm64")
# Every file the service needs at runtime, relative to the package root.
# `service/main.mjs` is the entry; the rest is the Python bridge it spawns.
SERVICE_FILES = (
    "service/main.mjs",
    "service/bridge/__init__.py",
    "service/bridge/__main__.py",
    "service/bridge/artifacts.py",
    "service/bridge/environment.py",
    "service/bridge/protocol.py",
    "service/bridge/scan.py",
)


def artifacts() -> list[dict[str, str]]:
    return [
        {
            "sha256": hashlib.sha256((ROOT / relative).read_bytes()).hexdigest(),
            "archive": "file",
            "destination": relative,
        }
        for relative in SERVICE_FILES
    ]


def main() -> int:
    missing = [relative for relative in SERVICE_FILES if not (ROOT / relative).is_file()]
    if missing:
        raise SystemExit(f"missing service files: {', '.join(missing)}")

    manifest_path = ROOT / "plugin.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    services = manifest["providers"]["services"]
    if len(services) != 1:
        raise SystemExit(f"expected one service, found {len(services)}")

    entries = artifacts()
    for tag in PLATFORMS:
        services[0]["runtime"]["platforms"][tag]["artifacts"] = [dict(entry) for entry in entries]

    manifest_path.write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"stamped {len(entries)} artifacts across {len(PLATFORMS)} platforms")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
