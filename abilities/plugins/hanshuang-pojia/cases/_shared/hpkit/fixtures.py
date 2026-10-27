"""Synthetic fixtures: the reason a tool can prove it still runs.

The corpus forbids shipping sample bytes, and rightly so - a case package is not
a sample drop. But a tool that cannot be executed is a document. So every
fixture here is *constructed byte by byte* at run time: a minimal PE, a minimal
ELF, a minimal DEX and a zip that looks like an APK. They are invalid as real
programs and that is fine; they are valid as *parsing targets*, which is what
the tools need in order to assert their own behaviour in CI.

Nothing in this module reads or writes anything outside the caller's temporary
directory.
"""

from __future__ import annotations

import io
import os
import struct
import tempfile
import zipfile

PE_PATTERN = bytes.fromhex("0F8500000000")
PE_PATCHED = bytes.fromhex("0F8400000000")
PE_MARKER = b"DEMO-LICENSE-GATE\x00"
ELF_MARKER = b"DEMO-UPX-PACKED-LOADER\x00"

PE_OPTIONAL_SIZE = 224
PE_SECTION_RVA = 0x1000
PE_SECTION_RAW = 0x200
PE_SECTION_SIZE = 0x200


def synthetic_pe(aslr=False, dotnet=False, version=True, marker=PE_MARKER):
    """A 0x400-byte PE32 with one .text section holding PE_PATTERN at RVA 0x1010."""
    data = bytearray(PE_SECTION_RAW + PE_SECTION_SIZE)
    pe_offset = 0x80
    headers = struct.pack("<H", 0x5A4D) + b"\x00" * 58 + struct.pack("<I", pe_offset)
    data[0 : len(headers)] = headers

    coff = struct.pack("<HHIIIHH", 0x014C, 1, 0x60000000, 0, 0, PE_OPTIONAL_SIZE, 0x0102)
    data[pe_offset : pe_offset + 4] = b"PE\x00\x00"
    data[pe_offset + 4 : pe_offset + 4 + len(coff)] = coff

    optional_at = pe_offset + 24
    optional = bytearray(PE_OPTIONAL_SIZE)
    struct.pack_into("<H", optional, 0, 0x10B)
    struct.pack_into("<H", optional, 2, 14)
    struct.pack_into("<I", optional, 16, PE_SECTION_RVA)
    struct.pack_into("<I", optional, 20, PE_SECTION_RVA)
    struct.pack_into("<I", optional, 28, 0x400000)
    struct.pack_into("<I", optional, 32, 0x1000)
    struct.pack_into("<I", optional, 36, 0x200)
    struct.pack_into("<H", optional, 40, 6)
    struct.pack_into("<H", optional, 48, 6)
    struct.pack_into("<I", optional, 56, 0x2000)
    struct.pack_into("<I", optional, 60, PE_SECTION_RAW)
    struct.pack_into("<H", optional, 68, 2)
    struct.pack_into("<H", optional, 70, 0x0140 if aslr else 0x0100)
    struct.pack_into("<I", optional, 92, 16)
    if dotnet:
        struct.pack_into("<II", optional, 96 + 14 * 8, 0x1800, 0x48)
    data[optional_at : optional_at + PE_OPTIONAL_SIZE] = optional

    section_at = optional_at + PE_OPTIONAL_SIZE
    section = struct.pack(
        "<8sIIIIIIHHI",
        b".text\x00\x00\x00",
        PE_SECTION_SIZE,
        PE_SECTION_RVA,
        PE_SECTION_SIZE,
        PE_SECTION_RAW,
        0,
        0,
        0,
        0,
        0x60000020,
    )
    data[section_at : section_at + 40] = section

    body = bytearray(PE_SECTION_SIZE)
    body[0x10 : 0x10 + len(PE_PATTERN)] = PE_PATTERN
    body[0x30 : 0x30 + len(marker)] = marker
    if version:
        blob = "VS_VERSION_INFO".encode("utf-16le") + b"\x00" * 4
        blob += "FileVersion".encode("utf-16le") + struct.pack("<H", 0x0031) + "2.7.1".encode("utf-16le")
        blob += b"\x00\x00" + "CompanyName".encode("utf-16le") + struct.pack("<H", 0x0031) + "Demo".encode("utf-16le")
        body[0x60 : 0x60 + len(blob)] = blob
    data[PE_SECTION_RAW : PE_SECTION_RAW + PE_SECTION_SIZE] = body
    return bytes(data)


EXPORT_RVA = 0x2000
EXPORT_RAW = 0x400
EXPORT_SECTION_SIZE = 0x400


def synthetic_pe_exports(names, module="qtdemo.dll", forwarded=(), ordinal_only=0):
    """A PE32 whose .edata section carries a real export directory.

    ``names`` become named exports with ordinals starting at 1. ``forwarded`` is
    a set of names that resolve to a forwarder string instead of code, which is
    exactly what a proxy DLL does - so the parser is tested on the mechanism the
    case depends on, not just on a name list.
    """
    base = synthetic_pe()
    data = bytearray(base) + bytearray(EXPORT_SECTION_SIZE)
    count = len(names)
    dir_size = 40
    names_table = EXPORT_RAW + dir_size
    ords_table = names_table + count * 4
    funcs_table = ords_table + count * 2
    cursor = funcs_table + (count + ordinal_only) * 4

    module_at = cursor
    module_bytes = module.encode("ascii") + b"\x00"
    data[cursor : cursor + len(module_bytes)] = module_bytes
    cursor += len(module_bytes)

    name_offsets = []
    for name in names:
        name_offsets.append(cursor)
        raw = name.encode("ascii") + b"\x00"
        data[cursor : cursor + len(raw)] = raw
        cursor += len(raw)

    forward_offsets = {}
    for name in forwarded:
        if name not in names:
            continue
        forward_offsets[name] = cursor
        raw = "OTHERDLL.{}".format(name).encode("ascii") + b"\x00"
        data[cursor : cursor + len(raw)] = raw
        cursor += len(raw)

    def to_rva(raw_offset):
        return EXPORT_RVA + (raw_offset - EXPORT_RAW)

    # IMAGE_EXPORT_DIRECTORY is exactly 11 fields / 40 bytes:
    # Characteristics, TimeDateStamp, Major(H), Minor(H), Name, Base,
    # NumberOfFunctions, NumberOfNames, AddressOfFunctions, AddressOfNames,
    # AddressOfNameOrdinals.
    struct.pack_into(
        "<IIHHIIIIIII",
        data,
        EXPORT_RAW,
        0,
        0,
        0,
        0,
        to_rva(module_at),
        1,
        count + ordinal_only,
        count,
        to_rva(funcs_table),
        to_rva(names_table),
        to_rva(ords_table),
    )
    for index, name in enumerate(names):
        struct.pack_into("<I", data, names_table + index * 4, to_rva(name_offsets[index]))
        struct.pack_into("<H", data, ords_table + index * 2, index)
        target = to_rva(forward_offsets[name]) if name in forward_offsets else 0x1000 + index * 8
        struct.pack_into("<I", data, funcs_table + index * 4, target)
    for extra in range(ordinal_only):
        # A slot with no entry in the name table: reachable by ordinal only, which
        # is exactly what a proxy DLL has to forward as NONAME.
        struct.pack_into("<I", data, funcs_table + (count + extra) * 4, 0x1200 + extra * 8)

    optional_at = 0x80 + 24
    struct.pack_into("<II", data, optional_at + 96 + 0 * 8, EXPORT_RVA, EXPORT_SECTION_SIZE)
    struct.pack_into("<H", data, 0x80 + 6, 2)  # COFF NumberOfSections
    section_at = optional_at + PE_OPTIONAL_SIZE + 40
    struct.pack_into(
        "<8sIIIIIIHHI",
        data,
        section_at,
        b".edata\x00\x00",
        EXPORT_SECTION_SIZE,
        EXPORT_RVA,
        EXPORT_SECTION_SIZE,
        EXPORT_RAW,
        0,
        0,
        0,
        0,
        0x40000040,
    )
    return bytes(data)


def synthetic_elf(packed=True, marker=ELF_MARKER):
    """A 64-bit little-endian ELF with one PT_LOAD covering the whole file."""
    total = 0x400
    data = bytearray(total)
    ident = b"\x7fELF" + bytes([2, 1, 1, 0]) + b"\x00" * 8
    data[0:16] = ident
    struct.pack_into("<HHI", data, 16, 2, 0x3E, 1)
    struct.pack_into("<Q", data, 24, 0x401000)
    struct.pack_into("<Q", data, 32, 64)
    struct.pack_into("<Q", data, 40, 0)
    struct.pack_into("<IHHHHHH", data, 52, 0, 64, 56, 1, 64, 0, 0)
    struct.pack_into("<IIQQQQQQ", data, 64, 1, 5, 0, 0x400000, 0x400000, total, total, 0x1000)
    body_at = 0x200
    blob = bytearray()
    if packed:
        blob += b"UPX0\x00\x00\x00\x00"
    blob += bytes.fromhex("E8 00 00 00 00 48 8D 3D")
    blob += marker
    data[body_at : body_at + len(blob)] = blob
    return bytes(data)


def synthetic_dex(strings=None, version=b"035"):
    """A structurally valid DEX 035 with a string pool, type table and method table."""
    strings = list(strings or ["Lcom/demo/Gate;", "isLicensed", "checkVip", "license", "DEMO-SIGN"])
    count = len(strings)
    header_size = 0x70
    string_ids_off = header_size
    type_ids_off = string_ids_off + count * 4
    method_ids_off = type_ids_off + count * 4
    data_off = method_ids_off + count * 8

    payload = bytearray()
    string_offsets = []
    for text in strings:
        string_offsets.append(data_off + len(payload))
        raw = text.encode("utf-8")
        payload += _uleb128(len(text))
        payload += raw + b"\x00"
    while len(payload) % 4:
        payload += b"\x00"

    total = data_off + len(payload)
    out = bytearray(total)
    out[0:8] = b"dex\n" + version + b"\x00"
    struct.pack_into("<I", out, 32, total)
    struct.pack_into("<I", out, 36, header_size)
    struct.pack_into("<I", out, 40, 0x12345678)
    struct.pack_into("<II", out, 56, count, string_ids_off)
    struct.pack_into("<II", out, 64, count, type_ids_off)
    struct.pack_into("<II", out, 72, 0, 0)
    struct.pack_into("<II", out, 80, 0, 0)
    struct.pack_into("<II", out, 88, count, method_ids_off)
    struct.pack_into("<II", out, 96, 0, 0)
    struct.pack_into("<II", out, 104, len(payload), data_off)
    for index, offset in enumerate(string_offsets):
        struct.pack_into("<I", out, string_ids_off + index * 4, offset)
    for index in range(count):
        struct.pack_into("<I", out, type_ids_off + index * 4, index)
    for index in range(count):
        # class 0 ("Lcom/demo/Gate;"), proto 0, name index = index
        struct.pack_into("<HHI", out, method_ids_off + index * 8, 0, 0, index)
    out[data_off:] = payload
    return bytes(out)


def synthetic_apk(strings=None):
    """A zip that carries classes.dex plus a placeholder manifest."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("classes.dex", synthetic_dex(strings))
        archive.writestr("AndroidManifest.xml", b"\x03\x00\x08\x00" + b"\x00" * 60)
    return buffer.getvalue()


def _uleb128(value):
    out = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            out.append(byte | 0x80)
        else:
            out.append(byte)
            return bytes(out)


class Workspace:
    """Temporary directory holding one or more fixtures; cleans up on exit."""

    def __init__(self, prefix="hpkit-"):
        self.path = tempfile.mkdtemp(prefix=prefix)
        self.files = []

    def write(self, name, data):
        target = os.path.join(self.path, name)
        with open(target, "wb") as handle:
            handle.write(data)
        self.files.append(target)
        return target

    def pe(self, name="demo.exe", **kwargs):
        return self.write(name, synthetic_pe(**kwargs))

    def elf(self, name="demo.bin", **kwargs):
        return self.write(name, synthetic_elf(**kwargs))

    def dex(self, name="classes.dex", **kwargs):
        return self.write(name, synthetic_dex(**kwargs))

    def apk(self, name="demo.apk", **kwargs):
        return self.write(name, synthetic_apk(**kwargs))

    def close(self):
        for path in self.files:
            try:
                os.unlink(path)
            except OSError:
                pass
        try:
            os.rmdir(self.path)
        except OSError:
            pass

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        self.close()
        return False
