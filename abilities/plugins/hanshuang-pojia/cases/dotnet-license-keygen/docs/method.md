# Method — recovering an offline key check and proving the reconstruction

No constants here; they are in [algorithm.md](algorithm.md). This is the order that decides whether
the reconstruction is true or merely self-consistent.

## 1. Establish the corpus before the code

Unpack the installer and identify what you are looking at: which assembly holds the check, its
target framework, its size, and which versions are in scope. An archived symbol file, if shipped by
accident, turns type-name guessing into reading.

Two versions are better than one, for a specific reason: the same check surviving a protection
upgrade is the strongest evidence that the algorithm is a product decision rather than an artefact
of one build.

## 2. Classify the protection, because it dictates the tooling

Read the shape of the obfuscation before fighting it:

| symptom | mechanism | what it forces |
|---|---|---|
| method body decompiles to a stub that builds a dynamic method | bodies stripped, encrypted, injected at runtime | runtime dump; static reading is pointless |
| every string is a call into a decryptor with a token argument | string table encrypted | bulk decryption, not one-by-one |
| `while(true) + switch` with constant expressions | control-flow flattening | follow the state variable, not the nesting |
| protection covers 5 methods out of 7000 | deliberately narrow | you can decompile the rest directly |

That last row is worth checking explicitly: if only a handful of methods are protected, the analysis
is small and the temptation to treat the whole assembly as hostile is wasted effort.

## 3. Get real IL: executor, token map, dump

Three moves, in this order:

1. **Find the body executor** — the method that decodes an encrypted blob into standard IL and
   calls `SetCode`. It is usually reached through a singleton field, and its own body is not
   protected (it has to run before anything else is decrypted).
2. **Patch the token allocator.** A dynamic method's references to fields and methods are runtime
   tokens. Record the mapping while the method is built; without it the dumped IL is a list of
   integers.
3. **Dump and disassemble.** Trigger the target method (or call the executor's decode entry) and
   write the IL bytes out beside the token map.

Skipping step 2 is the classic time sink: you get IL you cannot name.

## 4. Read the check as a pipeline of small decisions

The recovered body is short. Do not summarise it — transcribe it as a sequence of gates, each with
its consequence:

- a length gate (exact equality, so the key has a fixed size);
- a normalisation of the identity string (case folding: it changes the hash inputs);
- N hash computations over the identity, each a different recurrence;
- a concatenation into a wide integer;
- a fixed number of bit groups, each mapped through a character set;
- a comparison against a fixed slice of the key;
- an optional blocklist lookup.

Write down *why* each gate exists where it does. The slice position and the group count are the
whole design; the rest is mechanics.

## 5. Two independent implementations, then a third check

Self-consistency is not evidence. A generator and a verifier that share a wrong assumption agree
perfectly. So:

1. implement the transform in the language you are comfortable with, plus a generator and verifier
   built on it;
2. implement it **again** in a second language, from the transcription, not from the first
   implementation;
3. compare outputs character by character over a batch of identity strings.

The archived case caught exactly one class of bug this way — a concatenation that silently degrades
in fixed-width arithmetic — and it was invisible to the first implementation's own tests.

The same trap exists in reverse: a "shared seed" bug makes a batch generator produce identical keys
and looks like the algorithm is insensitive to input. Compare *different* inputs and require
*different* outputs before trusting anything.

## 6. Accept against the shipped check

Cross-implementation agreement proves the two implementations agree. It does not prove they match
the target. The acceptance test must be the target's own code:

- load the installed assembly;
- obtain the check method and invoke it reflectively with the identity string and a constructed
  key;
- require `true`.

Then walk the activation path: which settings are written, under which keys, and whether the
feature gate flips. In the archived case the settings live in a JSON profile, the write happens on
activation, and the application rewrites the file on exit — so the acceptance run must write with
the application closed, or the result is rolled back and looks like a failure.

## 7. Measure the weakness, do not editorialise

Three numbers turn "weak" into a finding:

- how many characters of the key are actually checked, and how many bits that is;
- how many bits of the checked slice are free (a five-bit reader over a 95-bit value leaves the top
  bit constant);
- how many entries the blocklist holds.

Then state the consequence: the key is not an attestation, it is a checksum over the identity —
anyone who knows the identity can compute it, and nothing binds it to a purchase.

## 8. Stop conditions

- Two days on the executor without a token map → the patch is the missing piece, not more reading.
- A reconstruction that matches the target on one identity but not another → the identity
  normalisation is wrong; check case folding before anything else.
- A "verified" key that the UI rejects → the acceptance path differs from the check (settings
  overwritten, or a second validation on load); read the activation path, not the check again.
