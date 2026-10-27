# Proving the reconstruction

An algorithm that "looks right" and reproduces one example is the normal failure mode of this work.
Three independent checks, in this order, is what turns it into a result.

## 1. Two implementations, written separately

Write the transform twice, from the transcription rather than from the first version:

- one implementation in the language whose arithmetic you trust least (`C#`, `ulong`, `int`);
- one in a language with arbitrary-precision integers by default (`Python`).

Then compare, character by character, over a batch of identity strings:

```
for identity in batch:
    a = impl_a.checksum(identity)
    b = impl_b.checksum(identity)
    assert a == b, (identity, a, b, first_differing_index)
```

Report the first differing index, not just failure: the index localises the bug to one group, which
maps to one bit range, which maps to one shift in the concatenation.

### What this caught

The `C#` version computed `(h1 << 64) | (h2 << 32) | h3` in `ulong` and produced a checksum whose
first characters were drawn from `h1 << 0`. Its own generator/verifier pair agreed with itself
perfectly — both used the same expression — and only the Python comparison, which had 96-bit
integers natively, exposed the difference.

**Generalise it:** any algorithm with a wide concatenation must be implemented once in a language
where the width is not a choice. Fixed-width arithmetic fails silently by design.

## 2. One worked example, hand-checkable

Reproduce every intermediate value for one identity string: three hashes, the concatenation, and the
19 characters. Keep it in the write-up. If a reader cannot re-derive at least one character by hand
from the group table, the transcription is not yet clear enough to be trusted.

The archived example's three hashes and checksum are recorded in
[algorithm.md](algorithm.md); its identity string is redacted, which is why the numbers are labelled
as recorded observations rather than reproducible values.

## 3. Acceptance against the shipped check

The only test that matters. Two ways, in increasing fidelity:

**Reflective invoke.** Load the assembly, find the check method, call it with the identity string
and a constructed key, require `true`. Fast, repeatable, and it exercises the real IL rather than
your model of it.

```
var type = assembly.GetType("<obfuscated or clear name>");
var m = type.GetMethod("CheckLicense", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
bool ok = (bool)m.Invoke(null, new object[] { identity, key });   // require true
```

If the type name is obfuscated, resolve it by method signature rather than by name — the parameter
list `(string, string) → bool` is usually unique in that assembly.

**Full path.** Press the activation button with the constructed pair and observe that the feature
gate flips. This also reveals the second half of the problem: where the result is persisted.

## 4. The persistence trap

In the archived case the activation path is: local check passes → optional HTTP POST → write the
licence values into a JSON settings profile. Two properties of that sequence matter:

- **The POST is not required.** The offline path completes on its own; a blocked network does not
  prevent activation. Worth verifying rather than assuming, because it also means the client alone
  decides.
- **Settings are rewritten on exit.** The application holds settings in memory and writes them back
  when it closes, so a key written by an external script while the app is running is overwritten by
  the app's own (pre-activation) copy. Close the application, write, then start it.

The second one produces the most confusing failure in this shape: the key is valid, the check
returns `true`, and the UI still shows unlicensed. The check is not the problem; the write ordering
is.

## 5. Version check, not version assumption

Before redoing any of this against a newer build, run the old reconstruction against the new
binary's check:

- decompile the new check method;
- diff the IL against the previous version;
- if identical, the old key generator works unchanged.

In the archived case the protection surface shrank dramatically between major versions — from
whole-assembly method encryption to five protected methods — while the check itself stayed
byte-identical, and a key generator written for the older version passed on the newer one with zero
adaptation. The saving came entirely from **testing that assumption instead of reversing again**.

The corollary: a protection upgrade is not evidence of an algorithm change. Look at the five
methods, not at the protector's version number.

## 6. What to report as unverified

- Whether any server-side validation exists for the same key. The offline path does not consult one;
  that says nothing about a separate online entitlement endpoint.
- Whether newer builds add a signature. Absence in the versions examined is not a promise.
- Whether the blocklist is authoritative. Six entries, no revocation channel: state the count and
  stop there.
