"""Patch tables: describe, apply, verify, roll back.

A patch table is the durable artefact of a case. The offsets go stale the day
the vendor ships a new build; the *shape* (original bytes -> patched bytes ->
what the branch now does) does not. This module keeps the table as data so a
tool can:

* check that the original bytes are still where the table says,
* apply the patch to a copy,
* verify the copy differs only at the listed sites, and
* restore the original bytes byte-for-byte.

Sites are addressed by RVA when an ``Image`` is supplied, by file offset
otherwise. Applying refuses to proceed on a mismatch unless ``force`` is set,
because a silent mismatch is how a "working" patch ends up editing something
else entirely.
"""

from __future__ import annotations

import hashlib
import re

from . import pe as pe_module

LINE = re.compile(r"^\s*(?:[-*]\s*)?(?P<addr>0x[0-9A-Fa-f]+|[0-9A-Fa-f]+)\s*\|\s*(?P<orig>[^|]*)\|\s*(?P<patch>[^|]*)(?:\|\s*(?P<note>.*))?$")


class SiteError(Exception):
    pass


class Site:
    """One row of a patch table."""

    __slots__ = ("address", "original", "patched", "note", "address_kind")

    def __init__(self, address, original, patched, note="", address_kind="rva"):
        if len(original) != len(patched):
            raise SiteError(
                "site 0x{:X}: original is {} bytes, patched is {} - lengths must match".format(
                    address, len(original), len(patched)
                )
            )
        self.address = address
        self.original = bytes(original)
        self.patched = bytes(patched)
        self.note = note.strip()
        self.address_kind = address_kind

    @property
    def width(self):
        return len(self.original)

    def resolve(self, image=None):
        if self.address_kind == "file" or image is None:
            return self.address
        return image.rva_to_off(self.address)

    def row(self):
        return [
            "0x{:X}".format(self.address),
            self.original.hex(" ").upper(),
            self.patched.hex(" ").upper(),
            self.note or "-",
        ]


def parse_hex_bytes(text):
    tokens = [token for token in text.replace(",", " ").split() if token and token not in ("-", "none", "NOP?")]
    if not tokens:
        return b""
    out = bytearray()
    for token in tokens:
        cleaned = token[2:] if token.lower().startswith("0x") else token
        cleaned = cleaned.replace("\\x", "")
        if len(cleaned) % 2 != 0:
            raise ValueError("odd-length byte token: " + token)
        out.extend(bytes.fromhex(cleaned))
    return bytes(out)


def parse_table(text, address_kind="rva"):
    """Parse ``0xADDR | ORIGINAL | PATCHED | note`` lines; other lines ignored."""
    sites = []
    for raw in text.splitlines():
        match = LINE.match(raw)
        if not match:
            continue
        address = int(match.group("addr"), 16)
        sites.append(
            Site(
                address,
                parse_hex_bytes(match.group("orig")),
                parse_hex_bytes(match.group("patch")),
                match.group("note") or "",
                address_kind=address_kind,
            )
        )
    return sites


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def check(data, sites, image=None):
    """Per-site state: 'original', 'patched', 'mismatch' (with what is there)."""
    rows = []
    for site in sites:
        offset = site.resolve(image)
        present = data[offset : offset + site.width]
        if present == site.original:
            state = "original"
        elif present == site.patched:
            state = "patched"
        else:
            state = "mismatch"
        rows.append({"site": site, "offset": offset, "state": state, "present": present.hex(" ").upper()})
    return rows


def apply(data, sites, image=None, force=False):
    """Return (new_bytes, rows). Refuses on mismatch unless ``force``."""
    rows = check(data, sites, image)
    blockers = [row for row in rows if row["state"] == "mismatch"]
    if blockers and not force:
        detail = ", ".join(
            "0x{:X}: found {}".format(row["site"].address, row["present"]) for row in blockers
        )
        raise SiteError("original bytes do not match at: " + detail)
    out = bytearray(data)
    for row in rows:
        out[row["offset"] : row["offset"] + row["site"].width] = row["site"].patched
    return bytes(out), rows


def restore(data, sites, image=None):
    """Undo the table: put the originals back wherever the patched bytes sit."""
    out = bytearray(data)
    for site in sites:
        offset = site.resolve(image)
        if out[offset : offset + site.width] == site.patched:
            out[offset : offset + site.width] = site.original
    return bytes(out)


def diff_ranges(before, after):
    """Contiguous ranges where two buffers differ: [(offset, before, after)]."""
    if len(before) != len(after):
        raise SiteError("buffers differ in length: {} vs {}".format(len(before), len(after)))
    ranges = []
    index = 0
    length = len(before)
    while index < length:
        if before[index] == after[index]:
            index += 1
            continue
        start = index
        while index < length and before[index] != after[index]:
            index += 1
        ranges.append((start, before[start:index], after[start:index]))
    return ranges


def render(rows):
    """Table rows for cli.Report.table."""
    out = []
    for row in rows:
        site = row["site"]
        out.append(
            [
                "0x{:X}".format(site.address),
                site.original.hex(" ").upper(),
                site.patched.hex(" ").upper(),
                row["state"],
                site.note or "-",
            ]
        )
    return out


def expected_width(sites):
    return sum(site.width for site in sites)


def count_mismatch(rows):
    return sum(1 for row in rows if row["state"] == "mismatch")


def load_image(path):
    return pe_module.read(path)
