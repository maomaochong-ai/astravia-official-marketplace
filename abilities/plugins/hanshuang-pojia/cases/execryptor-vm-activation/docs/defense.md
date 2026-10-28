# Defense — when the verifier is unrecoverable, the status becomes the target

This package exists because a virtualised verification routine is not worth attacking — so the
analyst attacked the place where its result becomes a decision instead. That is the lesson for the
defending side, and it generalises far beyond one protector: **the cheapest way around strong code is
the value it produces.**

## 1. Assume the verifier holds, and design the plumbing for it

If the protection around a check is genuinely strong, the security question moves entirely to what
happens after it. Three properties close the route this package records:

- the result is **not a single mutable variable**; the entitlement is a signed structure that
  downstream code verifies at the point of use;
- the success branch does not itself contain the capability, so reaching it yields a credential that
  the server still has to honour;
- side effects are enumerated — the patch in this package had to be validated at *both* entry points
  and across several consumers, which is a property to keep, not to remove.

## 2. Give the decision more than one observer

The recorded method patches a status and then checks the product's behaviour in several places to
prove the patch holds. Defensively, that is the shape to build: if exactly one consumer reads the
decision, one write wins. Require at least two independent observations before granting something
expensive — the server-side check and the local state must agree, and disagreement is a signal, not a
fallback.

## 3. Keep the channel boring

The method starts by mapping the network channel rather than the check. Any anti-tamper that depends
on a channel is attackable at the channel. Prefer:

- TLS with a pinned CA and certificate validation the platform performs, not hand-rolled;
- responses that are signed, so a proxy sees ciphertext it cannot rewrite usefully;
- request integrity that includes a server nonce, so a replayed "activated" response is worthless.

## 4. What a reviewer should be able to check

- No branch in the authorisation path returns a raw boolean that is stored globally.
- The signed entitlement names product, edition, expiry and account.
- Each entry point (installer, main program) re-derives the decision; neither trusts the other's file.
- The server logs and rate-limits activation attempts per account.

## 5. Verifying the fix

Patch the status exactly as this package did, then work through the report's own verification list.
Pass condition: the gated capability stays unavailable at every entry point, and at least one of them
produces a server-visible rejection. If the patched status still unlocks, the "unrecoverable verifier"
was protecting a value nobody needed to break.

## 6. Residual risk

A protected verifier that gates a local capability is still a local capability. The protection buys
time on the hard path; the plumbing has to make the easy path worthless on its own.
