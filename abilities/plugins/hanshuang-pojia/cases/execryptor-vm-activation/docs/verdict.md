# The verdict: one status value, one redirect, and what it costs elsewhere

Teaching values from the archived case (PE32+ x64, main program ~6.4 MB, helper runtime ~460 KB,
ImageBase `0x140000000`). Re-derive on your target; the shape is what transfers.

## The status mapping

| `result` | meaning | branch in the main program |
|---|---|---|
| `0` | failure | store failure, show the failure message |
| `2` | expired | store expiry, same failure path |
| `3` | success | write registration values, normalise licence type |

Only `3` reaches the write path. Everything else is indistinguishable to the caller.

## The site

```asm
0x140009E0F  E8 B4 4A 2D 00   call 0x1402DE8C8      ; parse the status document → integer
0x140009E14  ...              ; the returned integer is tested a few instructions later
```

The callee is a general-purpose "read integer from the parsed document" helper — it is called from
several places, so patching *it* would change unrelated behaviour. Patch the call site instead:

```asm
0x140009E0F  E8 0E 78 F9 FF   call 0x140001622      ; → stub
```

Stub, placed in a `0xCC` padding region of `.text` (found by scanning for a run of `CC` after the
last function of the section):

```asm
0x140001622  B8 03 00 00 00   mov eax, 3
0x140001627  C3               ret
```

Seven bytes, no stack usage, same return register. The two `call rel32` displacements differ only
because the targets differ; the patched bytes are a pure address recomputation, not hand-assembly.

## Why this and not something else

| alternative | why it is worse |
|---|---|
| patch the comparison instead | works, but the value is still produced by a call you do not control; two sites to keep in sync |
| patch the general "read integer" helper | it is shared — unrelated reads return `3` and break other screens |
| skip the whole function with `ret` | the caller expects a struct to be filled; skipping leaves it uninitialised |
| disable the helper | it performs start-up work; the main program exits within a second |
| attack the VM | unbounded; the verifier is a bytecode interpreter |

## Side effects, enumerated

A verdict patch changes what the program believes about itself. Screen by screen:

| surface | reads | after the patch |
|---|---|---|
| registration dialog | `result == 3` | closes as success |
| start-up check | registration values in the registry | success **only if those values exist** |
| about / registration display | the display name from the response | **empty** — the patch never supplied one |
| licence type | the normalised type field | canonical value; the struct-clear-then-write order must be intact |
| portable build | licence types `998` / `999` | not applicable — different activation channel |

Two consequences worth stating explicitly in a report:

1. **An empty name field is not a failed patch.** The decision changed; the data was never there.
   Write the two registry values yourself if the display matters for the acceptance test.
2. **The start-up check is a different function.** It reads persisted values, has its own trial
   logic (30 days) and its own clock-rollback detection (a stored timestamp compared against the
   current time, with distinct messages for "clock moved back" and "clock is earlier"). A patch on
   the interactive path alone leaves it untouched.

## Verification

| check | expected |
|---|---|
| read-back at the call site | `E8 0E 78 F9 FF` |
| read-back at the stub | `B8 03 00 00 00 C3`, remaining padding still `CC` |
| interactive activate with an invalid serial | dialog closes as success |
| start-up after writing the two registry values | reports registered |
| process still has its helper attached | yes — the patch does not disable it |
| file hash before / after | identical if patching memory; changed only at the two sites if patching a copy |

The archived case reported the tool's own verifier returning `is_patched=True` and a test harness
passing all assertions on a patched copy — worth reproducing as a self-check, but not a substitute
for the two behavioural rows above.

## What stays unproven

- The signature check itself. The VM stub was identified, not reversed. Any claim about *how* a
  serial is validated would be `[inferred]` at best.
- Whether the service-side response is signed. The plaintext channel and the client's willingness to
  trust an integer suggest not, but that is a property of the service, not of this binary.
- Long-run stability beyond the observed session. A verdict patch does not remove the periodic
  status query; if the runtime ever pushes an expiry downward, the next query returns `2` again and
  the patch is bypassed at a later call site. That is the reason to prefer patching the *parse*
  boundary rather than one comparison.
