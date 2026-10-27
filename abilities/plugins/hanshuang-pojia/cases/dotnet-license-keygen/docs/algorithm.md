# The check, written out

Archived case values. The salt constant is intentionally absent (see the note at the end); the
character set, lengths and hash recurrences are the algorithm and are kept.

## Constants

| name | value |
|---|---|
| character set | `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (32 characters; `0`, `1`, `I`, `O` removed) |
| key length | `192` |
| checksum position | `160` |
| checksum length | `19` |
| salt | a fixed string constant, product-related — value removed |

32 characters is not decoration: it is exactly `2^5`, which is why the checksum is read in five-bit
groups. The removed glyphs are the ones humans confuse, which is the standard argument and also a
tell that this string is meant to be read aloud.

## The three hashes

All three run over the **lower-cased** identity string, and all three produce 32-bit words.

**H1 — polynomial, multiplier 43**

```
h = 0
for c in identity:
    h = (h * 43 + ord(c)) & 0xFFFFFFFF
```

**H2 — ELF-style**

```
h = 0
for c in identity:
    h = (h << 4) + ord(c)
    g = h & 0xF0000000
    if g:
        h ^= g >> 24
        h ^= g
    h &= 0xFFFFFFFF
```

The `g` step is the whole point: without it the accumulator overflows and information is lost in a
way that is not reproducible across widths.

**H3 — four rotating rounds**

```
h = 0
j = 0
for c in identity:
    h ^= ord(c) << ((j * 8) % 32)
    j += 1
    h &= 0xFFFFFFFF
```

## Concatenation and slicing

```
v = (h1 << 64) | (h2 << 32) | h3        # 96 bits
```

Nineteen five-bit groups are read from `v`, from the top:

```
checksum = ""
for i in 0..18:
    group = (v >> (95 - 5*i)) & 0x1F
    checksum += CHARSET[group]
```

Two consequences worth stating explicitly:

- **95 of 96 bits are consumed.** The last group takes bits 4..0 of a value aligned so that its top
  bit falls outside — i.e. the final character is always drawn from the first 16 entries of the
  character set. A generator that produces a 19th character from the upper half is wrong and will
  fail on the target only.
- **The 96-bit value cannot live in a `ulong`.** `h1 << 64` is `h1 << 0` in C# and in every
  fixed-width language; the top word silently disappears and the first several characters are
  computed from the wrong bits. Use an arbitrary-precision integer, or keep three words and slice
  across the 64-bit boundary by hand.

## Key layout

```
[0 .. 159]   arbitrary characters (never checked)
[160..178]   the 19 computed characters
[179..191]   arbitrary characters (never checked)
```

Total: `160 + 19 + 13 = 192`.

The comparison is `key.Substring(160, 19) == checksum` — exact, case-sensitive, no trimming. Fillers
may be any characters; using the same character set keeps the artefact believable and avoids
surprises if a stricter build later validates the alphabet.

## The blocklist

After the checksum passes, the check computes `MD5(lower(identity) + salt)` and compares it against
**six** hard-coded digests. Six entries is not a defence; it is a list of identities someone wanted
to keep out. Report the count and the mechanism, and note what it implies: the check itself carries
no revocation channel, so the only revocation available is "ship a new build with a longer list".

## Worked example

Identity: a placeholder address, e.g. `user@example.test` (the archived run used a real-looking
address from the vendor's own domain; it is redacted here, so the three hashes below are recorded
values from that run, not values you can reproduce with this placeholder).

| step | value |
|---|---|
| H1 | `0x9F55B47B` |
| H2 | `0x00EEF05D` |
| H3 | `0x13070B6E` |
| `v` | `0x9F55B47B00EEF05D13070B6E` |
| checksum | `MXCVAYS2XVS7U6S93FR` |
| key | 160 filler + `MXCVAYS2XVS7U6S93FR` + 13 filler |

To reproduce the numbers you need the original identity string; the *method* is reproducible
without it, which is what matters for a report.

## Why this shape is worth writing down

- The check is **a checksum over public data**. Identity is not a secret (it is typed by the user),
  so the key is computable by anyone who can read the algorithm. There is no signature, no server,
  no per-purchase secret.
- 173 of 192 characters are unchecked: the key's length is theatre.
- The 95-bit checksum is not a MAC — it has no key. Six blocklist entries are the only per-identity
  state in the binary.

Together these make the finding precise: *the offline path cannot distinguish a purchased key from
a computed one, because both are the same function of the same public input.*

## Salt handling note

The salt is a real product string, so its value is not reproduced here. It does not affect the
reconstruction: everything above works with an unknown salt except the blocklist digests, which are
`salt`-keyed and therefore unverifiable without it. Record its *presence and position*
(`MD5(lower(identity) + salt)` inside the same method) and leave the value out.
