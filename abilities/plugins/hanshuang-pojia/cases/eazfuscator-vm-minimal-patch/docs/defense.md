# Defense — strong obfuscation on a weak architecture still loses

The finding here is not "the obfuscator is weak". The obfuscator did its job: recovering the
protected methods took days. The defect is that the answer those methods compute is a **local
decision**, so the cost of recovering it buys a permanent bypass.

## 1. Spend the budget where the decision is, not where the code is

A layer-by-layer cost table (as in [method.md](method.md)) is also a spending plan. If
virtualisation costs days and covers three methods, and those three methods only decide `isPro`, the
money went to protecting a boolean. Compare against the alternative: a two-hour change that makes the
feature call a server which re-derives entitlement. The second is cheaper *and* it cannot be patched.

The general rule: obfuscate code that reveals *how* to attack the server, and remove code that
decides *whether* a user is entitled.

## 2. Treat every obfuscation layer as delay, and say so

Renaming, string encryption, section encryption and virtualisation all increase the time to
understanding. None of them changes the outcome for someone who reaches the decision. Two engineering
consequences:

- the gated feature must not depend on a constant recovered from the protected region — if the
  constant is recoverable, the feature is forgeable;
- the protected region should not contain the only copy of a key that unlocks content; move that to a
  per-session server release.

## 3. Keep the layers honest

The package's method shows the cheapest route is often to *call the obfuscator's own code* rather than
defeat it. Defensively, that means the decryptor is a gadget: any code path that runs it on
attacker-chosen input hands over plaintext. Constrain it — derive keys from values the attacker
cannot choose, and do not expose a general-purpose "decrypt this blob" entry point through reflection
or a public API surface.

## 4. What a reviewer should be able to check

- Every virtualised method's effect can be stated as data, not as permission.
- Reflection entry points are trimmed; no public method decrypts arbitrary input.
- Section-encryption keys are derived per build, not stored once.
- The vendor can enumerate what each layer protects and what it would cost to remove.

## 5. Verifying the fix

Re-run the patch from this package against the rebuilt product. The pass condition is that the
feature is still gated after the local decision has been forced — because the decision no longer
grants anything. A build where the same three-method patch works again has spent the obfuscation
budget twice for the same non-result.

## 6. What to tell the vendor

Not "strengthen the VM". The message is that a virtualised boolean is still a boolean, that the
protection budget should shift to the server side of the feature, and that the obfuscation remains
valuable for the parts of the product that are genuinely worth delaying (protocol logic, key
derivation), not for entitlement.
