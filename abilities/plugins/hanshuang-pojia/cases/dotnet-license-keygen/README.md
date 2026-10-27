# Precedent — reconstructing an offline key check and building the key

## When this package applies

- A `.NET` desktop app validates a **pasted key string** entirely offline, plus an email/name.
- The key is long and looks random, but only a slice of it is checked; the rest is filler.
- The check is not a cryptographic signature: it is a hash of the identity fields mapped through a
  character set into a fixed position.

Then the algorithmic route is open: recover the transform, verify it against the real check, and
the key constructor is arithmetic. Contrast with
[`execryptor-vm-activation`](../execryptor-vm-activation/README.md) — where the verifier is
virtualised and **no** local key can be computed — and with
[`ed25519-offline-keygen`](../ed25519-offline-keygen/README.md), where a real signature means the
only path is recovering the authority, not the transform.

## Shape of the work

1. **Get the real IL, not the stub.** Method bodies may be stripped from metadata and kept in an
   encrypted resource, decrypted at runtime and executed as a dynamic method. Static decompilation
   then shows a thin stub. Plan for a runtime dump before reading anything.
2. **Patch the token allocator.** In a dynamic method, member references are runtime-allocated
   tokens. Without recording `GetTokenFor` mappings, the recovered IL is unreadable numbers.
3. **Decrypt the string table too.** Constants you need — the character set, the salt, the lengths —
   arrive through a string decryptor. Dump them in bulk rather than one call at a time.
4. **Read the check as four numbers and a slice.** Length gate, three 32-bit hashes over the
   identity string, a 96-bit concatenation, 19 five-bit groups mapped through a 32-character set,
   compared against a fixed slice of the key.
5. **Re-implement in a second language and compare character by character.** A self-consistent
   generator/verifier pair agrees with itself while both are wrong. This is the step that catches
   the type-width error described below.
6. **Verify against the real thing.** Reflectively invoke the shipped check method with a
   constructed key and require `true`. Then check the activation path stores it.
7. **Check whether the algorithm survived the next major version.** In the archived case v7 shrank
   the protection surface drastically while the check stayed byte-identical — re-running, not
   re-reversing, was the whole second day's saving.

## Traps that cost real time

- **96 bits in a 64-bit integer.** The concatenation `(h1 << 64) | (h2 << 32) | h3` is meaningless
  in `ulong` (`<< 64` is `<< 0`). Use an arbitrary-precision type or keep three words and slice
  across boundaries explicitly. A generator and verifier written the same wrong way both "work".
- **Fewer than 19 groups.** A five-bit reader over a 96-bit value consumes 95 bits, so the 19th
  group's top bit is always zero. If your mapping table is not 32 characters, every group shifts.
- **Random per key, shared per process.** Two keys generated in the same tick from `new Random()`
  are identical. Share one random source across the batch.
- **Writing settings while the app runs.** The app overwrites its settings on exit; a key written
  during the session is rolled back. Detect the process and require it closed.
- **Assuming the target's own check is strict.** A hard-coded blocklist of a handful of hashes is
  not a verification; it is a speed bump. State its size, do not imply it is a defence.

## Evidence this package expects you to produce

- how the method bodies and strings were recovered (executor location, token patch, dump), and the
  version in which the protection surface changed;
- the constants: character set, lengths, positions, and where each came from;
- the three hash functions written out, and the one-line reason each is what it is;
- a worked example: identity string → three hashes → 19 characters;
- a cross-implementation comparison (second language), with the mismatch it caught;
- a reflective call against the shipped check returning `true`, plus the activation-path
  observation;
- the blocklist size and the amount of the key that is never checked — with the arithmetic.

## Reading further

- [docs/method.md](docs/method.md) — the order, and where the analysis usually goes wrong.
- [docs/algorithm.md](docs/algorithm.md) — constants, hashes, slicing, and the worked example.
- [docs/verification.md](docs/verification.md) — cross-implementation, reflective acceptance, and
  the persistence trap.
- Document library `cases/dotnet-license-keygen/` — full walkthrough and the algorithm write-up.

## Tools

`tools/metadata_strings.py` walks the CLR directory to the metadata root and reads the two
heaps a licence check leaves fingerprints in: `#Strings` (type and member names) and `#US`
(user-visible literals). Both are uncompressed, so this needs no decompiler on the machine.

```bash
python3 tools/metadata_strings.py --sample app.dll
python3 tools/metadata_strings.py --sample app.dll --query licen,serial,hardware --out findings/
python3 tools/metadata_strings.py --self-test
```

Output: the runtime version, every metadata stream with its offset and size, the entry counts
of both heaps, the identifiers and literals that match the query, and the row counts of the
table stream (`Module`, `TypeRef`, `TypeDef`, `MethodDef`, `MemberRef`, ...). With `--out` it
also writes `metadata-strings.json`, which is the file to cite in a report.

It stops at the constant table. The key derivation is a comparison in IL; a string dump
cannot produce a key, and this tool does not pretend otherwise. What it gives you is the
vocabulary the assembly was built from, which is what the algorithm write-up then follows.

`--self-test` assembles a managed image with a real BSJB metadata root in a temporary
directory and asserts the version string, the three stream names and their sizes, the
`#Strings` and `#US` contents, and the parsed row counts.
