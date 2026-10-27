#!/usr/bin/env python3
"""Inventory a managed image's metadata so delegate recovery starts from facts.

Case K's bottleneck was not the packer; it was that the delegate graph had been
flattened into compiler-generated names. Before any of that can be recovered the
operator needs a count:

* which streams exist and how large each heap is,
* how many TypeDef / MethodDef / MemberRef rows the image declares,
* how many closure and delegate artefacts the compiler emitted, and
* which of those names are still readable.

Those four numbers say whether the image was merely obfuscated (heaps present,
names mangled) or rewritten (heaps small, tables large, or a native stub where
the metadata should be). The distinction decides whether the next step is a
rename pass or a full reconstruction, so it is worth measuring before touching
anything.

usage:
    python3 metadata_inventory.py --sample packed.exe
    python3 metadata_inventory.py --sample packed.exe --out findings/
    python3 metadata_inventory.py --self-test
"""

import json
import os
import struct
import sys

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli, fixtures, pe  # noqa: E402

TABLE_NAMES = {
    0x00: "Module",
    0x01: "TypeRef",
    0x02: "TypeDef",
    0x04: "Field",
    0x06: "MethodDef",
    0x08: "Param",
    0x0A: "MemberRef",
    0x0B: "Constant",
    0x0C: "CustomAttribute",
    0x11: "StandAloneSig",
    0x14: "Event",
    0x17: "Property",
    0x1A: "ModuleRef",
    0x1B: "TypeSpec",
    0x20: "Assembly",
    0x23: "AssemblyRef",
    0x26: "File",
    0x27: "ExportedType",
    0x28: "ManifestResource",
    0x29: "NestedClass",
    0x2B: "MethodSpec",
}

# Compiler-generated delegate and closure shapes. These are the names a rename
# pass has to resolve, so they are counted rather than merely listed.
DELEGATE_MARKERS = (
    "<>9__",
    "<>9",
    "b__",
    "<>c",
    "<>u__",
    "d__",
    "MoveNext",
    "Func`",
    "Action`",
    "Invoke",
)

METADATA_SIGNATURE = 0x424A5342


class DotNetError(Exception):
    pass


class Metadata:
    def __init__(self, image):
        data = image.data
        self._image = image
        directory = image.data_dirs.get("clr")
        if not directory or not directory[0]:
            raise DotNetError("no CLR data directory: this is not a managed image")
        cor_offset = image.rva_to_off(directory[0])
        meta_rva, meta_size = struct.unpack_from("<II", data, cor_offset + 8)
        if not meta_rva:
            raise DotNetError("CLR header declares no metadata RVA")
        self.meta_rva = meta_rva
        self.meta_size = meta_size
        offset = image.rva_to_off(meta_rva)
        signature = struct.unpack_from("<I", data, offset)[0]
        if signature != METADATA_SIGNATURE:
            raise DotNetError("metadata root signature is 0x{:08X}, not BSJB".format(signature))
        version_length = struct.unpack_from("<I", data, offset + 12)[0]
        if version_length > 256:
            raise DotNetError("metadata version string is {} bytes".format(version_length))
        self.version = data[offset + 16 : offset + 16 + version_length].rstrip(b"\x00").decode("ascii", "replace")
        cursor = offset + 16 + version_length
        _flags, stream_count = struct.unpack_from("<HH", data, cursor)
        cursor += 4
        self.streams = {}
        for _ in range(stream_count):
            stream_offset, stream_size = struct.unpack_from("<II", data, cursor)
            cursor += 8
            end = data.index(b"\x00", cursor)
            name = data[cursor:end].decode("ascii", "replace")
            cursor = end + 1
            while cursor % 4:
                cursor += 1
            self.streams[name] = (offset + stream_offset, stream_size)

    def strings(self):
        entry = self.streams.get("#Strings")
        if not entry:
            return []
        start, size = entry
        blob = self._image.data[start : start + size]
        return [part.decode("utf-8", "replace") for part in blob.split(b"\x00")]

    def tables(self):
        entry = self.streams.get("#~") or self.streams.get("#-")
        if not entry:
            return {}
        start, size = entry
        data = self._image.data
        if size < 24:
            raise DotNetError("table stream is {} bytes, too small for a header".format(size))
        valid = struct.unpack_from("<Q", data, start + 8)[0]
        cursor = start + 24
        rows = {}
        for table_id in range(64):
            if not valid & (1 << table_id):
                continue
            if cursor + 4 > start + size:
                raise DotNetError("row counts run past the table stream")
            rows[table_id] = struct.unpack_from("<I", data, cursor)[0]
            cursor += 4
        return rows


def open_metadata(path):
    image = pe.read(path)
    if not image.is_dotnet:
        raise DotNetError("{} has no CLR data directory".format(path))
    return image, Metadata(image)


def classify(names):
    """Split the readable names into delegate artefacts and ordinary identifiers."""
    delegates = []
    for name in names:
        if not name:
            continue
        if any(marker in name for marker in DELEGATE_MARKERS):
            delegates.append(name)
    return sorted(set(delegates))


def reading(image, meta, rows, delegates):
    lines = []
    typedefs = rows.get(0x02, 0)
    methods = rows.get(0x06, 0)
    strings = meta.streams.get("#Strings")
    if not meta.streams:
        lines.append("The metadata root parsed but declares no streams: the CLR directory is a stub, not a runtime image.")
    if typedefs and methods and delegates:
        lines.append(
            "{} types and {} methods with {} delegate artefacts: the metadata is intact, so recovery is a rename pass."
            .format(typedefs, methods, len(delegates))
        )
    if strings and strings[1] < 64 and (typedefs or methods):
        lines.append("The #Strings heap is only {} bytes while tables declare rows: names were stripped, not just mangled.".format(strings[1]))
    if image.has_aslr() and len(image.sections) > 6:
        lines.append("{} sections with ASLR set: a packer added sections, which is why the entry point needs checking too.".format(len(image.sections)))
    if not delegates:
        lines.append("No compiler-generated delegate names remain. Either the assembly is not C#, or the closure types were rewritten.")
    lines.append("Counts describe the metadata as shipped; they do not prove any delegate can be resolved.")
    return lines


def main(options):
    cli.require(options, "sample")
    image, meta = open_metadata(options["sample"])
    rows = meta.tables()
    names = meta.strings()
    delegates = classify(names)

    report = cli.Report(".NET metadata inventory")
    report.field("sample", image.path)
    report.field("sha256", image.sha256)
    report.field("runtime version", meta.version or "<empty>")
    report.field("metadata", "RVA 0x{:X}, {} bytes".format(meta.meta_rva, meta.meta_size))
    report.field("sections", len(image.sections))
    report.field("entry", "0x{:X}".format(image.entry))

    report.heading("streams")
    if meta.streams:
        report.table(
            ["stream", "offset", "size"],
            [[name, "0x{:X}".format(entry[0]), entry[1]] for name, entry in sorted(meta.streams.items())],
        )
    else:
        report.line("none")

    report.heading("table rows")
    interesting = [(table_id, count) for table_id, count in sorted(rows.items()) if count]
    if interesting:
        report.table(
            ["table", "rows"],
            [[TABLE_NAMES.get(table_id, "0x{:02X}".format(table_id)), count] for table_id, count in interesting],
        )
    else:
        report.line("no table stream (#~)")

    report.heading("delegate artefacts")
    report.field("count", len(delegates))
    report.field("#Strings entries", len([name for name in names if name]))
    if delegates:
        for name in delegates[:40]:
            report.bullet(name)
        if len(delegates) > 40:
            report.line("  ({} more)".format(len(delegates) - 40))
    else:
        report.line("none")

    report.heading("reading (heuristic)")
    for line in reading(image, meta, rows, delegates):
        report.bullet(line)

    out_dir = options.get("out")
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
        target = os.path.join(out_dir, "metadata-inventory.json")
        payload = {
            "sample": image.path,
            "sha256": image.sha256,
            "runtimeVersion": meta.version,
            "streams": {name: {"offset": entry[0], "size": entry[1]} for name, entry in sorted(meta.streams.items())},
            "tables": {TABLE_NAMES.get(key, "0x{:02X}".format(key)): value for key, value in sorted(rows.items())},
            "delegates": delegates,
        }
        with open(target, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
        report.field("evidence", target)

    report.emit()
    return cli.EXIT_OK


# -- fixture -------------------------------------------------------------

def metadata_root(streams):
    version = b"v4.0.30319\x00\x00"
    head = struct.pack("<IHHII", METADATA_SIGNATURE, 1, 1, 0, len(version)) + version
    head += struct.pack("<HH", 0, len(streams))
    padded = []
    for name, _ in streams:
        raw = name.encode("ascii") + b"\x00"
        while len(raw) % 4:
            raw += b"\x00"
        padded.append(raw)
    head_size = len(head) + sum(8 + len(raw) for raw in padded)
    headers = bytearray()
    body = bytearray()
    for (name, payload), raw in zip(streams, padded):
        headers += struct.pack("<II", head_size + len(body), len(payload)) + raw
        body += payload
        while len(body) % 4:
            body += b"\x00"
    return bytes(head) + bytes(headers) + bytes(body)


def dotnet_fixture(identifiers, rows):
    base = bytearray(fixtures.synthetic_pe(dotnet=True))
    section_at = 0x178
    struct.pack_into("<I", base, section_at + 8, 0x1000)
    struct.pack_into("<I", base, section_at + 16, 0x1000)
    struct.pack_into("<I", base, 0x98 + 56, 0x3000)
    base.extend(b"\x00" * (0x200 + 0x1000 - len(base)))

    table_stream = bytearray()
    table_stream += struct.pack("<I", 0)
    table_stream += bytes([2, 0, 0, 1])
    valid = 0
    counts = b""
    for table_id, count in sorted(rows.items()):
        valid |= 1 << table_id
        counts += struct.pack("<I", count)
    table_stream += struct.pack("<QQ", valid, 0) + counts

    string_heap = bytearray(b"\x00")
    for text in identifiers:
        string_heap += text.encode("utf-8") + b"\x00"

    blob = metadata_root([("#~", bytes(table_stream)), ("#Strings", bytes(string_heap))])
    cor_at = 0x200 + 0x800
    cor = bytearray(0x48)
    struct.pack_into("<I", cor, 0, 0x48)
    struct.pack_into("<HH", cor, 4, 2, 5)
    struct.pack_into("<II", cor, 8, 0x1800 + 0x48, len(blob))
    struct.pack_into("<I", cor, 16, 0x01)
    struct.pack_into("<I", cor, 20, 0x06000001)
    base[cor_at : cor_at + 0x48] = cor
    base[cor_at + 0x48 : cor_at + 0x48 + len(blob)] = blob
    return bytes(base)


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]

    identifiers = (
        "Program",
        "<>c",
        "<>9__0_0",
        "b__0_0",
        "Func`2",
        "MoveNext",
        "d__3",
        "Ordinary",
    )
    with fixtures.Workspace() as workspace:
        path = workspace.write("packed.exe", dotnet_fixture(identifiers, {0x00: 1, 0x02: 12, 0x06: 41, 0x0A: 9}))
        image, meta = open_metadata(path)
        results.append(meta.version == "v4.0.30319")
        results.append(set(meta.streams) == {"#~", "#Strings"})
        rows = meta.tables()
        results.append(rows.get(0x06) == 41 and rows.get(0x02) == 12)
        delegates = classify(meta.strings())
        results.append("<>9__0_0" in delegates)
        results.append("MoveNext" in delegates)
        results.append("Ordinary" not in delegates and "Program" not in delegates)
        results.append(len(delegates) == 6)
        lines = reading(image, meta, rows, delegates)
        results.append(any("rename pass" in line for line in lines))
        results.append(main({"sample": path, "out": None}) == cli.EXIT_OK)

    passed = sum(1 for item in results if item)
    sys.stdout.write("\nmetadata_inventory self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test))
