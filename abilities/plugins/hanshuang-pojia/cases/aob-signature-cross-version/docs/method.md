# Method — maintaining a patch table across builds

No addresses here on purpose: they are per-build and belong in
[docs/patch-table.md](patch-table.md). What follows is the order that keeps a cross-version tool
honest, and the judgements that decide whether it should write at all.

## 1. Declare the build set before touching anything

A patcher is only correct relative to a list of builds. Collect them first and record, for each:
file size, stored PE checksum, image end (the highest `RawPointer + RawSize`), the section table,
and the version resource. This matrix is the artifact that later proves the tool did not drift —
without it, "it works on my version" is the only claim available.

Watch the movement pattern, because it tells you what kind of recompile happened: a `.text`
virtual-size growth of `0x210` with a raw-size growth of `0x200` shifts every later section by
`0x200`, while the data section can move in the *opposite* direction in the same release. Two
builds can also be the same layout with a few bytes changed — those share offsets entirely and
should be treated as one row, not two.

## 2. Turn every address into a statement about behaviour

"Patch at `0x2D7BD`" is not knowledge. "The `test eax,eax` immediately before the branch that
sets the authorised flag" is. Write the meaning first, then find the address; the meaning is what
gets re-derived on the next build.

Each site should carry: what it decides, the instruction shape before and after, the byte change,
and the expected bytes in *both* states (original and patched). The patched-state bytes are not
decoration — they are how a tool recognises "already done" and avoids double-patching.

## 3. Find it once, with disassembly

Use a semantics-aware disassembler and record the surrounding instructions, not just the target
byte. Two payoffs:

- It distinguishes sites that look alike. Long identical prologues (same push, same shared
  exception-handling scope table) mean the function's own first bytes cannot identify it; anchor
  on the tail of the preceding function instead.
- It catches data-versus-code confusion. A data constant patched as if it were code leaves the
  program running and wrong, which is worse than crashing.

Confirm the data side with the address arithmetic explicitly:
`file offset = section RawPointer + (VA − ImageBase − section VA)`. Write the arithmetic out in
the notes; a mismatch of one section boundary is otherwise invisible.

## 4. Generate signatures against the intersection of builds

A signature fit to one build embeds immediates and relocation pointers that differ on the next
one. Fit it to the longest common byte run across **all supported builds**, in both states, and
then require exactly one match per file. Details and the merge rule for adjacent sites are in
[signatures.md](signatures.md).

If a site genuinely does not exist on some build, mark it optional. Forcing it makes the tool
refuse that build, which is worse than skipping one site and saying so.

## 5. Read the structure of the file, never a remembered constant

Three facts must come from the file itself at runtime:

- the checksum field's offset — `OptionalHeader + 0x40`;
- the certificate table — `DataDirectory[4]` (index 4 of the data directories);
- the image end — the maximum of `RawPointer + RawSize` over the sections.

The failure this prevents is specific: a tool that truncates to a fixed length computed for one
build will, on a slightly larger build, cut bytes *past* the signature and into real sections,
producing a file the loader rejects with `ERROR_BAD_EXE_FORMAT` (Win32 193). Stripping a signature
means: zero the directory entry, then drop only the trailing bytes that lie beyond the image end
and whose length matches the directory's size.

Recompute the checksum with the documented algorithm after all edits and the truncation. Do not
copy a value from a previous release: at least one published tool shipped a checksum that no
algorithm reproduces, which is harmless only because nothing checks it.

## 6. Verify in four layers

1. **Per site** — read back the bytes and compare with the expected patched state.
2. **Whole file** — every changed byte must be in the expected set. A diff outside that set means
   your signature matched the wrong place.
3. **Idempotency** — run the tool twice; the second run must either refuse (already patched) or
   produce a byte-identical file.
4. **Regression** — after adding a build to the matrix, re-run the older builds and confirm their
   output hashes are unchanged. An engine upgrade that silently changes yesterday's artefact is a
   defect, even if the new artefact also works.

## 7. Fail closed, and say what stopped you

The tool writes nothing unless every required site resolved exactly once, the PE gate passed, and
the whitelist diff is clean. Everything else produces a refusal listing what failed: which site,
which signature, how many matches, which check.

This is the single highest-value behaviour in the whole package. A partial write to a several-
megabyte binary is not a failed experiment, it is a destroyed sample.

## 8. Stop conditions

- Two different signatures resolve to the same address → the sites were described ambiguously;
  go back to step 2 rather than loosening the match.
- A site moves by an amount that no section shift explains → a different compile unit or a
  changed function body; re-read the disassembly instead of sliding the window.
- A fuzzy candidate is confirmed only by its Hamming distance → keep looking. Distance is a
  ranking, not a proof.
