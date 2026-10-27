#!/usr/bin/env python3
"""Signature chain: read the order the page signs a request in, from its source.

A signed request is built by a chain, and the chain is the finding: which fields
go in, in what order, with which secret, through which digest, and where the
result is attached. Reading a minified bundle for "the signing function" without
that order produces a signature that is correct in isolation and rejected by the
server, which is the most expensive way to be nearly right.

Six stages, four of them positional:

| stage        | positional | evidence                                            |
| ------------ | ---------- | --------------------------------------------------- |
| collect      | yes        | Object.keys, URLSearchParams, the params object     |
| order        | yes        | .sort(), join('&'), qs.stringify, encodeURIComponent |
| secret       | no         | a hex or base64 constant of key length              |
| digest       | yes        | md5 / sha1 / sha256 / hmac / createHash / subtle     |
| attach       | yes        | x-sign, signature, authorization, the sign header   |
| replay-guard | no         | nonce, timestamp, Date.now()                        |

Only the positional stages are ordered in the source: a constant is declared
wherever the bundler felt like it and a nonce is payload, not a step. The tool
prints whether the four positional stages already ascend - if they do, the chain
can be read instead of guessed - and the field names visible in the ordering
region, because the set of fields inside the signature is the actual security
boundary, not the algorithm.

usage:
    python3 sign_chain_scan.py --sample app.min.js
    python3 sign_chain_scan.py --sample a.js,b.js --query x-sign
    python3 sign_chain_scan.py --self-test
"""

import os
import re
import sys

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli, fixtures  # noqa: E402

# Tokens, not regular expressions, for everything that can be matched literally:
# a token list is auditable, and an operator can extend it for a bespoke SDK.
STAGES = (
    ("collect", True, ("object.keys", "urlsearchparams", "new map(", "object.entries", "params", "payload")),
    ("order", True, (".sort(", "join('&')", 'join("&")', "qs.stringify", "encodeuricomponent", "urlencode")),
    ("secret", False, ()),
    ("digest", True, ("md5", "sha1", "sha256", "hmac", "createhash", "createhmac", "subtledigest", "cryptojs", "digest(")),
    ("attach", True, ("x-sign", "x_sign", "x-signature", "signature", "authorization", '"sign"', "'sign'")),
    ("replay-guard", False, ("nonce", "timestamp", "date.now()", "math.random")),
)

SECRET_PATTERNS = (
    ("hex", re.compile(r"\b[0-9a-fA-F]{16,}\b")),
    ("base64", re.compile(r"\b[A-Za-z0-9+/]{20,}={0,2}")),
)

FIELD_PATTERN = re.compile(r"[\"']([a-z][a-z0-9_]{1,20})[\"']")

STOP_FIELDS = frozenset(
    (
        "string",
        "object",
        "number",
        "function",
        "undefined",
        "boolean",
        "text",
        "json",
        "get",
        "post",
        "then",
        "catch",
        "length",
        "prototype",
    )
)


def read_text(path):
    with open(path, "rb") as handle:
        return handle.read().decode("utf-8", "replace")


def find_tokens(lowered, tokens):
    hits = []
    for token in tokens:
        at = lowered.find(token)
        while at >= 0:
            hits.append({"token": token, "offset": at})
            at = lowered.find(token, at + 1)
            if len(hits) > 200:
                break
    hits.sort(key=lambda row: row["offset"])
    return hits


def secret_candidates(text):
    out = []
    for kind, pattern in SECRET_PATTERNS:
        for match in pattern.finditer(text):
            value = match.group(0)
            if value.isdigit():
                continue
            out.append({"kind": kind, "offset": match.start(), "length": len(value), "value": value[:6] + "..."})
    out.sort(key=lambda row: row["offset"])
    return out[:20]


def field_names(text, offset, window=600):
    """Field-like string literals around the ordering call, deduplicated."""
    names = []
    region = text[max(0, offset - window) : offset + window]
    for match in FIELD_PATTERN.finditer(region):
        name = match.group(1)
        if name in STOP_FIELDS or name in names:
            continue
        names.append(name)
        if len(names) >= 12:
            break
    return names


def scan(path, query=None):
    text = read_text(path)
    lowered = text.lower()
    secrets = secret_candidates(text)

    rows = []
    for name, positional, tokens in STAGES:
        if name == "secret":
            rows.append(
                {
                    "stage": name,
                    "positional": positional,
                    "present": bool(secrets),
                    "count": len(secrets),
                    "first": secrets[0]["offset"] if secrets else None,
                    "evidence": ", ".join(row["kind"] for row in secrets[:3]) if secrets else "-",
                }
            )
            continue
        if name == "attach" and query:
            tokens = tokens + (query.lower(),)
        hits = find_tokens(lowered, tokens)
        rows.append(
            {
                "stage": name,
                "positional": positional,
                "present": bool(hits),
                "count": len(hits),
                "first": hits[0]["offset"] if hits else None,
                "evidence": ", ".join(row["token"] for row in hits[:3]) if hits else "-",
            }
        )

    positional = [row for row in rows if row["positional"] and row["present"]]
    offsets = [row["first"] for row in positional]
    order_stage = next((row for row in rows if row["stage"] == "order" and row["present"]), None)
    return {
        "path": path,
        "bytes": len(text),
        "stages": rows,
        "present": [row["stage"] for row in rows if row["present"]],
        "missing": [row["stage"] for row in rows if not row["present"]],
        "ascending": offsets == sorted(offsets),
        "fields": field_names(text, order_stage["first"]) if order_stage else [],
        "secrets": secrets,
    }


def reading(result):
    lines = []
    if not result["present"]:
        lines.append("No stage matched: the bundle may be encrypted, or the signing is done by a fetched module.")
        return lines
    if result["ascending"]:
        lines.append("The four positional stages already appear in signing order: the chain can be read, not guessed.")
    else:
        lines.append("The positional stages are out of order in the source: bundlers inline helpers, so confirm the")
        lines.append("call order at a breakpoint before trusting the sequence.")
    if "digest" in result["missing"]:
        lines.append("No digest token found: the work is in a WebAssembly module, or the client fetches the signature.")
    if "secret" in result["missing"]:
        lines.append("No key-length constant found: the secret arrives at run time - trace the response carrying it.")
    if result["fields"]:
        lines.append("Fields inside the ordering region: " + ", ".join(result["fields"][:8]) + ".")
        lines.append("That set is the boundary: a field the client signs cannot be changed without recomputing.")
    lines.append("Replay the same input through the recovered function before sending anything to the server.")
    return lines


def render_report(result, query=None):
    report = cli.Report("signature chain")
    report.field("sample", result["path"])
    report.field("bytes", result["bytes"])
    if query:
        report.field("header query", query)

    report.heading("stages")
    report.table(
        ["stage", "positional", "present", "hits", "first offset", "evidence"],
        [
            [
                row["stage"],
                "yes" if row["positional"] else "no",
                "yes" if row["present"] else "no",
                row["count"],
                "0x{:X}".format(row["first"]) if row["first"] is not None else "-",
                row["evidence"][:44],
            ]
            for row in result["stages"]
        ],
    )

    report.heading("source order")
    report.line(
        "positional stages ascend in signing order"
        if result["ascending"]
        else "positional stages differ from the signing order"
    )

    report.heading("candidate fields")
    if result["fields"]:
        report.table(["field"], [[name] for name in result["fields"]])
    else:
        report.line("none - no ordering region to read field names from")

    report.heading("reading")
    report.line("{} of {} stages present".format(len(result["present"]), len(result["stages"])))
    if result["missing"]:
        report.line("missing: " + ", ".join(result["missing"]))
    for line in reading(result):
        report.line(line)
    return report


def main(options):
    cli.require(options, "sample")
    query = options.get("query")
    for path in [part.strip() for part in options["sample"].split(",") if part.strip()]:
        render_report(scan(path, query=query), query=query).emit()
    return cli.EXIT_OK


FULL_SAMPLE = """
function sign(a) {
  var q = Object.keys(a).sort().map(function (k) { return k + "=" + a[k]; }).join("&");
  return md5(q + SECRET);
}
var SECRET = "9f2c1e7a4b8d3f6051c2a9e4b7d0f386";
function call(p) {
  var q = { page: p, ts: Date.now(), nonce: Math.random() };
  return fetch("/api/v1/list", { headers: { "x-sign": sign(q), "timestamp": q.ts, "nonce": q.nonce } });
}
"""

THIN_SAMPLE = """
function call(p) {
  return fetch("/api/v1/list", { headers: { "x-sign": p } });
}
"""


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]

    with fixtures.Workspace() as workspace:
        full = workspace.write("full.js", FULL_SAMPLE.encode("utf-8"))
        thin = workspace.write("thin.js", THIN_SAMPLE.encode("utf-8"))

        full_result = scan(full)
        thin_result = scan(thin)

        results.append({"collect", "order", "digest", "attach"} <= set(full_result["present"]))
        results.append({"secret", "replay-guard"} <= set(full_result["present"]))
        results.append(full_result["ascending"])
        results.append(any(name in full_result["fields"] for name in ("page", "ts", "nonce")))
        results.append("digest" in thin_result["missing"] and "secret" in thin_result["missing"])
        results.append(not thin_result["ascending"] or len(thin_result["present"]) <= 1)

        rendered = "\n".join(render_report(full_result).lines)
        results.append("| stage" in rendered and "ascend in signing order" in rendered)

    passed = sum(1 for item in results if item)
    sys.stdout.write("\nsign_chain_scan self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


FLAGS = ()
VALUES = ("sample", "query")


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test, FLAGS, VALUES))
