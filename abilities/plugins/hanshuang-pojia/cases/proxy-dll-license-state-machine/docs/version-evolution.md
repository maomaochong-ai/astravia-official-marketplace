# Version-evolution of a proxy-DLL licence state machine

A version-DLL proxy is an old, unglamorous trick: the loader resolves
`version.dll` from the application directory before the system directory, so a
file placed there is loaded into the process and can forward every export to the
real module while doing something else on the side. That "something else" is
where the four generations below differ. Each generation keeps working against
the previous generation's defence, and each one changes **what counts as
evidence** - which is the part worth writing down, because a technique that is
only described by its patch offset is not reusable.

The four generations are stages of one engagement, not four unrelated tricks.
The judging criteria move from "is the export surface complete" to "is the state
word single-writer" to "does every path funnel through one predicate" to "is the
observation itself trustworthy".

## Generation 1 - forward and stay invisible

The proxy does one thing: forward. Its `.def` lists every export the original
module publishes, each one as `Name=original.Name @ordinal`, and the ordinal-only
exports as `@ordinal=original.#ordinal @ordinal NONAME`. Nothing is intercepted
yet; the goal is that the host cannot tell the module was replaced.

Acceptance at this stage is mechanical and testable without running the target:

- the export count of the proxy equals the original, by name *and* by ordinal;
- no ordinal shifted by one (the common failure: a forwarded table rebuilt from
  the name list, which drops ordinal-only entries and compresses the rest);
- the host starts, opens a document and exits with the same behaviour as before
  the proxy was installed.

What fails here is silent: the loader reports a missing entry point only for the
first import it cannot resolve, and the process may still start if that import is
delay-loaded. The failure then surfaces much later as a null function pointer.
This is why the first criterion in the pipeline is a **full export diff**, not a
successful launch.

## Generation 2 - own the state word

Once forwarding is invisible, the proxy becomes interesting: it can decide what
the licence check reads. The target keeps its entitlement in a process-global
16-bit word - written once when the licence blob is parsed, read by every feature
gate - so the proxy can clamp the word after the parser writes it.

The criterion changes from structure to **ownership of the writer**:

- count the writes to that word. One writer means the proxy has a single,
  well-defined place to intervene, and a patch there cannot be overwritten;
- zero writers means the value is copied from elsewhere (a mapped file, a
  resource, a registry read) and clamping the global is cosmetic: the next copy
  restores it;
- two or more writers means any single intervention is a race. The second writer
  is usually a re-validation timer, and it re-derives the state from the blob.

`state_word_audit.py` in this package produces exactly that census: every
RIP-relative reference in the code section, grouped by target, split into reads,
writes and address-taken uses. It is deliberately not a disassembler. A hit is a
place to look; the single-writer verdict is only as good as the confirmation that
follows it.

## Generation 3 - every path funnels through one predicate

The next build adds a second check site: the same predicate is evaluated when a
document opens and again before export. Patching the first site still lets the
second refuse. The naive response - patch both - fails a month later when a third
site appears.

The criterion here is about **the shape of the call graph**, not the number of
patches:

- if all sites call one predicate, patch the predicate once and the number of
  callers stops mattering;
- if each site inlines its own comparison, patching N sites is a maintenance
  debt proportional to N, and the honest move is to look for the shared input
  above them (a flag, a cached result, a vtable slot);
- if the sites disagree about the answer for the same input, there are two
  sources of truth, and the interesting finding is which one the UI trusts.

The proxy generation that survives here stops editing branches and starts
editing the value the branches read - which is only possible because generation 2
established who writes it.

## Generation 4 - make the observation itself checkable

The final build adds integrity checks: a checksum over the code section, a
debugger probe, and a thread that re-reads the state word. The first three
generations' patches are now detected rather than merely overwritten.

The criterion changes one more time, and this is the important shift: from "find
the branch" to **"find what makes the branch trustworthy"**. A patch is only
stable if the checker agrees with it, so the work becomes:

- locate the checksum input range and the comparison, and decide whether to
  correct the patch to satisfy the checksum or to neutralise the comparison;
- distinguish a probe whose result is used (a real gate) from one whose result is
  logged (noise), because the second kind does not need to be touched at all;
- keep the re-validation thread in the picture: a state word that is correct at
  time T and wrong at T+30s produces a report that contradicts itself.

`state_word_audit.py` still applies at this stage, and its `multi-writer` verdict
is the earliest warning that generation 4 is present: a second writer that
appears in a build where the previous one had a single writer is almost always a
re-validation path.

## What does not change across generations

Four invariants survived every build, and they are the reusable part:

1. **The export surface is a contract.** Any proxy must be re-diffed against each
   new build before it is trusted, because a moved ordinal is invisible at launch.
2. **Writes are more interesting than reads.** A read tells you where the value
   is consulted; a write tells you where it is decided. Reports that only cite
   reads are describing the symptom.
3. **A single intervention point beats N interventions.** If the number of sites
   grows with each build, the chosen point is wrong.
4. **A patch that is detected is not a patch.** Integrity checks do not make the
   edit harder; they make the edit observable, which changes the deliverable from
   "patched binary" to "patched binary plus a documented detection surface".

## Failure modes worth naming

- **Forwarding by name only.** Ordinal-only exports vanish, the table compresses,
  and the host binds the wrong function. Caught by an ordinal-complete diff.
- **Clamping a copy.** The state word is re-derived from the blob on a timer; the
  clamp holds for seconds and then reverts. Caught by the write census.
- **Patching the UI string.** The cheapest "fix" changes what the dialog says and
  leaves every feature gate intact. Caught by asking which predicate the UI reads.
- **Trusting an offset.** An offset is true for one build; a signature is true for
  a family of builds. The companion case
  `aob-signature-cross-version/docs/pipeline.md` covers the mechanism.

The short version: each generation moves the question one level up - from
structure, to ownership, to call-graph shape, to observability. Tools can answer
the first two mechanically. The third and fourth are judgement calls, and the
value of writing them down is that the next engagement starts at the right level
instead of at the patch offset.
