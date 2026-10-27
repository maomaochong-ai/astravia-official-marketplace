# The eight-step signature pipeline

An array-of-bytes signature is the only artefact of a patch engagement that
outlives the build it was found in. Everything else - the RVA, the file offset,
the section - is true for exactly one binary. This document is the loop that
turns an offset into a signature, and the acceptance criterion for each step.
`tools/sig_forge.py` automates steps 2 to 5 and 7; the rest stay human.

The order is not negotiable. Every step I have seen skipped is a step that
produced a wrong patch later, and the failure always looked like a logic bug in
the target rather than a mistake in the pipeline.

## 1. Fingerprint the build

Before any offset is written down, record what build it came from: SHA-256,
file size, `TimeDateStamp`, and the version resource string. This is the cheapest
step and the one that makes every later step checkable. A patch table without a
fingerprint is a list of numbers with no owner.

Acceptance: two independent runs of the tool print the same digest, and the
digest is written into the report header next to the date.

Failure mode: the operator patches build A, tests build B, and concludes the
patch "sometimes works".

## 2. Choose a seed from the decision point, not from the text

The seed is the short byte slice used to find the site in other builds. It must
come from the instruction that makes the decision - the comparison, the call, the
conditional jump - not from a nearby log string. Strings move between builds,
get localised, and are frequently duplicated; opcodes for a hot comparison are
stable.

Acceptance: the seed matches exactly once in the baseline. Not "at least once":
exactly once, at the known offset.

Failure mode: the seed matches a copy in an unrelated function, and the patch
lands there.

## 3. Align the same site in every other build

For each additional build, search the seed and require exactly one hit. If the
seed includes operands that changed between builds it will not be found at all -
that is not a failure, it is information: shrink the seed until the opcode part
alone is unique. Three bytes is the floor; below that the pattern is describing a
family of instructions rather than a site.

Acceptance: one hit per build, and the hit offsets are recorded rather than
discarded. Their spread is the drift the signature has to absorb.

Failure mode: a seed that matches twice is accepted "because it is probably the
first one". It is a coin flip, and it will be wrong in the build where the second
copy moves first.

## 4. Merge and wildcard

Align the windows around each hit and compare byte by byte. Positions that agree
stay literal; positions that differ become `??`. The result is a pattern that is
true for the whole family rather than for one member.

Acceptance: the wildcard count is small and every wildcard sits on an operand
byte - a displacement, an immediate, a relative target. A wildcard on an opcode
byte means the pattern is describing two different instructions and must not be
used as a patch anchor.

Failure mode: the window is too small, so the wildcards cover most of the
pattern, and the signature matches half the code section.

## 5. Widen until unique, never guess

If the merged pattern is not unique in every build, grow the window by a few
bytes and repeat from step 3. Uniqueness is the whole point of a signature; a
pattern that hits four places has not located anything, it has narrowed a search.

Acceptance: exactly one hit per build, for every build, with the same pattern
string.

Failure mode: an operator "fixes" ambiguity by adding wildcards rather than
bytes. Wildcards increase ambiguity; only context reduces it.

## 6. Write the patch table

The table is the durable deliverable: address, original bytes, patched bytes, and
one line on what the branch now does. Address in RVA and in file offset, because
the two diverge the moment a section is added.

Acceptance: original and patched byte counts are equal, the original bytes were
read from the build named in step 1, and the signature from step 5 is recorded
next to the row it locates.

Failure mode: the row quotes bytes copied from a disassembler view that has
already applied a relocation.

## 7. Apply and re-verify

Applying is a byte replacement; verifying is a separate act. Re-run the signature
against the patched copy and require that it still hits exactly once, then
disassemble the patched site and confirm the instruction decodes as intended. The
first check catches a patch that destroyed its own anchor; the second catches a
patch that is the right length and the wrong semantics.

Acceptance: hit count unchanged, difference confined to the listed sites, and the
decoded instruction at the site matches the intent written in step 6.

Failure mode: a patch that overwrites part of the signature it was found by, so
the next iteration of this pipeline cannot locate the site at all.

## 8. Roll back

The rollback is not "restore the backup"; it is "put the original bytes back at
the original sites and prove the file is identical to the input". Byte-for-byte
identity is the only acceptable proof, because a partially restored binary is the
worst of both worlds: it runs, and it is neither version.

Acceptance: the digest after rollback equals the digest from step 1.

Failure mode: the backup was taken after the first patch, so "rollback" restores
a half-patched state and the next engagement inherits it.

## Why the order cannot be shuffled

Steps 1 and 8 are the same digest, and that is deliberate: the pipeline is a
closed loop, not a list. Steps 2 to 5 are one computation - find, align, merge,
widen - and splitting them across separate manual passes is how "unique" quietly
becomes "unique as far as I checked". Steps 6 and 7 are the only ones that touch
bytes, and keeping them adjacent means the table and the verification describe
the same edit.

## The three ways this pipeline lies to you

1. **Offset staleness.** The number is right, the build is not. Only step 1
   protects against this.
2. **Signature drift.** The pattern is right, the family is not. Only step 5's
   per-build uniqueness check protects against this.
3. **Semantic drift.** The bytes changed as intended, and the branch now means
   something else because the surrounding code changed. Only step 7's second half
   - decoding the patched instruction - protects against this.

Each lie is cheap to detect at the step that owns it, and expensive to detect
afterwards: a report built on all three survives review, ships, and fails in the
field where nobody can attribute it.

## What the tool does and does not do

`sig_forge.py` performs steps 2 to 5 (seed choice, alignment, merge, widening)
and the re-verification half of step 7, and it refuses - exit code non-zero -
when no window is unique in every build. It does not disassemble, so it cannot
tell you whether a wildcard landed on an opcode: it reports the wildcard count and
the signature string, and the judgement in step 4 stays with the operator. It
does not fingerprint for you either; step 1 is deliberately manual, because the
digest has to end up in the report, not only in a console.

The division is intentional. A tool that claimed to decide whether a signature is
*semantically* correct would be wrong often enough to be worse than a tool that
prints the candidate and the evidence.
