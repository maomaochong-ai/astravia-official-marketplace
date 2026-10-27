"""PE and ELF header parsing: the parts a case tool actually needs.

Nothing here executes or validates a sample. It answers the questions that
recur in the case corpus:

* which architecture and how many bits,
* where the sections land in the file versus in memory (RVA <-> offset),
* does the image opt into ASLR / DEP / CFG,
* which DLLs and functions it imports,
* is there a CLR directory (a .NET image), and
* what do the version resources claim.

Unsupported or damaged input raises ``FormatError`` with the byte offset that
confused the parser, so a tool can report "not a PE" instead of a traceback.
"""

from __future__ import annotations

import hashlib
import struct

PE_MACHINES = {
    0x014C: ("x86", 32),
    0x8664: ("x86-64", 64),
    0x01C0: ("arm", 32),
    0x01C4: ("armv7", 32),
    0xAA64: ("arm64", 64),
    0x0200: ("ia64", 64),
}

ELF_MACHINES = {
    0x03: ("x86", 32),
    0x3E: ("x86-64", 64),
    0x28: ("arm", 32),
    0xB7: ("arm64", 64),
    0x08: ("mips", 32),
    0x14: ("ppc", 32),
    0x15: ("ppc64", 64),
    0xF3: ("riscv", 64),
}

# index -> (label, data directory index)
DLL_CHARACTERISTICS = (
    (0x0040, "DYNAMIC_BASE (ASLR)"),
    (0x0100, "NX_COMPAT (DEP)"),
    (0x0400, "NO_SEH"),
    (0x0800, "NO_BIND"),
    (0x2000, "WDM_DRIVER"),
    (0x4000, "TERMINAL_SERVER_AWARE"),
    (0x8000, "HIGH_ENTROPY_VA"),
)

DATA_DIRS = {
    0: "export",
    1: "import",
    2: "resource",
    5: "relocation",
    6: "debug",
    9: "tls",
    11: "bound-import",
    12: "iat",
    13: "delay-import",
    14: "clr",
}


class FormatError(Exception):
    """The bytes are not the format the tool expected."""

    def __init__(self, message, offset=None):
        self.offset = offset
        super().__init__(message if offset is None else "{} (at 0x{:X})".format(message, offset))


class Section:
    __slots__ = ("name", "va", "vsize", "raw_off", "raw_size", "flags")

    def __init__(self, name, va, vsize, raw_off, raw_size, flags=0):
        self.name = name
        self.va = va
        self.vsize = vsize
        self.raw_off = raw_off
        self.raw_size = raw_size
        self.flags = flags

    @property
    def writable(self):
        return bool(self.flags & 0x80000000)

    @property
    def executable(self):
        return bool(self.flags & 0x20000000)

    def end_rva(self):
        return self.va + max(self.vsize, self.raw_size)

    def __repr__(self):
        return "Section({!r}, va=0x{:X}, raw=0x{:X}, size=0x{:X})".format(
            self.name, self.va, self.raw_off, self.raw_size
        )


class Image:
    """A parsed PE or ELF image. ``data`` is the file exactly as read."""

    def __init__(self, path, data):
        self.path = path
        self.data = data
        self.kind = None
        self.arch = "unknown"
        self.bits = 0
        self.machine = 0
        self.entry = 0
        self.image_base = 0
        self.sections = []
        self.dll_characteristics = 0
        self.characteristics = 0
        self.timestamp = 0
        self.subsystem = 0
        self.headers_size = 0
        self.data_dirs = {}
        self.pe_offset = 0

    # -- identity -------------------------------------------------------
    @property
    def sha256(self):
        return hashlib.sha256(self.data).hexdigest()

    @property
    def size(self):
        return len(self.data)

    @property
    def is_dotnet(self):
        entry = self.data_dirs.get("clr")
        return bool(entry and entry[0])

    def is_pe(self):
        return self.kind == "pe"

    def is_elf(self):
        return self.kind == "elf"

    # -- address translation -------------------------------------------
    def rva_to_off(self, rva):
        """Map an RVA to a file offset, or raise FormatError."""
        for section in self.sections:
            span = max(section.vsize, section.raw_size)
            if section.va <= rva < section.va + span:
                delta = rva - section.va
                if delta >= section.raw_size and section.raw_size:
                    raise FormatError("RVA 0x{:X} is inside {} but past its raw data".format(rva, section.name))
                return section.raw_off + delta
        if 0 <= rva < self.headers_size:
            return rva
        raise FormatError("RVA 0x{:X} is not mapped by any section".format(rva))

    def off_to_rva(self, offset):
        for section in self.sections:
            if section.raw_off <= offset < section.raw_off + section.raw_size:
                return section.va + (offset - section.raw_off)
        if 0 <= offset < self.headers_size:
            return offset
        raise FormatError("offset 0x{:X} is not mapped by any section".format(offset))

    def va_to_off(self, va):
        """Accept an absolute virtual address as IDA/r2 display it."""
        if self.image_base and va >= self.image_base:
            return self.rva_to_off(va - self.image_base)
        return self.rva_to_off(va)

    def read_at(self, rva, count):
        offset = self.rva_to_off(rva)
        return self.data[offset : offset + count]

    def section_for(self, rva):
        for section in self.sections:
            if section.va <= rva < section.end_rva():
                return section
        return None

    # -- properties -----------------------------------------------------
    def dll_flags(self):
        return [label for mask, label in DLL_CHARACTERISTICS if self.dll_characteristics & mask]

    def has_aslr(self):
        return bool(self.dll_characteristics & 0x0040)

    def has_dep(self):
        return bool(self.dll_characteristics & 0x0100)

    def copyright_hint(self):
        """Version resources are UTF-16LE; return the strings that look useful."""
        return version_strings(self.data)

    # -- imports / exports ---------------------------------------------
    def imports(self):
        """[{'dll': name, 'functions': [names or ordinals]}] for PE, [] otherwise."""
        if not self.is_pe():
            return []
        entry = self.data_dirs.get("import")
        if not entry or not entry[0]:
            return []
        out = []
        offset = self.rva_to_off(entry[0])
        for index in range(0, 4096):
            descriptor = self.data[offset + index * 20 : offset + index * 20 + 20]
            if len(descriptor) < 20:
                break
            original_first_thunk, stamp, chain, name_rva, first_thunk = struct.unpack("<IIIII", descriptor)
            if not any((original_first_thunk, stamp, chain, name_rva, first_thunk)):
                break
            try:
                dll = read_cstring(self.data, self.rva_to_off(name_rva))
            except FormatError:
                dll = "<unmapped>"
            functions = []
            thunk_rva = original_first_thunk or first_thunk
            if thunk_rva:
                try:
                    thunk_off = self.rva_to_off(thunk_rva)
                except FormatError:
                    thunk_off = None
                if thunk_off is not None:
                    width = 8 if self.bits == 64 else 4
                    fmt = "<Q" if width == 8 else "<I"
                    flag = 1 << (63 if width == 8 else 31)
                    for step in range(0, 4096):
                        raw = self.data[thunk_off + step * width : thunk_off + step * width + width]
                        if len(raw) < width:
                            break
                        value = struct.unpack(fmt, raw)[0]
                        if value == 0:
                            break
                        if value & flag:
                            functions.append("#{}".format(value & 0xFFFF))
                        else:
                            try:
                                functions.append(read_cstring(self.data, self.rva_to_off(value + 2)))
                            except FormatError:
                                functions.append("<unmapped>")
            out.append({"dll": dll, "functions": functions})
        return out

    def exports(self):
        if not self.is_pe():
            return []
        entry = self.data_dirs.get("export")
        if not entry or not entry[0]:
            return []
        offset = self.rva_to_off(entry[0])
        head = self.data[offset : offset + 40]
        if len(head) < 40:
            return []
        (_flags, _stamp, _major, _minor, name_rva, base, func_count, name_count,
         funcs_rva, names_rva, ords_rva) = struct.unpack("<IIHHIIIIIII", head)
        try:
            module = read_cstring(self.data, self.rva_to_off(name_rva))
        except FormatError:
            module = "<unmapped>"
        export_dir = entry
        named = {}
        for index in range(min(name_count, 4096)):
            at = self.rva_to_off(names_rva) + index * 4
            raw = self.data[at : at + 4]
            if len(raw) < 4:
                break
            ord_at = self.rva_to_off(ords_rva) + index * 2
            ord_raw = self.data[ord_at : ord_at + 2]
            slot = struct.unpack("<H", ord_raw)[0] if len(ord_raw) == 2 else index
            try:
                named[slot] = read_cstring(self.data, self.rva_to_off(struct.unpack("<I", raw)[0]))
            except FormatError:
                continue

        # Walk every function slot, not just the name table: a proxy DLL must
        # forward ordinal-only exports too, and they have no name to find them by.
        out = []
        for slot in range(min(func_count or name_count, 4096)):
            forwarder = None
            at = self.rva_to_off(funcs_rva) + slot * 4
            target_raw = self.data[at : at + 4]
            if len(target_raw) == 4:
                target = struct.unpack("<I", target_raw)[0]
                # An export whose address points back inside the export directory
                # is a forwarder string, not code: "OTHERDLL.func".
                if target and export_dir[0] <= target < export_dir[0] + max(export_dir[1], 40):
                    try:
                        forwarder = read_cstring(self.data, self.rva_to_off(target))
                    except FormatError:
                        forwarder = "<unmapped forwarder>"
            out.append({
                "module": module,
                "name": named.get(slot),
                "ordinal": base + slot,
                "forwarder": forwarder,
            })
        return out
        out = []
        for index in range(min(name_count, 4096)):
            raw = self.data[self.rva_to_off(names_rva) + index * 4 : self.rva_to_off(names_rva) + index * 4 + 4]
            if len(raw) < 4:
                break
            name_offset = struct.unpack("<I", raw)[0]
            try:
                name = read_cstring(self.data, self.rva_to_off(name_offset))
            except FormatError:
                continue
            ordinal_raw = self.data[
                self.rva_to_off(ords_rva) + index * 2 : self.rva_to_off(ords_rva) + index * 2 + 2
            ]
            slot = struct.unpack("<H", ordinal_raw)[0] if len(ordinal_raw) == 2 else index
            ordinal = base + slot
            forwarder = None
            target_raw = self.data[
                self.rva_to_off(funcs_rva) + slot * 4 : self.rva_to_off(funcs_rva) + slot * 4 + 4
            ]
            if len(target_raw) == 4:
                target = struct.unpack("<I", target_raw)[0]
                # An export whose address points back inside the export directory
                # is a forwarder string, not code: "OTHERDLL.func".
                if export_dir[0] <= target < export_dir[0] + max(export_dir[1], 40):
                    try:
                        forwarder = read_cstring(self.data, self.rva_to_off(target))
                    except FormatError:
                        forwarder = "<unmapped forwarder>"
            out.append({"module": module, "name": name, "ordinal": ordinal, "forwarder": forwarder})
        if func_count and not out:
            out.append({"module": module, "name": "<ordinal-only export>", "ordinal": base, "forwarder": None})
        return out

    def summary(self):
        return {
            "path": self.path,
            "kind": self.kind,
            "arch": self.arch,
            "bits": self.bits,
            "size": self.size,
            "sha256": self.sha256,
            "entry": "0x{:X}".format(self.entry),
            "image_base": "0x{:X}".format(self.image_base),
            "sections": len(self.sections),
            "dotnet": self.is_dotnet,
            "aslr": self.has_aslr(),
            "dep": self.has_dep(),
        }


def read_cstring(data, offset, limit=512):
    if offset < 0 or offset >= len(data):
        raise FormatError("string offset outside the file", offset)
    end = data.find(b"\x00", offset, offset + limit)
    if end < 0:
        raise FormatError("unterminated string", offset)
    return data[offset:end].decode("utf-8", "replace")


def read(path):
    with open(path, "rb") as handle:
        data = handle.read()
    if len(data) < 0x40:
        raise FormatError("file is too small to be an image ({} bytes)".format(len(data)))
    if data[:2] == b"MZ":
        return read_pe(path, data)
    if data[:4] == b"\x7fELF":
        return read_elf(path, data)
    raise FormatError("neither MZ nor ELF magic", 0)


def read_pe(path, data):
    image = Image(path, data)
    image.kind = "pe"
    pe_offset = struct.unpack_from("<I", data, 0x3C)[0]
    if pe_offset + 24 > len(data):
        raise FormatError("e_lfanew points past the file", 0x3C)
    if data[pe_offset : pe_offset + 4] != b"PE\x00\x00":
        raise FormatError("missing PE signature", pe_offset)
    image.pe_offset = pe_offset
    machine, count, stamp, _symtab, _symbols, opt_size, chars = struct.unpack_from(
        "<HHIIIHH", data, pe_offset + 4
    )
    image.machine = machine
    image.arch, image.bits = PE_MACHINES.get(machine, ("unknown", 0))
    image.timestamp = stamp
    image.characteristics = chars
    optional = pe_offset + 24
    if optional + opt_size > len(data):
        raise FormatError("optional header runs past the file", optional)
    magic = struct.unpack_from("<H", data, optional)[0]
    if magic not in (0x10B, 0x20B):
        raise FormatError("unknown optional header magic 0x{:X}".format(magic), optional)
    if magic == 0x20B and image.bits == 0:
        image.bits = 64
    image.image_base = (
        struct.unpack_from("<Q", data, optional + 24)[0]
        if magic == 0x20B
        else struct.unpack_from("<I", data, optional + 28)[0]
    )
    image.entry = struct.unpack_from("<I", data, optional + 16)[0]
    image.subsystem = struct.unpack_from("<H", data, optional + 68)[0]
    image.dll_characteristics = struct.unpack_from("<H", data, optional + 70)[0]
    image.headers_size = struct.unpack_from("<I", data, optional + 60)[0]
    dir_count_offset = optional + (108 if magic == 0x20B else 92)
    if dir_count_offset + 4 <= len(data):
        dir_count = struct.unpack_from("<I", data, dir_count_offset)[0]
        base = dir_count_offset + 4
        for index in range(min(dir_count, 16)):
            at = base + index * 8
            if at + 8 > len(data):
                break
            rva, size = struct.unpack_from("<II", data, at)
            if index in DATA_DIRS:
                image.data_dirs[DATA_DIRS[index]] = (rva, size)
    section_at = optional + opt_size
    for index in range(count):
        at = section_at + index * 40
        if at + 40 > len(data):
            break
        raw = data[at : at + 40]
        name = raw[:8].rstrip(b"\x00").decode("ascii", "replace")
        vsize, va, raw_size, raw_off = struct.unpack_from("<IIII", raw, 8)
        flags = struct.unpack_from("<I", raw, 36)[0]
        image.sections.append(Section(name, va, vsize, raw_off, raw_size, flags))
    if not image.headers_size:
        image.headers_size = section_at
    return image


def read_elf(path, data):
    image = Image(path, data)
    image.kind = "elf"
    if len(data) < 52:
        raise FormatError("ELF header truncated", 0)
    bits = 64 if data[4] == 2 else 32
    endian = "<" if data[5] == 1 else ">"
    image.bits = bits
    machine = struct.unpack_from(endian + "H", data, 18)[0]
    image.machine = machine
    image.arch, _ = ELF_MACHINES.get(machine, ("unknown", bits))
    if bits == 64:
        image.entry, phoff, shoff = struct.unpack_from(endian + "QQQ", data, 24)
        phentsize, phnum, shentsize, shnum = struct.unpack_from(endian + "HHHH", data, 54)
        header_size = 64
    else:
        image.entry, phoff, shoff = struct.unpack_from(endian + "III", data, 24)
        phentsize, phnum, shentsize, shnum = struct.unpack_from(endian + "HHHH", data, 42)
        header_size = 52
    image.headers_size = phoff or header_size
    # Program headers describe load segments; treat them as sections so the same
    # rva_to_off works for both formats.
    for index in range(min(phnum, 128)):
        at = phoff + index * phentsize
        if at + phentsize > len(data):
            break
        if bits == 64:
            p_type, p_flags, p_offset, p_vaddr, _paddr, p_filesz, p_memsz = struct.unpack_from(
                endian + "IIQQQQQ", data, at
            )
        else:
            p_type, p_offset, p_vaddr, _paddr, p_filesz, p_memsz, p_flags = struct.unpack_from(
                endian + "IIIIIII", data, at
            )
        if p_type != 1:  # PT_LOAD
            continue
        flags = 0
        if p_flags & 4:
            flags |= 0x20000000
        if p_flags & 2:
            flags |= 0x80000000
        image.sections.append(
            Section("LOAD:{}".format(index), p_vaddr, p_memsz, p_offset, p_filesz, flags)
        )
    image.sections.sort(key=lambda section: section.va)
    return image


def version_strings(data):
    """UTF-16LE strings from a version resource, without walking .rsrc."""
    out = []
    needle = "VS_VERSION_INFO".encode("utf-16le")
    if needle not in data:
        return out
    for marker in ("FileVersion", "ProductVersion", "CompanyName", "OriginalFilename"):
        raw = marker.encode("utf-16le")
        at = data.find(raw)
        if at < 0:
            continue
        start = at + len(raw)
        chunk = data[start : start + 200]
        text = chunk.decode("utf-16le", "ignore")
        cleaned = "".join(char for char in text if char.isprintable()).strip()
        if cleaned:
            out.append((marker, cleaned[:80]))
    return out


def hexdump(data, offset=0, count=64):
    chunk = data[offset : offset + count]
    lines = []
    for index in range(0, len(chunk), 16):
        row = chunk[index : index + 16]
        hexed = " ".join("{:02X}".format(byte) for byte in row)
        ascii_view = "".join(chr(byte) if 32 <= byte < 127 else "." for byte in row)
        lines.append("{:08X}  {:<47}  {}".format(offset + index, hexed, ascii_view))
    return "\n".join(lines)
