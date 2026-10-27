# State machine, patch table and registration format — proxy-dll-license-state-machine

Teaching values from the archived case: build **28.40.0100**, x64, image base `0x140000000`,
37.5 MB, no digital signature, window class `ThunderRT6FormDC` (twinBASIC-recompiled runtime). The
previous build **28.30.2600** is listed alongside because the same source compiled twice is the best
available check on whether an offset is structural or accidental.

Everything below is a *derived address*, not sample bytes: on another build, relocate with the
predicates in the last section instead of reusing these numbers.

## 1. Global map

| Global | 28.40 RVA | 28.30 RVA | Type | Meaning |
|---|---|---|---|---|
| licence level | `0x22FD724` | `0x22E4D5C` | int | `0` = trial, `1..5` = tier (`xy01..xy05`), `5` = permanent |
| version-coverage flag | `0x230170C` | `0x22E8D44` | int | `1` covers this build, `2` does not cover an upgrade, `0` = forced |
| **activation state word** | `0x230CDEA` | — | word | `0xFFFF` = trial, `0x0000` = activated |
| licensee name | `0x2235A88` | `0x221CEF8` | wide string | shown in the about panel |
| key copy 1 / 2 | `0x2281C70` / `0x21FDDE0` | `0x22694A0` / `0x21E52F0` | wide string | two copies, both displayed |
| string allocator, host IAT slot | `0x2675408` | `0x265E408` | pointer | `OLEAUT32!SysAllocString` |
| coverage precheck word | `0x23ACDEA` | `0x22F434A` | word | early gate on the upgrade path |

Reader counts matter more than names: the level int had 18 cross-references, the coverage flag 33,
and the state word exactly one writer plus the feature gates. That distribution is what identifies
the gate.

## 2. The writer

```
0x670CA4   mov   ax, word [rsp+0x308]      ; loader's return value: -1 success, 0 failure
0x670CB1   not   eax                       ; ★ -1 -> 0 (activated), 0 -> 0xFFFF (trial)
0x670CB9   lea   rax, [rip+0x1C9C12B]      ; -> 0x230CDEA, the state word
0x670CBF   mov   word [rax], dx
```

Two fallback writers mark the same word as trial, each with its own trigger:

| Site | 28.40 | 28.30 | Trigger |
|---|---|---|---|
| early skip | `0x670BFF` | `0x66FBB8` | a global flag's bit `0x10` is clear, so the registration loader is never called |
| empty registration | `0x670CD5` | `0x66FC8E` | `[Register]` name or code length is not positive |

Both write the immediate `66 C7 00 FF FF` (`mov word [rax], 0xFFFF`).

## 3. Patch table (final set, 4 sites)

| # | 28.40 RVA | original | patched | effect |
|---|---|---|---|---|
| 1 | `0x670CB1` | `F7 D0` | `31 C0` | `not eax` → `xor eax,eax`: the state word is always `0x0000` |
| 2 | `0x670BFF` | `66 C7 00 FF FF` | `66 C7 00 00 00` | early-skip branch writes "activated" instead of "trial" |
| 3 | `0x670CD5` | `66 C7 00 FF FF` | `66 C7 00 00 00` | empty-registration branch likewise |
| 4 | `0x15E2A47` | `44 8B 5C 24 7C` | `E9 40 00 00 00` | about-panel tier branch jumps unconditionally into the permanent tier |

28.30.2600 equivalents: `0x66FC6A`, `0x66FBB8`, `0x66FC8E`, `0x15CEA84`. The first three are
structurally identical instruction sequences; the delta between builds is `-0x1039` at these sites,
which is a build artefact, not a rule.

## 4. Superseded sites (kept as the counter-example)

These were shipped in earlier iterations and are the reason the case exists — each one looked like
progress and none of them moved the state word:

| 28.40 RVA | original | patched | what it changed |
|---|---|---|---|
| `0x859AE7` | `0F 84 37 06 00 00` | `E9 38 06 00 00 90` | short-circuits the title-bar trial text |
| `0x64699D` | `6A 42 4C 8D 1D …` | `6A 00 4C 8D 1D …` | sets the trial-banner string length to 0 |
| `0x646AD3` | `68 80 01 00 00 …` | `6A 00 90 90 90 …` | removes the "not freeware" wording |
| `0x22FD724` | `00 00 00 00` | `05 00 00 00` | forces the level int to the top tier (display only) |
| `0x230170C` | `00 00 00 00` | `01 00 00 00` | forces the coverage flag |

Five sites, no change in behaviour beyond cosmetics. Reproduce this table in the report: it is the
clearest evidence that the display globals are not the gate.

## 5. Weak comparison that sets the level

The registration loader's entry is `0x66A600`, signature roughly `func(name, code)`. It holds a
literal pool of the tier prefixes at `0x21B3A44` (`xy01 xy02 xy03 xy04 xy05`) and compares each in
turn with `CompareStringXxx(..., 0x30001, ...)` — `0x30001` being
`NORM_IGNORECASE | NORM_KANATYPE | NORM_WIDTH`. On a hit it stores the tier:

| Comparison block | Stores |
|---|---|
| `0x66A750` | level 1 |
| `0x66A7CD` | level 2 |
| `0x66A84D` | level 3 |
| `0x66A8BC` | level 4 |
| `0x66A93C` | level 5 |

No signature, no checksum, no HMAC, no network receipt. A four-character prefix decides the tier,
which is why the level int can be produced locally — and why producing it does not activate the
product.

## 6. Version-coverage decision

`0x670D0D` (28.30: `0x66FC95`) computes the coverage flag:

- level 3 or 4 → `2` (does not cover an upgrade);
- parsed version `< 0x7E7` or `== 1` → `1`;
- otherwise → `0`.

The version comes from the ninth segment of the key text, so the key's own text participates in a
decision — one more reason the format below matters.

## 7. Registration key format

Observed shape (28.40): `xy05-<seats>-<4 hex>×5-<repeat of segment 3>-<major.minor>`

Example: `xy05-0100-D0F0-3970-185A-1963-A172-D0F0-28.40`

- segment 1 `xy05` → level 5;
- segment 2, four hex digits → seat count (`0100` = one seat; missing or non-hex → 0);
- segments 3–7 → free filler;
- segment 8 repeats the first filler segment, matching the host's own encoder output;
- segment 9 must equal the host's major.minor (`28.40`, `28.30`).

Native about-panel rendering: tier line, licensee name, key, seat line ("1 user, non-transferable"),
validity line ("applies to all future versions").

## 8. Injection timing (proxy-DLL delivery)

If the change ships as a proxy DLL, the sequence is the whole reliability story:

1. host reaches steady state — about **3 s**, verify rather than sleep;
2. allocate the wide strings through the **host's own** `SysAllocString` slot (`0x2675408`), so
   ownership matches the host's `SysFreeString`;
3. write the two string globals and the level/coverage ints;
4. retry at most **4 times, 2 s apart**, then stop.

Failure modes measured: writing during load → `0xC0000374` (`STATUS_HEAP_CORRUPTION`) because the
host overwrote the slot with its own allocation; unbounded retry → heap growth and
`0xC0000005` within about 20 s.

## 9. Scenario table to reproduce

| Scenario | level `0x22FD724` | coverage `0x230170C` | state word `0x230CDEA` | Title bar |
|---|---|---|---|---|
| untouched, empty `[Register]` | `0` | `1` | `0xFFFF` | `### 30 - 天试用版本 - 第 1 天 ###` |
| `[Register]` filled only | `5` | `1` | `0xFFFF` | same trial text — **not activated** |
| patches 1–3 | `5` | `1` | `0x0000` | clean |
| patches 1–4 | `5` | `1` | `0x0000` | clean + permanent tier in the about panel |

Row 2 is the important one: a filled registration block raises the level and still leaves the
product in trial. Any method that stops at row 2 has measured the wrong variable.

## 10. Relocating on another build

Do not reuse the offsets. Re-derive:

- **state word** — search for the store pattern `66 C7 00` preceded by a `not` on a value loaded
  from the stack, near a `lea r64, [rip+…]` that resolves into `.data`. Confirm by the two
  `66 C7 00 FF FF` siblings within a few hundred bytes.
- **fallback writers** — the same immediate, and each is dominated by a test on a global bit
  (`& 0x10`) or on a string length.
- **about-panel branch** — the only place that compares the level int against the top tier in a
  display path; the original five bytes are a `mov` of a stack slot that is then branched on.
- **tier comparison** — the imported `CompareString`-family symbol with `0x30001`, plus the literal
  pool of `xy0N` prefixes; the five stores follow in order.

Verify each relocation twice: against the previous build for structural identity, and against the
running process for the value it actually holds.

## 11. Limits

- The 28.30 delta `-0x1039` was observed at these sites only; it does not generalise to the image.
- The seat count and validity text are parsed from the key's text segments, so their display is not
  evidence that the entitlement was verified.
- Whether a later build adds a signature over the registration block was not tested; if it does,
  the state word stops being four bytes away from an answer.
