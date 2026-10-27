#!/usr/bin/env python3
"""Pinning surface: enumerate the layers a package actually declares.

Android pins in five places and they stack. The expensive mistake is not "the
bypass did not work", it is instrumenting one layer, watching nothing change,
and reporting a bypass that never happened. So this tool refuses to instrument
anything: it reads the package and prints which of the five layers are present,
with the string or entry that shows it.

| layer                  | what the package contains                              |
| ---------------------- | ------------------------------------------------------ |
| network-security-config| res/xml/...network_security... or the manifest attribute |
| okhttp-pinner          | CertificatePinner, pin-sha256, okhttp TLS internals    |
| custom-trust-manager   | X509TrustManager, checkServerTrusted, TrustManagerImpl |
| bundled-certificate    | a .cer/.pem/.crt/.p12/.bks under assets/ or res/       |
| native-pinning         | a lib/<abi>/*.so next to BoringSSL verify symbols      |

The symptom table it prints is the part that makes the next step a decision
rather than a guess: each layer fails differently, and the failure mode names
the layer.

usage:
    python3 pin_surface.py --sample app.apk
    python3 pin_surface.py --sample a.apk,b.apk
    python3 pin_surface.py --self-test
"""

import io
import os
import sys
import zipfile

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli, dex, fixtures  # noqa: E402

# layer -> (strings that prove it, zip entry rules that prove it)
LAYER_STRINGS = {
    "network-security-config": ("networksecurityconfig", "network_security_config", "pin-set", "trust-anchors"),
    "okhttp-pinner": ("certificatepinner", "pin-sha256", "okhttp3/internal/tls", "okhttp3/certificatepinner"),
    "custom-trust-manager": ("x509trustmanager", "checkservertrusted", "trustmanagerimpl", "x509extendedtrustmanager"),
    "bundled-certificate": (".cer", ".pem", ".crt", ".p12", ".bks"),
    "native-pinning": ("ssl_ctx_set_verify", "x509_verify_cert", "ssl_verify_cert", "ssl_verify_client_post_handshake"),
}

CERT_SUFFIXES = (".cer", ".pem", ".crt", ".p12", ".bks")

# The symptom each layer produces, quoted from the method document so the two
# cannot drift apart silently.
SYMPTOMS = {
    "network-security-config": "fails before any application code runs; removing the pin set changes the result",
    "okhttp-pinner": "throws with the host in the message; the chain itself is trusted",
    "custom-trust-manager": "accepts any certificate, then a later comparison rejects the session",
    "bundled-certificate": "the trust anchor is packaged, so the store you edited is not the one in use",
    "native-pinning": "no Java pinning frames at all in the stack; the comparison happens in the library",
}


def build_apk(dex_strings=None, extra=None):
    """A zip shaped like an APK: one classes.dex plus optional resources."""
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("classes.dex", fixtures.synthetic_dex(dex_strings))
        for name, data in (extra or {}).items():
            archive.writestr(name, data)
    return buffer.getvalue()


def entry_rows(path):
    rows = []
    with zipfile.ZipFile(path) as archive:
        for info in archive.infolist():
            rows.append({"name": info.filename, "size": info.file_size})
    return rows


def string_hits(path, hints):
    hits = []
    for entry in dex.read(path):
        for hint in hints:
            for row in entry.find_strings(hint, limit=4):
                hits.append({"text": row["text"], "hint": hint})
    seen = set()
    unique = []
    for row in hits:
        if row["text"] in seen:
            continue
        seen.add(row["text"])
        unique.append(row)
    return unique


def layers(path, entries):
    """One row per layer: present or not, and the evidence either way."""
    out = []
    for name in LAYER_STRINGS:
        hints = LAYER_STRINGS[name]
        strings = string_hits(path, hints)

        matching_entries = []
        for row in entries:
            lowered = row["name"].lower()
            if name == "bundled-certificate":
                if lowered.endswith(CERT_SUFFIXES) and (lowered.startswith("assets/") or lowered.startswith("res/")):
                    matching_entries.append(row["name"])
            elif name == "network-security-config":
                if lowered.startswith("res/xml/") and "network_security" in lowered:
                    matching_entries.append(row["name"])
            elif name == "native-pinning":
                if lowered.startswith("lib/") and lowered.endswith(".so"):
                    matching_entries.append(row["name"])

        present = bool(strings or matching_entries)
        evidence = []
        if matching_entries:
            evidence.append("entry " + ", ".join(matching_entries[:3]))
        if strings:
            evidence.append("string " + ", ".join(row["text"][:48] for row in strings[:3]))

        out.append(
            {
                "layer": name,
                "present": present,
                "evidence": "; ".join(evidence) if evidence else "-",
                "strings": len(strings),
                "entries": len(matching_entries),
                "symptom": SYMPTOMS[name],
            }
        )
    return out


def analyse(path):
    entries = entry_rows(path)
    rows = layers(path, entries)
    present = [row for row in rows if row["present"]]
    java_layer = any(row["present"] for row in present if row["layer"] != "native-pinning")
    return {
        "entries": entries,
        "layers": rows,
        "present": present,
        "java_layer": java_layer,
        "verdict": verdict(rows, present, java_layer),
    }


def verdict(rows, present, java_layer):
    if not present:
        return "none declared"
    if len(present) >= 3:
        return "stacked - expect to clear more than one layer"
    if len(present) == 1:
        return "single layer - " + present[0]["layer"]
    return "two layers"


def reading(result):
    lines = []
    names = [row["layer"] for row in result["present"]]
    if not names:
        lines.append("No pinning layer is declared in the package: look at the client certificate, the mTLS policy")
        lines.append("or the endpoint allowlist before blaming pinning.")
    else:
        lines.append("Declared layers: " + ", ".join(names) + ".")
        lines.append("Record the baseline refusal with the app unmodified first; one request, one difference.")
    native = [row for row in result["layers"] if row["layer"] == "native-pinning" and row["present"]]
    if native and not result["java_layer"]:
        lines.append("Nothing in Java pins, yet a native library is present: this is the 'handshake fails and no frames' case.")
    lines.append("Pinning is a control, not a finding: what it protects is what the report is about.")
    return lines


def render_report(path, result):
    report = cli.Report("pinning surface")
    report.field("sample", path)
    report.field("zip entries", len(result["entries"]))

    report.heading("layers")
    report.table(
        ["layer", "present", "evidence"],
        [[row["layer"], "yes" if row["present"] else "no", row["evidence"][:80]] for row in result["layers"]],
    )

    report.heading("symptom per layer")
    report.table(
        ["layer", "how it fails"],
        [[row["layer"], row["symptom"]] for row in result["layers"]],
    )

    report.heading("verdict")
    report.line(result["verdict"])
    for line in reading(result):
        report.line(line)
    return report


def main(options):
    cli.require(options, "sample")
    for path in [part.strip() for part in options["sample"].split(",") if part.strip()]:
        render_report(path, analyse(path)).emit()
    return cli.EXIT_OK


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]

    with fixtures.Workspace() as workspace:
        bare = workspace.write("bare.apk", build_apk(["Lcom/demo/Gate;", "isLicensed"]))
        okhttp = workspace.write("okhttp.apk", build_apk(["Lcom/demo/Gate;", "okhttp3/CertificatePinner", "pin-sha256"]))
        trust = workspace.write("trust.apk", build_apk(["Lcom/demo/Gate;", "X509TrustManager", "checkServerTrusted"]))
        stacked = workspace.write(
            "stacked.apk",
            build_apk(
                ["Lcom/demo/Gate;", "okhttp3/CertificatePinner", "X509TrustManager", "network_security_config"],
                extra={
                    "res/xml/network_security_config.xml": b"<network-security-config/>",
                    "assets/backend.cer": b"0" * 64,
                    "lib/arm64-v8a/libshield.so": b"\x7fELF" + b"\x00" * 60,
                },
            ),
        )

        bare_result = analyse(bare)
        okhttp_result = analyse(okhttp)
        trust_result = analyse(trust)
        stacked_result = analyse(stacked)

        names = lambda result: [row["layer"] for row in result["present"]]  # noqa: E731 - local predicate
        results.append(bare_result["present"] == [])
        results.append(names(okhttp_result) == ["okhttp-pinner"])
        results.append("custom-trust-manager" in names(trust_result))
        results.append(set(names(stacked_result)) == {
            "network-security-config",
            "okhttp-pinner",
            "custom-trust-manager",
            "bundled-certificate",
            "native-pinning",
        })
        results.append(len(stacked_result["layers"]) == 5)

        rendered = "\n".join(render_report("stacked.apk", stacked_result).lines)
        results.append("| layer" in rendered and "stacked" in rendered)

    passed = sum(1 for item in results if item)
    sys.stdout.write("\npin_surface self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


FLAGS = ()
VALUES = ("sample",)


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test, FLAGS, VALUES))
