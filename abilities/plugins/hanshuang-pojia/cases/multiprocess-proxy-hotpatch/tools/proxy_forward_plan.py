#!/usr/bin/env python3
"""Proxy forward plan: emit the .def a proxy DLL needs, and catch export drift.

A proxy DLL works only if it exports *everything the host might resolve*, in the
same shapes. Miss one export and the host's loader fails at startup; shift one
ordinal and the host silently binds a different function. The case that
produced this tool paid for both mistakes: the first proxy forwarded 41 of 43
exports by name, and the host resolved one by ordinal.

So the tool does two things and nothing else:

* ``--target real.dll``  prints the export list and the ``.def`` that forwards
  every entry to the original module, named exports by name, ordinal-only
  exports as ``NONAME`` with the ordinal pinned.
* ``--previous old.dll`` with ``--target new.dll`` reports the drift between two
  builds: added, removed and moved ordinals. That diff is what has to be
  re-checked before shipping a proxy against a new version.

usage:
    python3 proxy_forward_plan.py --target version.dll
    python3 proxy_forward_plan.py --target version.dll --previous version-1.dll --out plan/
    python3 proxy_forward_plan.py --self-test
"""

import os
import struct
import sys

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli, fixtures, pe  # noqa: E402


def read_exports(image):
    """Ordinal-complete export list: [(ordinal, name or None, rva)].

    The number of *functions* drives the array, not the number of names: an
    export can exist by ordinal only, and a proxy must still forward it.
    """
    entry = image.data_dirs.get("export")
    if not entry or not entry[0]:
        return []
    base_off = image.rva_to_off(entry[0])
    head = image.data[base_off : base_off + 40]
    if len(head) < 40:
        return []
    (_flags, _stamp, _major, _minor, name_rva, base, funcs, names, funcs_rva,
     names_rva, ords_rva) = struct.unpack("<IIHHIIIIIII", head)
    out = [{"ordinal": base + index, "name": None, "rva": 0} for index in range(funcs)]
    try:
        func_table = image.rva_to_off(funcs_rva)
    except pe.FormatError:
        func_table = None
    if func_table is not None:
        for index in range(funcs):
            raw = image.data[func_table + index * 4 : func_table + index * 4 + 4]
            if len(raw) < 4:
                break
            out[index]["rva"] = struct.unpack("<I", raw)[0]
    try:
        name_table = image.rva_to_off(names_rva)
        ord_table = image.rva_to_off(ords_rva)
    except pe.FormatError:
        return out
    for index in range(names):
        raw = image.data[name_table + index * 4 : name_table + index * 4 + 4]
        if len(raw) < 4:
            break
        name_offset = struct.unpack("<I", raw)[0]
        ordinal_raw = image.data[ord_table + index * 2 : ord_table + index * 2 + 2]
        if len(ordinal_raw) < 2:
            break
        slot = struct.unpack("<H", ordinal_raw)[0]
        if slot >= len(out):
            continue
        try:
            out[slot]["name"] = pe.read_cstring(image.data, image.rva_to_off(name_offset))
        except pe.FormatError:
            continue
    return out


def module_name(image, exports):
    entry = image.data_dirs.get("export")
    if not entry or not entry[0]:
        return None
    base_off = image.rva_to_off(entry[0])
    head = image.data[base_off : base_off + 40]
    if len(head) < 40:
        return None
    name_rva = struct.unpack_from("<I", head, 12)[0]
    try:
        return pe.read_cstring(image.data, image.rva_to_off(name_rva))
    except pe.FormatError:
        return None


def plan_def(library, exports, forward_to):
    """A .def that forwards every export to ``forward_to`` unchanged."""
    lines = ["LIBRARY {}".format(library), "EXPORTS"]
    for entry in exports:
        ordinal = entry["ordinal"]
        if entry["name"]:
            lines.append("    {name}={module}.{name} @{ordinal}".format(
                name=entry["name"], module=forward_to, ordinal=ordinal))
        else:
            lines.append("    @{ordinal}={module}.#{ordinal} @{ordinal} NONAME".format(
                ordinal=ordinal, module=forward_to))
    return "\n".join(lines) + "\n"


def by_key(exports):
    return {entry["name"] or "#{}".format(entry["ordinal"]): entry for entry in exports}


def diff_exports(previous, current):
    """Rows a proxy must be re-checked against: added / removed / moved."""
    before = by_key(previous)
    after = by_key(current)
    rows = []
    for key in sorted(set(before) | set(after)):
        old = before.get(key)
        new = after.get(key)
        if old and not new:
            rows.append([key, old["ordinal"], "-", "removed"])
        elif new and not old:
            rows.append([key, "-", new["ordinal"], "added"])
        elif old["ordinal"] != new["ordinal"]:
            rows.append([key, old["ordinal"], new["ordinal"], "ordinal moved"])
    return rows


def main(options):
    cli.require(options, "target")
    image = pe.read(options["target"])
    exports = read_exports(image)
    library = module_name(image, exports) or os.path.basename(options["target"])
    forward_to = options.get("module") or library

    report = cli.Report("proxy forward plan")
    report.field("target", options["target"])
    report.field("sha256", image.sha256)
    report.field("export module", library)
    report.field("exports", len(exports))
    report.field("named", sum(1 for entry in exports if entry["name"]))
    report.field("ordinal only", sum(1 for entry in exports if not entry["name"]))

    report.heading("exports")
    if exports:
        report.table(
            ["ordinal", "name", "rva"],
            [[entry["ordinal"], entry["name"] or "<none>", "0x{:X}".format(entry["rva"])] for entry in exports[:80]],
        )
        if len(exports) > 80:
            report.line("  ({} more)".format(len(exports) - 80))
    else:
        report.line("no export directory: there is nothing to forward, so a proxy is the wrong delivery")

    plan = plan_def(library, exports, forward_to)
    report.heading("def")
    for line in plan.splitlines()[:24]:
        report.line("  " + line)
    if len(plan.splitlines()) > 24:
        report.line("  ... {} more lines".format(len(plan.splitlines()) - 24))

    if options.get("previous"):
        old_image = pe.read(options["previous"])
        rows = diff_exports(read_exports(old_image), exports)
        report.heading("drift against " + os.path.basename(options["previous"]))
        if rows:
            report.table(["export", "old ordinal", "new ordinal", "change"], rows)
            report.line("Every row above is a forwarder that must be re-verified before shipping.")
        else:
            report.line("no drift: the export surface is identical, so the existing forwarders still resolve")

    out = options.get("out")
    if out:
        os.makedirs(out, exist_ok=True)
        def_path = os.path.join(out, "proxy.def")
        with open(def_path, "w", encoding="utf-8") as handle:
            handle.write(plan)
        report.field("def written", def_path)
        listing = os.path.join(out, "exports.tsv")
        with open(listing, "w", encoding="utf-8") as handle:
            for entry in exports:
                handle.write("{}\t{}\t0x{:X}\n".format(entry["ordinal"], entry["name"] or "", entry["rva"]))
        report.field("export list", listing)

    report.line("")
    report.line("A forwarder table is only correct for the build it was read from; re-run --previous")
    report.line("against the next version before trusting it.")
    report.emit()
    return cli.EXIT_OK


def _export_fixture():
    """A PE with three functions: Alpha @1, Beta @2, and one ordinal-only @3."""
    data = bytearray(fixtures.synthetic_pe(version=False))
    body = 0x200
    data[body : body + 0x200] = b"\x00" * 0x200

    def put(rva, blob):
        at = body + (rva - 0x1000)
        data[at : at + len(blob)] = blob

    put(0x1060, b"demo.dll\x00")
    put(0x1070, b"Alpha\x00")
    put(0x1080, b"Beta\x00")
    put(0x1030, struct.pack("<III", 0x1100, 0x1110, 0x1120))
    put(0x1040, struct.pack("<II", 0x1070, 0x1080))
    put(0x1050, struct.pack("<HH", 0, 1))
    put(
        0x1000,
        struct.pack("<IIHHIIIIIII", 0, 0, 0, 0, 0x1060, 1, 3, 2, 0x1030, 0x1040, 0x1050),
    )
    # Export directory entry: index 0 at optional header + 96.
    struct.pack_into("<II", data, 0x98 + 96, 0x1000, 0x28)
    return bytes(data)


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]
    with fixtures.Workspace() as workspace:
        path = workspace.write("demo.dll", _export_fixture())
        image = pe.read(path)
        exports = read_exports(image)

        results.append(len(exports) == 3)
        results.append(module_name(image, exports) == "demo.dll")
        results.append([entry["ordinal"] for entry in exports] == [1, 2, 3])
        results.append(exports[0]["name"] == "Alpha" and exports[1]["name"] == "Beta")
        results.append(exports[2]["name"] is None)

        plan = plan_def("demo.dll", exports, "demo_orig")
        results.append("EXPORTS" in plan and "Alpha=demo_orig.Alpha @1" in plan)
        results.append("NONAME" in plan and "@3=demo_orig.#3 @3" in plan)

        shifted = [dict(entry) for entry in exports]
        shifted[1]["ordinal"] = 7
        rows = diff_exports(exports, shifted)
        results.append(any(row[3] == "ordinal moved" for row in rows))
        rows = diff_exports(exports, exports[:2])
        results.append(any(row[3] == "removed" for row in rows))

    passed = sum(1 for item in results if item)
    sys.stdout.write("\nproxy_forward_plan self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


FLAGS = ()
VALUES = ("target", "previous", "module", "out")


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test, FLAGS, VALUES))
