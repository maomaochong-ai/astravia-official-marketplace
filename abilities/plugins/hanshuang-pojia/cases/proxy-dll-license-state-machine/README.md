# Precedent — one state word decides everything, and the UI only mirrors it

## When this package applies

- A native desktop product whose authorisation is **entirely local**: no server call, no signed
  token, sometimes not even a network import.
- The visible signals of "trial" (window title, banner, an "about" panel) are **derived**, not
  authoritative. Editing them changes what the user sees and nothing about what the program allows.
- A third-party proxy DLL was tried first, and either drifted with the version or crashed the host
  on a heap.

If the client does talk to an authorisation service and decides the verdict locally, this is still
the right package for the decision site — but read [cardkey-online-runtime-patch](../cardkey-online-runtime-patch/README.md)
for the protocol half of the work. If the product is a packed image with an RWX code section, the
timing discipline there also applies here.

## Shape of the work

1. **Enumerate the candidates before choosing one.** A host like this carries several globals that
   all look like "the licence": a level integer, a version-coverage flag, a state word, string
   pointers. Read the cross-reference count for each. The one with the most readers is usually the
   one the UI mirrors; the one written in a single tight block at startup is the state machine.
2. **Find the writer, not the readers.** Follow the startup path that assigns the state word. You
   are looking for a short block: load a return value, transform it, store it. That transform
   (`not` on a value that is either `0` or `-1`) is the whole gate.
3. **Confirm with three independent observers.** In-process value, window title, and the about
   panel. One observer is an opinion; three that agree are a measurement. The table in
   [docs/state-machine.md](state-machine.md) is the shape to reproduce: for each scenario, the three
   values plus what the user sees.
4. **Patch the producer, then the two downgrade branches.** A state machine usually has more than
   one write site: the normal path plus "we failed early, mark it trial" fallbacks. Patching only
   the first produces a pass that a later startup path silently reverts.
5. **Re-run the same input after each site.** Deploy, observe, revert, observe. A one-way result
   ("it opened") does not show that nothing was left behind; the revert leg is what proves it.
6. **Keep the disk image unchanged if you possibly can.** Here the delivery was a proxy DLL that
   rewrote memory only, which kept the vendor signature intact and made rollback a file delete.

## Traps that cost real time

- **"The about box shows the licence, so it is activated."** It is not: the panel reads display
  strings, and the startup path can still route to the trial branch. This exact confusion cost
  several iterations upstream — five separate patches were built on it before the real writer was
  found.
- **A heap-corruption crash misinterpreted as an ABI problem.** Writing a wide string from a DLL
  crashed with `0xC0000374`. The cause was not cross-heap allocation but *timing*: the write
  happened before the host finished initialising, and the host's own heap manager then
  overwrote/freed it. Allocating through the host's **own** import slot, after initialisation,
  fixed it.
- **Retry loops that never stop.** Re-writing the same pointers on a timer grows the heap until the
  process dies with `0xC0000005`. Bound the retries (a handful, seconds apart) and stop.
- **Re-reading a bytecode-compiled runtime as plain assembly.** The window class and the runtime's
  string type dictate the calling convention; a "correct-looking" write into a `BSTR` global is
  still wrong if it was allocated by another allocator.
- **Copying a third-party crack's offsets to a new build.** Its offsets were valid for one version
  only; on the next build they landed mid-instruction and corrupted an unrelated module. Derive,
  do not copy.
- **Config files in UTF-16 with a BOM.** Line-oriented edits only. A cross-line regex rewrite
  truncates the file and destroys the registration block you were about to test.

## Evidence this package expects you to produce

- the global-variable map, with the reader count for each candidate and the reason one of them is
  the state machine;
- the writer block, disassembled, with the transform and the store visible;
- every additional write site (the downgrade branches), each with its own trigger condition;
- a scenario table: in-process values for all three globals, plus title and about-panel text, for
  original / partially patched / fully patched;
- a bidirectional run — deploy then revert — showing the trial state returns with no residue;
- proof the on-disk image and its signature are untouched.

## Reading further

- [docs/method.md](docs/method.md) — order of work, decision criteria, when to stop.
- [docs/state-machine.md](docs/state-machine.md) — global map, writer block, patch table for two
  builds, registration-code structure, injection timing.
- Document library `cases/proxy-dll-license-state-machine/` — the full walkthrough and the
  third-party crack anatomy with the hardening spec derived from it.

## Tools

- [docs/version-evolution.md](docs/version-evolution.md) — the four generations of this proxy (forward, own
  the state word, funnel through one predicate, survive integrity checks) and how the acceptance
  criterion changes at each one.

[`tools/state_word_audit.py`](tools/state_word_audit.py) answers the generation-2 question from the
file instead of from a disassembler: every RIP-relative reference in the code section, grouped by
target, with the 16-bit writes separated from the reads. One writer means there is a single place to
intervene; zero means the value is copied from somewhere else; more than one means a single patch is
a race with the re-validation path.

```bash
cd tools
python3 state_word_audit.py --self-test        # builds its own PE, asserts the census
python3 state_word_audit.py --sample target.exe --word
```

A hit is a place to look, not a conclusion: the scanner knows instruction shapes, not semantics.
[`tools/manifest.json`](tools/manifest.json) registers the tool for the scaffolder, and `--self-test`
needs no sample - it constructs a synthetic PE and checks the parser, the scanner and the patch
round-trip before anything touches your file.
