# Algorithm — CNG blob, request string, sliding window, patch targets

Teaching values from the archived case. The `CONST` literal and the full modulus have been removed;
layout, offsets, lengths and the verification arithmetic are kept so the analysis can be replayed.

## 1. Public key blob

The component embeds a **CNG** public blob (not a CryptoAPI `RSA1` blob — the field order differs):

```
offset  size  field
0x00    4     magic "RSA1"
0x04    4     bit length
0x08    4     cbPublicExp   = 3
0x0C    4     cbModulus     = 128
0x10    4     cbPrime1      = 0
0x14    4     cbPrime2      = 0
0x18    3     exponent      = 01 00 01        (e = 0x10001)
0x1B    128   modulus       (1016-bit value; truncated in the archive, value removed here)
```

| item | value |
|------|-------|
| x64 component | file offset `0xA3160` |
| arm64 component | file offset `0xB1FB0` |
| modulus size | 1016 bits (127 bytes significant, 128-byte field) |
| exponent | `0x10001` |
| small factor found | 2663 (by trial division) — leaves a ~1005-bit cofactor |

Locate it again with the magic plus a plausible bit-length field; do not trust the offsets above on
another build.

## 2. Request string

```
R = LicenseHash + md5hex(A) + md5hex(B)      → 96 hex characters
  LicenseHash : md5hex(user key) as stored in the licence registry value (32 chars)
  A           : machine identifier #1 (SMBIOS string, with a fallback source), word-swapped
  B           : machine identifier #2 (volume/serial style UUID, "RSMB" Type-1 form)
  md5hex(x)   : MD5(x) formatted as 32 lowercase hex characters
```

Notes:

- `LicenseHash` is migrated on first run: the stored default value, if longer than 0x1e characters,
  is replaced by `md5hex(current value)`. Both shapes exist in the wild, so a producer must accept
  either.
- The fallback identifiers used when A/B are unavailable are fixed placeholder strings
  (`xxxx xxxx` / `yyyy yyyy` in the archive). Reproducing them is what makes the output identical on
  a machine with no SMBIOS access.
- The UI sends the same 96 characters to the activation endpoint, so an activation request captured
  from the wire is a free oracle for your reproduction.

## 3. Signed block

```
P  = R[0:32] + (CONST | R[32:96]) + "SABALL" + pad(0x00)      → 128 bytes
P[0:32]      = LicenseHash
P[32:96]     = CONST, a 64-hex constant (64 ASCII chars)      ← value removed
   or        = md5hex(A) + md5hex(B)                          (alternative accepted shape)
P[96:102]    = "SABALL"
P[102:128]   = zero padding
sig = P^d mod n
ActivationData = base64(sig)
```

`CONST` lives in `.rdata` at VA `0x1800A3E90`, 64 characters. It participates in the signed payload
exactly like a salt, so its value is not reproduced here; the length, the VA and its position in the
template are what you need to re-locate it.

## 4. Verification

```
block = base64decode(ActivationData)^e mod n        (BCryptImportKeyPair + BCryptEncrypt)
for o in 0 .. 0x1b:                                  # 28 offsets, step 1
    block[o   : o+32 ] == LicenseHash
and (
      block[o+32: o+96 ] == CONST
   or block[o+32: o+64 ] == md5hex(A)  and  block[o+64: o+96] == md5hex(B)
)
and block[o+96: o+102] == "SABALL"                    # immediate 0x41424153 / 0x4C4C, little endian
→ activated (verify returns 1 and writes '1' to the status byte)
```

Three things to keep in mind when reading a decompiler's output: the "block" is **one** 128-byte
buffer that appears as a dozen locals (`local_b8`, `local_98`, …); the loop bound is `0x1b`
inclusive of 27 offsets; and the two middle shapes are alternatives, not both required.

## 5. Trial clock

```
install_stamp = last-write time of the registry key
                HKCU\...\Explorer\CLSID\{ md5hex("<product>" + "<group>") - 1 - 31 - 9 }
trial_days    = 100
skip expiry  if now < install_stamp          (clock rollback tolerated)
             or year(now) >= 2028            (fixed horizon)
```

Both conditions are bypasses by design: a timestamp anchored to a registry key's write time moves
with the clock, and a fixed year guarantees a permanent expiry waiver after that date.

## 6. Patch targets

| target | what it is | shape of the change |
|--------|------------|---------------------|
| verify export (`Ordinal_102`) | the routine described in §4 | force the activated return path; keep the status byte write |
| trial checks (`Ordinal_100/101`) | expiry evaluation | neutralise the expiry branch, not the return value |

The archived engine applies the verify-entry patch and then verifies by **calling the ordinal
directly** from a harness: return value `1`, status byte `'1'`. That is the acceptance test — it
does not depend on the UI at all.

Anti-rollback: a guard service re-applies the patch after an update, keyed on a byte test (is the
original still there?), with an explicit restore path back to the `.bak` copy.

## 7. Why the keygen route is closed

| route | status |
|-------|--------|
| user key contains a self-check segment (like the 19-character check string in the .NET case) | absent — the key is not self-validating |
| forge activation data with the embedded public key | impossible by construction (needs the private exponent) |
| factor the modulus | 1016 bits, small factor 2663 found, cofactor ~1005 bits — infeasible |
| supply activation data produced elsewhere | needs the private key |

So the surviving route is local reproduction of `R` (so activation data can be produced for a
machine you control) plus a patch at the verify entry. That is a route with a real limitation — it
touches the client, not the signature.

## 8. Self-check list

1. blob parses with `cbPublicExp == 3`, `cbModulus == 128`, `e == 0x10001`;
2. the reproduced `R` equals a value the client itself computed (captured, not derived);
3. `md5hex` output is lowercase and exactly 32 characters for the known input;
4. trial-stamp key name reproduces the client's own key name;
5. direct ordinal call returns `1` and the status byte is `'1'` on the patched component, `0`/other
   on the original.
