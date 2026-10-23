#!/usr/bin/env bash
# manifest-summary.sh — macOS / Linux equivalent of manifest-summary.ps1
#
# Prints the same key=value lines as the PowerShell version so the agent can
# read either output with the same parser:
#
#   package=, permission_count=, permission=,
#   activity_count= / activity=$name\t$exported\t$enabled (same for service,
#   receiver, provider), main_activity=
#
# Usage:
#   ./manifest-summary.sh /path/to/AndroidManifest.xml
#
# Requires python3 (present on macOS by default, and on every mainstream
# Linux distribution). The XML is parsed with the standard library, not with
# regexes, so namespace prefixes and attribute ordering do not matter.

set -euo pipefail

if [ "$#" -lt 1 ]; then
	echo "usage: $(basename "$0") <AndroidManifest.xml>" >&2
	exit 2
fi

manifest_path=$1
if [ ! -f "$manifest_path" ]; then
	echo "Manifest not found: $manifest_path" >&2
	exit 1
fi

exec python3 - "$manifest_path" <<'PY'
import sys
import xml.etree.ElementTree as ET

ANDROID_NS = "http://schemas.android.com/apk/res/android"
NS = {"android": ANDROID_NS}


def android_attr(node, name):
    if node is None:
        return ""
    return node.get("{%s}%s" % (ANDROID_NS, name), "") or ""


path = sys.argv[1]
try:
    root = ET.parse(path).getroot()
except ET.ParseError as error:
    sys.stderr.write("Manifest is not valid XML: %s\n" % error)
    raise SystemExit(1)

print("package=%s" % root.get("package", ""))

permissions = root.findall("uses-permission", NS)
print("permission_count=%d" % len(permissions))
for perm in permissions:
    name = android_attr(perm, "name")
    if name:
        print("permission=%s" % name)

components = [
    ("activity", "application/activity"),
    ("service", "application/service"),
    ("receiver", "application/receiver"),
    ("provider", "application/provider"),
]

for label, query in components:
    nodes = root.findall(query, NS)
    print("%s_count=%d" % (label, len(nodes)))
    for node in nodes:
        print(
            "%s=%s\t%s\t%s"
            % (
                label,
                android_attr(node, "name"),
                android_attr(node, "exported"),
                android_attr(node, "enabled"),
            )
        )

seen = []
for activity in root.findall("application/activity", NS):
    for intent_filter in activity.findall("intent-filter", NS):
        actions = [android_attr(a, "name") for a in intent_filter.findall("action", NS)]
        categories = [android_attr(c, "name") for c in intent_filter.findall("category", NS)]
        if "android.intent.action.MAIN" in actions and "android.intent.category.LAUNCHER" in categories:
            name = android_attr(activity, "name")
            if name not in seen:
                seen.append(name)

for name in seen:
    print("main_activity=%s" % name)
PY
