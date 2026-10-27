#!/usr/bin/env python3
"""RSA public blob + machine code: parse the key, then verify the signature.

The case shape (project I): the client carries a CryptoAPI PUBLICKEYBLOB, builds
a machine-code string from the host, hashes it, and compares the result against
RSA-decrypted licence bytes. Two things decide whether a signature will be
accepted, and both are answerable offline:

1. What key is embedded?  PUBLICKEYBLOB is a fixed layout with little-endian
   modulus, and the exponent is almost always 65537. Printing bitlen and the
   modulus prefix tells you whether you are looking at the right key at all.
2. What exactly is hashed?  Almost never the raw machine code: upper/lower case,
   UTF-16LE, a trailing newline and a salt all change the digest. This tool
   tries the encodings the case documents actually encountered and reports which
   one verifies, instead of guessing.

Verification is real modular exponentiation with PKCS#1 v1.5 padding (or a raw
compare with --raw). No server, no key derivation, no network.

usage:
    python3 rsa_blob_verify.py --sample client.exe
    python3 rsa_blob_verify.py --blob <hex-or-file> --machine-code "AB-CD-EF" --signature <hex>
    python3 rsa_blob_verify.py --blob key.bin --signature <hex> --hash sha256 --message-file payload.bin
    python3 rsa_blob_verify.py --self-test
"""

import base64
import hashlib
import os
import random
import struct
import sys

_here = os.path.dirname(os.path.abspath(sys.argv[0]))
for _candidate in (_here, os.path.abspath(os.path.join(_here, "..", "..", "_shared"))):
    if os.path.isdir(os.path.join(_candidate, "hpkit")):
        sys.path.insert(0, _candidate)
        break

from hpkit import cli  # noqa: E402

BLOB_MAGIC = struct.pack("<BBHI", 0x06, 0x02, 0x0000, 0x00002400)
BLOB_SIGN_MAGIC = struct.pack("<BBHI", 0x06, 0x02, 0x0000, 0x0000A400)
PUBKEY_MAGIC = b"RSA1"
PRIVKEY_MAGIC = b"RSA2"

CALG_NAMES = {
    0x00002400: "CALG_RSA_KEYX",
    0x0000A400: "CALG_RSA_SIGN",
    0x0000A000: "CALG_RSA_SIGN (legacy)",
}

# DigestInfo prefixes for PKCS#1 v1.5 signatures.
DIGEST_INFO = {
    "md5": bytes.fromhex("3020300c06082a864886f70d020505000410"),
    "sha1": bytes.fromhex("3021300906052b0e03021a05000414"),
    "sha256": bytes.fromhex("3031300d060960864801650304020105000420"),
    "sha384": bytes.fromhex("3041300d060960864801650304020205000430"),
    "sha512": bytes.fromhex("3051300d060960864801650304020305000440"),
}


class BlobError(Exception):
    """The bytes are not a CryptoAPI RSA blob this tool can parse."""


class PublicKey:
    def __init__(self, bitlen, exponent, modulus, offset=0, key_type=None, magic=None):
        self.bitlen = bitlen
        self.exponent = exponent
        self.modulus = modulus
        self.offset = offset
        self.key_type = key_type
        self.magic = magic

    @property
    def size(self):
        return (self.bitlen + 7) // 8

    def summary(self):
        return {
            "bitlen": self.bitlen,
            "exponent": self.exponent,
            "modulus_bytes": len(self.modulus),
            "modulus_prefix": self.modulus[::-1].hex()[:24],
            "modulus_sha256": hashlib.sha256(self.modulus[::-1]).hexdigest()[:16],
            "offset": "0x{:X}".format(self.offset),
            "key_type": self.key_type,
        }


def parse_public_blob(data, offset=0):
    """Parse a PUBLICKEYBLOB or the public half of a PRIVATEKEYBLOB."""
    need = offset + 20
    if len(data) < need:
        raise BlobError("blob truncated: need at least {} bytes at offset {}".format(20, offset))
    b_type, b_version, _reserved, ai_key_alg = struct.unpack_from("<BBHI", data, offset)
    if b_type != 0x06:
        raise BlobError("bType is 0x{:02X}, expected 0x06 (PUBLICKEYBLOB)".format(b_type))
    if b_version != 0x02:
        raise BlobError("bVersion is 0x{:02X}, expected 0x02".format(b_version))
    magic = data[offset + 8 : offset + 12]
    if magic == PUBKEY_MAGIC:
        bitlen, exponent = struct.unpack_from("<II", data, offset + 12)
        mod_at = offset + 20
    elif magic == PRIVKEY_MAGIC:
        bitlen, exponent = struct.unpack_from("<II", data, offset + 12)
        mod_at = offset + 20
    else:
        raise BlobError("RSAPUBKEY magic is {!r}, expected RSA1 or RSA2".format(magic))
    if bitlen <= 0 or bitlen % 8:
        raise BlobError("bitlen {} is not a positive multiple of 8".format(bitlen))
    size = bitlen // 8
    if mod_at + size > len(data):
        raise BlobError("modulus runs past the buffer ({} bytes at offset {})".format(size, mod_at))
    modulus = data[mod_at : mod_at + size]
    return PublicKey(bitlen, exponent, modulus, offset, CALG_NAMES.get(ai_key_alg, "0x{:08X}".format(ai_key_alg)), magic.decode("ascii"))


def find_blobs(data):
    """Every plausible PUBLICKEYBLOB, by the two headers the case quotes."""
    found = []
    for magic in (BLOB_MAGIC, BLOB_SIGN_MAGIC):
        cursor = data.find(magic)
        while cursor >= 0:
            try:
                found.append(parse_public_blob(data, cursor))
            except BlobError:
                pass
            cursor = data.find(magic, cursor + 1)
    found.sort(key=lambda key: key.offset)
    return found


def load_blob(text):
    """Accept a path, a hex string, or base64 - whatever the operator pasted."""
    if os.path.exists(text):
        with open(text, "rb") as handle:
            return handle.read()
    compact = text.strip()
    if any(char in compact for char in "+/=") and not compact.lower().startswith("0602"):
        try:
            return base64.b64decode(compact, validate=False)
        except Exception:  # noqa: BLE001
            pass
    try:
        return bytes.fromhex(compact.replace(" ", ""))
    except ValueError:
        raise cli.UsageError("--blob is neither a readable file, base64, nor hex")


def pkcs1_verify(key, signature, digest, hash_name, raw=False):
    """RSA verify with PKCS#1 v1.5; returns (ok, reason)."""
    size = key.size
    if len(signature) != size:
        return False, "signature is {} bytes, the key is {} bytes".format(len(signature), size)
    s = int.from_bytes(signature, "big")
    if s >= int.from_bytes(key.modulus[::-1], "big"):
        return False, "signature value is not below the modulus"
    n = int.from_bytes(key.modulus[::-1], "big")
    message = pow(s, key.exponent, n).to_bytes(size, "big")
    if raw:
        expected_tail = digest
        if not message.endswith(expected_tail):
            return False, "raw compare failed (EM tail {})".format(message[-16:].hex())
        return True, "verified (raw digest compare)"
    prefix = DIGEST_INFO[hash_name]
    body = prefix + digest
    if len(body) + 11 > size:
        return False, "key too small for a {} DigestInfo".format(hash_name)
    expected = b"\x00\x01" + b"\xff" * (size - len(body) - 3) + b"\x00" + body
    if message == expected:
        return True, "verified (PKCS#1 v1.5 {})".format(hash_name)
    if message[:2] != b"\x00\x01":
        return False, "EM does not start with 00 01 (padding is not type 1)"
    return False, "EM padding block does not match the {} DigestInfo".format(hash_name)


def candidate_payloads(machine_code):
    """The encodings that show up in practice, in the order they usually do."""
    text = machine_code
    raw = text.encode("utf-8")
    upper = text.upper().encode("utf-8")
    lower = text.lower().encode("utf-8")
    compact = text.replace("-", "").replace(" ", "").encode("utf-8")
    out = [
        ("utf8 as given", raw),
        ("utf8 upper", upper),
        ("utf8 lower", lower),
        ("utf8 compact (separators removed)", compact),
        ("utf16le as given", text.encode("utf-16-le")),
        ("utf16le upper", text.upper().encode("utf-16-le")),
        ("utf8 as given + CRLF", raw + b"\r\n"),
        ("utf8 as given + LF", raw + b"\n"),
        ("utf16le as given + NUL", text.encode("utf-16-le") + b"\x00\x00"),
    ]
    seen = set()
    unique = []
    for label, payload in out:
        if payload in seen:
            continue
        seen.add(payload)
        unique.append((label, payload))
    return unique


def try_candidates(key, signature, payloads, hash_name, raw):
    rows = []
    for label, payload in payloads:
        digest = hashlib.new(hash_name, payload).digest()
        ok, reason = pkcs1_verify(key, signature, digest, hash_name, raw)
        rows.append([label, len(payload), "verified" if ok else reason])
    return rows


# --------------------------------------------------------------------------
# demo key: deterministic, generated in memory, never written anywhere
# --------------------------------------------------------------------------

SMALL_PRIMES = (3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97)


def _is_probable_prime(value, rounds=24):
    if value < 2:
        return False
    for prime in SMALL_PRIMES:
        if value % prime == 0:
            return value == prime
    d = value - 1
    shift = 0
    while d % 2 == 0:
        d //= 2
        shift += 1
    for _ in range(rounds):
        base = random.randrange(2, value - 1)
        x = pow(base, d, value)
        if x in (1, value - 1):
            continue
        for _ in range(shift - 1):
            x = pow(x, 2, value)
            if x == value - 1:
                break
        else:
            return False
    return True


def _prime(bits, rng):
    while True:
        candidate = rng.getrandbits(bits) | (1 << (bits - 1)) | 1
        if _is_probable_prime(candidate):
            return candidate


def demo_keypair(bits=512, seed=0x5EED5EED):
    """A throwaway key pair for the self test. Not a secret, not for use."""
    rng = random.Random(seed)
    e = 65537
    while True:
        p = _prime(bits // 2, rng)
        q = _prime(bits // 2, rng)
        if p == q:
            continue
        phi = (p - 1) * (q - 1)
        if phi % e:
            d = pow(e, -1, phi)
            break
    n = p * q
    aligned = ((n.bit_length() + 7) // 8) * 8
    return {"n": n, "e": e, "d": d, "bits": aligned}
    return {"n": n, "e": e, "d": d, "bits": n.bit_length()}


def demo_blob(key):
    size = (key["bits"] + 7) // 8
    header = BLOB_MAGIC + PUBKEY_MAGIC + struct.pack("<II", key["bits"], key["e"])
    return header + key["n"].to_bytes(size, "little")


def demo_sign(key, payload, hash_name):
    size = (key["bits"] + 7) // 8
    body = DIGEST_INFO[hash_name] + hashlib.new(hash_name, payload).digest()
    em = b"\x00\x01" + b"\xff" * (size - len(body) - 3) + b"\x00" + body
    return pow(int.from_bytes(em, "big"), key["d"], key["n"]).to_bytes(size, "big")


def main(options):
    report = cli.Report("rsa blob and machine code verification")
    if options.get("sample"):
        with open(options["sample"], "rb") as handle:
            data = handle.read()
        report.field("sample", options["sample"])
        report.field("size", len(data))
        keys = find_blobs(data)
        report.heading("embedded public keys")
        if keys:
            report.table(
                ["offset", "bitlen", "exponent", "key type", "modulus prefix"],
                [
                    [
                        "0x{:X}".format(key.offset),
                        key.bitlen,
                        key.exponent,
                        key.key_type,
                        key.modulus[::-1].hex()[:24],
                    ]
                    for key in keys
                ],
            )
            report.line("")
            report.line("the modulus is stored little-endian; the prefix above is big-endian (as IDA shows it)")
        else:
            report.line("no PUBLICKEYBLOB header found (looked for 06 02 00 00 + RSA1 / RSA2)")
        if options.get("signature"):
            report.line("pass --blob-free verification by reading one of these keys with --blob <hex>")
        report.emit()
        return cli.EXIT_OK

    cli.require(options, "blob", "signature")
    data = load_blob(options["blob"])
    key = parse_public_blob(data)
    signature = bytes.fromhex(options["signature"].replace(" ", ""))
    hash_name = (options.get("hash") or "sha256").lower()
    if hash_name not in DIGEST_INFO:
        raise cli.UsageError("--hash must be one of " + ", ".join(sorted(DIGEST_INFO)))
    raw = bool(options.get("raw"))

    report.field("key", "{} bits, exponent {}".format(key.bitlen, key.exponent))
    report.field("key type", key.key_type or "-")
    report.field("modulus", key.modulus[::-1].hex()[:32] + "...")
    report.field("signature", "{} bytes".format(len(signature)))

    if options.get("machine_code"):
        report.heading("machine code candidates ({})".format(hash_name))
        rows = try_candidates(key, signature, candidate_payloads(options["machine_code"]), hash_name, raw)
        report.table(["encoding", "bytes", "result"], rows)
        winners = [row[0] for row in rows if row[2] == "verified"]
        report.line("")
        if winners:
            report.line("the client hashes: " + winners[0])
            report.line("this is the encoding to use when reproducing the check")
        else:
            report.line("no candidate encoding verifies: the payload also carries a salt, a product id,")
            report.line("or a different machine-code field. Widen the payload before concluding.")
    else:
        payload = (options.get("message") or "").encode("utf-8")
        if options.get("message-file"):
            with open(options["message-file"], "rb") as handle:
                payload = handle.read()
        digest = hashlib.new(hash_name, payload).digest()
        ok, reason = pkcs1_verify(key, signature, digest, hash_name, raw)
        report.heading("verification")
        report.verdict("signature over {} bytes".format(len(payload)), ok, reason)

    report.emit()
    return cli.EXIT_OK


def self_test():
    from hpkit import selftest

    results = [selftest.run() == cli.EXIT_OK]
    key = demo_keypair()
    blob = demo_blob(key)
    parsed = parse_public_blob(blob)
    results.append(parsed.bitlen == key["bits"] and parsed.exponent == key["e"])
    results.append(int.from_bytes(parsed.modulus[::-1], "big") == key["n"])
    results.append(parsed.magic == "RSA1" and parsed.key_type == "CALG_RSA_KEYX")

    payload = b"AB-CD-EF-01-02-03"
    for hash_name in ("sha1", "sha256"):
        signature = demo_sign(key, payload, hash_name)
        ok, reason = pkcs1_verify(parsed, signature, hashlib.new(hash_name, payload).digest(), hash_name)
        results.append(ok)
        bad, _ = pkcs1_verify(parsed, signature, hashlib.new(hash_name, payload + b"x").digest(), hash_name)
        results.append(not bad)

    signature = demo_sign(key, payload, "sha256")
    rows = try_candidates(parsed, signature, candidate_payloads("AB-CD-EF-01-02-03"), "sha256", False)
    results.append(any(row[2] == "verified" for row in rows))
    rows_wrong = try_candidates(parsed, signature, candidate_payloads("FF-FF-FF"), "sha256", False)
    results.append(not any(row[2] == "verified" for row in rows_wrong))

    embedded = b"\x00" * 64 + blob + b"\x00" * 16
    found = find_blobs(embedded)
    results.append(len(found) == 1 and found[0].offset == 64)

    try:
        parse_public_blob(b"nope" * 8)
        results.append(False)
    except BlobError:
        results.append(True)

    passed = sum(1 for item in results if item)
    sys.stdout.write("\nrsa_blob_verify self test: {}/{} assertions passed\n".format(passed, len(results)))
    return cli.EXIT_OK if passed == len(results) else cli.EXIT_SELFTEST


FLAGS = ("raw",)
VALUES = ("sample", "blob", "signature", "message", "message-file", "machine-code", "hash")


if __name__ == "__main__":
    sys.exit(cli.run(main, self_test, FLAGS, VALUES))
