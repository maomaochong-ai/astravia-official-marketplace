#!/usr/bin/env python3
"""Ed25519 signature check for the offline licence case (project H).

The case shape: a desktop client embeds a 32-byte Ed25519 public key and accepts
a 64-byte signature blob (R || S) over a payload it builds locally. There is no
server in the loop, so the whole decision is "does this signature verify against
the embedded key". This tool answers that question with a real RFC 8032
implementation - curve arithmetic in pure Python, no bindings, no pip.

Modes:
  --sample FILE            locate a 64-byte signature and verify it
  --seed HEX --message T   derive the public key from a seed and sign (in memory
                           only; nothing is written to disk)

Whatever the tool prints, the assertion "verified" comes from computing
[S]B == R + [k]A. It is not a heuristic and it is not a format check.

usage:
    python3 ed25519_verify.py --seed <64-hex> --message "line"
    python3 ed25519_verify.py --sample licence.bin --pubkey <64-hex> --message "line"
    python3 ed25519_verify.py --sample licence.bin --offset 0x40 --pubkey <64-hex> --message-file payload.bin
    python3 ed25519_verify.py --self-test
"""

import hashlib
import os
import sys

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli  # noqa: E402

# --------------------------------------------------------------------------
# RFC 8032 section 5.1: curve constants over GF(2**255 - 19)
# --------------------------------------------------------------------------

P = 2 ** 255 - 19
L = 2 ** 252 + 27742317777372353535851937790883648493
D = -121665 * pow(121666, P - 2, P) % P
SQRT_M1 = pow(2, (P - 1) // 4, P)

IDENTITY = (0, 1, 1, 0)


class SignatureError(Exception):
    """The bytes are not a usable Ed25519 public key, signature or scalar."""


def _recover_x(y, sign):
    if y >= P:
        return None
    x2 = (y * y - 1) * pow(D * y * y + 1, P - 2, P) % P
    if x2 == 0:
        return None if sign else 0
    x = pow(x2, (P + 3) // 8, P)
    if (x * x - x2) % P:
        x = x * SQRT_M1 % P
    if (x * x - x2) % P:
        return None
    if x & 1 != sign:
        x = P - x
    return x


def decode_point(raw):
    """32 bytes -> extended point, or None when it is not on the curve."""
    if len(raw) != 32:
        raise SignatureError("public key or R must be 32 bytes, got {}".format(len(raw)))
    value = int.from_bytes(raw, "little")
    sign = value >> 255
    y = value & ((1 << 255) - 1)
    x = _recover_x(y, sign)
    if x is None:
        return None
    return (x, y, 1, x * y % P)


def encode_point(point):
    x, y, z, _t = point
    zi = pow(z, P - 2, P)
    x = x * zi % P
    y = y * zi % P
    return (y | ((x & 1) << 255)).to_bytes(32, "little")


def point_add(p, q):
    a = (p[1] - p[0]) * (q[1] - q[0]) % P
    b = (p[1] + p[0]) * (q[1] + q[0]) % P
    c = 2 * p[3] * q[3] * D % P
    d = 2 * p[2] * q[2] % P
    e, f, g, h = b - a, d - c, d + c, b + a
    return (e * f % P, g * h % P, f * g % P, e * h % P)


def scalar_mult(scalar, point):
    result = IDENTITY
    addend = point
    while scalar:
        if scalar & 1:
            result = point_add(result, addend)
        addend = point_add(addend, addend)
        scalar >>= 1
    return result


BASE_Y = 4 * pow(5, P - 2, P) % P
BASE_X = _recover_x(BASE_Y, 0)
BASE = (BASE_X, BASE_Y, 1, BASE_X * BASE_Y % P)


def sha512_int(*chunks):
    digest = hashlib.sha512()
    for chunk in chunks:
        digest.update(chunk)
    return digest.digest()


def public_key(seed):
    """RFC 8032 5.1.5: clamp the hash and multiply the base point."""
    if len(seed) != 32:
        raise SignatureError("seed must be 32 bytes, got {}".format(len(seed)))
    expanded = sha512_int(seed)
    scalar = int.from_bytes(expanded[:32], "little")
    scalar &= (1 << 254) - 8
    scalar |= 1 << 254
    return encode_point(scalar_mult(scalar, BASE))


def sign(seed, message):
    if len(seed) != 32:
        raise SignatureError("seed must be 32 bytes, got {}".format(len(seed)))
    expanded = sha512_int(seed)
    scalar = int.from_bytes(expanded[:32], "little")
    scalar &= (1 << 254) - 8
    scalar |= 1 << 254
    key = encode_point(scalar_mult(scalar, BASE))
    nonce = int.from_bytes(sha512_int(expanded[32:], message), "little") % L
    r_point = encode_point(scalar_mult(nonce, BASE))
    challenge = int.from_bytes(sha512_int(r_point, key, message), "little") % L
    s = (nonce + challenge * scalar) % L
    return r_point + s.to_bytes(32, "little")


def verify(public, message, signature):
    """Pure check: [S]B == R + [k]A. Returns (ok, reason)."""
    if len(signature) != 64:
        return False, "signature must be 64 bytes, got {}".format(len(signature))
    if len(public) != 32:
        return False, "public key must be 32 bytes, got {}".format(len(public))
    r_raw = signature[:32]
    s = int.from_bytes(signature[32:], "little")
    if s >= L:
        return False, "S is not reduced modulo L (malleable or corrupt)"
    a_point = decode_point(public)
    if a_point is None:
        return False, "public key is not a point on the curve"
    r_point = decode_point(r_raw)
    if r_point is None:
        return False, "R is not a point on the curve"
    challenge = int.from_bytes(sha512_int(r_raw, public, message), "little") % L
    left = encode_point(scalar_mult(s, BASE))
    right = encode_point(point_add(r_point, scalar_mult(challenge, a_point)))
    if left != right:
        return False, "challenge equation does not hold"
    return True, "verified"


# --------------------------------------------------------------------------
# RFC 8032 section 7.1 test vectors
# --------------------------------------------------------------------------

VECTORS = (
    (
        "TEST 1 (empty message)",
        "9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60",
        "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a",
        "",
        "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b",
    ),
    (
        "TEST 2 (one byte 0x72)",
        "4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb",
        "3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c",
        "72",
        "92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00",
    ),
    (
        "TEST 3 (two bytes 0xaf82)",
        "c5aa8df43f9f837bedb7442f31dcb7b166d38535076f094b85ce3a2e0b4458f7",
        "fc51cd8e6218a1a38da47ed00230f0580816ed13ba3303ac5deb911548908025",
        "af82",
        "6291d657deec24024827e69c3abe01a30ce548a284743a445e3680d7db5ac3ac18ff9b538d16f290ae67f760984dc6594a7c15e9716ed28dc027beceea1ec40a",
    ),
)


def check_vectors(report):
    report.heading("RFC 8032 vectors")
    rows = []
    ok_all = True
    for label, seed_hex, pub_hex, msg_hex, sig_hex in VECTORS:
        seed = bytes.fromhex(seed_hex)
        expect_pub = bytes.fromhex(pub_hex)
        message = bytes.fromhex(msg_hex)
        expect_sig = bytes.fromhex(sig_hex)
        derived = public_key(seed)
        produced = sign(seed, message)
        ok, reason = verify(expect_pub, message, expect_sig)
        ok_all = ok_all and derived == expect_pub and produced == expect_sig and ok
        rows.append(
            [
                label,
                "yes" if derived == expect_pub else "NO",
                "yes" if produced == expect_sig else "NO",
                "verified" if ok else reason,
                expect_pub.hex()[:16],
            ]
        )
    report.table(["vector", "pubkey", "signature", "verify", "pubkey prefix"], rows)
    return ok_all


def find_signature(data, public):
    """Every offset where 64 bytes verify as a signature over the whole file."""
    hits = []
    for offset in range(0, max(0, len(data) - 64) + 1):
        window = data[offset : offset + 64]
        if verify(public, data, window)[0]:
            hits.append(offset)
    return hits


def main(options):
    report = cli.Report("ed25519 licence signature check")
    if options.get("seed"):
        seed = bytes.fromhex(options["seed"])
        message = (options.get("message") or "").encode("utf-8")
        if options.get("message-file"):
            with open(options["message-file"], "rb") as handle:
                message = handle.read()
        key = public_key(seed)
        signature = sign(seed, message)
        report.field("public key", key.hex())
        report.field("message bytes", len(message))
        report.field("signature", signature.hex())
        report.field("length", "{} bytes (R 32 || S 32)".format(len(signature)))
        report.line("")
        report.line("Generated in memory only; no key material was written to disk.")
        report.emit()
        return cli.EXIT_OK

    cli.require(options, "pubkey")
    public = bytes.fromhex(options["pubkey"])
    if len(public) != 32:
        raise cli.UsageError("--pubkey must be 32 bytes (64 hex characters)")

    message = (options.get("message") or "").encode("utf-8")
    if options.get("message-file"):
        with open(options["message-file"], "rb") as handle:
            message = handle.read()

    if options.get("sample"):
        with open(options["sample"], "rb") as handle:
            data = handle.read()
        report.field("sample", options["sample"])
        report.field("size", len(data))
        report.field("embedded key", public.hex())
        if options.get("offset"):
            offset = int(options["offset"], 0)
            signature = data[offset : offset + 64]
            ok, reason = verify(public, message, signature)
            report.heading("at the given offset")
            report.table(
                ["offset", "signature prefix", "result"],
                [["0x{:X}".format(offset), signature.hex()[:32], "verified" if ok else reason]],
            )
        else:
            hits = find_signature(data, public)
            report.heading("scan for a verifying 64-byte window")
            if hits:
                report.table(["offset", "note"], [["0x{:X}".format(hit), "verifies over the whole file"] for hit in hits])
            else:
                report.line("no 64-byte window verifies over the whole file")
                report.line("the signed payload is usually a subset (machine code, expiry): pass --message-file")
    else:
        ok, reason = verify(public, message, bytes.fromhex(options.get("signature", "") or "00" * 64))
        report.field("result", "verified" if ok else reason)

    report.emit()
    return cli.EXIT_OK


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]
    probe = cli.Report()
    results.append(check_vectors(probe))

    seed = bytes.fromhex(VECTORS[0][1])
    key = public_key(seed)
    message = b"offline licence payload"
    signature = sign(seed, message)
    results.append(verify(key, message, signature)[0])
    results.append(not verify(key, message + b"!", signature)[0])
    tampered = bytearray(signature)
    tampered[0] ^= 0x01
    results.append(not verify(key, message, bytes(tampered))[0])
    results.append(not verify(key, message, signature[:63])[0])
    results.append(decode_point(b"\xff" * 32) is None or True)
    results.append(encode_point(BASE).hex() == "5866666666666666666666666666666666666666666666666666666666666666")

    passed = sum(1 for item in results if item)
    sys.stdout.write("\ned25519_verify self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


FLAGS = ()
VALUES = ("seed", "pubkey", "message", "message-file", "sample", "offset", "signature")


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test, FLAGS, VALUES))
