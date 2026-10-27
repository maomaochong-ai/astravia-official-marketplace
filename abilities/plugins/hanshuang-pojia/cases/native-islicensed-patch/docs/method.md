# Method — replacing a single boolean gate in a native binary

No addresses below: those belong to the target and are recorded in
[patch-and-guard.md](patch-and-guard.md) as teaching values. What follows is the order that turns
"the app says unregistered" into "the gate is provably single and the patch survives a restart".

## 1. Decide what kind of gate you are looking at

Three questions, each answerable in minutes, decide whether this package is even the right one:

- **Where does the decision live?** A local return value, a signature over a server response, or a
  key you would have to forge? Only the first is this shape.
- **Is the code readable on disk?** A normal section table with real code means a file patch is
  possible; an RWX runtime section or a packed image means
  [`cardkey-online-runtime-patch`](../cardkey-online-runtime-patch/README.md) instead.
- **Does anything verify the code?** If the app hashes its own `.text`, a file patch becomes a
  cat-and-mouse game and the honest answer is "your conclusion is conditional".

Write the three answers down before touching anything. If the third answer is "unknown", it is not
unknown for long — patch a copy, start it, and see whether it refuses to run.

## 2. Enumerate symbols before disassembling anything

A demangled C++ symbol that reads like a yes/no question is the cheapest entry into the whole
system. You are looking for a name that says "is entitled" rather than "check something".

Record, for each candidate: demangled name, virtual address, file offset (VA minus section RVA
plus raw pointer), and the byte range the function actually occupies. A name without a range is a
guess; a range lets you see whether the function is 40 bytes of INI parsing or 3 KB of protocol.

For a large Qt binary, do not start a full auto-analysis: it takes tens of minutes and often dies
on a 27 MB image. Scan deterministically instead — parse the section table, resolve the VAs of the
strings you care about, look for `LEA r64,[rip+disp32]` instructions whose displacement lands on
those VAs, and linearly disassemble a small window around each hit. Seconds, reproducible, and you
can re-run it on the next build.

## 3. Find every caller and count calls per start

Attach once and count how many times the gate is entered during a normal start. Two is normal: one
call decides the window title or banner, the other decides whether features unlock. Three means
there is probably a periodic re-check, and that changes the patch plan.

If the count is one, good — but confirm it again after patching, because a second call site that
was unreachable before may become reachable once the first one returns true.

## 4. Read the body before you delete it

A stub at the entry means the body never runs. That is fine for the return value and fatal for any
side effect the rest of the program expects: a cached payload parsed, a global flag set, a
configuration object populated.

Look for writes to globals and to the object passed in (`rcx` on x64), and for calls that fill a
buffer the caller later reads. If such a side effect exists, patch the compare-and-branch at the
end of the body instead of the entry — the same idea as the runtime-patch precedent, applied to a
file.

## 5. Write the stub, then read it back

The classic stub is "return true": on x64, a two-byte move of an immediate into the low byte of the
return register followed by a return, padded with no-ops to the length of the original prologue.
It needs no stack frame, which is exactly why it is safe even though the original prologue saved
registers — nothing has been pushed yet and nothing will be popped.

Two disciplines:

- **Pad deliberately.** Writing over the first five bytes of a longer prologue leaves the rest of
  the prologue as dead code that is never reached; that is fine, but the bytes you leave must not
  be the target of a jump. Check for incoming references into the middle of what you overwrite.
- **Read back.** A write that silently failed looks exactly like a patch that did not help. Compare
  the bytes from the file, not from your own buffer.

## 6. Prove the gate is single

Restart with the patch in place and watch for any path that still reports "not registered". Do not
accept "the main window opened" as the proof: exercise the capability the gate was protecting. If
something still refuses, you have found the second gate and step 3 was wrong — go back, do not
stack another patch on top.

## 7. Compare branches, not impressions

Run the unpatched binary and the patched one with the same input and capture the branch actually
taken (a log line, a debug print, a conditional breakpoint). Two lines of output — one saying the
free path, one saying the paid path — are worth more than a paragraph of "it works". This is the
single cheapest piece of evidence to produce and the hardest to argue with.

## 8. Look for the thing that re-applies the patch

Persistence in these targets is usually one of three mechanisms: a run key, a scheduled task, or a
guard binary invoked at login that re-checks the bytes and rewrites them. Find it before you claim
a revert: if the guard exists and you did not notice, your rollback silently undoes itself on the
next login.

Document the mapping trigger → effect, and how to remove it. A patch you cannot cleanly remove is a
worse finding than the one you were asked to assess.

## 9. Report shape

Root cause first: the client held the decision, and the server-issued state was advisory. Then the
patch as evidence (bytes, branch log, restart persistence), then the limits — what you did not
verify, what you assumed about the server, and which builds the offsets are valid for.

Recommendation follows the same order as always: move the decision to a signed credential the
client can only verify; keep the local cache but make it tamper-evident; and if a guard mechanism
exists, treat it as part of the product, not as a workaround.
