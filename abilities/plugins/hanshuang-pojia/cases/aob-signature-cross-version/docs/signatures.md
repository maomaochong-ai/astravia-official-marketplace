# Two-state signatures that survive a recompile

A signature here is not "the bytes at the patch site". It is the shortest byte run that is
**identical across every supported build, in both the original and the patched state, and unique
within each file**. Four requirements, one artefact.

## Why one build is not enough

Fitting a signature to a single build embeds things that are true only for that build:

- relocations and absolute pointers (`.data` references, import thunks) change when a section
  moves;
- immediates that happen to be addresses differ by exactly the section shift;
- padding and alignment differ per compile.

The observed symptom is a signature that hits 13 of 14 sites on the next build, and the one that
fails is the one whose run included a pointer. The fix is structural, not a bigger window: take
the **intersection** over the builds you support. In the archived case that reduced a 50-byte
common run to 46 bytes — and made it stable.

## Two states, not one

Generate each signature in the original state *and* in the patched state, and require exactly one
match of each in the corresponding file. This buys three things at once:

- **uniqueness** — a signature that matches twice cannot identify a site;
- **idempotency** — the patched-state signature is how the tool recognises "already done" instead
  of patching twice and corrupting the result;
- **drift detection** — a file that matches *neither* state is a build you have not characterised.

The check to run, per site, per build: original signature matches exactly once in the pristine
file; patched signature matches exactly once in the produced file; and the offset difference
between the two matches equals the length of the changed run.

## Adjacent sites merge into one signature

Two data sites four bytes apart (`01 00 00 00 1E 00 00 00` patched to `00 00 00 00 FF FF FF 7F`)
cannot each have their own six-byte signature: each one's window contains the other's change, so
neither is unique and neither matches after the other is applied. Merge them into a single
eight-byte entry. The rule generalises: **if two changed runs overlap or touch, they are one
signature**, regardless of how they are described in the notes.

## Short signatures are legitimate when they are anchored

Identical COMDAT bodies defeat prologue-based signatures: two functions can share their first 24
bytes and their exception-handling scope table, so no run starting inside the function is unique.
The available move is to anchor on the tail of the *preceding* function and accept a short run —
14 bytes in the archived case — as the only unique thing available.

Do not "fix" this by widening into the body: the body is byte-identical between the two functions,
so a wider window is still ambiguous. Anchoring moves the window into bytes that differ.

## Fuzzy matching is a candidate generator only

A sliding window with a Hamming-distance threshold is the right way to *find candidates* and the
wrong way to *decide*. The archived case has the canonical failure: a data block gained two zero
bytes of padding in a later build, so a 64-byte window at distance 2 sat **two bytes early**, and
the reported offset differed from the true one by exactly that. The bytes at the wrong offset were
a plausible-looking constant pair.

Discipline that closes it:

1. fuzzy match → candidate offsets (never a conclusion);
2. exact expected-byte comparison at the candidate → reject or accept;
3. on rejection, re-locate with an exact anchor (a nearby string constant, a constant pair);
4. confirm the final offset by disassembling and comparing semantics with the baseline.

## Practical bounds

- **Shortest useful run**: 12–14 bytes with a stable anchor; shorter than that and coincidence
  becomes likely in a multi-megabyte `.text`.
- **Per-site budget**: average around 54 bytes over 14 sites was acceptable (755 bytes total);
  if a site needs 200 bytes, its meaning is probably too vague to describe — split it.
- **Wildcards**: mask relocation bytes (`??`) rather than dropping the bytes, so the match length
  stays fixed and the uniqueness count stays meaningful.
- **Search the whole image**, not just `.text`: after a section move, a site may land in a region
  you did not expect.

## What to record per signature

| field | why |
|---|---|
| meaning | so the next person can re-derive it when every build in the matrix is replaced |
| signature bytes, original / patched state | the artefact itself |
| per-build offset | the matrix row it was verified on |
| match count in each state | the uniqueness proof |
| anchor note | which neighbouring bytes make it unique, when the run is short |
| optional flag | builds where the site legitimately does not exist |
