# Defense — one masked integer deciding the edition is the whole problem

This package follows an encrypted credential through a derived key to a predicate and finally to a
single masked integer that the UI reads as the edition. Every hop is defensible in isolation; the
outcome is a product whose edition is a number an attacker can compute.

## 1. Make the plaintext worthless on its own

The method's fifth step exploits the fact that the data is plain somewhere. The defensive counterpart
is to ensure plainness does not equal authority:

- the decoded value must be a **signed** claim, verified after decoding, so a locally computed
  integer has no effect;
- the claim must name the account and the expiry, not only an edition number;
- the value the UI displays must be derived from the verified claim, never from a cached integer.

If the cipher is symmetric — which is typical for offline activation — assume the key is derivable and
treat the ciphertext as public information.

## 2. Do not let the UI be the enforcement point

The recorded attack succeeds by making the dialog show the right edition. If the feature checks the
same integer the dialog checks, masking it unlocks the feature; if the feature asks the server, the
dialog is cosmetic and the finding is downgraded to a presentation bug. Two rules follow:

- dialog and feature must consult the same verified claim, not two copies of an integer;
- the feature's request must be refused by the server when the claim is absent, so the client's
  display state cannot grant anything.

## 3. Choose where the data is decoded carefully

The method explicitly picks the boundary where data is already plain because that is where a breakpoint
is cheapest. Defensively, that boundary should be inside the verification function's scope, so
plaintext never lands in a long-lived buffer or a global that other code can read. Prefer deriving and
verifying in one call, and returning a value the caller cannot write.

## 4. What a reviewer should be able to check

- Decoding and verification happen in one function; no intermediate plaintext is stored globally.
- The edition integer is derived from a verified claim and is not itself the authorisation input.
- The masking scheme is treated as encoding, not as protection, in the design notes.
- Variable parts (edition, expiry) come from a signed source rather than a settings file.

## 5. Verifying the fix

Replay the derivation, compute the same integer, and write it where the original did. Pass condition:
the dialog may show the edition, but the gated capability stays unavailable because the claim behind it
did not verify. If the integer still unlocks features, the UI was the enforcement point and that is the
finding to fix.

## 6. Residual risk

Any offline edition check can be made to display anything. What the vendor can defend is that display
does not equal delivery, and that a forged claim is detectable the next time the client is online.
