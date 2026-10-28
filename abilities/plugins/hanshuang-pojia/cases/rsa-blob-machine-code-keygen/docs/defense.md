# Defense — a signature check that accepts any correctly-signed blob is an oracle

The package decides whether a signature-blob activation can be keygenned, and the defensive reading is
about what the verifier was asked to prove. It proved that some key with the right shape signed
something. It did not prove that the *vendor* issued *this* licence to *this* customer for *this*
product.

## 1. Bind the message before worrying about the modulus

A keygen is cheap when the signed message is a licence blob the attacker assembles. Make assembly
useless:

- the signed payload names product id, edition, customer/account id, issue time, expiry and a device
  binding, all canonicalised (a fixed field order and encoding, not "whatever the parser accepts");
- the verifier rejects unknown or duplicate fields instead of ignoring them — parser differentials are
  the usual way a "signed" payload gets reinterpreted;
- the payload carries a server-issued serial that the server can look up, so the first online moment
  reveals a locally minted blob.

## 2. Give the vendor a revocation surface

Offline activation without revocation means one leaked key pair is a permanent licence for everyone
who has the blob. Add, in order:

- a revocation list checked whenever the client is online, with the result cached for a bounded time;
- a maximum offline window after which the client must reach the server once (this is a product
  decision, and it should be stated as one);
- a server-side signal when a serial is seen from more devices than its edition allows.

## 3. Size is not the security property

The recorded method spends time sizing the modulus before attempting anything, because a short key
makes the route easy. The defensive conclusion is *not* "use a bigger key" — 2048-bit RSA with an
unconstrained message and no revocation is worse than a modest key with a bound, revocable, expiring
claim. Pick the algorithm for platform support and put the engineering into the message and the
lifecycle.

## 4. Trial clocks are not clocks

The package's own note about the trial clock is the general lesson: any expiry the client computes
from local time is advisory. Keep a server-recorded first-seen timestamp, use a monotonic counter for
elapsed time, and treat rollback as a signal rather than a fallback.

## 5. What a reviewer should be able to check

- The verifier's accepted message is fully specified and versioned, and unknown versions fail closed.
- The same blob used twice from different accounts produces a server-visible anomaly.
- Revocation is reachable in one request and its absence has a bounded cost.
- No private key material is present in the shipped artefact, including in tests and samples.

## 6. Verifying the fix

Take the keygen from this package's method and run it against the hardened build. Pass condition: the
blob is either rejected outright, or accepted locally and then refused by the server at the first
online opportunity. The second outcome is the interesting one because it means the finding was
correctly rated as "client accepts a forgeable artefact" rather than "the product is unlicensed".

## 7. Residual risk

An offline product cannot verify issuance without a network. It can make forgery require the vendor's
key, and it can make reuse visible the moment the network returns.
