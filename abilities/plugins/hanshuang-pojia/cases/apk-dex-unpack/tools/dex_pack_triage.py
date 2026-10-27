#!/usr/bin/env python3
"""Packed APK triage: separate "the code is missing" from "the tool failed".

`jadx` returning a stub is not a finding. The case behind this tool exists
because that result was reported as one, and the real code only appeared after a
runtime dump. So the decision needs two independent readings before anyone
starts a device:

1. how thin the shipped DEX really is - class_defs, methods, string pool, size;
2. what the shell left behind - a loader class name in the string pool, native
   libraries, or an oversized asset blob that is not a DEX.

Two of those readings pointing the same way is the signal. One is a reason to
keep looking at the package before escalating.

The tool also validates a recovered dump, which is the step people skip: a
dumped file whose header does not agree with itself is a string constant that
happened to spell `dex`, not code.

usage:
    python3 dex_pack_triage.py --sample app.apk
    python3 dex_pack_triage.py --sample app.apk --dump exports/frida-dump/
    python3 dex_pack_triage.py --self-test
"""

import math
import os
import struct
import sys
import zipfile

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli, dex, fixtures  # noqa: E402

# Names a shell must carry: it has to be called from somewhere reachable, and it
# has to reach its payload. Each is checked against the DEX string pool.
LOADER_HINTS = (
    "loadlibrary",
    "stubapp",
    "proxyapplication",
    "appcomponentfactory",
    "libjiagu",
    "libmobisec",
    "libdexhelper",
    "libshella",
    "libexec.so",
    "jiagu",
    "bangcle",
    "secneo",
    "ijiami",
    "dexhelper",
)

CLASS_FLOOR = 50
THIN_FLOOR = 500
BLOB_FLOOR = 262144

BAND_PACKED = 55
BAND_SUSPICIOUS = 25


def shannon(data):
    if not data:
        return 0.0
    counts = [0] * 256
    for byte in data:
        counts[byte] += 1
    total = float(len(data))
    result = 0.0
    for count in counts:
        if not count:
            continue
        probability = count / total
        result -= probability * math.log(probability, 2)
    return result


def validate(name, data):
    """Header self-consistency for one candidate DEX dump."""
    if data[:4] != b"dex\n":
        return {"name": name, "size": len(data), "ok": False, "problems": ["missing dex magic"]}
    if len(data) < dex.HEADER_SIZE:
        return {"name": name, "size": len(data), "ok": False, "problems": ["header truncated"]}
    try:
        parsed = dex.Dex(name, data)
    except Exception as error:  # noqa: BLE001 - a dump can be anything at all
        return {"name": name, "size": len(data), "ok": False, "problems": [str(error)]}
    problems = parsed.problems()
    return {
        "name": name,
        "size": len(data),
        "version": parsed.magic[4:7].decode("ascii", "replace"),
        "file_size_field": parsed.file_size,
        "ok": not problems,
        "problems": problems,
    }


def open_entries(path):
    rows = []
    with zipfile.ZipFile(path) as archive:
        for info in archive.infolist():
            rows.append({"name": info.filename, "size": info.file_size, "compressed": info.compress_size})
    return rows


def dex_units(path):
    out = []
    with zipfile.ZipFile(path) as archive:
        for info in archive.infolist():
            if not (info.filename.startswith("classes") and info.filename.endswith(".dex")):
                continue
            data = archive.read(info.filename)
            try:
                parsed = dex.Dex(info.filename, data)
            except Exception as error:  # noqa: BLE001 - a broken entry is evidence, not a crash
                out.append(
                    {
                        "name": info.filename,
                        "size": len(data),
                        "classes": 0,
                        "methods": 0,
                        "strings": 0,
                        "entropy": shannon(data),
                        "problems": [str(error)],
                        "unreadable": True,
                    }
                )
                continue
            out.append(
                {
                    "name": info.filename,
                    "size": len(data),
                    "classes": parsed.class_defs_size,
                    "methods": parsed.method_ids_size,
                    "strings": parsed.string_ids_size,
                    "entropy": shannon(data),
                    "problems": parsed.problems(),
                    "unreadable": False,
                }
            )
    return out


def loader_strings(units_path):
    """Shell names, read from the string pool of every shipped DEX."""
    hits = []
    for entry in dex.read(units_path):
        for hint in LOADER_HINTS:
            for row in entry.find_strings(hint, limit=3):
                hits.append({"dex": entry.name, "text": row["text"]})
    seen = set()
    unique = []
    for row in hits:
        if row["text"] in seen:
            continue
        seen.add(row["text"])
        unique.append(row)
    return unique


def blobs(entries, path, floor=BLOB_FLOOR):
    """Entries big enough to hide a payload, entropy included. Not a DEX by name."""
    out = []
    for row in entries:
        name = row["name"]
        if name.startswith("classes") and name.endswith(".dex"):
            continue
        if not (name.startswith("assets/") or name.startswith("lib/")):
            continue
        if row["size"] < floor:
            continue
        out.append(row)
    out.sort(key=lambda row: row["size"], reverse=True)
    with zipfile.ZipFile(path) as archive:
        for row in out:
            row["entropy"] = shannon(archive.read(row["name"])[: 4 * 1024 * 1024])
    return out



def shell_evidence(units, native, big_blobs, strings):
    signals = []

    total_classes = sum(unit["classes"] for unit in units)
    total_methods = sum(unit["methods"] for unit in units)
    if total_classes < CLASS_FLOOR:
        signals.append(
            {
                "signal": "thin-dex",
                "detail": "{} classes and {} methods across {} file(s): below the floor of {}".format(
                    total_classes, total_methods, len(units), CLASS_FLOOR
                ),
            }
        )
    elif total_classes < THIN_FLOOR:
        signals.append(
            {
                "signal": "thin-dex",
                "detail": "{} classes: a large app usually ships more, but this is not decisive".format(total_classes),
            }
        )

    if strings:
        signals.append(
            {
                "signal": "loader-name",
                "detail": "{} shell string(s), first: {}".format(len(strings), strings[0]["text"][:60]),
            }
        )

    if native:
        signals.append(
            {
                "signal": "native-payload",
                "detail": "{} native library(ies): {}".format(len(native), ", ".join(row["name"] for row in native[:4])),
            }
        )

    if big_blobs:
        first = big_blobs[0]
        signals.append(
            {
                "signal": "big-blob",
                "detail": "{} is {} bytes, entropy {:.2f}".format(first["name"], first["size"], first["entropy"]),
            }
        )

    return signals


SIGNAL_WEIGHTS = {"thin-dex": 45, "loader-name": 40, "native-payload": 15, "big-blob": 10}


def assess(path):
    entries = open_entries(path)
    units = dex_units(path)
    strings = loader_strings(path)
    native = [row for row in entries if row["name"].startswith("lib/") and row["name"].endswith(".so")]
    big = blobs(entries, path)
    signals = shell_evidence(units, native, big, strings)
    score = sum(SIGNAL_WEIGHTS[row["signal"]] for row in signals)
    if score >= BAND_PACKED:
        band = "packed"
    elif score >= BAND_SUSPICIOUS:
        band = "suspicious"
    else:
        band = "thin but unexplained"
    return {
        "entries": len(entries),
        "units": units,
        "strings": strings,
        "native": native,
        "blobs": big,
        "signals": signals,
        "score": score,
        "band": band,
    }


def reading(result):
    lines = []
    if result["band"] == "packed":
        lines.append("The shipped DEX is not where the code is: plan for a runtime dump, not a better decompiler.")
        lines.append("Spawn rather than attach, and dump with the screen that triggers decryption open.")
    elif result["band"] == "suspicious":
        lines.append("One reading points at a shell and the others do not. Name the loader anchor before starting a device.")
    else:
        lines.append("Nothing in the package says the code is encrypted. If jadx looked empty, check the tool's own output.")
    lines.append("Validate every recovered file before believing it: a dump that fails the header check is a string constant.")
    return lines


def render_report(path, result, dumps):
    report = cli.Report("packed APK triage")
    report.field("sample", path)
    report.field("zip entries", result["entries"])

    report.heading("dex units")
    if result["units"]:
        report.table(
            ["dex", "bytes", "classes", "methods", "strings", "entropy", "problems"],
            [
                [
                    row["name"],
                    row["size"],
                    row["classes"],
                    row["methods"],
                    row["strings"],
                    "{:.2f}".format(row["entropy"]),
                    "; ".join(row["problems"])[:60] or "-",
                ]
                for row in result["units"]
            ],
        )
    else:
        report.line("none - the package ships no classes*.dex")

    report.heading("shell evidence")
    if result["signals"]:
        report.table(
            ["signal", "weight", "detail"],
            [[row["signal"], SIGNAL_WEIGHTS[row["signal"]], row["detail"]] for row in result["signals"]],
        )
    else:
        report.line("none - no thin-DEX, loader name, native library or oversized blob")

    report.heading("oversized non-dex entries")
    if result["blobs"]:
        report.table(
            ["entry", "bytes", "entropy"],
            [[row["name"], row["size"], "{:.2f}".format(row["entropy"])] for row in result["blobs"][:20]],
        )
    else:
        report.line("none above the size floor")

    report.heading("verdict")
    report.line("score {}/100 -> {}".format(result["score"], result["band"]))
    for line in reading(result):
        report.line(line)

    if dumps is not None:
        report.heading("recovered dumps")
        if not dumps:
            report.line("none given")
        else:
            report.table(
                ["file", "bytes", "version", "header file_size", "verdict"],
                [
                    [
                        row["name"],
                        row["size"],
                        row.get("version", "?"),
                        row.get("file_size_field", "?"),
                        "accepted" if row["ok"] else "; ".join(row["problems"])[:60],
                    ]
                    for row in dumps
                ],
            )
            accepted = sum(1 for row in dumps if row["ok"])
            report.line("{} of {} recovered files pass the header check".format(accepted, len(dumps)))
    return report


def collect_dumps(target):
    """A file, or every *.dex under a directory (what a dump produces)."""
    if target is None:
        return None
    rows = []
    if os.path.isdir(target):
        for name in sorted(os.listdir(target)):
            if not name.endswith(".dex"):
                continue
            path = os.path.join(target, name)
            with open(path, "rb") as handle:
                rows.append(validate(name, handle.read()))
        return rows
    for part in target.split(","):
        part = part.strip()
        if not part:
            continue
        with open(part, "rb") as handle:
            rows.append(validate(os.path.basename(part), handle.read()))
    return rows


def main(options):
    cli.require(options, "sample")
    result = assess(options["sample"])
    dumps = collect_dumps(options.get("dump"))
    render_report(options["sample"], result, dumps).emit()
    if dumps is not None and not all(row["ok"] for row in dumps):
        return cli.EXIT_FAIL
    return cli.EXIT_OK


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]

    with fixtures.Workspace() as workspace:
        stub = workspace.apk(
            "stub.apk",
            strings=["Lcom/demo/StubApp;", "loadLibrary", "libjiagu.so", "isLicensed"],
        )
        plain = workspace.apk("plain.apk", strings=["Lcom/demo/Gate;", "isLicensed", "checkVip"])

        stub_result = assess(stub)
        plain_result = assess(plain)

        results.append(len(stub_result["units"]) == 1 and stub_result["units"][0]["name"] == "classes.dex")
        results.append(stub_result["units"][0]["classes"] == 0 and stub_result["units"][0]["methods"] >= 4)
        results.append(any("stub" in row["text"].lower() for row in stub_result["strings"]))
        results.append(stub_result["band"] == "packed")
        results.append(plain_result["band"] != "packed")
        results.append(shannon(bytes(range(256))) > 7.9)

        good = validate("classes.dex", fixtures.synthetic_dex())
        bad = validate("decoy.dex", b"dex\n035\x00" + b"\x00" * 0x70)
        results.append(good["ok"] and not bad["ok"])

        rendered = "\n".join(render_report("stub.apk", stub_result, [good, bad]).lines)
        results.append("| dex" in rendered and "1 of 2 recovered files" in rendered)

    passed = sum(1 for item in results if item)
    sys.stdout.write("\ndex_pack_triage self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


FLAGS = ()
VALUES = ("sample", "dump")


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test, FLAGS, VALUES))
