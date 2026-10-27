# Method — patching a multi-process suite from one injected module

No RVAs below; the numbers belong to one build and live in
[points-and-proxy.md](points-and-proxy.md). What follows is the order that keeps a 52-site patch
set honest, and the places where a smaller, prettier design fails.

## 1. Draw the process map first

The instinct is to start at the UI. Resist it for one hour: enumerate every executable in the
install directory and ask, for each, "can this process refuse something on its own?"

In this suite there were four: the UI shell, a background daemon, a remote/push service and an
updater. Three of them carried their own copy of the entitlement decision; the fourth carried the
ability to undo the whole exercise by replacing the binaries.

That map is the deliverable of step 1, and it changes the shape of everything after it. A single
process would have been a 30-minute job; four processes with separate compilations is a different
problem, and the report should say so explicitly.

## 2. Choose the delivery by import table, not by preference

Two designs were tried historically.

**Rename and forward.** Take the module the host loads, rename the original to `*_orig.dll`, and
place a forwarder under the original name that loads the renamed copy and patches on load. It works,
and it is fragile: it assumes a specific load order, it needs two extra files on disk, and any
update that reinstalls the module silently reverts it.

**Hide behind an import the host already has.** Pick a system DLL that every target *statically*
imports, and place your module under that name beside the executable. The loader resolves it first,
your module forwards every export to the real system file, and the host never notices. No rename,
one file, and the updater loads it for the same reason the UI does.

The second design is better here **because of a fact you must verify first**: grep the import tables
of all four executables for the chosen module. If even one does not import it, that process needs a
different delivery, and the "single file" story collapses. Write the import evidence down with the
count of targets it covers.

## 3. Generate the bridge; never hand-write it

A forwarding module must expose exactly the exports the host may call. Derive the list from the
original file's export table and generate the stubs — a partial list passes every test you write and
then fails in the field on an API nobody thought about.

The one genuinely new technique in this case is how the stubs are written: a naked function that
loads the real target's address and jumps to it, without a prologue and without touching registers
or the stack. That keeps calling conventions exact for APIs that take variadic arguments or return
structures — a C-level trampoline would need per-signature care.

## 4. Per site: read, compare, write, log

Every patch carries its expected original bytes. The guard reads the target, compares, and writes
only on an exact match. Three consequences, all good:

- a rebuild that moved the code produces `MISMATCH` and **zero writes**, instead of corrupting a
  function that happens to sit at the old address;
- a second load in the same process produces `ALREADY`, not a second write;
- a host that is not a target (a shell, a helper) produces `SKIPPED out of range`, which is a fact
  worth logging rather than an error.

If you cannot say which of those four states a given line came from, your log is not evidence.

## 5. Patch the branch, not the outcome

The UI is Qt. The entitlement check does not just return a boolean the caller branches on — it also
**emits a signal** that the rest of the interface waits for. Overwriting the function entry to
return success drops the signal, and the window looks unchanged in a way that reads as "the patch
did nothing".

The safe edit is the conditional jump at the point where the decision is used. The signal still
fires, with the value the code path was going to produce anyway.

This generalises: in any framework where outcomes are events, patch where the event is produced,
not where the function returns.

## 6. Verify on a synthetic host before the installation

The writer can be tested without a licence, an installation or the real product: build a legal PE64
image that contains the expected bytes at the exact RVAs plus a stub entry point, run the guard
against it, and diff the bytes afterwards. A guard that reports "applied 30/30" on a synthetic image
and shows the expected bytes is proven at the writer level.

Keep that harness in the case directory. It is the only part of the work that can be repeated
forever without touching anyone's machine.

## 7. Deploy with a stated write scope

Before copying anything: list every path the guard will create or rename, and take a timestamped
backup of the ones that already exist. State the negative space in the report too — the executables,
the registry, the system directory and the service configuration were not written.

Then restart the resident processes. A daemon that was running before deployment keeps its old
image; this produces the single most confusing false negative in the whole shape ("Main is patched,
the badge still comes back").

## 8. Roll back once, on purpose

Execute the restore procedure at least once, in the lab, before declaring success. A rollback that
has never been run is a hope. It also produces the cleanest possible evidence for the report: after
restore, the product behaves exactly as before, and the diff of the install directory is empty.

## 9. Close on design

The finding is not "52 offsets". It is: entitlement decisions are duplicated in every process,
computed from parsed text, and rendered from a value the client minted. The hardening section should
attack that duplication — one server-signed entitlement, verified once and shared, with the client
unable to mint it — plus the update channel, which is otherwise a delivery mechanism for reverting
any client-side change.
