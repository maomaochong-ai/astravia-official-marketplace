#!/usr/bin/env python3
"""Java agent manifest: is this JAR actually an agent, and what does it load?

A Java agent is not a library. The JVM reads ``META-INF/MANIFEST.MF``, finds
``Premain-Class`` (or ``Agent-Class``), loads that class, and calls ``premain``
before ``main`` runs. Every one of those steps is a place where a broken agent
fails *silently* - a wrong manifest attribute just means "not an agent", and a
missing ``premain`` means the class loads and nothing is instrumented.

So this tool checks the two things that decide whether the paste worked:

1. manifest attributes, including the 72-byte line continuation rule that
   quietly truncates hand-edited values;
2. that the declared class exists in the JAR and actually declares ``premain``
   with the descriptor ``(Ljava/lang/String;Ljava/lang/Instrumentation;)V``.

It also reads ``Boot-Class-Path``, because that attribute is a load-path entry
the JVM appends to the bootstrap class path - which is how an agent gets a DLL
loaded from a directory the operator may not control.

usage:
    python3 jar_agent_audit.py --jar agent.jar
    python3 jar_agent_audit.py --jar agent.jar --class com.example.Agent
    python3 jar_agent_audit.py --self-test
"""

import io
import os
import struct
import sys
import zipfile

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli  # noqa: E402

MANIFEST = "META-INF/MANIFEST.MF"
PREMAIN_DESCRIPTOR = "(Ljava/lang/String;Ljava/lang/Instrumentation;)V"
AGENTMAIN_DESCRIPTOR = "(Ljava/lang/String;)V"
CLASS_MAGIC = b"\xCA\xFE\xBA\xBE"

WANTED = (
    "Premain-Class",
    "Agent-Class",
    "Launcher-Agent-Class",
    "Boot-Class-Path",
    "Can-Redefine-Classes",
    "Can-Retransform-Classes",
    "Can-Set-Native-Method-Prefix",
)


class JarError(Exception):
    pass


def parse_manifest(text):
    """Parse MANIFEST.MF with the continuation rule: a leading space continues.

    This is the rule that bites: a value wrapped at 72 bytes has the following
    line start with a single space, and the space is *not* part of the value.
    Hand-edited manifests usually drop the space and silently split the value.
    """
    entries = {}
    order = []
    key = None
    value = []
    for raw in text.splitlines():
        if not raw.strip():
            if key is not None:
                entries[key] = "".join(value)
                key = None
                value = []
            continue
        if raw.startswith(" "):
            if key is None:
                raise JarError("continuation line without a preceding attribute")
            value.append(raw[1:])
            continue
        if key is not None:
            entries[key] = "".join(value)
        name, separator, rest = raw.partition(":")
        if not separator:
            raise JarError("malformed manifest line: " + raw[:40])
        key = name.strip()
        value = [rest.lstrip()]
        order.append(key)
    if key is not None:
        entries[key] = "".join(value)
    return entries


def read_class(data):
    """Return {'name', 'methods': [...], 'super'} from a class file.

    Only the constant pool and the method table are decoded: enough to answer
    "does this class declare premain with the right descriptor", not enough to
    decompile anything.
    """
    if data[:4] != CLASS_MAGIC:
        raise JarError("not a class file (bad magic)")
    offset = 8
    count = struct.unpack_from(">H", data, offset)[0]
    offset += 2
    index = 1
    utf8 = {}
    class_names = {}
    while index < count:
        tag = data[offset]
        offset += 1
        if tag == 1:
            length = struct.unpack_from(">H", data, offset)[0]
            offset += 2
            utf8[index] = data[offset : offset + length].decode("utf-8", "replace")
            offset += length
        elif tag == 7:
            class_names[index] = struct.unpack_from(">H", data, offset)[0]
            offset += 2
        elif tag in (8, 16, 19, 20):
            offset += 2
        elif tag in (15,):
            offset += 3
        elif tag in (3, 4, 9, 10, 11, 12, 17, 18):
            offset += 4
        elif tag in (5, 6):
            offset += 8
            index += 1
        else:
            raise JarError("unknown constant pool tag {} at {}".format(tag, offset - 1))
        index += 1

    offset += 2  # access flags
    this_class = struct.unpack_from(">H", data, offset)[0]
    offset += 2
    super_class = struct.unpack_from(">H", data, offset)[0]
    offset += 2
    name = utf8.get(class_names.get(this_class, 0), "<unknown>")
    super_name = utf8.get(class_names.get(super_class, 0), "<none>") if super_class else "<none>"

    interfaces = struct.unpack_from(">H", data, offset)[0]
    offset += 2 + interfaces * 2
    fields = struct.unpack_from(">H", data, offset)[0]
    offset += 2
    for _ in range(fields):
        offset += 6
        attributes = struct.unpack_from(">H", data, offset)[0]
        offset += 2
        for _ in range(attributes):
            length = struct.unpack_from(">I", data, offset + 2)[0]
            offset += 6 + length

    methods = []
    method_count = struct.unpack_from(">H", data, offset)[0]
    offset += 2
    for _ in range(method_count):
        _flags, name_index, descriptor_index = struct.unpack_from(">HHH", data, offset)
        offset += 6
        attribute_count = struct.unpack_from(">H", data, offset)[0]
        offset += 2
        for _ in range(attribute_count):
            length = struct.unpack_from(">I", data, offset + 2)[0]
            offset += 6 + length
        methods.append(
            {
                "name": utf8.get(name_index, "<unknown>"),
                "descriptor": utf8.get(descriptor_index, "<unknown>"),
            }
        )
    return {"name": name.replace("/", "."), "super": super_name.replace("/", "."), "methods": methods}


def class_entry_for(class_name):
    return class_name.replace(".", "/") + ".class"


def audit(archive, class_name=None):
    names = archive.namelist()
    report = {"entries": len(names), "classes": sum(1 for name in names if name.endswith(".class"))}

    if MANIFEST in names:
        manifest_text = archive.read(MANIFEST).decode("utf-8", "replace")
        report["manifest"] = parse_manifest(manifest_text)
        report["manifest_raw_bytes"] = len(archive.read(MANIFEST))
    else:
        report["manifest"] = {}
        report["manifest_raw_bytes"] = 0

    attributes = report["manifest"]
    declared = {}
    for key in WANTED:
        if key in attributes:
            declared[key] = attributes[key]
    report["declared"] = declared

    candidates = []
    for key in ("Premain-Class", "Agent-Class", "Launcher-Agent-Class"):
        if key in attributes:
            candidates.append((key, attributes[key].strip()))
    if class_name:
        candidates.append(("--class", class_name))
    report["candidates"] = candidates

    inspected = []
    for source, name in candidates:
        entry = class_entry_for(name)
        row = {"source": source, "class": name, "entry": entry, "present": entry in names}
        if row["present"]:
            parsed = read_class(archive.read(entry))
            row["declared_name"] = parsed["name"]
            row["super"] = parsed["super"]
            row["name_matches"] = parsed["name"] == name
            row["premain"] = [item for item in parsed["methods"] if item["name"] == "premain"]
            row["agentmain"] = [item for item in parsed["methods"] if item["name"] == "agentmain"]
            row["has_premain"] = any(item["descriptor"] == PREMAIN_DESCRIPTOR for item in row["premain"])
            row["has_agentmain"] = any(item["descriptor"] == AGENTMAIN_DESCRIPTOR for item in row["agentmain"])
            row["method_count"] = len(parsed["methods"])
        inspected.append(row)
    report["inspected"] = inspected

    boot = attributes.get("Boot-Class-Path", "").strip()
    report["boot"] = [part.strip() for part in boot.split() if part.strip()] if boot else []
    report["boot_outside"] = [part for part in report["boot"] if part.startswith(("/", "\\")) or ".." in part or part.lower().endswith((".dll", ".so", ".dylib", ".jar"))]
    return report


def render(report, path):
    out = cli.Report("java agent audit")
    out.field("jar", path)
    out.field("entries", report["entries"])
    out.field("class files", report["classes"])
    out.field("manifest", "{} bytes".format(report["manifest_raw_bytes"]) if report["manifest_raw_bytes"] else "absent")

    out.heading("agent attributes")
    if report["declared"]:
        out.table(["attribute", "value"], [[key, value] for key, value in report["declared"].items()])
    else:
        out.line("none - no Premain-Class, Agent-Class or Launcher-Agent-Class")
        out.line("the JVM will treat this JAR as a plain library; -javaagent is accepted and ignored.")

    out.heading("declared class")
    if not report["inspected"]:
        out.line("nothing to inspect: no class was declared and none was given")
    else:
        for row in report["inspected"]:
            out.bullet("{} -> {} ({})".format(row["source"], row["class"], row["entry"]))
            if not row["present"]:
                out.line("    ! the entry is not in the JAR - the agent will fail with ClassNotFoundException")
                continue
            if not row.get("name_matches", True):
                out.line("    ! the class file declares {} but the manifest names {}".format(row["declared_name"], row["class"]))
            out.line("    superclass: {}, methods: {}".format(row.get("super", "?"), row.get("method_count", "?")))
            if row.get("has_premain"):
                out.line("    premain{}: present".format(PREMAIN_DESCRIPTOR))
            elif row.get("premain"):
                out.line("    premain: present but with the wrong descriptor - {}".format(row["premain"][0]["descriptor"]))
            else:
                out.line("    premain: absent - the JVM starts, nothing is instrumented")

    out.heading("bootstrap load path")
    if report["boot"]:
        out.table(["entry", "note"], [[part, "outside the JAR" if part in report["boot_outside"] else "inside or relative"] for part in report["boot"]])
        if report["boot_outside"]:
            out.line("")
            out.line("Boot-Class-Path is appended to the bootstrap class path. An absolute path")
            out.line("or a native library here is a DLL side-load: the JVM loads it before the app.")
    else:
        out.line("none")

    out.heading("verdict")
    active = [row for row in report["inspected"] if row["present"] and row.get("has_premain")]
    if active:
        out.line("this JAR is an agent, and the declared class really implements premain.")
    elif report["inspected"]:
        out.line("the manifest points at a class that will not start the agent; check the rows above.")
    else:
        out.line("not an agent JAR.")
    out.emit()


def main(options):
    cli.require(options, "jar")
    path = options["jar"]
    with zipfile.ZipFile(path) as archive:
        report = audit(archive, options.get("class"))
    render(report, path)
    return cli.EXIT_OK


# --------------------------------------------------------------------------
# fixtures
# --------------------------------------------------------------------------


def _class_bytes(class_name, methods):
    """Build a minimal but well-formed class file with the given methods."""
    utf8 = []
    methods = list(methods)

    def add(text):
        utf8.append(text)
        return None

    constant_pool = []
    index_of = {}

    def pool(text):
        if text in index_of:
            return index_of[text]
        index_of[text] = len(constant_pool) + 1
        constant_pool.append((1, text))
        return index_of[text]

    this_name = pool(class_name.replace(".", "/"))
    super_name = pool("java/lang/Object")
    code_name = pool("Code")
    method_refs = []
    for name, descriptor in methods:
        method_refs.append((pool(name), pool(descriptor)))

    class_ref = len(constant_pool) + 1
    constant_pool.append((7, this_name))
    super_ref = len(constant_pool) + 1
    constant_pool.append((7, super_name))

    body = bytearray()
    body += CLASS_MAGIC + struct.pack(">HH", 0, 52)
    body += struct.pack(">H", len(constant_pool) + 1)
    for entry in constant_pool:
        if entry[0] == 1:
            raw = entry[1].encode("utf-8")
            body += b"\x01" + struct.pack(">H", len(raw)) + raw
        else:
            body += b"\x07" + struct.pack(">H", entry[1])
    body += struct.pack(">HHH", 0x0021, class_ref, super_ref)
    body += struct.pack(">H", 0)  # interfaces
    body += struct.pack(">H", 0)  # fields
    body += struct.pack(">H", len(method_refs))
    for name_index, descriptor_index in method_refs:
        body += struct.pack(">HHH", 0x0009, name_index, descriptor_index)
        body += struct.pack(">H", 1)
        # Code attribute info: max_stack(2) + max_locals(2) + code_length(4) +
        # code(1) + exception_table_length(2) + attributes_count(2) = 13 bytes.
        body += struct.pack(">HI", code_name, 13)
        body += struct.pack(">H", 0)  # max_stack
        body += struct.pack(">H", 1)  # max_locals
        body += struct.pack(">I", 1)  # code_length
        body += b"\xb1"  # return
        body += struct.pack(">HH", 0, 0)  # exception table, attributes
    body += struct.pack(">H", 0)  # class attributes
    return bytes(body)


def build_jar(class_name="com.example.Agent", manifest=None, with_premain=True):
    """A JAR that is a real agent unless told otherwise.

    ``manifest=None`` writes the manifest a working agent needs; pass a string
    to control the attributes exactly, or an empty string for a library JAR.
    """
    if manifest is None:
        manifest = (
            "Manifest-Version: 1.0\r\nPremain-Class: {}\r\nCan-Redefine-Classes: true\r\n".format(class_name)
        )
    buffer = io.BytesIO()
    methods = []
    if with_premain:
        methods.append(("premain", PREMAIN_DESCRIPTOR))
    methods.append(("run", "()V"))
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(MANIFEST, manifest)
        archive.writestr(class_entry_for(class_name), _class_bytes(class_name, methods))
        archive.writestr("com/example/Helper.class", _class_bytes("com.example.Helper", [("run", "()V")]))
    return buffer.getvalue()


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]

    # continuation rule: a value wrapped with a leading space is one value
    text = "Manifest-Version: 1.0\r\nPremain-Class: com.example.\r\n Agent\r\nAgent-Class: com.example.Agent\r\n"
    entries = parse_manifest(text)
    results.append(entries["Premain-Class"] == "com.example.Agent")
    results.append(entries["Agent-Class"] == "com.example.Agent")

    # a good agent jar
    good = build_jar()
    with zipfile.ZipFile(io.BytesIO(good)) as archive:
        report = audit(archive)
    results.append(report["declared"].get("Premain-Class") == "com.example.Agent")
    row = report["inspected"][0]
    results.append(row["present"] and row["has_premain"] and row["name_matches"])

    # the same jar without premain: the silent failure
    silent = build_jar(with_premain=False)
    with zipfile.ZipFile(io.BytesIO(silent)) as archive:
        report2 = audit(archive)
    results.append(report2["inspected"][0]["present"] and not report2["inspected"][0]["has_premain"])

    # a manifest pointing at a class that is not in the jar
    ghost = build_jar(manifest="Manifest-Version: 1.0\r\nPremain-Class: com.example.Ghost\r\n")
    with zipfile.ZipFile(io.BytesIO(ghost)) as archive:
        report3 = audit(archive)
    results.append(not report3["inspected"][0]["present"])

    # Boot-Class-Path pointing outside the jar
    boot = build_jar(
        manifest="Manifest-Version: 1.0\r\nPremain-Class: com.example.Agent\r\nBoot-Class-Path: C:\\hook\\helper.dll native/agent.dll\r\n"
    )
    with zipfile.ZipFile(io.BytesIO(boot)) as archive:
        report4 = audit(archive)
    results.append(len(report4["boot"]) == 2)
    results.append(len(report4["boot_outside"]) == 2)

    # a library jar: no agent attributes at all
    with zipfile.ZipFile(io.BytesIO(build_jar(manifest="Manifest-Version: 1.0\r\n"))) as archive:
        report5 = audit(archive)
    results.append(report5["declared"] == {})
    results.append(report5["candidates"] == [])

    # the WrongDescriptor case: premain with the wrong signature must not pass
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr(MANIFEST, "Manifest-Version: 1.0\r\nPremain-Class: com.example.Agent\r\n")
        archive.writestr(
            class_entry_for("com.example.Agent"),
            _class_bytes("com.example.Agent", [("premain", "(Ljava/lang/String;)V")]),
        )
    with zipfile.ZipFile(io.BytesIO(buffer.getvalue())) as archive:
        report6 = audit(archive)
    results.append(report6["inspected"][0]["premain"] and not report6["inspected"][0]["has_premain"])

    passed = sum(1 for item in results if item)
    sys.stdout.write("\njar_agent_audit self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


FLAGS = ()
VALUES = ("jar", "class")


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test, FLAGS, VALUES))
