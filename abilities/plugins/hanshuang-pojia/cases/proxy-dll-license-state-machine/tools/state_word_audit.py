#!/usr/bin/env python3
"""State-word audit: find the global that a local authorisation decision writes.

The case this tool comes from has one lesson that repeats on every target: the
five patches that "worked" all edited what the UI *reads*, and the startup path
kept *writing* the trial value a moment later. So the question is never "where
is the licence flag", it is "which global has a writer, and where is it".

This tool answers that from a static PE: it scans the executable sections for
the canonical x86-64 forms that address a global RIP-relative, groups them by
target address, and separates readers from writers.

    python3 state_word_audit.py --sample app.exe
    python3 state_word_audit.py --sample app.exe --word --json out.json
    python3 state_word_audit.py --self-test

The verdict column is the point of the tool:

* ``single-writer``  - exactly one write site. That site is the gate; patching a
  reader will be undone at the next call.
* ``read-only``      - no write site in code. Patching a reader here changes the
  display and nothing else. This is the shape of a cosmetic patch.
* ``multi-writer``   - several writers. A single-site patch leaves the others.

What it is not: a disassembler. It recognises the RIP-relative operand forms
that compilers actually emit for globals and reports them as observed bytes with
their address. A hit is a place to look, not a conclusion; the report says so.
"""

import json
import os
import sys

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli, fixtures, pe, scan  # noqa: E402

# ModRM bytes whose mod=00 and rm=101 mean "RIP + disp32".
RIP_MODRM = {0x05, 0x0D, 0x15, 0x1D, 0x2D, 0x35, 0x3D}

READ = "read"
WRITE = "write"
ADDRESS = "address"


def _disp32(data, offset):
    value = int.from_bytes(data[offset : offset + 4], "little")
    return value - 0x100000000 if value & 0x80000000 else value


def _matches(data, index):
    """Yield (kind, width, instruction_length, disp_offset) for ``index``.

    ``disp_offset`` is where the RIP-relative disp32 starts, counted from
    ``index``. It is not always ``length - 4``: ``cmp word [rip+d], 1`` carries
    an imm8 *after* the displacement, so a naive ``length - 4`` reads the
    immediate as part of the address.

    Ordered longest-first so a 0x66-prefixed form is not read as its bare
    sibling. Only these canonical shapes are recognised; anything else is left
    to the disassembler.
    """
    try:
        first = data[index]
        second = data[index + 1]
        third = data[index + 2]
    except IndexError:
        return

    if first == 0x48 and second in (0x8B, 0x89, 0x8D) and third in RIP_MODRM:
        kind = READ if second == 0x8B else (WRITE if second == 0x89 else ADDRESS)
        yield kind, 64, 7, 3
    elif first == 0x66 and second in (0x8B, 0x89) and third in RIP_MODRM:
        yield (READ if second == 0x8B else WRITE), 16, 7, 3
    elif first == 0x66 and second == 0x83 and third in RIP_MODRM:
        yield READ, 16, 8, 3
    elif first == 0x66 and second == 0x89 and third in RIP_MODRM:
        yield WRITE, 16, 7, 3
    elif first == 0x0F and second in (0xB6, 0xB7) and third in RIP_MODRM:
        yield READ, (8 if second == 0xB6 else 16), 7, 3
    elif first == 0x83 and second in RIP_MODRM:
        yield READ, 32, 7, 2
    elif first == 0x39 and second in RIP_MODRM:
        yield READ, 32, 6, 2
    elif first == 0x3B and second in RIP_MODRM:
        yield READ, 32, 6, 2
    elif first == 0xC7 and second == 0x05:
        yield WRITE, 32, 10, 2
    elif first == 0xC6 and second == 0x05:
        yield WRITE, 8, 7, 2
    elif first == 0x88 and second == 0x05:
        yield WRITE, 8, 6, 2
    elif first in (0x8B, 0x89, 0x8D) and second in RIP_MODRM:
        kind = READ if first == 0x8B else (WRITE if first == 0x89 else ADDRESS)
        yield kind, 32, 6, 2


def code_sections(image):
    return [section for section in image.sections if section.executable and section.raw_size]


def scan_image(image):
    """All RIP-relative global references, grouped by target RVA."""
    references = []
    skipped = 0
    for section in code_sections(image):
        base = section.va
        start = section.raw_off
        end = section.raw_off + section.raw_size
        index = start
        while index < end - 10:
            advance = 1
            for kind, width, length, disp_at in _matches(image.data, index):
                advance = length
                disp = _disp32(image.data, index + disp_at)
                site_rva = base + (index - start)
                target_rva = site_rva + length + disp
                try:
                    image.rva_to_off(target_rva)
                except pe.FormatError:
                    skipped += 1
                    break
                references.append(
                    {
                        "site_rva": site_rva,
                        "target_rva": target_rva,
                        "kind": kind,
                        "width": width,
                        "length": length,
                        "bytes": image.data[index : index + length].hex(" ").upper(),
                    }
                )
                break
            index += advance
    by_target = {}
    for reference in references:
        by_target.setdefault(reference["target_rva"], []).append(reference)
    return by_target, skipped


def verdict_for(entries):
    writes = [item for item in entries if item["kind"] == WRITE]
    reads = [item for item in entries if item["kind"] == READ]
    if len(writes) == 1:
        return "single-writer"
    if not writes:
        return "read-only"
    return "multi-writer"


def label_for(image, target_rva):
    section = image.section_for(target_rva)
    return section.name if section else "<unmapped>"


def build_rows(image, by_target, word_only=False):
    rows = []
    for target_rva in sorted(by_target):
        entries = by_target[target_rva]
        if word_only and not any(item["width"] == 16 for item in entries):
            continue
        writes = [item for item in entries if item["kind"] == WRITE]
        reads = [item for item in entries if item["kind"] == READ]
        addresses = [item for item in entries if item["kind"] == ADDRESS]
        widths = sorted({item["width"] for item in entries})
        rows.append(
            {
                "target_rva": target_rva,
                "va": "0x{:X}".format(image.image_base + target_rva),
                "section": label_for(image, target_rva),
                "widths": "/".join(str(width) for width in widths),
                "writes": len(writes),
                "reads": len(reads),
                "addresses": len(addresses),
                "verdict": verdict_for(entries),
                "write_sites": ["0x{:X}".format(item["site_rva"]) for item in writes],
                "read_sites": ["0x{:X}".format(item["site_rva"]) for item in reads],
            }
        )
    return rows


def read_globals(image, by_target):
    """Globals with at least one 16-bit *write*: the shape of a state word.

    A 16-bit read of a 64-bit counter is not a state word, so the write width is
    what decides membership here, not the read width.
    """
    out = []
    for target_rva in sorted(by_target):
        entries = by_target[target_rva]
        word_writes = [item for item in entries if item["kind"] == WRITE and item["width"] == 16]
        if not word_writes:
            continue
        reads = [item for item in entries if item["kind"] == READ]
        try:
            raw = image.read_at(target_rva, 2)
        except pe.FormatError:
            continue
        value = int.from_bytes(raw, "little")
        out.append(
            {
                "va": "0x{:X}".format(image.image_base + target_rva),
                "current": "0x{:04X}".format(value),
                "writes": len(word_writes),
                "reads": len(reads),
                "write_sites": ["0x{:X}".format(item["site_rva"]) for item in word_writes],
            }
        )
    return out


def main(options):
    cli.require(options, "sample")
    image = pe.read(options["sample"])
    if not image.is_pe():
        raise cli.UsageError("this tool reads PE images; {} is {}".format(options["sample"], image.kind))

    by_target, skipped = scan_image(image)
    rows = build_rows(image, by_target, word_only=options.get("word"))

    report = cli.Report("RIP-relative global audit")
    report.field("sample", options["sample"])
    report.field("sha256", image.sha256)
    report.field("arch", "{} {}".format(image.arch, image.bits))
    report.field("image base", "0x{:X}".format(image.image_base))
    report.field("code sections", ", ".join(section.name for section in code_sections(image)) or "<none>")
    report.field("targets", len(rows))
    report.field("unmapped references skipped", skipped)

    report.heading("globals by write count")
    if rows:
        report.table(
            ["target VA", "section", "width", "W", "R", "&", "verdict"],
            [
                [row["va"], row["section"], row["widths"], row["writes"], row["reads"], row["addresses"], row["verdict"]]
                for row in rows
            ],
        )
    else:
        report.line("no RIP-relative global reference found in the executable sections")

    single = [row for row in rows if row["verdict"] == "single-writer"]
    read_only = [row for row in rows if row["verdict"] == "read-only"]
    report.heading("reading")
    if single:
        report.line("Single-writer globals (patch the writer, not the reader):")
        for row in single[:20]:
            report.bullet("{} in {} - write site {}".format(row["va"], row["section"], ", ".join(row["write_sites"])))
    if read_only:
        report.line("Read-only globals ({}): a patch here changes the display only.".format(len(read_only)))
        for row in read_only[:10]:
            report.bullet("{} read from {}".format(row["va"], ", ".join(row["read_sites"][:3])))
    report.line("A hit is a place to look, not a conclusion: confirm the write site with the disassembler")
    report.line("before writing a patch table row, and re-read it after the next build.")

    words = read_globals(image, by_target)
    if words:
        report.heading("16-bit state-word candidates")
        report.table(["va", "current", "writes", "reads"], [[row["va"], row["current"], row["writes"], row["reads"]] for row in words])

    payload = {"sample": options["sample"], "sha256": image.sha256, "rows": rows, "words": words, "skipped": skipped}
    out = options.get("json")
    if out:
        directory = os.path.dirname(os.path.abspath(out))
        if directory:
            os.makedirs(directory, exist_ok=True)
        with open(out, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
        report.field("json", out)

    report.emit()
    return cli.EXIT_OK


def _fixture():
    """A PE whose .text holds one writer and two readers of one 16-bit global."""
    data = bytearray(fixtures.synthetic_pe(version=False))
    body = 0x200
    data[body : body + 0x200] = b"\x00" * 0x200
    target = 0x1180
    # 48 89 05 <disp> - mov [rip+disp], rax           (write, 16-bit-wide slot below)
    data[body + 0x00 : body + 0x07] = b"\x48\x89\x05" + (target - (0x1000 + 7)).to_bytes(4, "little", signed=True)
    # 48 8B 05 <disp> - mov rax, [rip+disp]           (read)
    data[body + 0x10 : body + 0x17] = b"\x48\x8B\x05" + (target - (0x1010 + 7)).to_bytes(4, "little", signed=True)
    # 66 83 3D <disp> 01 00 - cmp word [rip+disp], 1  (16-bit read)
    data[body + 0x20 : body + 0x28] = b"\x66\x83\x3D" + (target - (0x1020 + 8)).to_bytes(4, "little", signed=True) + b"\x01"
    # 0F B7 05 <disp> - movzx eax, word [rip+disp]    (16-bit read of a second global)
    other = 0x1190
    data[body + 0x30 : body + 0x37] = b"\x0F\xB7\x05" + (other - (0x1030 + 7)).to_bytes(4, "little", signed=True)
    # 66 89 05 <disp> - mov [rip+disp], ax            (16-bit write of the second global)
    data[body + 0x40 : body + 0x47] = b"\x66\x89\x05" + (other - (0x1040 + 7)).to_bytes(4, "little", signed=True)
    data[0x200 + 0x190 : 0x200 + 0x192] = b"\x01\x00"
    return bytes(data)


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]
    with fixtures.Workspace() as workspace:
        path = workspace.write("state.exe", _fixture())
        image = pe.read(path)
        by_target, skipped = scan_image(image)
        rows = build_rows(image, by_target)
        found = {row["target_rva"]: row for row in rows}

        results.append(0x1180 in found and 0x1190 in found)
        results.append(found[0x1180]["writes"] == 1 and found[0x1180]["reads"] == 2)
        results.append(found[0x1180]["verdict"] == "single-writer")
        results.append(found[0x1190]["writes"] == 1)
        results.append(skipped >= 0 and len(rows) == 2)

        # A global that is only read must be classified read-only, not "absent".
        reader_only = bytearray(_fixture())
        reader_only[0x200 + 0x00 : 0x200 + 0x07] = b"\x48\x8D\x05" + (0x1190 - (0x1000 + 7)).to_bytes(4, "little", signed=True)
        second = workspace.write("reader.exe", bytes(reader_only))
        image2 = pe.read(second)
        rows2 = build_rows(image2, scan_image(image2)[0])
        found2 = {row["target_rva"]: row for row in rows2}
        results.append(found2[0x1180]["writes"] == 0 and found2[0x1180]["verdict"] == "read-only")

        word_rows = build_rows(image, by_target, word_only=True)
        results.append(len(word_rows) == 2 and all("16" in row["widths"] for row in word_rows))
        words = read_globals(image, by_target)
        results.append(len(words) == 1 and words[0]["current"] == "0x0001")
        results.append(all(len(item["bytes"].split()) == item["length"] for entries in by_target.values() for item in entries))

    passed = sum(1 for item in results if item)
    sys.stdout.write("\nstate_word_audit self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


FLAGS = ("word",)
VALUES = ("sample", "json")


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test, FLAGS, VALUES))
