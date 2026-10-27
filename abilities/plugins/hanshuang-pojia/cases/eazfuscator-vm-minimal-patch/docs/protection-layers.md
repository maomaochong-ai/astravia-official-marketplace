# Protection layers — the algorithms, in the order they run

Everything here is a reproduction of what the obfuscator built, written so a reader can re-derive it from the
file instead of trusting the numbers. Offsets and constants are the ones observed in the source engagement;
identifiers of the target build are redacted, the maths is not.

## 0. Layer inventory

| layer | mechanism | restoration |
|---|---|---|
| L1 | symbol renaming | decompile; read the IL |
| L2 | string encryption | call the client's own decryptor at runtime |
| L3 | assembly code encryption | reproduce keystream derivation statically |
| L4 | code virtualisation | separate the container into three layers |
| L5 | custom symmetric cipher | recover parameters, verify with vectors |
| L6 | anti-debug / anti-dump | in the source engagement: no effective block |

## 1. L2 — strings

Do not un-flatten the decryptor. Reflect over the assembly, find the static `string Decrypt(int id)`, and walk
`id` over its space. Result in the source engagement: **7,806 / 7,806** recovered.

Load each build in its own process — identical assembly identity means `Assembly.LoadFrom` hands back the
already-loaded instance.

## 2. L3 — assembly code encryption

### 2.1 Identifying the target section

```
product = u32(sectionName[0..4]) * u32(sectionName[4..8])

product == 0x65452714      → the encrypted section
product != 0, != magic     → participates in the key seed (anti-tamper input)
```

A section name that hashes to a magic product is not a name at all — it is a tag. Look for the section whose
name is random bytes, then confirm by the product.

### 2.2 Seed evolution over other sections' content

```
num5..num8 = 1758353659, 186699061, 1283470176, 872273121      // initial seeds

for each dword v in every non-empty, non-target section:
    nv = (num5 ^ v) + num6 + (num7 * num8)                     // 32-bit wrapping
    num5, num6, num7, num8 = num6, num7, num8, nv
```

Sixteen keystream words are then expanded, interleaved with rotations:

```
for j in 0..15:
    arr[j]  = num8;  arr2[j] = num6
    num5 = ROL(num6, 27); num6 = ROL(num7, 29)
    num7 = ROL(num8, 25); num8 = ROL(num5, 21)

for i in 0..15:
    arr[i] = arr[i] XOR arr2[i]   if i % 3 == 0
    arr[i] = arr[i] *   arr2[i]   if i % 3 == 1
    arr[i] = arr[i] +   arr2[i]   if i % 3 == 2
```

### 2.3 Per-dword decryption, and the property that makes patching safe

```
plain      = cipher ^ ks[i & 15]
ks[i & 15] = (ks[i & 15] ^ plain) + 1204611781        // feedback uses PLAINTEXT
```

Because the state advances on plaintext, encryption is the same loop with the sides swapped. Decrypt the
section, change four bytes, re-encrypt: the output is byte-identical to the input everywhere else. No length
change, no metadata change, nothing for a size or entropy check to notice.

### 2.4 The anti-tamper, and its failure mode

The keystream depends on the *other* sections, so editing `.text` or `.rsrc` makes the target section decrypt
to garbage. In the source engagement, garbage decryption did **not** stop execution — the app ran with wrong
behaviour. That is fail-open tamper detection: the mechanism is right, the enforcement is missing.

## 3. L4 — virtualisation, three separable layers

### 3.1 Container

```
resource (754,692 B)
  ├─ layer 1: RSA-2048 / PKCS#1 v1.5, block-wise
  ├─ layer 2: positional stream XOR
  └─ layer 3: name → offset tokenisation (method addressing)
```

### 3.2 Layer 1 — RSA envelope

```
n = a1 (128 B FieldRva) ‖ Base64Decode(embedded string) (128 B)
e = 65537
block = 256 B, plaintext = 245 B per block (PKCS#1 v1.5, fixed 8-byte padding)
2948 × 245 = 722,260 B
```

All 2,948 blocks validate with padding length exactly 8 — the signature of a fixed build-time chunking
strategy, and a useful confirmation that the modulus is the right one.

Only the public key is present, so **you cannot re-encrypt**. Modifying VM bytecode requires substituting
your own keypair: replace `a1` (128 B, lives in the encrypted section, so the L3 patch capability applies),
replace the embedded base64 string **at exactly the same length**, re-encrypt with your private key, and
overwrite the resource in place with identical size.

### 3.3 Layer 2 — positional stream XOR

```csharp
this.seed = seedArg ^ -559030707;          // source engagement: 1822868938 → 0xB20B1B87

byte DecryptByte(byte b, uint pos) {
    byte k = (byte)((uint)this.seed ^ pos);
    return (byte)(b ^ k);
}

int Read(byte[] buf, int off, int count) {
    uint pos = (uint)this.Position;        // absolute offset in the underlying stream
    int got  = this.stream.Read(buf, off, count);
    for (int i = off; i < off + got; i++) buf[i] = DecryptByte(buf[i], pos + (uint)(i - off));
    return got;
}
```

Python equivalent:

```python
seed = (1822868938 ^ (-559030707 & 0xFFFFFFFF)) & 0xFFFFFFFF   # 0xB20B1B87
plain = bytes(c ^ ((seed ^ i) & 0xFF) for i, c in enumerate(cipher))
```

Effect on the payload in the source engagement: entropy 7.9997 → 6.7565, printable strings 6,161 → 7,107.

### 3.4 Layer 3 — the method name *is* the offset

Each virtualised method has a managed stub:

```csharp
public bool SomeProperty {
    get {
        object[] a = new object[1] { this };
        return (bool)VM.Instance.Dispatch(VM.Stream, "<unreadable token>", a);
    }
}
```

The token is not random. Decode it:

```
token
 ├─ (1) Ascii85: alphabet '!' (33) .. 'u' (117), 5 chars → 4 bytes big-endian,
 │            'z' = all-zero group, K = {85⁴, 85³, 85², 85, 1}
 ├─ (2) positional stream XOR (seedArg = 1485391981, same scheme as 3.3)
 ├─ (3) scrambled ReadInt64:
 │            low  = (a7<<8) | (a2<<24) | a0 | (a1<<16)
 │            high = (a5<<24) | (a6<<16) | a4 | (a3<<8)
 │            value = (high << 32) | low
 └─ (4) → offset into the VM stream → method record
```

It is fully reversible: after the XOR the eight bytes are a fixed permutation of the little-endian offset —

```
a[0]=b0  a[7]=b1  a[1]=b2  a[2]=b3  a[4]=b4  a[3]=b5  a[6]=b6  a[5]=b7
```

so you can generate a valid token for **any** offset and reproduce the original token byte for byte.

**Why this matters more than the ISA.** A virtualised call's target is selected by a short string. Rewriting
that string redirects the call to any other virtualised method — no private key, no interpreter. That is the
economically interesting attack on this scheme; recovering the instruction set is the expensive one.

### 3.5 Method records and instruction encoding

```
+0x00  18-byte record header (signature / type description)
+0x12  [1 byte length][method name ASCII]
+…     [u32 code length][code area]
```

Instructions are fixed 4-byte tokens with randomly permuted opcodes. Identified in the source engagement:

| token | inferred semantics | evidence |
|---|---|---|
| `0x42487a8f` | `ret` | last instruction of nearly every method |
| `0x5d914689` | `ldarg.0` / `ldfld` | first of 12-byte methods; second of property getters |
| `0xb4f09a23` | `ldarg.0` (reference `this`) | first of reference-type methods |

A 12-byte constant getter is therefore `89 46 91 5d | XX XX XX XX | 8f 7a 48 42`.

Recovery result: 722,260 bytes of VM bytecode in cleartext, 3,917 member records, 7,107 printable strings —
in practice the whole semantic surface, without a full ISA.

## 4. L5 — the custom symmetric cipher

| parameter | value |
|---|---|
| block | 32 bit |
| key | **80 bit** |
| mode | ECB, no padding |
| rounds | **12** |

Round function (S is a 256-byte table initialised from a `FieldRva`):

```
hi = v >> 8;  lo = v & 0xFF
b5 = S[lo ^ key[(4·sum + 0) % 10]] ^ hi
b7 = S[b5 ^ key[(4·sum + 1) % 10]] ^ lo
b8 = S[b7 ^ key[(4·sum + 2) % 10]] ^ b5
b9 = S[b8 ^ key[(4·sum + 3) % 10]] ^ b7
→ (b8 << 8) | b9
```

Schedule:

```
encrypt: delta = +1, sum = 0
decrypt: delta = -1, sum = 23

for i in 0..11:
    v1 ^= F(key, sum, v0) ^ sum;  sum += delta
    v0 ^= F(key, sum, v1) ^ sum;  sum += delta
```

Cascaded five deep, each stage keyed by 10-byte key + 4-byte IV (70 bytes total) from
`DeriveBytes(password, salt, iterationCount: 1)`.

This cipher protects the **business data channel**, not the VM container — a useful distinction when you are
deciding which layer a given blob belongs to. Getting it wrong sends you looking for an AES key that does not
exist.

## 5. Layer interaction, as a checklist

1. Which section is tagged `0x65452714`? (L3 target)
2. Does the keystream reproduce from the *other* sections' content? (proves L3 understood)
3. Does decrypt→re-encrypt return an identical file when no byte is changed? (proves the patch route)
4. Do the strings come out by reflection, in a fresh process per build? (L2)
5. Is the container 2,948 × 245 bytes, and does every block validate with padding 8? (L4 layer 1)
6. Does the positional XOR raise printable strings from ~6.2k to ~7.1k? (L4 layer 2)
7. Can you encode an arbitrary offset back into a token? (L4 layer 3 — the real lever)
8. Is the gate you care about actually virtualised? (usually not — check before investing in the ISA)
