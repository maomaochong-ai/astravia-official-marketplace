# Method — auditing an authorisation check you cannot read

The whole method turns on one early judgement: **is the verifier recoverable?** Everything after it
depends on the answer, and getting it wrong costs days.

## 1. Two binaries, one decision

Start from the package layout, not from the entry point. An installer that ships a main program
plus a second, smaller executable with a protector's name on it is telling you the design: the
check lives in the second one, and the first one calls it. Record both: architecture, compiler,
size, signature state, protector verdict.

Then read the main program's **import surface** before its code. This is the cheapest decisive
evidence in the whole case:

- registry APIs → the verdict is persisted locally;
- winsock / wininet → something talks to a server;
- crypt32 certificate and random APIs → transport and, possibly, verification;
- **no MD5, no SHA, no symmetric primitive** → the program cannot check a cryptographic signature
  itself, therefore the decision is not local.

Write that down as a negative result with the evidence attached: "the import table contains no
hashing or symmetric primitive, so a local key-validation path is excluded for this binary". A
negative result stated with evidence is a finding; a negative result assumed is a guess.

## 2. Let strings give you the chain

A string table that decrypts on read (a common pattern: pointer array + XOR per call) still yields
its values once the program runs. Collect them and look for the four that matter: the dialog title,
the manager class name, the verify-wrapper name, the failure message. Those four names anchor the
whole call chain, and they are enough to walk from the UI to the boundary in an afternoon.

Statics help here: a summary decompile of the string-referencing functions, filtered by string,
beats reading the binary linearly. If the toolchain offers a headless query mode, use it — a
6 MB binary with 15k functions does not need to be opened interactively for this step.

## 3. Map the channel before you map the check

Between the two binaries there is a channel. Find its three parts and write them down:

- a named shared-memory section with a fixed size;
- two named events, one per direction (request written / response ready);
- a mutex whose name is short and process-local.

Then read a payload. Structured text in shared memory is the normal shape. Two observations come
out of it immediately: what the main program sends (fields, not values), and what comes back (a
status plus a handful of typed fields). Neither requires understanding the verifier.

This is the case's central asymmetry: **the transport is plaintext and the verifier is opaque.**
The audit does not need the second to be readable, because the first already exposes the contract.

## 4. Confirm the verifier is virtualised, then stop attacking it

The helper's entry point decompiles into a dispatch loop over a bytecode table — a VM interpreter.
Recognise it and stop: a virtualised signature check is not a decompilation target, it is a
research project. The correct output of this step is a statement, not an exploit:

> the signature check is executed by the protected runtime; no pure-local key-generation path
> exists for this design, because the value being checked is produced inside the VM.

`[observed]` = the dispatch loop and the bytecode table. `[inferred]` = the check itself happens
there. Do not upgrade the second to `[observed]` without evidence you will never cheaply get.

## 5. Find where a status becomes a decision

In the readable half, one function parses the response and returns an integer; one comparison
decides. Find the comparison, not the parse. The shape to look for is a small constant: `0`, `1`,
`2`, `3`.

Map each value to a meaning by reading the branches, not by guessing from the number. In the
archived case: `0` = failure, `2` = expired, `3` = success. That mapping is the deliverable of this
step, because everything downstream is expressed in those terms.

## 6. Read the success branch all the way out

The branch body is where implementations hide their surprises. Look for:

- **written state** — which registry values, under which key, with which names;
- **type normalisation** — a `license type` field that maps several inputs onto one canonical value
  (a "single computer" licence type collapsing to `1`), often after a struct clear;
- **a struct clear before the write** — a zeroing routine that runs first; if you patch the status
  without the caller writing the type, later code reads zero and takes a different path;
- **a second entry point** — the start-up check is a *different* function with its own status
  handling and its own trial/time-rollback logic.

Failing to notice the second entry point is the most common reason a patch "works" in the UI and
"still shows unregistered" on the next launch.

## 7. Patch the status, not the check

Replace the call that parses the status with a call to a stub that returns the success constant.
Two reasons this is the right edit rather than a shortcut:

- the virtualised verifier keeps running, so nothing else it does (side effects, caches, timers) is
  lost;
- the edit is 6 bytes in readable code plus a 7-byte stub, both verifiable by read-back, and it
  does not depend on any offset inside the protected runtime.

Requirements on the stub: it must be in executable memory, ideally in a padding region of an
existing section, and it must preserve the calling convention of the call it replaces (return value
in the same register, no stack imbalance).

## 8. Verify both entry points, then enumerate side effects

Run the interactive path and the start-up path separately, and record what each screen shows.
Expect the patch to produce *cosmetically* empty fields — a registration name blank because the
program never received one. That is not a failed patch; distinguish "the decision changed" from
"the display has data".

Side-effect matrix: for each screen or feature that reads authorisation state, note the field it
reads and whether the patch sets it. Anything unset is a candidate for the next patch or for a
documented limitation.

## 9. State the limit in the report

The report must say plainly that the signature check was never reversed, and what that implies: the
finding is that the **authority is misplaced** — the client alone converts a status value into
entitlement — not that the cryptography was broken. This distinction is what makes the write-up
defensible and what points at the real fix: the service should sign an entitlement, and the client
should verify rather than decide.

## 10. Stop conditions

- Two days spent on the dispatch loop without a mapping to source semantics → stop; the route is
  the channel, not the VM.
- A patch that changes the UI but not the feature gate → you patched a display path; go back to
  step 5 and find the other comparison.
- A patch that needs the helper disabled → wrong layer; the helper also does startup work.
