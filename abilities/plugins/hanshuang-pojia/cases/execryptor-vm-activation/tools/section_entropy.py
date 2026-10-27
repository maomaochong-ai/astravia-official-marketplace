#!/usr/bin/env python3
"""Section entropy and layout judgement for a packed native image.

Case E's decision was not "the packer is Execryptor"; it was a much smaller
observation that a human could check in one screenshot:

* a section that is writable *and* executable at the same time,
* that section carrying near-random bytes,
* the entry point landing in the last section, and
* no ASLR opt-in.

Those four are properties of the file, not opinions about it. This tool measures
them. The judgement at the end says "consistent with a self-unpacking stub" and
never "this is Execryptor": attribution needs the stub's own constants, which is
a manual read.

usage:
    python3 section_entropy.py --sample demo.exe
    python3 section_entropy.py --sample demo.exe --threshold 7.2 --out findings/
    python3 section_entropy.py --self-test
"""

import json
import math
import os
import struct
import sys

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli, fixtures, pe  # noqa: E402

DEFAULT_THRESHOLD = 7.0


def shannon(data):
    """Bits per byte, 0.0 for empty or single-valued input."""
    if not data:
        return 0.0
    counts = [0] * 256
    for byte in data:
        counts[byte] += 1
    total = float(len(data))
    entropy = 0.0
    for count in counts:
        if not count:
            continue
        probability = count / total
        entropy -= probability * math.log(probability, 2)
    return entropy


def section_rows(image, threshold):
    rows = []
    last_index = len(image.sections) - 1
    for index, section in enumerate(image.sections):
        raw = image.data[section.raw_off : section.raw_off + section.raw_size]
        entropy = shannon(raw)
        flags = []
        if section.executable:
            flags.append("X")
        if section.writable:
            flags.append("W")
        if not flags:
            flags.append("R")
        notes = []
        if section.executable and section.writable:
            notes.append("RWX")
        if entropy >= threshold:
            notes.append("high entropy")
        if len(raw) == 0:
            notes.append("no raw data (uninitialised)")
        contains_entry = section.va <= image.entry < section.end_rva()
        if contains_entry:
            notes.append("entry" + (" (last section)" if index == last_index else ""))
        rows.append(
            {
                "index": index,
                "name": section.name,
                "va": "0x{:X}".format(section.va),
                "raw_size": section.raw_size,
                "vsize": section.vsize,
                "flags": "".join(flags),
                "entropy": round(entropy, 3),
                "entry": contains_entry,
                "notes": ", ".join(notes) or "-",
            }
        )
    return rows


def judge(image, rows, threshold):
    """Short heuristic lines; each one names the measurement behind it."""
    lines = []
    rwx = [row for row in rows if "RWX" in row["notes"]]
    hot = [row for row in rows if row["entropy"] >= threshold and row["raw_size"]]
    entry_row = next((row for row in rows if row["entry"]), None)
    if rwx:
        lines.append(
            "{} section(s) are writable and executable: a stub that decrypts itself in place needs exactly this.".format(len(rwx))
        )
    if hot:
        lines.append(
            "{} section(s) measure at or above {:.1f} bits/byte, which is packed or encrypted payload rather than compiled code.".format(
                len(hot), threshold
            )
        )
    if entry_row and entry_row is rows[-1]:
        lines.append("The entry point sits in the last section, so the first bytes executed are the stub, not the program.")
    if not image.has_aslr():
        lines.append("The image does not opt into ASLR (DllCharacteristics has no DYNAMIC_BASE).")
    if image.has_dep() and rwx:
        lines.append("DEP is declared while an RWX section exists: the section was added by the packer, not by the linker.")
    if not lines:
        lines.append("No packing indicator measured above the threshold. If the case still applies, raise --threshold or check the stub manually.")
    lines.append("Attribution stays open: these are layout measurements, not a packer signature.")
    return lines


def main(options):
    cli.require(options, "sample")
    threshold = float(options.get("threshold") or DEFAULT_THRESHOLD)
    image = pe.read(options["sample"])
    rows = section_rows(image, threshold)

    report = cli.Report("section entropy and layout")
    report.field("sample", image.path)
    report.field("format", "{} {} {}-bit".format(image.kind, image.arch, image.bits))
    report.field("sha256", image.sha256)
    report.field("image base", "0x{:X}".format(image.image_base))
    report.field("entry", "0x{:X}".format(image.entry))
    report.field("dotnet", image.is_dotnet)
    report.bullet("DllCharacteristics: " + (", ".join(image.dll_flags()) or "none"))

    report.heading("sections")
    report.table(
        ["#", "name", "va", "raw", "entropy", "flags", "notes"],
        [
            [
                row["index"],
                row["name"],
                row["va"],
                row["raw_size"],
                "{:.3f}".format(row["entropy"]),
                row["flags"],
                row["notes"],
            ]
            for row in rows
        ],
    )

    report.heading("judgement (heuristic)")
    for line in judge(image, rows, threshold):
        report.bullet(line)

    out_dir = options.get("out")
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
        target = os.path.join(out_dir, "sections.json")
        payload = {
            "sample": image.path,
            "sha256": image.sha256,
            "format": {"kind": image.kind, "arch": image.arch, "bits": image.bits},
            "entry": "0x{:X}".format(image.entry),
            "dllCharacteristics": image.dll_flags(),
            "threshold": threshold,
            "sections": rows,
        }
        with open(target, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
        report.field("evidence", target)

    report.emit()
    return cli.EXIT_OK


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]

    results.append(shannon(b"") == 0.0)
    results.append(shannon(b"\x00" * 4096) == 0.0)
    results.append(abs(shannon(bytes(range(256)) * 4) - 8.0) < 1e-9)

    with fixtures.Workspace() as workspace:
        data = bytearray(fixtures.synthetic_pe(aslr=False))
        # Section header table starts at 0x178; VirtualSize +8, SizeOfRawData +16,
        # Characteristics +36. Mark .text as read/write/execute.
        section_at = 0x178
        struct.pack_into("<I", data, section_at + 36, 0xE0000020)
        # Fill the section body with a flat distribution so entropy is measurable.
        body = bytes(range(256)) * 2
        data[0x200 : 0x200 + len(body)] = body
        path = workspace.write("rwx.exe", bytes(data))
        image = pe.read(path)
        rows = section_rows(image, DEFAULT_THRESHOLD)
        results.append(rows[0]["flags"] == "XW")
        results.append("RWX" in rows[0]["notes"])
        results.append(abs(rows[0]["entropy"] - 8.0) < 1e-9)
        results.append("entry" in rows[0]["notes"])
        lines = judge(image, rows, DEFAULT_THRESHOLD)
        results.append(any("writable and executable" in line for line in lines))
        code = main({"sample": path, "threshold": "7.0", "out": None})
        results.append(code == cli.EXIT_OK)

    passed = sum(1 for item in results if item)
    sys.stdout.write("\nsection_entropy self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test))
