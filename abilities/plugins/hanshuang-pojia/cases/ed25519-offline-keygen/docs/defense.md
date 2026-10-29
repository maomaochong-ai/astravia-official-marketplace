# Defense — the verification key is public, so the trust anchor must be something else

This package replaces the embedded verification key with one the analyst controls, then mints codes
the stock client accepts. The mechanism is not a flaw in the algorithm; it is the consequence of
putting the trust anchor inside the thing being trusted.

## 1. A key you ship is a key an attacker owns

Whether the key sits in a resource, an assembly or a constant, replacing it is a patch, and a patch is
minutes. The design consequence is blunt: **a code accepted purely because a shipped public key signed
it is a code anyone can make.** Two ways out exist, and good products use both:

- **bind the documented fields** — the signed message must cover product, edition, customer, issue
  date, expiry and a device/account binding, so a re-signed code cannot be re-targeted;
- **anchor part of the check outside the binary** — activation against the server once, then a
  short-lived signed entitlement; the offline code becomes an onboarding step rather than the
  permanent proof.

## 2. Reproduce device binding on purpose

The package records a device-binding step because the client derived a machine identifier and folded
it into the message. That is the right instinct and it is often implemented too weakly:

- derive the identifier from a hardware-backed key where the platform allows it, not from a
  concatenation of serial numbers and a volume id (both of which are clipboard-editable);
- sign a **server-chosen challenge** with that key, so the binding proves possession rather than
  naming a machine;
- store the binding server-side, so a moved licence is visible instead of silently accepted.

## 3. Persistence is part of the contract

Activation that survives a restart must survive *correctly*: writing the accepted state into a
registry blob or a config file is fine only if the next read re-verifies the signature. If the client
writes "valid" and later reads "valid" without re-checking, the patch has a second, cheaper target
than the verifier.

## 4. What a reviewer should be able to check

- The public key is loaded from a signed, integrity-checked resource and its fingerprint is pinned
  server-side for the product's lifetime.
- The signed payload includes every field the UI displays (edition, expiry) — nothing is display-only.
- Activation records the binding server-side and the record is examined on the next online call.
- Replay of an old code into a newer product version fails, and the failure is explicit.

## 5. Verifying the fix

Use the key pair produced in this package's run against the hardened build. Acceptable outcomes: the
client rejects the code, or it accepts it and the server refuses the resulting entitlement. Then
restart, and check the same thing again — the persistence path is where fixes usually leak.

## 6. Residual risk

A fully offline product with a shipped public key cannot stop a local verifier patch. The guarantee
worth stating is narrower: stock clients cannot be made to accept third-party codes, and codes cannot
be moved between accounts or machines without a server-visible failure.
