# Precedent — RSA blob, machine-bound request string, and a negative result

## When this package applies

- Activation data is an **RSA signature blob** verified with the platform CNG/BCrypt API inside a
  component DLL, keyed by an ordinal export rather than a name.
- The signed message is a **request string assembled from machine identifiers** rather than a code
  the user types.
- The modulus looks small enough to tempt a factoring attempt.

This package is written around a **negative result**: the keygen route does not open, and knowing
why is more useful than another patch. If your target instead has a replaceable embedded key, go to
[`ed25519-offline-keygen`](../ed25519-offline-keygen/README.md). If the gate has no crypto at all,
[`native-islicensed-patch`](../native-islicensed-patch/README.md).

## Shape of the work

1. **Map the packaging before the logic.** An installer is a container; the licence code is in a
   component DLL, not in the SFX stub. Confirm which binary actually imports the crypto API.
2. **Find the public key blob, not the strings.** Search for the CNG blob header (`RSA1`) rather
   than for words like "activation"; the blob's field layout is self-describing and settles the
   algorithm (exponent, modulus length) in one read.
3. **Recover the request string composition.** Two or three machine-derived identifiers, each
   reduced to a hex digest and concatenated. Establish the order and the encoding before anything
   else — a one-field mistake makes every later experiment meaningless.
4. **Read the verification as a window, not an equality.** The check slides over the decrypted
   block, so several offsets can satisfy it. Knowing that changes what "forging" would require.
5. **Bound the factoring claim before attempting it.** Compute the modulus size, run a cheap
   factor search, and record what came out. Do not spend days on a number you have not sized.
6. **Decide, in writing, which route survives.** Local reproduction of the machine identifiers,
   then a patch at the verify export, then anti-rollback — that is the route that works.
7. **Prove the patched path at the export, not only in the UI.** Call the ordinal directly and
   check the returned state and the output buffer.

## Traps that cost real time

- **Looking for the licence in the installer.** The SFX stub imports no network and no crypto;
  everything interesting is one level down.
- **Guessing the digest.** A hex string of the right length can be MD5, SHA-1 or a slice of
  something longer. Confirm by reproducing one value the client itself computes.
- **Treating the sliding window as an exact match.** The same decrypted block can validate at more
  than one offset, so "it failed at offset 0" says nothing about the rest.
- **Reading a 64-bit decompiler output as one variable.** A 128-byte buffer split into a dozen
  locals is one buffer; reconstruct it before interpreting byte ranges.
- **Reporting "weak key" as "broken".** A small modulus with one large prime factor is still
  unbreakable in practice; the report has to say which part was actually established.

## Evidence this package expects you to produce

- the blob layout with `e`, modulus bit length and the file offsets of every copy (x64 and any
  second architecture);
- the request string reproduced byte-identically for this machine, with the digest of each field;
- the factor-search log: what was tried, what was found, and why the remainder is infeasible;
- the patched export called directly, returning the activated state and writing the expected status
  byte;
- the registry diff showing what an activated state actually writes, and what happens on reload;
- a stated limitation list — the online activation path and any server-side check you did not touch.

## Reading further

- [docs/method.md](docs/method.md) — the order of work, and the criteria that end the keygen route.
- [docs/algorithm.md](docs/algorithm.md) — blob layout, request string, sliding-window check,
  trial clock derivation, patch targets.
- Document library `cases/rsa-blob-machine-code-keygen/` — the full walkthrough and algorithm notes.
