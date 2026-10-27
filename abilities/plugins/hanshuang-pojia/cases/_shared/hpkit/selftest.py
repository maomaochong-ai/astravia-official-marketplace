"""Kit-wide self test: every tool's ``--self-test`` runs this first.

The assertions below are the contract between the kit and the tools. If a
fixture or a parser drifts, this fails loudly here instead of producing a
plausible-looking hex table in a case report.
"""

from __future__ import annotations

import sys

from . import cli as cli_module
from . import dex as dex_module
from . import fixtures
from . import patch as patch_module
from . import pe as pe_module
from . import scan as scan_module


def _check(name, condition, detail=""):
    mark = "PASS" if condition else "FAIL"
    suffix = (" - " + detail) if detail else ""
    sys.stdout.write("[{}] kit: {}{}\n".format(mark, name, suffix))
    return bool(condition)


def run():
    results = []
    with fixtures.Workspace() as workspace:
        plain = workspace.pe("plain.exe")
        aslr = workspace.pe("aslr.exe", aslr=True, dotnet=True)
        elf = workspace.elf("packed.bin")
        dex_path = workspace.dex("classes.dex")
        apk_path = workspace.apk("demo.apk")

        image = pe_module.read(plain)
        results.append(_check("pe.magic", image.kind == "pe" and image.is_pe()))
        results.append(_check("pe.arch", (image.arch, image.bits) == ("x86", 32), "{} {}".format(image.arch, image.bits)))
        results.append(_check("pe.entry", image.entry == 0x1000, hex(image.entry)))
        results.append(_check("pe.sections", len(image.sections) == 1 and image.sections[0].name == ".text"))
        results.append(_check("pe.rva_to_off", image.rva_to_off(0x1010) == 0x210))
        results.append(_check("pe.off_to_rva", image.off_to_rva(0x210) == 0x1010))
        results.append(_check("pe.va_to_off", image.va_to_off(0x401010) == 0x210))
        results.append(_check("pe.read_at", image.read_at(0x1010, 2) == fixtures.PE_PATTERN[:2]))
        results.append(_check("pe.dep", image.has_dep()))
        results.append(_check("pe.no_aslr", not image.has_aslr()))
        results.append(_check("pe.not_dotnet", not image.is_dotnet))
        results.append(_check("pe.imports_empty", image.imports() == []))
        version = dict(image.copyright_hint())
        results.append(_check("pe.version", "2.7.1" in version.get("FileVersion", ""), version.get("FileVersion", "")))

        hardened = pe_module.read(aslr)
        results.append(_check("pe.aslr", hardened.has_aslr()))
        results.append(_check("pe.dotnet", hardened.is_dotnet))

        exported_path = workspace.write(
            "qtdemo.dll",
            fixtures.synthetic_pe_exports(
                ["qt_plugin_instance", "qt_plugin_query_metadata", "probe"],
                module="qtdemo.dll",
                forwarded=("probe",),
            ),
        )
        exported = pe_module.read(exported_path)
        rows = exported.exports()
        results.append(_check("pe.exports_count", len(rows) == 3, str(len(rows))))
        results.append(_check("pe.exports_module", bool(rows) and rows[0]["module"] == "qtdemo.dll"))
        results.append(_check("pe.exports_ordinals", [row["ordinal"] for row in rows] == [1, 2, 3]))
        results.append(
            _check(
                "pe.exports_forwarder",
                rows[2]["forwarder"] == "OTHERDLL.probe" and rows[0]["forwarder"] is None,
                str(rows[2]["forwarder"]),
            )
        )

        # A slot with no name-table entry is reachable by ordinal only. A proxy
        # that forwards only the named exports breaks callers that use ordinals.
        mixed_path = workspace.write(
            "mixed.dll",
            fixtures.synthetic_pe_exports(["Alpha", "Beta"], module="mixed.dll", ordinal_only=1),
        )
        mixed = pe_module.read(mixed_path).exports()
        results.append(_check("pe.exports_ordinal_only_count", len(mixed) == 3, str(len(mixed))))
        results.append(
            _check(
                "pe.exports_ordinal_only_nameless",
                [row["name"] for row in mixed] == ["Alpha", "Beta", None],
                str([row["name"] for row in mixed]),
            )
        )
        results.append(
            _check("pe.exports_ordinal_only_ordinal", mixed[2]["ordinal"] == 3, str(mixed[2]["ordinal"]))
        )

        try:
            image.rva_to_off(0x9000)
            results.append(_check("pe.unmapped_raises", False))
        except pe_module.FormatError:
            results.append(_check("pe.unmapped_raises", True))

        elf_image = pe_module.read(elf)
        results.append(_check("elf.kind", elf_image.is_elf() and elf_image.arch == "x86-64"))
        results.append(_check("elf.entry", elf_image.entry == 0x401000, hex(elf_image.entry)))
        results.append(_check("elf.load_maps", elf_image.rva_to_off(0x400210) == 0x210))

        pattern = "0F 85 ?? ?? ?? ??"
        compiled = scan_module.compile_pattern(pattern)
        hits = scan_module.find_all(image.data, compiled)
        results.append(_check("scan.find_all", hits == [0x210], str(hits)))
        results.append(_check("scan.matches_at", scan_module.matches_at(image.data, 0x210, compiled)))
        found = scan_module.find_in_image(image, pattern)
        results.append(_check("scan.rva", len(found) == 1 and found[0]["rva"] == 0x1010))
        results.append(_check("scan.cross_version", scan_module.common_span([image], pattern) == 1))
        results.append(_check("scan.describe", scan_module.describe_hit(image, found[0], compiled)["section"] == ".text"))
        try:
            scan_module.compile_pattern("0F 8? ??")
            results.append(_check("scan.rejects_nibble_wildcard", False))
        except ValueError:
            results.append(_check("scan.rejects_nibble_wildcard", True))

        table = "0x1010 | 0F 85 00 00 00 00 | 0F 84 00 00 00 00 | flip branch\n"
        sites = patch_module.parse_table(table)
        results.append(_check("patch.parse_table", len(sites) == 1 and sites[0].address == 0x1010))
        rows = patch_module.check(image.data, sites, image)
        results.append(_check("patch.check_original", rows[0]["state"] == "original"))
        patched, _ = patch_module.apply(image.data, sites, image)
        results.append(_check("patch.apply_bytes", patched[0x210:0x212] == fixtures.PE_PATCHED[:2]))
        results.append(_check("patch.check_patched", patch_module.check(patched, sites, image)[0]["state"] == "patched"))
        ranges = patch_module.diff_ranges(image.data, patched)
        results.append(_check("patch.diff_ranges", len(ranges) == 1 and ranges[0][0] == 0x211 and len(ranges[0][1]) == 1, str(ranges)))
        restored = patch_module.restore(patched, sites, image)
        results.append(_check("patch.restore", restored == image.data))
        try:
            patch_module.apply(image.data, patch_module.parse_table("0x1010 | DE AD BE EF | 00 00 00 00"), image)
            results.append(_check("patch.refuses_mismatch", False))
        except patch_module.SiteError:
            results.append(_check("patch.refuses_mismatch", True))

        dexes = dex_module.read(dex_path)
        results.append(_check("dex.single", len(dexes) == 1))
        entry = dexes[0]
        results.append(_check("dex.problems", entry.problems() == [], "; ".join(entry.problems())))
        results.append(_check("dex.strings", "isLicensed" in entry.strings()))
        results.append(_check("dex.find_strings", any(hit["text"] == "license" for hit in entry.find_strings("licen"))))
        methods = entry.find_methods("islicensed")
        results.append(_check("dex.find_methods", len(methods) == 1 and methods[0]["class"] == "Lcom/demo/Gate;"))
        results.append(_check("dex.version", entry.summary()["version"] == "035"))

        apk_dexes = dex_module.read(apk_path)
        results.append(_check("apk.classes_dex", len(apk_dexes) == 1 and apk_dexes[0].string_ids_size > 0))

        options = cli_module.parse_options(["--sample", "x", "--force", "--limit=5"], flags=("force",), values=("sample", "limit"))
        results.append(_check("cli.parse_options", options["sample"] == "x" and options["force"] and options["limit"] == "5"))

    passed = sum(1 for item in results if item)
    total = len(results)
    sys.stdout.write("\nkit self test: {}/{} assertions passed\n".format(passed, total))
    return cli_module.EXIT_OK if passed == total else cli_module.EXIT_SELFTEST


if __name__ == "__main__":
    # `python3 -m hpkit.selftest` used to exit 0 silently: a self test that
    # asserts nothing is worse than none, because it reads as a pass.
    sys.exit(run())
