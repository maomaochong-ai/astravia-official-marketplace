"""One-off: fill the shipped service artifact checksum into plugin.json."""

import hashlib
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHA = hashlib.sha256((ROOT / "service" / "main.mjs").read_bytes()).hexdigest()

manifest = json.loads((ROOT / "plugin.json").read_text(encoding="utf-8"))
platforms = manifest["providers"]["services"][0]["runtime"]["platforms"]
for platform in platforms.values():
    platform["artifacts"][0]["sha256"] = SHA

(ROOT / "plugin.json").write_text(
    json.dumps(manifest, indent="\t", ensure_ascii=False) + "\n", encoding="utf-8"
)
print(f"sha256={SHA} platforms={len(platforms)}")
