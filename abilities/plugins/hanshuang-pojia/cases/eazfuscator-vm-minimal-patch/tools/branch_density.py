#!/usr/bin/env python3
"""Locate the densest branch clusters in an executable image.

Case N's patch was two bytes. Finding those two bytes took a day, because the
interesting code is not where the entry point is: it is inside whichever
dispatcher has the most control flow per byte. Branch density is the cheapest
way to find that dispatcher without a full analysis.

How it measures, and what that costs:

* a sliding window (default 256 bytes, stepped by 16) walks each executable
  section,
* inside a window it counts ``0F 8x`` and ``7x`` (conditional jumps), ``E8``
  (direct call) and ``FF 25`` (indirect jump),
* density is counts per 100 bytes of window.

The scan is a byte scan, not an instruction-aligned sweep: a ``7x`` byte inside
an immediate operand is counted too. That inflates the number for data-heavy
sections, which is exactly why the report prints raw counts beside the density
and why the reading says "candidate" rather than "dispatcher".

usage:
    python3 branch_density.py --sample packed.exe
    python3 branch_density.py --sample packed.exe --window 512 --top 20
    python3 branch_density.py --self-test
"""

import os
import sys

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli, fixtures, pe  # noqa: E402

DEFAULT_WINDOW = 256
DEFAULT_STEP = 16
DEFAULT_TOP = 10
DEFAULT_MAX_BYTES = 16 * 1024 * 1024


def count_branches(blob):
    """Conditional jumps, direct calls and indirect jumps in one window."""
    conditional = 0
    index = 0
    length = len(blob)
    while index < length - 1:
        byte = blob[index]
        if byte == 0x0F and 0x80 <= blob[index + 1] <= 0x8F:
            conditional += 1
            index += 2
            continue
        if 0x70 <= byte <= 0x7F:
            conditional += 1
        index += 1
    calls = 0
    index = 0
    while index < length:
        if blob[index] == 0xE8:
            calls += 1
        index += 1
    indirect = 0
    index = 0
    while index < length - 1:
        if blob[index] == 0xFF and blob[index + 1] == 0x25:
            indirect += 1
            index += 2
            continue
        index += 1
    return {"conditional": conditional, "call": calls, "indirect": indirect}


def windows(image, window, step, max_bytes):
    """Per-window measurements for every executable section."""
    out = []
    for section in image.sections:
        if not section.executable or not section.raw_size:
            continue
        body = image.data[section.raw_off : section.raw_off + min(section.raw_size, max_bytes)]
        if len(body) < window:
            counts = count_branches(body)
            total = counts["conditional"] + counts["call"] + counts["indirect"]
            out.append(
                {
                    "section": section.name,
                    "rva": section.va,
                    "size": len(body),
                    "counts": counts,
                    "total": total,
                    "density": round(total * 100.0 / max(1, len(body)), 2),
                }
            )
            continue
        for start in range(0, len(body) - window + 1, step):
            chunk = body[start : start + window]
            counts = count_branches(chunk)
            total = counts["conditional"] + counts["call"] + counts["indirect"]
            out.append(
                {
                    "section": section.name,
                    "rva": section.va + start,
                    "size": window,
                    "counts": counts,
                    "total": total,
                    "density": round(total * 100.0 / window, 2),
                }
            )
    return out


def section_totals(rows):
    totals = {}
    for row in rows:
        entry = totals.setdefault(row["section"], {"windows": 0, "branches": 0, "density": 0.0})
        entry["windows"] += 1
        entry["branches"] += row["total"]
    for name, entry in totals.items():
        span = sum(row["size"] for row in rows if row["section"] == name)
        entry["density"] = round(entry["branches"] * 100.0 / max(1, span), 2)
    return totals


def classify(rows, top):
    """A cluster is interesting when it stands well above its own section mean."""
    if not rows:
        return []
    totals = section_totals(rows)
    ranked = []
    for row in rows:
        mean = totals[row["section"]]["density"] or 1.0
        ranked.append((row["density"] / mean if mean else 0.0, row))
    if not ranked:
        return []
    baseline = min(row["density"] for row in rows)
    picked = []
    for ratio, row in ranked:
        if row["density"] <= baseline:
            continue
        if row["counts"]["conditional"] == 0:
            continue
        picked.append((ratio, row))
    picked.sort(key=lambda item: (-item[0], -item[1]["density"]))
    return [row for _ratio, row in picked[:top]]


def main(options):
    cli.require(options, "sample")
    window = int(options.get("window") or DEFAULT_WINDOW)
    top = int(options.get("top") or DEFAULT_TOP)
    max_bytes = int(options.get("max-bytes") or DEFAULT_MAX_BYTES)
    if window < 16:
        raise cli.UsageError("--window must be at least 16 bytes")

    image = pe.read(options["sample"])
    rows = windows(image, window, DEFAULT_STEP, max_bytes)

    report = cli.Report("branch density and stub probes")
    report.field("sample", image.path)
    report.field("format", "{} {} {}-bit".format(image.kind, image.arch, image.bits))
    report.field("entry", "0x{:X}".format(image.entry))
    report.field("window", "{} bytes, step {}".format(window, DEFAULT_STEP))
    if image.bits and image.bits != 32 and image.arch.startswith("x86"):
        report.bullet("x86-64 image: 7x and 0F 8x are still conditional jumps; E8 rel32 is still a direct call.")

    report.heading("per section")
    totals = section_totals(rows)
    if totals:
        report.table(
            ["section", "windows", "branches", "per 100 bytes"],
            [[name, entry["windows"], entry["branches"], "{:.2f}".format(entry["density"])] for name, entry in sorted(totals.items())],
        )
    else:
        report.line("no executable section with raw data")

    report.heading("densest windows")
    picked = classify(rows, top)
    if picked:
        report.table(
            ["section", "rva", "cond", "call", "indirect", "per 100 bytes"],
            [
                [
                    row["section"],
                    "0x{:X}".format(row["rva"]),
                    row["counts"]["conditional"],
                    row["counts"]["call"],
                    row["counts"]["indirect"],
                    "{:.2f}".format(row["density"]),
                ]
                for row in picked
            ],
        )
    else:
        report.line("no window stands above its section baseline")
    if not rows:
        report.bullet("Nothing measured: the image has no executable section with raw data.")

    report.heading("reading (heuristic)")
    if picked:
        first = picked[0]
        report.bullet(
            "Densest cluster: {} at RVA 0x{:X}, {:.2f} branches per 100 bytes.".format(
                first["section"], first["rva"], first["density"]
            )
        )
        report.bullet(
            "A dispatcher, an obfuscator loop or a switch table all look like this. Disassemble the window before naming it."
        )
    calls = sum(row["counts"]["call"] for row in rows)
    indirect = sum(row["counts"]["indirect"] for row in rows)
    report.bullet("{} direct call sites and {} indirect jumps across the measured windows.".format(calls, indirect))
    report.bullet("Byte scanning counts opcodes inside immediates too: treat these numbers as a ranking, not a branch census.")
    if image.bits == 64 and image.arch.startswith("x86"):
        report.bullet("On x86-64 prefer a 5-byte patch (relative branch) over a 2-byte one when the target is more than 127 bytes away.")

    report.emit()
    return cli.EXIT_OK


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]

    results.append(count_branches(b"\x0F\x85\x00\x00\x00\x00") == {"conditional": 1, "call": 0, "indirect": 0})
    results.append(count_branches(b"\x74\x00\x74\x00")["conditional"] == 2)
    results.append(count_branches(b"\xE8\x00\x00\x00\x00\xFF\x25\x00\x00\x00\x00") == {"conditional": 0, "call": 1, "indirect": 1})
    results.append(count_branches(b"\x00" * 64)["conditional"] == 0)

    with fixtures.Workspace() as workspace:
        data = bytearray(fixtures.synthetic_pe())
        dense = bytes.fromhex("0F8500000000") * 24
        data[0x300 : 0x300 + len(dense)] = dense
        path = workspace.write("dense.exe", bytes(data))
        image = pe.read(path)
        rows = windows(image, 256, 16, DEFAULT_MAX_BYTES)
        results.append(bool(rows) and all(row["section"] == ".text" for row in rows))
        hottest = max(rows, key=lambda row: row["density"])
        results.append(hottest["counts"]["conditional"] > 0)
        # The dense block was written at file 0x300, which is RVA 0x1100; the
        # winning window may start earlier because it overlaps the block.
        results.append(hottest["rva"] <= 0x1100 < hottest["rva"] + hottest["size"])
        picked = classify(rows, 5)
        results.append(bool(picked) and picked[0]["counts"]["conditional"] > 0)
        results.append(section_totals(rows)[".text"]["branches"] > 0)

        plain = workspace.write("plain.exe", fixtures.synthetic_pe())
        plain_rows = windows(pe.read(plain), 256, 16, DEFAULT_MAX_BYTES)
        results.append(sum(row["total"] for row in plain_rows) < section_totals(rows)[".text"]["branches"] / 4)
        results.append(main({"sample": path, "window": "128", "top": "5", "max-bytes": None}) == cli.EXIT_OK)

    passed = sum(1 for item in results if item)
    sys.stdout.write("\nbranch_density self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test))
