# Defense — a card key is a server-side redemption, not a client-side state

The whole attack surface in this package comes from one architectural choice: the client decides
that a card key is good, and caches the conclusion. Everything else — the packer, the network
protocol, the branch that was patched — is downstream of that choice.

## 1. Redeem once, on the server, and never cache the verdict

A card key is a bearer token with a monetary value. The correct flow has four properties, and each
one removes a class of attack:

- **single-use, atomically** — the redemption is a conditional write, so two concurrent requests
  cannot both succeed;
- **bound to an account at redemption time** — a screenshot of the key is worthless afterwards;
- **the response is a server-issued entitlement** (signed, with an expiry), not a boolean the client
  stores;
- **the local state is a cache of that entitlement**, re-validated on a schedule, and the gated
  content is fetched with it rather than unlocked by it.

If the client can be made to say "activated" and the product then works offline forever, the scheme
has no server in the loop regardless of what the network trace suggested.

## 2. Do not let the first call decide the rest

The package records a "second decision" pattern: a status from the network becomes a local variable,
and later code reads that variable. Harden it by making the value *unusable without the accompanying
signature* — carry the entitlement as a signed blob and verify at the point of use, not at parse
time. A patched status then produces a verification failure at the next call instead of a silent
upgrade.

## 3. Treat packing as a schedule, not a control

Packing is worth doing because it makes the first hour of analysis expensive, and that hour is
sometimes the difference between a mass exploit and a targeted one. It is not worth doing because it
"protects the licence logic": the logic runs, therefore it is readable, therefore the only question
is whether reading it yields anything reusable. See [method.md](method.md) for where the seams
actually are — the same map tells a defender where to place the checks that matter.

## 4. What a reviewer should be able to check

- The card-key endpoint rejects a second redemption with a distinguishable error.
- The entitlement the client stores carries a signature and an expiry.
- Gated content arrives over an authenticated call, not from a local unlock flag.
- Refund and chargeback paths revoke the entitlement server-side and the client notices.

## 5. Verifying the fix

Replay the recorded attack: patch the status, keep the old entitlement, and attempt to use the
product. Pass condition is that the capability stays unavailable, and that the server sees either no
request (the client knew better) or a rejecting one (the signature did not verify). A build where the
patched client still works, only "without support", has not been fixed.

## 6. Residual risk

Offline use after a legitimate activation is a product requirement in many markets, and it means a
patched client can keep using what it already downloaded. The honest control is the expiry on the
signed entitlement plus a re-check window; anything stronger breaks the offline promise.
