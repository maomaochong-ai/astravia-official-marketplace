#!/usr/bin/env python3
"""Read .NET metadata and surface the identifiers and literals a licence check uses.

Case F started from a table of strings, not from a decompiler: the assembly's
``#Strings`` heap held the type and member names the check was built from, and
``#US`` held the user-visible literals. Both heaps are plain, uncompressed and
reachable in about eighty lines of parsing, which is why this tool exists: an
operator should not need dnSpy on the machine to answer "which name in this
assembly mentions a licence".

What it does not do: it does not decompile, does not evaluate the key algorithm,
and does not print a key. A keygen needs the branch that compares a derived value
against a stored one; that is read from IL, and pretending a string dump answers
it would be the kind of confident nonsense this corpus is supposed to avoid.

usage:
    python3 metadata_strings.py --sample app.dll
    python3 metadata_strings.py --sample app.dll --query licence,vip,serial --out findings/
    python3 metadata_strings.py --self-test
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

DEFAULT_QUERY = ("licen", "serial", "regkey", "productkey", "activation", "trial", "expire", "hardware", "machine", "fingerprint")

TABLE_NAMES = {
    0x00: "Module",
    0x01: "TypeRef",
    0x02: "TypeDef",
    0x04: "Field",
    0x06: "MethodDef",
    0x08: "Param",
    0x09: "InterfaceImpl",
    0x0A: "MemberRef",
    0x0B: "Constant",
    0x0C: "CustomAttribute",
    0x0E: "DeclSecurity",
    0x11: "StandAloneSig",
    0x12: "EventMap",
    0x14: "Event",
    0x15: "PropertyMap",
    0x17: "Property",
    0x18: "MethodSemantics",
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

METADATA_SIGNATURE = 0x424A5342


class DotNetError(Exception):
    pass


def read_compressed(data, offset):
    first = data[offset]
    if first & 0x80 == 0:
        return first, 1
    if first & 0xC0 == 0x80:
        return ((first & 0x3F) << 8) | data[offset + 1], 2
    return (
        ((first & 0x1F) << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3],
        4,
    )


class Metadata:
    """Stream directory plus the two heaps a licence read actually needs."""

    def __init__(self, image):
        data = image.data
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
        self.offset = offset
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
        self._strings = None
        self._user_strings = None

    # -- heaps ----------------------------------------------------------
    def strings(self):
        if self._strings is None:
            entry = self.streams.get("#Strings")
            if not entry:
                self._strings = []
            else:
                start, size = entry
                blob = self.image_data[start : start + size]
                self._strings = [part.decode("utf-8", "replace") for part in blob.split(b"\x00")]
        return self._strings

    def user_strings(self):
        if self._user_strings is None:
            entry = self.streams.get("#US")
            out = []
            if entry:
                start, size = entry
                data = self.image_data
                cursor = start + 1  # index 0 is the empty string
                limit = start + size
                while cursor < limit:
                    length, prefix = read_compressed(data, cursor)
                    if length == 0:
                        cursor += prefix
                        continue
                    body = data[cursor + prefix : cursor + prefix + length - 1]
                    out.append(body.decode("utf-16le", "replace"))
                    # #US entries are packed back to back; the heap is not aligned
                    # between literals, only the stream itself is.
                    cursor += prefix + length
            self._user_strings = out
        return self._user_strings

    # -- tables ---------------------------------------------------------
    def tables(self):
        entry = self.streams.get("#~") or self.streams.get("#-")
        if not entry:
            return {}
        start, size = entry
        data = self.image_data
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
            count = struct.unpack_from("<I", data, cursor)[0]
            cursor += 4
            rows[table_id] = count
        return rows

    @property
    def image_data(self):
        return self._image.data


def open_metadata(path):
    image = pe.read(path)
    if not image.is_dotnet:
        raise DotNetError("{} has no CLR data directory".format(path))
    meta = Metadata(image)
    meta._image = image
    return image, meta


def matches(text, queries):
    lowered = text.lower()
    return [query for query in queries if query in lowered]


def main(options):
    cli.require(options, "sample")
    queries = tuple(
        part.strip().lower() for part in (options.get("query") or ",".join(DEFAULT_QUERY)).split(",") if part.strip()
    )
    image, meta = open_metadata(options["sample"])

    report = cli.Report(".NET metadata strings")
    report.field("sample", image.path)
    report.field("sha256", image.sha256)
    report.field("runtime version", meta.version or "<empty>")
    report.field("metadata", "RVA 0x{:X}, {} bytes".format(meta.meta_rva, meta.meta_size))
    report.field("query", ", ".join(queries))

    report.heading("streams")
    report.table(
        ["stream", "offset", "size"],
        [[name, "0x{:X}".format(entry[0]), entry[1]] for name, entry in sorted(meta.streams.items())],
    )
    if not meta.streams:
        report.line("no streams: the metadata root parsed but declares none")

    identifiers = meta.strings()
    literals = meta.user_strings()
    report.heading("heap sizes")
    report.bullet("#Strings: {} named entries".format(len([text for text in identifiers if text])))
    report.bullet("#US: {} literals".format(len(literals)))

    matched_identifiers = [text for text in identifiers if text and matches(text, queries)]
    matched_literals = [text for text in literals if text and matches(text, queries)]

    report.heading("identifiers matching the query")
    if matched_identifiers:
        for text in matched_identifiers[:60]:
            report.bullet(text)
        if len(matched_identifiers) > 60:
            report.line("  ({} more)".format(len(matched_identifiers) - 60))
    else:
        report.line("none. The check may be named without a licence word, or the assembly is obfuscated.")

    report.heading("user literals matching the query")
    if matched_literals:
        report.table(["literal"], [[text[:100]] for text in matched_literals[:60]])
    else:
        report.line("none. Prompts and messages often carry the wording instead.")

    rows = meta.tables()
    report.heading("table rows")
    if rows:
        interesting = [(table_id, count) for table_id, count in sorted(rows.items()) if count]
        report.table(
            ["table", "rows"],
            [[TABLE_NAMES.get(table_id, "0x{:02X}".format(table_id)), count] for table_id, count in interesting[:16]],
        )
        for table_id, count in interesting[16:]:
            report.bullet("{}: {}".format(TABLE_NAMES.get(table_id, "0x{:02X}".format(table_id)), count))
    else:
        report.line("no table stream (#~). This image may be a native host with a stub CLR directory.")

    report.heading("reading")
    report.bullet("Identifier hits are candidate names, not the check: confirm by reading the method body.")
    report.bullet("A key derivation needs the compare in IL; this tool stops at the constant table.")

    out_dir = options.get("out")
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
        target = os.path.join(out_dir, "metadata-strings.json")
        payload = {
            "sample": image.path,
            "sha256": image.sha256,
            "runtimeVersion": meta.version,
            "streams": {name: {"offset": entry[0], "size": entry[1]} for name, entry in sorted(meta.streams.items())},
            "queries": list(queries),
            "identifiers": matched_identifiers,
            "literals": matched_literals,
            "tables": {TABLE_NAMES.get(key, "0x{:02X}".format(key)): value for key, value in sorted(rows.items())},
        }
        with open(target, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
        report.field("evidence", target)

    report.emit()
    return cli.EXIT_OK


# -- fixture: a managed image with real metadata -------------------------

def compressed(value):
    if value < 0x80:
        return bytes([value])
    if value < 0x4000:
        return bytes([0x80 | (value >> 8), value & 0xFF])
    return bytes([0xC0 | ((value >> 24) & 0xFF), (value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF])


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


def dotnet_fixture(identifiers, literals, rows):
    """Synthetic PE whose CLR directory points at real, parseable metadata."""
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

    user_heap = bytearray(b"\x00")
    for text in literals:
        raw = text.encode("utf-16le")
        user_heap += compressed(len(raw) + 1) + raw + b"\x00"

    blob = metadata_root([("#~", bytes(table_stream)), ("#Strings", bytes(string_heap)), ("#US", bytes(user_heap))])

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
        "LicenceManager",
        "ValidateSerial",
        "Program",
        "System.Object",
        "get_HardwareId",
        "Unrelated",
    )
    literals = ("TRIAL-EXPIRED", "Enter your serial", "OK")
    with fixtures.Workspace() as workspace:
        path = workspace.write(
            "app.dll",
            dotnet_fixture(identifiers, literals, {0x00: 1, 0x01: 2, 0x02: 3, 0x06: 7}),
        )
        image, meta = open_metadata(path)
        results.append(meta.version == "v4.0.30319")
        results.append(set(meta.streams) == {"#~", "#Strings", "#US"})
        results.append(all(size > 0 for _offset, size in meta.streams.values()))
        results.append("LicenceManager" in meta.strings())
        results.append("Enter your serial" in meta.user_strings())
        rows = meta.tables()
        results.append(rows.get(0x06) == 7 and rows.get(0x02) == 3)
        hits = [text for text in meta.strings() if matches(text, ("licen", "serial"))]
        results.append("LicenceManager" in hits and "ValidateSerial" in hits)
        results.append("Program" not in hits)

        code = main({"sample": path, "query": "licen,serial", "out": None})
        results.append(code == cli.EXIT_OK)

    passed = sum(1 for item in results if item)
    sys.stdout.write("\nmetadata_strings self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test))
