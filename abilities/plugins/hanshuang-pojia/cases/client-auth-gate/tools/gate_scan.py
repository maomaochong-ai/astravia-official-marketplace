#!/usr/bin/env python3
"""Gate scan: find client-side entitlement decisions in a DEX or APK.

The CWE-602 shape this looks for is narrow and checkable: a method whose name
says "this decides entitlement" lives in application code, and nothing in the
same package talks to a server about it. That combination is what makes a local
boolean authoritative.

The tool reports two lists and does not guess a verdict on its own:

* candidate gates   - application methods whose name carries an entitlement word
* authority surface - strings that look like endpoints or receipt validation

If the first list is non-empty and the second is empty, the package decides
entitlement locally. That inference stays with the operator; the tool only puts
the two lists side by side, which is what a report has to cite.

usage:
    python3 gate_scan.py --sample app.apk
    python3 gate_scan.py --sample classes.dex --query vip --out findings/
    python3 gate_scan.py --self-test
"""

import os
import sys

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli, dex, fixtures  # noqa: E402

GATE_HINTS = (
    "licen",
    "vip",
    "premium",
    "subscri",
    "purchase",
    "entitle",
    "unlock",
    "trial",
    "activ",
    "cardkey",
    "redeem",
    "quota",
    "pro_",
    "ispro",
    "upgrade",
)

AUTHORITY_HINTS = (
    "/api/",
    "/v1/",
    "/v2/",
    "https://",
    "receipt",
    "jws",
    "jwt",
    "verifypurchase",
    "play.google.com",
)

FRAMEWORK_PREFIXES = (
    "Landroid/",
    "Landroidx/",
    "Ljava/",
    "Ljavax/",
    "Lkotlin/",
    "Lkotlinx/",
    "Lcom/google/android/",
    "Ldalvik/",
    "Lorg/jetbrains/",
)


def application_method(name):
    return not name.startswith(FRAMEWORK_PREFIXES)


def scan(dexes, hints):
    gates = []
    for entry in dexes:
        for index in range(entry.method_ids_size):
            try:
                method = entry.method_at(index)
            except Exception:  # noqa: BLE001 - a damaged table must not abort the scan
                continue
            if not application_method(method["class"]):
                continue
            haystack = (method["class"] + "->" + method["name"]).lower()
            matched = [hint for hint in hints if hint in haystack]
            if not matched:
                continue
            gates.append(
                {
                    "dex": entry.name,
                    "method": "{}->{}".format(method["class"], method["name"]),
                    "hints": matched,
                }
            )
    return gates


def authority(dexes):
    out = []
    for entry in dexes:
        for hit in entry.find_strings("/", limit=4000):
            text = hit["text"]
            lowered = text.lower()
            if not any(hint in lowered for hint in AUTHORITY_HINTS):
                continue
            out.append({"dex": entry.name, "text": text})
    seen = set()
    unique = []
    for row in out:
        if row["text"] in seen:
            continue
        seen.add(row["text"])
        unique.append(row)
    return unique


def render_patch_skeleton(gates):
    """A patch-table skeleton: the operator fills in the branch bytes."""
    lines = [
        "# patch-table skeleton - fill in the addressed site from the disassembly.",
        "# Each row is: <rva or file offset> | <original bytes> | <patched bytes> | note",
    ]
    for row in gates:
        lines.append("# 0x000000 | 0F 85 ?? ?? ?? ?? | 0F 84 ?? ?? ?? ?? | {} -> force the non-entitled branch".format(row["method"]))
    return "\n".join(lines) + "\n"


def main(options):
    cli.require(options, "sample")
    hints = GATE_HINTS
    if options.get("query"):
        hints = tuple(part.strip().lower() for part in options["query"].split(",") if part.strip())
    dexes = dex.read(options["sample"])
    report = cli.Report("client-side entitlement scan")
    report.field("sample", options["sample"])
    report.field("dex units", len(dexes))
    for entry in dexes:
        summary = entry.summary()
        report.bullet(
            "{}: {} strings, {} methods, version {}".format(
                summary["name"], summary["strings"], summary["methods"], summary["version"]
            )
        )
        for problem in summary["problems"]:
            report.line("  ! " + problem)

    gates = scan(dexes, hints)
    endpoints = authority(dexes)

    report.heading("candidate gates")
    if gates:
        report.table(["dex", "method", "hints"], [[row["dex"], row["method"], ",".join(row["hints"])] for row in gates])
    else:
        report.line("none - no application method name carries an entitlement word")

    report.heading("authority surface")
    if endpoints:
        report.table(["dex", "string"], [[row["dex"], row["text"][:90]] for row in endpoints[:40]])
        if len(endpoints) > 40:
            report.line("  ({} more)".format(len(endpoints) - 40))
    else:
        report.line("none - no endpoint or receipt string found in the string pool")

    report.heading("reading")
    if gates and not endpoints:
        report.line("Gates exist and no server authority is reachable from this package:")
        report.line("treat the entitlement decision as client-side until the network trace says otherwise.")
    elif gates and endpoints:
        report.line("Gates exist and endpoint strings exist: the question is whether the gate *calls* one.")
        report.line("Resolve the call graph before claiming a client-side finding.")
    else:
        report.line("No client-side gate found by name. Rename-obfuscated gates need the string pool, not method names.")

    out_dir = options.get("out")
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
        target = os.path.join(out_dir, "patch-table.skeleton.txt")
        with open(target, "w", encoding="utf-8") as handle:
            handle.write(render_patch_skeleton(gates))
        report.field("skeleton", target)

    report.emit()
    return cli.EXIT_OK


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]
    with fixtures.Workspace() as workspace:
        path = workspace.apk("gate.apk")
        dexes = dex.read(path)
        gates = scan(dexes, GATE_HINTS)
        cli_line = "{}->{}".format(gates[0]["method"], "") if gates else ""
        results.append(cli_line.startswith("Lcom/demo/Gate;->"))
        results.append(any("isLicensed" in row["method"] for row in gates))
        skeleton = render_patch_skeleton(gates)
        results.append(skeleton.count("\n") >= 3)
        report = cli.Report("t")
        report.table(["a"], [["b"]])
        results.append("| b" in "\n".join(report.lines))
    passed = sum(1 for item in results if item)
    sys.stdout.write("\ngate_scan self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


FLAGS = ()
VALUES = ("sample", "query", "out")


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test, FLAGS, VALUES))
