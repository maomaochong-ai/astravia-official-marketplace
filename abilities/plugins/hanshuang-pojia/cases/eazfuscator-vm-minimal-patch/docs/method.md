# Method — when the protection is strong and the architecture is weak

## 1. Score the layers, then choose the cheapest route to the *finding*

Write this table before touching the binary. It is a work plan and a budget at once.

| layer | what it hides | route | cost |
|---|---|---|---|
| renaming | names | plain decompilation after load | minutes |
| string encryption | constants | reflect the client's own decryptor | minutes |
| assembly code encryption | one section's bytes | reproduce the keystream derivation | hours |
| virtualisation | a few critical methods | analyse the container, not the ISA | days |
| custom cipher | business payloads | parameter recovery + test vectors | hours |
| anti-debug | the analyst | usually absent in effect | minutes |

The order in the table is also the order of *value*, not the order of difficulty. In the source engagement,
reading the entitlement took minutes once strings were dumped; breaking the virtualisation was days of work
and contributed nothing to the patch. Do the cheap layers first and let them tell you whether the expensive
one is needed at all.

## 2. Call the obfuscator's own code instead of defeating it

A string decryptor under control-flow flattening is full of `if (0 == 0) {}` noise. Reimplementing it is a
trap. Instead:

```csharp
Assembly a  = Assembly.LoadFrom(sample);          // one process per variant
Type     t  = a.GetTypes().First(x => /* static string Decrypt(int) */);
MethodInfo m = t.GetMethod("…", BindingFlags.Static | BindingFlags.NonPublic);
for (int id = 0; id < N; id++) map[id] = (string)m.Invoke(null, new object[] { id });
```

The result is exact by construction, because it is the same code the application runs.

**One process per variant.** All builds in a family share the assembly identity, so a second
`Assembly.LoadFrom` inside the same process returns the first instance and your measurement silently belongs
to the wrong file. This cost a wasted afternoon in the source engagement.

## 3. Section encryption: reproduce the derivation, then exploit the direction

The encrypted section's keystream is a function of the *other* sections' content, which doubles as the
anti-tamper check. Two properties matter:

1. **The keystream advances on plaintext, not ciphertext.** So decryption and encryption are the same loop
   with a different output, and you can implement `decrypt → edit → encrypt` and land back on a file that is
   byte-identical outside your patch sites.
2. **The derivation is deterministic from the file.** Reproduce it and you never need the key.

That second property is also why a byte-exact re-encryption is the *stealthiest* possible patch: no section
grew, no checksum moved, and any tool comparing "modified region" sees only your four bytes.

## 4. Read the gate as IL; treat the VM as a separate question

Obfuscators rename and encrypt, but they rarely virtualise *everything* — it is expensive at runtime. So the
entitlement is usually still ordinary IL:

```
// premium marker on a settings item
ldc.i4.1
call     <MarkAsPro>

// the single predicate everything consults
ldarg.0
ldfld    bool <cachedPro>
ret
```

In the source engagement: 26 settings, **4** marked premium at construction, **8** managed call sites of one
`isPro()`-equivalent predicate (activation page, optimiser flow ×2, a view-model editability check, the
settings list builder, and three page-level gates).

Patch the predicate to return a constant and set the four markers — that is the minimal set. Everything else
that reads the predicate follows for free.

## 5. Rank by what each defect actually grants

Three findings, three different strengths, and a report that conflates them is wrong even when its facts are
right:

| finding | defect | what it grants |
|---|---|---|
| local premium decision | CWE-602 | the paid feature set, once the predicate is constant |
| client-readable entitlement state | CWE-863 | feature toggles with no binary change at all |
| fail-open credential check | CWE-287 | "verification passed" without a request — but often not the badge |

The third is the instructive one. The credential check treats `null`, `""` and `"null"` as "nothing to
verify" and short-circuits, which is a textbook fail-open. But the premium badge in the source engagement was
driven by a **server response field**, so a locally-passed check did not activate it, and some flows threw
`IndexOutOfRangeException` afterwards. Write that down. A finding that is architecturally serious and
operationally incomplete is still worth reporting — as exactly that.

## 6. Patch tooling: profiles, original-byte checks, no stacking

```
profile A (control)      : 4 premium markers only            → predicate stays False
profile B (recommended)  : A + the master switch             → predicate True
profile C (complete)     : B + credential shortcut           → True, plus the side effects above
```

Rules that made the tool trustworthy:

- **always start from the pristine sample** (idempotent by construction, no stacking);
- **verify the original bytes at every site before writing** — a wrong offset then fails loudly instead of
  corrupting the section;
- **print the profile's site list and a hash of the output** so two runs can be compared;
- **ship the inverse**: registry script with `-Restore`, and a rebuild-from-original path.

## 7. Verification that survives review

- reflection probe returns `False` on the original and `True` on profile B — a two-valued, objective claim;
- the patched file differs from the original **only** at the listed offsets (byte diff, not "looks fine");
- the same sha-256 anchored to the version under test, so a version bump invalidates the patch rather than
  producing a mystery;
- each profile's user-visible effect recorded separately, including the ones that did *not* change.

## 8. What to tell the vendor

1. **Fail-closed.** Empty, missing or malformed credentials ⇒ failure. "Cannot decide" is never "allowed".
2. **Local state is not entitlement.** Preferences may store user choices; entitlements come from a signed
   server-issued credential.
3. **Signed, hardware-bound, revocable credentials** (Ed25519 / RSA-PSS) instead of a bundled symmetric key.
4. **HTTPS with pinning, nonce + timestamp + request signature**; remove the plaintext endpoint and the
   bare-IP fallback.
5. **Tamper detection that refuses to run.** The current mechanism derives its keystream from other
   sections, which is good design — but its failure mode is "behave oddly", which is not enforcement.

The one-line lesson for the reader: **days spent on the protection layer bought nothing, because the
architecture let a local boolean decide the business.** Hardening should start from the decision, not from
the obfuscator settings.
