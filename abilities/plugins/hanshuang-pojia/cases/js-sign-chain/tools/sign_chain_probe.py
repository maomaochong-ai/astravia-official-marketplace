#!/usr/bin/env python3
"""Signature chain probe: which concatenation, which hash, which secret order?

Front-end signature schemes are not secret; they are undocumented. The bundle
contains a string join and a hash call, and the work is to find *which* join. So
this tool does not crack anything: given one captured request, the parameters
that were signed, a candidate secret, and the observed signature, it enumerates
the constructions that actually appear in shipped bundles and reports which one
reproduces the observed value.

Enumerated constructions:

* keys sorted or in body order, ``k=v`` or ``k v`` or ``kv``, joined by ``&``
  (or nothing), with the secret prefixed, suffixed, or omitted;
* the whole thing lower- or upper-cased before hashing (a surprising number of
  bundles do this);
* MD5, SHA-1, SHA-256, HMAC-SHA256 with the secret as key.

A match is evidence, not proof: it says this recipe reproduces this request. The
next request is what turns it into a rule.

usage:
    python3 sign_chain_probe.py --request req.json --secret demo --algo sha256
    python3 sign_chain_probe.py --request req.json --secret demo --sign-field sign --exclude sign,timestamp
    python3 sign_chain_probe.py --self-test
"""

import hashlib
import hmac
import json
import os
import sys
from urllib.parse import quote, urlencode

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli  # noqa: E402

ALGOS = ("md5", "sha1", "sha256", "hmac-sha256")

DEFAULT_EXCLUDE = ("sign", "signature", "sig", "_sign", "token")


def scalar(value):
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return ""
    return str(value)


def pairs(params, exclude):
    out = []
    for key in params:
        if key in exclude:
            continue
        out.append((key, scalar(params[key])))
    return out


def bodies(pairs_list, secret):
    """Every (label, text) pre-image worth trying, in a stable order."""
    out = []
    for order_label, items in (("sorted", sorted(pairs_list)), ("body-order", list(pairs_list))):
        for join_label, glue in (("k=v&", "&"), ("k=v-noglue", ""), ("k=v-space", " ")):
            if join_label == "k=v&":
                body = "&".join("{}={}".format(key, value) for key, value in items)
            elif join_label == "k=v-noglue":
                body = "".join("{}={}".format(key, value) for key, value in items)
            else:
                body = " ".join("{}={}".format(key, value) for key, value in items)
            del glue
            out.append(("{} {}".format(order_label, join_label), body))
        body_values = "".join(value for _key, value in items)
        out.append(("{} values-only".format(order_label), body_values))
        body_keys = "".join(key for key, _value in items)
        out.append(("{} keys-only".format(order_label), body_keys))
        body_url = urlencode(items)
        out.append(("{} urlencoded".format(order_label), body_url))
    combined = []
    for label, body in out:
        if secret:
            combined.append((label + " +secret-suffix", body + secret))
            combined.append((label + " secret-prefix+", secret + body))
            combined.append((label + " secret&body", secret + "&" + body))
            combined.append((label + " body&secret", body + "&" + secret))
        combined.append((label, body))
    return combined


def digest(text, algo, secret=""):
    raw = text.encode("utf-8")
    if algo == "md5":
        return hashlib.md5(raw).hexdigest()
    if algo == "sha1":
        return hashlib.sha1(raw).hexdigest()
    if algo == "sha256":
        return hashlib.sha256(raw).hexdigest()
    if algo == "hmac-sha256":
        return hmac.new(secret.encode("utf-8"), raw, hashlib.sha256).hexdigest()
    raise ValueError("unknown algorithm: " + algo)


def probe(params, sign_value, secret, algos, exclude):
    observed = sign_value.strip().lower()
    rows = []
    items = pairs(params, exclude)
    for algo in algos:
        for label, body in bodies(items, secret if algo != "hmac-sha256" else ""):
            for case_label, candidate in (("", body), (" lower", body.lower()), (" upper", body.upper())):
                value = digest(candidate, algo, secret)
                rows.append(
                    {
                        "algo": algo,
                        "recipe": label + case_label,
                        "value": value,
                        "match": value == observed or value.upper() == sign_value.strip().upper(),
                        "preimage_length": len(candidate),
                    }
                )
    return rows


def guess_algo(sign_value):
    length = len(sign_value.strip())
    if length == 32:
        return ["md5"]
    if length == 40:
        return ["sha1"]
    if length == 64:
        return ["sha256", "hmac-sha256"]
    return list(ALGOS)


def main(options):
    cli.require(options, "request")
    with open(options["request"], "r", encoding="utf-8") as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise cli.UsageError("the request must be a JSON object")

    sign_field = options.get("sign_field") or "sign"
    if sign_field not in payload:
        raise cli.UsageError("no '{}' field in the request; pass --sign-field".format(sign_field))
    observed = scalar(payload[sign_field])

    params = payload.get("params") if isinstance(payload.get("params"), dict) else payload
    exclude = set(DEFAULT_EXCLUDE)
    if options.get("exclude"):
        exclude = {part.strip() for part in options["exclude"].split(",") if part.strip()}
    exclude.add(sign_field)

    secret = options.get("secret") or ""
    algos = [options["algo"]] if options.get("algo") else guess_algo(observed)

    report = cli.Report("signature chain probe")
    report.field("request", options["request"])
    report.field("signature field", sign_field)
    report.field("observed", observed)
    report.field("signed fields", ", ".join(key for key, _ in pairs(params, exclude)) or "<none>")
    report.field("algorithms tried", ", ".join(algos))
    report.field("secret supplied", "yes" if secret else "no (prefix/suffix recipes still tried)")

    rows = probe(params, observed, secret, algos, exclude)
    hits = [row for row in rows if row["match"]]

    report.heading("matches")
    if hits:
        report.table(
            ["algorithm", "recipe", "preimage length"],
            [[row["algo"], row["recipe"], row["preimage_length"]] for row in hits],
        )
        report.line("")
        distinct = len({row["value"] for row in hits})
        report.field("distinct pre-images", distinct)
        if distinct < len(hits):
            report.line("several recipes collapse to the same pre-image (sorting or urlencoding was a")
            report.line("no-op on this input); the recipe name is not yet pinned down by one request.")
        report.line("the recipe reproduces this request; confirm it on a second request before calling it a rule.")
    else:
        report.line("none of the {} constructions reproduce the observed value.".format(len(rows)))
        report.line("")
        report.line("usual reasons, in the order worth checking:")
        report.bullet("the signed set is not the whole body: look for a whitelist in the bundle")
        report.bullet("a nonce or timestamp is hashed but not sent, or sent under another name")
        report.bullet("the value is url-encoded once more before hashing")
        report.bullet("the secret is per-session, or derived from another field")
        report.bullet("the hash is truncated or reversed, or the bundle hashes bytes not text")

    report.heading("tried")
    report.line("{} constructions across: {}".format(len(rows), ", ".join(algos)))
    report.line("order: sorted and body-order; joins: 'k=v&', 'k=v' with no glue, space, urlencoded,")
    report.line("values-only, keys-only; secret: omitted, prefix, suffix, '&'-joined on both sides;")
    report.line("each also lower- and upper-cased before hashing.")
    report.emit()
    return cli.EXIT_OK if hits else cli.EXIT_FAIL


def _request():
    return {"params": {"appId": "demo", "nonce": "abc123", "ts": "1700000000", "q": "x y"}, "sign": ""}


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]

    # 1. recover the sorted k=v& + secret-suffix sha256 recipe
    base = {"params": {"appId": "demo", "nonce": "abc123", "ts": "1700000000"}, "sign": ""}
    items = sorted(base["params"].items())
    preimage = "&".join("{}={}".format(key, value) for key, value in items) + "s3cr3t"
    base["sign"] = hashlib.sha256(preimage.encode("utf-8")).hexdigest()
    rows = probe(base["params"], base["sign"], "s3cr3t", ["sha256"], set())
    hits = [row for row in rows if row["match"]]
    # several recipes collapse to one pre-image (sorted == body order, plain == urlencoded for
    # alphanumeric values), so the honest assertion is one distinct pre-image, not one recipe.
    results.append(len(hits) >= 1 and len({row["value"] for row in hits}) == 1)
    results.append(bool(hits) and hits[0]["recipe"].endswith("+secret-suffix"))

    # 2. the wrong secret finds nothing
    results.append(probe(base["params"], base["sign"], "wrong", ["sha256"], set()) == [] or
                   not [row for row in probe(base["params"], base["sign"], "wrong", ["sha256"], set()) if row["match"]])

    # 3. hmac-sha256 with the secret as key
    mac = hmac.new(b"s3cr3t", "&".join("{}={}".format(k, v) for k, v in items).encode(), hashlib.sha256).hexdigest()
    hmac_hits = [row for row in probe(base["params"], mac, "s3cr3t", ["hmac-sha256"], set()) if row["match"]]
    results.append(len(hmac_hits) >= 1 and hmac_hits[0]["algo"] == "hmac-sha256")

    # 4. upper-cased hex still matches
    upper = base["sign"].upper()
    results.append(any(row["match"] for row in probe(base["params"], upper, "s3cr3t", ["sha256"], set())))

    # 5. algorithm guessed from the digest length
    results.append(guess_algo(base["sign"]) == ["sha256", "hmac-sha256"] and guess_algo("a" * 32) == ["md5"])

    # 6. excluded fields do not enter the pre-image
    excluded = dict(base["params"])
    excluded["sign"] = "should-not-be-signed"
    rows_ex = probe(excluded, base["sign"], "s3cr3t", ["sha256"], {"sign"})
    results.append(any(row["match"] for row in rows_ex))
    rows_bad = probe(excluded, base["sign"], "s3cr3t", ["sha256"], set())
    results.append(not any(row["match"] for row in rows_bad))

    # 7. a value with a space is url-encoded in one of the recipes
    spaced = {"params": {"q": "x y", "id": "1"}, "sign": ""}
    url_body = urlencode(sorted(spaced["params"].items())) + "k"
    spaced["sign"] = hashlib.sha256(url_body.encode()).hexdigest()
    url_hits = [row for row in probe(spaced["params"], spaced["sign"], "k", ["sha256"], set()) if row["match"]]
    results.append(
        len({row["value"] for row in url_hits}) == 1
        and any("urlencoded" in row["recipe"] for row in url_hits)
    )

    # 8. report renders without a match
    report = cli.Report("t")
    report.table(["a"], [["b"]])
    results.append("| b" in "\n".join(report.lines))

    passed = sum(1 for item in results if item)
    sys.stdout.write("\nsign_chain_probe self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


FLAGS = ()
VALUES = ("request", "secret", "algo", "sign-field", "exclude")


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test, FLAGS, VALUES))
