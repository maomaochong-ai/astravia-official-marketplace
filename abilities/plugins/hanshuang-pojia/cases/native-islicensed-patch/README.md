# Precedent — a single bool-returning symbol as the entire gate

## When this package applies

- A native desktop application (Qt, MFC, plain Win32) whose entitlement state is read once per
  start and returned as a boolean from **one** function.
- The binary is **not** packed, or is packed in a way that still lets you write to the image on
  disk; there is no self-integrity check over `.text`.
- The decision is local: no signature over a server response, no key material you would have to
  forge.

Not this shape:

- a signed credential you would have to mint → [`ed25519-offline-keygen`](../ed25519-offline-keygen/README.md)
  or [`rsa-blob-machine-code-keygen`](../rsa-blob-machine-code-keygen/README.md);
- the code only exists after decryption, or the section is RWX at runtime →
  [`cardkey-online-runtime-patch`](../cardkey-online-runtime-patch/README.md);
- the gate is a check inside a managed VM or an obfuscated delegate graph →
  [`eazfuscator-vm-minimal-patch`](../eazfuscator-vm-minimal-patch/README.md).

## Shape of the work

1. **Enumerate symbols before disassembling.** A demangled C++ symbol that reads like a yes/no
   question (`…::isLicensed(void)`, `…::hasPro(void)`) is the shortest path into the system. Confirm
   its byte range, not just its name.
2. **Find every caller.** Two call sites at startup is normal — one for the UI banner, one for the
   feature gate. A patch that covers one and not the other produces "activated" with features still
   missing, or the reverse.
3. **Prove the gate is single.** Cheap proof: patch only the entry, restart, and see whether any
   path still reports unregistered. If something else also decides, it will show up here, not later.
4. **Read what the function does before replacing it.** If it also initialises state that later
   code reads, an early `ret` leaves that state zeroed. That is the failure that arrives minutes
   later as an unrelated crash.
5. **Write the stub and check the frame.** `mov al,1; ret` at the entry needs no stack frame, so it
   is safe even though the original prologue saved registers. Verify the following bytes are
   harmless padding, or `nop` them.
6. **Restart, don't just re-run.** The decision usually also writes to an INI or registry; a
   patched run must survive a clean start with the stored state untouched.
7. **Plan the rollback before the guard.** Keep the original bytes and hash, and know how to put
   them back. A persistence mechanism is a second artefact people forget to document.

## Traps that cost real time

- **Analyser time is the trap.** Full auto-analysis on a 27 MB Qt binary is slow and fragile. A
  deterministic scan — parse section table, resolve target string VAs in `.rdata`, find
  `LEA r64,[rip+disp32]` references, linear-disassemble only around them — finishes in seconds and
  is reproducible on the next build.
- **Calling convention on x64.** The first integer argument arrives in `rcx`, and a prologue that
  stores it (`mov [rsp+8], rcx`) is not "unused". Overwriting those bytes is fine only because the
  stub returns before anything reads the slot.
- **The trial branch is not a separate gate.** Free-trial and paid both come out of the same
  return value; patching a "trial expired" message does nothing.
- **Version drift.** Hash the file and compare against a known build; byte-match alone will happily
  patch a different release that happens to share a prologue.
- **Persistence side effects.** A run-key or scheduled-task guard rewrites the patch on login. If
  you do not notice it, your revert silently undoes itself.

## Evidence this package expects you to produce

- the symbol table rows that justify the entry point (name, VA, file offset);
- the callers, with the number of calls per start;
- original bytes, patched bytes, and a read-back after writing;
- a branch log from an unpatched run and a patched run, same input, showing the branch target
  changed;
- a restart-persistence run and a stability run with the gated feature exercised;
- the exact rollback steps, including anything that would re-apply the patch.

## Reading further

- [docs/method.md](docs/method.md) — order of work, and the criteria that end each step.
- [docs/patch-and-guard.md](docs/patch-and-guard.md) — patch table, stub semantics, version
  detection, persistence guard, revert.
- Document library `cases/native-islicensed-patch/` — the evidence chain and the patch plan this
  digest was written from.

## Tools

`tools/bool_stub_scan.py` finds the shapes a boolean gate returns with: `mov eax, 0; ret`,
`xor eax, eax; ret`, and on AArch64 `mov w0, #0; ret`, together with their true-return
counterparts so a hit can be classified instead of assumed.

```bash
python3 tools/bool_stub_scan.py --sample target.exe
python3 tools/bool_stub_scan.py --sample target.exe --table findings/
python3 tools/bool_stub_scan.py --self-test
```

It prints a hit table with section, RVA and file offset, then a patch row per false-return
stub. The patch is equal-length by construction: the immediate inside `mov eax, imm32` is
flipped from `00 00 00 00` to `01 00 00 00`, so the file keeps its size and nothing shifts.
`xor eax, eax; ret` is reported but not patchable in place, and the report says so rather
than inventing a longer stub that would not fit.

Rows are emitted only for the image's own architecture. A patch row that cannot apply is
worse than no row, because it looks like a plan.

`--table` writes `patch-table.txt` in the `address | original | patched | note` form that
`hpkit.patch.parse_table` reads back, so the table can be checked, applied and rolled back by
the same primitives that produced it.
