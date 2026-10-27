# Site table — offsets, bytes and per-build drift

Teaching values from the archived case (PE32, x86, five-section layout, ImageBase `0x400000`,
no relocations). Treat the offsets as evidence that drift is real, not as a table to paste: on
your target, re-derive them with the signatures.

Builds: `b10` = 6.43.10.2, `b11.2` = 6.43.11.2, `b11.3` = 6.43.11.3, `b12.3` = 6.43.12.3,
`b15.3` = 6.43.15.3.

## Drift summary

| comparison | code movement | data movement |
|---|---|---|
| b10 → b11.2 | −384 … −896 (span 512) | **+512** |
| b11.2 → b11.3 | −48 … −96 (span 48) | 0 |
| b11.3 → b12.3 | **0** (identical sites) | 0 |
| b11.3 → b15.3 | +0x184 … +0x4F0 (all positive) | **+0x648** |

Note the sign flip between sections in the same release, and the fact that b15 is not a
translation of b11 at all: its data section moves four times further than its code.

## Code and data sites

| # | meaning | b10 | b11.2 | b11.3 | b12.3 | b15.3 | expect | patch |
|:--:|---|---|---|---|---|---|---|---|
| 1 | authorisation branch (`test eax,eax`) | `0x2D7BD` | `0x2D45D` | `0x2D3FD` | `0x2D3FD` | `0x2D71D` | `85` | `33` |
| 2 | trial maximum (`and/add 0xF`) | `0x4C100` | `0x4BF60` | `0x4BF10` | `0x4BF10` | `0x4C100` | `83E00F83C00F` | `B8FFFFFF7F90` |
| 3 | fake-serial dialog A (`jz`) | `0x53F78` | `0x53DF8` | `0x53DA8` | `0x53DA8` | `0x54178` | `74` | `EB` |
| 4 | watchdog thread A (entry → ret) | `0x74920` | `0x745A0` | `0x74550` | `0x74550` | `0x74A10` | `6A` | `C3` |
| 5 | watchdog thread B | `0x753C0` | `0x75040` | `0x74FF0` | `0x74FF0` | `0x754B0` | `6A` | `C3` |
| 6 | watchdog thread C | `0x7BC00` | `0x7B890` | `0x7B830` | `0x7B830` | `0x7BAD0` | `6A` | `C3` |
| 7 | watchdog thread D | `0x7CA50` | `0x7C6E0` | `0x7C680` | `0x7C680` | `0x7C920` | `6A` | `C3` |
| 8 | watchdog-associated function | `0x834E0` | `0x83170` | `0x83120` | `0x83120` | `0x833B0` | `6A` | `C3` |
| 9 | watchdog thread E (`push ebp`) | `0x842E0` | `0x83F70` | `0x83F20` | `0x83F20` | `0x841B0` | `55` | `C3` |
| 10 | watchdog thread F | `0x131C60` | `0x131A60` | `0x131A30` | `0x131A30` | `0x131F20` | `6A` | `C3` |
| 11 | expiry forced-exit (`jnz`) | `0x91ABC` | `0x9173C` | `0x9170C` | `0x9170C` | `0x9194C` | `0F85` | `90E9` |
| 12 | online-check flag byte | `0x99A6D` | `0x996ED` | `0x996BD` | `0x996BD` | `0x99841` | `01` | `00` |
| 13 | fake-serial dialog B (`jz`) | `0xF710E` | `0xF6EDE` | `0xF6E8E` | `0xF6E8E` | `0xF71AE` | `74` | `EB` |
| 14 | trial flag + day constant (8 B) | `0x378CDC` | `0x378EDC` | `0x378EDC` | `0x378EDC` | `0x379524` | `010000001E000000` | `00000000FFFFFF7F` |
| 15 | registration-dialog suppression (**optional**) | — | — | `0x8D66D` | `0x8D66D` | `0x8D8EE` | `74` | `EB` |
| 16 | update-timer cut-off (`jne`) | `0x76C0D` | `0x7689D` | `0x7683D` | `0x7683D` | `0x76B2D` | `75` | `EB` |

Site 15 exists only from b11.3: on b10 / b11.2 the same place is handle-cleanup code, the
signature matches zero times there, and the engine must treat it as optional rather than refuse
those builds.

## Three representative semantics

**1 — authorisation branch.** `call dword ptr [<iat>]` returns the state; `85 C0 test eax,eax`
then `0F 85 … jne`. Patching `85` → `33` turns it into `xor eax,eax`, so `ZF=1`, the `jne` never
takes, and the "authorised" byte is stored unconditionally. The change is one byte and it does not
touch the call — the decision is neutralised, not the API.

**2 — trial maximum.** The sequence reads a trial flag, `neg` / `sbb` / `and eax,0xF` / `add eax,0xF`
produces 15 or 30 days, and stores it. Replacing the six bytes with `mov eax,0x7FFFFFFF` + `nop`
makes the stored value 2147483647. The arithmetic is worth reading twice: `sbb eax,eax` yields 0
or −1, so the two branches give 15 and 31-masked values, which is why the constant is `0xF` on
both sides.

**14 — data pair.** `01 00 00 00 | 1E 00 00 00` (flag 1, 30 days) becomes
`00 00 00 00 | FF FF FF 7F`. The two fields are four bytes apart, so they merge into one entry.
Cross-check the address arithmetic: the flag is read as `[0x779CDC]`, RVA `0x379CDC`, and with
`.data` at `RawPointer 0x378000` / `VA 0x379000` the file offset is
`0x378000 + (0x379CDC − 0x400000 − 0x379000) = 0x378CDC` — which is the table entry. When that
arithmetic does not land on the table, one of the three inputs is wrong.

## PE-side facts resolved at runtime

| fact | how |
|---|---|
| checksum field offset | `e_lfanew = DWORD@0x3C`; `COFF = e_lfanew+4`; `Optional = COFF+20`; field = `Optional+0x40` |
| certificate directory | `DataDirectory[4]` at `Optional+0x60` (PE32) / `Optional+0x70` (PE32+) |
| image end | `max(RawPointer + RawSize)` over the section table |
| safety gate | MZ, PE signature, section bounds, `RawPointer+RawSize ≤ file length` |

Truncation rule: drop the trailing certificate bytes only when they lie beyond the image end and
their length equals the directory's declared size. The archived defect was a fixed length carried
over from one build — on the next build it removed 10,608 bytes of `.rsrc`/`.reloc` and the loader
answered `ERROR_BAD_EXE_FORMAT` (193).

## Why the old table died

| | earlier generation | this generation |
|---|---|---|
| locating | hard-coded absolute offsets | two-state signatures |
| entries | 18 sites (incl. 3 hard-coded PE header values) | 14 sites, PE facts computed |
| builds | one | three, then five |
| changed bytes in output | 31 | 30 / 30 / 31 |
| failure mode | silent structural corruption on a new build | refusal listing the unresolved site |

The header values are the clearest illustration: writing a remembered checksum and a remembered
certificate-directory RVA works exactly as long as the build matches the memory.
