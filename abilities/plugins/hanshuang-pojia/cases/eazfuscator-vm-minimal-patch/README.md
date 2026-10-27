# Precedent — protection strength is not security architecture

## When this package applies

- A .NET Framework desktop application (typically WPF) protected by a **commercial obfuscator in full mode**:
  symbol renaming, string encryption, assembly code encryption, and code virtualisation.
- Static analysis is expensive by design: decompiled identifiers are unreadable, string constants are
  absent from the metadata, one PE section is XOR-encrypted, and the security-relevant methods are
  compiled into a proprietary bytecode executed by an embedded interpreter.

The finding this package exists to teach is not "we broke the VM". It is:

> **Protection strength and security architecture are orthogonal.** A build can raise the cost of reading
> the code from hours to days and still let a local boolean decide who gets paid features.

The second lesson is about the patch shape. Once the code-encryption layer is understood, the *safest*
modification is a decrypt → edit a few bytes → re-encrypt cycle that reproduces the original file byte for
byte everywhere except the patch sites.

This is not the package for a native binary ([`native-islicensed-patch`](../native-islicensed-patch/README.md)),
for a JVM target ([`java-agent-dll-hijack`](../java-agent-dll-hijack/README.md)), or for a Themida-wrapped
.NET build whose methods are stubbed at load time
([`themida-dotnet-delegate-recovery`](../themida-dotnet-delegate-recovery/README.md)).

## Shape of the work

1. **Enumerate the layers before touching any of them.** Renaming, string encryption, assembly encryption,
   virtualisation, custom symmetric cipher, anti-debug. Write the table down with one row per layer and the
   restoration route you intend to use; that table is the work plan, and it also prevents the classic
   mistake of attacking virtualisation when the gate is three lines of IL.
2. **Prefer calling the client's own runtime over reimplementing its obfuscation.** A string decryptor is
   usually control-flow flattened; instead of un-flattening it, reflect over the assembly, find
   `string Decrypt(int id)`, and walk the id space. The source engagement dumped 7,806 of 7,806 strings this
   way. Load each variant in a **separate process** — same assembly identity means `Assembly.LoadFrom`
   returns the already-loaded instance and you will silently measure the wrong build.
3. **Reverse the section encryption statically, and note what its key depends on.** The encrypted section's
   keystream is derived from the *content hash of the other sections* — which is also the anti-tamper
   mechanism. Reproducing the derivation exactly is what makes a byte-exact re-encryption possible.
4. **Check whether the anti-tamper actually enforces anything.** In the source engagement the derived
   keystream failed when other sections changed, and the program kept running with wrong behaviour instead
   of refusing to start. "Fail-open tamper detection" is a finding in its own right.
5. **Read the entitlement as IL, not as a VM problem.** In an obfuscated build the interesting gate is
   usually a plain managed method that survived obfuscation: a predicate returning a cached flag, and a
   handful of `stfld`/`ldc.i4.1` sites that mark settings as premium. Four flag writes plus one predicate
   was the entire minimal patch — 15,380 decrypted method bodies were available and none of them needed
   editing.
6. **Rank the findings by what they actually grant.** A fail-open credential check
   (empty or `"null"` ⇒ "nothing to verify") is an architectural defect, but it may *not* light up the
   premium badge, and it may throw `IndexOutOfRangeException` downstream. Say so explicitly instead of
   overstating it: the honest ranking is more useful than a bigger number.
7. **Ship profiles, not one patch.** Three tiers let a reader see what each site contributes: control (only
   the premium flags, predicate stays `false`), recommended (plus the master switch ⇒ `true`), complete
   (plus the credential shortcut). Each profile is a byte-verified list of sites.
8. **Make the tool idempotent and reversible.** Always regenerate from the pristine sample; never patch an
   already-patched build. Validate every site's original bytes before writing, and provide the inverse
   script.

## Traps that cost real time

- **Attacking the VM first.** Days of interpreter work, while the entitlement sits in IL you can read after
  the string layer is dumped.
- **Reimplementing the string decryptor.** Control-flow noise (`if (0 == 0) {}`) is designed to make this
  expensive; reflect instead.
- **Sharing one process across variants.** Same identity, cached instance, wrong conclusion.
- **Patching the encrypted bytes directly.** You will scramble the section; the decrypt→edit→re-encrypt
  route exists precisely to avoid that.
- **Assuming the badge follows the predicate.** In the source engagement the home-page badge read a
  server response field, so a locally-true predicate did not activate it. Verify the user-visible effect at
  every profile, not just the boolean.
- **Treating local registry state as configuration.** 71 plaintext booleans under `HKCU` are not
  preferences when the client also consults them as entitlement. That is the CWE-863 finding, and it needs
  no binary patch at all.

## Evidence this package expects you to produce

- the layer table with per-layer restoration route and what each one actually cost;
- counts: types decompiled, strings dumped, method bodies decrypted, VM bytecode bytes, member records;
- the minimal patch set as `offset | original bytes | patched bytes | effect`, with the original-bytes check;
- the three profiles and the runtime predicate value observed for each;
- a file-level claim: patched file differs from the original only at the listed offsets;
- the fail-open and registry findings written separately, with the limits of what each grants.

## Reading further

- [docs/method.md](docs/method.md) — the order of work and why the minimal patch wins.
- [docs/protection-layers.md](docs/protection-layers.md) — the algorithms: section keystream, the RSA/positional
  two-layer VM container, the name-as-offset tokenisation, the custom cipher.
- Document library `cases/eazfuscator-vm-minimal-patch/` — the full walkthrough this digest came from.
