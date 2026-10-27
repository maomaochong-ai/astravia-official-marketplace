"""Minimal DEX reader: header, string pool, type and method tables.

Enough to answer the questions the Android cases ask before jadx/apktool are
even installed: is this really a dex, how large is it, which classes and methods
mention a given word, and does the file still look structurally intact after a
repack. It does not decode bytecode - that is ``baksmali`` / jadx territory,
and pretending otherwise would produce confidently wrong output.

An ``.apk`` is accepted and read through ``zipfile``, picking ``classes*.dex``
in order.
"""

from __future__ import annotations

import io
import struct
import zipfile

MAGIC_PREFIX = b"dex\n"
VALID_MAGIC = {b"dex\n035\x00", b"dex\n036\x00", b"dex\n037\x00", b"dex\n038\x00", b"dex\n039\x00"}
HEADER_SIZE = 0x70
ENDIAN_TAG = 0x12345678


class DexError(Exception):
    pass


def is_dex(data):
    return data[:4] == MAGIC_PREFIX


def read_uleb128(data, offset):
    result = 0
    shift = 0
    cursor = offset
    for _ in range(5):
        byte = data[cursor]
        result |= (byte & 0x7F) << shift
        cursor += 1
        if not byte & 0x80:
            return result, cursor
        shift += 7
    raise DexError("uleb128 longer than 5 bytes", offset)


class Dex:
    def __init__(self, name, data):
        if not is_dex(data):
            raise DexError("missing dex magic", 0)
        if len(data) < HEADER_SIZE:
            raise DexError("header truncated", 0)
        self.name = name
        self.data = data
        self.magic = data[:8]
        self.checksum = struct.unpack_from("<I", data, 8)[0]
        self.signature = data[12:32]
        self.file_size = struct.unpack_from("<I", data, 32)[0]
        self.header_size = struct.unpack_from("<I", data, 36)[0]
        self.endian_tag = struct.unpack_from("<I", data, 40)[0]
        self.string_ids_size, self.string_ids_off = struct.unpack_from("<II", data, 56)
        self.type_ids_size, self.type_ids_off = struct.unpack_from("<II", data, 64)
        self.proto_ids_size, self.proto_ids_off = struct.unpack_from("<II", data, 72)
        self.field_ids_size, self.field_ids_off = struct.unpack_from("<II", data, 80)
        self.method_ids_size, self.method_ids_off = struct.unpack_from("<II", data, 88)
        self.class_defs_size, self.class_defs_off = struct.unpack_from("<II", data, 96)
        self.data_size, self.data_off = struct.unpack_from("<II", data, 104)

    # -- integrity ------------------------------------------------------
    def problems(self):
        """Structural complaints, in the order a repack breaks them."""
        out = []
        if self.magic not in VALID_MAGIC:
            out.append("unexpected version tag {}".format(self.magic))
        if self.header_size != HEADER_SIZE:
            out.append("header_size is 0x{:X}, expected 0x70".format(self.header_size))
        if self.endian_tag != ENDIAN_TAG:
            out.append("endian_tag is 0x{:08X}".format(self.endian_tag))
        if self.file_size != len(self.data):
            out.append("header file_size {} but the file is {}".format(self.file_size, len(self.data)))
        for label, size, offset, stride in (
            ("string_ids", self.string_ids_size, self.string_ids_off, 4),
            ("type_ids", self.type_ids_size, self.type_ids_off, 4),
            ("method_ids", self.method_ids_size, self.method_ids_off, 8),
            ("class_defs", self.class_defs_size, self.class_defs_off, 32),
        ):
            if size and offset + size * stride > len(self.data):
                out.append("{} table ({} entries at 0x{:X}) runs past the file".format(label, size, offset))
        return out

    def header_ok(self):
        return not [item for item in self.problems() if "runs past" in item or "e 0x" in item]

    # -- string pool ----------------------------------------------------
    def string_at(self, index):
        offset = struct.unpack_from("<I", self.data, self.string_ids_off + index * 4)[0]
        _, cursor = read_uleb128(self.data, offset)
        end = self.data.find(b"\x00", cursor)
        if end < 0:
            raise DexError("string {} is unterminated".format(index))
        return self.data[cursor:end].decode("utf-8", "replace")

    def strings(self, limit=None):
        total = self.string_ids_size if limit is None else min(limit, self.string_ids_size)
        out = []
        for index in range(total):
            try:
                out.append(self.string_at(index))
            except (DexError, struct.error):
                out.append("<undecodable {}>".format(index))
        return out

    def find_strings(self, query, limit=50):
        query = query.lower()
        hits = []
        for index in range(self.string_ids_size):
            try:
                text = self.string_at(index)
            except (DexError, struct.error):
                continue
            if query in text.lower():
                hits.append({"index": index, "text": text})
                if len(hits) >= limit:
                    break
        return hits

    # -- types / methods ------------------------------------------------
    def type_name(self, index):
        if index >= self.type_ids_size:
            return "<type {}>".format(index)
        string_index = struct.unpack_from("<I", self.data, self.type_ids_off + index * 4)[0]
        return self.string_at(string_index)

    def method_at(self, index):
        at = self.method_ids_off + index * 8
        class_index, proto_index, name_index = struct.unpack_from("<HHI", self.data, at)
        return {
            "class": self.type_name(class_index),
            "name": self.string_at(name_index),
            "proto": proto_index,
        }

    def find_methods(self, query, limit=80):
        query = query.lower()
        hits = []
        for index in range(self.method_ids_size):
            try:
                method = self.method_at(index)
            except (DexError, struct.error):
                continue
            haystack = (method["class"] + "->" + method["name"]).lower()
            if query in haystack:
                hits.append(method)
                if len(hits) >= limit:
                    break
        return hits

    def summary(self):
        return {
            "name": self.name,
            "size": len(self.data),
            "strings": self.string_ids_size,
            "types": self.type_ids_size,
            "methods": self.method_ids_size,
            "classes": self.class_defs_size,
            "version": self.magic[4:7].decode("ascii", "replace"),
            "problems": self.problems(),
        }


def read_dex_bytes(name, data):
    return Dex(name, data)


def read(path):
    """Open a .dex, or every classes*.dex inside an .apk/.zip, as a list."""
    with open(path, "rb") as handle:
        head = handle.read(4)
        handle.seek(0)
        if head == b"PK\x03\x04":
            return read_apk(path)
        return [Dex(path, handle.read())]


def read_apk(path):
    out = []
    with zipfile.ZipFile(path) as archive:
        names = [item for item in archive.namelist() if item.startswith("classes") and item.endswith(".dex")]
        for name in sorted(names):
            out.append(Dex(name, archive.read(name)))
    if not out:
        raise DexError("no classes*.dex inside " + path)
    return out


def read_buffer(name, data):
    """Accept either raw dex bytes or a zip (apk) held in memory."""
    if data[:4] == b"PK\x03\x04":
        out = []
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            for name in sorted(archive.namelist()):
                if name.startswith("classes") and name.endswith(".dex"):
                    out.append(Dex(name, archive.read(name)))
        return out
    return [Dex(name, data)]
