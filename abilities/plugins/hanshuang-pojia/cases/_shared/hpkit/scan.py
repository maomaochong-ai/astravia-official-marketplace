"""Array-of-bytes scanning with wildcards.

The corpus keeps saying the same thing in different words: an offset is a
position, a signature is a shape. This module is the shape half. Patterns are
written the way they appear in the case documents::

    0F 85 ?? ?? ?? ?? E8
    48 8B 05 ?? ?? ?? ??

A ``??`` token matches any single byte. Nibble wildcards are rejected on
purpose: a half-byte match is almost always a pattern that is too short, and
accepting it hides that.
"""

from __future__ import annotations

from . import pe as pe_module

WILDCARDS = {"?", "??", "**"}


def compile_pattern(text):
    """'0F 85 ?? 00' -> [15, 133, None, 0]. Raises ValueError on bad tokens."""
    if isinstance(text, (bytes, bytearray)):
        return list(text)
    tokens = text.replace(",", " ").split()
    if not tokens:
        raise ValueError("empty pattern")
    pattern = []
    for token in tokens:
        if token in WILDCARDS:
            pattern.append(None)
            continue
        cleaned = token[2:] if token.lower().startswith("0x") else token
        cleaned = cleaned.replace("\\x", "")
        if len(cleaned) % 2 != 0:
            raise ValueError("odd-length token: " + token)
        if any(char in "?*" for char in cleaned):
            raise ValueError(
                "nibble wildcards are not supported ({}): use whole-byte ?? and a longer anchor".format(token)
            )
        try:
            pattern.append(int(cleaned, 16))
        except ValueError:
            raise ValueError("not hex: " + token)
    if all(byte is None for byte in pattern):
        raise ValueError("pattern is all wildcards")
    return pattern


def matches_at(data, offset, pattern):
    if offset < 0 or offset + len(pattern) > len(data):
        return False
    for index, byte in enumerate(pattern):
        if byte is None:
            continue
        if data[offset + index] != byte:
            return False
    return True


def find_all(data, pattern, limit=1000, start=0):
    """Every offset where the pattern matches, capped at ``limit``."""
    if isinstance(pattern, str):
        pattern = compile_pattern(pattern)
    hits = []
    anchor = pattern[0]
    if anchor is None:
        for offset in range(start, max(0, len(data) - len(pattern)) + 1):
            if matches_at(data, offset, pattern):
                hits.append(offset)
                if len(hits) >= limit:
                    break
        return hits
    offset = data.find(bytes([anchor]), start)
    while offset >= 0:
        if matches_at(data, offset, pattern):
            hits.append(offset)
            if len(hits) >= limit:
                break
        offset = data.find(bytes([anchor]), offset + 1)
    return hits


def find_in_image(image, pattern, limit=1000):
    """Hits as {'rva', 'file_offset'} - RVAs are what the case tables quote."""
    hits = []
    for offset in find_all(image.data, pattern, limit=limit):
        try:
            rva = image.off_to_rva(offset)
        except pe_module.FormatError:
            rva = None
        hits.append({"rva": rva, "file_offset": offset})
    return hits


def describe_hit(image, hit, pattern, context=16):
    file_offset = hit["file_offset"]
    rva = hit["rva"]
    start = max(0, file_offset - context)
    return {
        "rva": "0x{:X}".format(rva) if rva is not None else "unmapped",
        "file_offset": "0x{:X}".format(file_offset),
        "section": (image.section_for(rva).name if rva is not None and image.section_for(rva) else "<none>"),
        "bytes": image.data[file_offset : file_offset + len(pattern)].hex(" ").upper(),
        "context": image.data[start : file_offset + len(pattern) + context].hex(" ").upper(),
    }


def cross_version(images, pattern):
    """Which builds contain the pattern, and at which RVA.

    A signature is only usable across versions if the *shape* is present in all
    of them; this is the check that decides whether a pattern is a signature or
    a souvenir of one build.
    """
    rows = []
    for image in images:
        hits = find_in_image(image, pattern)
        rows.append(
            {
                "path": image.path,
                "hits": len(hits),
                "rvas": ["0x{:X}".format(hit["rva"]) if hit["rva"] is not None else "?" for hit in hits],
            }
        )
    return rows


def common_span(images, pattern):
    """Smallest hit count across builds: 0 means the pattern does not generalise."""
    counts = [len(find_in_image(image, pattern)) for image in images]
    return min(counts) if counts else 0
