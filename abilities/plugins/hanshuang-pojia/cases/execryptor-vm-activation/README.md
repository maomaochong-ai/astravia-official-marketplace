# Precedent — a virtualised verifier and the one verdict it feeds

## When this package applies

- The authorisation check is confirmed to run inside a **virtualised / protected runtime** (a
  separate helper process, a VM interpreter, a code-virtualising protector): the signature check
  itself is not statically recoverable.
- The main program and that runtime communicate over an observable channel — shared memory, a
  named event pair, a local socket, a pipe.
- The result crosses back into the main program as a **small integer status**, and the main
  program alone decides what that status means.

This is the case where "build a keygen" is the wrong plan, and recognising that early is the whole
value. If the verifier is plain code you can read, use
[`dotnet-license-keygen`](../dotnet-license-keygen/README.md) or
[`ed25519-offline-keygen`](../ed25519-offline-keygen/README.md) instead. If the protector hides the
code entirely and nothing is observable, use
[`themida-dotnet-delegate-recovery`](../themida-dotnet-delegate-recovery/README.md).

## Shape of the work

1. **Establish what the check is made of before trying to read it.** Two binaries, one of them a
   runtime the vendor did not write. Import surface of the main program tells you whether local
   cryptography is even possible: registry + winsock + crypt32 certificate APIs and **no MD5/SHA/
   symmetric primitives** means the decision cannot be local.
2. **Follow the string, not the code.** A decryptable string table identifies the dialog, the
   manager class, the verify wrapper, the failure message. That gives you the call chain in
   minutes and tells you which end of it is readable.
3. **Map the channel.** Shared memory with a fixed size, two named events (sent / complete), one
   mutex. The payload is structured text; the fact that it is plaintext in memory while the
   signature check is virtualised is the asymmetry this whole route depends on.
4. **Find where the status becomes a decision.** One comparison of an integer against a small
   constant, in the main program, in readable code. That is the site.
5. **Read the success branch to its end.** The interesting part is not the branch but everything it
   gates: registry value names, a type field that is later normalised, a memory clear that resets
   a struct before the type is written.
6. **Patch the status, not the check.** Redirect the single "parse status" call to a stub that
   returns the success constant. The virtualised verifier stays untouched and still runs.
7. **Enumerate the side effects and verify each one.** A verdict patch changes what the program
   believes about itself; some screens read fields the patch never sets.

## Traps that cost real time

- **Attacking the stub.** The VM entry point decompiles to a dispatch loop over a bytecode table.
  Time spent "understanding" it is unbounded; the recoverable surface is on the other side of the
  channel.
- **Assuming the helper can be disabled.** It also performs startup work; killing it makes the main
  program exit immediately. Patch the verdict and let it run.
- **Forgetting the struct clear.** A zeroing `memset` over the result struct runs before the type
  field is normalised; if you patch the status but the caller never sets the type, later code reads
  a zero and takes a different path.
- **Patching a copy that cannot start.** The program must run next to its helper and its resources;
  a lone executable in a temp directory fails for reasons unrelated to the patch.
- **Treating one successful screen as success.** The registration dialog closing proves the
  activate path; the start-up check is a *different* function with its own status handling.

## Evidence this package expects you to produce

- the import surface that rules out local cryptography, quoted as a list;
- the call chain from the dialog to the status comparison, with the two offsets that matter;
- the channel description: size, event names, mutex name, payload shape;
- the patch table (original bytes, patched bytes, stub bytes) and a read-back;
- a side-effect matrix: which screens read which fields, and what they show after the patch;
- before/after behaviour of *both* entry points (interactive activate, start-up check);
- what remains unverified — in particular that the signature check itself was never reversed.

## Reading further

- [docs/method.md](docs/method.md) — order of work and the stopping rules.
- [docs/ipc.md](docs/ipc.md) — the shared-memory channel and how to observe it.
- [docs/verdict.md](docs/verdict.md) — the status values, the stub, and the side-effect matrix.
- Document library `cases/execryptor-vm-activation/` — full narrative and the activation path.

## Tools

`tools/section_entropy.py` measures the layout facts this case actually turned on: section
flags, Shannon entropy per section, and whether the entry point sits in the last section.

```bash
python3 tools/section_entropy.py --sample target.exe
python3 tools/section_entropy.py --sample target.exe --threshold 7.2 --out findings/
python3 tools/section_entropy.py --self-test
```

It prints one row per section (`name | raw size | entropy | flags | notes`) followed by a
`reading (heuristic)` block. Every line in that block is derived from the numbers above it:
an RWX section, sections above the threshold, an entry point in the last section, missing
ASLR, DEP and RWX together. It never names a packer, because layout is evidence and
attribution is a separate claim.

`--out` writes `sections.json` with the sample hash, format, entry point, threshold and the
full section table, so a report can cite numbers instead of screenshots.

`--self-test` builds synthetic images in a temporary directory and asserts the entropy of a
filled section (8.0 bits/byte), the entropy of a zero-filled one (0.0), the flag decoding,
and the entry-in-last-section rule. No sample bytes ship with this package.
