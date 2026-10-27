#!/usr/bin/env python3
"""Proxy DLL export completeness: every import the host makes must be forwarded.

The failure this prevents is boring and total: you build a proxy DLL, forward 40
of 41 exports, and the application dies at load time with "procedure entry point
not found" before any of your code runs. The missing one is usually not the
interesting one.

Three inputs, any combination:

* ``--dll <file>``   the original DLL (exports read from the PE export directory)
* ``--def <file>``   the proxy's module definition file (the forwarding list)
* ``--need <file>``  a plain list of names the host imports (from a dependency
                    walker, or pasted out of ``dumpbin /imports``)

Reports missing forwarders (fatal), stale forwarders (dead weight), ordinal
drift, and the Qt plugin entry points specifically, because those four symbols
are the ones a Qt plugin must expose with exactly the right names.

usage:
    python3 qt_export_diff.py --dll Qt5Core.dll --def proxy.def
    python3 qt_export_diff.py --def proxy.def --need imports.txt
    python3 qt_export_diff.py --self-test
"""

import os
import re
import sys

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli, fixtures, pe  # noqa: E402

# The symbols a Qt plugin DLL has to expose by name. A proxy that renames or
# drops any of them produces "not a Qt plugin" at load time, not a link error.
QT_PLUGIN_ENTRIES = (
    "qt_plugin_instance",
    "qt_plugin_query_metadata",
    "qt_plugin_query_metadata_v2",
    "qt_plugin_query_metadata_v3",
)

QT_MODULE_HINT = re.compile(r"^Qt[0-9]?(Core|Gui|Widgets|Network|Sql|Xml|Qml|Quick)", re.IGNORECASE)


class DefError(Exception):
    pass


def parse_def(text):
    """Parse an ``EXPORTS`` block into rows: {'name', 'target', 'ordinal'}.

    Handles the two forms that matter for forwarding::

        EXPORTS
            SomeFunction=OTHERDLL.SomeFunction @1
            AnotherFunction=OTHERDLL.#42

    Line continuations (trailing backslash) are joined before parsing, and
    ``;``-comments, ``LIBRARY``/``DESCRIPTION``/``NAME`` lines are ignored.
    """
    logical = []
    pending = ""
    for raw in text.splitlines():
        line = raw.rstrip()
        if line.endswith("\\"):
            pending += line[:-1] + " "
            continue
        logical.append(pending + line)
        pending = ""
    if pending:
        logical.append(pending)

    rows = []
    in_exports = False
    for line in logical:
        stripped = line.split(";", 1)[0].strip()
        if not stripped:
            continue
        upper = stripped.upper()
        if upper.startswith("EXPORTS"):
            in_exports = True
            rest = stripped[len("EXPORTS") :].strip()
            if not rest:
                continue
            stripped = rest
        if not in_exports:
            continue
        if upper.startswith(("LIBRARY", "DESCRIPTION", "NAME", "STACKSIZE", "SECTIONS", "HEAPSIZE", "VERSION", "CODE", "DATA", "SEGMENTS")):
            continue
        ordinal = None
        match = re.search(r"@(\d+)\s*(?:NONAME\s*)?(?:DATA\s*)?(?:PRIVATE\s*)?$", stripped, re.IGNORECASE)
        if match:
            ordinal = int(match.group(1))
            stripped = stripped[: match.start()].strip()
        stripped = re.sub(r"\s+(DATA|NONAME|PRIVATE|CONSTANT)\s*$", "", stripped, flags=re.IGNORECASE)
        if "=" in stripped:
            name, _, target = stripped.partition("=")
            name = name.strip()
            target = target.strip()
        else:
            name = stripped
            target = ""
        if not name:
            continue
        if not target:
            target = ""
        if name.startswith("#") and name[1:].isdigit() and ordinal is None:
            ordinal = int(name[1:])
        rows.append({"name": name, "target": target, "ordinal": ordinal})
    if not rows:
        raise DefError("no exports found in the .def file")
    return rows


def parse_need(text):
    names = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith(("#", ";")):
            continue
        token = line.split()[0]
        token = token.split("(", 1)[0]
        names.append(token)
    return names


def forwarded_name(row):
    """For ``Fn=MODULE.Fn`` rows, the forwarded symbol is everything after the dot."""
    target = row["target"]
    if not target:
        return None
    if "." in target:
        return target.rsplit(".", 1)[1]
    return target


def detect_and_rank(dll_rows, def_rows, need_rows):
    reference = {row["name"]: row for row in dll_rows} if dll_rows else {}
    forwarded = {}
    by_ordinal = {}
    for row in def_rows or []:
        forwarded[row["name"]] = row
        if row["ordinal"] is not None:
            by_ordinal[row["ordinal"]] = row
    ordinal_map = {row["ordinal"]: row["name"] for row in dll_rows if "ordinal" in row}

    required = list(need_rows or [])
    if dll_rows and not required:
        required = [row["name"] for row in dll_rows]

    missing = []
    for name in required:
        if name in forwarded:
            continue
        # a forward may be declared by ordinal only: "#42=OTHER.#42"
        candidate = None
        if name in reference:
            candidate = by_ordinal.get(reference[name]["ordinal"])
        if candidate is not None:
            continue
        missing.append(name)

    stale = []
    if reference:
        for name in forwarded:
            if name in reference or name.startswith("#"):
                continue
            stale.append(name)

    ordinal_rows = []
    for name, row in forwarded.items():
        if row["ordinal"] is None or name not in reference:
            continue
        expected = reference[name]["ordinal"]
        if expected != row["ordinal"]:
            ordinal_rows.append([name, expected, row["ordinal"]])

    renamed = []
    for name, row in forwarded.items():
        if name not in reference:
            continue
        target = forwarded_name(row)
        if target and target != name and not target.startswith("#"):
            renamed.append([name, target])

    return {
        "required": required,
        "missing": missing,
        "stale": stale,
        "ordinal_drift": ordinal_rows,
        "renamed": renamed,
        "forwarded": forwarded,
        "reference": reference,
        "ordinal_map": ordinal_map,
    }


def qt_rows(state):
    rows = []
    for entry in QT_PLUGIN_ENTRIES:
        in_reference = entry in state["reference"]
        in_forwarded = entry in state["forwarded"]
        if in_reference and in_forwarded:
            status = "forwarded"
        elif in_reference:
            status = "MISSING - plugin will not load"
        elif in_forwarded:
            status = "extra - not in the original"
        else:
            status = "absent in both"
        rows.append([entry, "yes" if in_reference else "no", "yes" if in_forwarded else "no", status])
    return rows


def main(options):
    dll_rows = []
    module = None
    if options.get("dll"):
        image = pe.read(options["dll"])
        dll_rows = image.exports()
        module = dll_rows[0]["module"] if dll_rows else None
        if not dll_rows:
            raise cli.UsageError("no export directory in " + options["dll"])

    def_rows = []
    if options.get("def"):
        with open(options["def"], "r", encoding="utf-8", errors="replace") as handle:
            def_rows = parse_def(handle.read())

    need_rows = []
    if options.get("need"):
        with open(options["need"], "r", encoding="utf-8", errors="replace") as handle:
            need_rows = parse_need(handle.read())

    if not (dll_rows or def_rows):
        raise cli.UsageError("give --dll, --def, or both")

    state = detect_and_rank(dll_rows, def_rows, need_rows)

    report = cli.Report("proxy DLL export completeness")
    if module:
        report.field("original", "{} ({} named exports)".format(module, len(dll_rows)))
        report.field("qt module", "yes" if QT_MODULE_HINT.match(module) else "not recognised as a Qt module")
    if def_rows:
        forwarded_count = sum(1 for row in def_rows if row["target"])
        report.field("proxy def", "{} exports, {} of them forwarded".format(len(def_rows), forwarded_count))
    if need_rows:
        report.field("required", "{} names from the import list".format(len(need_rows)))
    report.field("checked", len(state["required"]))
    report.field("data-only note", "a name can be a data export; a proxy must forward it as DATA or by ordinal")

    report.heading("missing forwarders (fatal)")
    if state["missing"]:
        report.table(
            ["name", "ordinal in original"],
            [[name, state["reference"].get(name, {}).get("ordinal", "-")] for name in state["missing"]],
        )
        report.line("")
        report.line("each of these aborts the load before your code runs.")
    else:
        report.line("none - every required name is forwarded or declared by ordinal")

    if dll_rows and def_rows:
        report.heading("stale forwarders (harmless)")
        if state["stale"]:
            report.table(["name"], [[name] for name in state["stale"]])
        else:
            report.line("none")

        report.heading("ordinal drift")
        if state["ordinal_drift"]:
            report.table(["name", "original", "proxy"], state["ordinal_drift"])
            report.line("")
            report.line("drift only matters for import-by-ordinal callers; name-importing hosts ignore it.")
        else:
            report.line("none")

        report.heading("renamed forwards")
        if state["renamed"]:
            report.table(["declared as", "forwards to"], state["renamed"])
            report.line("")
            report.line("a rename is fine as long as the *declared* name is what the host imports.")
        else:
            report.line("none")

    report.heading("Qt plugin entry points")
    report.table(["symbol", "original", "proxy", "status"], qt_rows(state))

    report.heading("verdict")
    fatal = bool(state["missing"])
    if fatal:
        report.line("FAIL: the proxy is not loadable yet - forward the missing names first.")
    elif def_rows and not state["stale"] and not state["ordinal_drift"]:
        report.line("PASS: the export surface matches; the remaining risk is behaviour, not loading.")
    else:
        report.line("LOADABLE: no missing name, but review the stale and drifted rows above.")
    report.line("")
    report.line("load-order reminder: a proxy only helps if it is found before the original;")
    report.line("same directory as the host executable, and no absolute path in the import table.")

    report.emit()
    return cli.EXIT_FAIL if fatal else cli.EXIT_OK


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]
    names = ["qt_plugin_instance", "qt_plugin_query_metadata", "core_helper", "helper_two"]
    with fixtures.Workspace() as workspace:
        dll = workspace.write(
            "qtdemo.dll", fixtures.synthetic_pe_exports(names, module="qtdemo.dll", forwarded=("core_helper",))
        )
        image = pe.read(dll)
        rows = image.exports()
        results.append(len(rows) == 4 and rows[0]["module"] == "qtdemo.dll")
        results.append(rows[2]["forwarder"] == "OTHERDLL.core_helper")

        def_text = "\n".join(
            [
                "LIBRARY proxy.dll",
                "EXPORTS",
                "    qt_plugin_instance=REAL.qt_plugin_instance @1",
                "    qt_plugin_query_metadata=REAL.qt_plugin_query_metadata @2",
                "    core_helper=REAL.core_helper @3",
                "    removed_export=REAL.removed_export @9 ; stale",
            ]
        )
        parsed = parse_def(def_text)
        results.append(len(parsed) == 4 and parsed[0]["name"] == "qt_plugin_instance")
        results.append(parsed[0]["ordinal"] == 1)
        results.append(forwarded_name(parsed[0]) == "qt_plugin_instance")

        required = names + ["helper_absent"]
        state = detect_and_rank(rows, parsed, required)
        results.append(state["missing"] == ["helper_two", "helper_absent"])
        results.append(state["stale"] == ["removed_export"])
        results.append(len(state["renamed"]) == 0)
        results.append(state["ordinal_drift"] == [])

        drifted = parse_def("EXPORTS\n    core_helper=REAL.core_helper @7\n")
        state2 = detect_and_rank(rows, drifted, names)
        results.append(state2["ordinal_drift"] and state2["ordinal_drift"][0][:3] == ["core_helper", 3, 7])

        renamed = parse_def("EXPORTS\n    core_helper=REAL.other_helper\n")
        state3 = detect_and_rank(rows, renamed, ["core_helper"])
        results.append(len(state3["renamed"]) == 1 and state3["renamed"][0][1] == "other_helper")

        qt = qt_rows(state)
        results.append(qt[0][3] == "forwarded" and qt[3][3] == "absent in both")

        # ordinal-only forwarding resolves through the original's ordinal
        ordinal_def = parse_def("EXPORTS\n    #3=REAL.#3\n")
        state4 = detect_and_rank(rows, ordinal_def, ["core_helper"])
        results.append(state4["missing"] == [])

        continuation = parse_def("EXPORTS\n    one=REAL.one \\\n    @1\n")
        results.append(len(continuation) == 1 and continuation[0]["ordinal"] == 1)

    passed = sum(1 for item in results if item)
    sys.stdout.write("\nqt_export_diff self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


FLAGS = ()
VALUES = ("dll", "def", "need")


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test, FLAGS, VALUES))
