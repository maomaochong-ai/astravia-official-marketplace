# Precedent — online card-key gate, patched in memory while packed

## When this package applies

- The licence is a **card key checked online** and the client decides the outcome locally.
- The image is packed: high whole-file entropy, random section names, entry point inside the
  ciphertext section, imports rebuilt at runtime.
- The shell did **not** protect the running process: no ASLR, an RWX code section, no
  self-check. That combination is what makes this route shorter than unpacking.

If the shell also disables dynamic code, drops sections to RX or checksums itself, go to
[`elf-packed-loader`](../elf-packed-loader/README.md) for the unpack-first route instead: this
package deliberately does not unpack anything.

## Shape of the work

1. **Read the loader, not the code.** `DllCharacteristics`, section permissions, entropy per
   block, import count. Two answers decide the route: is the base fixed, is the code section
   writable at runtime. Both yes → keep the file untouched and plan a memory patch.
2. **Watch the wire before reading the assembly.** Hook `ws2_32!connect/send/recv`. One session
   shows whether authorisation is online, which command number carries the login, and whether
   the server text is rendered verbatim (a string absent from the image came from the server).
3. **Pivot on `recv`'s return address.** `this.returnAddress` inside the receive hook names the
   wrapper that called it; walk up two frames and you are in the login event handler. This is
   the cheapest way into a large obfuscated function graph.
4. **Locate the local decision, not the network call.** The call returns a value; the branch
   after it decides. Patch the branch.
5. **Run the control matrix before believing a patch.** Single-site, whole-function `ret` and
   "return a constant" all look like success for seconds and then die. See
   [docs/patches.md](patches.md) for the three failure modes and the matrix that separates them.
6. **Synchronise on bytes, not sleeps.** The decrypted code does not exist on disk, so poll the
   target address for the function prologue (`55 8B EC` on x86) before writing, then read back.

## Traps that cost real time

- **Writing to the file.** The packed section has `rawsize = 0`; the instructions you want are
  not in the file at all. Any "static" patch edits bytes that are overwritten at load.
- **Patching a return value.** The host language is typed: a function returning a byte set
  cannot be made to return an integer without breaking the conversion the caller performs.
- **Skipping a whole function with `ret`.** The function also initialises state; the crash
  arrives minutes later and looks unrelated.
- **Leaving the console attached.** A GUI child launched from a batch or script inherits the
  console; when it closes, `CTRL_CLOSE_EVENT` kills the target mid-verification.
- **Trusting a single stable run.** "It opened" is not the result; "it stayed open while the
  gated capability was used" is.

## Evidence this package expects you to produce

- the loader facts (`DllCharacteristics`, section permissions, entropy) that justified skipping
  the unpack;
- the protocol capture, with the command number and the response magic, and the observation that
  the failure text is server-supplied;
- the call chain from the receive hook back to the login handler;
- a patch table with address, original bytes, patched bytes and effect — plus the control matrix
  rows for the rejected variants;
- a read-back of every patched site and a timed stability run of the gated feature.

## Reading further

- [docs/method.md](docs/method.md) — the order of work and what each step must produce.
- [docs/patches.md](docs/patches.md) — patch discipline, control matrix, timing, read-back.
- Document library `cases/cardkey-online-runtime-patch/` — the full walkthrough and the protocol
  and patch tables this digest was written from.
