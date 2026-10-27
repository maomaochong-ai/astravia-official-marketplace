#!/usr/bin/env python3
"""Packed ELF triage: decide from the bytes whether the code is really there.

The case this belongs to exists because of one repeated mistake: reading a
loader and describing it as the programme. The loader imports memory functions
instead of library functions, its executable segment does not look like code,
and its entry point is not where a linker would put it. Those are properties of
the file, so they can be measured before anything is executed.

Five signals, each with the evidence that produced it:

1. packer-marker     - a known stub string (UPX, VMProtect, MPRESS, ...);
2. rwx-segment       - a load segment that is both writable and executable;
3. high-entropy      - an executable segment at or above the entropy floor;
4. no-libc-symbols   - a dynamically linked programme that names none of the
                       functions it would normally call;
5. entry-outside     - the entry point does not fall inside any load segment.

The tool sums weights and prints a band, but the weights are a reading aid, not
a verdict: a stripped static binary can score without being packed, and that is
why every signal carries its own line of evidence. Nothing is executed, and the
report says which file each address belongs to.

usage:
    python3 elf_pack_scan.py --sample packed.bin
    python3 elf_pack_scan.py --sample a.bin,b.bin --min-entropy 7.0
    python3 elf_pack_scan.py --self-test
"""

import math
import os
import sys

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli, fixtures, pe  # noqa: E402

DEFAULT_ENTROPY = 7.2

# Marker bytes, not marker names: these survive in the file even when the string
# table has been stripped, because the stub matches on them itself.
PACKER_MARKERS = (
    b"UPX!",
    b"UPX0",
    b"UPX1",
    b"$Info: This file is packed",
    b"VMProtect",
    b".vmp0",
    b"MPRESS1",
    b"ASPack",
    b"Themida",
    b"PECompact",
    b"Enigma protector",
    b"pyinstaller",
)

# A normally linked programme names the functions it calls. A loader names the
# ones it needs to build code at run time, which is a different set.
LIBC_SYMBOLS = (
    b"printf\x00",
    b"puts\x00",
    b"malloc\x00",
    b"fopen\x00",
    b"memcpy\x00",
    b"strlen\x00",
    b"__libc_start_main\x00",
)

LOADER_SYMBOLS = (
    b"mmap\x00",
    b"mprotect\x00",
    b"madvise\x00",
    b"dlopen\x00",
    b"dlsym\x00",
    b"memfd_create\x00",
)

WEIGHTS = {
    "packer-marker": 45,
    "rwx-segment": 30,
    "high-entropy": 25,
    "no-libc-symbols": 20,
    "entry-outside": 20,
}

BAND_PACKED = 55
BAND_SUSPICIOUS = 25


def shannon(data):
    """Entropy in bits per byte, 0.0 for empty input."""
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


def segment_rows(image):
    rows = []
    for section in image.sections:
        raw = image.data[section.raw_off : section.raw_off + section.raw_size]
        rows.append(
            {
                "name": section.name,
                "va": section.va,
                "raw_size": section.raw_size,
                "vsize": section.vsize,
                "entropy": shannon(raw),
                "writable": section.writable,
                "executable": section.executable,
            }
        )
    return rows


def markers(image):
    hits = []
    for marker in PACKER_MARKERS:
        at = image.data.find(marker)
        while at >= 0:
            hits.append({"offset": at, "marker": marker.decode("ascii", "replace")})
            at = image.data.find(marker, at + 1)
            if len(hits) > 64:
                return hits
    hits.sort(key=lambda row: row["offset"])
    return hits


def symbol_presence(image):
    present_libc = [name for name in LIBC_SYMBOLS if name in image.data]
    present_loader = [name for name in LOADER_SYMBOLS if name in image.data]
    return {
        "libc": [name.rstrip(b"\x00").decode("ascii") for name in present_libc],
        "loader": [name.rstrip(b"\x00").decode("ascii") for name in present_loader],
    }


def entry_segment(image, rows):
    for row in rows:
        if row["va"] <= image.entry < row["va"] + max(row["vsize"], row["raw_size"]):
            return row
    return None


def assess(image, min_entropy=DEFAULT_ENTROPY):
    """Every signal, with the detail that justifies it. Order is stable."""
    from_markers = markers(image)
    rows = segment_rows(image)
    symbols = symbol_presence(image)
    holder = entry_segment(image, rows)

    signals = []

    if from_markers:
        first = from_markers[0]
        signals.append(
            {
                "signal": "packer-marker",
                "detail": "{} at 0x{:X} ({} hits)".format(first["marker"], first["offset"], len(from_markers)),
            }
        )

    rwx = [row for row in rows if row["writable"] and row["executable"]]
    if rwx:
        signals.append(
            {
                "signal": "rwx-segment",
                "detail": "{} is W+X (va 0x{:X}, raw {} bytes)".format(rwx[0]["name"], rwx[0]["va"], rwx[0]["raw_size"]),
            }
        )

    dense = [row for row in rows if row["executable"] and row["raw_size"] >= 256 and row["entropy"] >= min_entropy]
    if dense:
        signals.append(
            {
                "signal": "high-entropy",
                "detail": "{} entropy {:.2f} over {} raw bytes (floor {:.1f})".format(
                    dense[0]["name"], dense[0]["entropy"], dense[0]["raw_size"], min_entropy
                ),
            }
        )

    if image.is_elf() and not symbols["libc"]:
        detail = "no libc symbol strings"
        if symbols["loader"]:
            detail += "; loader symbols present: " + ", ".join(symbols["loader"][:6])
        signals.append({"signal": "no-libc-symbols", "detail": detail})

    if rows and holder is None:
        signals.append(
            {
                "signal": "entry-outside",
                "detail": "entry 0x{:X} is not inside any load segment".format(image.entry),
            }
        )

    score = sum(WEIGHTS[row["signal"]] for row in signals)
    if score >= BAND_PACKED:
        band = "packed"
    elif score >= BAND_SUSPICIOUS:
        band = "suspicious"
    else:
        band = "unpacked"
    return {
        "segments": rows,
        "markers": from_markers,
        "symbols": symbols,
        "signals": signals,
        "score": score,
        "band": band,
        "entry_segment": holder["name"] if holder else "<none>",
    }


def reading(result):
    """The sentences a report has to restate, one per line."""
    lines = []
    if result["band"] == "packed":
        lines.append(
            "The file is a loader: at least one signal says the executable bytes on disk are not the programme."
        )
        lines.append(
            "Dump the payload before analysing it, and label every later address with the file it came from."
        )
    elif result["band"] == "suspicious":
        lines.append("Mixed signals: a thin import surface and an odd entry point without a known stub.")
        lines.append("Run the entry point under a disassembler before concluding either way.")
    else:
        lines.append("No packing evidence found. If the strings still look empty, check for stripping rather than packing.")
    if result["symbols"]["loader"]:
        lines.append("Loader symbols are present: the unpacking loop is what they are for.")
    return lines


def render_report(path, image, result, min_entropy):
    report = cli.Report("packed image triage")
    report.field("sample", path)
    report.field("sha256", image.sha256)
    report.field("kind", "{} {} {}-bit".format(image.kind, image.arch, image.bits) if image.bits else image.kind)
    report.field("entry", "0x{:X} (segment {})".format(image.entry, result["entry_segment"]))

    report.heading("segments")
    report.table(
        ["segment", "va", "raw", "vsize", "entropy", "flags"],
        [
            [
                row["name"],
                "0x{:X}".format(row["va"]),
                row["raw_size"],
                row["vsize"],
                "{:.2f}".format(row["entropy"]),
                ("W" if row["writable"] else "-") + ("X" if row["executable"] else "-"),
            ]
            for row in result["segments"]
        ],
    )

    report.heading("packer markers")
    if result["markers"]:
        report.table(
            ["offset", "marker"],
            [["0x{:X}".format(row["offset"]), row["marker"]] for row in result["markers"][:20]],
        )
    else:
        report.line("none - no stub marker bytes in the file")

    report.heading("signals")
    if result["signals"]:
        report.table(
            ["signal", "weight", "detail"],
            [[row["signal"], WEIGHTS[row["signal"]], row["detail"]] for row in result["signals"]],
        )
    else:
        report.line("none - no packing signal fired")

    report.heading("verdict")
    report.line("score {}/100 (entropy floor {:.1f}) -> {}".format(result["score"], min_entropy, result["band"]))
    for line in reading(result):
        report.line(line)
    return report


def main(options):
    cli.require(options, "sample")
    min_entropy = float(options.get("min_entropy", DEFAULT_ENTROPY))
    samples = [part.strip() for part in options["sample"].split(",") if part.strip()]
    for path in samples:
        image = pe.read(path)
        result = assess(image, min_entropy=min_entropy)
        render_report(path, image, result, min_entropy).emit()
    return cli.EXIT_OK


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]

    # entropy has to behave like entropy before any threshold means anything
    results.append(abs(shannon(bytes(range(256))) - 8.0) < 0.01)
    results.append(shannon(b"\x00" * 4096) == 0.0)

    with fixtures.Workspace() as workspace:
        packed = pe.read(workspace.elf("packed.bin", packed=True))
        clean = pe.read(workspace.elf("clean.bin", packed=False))

        packed_result = assess(packed)
        clean_result = assess(clean)

        results.append([row["marker"] for row in packed_result["markers"]].count("UPX0") == 1)
        results.append(packed_result["band"] == "packed")
        results.append(clean_result["band"] != "packed")
        results.append(
            any(row["signal"] == "entry-outside" for row in packed_result["signals"])
        )
        rendered = "\n".join(render_report("packed.bin", packed, packed_result, DEFAULT_ENTROPY).lines)
        results.append("| signal" in rendered and "-> packed" in rendered)

    passed = sum(1 for item in results if item)
    sys.stdout.write("\nelf_pack_scan self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


FLAGS = ()
VALUES = ("sample", "min_entropy", "out")


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test, FLAGS, VALUES))
