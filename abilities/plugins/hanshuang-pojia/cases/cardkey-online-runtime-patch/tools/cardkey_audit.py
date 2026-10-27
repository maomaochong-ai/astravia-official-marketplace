#!/usr/bin/env python3
"""Card key structure: what the string encodes, and where the client decides.

The case shape (project J): a card key is typed into the client, checked
offline for shape, then sent to an activation server whose reply flips a local
flag. Two questions are answerable without the server, and both change how the
runtime patch is planned:

1. Is there a checksum?  A key that is validated locally usually carries one
   (mod 97, a weighted fold, Luhn, or the low byte of a hash). If the client
   rejects typos before the network call, that check is a branch you can see.
2. Is the expiry inside the key?  Many schemes pack it as YYMM or as a day
   count. Finding which window holds it tells you what the server would have
   said, which is what an offline reproduction needs.

The tool does not claim to know the vendor's scheme. It tests named hypotheses
against a corpus you supply and reports which ones survive *every* sample -
a hypothesis that fails one key is not the scheme, it is a coincidence.

usage:
    python3 cardkey_audit.py --key ABCD-EFGH-IJKL-MNOP
    python3 cardkey_audit.py --corpus keys.txt --group 4
    python3 cardkey_audit.py --corpus keys.txt --sample client.exe --key ABCD-EFGH-IJKL-MNOP
    python3 cardkey_audit.py --self-test
"""

import datetime
import os
import struct
import sys

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli, patch, scan  # noqa: E402

ALPHABETS = {
    "base36": "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "base32": "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
    "digits": "0123456789",
    "hex": "0123456789ABCDEF",
}

EPOCH = datetime.date(2020, 1, 1)


class KeyError_(Exception):
    """The input is not a key this tool can read."""


def normalise(text, alphabet):
    return "".join(char for char in text.upper() if char in alphabet)


def to_int(text, alphabet):
    base = len(alphabet)
    value = 0
    for char in text:
        digit = alphabet.index(char)
        value = value * base + digit
    return value


def groups_of(text, size):
    return [text[index : index + size] for index in range(0, len(text), size)]


def describe(key, alphabet, group):
    body = normalise(key, alphabet)
    if not body:
        raise KeyError_("no characters from the alphabet")
    out = {
        "raw": key,
        "body": body,
        "length": len(body),
        "groups": groups_of(body, group),
        "alphabet": "".join(sorted(set(body))),
        "value": to_int(body, alphabet),
    }
    out["group_sizes"] = sorted({len(item) for item in out["groups"]})
    return out


# --------------------------------------------------------------------------
# checksum hypotheses
# --------------------------------------------------------------------------


def hyp_mod97(keys, alphabet, group):
    """IBAN style: body modulo 97 equals the trailing two characters read as decimal.

    The tail is decimal on purpose. Reading it as base-36 digits gives a
    different number for anything above 35 and turns a real scheme into 0 passes.
    """
    rows = []
    for key in keys:
        body = normalise(key, alphabet)
        if len(body) < 3 or not body[-2:].isdigit():
            return None
        expected = int(body[-2:])
        rows.append(to_int(body[:-2], alphabet) % 97 == expected)
    return rows


def hyp_luhn(keys, alphabet, group):
    rows = []
    for key in keys:
        body = normalise(key, alphabet)
        if not body.isdigit() or len(body) < 2:
            return None
        rows.append(luhn_ok(body))
    return rows


def luhn_ok(digits):
    total = 0
    parity = len(digits) % 2
    for index, char in enumerate(digits):
        value = int(char)
        if index % 2 == parity:
            value *= 2
            if value > 9:
                value -= 9
        total += value
    return total % 10 == 0


def hyp_fold(keys, alphabet, group):
    """Last character is the sum (mod alphabet size) of the others."""
    base = len(alphabet)
    rows = []
    for key in keys:
        body = normalise(key, alphabet)
        if len(body) < 2:
            return None
        total = sum(alphabet.index(char) for char in body[:-1]) % base
        rows.append(total == alphabet.index(body[-1]))
    return rows


def hyp_weighted(keys, alphabet, group):
    """Last character is sum(value * position) mod alphabet size."""
    base = len(alphabet)
    rows = []
    for key in keys:
        body = normalise(key, alphabet)
        if len(body) < 2:
            return None
        total = 0
        for index, char in enumerate(body[:-1]):
            total += alphabet.index(char) * (index + 1)
        rows.append(total % base == alphabet.index(body[-1]))
    return rows


def hyp_xor(keys, alphabet, group):
    rows = []
    for key in keys:
        body = normalise(key, alphabet)
        if len(body) < 2:
            return None
        folded = 0
        for char in body[:-1]:
            folded ^= alphabet.index(char)
        rows.append(folded % len(alphabet) == alphabet.index(body[-1]))
    return rows


HYPOTHESES = (
    ("mod97 (trailing two characters)", hyp_mod97),
    ("luhn (digits, mod 10)", hyp_luhn),
    ("fold (sum of digits mod base)", hyp_fold),
    ("weighted sum mod base", hyp_weighted),
    ("xor fold mod base", hyp_xor),
)


def checksum_report(keys, alphabet, group):
    rows = []
    for label, function in HYPOTHESES:
        try:
            results = function(keys, alphabet, group)
        except (ValueError, IndexError):
            results = None
        if results is None:
            rows.append([label, "n/a", "not applicable to this alphabet or length"])
            continue
        passed = sum(1 for item in results if item)
        verdict = "consistent" if passed == len(keys) else "rejected"
        rows.append([label, "{}/{}".format(passed, len(keys)), verdict])
    return rows


# --------------------------------------------------------------------------
# expiry hypotheses
# --------------------------------------------------------------------------


def _yy_mm(value):
    year = 2000 + value // 100
    month = value % 100
    if not 1 <= month <= 12:
        return None
    return datetime.date(year, month, 1)


def _yyyy_mm(value):
    year = value // 100
    month = value % 100
    if not 1 <= month <= 12 or not 2000 <= year <= 2099:
        return None
    return datetime.date(year, month, 1)


def _day_count(value):
    if not 0 <= value <= 40000:
        return None
    day = EPOCH + datetime.timedelta(days=value)
    if not 2015 <= day.year <= 2035:
        return None
    return day


INTERPRETATIONS = (
    ("YYMM", 4, _yy_mm),
    ("YYYYMM", 6, _yyyy_mm),
    ("days since 2020-01-01", 5, _day_count),
)


def expiry_report(keys, alphabet):
    """Find windows that decode as a date in every key, and differ between keys."""
    bodies = [normalise(key, alphabet) for key in keys]
    if len(bodies) < 2:
        return []
    width = min(len(body) for body in bodies)
    rows = []
    for label, size, decoder in INTERPRETATIONS:
        for start in range(0, max(0, width - size) + 1):
            if not all(body[start : start + size].isdigit() for body in bodies):
                continue
            dates = []
            for body in bodies:
                decoded = decoder(int(body[start : start + size]))
                if decoded is None:
                    dates = None
                    break
                dates.append(decoded)
            if not dates:
                continue
            varying = len(set(dates)) > 1
            rows.append(
                [
                    "{}..{}".format(start, start + size - 1),
                    label,
                    dates[0].isoformat(),
                    dates[-1].isoformat(),
                    "varies" if varying else "constant",
                ]
            )
    return rows


# --------------------------------------------------------------------------
# where the client keeps it
# --------------------------------------------------------------------------


def embedded_forms(key, alphabet, group):
    """Byte forms of the key that a binary would contain or compare against."""
    body = normalise(key, alphabet)
    value = to_int(body, alphabet)
    forms = [
        ("ascii with separators", key.encode("utf-8")),
        ("ascii body", body.encode("utf-8")),
        ("utf16le with separators", key.encode("utf-16-le")),
        ("utf16le body", body.encode("utf-16-le")),
        ("body as u64 (LE)", value.to_bytes(8, "little") if value < 1 << 64 else b""),
        ("body as u64 (BE)", value.to_bytes(8, "big") if value < 1 << 64 else b""),
        ("mod 97 as u32 (LE)", struct.pack("<I", value % 97)),
        ("mod 97 as u32 (BE)", struct.pack(">I", value % 97)),
        ("luhn digit as u8", bytes([sum(alphabet.index(char) for char in body) % len(alphabet)])),
    ]
    out = []
    for label, needle in forms:
        if not needle:
            continue
        out.append((label, needle))
    return out


def search_sample(path, key, alphabet, group):
    with open(path, "rb") as handle:
        data = handle.read()
    rows = []
    for label, needle in embedded_forms(key, alphabet, group):
        hits = scan.find_all(data, needle, limit=8)
        rows.append([label, len(needle), ", ".join("0x{:X}".format(hit) for hit in hits) or "-"])
    return len(data), rows


def patch_skeleton(key, checksum_label, expiry_hint):
    lines = [
        "# patch table skeleton for the local half of the activation check.",
        "# Fill the address from the disassembly of the function that reads the key.",
        "#  address | original | patched | effect",
    ]
    lines.append("# 0x00000000 | 0F 85 ?? ?? ?? ?? | 0F 84 ?? ?? ?? ?? | jump to the accepted branch when the checksum matches")
    if checksum_label:
        lines.append(
            "# 0x00000000 | 74 ?? | EB ?? | skip the {} rejection once the key is well formed".format(checksum_label)
        )
    if expiry_hint:
        lines.append("# 0x00000000 | 0F 8C ?? ?? ?? ?? | 90 90 90 90 90 90 | do not take the expiry branch for {} ".format(expiry_hint))
    lines.append("# 0x00000000 | C6 45 ?? 00 | C6 45 ?? 01 | force the local accepted flag (last resort)")
    lines.append("#")
    lines.append("# verify: apply to a copy, rerun the check, then restore with the same table.")
    return "\n".join(lines) + "\n"


def main(options):
    alphabet_name = (options.get("alphabet") or "base36").lower()
    if alphabet_name not in ALPHABETS:
        raise cli.UsageError("--alphabet must be one of " + ", ".join(sorted(ALPHABETS)))
    alphabet = ALPHABETS[alphabet_name]
    group = int(options.get("group") or 4)
    if group < 1:
        raise cli.UsageError("--group must be positive")

    keys = []
    if options.get("corpus"):
        with open(options["corpus"], "r", encoding="utf-8") as handle:
            keys = [line.strip() for line in handle if line.strip() and not line.startswith("#")]
    if options.get("key"):
        keys.insert(0, options["key"])
    if not keys:
        raise cli.UsageError("give --key, or --corpus with one key per line")

    report = cli.Report("card key structure")
    report.field("keys", len(keys))
    report.field("alphabet", "{} ({} characters)".format(alphabet_name, len(alphabet)))
    report.field("group size", group)

    described = [describe(key, alphabet, group) for key in keys]
    first = described[0]
    report.heading("shape")
    report.field("body", first["body"])
    report.field("length", first["length"])
    report.field("groups", " ".join(first["groups"]))
    report.field("characters used", first["alphabet"])
    if len(described) > 1:
        lengths = sorted({item["length"] for item in described})
        report.field("lengths in corpus", ", ".join(str(item) for item in lengths))
        constant = [
            index
            for index in range(first["length"])
            if all(item["body"][index] == first["body"][index] for item in described if len(item["body"]) > index)
        ]
        report.field("fixed positions", ", ".join(str(item) for item in constant) or "none")

    report.heading("checksum hypotheses")
    report.table(["hypothesis", "passed", "verdict"], checksum_report([item["body"] for item in described], alphabet, group))
    report.line("")
    report.line("a hypothesis is only the scheme when it passes every key in the corpus;")
    report.line("one failure is enough to reject it, whatever the score looks like.")

    if len(described) > 1:
        report.heading("expiry hypotheses")
        rows = expiry_report(keys, alphabet)
        if rows:
            report.table(["window", "reading", "first key", "last key", "behaviour"], rows)
            report.line("")
            report.line("a window that decodes in every key and differs between them is the expiry.")
        else:
            report.line("no window decodes as a date in every key")

    checksum_label = ""
    for label, _function in HYPOTHESES:
        if any(item[0] == label and item[2] == "consistent" for item in checksum_report([item["body"] for item in described], alphabet, group)):
            checksum_label = label
            break
    expiry_hint = ""
    if len(described) > 1:
        rows = expiry_report(keys, alphabet)
        for row in rows:
            if row[4] == "varies":
                expiry_hint = "{} at {}".format(row[1], row[0])
                break

    if options.get("sample"):
        report.heading("embedded in the sample")
        size, rows = search_sample(options["sample"], keys[0], alphabet, group)
        report.field("sample size", size)
        report.table(["form", "bytes", "offsets"], rows)
        found = [row for row in rows if row[2] != "-"]
        report.line("")
        if found:
            report.line("the client compares against: " + found[0][0])
        else:
            report.line("no byte form of this key is present; the key is typed, not stored.")
            report.line("search for the reply parser instead: the local flag is written after the server answers.")

    out_dir = options.get("out")
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
        target = os.path.join(out_dir, "patch-table.skeleton.txt")
        with open(target, "w", encoding="utf-8") as handle:
            handle.write(patch_skeleton(keys[0], checksum_label, expiry_hint))
        report.field("skeleton", target)
        report.field("checksum used in skeleton", checksum_label or "-")
        report.field("expiry used in skeleton", expiry_hint or "-")

    report.emit()
    return cli.EXIT_OK


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]
    alphabet = ALPHABETS["base36"]

    # a mod-97 corpus: body = payload + two digit checksum
    payloads = ["ABCD4K2M", "QWER7P9X", "ZZZ91A2B", "MMN42C7D"]
    mod97_keys = []
    for payload in payloads:
        checksum = to_int(payload, alphabet) % 97
        mod97_keys.append(payload + "{:02d}".format(checksum))
    rows = checksum_report(mod97_keys, alphabet, 4)
    mod97_row = [row for row in rows if row[0].startswith("mod97")][0]
    results.append(mod97_row[2] == "consistent")
    results.append([row for row in rows if row[0].startswith("luhn")][0][2] != "consistent")

    # a corpus with one bad key must reject mod97
    broken = list(mod97_keys)
    broken[2] = broken[2][:-1] + str((int(broken[2][-1]) + 1) % 10)
    broken_row = [row for row in checksum_report(broken, alphabet, 4) if row[0].startswith("mod97")][0]
    results.append(broken_row[2] == "rejected")

    # luhn corpus over digits
    digits = ["79927398713", "49927398716", "1234567812345670"]
    luhn_row = [row for row in checksum_report(digits, ALPHABETS["digits"], 4) if row[0].startswith("luhn")][0]
    results.append(luhn_row[2] == "consistent")
    results.append(luhn_ok("79927398713") and not luhn_ok("79927398710"))

    # expiry: YYMM in positions 4..7, differing between keys
    dated = ["AB" + "2512" + "XY7", "AB" + "2606" + "QW3", "AB" + "2701" + "ZP9"]
    rows = expiry_report(dated, alphabet)
    yy_rows = [row for row in rows if row[1] == "YYMM" and row[0] == "2..5"]
    results.append(bool(yy_rows) and yy_rows[0][4] == "varies")

    # shape
    shape = describe("abcd-efgh-ijkl", alphabet, 4)
    results.append(shape["body"] == "ABCDEFGHIJKL" and shape["groups"] == ["ABCD", "EFGH", "IJKL"])

    # embedded forms found in a synthetic buffer
    with cli_report_guard() as guard:
        key = "ABCD4K2M12"
        buffer = b"\x00" * 32 + key.encode("ascii") + b"\x00" * 8 + to_int(key, alphabet).to_bytes(8, "little")
        path = os.path.join(guard, "sample.bin")
        with open(path, "wb") as handle:
            handle.write(buffer)
        size, rows = search_sample(path, key, alphabet, 4)
        hits = [row for row in rows if row[2] != "-"]
        results.append(size == len(buffer) and len(hits) >= 2)

    skeleton = patch_skeleton("ABCD", "mod97", "YYMM at 2..5")
    results.append(skeleton.count("\n") >= 5 and "mod97" in skeleton)

    passed = sum(1 for item in results if item)
    sys.stdout.write("\ncardkey_audit self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


class cli_report_guard:
    """Tiny temporary directory helper so the self test stays dependency free."""

    def __enter__(self):
        import tempfile

        self.path = tempfile.mkdtemp(prefix="cardkey-")
        return self.path

    def __exit__(self, *_exc):
        import shutil

        shutil.rmtree(self.path, ignore_errors=True)
        return False


FLAGS = ()
VALUES = ("key", "corpus", "alphabet", "group", "sample", "out")


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test, FLAGS, VALUES))
