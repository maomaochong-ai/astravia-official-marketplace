# Precedent — one patch table, five builds

## When this package applies

- A patch tool must keep working across **several builds of the same binary**, published over
  months, each one a full recompile.
- The sites are stable in *meaning* (a decision branch, a watchdog thread entry, a data constant)
  but move in *address* every time.
- The binary is Authenticode-signed, so any edit invalidates the signature and the checksum.

This is not an unpacking case and not a shell case: the code is plain, the problem is entirely
address drift. If the target hides its code behind a packer, start with
[`elf-packed-loader`](../elf-packed-loader/README.md) or
[`cardkey-online-runtime-patch`](../cardkey-online-runtime-patch/README.md) instead.

## Shape of the work

1. **Build the version matrix first.** Collect every build you intend to support, with size,
   checksum, image end, section table. Write down which fields move: a `.text` growth of `0x210`
   shifts everything after it, and the data section can move the *other* way.
2. **Describe each site by meaning, not by address.** "The `test eax,eax` in front of the
   authorisation branch", "the SEH prologue of the thread whose body allocates `0x1C4` bytes".
   An address without a meaning cannot be re-derived.
3. **Generate signatures from at least three builds.** A signature fit to one build picks up
   relocation pointers and immediates that differ in the next build; fit it to the *intersection*
   of all supported builds and it survives. See [docs/signatures.md](docs/signatures.md).
4. **Anchor forward-only where functions are folded.** Identical COMDAT bodies (same first 24
   bytes, shared SEH scope table) cannot be told apart by their own prologue — anchor on the tail
   of the preceding function, and accept a short signature.
5. **Resolve PE facts at runtime, never as constants.** Checksum offset is
   `OptionalHeader + 0x40`; the certificate directory is `DataDirectory[4]`; the image end is
   `max(RawPointer + RawSize)`. A hard-coded truncation length is the defect this package exists
   to prevent.
6. **Verify with a byte whitelist, then with the same input twice.** Every changed byte must be
   in the expected set; a second run on an already-patched file must produce an identical hash.
7. **Fail closed.** If any required site does not resolve, or a signature matches twice, write
   nothing and say why.

## Traps that cost real time

- **Fuzzy matching promoted to a conclusion.** A sliding Hamming window with distance 2 looked
  like a perfect hit and was two bytes early — the data block had gained two zero-padding bytes.
  A fuzzy candidate is a *candidate*: confirm with exact expected bytes, then with disassembly
  semantics.
- **Two sites four bytes apart.** Generate one eight-byte signature, not two six-byte ones, or
  each signature contains the other and neither is unique.
- **A signature that only exists on one build.** Requiring a site that a build does not have makes
  the engine refuse that build entirely. Mark it optional and print "this version has no such
  logic" instead.
- **Truncating to a remembered length.** The old tool cut the file to a fixed size, dropped
  `.rsrc`/`.reloc` beyond the certificate, and produced `ERROR_BAD_EXE_FORMAT (193)`. Strip only
  the bytes past the image end that match the certificate directory's length.
- **Trusting the shipped checksum.** A previously published tool wrote a checksum that no
  algorithm reproduces; the target and the OS both ignore the field. Recompute it with the
  documented algorithm so the file stays well-formed — do not copy a remembered value.

## Evidence this package expects you to produce

- the version matrix, with the measured movement per section;
- for every site: meaning, signature, per-build addresses, expected bytes, patched bytes;
- the uniqueness check for each signature (exactly one match, in original and in patched state);
- the byte-diff whitelist result and a hash of the produced file per build;
- an idempotency run and at least one negative case (truncated section, no match, empty file,
  not a PE) that ended with zero bytes written;
- a statement of which builds are *not* covered, and why.

## Reading further

- [docs/method.md](docs/method.md) — order of work, decision points, where to stop.
- [docs/signatures.md](docs/signatures.md) — how a two-state signature is generated and checked.
- [docs/patch-table.md](docs/patch-table.md) — the site table with per-build offsets and bytes.
- Document library `cases/aob-signature-cross-version/` — full narrative and the tables this
  digest was written from.
