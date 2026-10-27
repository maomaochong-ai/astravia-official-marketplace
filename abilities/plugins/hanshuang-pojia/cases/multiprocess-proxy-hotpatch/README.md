# Precedent — entitlements spread across four processes, patched from one injected DLL

## When this package applies

- The product is a **suite**, not one binary: a UI shell, a background daemon, a remote/push
  service and an updater, each with its own copy of the entitlement logic.
- The GUI is Qt (signals carry the outcome), so "patch the function that returns the answer" loses
  the event that the rest of the UI waits for.
- A previous attempt renamed a dependency and dropped in two forwarder DLLs. It worked on the build
  it was written for and needed re-derivation for the next one.

If the whole product is a single process, the multi-process half of this package is unnecessary —
[proxy-dll-license-state-machine](../proxy-dll-license-state-machine/README.md) covers the state
word and injection timing, and [version-dll-proxy-iat-hook](../version-dll-proxy-iat-hook/README.md)
covers a single loader-hijack delivery.

## Shape of the work

1. **Count the processes before counting the patches.** Enumerate every executable that can decide
   an entitlement: UI, daemon, push service, updater. A patch set that fixes the UI and leaves the
   daemon refusing will present as "the badge comes back" — the classic symptom, and it costs a day
   if you do not predict it.
2. **Pick a module the binaries already import.** This is the whole delivery design. If the host
   statically imports a system DLL, dropping a same-named file beside it is enough — no rename, no
   `_orig` copy, no install manifest, and the updater loads it too. Verify the import exists in
   *every* target before committing to it.
3. **Bridge, do not reimplement.** The stub must forward every exported entry point to the real
   system module. Generate the export list from the original (`169` forwarders in one build here,
   `17` in another); a hand-written partial list breaks the first API you did not think of.
4. **Compare before writing, per site.** Each patch carries its expected original bytes. Read the
   target, compare, write only on an exact match, then log the outcome. On a rebuild this converts
   "silently patched the wrong offset" into "`MISMATCH`, nothing written".
5. **Log four states, not two.** Applied / already applied (second load in the same process) /
   out of range (the RVA does not exist in this image) / mismatch. Without the distinctions you
   cannot tell "the patch failed" from "the patch ran twice" from "this host is not a target".
6. **Make the guard idempotent and reversible.** It must be safe to load twice, and rollback must be
   a file operation, not a reinstall.
7. **Prove it on a synthetic host before the real one.** Build a legal PE with the expected bytes at
   the exact RVAs and a stub entry point, run the guard against it, and diff the bytes afterwards.
   That is how you test the writer without touching an installation.

## Traps that cost real time

- **Patching the function entry of a Qt outcome check.** The function also *emits* the signal the
  rest of the UI waits for. Returning early drops the signal, and the UI silently keeps the old
  state — look at all four sites before concluding, and patch the branch instead.
- **Assuming a constant RVA delta between builds.** One module's sections shifted by a fixed amount
  across four regions, so addresses inside one compilation unit translated cleanly. The daemon's
  shift was *not* constant and the remote service grew by several times — translation there
  produced plausible-looking but wrong addresses.
- **Trusting an old point list.** The previous generation's 53 points had **zero** byte hits in the
  new build. A patch table is not portable; it is a set of facts about one image.
- **Leaving a resident daemon running.** A service started before deployment keeps executing its old
  image. Restart it, or the patch will look ineffective for exactly one process.
- **Forgetting the updater.** A suite that checks for updates will happily replace itself and undo
  the change. Decide explicitly whether to block the updater, and say so in the report.
- **Jumping into a code cave far away.** The old approach used a `jmp` into a stretch of `0xCC`
  padding. It depends on that padding surviving the linker, which it does not across builds.

## Evidence this package expects you to produce

- a process inventory with the entitlement decision points found in each, and the total;
- the import table of every target, showing the chosen delivery module is imported by all of them;
- the generated export/forwarder count from the original module, with the generator command;
- the per-site table: image, section, file offset, RVA, original bytes, patched bytes, semantic;
- a byte-verification result (`n/n` matched, `0` mismatched) and the four-state log excerpt;
- the write-scope statement — which directories changed and which were untouched (binaries,
  registry, system directories, service configuration);
- the rollback procedure, executed once.

## Reading further

- [docs/method.md](docs/method.md) — ordering, decision criteria, when to stop.
- [docs/points-and-proxy.md](docs/points-and-proxy.md) — point table shape, RVA-shift evidence, the
  naked-stub technique, logging states, deployment and rollback.
- Document library `cases/multiprocess-proxy-hotpatch/` — the full walkthrough plus the
  cross-version drift study and the guard rails.
