# Patch table and guard — native-islicensed-patch

Teaching values from the archived case (image base `0x140000000`). Treat every address as "where it
was", not "where it is": re-locate on your build, then substitute.

## 1. The site

| item | value |
|------|-------|
| symbol | the app's own `…::isLicensed(void)` (mangled C++ member, no arguments) |
| VA | `0x140b83910` |
| file offset | `0xB82D10` (`VA - 0x140000000 - 0x1000 + raw pointer` for a `.text` starting at RVA `0x1000`) |
| original bytes | `48 89 4c 24 08` — `mov qword [rsp+8], rcx`, i.e. spilling the `this` pointer |
| patched bytes | `b0 01 c3 90 90` — `mov al,1; ret; nop; nop` |
| original SHA-256 | `<measured hash>` |
| patched SHA-256 | `<measured hash>` |

Five bytes is the whole patch, and the reason is worth stating precisely: the stub returns before
the prologue's stack adjustment, so no frame has to be balanced. `al` is the low byte of the return
register on x64, which is all a `bool` return reads — the upper 56 bits of `rax` are don't-care for
a one-byte return type. The two `nop`s are not decoration: they keep the total length equal to the
original five bytes so nothing after the patch point moves.

## 2. Why the entry and not the tail

The original body reads an INI file, validates a payload and returns false on failure. The classic
alternative is to patch the final compare (`xor eax,eax` → `mov al,1`) instead of the entry. Both
work when the body has no side effects the caller depends on. The entry stub was chosen here
because the body's only observable effect is the return value, and patching the entry makes the
result independent of which failure branch is taken.

Rule of thumb: **entry stub if the body is pure; tail patch if the body initialises state.** If you
are not sure, you are in the second case.

## 3. Callers and call count

The gate is entered twice per start: once by the startup check, once by the window/feature setup.
Both consume the same boolean, so a single stub covers both. Verify the count on your build by
attaching and counting entries during one start — a third call usually means a periodic re-check,
which is where a "works for two minutes" report comes from.

## 4. Byte-level version detection

Patching by pattern alone will happily hit a different release that happens to share a prologue.
The archived tool classifies three outcomes before writing:

| state | test | action |
|-------|------|--------|
| already patched | bytes equal the stub | skip, report "patched" |
| original | bytes equal `48 89 4c 24 08` **and** file hash matches a known build | patch |
| unknown | bytes differ | refuse, print a warning, patch nothing |

"Refuse on unknown" is the part people drop, and it is the difference between a tool and a footgun:
on an unrecognised build the prologue may belong to a different function entirely.

## 5. Persistence and anti-rollback

The archived case pairs the patch with a guard that re-applies it, because product updates overwrite
the binary:

- a run-key entry (per-user `…\CurrentVersion\Run`) invoking the tool with a silent fix flag;
- at login the guard locates every install directory, checks the bytes at the site, re-patches only
  if the original bytes are present, and exits — idempotent by construction;
- a revert mode restores from the `.bak` copy, and an unguard mode removes the run-key entry.

Two things to copy from this, independent of whether you want the guard at all:

1. **Idempotence is a byte test, not a flag file.** A flag file lies after an update.
2. **Revert must be reachable without the tool being intact.** If the guard is the only thing that
   knows how to restore, a broken guard locks the install.

## 6. Re-locating on a new build

1. Confirm the symbol still exists and still has no arguments; if the mangled name changed, the
   class was renamed, not removed.
2. Confirm the first five bytes still spill `rcx`; a compiler update may reorder the prologue.
3. Confirm the byte range is long enough for five bytes and that no jump lands inside the range you
   overwrite.
4. Re-read one caller to confirm the return value still feeds a branch (and not, say, a tri-state
   enum).

## 7. Verification commands (shape, not paths)

```
# baseline
sha256sum <target>.exe
# before/after branch, same input
<target>.exe            → "[branch] free trial @<addr>"
<patched>.exe           → "[branch] pass @<addr>"
# read-back
xxd -s 0xB82D10 -l 5 <patched>.exe   → b0 01 c3 90 90
# self-check of the tool's own constants
python -m pytest tests -q            → 5 passed
```

The five self-tests in the archived tool are worth imitating: constants self-consistent, patch
round-trip, version recognition, sample hash, and the "buy the real thing" link present. A patcher
whose own constants are not tested is a patcher that silently writes the wrong bytes.
