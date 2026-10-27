#!/usr/bin/env python3
"""IAT slot plan: where the version proxy's hook has to land, and whether it can.

The version-DLL proxy case hangs on two arithmetic facts that are easy to get
wrong by hand:

* the IAT slot for one imported function is ``FirstThunk + index * ptr`` - the
  index is the position in *that DLL's* thunk array, not in the whole import
  table;
* a 10-byte store (``48 B8 <imm64>`` + ``FF E0``) must sit fully inside one
  writable region. Cross a section end by two bytes and the write faults at
  exactly the moment the licence check runs, which reads like a logic bug
  rather than a memory bug.

So this tool answers both, from the file, without a debugger:

    python3 iat_slot_plan.py --sample app.exe --dll user32.dll --function SetDlgItemTextW
    python3 iat_slot_plan.py --sample app.exe --stores 0x1234:10,0x1240:10
    python3 iat_slot_plan.py --sample app.exe --dll version.dll --proxy-check
    python3 iat_slot_plan.py --self-test
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

STORE_FORMS = {
    10: "48 B8 <imm64> FF E0  (mov rax, imm64; jmp rax)",
    5: "E9 <rel32>            (jmp rel32)",
    6: "FF 25 <rel32>         (jmp [rip+rel32])",
    2: "EB <rel8>             (jmp short)",
}


def read_imports(image):
    """Import descriptors with slot RVAs: [{dll, entries:[{name, slot_rva}]}]."""
    entry = image.data_dirs.get("import")
    if not entry or not entry[0]:
        return []
    width = 8 if image.bits == 64 else 4
    flag = 1 << (63 if width == 8 else 31)
    fmt = "<Q" if width == 8 else "<I"
    offset = image.rva_to_off(entry[0])
    out = []
    for index in range(0, 512):
        descriptor = image.data[offset + index * 20 : offset + index * 20 + 20]
        if len(descriptor) < 20:
            break
        original_first_thunk, stamp, chain, name_rva, first_thunk = struct.unpack("<IIIII", descriptor)
        if not any((original_first_thunk, stamp, chain, name_rva, first_thunk)):
            break
        try:
            dll = pe.read_cstring(image.data, image.rva_to_off(name_rva))
        except pe.FormatError:
            dll = "<unmapped>"
        entries = []
        thunk_rva = original_first_thunk or first_thunk
        if thunk_rva and first_thunk:
            try:
                thunk_off = image.rva_to_off(thunk_rva)
            except pe.FormatError:
                thunk_off = None
            if thunk_off is not None:
                for step in range(0, 4096):
                    raw = image.data[thunk_off + step * width : thunk_off + step * width + width]
                    if len(raw) < width:
                        break
                    value = struct.unpack(fmt, raw)[0]
                    if value == 0:
                        break
                    if value & flag:
                        name = "#{}".format(value & 0xFFFF)
                    else:
                        try:
                            name = pe.read_cstring(image.data, image.rva_to_off(value + 2))
                        except pe.FormatError:
                            name = "<unmapped>"
                    entries.append({"name": name, "slot_rva": first_thunk + step * width})
        out.append({"dll": dll, "entries": entries})
    return out


def find_slot(imports, dll, function):
    wanted_dll = dll.lower()
    for group in imports:
        if group["dll"].lower() != wanted_dll:
            continue
        for entry in group["entries"]:
            if entry["name"].lower() == function.lower():
                return group, entry
    return None, None


def site_report(image, rva, width):
    """Can a ``width``-byte store at ``rva`` land without crossing a section end?"""
    section = image.section_for(rva)
    if section is None:
        return {"rva": rva, "section": "<none>", "ok": False, "reason": "not mapped by any section"}
    end = section.va + max(section.vsize, section.raw_size)
    healthy = section.writable and rva + width <= end
    if not section.writable and rva + width <= end:
        reason = "inside {} but the section is not writable; needs a page-attribute change first".format(section.name)
    elif rva + width > end:
        reason = "crosses the end of {} by {} byte(s)".format(section.name, rva + width - end)
    else:
        reason = "fits inside writable {}".format(section.name)
    return {
        "rva": rva,
        "section": section.name,
        "ok": healthy,
        "writable": section.writable,
        "reason": reason,
    }


def main(options):
    cli.require(options, "sample")
    image = pe.read(options["sample"])
    imports = read_imports(image)

    report = cli.Report("IAT slot plan")
    report.field("sample", options["sample"])
    report.field("sha256", image.sha256)
    report.field("bits", image.bits)
    report.field("imported DLLs", len(imports))

    if options.get("dll"):
        group, entry = find_slot(imports, options["dll"], options.get("function") or "")
        if options.get("function") is None:
            group = next((item for item in imports if item["dll"].lower() == options["dll"].lower()), None)
            entry = None
        report.heading("import lookup")
        report.field("dll", options["dll"])
        if group is None:
            report.line("not imported by this image.")
            if options.get("proxy"):
                report.line("A proxy DLL for an unimported module is dead weight: nothing will load it.")
            else:
                report.line("Without an import there is no IAT slot to redirect.")
        else:
            report.field("functions imported", len(group["entries"]))
            if entry is None and options.get("function"):
                report.line("function not found in that DLL's thunk array.")
                for item in group["entries"][:20]:
                    report.line("  {} @ 0x{:X}".format(item["name"], item["slot_rva"]))
            elif entry is not None:
                width = 8 if image.bits == 64 else 4
                slot_off = image.rva_to_off(entry["slot_rva"])
                current = image.data[slot_off : slot_off + width]
                section = image.section_for(entry["slot_rva"])
                report.field("slot RVA", "0x{:X}".format(entry["slot_rva"]))
                report.field("file offset", "0x{:X}".format(slot_off))
                report.field("slot section", section.name if section else "<none>")
                report.field("slot writable", bool(section and section.writable))
                report.field("current value", current[::-1].hex(" ").upper() if image.bits == 64 else current.hex(" ").upper())
                report.line("")
                report.line("Static plan: overwrite those {} bytes with the replacement's VA.".format(width))
                report.line("Runtime plan: VirtualProtect the slot page, store, restore the old protection.")
                if not (section and section.writable):
                    report.line("The slot lives in a non-writable section, so a file patch alone will not take effect:")
                    report.line("either the loader relocates it (check the relocation directory) or the write must happen at runtime.")

    if options.get("stores"):
        report.heading("store sites")
        rows = []
        for spec in options["stores"].split(","):
            spec = spec.strip()
            if not spec:
                continue
            address_text, _, width_text = spec.partition(":")
            rva = int(address_text, 16)
            width = int(width_text) if width_text else 10
            info = site_report(image, rva, width)
            rows.append(
                [
                    "0x{:X}".format(rva),
                    width,
                    info["section"],
                    "yes" if info.get("writable") else "no",
                    "ok" if info["ok"] else "blocked",
                    info["reason"],
                ]
            )
        report.table(["rva", "bytes", "section", "writable", "verdict", "reason"], rows)
        report.line("")
        for width, form in sorted(STORE_FORMS.items(), reverse=True):
            report.line("  {} bytes: {}".format(width, form))

    if options.get("proxy"):
        report.heading("proxy viability")
        version_groups = [group for group in imports if "version" in group["dll"].lower()]
        if version_groups:
            group = version_groups[0]
            report.field("loaded module", group["dll"])
            report.field("imported functions", len(group["entries"]))
            report.line("The host resolves these through its own import table, so a proxy must forward all of them.")
            report.line("Use proxy_forward_plan.py (multiprocess-proxy-hotpatch) to emit the .def.")
        else:
            report.line("No version.dll import: a version proxy would never be loaded by this image.")

    report.emit()
    return cli.EXIT_OK


def _import_fixture():
    """One DLL, one function: user32.dll!SetDlgItemTextW at slot 0x1140."""
    data = bytearray(fixtures.synthetic_pe(version=False))
    body = 0x200
    data[body : body + 0x200] = b"\x00" * 0x200

    def put(rva, blob):
        at = body + (rva - 0x1000)
        data[at : at + len(blob)] = blob

    name_rva = 0x1150
    put(name_rva, struct.pack("<H", 0) + b"SetDlgItemTextW\x00")
    dll_rva = 0x1170
    put(dll_rva, b"user32.dll\x00")
    put(0x1130, struct.pack("<QQ", name_rva, 0))
    put(0x1140, struct.pack("<QQ", 0x7FFE1000, 0))
    put(0x1100, struct.pack("<IIIII", 0x1130, 0, 0, dll_rva, 0x1140))
    put(0x1114, b"\x00" * 20)
    struct.pack_into("<II", data, 0x98 + 96 + 8, 0x1100, 40)
    return bytes(data)


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]
    with fixtures.Workspace() as workspace:
        path = workspace.write("app.exe", _import_fixture())
        image = pe.read(path)
        imports = read_imports(image)

        results.append(len(imports) == 1 and imports[0]["dll"] == "user32.dll")
        results.append(len(imports[0]["entries"]) == 1)
        results.append(imports[0]["entries"][0]["name"] == "SetDlgItemTextW")
        results.append(imports[0]["entries"][0]["slot_rva"] == 0x1140)

        group, entry = find_slot(imports, "USER32.DLL", "setdlgitemtextw")
        results.append(group is not None and entry is not None)
        results.append(find_slot(imports, "version.dll", "GetFileVersionInfoW") == (None, None))

        offset = image.rva_to_off(entry["slot_rva"])
        results.append(image.data[offset : offset + 8] == struct.pack("<Q", 0x7FFE1000))

        inside = site_report(image, 0x1080, 10)
        results.append(inside["ok"] is False and inside["section"] == ".text")
        crossing = site_report(image, 0x11FA, 10)
        results.append(crossing["ok"] is False and "crosses" in crossing["reason"])
        unmapped = site_report(image, 0x9000, 10)
        results.append(unmapped["ok"] is False and unmapped["section"] == "<none>")

    passed = sum(1 for item in results if item)
    sys.stdout.write("\niat_slot_plan self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


FLAGS = ("proxy",)
VALUES = ("sample", "dll", "function", "stores")


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test, FLAGS, VALUES))
