# Precedent — offline activation with a replaceable embedded signing key

## When this package applies

- Activation is **offline**: the user pastes a code, the client verifies it locally, no server call.
- The verification is a real signature (Ed25519 here), and the public key lives **in the binary**,
  in a form the program itself must decrypt before use.
- The signed message is the payload itself, not a digest of it, so whatever the client verifies is
  whatever you can serialise.

Not this shape:

- the key is fetched from the server, or the signature is checked server-side → forging is off the
  table, and the honest conclusion is "client-side route closed";
- the algorithm is broken by a weak modulus rather than by key handling →
  [`rsa-blob-machine-code-keygen`](../rsa-blob-machine-code-keygen/README.md);
- the gate is a plain boolean with no crypto at all →
  [`native-islicensed-patch`](../native-islicensed-patch/README.md).

## Shape of the work

1. **Find the verification entry, not the UI.** The dialog that accepts a code is disposable; the
   function that decodes and verifies is the system. UI strings are the cheapest way to reach it.
2. **Establish the container format before the crypto.** Character checks, separator position,
   base64, compression, and the XOR that reconstitutes the signature are all format, not crypto —
   and all of them have to be right before a signature has any chance of verifying.
3. **Identify the algorithm and the message.** Which signature scheme, what exactly is signed
   (the decompressed JSON bytes, not a hash of them), and what the verifier is called.
4. **Trace where the public key comes from.** If it is embedded and decrypted at runtime, that is
   the opening: the key is data, and data can be replaced.
5. **Recover the key material from the ciphertext, not from the algorithm.** A repeating-key XOR
   with a known plaintext is arithmetic, not cryptanalysis; state the period and prove it.
6. **Write a new key pair, re-encrypt the public half, patch every copy of the blob.** One blob may
   be smeared across several immediate loads in one function.
7. **Sign your own payload and replay the full client path.** The code has to pass the format
   checks, decompress, verify, parse, and satisfy the state check that follows.
8. **Say whether the state persists.** Offline activation often only sets in-memory state; if it
   does not survive a restart, that is the deliverable's real limitation, not a footnote.

## Traps that cost real time

- **Qt container layout.** A `QByteArray` is not a bare pointer: the object points to a header, and
  the data pointer is a separate field. Read the wrong offset and you get plausible garbage.
- **Double XOR that cancels.** The archived format XORs the body with the signature twice — once
  before decompression, once after — and the verifier XORs once more. Net effect: the signed
  message is plain JSON. Miss that and you spend hours looking for a digest that does not exist.
- **Anti-debug branches that change control flow.** A debugger-present check switching one XOR off
  turns a working reproduction into a puzzling failure; always confirm outside a debugger.
- **Device binding that looks stricter than it is.** A machine code derived from a GUID hash with a
  fixed-length format can be *constructed*; if the length is fixed, the generator never needs to
  know it in advance.
- **Patched builds that still show the old dialogue.** Verifying the key at runtime is not the same
  as the UI accepting the code; check both.

## Evidence this package expects you to produce

- the container layout (version character, check character, base64 body) with the arithmetic that
  validates each part;
- the signing message bytes, captured at the verifier, matching the payload you serialised;
- the recovered key stream, its period, and the new public key blob written back, plus a read-back
  from the patched file;
- one end-to-end run: code generated from the machine's own identifier, pasted into the UI, state
  accepted;
- a runtime proof that the key in memory is your key, not the vendor's;
- the persistence fact — what survives a restart and what does not.

## Reading further

- [docs/method.md](docs/method.md) — order of work and the criteria that close each step.
- [docs/algorithm.md](docs/algorithm.md) — container format, key replacement arithmetic, offsets.
- Document library `cases/ed25519-offline-keygen/` — the full walkthrough and the algorithm notes.
