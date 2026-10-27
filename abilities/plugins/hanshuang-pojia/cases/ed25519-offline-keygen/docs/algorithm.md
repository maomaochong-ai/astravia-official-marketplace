# Algorithm and key replacement — ed25519-offline-keygen

Teaching values from the archived case (x64, image base `0x140000000`). The literal key material,
the vendor public key and the sample hash have been removed; the structure, the arithmetic and the
offsets are kept so the analysis can be replayed.

## 1. Constants

| item | value |
|------|-------|
| signature scheme | Ed25519 (a CryptoPP-style verifier) |
| signature length | 64 bytes |
| payload compression | gzip, `wbits=31` (so a Qt reader and a Python reader agree) |
| machine hash | `blake2s(digest_size=16)` over product name + a version digit + machine GUID |
| vendor public key | 32 bytes raw; **value removed** |
| key storage | 58-byte ciphertext inside the key-load function, 15 immediate operands |
| key transform | repeating XOR, 16-byte period |

## 2. The activation code container

```
code = v + check + "-" + base64(payload)
  v      : one character (offline vendor codes use a digit; a generator can use any)
  check  : derived from the body, e.g. sum of adjacent character differences reduced into one char
  payload: 64-byte signature || body
           body = gzip(json) XOR signature          (repeating over 64 bytes)
```

Two properties make this format workable: the check character is computable from the body, and the
separator position is fixed, so no parsing ambiguity exists.

## 3. What the client does with it

```
1. entry:      len > 3, code[2] == '-', verify code[1], base64-decode payload
2. postProcess (only if len(payload) >= 65):
      body = payload[64:]
      body ^= sig            (A)
      body  = gunzip(body)   (B)   on failure: pass through unchanged, which cannot verify
      body ^= sig            (C)
      out   = sig || body
3. verify:     sig'  = out[0:64]
               msg   = out[64:]
               msg  ^= sig'        (only when no debugger is present)
               verify(pub, msg, sig')
4. parse:      json → entitlement fields
5. state check: plan, workgroup, machine id, issued-at, expiry → error code
```

Note the arithmetic: A and C cancel, and the verifier's XOR cancels again, so **the signed message
is exactly the gzip-decompressed JSON plaintext**. That is worth stating in a finding: no digest, no
domain string, no length prefix — the signature covers a serialisation format the client also
accepts loosely.

The anti-debug branch matters for reproduction, not for the analysis: with a debugger attached the
final XOR path changes, so a debugged run fails for a reason unrelated to the patch.

## 4. Replacing the public key

The embedded blob is a repeating-key XOR of the 32-byte key plus a terminator:

```
stream     = embedded_cipher XOR vendor_public_key        # 33 bytes
check       stream[0:16] == stream[16:32]                 # proves the period
new_cipher  = my_public_key XOR stream[0:32] + stream[32]  # keep the last byte as-is
```

Then write the 33 bytes back over the immediate operands that hold it — in the archived build that
is nine file offsets inside one function (`0x2493C8` … `0x249400`), eight full dwords plus the first
byte of a ninth, with the remaining bytes of the ninth left untouched.

After patching, the running process decrypts **your** key. Verify that at runtime by reading the
decrypted buffer after the key-load function returns; equality with your public key is the proof
that the patch, and not something else, changed the outcome.

## 5. Device code

The client recomputes the expected machine identifier on every check and compares it with the value
inside the signed payload:

```
hex12 = blake2s(product, version_digit, machine_guid)[-6:].hex().upper()   # 12 chars
s     = hex12[0:4] + "-" + hex12[4:12]                                    # e.g. AAAA-BBBBBBBB
check = adjacent_char_diff_sum(hex12) mapped to one character
code  = s + check + "1"                                                   # 15 chars
```

Self-consistency: 15 characters, one dash, one check character and one device-count digit leaves
12 hex characters — exactly what `[-6:]` produces. A generator therefore never needs to know the
final length in advance.

Field encoding inside the payload is a reversible per-character transform (rotate, then XOR with a
key byte that is prepended to the output), so the JSON can carry **plaintext** values: the client
encodes on write and decodes on read with matching parameters. Reproducing that transform is only
necessary if you want to read the client's own stored blobs; for signing, plaintext is enough.

## 6. Optional persistence patch

The state check has four failure exits, each storing an error code with a `mov dword [reg], imm32`.
Writing `0` into all four makes the check always succeed, so the application starts elevated
without any activation at all.

This is a **separate** intervention from the key replacement, and it is the less reliable of the
two: in the archived case some environments showed an intermittent dialogue regression. Report it
as an alternative, not as the primary route, and only after the key route is proven end to end.

## 7. Self-check list

A generator built on this analysis should assert, in this order:

1. the recovered stream has a 16-byte period (otherwise the transform is wrong);
2. re-encrypting the vendor key reproduces the original 58-byte blob byte for byte;
3. the machine code formula reproduces a code the client accepted on this machine;
4. the field encode/decode pair round-trips;
5. a freshly signed payload verifies with the patched key and fails with the original key.

Point 2 is the one that catches an off-by-one in the period alignment before it becomes a mysterious
verification failure.
