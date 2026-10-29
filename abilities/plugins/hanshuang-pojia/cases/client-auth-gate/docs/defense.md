# Defense — making a client-side entitlement gate uninteresting

The finding in this package is a decision the client makes about itself: a boolean, a cached receipt
or a clock comparison, and the feature reads it. There is no patch that fixes that. The fix is that
the decision stops being the client's to make, and the same rule applies to every product that ships
an offline-first entitlement model.

## 1. Move the authority, not the check

"Verify the receipt server-side" is the whole answer and it is usually applied to the wrong place —
people add a second check in the client and leave the first one load-bearing. What matters is that
the server refuses to serve gated data to an unentitled caller, and that the client's local state
only ever controls what is *rendered*, never what is *delivered*. Two consequences worth stating in
the design document:

- every gated API call carries the entitlement in the request and the server re-derives it;
- cached content that was fetched while entitled is either re-validated with a short TTL or is
  re-fetched, never trusted indefinitely because it sits on disk.

## 2. Make the local state verifiable, not just present

A local flag is acceptable when it is a *cache of a signed statement*. Sign the entitlement payload
(offline-capable products need exactly this), bind it to the account and a device key, and give it an
expiry. Then forging it requires the signing key rather than a debugger, and the severity of "the
client trusts a local flag" drops to "the client trusts a signed flag it should also re-check".

Keep the verification in one function and call it from everywhere. When it is duplicated, one copy
will drift and the drift is what an auditor reports.

## 3. What a reviewer should be able to check

- The gate function has an obvious owner, one implementation, and every caller goes through it.
- The server-side counterpart exists and rejects an unentitled request with a specific error, not a
  generic 403 that a client could confuse with a transient failure.
- Nothing in the request body lets the client *state* its entitlement (`is_pro`, `plan`, `credits`).
  If those fields exist for telemetry, they must be ignored by the authorisation path — and the code
  should say so next to the parse.
- Trial and expiry decisions read a server time or a monotonic timer, not a settable system clock.

## 4. Detection that survives a rebuild

The interesting signal is not a patched byte, it is a *contradiction*: a client presenting an
entitlement whose signature does not verify, or a plan value that the account's history cannot
explain. Ship a server-side counter for those. It catches the offline patch (which produces
signature failures on the next online call) and the request-tampering case (which produces plan
values with no purchase behind them) with the same mechanism, and it costs a log line.

Client-side integrity checks are worth having but should be understood as friction, not control:
they raise the cost of a debugger and do nothing against a memory patch. Do not let their presence
justify leaving the decision local.

## 5. Verifying the fix

Re-run the attack against the fixed build. The pass condition is not "the hook no longer works" — a
hook can always be made to work locally. The pass condition is that the capability the flag gates
still does not function, because the data behind it was never delivered. If patching the flag makes
the feature work, only the UI was gated and the finding was understated in the original report.

## 6. Residual risk to write down

A fully offline product with local content *cannot* prevent a determined user from reading content
they already have. Say that plainly in the threat model instead of implying the local check is a
control. The defensible claim is narrower and honest: entitlements cannot be minted, and gated data
is not delivered to unentitled callers.
